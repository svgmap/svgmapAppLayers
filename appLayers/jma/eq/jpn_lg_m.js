// 日本の市区町村メッシュに色塗りする感じのSVGMap WebAppレイヤー SVGMapFrame準拠の外部操作APIも備える
// jpn_lg_a.jsのラスター(メッシュ)版
// 
//
// メリット：元データの生成が完全自動
// 小縮尺で小さなエリアがつぶれないかもしれない
// 大縮尺でエリアの境界に隙間や重なりができないかもしれない
//
// Copyright 2022 by Satoru Takagi All Rights Reserved
// Programmed by Satoru Takagi

//
// currentContent グローバル変数：　csvの文字列で、可視化データを入れる
// 可視化データ形式：
// 1行目：スキーマ行、　0桁に　自治体名の場合は"key", 自治体コードの場合は"lgcode"と記述、2桁目以降任意データの名称
// 2行目以降：　スキーマ行と同じ数、でデータを設定。　ダブルクオーテーションによるエスケープは効いてない
//
// currentcolormap

var rootMessage={ // svgMapFrameを使っている。rootMessageにはルートのhtmlから送られてくる情報が入る
	update(){
		console.log("updated jpn_lg_m", this);
		checkUpdate();
	}
}

var currentContent; // csvで　データを入れる col0はKey, col1はVal
				// Key: 自治体5桁コード、漢字自治体名称、(都道府県)(郡支庁振興局)市区町村(区)
				// Val: 下のcurrentcolormap次第の値
var currentcolormap;   // "direct"(#RRGGBB|色の文字列)⇒default | "hue"(青～赤のヒートマップ:値域は自動演算) | "数字"(H値指定で濃淡:値域は自動演算)

function checkUpdate(){
	console.log(rootMessage.textContent,rootMessage.colormap);
	if (currentContent != rootMessage.textContent || currentcolormap != rootMessage.colormap){
		currentContent = rootMessage.textContent;
		currentcolormap = rootMessage.colormap;
		if ( currentContent ){
			drawData();
		}
	}
}




var japanMeshDbName={dbName:"japanMeshDB",tableName:"japanMeshRawData"};

var isReady;
addEventListener("load", function(){
	isReady = initApp();
});

var lgMeshD;// 自治体コード -> 自治体名＆3次メッシュ・ジオコーダオブジェクト
// var lgCoderData;// 自治体名 ->自治体コードジオコードデータ

var parsedData, currentContentSchema; // 元データをパースしたもの
var imagePyramid, geoBounds; // グローバルの変数：生成したImageDataピラミッド、その地理座標の領域、最高解像度のレベル

async function initApp(){
	/**
	if ( typeof(svgMap)=="object"){
		preparePointUIs();
	}
	**/
	if ( typeof(svgMap)=="object" ){
		if ( typeof jpn_lg_m_disable_customShowPoiProperty4index !="undefined" && jpn_lg_m_disable_customShowPoiProperty4index==true ){
			console.log("DISABLE jpn_lg_m's customShowPoiProperty");
		} else {
			svgMap.setShowPoiProperty( customShowPoiProperty, layerID);
		}
	}
	lgMeshD = await lgMesh(japanMeshDbName); 
	//console.log("lgMeshList:",lgMesh.getMeshList());
	
	//lgCoderData = await initLgCodeDB(); // jpn_lg_a.jsではlgDBだったもの lgDBのジオコーダでの利用は廃止する
	
	setTimeout( testVisualize0, 100);
}

