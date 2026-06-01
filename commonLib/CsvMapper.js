// Dynamic Csv POI Layer for SVGMap Sample for SVGMapLevel0.1 > r8
// Programmed by Satoru Takagi
// 
// License: (MPL v2)
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0.
// If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.
//
// XHRで外部のcsvデータを読み取りPOIとして表示するwebApps　csvはタイリングを想定していない単純なもの。
// SVGMapLv0.1_r8で使える。
// ○CSVの形式：
//   最初の行に属性名を記入 次の行からデータを入れる
//   緯度と経度(WGS84)の桁が必須
//   タイトルの桁が必須
//   その他の桁は任意(用意できていない場合は適当な桁を指定しておくと良いでしょう・・・)
// ○このファイル(svg)のコンテナでのリンクの張り方:
//   csvXhr.svg#csvPath=refuge.csv&latCol=9&lngCol=10&titleCol=6
//     ハッシュの後に、サーチパートと同じような書き方をします。
//     csvPathとして読み込むcsvのパスを記述
//     latColに緯度の桁(base 0)
//     lngColに経度の桁
//     titleColにタイトルの桁
//     iconにアイコンの番号(0..5) - optional
//     variableIcon  指定カラムに応じてアイコンが振られる：カラム番号[,Th(LL.L),Th(L.M),Th(M.H),Th(H.HH)]  (LL:p0, L:p1, M:p2, H:p3, HH:p4のアイコンが振られる) - optional
//
// 2013/04/20 : 1st ver. ( Dynamic SVGMap LayerのテンプレートApps)
// 2014/06/26 : 1st ver. XHRによってCSVを読み込むレイヤーを開発
// fork from rev3 : asynchronous >rev10 framework
// 2017/02/17 Edge不具合対策 svgネームスペース文書操作全排除
// 2019/06/10 : from rev3 アイコンをプロパティ値によって変化
// 2019/09/11 : from 2a iconColの値が列挙型文字列の場合でも、値に応じて適当にアイコンを割り付ける
// 2019/10/28 : いろいろバグフィックス　CSV手入力UIを高機能化(アイコンの色指定、指定カラムの値で可変)
// 2022/01/20 : svgのscriptをhtmlに移設
// 2022/04/xx : CSVの手入力・ジオコーダ部を　別ウィンドに切り離し・UI改善＆モジュール化
// 2022/12/01 : iconCol系いろいろデバッグ  FileAPIでローカルファイル読み込み->csvInputUI_r17.html
// 2022/12/13 : データのサイズに応じて、オンメモリQuadTreeComposite Tilingを実装
// 2024/08/01 : 複数のcsvのサブレイヤーでの同時表示をサポートできるよう、インスタンスを複数立ち上げ、ターゲットのドキュメントも個別に指定できる機能を追加する
// 2025/06/13 : editCsv
// 2026/04/20 : [Refactor 2026]: ESM Class化。windowオブジェクトへの依存をなくし、内部にQTCTLayerRendererをカプセル化

// Issues:
//    iconCol系の実装(9/11の)が、未検証多々あります！
//    windowObjがQTCTrendererを持つことを想定しているなどいろいろ整理ができてない
/**
windowObjから直接取得している(整理できていない)リソースは以下の通り
	useQTCT
	parent.location.href
	svgImage
	messageDiv
	removePrevTiles()
	clearQTCTdata()
	buildQTCTdata()
	removePrevTiles()
	clearQTCTdata()
	clientSideQTCT
**/
// [Refactor 2026]: 上記の依存問題は今回のリファクタリング（DIと内部委譲）で解決済みです

// ToDo:
//    from 2a: ｘｘKm圏の円(楕円)を表示する機能(circleRadius),(radiusCol)
//

import { QTCTLayerRenderer } from './QTCTLayerRenderer.js';

