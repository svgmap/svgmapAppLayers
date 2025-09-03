// Description:
// 国交省川の防災情報のダム情報を表示するSVGMapレイヤー
//
// Programmed by Satoru Takagi
// 
// License: (MPL v2)
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.

//import { doQTCT, quadTreeCompositeTile } from './outdated/clientSideQTCT_func.js';
//import * as csvFetcher from './outdated/csvFetcher_func.js';
import { ClientSideQTCT } from './ClientSideQTCT.js';
import {CsvFetcher} from './CsvFetcher.js';

var csvFetcher = new CsvFetcher;
var clientSideQTCT = new ClientSideQTCT

//window.csvFetcher = csvFetcher; // for debug
//window.clientSideQTCT = clientSideQTCT;

var svgMap,svgImage,svgImageProps,layerID;

var qtctMapData

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
	
	window.setInterval(renderData,300000);
});

async function renderData(){
	var csvTxt,csvData;
	if ( damJsonBaseURL ){
		csvData = await getDamData(damJsonBaseURL);
	} else {
		csvData = await getPrefDamData();
	}
	csvTxt = csvData.csv;
	console.log(csvData.timeStamp, csvTxt);
	var csv = csvFetcher.parseCsv(csvTxt);
	var schemaCol = csv.shift();
	var schema=csvFetcher.getCsvSchema(schemaCol);
	//console.log("schema:",schema);
	//console.log("csv:",csv);
	svgImage.documentElement.setAttribute("property",schema.metaSchema.join(","));
	titleCol = schema.metaSchema.indexOf("obs_nm");
	if (titleCol==-1){titleCol = schema.metaSchema.indexOf("swobs_nm");}
	clientSideQTCT.init();
	qtctMapData = await clientSideQTCT.doQTCT(csv, function(col){
		var matadata = [];
		if ( schema.latCol > schema.lngCol ){
			var y = col.splice(schema.latCol,1)[0];
			var x = col.splice(schema.lngCol,1)[0];
		} else {
			var x = col.splice(schema.lngCol,1)[0];
			var y = col.splice(schema.latCol,1)[0];
		}
		if ( col.join().indexOf("122313145")>=0){
			console.log(x,y,col);
		}
		//console.log(x,y,col);
		return [x,y,col];
	}, {maxTilePoints:tilePoints,pixelColor:pixelColor});
	//window.qtctMapData = qtctMapData; // for debug
	// console.log(qtctMapData);
	// clientSideQTCT.countRecords();
	
	initUI();
	
	window.preRenderFunction();
	svgMap.refreshScreen();
}

window.renderData = renderData;

window.preRenderFunction=function(){
	//console.log("Called window.preRenderFunction, svgMap:",svgMap,"  svgImage:",svgImage," layerID:",layerID);
	var level = Math.floor( Math.LOG2E * Math.log(svgImageProps.scale) + 6.5);
	var gvb = svgMap.getGeoViewBox();
	//console.log("geoVB:", gvb,"  level:",level);
	var tileSet = clientSideQTCT.getTileSet(gvb,level)
	//console.log("getTileSet:",tileSet);
	
	removePrevTiles(tileSet);// ひとまず全タイル削除
	
	for ( var tkey in tileSet){
		var tileData = qtctMapData[tkey];
		
		var tileG = svgImage.createElement("g");
		tileG.setAttribute("id","T"+tkey);
		svgImage.documentElement.appendChild(tileG);
		
		if ( tileData instanceof Array){ // 実データ
			setPoiTile(tileData, tileG);
		} else { // String imageURI
			var geoBBox = clientSideQTCT.getGeoBound(tkey);
			setImageTile(tileData, geoBBox, tileG);
		}
	}
	console.log(svgImage);
}

