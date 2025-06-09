// Description:
// EPSG:3857のWMSを使用して、画面いっぱいのイメージを生成するSimple WMS Layer
//
// Programmed by Satoru Takagi
// 
// License: (MPL v2)
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.
//
// HISTORY:
// 2024/08/27 : 従来の実装（dynamic_WMS_general_mercator2pc_noTile_canvas.html）とは別物として、svgmapjsのメルカトルサポートを使った新しい実装を行った

const EPSG3857={ // x,yは左上の座標　SVGMapのmercatorの{x:0,y:0,width:1,height:1}に対応する値
	x:-20037508.34,
	y:20037508.34,
	width:20037508.34*2,
	height:20037508.34*2
};

var _baseURL ;

var requestEncoderFunction;

function initWMS(baseURL, progressCBF, requestEncoder){
	console.log("baseURL:",baseURL);
	_baseURL = baseURL;
	if ( requestEncoder ){
		requestEncoderFunction = requestEncoder;
	}
	document.addEventListener("zoomPanMap", zoomPanMapFunc,false);
	
	zoomPanMapFunc();
};

function zoomPanMapFunc(){
	console.log("This is zoomPanMapFunc: svgImageProps:",svgImageProps);
	var wmsimg = getWMSimage();
	console.log(" wmsurl:",wmsimg);
	var prevImg = svgImage.getElementById("wmsSingleImage");
	if ( prevImg){
		prevImg.remove();
	}
	svgImage.getElementById("mapContents").appendChild(wmsimg);
//	var iUrl = getWmsImageURL(geoViewBox, canvasSize);
//	loadImage2Canvas(iUrl,geoViewBox);
	svgMap.refreshScreen();
}

function getWMSimage(baseURL){
	var si = svgImage.createElement("image");
	var cs = svgMap.getMapCanvasSize();
	var geoViewBox = svgMap.getGeoViewBox();
	var mercatorVB = svgMap.getTransformedBox(geoViewBox,svgImageProps.CRS);
	var wmsVB = get3857box(mercatorVB);
	console.log(geoViewBox,mercatorVB,wmsVB);
	var url = `${_baseURL}&CRS=EPSG:3857&WIDTH=${cs.width}&HEIGHT=${cs.height}&BBOX=${wmsVB.x},${wmsVB.y},${wmsVB.x+wmsVB.width},${wmsVB.y+wmsVB.height}`;
	if ( requestEncoderFunction ){
		url = requestEncoderFunction(url);
	}
	si.setAttribute("xlink:href",url);
	si.setAttribute("x",mercatorVB.x);
	si.setAttribute("y",mercatorVB.y);
	si.setAttribute("width",mercatorVB.width);
	si.setAttribute("height",mercatorVB.height);
	si.setAttribute("id","wmsSingleImage");
	return si;
}

function get3857box(mercatorVB){
	var x = (mercatorVB.x-0.5) * EPSG3857.width;
	var y = (0.5-mercatorVB.y) * EPSG3857.height;
	var width = mercatorVB.width * EPSG3857.width;
	var height = mercatorVB.height * EPSG3857.height;
	y=y-height; // 上座標だったので・・
	return {x,y,width,height}
}

export{initWMS}
