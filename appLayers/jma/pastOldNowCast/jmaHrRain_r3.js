	// NowCast High Resolution Rain Map Layer
	// Programmed by Satoru Takagi 2017.8.17
	// 2018/11/22 Rev2 Extend other dataset
	//
	// Dynamic NowCast Layer for SVGMap Sample for SVGMapLevel0 > r10
	// Programmed by Satoru Takagi
	// Copyright (C) 2014 by Satoru Takagi @ KDDI CORPORATION
	// 
	// License:
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
	//  along with this program.  If not, see (http://www.gnu.org/licenses/) .
	//
	
	// 高解像度ナウキャストデータのTips:
	// ナウキャストはWebMercatorTile互換じゃない
	// 図法：plate caree
	// グリッド：level1: 5度（https://www.jma.go.jp/jp/commonmesh/map_tile/MAP_COLOR/none/anal/zoom1/1_0.png）
	// https://www.jma.go.jp/jp/commonmesh/map_tile/MAP_COLOR/none/anal/zoom1/0_0.png
	// x_y.png
	// L1: 1,0 tile: 
	// 左端：135度　右端：170度　スパン：35度
	// 下端：　34度、上端：61度　スパン：27度
	//
	// ->L0:0,0 tile(ないけど)
	// 左端：100度　右端：170度　スパン：70度
	// 下端：　7度、上端：61度　スパン：54度
	//
	// また、Levelは6,4,2しか用意されない
	// https://www.jma.go.jp/jp/highresorad/highresorad_tile/HRKSNC/201708170155/201708170155/zoom6/36_24.png
	// https://www.jma.go.jp/jp/highresorad/highresorad_tile/HRKSNC/201708170155/201708170155/zoom4/9_4.png
	// https://www.jma.go.jp/jp/highresorad/highresorad_tile/HRKSNC/201708170155/201708170155/zoom2/0_3.png
	
	/**
	ナウキャスト高解像（１時間後まで）
	https://www.jma.go.jp/jp/highresorad/highresorad_tile/HRKSNC/201811220040/201811220040/zoom4/8_8.png

	降水短時間予報（１５時間後まで）
	https://www.jma.go.jp/jp/kaikotan/kaikotan_tile/KAIKOTAN10M/201811220030/201811220030/zoom6/36_25.png

	土砂災害警戒判定メッシュ（今まで）
	https://www.jma.go.jp/jp/doshamesh/dosha_tile/DOSHA/201811220030/201811220030/zoom6/34_26.png

	浸水害危険度分布
	https://www.jma.go.jp/jp/suigaimesh/suigai_tile/INUND/201811220030/201811220030/zoom6/33_29.png

	洪水　なんとSVGで配信していますよ！
	https://www.jma.go.jp/jp/suigaimesh/suigai_tile/FLOOD_FCST/201811220030/201811220030/zoom6/data.svgz
	https://www.jma.go.jp/jp/suigaimesh/suigai_tile/FLOOD/201811220030/201811220030/zoom6/data.svgz
	https://www.jma.go.jp/jp/commonmesh/map_tile/FLOOD_FCST_RIVER/none/none/zoom9/data.svgz
	https://www.jma.go.jp/jp/suigaimesh/suigai_tile/FLOOD/201811220030/201811220030/zoom9/data.svgz
	https://www.jma.go.jp/jp/suigaimesh/suigai_tile/FLOOD_FCST/201811220030/201811220030/zoom9/data.svgz

	河川データ
	https://www.jma.go.jp/jp/commonmesh/map_tile/FLOOD_RIVER/none/none/zoom6/33_29.png
	**/
	
	/**
	Example:
	jmaNowCast/jmaHrRain_r2.svg#fSpan=900&minStep=10&futureStep=60&datasetPath=kaikotan/kaikotan_tile/KAIKOTAN10M/
	fSpan: 未来の予報の上限(分) : ナウキャストは60、降水短時間予報は15x60(900)、それ以外は0
	minStep: 現在及び過去のデータの生成間隔　：　ナウキャストは５、それ以外は10　かな
	futureStep: 未来予報データのステップ(現在に近いところもこれでグリッディングされるとする)：ナウキャストは５、降水短時間予報は60
	datasetPath: https://www.jma.go.jp/jp/ 以降、　YYYYMMDDHHMM/YYYYMMDDHHMM/zoomX/TX_TY.png　以前のデータセットごとのURL部分
	
	降水短時間予報（１５時間後まで）fSpan=15 x 60=900 minStep=10 futureStep=60
	kaikotan/kaikotan_tile/KAIKOTAN10M/
	
	土砂災害警戒判定メッシュ（今まで）fSpan=0 minStep=10
	doshamesh/dosha_tile/DOSHA/
	
	高分解能ナウキャスト（default）fSpan=60 minStep=5
	highresorad/highresorad_tile/HRKSNC/
	
	浸水害危険度分布
	suigaimesh/suigai_tile/INUND/
	がある。
	**/
	
	var minStep = 5;
	var fSpan = 60;
