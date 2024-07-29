	// Dynamic OpemStreetMap Layer for SVGMap Sample for SVGMapLevel0 > r10
	// Programmed by Satoru Takagi
	// Copyright (C) 2013 by Satoru Takagi @ KDDI CORPORATION
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

	// iframe化を想定した動的レイヤーのプロトタイプ
	// (JavaScriptをインポートSVGコンテンツに置くことができる。)
	// 地図データとしては、OpenStreetMapを利用（比較的容易に他にも置き換えられる）
	//
	// 
	// このコードの動作環境では、以下があらかじめ設定される
	// document:このドキュメント自身
	// svgImage:このドキュメントに紐づいたSVGMapコンテンツ
	//   svgMap.getGeoViewBox(): 地理的なビューボックス
	// svgImageProps:このドキュメントに紐づいたSVGMapコンテンツの各種プロパティ
	//   svgImageProps.scale: スケール(画面座標に対する、このsvgコンテンツの座標のスケール)
	//
	// 2013/01/24 : 1st ver.
	// 2022/01/31 : WebApp layerに移植
	
	// このファイルの読み込み時に実行する
	
	/**
	addEventListener("load", function(){
		// このスクリプトが読み込まれた直後、refreshScreen()を呼ぶことで、
		//下記preRenderFunctionが初回実行される
		svgMap.();
	})
	**/
	
	function setServerParams(path,zoomMax,zoomMin, targetElement){
		// targetElementは、別のレイヤーであっても動くはずです。グループ要素でもいいしdocElement(svg)要素でも良い
		if (path){
			tileServerUrlTemplate = path;
		}
		if (zoomMax){
			maxLevel = zoomMax;
		}
		if ( zoomMin ){
			minLevel = zoomMin;
		}
		if ( targetElement ){
			targetGroup = targetElement;
		} else {
			targetGroup = svgImage.documentElement;
		}
		targetDocument = targetGroup.ownerDocument;
		
		var currentTiles =  targetGroup.getElementsByTagName("image");
		for ( var i = currentTiles.length - 1 ; i >= 0 ; i-- ){
			var oneTile = currentTiles[i];
			oneTile.parentNode.removeChild(oneTile);
		}
		
	}
	
	function getServerParams(){
		return{
			tileServerUrlTemplate,maxLevel,minLevel
		}
	}
	
	var tileServerUrlTemplate= "http://tile.openstreetmap.org/[[zoom]]/[[tx]]/[[ty]].png";
	var maxLevel = 18;
	var minLevel = 3;
	
	var targetGroup, targetDocument;
	
	function preRenderFunction(){
		// 再描画直前に実行されるコールバック関数
		if ( ! targetGroup){ 
			targetGroup=svgImage.documentElement
			targetDocument = targetGroup.ownerDocument;
		}
		var level = 8;
		// ズームレベルを計算(3から18)
		var level = Math.floor( Math.LOG2E * Math.log(svgImageProps.scale) + 7.5);
		if (level > maxLevel ){
			level = maxLevel;
		} else if ( level < minLevel ){
			level = minLevel;
		}
		
		// この地図の地理座標におけるviewBox内表示させる、tileのXYとそのHashKeyを取得する
		var tileSet = getTileSet( svgMap.getGeoViewBox() , level )
		
		// 現在読み込まれているimageというタグ名を持った(地図のタイルごとのイメージ)要素を取得
		console.log("tileSet:",tileSet);
		var currentTiles =  targetGroup.getElementsByTagName("image");
		
		// 取得できた各タイル分以下を繰り返し、既に読み込み済みのものは再利用、表示範囲外のものは削除する
		for ( var i = currentTiles.length - 1 ; i >= 0 ; i-- ){
			var oneTile = currentTiles[i];
			var qkey = oneTile.getAttribute("metadata");
			if ( tileSet[qkey] ){
//				すでにあるのでスキップさせるフラグ立てる。
				tileSet[qkey].exist = true;
			} else {
//				ないものなので、消去
				oneTile.parentNode.removeChild(oneTile);
			}
		}
		
		// 表示させるタイル分以下を繰り返し、読み込まれていないファイルを読込み要素に加える
		for ( var tkey in tileSet ){
			if ( ! tileSet[tkey].exist ){
				var addTile = getTile( tileSet[tkey].x , tileSet[tkey].y , level , this.CRS );
				targetGroup.appendChild(addTile);
			}
		}
	}

	
	// 指定された場所のタイル(分割された地図イメージ)を取得
	function getTile( tileX ,  tileY , level , crs ){
		// tileX、tileYの座標、levelのズームレベルのタイルのURLを取得。
		var tileURL = getURL( tileX , tileY , level);
		
		// タイルのSVGにおけるbboxを得る
		var tLatLng = XY2latLng( tileX * tilePix , tileY * tilePix, level );
		var tSvg = svgMap.transform( tLatLng.lng , tLatLng.lat , crs );
		var tLatLngBR = XY2latLng( tileX * tilePix + tilePix , tileY * tilePix + tilePix , level  );
		var tSvgBR = svgMap.transform( tLatLngBR.lng , tLatLngBR.lat , crs );
		tSvg.width  = tSvgBR.x - tSvg.x; // 効率悪い・・改善後回し
		tSvg.height = tSvgBR.y - tSvg.y;
		
		// 取得するタイル要素を作成し、各属性をセットする。
		var cl = targetDocument.createElement("image");
		cl.setAttribute("x" , tSvg.x);
		cl.setAttribute("y" , tSvg.y);
		cl.setAttribute("width" , tSvg.width);
		cl.setAttribute("height" , tSvg.height);
		cl.setAttribute("xlink:href" , tileURL.URL);
		cl.setAttribute("metadata" , tileURL.Key);
		
		return ( cl );
	}
	
	// 指定された地図座標geoViewBoxに、levelのズームレベルの地図を表示する場合に、必要なタイルのXYのセットを返却する
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
		
		// 必要な高さ・幅分のタイル個数分以下を繰り返す
		for ( var i = tileTLxy.y ; i <= tileBRxy.y ; i++ ){
			for ( var j = tileTLxy.x ; j <= tileBRxy.x  ; j++ ){
				// タイルのXYとズームレベルからHashKeyを取得する
				var qkey = getKey( j, i, level);
				// 上記で取得したHashKeyごとに、必要なタイル情報を設定する
				TileSet[qkey] = new Object();
				TileSet[qkey].x = j;
				TileSet[qkey].y = i;
			}
		}
		return ( TileSet );
	}
	
	// 緯度・経度からXYに変換
	function latLng2XY( lat , lng , lvl ){
		var size = lvl2Res(lvl);
		var sinLat = Math.sin(lat * Math.PI / 180.0);
		var pixelX = (( lng + 180.0 ) / 360.0 ) * size;
		var pixelY = (0.5 - Math.log((1 + sinLat) / (1.0 - sinLat)) / (4 * Math.PI)) * size;
		return {
			x : pixelX ,
			y : pixelY
		}
	}
	
	// XYからタイルのXYに変換
	function XY2TileXY( xy ){
		var tileX = Math.floor(xy.x / tilePix);
		var tileY = Math.floor(xy.y / tilePix);
		return {
			x : tileX ,
			y : tileY
		}
	}
	
	var tilePix = 256;
	// ズームレベルからタイルの一片のサイズを返却
	function lvl2Res( lvl ){
		var j = 1;
		for(var i = 0 ; i < lvl ; i++){
			j = j * 2;
		}
		return ( j * tilePix );
	}
	
	// XYから緯度・経度に変換
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
	
	// タイルのXYとズームレベルからURLを返却する
	function getURL( tx , ty , lvl ){
		// XYとズームレベルからHashKeyを取得
		var tile_ans = getKey( tx , ty , lvl );
		// OpenStreetMapのURLを組み立てる
		var mapServerURL = tileServerUrlTemplate;
		mapServerURL = mapServerURL.replace("[[zoom]]",lvl);
		mapServerURL = mapServerURL.replace("[[tx]]",tx);
		mapServerURL = mapServerURL.replace("[[ty]]",ty);
		return {
			URL : mapServerURL ,
			Key : tile_ans
		}
	}
	
	// HashKeyを生成し返却する
	function getKey(tx , ty , lvl){
		return ( tx + "_" + ty + "_" + lvl );
	}