function setPoiTile(tileData, tileG){
	for ( var poiDat of tileData ){
		var poi = svgImage.createElement("use");
		var iconLink="#pin";
		if ( window.pixelColor && window.statDict){
			var iconLinkT=window.statDict[poiDat[2][window.pixelColor.colorEvaluatorCol]];
			if (iconLinkT){
				iconLink=iconLinkT[1];
			}
		}
		poi.setAttribute("xlink:href",iconLink);
		poi.setAttribute("x",0);
		poi.setAttribute("y",0);
		poi.setAttribute("xlink:title",poiDat[2][titleCol]);
		poi.setAttribute("content",poiDat[2].join(","));
		poi.setAttribute("transform","ref(svg,"+Number(poiDat[0])*100+","+(-Number(poiDat[1])*100)+")" );
		//console.log(poi);
		tileG.appendChild(poi);
	}
}

function setImageTile(tileData, geoBBox, tileG){
	var img = svgImage.createElement("image");
	img.setAttribute("xlink:href",tileData);
	img.setAttribute("style","image-rendering:pixelated");
	img.setAttribute("x",geoBBox.x*100);
	img.setAttribute("y",-(geoBBox.y+geoBBox.height)*100);
	img.setAttribute("height",geoBBox.height*100);
	img.setAttribute("width",geoBBox.width*100);
	tileG.appendChild(img);
}

function removePrevTiles(tileSet){ // 前のステップで表示していた要素のうち、不要なものを削除＆今のステップでも使うものは流用する処理
	var gs = svgImage.getElementsByTagName("g");
	for ( var i = gs.length-1 ; i >0 ; i--){
		var gid = gs[i].getAttribute("id")
		if ( gid.startsWith("T")==false){continue} // ちょっと適当すぎですが、アイコンのIDの頭は"T"つけないでください・・
		var tkey = gid.substring(1);
		if ( !tileSet[tkey]){ // 必要なタイルのセットの中にないものは消去
			gs[i].remove();
		} else { // あったものについてはタイルセットのほうを消去
			delete tileSet[tkey];
		}
	}
}


// POIクリック時のUIのカスタマイズ
function initUI(){
	console.log("window:",window,"  document:",document);
	console.log("initUI:",layerID);
	svgMap.setShowPoiProperty( customShowPoiProperty, layerID);
}
async function customShowPoiProperty(target){
	var metaSchema = target.ownerDocument.firstChild.getAttribute("property").split(","); // debug 2013.8.27
	var metaData = svgMap.parseEscapedCsvLine(target.getAttribute("content"));
	
	var pos = target.getAttribute("transform").replaceAll(/[^\d.,]/g,"").split(","); // 数値とカンマとピリオドだけを切り出す
	// svg座標から取り出しておく(マイナスは上の正規表現で消されてるよw)
	var lat = Number(pos[2])/100;
	var lon = Number(pos[1])/100;
	
	
	console.log(metaSchema , metaData );
	// ちょっと非効率だがまぁ・・
	var itmkndCd = metaData[metaSchema.indexOf("itmknd_cd")];
	var ofcCd = metaData[metaSchema.indexOf("ofc_cd")];
	var obsCd = metaData[metaSchema.indexOf("obs_cd")];
	if ( !itmkndCd){ // 水位計（水位観測所でなくて）
		itmkndCd="300";
		ofcCd = metaData[metaSchema.indexOf("swofc_cd")];
		obsCd = metaData[metaSchema.indexOf("swobs_cd")];
	}
	console.log(itmkndCd,ofcCd,obsCd);
	
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

function loadJSON(cbFunc, url, isCsv){
//	console.log("loadJSON : SRC: ", url);
	var httpObj = new XMLHttpRequest();
	if ( httpObj ) {
		httpObj.onreadystatechange = function(){
			loadJSON_ph2( this , cbFunc , isCsv );
		} ;
		httpObj.open("GET", svgMap.getCORSURL(url) , true );
		httpObj.send(null);
	}
}

function loadJSON_ph2( httpRes , cbFunc , isCsv ){
	if ( httpRes.readyState == 4 ){
		if ( httpRes.status == 403 || httpRes.status == 404 || httpRes.status == 500 || httpRes.status == 503 ){
			console.log( "loadJSON : File get failed : stat : ", httpRes.status);
			return;
		}
		var jst = httpRes.responseText;
		jst = unescape(jst);
//		console.log("isCsv:",isCsv, "\nloadJSON_ph2:",jst);
		if ( isCsv ){
			var csv = jst.split("\n");
//			console.log("csv:",csv);
			for ( var i = 0 ; i < csv.length ; i++ ){
				csv[i] = csv[i].split(",");
			}
//			console.log("csv:",csv);
			cbFunc ( csv );
		} else {
			var Json = JSON.parse(jst);
			cbFunc(Json);
		}
	}
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
async function getPrefDamData(){ // 県単位のデータ(平時の位置を表示する方)
	var prefUrl="https://www.river.go.jp/kawabou/file/files/map/pref/prefarea.json";
	var prefJson = await fetchJson(prefUrl,null);
	console.log("prefJson:",prefJson);
//	var timeSt="https://www.river.go.jp/kawabou/file/system/rwCrntTime.json";
//	var timeStamp = (await fetchJson(timeSt,true)).crntRwTime;
	var timeSt="https://www.river.go.jp/kawabou/file/system/tmCrntTime.json"; // これが正しい？
	let  timeStampD = (await fetchJson(timeSt,true)).crntObsTime;
	
	timeStampD=new Date(timeStampD);
	let timeStamp = getDateTimeStr(timeStampD);
	var damJsonBase = damJsonPrefBaseURL.replace("[[datetime]]",timeStamp);
	console.log(timeStamp,damJsonBase);
	
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
			console.log(i + "/" + prefJson.prefs.length );
			document.getElementById("prg").innerText=i + "/" + prefJson.prefs.length;
		}
	}
	console.log("Finished!",tjp);
	document.getElementById("prg").innerText="";
	return ({csv:printCsv(damData, timeStampD),timeStamp:timeStampD});
}

