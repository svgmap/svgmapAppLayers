// 
// Description:
// WebApp layer for SVGMap.js to draw experimental GSI map data in mapbox vector tile data format.
// 
//  Programmed by Satoru Takagi
//  
//  Copyright (C) 2021- by Satoru Takagi @ KDDI CORPORATION
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
// 
// History:
//  2021/03/01 mapboxのバイナリデータ形式の読み込み方法が判明
//  2021/04/01 スタイリングは全くやっていませんが、基本的なレンダリングを実装(ビューボックス(ズームレベル・表示領域)に応じた等分割タイルピラミッドの差分取得と描画)
//  2021/07/01 JMAの危険度分布表示に利用

// TBD: 注記を含むスタイリング～　たいへんそうなのでやるかどうかは必要に応じてになりますが・・

// 以下の変数を外部から設定する
var pbfLayerID,pbfImage,pbfImageProps; 
var pbfEnabled = true;
//var basePbfURL :"https://www.jma.go.jp/bosai/jmatile/data/[[category0]]/[[basetime]]/[[category1]]/[[validtime]]/[[category2]]/[[category3]]/[[zoom]]/[[tx]]/[[ty]].pbf" でcat*,*time設定したものを与える
//var basePbfURL0 = "https://www.jma.go.jp/bosai/jmatile/data/risk/20210701002000/none/20210701002000/surf/flood/[[zoom]]/[[tx]]/[[ty]].pbf";
var basePbfURL0 = "https://www.jma.go.jp/bosai/jmatile/data/risk/[[baseTime]]/none/[[validTime]]/surf/flood/[[zoom]]/[[tx]]/[[ty]].pbf";
function setPbfURL(baseT,validT){
	var pburl=basePbfURL0.replace("[[baseTime]]",baseT);
	pburl=pburl.replace("[[validTime]]",validT);
	basePbfURL = pburl;
	console.log("setPbfURL basePbfURL:",basePbfURL);
	clearAllTiles();
	zoomPanMapFunction();
}
var basePbfURL = "https://www.jma.go.jp/bosai/jmatile/data/risk/20210630222000/none/20210630222000/surf/flood/[[zoom]]/[[tx]]/[[ty]].pbf";
// ここまで


function initParams(){
	for ( pbfLayerID in svgImageProps.childImages){
		break
	}
	
	pbfImageProps=svgMap.getSvgImagesProps()[pbfLayerID];
	pbfImageProps.isClickable=false;
	pbfImage=svgMap.getSvgImages()[pbfLayerID];
	//console.log("initParams pbfLayerID:",pbfLayerID," pbfImageProps:",pbfImageProps," pbfImage:",pbfImage);
	if ( ! pbfImage ){
		setTimeout(initParams,100);
	} else {
		zoomPanMapFunction();
	}
}

addEventListener("load",function(){
	initParams();
//	setTimeout(initParams,100);
//	setTimeout(zoomPanMapFunction,110);
});

addEventListener("zoomPanMap",zoomPanMapFunction);
addEventListener("zoomPanMapCompleted",function(){ // for test
	console.log("jma_pbf zoomPanMapCompleted");
});

async function zoomPanMapFunction(){
	if ( !pbfEnabled ){
		//console.log("pbf disabled exit.");
		return;
	} else {
		//console.log("pbf ENABLED.");
	}
//	console.log("called gsivm zoomPanMapFunction:",window,pbfImage,pbfImageProps,svgMap.getGeoViewBox());
	var level = Math.floor( Math.LOG2E * Math.log(pbfImageProps.scale) + 6);
	if ( level < 4 ){
		level = 4;
	} else if ( level > 17 ){
		level = 17;
	}
//	console.log("called gsivm zoomPanMapFunction: level:",level);
	var tileSet = getTileSet( svgMap.getGeoViewBox() , level );
	//console.log("called gsivm zoomPanMapFunction: tileSet:",tileSet);
	
	var areaParentElm = pbfImage.getElementById("areas");
	
	var currentTiles =  areaParentElm.getElementsByTagName("g");
	
	for ( var i = currentTiles.length - 1 ; i >= 0 ; i-- ){
		var oneTile = currentTiles[i];
		var qkey = oneTile.getAttribute("data-metadata");
		if ( tileSet[qkey] ){
			// console.log("exist, skip:",qkey);
			tileSet[qkey].exist = true;
		} else {
			//console.log("Not exist, remove:",qkey);
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
			var tileContElement = pbfImage.createElement("g");
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

function clearAllTiles(){
	var areaParentElm = pbfImage.getElementById("areas");
	removeChildren(areaParentElm);
	//console.log("clearAllTiles");
}

async function drawPbfTile(tx,ty,tz,tileContElement){
	var geoData = await getPbf(tx,ty,tz);
	drawGeoData(geoData, {x:tx,y:ty,z:tz}, tileContElement);
}

function getURL(tx,ty,tz){
	var mapServerURL = basePbfURL.replace("[[zoom]]", tz );
	mapServerURL = mapServerURL.replace("[[tx]]", tx );
	mapServerURL = mapServerURL.replace("[[ty]]", ty );
	return ( mapServerURL );
}

async function getPbf(tx,ty,tz){
//	console.log("caled getPbf");
	// テンプレートリテラル・・ちょっと微妙な使い勝手？　使い方理解しきれてないだけかも
//	var url = `https://www.jma.go.jp/bosai/jmatile/data/map/none/none/none/surf/flood_name/${tz}/${tx}/${ty}.pbf`;
//	var url = `https://www.jma.go.jp/bosai/jmatile/data/risk/20210701002000/none/20210701002000/surf/flood/${tz}/${tx}/${ty}.pbf`;
//	https://www.jma.go.jp/bosai/jmatile/data/risk/20210701002000/none/20210701002000/surf/flood/12/3639/1622.pbf
//	var url =`https://cyberjapandata.gsi.go.jp/xyz/experimental_bvmap/${tz}/${tx}/${ty}.pbf`; // z,x,y
	var url = getURL(tx,ty,tz);
	//console.log("caled getPbf: url:",url);
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

var colorTable={
	1:"#faf500",
	2:"#fa4600",
	3:"#da4fed",
	4:"#7e2d97"
}
function drawGeoData(geoData,xyz, tileContElement){
	for ( var key in geoData.layers ){
		var layer = geoData.layers[key];
		var fc = layer.length
		//console.log("layer:",layer," key:",key,"  length:",fc);
		for ( var i = 0 ; i < fc ; i++ ){
			var geojson = layer.feature(i).toGeoJSON(xyz.x,xyz.y,xyz.z); // geoGeojson(x,y,z)の数値はタイルのxyzのことです
			//console.log(key," geojson:",i," level:",geojson.properties.level);
			
			var color=colorTable[geojson.properties.level];
			svgMapGIStool.drawGeoJson(geojson,pbfLayerID,color,3,color, "p0", "poi", "", tileContElement);
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