function getColorMode(){
	var colorMode = -1;
	var hue0 = -1;
	if ( !currentcolormap || currentcolormap.toLowerCase()=="direct"){
		colorMode = -1;
	} else if ( currentcolormap.toLowerCase()=="hue" ){ // 逆準hue
		colorMode = 0;
		// colorMode:1は省略(正順hue)
	} else if ( Number(currentcolormap) ){ // 色調指定の明度変化
		colorMode = 2;
		hue0 = Number(currentcolormap);
	} // 3は-1と同じ扱いにする(directColorのフォールバックとしての適当配色)
	return ( {mode:colorMode,hue0:hue0});
}
async function drawData(){
	//if ( typeof(svgMap)!="object" ){ return }
	
	await isReady; // 3次メッシュDB初期化完了まで待つ
	
	var lines = currentContent.split("\n");
	var datas=[];
	var dataStartLine = 0;
	var lgCodedData = false;
	var colorMode = getColorMode();
	if ( lines[0].trim().toLowerCase().startsWith("key") || lines[0].trim().toLowerCase().startsWith("lgcode") ){
		if (  lines[0].trim().toLowerCase().startsWith("lgcode") ){
			lgCodedData = true;
		}
		dataStartLine = 1;
		currentContentSchema = lines[0].trim().split(",");
		for ( var i = 0 ; i < currentContentSchema.length ; i++){
			currentContentSchema[i]=currentContentSchema[i].trim();
		}
	}
	var minval=1e99, maxval=-1e99;
	for ( var i = dataStartLine ; i < lines.length ; i++ ){
		var line = lines[i].trim();
		if ( line ==""){
			continue;
		}
		var cols = line.split(",");
		var rd = [];
		var meta=[];
		var colorSrcVal;
		var keys=[];
		for ( var j = 0 ; j < cols.length ; j++ ){
			var col = cols[j].trim();
			if ( j==0){ // Keyカラムは0番に固定する
				//meta.push(col);
				
				/** 別のデータをつかうのはやめた・・・
				var key = getLgCodes(col, lgCoderData); // 自治体コード
//				var key = [col];
				if ( key && key.length==1){
					key = key[0];
				} else {
					console.warn("LG key: ",col," not found skip.");
					key = null;
				}
				**/
				var lgCodes;
				if ( lgCodedData ){
					lgCodes = [col.trim()];
				} else {
					lgCodes = lgMeshD.geoCode(col); // 自治体3次メッシュデータを使ったジオコード
				}
				//console.log("geoCode: key:",col,"  ans:",lgCodes);
				if ( lgCodes.length > 0 ){
					for ( var lgCode of lgCodes){
						keys.push(lgCode.code);
					}
				} else {
					console.warn("Not resolved. query:" ,col, "  result:",lgCode);
					continue;
				}
				
			} else if ( j==1){ // valが1番固定 
				colorSrcVal=col; // 色のためのデータ（もしくは色そのもの(#xxxxxx)でもいいようにしたい）
				if ( colorMode.mode >=0){
					colorSrcVal = Number(colorSrcVal);
					minval = Math.min(colorSrcVal, minval);
					maxval = Math.max(colorSrcVal, maxval);
				}
			} else {
				meta.push(col);
			}
		}
		if ( meta.length >0){
			meta = meta.join(",");
		} else {
			meta=null;
		}
		//if ( keys.length == 0 ){continue};
		for ( var key of keys ){
			datas.push([key,colorSrcVal,meta]);
		}
	}
	console.log("datas:",datas );
	for ( var data of datas ){
		var colorSrcVal = data[1];
		data[1] = getColor(colorSrcVal, colorMode.mode, minval,maxval,colorMode.hue0,true);
	}
	if ( datas.length ==0){
		console.warn("No resolved data. exit...."); // 表示をやめる処理がないのが問題
		imagePyramid=null;
		var imgg=svgImage.getElementById("imgg");
		removeChildren(imgg);
	} else {
		parsedData = datas;
		generateMeshData(datas);
	}
	if ( typeof(svgMap)=="object"){ 
		preRenderFunction();
		svgMap.refreshScreen();
	}
}


function generateMeshData(datas){
	//console.log("generateMeshData:",datas);
	var testData={};
	var areaBound={xMin:9e99,xMax:-9e99,yMin:9e99,yMax:-9e99};
	var lgMeshList = lgMeshD.getMeshList();
	//console.log("lgMeshList:",lgMeshList);
	for ( var data of datas){
		if ( data.length <2){continue}
		var lgCode = data[0];
//		var color = stringToColour2(data[1],true);
		var color = data[1];
		//console.log(color,data,lgCode,lgMeshList[lgCode]);
		for ( var meshCode of lgMeshList[lgCode].mesh){
			//meshCode = meshCode.substring(0,6);
			testData[meshCode]=color; // 上書き・・・　小さいエリアがつぶれるので何とかしないとならないはず
			var mxy = mesh2GridPix(meshCode);
			updateBound(mxy, areaBound);
		}
	}
	buildBBox(areaBound);
	console.log(areaBound,Object.keys(testData).length);
	imagePyramid = createImageData(testData,areaBound);
	var meshLevel = lgMeshD.getMeshLevel();
	geoBounds = getGeoBounds(areaBound,meshLevel);
	console.log( "geoBounds:",geoBounds);
	//testMeshImage(imagePyramid);
}

