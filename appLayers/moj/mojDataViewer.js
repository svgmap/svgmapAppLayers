// mojDataViewer
// test.htmlの内容を汎用化してモジュール分離
//
// Programmed by Satoru Takagi
// 
// License: (MPL v2)
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.
//
// 2023/4/24 Programmed by Satoru Takagi

import {MojMapGML2GeoJSON} from "./MojMapGML2GeoJSON.js";
import {getMOJindex, getDistribution} from "./getMOJindex.js";

// ZIPファイルの読み込みライブラリ
import {ZipDataDownloader} from "./ZipDataDownloader.js";

var mapDir="testdata/";

var indexData, gobj;
/**
window.onload=async function(){
	initUI();
	indexData = await getMOJindex(mapDir+"13102-0100-search-list.csv");
	console.log("indexData:",indexData);
	if (  typeof svgMapGIStool == "object" && window.layerID){
		drawIndexData(indexData.roughIndex);
		window.svgMap.refreshScreen();
	} else {
		showMojMap("13101-0100-28.zip");
	}
	openImageBtn.addEventListener("click" , openBitImagePanel);
	window.addEventListener("message", receiveMessage, false);
	window.addEventListener("closeFrame ",closeProcess,false);
	window.setPoint = setPoint;
}
**/

function initEvent(openImageBtn){
	window.setPoint = setPoint;
	window.addEventListener("message", receiveMessage, false);
	window.addEventListener("closeFrame ",closeProcess,false);
	openImageBtn.addEventListener("click" , openBitImagePanel);
}

function sleep(ms){return new Promise(function(cbf){setTimeout(cbf,ms)})}

async function showMojMap(zipFileName){
	var path;
	if ( zipFileName.startsWith("http://") || zipFileName.startsWith("https://") ){
		path = zipFileName;
	} else {
		path = mapDir + zipFileName;
	}
	messageDiv.innerText=path +"読み込み中";
	var r=await ZipDataDownloader.download(path,{});
	await sleep(20);
	messageDiv.innerText=path +"パース中";
	var xml = new DOMParser().parseFromString(r[0].content, "text/xml");
	await sleep(20);
	// var xml = await readXML("testdata/13101-0100-28.xml");
	messageDiv.innerText=path +"geojson変換中";
	gobj = MojMapGML2GeoJSON.convert(xml);
	await sleep(20);
	console.log(gobj);
	
	initAlignmentPoints();
	drawAlignmentPoints();

	if (  typeof svgMapGIStool == "object" && window.layerID){
		removeChildren(window.svgImage.getElementById("poig"));
		removeChildren(svgImage.getElementById("distg"));
		console.log("gobj:",gobj);
		if ( gobj.properties["座標系"].indexOf("任意")==0){
			messageDiv.innerText=path + "は任意座標系のデータでした。";
			showDistribution(zipFileName);
			
			//showCadImage(gobj);
			flipGobj(); // フリップが基本
			
		} else {
			messageDiv.innerText=`表示データ：${path}`;
			console.log(gobj.geoObjects.筆);
			showMap(gobj.geoObjects.筆);
		}
	}
}

async function showDistribution(zipfn){
	zipfn=zipfn.substring(zipfn.lastIndexOf("/")+1);
	console.log(zipfn,indexData);
	var dat = await getDistribution(indexData.fullIndex[zipfn]);
	console.log("Distribution:",dat);
	var distg = svgImage.getElementById("distg");
	for ( var poi of dat ){
		var use =svgImage.createElement("use");
		use.setAttribute("transform",`ref(svg,${poi[7]*100},${poi[6]*(-100)})`);
		use.setAttribute("x",0);
		use.setAttribute("y",0);
		use.setAttribute("xlink:href","#p2");
		use.setAttribute("content", poi.join(","));
		distg.appendChild(use);
	}
	window.svgMap.refreshScreen();
}

function initUI(){
	console.log("initUI:",layerID);
	svgMap.setShowPoiProperty( customShowPoiProperty, layerID);
	
}

function customShowPoiProperty(target){
	var metaSchema = target.ownerDocument.firstChild.getAttribute("property").split(",");
	var metaData = svgMap.parseEscapedCsvLine(target.getAttribute("content"));
	console.log(metaSchema , metaData  );
	if ( metaData[0].indexOf("zip")>0){
		console.log("show map : ",metaData[0]);
		showMojMap(metaData[0]);
	} else if ( metaSchema.length == metaData.length){
		var i=0;
		var message = `<table border="1">`;
		for ( var val of metaData){
			var name = metaSchema[i];
			if ( val ){
				message+=`<tr><td>${name}</td><td>${val}</td></tr>`;
			}
			++i;
		}
		message+=`</table>`
		svgMap.showModal(message,400,600);
	} else {
		var message = `${metaSchema}<br>${metaData}`;
		svgMap.showModal(message,400,600);
	}
}


