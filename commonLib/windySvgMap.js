// Description:
// 風等のベクトル場情報をwindy.jsを使ってアニメーション表示するSVGMapレイヤー
//
// Programmed by Satoru Takagi
// 
// License: (MPL v2)
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.
//
// Fork前 (NIIのGPV用のアプリです)
// 2023/08/17 1st working release
// 2023/08/29 Support mercator proj.
// 汎用化
// 2025/07/11 setRenderingParameters()

var wcan;
var windy;

function getLayerCanvas(){
	var layerCanvas = window.parent.document.getElementById(layerID+"_canvas");
	return (layerCanvas);
}

function maintainCanvas(){
	var gc = svgMap.getGeoViewBox();
	var cm = svgImage.getElementById("canvasMarker");
	cm.setAttribute("cx",gc.cx);
	cm.setAttribute("cy",-gc.cy);

	var bm = svgImage.getElementById("bgMask");
	bm.setAttribute("x",gc.x);
	bm.setAttribute("y",-gc.y-gc.height);
	bm.setAttribute("width",gc.width);
	bm.setAttribute("height",gc.height);
}

var animStarted = false;

function zpmc(){
	var lc = getLayerCanvas();
	var cw = lc.width;
	var ch = lc.height;
	var gvb = svgMap.getGeoViewBox();
//	windy.clear();
	if ( windy ){
		windy.start([[0,0],[cw,ch]],cw,ch,[[gvb.x,gvb.y],[gvb.x + gvb.width, gvb.y + gvb.height]]); // OK
		animStarted = true;
	}
}

function preRenderFunction(){
	//console.log("preRenderFunction : windy", typeof windy);
	maintainCanvas();
	if ( !windy || typeof windy !="object"){return;}
	//console.log("windy:",windy);
	windy.stop();
	animStarted = false;
//	windy.clear();
	setTimeout(function(){
		if ( !animStarted){
			zpmc()
		}
	},500);
}

var isMercator = false;
onload=async function(){
	addEventListener("zoomPanMapCompleted",zpmc);
	isMercator = svgMap.getSvgImagesProps()["root"].CRS.mercator;
}


function startWindy(json){
	console.log("startWindy :");
	if ( typeof windy =="object"){
		windy.stop();
		windy.clear();
		windy=null;
	}
	maintainCanvas();
	svgMap.refreshScreen();
	setTimeout(function(){
		//console.log("startWindy ph2");
		var lc = getLayerCanvas();
		//console.log(lc, typeof lc);
		var plateCarree = true;
		if ( isMercator ){
			plateCarree = false;
		}
		//console.log("plateCarree:",plateCarree);
		windy = new Windy({ canvas:lc , data: json , plateCarree});
		windy.setRenderingParameters({multiplier: 1/300, fadeAlpha:0.9} );
		zpmc();
	},500);
}

