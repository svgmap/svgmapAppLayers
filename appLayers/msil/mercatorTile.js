// mercatorTile.js
// 画面のスケールと表示領域から、対応するWebメルカトルタイルの行列座標（XYZ/Extent）を計算するモジュール
//
// License: (MPL v2)
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.

var tilePix = 256;
var earthRadius=6378137 ; // in [m] 球面メルカトル: EPSG3897(102100)

function getTile( tileX ,  tileY , level , crs ){
	var tileURL = getURL( tileX , tileY , level);
	
	// タイルのSVGにおけるbboxを得る
	var tLatLng = XY2latLng( tileX * tilePix , tileY * tilePix, level );
	var tSvg = transform( tLatLng.lng , tLatLng.lat , crs );
	var tLatLngBR = XY2latLng( tileX * tilePix + tilePix , tileY * tilePix + tilePix , level  );
	var tSvgBR = transform( tLatLngBR.lng , tLatLngBR.lat , crs );
	tSvg.width  = tSvgBR.x - tSvg.x; // 効率悪い・・改善後回し
	tSvg.height = tSvgBR.y - tSvg.y;
//		console.log("tileSVGXYWH  : " + tSvg.x + " , " + tSvg.y + " , " + tSvg.width + " , " + tSvg.height );
	
	var cl = document.createElement("image");
	cl.setAttribute("x" , tSvg.x);
	cl.setAttribute("y" , tSvg.y);
	cl.setAttribute("width" , tSvg.width);
	cl.setAttribute("height" , tSvg.height);
	cl.setAttribute("xlink:href" , tileURL.URL);
//		cl.setAttribute("opacity" , "0.5");
	cl.setAttribute("metadata" , tileURL.Key);
	cl.setAttribute("data-mercator-tile" , "true");
	
	return ( cl );
}

function getTileSet( geoViewBox , level, tileKeyHeader ){
	if ( tileKeyHeader ){
		tileKeyHeader = tileKeyHeader +"~";
	} else {
		tileKeyHeader ="";
	}
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
	
	
	var mercWH = 2 * earthRadius*Math.PI / Math.pow(2,level);
	var mercAccu = mercWH/tilePix;
	for ( var ty = tileTLxy.y ; ty <= tileBRxy.y ; ty++ ){
		var mercY = earthRadius*Math.PI - (ty+1) / Math.pow(2,level) * 2 * earthRadius*Math.PI;
		for ( var tx = tileTLxy.x ; tx <= tileBRxy.x  ; tx++ ){
			var mercX = -earthRadius*Math.PI + tx / Math.pow(2,level) * 2 * earthRadius*Math.PI;
			var qkey = tileKeyHeader + getKey( tx, ty, level);
			TileSet[qkey] = {
				x:tx,
				y:ty,
				mecratorExtent:{
					x:mercX,
					y:mercY,
					width:mercWH,
					height:mercWH,
					pixel:mercAccu
				}
//				console.log( tx , ty , qkey );
			}
		}
	}
	return ( TileSet );
}

var deg2Rad = Math.PI / 180.0;
// 緯度経度0,0を原点としたメルカトルのXY座標（メートルか、正規化座標(球の半径1)）、経緯度は度
function latLng2Mercator(lat,lng, normalized){
	var x = lng * deg2Rad;
	var y = Math.log(Math.tan(Math.PI/4 +lat*deg2Rad/2));
	if ( normalized ){
		return {x,y}
	} else {
		return {x:earthRadius*x,y:earthRadius*y}
	}
}
function mercator2LatLng(x,y, normalized){
	if ( !normalized ){
		x = x / earthRadius;
		y= y / earthRadius;
	}
	var longitude = x/deg2Rad;
	var latitude =( Math.asin(Math.tanh(y)) ) / deg2Rad;
	return { latitude, longitude };
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


function getLevel(svgMapScale){
	var level = 8;
	var level = Math.floor( Math.LOG2E * Math.log(svgMapScale) + 7.5);
	if (level > 17 ){
		level = 17;
	} else if ( level < 2 ){
		level = 2;
	}
	return level;
}

function getKey(tx , ty , lvl){
	return ( tx + "_" + ty + "_" + lvl );
}


export{getLevel,XY2latLng,latLng2XY,mercator2LatLng,latLng2Mercator,getTileSet}