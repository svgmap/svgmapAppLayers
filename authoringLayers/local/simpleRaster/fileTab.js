import {FileManager} from "./FileManager.js";
import {LocalDBFileManager} from "./LocalDBFileManager.js";
var contentDir = "./contents/";
var fm;
var removeMode=false;
addEventListener("load",  async function(){
	fm = new FileManager();
	var indexData = await fm.init();
	console.log("indexData:",indexData);
	if ( !indexData){
		fm = new LocalDBFileManager(svgMap.getLayer(layerID).getAttribute("title"));
		await fm.init();
		localFSnote();
	}
	updateTable();
	postB.addEventListener("click", async function(){
		var descTxt = postText.value;
		if ( !descTxt ){
			alert("説明文を入力してください。");
			return;
		}
		
		descTxt = descTxt.replaceAll(",","，");
		removeImageIid(svgImage);
		var svgContentXML = fm.xml2Str(svgImage);
		
		var ret = await fm.registSvgContent(svgContentXML,descTxt);
		console.log(ret);
		updateTable();
		postText.value="";
	});
	syncB.addEventListener("click", async function(){
		var idx = await fm.syncIndex();
		console.log(idx);
		updateTable()
	});
	removeB.addEventListener("click", async function(){
		if ( removeMode==true ){
			removeMode=false;
			removeB.value="remove";
		} else {
			removeMode=true;
			removeB.value="exit remove mode";
		}
		updateTable();
	});
});

function removeImageIid(svgImage){
	var imgs = svgImage.getElementsByTagName("image");
	for ( var img of imgs ){
		img.removeAttribute("iid");
	}
}

window.showSvg = async function(event){
	var targetMeta = fm.indexData[event.target.getAttribute("data-value")];
	var targetFile = targetMeta[0];
	console.log(targetMeta);
	if ( removeMode ){
		await fm.removeSvgContent(targetFile);
		updateTable();
	} else {
		console.log("SHOW File:",targetFile);
		await loadAndShowSvg(targetFile);
	}
}

async function loadAndShowSvg(fileName){
	if ( fm.getContent){
		var txt =  await fm.getContent(fileName);
		console.log("loadAndShowSvg: fileName:",fileName, " content:", txt);
	} else {
		var path = new URL( fileName, new URL(contentDir, window.location));
		console.log(path);
		var res = await fetch(path);
		var txt = await res.text();
	} 
	const parser = new DOMParser();
	const svgDoc = await parser.parseFromString(txt, "text/xml");
	console.log(svgDoc);
	
	removeAllShapes();
	
	var paths = svgDoc.getElementsByTagName("path");
	var uses = svgDoc.getElementsByTagName("use");
	var images = getDrawingImages(svgDoc);
	importShapes(paths);
	importShapes(uses);
	importShapes(images);
	
	svgMap.refreshScreen();
}

function getDrawingImages(svgDoc){
	// svg要素直下のimage要素をフリーハンドツールで作ったビットイメージだとして収集する
	var images = svgDoc.getElementsByTagName("image");
	var ans = [];
	for ( var img of images){
		if ( img.parentElement.nodeName=="svg"){
			ans.push(img);
		}
	}
	console.log(ans);
	return ans;
}

function importShapes(shps){
	for ( var i = 0 ; i < shps.length ; i++){
		var cloneElm = svgImage.importNode(shps[i], true);
		svgImage.documentElement.appendChild(cloneElm);
	}
}


function removeAllShapes(){
	var paths = svgImage.getElementsByTagName("path");
	removeElements(paths);
	var uses = svgImage.getElementsByTagName("use");
	removeElements(uses);
	var images =  getDrawingImages(svgImage);
	removeElements(images);
}

function removeElements(elms){
	for ( var i = elms.length-1; i >=0 ; i--){
		var elm = elms[i];
		elm.parentElement.removeChild(elm);
	}
}


function updateTable(){
	removeChildren(contentListTable);
	var hdmsg = "更新日時";
	var btnMsh = "表示";
	if ( removeMode ){
		hdmsg = "ファイル名";
		btnMsh = "削除";
	}
	contentListTable.insertAdjacentHTML("beforeend",`<tr><th></th><th>${hdmsg}</th><th>説明</th></tr>`);
	var ar = buildList(fm.indexData, 1, true);
	console.log(ar);
	
	for ( var rec of ar){
		var dt = new Date(fm.getDateTime(rec[1]));
		var dts = dt.toLocaleString();
		dts = dts.substring(0,dts.length-3);
		var desc = rec[2];
		var hdCont = dts;
		if ( removeMode ){
			hdCont = rec[0];
		}
		contentListTable.insertAdjacentHTML("beforeend",`<tr><td><input type="button" value="${btnMsh}" data-value="${rec[0]}" onclick="showSvg(event)"></input></td><td>${hdCont}</td><td>${desc}</td></tr>`);
	}
}

function buildList(srcObj, sortIndex, descendingOrder){
	console.log("buildList:",srcObj," sortIndex:",sortIndex);
	var array = Object.keys(srcObj).map((k)=>(srcObj[k]));
	array.sort((a, b) => {
		if ( descendingOrder ){
			return a[sortIndex] > b[sortIndex] ? -1 : 1;
		} else {
			return a[sortIndex] < b[sortIndex] ? -1 : 1;
		}
	});
	
	return array
}

function removeChildren(elm){
	while(elm.firstChild){
		elm.removeChild(elm.firstChild);
	}
}


function localFSnote(){
	var fsNoteSpan = document.getElementById("fileSystemNote");
	if ( fsNoteSpan ){
		fsNoteSpan.innerText="端末のブラウザ内にデータを保存します"
	}
}
