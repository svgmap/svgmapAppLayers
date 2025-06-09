// Description:
// Geoid Height Calculator
//
// Programmed by Satoru Takagi
// 
// License: (MPL v2)
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.
// 
// History:
// 2022/02/08 : 1st rev.

onload = async function(){
	initPOIUI();

	await buildData();
	/**
	tests:
	x,y lng,lat 正解データ
	500,800 132.5,33.333600000000004 33.1343
	500,801 132.5,33.350267 33.163
	501,801 132.525,33.350267 33.299
	501,800 132.525,33.333600000000004 33.2766
	
	132.5,33.3419335: 33.14865
	132.5125,33.3419335: 33.218225000000004
	
	console.log(getGeoidHeight(132.5,33.333600000000004));//33.1343
	console.log(getGeoidHeight(132.5,33.350267));//33.163
	console.log(getGeoidHeight(132.525,33.350267));//33.299
	console.log(getGeoidHeight(132.525,33.333600000000004));//33.2766
	console.log(getGeoidHeight(132.5,33.3419335));//33.14865
	console.log(getGeoidHeight(132.5125,33.3419335));//33.218225000000004
	console.log(getGeoidHeight(135,35));
	console.log(getGeoidHeight(144.353085,41.034875));
	console.log(getGeoidHeight(140.737947,41.817221)); // should be null
	console.log(getGeoidHeight(139.766572,35.680466));
	console.log(getGeoidHeight(139.559589,34.070841));
	console.log(getGeoidHeight(140.673977,33.856008)); // should be null
	console.log(getGeoidHeight(124.148742,24.339679));
	**/
	
	showGridImage();
}

var geoidGrid=[];
var dataProps;


async function buildData(){
	var gtxt = await loadText("gsigeo2011_ver2_1.asc");
	
	gtxt = gtxt.split("\n");
	
	dataProps = getHeader(gtxt[0]);
	var gx=0, gy=0;
	var geoidGridLine=[];
	for ( var i = 1 ; i < gtxt.length ; i++){
		var na = getNumberArray(gtxt[i]);
		gx += na.length;
		geoidGridLine = geoidGridLine.concat(na);
		if ( gx >= dataProps.nlo ){
			geoidGrid.push(geoidGridLine);
			geoidGridLine=[];
			gx=0;
		}
	}
	//console.log("dataProps:",dataProps);
	//console.log("geoidGrid:",geoidGrid);
}

function showGridImage(){
	var duri = buildImage(geoidGrid,document.getElementById("geoidCanvas"));
	// 生成した画像の地理的な範囲
	// 画像になると、グリッドの点は画像のピクセルの中心となることに注意！
	var imageGeoArea={
		lng0: dataProps.glomn - dataProps.dglo/2,
		lat0: dataProps.glamn - dataProps.dgla/2,
		lngSpan: dataProps.nlo * dataProps.dglo,
		latSpan: dataProps.nla * dataProps.dgla
	}
	if ( typeof(svgMap)=="object" ){
		buildSvgImage(duri,imageGeoArea);
	}
}

function buildImage(geoidGrid, canvas){
	canvas.width=dataProps.nlo;
	canvas.height=dataProps.nla;
	var context = canvas.getContext('2d');
	var imageData = context.getImageData(0, 0, canvas.width, canvas.height);
	var pixels = imageData.data; 
	for ( var py = 0 ; py < dataProps.nla ; py++ ){
		var dy = dataProps.nla - 1 - py
		for ( var px = 0 ; px < dataProps.nlo ; px++ ){
			var base = (dy * dataProps.nlo + px) * 4;
			if ( geoidGrid[py][px]!=999){
				
				var hue = (1-(geoidGrid[py][px]-dataProps.minVal)/(dataProps.maxVal-dataProps.minVal))*270;
				
				var rgb = HSVtoRGB(hue,255,255);
				
				pixels[base + 0] = rgb.r;  // Red
				pixels[base + 1] = rgb.g;  // Green
				pixels[base + 2] = rgb.b;  // Blue
				pixels[base + 3] = 255;  // Alpha
			}
		}
	}
	context.putImageData(imageData, 0, 0);
	var duri = canvas.toDataURL('image/png');
	return ( duri );
}

function getHeader(line){
	var datas = parseLine(line);
	return {
		glamn:Number(datas[0]),
		glomn:Number(datas[1]),
		dgla:Number(datas[2]),
		dglo:Number(datas[3]),
		nla:Number(datas[4]),
		nlo:Number(datas[5]),
		ikind:Number(datas[6]),
		vern:datas[7],
		minVal:9e99,
		maxVal:-9e99
	}
}

function getNumberArray(line){
	var ans = [];
	var lineArray = parseLine( line );
	for ( var col of lineArray){
		var val = Number(col);
		if ( val != 999){
			if ( val > dataProps.maxVal){
				dataProps.maxVal=val;
			}
			if ( val < dataProps.minVal){
				dataProps.minVal=val;
			}
		}
		ans.push(val);
	}
	return ( ans );
}

function parseLine(line){
	var ans = line.trim().split(/\s+/)
	return (ans);
}


function getGeoidHeight(lng,lat){
	return ( biLinearInterpolate(lng,lat) );
}