function testMeshImage(imagePyramid){
	// テストコード
	var actualImageWidth=400;
	removeChildren(document.getElementById("testDiv"));
	for ( var imgd of imagePyramid){
		var clipArea;
		//	clipArea={x:1000,y:1000,width:300,height:300};
		// meshBboxの必要な情報はviewImageから取れる
		var uri = getImageURI(imgd,clipArea);
		var img=document.createElement("img");
		img.style.imageRendering="pixelated";
		img.width=actualImageWidth;
		img.height=Math.floor(imgd.height/imgd.width*actualImageWidth);
		img.src=uri;
		document.getElementById("testDiv").appendChild(img);
	}
}

function getGeoBounds(areaBound, meshLevel){
	//console.log("getGeoBounds:",areaBound,meshLevel);
	
	var x = meshOrigin.lng + areaBound.x * meshSpan.lng[meshLevel-1];
	var y = meshOrigin.lat + areaBound.y * meshSpan.lat[meshLevel-1];
	var width = areaBound.width * meshSpan.lng[meshLevel-1];
	var height = areaBound.height * meshSpan.lat[meshLevel-1];
	
	return {
		x: x,
		y: y,
		width: width,
		height: height
	}
}

function updateBound(mxy, areaBound){
	areaBound.xMin=Math.min(mxy.x, areaBound.xMin);
	areaBound.xMax=Math.max(mxy.x, areaBound.xMax);
	areaBound.yMin=Math.min(mxy.y, areaBound.yMin);
	areaBound.yMax=Math.max(mxy.y, areaBound.yMax);
}
function buildBBox(areaBound){
	areaBound.x = areaBound.xMin;
	areaBound.y = areaBound.yMin;
	areaBound.width = areaBound.xMax-areaBound.xMin+1;
	areaBound.height = areaBound.yMax-areaBound.yMin+1;
}

//地域基準メッシュコードからビットイメージを生成する
function createImageData(meshData,meshBbox){
	var level=0;
	var viewImage = new ImageData(meshBbox.width, meshBbox.height);
	var tilePixels = viewImage.data;
	for ( meshCode in meshData ){
		mxy = mesh2GridPix(meshCode);
		var color=meshData[meshCode];
		if ( !level){
			level = mxy.level;
		} else if ( level!= mxy.level){
			console.warn("mesh level is inconsistent exit..");
			return;
		}
		px = mxy.x - meshBbox.x;
		py = meshBbox.height - (mxy.y - meshBbox.y)-1;
		if ( px >=0 && px < meshBbox.width && py >=0 && py < meshBbox.height){
			var baseSub = (py * meshBbox.width + px) * 4;
			tilePixels[baseSub + 0] = color[0];
			tilePixels[baseSub + 1] = color[1];
			tilePixels[baseSub + 2] = color[2];
			tilePixels[baseSub + 3] = 255;
		}
	}
	
	var imagePyramid = downsample(viewImage);
	console.log("imagePyramid:",imagePyramid); // nullになるケースある・・
	return(imagePyramid);
}

