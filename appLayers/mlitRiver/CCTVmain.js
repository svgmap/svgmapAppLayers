// Description:
// 国交省川の防災情報のCCTVを表示するSVGMapレイヤー
// 
//  Programmed by Satoru Takagi
//  
//  Copyright (C) 2024 by Satoru Takagi @ KDDI CORPORATION
//  
// License: (GPL v3)
//  This program is free software: you can redistribute it and/or modify
//  it under the terms of the GNU General Public License version 3 as
//  published by the Free Software Foundation.
//  
//  This program is distributed in the hope that it will be useful,
//  but WITHOUT ANY WARRANTY; without even the implied warranty of
//  MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
//  GNU General Public License for more details.
//  
//  You should have received a copy of the GNU General Public License
//  along with this program.  If not, see <http://www.gnu.org/licenses/>.


//import { doQTCT, quadTreeCompositeTile } from './outdated/clientSideQTCT_func.js';
//import * as csvFetcher from './outdated/csvFetcher_func.js';
import { ClientSideQTCT } from './ClientSideQTCT.js';
import {CsvFetcher} from './CsvFetcher.js';

var csvFetcher = new CsvFetcher();
var clientSideQTCT = new ClientSideQTCT();

//window.csvFetcher = csvFetcher; // for debug
//window.clientSideQTCT = clientSideQTCT;

var svgMap,svgImage,svgImageProps,layerID;

var qtctMapData

addEventListener("load",async function(){
	svgMap = window.svgMap;
	svgImage = window.svgImage;
	svgImageProps = window.svgImageProps;
	layerID = window.layerID;
	
	// OBS_Blist_20220405.csv  CCTV_Blist_20220405.csv  CCTVlist_20220405.csv
	document.getElementById("poiInfoDiv").innerText="データ読み込み中";
	var csv = await csvFetcher.fetchCsv("./CCTV.csv")
	var schemaCol = csv.shift();
	document.getElementById("poiInfoDiv").innerText=csv.length+"レコードのデータがあります";
	var schema=csvFetcher.getCsvSchema(schemaCol);
	//console.log("schema:",schema);
	//console.log("csv:",csv);
	svgImage.documentElement.setAttribute("property",schema.metaSchema.join(","));
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
	}, {maxTilePoints:100,pixelColor:[0,0,255,255]});
	window.qtctMapData = qtctMapData; // for debug
	// console.log(qtctMapData);
	// clientSideQTCT.countRecords();
	
	initUI();
	
	window.preRenderFunction();
	svgMap.refreshScreen();
});

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
		poi.setAttribute("xlink:href","#p0");
		poi.setAttribute("x",0);
		poi.setAttribute("y",0);
		poi.setAttribute("xlink:title",poiDat[2][1]);
		poi.setAttribute("content",poiDat[2].join(","));
		poi.setAttribute("transform","ref(svg,"+Number(poiDat[0])*100+","+(-Number(poiDat[1])*100)+")" );
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
		var tkey = gs[i].getAttribute("id").substring(1);
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

function getTimedURL(url){
	var dateStr = new Date().getTime();
	if ( url.indexOf("?")>0){
		url += "&t="+dateStr;
	} else {
		url += "?t="+dateStr;
	}
	return ( url );
}

