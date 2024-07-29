// SVGMapレイヤーのコンテンツをphpで作ったファイル登録機構で保存・読み込む機能
var contentDir = "uploaded/contents/";
var workDir="uploaded/";

function registMap(dataTitleId,registMsgId){
	var dataTitle = document.getElementById(dataTitleId).value;
	if ( ! dataTitle ){
		alert("データの内容がわかるタイトルを入力してください");
		return;
	}
	var ss = getSource();
	console.log(ss);
	document.getElementById(registMsgId).innerText="REGISTERING";
	sendData({title:dataTitle , svgmapdata:ss},function(msg){
		if (msg =="load"){
			document.getElementById(registMsgId).innerText="SUCCESS";
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
		sendDataLocal(data, cbf);
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
		XHR.open('POST', workDir+'testStore.php');
		XHR.send(FD);
	}
}

function getSource(){
	svgsrc = xml2Str(svgImage);
//	svgsrc = svgsrc.replace(/<!-- symbols[\s\S]*endSymbols -->/ , "" );
//	svgsrc = svgsrc.replace(/<!-- markers[\s\S]*endMarkers -->/ , "" );
	svgsrc = svgsrc.replace(/><svg/,">\n<svg");
	svgsrc = svgsrc.replaceAll(/iid="[\w]*"/g , "" );
	return ( svgsrc );
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

var _menutblId, _targetSvgContentGrpId;
async function initLoader(targetId, menuTblId, targetSvgContentGrpId){
	await checkIndexTxt();
	initSubLayerList();
	document.getElementById(targetId).addEventListener("click",initSubLayerList);
	_menutblId=menuTblId;
	_targetSvgContentGrpId = targetSvgContentGrpId;
}

function initSubLayerList(){
	// 登録済みビットイメージデータ表示モードに入ったら、オーサリングの要素を無効に
	if ( _int_localFileMode ){
		loadIndex_local( dispCsvIndex );
	} else {
		loadJSON(dispCsvIndex, workDir+"index.txt?t="+(new Date().getTime()), "csv" );
	}
	/**
	if ( typeof(svgMap) == "object" ){
		svgImage.getElementById("bitimage").setAttribute("xlink:href","null");
		svgImage.getElementById("bitimage").setAttribute("display","none");
		svgImage.getElementById("markers").setAttribute("display","none");
		svgMap.refreshScreen();
	}
	**/
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
		btn.setAttribute("value","表示");
		btn.addEventListener("click",function(url,title){
			return(
				async function(){
					await _int_showMapEmbed(url,title);
					hilightSelectedTable();
				});
		}(contentDir+csvdata[i][0], csvdata[i][2]));
		btn.setAttribute("data-hash",csvdata[i][0].split(".")[0]);
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

async function  _int_showMapEmbed(url,title){
	console.log("showMapEmbed:",url,title);
	if (typeof svgImage=="object"){
		var targetGrp = _targetSvgContentGrpId;
		var srcTxt;
		if ( _int_localFileMode ){
			srcTxt = await localDB.getContent(url.substring(url.lastIndexOf("/")+1));
		} else {
			const res = await fetch(url);
			srcTxt = await res.text();
		}
		const parser = new DOMParser();
		const srcSvgMapDom = await parser.parseFromString(srcTxt, "text/xml");
		console.log(srcSvgMapDom);
		var metaProp=srcSvgMapDom.documentElement.getAttribute("property");
		var impN = srcSvgMapDom.getElementById(_targetSvgContentGrpId);
		var toImpN = svgImage.importNode(impN, true);
		console.log(toImpN);
		
		var impGrp = svgImage.getElementById(_targetSvgContentGrpId);
		if ( impGrp){
			impGrp.parentNode.removeChild(impGrp);
		}
		svgImage.documentElement.setAttribute("property",metaProp);
		svgImage.documentElement.appendChild(toImpN);
		impGrp = svgImage.getElementById(_targetSvgContentGrpId);
		var fileName=url.split("/");
		fileName=fileName[fileName.length-1];
		fileName = fileName.split(".");
		fileName = fileName[0];
		console.log(fileName);
		impGrp.setAttribute("data-contentUrl",fileName);
		svgMap.refreshScreen();
	}
}

function _int_showMap(url,title){
	console.log("showMap:",url,title);
	if (svgImage){
		var anim = svgImage.getElementById("bitimageSubLayer");
		if ( anim){
			anim.parentNode.removeChild(anim);
		}
		
		anim = svgImage.createElement("animation")
		anim.setAttribute("id","bitimageSubLayer");
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

function _int_removeChildren(element){
	while (element.firstChild) element.removeChild(element.firstChild);
}


function getHash(){
	var ans="";
	var impGrp = svgImage.getElementById(_targetSvgContentGrpId);
	var savedName = impGrp.getAttribute("data-contentUrl");
	if ( !savedName){
	} else {
		ans = savedName;
	}
	return ans;
}

function loadByHash(hashStr){
	console.log("loadByHash:",hashStr);
	_int_showMapEmbed(contentDir+hashStr+".svg","");
	hilightSelectedTable();
}

function hilightSelectedTable(){
	var impGrp = svgImage.getElementById(_targetSvgContentGrpId);
	var savedName = impGrp.getAttribute("data-contentUrl");
	//console.log("savedName:",savedName);
	if ( !savedName){
	} else {
		var tbl=document.getElementById(_menutblId);
		var trs = tbl.getElementsByTagName("tr");
		for ( var tr of trs){
			var btn = tr.getElementsByTagName("input");
			if ( btn.length==1 ){
				//console.log(tr.innerText, btn[0].getAttribute("data-hash"));
				var hash = btn[0].getAttribute("data-hash");
				if (hash == savedName){
					tr.style.backgroundColor="#fdd";
				} else {
					tr.style.backgroundColor="";
				}
			}
		}
	}
}



// 2024/5/21 local indexDB support
var _int_localFileMode = false;
var localDB;
async function loadIndex_local(cbfunc){
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
