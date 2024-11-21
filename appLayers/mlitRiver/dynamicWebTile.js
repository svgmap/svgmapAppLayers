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
	// 2016/02/19 新サーバに対応し、フラグメントを与えることでいろいろな地図を出せるようにしてある。
	// dynamicDenshiKokudo2016.svg#map=name||number
	// nameは、stdとかblankとかenglishとか、あとは数字 (sva配列参照)
	// see: http://maps.gsi.go.jp/development/ichiran.html
	// 2016/10/27 地理院ドメインの地図以外でもなんでも出せるようなものにした (baseURL)
	// 2020/01/28 LayerUIからロードするタイルセットを可変にした setServerParams()
	// 2020/07/27 setServerParams(URL)や、#baseURL=URLで、https://server.name.jp/[[zoom]]/[[tx]]/[[ty]].png みたいなテンプレートを指定可能に
	// 2022/04/18 : WebApp layerに移植
var dynamicWebTile = function(){
	var maxLevel = 18;
	var minLevel = 3;
	var tilePix = 512;
	var jpegMedia = false;
	var mapName = "std"; // タイルサーバのURL、もしくは相対パスとなる変数
	var baseURL = "http://cyberjapandata.gsi.go.jp/xyz/"; // 地理院タイル
	var maxOverFlowChekTiles = 320;
	
	var sva = { // 地理院タイル
		"std" : [2,18],
		"pale" : [12,18],
		"blank" : [5,14],
		"english" : [5,11],
		"relief" : [5,15],
		"lcm25k_2012" :[10,16],
		"lum4bl_capital2000" :[13,16],
		"lum4bl_capital2005" :[13,16],
		"lum4bl_chubu2003" :[13,16],
		"lum4bl_kinki2001" :[13,16],
		"lum4bl_kinki2008" :[13,16],
		"ort" :[2,18],
		"gazo1" :[10,17],
		"gazo2" :[10,17],
		"gazo3" :[10,17],
		"gazo4" :[10,17],
		"ort_old10" :[10,17],
		"ort_USA10" :[10,17],
		"airphoto" :[15,18],
		"toho1" :[15,17],
		"toho2" :[15,18],
		"toho3" :[15,18],
		"toho4" :[15,18],
		"fukkokizu" :[18,18],
		"20130717dol" :[10,18],
		"20130717dol2" :[10,18],
		"20130902dol" :[10,18],
		"201204dol" :[8,18],
		"20131017dol" :[10,18],
		"20131017dol2" :[10,18],
		"20131204doh" :[10,18],
		"20131217doh" :[10,18],
		"20140216doh" :[10,18],
		"20140322dol" :[10,18],
		"20140704dol" :[10,18],
		"20141204doh" :[10,18],
		"20141210doh" :[10,18],
		"20150301doh" :[10,18],
		"20150728dol" :[14,18],
		"20151209dol" :[13,18],
		"20140711dol" :[8,18],
		"20140813dol" :[10,18],
		"20140819dol" :[10,18],
		"20140820dol" :[10,18],
		"20140820dol2" :[10,18],
		"20140820dol3" :[10,18],
		"19480000dol" :[10,18],
		"19620000dol" :[10,18],
		"20140828dol" :[10,18],
		"20140830dol" :[10,18],
		"20140831dol" :[10,18],
		"20140928dol" :[10,18],
		"20140929dol2" :[10,18],
		"20140930dol" :[10,18],
		"20150911dol1" :[10,18],
		"20150911dol2" :[10,18],
		"20150913dol" :[10,18],
		"20150915dol" :[10,18],
		"20150929dol" :[14,18],
		"20150911dol3" :[10,18],
		"20150911dol4" :[10,18],
		"20150911dol5" :[10,18],
		"20150911dol" :[14,18],
		"20150714dol" :[14,18]
		};
	
	//addEventListener("load",init);
	
	function init(baseURLp,maxLevelp,minLevelp,options){
		console.log("HelloOnloadFUNC of DynamicWebTile WebAppLayer! ", svgImageProps.Path);
		if ( typeof(baseURLp)=='string' ){
			if (baseURLp==""){
				mapName = null;
			} else {
				setServerParams(baseURLp,maxLevelp,minLevelp,options);
			}
		} else {
			var hParams = {};
			if ( svgImageProps.Path.indexOf("#")>=0){
				var lhash=svgImageProps.Path.substring(svgImageProps.Path.indexOf("#"));
				console.log( "has lhash:",lhash);
				hParams = getHashParams(lhash);
			}
			
			if (hParams.map && typeof(hParams.map) == "string" ){
				if ( sva[hParams.map] ){
					mapName = baseURL + hParams.map;
					maxLevel = sva[hParams.map][1];
				}
			} else if (hParams.baseURL ){
	//				console.log("set baseurl to mapname");
				mapName = hParams.baseURL;
				if ( hParams.zmax ){
					maxLevel = Number(hParams.zmax);
				}
				if ( hParams.jpegMedia ){
					jpegMedia = true;
				}
				
			} else {
				mapName = baseURL + mapName;
			}
			
			
	//			console.log("resolved Url:",mapName, " jpg:",jpegMedia);
			svgMap.refreshScreen();
		}
	};
	
	function getServerParams(){
		return {
			baseURL: mapName,
			maxLevel: maxLevel,
			minLevel: minLevel,
			options: {style:tileOptions.style},
		}
	}
	var tileOptions={};
	function setServerParams(baseURLp,maxLevelp,minLevelp,options){
		console.log("setServerParams:",baseURLp,maxLevelp,minLevelp,options);
		mapName = baseURLp;
		maxLevel = maxLevelp;
		minLevel = minLevelp;
		if ( options && options.style){
			tileOptions.style=options.style;
		}
		if ( options && options.crossorigin){
			tileOptions.crossorigin=true;
		}
		removeAllTiles();
		existTiles={};
		svgImage.documentElement.removeAttribute("property");
		svgMap.refreshScreen();
	}
	
	function removeAllTiles(){ // metadataがついている imageもしくはg要素を消す
		var currentTiles =  svgImage.getElementsByTagName("image");
		for ( var i = currentTiles.length - 1 ; i >= 0 ; i-- ){
			var oneTile = currentTiles[i];
			if ( oneTile.getAttribute("metadata")){
				oneTile.parentNode.removeChild(oneTile);
			}
		}
		currentTiles =  svgImage.getElementsByTagName("g");
		for ( var i = currentTiles.length - 1 ; i >= 0 ; i-- ){
			var oneTile = currentTiles[i];
			if ( oneTile.getAttribute("metadata")){
				oneTile.parentNode.removeChild(oneTile);
			}
		}
	}
	
	function getHashParams( hash ){
		hash = hash.substring(1);
		hash = hash.split("&");
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
    
	var CRS;
	
	function preRenderFunction(){
		CRS = this.CRS;
		console.log("CRS:",CRS);
	// 再描画直前に実行されるコールバック関数
		if ( !mapName || mapName =="none"){
			return;
		}
		var level = 8;
		var overflow = false;
		// ズームレベルを計算(3から18)
		var level = Math.floor( Math.LOG2E * Math.log(svgImageProps.scale) + 7.5);
		if (level > maxLevel ){
			level = maxLevel;
		} else if ( level < minLevel ){
			level = minLevel;
			overflow = true;
		}
		
		// この地図の地理座標におけるviewBox内表示させる、tileのXYとそのHashKeyを取得する
		var tileSet = getTileSet( svgMap.getGeoViewBox() , level );
		
		// 小縮尺レンジオーバー処理 2022/04/18
		if ( overflow){
			removeAllTiles();
			if (Object.keys(tileSet).length < maxOverFlowChekTiles){ // 最大数よりは小さいので存在確認だけする
				console.warn("Too many tiles:",Object.keys(tileSet).length,"  Checking Tile Existence");
				getTilesExistence(tileSet);
			} else {
				console.warn("Too many tiles:",Object.keys(tileSet).length);
				removeOverflowPicts();
				showOverflowMessage("Range Over ZOOM IN");
			}
			return;
		}
		removeOverflowPicts();
		
		// 現在読み込まれているimageというタグ名を持った(地図のタイルごとのイメージ)要素を取得
		console.log("tileSet:",tileSet);
		var currentTiles =  getCurrentTiles();
		
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
		
		if (mapName.endsWith("geojson")){
			if ( typeof(setGeoJsonTiles)=="function"){
				setGeoJsonTiles(tileSet);
			}
		} else if (mapName.endsWith("pbf")){
			if ( typeof(setPbfTiles)=="function"){
				setPbfTiles(tileSet);
			}
		} else {
			// 表示させるタイル分以下を繰り返し、読み込まれていないファイルを読込み要素に加える
			for ( var tkey in tileSet ){
				if ( ! tileSet[tkey].exist ){
					var addTile = getTile( tileSet[tkey].x , tileSet[tkey].y , level , this.CRS );
					svgImage.documentElement.appendChild(addTile);
				}
			}
		}
	}
	window.preRenderFunction = preRenderFunction;
	
	function getCurrentTiles(){
		var ans=[];
		var tiles=svgImage.getElementsByTagName("image");
		for ( var tile of tiles){
			if (tile.getAttribute("metadata")){
				ans.push(tile);
			}
		}
		tiles=svgImage.getElementsByTagName("g");
		for ( var tile of tiles){
			if (tile.getAttribute("metadata")){
				ans.push(tile);
			}
		}
		return ( ans );
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
		var cl = svgImage.createElement("image");
		cl.setAttribute("x" , tSvg.x);
		cl.setAttribute("y" , tSvg.y);
		cl.setAttribute("width" , tSvg.width);
		cl.setAttribute("height" , tSvg.height);
		cl.setAttribute("xlink:href" , tileURL.URL);
		cl.setAttribute("metadata" , tileURL.Key);
		cl.setAttribute("data-mercator-tile" , "true");
		if ( tileOptions.style ){
			var styleOption=tileOptions.style;
			cl.setAttribute("style" , styleOption);
		}
		if (tileOptions.crossorigin){
			cl.setAttribute("crossorigin" , "");
		}
		
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
				TileSet[qkey].level = level;
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
	
	var svNumb = 0;
	var culture ="en-US";
	
	// タイルのXYとズームレベルからURLを返却する
	function getURL( tx , ty , lvl ){
		var tile_ans = getKey( tx , ty , lvl );
		var media=".png";
		if ( mapName=="ort" || jpegMedia ){
			media =".jpg";
		}
		var mapServerURL;
		//console.log("getURL:",mapName, tx , ty , lvl);
		if ( mapName.indexOf("[[zoom]]") > 0 && mapName.indexOf("[[tx]]") > 0 ){
			// 2020/7/27 WMTSとかみたいなサーチパートのモノとか、なんでも設定できるように・・・
			// https://server.name.jp/[[zoom]]/[[tx]]/[[ty]].png" みたいにmapNameをsetServerParams()や、#baseURL=xxxで、設定する
			mapServerURL = mapName.replace("[[zoom]]", lvl );
			mapServerURL = mapServerURL.replace("[[tx]]", tx );
			if (mapName.indexOf("[[ty]]") > 0 ){
				mapServerURL = mapServerURL.replace("[[ty]]", ty );
			} else if (mapName.indexOf("[[rty]]") > 0 ){ // 2022/04/27 yを南から附番してるサーバがあるね・・・
				var rty = Math.pow(2,lvl)-ty-1;
				mapServerURL = mapServerURL.replace("[[rty]]", rty );
			}
		} else {
			mapServerURL = mapName + "/" + lvl + "/" + tx + "/" + ty + media;
		}
		return {
			URL : mapServerURL ,
			Key : tile_ans
		}
	}
	
	// HashKeyを生成し返却する
	function getKey(tx , ty , lvl){
		return ( tx + "_" + ty + "_" + lvl );
	}
	
	
	async function getTilesExistence(tileSet){
		if ( overFlowRefreshed){ // 無限ループ抑止
			overFlowRefreshed=false;
			return;
		}
		var tileExs =[];
		var tkeys=[];
		var allQs=0;
		for ( var tkey in tileSet ){
			if ( existTiles[tkey]===undefined){
				var url = getURL( tileSet[tkey].x , tileSet[tkey].y ,  tileSet[tkey].level);
				tileExs.push(UrlExists(url.URL));
				tkeys.push(tkey);
				if ( tileExs.length >32){
					allQs+=tileExs.length;
					var ret = await Promise.all(tileExs);
					for ( var i = 0 ; i < tkeys.length ; i++ ){
						var tk = tkeys[i];
						tileSet[tk].exists = ret[i];
						existTiles[tk]=ret[i];
					}
					tileExs =[];
					tkeys=[];
				}
			} else {
				tileSet[tkey].exists = existTiles[tkey];
			}
		}
		allQs+=tileExs.length;
		var ret = await Promise.all(tileExs);
		for ( var i = 0 ; i < tkeys.length ; i++ ){
			var tk = tkeys[i];
			tileSet[tk].exists = ret[i];
		}
		console.log("getTilesExistence: len:",Object.keys(tileSet).length,allQs,tileSet);
		showOverflow(tileSet);
	}
	
	var overFlowRefreshed=false;
	function showOverflow(tileSet){
		var g = svgImage.getElementById("overflowPict");
		if ( g ){g.remove()}
		g = svgImage.createElement("g");
		g.setAttribute("id","overflowPict");
		console.log("showOverflow: CRS:", CRS);
		if ( tileSet){
			for( var tileKey in tileSet ){
				var tile = tileSet[tileKey];
				var tileX = tile.x;
				var tileY = tile.y;
				var level = tile.level;
				if ( !tile.exists){continue}
				var tLatLng = XY2latLng( tileX * tilePix , tileY * tilePix, level );
				var tSvg = svgMap.transform( tLatLng.lng , tLatLng.lat , CRS );
				var tLatLngBR = XY2latLng( tileX * tilePix + tilePix , tileY * tilePix + tilePix , level  );
				var tSvgBR = svgMap.transform( tLatLngBR.lng , tLatLngBR.lat , CRS );
				tSvg.width  = tSvgBR.x - tSvg.x; // 効率悪い・・改善後回し
				tSvg.height = tSvgBR.y - tSvg.y;
//				var cl = svgImage.createElement("rect");
				var cl = svgImage.createElement("image");
				cl.setAttribute("xlink:href" , exTileURI);
				cl.setAttribute("data-mercator-tile" , "true");
				cl.setAttribute("x" , tSvg.x);
				cl.setAttribute("y" , tSvg.y);
				cl.setAttribute("width" , tSvg.width);
				cl.setAttribute("height" , tSvg.height);
//				cl.setAttribute("fill" , "orange");
				cl.setAttribute("opacity" , "0.5");
				g.appendChild(cl);
			}
		}
		
		svgImage.documentElement.appendChild(g);
		showOverflowMessage("Range Over Zoom in Orange areas");
		overFlowRefreshed=true;
		svgMap.refreshScreen();
	}
	var existTiles={};
	function UrlExists(url) {
		return new Promise(function(okCallback, ngCallback) {
			(function(url, callback){
				var http = new XMLHttpRequest();
				http.open('HEAD', url);
				http.onreadystatechange = function() {
					if (this.readyState == this.DONE) {
						callback(this.status != 404);
					}
				};
				http.send();
			})(url, okCallback);
		});
	}
	
	function showOverflowMessage(messageText){
		console.log("showOverflowMessage svgMap:",svgMap," txt:",messageText);
		var vb = svgMap.getGeoViewBox();
		var svgPos1 = svgMap.transform( vb.x , vb.y , CRS );
		var svgPos2 = svgMap.transform( vb.x+vb.width , vb.y+vb.height , CRS );
		
		var txt = svgImage.getElementById("overflowText");
		if ( txt ){txt.remove()}
		txt = svgImage.createElement("text");
		txt.setAttribute("id","overflowText");
		svgImage.documentElement.appendChild(txt);
		txt.setAttribute("fill","purple");
//			txt.setAttribute("x","5");
		txt.setAttribute("font-size","20");
		txt.textContent=messageText;
		txt.setAttribute("transform","ref(svg,"+(svgPos1.x+svgPos2.x)/2+","+(svgPos1.y+svgPos2.y)/2+")");
	}
	
	function removeOverflowPicts(){
		var g = svgImage.getElementById("overflowPict");
		if ( g ){g.remove()}
		var txt = svgImage.getElementById("overflowText");
		if ( txt ){txt.remove()}
	}
	
	var exTileURI="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAIAAAACACAIAAABMXPacAAABhGlDQ1BJQ0MgcHJvZmlsZQAAKJF9kT1Iw1AUhU/TSkUqDu0g4pChOlkQFXGUViyChdJWaNXB5KV/0KQhSXFxFFwLDv4sVh1cnHV1cBUEwR8QRycnRRcp8b6k0CLGB5f3cd47h/vuA4RWjalmYBJQNcvIJONivrAqBl8RQJgqCkFipp7KLubgub7u4eP7XYxned/7cw0qRZMBPpF4numGRbxBPLtp6Zz3iSOsIinE58QTBjVI/Mh12eU3zmWHBZ4ZMXKZBHGEWCz3sNzDrGKoxDPEUUXVKF/Iu6xw3uKs1hqs0yd/YaiorWS5TjWKJJaQQhoiZDRQRQ0WYrRrpJjI0Hncwz/i+NPkkslVBSPHAupQITl+8D/4PVuzND3lJoXiQN+LbX+MAcFdoN207e9j226fAP5n4Err+ustYO6T9GZXix4BQ9vAxXVXk/eAyx1g+EmXDMmR/FRCqQS8n9E3FYDwLTCw5s6tc47TByBHs1q+AQ4OgfEyZa97vLu/d27/3unM7wcx5XKNUv5FeAAAAAlwSFlzAAAuIwAALiMBeKU/dgAAAAd0SU1FB+YEEwQnE+KXV+kAAAAZdEVYdENvbW1lbnQAQ3JlYXRlZCB3aXRoIEdJTVBXgQ4XAAAAxUlEQVR42u3RQQEAAATAQPSvIx8xeNwi7HI6dFhZAACAAAAQAAACAEAAAAgAAAEAIAAABACAAAAQAAACAEAAAAgAAAEAIAAABACAAAAQAAACAEAAAAgAAAEAIAAABACAAAAQAAACAEAAAAgAAAEAIAAAAAgAAAEAIAAABACAAAAQAAACAEAAAAgAAAEAIAAABACAAAAQAAACAEAAAAgAAAEAIAAABACAAAAQAAACAEAAAAgAAAEAIAAABACAAAAQAAAC8KEF8O8CtGbFUCMAAAAASUVORK5CYII="; // 128x128 orange
	
	return {
		init:init,
		getServerParams : getServerParams,
		setServerParams : setServerParams,
		getTileURL: getURL,
		removeAllTiles: removeAllTiles,
	}
}();
