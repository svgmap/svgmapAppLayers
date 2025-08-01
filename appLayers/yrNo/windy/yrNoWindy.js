// Description:
// yr.noの風情報をアニメーション表示するSVGMapレイヤー
//
// Programmed by Satoru Takagi
// 
// License: (MPL v2)
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.

// headerの必要な要素は、uCompのlo1,la1, dx,dy, nx,ny,( refTime, forecastTime : 多分使ってない)

// 2025/07/11 initial release
// 2025/08/01 風速ヒートマップを実装

const timeIndexURL = "https://tiles.yr.no/api/wind/available.json";
let timeIndex;
let noforecast=false;
addEventListener("load", async function () {
	noMask = true;
	showLegend("legendDiv");
	if (svgImageProps.hash.toLowerCase().indexOf("noforecast")>0){
		noforecast = true;
	}
	addEventListener("zoomPanMap",checkArea);
	await getTimeIndex();
	buildTimeSelect();
	console.log(timeIndex);
	//	getImage();
	checkArea();
});

async function getTimeIndex() {
	timeIndex = await (await fetch(timeIndexURL)).json();
}

let currentArea=null;
let currentTimeIndex=0;

function checkArea() {
	//console.log("checkArea");
	// ズームレベルを計算(0から6:yrNoの仕様(timeIndex記載)により)
	var level = Math.floor(Math.LOG2E * Math.log(svgImageProps.scale) - 3);
	if (level > timeIndex.maxzoom) {
		level = timeIndex.maxzoom;
	} else if (level < timeIndex.minzoom) {
		level = timeIndex.minzoom;
	}
	var tileSet = getTileSet(svgMap.getGeoViewBox(), level);
	var tiles = {};
	let tileAreaChanged=false;
	for (var k in tileSet) {
		const tile = tileSet[k];
		if ( currentArea && currentArea[k] ){
			tiles[k]=currentArea[k];
		} else {
			tileAreaChanged = true;
			tiles[k] = {z:level, x:tile.x, y:tile.y};
		}
	}
	// console.log("level:", level, " tiles:", tiles);
	currentArea = tiles;
//	getImage(currentArea);
	if ( tileAreaChanged ){
		getImages(currentArea, currentTimeIndex);
	} else {
		//console.log("SKIP updating");
	}
}

//const tiles=[[3,6,3],[3,7,3],[3,6,2],[3,7,2]]; // z,x,y

async function getImages(tiles, tidx=0){
	const baseUrl = timeIndex.times[tidx].tiles.webp;
	for ( const k in tiles ){
		const tile = tiles[k];
		if ( !tile.data ){
			const img = await getWindDataImageTile(baseUrl, tile.z, tile.x, tile.y); // まぁ個数がとても少ないのでPromise.allはいいや
			const windyJson = buildWindData(img, tile);
			tile.data = windyJson;
		}
	}
	const mergedWindyJson = mergeWindyJson(tiles);
	//console.log("mergedWindyJson:",mergedWindyJson);
	startWindy(mergedWindyJson);
	buildHeatMapImage(mergedWindyJson);
}

