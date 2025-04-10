//
// Description:
// Bitimage2GeoInfo
//  The Primitive tool to change the maps of the picture on the Web into geospatial information
//  Based on SVG Map Level0.1 polyfill
//
// Programmed by Satoru Takagi
// 
// License: (MPL v2)
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.
//
// Version History:
//   2014.6.14 : The 1st version.
//   2014.6.17 : Add publish mode
//   2014.6.17 : Three point alignment ( formula only )
//   2014.6.19 : Three point alignment
//   2020.10.05 : Ported as a layer as webApps based on latest SVGMap.js
//
//
// ToDo:
// PDFを解凍して抜きだす的な？
// https://stackoverflow.com/questions/18680261/extract-images-from-pdf-file-with-javascript

window.addEventListener('load', function(){
	
	document.getElementById("programming").addEventListener("click",initAuthoring);
	window.addEventListener('closeFrame', function(){
		console.log("closeFrame!! : bitImagePanel:", bitImagePanel);
		if(bitImagePanel){
			console.log("sendMessage to bitImagePanel");
			bitImagePanel.postMessage("closed","*");
		}
		if(srcWindow){
			console.log("sendMessage to srcWindow");
			srcWindow.postMessage("closed","*");
		}
	});
});

function initAuthoring(){
	// オーサリングモードに入ったら、サブレイヤーを削除し、オーサリングの要素を有効に
	console.log("initAuthoring ",typeof(svgMap));
	if ( typeof(svgMap) == "object" ){
		var anim = svgImage.getElementById("bitimageSubLayer");
		if ( anim){
			anim.parentNode.removeChild(anim);
			svgMap.refreshScreen();
		}
		svgImage.getElementById("bitimage").removeAttribute("display");
		svgImage.getElementById("markers").removeAttribute("display");
		update();
	}
}

// ビットイメージ上の基準点座標[px]
var imagePoint1 = {lat:-1,lng:-1};
var imagePoint2 = {lat:-1,lng:-1};
var imagePoint3 = {lat:-1,lng:-1}; // TBD

// ビットイメージがローカルファイルだった場合のファイル名
var localBitImageFileName = null;

// 対応する地理座標
var point1 ={lat:-200, lng:-200};
var point2 ={lat:-200, lng:-200};
var point3 ={lat:-200, lng:-200}; // TBD

// 上記の2(3)点を基に作成したgeo->bitimage変換行列{a,b,c,d,e,f} c,d:TBD
var geo2image = { a:1, b:0, c:0, d:1, e:0, f:0 };

var rootCrs = { a:1, b:0, c:0, d:-1, e:0, f:0 };

// ビットイメージのURL
var imagePath ="";

// ビットイメージのサイズ
var imageWidth, imageHeight;

function update(){
	console.log("called update ",imagePoint1,imagePoint2,imagePoint3);
	
	if ( imagePoint1.lat >= 0 ){
		document.getElementById("point1it").innerHTML = imagePoint1.lng.toFixed(2) + ", " + imagePoint1.lat.toFixed(2);
	}
	if ( imagePoint2.lat >= 0 ){
		document.getElementById("point2it").innerHTML = imagePoint2.lng.toFixed(2) + ", " + imagePoint2.lat.toFixed(2);
	}
	if ( imagePoint3.lat >= 0 ){
		document.getElementById("point3it").innerHTML = imagePoint3.lng.toFixed(2) + ", " + imagePoint3.lat.toFixed(2);
	}
	
	if ( point1.lat >=-180 ){
		document.getElementById("point1t").innerHTML=point1.lng.toFixed(5)+", "+point1.lat.toFixed(5);
		setMarker( 1, point1 );
	}
	if ( point2.lat >=-180 ){
		document.getElementById("point2t").innerHTML=point2.lng.toFixed(5)+", "+point2.lat.toFixed(5);
		setMarker( 2, point2 );
	}
	if ( point3.lat >=-180 ){
		document.getElementById("point3t").innerHTML=point3.lng.toFixed(5)+", "+point3.lat.toFixed(5);
		setMarker( 3, point3 );
	}
	
	if ( imagePath !="" ){
		document.getElementById("imageMapPath").innerHTML = "file: " + imagePath.substring(imagePath.lastIndexOf("/")+1); // pathはながくなるのでやめました。
		document.getElementById("imageMapSize").innerHTML = "size: " + imageWidth+", "+imageHeight;
	}
	
	checkAllData();
	
}