function drawIndexData(indexDataInp){
	indexData = indexDataInp;
	var dat = indexData.roughIndex;
	var indexg = svgImage.getElementById("indexg");
	removeChildren(indexg);
	for ( var poi of dat ){
		var use =svgImage.createElement("use");
		use.setAttribute("transform",`ref(svg,${poi[5]*100},${poi[4]*(-100)})`);
		use.setAttribute("x",0);
		use.setAttribute("y",0);
		use.setAttribute("xlink:href","#indexPoi");
		use.setAttribute("content", poi.join(","));
		indexg.appendChild(use);
	}
}

async function readXML(path){
	var res = await fetch(path);
	var str = await res.text();
	var xml = new DOMParser().parseFromString(str, "text/xml");
	return ( xml );
}


function showMap(geojs){
	console.log("draw svgmap ");
	var poig = window.svgImage.getElementById("poig");
	removeChildren(poig);
	var mapmeta = geojs.properties;
	delete geojs.properties;
	var schema = window.generateMetaSchema(geojs);
	geojs.properties={stroke:"brown","stroke-width":1}
	/**
	var schema = window.generateMetaSchema(geojs.features[3].features);
	schema = schema.concat(window.generateMetaSchema(geojs.features[2].features));
	schema = schema.concat(window.generateMetaSchema(geojs.features[0].features));
	**/
	console.log("schema:",schema, "geojson:",geojs);
	window.setMetaProp( schema, window.svgImage, {});
	window.svgMapGIStool.drawGeoJson(geojs, window.layerID,"blue",1,"pink","p0",undefined,undefined,poig,schema);
	/**
	window.svgMapGIStool.drawGeoJson(geojs.features[3], window.layerID,"blue",1,"pink","p0",undefined,undefined,poig,schema);
	window.svgMapGIStool.drawGeoJson(geojs.features[2], window.layerID,"blue",1,"pink","p0",undefined,undefined,poig,schema);
	window.svgMapGIStool.drawGeoJson(geojs.features[0], window.layerID,"blue",1,"pink","p0",undefined,undefined,poig,schema);
	**/
	//svgMapGIStool.drawGeoJson(geojs,layerID);
	window.svgMap.refreshScreen();
}

function removeChildren(element){
	while (element.firstChild) element.removeChild(element.firstChild);
}

var bitImagePanel , bitImagePanelReady, drawDataQueue;

function showCadImage(gobj){
	var schema = window.generateMetaSchema(gobj.geoObjects.筆);
	gobj.geoObjects.筆.properties=gobj.properties;
	gobj.geoObjects.筆.properties["stroke"]="brown";
	gobj.geoObjects.筆.properties["stroke-width"]=1;
	console.log("schema:",schema,"  geojs:",gobj.geoObjects.筆);
	if ( bitImagePanelReady ){
		sendDrawData({geojson:gobj.geoObjects.筆,schema});
	} else {
		drawDataQueue = {geojson:gobj.geoObjects.筆,schema};
		openBitImagePanel();
	}
}

function sendDrawData(mapData){
	if ( !mapData){
		if (drawDataQueue){
			mapData = drawDataQueue;
		} else {
			console.warn("今のところ描画すべきデータがないので終了します");
			return;
		}
	}
	drawDataQueue = null;
	bitImagePanel.postMessage(mapData,"*");	
//	bitImagePanel.postMessage({geojson:gobj.geoObjects.筆},"*");	
}

function openBitImagePanel(){
	console.log("openBitImagePanel",bitImagePanel);
	if ( (bitImagePanel && bitImagePanelReady) ){
		// panelもあるし、ready状態なら処理不要
		console.log("already opened : ", bitImagePanel, bitImagePanelReady);
		return;
	}
	if (bitImagePanel && !bitImagePanelReady ){
		// panelはあるが、Ready状態でないときも多分現在初期化中なので処理せず
		console.log("Now initializing");
		return;
	}
	
	bitImagePanel = window.open('./bitimagePanel.html','sub','width=800,height=600');
	
}

