// Description:
// eStatレイヤーを使って、指定したレイヤーのポリゴンに包含される人口や世帯数を統計する
// 他のレイヤーを連携させて機能させるデザインパターンの習作の側面が強い
//
// Programmed by Satoru Takagi
// 
// License: (MPL v2)
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.

vectorGISlayerName="Vector GIS Lv2";
var vectorGisWindow;

var targetLayerSelId="targetLayer0"

async function openVectorGIS(){
	var spid=svgMap.getLayerId(vectorGISlayerName);
	svgMap.setLayerVisibility(spid,true);
	ready=false;
	while (ready==false){
		await sleep(100);
		var sp=svgMap.getSvgImagesProps()[spid].controllerWindow;
		if ( sp){
			if (sp.completed == true ){
				ready=true;
			}
		} else {
			console.log("wait");
		}
	}
	vectorGisWindow = sp;
	return ( sp );
}

function changePopGISpanel(event){
	if ( event.target.checked){
		popGISui.style.display="";
		initSearchPanel();
	} else {
		popGISui.style.display="none";
		finishSearchPanel();
	}
}

function setSchemaAddendum(vgisWin){
	var sa={};
	for(var sname in estatSchema){
		sa[sname]=estatSchema[sname][2];
	}
	vgisWin.schemaAddendum = sa;
}

async function initSearchPanel(){
	var vgisWin = await openVectorGIS();
	setSchemaAddendum(vgisWin);
	svgMap.setShowPoiProperty(customShowPoiProperty4estat, vgisWin.layerID);
	layerLister.listTargetLayers(targetLayerSelId,[vectorGISlayerName]);
	document.addEventListener("screenRefreshed", layerLister.listTargetLayers , false);
	document.getElementById("doIntersectionButton").addEventListener("click", doPopGIS);
	document.getElementById("showCsvBtn").addEventListener("click", showCsv);
	document.getElementById("saveCsvBtn").addEventListener("click", saveCsv);
	document.getElementById("saveCsvBtn").addEventListener("contextmenu", saveSjisCsv,true);
	document.addEventListener("closeFrame",finishSearchPanel);
}

function finishSearchPanel(){
	document.removeEventListener("screenRefreshed", layerLister.listTargetLayers , false);
	document.removeEventListener("closeFrame",finishSearchPanel);
	var spid=svgMap.getLayerId(vectorGISlayerName);
	svgMap.setLayerVisibility(spid,false);
}

function getTargetLayerId(seledtTagId){
	var sel = document.getElementById(seledtTagId);
	var layerTitle = sel.options[sel.selectedIndex].value;
	return( svgMap.getLayerId(layerTitle));
}

async function doPopGIS(){
	popGISmessageDiv.innerText="";
	try{
		var source1ID = getTargetLayerId(targetLayerSelId);
	} catch ( e ) {
		console.log("No layer specified exit");
		document.getElementById("hitcount").innerText="Specify both target 1 and 2.";
		return;
	}
	var source2ID = layerID;
	
	var compOptions = {
		areaCompare:true,
		opacity:0.5,
		uniteSource1:true,
		progrssCallback:progressCBF
	}
	
	console.log("source1ID:",source1ID,"  source2ID:",source2ID ," compOptions:",compOptions);
	setCsvStoreUiAvailability(false);
	try{
		await vectorGisWindow.search_api(source1ID,source2ID,compOptions);
	} catch(e){
		console.warn("vectorGisWindow.search_api exception:",e);
	}
	console.log("Computation has been completed.");
	setCsvStoreUiAvailability(true);
}

function progressCBF(percent){
	
	if ( percent < 100 ){
		document.getElementById("popGISmessageDiv").innerHTML= "computing:"+ percent + "/100";
	} else {
		document.getElementById("popGISmessageDiv").innerHTML= "completed!!";
//		document.getElementById("hlt").disabled=true;
//		completed=true;
	}
}

function setCsvStoreUiAvailability(enabled){
	if ( enabled ){
		document.getElementById("csvStoreSpan").style.display="";
		document.getElementById("computingSpan").style.display="none";
	} else {
		document.getElementById("csvStoreSpan").style.display="none";
		document.getElementById("computingSpan").style.display="";
	}
}

async function showCsv(){
	var ret =await vectorGisWindow.showCsv();
	console.log(ret);
	if ( ret==false ){
		popGISmessageDiv.innerText=("検索結果がありません。まず検索してください");
	}
}

function saveCsv(){
	var ret = vectorGisWindow.saveCsv();
	if ( ret ){
		popGISmessageDiv.innerText=("保存しました(SJISで保存は右クリック)");
	} else {
		popGISmessageDiv.innerText=("検索結果がありません。まず検索してください");
	}
}

function saveSjisCsv(event){
	var ret = vectorGisWindow.saveCsv(true);
	event.preventDefault();
	if ( ret ){
		popGISmessageDiv.innerText=("SJIS形式でCSVを保存しました");
	} else {
		popGISmessageDiv.innerText=("検索結果がありません。まず検索してください");
	}
}

var sleep = ms => new Promise(res => setTimeout(res, ms));
