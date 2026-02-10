// Client Side QTCT SVGMap Renderer Class
// Programmed by Satoru Takagi
//
// License: (MPL v2)
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.
//
// ClientSideQTCTモジュールを用いてSVGMapコンテンツの描画を動的に行うモジュール
// この実装は、ちゃんとしたモジュールとして別ファイル化して使いまわせるようにすべき
// rev18 ClientSideQTCT impl
// Ported from river/riverr2022/CCTV
//
// 2024/08/01 : クラス化

import { ClientSideQTCT } from './ClientSideQTCT.js';

class QTCTrendererClass{
	constructor(windowObj){
		this.windowObject = windowObj;
		this.clientSideQTCT = new ClientSideQTCT();
	}
	windowObject;
	qtctMapData; // ここにQuadTreeCompositeTilingされたデータが格納される
	csvSchema;
	clientSideQTCT;
	
	 // このcolorはPOIのビットイメージの実際の色に対応させている。csvXhr_r*.svgのdefs #p?で定義
	// (png読んで色を統計し自動設定すと良いけど面倒なのでひとまずハードコード・・)
	colors = [[0x1d,0x64,0xbb],[0x1a,0xb9,0xb7],[0x71,0xf0,0x49],[0xf0,0xea,0x4a],[0xf0,0x49,0x49],[0xf5,0x4f,0xf7]];
	
	// initCsvでこちらを呼ぶ
	buildQTCTdata = async function(csv,schema, progressCBF, removeLatLngMeta){
		this.clientSideQTCT.init();
		console.log("buildQTCTdata:",schema);
		this.csvSchema = schema;
		
		var pixelColorOpt;
		if ( typeof schema.defaultIconNumber == "string"){
			// カスタムアイコンの場合は、defaultIconNumberにimageのdataURLがあり、これから無条件でのピクセルカラーを設定する
			pixelColorOpt = await this.#getCustomIconMainColor(schema.defaultIconNumber);
		} else {
			pixelColorOpt = {
				table:this.colors,
				evaluator: function(rawData){
					var icIdx = this.windowObject.csvMapper.getIconId(rawData[2], this.csvSchema, true);
					//console.log("evaluator  :rawData",rawData,"  icIdx:",icIdx);
					return (icIdx)
				}.bind(this),
				order: "Descending",
				
			}
		}
		
		this.qtctMapData = await this.clientSideQTCT.doQTCT(csv, function(col){
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
		}.bind(this), {maxTilePoints:120,pixelColor:pixelColorOpt , progressCBF:progressCBF});
		
	}.bind(this);
	
	clearData = function (){
		this.clientSideQTCT.init();
		this.qtctMapData = null;
	}.bind(this);
	
	preRenderFunction=function(){
		if ( this.windowObject.useQTCT==false || !this.qtctMapData){return}
		
		//console.log(this.csvSchema);
		
		var level = Math.floor( Math.LOG2E * Math.log(this.windowObject.svgImageProps.scale) + 7.25);
		var gvb = svgMap.getGeoViewBox();
		var tileSet = this.clientSideQTCT.getTileSet(gvb,level)
		
		this.removePrevTiles(tileSet);// 前のステップで表示していた要素のうち、不要なものを削除
		
		for ( var tkey in tileSet){
			var tileData = this.qtctMapData[tkey];
			
			var tileG = this.windowObject.svgImage.createElement("g");
			tileG.setAttribute("id","T"+tkey);
			this.windowObject.svgImage.documentElement.appendChild(tileG);
			
			if ( tileData instanceof Array){ // 実データ
				this.setPoiTile(tileData, tileG);
			} else { // String imageURI
				var geoBBox = this.clientSideQTCT.getGeoBound(tkey);
				this.setImageTile(tileData, geoBBox, tileG);
			}
		}
		//console.log(svgImage);
	}.bind(this);
	
	getPoiStyle=function(){
		var titleCol = 0;
		if ( this.csvSchema.titleCol >=0){
			titleCol = this.csvSchema.titleCol;
		}
		if ( this.csvSchema.varIconCol >=0){
			
		}
	}