export class CsvMapper {
	constructor(options) {
		// [Refactor 2026]: windowObj に依存せず、options 経由で依存を注入 (DI)
		this.svgMap = options.svgMap;
		this.svgImage = options.svgImage;
		this.svgImageProps = options.svgImageProps;
		this.layerID = options.layerID;
		this.messageDivElm = options.messageDivElm || null;
		
		// [Refactor 2026]: これまでグローバル変数だった useQTCT をクラスのプライベートな状態として管理
		this.useQTCT = false;
		this.qtctRenderer = null; // 第2層エンジンを内部に保持
		
		this.csv = null; // このデータがこのクラスのインスタンスにおける基幹のCSV生データ
		this.currentSchema = null; // 現在のこのオブジェクトが処理しているデータのスキーマ
		
		this.hashParamCsvSchema = {
			latCol: null,
			lngCol: null,
			titleCol: 0,
			titleCol2: -1,
			varIconCol: -1,
			varIconTh: []
		};
		
		this._csvPath = null;
		this._docPath = null;
		this._csvIndex = null;
		this.defaultIconNumber = 0;
		this.tokyoDatum = false;
		
		this.iconColMatch = options.iconColMatch || null;
		
		this.CR = String.fromCharCode(13);
		this.LF = String.fromCharCode(10);

		this.category = [];
		this.QTCTth = options.QTCTth || 1000; // ClientSideQuadTreeCompositeTilingに移行するスレッショルドポイント数
		this.customIconId = "customIcon";

		this.allocatedIconNumb = 0;
		this.iconColData2Category = {};
		this.iconsLength = 0;
		this.initCsvCallback = null;
	}

	// [Refactor 2026]: アプリ側からフックされる描画関数。QTCTモード時のみ内部のレンダラーにパススルー
	preRenderFunction = () => {
		if (this.useQTCT && this.qtctRenderer) {
			this.qtctRenderer.preRenderFunction();
		}
	};

	#getHashParams(hash) {
		hash = hash.substring(1);
		hash = hash.split("&");
		let result = {};
		for (let i = 0; i < hash.length; i++) {
			if (hash[i].indexOf("=") > 0) {
				let hName = hash[i].substring(0, hash[i].indexOf("="));
				let hVal = hash[i].substring(hash[i].indexOf("=") + 1);
				hash[i] = [hName, hVal];
				result[hName] = hVal;
			} else {
				result[hash[i]] = true;
			}
		}
		return result;
	}
	
	getCsv(progressCallBack) {
		console.log("getCsv:csv:", this.csv);
		// [Refactor 2026]: windowObj.useQTCT の代わりに this.useQTCT をチェック
		if (!this.csv && this.useQTCT) {
			// [Refactor 2026]: globalObj への依存をなくし、内包する qtctRenderer から直接データを復元
			if (this.qtctRenderer) {
				let csvdat = this.qtctRenderer.restoreCsvData();
				if (csvdat) {
					for (let i = 0; i < csvdat.length; i++) {
						csvdat[i] = csvdat[i].join(",");
					}
					return csvdat;
				}
			}
		}
		return this.csv;
	}
	
	getSchema() {
		return this.currentSchema;
	}
	
	#getHtmlDirHref() {
		// ヘルパー関数から安全な docHref を取得
		const envCtx = this.#resolveEnvContext();
		let ans = envCtx.docHref;
		
		if (ans.lastIndexOf("#") > 0) {
			ans = ans.substring(0, ans.lastIndexOf("#"));
		}
		if (ans.lastIndexOf("?") > 0) {
			ans = ans.substring(0, ans.lastIndexOf("?"));
		}
		if (ans.lastIndexOf("/") > 0) {
			ans = ans.substring(0, ans.lastIndexOf("/"));
		} else {
			ans = "";
		}
		return ans;
	}
	
	setMessageDiv(mdiv) {
		this.messageDivElm = mdiv;
	}
	
	onload(options) {
		console.log("ONLOAD APP");
		if (options?.svgImage) { // 別のsvgImageを設定することができる 2024/08/01
			this.svgImage = options.svgImage;
		}
		if (options?.messageDiv) {
			this.messageDivElm = options.messageDiv;
		}
		
		// 環境に応じたパスとハッシュの解決
		const envCtx = this.#resolveEnvContext();
		let docHref = envCtx.docHref;
		let hParams = this.#getHashParams(envCtx.hashStr);
		this._docPath = envCtx.docPath;
		
		console.log("hParams:", hParams, " docPath:", this._docPath, " docHref:", docHref);
		
		if (hParams.csvPath) {
			this._csvPath = new URL(hParams.csvPath, docHref).href;
			console.log("csvPath:", this._csvPath);
		}
		let csvCharset = null;
		if (hParams.charset) {
			csvCharset = hParams.charset;
		}
		if (hParams.csvIndex) {
			if (hParams.csvIndex.startsWith("http")) {
				this._csvIndex = hParams.csvIndex;
			} else {
				this._csvIndex = this.#getHtmlDirHref() + "/" + hParams.csvIndex;
			}
			console.log("csvIndex:", this._csvIndex);
		}
		this.hashParamCsvSchema.latCol = Number(hParams.latCol);
		this.hashParamCsvSchema.lngCol = Number(hParams.lngCol);
		
		if (hParams.datum && hParams.datum == "tokyo") {
			this.tokyoDatum = true;
		}
		
		if (hParams.titleCol) {
			if (hParams.titleCol.indexOf("/") >= 0) {
				let tc = hParams.titleCol.split("/");
				this.hashParamCsvSchema.titleCol = Number(tc[0]);
				this.hashParamCsvSchema.titleCol2 = Number(tc[1]);
			} else {
				this.hashParamCsvSchema.titleCol = Number(hParams.titleCol);
			}
		}
		
		if (hParams.schema) {
			let schemaTxt = hParams.schema;
			console.log("schea:", schemaTxt);
			this.svgImage.getElementsByTagName("svg")[0].setAttribute("property", schemaTxt);
		}
		
		if (hParams.variableIcon) {
			// variableIconクエリ: カンマ区切り、カラム番号,Th(LL.L),Th(L.M),Th(M.H),Th(H.HH)
			let viParam = hParams.variableIcon;
			viParam = viParam.split(",");
			this.hashParamCsvSchema.varIconCol = Number(viParam[0]);
			this.hashParamCsvSchema.varIconTh = new Array();
			if (viParam.length > 1) {
				for (let i = 0; i < viParam.length - 1; i++) {
					this.hashParamCsvSchema.varIconTh[i] = Number(viParam[i + 1]);
				}
			}
		}
		
		if (hParams.iconColMatch) {
			this.iconColMatch = new RegExp(hParams.iconColMatch);
		} 
		
		if (hParams.icon) {
			this.defaultIconNumber = Number(hParams.icon);
		}
		
		document.addEventListener("zoomPanMap", this.#testZP.bind(this));
		
		if (this._csvPath) {
			this.#removeAllPOIs();
			this.loadCsv(this._csvPath, csvCharset);
		}
		
		this.#buildInitialCategory();
	}
	
	#buildInitialCategory() {
		this.category = [];
		this.allocatedIconNumb = 0;
		this.iconColData2Category = {};
		let defs = this.svgImage.getElementsByTagName("defs")[0];
		if (!defs) return;
		let icons = this.#getChildren(defs);
		console.log("icons:", icons);
		this.iconsLength = icons.length;
		for (let i = 0; i < this.iconsLength; i++) {
			this.category.push(icons[i].getAttribute("id"));
		}
	}
	
	#getChildren(parent) {
		let ans = [];
		let cn = parent.childNodes;
		for (let i = 0; i < cn.length; i++) {
			if (cn[i].nodeType == 1) {
				ans.push(cn[i]);
			}
		}
		return ans;
	}
	
	#testZP(e) {