// 複数のwindyJson形式タイルを一個に統合したwindyJson形式を生成する　結構大変な作業でした・・・
function mergeWindyJson(tiles){
	let xmax = -100 , xmin = 100 , ymax = -100, ymin = 100;
	let z;
	let nx , ny; // タイルのピクセル数
	for ( const k in tiles ){
		const tile = tiles[k];
		z = tile.z;
		nx = tile.data[0].header.nx;
		ny = tile.data[0].header.ny;
		xmax = Math.max(xmax, tile.x);
		xmin = Math.min(xmin, tile.x);
		ymax = Math.max(ymax, tile.y);
		ymin = Math.min(ymin, tile.y);
	}
	const minBound = getTileBounds(z,xmin,ymin)
	const maxBound = getTileBounds(z,xmax,ymax)
	const mergedWidth = maxBound.x + minBound.width - minBound.x;
	const mergedHeight = minBound.y+minBound.height - maxBound.y;
	const mergedNx = (xmax - xmin +1 ) *nx;
	const mergedNy = (ymax - ymin +1 ) *ny;
	const mergedBound = {
		x:minBound.x,
		y:maxBound.y,
		width:mergedWidth,
		height:mergedHeight
	}
	// console.log({minBound,maxBound,mergedWidth,mergedHeight,mergedBound,mergedNx,mergedNy});
	const windX=[];
	const windY=[];
	for ( let y = ymin ; y<=ymax ; y++){
		const mergedDatYtileOffset = (y-ymin)*(mergedNx*ny)
		for ( let x = xmin ; x <=xmax ; x++){
			const mergedDatXoffset = (x-xmin)*nx;
			let tileDatIdx = 0;
			const tile = tiles[getKey(x,y,z)];
			// console.log(tile,tiles,getKey(x,y,z));
			if ( !tile ){continue}
			for ( let py = 0 ; py < ny ; py++){
				const mergedDatYoffet = mergedDatYtileOffset + py * mergedNx;
				for ( let px = 0 ; px < nx ; px++){
					const dataIndex = mergedDatYoffet + (mergedDatXoffset + px);
					windX[dataIndex] = tile.data[0].data[tileDatIdx];
					windY[dataIndex] = tile.data[1].data[tileDatIdx];
					++tileDatIdx;
				}
			}
		}
	}
	const mergedData=[
		{
			header:{
				lo1:mergedBound.x,
				la1:(mergedBound.y + mergedBound.height),
				loSpan:mergedBound.width,
				laSpan:mergedBound.height,
				nx:mergedNx,
				ny:mergedNy,
				parameterCategory:2,
				parameterNumber:2,
				mercatorGrid: true
			},
			data:windX
		},
		{
			header:{
				lo1:mergedBound.x,
				la1:(mergedBound.y + mergedBound.height),
				loSpan:mergedBound.width,
				laSpan:mergedBound.height,
				nx:mergedNx,
				ny:mergedNy,
				parameterCategory:2,
				parameterNumber:3,
				mercatorGrid: true
			},
			data:windY
		}
	];
	return mergedData;
}

async function getImage(tiles) {
	const baseUrl = timeIndex.times[0].tiles.webp;
	const tile = tiles[Object.keys(tiles)[0]];
	console.log("tiles:", tiles, " tile:", tile);
	const img = await getWindDataImageTile(baseUrl, tile.z, tile.x, tile.y);
	console.log("img:", img);
	const windyJson = buildWindData(img, tile);
	startWindy(windyJson);
}

async function getWindDataImageTile(baseUrl, z, x, y) {
	const imageURL = baseUrl
		.replace("{z}", z)
		.replace("{x}", x)
		.replace("{y}", y);

	statusDiv.textContent = 'データをフェッチ中...';
	try {
		const response = await fetch(imageURL);
		if (!response.ok) {
			throw new Error(`HTTPエラー！ ステータス: ${response.status}`);
		}
		const blob = await response.blob();

		return new Promise((resolve, reject) => {
			const img = new Image();
			const url = URL.createObjectURL(blob);

			img.onload = () => {
				URL.revokeObjectURL(url); // オブジェクトURLは不要になったら解放
				statusDiv.textContent = "";
				resolve(img);
			};

			img.onerror = () => {
				URL.revokeObjectURL(url);
				statusDiv.textContent = '画像の読み込みに失敗しました。';
				reject(new Error("画像の読み込みに失敗しました。"));
			};

			img.src = url;
		});
	} catch (error) {
		statusDiv.textContent = `エラー: ${error.message}`;
		console.error("フェッチまたは解析中にエラーが発生しました:", error);
		throw error; // エラーを再スローして、呼び出し元で処理できるようにする
	}
}