async function getDamData(damUrl){ // 全国のデータ(警戒情報の位置を表示する方)
//	var timeSt="https://www.river.go.jp/kawabou/file/system/rwCrntTime.json";
//	var timeStamp = (await fetchJson(timeSt,true)).crntRwTime;
	var timeSt="https://www.river.go.jp/kawabou/file/system/tmCrntTime.json"; // これが正しい？
	let  timeStampD = (await fetchJson(timeSt,true)).crntObsTime;
	
	timeStampD=new Date(timeStampD);
	let timeStamp = getDateTimeStr(timeStampD);
	
	//timeStamp = "20220427/1120"; // for debug
	
	damUrl = damUrl.replace("[[datetime]]",timeStamp);
	damData = await fetchJson(damUrl,null)
	console.log("Finished!",damData);
	document.getElementById("prg").innerText="";
	return ({csv:printCsv(damData, timeStampD),timeStamp:timeStampD});
}

function printCsv( camData, timeStampDate ){
	// geoJsonのpropertiesは単層構造なことを前提としていて、且つ最初のfeatureレコードに全部のプロパティがあることを前提として正規化しているｗｗｗ
	var schema = [];
	var ansTxt = "";
	
	document.getElementById("prg").innerHTML=`<span style="font-size:12px">${camData.features.length}レコードのデータがあります。 ${timeStampDate.toLocaleString('ja-JP', {year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit'})}更新</span>`;
	
	for ( var cam of camData.features ){
		var prop = cam.properties;
		if(schema.length==0){
			for ( var key in prop){
				schema.push(key);
			}
			ansTxt+="longitude,latitude," + schema.join(",")+"\n";
		}
		var propArray=[];
		for ( key of schema){
			propArray.push(prop[key]);
		}
		ansTxt+= cam.geometry.coordinates.join(",")+","+propArray.join(",")+"\n";
	}
	if (window.pixelColor && window.pixelColor.colorEvaluatorKey){
		colorEvaluatorCol = schema.indexOf(window.pixelColor.colorEvaluatorKey);
		window.pixelColor.colorEvaluatorCol = colorEvaluatorCol;
	}
	return(ansTxt);
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