// SVGMapレイヤーのコンテンツをphpで作ったファイル登録機構で保存・読み込む機能
//
// Programmed by Satoru Takagi
// 
// License: (MPL v2)
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.
//

// 2024/05/20 ローカルモード追加(IndexedDB使用)
// 2024/08/19 画像メタデータ拡張対応

var contentDir = "uploaded/contents/";
var workDir="uploaded/";

var _int_getSource; // ソースデータを取得する関数 ()
var _int_showMapEmbed; // 地図を表示する関数async可 (localPath)

var _int_localFileMode = false;
var localDB;

function registMap(dataTitleId,registMsgId,typeStr){
	if (!typeStr){typeStr="svg"}
	var dataTitle = document.getElementById(dataTitleId).value;
	if ( ! dataTitle ){
		alert("データの内容がわかるタイトルを入力してください");
		return;
	}
	var ss = _int_getSource();
	console.log(ss);
	document.getElementById(registMsgId).innerText="REGISTERING";
	sendData({title:dataTitle , svgmapdata:ss, type:typeStr},function(msg){
		if (msg.indexOf("load")==0){
			document.getElementById(registMsgId).innerText="SUCCESS";
			if ( typeof(window.imageMetadata)=="object"){
				var ret = window.imageMetadata.registImageMetadata(msg.split(",")[1].trim(), registMsgId);
			}
		} else {
			document.getElementById(registMsgId).innerText="FAIL";
		}
		setTimeout(function(){
			document.getElementById(registMsgId).innerText="";
			initSubLayerList();
		}, 2000);
		document.getElementById(dataTitleId).value="";
	})
}