function buildWindData(img, zxy) {
	const outputCanvas = document.createElement("canvas");
	const ctx = outputCanvas.getContext("2d");
	const width = img.width;
	const height = img.height;
	outputCanvas.width = width;
	outputCanvas.height = height;
	ctx.drawImage(img, 0, 0);
	const imageData = ctx.getImageData(0, 0, width, height);
	const data = imageData.data;
	const windX = [];
	const windY = [];
	for (let y = 0; y < height; y++) {
		for (let x = 0; x < width; x++) {
			const index = (y * width + x) * 4;
			const r = data[index];
			const g = data[index + 1];

			const vx = (r - 128) / 2;
			const vy = (g - 128) / 2;
			//const windSpeed = Math.sqrt(vx * vx + vy * vy);
			windX.push(vx);
			windY.push(vy);
		}
	}
	var uHeader = makeWindyHeader({ width, height, tiilezxy: zxy }, 2);
	uData = { header: uHeader, data: windX }; // 東西
	var vHeader = makeWindyHeader({ width, height, tiilezxy: zxy }, 3);
	vData = { header: vHeader, data: windY }; // 南北

	var wJson = [uData, vData];

	return wJson;
}

function makeWindyHeader(tileInfo, pn) {
	//console.log(tileInfo);
	const bound = getTileBounds(
		tileInfo.tiilezxy.z,
		tileInfo.tiilezxy.x,
		tileInfo.tiilezxy.y
	);
	const w_rate = bound.width / tileInfo.width;
	const h_rate = bound.height / tileInfo.height;
	var ans = {
		lo1: bound.x,
		la1: bound.y + bound.height, // 北端
		//		dx:w_rate, // mercatorGridなのでこちらは使わない(loSpanにする)
		//		dy:h_rate,
		loSpan: bound.width,
		laSpan: bound.height,
		nx: tileInfo.width,
		ny: tileInfo.height,
		parameterCategory: 2,
		parameterNumber: pn, // U:2, V:3
		mercatorGrid: true, // add 2025/07
	};
	return ans;
}

function getTileBounds(level, tileX, tileY) {
	var tLatLng = XY2latLng(tileX * tilePix, tileY * tilePix, level);
	var tLatLngBR = XY2latLng(
		tileX * tilePix + tilePix,
		tileY * tilePix + tilePix,
		level
	);
	//console.log(tLatLng, tLatLngBR);
	return {
		x: tLatLng.lng,
		y: tLatLngBR.lat,
		width: tLatLngBR.lng - tLatLng.lng,
		height: tLatLng.lat - tLatLngBR.lat,
	};
}

const tilePix = 512;
// ズームレベルからタイルの一片のサイズを返却
function lvl2Res(lvl) {
	var j = 1;
	for (var i = 0; i < lvl; i++) {
		j = j * 2;
	}
	return j * tilePix;
}

// XYから緯度・経度に変換
function XY2latLng(px, py, lvl) {
	var size = lvl2Res(lvl);
	var x = px / size - 0.5;
	var y = 0.5 - py / size;
	var lat = 90 - (360 * Math.atan(Math.exp(-y * 2 * Math.PI))) / Math.PI;
	var lng = 360 * x;
	return {
		lat: lat,
		lng: lng,
	};
}

// 緯度・経度からXYに変換
function latLng2XY(lat, lng, lvl) {
	var size = lvl2Res(lvl);
	var sinLat = Math.sin((lat * Math.PI) / 180.0);
	var pixelX = ((lng + 180.0) / 360.0) * size;
	var pixelY =
		(0.5 - Math.log((1 + sinLat) / (1.0 - sinLat)) / (4 * Math.PI)) * size;
	return {
		x: pixelX,
		y: pixelY,
	};
}

// XYからタイルのXYに変換
function XY2TileXY(xy) {
	var tileX = Math.floor(xy.x / tilePix);
	var tileY = Math.floor(xy.y / tilePix);
	return {
		x: tileX,
		y: tileY,
	};
}

