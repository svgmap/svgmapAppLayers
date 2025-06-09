// Description:
// Client-side Quad Tree Composite Tiling Processing
// 
// ESModule+Classによるカプセル化の習作
// プロトコル圧縮された比較的大きなレコード(数万件)のCSVデータを、
// SVGMap.jsで（SVGMapToolsなどを使った前処理なしに）直接可視化するようなケースでは有用かも
// 
//  Programmed by Satoru Takagi
//  
// License: (MPL v2)
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.

// history:
// 2022/04/20 : 1st rev
// 2022/04/28 : 属性値による色分け機能
// 2022/12/12 : 処理の効率化。(IndexedDBにタイルデータを格納することを想定した準備工事)　逐次登録対応
// 2023/07/26 : 処理の効率化(小縮尺ビットイメージの統計段階をImageDataでなく、単なる一次元配列に変更）、ヒートマップ表示の準備工事
// 2024/04/18 : tileIndexを持つようにした。　zipアーカイブなどによる、非同期QTCTへの備え
// 2024/05/29 : データ削除機能 deleteOneData
// 2024/06/05 : データの1個づつの追加機能と、それの祖先ビットイメージ群更新(registOneData (#registOneData_int分離))

class ClientSideQTCT{
	#imageSize = 96; // 偶数である必要がある
	#tileDataMaxLength = 200;
	#levelLimit = 30;

	#quadTreeCompositeTile={}; //タイリング結果格納オブジェクト key:level_tx_ty , value:ImageData or RawData Array [[x,y,meta]..]
	#lowResImages={}; // 小縮尺データの要約イメージ
	
	#mergedTiledData={}; // ↑の二つの基本オブジェクトのうち、#quadTreeCompositeTileの小縮尺集計情報を外して#lowResImagesをマージしたデータ。　外部に公開したり、initで設定するデータは基本こちらのデータ Proxyをつかうべきかも・・・
	
	#buildRawData;

	#progressCBF;
	#pixelColor=[255,0,0,255];//RGBA でビットイメージの色を指定する(doQTCTのoptions.pixelColor)　もしくは
	/** 特定のプロパティ値に応じて色を変化させたい場合は
	#pixelColor = {
		evaluator:function(rawData):rawDataを入力し、下記tableのindex(base0)を返却する評価関数：デフォルトはindexが"小さいほう(table配列の先頭)"が優先度が高い(優先度高い値の色で上塗りされる(基本アンダーサンプリングなので))、orderで逆順も指定できる
		table:[[r,g,b,a],[r,g,b,a],[r,g,b,a]...] (最大255個まで)
		order:Ascending(default):小さいほうを優先してピクセル塗る,Descending大きいほう優先して塗る
	}
	**/
	
	constructor(){
		this.init();
	}
	
	init(qtctMapData,buildRawData){
		this.#deleteAllData();
		if (qtctMapData ){
			this.#mergedTiledData = qtctMapData;
			this.#quadTreeCompositeTile.tileIndex = qtctMapData.tileIndex;
			this.restoreQuadTreeCompositeTileAndLowResImages();
			/**
			for ( var key in qtctMapData){
				this.#quadTreeCompositeTile[key] = qtctMapData[key];
			}
			**/
			// this.#lowResImages = await this.buildLowResTiles(); は要らないのか？？　color設定は？　いろいろ疑問が残る仕様
		} else {
			this.#quadTreeCompositeTile["00_0_0"]=[];
		}
		//this.#mergedTiledData=null;
		//this.#lowResImages=null;
		if ( buildRawData ){
			this.#buildRawData = buildRawData;
		}
	}
	
	#sleep = ms => new Promise(res => setTimeout(res, ms));
	
