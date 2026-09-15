// Client Side QTCT SVGMap Renderer Class
// Programmed by Satoru Takagi
//
// License: (MPL v2)
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0.
// If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.
//
// ClientSideQTCTモジュールを用いてSVGMapコンテンツの描画を動的に行うモジュール
// この実装は、ちゃんとしたモジュールとして別ファイル化して使いまわせるようにすべき
// rev18 ClientSideQTCT impl
// Ported from river/riverr2022/CCTV
//
// 2024/08/01 : クラス化
//
// 2026/04/20 : [Refactor 2026]: ESM Class化。旧 QTCTrendererClass_r1.js + QTCTrenderer.js を統合し、
// windowオブジェクトへの依存を排除してDI（依存性注入）設計に変更。
// 2026/09/03 : 生成済みQTCTzipアーカイブによる即時レンダリングに対応(ZIPアーカイブからの非同期タイリングと遅延レンダリングを統合)

import { unzip, HTTPRangeReader } from './unzipit.module.js';
import { ClientSideQTCT } from './ClientSideQTCT.js';

export class QTCTLayerRenderer {
	#generation = 0;
	constructor(options) {
		// [Refactor 2026]: フレームワーク環境の注入。
		// window.svgMap や window.svgImage などを直接参照するのをやめ、コンストラクタの引数から受け取る
		this.svgMap = options.svgMap;
		this.svgImage = options.svgImage;
		this.svgImageProps = options.svgImageProps;
		this.layerID = options.layerID;

		// [Refactor 2026]: 外部ロジックの注入。
		// CsvMapperクラスとの循環参照を防ぐため、アイコンIDや色を決定する「関数」だけを外から渡してもらう
		this.iconIdEvaluator = options.iconIdEvaluator || (() => "p0");
		this.colorIndexEvaluator = options.colorIndexEvaluator || ((rawData) => {
			let iconId = this.iconIdEvaluator(rawData);
			// 文字列の末尾にある数字を抽出（"p0" -> 0, "p12" -> 12）して色番号を推論
			let match = String(iconId ?? "").match(/\d+$/);
			return match ? parseInt(match[0], 10) : 0;
		});
		
		// タイトルを動的に生成する関数を受け取れるようにする 2026/4/21
		this.titleEvaluator = options.titleEvaluator || null;
		this.createPoi = options.createPoi || null;
		this.csvCodec = options.csvCodec || null;
		
		this.clientSideQTCT = new ClientSideQTCT();
		this.qtctMapData = null; // ここにQuadTreeCompositeTilingされたデータが格納される
		this.csvSchema = null;
		
		// このcolorはPOIのビットイメージの実際の色に対応させている。csvXhr_r*.svgのdefs #p?で定義
		// (png読んで色を統計し自動設定すと良いけど面倒なのでひとまずハードコード・・)
		this.colors = [[0x1d,0x64,0xbb],[0x1a,0xb9,0xb7],[0x71,0xf0,0x49],[0xf0,0xea,0x4a],[0xf0,0x49,0x49],[0xf5,0x4f,0xf7]];
		// 2026/09/03
		this.isZipMode = false;
		this.loadingTiles = {};
		this.toBeRemovedTiles = [];
		this.zipArchive = null;
		this.zipArchivePath = null;
	}