// HashKeyを生成し返却する
function getKey(tx, ty, lvl) {
	return tx + "_" + ty + "_" + lvl;
}

// 指定された地図座標geoViewBoxに、levelのズームレベルの地図を表示する場合に、必要なタイルのXYのセットを返却する
function getTileSet(geoViewBox, level) {
	var TileSet = new Object();
	if (geoViewBox.y + geoViewBox.height > 85.05113) {
		geoViewBox.height = 85.05113 - geoViewBox.y;
	}

	if (geoViewBox.y < -85.05113) {
		geoViewBox.y = -85.05113;
	}

	// 指定エリアの、tileのXYとそのHashKeyを返却する
	var tlxy = latLng2XY(geoViewBox.y + geoViewBox.height, geoViewBox.x, level);
	var tileTLxy = XY2TileXY(tlxy);
	var brxy = latLng2XY(geoViewBox.y, geoViewBox.x + geoViewBox.width, level);
	var tileBRxy = XY2TileXY(brxy);

	// 必要な高さ・幅分のタイル個数分以下を繰り返す
	for (var i = tileTLxy.y; i <= tileBRxy.y; i++) {
		for (var j = tileTLxy.x; j <= tileBRxy.x; j++) {
			// タイルのXYとズームレベルからHashKeyを取得する
			var qkey = getKey(j, i, level);
			// 上記で取得したHashKeyごとに、必要なタイル情報を設定する
			TileSet[qkey] = new Object();
			TileSet[qkey].x = j;
			TileSet[qkey].y = i;
		}
	}
	return TileSet;
}




function buildTimeSelect(){
	function getTimeStr(dateStr){
		let ans = new Date(dateStr).toLocaleString();
		ans = ans.substring(0,ans.lastIndexOf(":"));
		return ans;
	}
	const timeSelParent = timeSel.parentElement;
	if ( noforecast ){
		timeSelParent.innerHTML=`${getTimeStr(timeIndex.times[currentTimeIndex].time)}の情報`;
	} else {
		let idx = 0;
		for ( const time of timeIndex.times ){
			const tt = getTimeStr(time.time);
			timeSel.insertAdjacentHTML("beforeend",`<option value="${idx}" ${idx==0?"selected":""}>${tt}</option>`);
			++idx;
		}
	}
	timeSelParent.style.visibility="";
}

function changeTime(){
	currentArea=null;
	currentTimeIndex = Number(timeSel.options[timeSel.selectedIndex].value);
	console.log(currentTimeIndex);
	checkArea();
}


function radLonlat2mercator(x,y){
	const mY = Math.log(Math.tan(y / 2 + Math.PI / 4));
	return[x,mY];
}