	async doQTCT(srcData, buildRawData, options){ // srcData: [[x,y,meta]....]
		// srcData : 一次元配列、各要素にbuildRawDataに入力するデータがある必要がある
		// buildRawData : srcDataを読解する関数 ：正規化された一次元配列を返却し、0,1番目にlon(経度(x)),lat(緯度(y)), 2番目にメタデータの配列が入る必要がある
		// options :
		//  maxTilePoints : number タイル分割の閾値(ポイント数)
		//  pixelColor :
		//    [r,g,b,a]で共通のピクセルカラー指定する
		//    か、
		//    {evaluator, table, [order]}を用意し低解像度イメージタイルの生成色を規定する
		//      evaluator: 数字を算出する評価関数　引数は、buildRawDataと同じく、入力ローデータ
		//      table : eveluatorで算定したindex値(>=0の数字)に対応する、色のテーブル( [[r,g,b,a],...] )
		//      order :   "descending"   : index値の優先順位（大きい方を優先するか小さい方を優先するか）
		//      heatmap : true : ヒートマップ描画モード
		//  image : boolean trueに設定すると、低解像度タイル画像(dataURL)をimagesメンバに、buildRawDataでパースされたデータを格納したタイルデータをdataメンバ(ただし低解像度タイル部分には、そのは配下のタイルにあるデータの総数(数値)が入った)オブジェクトデータを出力する
		//  
		// console.log("doQTCT options:",options, (options && options.maxTilePoints ), (options.maxTilePoints) instanceof Number );
		if ( !buildRawData){
			console.warn("NO dataReader(buildRawData) exit.");
			return;
		} else {
			this.#buildRawData = buildRawData;
		}
		if ( options && options.maxTilePoints && typeof(options.maxTilePoints)=="number" ){
			this.#tileDataMaxLength=options.maxTilePoints;
			// console.log("set this.#tileDataMaxLength:",this.#tileDataMaxLength);
		}
		if ( options && options.progressCBF ){
			this.#progressCBF=options.progressCBF;
		}
		if ( options && options.pixelColor && ((options.pixelColor instanceof Array && options.pixelColor.length==4)||(options.pixelColor instanceof Object && (options.pixelColor.heatmap || options.pixelColor.evaluator))) ){
			this.#pixelColor= options.pixelColor;
			this.#normalizePixelColor(this.#pixelColor);
		}
		this.#quadTreeCompositeTile = {"00_0_0":[]};
		var regCount=0;
		var pt = new Date().getTime();
		if ( srcData && srcData instanceof Array ){
			for ( var sData of srcData ){ // データを一個づつ登録していく
				var registeredTileKey = this.#registOneData_int(sData);
//				console.log(registeredTileKey);
				++regCount;
				if (regCount%1000==0){
					var ct = new Date().getTime();
					if ( ct - pt > 300){
						pt = ct;
						if ( this.#progressCBF ){
							this.#progressCBF( regCount+" / "+ srcData.length+ " tiling")
						}
						await this.#sleep(10);
					}
				}
				
			}
		}
		
		if ( options && options.appendMode){
			console.log("Append mode.. skip low red tile images generation");
			return;
		}
		
		if ( this.#progressCBF ){
			this.#progressCBF( "Start building LowResTiles.")
		}
		await this.#sleep(10);
		
		// 小縮尺ピラミッドビットイメージ生成
		this.#lowResImages = await this.buildLowResTiles();
		
		/**
		for ( var key in this.#quadTreeCompositeTile){
			console.log(key,this.#quadTreeCompositeTile[key]);
		}
		console.log(this.#lowResImages);
		**/
		
		this.#quadTreeCompositeTile.tileIndex=this.getTileIndex();
		// 返答処理
		var separateImage = false;
		if ( options && options.image ){
			separateImage=true;
		}
		this.#updateMergedTiledData()
		return ( this.getTliedData(separateImage));
	}
	