	// initCsvでこちらを呼ぶ
	async buildQTCTdata(csv, schema, progressCBF, removeLatLngMeta) {
		this.reset();
		const generation = this.#generation;
		const engine = this.clientSideQTCT;
		console.log("buildQTCTdata:", schema);
		this.csvSchema = schema;
		
		let pixelColorOpt;
		if (typeof schema.defaultIconNumber === "string") {
			// カスタムアイコンの場合は、defaultIconNumberにimageのdataURLがあり、これから無条件でのピクセルカラーを設定する
			pixelColorOpt = await this.#getCustomIconMainColor(schema.defaultIconNumber);
		} else {
			pixelColorOpt = {
				table: this.colors,
				evaluator: (rawData) => {
					// [Refactor 2026]: windowObject.csvMapper.getIconId(..., true) への依存を排除し、
					// 注入された colorIndexEvaluatorのメタデータを渡して実行する
					return this.colorIndexEvaluator(rawData[2]);
				},
				order: "Descending",
			};
		}
		
		// スキーマに maxTilePoints の指定があればそれを使い、無ければデフォルトの120にする
		let maxPoints = schema.maxTilePoints !== undefined ? schema.maxTilePoints : 120;
		
		if (generation !== this.#generation) return false;
		const data = await engine.doQTCT(csv, (sourceRow) => {
			const col = [...sourceRow];
			let x, y;
			if (removeLatLngMeta) {
				if (schema.latCol > schema.lngCol) {
					y = col.splice(schema.latCol, 1)[0];
					x = col.splice(schema.lngCol, 1)[0];
				} else {
					x = col.splice(schema.lngCol, 1)[0];
					y = col.splice(schema.latCol, 1)[0];
				}
			} else {
				x = col[schema.lngCol];
				y = col[schema.latCol];
			}
			//console.log(x,y,col);
			return [x, y, col];
		}, { maxTilePoints: maxPoints, pixelColor: pixelColorOpt, progressCBF: (message) => {
			if (generation === this.#generation) progressCBF?.(message);
		} });
		if (generation !== this.#generation) return false;
		this.qtctMapData = data;
		return true;
	}

	#invalidateLoads() {
		++this.#generation;
		this.isZipMode = false;
		this.zipArchive = null;
		this.zipArchivePath = null;
		this.loadingTiles = {};
		this.toBeRemovedTiles = [];
	}

	// データのみ消去する。進行中の処理は旧世代として破棄する。
	clearData() {
		this.#invalidateLoads();
		// 古いdoQTCTが再開しても、新しいエンジンを変更できないようにする。
		this.clientSideQTCT = new ClientSideQTCT();
		this.qtctMapData = null;
		this.csvSchema = null;
	}

	// 再利用・データ切替時の共通後始末。defsや保護グループは保持する。
	reset() {
		this.clearData();
		this.removePrevTiles();
	}

	// window.preRenderFunction に直接代入されるなど、外部からコールバックとして呼ばれても this のコンテキストが失われないようにバインド。
	preRenderFunction = () => {
		if (this.isZipMode) {
			this.asyncPreRenderFunction();
			return;
		}
		// [Refactor 2026]: window.useQTCT のチェックは廃止。レンダラーを呼ぶかどうかの判断は上位クラス(CsvMapper)に委ねる
		if (!this.qtctMapData) return; 
		
		let level = Math.floor(Math.LOG2E * Math.log(this.svgImageProps.scale) + 7.25);
		let gvb = this.svgMap.getGeoViewBox();
		
		let tileSet = this.clientSideQTCT.getTileSet(gvb, level);
		
		this.removePrevTiles(tileSet); // 前のステップで表示していた要素のうち、不要なものを削除
		
		for (let tkey in tileSet) {
			let tileData = this.qtctMapData[tkey];
			
			let tileG = this.svgImage.createElement("g");
			tileG.setAttribute("id", "T" + tkey);
			this.svgImage.documentElement.appendChild(tileG);
			
			if (tileData instanceof Array) { // 実データ
				this.#setPoiTile(tileData, tileG);
			} else { // String imageURI
				let geoBBox = this.clientSideQTCT.getGeoBound(tkey);
				this.#setImageTile(tileData, geoBBox, tileG);
			}
		}
	}

	#setPoiTile(tileData, tileG) {
		for (let poiDat of tileData) {
			// [Refactor 2026]: windowObject.csvMapper... への直接アクセスをやめ、関数で解決
			let iconId = this.iconIdEvaluator(poiDat[2]);
			
			let titleStr = "";
			// titleEvaluatorが渡されていればそれを優先実行
			if (typeof this.titleEvaluator === "function") {
				titleStr = this.titleEvaluator(poiDat[2]);
			} else if (this.csvSchema?.titleCol >= 0) {
				titleStr = poiDat[2][this.csvSchema.titleCol];
			}
			
			// titleEvaluator が無い時だけ titleCol2 の連結処理をする
			if (!this.titleEvaluator && this.csvSchema?.titleCol2 >= 0) {
				let ts2 = poiDat[2][this.csvSchema.titleCol2];
				if (ts2 !== "undefined") {
					if (titleStr !== "undefined") {
						titleStr += " " + ts2;
					} else {
						titleStr = ts2;
					}
				}
			}
			const poi = createPoiElement({
				svgImage: this.svgImage,
				longitude: poiDat[0], latitude: poiDat[1], metadata: poiDat[2],
				iconId, title: titleStr, createPoi: this.createPoi, csvCodec: this.csvCodec
			});
			if (poi) tileG.appendChild(poi);
		}
	}

	#setImageTile(tileData, geoBBox, tileG) {
		let img = this.svgImage.createElement("image");
		img.setAttribute("xlink:href", tileData);
		img.setAttribute("style", "image-rendering:pixelated");
		img.setAttribute("x", geoBBox.x * 100);
		img.setAttribute("y", -(geoBBox.y + geoBBox.height) * 100);
		img.setAttribute("height", geoBBox.height * 100);
		img.setAttribute("width", geoBBox.width * 100);
		tileG.appendChild(img);
		
		/**
		var rect = this.windowObject.svgImage.createElement("rect");
		rect.setAttribute("x",geoBBox.x*100);
		rect.setAttribute("y",-(geoBBox.y+geoBBox.height)*100);
		rect.setAttribute("height",geoBBox.height*100);
		rect.setAttribute("width",geoBBox.width*100);
		rect.setAttribute("vector-effect","non-scaling-stroke");
		rect.setAttribute("fill","none");
		rect.setAttribute("stroke","red");
		rect.setAttribute("stroke-width","0.5");
		tileG.appendChild(rect);
		**/
	}