// 2025/07/31 heatmap
function buildHeatMapImage(mergedWindyJson){ // 図法がまずい(メルカトルで粗いので大ズレ)のでメルカトルからPlateCarreeに変換する・・
	const outputCanvas = document.createElement('canvas');
	const ctx = outputCanvas.getContext('2d');
	const width = mergedWindyJson[0].header.nx;
	const height = mergedWindyJson[0].header.ny;
	outputCanvas.width = width;
	outputCanvas.height = height;
	//ctx.drawImage(img, 0, 0);
	const imageData = ctx.getImageData(0, 0, width, height);
	const data = imageData.data;
	for (let y = 0; y < height; y++) {
		
		const lat = (mergedWindyJson[0].header.la1) - mergedWindyJson[0].header.laSpan * y / mergedWindyJson[0].header.ny;
		const mercY = radLonlat2mercator(0,lat * Math.PI/180)[1];
		const mercY0 = radLonlat2mercator(0,(mergedWindyJson[0].header.la1- mergedWindyJson[0].header.laSpan) * Math.PI/180)[1];
		const mercY1 = radLonlat2mercator(0,mergedWindyJson[0].header.la1 * Math.PI/180)[1];
		const ym = Math.floor(mergedWindyJson[0].header.ny - (mercY - mercY0) / ( mercY1 - mercY0)*mergedWindyJson[0].header.ny);
//		console.log("merc-y:",ym," : ", mercY, mercY0,mercY1,mergedWindyJson[0].header.la1, mergedWindyJson[0].header.laSpan);
		let idxm0 = ym * width;
		let idx0 = y * width;
		for (let x = 0; x < width; x++) {
//			const lon = mergedWindyJson[0].header.lo1 + mergedWindyJson[0].header.loSpan * x / mergedWindyJson[0].header.ny; // メルカトルはxについては何もしなくて良い
			
			let midx = idxm0 + x;
			const index = (idx0+x) * 4;
			const vx = mergedWindyJson[0].data[midx];
			const vy = mergedWindyJson[1].data[midx];
			const windSpeed = Math.sqrt(vx * vx + vy * vy);
			const color = getColorForSpeed(windSpeed);
			const fixedColor = fixColor(color,0.5);
			imageData.data [index] = fixedColor [0];     // R
			imageData.data [index + 1] = fixedColor [1]; // G
			imageData.data [index + 2] = fixedColor [2]; // B
			imageData.data [index + 3] = 255;       // A (不透明)
		}
	}
	ctx.putImageData(imageData, 0, 0);
	const durl = outputCanvas.toDataURL('image/png');
//	console.log(durl,mergedWindyJson[0]);
//	const wi = svgImage.createElement("image");
	const wi = svgImage.getElementById("bgMask");
	wi.setAttribute("xlink:href",durl);
	wi.setAttribute("x",mergedWindyJson[0].header.lo1);
	wi.setAttribute("y",-(mergedWindyJson[0].header.la1));
	wi.setAttribute("width",mergedWindyJson[0].header.loSpan);
	wi.setAttribute("height",mergedWindyJson[0].header.laSpan);
	svgMap.refreshScreen();
}

// 風速と色の対応テーブル
const colorTable = [
	{ speed: 32.6, color: [49, 0, 71] },
	{ speed: 28.5, color: [77, 10, 108] },
	{ speed: 24.5, color: [91, 39, 141] },
	{ speed: 20.8, color: [112, 67, 168] },
	{ speed: 17.2, color: [123, 87, 237] },
	{ speed: 13.9, color: [75, 135, 234] },
	{ speed: 10.8, color: [19, 168, 214] },
	{ speed: 8.0, color: [60, 190, 190] },
	{ speed: 5.5, color: [121, 204, 172] },
	{ speed: 0.0, color: [167, 206, 161] }, // 5.4以下をこの色で表現
];

function getColorForSpeed(speed) {
	for (let i = 0; i < colorTable.length - 1; i++) {
		if (speed > colorTable.slice().sort((a, b) => b.speed - a.speed)[i + 1].speed && speed <= colorTable.slice().sort((a, b) => b.speed - a.speed)[i].speed) {
			return colorTable.slice().sort((a, b) => b.speed - a.speed)[i].color;
		}
	}
	return colorTable.slice().sort((a, b) => b.speed - a.speed).pop().color; // 最小値以下の場合は最後の色
}

function fixColor(color, gain){
	const r = Math.floor(color[0]*gain);
	const g = Math.floor(color[1]*gain);
	const b = Math.floor(color[2]*gain);
	//console.log(r,g,b,color);
	return [r,g,b];
}

function showLegend(tgtid){
	const tdiv = document.getElementById(tgtid);
	const tbl = document.createElement("table");
	const tr = document.createElement("tr");
	tbl.appendChild(tr);
	for ( var co of colorTable){
		tr.insertAdjacentHTML("afterbegin",`<td width="24" style="background-color:rgb(${co.color[0]},${co.color[1]},${co.color[2]})"><span style="color:magenta">${co.speed}</span></td>`);
	}
	tr.insertAdjacentHTML("afterbegin","<td>凡例:[m/s]</td>");
	tdiv.appendChild(tbl);
}

