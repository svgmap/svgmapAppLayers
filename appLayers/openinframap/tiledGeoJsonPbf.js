// 
// Description:
// WebApp layer for SVGMap.js to draw experimental GSI map data in mapbox vector tile data format.
// 
//  Programmed by Satoru Takagi
//  
// License: (MPL v2)
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.
// 
// History:
//  2021/03/01 mapboxのバイナリデータ形式の読み込み方法が判明
//  2021/04/01 スタイリングは全くやっていませんが、基本的なレンダリングを実装(ビューボックス(ズームレベル・表示領域)に応じた等分割タイルピラミッドの差分取得と描画)
//  FORK
//  2023/02/22 OpenInfrastructureMap

// Pbf, VectorTileクラスが必要　⇒　windowで、以下のロードが必要
// <script src="https://unpkg.com/pbf@3.0.5/dist/pbf.js"></script>
// <script src="../../pbfTile/mbvt.js"></script>

// ISSUE
//   レベルがかわるときに点滅する。　全部がロードし終わってから元のを消すべき

var metaNameList ;

var currentLevel;
var defaultLevelOffset = 6;
var levelOffset = defaultLevelOffset;
var schema

var parentGroup;
/**
onload=function(){
	setTimeout(zoomPanMapFunction,20);
}
**/

// addEventListener("zoomPanMap",zoomPanMapFunction);

//var prevLevel = -1;
async function zoomPanMapFunction(options){
//	console.log("called gsivm zoomPanMapFunction:",window,svgImage,svgImageProps,svgMap.getGeoViewBox());
	console.log("ZPM: ");
	var level = Math.floor( Math.LOG2E * Math.log(svgImageProps.scale) + levelOffset);
	if ( level < 4 ){
		level = 4;
	} else if ( level > 16 ){
		level = 16;
	}
	currentLevel = level;
//	prevLevel = currentLevel;
//	console.log("called gsivm zoomPanMapFunction: level:",level);
	var tileSet = getTileSet( svgMap.getGeoViewBox() , level );
	console.log("called gsivm zoomPanMapFunction: tileSet:",tileSet);
	
	var areaParentElm = parentGroup;
	if ( options && options.totallyRefresh ){
		removeChildren(areaParentElm);
	}
	
	var currentTiles =  areaParentElm.getElementsByTagName("g");
	
	for ( var i = currentTiles.length - 1 ; i >= 0 ; i-- ){
		var oneTile = currentTiles[i];
		var qkey = oneTile.getAttribute("data-metadata");
		if ( tileSet[qkey] ){
			// console.log("exist, skip:",qkey);
			tileSet[qkey].exist = true;
		} else {
			console.log("Not exist, remove:",qkey);
			oneTile.parentNode.removeChild(oneTile);
		}
	}
	
//	removeChildren(areaParentElm);
	
	for ( var tkey in tileSet ){
		if ( ! tileSet[tkey].exist ){
			//console.log("Load new tile:",tkey);
			var tx = tileSet[tkey].x;
			var ty = tileSet[tkey].y;
			var tz = level;
			//console.log(tx,ty,tz);
			var tileContElement = svgImage.createElement("g");
			tileContElement.setAttribute("data-metadata", tkey);
			areaParentElm.appendChild(tileContElement);
			//var geoData = await getPbf(tx,ty,tz);
			//drawGeoData(geoData, {x:tx,y:ty,z:tz}, tileContElement);
			drawPbfTile(tx,ty,tz,tileContElement);
		} else {
			//console.log("Already exist:",tkey);
		}
	}
}

async function drawPbfTile(tx,ty,tz,tileContElement){
	var geoData = await getPbf(tx,ty,tz);
	if (!metaNameList){
		metaNameList = buildSchema(geoData, {x:tx,y:ty,z:tz});
		svgImage.documentElement.setAttribute("property",metaNameList.join(","));
	}
	drawGeoData(geoData, {x:tx,y:ty,z:tz}, tileContElement);
}

var urlTemplate;
async function getPbf(tx,ty,tz){
//	console.log("caled getPbf");
	var url = urlTemplate.replace("${tx}",tx);
	url = url.replace("${ty}",ty);
	url = url.replace("${tz}",tz);
//	url = `https://openinframap.org/tiles/${tz}/${tx}/${ty}.pbf`;
//	console.log("url:",url);
	let response = await fetch(url);
	if (response.ok) {
		var bufferRes = await response.arrayBuffer();
		var pbf = new Pbf(new Uint8Array(bufferRes));
		var obj = new VectorTile(pbf);
		return obj;
	} else {
		console.error("error:", response.status);
	}
};

function buildSchema(geoData,xyz){
	var metaNames ={};
	for ( var key in geoData.layers ){
		var layer = geoData.layers[key];
		var fc = layer.length
		//console.log("layer:",layer," key:",key,"  length:",fc);
		for ( var i = 0 ; i < fc ; i++ ){
			var geojson = layer.feature(i).toGeoJSON(xyz.x,xyz.y,xyz.z); // geoGeojson(x,y,z)の数値はタイルのxyzのことです
			for ( var pname in geojson.properties ){
				metaNames[pname]=true;
//				window.metaNames[pname]=true;
			}
		}
	}
	var metaNameList=[];
	for ( var metaName in metaNames){
		metaNameList.push(metaName);
	}
	console.log("metaNameList:",metaNameList);
	return ( metaNameList );
}