	#normalizePixelColor(pixelColor){
		if ( pixelColor instanceof Object && pixelColor.evaluator){
			if ( pixelColor.table && pixelColor.table instanceof Array ){
				for ( var color of pixelColor.table ){
					if (color instanceof Array && color.length <4){
						color.push(255);
					} else {
						console.warn( "elements of options.pixelColor.table is not array" );
					}
				}
			} else {
				console.warn( "options.pixelColor.table is not exist. set FF0000FF" );
				pixelColor.table=[255,0,0,255];
			}
		} else {
			if (pixelColor.length ==3){
				pixelColor.push(255);
			}
		}
		console.log("normalizePixelColor:",pixelColor);
	}
	
	#updateMergedTiledData(){
		// 内部データから、実データと低解像データタイルを複合した構造をアップデートする(オブジェクトは基本的に保持)
		this.#quadTreeCompositeTile.tileIndex=this.getTileIndex();
		for ( var key in this.#mergedTiledData){
			delete this.#mergedTiledData[key];
		}
		for ( var tkey in this.#quadTreeCompositeTile){
			this.#mergedTiledData[tkey] = this.#quadTreeCompositeTile[tkey];
		}
		for ( var tkey in this.#lowResImages ){
			this.#mergedTiledData[tkey]=this.#lowResImages[tkey];
		}
	}
	
	
	setTileData(key,value){
		this.#mergedTiledData[key]=value;
		if ( typeof value =="object" ){ // tileIndex or tiledata
			this.#quadTreeCompositeTile[key]=value;
		} else { // 画像
			this.#lowResImages[key]=value;
		}
	}
	
	getTileData(key){
		var val = this.#quadTreeCompositeTile[key];
		if ( typeof(val)=="number"){
			return ( this.#lowResImages[key]);
		} else {
			return val;
		}
	}
	
	getTliedData(separateImage){
		if ( separateImage ){
			return {
				data : this.#quadTreeCompositeTile,
				images : this.#lowResImages
			}
		} else {
			this.#updateMergedTiledData()
			return this.#mergedTiledData;
		}
	}
	
	async registOneData(sData){
		// 一個ずつ登録するときはこちらを使う。　都度都度画像の生成を行う
		var registeredTileKey = this.#registOneData_int(sData);
		var partialLRT = await this.buildLowResTiles(true,null,registeredTileKey); // そのregisteredTileKeyの上だけのビットイメージを更新していく
		for ( var tk in partialLRT){
			this.#lowResImages[tk]=partialLRT[tk];
		}
		this.#updateMergedTiledData()
		return ( registeredTileKey );
	}
	
	#registOneData_int(sData){
		// バルクで登録するときはこちらを使って、その後画像の生成を一気に行う（効率良い）
		var rdata = this.#buildRawData(sData);
		rdata[0]=Number(rdata[0]);
		rdata[1]=Number(rdata[1]);
		var registeredTileKey =  this.#doTiling(rdata);
		return registeredTileKey;
	}
	
	async deleteOneData(sData){
		var rawData = this.#buildRawData(sData);
		rawData[0]=Number(rawData[0]);
		rawData[1]=Number(rawData[1]);
		var deletedTileKey = this.#deleteOneData_int(rawData,0);
		console.log("deleteOneData:",deletedTileKey);
		if ( deletedTileKey ){
			var partialLRT = await this.buildLowResTiles(true,null,deletedTileKey); // そのdeletedTileKeyの上だけのビットイメージを更新していく
			// this.#lowResImages をアップデートしていく
			if ( this.#lowResImages[deletedTileKey]){
				delete this.#lowResImages[deletedTileKey];
			}
			for ( var tk in partialLRT){
				this.#lowResImages[tk]=partialLRT[tk];
			}
			this.#updateMergedTiledData()
		}
		console.log({img:this.#lowResImages,tile:this.#quadTreeCompositeTile});
		return deletedTileKey;
	}
	
	#deleteOneData_int(rawData,level){ // 2024/5/26
		// 返却：削除が生じたタイルのtileKey
		var dataDeleted = false;
		var tilePos = this.#getTileCrds( rawData[0], rawData[1], level );
		var tileKey = this.#getTileKey( tilePos.tx, tilePos.ty, level );
		var tileData = this.#quadTreeCompositeTile[tileKey];
		console.log("deleteOneData_int:",level," key:",tileKey,"  data:",tileData);
		if ( tileData instanceof Array){ // 実データが入っているタイル
			for ( var k= 0 ; k < tileData.length ; k++){
				var oneRecord = tileData[k];
				if ( Math.abs(oneRecord[0] - rawData[0])<1e5 && Math.abs(oneRecord[1] - rawData[1])<1e5){
					var hitData=true;
					if ( oneRecord[2].length == rawData[2].length){
						for ( var i=0 ; i < oneRecord[2].length ; i++){
							if ( oneRecord[2][i] != rawData[2][i]){
								hitData = false;
								break;
							}
						}
					} else {
						hitData = false;
					}
					if ( hitData ){
						tileData.splice(k,1);
						dataDeleted = tileKey;
						if ( tileData.length == 0){
							 delete this.#quadTreeCompositeTile[tileKey];
						}
						break;
					}
				}
			}
			if ( !dataDeleted){
				console.warn("Could not find to be deleted data");
			}
		} else if ( typeof(tileData)=="number" ){
			dataDeleted = this.#deleteOneData_int(rawData,level+1)
			if ( dataDeleted ){ // これは確かに実データが削除されたときに行わないとバグる
				var dataCounts = tileData-1;
				this.#quadTreeCompositeTile[tileKey] = dataCounts;
//				console.log("Set LowResTile Counts:",dataCounts,tileKey);
				if ( dataCounts <= this.#tileDataMaxLength ){
					//配下タイルの結合　下のレベルから上がっていくことになるので、一つ下の階層に必ず実データがあり、そのマージだけで良いはず
					console.log("quadMerge occurred under :",tileKey," counts:",dataCounts);
					this.#quadMerge(tileKey);
					dataDeleted = tileKey; // 削除が発生したtileKeyをマージ後のものに置き換える
				}
			}
		} else {
			// 見つからないのでスキップ
			console.warn("Could not find to be deleted data : tilePos", tilePos, " tileKey:",tileKey," rawData:",rawData);
		}
		return dataDeleted;
	}

	countRecords(){
		var counts=0;
		for ( var key in this.#quadTreeCompositeTile ){
			if ( this.#quadTreeCompositeTile[key] instanceof Array){
				counts += this.#quadTreeCompositeTile[key].length;
			}
		}
		console.log("countRecords:",counts);
		return ( counts );
	}
	
	#doTiling(rawData, level){
		// console.log("doTiling:",rawData,level);
		var registeredTileKey;
		if ( !level){level=0}
		var tilePos = this.#getTileCrds( rawData[0], rawData[1], level );
		var tileKey = this.#getTileKey( tilePos.tx, tilePos.ty, level );
		var tileData = this.#quadTreeCompositeTile[tileKey];
		if ( tileData == undefined || tileData instanceof Array){ // 実データが入っているタイル
			if ( tileData == undefined ){
				tileData = [];
				this.#quadTreeCompositeTile[tileKey]=tileData;
			}
			tileData.push(rawData);
			if ( tileData.length > this.#tileDataMaxLength ){
				if ( level +1 > this.#levelLimit ){
					console.warn("levelLimit over.. stop quadParting: level:",level);
					registeredTileKey = tileKey;
				} else {
					registeredTileKey = this.#quadPart(tileData,level+1);
					this.#quadTreeCompositeTile[tileKey]= -1; // 後々個数を入れることにしましょうか
				}
			} else {
				registeredTileKey = tileKey;
			}
		} else { // 低解像度データ
			if ( typeof(tileData)=="number" ){
				registeredTileKey = this.#doTiling(rawData, level+1);
			}
		}
		return registeredTileKey;
	}

	#quadPart(tileData,level){
		var registeredTileKey; // タイル分割された最深部のkeyの組
		var keys=[];
		for ( var rdata of tileData){
			var tilePos = this.#getTileCrds( rdata[0], rdata[1], level );
			var tileKey = this.#getTileKey( tilePos.tx, tilePos.ty, level );
			if ( !this.#quadTreeCompositeTile[tileKey] ){
				this.#quadTreeCompositeTile[tileKey] = [];
				keys.push(tileKey);
			}
			this.#quadTreeCompositeTile[tileKey].push(rdata);
		}
		registeredTileKey = tileKey; //tileData末尾が、最後に追加されたデータなので、そのタイルキーが最後に追加されたデータのタイルキー
		for ( var key of keys){ // 分割しても、同じ場所に結局データが集まっていた場合には、どんどん掘り下げてタイツ分割する必要がある
			if ( this.#quadTreeCompositeTile[key].length > this.#tileDataMaxLength ){
				if ( level > this.#levelLimit ){
					console.warn("levelLimit over.. stop quadParting: level:",level, "  key:", key , "  dataLength:",this.#quadTreeCompositeTile[key].length);
				} else {
					registeredTileKey = this.#quadPart(this.#quadTreeCompositeTile[key],level+1);
					this.#quadTreeCompositeTile[key] = -1;
				}
			}
		}
		return registeredTileKey;
	}
	
	#quadMerge(tileKey){ // ひとつ下の階層の4つのタイルを一つにマージする
		var ck0 = this.#getChildKey(tileKey);
		var mtile=[];
		var cks=[];
		for ( var subTile of this.#subTiles){
			var clevel = ck0.level;
			var ctx = ck0.tx0+subTile[0];
			var cty = ck0.ty0+subTile[1];
			var ckey = this.#getTileKey( ctx, cty, clevel );
			cks.push(ckey);
			var ctile = this.#quadTreeCompositeTile[ckey];
			if ( ctile instanceof Array ){
				mtile = mtile.concat(ctile);
			} else {
				// 想定外
				console.warn("ERR: Child tile has low res tile exit");
				return false;
			}
		}
		this.#quadTreeCompositeTile[tileKey]=mtile; // マージした配列を投入
		for ( var ckey of cks ){ // 下階層のタイルを削除
			delete this.#quadTreeCompositeTile[ckey];
		}
		return true;
	}

	#getTileKey(tx,ty,level){
		if (level < 10){
			level="0"+level;
		}
		return ( level + "_" + tx + "_" + ty );
	}
	
	getGeoBound(key){ // これはstatic
		var level,tx,ty;
		if ( key instanceof Array ){
			level = key[0];
			tx = key[1];
			ty = key[2];
		} else {
			var ks = key.split("_");
			level = Number(ks[0]);
			tx = Number(ks[1]);
			ty = Number(ks[2]);
		}
		var div = 360 / Math.pow(2,level);
		
		var geoX0 = tx * div -180;
		var geoY0 = 180 - ty * div - div;
		return {
			x: geoX0,
			y: geoY0,
			width: div,
			height: div
		}
	}
	
	getTileNmber( x, y, level){ // これは基本的にstatic
		return ( this.#getTileCrds( x, y, level));
	}
	
	// 経度(x)緯度(y)の四分木タイル（経度・緯度と共、±180）
	#getTileCrds( x, y, level, getIntTileCrds ){
		//座標pos.x,yのタイル番号、およびタイル内での相対座標
		x = x + 180;
		y = -y + 180;
		var div = 360 / Math.pow(2,level);

		if ( getIntTileCrds ){
			var ix = (x % div)/div;
			var iy = (y % div)/div;
			return {
				ix:ix,iy:iy,
				size:div,
			}
		} else {
			var tx = Math.floor(x / div);
			var ty = Math.floor(y / div);
			return {
				tx:tx,ty:ty,
				size:div,
			}
		}
	}

	#subTiles=[[0,0],[1,0],[0,1],[1,1]];
	
	#lowResRasterDatas; // 小縮尺の集計データ格納連想配列 ==> lowResRasterDatasにして、lowResRasterDatas[key]の中身はImageDataではなく、単純な一次元配列[val,...]に 20230726
	#pointDensityBound={}; // ヒートマップのレンジパラメータ決定用 1ピクセルに最大何個のポイント(もしくは見なし数値)があるかを単位面積[m^2]当たりのポイントで heatmap指定の時、buildSubImage(),downSample()内で生成している レベルごとに別に作る
	// 小縮尺ビットイメージ生成の集計処理　最後に一気に行っている
	// useImageDataCacheは統計処理データを再利用するオプション　基本的にheatmap表示時の表示色調整時用
	// targetKeyがある場合、そのtargetKeyの上に連なるビットイメージだけを更新していく
	async buildLowResTiles(useImageDataCache, heatMap, targetKey){
		this.#pixelAreaCache={};
		if ((useImageDataCache==true || targetKey) && this.#lowResRasterDatas){
			// キャッシュされた統計情報を使う
		} else {
			this.#lowResRasterDatas={};
			targetKey =null; // lowResRasterDatasが見つからなければ、全部作るしかない？
			console.log("new lowResRasterDatas");
		}
		if ( heatMap ){
			this.#pixelColor.heatmap = true;
			console.log("this.#pixelColor.heatmap:",this.#pixelColor.heatmap);
		} else {
			delete this.#pixelColor.heatmap;
		}
		// まずは下(大縮尺)の階層から、lowResRasterDatasへの統計処理を実行
		// ダウンサンプリング(上の階層)統計データの生成処理もこのループで実行
		var keys; // 下の階層からループを回す
		if ( targetKey){
			keys = this.#filterAncestors(targetKey);
		} else {
			keys = Object.keys(this.#quadTreeCompositeTile).sort().reverse(); // 下の階層からループを回すために逆ソートする
		}
		for ( var key of keys ){
			var tile = this.#quadTreeCompositeTile[key];
			var tileZXY = (key.split("_")).map(Number);
			if ( tile instanceof Array ){
				// 実データ　スキップ
			} else { // 数字(デフォルト-1)が入っているものは低解像度データ生成すべきタイル
				var tileRaster = new Array(this.#imageSize * this.#imageSize);
				tileRaster.fill(0);
//				var tileImage = new ImageData(this.#imageSize , this.#imageSize);
				this.#lowResRasterDatas[key] = tileRaster;
				// console.log("buildLowResTiles keys:",key);
				var ck0 = this.#getChildKey(key);
				
				var dataCount = 0;
				for ( var subTile of this.#subTiles){ // 配下のタイルから統計・イメージデータ生成
					var ctx = ck0.tx0+subTile[0];
					var cty = ck0.ty0+subTile[1];
					var clevel =  ck0.level;
					var ckey = this.#getTileKey( ctx, cty, clevel );
					var ctile = this.#quadTreeCompositeTile[ckey];
					//console.log("key:",key," cKey:",ckey," cDat:",ctile," cImg:",typeof this.#lowResRasterDatas[ckey]);
					if ( ctile instanceof Array ){ // 実データ
						this.#buildSubImage(tileRaster, ctile, clevel-1 , tileZXY);
						dataCount += ctile.length;
					} else { // number || 無い
						var childRasterData = this.#lowResRasterDatas[ckey];
						if ( childRasterData ){
							this.#downSample(tileRaster, childRasterData, subTile[0], subTile[1], tileZXY );
							dataCount += ctile;
						}
					}
				}
				if (this.#pixelColor.heatmap){
					this.#buildPointDensityBound(tileZXY,tileRaster);
				}
				this.#quadTreeCompositeTile[key] = dataCount;
				//console.log("set count to tile:",key," count:",dataCount, this.#quadTreeCompositeTile[key]);
			}
		}
		
		if ( this.#progressCBF ){
			this.#progressCBF( "Low Res Raster Data Generation Completed. Building ImageURL.")
		}
		
		var imgPromise=[];
		var pt = new Date().getTime();
		var iCount=0;
	 	var imgAns = {};
		for ( var key of keys ){
			var tile = this.#quadTreeCompositeTile[key];
			if ( tile instanceof Array ){
				// 実データ　スキップ
			} else {
				var rasterTile = this.#lowResRasterDatas[key];
				var imageTile;
				if  ( this.#pixelColor instanceof Array == false){ // evaluatorを使った多色設定のための色設定
					imageTile = this.#setPixelColor(rasterTile); // 
					/** TBD evaluatorを用いたみなし値によるヒートマップモード？　ここじゃない？
					if ( this.#pixelColor.heatmap){
						var level = Number(key.split("_")[0]);
						imageTile = this.#buildHeatMap(rasterTile,level); // 
					} else {
						imageTile = this.#setPixelColor(rasterTile); // 
					}
					**/
				} else if( this.#pixelColor.heatmap) {
					var tileZXY = (key.split("_")).map(Number);
					imageTile = this.#buildHeatMap(rasterTile,tileZXY); // 
				} else {
					imageTile = this.#setPixelColor(rasterTile, this.#pixelColor);
				}
				imgAns[key]=this.#showImageData(imageTile,this.#imageSize);
				// delete lowResImageDatas[key];
				
				var ct = new Date().getTime();
				if ( ct - pt > 300){
					pt = ct;
					//console.log( iCount+" / "+ keys.length+ " raster image generation")
					if ( this.#progressCBF ){
						this.#progressCBF( iCount+" / "+ keys.length+ " raster image generation")
					}
					await this.#sleep(10);
				}
				
			}
			++iCount;
		}
		//var imgs=await Promise.all(imgPromise);
		
		// console.log(imgs,this.#quadTreeCompositeTile);
		this.#pixelAreaCache={};
		console.log("#pointDensityBound:",this.#pointDensityBound," lowResRasterDatas:",this.#lowResRasterDatas," imgAns:",imgAns);
	 	return ( imgAns );
	}
	
	#filterAncestors(chidKey){
		var tileZXY = (chidKey.split("_")).map(Number);
		var lx = tileZXY[1];
		var ly = tileZXY[2];
		var ans = [];
		for ( var lvl = tileZXY[0] ; lvl >=0 ; lvl--){
			ans.push(this.#getTileKey(lx,ly,lvl));
			lx = Math.floor(lx/2);
			ly = Math.floor(ly/2);
		}
		//console.log("filterAncestors:",ans);
		return ( ans );
	}
	
	#imgGenCanvas;
	#showImageData(imageData,size){ // これを並列に動かしたら早くなる?
		// blinkのCSSで画面の更新が頻繁に起こると大幅にパフォーマンスが低下することがわかった
		var canvas = this.#imgGenCanvas;
		if (!canvas){
			canvas = document.createElement("canvas");
		}
		canvas.width=size;
		canvas.height=size;
		var canvasContext = canvas.getContext('2d');
		canvasContext.putImageData(imageData, 0, 0);
		var uri = canvas.toDataURL('image/png');
		/**
		//document.documentElement.appendChild(canvas); // for debug
		//var imgBlob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
		**/
		//var uri="";
		return ( uri );
	}
	
	#setPixelColor(tileRaster, fixedColors){ // #pixelColorがobjectの場合、実際の色をここで生成させる
		//console.log("setPixelColor: this.#pixelColor:",this.#pixelColor);
		var ansImg = new ImageData(this.#imageSize , this.#imageSize);
		var tilePixels = ansImg.data;
		for ( var py=0 ; py < this.#imageSize ; py++){
			for ( var px=0 ; px < this.#imageSize ; px++){
				var baseRas = (py * this.#imageSize + px) ;
				var baseSub = baseRas * 4;
				if ( tileRaster[baseRas] !=0){ // 空ピクセルは無視
					if ( fixedColors ){
						tilePixels[baseSub + 0] = fixedColors[0];
						tilePixels[baseSub + 1] = fixedColors[1];
						tilePixels[baseSub + 2] = fixedColors[2];
						tilePixels[baseSub + 3] = fixedColors[3];
					} else {
						var pColor=this.#pixelColor.table[tileRaster[baseRas]-1]; // この-1はbuildSubImageで+1してるのを戻している
						// console.log("pColor:",pColor);
						tilePixels[baseSub + 0] = pColor[0];
						tilePixels[baseSub + 1] = pColor[1];
						tilePixels[baseSub + 2] = pColor[2];
						tilePixels[baseSub + 3] = pColor[3];
					}
				}
			}
		}
		return ( ansImg );
	}
	
	#buildHeatMap(tileRaster,tileZXY){ // #pixelColor.heatmap==trueの時は集計したデータがtilePixに入っているので、それを色に変換する
		//console.log("buildHeatMap : ",tileRaster.join(","), tileZXY);
		var ansImg = new ImageData(this.#imageSize , this.#imageSize);
		var tilePixels = ansImg.data;
		var level = tileZXY[0];
		for ( var py=0 ; py < this.#imageSize ; py++){
			var pixelArea = this.#getPixelArea(tileZXY,py); // xは面積に関係ないため
			for ( var px=0 ; px < this.#imageSize ; px++){
				var baseRas = (py * this.#imageSize + px) ;
				var baseSub = baseRas * 4;
				if ( tileRaster[baseRas] !=0){ // 空ピクセルは無視
					var pointDensity = tileRaster[baseRas] / pixelArea;
					
					var val = 270 * (pointDensity - this.#pointDensityBound[level].min) / (  this.#pointDensityBound[level].max - this.#pointDensityBound[level].min);
					val = Math.min(val,270);
					val = Math.max(val,0);
					val = 270 - val;
					
					var rgb = svgMapGIStool.hsv2rgb(val,100,100);
					
					tilePixels[baseSub + 0] = rgb.r;
					tilePixels[baseSub + 1] = rgb.g;
					tilePixels[baseSub + 2] = rgb.b;
					tilePixels[baseSub + 3] = 255;
				}
			}
		}
		return ( ansImg );
	}
	
	#getChildKey(pkey){
		var ks = pkey.split("_");
		var level = Number(ks[0])+1;
		var tx = Number(ks[1])*2;
		var ty = Number(ks[2])*2;
		return {tx0:tx,ty0:ty,level:level};
	}
	
	#getColorEvalAscendingOrder(){
		var ans = true;
		if( this.#pixelColor.order && this.#pixelColor.order.toLowerCase() == "descending"){
			ans = false;
			// console.log("colorEvaluatorOrder : descending");
		}
		return ( ans );
	}
	
	#buildSubImage(parentRasterData, childTileData , parentLevel, tileZXY){
		var pixels = parentRasterData;
		var colorEvaluatorOrderAscending = this.#getColorEvalAscendingOrder();
		var hasPxMap={}; // ピクセルがあるデータのマップ(heatmapの最大最小値演算に使用)
		for ( var rawData of childTileData){
			var tcd = this.#getTileCrds( rawData[0], rawData[1], parentLevel, true );
			
			var px = Math.floor(this.#imageSize * tcd.ix);
			var py = Math.floor(this.#imageSize * tcd.iy);
			var base = (py * this.#imageSize + px);
			if (this.#pixelColor.heatmap){
				var pixelArea = this.#getPixelArea(tileZXY,py);
				if(!hasPxMap[base]){
					hasPxMap[base] = pixelArea;
				}
				var pv = pixels[base] +1;
				pixels[base]=pv;
			} else if  ( this.#pixelColor instanceof Array){ // 単色設定
				pixels[base]=1;
			} else {
				var colorIndex = this.#pixelColor.evaluator(rawData)+1; // +1してるのは0がまずいため
				// console.log("colorIndex:",colorIndex,"  orgpix:",pixels[base+3])
				//console.log( colorIndex,  pixels[base+3]);
				if (
					pixels[base]==0 ||
					(colorEvaluatorOrderAscending && pixels[base] > colorIndex )||
					((!colorEvaluatorOrderAscending) && pixels[base] < colorIndex)
				){
					pixels[base] = colorIndex; // 実際の色の設定は最後に一括で行うことにします
//					console.log("set color:",pixels[base] ,"  addr:",base);
				}
			}
		}
		if (this.#pixelColor.heatmap){
			var level = tileZXY[0];
			if ( !this.#pointDensityBound[level]){
				this.#pointDensityBound[level] = {min:1e99,max:0};
			}
			for ( var pk in hasPxMap){
				if ( hasPxMap[pk] >0){
					var densitiy = pixels[pk]/hasPxMap[pk]; // 個数(もしくは見なし値) / 物理面積
					this.#pointDensityBound[level].max = Math.max(densitiy, this.#pointDensityBound[level].max);
					this.#pointDensityBound[level].min = Math.min(densitiy, this.#pointDensityBound[level].min);
				}
			}
			//console.log(this.#pointDensityBound);
		}
	}
	#downSample(parentRasterData, childRasterData, childX, childY, tileZXY ){
		var colorEvaluatorOrderAscending = this.#getColorEvalAscendingOrder();
		var parentPixels = parentRasterData;
		var subPixels = childRasterData;
		for ( var py=0 ; py < this.#imageSize ; py++){
			for ( var px=0 ; px < this.#imageSize ; px++){
				var baseSub = (py * this.#imageSize + px);
				var baseParent = (Math.floor((py+childY*this.#imageSize)/2)*this.#imageSize + Math.floor((px+childX*this.#imageSize)/2));
				if (  this.#pixelColor.heatmap){
					var pv = subPixels[baseSub] + parentPixels[baseParent];
					parentPixels[baseParent]=pv;
				} else {
					if ( subPixels[baseSub] !=0){ // 空ピクセルは上書きさせない
						if  ( this.#pixelColor instanceof Array){ // 単色設定
							parentPixels[baseParent]= subPixels[baseSub];
						} else { // evaluatorを使った多色設定
							if (
								parentPixels[baseParent]==0 ||
								(colorEvaluatorOrderAscending && parentPixels[baseParent] > subPixels[baseSub] )||
								((!colorEvaluatorOrderAscending) && parentPixels[baseParent] < subPixels[baseSub] )
							){
								parentPixels[baseParent] = subPixels[baseSub];
							}
						}
					}
				}
			}
		}
	}
	
	#buildPointDensityBound(tileZXY,tileRaster){
		var level = tileZXY[0];
		for ( var py=0 ; py < this.#imageSize ; py++){
			var pixelArea = this.#getPixelArea(tileZXY,py);
			if ( !this.#pointDensityBound[level]){
				this.#pointDensityBound[level] = {min:1e99,max:0};
			}
			for ( var px=0 ; px < this.#imageSize ; px++){
				var base = (py * this.#imageSize + px);
				var pv = tileRaster[base];
				if ( pixelArea >0){
					var densitiy = pv/pixelArea; // 個数(もしくは見なし値) / 物理面積
					this.#pointDensityBound[level].max = Math.max(densitiy, this.#pointDensityBound[level].max);
					this.#pointDensityBound[level].min = Math.min(densitiy, this.#pointDensityBound[level].min);
				}
			}
		}
	}
	
	#pixelAreaCache={};
	#getPixelArea(tileZXY,py){
		var pixelArea = this.#pixelAreaCache[tileZXY[0]+"_"+tileZXY[2]+"_"+py];
		if ( !pixelArea ){
			var geoBound = this.getGeoBound(tileZXY);
			// メートルでピクセルのw/hを出す
			var lat = (geoBound.y+ ( this.#imageSize - py - 1) * geoBound.height / this.#imageSize);
			if ( Math.abs(lat)>=90){
				return 0;
			}
			var xLen = Math.cos(lat * Math.PI/180) *  (geoBound.height / this.#imageSize ) * (40000000/360);
			var yLen = (geoBound.width / this.#imageSize ) * (40000000/360);
			pixelArea = xLen * yLen; // 掛けて面積
			this.#pixelAreaCache[tileZXY[0]+"_"+tileZXY[2]+"_"+py] = pixelArea;
		}
		return pixelArea;
	}
	
	// 以下は表示に関わる関数
	getTileSet(geoVB,level, keyOnly){
		//var keys = Object.keys(this.#quadTreeCompositeTile);
		var ans = {};
		var bl = this.getTileNmber(geoVB.x, geoVB.y, level);
		var tr = this.getTileNmber(geoVB.x+geoVB.width, geoVB.y+geoVB.height, level);
		for ( var ty = tr.ty ; ty <= bl.ty ; ty++){
			for ( var tx = bl.tx ; tx <= tr.tx ; tx++){
				var tk = this.#searchTile(level, tx, ty, level);
				if ( tk ){
					if ( keyOnly ){
						ans[tk]=true;
					} else {
						ans[tk]=this.#quadTreeCompositeTile[tk];
					}
				}
			}
		}
		return ( ans );
	}
	
	#searchTile(level, tx, ty, initialLevel){
		var tkey = this.#getTileKey(tx,ty,level);
		//var tkey = level+"_"+tx+"_"+ty;
		var hasTile, isDataBody;
		if ( this.#quadTreeCompositeTile.tileIndex ){
			var td = this.#quadTreeCompositeTile.tileIndex[tkey];
			if ( td == true ){
				hasTile = true;
				isDataBody = true;
			} else if ( td == false ){
				hasTile = true;
				isDataBody = false;
			} else {
				hasTile = false;
			}
		} else {
			var td = this.#quadTreeCompositeTile[tkey];
			if ( td ){
				hasTile = true;
				if (  td instanceof Array ){
					isDataBody = true;
				} else {
					isDataBody = false;
				}
			} else {
				hasTile = false;
			}
		}
		if ( hasTile ){
			if ( level == initialLevel){
				return ( tkey );
			} else if ( isDataBody ){
				return ( tkey );
			} else {
				return ( null );
			}
		} else {
			if ( level == 0 ){
				return ( null );
			} else {
				return this.#searchTile(level-1, Math.floor(tx/2), Math.floor(ty/2), initialLevel );
			}
		}
	}	
	
	
	
	#getRGBAfromCount(val){
		if ( val > 0xffffffff ){return null };
		var ans = [];
		for ( var s = 24 ; s>=0 ; s -=8){
			ans.push( val >> s & 0xff)
		}
		return ans;
	}
	#getCountFromRGBA(rgba){
		var ans = (rgba[0]<<24) + (rgba[1]<<16) + (rgba[2]<<8) + (rgba[3]);
		return ans;
	}
	
	#getNumberFromColor(srcPixels,srcBase){
		var pv = this.#getCountFromRGBA([srcPixels[srcBase + 0],srcPixels[srcBase + 1],srcPixels[srcBase + 2],srcPixels[srcBase + 3]]);
		return pv;
	}
	
	#setNumberFromColor(numb, srcPixels,srcBase){
		var rgba = this.#getRGBAfromCount(numb);
		srcPixels[srcBase + 0] = rgba[0];
		srcPixels[srcBase + 1] = rgba[1];
		srcPixels[srcBase + 2] = rgba[2];
		srcPixels[srcBase + 3] = rgba[3];
	}
	
	getTileIndex(){
		var idx = {};
		for ( var key in this.#quadTreeCompositeTile){
			if ( key == "tileIndex"){
				continue;
			}
			if (Array.isArray( this.#quadTreeCompositeTile[key])){
				idx[key]=true;
			} else {
				idx[key]=false;
			}
		}
		return idx;
	}
	
	searchTileExp(level, tx, ty, initialLevel){
		return this.#searchTile(level, tx, ty, initialLevel);
	}
	
	#deleteAllData(excludeMergedData){
		for ( var key in this.#quadTreeCompositeTile){
			delete this.#quadTreeCompositeTile[key];
		}
		for ( var key in this.#lowResImages){
			delete this.#lowResImages[key];
		}
		if ( excludeMergedData == true ) {
			// skip #mergedTiledData delete
		} else {
			for ( var key in this.#mergedTiledData){
				delete this.#mergedTiledData[key];
			}
		}
	}
	
	restoreQuadTreeCompositeTileAndLowResImages(){
		console.log("#restoreQuadTreeCompositeTileAndLowResImages:",this.#mergedTiledData);
		// 統計情報ではなく、画像情報が繰り込まれたデータ(#mergedTiledData)から、
		// this.#quadTreeCompositeTileとthis.#lowResImagesを復元する
		this.#deleteAllData(true);
		var keys = Object.keys(this.#mergedTiledData).sort().reverse();
		console.log(keys, this.#mergedTiledData);
		for ( var key of keys ){
			var dat = this.#mergedTiledData[key];
			if ( key.indexOf("_")<0){
				this.#quadTreeCompositeTile[key]=dat;
			}else if ( typeof dat == "string"){ // 画像データが入っていて不正・・
				this.#lowResImages[key]=dat;
				var ck0 = this.#getChildKey(key);
				var pCount=0;
				for ( var subTile of this.#subTiles){
					var ctx = ck0.tx0+subTile[0];
					var cty = ck0.ty0+subTile[1];
					var clevel =  ck0.level;
					var ckey = this.#getTileKey( ctx, cty, clevel );
					var ctile = this.#quadTreeCompositeTile[ckey];
					if ( typeof ctile  == "number"){
						pCount+=ctile;
					} else if ( Array.isArray(ctile)){
						pCount+=ctile.length;
					}
				}
				console.log(key,pCount);
				this.#quadTreeCompositeTile[key]=pCount;
			} else {
				this.#quadTreeCompositeTile[key]=dat;
			}
		}
		console.log("restoreQuadTreeCompositeTileAndLowResImages:dat:",this.#quadTreeCompositeTile," img:",this.#lowResImages);
	}

}

export { ClientSideQTCT };