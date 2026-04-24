// Description:
// 国交省川の防災情報のダム情報を表示するSVGMapレイヤー
//
// Programmed by Satoru Takagi
// 
// License: (MPL v2)
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.
//
// History:
// 2025/09/03 : rev1
// 2026/04/22 : QTCTLayerRenderer.jsを使用するように変更


// [Refactor 2026] 共通レンダラー(QTCTLayerRenderer.js)をインポート
import { QTCTLayerRenderer } from './QTCTLayerRenderer.js';

var svgMap,svgImage,svgImageProps,layerID;

// [Refactor 2026] 共通の QTCTLayerRenderer のインスタンスを保持
var qtctRenderer = null;

var townJson;
var damData={type:"FeatureCollection",features:[]};

var titleCol;

var pixelColor=[50,0,0,255];
var damJsonPrefBaseURL="https://www.river.go.jp/kawabou/file/gjson/obs/[[datetime]]/dam/[[prefID]].json";
var damJsonBaseURL;

var tilePoints = 100;
var colorEvaluatorCol;

addEventListener("load",async function(){
	svgMap = window.svgMap;
	svgImage = window.svgImage;
	svgImageProps = window.svgImageProps;
	layerID = window.layerID;
	if (window.pixelColor){
		pixelColor = window.pixelColor;
		console.log("set custom pixelColor:",pixelColor);
	}
	if ( window.prefBaseURL){
		damJsonPrefBaseURL = window.prefBaseURL;
		console.log("set custom damJsonPrefBaseURL:",damJsonPrefBaseURL);
	}
	if ( window.baseURL){
		damJsonBaseURL = window.baseURL;
		console.log("set custom damJsonBaseURL:",damJsonBaseURL);
	}
	
	buildLegend();
	await renderData();
	
	// 5分ごとの定期更新
	window.setInterval(renderData,300000);
});

// [Refactor 2026] 描画フックの登録
window.preRenderFunction = function(){
	if (qtctRenderer) {
		qtctRenderer.preRenderFunction();
	}
};

async function renderData(){
	var processedData;
	if ( damJsonBaseURL ){
		processedData = await getDamData(damJsonBaseURL);
	} else {
		processedData = await getPrefDamData();
	}
	
	var flat = processedData.flatData;
	var schema = flat.schema;
	var dataArray = flat.dataArray;
	
	console.log(processedData.timeStamp, "Data Loaded. Records:", dataArray.length);
	
	svgImage.documentElement.setAttribute("property", schema.join(","));
	
	titleCol = schema.indexOf("obs_nm");
	if (titleCol==-1){titleCol = schema.indexOf("swobs_nm");}

	// [Refactor 2026] 共通レンダラーの初期化
	if (!qtctRenderer) {
		qtctRenderer = new QTCTLayerRenderer({
			svgMap: window.svgMap,
			svgImage: window.svgImage,
			svgImageProps: window.svgImageProps,
			layerID: window.layerID,
			
			// 1. ピンのアイコン切り替えロジック
			iconIdEvaluator: (rawData) => {
				let iconLink = "pin"; // デフォルト
				if (window.pixelColor && window.statDict && window.pixelColor.colorEvaluatorCol !== undefined) {
					let statVal = rawData[window.pixelColor.colorEvaluatorCol];
					let iconLinkT = window.statDict[statVal];
					if (iconLinkT) {
						iconLink = iconLinkT[1].replace("#", ""); 
					}
				}
				return iconLink;
			},
			
			// 2. ラスタータイルの多色塗り分けロジック
			colorIndexEvaluator: (rawData) => {
				if (window.pixelColor && typeof window.pixelColor.evaluator === 'function') {
					// [Refactor 2026] 互換性レイヤー
					// HTML側に記述された旧evaluatorは `rawData[2]` にメタデータが入っていることを前提としているため、
					// ダミーの配列構造 [0, 0, metaArray] を作って渡してやることでHTML無改変で動かす
					let dummyRawData = [0, 0, rawData];
					return window.pixelColor.evaluator.call(window.pixelColor, dummyRawData);
				}
				return 0; // デフォルト
			}
		});
		
		// [Refactor 2026] 色テーブルの設定 (HTML側で .table が定義されていれば複数色展開する)
		if (window.pixelColor && Array.isArray(window.pixelColor.table)) {
			window.pixelColor.table.forEach((colorArray, index) => {
				qtctRenderer.colors[index] = colorArray;
			});
		} else {
			qtctRenderer.colors[0] = Array.isArray(pixelColor) ? pixelColor : [50,0,0,255];
		}
	}

	let qtctSchema = {
		lngCol: 0,
		latCol: 1,
		titleCol: titleCol,
		defaultIconNumber: 0,
		maxTilePoints: tilePoints
	};

	// 四分木タイリングの実行
	await qtctRenderer.buildQTCTdata(dataArray, qtctSchema, null, true);
	
	// 定期更新（データ洗い替え）のため、DOMの旧タイルを強制クリア
	qtctRenderer.removePrevTiles();
	
	initUI();
	
	window.preRenderFunction();
	svgMap.refreshScreen();
}

