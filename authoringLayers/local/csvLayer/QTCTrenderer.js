// Client Side QTCT SVGMap Renderer
// Progammed by Satoru Takagi
// ClientSideQTCTモジュールを用いてSVGMapコンテンツの描画を動的に行うモジュール
// この実装は、ちゃんとしたモジュールとして別ファイル化して使いまわせるようにすべき
// rev18 ClientSideQTCT impl
// Ported from river/riverr2022/CCTV
var qtctMapData; // ここにQuadTreeCompositeTilingされたデータが格納される
window.useQTCT=false; // trueの時のみQTCT表示させる
window.buildQTCTdata = buildQTCTdata;
window.clearQTCTdata = clearData;

var csvSchema;
var clientSideQTCT;

const colors = [[0x1d,0x64,0xbb],[0x1a,0xb9,0xb7],[0x71,0xf0,0x49],[0xf0,0xea,0x4a],[0xf0,0x49,0x49],[0xf5,0x4f,0xf7]]; // このcolorはPOIのビットイメージの実際の色に対応させている。csvXhr_r*.svgのdefs #p?で定義(png読んで色を統計し自動設定すと良いけど面倒なのでひとまずハードコード・・)

import { ClientSideQTCT } from './ClientSideQTCT.js';
addEventListener("load",function(){
	clientSideQTCT = new ClientSideQTCT();
	window.clientSideQTCT = clientSideQTCT; // for debug
});

// initCsvでこちらを呼ぶ
async function buildQTCTdata(csv,schema, progressCBF, removeLatLngMeta){
	clientSideQTCT.init();
	console.log("buildQTCTdata:",schema);
	csvSchema = schema;
	
	var pixelColorOpt = {
		table:colors,
		evaluator: function(rawData){
			var icIdx = window.csvMapper.getIconId(rawData[2], csvSchema, true);
			//console.log("evaluator  :rawData",rawData,"  icIdx:",icIdx);
			return (icIdx)
		},
		order: "Descending",
		
	}
	
	qtctMapData = await clientSideQTCT.doQTCT(csv, function(col){
		var matadata = [];
		var x,y;
		if ( removeLatLngMeta ){
			if ( schema.latCol > schema.lngCol ){
				y = col.splice(schema.latCol,1)[0];
				x = col.splice(schema.lngCol,1)[0];
			} else {
				x = col.splice(schema.lngCol,1)[0];
				y = col.splice(schema.latCol,1)[0];
			}
		} else {
			x = col[schema.lngCol];
			y = col[schema.latCol];
		}
		//console.log(x,y,col);
		return [x,y,col];
	}, {maxTilePoints:120,pixelColor:pixelColorOpt , progressCBF:progressCBF});
	
}

function clearData(){
	clientSideQTCT.init();
	qtctMapData = null;
}

window.preRenderFunction=function(){
	if ( window.useQTCT==false || !qtctMapData){return}
	
	//console.log(csvSchema);
	
	var level = Math.floor( Math.LOG2E * Math.log(svgImageProps.scale) + 7.25);
	var gvb = svgMap.getGeoViewBox();
	var tileSet = clientSideQTCT.getTileSet(gvb,level)
	
	removePrevTiles(tileSet);// 前のステップで表示していた要素のうち、不要なものを削除
	
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
	//console.log(svgImage);
}

function getPoiStyle(){
	var titleCol = 0;
	if ( csvSchema.titleCol >=0){
		titleCol = csvSchema.titleCol;
	}
	if ( csvSchema.varIconCol >=0){
		
	}
}

function setPoiTile(tileData, tileG){
	for ( var poiDat of tileData ){
		var iconId = window.csvMapper.getIconId(poiDat[2] , csvSchema);
		//console.log("iconId:",iconId);
		var titleCol = 0;
		if ( csvSchema.titleCol >= 0){
			titleCol = csvSchema.titleCol;
		}
		var poi = svgImage.createElement("use");
		poi.setAttribute("xlink:href","#"+ iconId );
		poi.setAttribute("x",0);
		poi.setAttribute("y",0);
		poi.setAttribute("xlink:title",poiDat[2][titleCol]);
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
	/**
	var rect = svgImage.createElement("rect");
	rect.setAttribute("x",geoBBox.x*100);
	rect.setAttribute("y",-(geoBBox.y+geoBBox.height)*100);
	rect.setAttribute("height",geoBBox.height*100);
	rect.setAttribute("width",geoBBox.width*100);
	rect.setAttribute("vector-effect","non-scaling-stroke");
	rect.setAttribute("fill","none");
	rect.setAttribute("stroke","red");
	rect.setAttribute("stroke-width","0.5");
	tileG.appendChild(rect);
	**/
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
			console.log("remove ",gs[i]);
			gs[i].remove();
		}
	}
}


function restoreCsvData(){
	// qtctMapDataからCSVデータを生成する 2024/6/21-
	// qtctMapDataが不完全な場合はどうするか？
	var csvArray = [];
	if ( !csvSchema){return};
	csvArray.push(csvSchema.property);
	for ( var tileKey in qtctMapData){
		if (tileKey == "tileIndex" || tileKey == "csvSchema"){
			continue;
		}
		var tileData = qtctMapData[tileKey];
		if ( typeof tileData =="string"){
			continue;
		}
		for ( var oneRec of tileData){
			var lng = oneRec[0];
			var lat = oneRec[1];
			var csvLine = oneRec[2];
			csvArray.push(csvLine); // csvLine.join(",")のほうが良いか？
		}
	}
	return  (csvArray);
}

window.removePrevTiles = removePrevTiles;


function getQtctMapData(){
	return qtctMapData;
}
window.getQtctMapData = getQtctMapData;

function setQtctMapData(qtctMapDataSrc){
	qtctMapData = qtctMapDataSrc;
}
window.setQtctMapData = setQtctMapData;

window.restoreCsvData = restoreCsvData;