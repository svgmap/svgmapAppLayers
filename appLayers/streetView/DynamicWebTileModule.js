class DynamicWebTile{

	// Dynamic XYZ mercator tle pyramid for SVGMap Sample for SVGMapLevel0 > r10
	//
	// Programmed by Satoru Takagi
	// 
	// License: (MPL v2)
	// This Source Code Form is subject to the terms of the Mozilla Public
	// License, v. 2.0. If a copy of the MPL was not distributed with this
	// file, You can obtain one at https://mozilla.org/MPL/2.0/.
	//
	//
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
	// 2025/07/16 : Class・ESM化・サブレイヤーでも利用できる形態へ拡張
	
	// このファイルの読み込み時に実行する
	// この情報に必要な値を入れて、svgMap.refreshScreen()　で初期化完了
	
	svgImage=null;
	svgImageProps = null;
	underRangeDisplay = false;
	
	constructor( svgImage, svgImageProps, tileInfo){
		if  ( ! svgImage || !svgImageProps){
			throw new Error("Required svgImage and svgImageProps.");
		}
		this.svgImage = svgImage;
		this.svgImageProps = svgImageProps;
		if (tileInfo && tileInfo.baseURL && !isNaN(tileInfo.minLevel) && !isNaN(tileInfo.maxLevel) ){
			this.tileInfo = tileInfo;
			if (this.tileInfo.underRangeDisplay){
				this.underRangeDisplay = this.tileInfo.underRangeDisplay;
			}
		}
	}
	
	tileInfo={
		baseURL:"https://a.tile.openstreetmap.org/{z}/{x}/{y}.png",
		minLevel:3,
		maxLevel:18,
	}
	
	preRenderFunction(){
		console.log("class preRenderFunction");
		if ( !this.tileInfo.baseURL){
			this.clearTiles();
			return
		}
	// 再描画直前に実行されるコールバック関数
		var level = 8;
		var scaleFactor = 7.5;
		if ( this.tileInfo.scaleFactor){
			scaleFactor = this.tileInfo.scaleFactor;
		}
		let underRange=false;
		// ズームレベルを計算(3から18)
		var level = Math.floor( Math.LOG2E * Math.log(this.svgImageProps.scale) + scaleFactor);
		if (level > this.tileInfo.maxLevel ){
			level = this.tileInfo.maxLevel;
		} else if ( level < this.tileInfo.minLevel ){
			underRange = true;
			level = this.tileInfo.minLevel;
		}
		if ( this.underRangeDisplay == false && underRange){
			this.showOverflowMessage("Under ragne, please  zoom up.");
			return;
		} else {
			this.showOverflowMessage();
		}
		// この地図の地理座標におけるviewBox内表示させる、tileのXYとそのHashKeyを取得する
		var tileSet = this.getTileSet( svgMap.getGeoViewBox() , level )
		
		// 現在読み込まれているimageというタグ名を持った(地図のタイルごとのイメージ)要素を取得
		console.log("tileSet:",tileSet);
		var currentTiles =  this.svgImage.getElementsByTagName("image");
		
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
				var addTile = this.getTile( tileSet[tkey].x , tileSet[tkey].y , level , this.svgImageProps.CRS );
				this.svgImage.getElementsByTagName("svg")[0].appendChild(addTile);
			}
		}
	}

	
	// 指定された場所のタイル(分割された地図イメージ)を取得
	getTile( tileX ,  tileY , level , crs ){
		// tileX、tileYの座標、levelのズームレベルのタイルのURLを取得。
		var tileURL = this.getURL( tileX , tileY , level);
		
		// タイルのSVGにおけるbboxを得る
		var tLatLng = this.XY2latLng( tileX * this.tilePix , tileY * this.tilePix, level );
		var tSvg = svgMap.transform( tLatLng.lng , tLatLng.lat , crs );
		var tLatLngBR = this.XY2latLng( tileX * this.tilePix + this.tilePix , tileY * this.tilePix + this.tilePix , level  );
		var tSvgBR = svgMap.transform( tLatLngBR.lng , tLatLngBR.lat , crs );
		tSvg.width  = tSvgBR.x - tSvg.x; // 効率悪い・・改善後回し
		tSvg.height = tSvgBR.y - tSvg.y;
		
		// 取得するタイル要素を作成し、各属性をセットする。
		var cl = this.svgImage.createElement("image");
		cl.setAttribute("x" , tSvg.x);
		cl.setAttribute("y" , tSvg.y);
		cl.setAttribute("width" , tSvg.width);
		cl.setAttribute("height" , tSvg.height);
		cl.setAttribute("xlink:href" , tileURL.URL);
		cl.setAttribute("metadata" , tileURL.Key);
		
		return ( cl );
	}
	
	// 指定された地図座標geoViewBoxに、levelのズームレベルの地図を表示する場合に、必要なタイルのXYのセットを返却する
	getTileSet( geoViewBox , level ){
		var TileSet = new Object();
		if ( geoViewBox.y + geoViewBox.height > 85.05113 ){
			geoViewBox.height = 85.05113 -  geoViewBox.y;
		}
		
		if ( geoViewBox.y < -85.05113 ){
			geoViewBox.y = -85.05113;
		}
		
		// 指定エリアの、tileのXYとそのHashKeyを返却する
		var tlxy = this.latLng2XY( geoViewBox.y + geoViewBox.height , geoViewBox.x , level );
		var tileTLxy = this.XY2TileXY( tlxy );
		var brxy = this.latLng2XY( geoViewBox.y , geoViewBox.x + geoViewBox.width, level );
		var tileBRxy = this.XY2TileXY( brxy );
		
		// 必要な高さ・幅分のタイル個数分以下を繰り返す
		for ( var i = tileTLxy.y ; i <= tileBRxy.y ; i++ ){
			for ( var j = tileTLxy.x ; j <= tileBRxy.x  ; j++ ){
				// タイルのXYとズームレベルからHashKeyを取得する
				var qkey = this.getKey( j, i, level);
				// 上記で取得したHashKeyごとに、必要なタイル情報を設定する
				TileSet[qkey] = new Object();
				TileSet[qkey].x = j;
				TileSet[qkey].y = i;
			}
		}
		return ( TileSet );
	}
	
	// 緯度・経度からXYに変換
	latLng2XY( lat , lng , lvl ){
		var size = this.lvl2Res(lvl);
		var sinLat = Math.sin(lat * Math.PI / 180.0);
		var pixelX = (( lng + 180.0 ) / 360.0 ) * size;
		var pixelY = (0.5 - Math.log((1 + sinLat) / (1.0 - sinLat)) / (4 * Math.PI)) * size;
		return {
			x : pixelX ,
			y : pixelY
		}
	}
	
	// XYからタイルのXYに変換
	XY2TileXY( xy ){
		var tileX = Math.floor(xy.x / this.tilePix);
		var tileY = Math.floor(xy.y / this.tilePix);
		return {
			x : tileX ,
			y : tileY
		}
	}
	
	tilePix = 256;
	// ズームレベルからタイルの一片のサイズを返却
	lvl2Res( lvl ){
		var j = 1;
		for(var i = 0 ; i < lvl ; i++){
			j = j * 2;
		}
		return ( j * this.tilePix );
	}
	
	// XYから緯度・経度に変換
	XY2latLng( px , py , lvl ){
		var size = this.lvl2Res(lvl);
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
	getURL( tx , ty , lvl ){
		// XYとズームレベルからHashKeyを取得
		var tile_ans = this.getKey( tx , ty , lvl );
		// OpenStreetMapのURLを組み立てる
		var mapServerURL = this.tileInfo.baseURL.replaceAll("{z}",lvl);
		mapServerURL = mapServerURL.replaceAll("{x}",tx);
		mapServerURL = mapServerURL.replaceAll("{y}",ty);
		var rty = Math.pow(2,lvl)-ty-1;
		mapServerURL = mapServerURL.replaceAll("{ry}",rty);  // 2022/04/27 yを南から附番してるサーバがあるね・・・ それは{ry}を使えば良いようにしてみる
		// 複数の同様のサーバを順次切り替えながら使用することで、地図イメージ取得時の負荷分散を行う。
		return {
			URL : mapServerURL ,
			Key : tile_ans
		}
	}
	
	// HashKeyを生成し返却する
	getKey(tx , ty , lvl){
		return ( tx + "_" + ty + "_" + lvl );
	}
		
	clearTiles(){
		var tiles = this.svgImage.getElementsByTagName("image");
		for ( var i = tiles.length-1 ; i>=0 ; i--){
			var tile = tiles[i];
			tile.parentElement.removeChild(tile);
		}
	}

	showOverflowMessage(messageText){
		console.log("showOverflowMessage:",messageText);
		var vb = svgMap.getGeoViewBox();
		var svgPos1 = svgMap.transform( vb.x , vb.y , this.svgImageProps.CRS );
		var svgPos2 = svgMap.transform( vb.x+vb.width , vb.y+vb.height , this.svgImageProps.CRS );
		
		var txt = this.svgImage.getElementById("overflowText");
		if ( txt ){txt.remove()}
		if ( !messageText){return}
		
		txt = this.svgImage.createElement("text");
		txt.setAttribute("id","overflowText");
		this.svgImage.documentElement.appendChild(txt);
		txt.setAttribute("fill","purple");
//			txt.setAttribute("x","5");
		txt.setAttribute("font-size","20");
		txt.textContent=messageText;
		txt.setAttribute("transform","ref(svg,"+(svgPos1.x+svgPos2.x)/2+","+(svgPos1.y+svgPos2.y)/2+")");
	}
}
	
export {DynamicWebTile};
