// Inporter for bitimage2geo
//
// Programmed by Satoru Takagi
// 
// License: (MPL v2)
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.
//

var workDir = "uploaded/";
var contentDir = workDir + "contents/";
var oneTimeMode=false;

window.addEventListener('load', async function(){
	if ( svgImageProps.Path.indexOf("oneTime")>0){
		console.log("oneTimeMode");
		oneTimeMode=true;
		document.getElementsByName("tab_item")[1].click();
		var tabItms = document.getElementsByClassName("tab_item");
		for(i=0;i<tabItms.length;i++){
			tabItms[i].style.display = "none";
		}
		registTr.style.display="none";
		manualLink.href="man/index_oneTime.html";
	} else {
		await checkIndexTxt()
		initSubLayerList();
		document.getElementById("all").addEventListener("click",initSubLayerList);
		initialFileLoadFromHash();
	}
});

function initialFileLoadFromHash(){
	var hashStr = svgImageProps.Path;
	if ( hashStr.indexOf("#")>0){
		hashStr=hashStr.substring(hashStr.indexOf("#")+1);
	} else {
		hashStr="";
	}
	console.log("vectorFileLoader2 onload:",hashStr);
	if ( hashStr.indexOf("saved:")==0){
		console.log("Load Saved File");
		loadByHash(hashStr.substring(6));
		return true;
	}
	return false;
}


function initSubLayerList(){
	// 登録済みビットイメージデータ表示モードに入ったら、オーサリングの要素を無効に
	if ( _int_localFileMode ){
		loadIndex_local(dispCsv);
	} else {
		loadJSON(dispCsv, workDir + "index.txt?t="+(new Date().getTime()), "csv" );
	}
	if ( typeof(svgMap) == "object" ){
		svgImage.getElementById(_bitimageContId).setAttribute("xlink:href","null");
		svgImage.getElementById(_bitimageContId).setAttribute("display","none");
		svgImage.getElementById("markers").setAttribute("display","none");
		svgMap.refreshScreen();
	}
}

var _menutblId="menutbl";
var _bitimageContId="bitimage";
var _bitimageSubLayerId = "bitimageSubLayer";
function dispCsv(csvdata){
	var mtbl = document.getElementById(_menutblId);
	removeChildren(mtbl);
	console.log(csvdata);
	var ths = document.createElement("tr");
	ths.innerHTML="<th></th><th>タイトル</th><th>登録日時</th>";
	mtbl.appendChild(ths);
	for ( var i = 0 ; i < csvdata.length ; i++ ){
		if ( csvdata[i][0]==""){
			continue;
		}
		var td1 = document.createElement("td");
		var btn = document.createElement("input");
		btn.setAttribute("type","button");
		btn.setAttribute("value","選択");
		var sourceURL=contentDir+csvdata[i][0];
		btn.addEventListener("click",function(contentDir,fileName,title){
			return(
				function(){
					if ( getSavedName().indexOf( fileName  )< 0 ){
						var url = contentDir + fileName
						// console.log("URL:",url," title:",title)
						if ( hexDecode ){
	//						showMapDecodeEmbed(url,title);
						} else {
							if ( _int_localFileMode ){
								showMapLocalEmbed(url,title);
								hilightSelectedTable(url);
							} else {
								showMap(url,title);
								svgImageProps.hash=`#saved:${fileName.split(".")[0]}`;
								hilightSelectedTable();
							}
						}
					} else {
						clearMap();
						hilightSelectedTable();
					}
				});
		}(contentDir, csvdata[i][0], csvdata[i][2]));
		btn.setAttribute("data-contentUrl",sourceURL);
		td1.appendChild(btn);
//		td1.innerText= csvdata[i][0];
		var td2 = document.createElement("td");
		var dt = csvdata[i][1];
		dt = dt.substring(0,4)+"/"+dt.substring(4,6)+"/"+dt.substring(6,8)+" "+dt.substring(8,10)+":"+dt.substring(10,12);
		td2.innerText= dt;
		var td3 = document.createElement("td");
		td3.innerText= csvdata[i][2];
		
		var tr = document.createElement("tr");
		tr.appendChild(td1);
		tr.appendChild(td3);
		tr.appendChild(td2);
		mtbl.appendChild(tr);
	}
	hilightSelectedTable();
}

function getSavedName(){
	savedName = svgImage.getElementById(_bitimageSubLayerId)?.getAttribute("xlink:href");
	if ( !savedName ){savedName = ""}
	return savedName;
}
	
