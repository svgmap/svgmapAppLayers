// Description: Dynamic  SVGMap Tile
//
// Programmed by Satoru Takagi
// 
// License: (MPL v2)
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.
//

import { ClientSideQTCT } from './ClientSideQTCT.js';
var clientSideQTCT = new ClientSideQTCT

var qtctMapData;

let pixelColor=[146,23,173,255],titleCol=0,titleFunction,iconFunction;

function clear(){
	function removeAllPOIs(){
		console.log("removeAllPOIs");
		var pois=svgImage.getElementsByTagName("use");
		if ( pois.length >0){
			for ( var i = pois.length -1  ; i >=0 ; i-- ){
				(pois[i].parentElement).removeChild(pois[i]);
			}
		}
	}
	removePrevTiles();
	removeAllPOIs();
	clientSideQTCT.init();
	qtctMapData = null;
	svgImage.firstChild.setAttribute("property","");
}

async function initSvgMapTile(aData, progressCBF,options){
	clear();
	if ( !aData ) { return }
	if ( options?.pixelColor){
		pixelColor = options.pixelColor;
	}
	if ( options?.titleCol){
		titleCol = options.titleCol;
	}
	if ( options?.titleFunction){
		titleFunction = options.titleFunction;
	}
	
	if ( options?.iconFunction){
		iconFunction = options.iconFunction;
	}
	
	var schema = getQTCTcsvSchema(aData.schema);
	svgImage.documentElement.setAttribute("property",schema.metaSchema.join(","));
	qtctMapData = await clientSideQTCT.doQTCT(aData.data, function(col){
		var matadata = [];
		var x,y;
		if ( schema.lngCol > schema.latCol){
			x = col.splice(schema.lngCol,1)[0];
			y = col.splice(schema.latCol,1)[0];
		} else {
			y = col.splice(schema.latCol,1)[0];
			x = col.splice(schema.lngCol,1)[0];
		}
		return [x,y,col];
	},{progressCBF , pixelColor});
	
	
	// window.qtctMapData = qtctMapData; // for debug
	console.log(qtctMapData);
	window.preRenderFunction();
	svgMap.refreshScreen();
	return ( schema );
};


window.preRenderFunction=function(){
	if ( !qtctMapData){return}
	//console.log("Called window.preRenderFunction, svgMap:",svgMap,"  svgImage:",svgImage," layerID:",layerID);
	var level = Math.floor( Math.LOG2E * Math.log(svgImageProps.scale) + 6.5);
	var gvb = svgMap.getGeoViewBox();
	//console.log("geoVB:", gvb,"  level:",level);
	var tileSet = clientSideQTCT.getTileSet(gvb,level)
	console.log("getTileSet:",tileSet);
	
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
		
		let iconID;
		if ( typeof iconFunction =="function"){
			iconID = iconFunction(poiDat[2]);
		} else {
			iconID = "#p0";
		}
		poi.setAttribute("xlink:href",iconID);
		poi.setAttribute("x",0);
		poi.setAttribute("y",0);
		poi.setAttribute("content",poiDat[2].join(","));
		poi.setAttribute("transform","ref(svg,"+Number(poiDat[0])*100+","+(-Number(poiDat[1])*100)+")" );
		let title;
		if ( typeof titleFunction=="function"){
			title = titleFunction(poiDat[2]);
		} else {
			title = poiDat[2][titleCol];
		}
		poi.setAttribute("xlink:title",title);
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
		if ( gs[i].parentElement.nodeName == "defs"){continue}
		if ( tileSet ){
			var tkey = gs[i].getAttribute("id").substring(1);
			if ( !tileSet[tkey]){ // 必要なタイルのセットの中にないものは消去
				gs[i].remove();
			} else { // あったものについてはタイルセットのほうを消去
				delete tileSet[tkey];
			}
		} else {
			gs[i].remove();
		}
	}
}


function getQTCTcsvSchema(col){
	// 元データから、緯度と経度のカラムが抜かれたものがmetaSchemaになり、元データの緯度経度カラムの番号がそれぞれlatCol,lngColに入る
	// latCol,lngColはmetaSchemaの配列のインデックスには符合しないので要注意
	var latCol=-1,lngCol=-1;
	var metaSchema=[];
	for ( var i = 0 ; i < col.length ; i++ ){
		if (latCol==-1 && col[i].indexOf("緯度")>=0 ){
			latCol = i;
		} else if (lngCol==-1 && col[i].indexOf("経度")>=0){
			lngCol = i;
		} else {
			metaSchema.push(col[i]);
		}
	}
	return {
		latCol:latCol,
		lngCol:lngCol,
		metaSchema:metaSchema
	}
}

export { initSvgMapTile , getQTCTcsvSchema}