async function customShowPoiProperty(target){
	var metaSchema = null;
	metaSchema = target.ownerDocument.firstChild.getAttribute("property").split(","); // debug 2013.8.27
	var nameCol,idCol;
	for ( var i =0 ;i < metaSchema.length; i++ ){
		if ( metaSchema[i].toLowerCase() == "name"){
			nameCol =i;
		}else if ( metaSchema[i].toLowerCase() == "id"){
			idCol = i;
		}
	}
	var metaData = svgMap.parseEscapedCsvLine(target.getAttribute("content"));
	console.log(metaSchema , metaData , nameCol,idCol );
	//varlinkURL="https://www.river.go.jp/kawabou/ipCamera.do?cameraId="+metaData[idCol];
	var varlinkURL="https://www.river.go.jp/kawabou/file/files/master/obs/scam/"+metaData[idCol]+".json";

	var camJson = await fetchJson(varlinkURL);
	console.log("camJson:",camJson);

	var cctvCode = +metaData[idCol];
	var currentURL =camJson.obsInfo.currProvUrl;
	var usualUrl = camJson.obsInfo.normProvUrl;
	i
	// 多分以下のURLがあるときはこれのほうが信頼性高い？
	if ( camJson.obsInfo.currentUrl && camJson.obsInfo.currentUrl.startsWith("https://")){
		currentURL =camJson.obsInfo.currentUrl;
	}
	var altCurrentURL, altCurrentImgURL;
	if ( camJson.obsInfo.currentUrl && camJson.obsInfo.currentUrl.startsWith("http://")){
		altCurrentURL =svgMap.getCORSURL(camJson.obsInfo.currentUrl);
		var ires = await fetch(getTimedURL(altCurrentURL));
		var iblob = await ires.blob();
		altCurrentImgURL = (window.URL || window.webkitURL).createObjectURL(iblob);
		
	}
	
	if ( camJson.obsInfo.normallyUrl && camJson.obsInfo.normallyUrl.startsWith("https://")){
		usualUrl =camJson.obsInfo.normallyUrl;
	}
	
	var capturedTime;
	if ( camJson.obsInfo.currDateProvUrl){
		try{
			var cdj = await fetchJson(camJson.obsInfo.currDateProvUrl);
			if (cdj && cdj.create_time){
				capturedTime = new Date(cdj.create_time).toLocaleString();
			}
		} catch ( e ){
			console.warn("create_time capture failed. Skip");
		}
	}
	
	document.getElementById("poiInfoDiv").innerText=metaSchema+":"+metaData;
	
	var message="<table border='1' style='word-break: break-all;table-layout:fixed;width:100%;border:solid orange;border-collapse: collapse'>";
	message += "<tr><th style='width=25%'>"+metaData[nameCol]+"</th><th>ID: "+metaData[idCol]+"</th></tr>";
	message += "<tr><td><a target='_blank' href='" + varlinkURL + "'>オリジナルデータ</a></td>";
//	message += "</table>";
	message +="<td>";
	if ( camJson.obsInfo.addr){
		message += camJson.obsInfo.addr +"<br>";
	}
	if ( capturedTime ){
		message += capturedTime +"<br>";
	}
	if ( camJson.obsInfo.liveUrl ){
		message += "<a target='_blank' href='" + camJson.obsInfo.liveUrl + "'>ライブ動画映像</a>";
	}
	message += "</td></tr>";
	
	message+="<tr><td colspan='2'>";

	
	if ( currentURL ){
		if ( altCurrentURL){
			message+=`現況<br><img style="max-width: 100%; max-height: 100%; width: auto; height: auto;" src="${getTimedURL(currentURL)}" onerror="this.src = '${altCurrentImgURL}';" />`;
		} else {
			message+=`現況<br><img style="max-width: 100%; max-height: 100%; width: auto; height: auto;" src="${getTimedURL(currentURL)}"/>`;
		}
	} else {
		message+="現況<br>画像がありません";
	}
	if ( usualUrl ){
		message+="<br>平時<br><img style=\"max-width: 100%; max-height: 100%; width: auto; height: auto;\" src=\""+usualUrl+"\"/>";
	} else {
		message+="<br>平時<br>画像がありません";
	}
	
	message += "</td></tr></table>";
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

async function fetchJson(path){
	var dt = new Date().getTime();
	if (path.indexOf("?")>0){
		path = path + "&time="+dt;
	} else {
		path = path + "?time="+dt;
	}
	var response = await fetch(svgMap.getCORSURL(path));
	var json = await response.json();
	
	return ( json );
}