async function showMapDecodeEmbed(url,title){
	console.log("showMapDecodeEmbed");
	var hex;
	hex = await (await fetch(url)).text();
	console.log(hex);
	const svgSrc = hexStr2utf8Str(hex);
	const doc = (new DOMParser()).parseFromString(svgSrc, "application/xml");
	var impImgElm = doc.getElementsByTagName("image")[0];
	
	var imgElm = svgImage.getElementById(_bitimageContId);
	
	
	for ( var attr of impImgElm.attributes){
		if ( attr.name!="id"){
			imgElm.setAttribute(attr.name, attr.value);
		}
	}
	imgElm.removeAttribute("display");
//	var img = svgImage.importNode( doc.getElementsByTagName("image")[0], false);
//	console.log(img);
	
	svgMap.refreshScreen();
}

function showMap(url,title){
//	console.log("showMap");
	console.log("showMap:",url,title);
	if (svgImage){
		var anim = svgImage.getElementById(_bitimageSubLayerId);
		if ( anim){
			anim.parentNode.removeChild(anim);
		}
		
		anim = svgImage.createElement("animation")
		anim.setAttribute("id",_bitimageSubLayerId);
		anim.setAttribute("x",-30000);
		anim.setAttribute("y",-30000);
		anim.setAttribute("width",60000);
		anim.setAttribute("height",60000);
		anim.setAttribute("xlink:href",url);
		anim.setAttribute("title",title);
		svgImage.documentElement.appendChild(anim);
		
		svgMap.refreshScreen();
	}
}

function loadJSON(cbFunc, url, dataCat, postProcess){
//	console.log("loadJSON : SRC: ", url);
	var httpObj = new XMLHttpRequest();
	if ( httpObj ) {
		httpObj.onreadystatechange = function(){
			loadJSON_ph2( this , cbFunc , dataCat , postProcess);
		} ;
		httpObj.open("GET", url , true );
		httpObj.send(null);
	}
}

function loadJSON_ph2( httpRes , cbFunc , dataCat , postProcess){
	if ( httpRes.readyState == 4 ){
		if ( httpRes.status == 403 || httpRes.status == 404 || httpRes.status == 500 || httpRes.status == 503 ){
			console.log( "loadJSON : File get failed : stat : ", httpRes.status);
			return;
		}
		var jst = httpRes.responseText;
		jst = unescape(jst);
		if ( postProcess ){
			jst = postProcess(jst);
		}
//		console.log("isCsv:",isCsv, "\nloadJSON_ph2:",jst);
		if ( dataCat=="csv" ){
			var csv = jst.split("\n");
//			console.log("csv:",csv);
			for ( var i = 0 ; i < csv.length ; i++ ){
				csv[i] = csv[i].split(",");
				for ( var j = 0 ; j < csv[i].length ; j++ ){
					csv[i][j] = csv[i][j].trim();
				}
			}
//			console.log("csv:",csv);
			cbFunc ( csv );
		} else if ( dataCat == "html" ){
			var parser = new DOMParser();
			var htmlDoc = parser.parseFromString(jst, 'text/html');
			// var htmlDoc = parser.parseFromString(txt, 'text/xml');
			cbFunc(htmlDoc);
		} else {
			var Json = JSON.parse(jst);
			cbFunc(Json);
		}
	}
}

function removeChildren(element){
	while (element.firstChild) element.removeChild(element.firstChild);
}


function loadByHash(hashStr){
	console.log("loadByHash:",hashStr);
	showMap(contentDir+hashStr+".svg","");
	/**
	_int_showMapEmbed(contentDir+hashStr+".svg","");
	**/
	var ltitle = hilightSelectedTable();
	svgImage.getElementById(_bitimageSubLayerId).setAttribute("title",ltitle);
}

function getHashFromURL(url){
	var fileName=url.split("/");
	fileName=fileName[fileName.length-1];
	fileName = fileName.split(".");
	fileName = fileName[0];
	return fileName;
}

function hilightSelectedTable(savedName){
	console.log("hilightSelectedTable");
	if ( !savedName){
		savedName = getSavedName();
	}
	console.log("savedName:",savedName);
	var ltitle;
	var tbl=document.getElementById(_menutblId);
	var trs = tbl.getElementsByTagName("tr");
	for ( var tr of trs){
		var btn = tr.getElementsByTagName("input");
		if ( btn.length==1 ){
			//console.log(tr.innerText, btn[0].getAttribute("data-hash"));
			var hash = btn[0].getAttribute("data-contentUrl");
			if (hash == savedName){
				tr.style.backgroundColor="#fdd";
				ltitle = tr.children[1]
			} else {
				tr.style.backgroundColor="";
			}
		}
	}
	console.log(ltitle);
	return ltitle;
}