function receiveMessage(msg){
	console.log(msg.data);
	if(msg.data=="ready"){
		bitImagePanelReady = true;
		//bitImagePanel.postMessage({table:[1,3,4],msg:"Hello"},"*");	
		sendDrawData();
	} else if(msg.data=="closed"){
		bitImagePanel=null;
		bitImagePanelReady=false;
	} else if (msg.data.imagePoint1){
		alignmentPoints[0].image=msg.data.imagePoint1;
	} else if (msg.data.imagePoint2){
		alignmentPoints[1].image=msg.data.imagePoint2;
	} else if (msg.data=="flip"){
		flipGobj();
	}
	printAlignmentPointsAndMap();
}

var alignmentPoints;

function initAlignmentPoints(){
	alignmentPoints=[
		{image:null,geo:null},
		{image:null,geo:null},
	];
	document.getElementById("point1t").innerText="";
	document.getElementById("point2t").innerText="";
}
function closeProcess(msg){
	bitImagePanel.postMessage("closed","*");
}



function setPoint(n){
	var pointg = svgMap.getCentralGeoCoorinates();
	var geoCrd ={x: pointg.lng, y: pointg.lat};
	console.log("setPoint:",n,pointg,geoCrd);
	if ( n==1){
		alignmentPoints[0].geo=geoCrd;
		document.getElementById("point1t").innerText=[geoCrd.x,geoCrd.y];
	} else {
		alignmentPoints[1].geo=geoCrd;
		document.getElementById("point2t").innerText=[geoCrd.x,geoCrd.y];
	}
	printAlignmentPointsAndMap();
}

function flipGobj(){
	if ( !gobj){return}
	for ( var tname in gobj.geoObjects){
		gobj.geoObjects[tname] = flipJS(gobj.geoObjects[tname]);
	}
	var miny = -gobj.properties.bbox.maxy;
	var maxy = -gobj.properties.bbox.miny;
	gobj.properties.bbox.miny=miny;
	gobj.properties.bbox.maxy=maxy;
	
	console.log("Filpped gobj:",gobj);
	showCadImage(gobj);
}

function flipJS(js){
	var ans = getTransformedGeoJS(js, [1,0,0,-1,0,0])
	return ans;
}


function getTransformedGeoJS(js, tf){
	var tfa;
	if ( tf.a){
		tfa = [tf.a, tf.b, tf.c, tf.d, tf.e, tf.f];
	} else {
		tfa = tf;
	}
	var deepCopy = JSON.parse(JSON.stringify(js));
	transformJS(deepCopy, tfa)
	return ( deepCopy );
}

function transformJS(js, tf){
	if ( Array.isArray(js)){
		for ( var c of js ){
			transformJS(c, tf);
		}
	} else {
		for ( var k in js){
			if ( k=="coordinates"){
				var crds = js[k];
				transformCrds(crds, tf);
			} else if ( k=="features" || k=="geometry" ){
				transformJS(js[k], tf);
			}
		}
	}
}

function transformCrds(crds, tf){
	if ( crds.length == 2 && typeof (crds[0])=="number"){
		var x= tf[0] * crds[0] + tf[2] * crds[1] + tf[4];
		var y= tf[1] * crds[0] + tf[3] * crds[1] + tf[5];
		crds[0]=x;
		crds[1]=y;
		//console.log(crds);
	} else {
		for ( var scrds of crds){
			transformCrds(scrds, tf);
		}
	}
}

function printAlignmentPointsAndMap(){
	drawAlignmentPoints();
	if ( alignmentPoints[0].image && alignmentPoints[0].geo && alignmentPoints[1].image && alignmentPoints[1].geo ){
		var T = getTransform();
		console.log( "TransformMatrix:" , T );
		var tgj = getTransformedGeoJS(gobj.geoObjects.筆, T);
		console.log("transformedGeoJSO:",tgj);
		showMap(tgj);
	} else {
		window.svgMap.refreshScreen();
	}
}

function drawAlignmentPoints(){
	console.log("alignmentPoints:",alignmentPoints);
	var apg = svgImage.getElementById("aping");
	removeChildren(apg);
	if ( alignmentPoints[0].geo){
		setPin(0,apg);
	}
	if ( alignmentPoints[1].geo){
		setPin(1,apg);
	}
}

function setPin(n,apg){
	var pin = svgImage.createElement("use");
	pin.setAttribute("x",0);
	pin.setAttribute("y",0);
	pin.setAttribute("xlink:href",`#ap${n+1}`);
	pin.setAttribute("xlink:title",`基準点${n+1}`);
	pin.setAttribute("transform",`ref(svg,${alignmentPoints[n].geo.x*100},${-alignmentPoints[n].geo.y*100})`);
	apg.appendChild(pin);
}