function biLinearInterpolate(lng,lat){
	// バイリニア補完によって、任意の緯度経度(実数)でのジオイド高を算出する(世界測地系)
	//lng=lng1,lat=lat0 : u=1, t=0, Z=Z10(経度1,緯度0のグリッド値)
	//lng=lng0,lat=lat1 : u=0, t=1, Z=Z01(経度0,緯度1のグリッド値)
	//lng=lng0,lat=lat0 : u=0, t=0, Z=Z00
	//lng=lng1,lat=lat1 : u=1, t=1, Z=Z11
	var px = Math.floor((lng-dataProps.glomn)/dataProps.dglo);
	var py = Math.floor((lat-dataProps.glamn)/dataProps.dgla);
	
	if ( px < 0 || px > dataProps.nlo -1 || py < 0 || py > dataProps.nla ){
		return ( null );
	}
	
	var lng0 = dataProps.glomn + px * dataProps.dglo;
	var lat0 = dataProps.glamn + py * dataProps.dgla;
	var lng1 = lng0 + dataProps.dglo;
	var lat1 = lat0 + dataProps.dgla;
	
	var Z00 = geoidGrid[py][px];
	var Z10 = geoidGrid[py][px+1];
	var Z01 = geoidGrid[py+1][px];
	var Z11 = geoidGrid[py+1][px+1];
	
	
	if ( Z00 == 999 || Z10 == 999 || Z01 == 999 || Z11 == 999 ){
		return ( null );
	}
	
	var u = (lng - lng0)/(lng1 - lng0);
	var t = (lat - lat0)/(lat1 - lat0);
	var Z = (1 - t) * (1 - u) * Z00 + (1 - t) * u * Z10 + t * (1 - u) * Z01 + t * u * Z11;
	
	// console.log(" lng:",lng," lat:",lat," lng0:",lng0," lng1:",lng1," lat0:",lat0," lat1:",lat1," Z00:",Z00," Z01:",Z01," Z10:",Z10," Z11:",Z11," u:",u," t:",t," Z:",Z);
	
	return ( Z );
}

async function loadText(url){ // テキストデータをfetchで読み込む
	messageDiv.innerText="ジオイド高データ読み込み中";
	var response = await fetch(url);
	var txt = await response.text();
	messageDiv.innerText="";
	return ( txt );
}

function HSVtoRGB (h, s, v) { // from http://d.hatena.ne.jp/ja9/20100903/1283504341
	var r, g, b; // 0..255
	while (h < 0) {
		h += 360;
	}
	h = h % 360;
	
	// 特別な場合 saturation = 0
	if (s == 0) {
		// → RGB は V に等しい
		v = Math.round(v);
		return {'r': v, 'g': v, 'b': v};
	}
	s = s / 255;
	
	var i = Math.floor(h / 60) % 6,
	f = (h / 60) - i,
	p = v * (1 - s),
	q = v * (1 - f * s),
	t = v * (1 - (1 - f) * s);

	switch (i) {
	case 0 :
		r = v;  g = t;  b = p;  break;
	case 1 :
		r = q;  g = v;  b = p;  break;
	case 2 :
		r = p;  g = v;  b = t;  break;
	case 3 :
		r = p;  g = q;  b = v;  break;
	case 4 :
		r = t;  g = p;  b = v;  break;
	case 5 :
		r = v;  g = p;  b = q;  break;
	}
	return {'r': Math.round(r), 'g': Math.round(g), 'b': Math.round(b)};
}

function calcGeoidHeight(){
	var lnglat=lnglatinp.value.split(",");
	var lng = Number(lnglat[0]);
	var lat = Number(lnglat[1]);
	if (Math.abs(lng)>180 && Math.abs(lat)>90){
		lng = parseDDDMMSSpSSSS(lnglat[0]);
		lat = parseDDDMMSSpSSSS(lnglat[1]);
	}
	var geiodHeight = getGeoidHeight(lng,lat);
	messageDiv.innerText=geiodHeight+" m";
}


function parseDDDMMSSpSSSS(dmssStr){
	dmssStr=dmssStr.trim();
	var pp = dmssStr.indexOf(".");
	var sp,mp;
	if (pp <0){
		sp = dmssStr.length - 2;
	} else {
		sp = pp - 2;
	}
	mp = sp - 2;
	
	var s=Number(dmssStr.substring(sp));
	var m=Number(dmssStr.substring(mp,sp));
	var d=Number(dmssStr.substring(0,mp));
	var ans = d + m/60 + s/3600;
	return ( ans );
}

// 以下はSVGMapレイヤーとして動かしたときに有効になる関数

var CRSad = 100; // svgmapコンテンツのCRSきめうち・・

function  buildSvgImage(imageDataUri,imageParam){
	// dataURLを受け取って、SVGMapコンテンツに画像を張り付ける
	var root = svgImage.documentElement;
	
	var rct = svgImage.createElement("image");
	rct.setAttribute("x", imageParam.lng0 * CRSad);
	rct.setAttribute("y", -(imageParam.lat0 + imageParam.latSpan) * CRSad);
	rct.setAttribute("width", imageParam.lngSpan * CRSad);
	rct.setAttribute("height", imageParam.latSpan * CRSad);
	rct.setAttribute("xlink:href",imageDataUri);
	rct.setAttribute("style","image-rendering:pixelated");
//	console.log(rct);
	root.appendChild(rct);
	svgMap.refreshScreen();
}

var poiUI;
function initPOIUI(){
	poiUI=document.getElementById("pointInputUI");
	var getPointOnly = false;
	svgMapAuthoringTool.initPOIregistTool(poiUI,svgImageProps.rootLayer,"targetPoint","p0","targetPoint","",POIUIcbFunc,"cbFuncParam",getPointOnly);
}

function POIUIcbFunc(){
	var latlngs=(poiUI.getElementsByTagName("input")[2].value).split(",");
	console.log(latlngs);
	var lat=Number(latlngs[0]);
	var lng=Number(latlngs[1]);
	var geiodHeight = getGeoidHeight(lng,lat);
	messageDiv.innerText=geiodHeight+" m";
}

