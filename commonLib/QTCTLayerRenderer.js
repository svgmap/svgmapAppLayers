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

import { ClientSideQTCT } from './ClientSideQTCT.js';

export class QTCTLayerRenderer {
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
			let match = iconId.match(/\d+$/);
			return match ? parseInt(match[0], 10) : 0;
		});
		
		// タイトルを動的に生成する関数を受け取れるようにする 2026/4/21
		this.titleEvaluator = options.titleEvaluator || null;
		
		this.clientSideQTCT = new ClientSideQTCT();
		this.qtctMapData = null; // ここにQuadTreeCompositeTilingされたデータが格納される
		this.csvSchema = null;
		
		// このcolorはPOIのビットイメージの実際の色に対応させている。csvXhr_r*.svgのdefs #p?で定義
		// (png読んで色を統計し自動設定すと良いけど面倒なのでひとまずハードコード・・)
		this.colors = [[0x1d,0x64,0xbb],[0x1a,0xb9,0xb7],[0x71,0xf0,0x49],[0xf0,0xea,0x4a],[0xf0,0x49,0x49],[0xf5,0x4f,0xf7]];
	}

	// initCsvでこちらを呼ぶ
	async buildQTCTdata(csv, schema, progressCBF, removeLatLngMeta) {
		this.clientSideQTCT.init();
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
		
		this.qtctMapData = await this.clientSideQTCT.doQTCT(csv, (col) => {
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
		}, { maxTilePoints: maxPoints, pixelColor: pixelColorOpt, progressCBF: progressCBF });
	}

	clearData() {
		this.clientSideQTCT.init();
		this.qtctMapData = null;
	}

	// window.preRenderFunction に直接代入されるなど、外部からコールバックとして呼ばれても this のコンテキストが失われないようにバインド。
	preRenderFunction = () => {
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
			} else if (this.csvSchema.titleCol >= 0) {
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
			let poi = this.svgImage.createElement("use");
			poi.setAttribute("xlink:href", "#" + iconId);
			poi.setAttribute("x", 0);
			poi.setAttribute("y", 0);
			poi.setAttribute("xlink:title", titleStr);
			poi.setAttribute("content", poiDat[2].join(","));
			poi.setAttribute("transform", "ref(svg," + Number(poiDat[0]) * 100 + "," + (-Number(poiDat[1]) * 100) + ")");
			tileG.appendChild(poi);
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
		let gs = this.svgImage.getElementsByTagName("g");
		for (let i = gs.length - 1; i > 0; i--) {
			if (gs[i].parentElement.nodeName === "defs") continue;
			if (gs[i].getAttribute("data-preserve") === "qtct-exclude") continue; // 2026/02/20 QTCT実装レイヤでも制御外のグループを入れられるように
			
			if (tileSet) {
				let tkey = gs[i].getAttribute("id").substring(1);
				if (!tileSet[tkey]) { // 必要なタイルのセットの中にないものは消去
					gs[i].remove();
				} else { // あったものについてはタイルセットのほうを消去
					delete tileSet[tkey];
				}
			} else {
				// console.log("remove ",gs[i]);
				gs[i].remove();
			}
		}
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

	getQtctMapData() {
		return this.qtctMapData;
	}
	
	setQtctMapData(qtctMapDataSrc) {
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
}