var geojsonFilter, layerFilter;

function drawGeoData(geoData,xyz, tileContElement){
	for ( var key in geoData.layers ){
		//console.log(geoData.layers);
		if (typeof layerFilter =="function" && layerFilter(key)!=true){
			continue;
		}
		var layer = geoData.layers[key];
		var fc = layer.length
		//console.log("layer:",layer," key:",key,"  length:",fc);
		for ( var i = 0 ; i < fc ; i++ ){
			var geojson = layer.feature(i).toGeoJSON(xyz.x,xyz.y,xyz.z); // geoGeojson(x,y,z)の数値はタイルのxyzのことです
			if ( typeof geojsonFilter =="function"){
				geojsonFilter(geojson);
			}
			if ( !geojson.properties){geojson.properties={}}
			geojson.properties.subLayer=key;
			var color="blue";
			var poiId = "p0";
			//console.log(key," geojson:",i,":",geojson);
			svgMapGIStool.drawGeoJson(geojson,layerID,color,1.5,color, poiId, key, "", tileContElement, metaNameList);
		}
	}
	//console.log("load Completed:",xyz);
	svgMap.refreshScreen();
}



// メルカトルタイルのURLを取得する関数群
function getTileSet( geoViewBox , level ){
	var TileSet = new Object();
	if ( geoViewBox.y + geoViewBox.height > 85.05113 ){
		geoViewBox.height = 85.05113 -  geoViewBox.y;
	}
	
	if ( geoViewBox.y < -85.05113 ){
		geoViewBox.y = -85.05113;
	}
	
	// 指定エリアの、tileのXYとそのHashKeyを返却する
	var tlxy = latLng2XY( geoViewBox.y + geoViewBox.height , geoViewBox.x , level );
	var tileTLxy = XY2TileXY( tlxy );
	var brxy = latLng2XY( geoViewBox.y , geoViewBox.x + geoViewBox.width, level );
	var tileBRxy = XY2TileXY( brxy );
	
	for ( var i = tileTLxy.y ; i <= tileBRxy.y ; i++ ){
		for ( var j = tileTLxy.x ; j <= tileBRxy.x  ; j++ ){
			var qkey = getKey( j, i, level);
			TileSet[qkey] = new Object();
			TileSet[qkey].x = j;
			TileSet[qkey].y = i;
//				console.log( j , i , qkey );
		}
	}
	return ( TileSet );
}

function latLng2XY( lat , lng , lvl ){
	var size = lvl2Res(lvl);
//		console.log("size:" + size);
	var sinLat = Math.sin(lat * Math.PI / 180.0);
	var pixelX = (( lng + 180.0 ) / 360.0 ) * size;
	var pixelY = (0.5 - Math.log((1 + sinLat) / (1.0 - sinLat)) / (4 * Math.PI)) * size;
	return {
		x : pixelX ,
		y : pixelY
	}
}

function XY2TileXY( xy ){
	var tileX = Math.floor(xy.x / tilePix);
	var tileY = Math.floor(xy.y / tilePix);
	return {
		x : tileX ,
		y : tileY
	}
}

var tilePix = 256;
function lvl2Res( lvl ){
	var j = 1;
	for(var i = 0 ; i < lvl ; i++){
		j = j * 2;
	}
	return ( j * tilePix );
}

function XY2latLng( px , py , lvl ){
	var size = lvl2Res(lvl);
	var x = ( px / size ) - 0.5;
	var y = 0.5 - ( py / size);
	var lat = 90 - 360 * Math.atan(Math.exp(-y * 2 * Math.PI)) / Math.PI;
	var lng = 360 * x;
	return{
		lat : lat ,
		lng : lng
	}
}

function getKey(tx , ty , lvl){
	return ( tx + "_" + ty + "_" + lvl );
}

function removeChildren(element){
	while (element.firstChild) element.removeChild(element.firstChild);
}

function setFilter( layerFilterFunction, geojsonFilterFunction ){
	if ( typeof geojsonFilterFunction =="function"){
		geojsonFilter = geojsonFilterFunction;
	} else {
		geojsonFilter = null;
	}
	if ( typeof layerFilterFunction =="function"){
		layerFilter = layerFilterFunction;
	} else {
		layerFilter = null;
	}
}

function initPbfTile(URL_Template, targetGroup, metaNameListInp){
//	window.metaNames={};
	urlTemplate = URL_Template;
	if ( !targetGroup ){
		if ( svgImage.getElementById("areas") ){
			parentGroup = svgImage.getElementById("areas");
		} else {
			parentGroup = svgImage.createElement("g");
			parentGroup.setAttribute("id","areas");
			svgImage.documentElement.appendChild(parentGroup);
		}
	} else {
		parentGroup = targetGroup;
	}
	if ( metaNameListInp ){
		metaNameList = metaNameListInp;
		svgImage.documentElement.setAttribute("property",metaNameList.join(","));
	}
}

export { zoomPanMapFunction, setFilter, initPbfTile };