function setMarker( numb , point ){ // 2023/5/2 作業中
	var uses = svgImage.getElementsByTagName("use");
	var use;
	for ( var i = 0 ; i < uses.length ; i++ ){
		if ( uses[i].getAttribute("xlink:title")==("point"+numb)){
			use = uses[i];
			break;
		}
	}
//	console.log(use.getAttribute("transform"),use.getAttribute("xlink:title"));
	use.setAttribute("transform", "ref(svg,"+point.x+","+point.y+")");
}


function getTransform(){
	// 回転と原点だけ決める
	// XYは歪んでいないと仮定（これはたぶん正しい）
	// 縮尺はメートルで正しく記載されていると仮定しているが・・どうだろう
	// 狭い領域なので、地図の図法(正距円筒やメルカトル)による歪みはないと仮定
	
	// 図面のほうの２アライメントポイントからベクトルをつくる
	var vi = {
		x: alignmentPoints[1].image.x - alignmentPoints[0].image.x,
		y: alignmentPoints[1].image.y - alignmentPoints[0].image.y
	}
	
	// 地図のほうの２アライメントポイントからXY系上のベクトルをつくる
	var cosG0 = Math.cos( alignmentPoints[0].geo.y * Math.PI / 180); // 緯度経度->XY
	var vg = {
		x: ( alignmentPoints[1].geo.x - alignmentPoints[0].geo.x) * cosG0 ,
		y: alignmentPoints[1].geo.y - alignmentPoints[0].geo.y
	}
	
	
	// 内積公式より
	var cosT = (vi.x * vg.x + vi.y * vg.y)  / ( Math.sqrt(vi.x * vi.x + vi.y * vi.y) * Math.sqrt(vg.x * vg.x + vg.y * vg.y));
	// 外積公式より
	var sinT = (vi.x * vg.y - vi.y * vg.x)  / ( Math.sqrt(vi.x * vi.x + vi.y * vi.y) * Math.sqrt(vg.x * vg.x + vg.y * vg.y));
	
	var m2d= 360 / 40000000; // これを変数化する
	
	var m2dn = cosG0 * (alignmentPoints[1].geo.x - alignmentPoints[0].geo.x)/(cosT * (alignmentPoints[1].image.x - alignmentPoints[0].image.x) - sinT * (alignmentPoints[1].image.y - alignmentPoints[0].image.y));
	var m2do = (alignmentPoints[1].geo.y - alignmentPoints[0].geo.y)/(sinT * (alignmentPoints[1].image.x - alignmentPoints[0].image.x) + cosT * (alignmentPoints[1].image.y - alignmentPoints[0].image.y));
	
	m2d = m2dn;
	
	console.log("m2d,m2dn,m2do:",m2d,m2dn,m2do);
	
	var M = [m2d / cosG0 , 0 , 0 , m2d];
	var R = [cosT, sinT, -sinT, cosT];
	var MR = matMul(M,R);
	var s1 = transform(MR, [alignmentPoints[0].image.x , alignmentPoints[0].image.y]);
	// console.log("s1:",s1);
	var s2 = [alignmentPoints[0].geo.x , alignmentPoints[0].geo.y];
	var sx = -s1[0]+s2[0];
	var sy = -s1[1]+s2[1];
	MR.push(sx);
	MR.push(sy);
	console.log("TESTP0:",[alignmentPoints[0].image.x , alignmentPoints[0].image.y],transform(MR,[alignmentPoints[0].image.x , alignmentPoints[0].image.y]),[alignmentPoints[0].geo.x , alignmentPoints[0].geo.y]);
	console.log("TESTP1:",[alignmentPoints[1].image.x , alignmentPoints[1].image.y],transform(MR,[alignmentPoints[1].image.x , alignmentPoints[1].image.y]),[alignmentPoints[1].geo.x , alignmentPoints[1].geo.y]);
	return ( MR);
}

function matMul(A,B){
	var ans=[
		A[0]*B[0] + A[2]*B[1],
		A[1]*B[0] + A[3]*B[1],
		A[0]*B[2] + A[2]*B[3],
		A[1]*B[2] + A[3]*B[3]
	];
	return ans;
}

function transform(T,v){
	var t4 = 0;
	var t5 = 0;
	if ( T.length==6){
		t4 = T[4];
		t5 = T[5];
	}
	var ans = [
		T[0]*v[0]+T[2]*v[1]+t4,
		T[1]*v[0]+T[3]*v[1]+t5
	];
	return ans;
}

export {getMOJindex, drawIndexData, showMojMap, openBitImagePanel, initEvent, removeChildren};