window.renderData = renderData;

// POIクリック時のUIのカスタマイズ
function initUI(){
	console.log("initUI:",layerID);
	svgMap.setShowPoiProperty( customShowPoiProperty, layerID);
}

async function customShowPoiProperty(target){
	var metaSchema = target.ownerDocument.firstChild.getAttribute("property").split(",");
	var metaData = svgMap.parseEscapedCsvLine(target.getAttribute("content"));
	
	var pos = target.getAttribute("transform").replaceAll(/[^\d.,]/g,"").split(",");
	var lat = Number(pos[2])/100;
	var lon = Number(pos[1])/100;
	
	var itmkndCd = metaData[metaSchema.indexOf("itmknd_cd")];
	var ofcCd = metaData[metaSchema.indexOf("ofc_cd")];
	var obsCd = metaData[metaSchema.indexOf("obs_cd")];
	if ( !itmkndCd){ 
		itmkndCd="300";
		ofcCd = metaData[metaSchema.indexOf("swofc_cd")];
		obsCd = metaData[metaSchema.indexOf("swobs_cd")];
	}
	
	var obs_nm = metaData[metaSchema.indexOf("obs_nm")];
	if ( !obs_nm){obs_nm = metaData[metaSchema.indexOf("swobs_nm")];}
	var obs_kana = metaData[metaSchema.indexOf("obs_kana")];
	if ( !obs_kana){obs_kana = metaData[metaSchema.indexOf("swobs_kana")];}
	var lat2 = metaData[metaSchema.indexOf("lat")];
	var lon2 = metaData[metaSchema.indexOf("lon")];
	if ( lat2 ){lat=lat2};
	if ( lon2 ){lon=lon2};
	var obs_time = metaData[metaSchema.indexOf("obs_time")];
	
	var stat;
	if (window.pixelColor && window.pixelColor.colorEvaluatorKey){
		stat = metaData[metaSchema.indexOf(window.pixelColor.colorEvaluatorKey)];
		if ( window.statDict && window.statDict[stat]){
			stat = window.statDict[stat];
		}
	}
	
	var varlinkURL=`https://www.river.go.jp/kawabou/pcfull/tm?itmkndCd=${itmkndCd}&ofcCd=${ofcCd}&obsCd=${obsCd}&isCurrent=true&fld=0`;
	
	var message="<table border='1' style='word-break: break-all;table-layout:fixed;width:100%;border:solid orange;border-collapse: collapse'>";
	message += "<tr><th style='width=25%'>名称</th><th>"+obs_nm+"</th></tr>";
	message += "<tr><td style='width=25%'>カナ</td><td>"+obs_kana+"</td></tr>";
	message += "<tr><td style='width=25%'>緯度</td><td>"+lat+"</td></tr>";
	message += "<tr><td style='width=25%'>経度</td><td>"+lon+"</td></tr>";
	message += "<tr><td style='width=25%'>計測</td><td>"+obs_time+"</td></tr>";
	if ( stat ){
		message += "<tr><td style='width=25%'>状況フラグ</td><td>"+stat[0]+"</td></tr>";
	}
	message += "<tr><td colspan='2'><a target='_blank' href='" + varlinkURL + "'>測定データページ</a></td></tr>";
	message += "</table>";
	
	svgMap.showModal(message,400,600);
}

async function fetchJson(path, getLatest){
	var dt = new Date().getTime();
	if ( getLatest ){
		if (path.indexOf("?")>0){
			path = path + "&time="+dt;
		} else {
			path = path + "?time="+dt;
		}
	}
	var json;
	try{
		var response = await fetch(svgMap.getCORSURL(path));
		var json = await response.json();
	} catch (e){
		console.warn(e);
		json = null;
	}
	return ( json );
}

function getDateTimeStr(dt){
	var y = dt.getFullYear()+"";
	var mo = pad(dt.getMonth()+1);
	var d = pad(dt.getDate());
	var h = pad(dt.getHours());
	var mi =pad(dt.getMinutes());
	return ( y+mo+d+"/"+h+mi);
}