function sendData(data,cbf) {
	if ( _int_localFileMode ){
		sendDataLocal(data,cbf);
	} else {
		var XHR = new XMLHttpRequest();
		var FD  = new FormData();
		
		for(name in data) {
			FD.append(name, data[name]);
		}
		XHR.addEventListener('load', function(event) {
			console.log("post success:",event,this.responseText);
			if (cbf){
				cbf("load,"+this.responseText);
			}
		});
		XHR.addEventListener('error', function(event) {
			console.log('Oups! Something goes wrong.');
			if (cbf){
				cbf("error");
			}
		});
		XHR.open('POST', workDir+'fileManage.php');
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

var _menutblId, _messageDivId;
var _int_fetchTextProgress;
async function initLoader(targetTabUiId, menuTableId, getSourceFunc, showMapFunc, clearMapFunc, messageDivId){
	await checkIndexTxt();
	initSubLayerList();
	document.getElementById(targetTabUiId).addEventListener("click",initSubLayerList);
	_menutblId=menuTableId;
	_int_getSource = getSourceFunc; // ()
	_int_showMapEmbed = showMapFunc; // (localPath)
	_int_clearMapFunction = clearMapFunc; // ();
	if ( messageDivId){
		_messageDivId = messageDivId;
	}
	var fetchModule = await import('./FetchTextProgress.js');
	_int_fetchTextProgress = new fetchModule.FetchTextProgress();
	console.log("fetchTextProgress:", _int_fetchTextProgress, "  fetchModule:",fetchModule);
}

function initSubLayerList(){
	if ( _int_localFileMode ){
		loadIndex_local(dispCsvIndex);
	} else {
		// 登録済みビットイメージデータ表示モードに入ったら、オーサリングの要素を無効に
		loadJSON(dispCsvIndex, workDir+"index.txt?t="+(new Date().getTime()), "csv" );
	}
}

function dispCsvIndex(csvdata){
	var mtbl = document.getElementById(_menutblId);
	_int_removeChildren(mtbl);
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
		btn.addEventListener("click",function(fileName, titleName){
			return(
				async function(){
					//console.log("Select File: fileName:",fileName,"  _int_loadedFileName:",_int_loadedFileName);
					if ( _int_loadedFileName == fileName){
						setHash();
						_int_clearMap();
						hilightSelectedTable();
					} else {
						if ( _messageDivId ){
							document.getElementById(_messageDivId).innerText=`Load file:${titleName}`;
						}
						await loadByFileName(fileName);
					}
				});
		}(csvdata[i][0], csvdata[i][2]));
		btn.setAttribute("data-fileName",csvdata[i][0]);
		btn.setAttribute("data-fileTitle",csvdata[i][2]);
		td1.appendChild(btn);
//		td1.innerText= csvdata[i][0];
		var td2 = document.createElement("td");
		var dt = csvdata[i][1];
		dt = dt.substring(0,4)+"/"+dt.substring(4,6)+"/"+dt.substring(6,8)+" "+dt.substring(8,10)+":"+dt.substring(10,12);
		td2.innerText= dt;
		btn.setAttribute("data-date",dt);
		var td3 = document.createElement("td");
		td3.innerText= csvdata[i][2];
		
		var tr = document.createElement("tr");
		tr.appendChild(td1);
		tr.appendChild(td3);
		tr.appendChild(td2);
		mtbl.appendChild(tr);
	}
	var fileMata = hilightSelectedTable();
	return fileMata;
}

// 何か古臭い関数だね・・
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
			cbFunc(false);
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

function _int_removeChildren(element){
	while (element.firstChild) element.removeChild(element.firstChild);
}


function getHash(){
	var ans="";
	var savedName = _int_loadedFileName;
	if ( !savedName){
	} else {
		ans = savedName;
	}
	return ans;
}

var _int_loadedFileName;
async function loadByFileName(fileName){
	//console.log("loadByFileName:",fileName, " _int_localFileMode:", _int_localFileMode,"   _int_fetchTextProgress:",_int_fetchTextProgress);
	if ( _int_localFileMode ){ // 2024/5/20　ローカルモード
		var contentObj = await localDB.getContent(fileName);
		/**
		console.log("contentObj:",contentObj);
		contentObj = JSON.parse(contentObj); // jsonになってるのがよくないが・・(csvUI_r20.htmlのgetSourceFunc)
		**/
		await _int_showMapEmbed(contentObj);
	} else { // サーバ登録モード
		
		var rawContent = await _int_fetchTextProgress.fetch(
			(contentDir+fileName) ,
			function(byte){
				if ( _messageDivId ){
					document.getElementById(_messageDivId).innerText=`${Math.floor(10*byte/(1024*1024))/10} MB Loaded`;
				}
			});
		
		setHash(fileName);
		await _int_showMapEmbed(rawContent);
		if ( typeof(window.imageMetadata)=="object" && !fileName.csv){ // ローカルIndexedDB対応バージョンでは実データ(fileName.csvとか.schemaとか)が入っているケースがある・・・が、ひとまずいまのところ、imageMetadataはサーバ登録モードのみの対応としておく
			window.imageMetadata.initImageMetadataZip(fileName); // 画像メタデータ拡張
		}
	}
	_int_loadedFileName = fileName;
	var fileMata = hilightSelectedTable();
	return fileMata;
}

function setHash(pathOrFileName){
	if ( !pathOrFileName){
		svgImageProps.hash="";
	} else {
		var sfp = pathOrFileName.split("/");
		const fname = sfp[sfp.length-1];
		const hashStr = `#saved:${fname}`;
		svgImageProps.hash=hashStr;
	}
	console.log("setHash :",svgImageProps.hash,svgImageProps.Path);
}


function _int_clearMap(){
	if ( typeof _int_clearMapFunction == "function"){
		_int_clearMapFunction();
	}
	_int_loadedFileName=null; // この関数はつまるところこの変数をクリアするためだけにあります・・・
}

function hilightSelectedTable(){
	var savedName = _int_loadedFileName;
	//console.log("savedName:",savedName);
	var selectedFileMeta;
	var tbl=document.getElementById(_menutblId);
	var trs = tbl.getElementsByTagName("tr");
	for ( var tr of trs){
		var btn = tr.getElementsByTagName("input");
		if ( btn.length==1 ){
			//console.log(tr.innerText, btn[0].getAttribute("data-hash"));
			var hash = btn[0].getAttribute("data-fileName");
			var title = btn[0].getAttribute("data-fileTitle");
			var date = btn[0].getAttribute("data-date");
			if (hash == savedName){
				tr.style.backgroundColor="#fdd";
				selectedFileMeta={hash,title,date};
			} else {
				tr.style.backgroundColor="";
			}
		}
	}
	return selectedFileMeta;
}

// 2024/5/20 local indexDB support
async function loadIndex_local(cbfunc){
	await localDB.syncIndex();
	var indexObj = await localDB.indexData;
	var ans = [];
	for ( var fn in indexObj){
		ans.push(indexObj[fn]);
	}
	cbfunc(ans);
}

async function checkIndexTxt(){
	var res = await fetch(workDir+"index.txt?t="+(new Date().getTime()));
	console.log("checkIndexTxt:",res);
	if (res.status !=200){
		localDB = new LocalDBFileManager(svgMap.getLayer(layerID).getAttribute("title"));
//		localDB = new LocalDBFileManager("testCsvLayerDB");
		await localDB.init();
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

function localFSnote(){
	var fsNoteSpan = document.getElementById("fileSystemNote");
	if ( fsNoteSpan ){
		fsNoteSpan.innerText="端末のブラウザ内にデータを保存します"
	}
}