function downsample(imageData,ans){
	var w = Math.round(imageData.width / 2); // roundでないと、大きいほうの隅が切れるので・・・
	var h = Math.round(imageData.height / 2);
	if ( w < 50 || h < 50){
		return([imageData]);
	}
	var pix =0;
	var pImage = imageData.data;
	var dsImageData = new ImageData(w, h);
	var dsImage=dsImageData.data;
	for ( var py = 0 ; py<imageData.height ; py++){
		for ( var px = 0 ; px<imageData.width ; px++){
			var baseSrc = (py * imageData.width + px) * 4;
			var baseDs = (Math.floor(py/2)*dsImageData.width + Math.floor(px/2)) * 4;
			if ( pImage[baseSrc+3]==255){
				/**
				if ( px == imageData.width-1  ){
					console.log("XE x:",dsImageData.width,Math.floor(px/2),"  y:",dsImageData.height,Math.floor(py/2));
				}
				if (  py == imageData.height-1 ){
					console.log("YE x:",dsImageData.width,Math.floor(px/2),"  y:",dsImageData.height,Math.floor(py/2));
				}
				**/
				//console.log(pImage[baseSrc+0],pImage[baseSrc+1],pImage[baseSrc+2],pImage[baseSrc+3]);
				dsImage[baseDs+0] = pImage[baseSrc+0];
				dsImage[baseDs+1] = pImage[baseSrc+1];
				dsImage[baseDs+2] = pImage[baseSrc+2];
				dsImage[baseDs+3] = pImage[baseSrc+3];
				++pix;
			}
		}
	}
	//console.log("painted pix:",pix," dsImage:",dsImage," dsImageData:",dsImageData);
	if ( !ans ){
		ans = [imageData, dsImageData];
	} else {
		ans.push(dsImageData);
	}
	
	downsample(dsImageData, ans );
	
	
	return ( ans );
}


function getImageURI(imageData,clipArea){
	
	if (!clipArea){
		clipArea={
			x:0,
			y:0,
			width:imageData.width,
			height:imageData.height
		}
	}
	
	var canvas =document.createElement("canvas");
	//console.log("size:",imageData.width,imageData.height);
	canvas.width=clipArea.width;
	canvas.height=clipArea.height;
//	canvas.width=size.width;
//	canvas.height=size.height;
	var canvasContext = canvas.getContext('2d');
//	canvasContext.putImageData(imageData, 0, 0);
	canvasContext.putImageData(imageData, -clipArea.x, -clipArea.y);
	var uri = canvas.toDataURL('image/png');
	return ( uri );
}

function getImageClipBox(geoViewBox,geoDataBound,imageDataSize){
	// imageDataサイズで正規化した座標
	var meshLevel = lgMeshD.getMeshLevel();
	geoViewBox.width += meshSpan.lng[meshLevel-1];
	geoViewBox.height += meshSpan.lat[meshLevel-1];
	var nx0 = (geoViewBox.x - geoDataBound.x)/geoDataBound.width;
	var ny0 = (geoViewBox.y - geoDataBound.y)/geoDataBound.height;
	var nw = geoViewBox.width / geoDataBound.width;
	var nh = geoViewBox.height / geoDataBound.height;
	var nx1 = nx0 + nw;
	var ny1 = ny0 + nh;
	
	if ( nx0 < 0 ){nx0 = 0}
	if ( ny0 < 0 ){ny0 = 0}
	if ( nx1 > 1 ){nx1 = 1}
	if ( ny1 > 1 ){ny1 = 1}
	
	//console.log("img w,h:",imageDataSize.width,imageDataSize.height,"  nx0,1:",nx0,nx1,"  ny0,1:",ny0,ny1);
	
	var ix0 = Math.floor(nx0 * imageDataSize.width); // 左隅
	var ix1 = Math.floor(nx1 * imageDataSize.width); // 右隅
	var iy0 = Math.floor((ny0) * imageDataSize.height); // 下隅　座標軸は下からのピクセル座標とする
	var iy1 = Math.floor((ny1) * imageDataSize.height); // 上隅　同
	
	var geoClipBox={
		x:geoDataBound.x + geoDataBound.width * (ix0 / imageDataSize.width),
		y:geoDataBound.y + geoDataBound.height * (iy0 / imageDataSize.height),
		width: geoDataBound.width * (ix1-ix0) / imageDataSize.width,
		height: geoDataBound.height * (iy1-iy0) / imageDataSize.height
	}
	//console.log("geoClipBox:",geoClipBox);
	var ans = {
		x: ix0,
		y:imageDataSize.height - iy1,
		width: ix1-ix0,
		height: iy1-iy0,
		geo:geoClipBox,
	}
	
	return ( ans );
}

function removeChildren(elm){
	while( elm.firstChild ){
	  elm.removeChild( elm.firstChild );
	}
}