	// 前のステップで表示していた要素のうち、不要なものを削除＆今のステップでも使うものは流用する処理
	removePrevTiles(tileSet) {
		for (const group of this.#getTileGroups()) {
			const tileKey = group.getAttribute("id").slice(1);
			if (tileSet?.[tileKey]) {
				delete tileSet[tileKey];
			} else {
				group.remove();
			}
		}
	}

	// ルート直下のQTCTタイルだけを対象とし、defsや補助図形は保持する。
	#getTileGroups() {
		return Array.from(this.svgImage.documentElement.children).filter(
			(element) =>
				element.nodeName === "g" &&
				element.getAttribute("id")?.startsWith("T") &&
				element.getAttribute("data-preserve") !== "qtct-exclude"
		);
	}

	// this.qtctMapDataからCSVデータを生成する 2024/6/21-
	// this.qtctMapDataが不完全な場合はどうするか？
	restoreCsvData() {
		let csvArray = [];
		if (!this.csvSchema) return;
		csvArray.push(this.csvSchema.property);
		for (let tileKey in this.qtctMapData) {
			if (tileKey === "tileIndex" || tileKey === "csvSchema") {
				continue;
			}
			let tileData = this.qtctMapData[tileKey];
			if (typeof tileData === "string") {
				continue;
			}
			for (let oneRec of tileData) {
				// var lng = oneRec[0];
				// var lat = oneRec[1];
				let csvLine = oneRec[2];
				csvArray.push(csvLine); // csvLine.join(",")のほうが良いか？
			}
		}
		return csvArray;
	}

	getQtctMapData(completenessCheck) {
		if (completenessCheck) {
			let completeness = true;
			if (!this.qtctMapData || !this.qtctMapData.tileIndex) return null;
			
			for (let key in this.qtctMapData.tileIndex) {
				if (!this.qtctMapData[key]) {
					completeness = false;
					break;
				}
			}
			if (completeness) {
				return this.qtctMapData;
			} else {
				return null;
			}
		} else {
			return this.qtctMapData;
		}
	}
	
	setQtctMapData(qtctMapDataSrc) {
		this.#invalidateLoads();
		this.qtctMapData = qtctMapDataSrc;
	}

	// ported from QTCTrenderer_r3.js
	#getCustomIconMainColor(imgURL) {
		return new Promise((okCallback, ngCallback) => {
			let img = document.createElement("img");
			try {
				img.src = imgURL;
				img.addEventListener("load", () => {
					let canvas = document.createElement("canvas");
					let ctx = canvas.getContext("2d");
					canvas.width = img.naturalWidth;
					canvas.height = img.naturalHeight;
					ctx.drawImage(img, 0, 0);
					let imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
					let data = imageData.data;
					let tR = 0, tG = 0, tB = 0, tPx = 0;
					
					for (let i = 0; i < data.length; i += 4) {
						if (data[i+3] > 128) { // 透明度が高いものは採用しない
							let pxR = data[i];
							let pxG = data[i+1];
							let pxB = data[i+2];
							let imin = Math.min(pxR, pxG, pxB);
							let imax = Math.max(pxR, pxG, pxB);
							let saturation = 0;
							if (imax > 0) {
								saturation = (imax - imin) / imax;
							}
							if (saturation > 0.5) { // 彩度が低いものは採用しない
								++tPx;
								tR += pxR;
								tG += pxG;
								tB += pxB;
							}
						}
					}
					if (tPx > 0) {
						tR = Math.round(tR / tPx);
						tG = Math.round(tG / tPx);
						tB = Math.round(tB / tPx);
					} else {
						tB = 255; tG = 0; tR = 0;
					}
					// console.log("Color : ", tR,tG,tB);
					img.setAttribute("data-meanColor", `${tR},${tG},${tB}`);
					okCallback([tR, tG, tB, 255]);
				});
			} catch (e) {
				ngCallback(e);
			}
		});
	}

	// ==========================================
	// ZIP Range Request 非同期描画用 新設メソッド群
	// ==========================================
	async initZippedTile(path) {
		this.reset();
		const generation = this.#generation;
		try {
			const archive = await unzip(new HTTPRangeReader(path));
			const [tileIndex, schema] = await Promise.all([
				archive.entries.tileIndex.json(), archive.entries.csvSchema.json()
			]);
			if (generation !== this.#generation) return false;
			this.isZipMode = true;
			this.zipArchivePath = path;
			this.zipArchive = archive;
			this.csvSchema = schema;
			this.qtctMapData = { tileIndex, csvSchema: schema };
			this.svgImage.documentElement.setAttribute("property", this.csvCodec ? this.csvCodec.serializeRow(schema.property ?? []) : (schema.property ?? []).join(","));
			this.clientSideQTCT.init(this.qtctMapData, (col) => [col[schema.lngCol], col[schema.latCol], col]);
			this.svgMap.refreshScreen();
			return true;
		} catch (error) {
			if (generation !== this.#generation) return false;
			this.reset();
			throw error;
		}
	}

	asyncPreRenderFunction() {
		if (!this.qtctMapData) return;
		if (Object.keys(this.loadingTiles).length > 0) return; // パン操作の競合ロック
		
		let level = Math.floor(Math.LOG2E * Math.log(this.svgImageProps.scale) + 7.25);
		let gvb = this.svgMap.getGeoViewBox();
		let tileSet = this.clientSideQTCT.getTileSet(gvb, level, true);
		
		// 即座に消さず、消去候補としてリストアップ（チラつき防止）
		this.toBeRemovedTiles = [];  
		for (const group of this.#getTileGroups()) {  
			const tkey = group.getAttribute("id").slice(1);  
			if (tileSet[tkey]) {  
				delete tileSet[tkey];  
			} else {  
				this.toBeRemovedTiles.push(group);  
			}  
		}
		
		let asyncLoad = false;
		for (let tkey in tileSet) {
			if (this.qtctMapData[tkey]) {
				let tileG = this.svgImage.createElement("g");
				tileG.setAttribute("id", "T" + tkey);
				this.svgImage.documentElement.appendChild(tileG);
				let tileData = this.qtctMapData[tkey];
				if (tileData instanceof Array) this.#setPoiTile(tileData, tileG);
				else this.#setImageTile(tileData, this.clientSideQTCT.getGeoBound(tkey), tileG);
			} else {
				this.renderAsyncTile(tkey);
				asyncLoad = true;
			}
		}
		
		if (!asyncLoad) {
			for (let i = this.toBeRemovedTiles.length - 1; i >= 0; i--) this.toBeRemovedTiles[i].remove();
		}
	}

	async renderAsyncTile(tkey) {
		const data = this.qtctMapData;
		const archive = this.zipArchive;
		const locks = this.loadingTiles;
		const generation = this.#generation;
		if (locks[tkey] || !archive || !data?.tileIndex ||
			typeof data.tileIndex[tkey] !== "boolean" || !archive.entries[tkey]) return;
		locks[tkey] = true;
		let tileG;
		let rendered = false;
		try {
			const tileData = data.tileIndex[tkey]
				? await archive.entries[tkey].json()
				: await archive.entries[tkey].text();
			if (generation !== this.#generation) return;
			this.clientSideQTCT.setTileData(tkey, tileData);
			data[tkey] = tileData;
			tileG = this.svgImage.createElement("g");
			tileG.setAttribute("id", "T" + tkey);
			// S-LaWAの差分同期のため、親を接続してからPOIを追加する。
			this.svgImage.documentElement.appendChild(tileG);
			if (Array.isArray(tileData)) this.#setPoiTile(tileData, tileG);
			else this.#setImageTile(tileData, this.clientSideQTCT.getGeoBound(tkey), tileG);
			rendered = true;
		} catch (error) {
			tileG?.remove();
			if (generation === this.#generation) console.warn(`[QTCT] タイル ${tkey} の描画をスキップしました:`, error);
		} finally {
			// 旧リクエストの完了で新世代の同名タイルのロックを消さない。
			delete locks[tkey];
			if (generation === this.#generation && rendered) {
				if (Object.keys(locks).length === 0) {
					for (const group of this.toBeRemovedTiles) group.remove();
					this.toBeRemovedTiles = [];
					this.svgMap.refreshScreen();
				} else {
					this.svgMap.refreshScreen(true);
				}
			}
		}
	}

	#assertGeneration(generation) {
		if (generation !== this.#generation) {
			throw new DOMException("QTCTデータが切り替わったため処理を中止しました", "AbortError");
		}
	}

	async restoreCsvDataFromZipFile(progressCBF) {
		const generation = this.#generation;
		const data = this.qtctMapData;
		const path = this.zipArchivePath;
		if (!path || !data?.tileIndex) return;
		const response = await fetch(path);
		this.#assertGeneration(generation);
		if (!response.ok) throw new Error(`ZIP取得に失敗しました: HTTP ${response.status}`);
		const total = Number(response.headers.get("content-length"));
		const reader = response.body.getReader();
		const chunks = [];
		let loaded = 0;
		try {
			for (;;) {
				const { done, value } = await reader.read();
				this.#assertGeneration(generation);
				if (done) break;
				chunks.push(value);
				loaded += value.byteLength;
				progressCBF?.({ loaded, total });
			}
		} catch (error) {
			await reader.cancel().catch(() => {});
			throw error;
		} finally {
			reader.releaseLock();
		}
		const archive = await unzip(new Blob(chunks));
		this.#assertGeneration(generation);
		const keys = Object.keys(data.tileIndex);
		for (let start = 0; start < keys.length; start += 8) {
			await Promise.all(keys.slice(start, start + 8).map(async (key) => {
				if (data[key]) return;
				const value = data.tileIndex[key]
					? await archive.entries[key].json() : await archive.entries[key].text();
				this.#assertGeneration(generation);
				data[key] = value;
			}));
			this.#assertGeneration(generation);
			progressCBF?.(Math.min(start + 8, keys.length) / keys.length);
		}
		this.#assertGeneration(generation);
		this.clientSideQTCT.restoreQuadTreeCompositeTileAndLowResImages();
		return this.restoreCsvData();
	}
}

// createPoiは未接続の要素（または描画を省略するnull）を返す。
// 地点情報と座標は共通処理で付与し、親タイルへの追加は呼び出し元が行う。
export function createPoiElement({
  svgImage, longitude, latitude, metadata, iconId, title, createPoi, csvCodec
}) {
  if (iconId === null) return null;
  const poi = createPoi
    ? createPoi({ svgImage, longitude, latitude, metadata, iconId, title })
    : svgImage.createElement("use");
  if (!poi) return null;
  if (!createPoi) {
    poi.setAttribute("xlink:href", "#" + iconId);
    poi.setAttribute("x", 0);
    poi.setAttribute("y", 0);
  }
  const label = title == null || title === "undefined" ? "" : String(title);
  poi.setAttribute("xlink:title", label.trim() ? label : "-");
  poi.setAttribute("content", csvCodec ? csvCodec.serializeRow(metadata) : metadata.join(","));
  poi.setAttribute("transform", `ref(svg,${Number(longitude) * 100},${-Number(latitude) * 100})`);
  return poi;
}