function setPoint( numb ){
	var cp = svgMap.getCentralGeoCoorinates();
	console.log(numb,cp);
	if ( numb == 1 ){
		point1 = cp;
	} else if ( numb == 2 ){
		point2 = cp;
	} else if ( numb == 3 ){
		point3 = cp;
	}
	
	svgMap.dynamicLoad();
	update();
}

function setMarker( numb , point ){
	var use = svgImage.getElementById("gp"+numb);
	use.setAttribute("transform", "ref(svg,"+point.lng+","+(-point.lat)+")");
	console.log("setMarker:",use.getAttribute("transform"),use.getAttribute("xlink:title"));
}


function checkAllData(){
	/**
	svgMap.getLinearTransformMatrix(x1i,y1i,x2i,y2i,x3i,y3i,x1o,y1o,x2o,y2o,x3o,y3o)
	を使うようにしよう 2020/10/05
		// *i:変換前の座標の3組
		// *o:変換後の座標の3組
		// output:
		// matrix{.a,.b,.c,.d,.e,.f}
	**/
	console.log("checkAllData:");
	if ( point1.lat >=-180 && point2.lat >=-180
		&& imagePath !=""
		&& imagePoint1.lat >=0 && imagePoint2.lat >=0 
		&& ( point1.lng != point2.lng ) && ( point1.lat != point2.lat )
		&& ( imagePoint1.lng != imagePoint2.lng ) && ( imagePoint1.lat != imagePoint2.lat )){
			var p3Lat,p3Lng, ip3Lat,ip3Lng;
			if ( point3.lat >=-180 && imagePoint3.lat >=0 ){
				p3Lat =  point3.lat;
				p3Lng =  point3.lng;
				ip3Lat = imagePoint3.lat;
				ip3Lng = imagePoint3.lng;
			} else {
				p3Lat = point1.lat;
				p3Lng = point2.lng;
				ip3Lat = imagePoint1.lat;
				ip3Lng = imagePoint2.lng;
			}
			
			var tf = svgMap.getLinearTransformMatrix(
				imagePoint1.lng, imagePoint1.lat,
				imagePoint2.lng, imagePoint2.lat,
				ip3Lng, ip3Lat,
				
				point1.lng, point1.lat,
				point2.lng, point2.lat,
				p3Lng, p3Lat
			);
			console.log("Calc transform:",tf);
			
			var bi = svgImage.getElementById("bitimage");
			bi.setAttribute("transform", "matrix(" + tf.a + "," + (-tf.b) + "," + tf.c + "," + (-tf.d) + "," + tf.e + "," + (-tf.f) + ")");
			bi.setAttribute("width",imageWidth);
			bi.setAttribute("height",imageHeight);
			bi.setAttribute("xlink:href", imagePath );
			console.log("bitimage:",bi);
			
			// 2020/10/09 imagePoint*をdata-anchorPointsに付記する
			var ips = imagePoint1.lng + "," + imagePoint1.lat + "," + imagePoint2.lng + "," + imagePoint2.lat;
			if ( point3.lat >=-180 && imagePoint3.lat >=0 ){
				ips +=  "," + imagePoint3.lng + "," + imagePoint3.lat;
			}
			bi.setAttribute("data-anchorPoints",ips);
			
			svgMap.refreshScreen();
		} else {
			
		}
}