function selectImage(level,imagePyramid){
	// level6: mesh3 original
	var maxDepth = imagePyramid.length-1;
	var ans = 6-level;
	if ( ans <0){ans = 0}
	if ( ans >maxDepth){ans = maxDepth}
	console.log("selectImage: depth:",ans);
	return(imagePyramid[ans]);
}

function preRenderFunction(){
	if ( !imagePyramid){return}
	console.log("preRenderFunction:");
	var level = Math.floor( Math.LOG2E * Math.log(svgImageProps.scale) + 5.0);
	var gvb = svgMap.getGeoViewBox();
	//console.log("geoVB:", gvb,"  level:",level);
	
	var meshImageData = selectImage(level,imagePyramid);
	var imgBox = getImageClipBox(gvb,geoBounds,meshImageData);
	console.log("imgBox:",imgBox);
	var uri = getImageURI(meshImageData,imgBox);
	
	var imgg=svgImage.getElementById("imgg");
	removeChildren(imgg);
	var img=svgImage.createElement("image");
	img.setAttribute("xlink:href",uri);
	img.setAttribute("x",imgBox.geo.x*100);
	img.setAttribute("y",-(imgBox.geo.y+imgBox.geo.height)*100);
	img.setAttribute("width",imgBox.geo.width*100);
	img.setAttribute("height",imgBox.geo.height*100);
	img.setAttribute("style","image-rendering:pixelated");
	img.setAttribute("content","testMeta0,testMeta1");
	imgg.appendChild(img);
	/**
	removeChildren(document.getElementById("testDiv"));
	var himg=document.createElement("img");
	himg.style.imageRendering="pixelated";
	himg.width=500;
	himg.height=500;
	himg.src=uri;
	document.getElementById("testDiv").appendChild(himg);
	**/
}


/**
// クリックに対するインタラクティビティの実装
// メッシュデータのクエリ機能 2020/4/12
var poiUI1;
function preparePointUIs(){
	poiUI1=document.getElementById("poiUI");
	var getPointOnly = true;
	if ( typeof(svgMapAuthoringTool)=="object" ){
		svgMapAuthoringTool.initPOIregistTool(poiUI1,svgImageProps.rootLayer,"poi1","p1","title","",poiCbFunc,"poi1",getPointOnly);
	// poiUI1.getElementsByTagName("input")[1].click(); // ボタンを押さなくても地図上クリックで表示させるようにするものだが、これは筋が悪い。フレームワーク側の拡張を行うのが筋なので凍結
	}
}
function poiCbFunc(stat,param){
	if ( !imagePyramid ){return}
	var latlngs1=getCrds(poiUI1.getElementsByTagName("input")[2].value);
	
//	var mesh6 = latLng2Mesh(latlngs1.lat,latlngs1.lng, 6);
	console.log("poiCbFunc:",latlngs1," stat:",stat);
	if (stat=="Cancel"){return}
	showMetadata(latlngs1);
}

function getCrds( inputStr ){
	var latlngs = inputStr.split(",");
	var lat,lng;
	if ( latlngs.length == 2 ){
		lat = Number(latlngs[0]);
		lng = Number(latlngs[1]);
		if ( isNaN(lat) || isNaN(lng) ){
			return ( null );
		}
	}
	return {
		y : lat,
		x : lng
	}
}

function showMetadata(geoPos){
	if ( !imagePyramid ){return}
	if ( !parsedData){return}
	var ans = testMetadata(geoPos);
	console.log("geoPos:",geoPos, " ans:",ans);
	customShowPoiProperty(ans);
}
**/
function testMetadata(geoPos){
	if ( !imagePyramid ){return}
	if ( !parsedData){return}
	// 緯度経度からメッシュデータを検索、ダイアログに表示
	var ans=lgMeshD.searchPos(geoPos);
	console.log("searchPos:",ans);
	for ( var lgCode in ans){
		for ( var data of parsedData){
			if (lgCode == data[0]){
				if ( !ans[lgCode].data){
					ans[lgCode].data=[];
				}
				ans[lgCode].data.push(data);
			}
		}
	}
	return ( ans );
}

var showAllHit=false;