	setPoiTile=function (tileData, tileG){
		for ( var poiDat of tileData ){
			var iconId = this.windowObject.csvMapper.getIconId(poiDat[2] , this.csvSchema);
			//console.log("iconId:",iconId);
			var titleStr ="";
			var titleCol = 0;
			//console.log( this.csvSchema.titleCol, this.csvSchema.titleCol2);
			//console.log(poiDat[2]);
			if ( this.csvSchema.titleCol >= 0){
				titleStr = poiDat[2][this.csvSchema.titleCol];
			}
			if ( this.csvSchema?.titleCol2 >= 0){
				let ts2 = poiDat[2][this.csvSchema.titleCol2];
				if ( ts2 !="undefined"){
					if ( titleStr != "undefined" ){
						titleStr +=" "+ ts2;
					} else {
						titleStr = ts2;
					}
				}
			}
			var poi = this.windowObject.svgImage.createElement("use");
			poi.setAttribute("xlink:href","#"+ iconId );
			poi.setAttribute("x",0);
			poi.setAttribute("y",0);
			poi.setAttribute("xlink:title",titleStr);
			poi.setAttribute("content",poiDat[2].join(","));
			poi.setAttribute("transform","ref(svg,"+Number(poiDat[0])*100+","+(-Number(poiDat[1])*100)+")" );
			tileG.appendChild(poi);
		}
	}

	setImageTile=function (tileData, geoBBox, tileG){
		var img = this.windowObject.svgImage.createElement("image");
		img.setAttribute("xlink:href",tileData);
		img.setAttribute("style","image-rendering:pixelated");
		img.setAttribute("x",geoBBox.x*100);
		img.setAttribute("y",-(geoBBox.y+geoBBox.height)*100);
		img.setAttribute("height",geoBBox.height*100);
		img.setAttribute("width",geoBBox.width*100);
		tileG.appendChild(img);
		/**
		var rect = this.windowObject.svgImage.createElement("rect");
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

	removePrevTiles=function (tileSet){ // 前のステップで表示していた要素のうち、不要なものを削除＆今のステップでも使うものは流用する処理
		var gs = this.windowObject.svgImage.getElementsByTagName("g");
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
	}.bind(this);

	restoreCsvData=function (){
		// this.qtctMapDataからCSVデータを生成する 2024/6/21-
		// this.qtctMapDataが不完全な場合はどうするか？
		var csvArray = [];
		if ( !this.csvSchema){return};
		csvArray.push(this.csvSchema.property);
		for ( var tileKey in this.qtctMapData){
			if (tileKey == "tileIndex" || tileKey == "csvSchema"){
				continue;
			}
			var tileData = this.qtctMapData[tileKey];
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
	}.bind(this);

	getQtctMapData = function (){
		return this.qtctMapData;
	}.bind(this);

	setQtctMapData = function (qtctMapDataSrc){
		this.qtctMapData = qtctMapDataSrc;
	}.bind(this);
	
	#getCustomIconMainColor(imgURL){ // ported from QTCTrenderer_r3.js
		return new Promise(function(okCallback, ngCallback) {
			var img = document.createElement("img");
			try{
				img.src=imgURL;
				
				img.addEventListener("load",function(){
					var canvas = document.createElement("canvas");
					var ctx = canvas.getContext("2d");
					canvas.width = img.naturalWidth;
					canvas.height = img.naturalHeight;
					ctx.drawImage(img, 0, 0);
					var imageData = ctx.getImageData(0,0,canvas.width,canvas.height);
					var data = imageData.data;
					var tR=0, tG=0, tB=0, tPx = 0;
					
					for (var i = 0; i < data.length; i += 4) {
						if ( data[i+3]>128 ){ // 透明度が高いものは採用しない
							var pxR = data[i];
							var pxG = data[i+1];
							var pxB = data[i+2];
							var imin = Math.min(pxR,pxG,pxB);
							var imax = Math.max(pxR,pxG,pxB);
							var saturation = 0;
							if ( imax >0){
								saturation = (imax-imin)/imax;
							}
							if ( saturation>0.5){ // 彩度が低いものは採用しない
								++tPx;
								tR += pxR;
								tG += pxG;
								tB += pxB;
							}
						}
					}
					if ( tPx >0){
						tR=Math.round(tR/tPx);
						tG=Math.round(tG/tPx);
						tB=Math.round(tB/tPx);
					} else {
						tB = 255, tG=0, tR=0;
					}
					console.log("Color : ", tR,tG,tB);
					img.setAttribute("data-meanColor",`${tR},${tG},${tB}`);
					okCallback( [tR,tG,tB,255] );
				});
			} catch (e){
				ngCallback(e);
			}
		});
	}
}


export {QTCTrendererClass}