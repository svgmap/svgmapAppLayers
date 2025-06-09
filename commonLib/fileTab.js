// Description: fileTab module
//
// Programmed by Satoru Takagi
// 
// License: (MPL v2)
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.
//
// import {FileManager} from "./FileManager.js";
//import {LocalDBFileManager} from "./LocalDBFileManager.js";
var contentDir = "./contents/";
var fm;
var removeMode=false;
addEventListener("load", init);
const customizerObject={
	setContent:null,
	getContent:null,
	messages:{},
};

function setFileTabCustomizer(obj){
	if ( typeof obj.setContent == "function"){
		customizerObject.setContent = obj.setContent;
	} else {
		customizerObject.setContent =null;
	}
	if ( typeof obj.getContent == "function"){
		customizerObject.getContent = obj.getContent;
	}else {
		customizerObject.getContent = null;
	}
	
	if ( typeof obj.messages?.storeAlert == "string"){
		customizerObject.messages.storeAlert = obj.messages.storeAlert;
	} else {
		customizerObject.messages.storeAlert = null;
	}
	if ( typeof obj.messages?.dateTitle == "string"){
		customizerObject.messages.dateTitle = obj.messages.dateTitle;
	} else {
		customizerObject.messages.dateTitle = null;
	}
	if ( typeof obj.messages?.descTitle == "string"){
		customizerObject.messages.descTitle = obj.messages.descTitle;
	} else {
		customizerObject.messages.descTitle = null;
	}
	if ( typeof obj.messages?.fsNote == "string"){
		customizerObject.messages.fsNote = obj.messages.fsNote;
	} else {
		customizerObject.messages.fsNote = null;
	}
}


async function init(){
	var indexData;
	if ( window.localFileMode=="undefined" || window.localFileMode != true ){
		var module = await import('./FileManager.js');
		fm = new module.FileManager();
		indexData = await fm.init();
	}
	console.log("indexData:",indexData);
	if ( !indexData){
		var module = await import('./LocalDBFileManager.js');
		fm = new module.LocalDBFileManager(svgMap.getLayer(layerID).getAttribute("title"));
		await fm.init();
		localFSnote();
	}
	updateTable();
	if ( svgImageProps.hash ){
		var ipt = contentListTable.querySelector(`input[data-value="${svgImageProps.hash.substring(1)}"]`);
		console.log("searched input element:",ipt);
		if ( ipt ){
			ipt.click();
		}
	}
	postB.addEventListener("click", async function(){
		var descTxt = postText.value;
		if ( !descTxt ){
			if ( customizerObject.messages?.storeAlert){
				alert(customizerObject.messages.storeAlert);
			} else {
				alert("説明文を入力してください。");
			}
			return;
		}
		
		descTxt = descTxt.replaceAll(",","，").replaceAll("\n","").replaceAll("\r","");
		if ( customizerObject.getContent ){
			var customContent = customizerObject.getContent();
			var ret = await fm.registSvgContent(customContent,descTxt);
		} else {
			removeImageIid(svgImage);
			var svgContentXML = fm.xml2Str(svgImage);
			var ret = await fm.registSvgContent(svgContentXML,descTxt);
		}
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
}

function removeImageIid(svgImage){
	var imgs = svgImage.getElementsByTagName("image");
	for ( var img of imgs ){
		img.removeAttribute("iid");
	}
}

var prevTarget;
window.showSvg = async function(event){
	if ( prevTarget ){
		prevTarget.parentElement.parentElement.style.backgroundColor="";
	}
	if ( prevTarget === event.target ){
		prevTarget = undefined;
		if ( customizerObject.setContent){
			customizerObject.setContent();
		} else {
			removeAllShapes();
			svgMap.refreshScreen();
		}
		svgImageProps.hash="";
		return;
	}
	event.target.parentElement.parentElement.style.backgroundColor="orange";
	prevTarget = event.target;

	var targetMeta = fm.indexData[event.target.getAttribute("data-value")];
	var targetFile = targetMeta[0];
	console.log(targetMeta);
	if ( removeMode ){
		await fm.removeSvgContent(targetFile);
		updateTable();
	} else {
		console.log("SHOW File:",targetFile);
		svgImageProps.hash=`#${targetFile}`;
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
	
	if ( customizerObject.setContent){
		customizerObject.setContent(txt);
	} else {
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
		var annotations = svgDoc.getElementById("annotations");
		if ( !annotations){annotations=[]}
		console.log("annotations:",annotations);
		if ( window.initAnnotation){
			window.initAnnotation(annotations);
		}
		
		svgMap.refreshScreen();
	}
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
	var btnMsh = "選択";
	var descStr = "説明";
	if (customizerObject.messages?.descTitle ){
		descStr = customizerObject.messages.descTitle;
	}
	if (customizerObject.messages?.dateTitle ){
		hdmsg = customizerObject.messages.dateTitle;
	}
	if ( removeMode ){
		hdmsg = "ファイル名";
		btnMsh = "削除";
	}
	contentListTable.insertAdjacentHTML("beforeend",`<tr><th></th><th>${hdmsg}</th><th>${descStr}</th></tr>`);
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
		let fsNote = "端末のブラウザ内にデータを保存します";
		if (customizerObject.messages?.fsNote ){
			fsNote = customizerObject.messages.fsNote;
		}
		fsNoteSpan.innerText = fsNote;
	}
}

export {setFileTabCustomizer};