function pad(num){
	var ret = ( '00' + num ).slice( -2 );
	return ret;
}

var bunchSize = 10;
async function getPrefDamData(){ 
	var prefUrl="https://www.river.go.jp/kawabou/file/files/map/pref/prefarea.json";
	var prefJson = await fetchJson(prefUrl,null);
	var timeSt="https://www.river.go.jp/kawabou/file/system/tmCrntTime.json"; 
	let  timeStampD = (await fetchJson(timeSt,true)).crntObsTime;
	
	timeStampD=new Date(timeStampD);
	let timeStamp = getDateTimeStr(timeStampD);
	var damJsonBase = damJsonPrefBaseURL.replace("[[datetime]]",timeStamp);
	
	var tjp =[];
	for ( var i = 0 ; i < prefJson.prefs.length ; i++  ){
		var pref = prefJson.prefs[i];
		var damUrl=damJsonBase.replace("[[prefID]]",pref.prefCd);
		tjp.push( fetchJson(damUrl,null) );
		if ( tjp.length == bunchSize || i == prefJson.prefs.length-1){
			var camTowns = await Promise.all(tjp);
			for ( var camTown of camTowns){
				if ( camTown &&  camTown.features ){
					damData.features=damData.features.concat(camTown.features);
				}
			}
			tjp =[];
			document.getElementById("prg").innerText=i + "/" + prefJson.prefs.length;
		}
	}
	document.getElementById("prg").innerText="";
	return ({flatData: buildFlatData(damData, timeStampD), timeStamp: timeStampD});
}

async function getDamData(damUrl){ 
	var timeSt="https://www.river.go.jp/kawabou/file/system/tmCrntTime.json"; 
	let  timeStampD = (await fetchJson(timeSt,true)).crntObsTime;
	
	timeStampD=new Date(timeStampD);
	let timeStamp = getDateTimeStr(timeStampD);
	
	damUrl = damUrl.replace("[[datetime]]",timeStamp);
	damData = await fetchJson(damUrl,null)
	document.getElementById("prg").innerText="";
	
	return ({flatData: buildFlatData(damData, timeStampD), timeStamp: timeStampD});
}

// GeoJSONから直接フラット配列を生成
function buildFlatData(camData, timeStampDate){
	let schema = [];
	let dataArray = [];
	
	let prg = document.getElementById("prg");
	if (prg) {
		prg.innerHTML = `<span style="font-size:12px">${camData.features.length}レコードのデータがあります。 ${timeStampDate.toLocaleString('ja-JP', {year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit'})}更新</span>`;
	}

	if (!camData.features || camData.features.length === 0) {
		return { schema, dataArray };
	}

	schema = Object.keys(camData.features[0].properties);
	
	if (window.pixelColor && window.pixelColor.colorEvaluatorKey){
		colorEvaluatorCol = schema.indexOf(window.pixelColor.colorEvaluatorKey);
		window.pixelColor.colorEvaluatorCol = colorEvaluatorCol;
	}

	for (let cam of camData.features) {
		let row = [];
		row.push(cam.geometry.coordinates[0]); // 経度
		row.push(cam.geometry.coordinates[1]); // 緯度
		
		for (let key of schema) {
			row.push(cam.properties[key]);
		}
		dataArray.push(row);
	}
	
	return { schema, dataArray };
}

function buildLegend(){
	const legendDiv = document.getElementById("legendDiv");
	if ( !legendDiv){return}
	if (!window.statDict){return}
	const fontSize = 12;
	legendDiv.style.fontSize=`${fontSize}px`;
	for ( let sk in window.statDict){
		const legendDat = window.statDict[sk];
		const iconG =  svgImage.getElementById(legendDat[1].substring(1));
		const iconC = iconG.getElementsByTagName("image");
		let iconImg, iconWidth, iconHeight;
		if ( iconC && iconC.length>0){
			iconImg = iconC[0].getAttribute("xlink:href");
			iconWidth = iconC[0].getAttribute("width");
			iconHeight = iconC[0].getAttribute("height");
		}
		iconWidth = Math.floor(iconWidth/iconHeight*fontSize);
		iconHeight=fontSize;
		if ( iconImg ){
			legendDiv.insertAdjacentHTML("afterbegin",`<li><img height="${iconHeight}px" width="${iconWidth}px" src="${iconImg}"> : ${legendDat[0]}`);
		}
	}
	legendDiv.insertAdjacentHTML("afterbegin","凡例");
}