//		console.log( "called testZP:",e);
	}
	
	#checkVarIconTh(csvArray, firstRecord, cs) {
		let minVal = 1e99;
		let maxVal = -1e99;
		let minSet = false;
		let maxSet = false;
		for (let i = firstRecord; i < csvArray.length; i++) {
			let strTxt = csvArray[i].split(",");
			if (strTxt.length > 2 && strTxt[cs.varIconCol]) {
				let iconVal = strTxt[cs.varIconCol];
				if (isNaN(iconVal)) {
					continue;
				} else {
					iconVal = Number(iconVal);
					if (minVal > iconVal) {
						minSet = true;
						minVal = iconVal;
					}
					if (maxVal < iconVal) {
						maxSet = true;
						maxVal = iconVal;
					}
				}
			}
		}
		if (maxSet && minSet) {
			for (let i = 0; i < this.iconsLength - 1; i++) {
				cs.varIconTh.push(minVal + (i + 1) * (maxVal - minVal) / this.iconsLength);
			}
		}
	}
	
	#parseSchema(sline) {
		let scols = sline.split(",");
		let latCol = -1, lngCol = -1, titleCol = -1, titleCol2 = -1, varIconCol = -1, varIconTh = [];
		for (let i = 0; i < scols.length; i++) {
			let col = scols[i].toLowerCase();
			if (latCol == -1 && (col.indexOf("lat") >= 0 || col.indexOf("latitude") >= 0 || col.indexOf("緯度") >= 0)) {
				latCol = i;
			} else if (lngCol == -1 && (col.indexOf("lng") >= 0 || col.indexOf("lon") >= 0 || col.indexOf("longitude") >= 0 || col.indexOf("経度") >= 0)) {
				lngCol = i;
			} else if (titleCol == -1 && (col.indexOf("title") >= 0 || col.indexOf("名称") >= 0 || col.endsWith("name") || col.endsWith("名") || col.indexOf("タイトル") >= 0)) {
				titleCol = i;
			} else if (titleCol2 == -1 && (col.indexOf("title") >= 0 || col.indexOf("名称") >= 0 || col.endsWith("name") || col.endsWith("名") || col.indexOf("タイトル") >= 0)) {
				titleCol2 = i;
			} else if (col.indexOf("icon") >= 0 || col.indexOf("アイコン") >= 0) {
				//varIconCol = i;
			}
		}
		if (titleCol == -1) {
			titleCol = 0;
		}
		let ans = {
			latCol: latCol,
			lngCol: lngCol,
			titleCol: titleCol,
			titleCol2: titleCol2,
			varIconCol: varIconCol,
			varIconTh: varIconTh,
			csvLength: scols.length,
			property: scols
		};
		return ans;
	}
	
	#getSchemaTxt(schemaObj, csvLength) {
		let ans = [];
		for (let i = 0; i < csvLength; i++) {
			if (i == schemaObj.latCol) {
				ans.push("latitude");
			} else if (i == schemaObj.lngCol) {
				ans.push("longitude");
			} else if (i == schemaObj.titleCol) {
				ans.push("title");
			} else if (i == schemaObj.titleCol2) {
				ans.push("subTitle");
			} else if (i == schemaObj.varIconCol) {
				ans.push("category");
			} else {
				ans.push("prop" + i);
			}
		}
		let ret = "";
		let fitstCol = true;
		for (let i = 0; i < ans.length; i++) {
			if (fitstCol) {
				fitstCol = false;
				ret = ans[i];
			} else {
				ret += "," + ans[i]
			}
		}
		return ret;
	}
	
	#sleep = ms => new Promise(res => setTimeout(res, ms));
	
	// csv生データの割り切った簡単化
	simplifyCsv(csvText) {
		let eCsv = "";
		// 改行コードの正規化を行っておく
		csvText = csvText.replace(/\r\n/g, "\n");
		if (csvText.endsWith("\n")) {
		    csvText = csvText.slice(0, -1);
		}
		
		// ダブルクオーテーションによるエスケープを消す
		// そのとき、ダブルクオーテーションはシングルクォーテーションに、　カンマは;に、　改行は除去する
		csvText = csvText.replace(/\"\"/g, "'");
		let prevPos = 0;
		let startPos = 0;
		while (startPos >= 0) {
			startPos = csvText.indexOf('"', prevPos);
			if (startPos >= 0) {
				let endPos = csvText.indexOf('"', startPos + 1);
				if (endPos < 0) { break }
				eCsv += csvText.substring(prevPos, startPos);
				let escStr = csvText.substring(startPos + 1, endPos);
				escStr = escStr.replace(/\r?\n/g, "");
				escStr = escStr.replace(/,/g, ";");
				eCsv += escStr;
				prevPos = endPos + 1;
			} else {
				eCsv += csvText.substring(prevPos);
			}
		}
		
		csvText = eCsv;
		csvText = csvText.replace(/"/g, "'");
		return csvText;
	}
	
	async initCsv(inputCsv, latC, lngC, titleC, iconIndexOrCustomIconDataURL, varIconThParam, firstRecordParam) {
		console.log("called: initCsv", iconIndexOrCustomIconDataURL, varIconThParam, firstRecordParam);
		let iconIndex;
		let customIconDataURL;
		if (typeof iconIndexOrCustomIconDataURL == "string") {
			customIconDataURL = iconIndexOrCustomIconDataURL;
		} else {
			iconIndex = iconIndexOrCustomIconDataURL;
		}
		if (this.messageDivElm) this.messageDivElm.innerText = "Start Visualization";
		await this.#sleep(10);
		
		// [Refactor 2026]: 外部の関数呼び出しを廃止、クラス自身のメソッドで消去処理を実行
		this.clearMap();
		
		let csvArray = null;
		// CSVを準備する
		if (inputCsv) {
			let csvText = this.simplifyCsv(inputCsv);
			csvArray = csvText.split(this.LF); // CSVデータは、1次元配列、配列の要素は、1レコード分のCSVデータ（2次元配列ではない・・）
		}
		
		if (!csvArray) {
			console.warn("No CSV: exit");
			if (this.messageDivElm) this.messageDivElm.innerText = "";
			this.svgMap.refreshScreen();
			return;
		}
		if (latC == -1 || lngC == -1) {
			console.log("Force Clear : exit");
			if (this.messageDivElm) this.messageDivElm.innerText = "";
			this.svgMap.refreshScreen();
			return;
		}
		
		let firstRecord = 0;
		if (firstRecordParam) {
			firstRecord = firstRecordParam;
		}
		
		// スキーマを求める
		let cs = {
			latCol: -1,
			lngCol: -1,
			titleCol: -1,
			titleCol2: -1,
			varIconCol: -1,
			varIconTh: [],
			defaultIconNumber: 0,
		}
		this.#removeCustomIcon();
		this.#buildInitialCategory();
		
		if (csvArray) {
			if (latC != undefined || latC != null) {
				cs.latCol = latC;
			}
			if (lngC != undefined || lngC != null) {
				cs.lngCol = lngC;
			}
			if (titleC != undefined || titleC != null) {
				if (Array.isArray(titleC) && titleC.length == 2) {
					cs.titleCol = titleC[0];
					cs.titleCol2 = titleC[1];
				} else {
					cs.titleCol = titleC;
				}
			}
			if (varIconThParam) {
				cs.varIconCol = iconIndex;
				cs.varIconTh = varIconThParam;
			} else if (customIconDataURL) {
				cs.defaultIconNumber = customIconDataURL;
				cs.varIconCol = -1;
				cs.varIconTh = [];
				this.buildCustomIconDefs(customIconDataURL);
			} else {
				cs.defaultIconNumber = iconIndex;
				cs.varIconCol = -1;
				cs.varIconTh = [];
			}
		} else if (this.hashParamCsvSchema.latCol >= 0) {
			cs = this.hashParamCsvSchema;
		}
		
		if (cs.latCol == null || cs.latCol == -1) {
			cs = this.#parseSchema(csvArray[0]);
			this.svgImage.firstChild.setAttribute("property", csvArray[0]);
			firstRecord = 1;
		}
		cs.firstRecord = firstRecord;

		if (cs.latCol == -1 || cs.lngCol == -1) {
			console.warn("initCsv: Can't resolve latCol or lngCol exit");
			if (this.messageDivElm) this.messageDivElm.innerText = "Can't resolve latCol or lngCol ";
			return;
		}
		
		if (cs.varIconCol != -1 && cs.varIconTh.length == 0) {
			this.#checkVarIconTh(csvArray, firstRecord, cs);
		}
		
		if (firstRecord != 0 && !this.svgImage.firstChild.getAttribute("property")) {
			this.svgImage.firstChild.setAttribute("property", csvArray[0]);
		}
		
		let qtctData;
		// [Refactor 2026]: グローバルの window.useQTCT への依存をやめ、内部判定をカプセル化
		this.useQTCT = false;
		if (csvArray.length > this.QTCTth) {
			this.useQTCT = true;
			qtctData = [];
		}
		
		let properPoints = 0;
		for (let i = firstRecord; i < csvArray.length; i++) {
			let strTxt = csvArray[i].split(",");
			
			if (strTxt.length > 2) {
				let wgPos;
				if (i == 0) {
					let stxt;
					if (isNaN(strTxt[cs.latCol]) || isNaN(strTxt[cs.lngCol])) {
						// 0行目はスキーマ行だった
						stxt = csvArray[i];
					} else {
						stxt = this.#getSchemaTxt(cs, strTxt.length);
					}
					this.svgImage.firstChild.setAttribute("property", stxt);
				}
				if (this.tokyoDatum) {
					wgPos = this.#toWGS(Number(strTxt[cs.latCol]), Number(strTxt[cs.lngCol]));
				} else {
					wgPos = { lat: Number(strTxt[cs.latCol]), lng: Number(strTxt[cs.lngCol]) };
				}
				if (isNaN(wgPos.lat) || isNaN(wgPos.lng)) {
					continue;
				}
				if (wgPos && wgPos.lat && wgPos.lng) {
					if (this.useQTCT) {
						strTxt[cs.latCol] = wgPos.lat;
						strTxt[cs.lngCol] = wgPos.lng;
						qtctData.push(strTxt);
					} else {
						let title;
						if (cs.titleCol2 >= 0) {
							let title1 = strTxt[cs.titleCol];
							let title2 = strTxt[cs.titleCol2];
							if (title1 == "undefined") {
								title1 = "";
							}
							if (title2 == "undefined") {
								title2 = "";
							}
							title = (title1 + " " + title2).trim();
						} else {
							title = strTxt[cs.titleCol];
						}
						let addPOI = this.#getPOI(wgPos.lat, wgPos.lng, title, strTxt, cs); 
						if (addPOI) {
							this.svgImage.getElementsByTagName("svg")[0].appendChild(addPOI);
						}
					}
					++properPoints;
				}
			}
		}
		
		cs.property = this.svgImage.firstChild.getAttribute("property").split(",");
		this.currentSchema = cs;
		this.csv = csvArray;
		
		// [Refactor 2026]: 外の window.buildQTCTdata を呼ぶのではなく、自身で QTCTLayerRenderer をインスタンス化し、構築する
		if (this.useQTCT) {
			this.qtctRenderer = new QTCTLayerRenderer({
				svgMap: this.svgMap,
				svgImage: this.svgImage,
				svgImageProps: this.svgImageProps,
				layerID: this.layerID,
				// [Refactor 2026]: 循環参照を避けるため、自身のメソッドをアロー関数で包んで注入
				iconIdEvaluator: (rawData) => this.getIconId(rawData, cs, false),
				colorIndexEvaluator: (rawData) => this.getIconId(rawData, cs, true)
			});
			await this.qtctRenderer.buildQTCTdata(qtctData, cs, (msg) => {
				if (this.messageDivElm) this.messageDivElm.innerText = msg;
			}, false);
			this.svgMap.refreshScreen();
			if (this.messageDivElm) this.messageDivElm.innerText = "";
		} else {
			if (this.messageDivElm) this.messageDivElm.innerText = "";
			this.svgMap.refreshScreen();
		}
		
		if (typeof this.initCsvCallback == "function") {
			this.initCsvCallback({ properPoints });
		}
	}
	
	setInitCsvCallback(cbf) {
		this.initCsvCallback = cbf;
	}
	
	#removeCustomIcon() {
		console.log("removeCustomIcon");
		let ci = this.svgImage.getElementById(this.customIconId);
		if (ci) {
			ci.parentElement.removeChild(ci);
		}
	}
	
	buildCustomIconDefs(customIconDataURL) {
		this.#removeCustomIcon();
		console.log("buildCustomIconDefs");
		
		let defs = this.svgImage.getElementsByTagName("defs")[0];
		let grp = this.svgImage.createElement("g");
		grp.setAttribute("id", this.customIconId);
		
		let cimg = this.svgImage.createElement("image");
		cimg.setAttribute("xlink:href", customIconDataURL);
		cimg.setAttribute("preserveAspectRatio", "none");
		cimg.setAttribute("x", "-10");
		cimg.setAttribute("y", "-10");
		cimg.setAttribute("width", "20");
		cimg.setAttribute("height", "20");
		
		grp.appendChild(cimg);
		defs.appendChild(grp);
	}
	
	clearMap() {
		// [Refactor 2026]: 外部の関数呼び出しではなく、内部のレンダラーとDOMに対して直接クリアを実行
		if (this.qtctRenderer) {
			this.qtctRenderer.removePrevTiles();
			this.qtctRenderer.clearData();
			this.qtctRenderer = null;
		}
		this.#removeAllPOIs();
		if (this.svgImage.firstChild) {
			this.svgImage.firstChild.setAttribute("property", "");
		}
		this.csv = null;
		this.currentSchema = null;
		this.svgMap.refreshScreen();
	}
	
	loadCsv(csvPath, charset) {
		console.log("loadCSV csvPath:", csvPath, " \ndocPath:", this._docPath);
		let httpObj = new XMLHttpRequest();
		if (httpObj) {
			let self = this;
			httpObj.onreadystatechange = function() { self.#handleResult(this) }; // 非同期に変更(for >rev10) 2015.6.2
			httpObj.open("GET", csvPath, true);
			if (charset) {
				httpObj.overrideMimeType('text/plain; charset=' + charset);
			}
			httpObj.send(null);
		}
	}
	
	#handleResult(httpRes, cbf) {
		if ((httpRes.readyState == 4)) {
			if (httpRes.status == 403 || httpRes.status == 404 || httpRes.status == 500 || httpRes.status == 503) {
				console.log("File get failed: ", httpRes.status);
				return;
			}
			this.initCsv(httpRes.responseText);
		}
	}
	
	#getIconNumber(val, th) {
		let ans = 0;
		while (val > th[ans] && ans <= th.length) {
			++ans;
		}
		return ans;
	}
	
	getIconId(metadata, csvSchema, byIndex) { // iconColの内容が数字以外だったら連想配列で処理する 2018/06
		let icon = csvSchema.defaultIconNumber;
		if (typeof icon == "string") { // added 2024/2/22 カスタムアイコン
			if (byIndex) { // QTCTのLowRes表示の色マップのインデックスを決める数字(QTCTrendererのbuildQTCTdataで呼んでいる)だが・・・これは0番の色を決め打っていていい加減(TBD)
				// 本来ならカスタムアイコンの平均的な色合いを基に色を決めて設定する感じのちょっと難しいロジックがあるべき？
				return 0;
			} else {
				return this.customIconId;
			}
		}
		if (csvSchema.varIconCol != -1) {
			icon = metadata[csvSchema.varIconCol];
			if (this.iconColMatch && !this.iconColMatch.test(icon)) {
				return null;
			}
		}
		
		if (csvSchema.varIconTh.length > 0) { // 数値の閾値に応じたアイコン番号変更
			icon = this.#getIconNumber(Number(icon), csvSchema.varIconTh);
		}
		
		// iconの内容が文字の場合、アイコンの数分だけ、連想配列を割り付ける。超えてしまったら、最初のアイコンに戻って繰り返し割り付ける
		let ansIconIndex = null;
		
		if (this.category[icon]) {
				ansIconIndex = Number(icon);
		} else {
			let iconNumb = this.iconColData2Category[icon];
			if (iconNumb != undefined) {
				ansIconIndex = iconNumb;
			} else {
				this.iconColData2Category[icon] = this.allocatedIconNumb;
				ansIconIndex = this.allocatedIconNumb;
				++this.allocatedIconNumb;
				if (this.allocatedIconNumb >= this.iconsLength) {
					this.allocatedIconNumb = 0;
				}
			}
		}
		if (byIndex) {
			return ansIconIndex;
		} else {
			return this.category[ansIconIndex];
		}
	}
	
	#getPOI(latitude, longitude, title, metadata, csvSchema) {
		let iconId = this.getIconId(metadata, csvSchema);
		if (iconId === null) { return null };
		let tf = "ref(svg," + (longitude * 100) + "," + (latitude * -100) + ")";
		let cl;
		// Edgeで不具合発生＆すべてのケースでもはやdocumentはSVG文書ではなく単なるwell formed XML文書化したためSVGネームスペース宣言不要
		cl = this.svgImage.createElement("use"); 
		cl.setAttribute("x", 0);
		cl.setAttribute("y", 0);
		cl.setAttribute("transform", tf);
		cl.setAttribute("xlink:href", "#" + iconId);
		cl.setAttribute("xlink:title", title);
		if (metadata) {
			cl.setAttribute("content", metadata);
		}
		return cl;
	}
	
	#toWGS(jlat, jlng) { // 雑すぎる旧測地系からWGS84への変換関数(TBD)
		let glat = jlat - 0.00010695 * jlat + 0.000017464 * jlng + 0.0046017;
		let glng = jlng - 0.000046038 * jlat - 0.000083043 * jlng + 0.010040;
		return {
			lat: glat,
			lng: glng
		}
	}
	
	#removeAllPOIs() {
		console.log("removeAllPOIs");
		let pois = this.svgImage.getElementsByTagName("use");
		if (pois.length > 0) {
			for (let i = pois.length - 1; i >= 0; i--) {
				(pois[i].parentElement).removeChild(pois[i]);
			}
		}
	}
	
	// アイコンの図形・画像～文字列：もしくは配列(varIconTh>0のとき) 2025/6/12
	getUsedIcon() {
		if (!this.currentSchema) { return }
		if (this.currentSchema.varIconTh.length > 1) {
			// TBD
			// カラム番号の値(currentSchema.varIconCol)によってアイコンが変わるケース
			return ["現在のところ値による可変アイコンの提供は未対応です"];
		} else {
			if (typeof this.currentSchema.defaultIconNumber == "string") {
				return this.currentSchema.defaultIconNumber; // dataURLが入るはず
			} else {
				let iconElmg = this.svgImage.getElementById(this.category[this.currentSchema.defaultIconNumber]);
				let iconImg = iconElmg.getElementsByTagName("image");
				if (iconImg.length > 0) {
					return iconImg[0].getAttribute("xlink:href"); // 登録済みアイコンのケース
				} else {
					return iconElmg; // ベクトルアイコンのケースはElementが入る・・・
				}
			}
		}
	}
	
	// CSVを操作する 2025/06
	// action:
	// "add": lineが必要
	// "replace": line, prevLineが必要
	// "delete": lineが必要
	// useQTCTではない場合は、オーサリングツールが静的なsvgコンテンツ実体を編集していることを前提とし、再レンダリングしない制約がある
	async editCsv(action, line, prevLine) {
		let q, stat = true;
		if (!line) { return false }
		line = this.simplifyCsv(line);
		if (action.toLowerCase() == "add") {
			this.csv.push(line);
			if (this.useQTCT && this.qtctRenderer) {
				q = line.split(",");
				// [Refactor 2026]: 内包するQTCTLayerRendererのインスタンスに委譲
				stat = await this.qtctRenderer.clientSideQTCT.registOneData(q);
			}
		} else if (action.toLowerCase() == "replace") {
			if (!prevLine) { return false };
			prevLine = this.simplifyCsv(prevLine);
			const hitLine = this.csv.indexOf(prevLine);
			if (hitLine >= 0) {
				this.csv[hitLine] = line;
				// まったく同じ内容のレコードがある場合は失敗するが大目に見てくださいｗ・・・
			} else {
				return false;
			}
			if (this.useQTCT && this.qtctRenderer) {
				q = prevLine.split(",");
				stat = await this.qtctRenderer.clientSideQTCT.deleteOneData(q);
				q = line.split(",");
				stat = await this.qtctRenderer.clientSideQTCT.registOneData(q);
			}
		} else if (action.toLowerCase() == "delete") {
			const hitLine = this.csv.indexOf(line);
			if (hitLine >= 0) {
				this.csv.splice(hitLine, 1); 
			} else {
				return false;
			}
			if (this.useQTCT && this.qtctRenderer) {
				q = line.split(",");
				stat = await this.qtctRenderer.clientSideQTCT.deleteOneData(q);
			}
		}
		return stat;
	}
	
	get csvPath() { return this._csvPath; }
	get csvIndex() { return this._csvIndex; }
	
	// S-LaWAとLegacy LaWAの実行環境を自動判定し、適切なパス情報を返すヘルパー関数 2026/04/28
	#resolveEnvContext() {
		let isSLaWA = false;
		let parentHref = "";
		try {
			// Legacy LaWA (同一オリジン) の場合はアクセス可能
			parentHref = window.parent.location.href;
		} catch (e) {
			// S-LaWA (クロスオリジン) の場合は SecurityError が発生する
			isSLaWA = true;
		}

		let docHref, hashStr, docPath;

		if (isSLaWA) {
			// S-LaWA環境: 自身のlocationと同期されたプロパティを信頼する
			docHref = location.href;
			hashStr = this.svgImageProps.hash || location.hash || "";
			docPath = this.svgImageProps.Path || location.pathname;
		} else {
			// Legacy LaWA環境: 従来のプロパティ解決ロジックを維持
			if (this.svgImageProps.script && this.svgImageProps.script.src) {
				docHref = new URL(this.svgImageProps.script.src, parentHref).href;
				hashStr = this.svgImageProps.script.location ? this.svgImageProps.script.location.hash : (this.svgImageProps.hash || "");
				docPath = this.svgImageProps.script.location ? this.svgImageProps.script.location.pathname : (this.svgImageProps.Path || "");
			} else {
				// scriptオブジェクトがない場合のフォールバック
				docHref = location.href;
				hashStr = this.svgImageProps.hash || location.hash || "";
				docPath = this.svgImageProps.Path || location.pathname;
			}
		}

		return { docHref, hashStr, docPath };
	}
}