function getPermaLink(){
	var ans;
	var animHref = getSavedName();
	if ( animHref ){
		var fileHash=getHashFromURL(animHref);
		console.log("fileHash:",fileHash);
		var lname = svgMap.getLayer(layerID).getAttribute("title");
		var bpm = svgMap.getBasicPermanentLink()
		var dhash = decodeURIComponent(bpm.hash);
		if ( dhash.indexOf(lname)>=0){
			var dh1 = dhash.substring(0,dhash.indexOf(lname) + lname.length);
			var dh2 = dhash.substring(dhash.indexOf(lname) + lname.length);
			console.log(dh1, dh2);
			var hashPath;
			if ( dh2.startsWith("#")){
				// 既にサブレイヤー識別子アリ
				hashPath = bpm;
			} else {
				var chash = dh1 + "#saved:"+fileHash+dh2;
				hashPath = bpm.origin + bpm.pathname + chash;
			}
			console.log(hashPath);
			pathAns.innerText=hashPath;
			navigator.clipboard.writeText(hashPath);
	//		alert(hashPath);
		} else {
			alert("うまく作れませんでした・・・");
		}
	} else {
		pathAns.innerText="保存済みコンテンツに対してのみ有効です";
	}
}


// 2024/05/21 support for stand-alone mode (uses indexedDB
var _int_localFileMode = false;
var localDB;
async function loadIndex_local(cbfunc){
	await localDB.syncIndex();
	var indexObj = await localDB.indexData;
	var ans = [];
	for ( var fn in indexObj){
		ans.push(indexObj[fn]);
	}
	console.log("loadIndex_local: indexObj:",indexObj, " ans:",ans);
	cbfunc(ans);
}

async function checkIndexTxt(){
	var res = await fetch(workDir+"index.txt?t="+(new Date().getTime()));
	console.log("checkIndexTxt:",res);
	if (res.status !=200){
		localDB = new LocalDBFileManager(svgMap.getLayer(layerID).getAttribute("title"));
//		localDB = new LocalDBFileManager("testCsvLayerDB");
		await localDB.init();
		await localDB.getIndex();
		console.log("Use localDB", localDB);
		_int_localFileMode = true;
		localFSnote();
		return false;
	} else {
		return true;
	}
}

async function sendDataLocal(data, cbf){
	try{
		await localDB.registContent(data);
		cbf("load");
	} catch ( e ){
		cbf("fail");
	}
}

async function showMapLocalEmbed(url,title){
	
	var anim = svgImage.getElementById(_bitimageSubLayerId);
	if ( anim){
		anim.parentNode.removeChild(anim);
	}
	
	url = url.substring(url.lastIndexOf("/")+1);
	console.log("showMapLocalEmbed:",url,title);
	var svgMapContent = await localDB.getContent(url);
	var svgc = (new DOMParser()).parseFromString(svgMapContent,"text/xml");
	var img = svgc.getElementById("bitimage");
	console.log(img);
	var href = img.getAttribute("xlink:href");
	var x = img.getAttribute("x");
	var y = img.getAttribute("y");
	var w = img.getAttribute("width");
	var h = img.getAttribute("height");
	var tf = img.getAttribute("transform");
	var ap = img.getAttribute("data-anchorPoints");
	
	var svg_img = svgImage.getElementById("bitimage");
	svg_img.setAttribute("xlink:href",href);
	svg_img.setAttribute("x",x);
	svg_img.setAttribute("y",y);
	svg_img.setAttribute("width",w);
	svg_img.setAttribute("height",h);
	svg_img.setAttribute("transform",tf);
	svg_img.setAttribute("data-anchorPoints",ap);
	svg_img.setAttribute("data-filename",url);
	svg_img.setAttribute("display","");
	svgMap.refreshScreen();
}

function clearMap(){
	var anim = svgImage.getElementById(_bitimageSubLayerId);
	if ( anim){
		anim.parentNode.removeChild(anim);
	}
	var svg_img = svgImage.getElementById("bitimage");
	if ( svg_img ){
		svg_img.setAttribute("xlink:href","");
		svg_img.removeAttribute("data-anchorPoints");
	}
	svgImageProps.hash="";
	svgMap.refreshScreen();
}

function localFSnote(){
	var fsNoteSpan = document.getElementById("fileSystemNote");
	if ( fsNoteSpan ){
		fsNoteSpan.innerText="端末のブラウザ内にデータを保存します"
	}
}