var srcWindow, svgsrc;
function viewSource(getText){
	svgsrc = xml2Str(svgImage);
	svgsrc = svgsrc.replace(/<!-- symbols[\s\S]*endSymbols -->/ , "" );
	svgsrc = svgsrc.replace(/<!-- markers[\s\S]*endMarkers -->/ , "" );
	svgsrc = svgsrc.replace(/><svg/,">\n<svg");
	svgsrc = svgsrc.replace(/iid="[\w]*"/ , "" );
//	document.getElementById("source").innerHTML= svgsrc;
//	alert(svgsrc);
//    srcWindow = window.open();
	
	if ( getText ){
		return ( svgsrc );
	} else {
//		svgsrc = escape("\n"+svgsrc);
		srcWindow = window.open('srcWindow.html','sub2','width=800,height=450,scrollbars=yes');
		window.addEventListener("message", receiveMessage, false);
		
		/** これだと既に開いているウィンドには効かない・・・ unloadで仕込めばいいのかもだがもうmessagingで対応する
		srcWindow.addEventListener('load', function(){
			console.log("LOAD COMPL");
			srcWindow.document.getElementsByTagName("textarea")[0].value=svgsrc;
		}, true); 
		**/
	}
}

function receiveMessage(event){
//	console.log("event.data:",event.data);
	window.removeEventListener("message", receiveMessage, false);
	if ( event.data=="loaded"){
		srcWindow.document.getElementsByTagName("textarea")[0].value=svgsrc;
		srcWindow.localBitImageFileName = localBitImageFileName;
	}
}

var bitImagePanel;
function openBitImagePanel(){
	bitImagePanel = window.open('bitimagePanel.html','sub','width=800,height=600');
	return false;
}

function registMap(){
	if ( oneTimeMode ){return}
	var dataTitle = document.getElementById("dataTitle").value;
	if ( ! dataTitle ){
		alert("データの内容がわかるタイトルを入力してください");
		return;
	}
	var ss = viewSource(true);
	if ( hexDecode){
		ss = utf8Str2hexStr(ss);
	}
	// console.log(ss);
	document.getElementById("registMsg").innerText="REGISTERING";
	sendData({title:dataTitle , svgmapdata:ss},function(msg){
		if (msg =="load"){
			document.getElementById("registMsg").innerText="SUCCESS";
		} else {
			document.getElementById("registMsg").innerText="FAIL";
		}
		setTimeout(function(){
			document.getElementById("registMsg").innerText="";
		}, 2000);
		document.getElementById("dataTitle").value="";
	})
	
}

async function sendData(data,cbf) {
	if ( _int_localFileMode ){
		await localDB.registContent(data);
		cbf("load");
	} else {
		var XHR = new XMLHttpRequest();
		var FD  = new FormData();
		
		for(name in data) {
			FD.append(name, data[name]);
		}
		XHR.addEventListener('load', function(event) {
			console.log("post success:",event,this.responseText);
			if (cbf){
				cbf("load");
			}
		});
		XHR.addEventListener('error', function(event) {
			console.log('Oups! Something goes wrong.');
			if (cbf){
				cbf("error");
			}
		});
		XHR.open('POST', 'uploaded/testStore.php');
		XHR.send(FD);
	}
}



function xml2Str(xmlNode) {
	try {
		// Gecko- and Webkit-based browsers (Firefox, Chrome), Opera.
		return (new XMLSerializer()).serializeToString(xmlNode);
	}
	catch (e) {
		try {
			// Internet Explorer.
			return xmlNode.xml;
		}
		catch (e) {
			//Other browsers without XML Serializer
			alert('Xmlserializer not supported');
		}
	}
	return false;
}

function escape(str) {
	str = str.replace(/&/g,"&amp;");
	str = str.replace(/"/g,"&quot;");
	str = str.replace(/'/g,"&#039;");
	str = str.replace(/</g,"&lt;");
	str = str.replace(/>/g,"&gt;");
	return str;
}