//	var contCat = ["radar","thunder","tornado"];
	var guardTime = 300*1000; // in msec 
	
	var futureStep = minStep;
	
//	console.log("Build Function");
	var testIscript2 = 2;
	
	var currentZoom;
	
	addEventListener("loadXX",function(){
//		console.log("HelloOnloadFUNC of NOWCAST HR! : " );
		
//		console.log("ONLOAD func:  is Tranfrom?:",transform, " is showPage?:",showPage, "  is getScript?", getScript,  "  is refreshScreen",refreshScreen, " svgImagesProps:" , svgImagesProps , "  this?:",this);
//		console.log("jmaHr: onload : this?:",this, "   window:",window,  "   transform:",transform ," svgMap:", svgMap);
		var hParams = getHashParams(location.hash);
		if ( hParams.datasetPath ){
			datasetPath = hParams.datasetPath;
			console.log("set datasetPath:",datasetPath);
		}
		if ( hParams.minStep ){
			minStep = Number(hParams.minStep);
			console.log("set minStep:",minStep);
		}
		if ( hParams.futureStep ){
			futureStep = Number(hParams.futureStep);
			console.log("set futureStep:",futureStep);
		}
		if ( hParams.fSpan ){
			fSpan = Number(hParams.fSpan);
			console.log("set fSpan:",fSpan);
		}
		guardTime = minStep * 60 * 1000 * 0.7; // ガードタイムはステップの７掛けということにする
		/**
		guardTime = guardTime;
		minStep = minStep;
		refreshTiles = refreshTiles;
		futureStep = futureStep;
		fSpan = fSpan;
		**/
		//refreshTiles(svgImageProps.scale, svgImageProps.CRS);
		
		
	});
	
	function getHashParams( hash ){
		hash = hash.substring(1);
		hash = hash.split("&amp;");
		for ( var i = 0 ; i < hash.length ; i++ ){
			hash[i] = hash[i].split("="); // "
			if ( hash[i][1] ){
				hash[hash[i][0]] = hash[i][1];
			} else {
				hash[hash[i][0]] = true;
			}
		}
//    	console.log(hash);
		return ( hash );
	}
	
	function preRenderFunction(params){
		console.log("script onzoom fucntion : noRefresh : ", noRefresh , params);
		if ( !noRefresh ){
//			console.log("Load JMA NowCast HR onzoom, onscroll scale:", params.scale);
			refreshTiles(params.scale, svgImageProps.CRS );
		}
	}
	
	var sDateC;
	
	function removeAllTiles(){
		var currentTiles =  svgImage.getElementsByTagName("image");
		for ( var i = currentTiles.length - 1 ; i >= 0 ; i-- ){
			var oneTile = currentTiles[i];
			oneTile.parentNode.removeChild(oneTile);
		}
	}
	
	function refreshTiles( scale , CRS , sDate){
		//console.log("called refreshTiles :  scale:",scale, " date:",sDate , "   caller:",refreshTiles.caller);
		if ( !sDate ){
			sDate = sDateC;
		} else{
			sDateC = sDate;
		}
		var level = 8;
		var level = Math.floor( Math.LOG2E * Math.log(scale) + 5);
		if (level > 6 ){
			level = 6;
		} else if ( level < 2 ){
			level = 2;
		} else {
			level = Math.floor(level / 2 ) * 2;
		}
		++ testIscript2;
		
		
		var tileSet = getTileSet( svgMap.getGeoViewBox() , level , sDate );
		
		var currentTiles =  svgImage.getElementsByTagName("image");
//		console.log(currentTiles);
		
		for ( var i = currentTiles.length - 1 ; i >= 0 ; i-- ){
			var oneTile = currentTiles[i];
			var qkey = oneTile.getAttribute("metadata");
			if ( tileSet[qkey] ){
//				すでにあるのでスキップさせるフラグ立てる。
				tileSet[qkey].exist = true;
			} else {
//				console.log("remove", oneTile);
//				ないものなので、消去
				oneTile.parentNode.removeChild(oneTile);
			}
		}
		
		
		for ( var tkey in tileSet ){
			if ( ! tileSet[tkey].exist ){
				var addTile = getTile( tileSet[tkey].x , tileSet[tkey].y , level , CRS , sDate);
				svgImage.getElementsByTagName("svg")[0].appendChild(addTile);
			}
		}
	}
	
	
	function getTile( tileX ,  tileY , level , crs , sDate){
		//console.log ( "getTile: " , tileX ,  tileY , level , "  is Tranfrom?:",svgMap.transform, " is svgMap?:",svgMap, " isCRS:", crs);
//		console.log("jmaHr: getTile : this?:",this, "  window:",window, "  onzoom:",onzoom,  "   transform:",transform);
		
		var tileURL = getURL( tileX , tileY , level, sDate); // こちらのsDateは、完全に意味のあるsDate(サーバへの日時要求用の値)
		
		// タイルのSVGにおけるbboxを得る
		var tLatLng = tileXY2latLngTL( tileX  , tileY , level );
//		console.log("tLatLng:",tLatLng);
		var tSvg = svgMap.transform( tLatLng.lng , tLatLng.lat , crs );
		var tSvgSpan = svgMap.transform( tLatLng.lngSpan , tLatLng.latSpan , crs , true );
		
		tSvg.width  = tSvgSpan.x; 
		tSvg.height = Math.abs(tSvgSpan.y);
		
//		console.log("tileSVGXYWH  : " + tSvg.x + " , " + tSvg.y + " , " + tSvg.width + " , " + tSvg.height );
		
		var cl = svgImage.createElement("image");
		cl.setAttribute("x" , tSvg.x);
		cl.setAttribute("y" , tSvg.y);
		cl.setAttribute("width" , tSvg.width);
		cl.setAttribute("height" , tSvg.height);
		cl.setAttribute("xlink:href" , tileURL.URL);
//		cl.setAttribute("opacity" , "0.5");
		cl.setAttribute("metadata" , tileURL.Key);
		
		return ( cl );
	}
	
	function getTileSet( geoViewBox , level , sDate ){
		var dateTime = getJmaDateStr(sDate);
//		console.log("getTileSet: dateTime:",dateTime, "    wanted:",sDate);
		var TileSet = new Object();
		
		// 指定エリアの、tileのXYとそのHashKeyを返却する
		var tileTLxy = latLng2HrNcXY( geoViewBox.y + geoViewBox.height , geoViewBox.x , level );
		var tileBRxy = latLng2HrNcXY( geoViewBox.y , geoViewBox.x + geoViewBox.width, level );
		
		for ( var i = tileTLxy.y ; i <= tileBRxy.y ; i++ ){
			for ( var j = tileTLxy.x ; j <= tileBRxy.x  ; j++ ){
				var qkey = getKey( j, i, level, dateTime.t1, dateTime.t2 ); // この関数でのsDateは、今のtileと新しいタイルの自国の違いを弁別するためだけに使われている・・
				TileSet[qkey] = new Object();
				TileSet[qkey].x = j;
				TileSet[qkey].y = i;
//				console.log( j , i , qkey );
			}
		}
		return ( TileSet );
	}
	
	// 高解像ナウキャストのレベル0相当のタイルの配置パラメータ
	var HrNcLngOrig0 = 100.0; // 原点
	var HrNcLatOrig0 = 7.0;
	var HrNcLngSpan0 = 70.0; // スパン
	var HrNcLatSpan0 = 54.0;
	
	// 緯度経度から高解像ナウキャストタイルXY求める
	function latLng2HrNcXY( lat , lng , lvl ){
		
		var div = getDiv(lvl);
		
		var lngSpan = HrNcLngSpan0 / div;
		var latSpan = HrNcLatSpan0 / div;
		
		var tx = Math.floor( ( lng - HrNcLngOrig0) / lngSpan);
		var ty = Math.floor( ( ( HrNcLatOrig0 + HrNcLatSpan0 ) - lat ) / latSpan);
		
		return {
			x: tx,
			y: ty
		}
		
	}
	
	function getDiv(lvl){
		var div = 1;
		for(var i = 0 ; i < lvl ; i++){
			div = div * 2;
		}
		return ( div );
	}
	
	function tileXY2latLngTL( tx , ty , lvl ){
		// タイルのXYからタイルTopLeft(NorthWest)の緯度経度,タイルのサイズを得る
		var div = getDiv(lvl);
		
		var lngSpan = HrNcLngSpan0 / div;
		var latSpan = HrNcLatSpan0 / div;
		
		var lng = HrNcLngOrig0 + tx * lngSpan;
		var lat = HrNcLatSpan0 + HrNcLatOrig0 - ty * latSpan;
		
		return{
			lat : lat ,
			lng : lng ,
			latSpan : latSpan ,
			lngSpan : lngSpan
		}
	}
	
	var baseURL = "";
	var datasetPath = "https://www.data.jma.go.jp/fcd/yoho/meshjirei/jirei03/highresorad/highresorad_tile/HRKSNC/";
	
	function getURL( tx , ty , lvl ,sDate){
		var dateTime = getJmaDateStr(sDate);
		var tile_ans = getKey( tx , ty , lvl , dateTime.t1 , dateTime.t2 );
		var mapServerURL = baseURL + datasetPath + dateTime.t1 + "/" + dateTime.t2 + "/zoom" + lvl + "/" + tx + "_" + ty +  ".png";
		return {
			URL : mapServerURL ,
			Key : tile_ans
		}
	}
	
	function getKey(tx , ty , lvl , dateTime , dateTime2){
		return ( tx + "_" + ty + "_" + lvl + "_" + dateTime + "_" +  dateTime2 );
	}
	
	
	function getDateStr(dateData , tStep){
		var mind = tStep * Math.floor( dateData.getUTCMinutes() / tStep ) ;
		var ans = dateData.getUTCFullYear()+ pad(dateData.getUTCMonth() + 1) + pad(dateData.getUTCDate()) + pad(dateData.getUTCHours()) + pad(mind);
		return ( ans );
	}
	
	function getJmaDateStr(sDate){
		var date0 = new Date();
		var latestDataDate = new Date(date0.getTime() - guardTime); 
		
		var date;
		var futureAns = "";
		var ans  ="";
		var fmind, tDate;
		if ( sDate ){ // 予報もしくは過去データの取得のケース
			var fTime = sDate.getTime() - latestDataDate.getTime()
			if ( fTime > 0  ){ // 予報 tDate時点でのsDateの予報
				tDate= latestDataDate; 
				if ( fTime / ( 1000 * 60 ) <= fSpan ){ // fSpan分以前の未来ならば・・・予想を出す
					ans = getDateStr(tDate, futureStep);
					futureAns = getDateStr(sDate, futureStep);
				} else { // 超えていた時は・・・エラーだが　今の情報を・・・
					console.log("sDate exceeded");
					ans = getDateStr(tDate, futureStep);
					futureAns = ans;
				}
			} else { // 過去
				ans = getDateStr(sDate, minStep);
				futureAns = ans;
			}
		} else { // 今のデータ
			tDate = latestDataDate; // guard time cared current time
			ans = getDateStr(tDate, minStep);
			futureAns = ans;
		}
		
		return {
			t1: ans,
			t2: futureAns
		};
	}
	
	function pad( inp ){
		return ( ("0"+inp).slice(-2));
	}