function customShowPoiProperty(ans){
	console.log("customShowPoiProperty: ans:",ans);
	var hti;
	if ( ans.getAttribute && ans.getAttribute("data-hitTestIndex")){
		hti = ans.getAttribute("data-hitTestIndex");
	}
	if (!hti ){
		console.log("This data is not for jpn_lg_m");
		if ( typeof(altShowPoiProperty)=="function"){
			altShowPoiProperty(ans);
		}
		return;
	}
	var hitMetaIndex = Number(hti);
	
	console.log("customShowPoiProperty: idx:", hitMetaIndex,ans.getAttribute("data-hitTestIndex"),"  meta:",customHitTestAns[hitMetaIndex],"  ans:",customHitTestAns);
	
	if ( !hitMetaIndex ){
	}
	var ha=customHitTestAns[hitMetaIndex];
	
	var message="<table>";
	
	var name = ha[4];
	name = (name).substring(name.indexOf(",")).replaceAll(",","");
	var lgCode = ha[3];
	
	message+=`<tr bgcolor="#cccccc"><td>自治体名</td><td >${name} <span style="font-size:10px">(コード:${lgCode})</span></td></tr>`;
	if (  ha[2] ){
		var metas = ha[2].split(",");
		var j=0;
		for ( var meta of metas){
			var js = j;
			if ( currentContentSchema ){
				js = currentContentSchema[2+j];
			}
			if ( meta.startsWith("http://") || meta.startsWith("https://")){
				meta = `<a href="${meta}" target="jpn_lg_metaLink">${meta}</a>`;
			}
			message+=`<tr ><td>${js}</td><td>${meta}</td></tr>`;
			++j;
		}
	}
	message+="</table>";
	svgMap.showModal(message,400,600);
//	svgMap.setCustomModal(message);
}

var customHitTestAns;

function customHitTester(pos){ // hitTestHookerが実装されたSVGMap.jsで有効になる 2022/05
	if ( !imagePyramid ){return}
	var testRes = testMetadata({x:pos.lng,y:pos.lat});
	console.log("HitTest:",pos," testResult:",testRes);
	var ans = [];
	var hasAns = false;
	customHitTestAns = [];
	if ( !testRes ||  Object.keys(testRes).length==0){
		return ( null );
	} else {
		for ( var key in testRes){
			if ( testRes[key].data){
				hasAns = true;
				var lgName = (testRes[key].name);
				lgName = lgName.substring(lgName.indexOf(","));
				lgName = lgName.replaceAll(",","");
				for ( var aval of  testRes[key].data){
					// カスタムヒットテストの結果を文字列の配列にする（ことで、Tickerに選択肢が出せる)
//					ans.push( aval[2].split(",")[0] + "/" + lgName);
					console.log(aval);
					if ( aval[2]!=null){
						ans.push( aval[2].split(",")[0] + "/" + key);
					} else {
						ans.push(key);
					}
					aval.push(key);
					aval.push(lgName);
					customHitTestAns.push(aval);
				}
			}
		}
	}
	if ( hasAns ){
		console.log("customHitTester ans:",ans);
		return(ans);
	} else {
		return ( null );
	}
}

function customHitTesterSingle(pos){ // 一個しか返答しないタイプのカスタムヒットテスト(Obsoluted)
	var ans = testMetadata({x:pos.lng,y:pos.lat});
	console.log("HitTest:",pos," ans:",ans);
	
	if ( !ans ||  Object.keys(ans).length==0){
		customHitTestAns = null;
		return ( null );
	} else {
		for ( var key in ans){
			if ( ans[key].data){
				customHitTestAns = ans;
				return ( ans[key].data[0][2].split(",")[0]);
			}
		}
		customHitTestAns = null;
		return ( null );
	}
}

// testFunc 日本の全自治体を可視化する
function testVisualize0(){
	if (currentContent !=undefined) {return}
	var datas="key,color,メタデータ\n";
	var lgMeshList = lgMeshD.getMeshList();
	for ( var lgCode in lgMeshList){
		var lgName = lgMeshList[lgCode].name;
		datas+=`${lgCode},${lgName.replaceAll(",","")},-\n`;
	}
	//console.log(datas);
	currentContent=datas;
	drawData();
}

