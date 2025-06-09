// Description:
// USGS Earthquakeレイヤー
//
// Programmed by Satoru Takagi
// 
// License: (MPL v2)
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.
//
// History:
// 2025/03/31 : initial　基本的な表示機能

// 簡易Request URL:
// https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_week.csv
// https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/4.5_month.csv

import{covJsonToDataUrl} from "./covjsonParser.js";

const searchEndpoint =
	"https://earthquake.usgs.gov/fdsnws/event/1/query.geojson?starttime={startDateTime}&endtime={endDateTime}&minmagnitude={minMag}&orderby=time"; // start/endDate: YYYY-MM-DD  minMag:数値

let eqIndexGjs;

let eqDetailMode = null; // 地震の詳細を表示しているモードの時そのtrIDが入る
let showDetailDataOnly=false;


const defaultIndexes = {
	all_day:
		"https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_day.geojson",
	all_week:
		"https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_week.geojson",
	all_month:
		"https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_month.geojson",
	m2p5_day:
		"https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/2.5_day.geojson",
	m2p5_week:
		"https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/2.5_week.geojson",
	m2p5_month:
		"https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/2.5_month.geojson",
	m4p5_day:
		"https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/4.5_day.geojson",
	m4p5_week:
		"https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/4.5_week.geojson",
	m4p5_month:
		"https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/4.5_month.geojson",
};

let searchURL = defaultIndexes.m2p5_day;

onload = async function () {
	addEventListener("zoomPanMap", zpmFunc);
	svgMap.setShowPoiProperty(eqShowProperty, layerID);
	changeTimeSpanSelect.addEventListener("change", tsSel);
	searchSpan.addEventListener("click", customSpanSel);
	retuenToListBtn.addEventListener("click",changeToListMode);
	detailOnlyCk.addEventListener("click",changeDetailListMode);
	await tsSel();
	zpmFunc();
};

async function tsSel() {
	console.log(
		changeTimeSpanSelect.options[changeTimeSpanSelect.selectedIndex].value
	);
	let searchURL;
	switch (
		changeTimeSpanSelect.options[changeTimeSpanSelect.selectedIndex].value
	) {
		case "m2p5_day":
			customSpan.style.display = "none";
			searchURL = defaultIndexes.m2p5_day;
			await updateIndexData(searchURL);
			break;
		case "m2p5_week":
			customSpan.style.display = "none";
			searchURL = defaultIndexes.m2p5_week;
			await updateIndexData(searchURL);
			break;
		case "m4p5_month":
			customSpan.style.display = "none";
			searchURL = defaultIndexes.m4p5_month;
			await updateIndexData(searchURL);
			break;
		case "custom":
			customSpan.style.display = "";
			setDefaultCustomSpan();
			console.log(customSpan);
			break;
	}
}

async function updateIndexData(searchURL) {
	console.log("updateIndexData");
	try {
		eqIndexGjs = await (await fetch(svgMap.getCORSURL(searchURL))).json();
		window.eqIndexGjs = eqIndexGjs;
		const schemas = getMetaSchema(eqIndexGjs);
		eqIndexGjs.commonSchema = schemas.schema;
		eqIndexGjs.nonNullSchema = schemas.nonNullSchema;
		svgImage.documentElement.setAttribute(
			"property",
			eqIndexGjs.commonSchema.join()
		);
		console.log("eqIndexGjs:", eqIndexGjs);
		drawEpiCenters();
		showEqList(eqIndexGjs, true);
	} catch (e) {
		console.error(e);
	}
}

function drawEpiCenters(){
	const epicenters = svgImage.getElementById("epicenters");
	removeChildren(epicenters);
	let eqidx;
	if ( showDetailDataOnly ){
		eqidx = getDetailDataOnly();
	} else {
		eqidx = eqIndexGjs;
	}
	svgMapGIStool.drawGeoJson(
		eqidx,
		layerID,
		"red",
		2,
		"pink",
		"syl0",
		"EQ",
		null,
		epicenters,
		eqIndexGjs.commonSchema
	);
	svgMap.refreshScreen();
}

function getDetailDataOnly(){
	var ans ={
		type:"FeatureCollection",
		features:[],
		commonSchema:eqIndexGjs.commonSchema,
		metadata:eqIndexGjs.metadata,
		nonNullSchema:eqIndexGjs.nonNullSchema,
	}
	
	for (let ft of eqIndexGjs.features ){
		if ( ft.properties.mmi ){
			ans.features.push(ft);
		}
	}
	return ans;
}

function getMetaSchema(gjs) {
	const schema = {};
	const nonNullSchema = {};
	for (var ft of gjs.features) {
		var props = ft.properties;
		for (var pn in props) {
			if (!schema[pn]) {
				schema[pn] = true;
			}
			if (!nonNullSchema[pn] && props[pn]) {
				nonNullSchema[pn] = true;
			}
			if (pn == "time" || pn == "updated") {
				props[pn] = new Date(props[pn]).toLocaleString();
			}
		}
	}
	return {
		schema: Object.keys(schema),
		nonNullSchema: Object.keys(nonNullSchema),
	};
}

function customSpanSel(event) {
	trimDate(event.target);
	const csStr = getCustomSpanStr();
	let searchURL = searchEndpoint
		.replace("{startDateTime}", getUtcTimeStr(`${csStr.from} 00:00:00`))
		.replace("{endDateTime}", getUtcTimeStr(`${csStr.to} 23:59:59`))
		.replace("{minMag}", csStr.minMag);
	if ( document.getElementById("vpsearchCk").checked){
		searchURL = searchURL+getGeoBoundsQuery();
	}
	console.log("customSpanSel:", csStr, " searchURL:", searchURL);
	updateIndexData(searchURL);
}

function getUtcTimeStr(localTimeStr) {
	// localTimeStr: YYYY/MM/DD HH:MM:SS
	const dt = new Date(localTimeStr);
	const year = dt.getUTCFullYear();
	const month = String(dt.getUTCMonth() + 1).padStart(2, "0");
	const day = String(dt.getUTCDate()).padStart(2, "0");
	const hours = String(dt.getUTCHours()).padStart(2, "0");
	const minutes = String(dt.getUTCMinutes()).padStart(2, "0");
	const seconds = String(dt.getUTCSeconds()).padStart(2, "0");
	const ans = `${year}/${month}/${day}%20${hours}%3A${minutes}%3A${seconds}`;
	return ans;
}

function trimDate(targetElm) {
	const today = new Date();
	//console.log("trimDate:",new Date(targetElm.value) , today);
	if (new Date(targetElm.value) > today) {
		targetElm.value = today.toISOString().split("T")[0];
	}
}

function getCustomSpanStr() {
	let ans = {};
	if (new Date(fromDatePicker.value) > new Date(toDatePicker.value)) {
		ans.from = toDatePicker.value;
		ans.to = fromDatePicker.value;
	} else {
		ans.from = fromDatePicker.value;
		ans.to = toDatePicker.value;
	}
	ans.minMag = minMagInput.value;
	return ans;
}

function setDefaultCustomSpan() {
	const today = new Date();
	const daysAgo = new Date(today);
	daysAgo.setDate(today.getDate() - 30);
	console.log("today:", today, "  daysAgo:", daysAgo);
	fromDatePicker.value = daysAgo.toISOString().split("T")[0];
	toDatePicker.value = today.toISOString().split("T")[0];
	console.log(
		"setDefaultCustomSpan:",
		fromDatePicker.value,
		toDatePicker.value
	);
}

function clearAllTiles() {
	var tiles = svgImage.getElementsByTagName("image");
	for (var i = tiles.length - 1; i >= 0; i--) {
		let tile = tiles[i];
		tile.remove();
	}
}

function changeDetailListMode(){
	if ( document.getElementById("detailOnlyCk").checked){
		showDetailDataOnly = true;
	} else {
		showDetailDataOnly=false;
	}
	console.log("changeListMode:",showDetailDataOnly);
	drawEpiCenters();
	zpmFunc();
}

function zpmFunc() {
	console.log("zpm usgs eq");
	showEqList(eqIndexGjs, true);
}

function removeChildren(ele) {
	while (ele.firstChild) {
		ele.removeChild(ele.firstChild);
	}
}

function showEqList(eqListGjs, onViewportOnly) {
	const exculdeNames = {
		status: true,
		net: true,
		ids: true,
		sources: true,
		types: true,
	};
	

	console.log("eqListGjs:", eqListGjs);
	const ttbl = document.getElementById("eqList");
	removeChildren(ttbl);
	var tr = `<tr>`;
	for (var pn of eqListGjs.nonNullSchema) {
		// commonSchema vs nonNullSchema
		if (exculdeNames[pn]) {
			continue;
		}
		tr += `<th>${pn}</th>`;
	}
	tr += `</tr>`;
	ttbl.insertAdjacentHTML("beforeend", tr);
	for (var eq of eqListGjs.features) {
		if (inViewPort(eq.geometry.coordinates) == false) {
			continue;
		}
		var eqdata = eq.properties;
		if (showDetailDataOnly && !eqdata.mmi){
			continue;
		}
		var trID = `urlID:${eqdata.url}`;
		var tr = `<tr id="${trID}">`;
		for (var pn of eqListGjs.nonNullSchema) {
			if (exculdeNames[pn]) {
				continue;
			}
			if (pn == "url") {
				tr += `<td><a href="${eqdata[pn]}" target="_blank">detail page</a></td>`;
			} else if (pn == "detail") {
				if ( eqdata.mmi){ // mmiがあるものだけが詳細表示可能なデータであると見做す　多分当たりだと思うんだけどね
					tr += `<td><input type="button" onClick="selectEq('${eqdata[pn]}','${trID}')" value="詳細表示"></input></td>`;
				} else  {
					tr += `<td>-</td>`;
				}
			} else {
				tr += `<td>${eqdata[pn]}</td>`;
			}
		}
		tr += `</tr>`;
		ttbl.insertAdjacentHTML("beforeend", tr);
	}
}

window.selectEq = async function (detailURL, trID) {
	var eqInfo = await (await fetch(svgMap.getCORSURL(detailURL))).json();
	console.log("selectEq:", detailURL, eqInfo,eqInfo?.properties.products);
	if ( eqInfo && eqInfo?.properties.products  ){
		var pdc = eqInfo?.properties.products;
		console.log("pdc:", pdc);
		if ( pdc.shakemap?.length>0){
			var sm = pdc.shakemap[0];
			console.log("sm:", sm);
			if (sm.contents?.["download/coverage_mmi_high_res.covjson"]){
				showMMImap(eqInfo,trID);
			} else {
				console.warn("has shakemap product but no mmi map");
			}
		} else {
			console.warn("no shakemap product");
		}
	} else {
		console.warn("no products exit.");
	}
};

async function showMMImap(eqInfo,trID){
	
	var sm = eqInfo.properties.products.shakemap[0];
	var covjUrl = sm.contents?.["download/coverage_mmi_high_res.covjson"].url;
	var smProps = sm.properties;
	
	let epiCenter = [smProps.longitude,smProps.latitude]
	try{
		var mmiRaster = await (await fetch(svgMap.getCORSURL(covjUrl))).json();
		var mmiCov = covJsonToDataUrl(mmiRaster);
		console.log(mmiCov);
		const imgUrl=mmiCov.dataUrl;
//		document.getElementById("msgDiv").innerHTML=`<img src="${imgUrl}"/>`;
		var imgBnd = mmiCov.metadata.bounds;
		
		var imgSrc = `<image 
		xlink:href="${mmiCov.dataUrl}" 
		x="${100*imgBnd.west}" 
		y="${-100*imgBnd.north}" 
		width="${100*(imgBnd.east-imgBnd.west)}" 
		height="${100*(imgBnd.north-imgBnd.south)}" 
		preserveAspectRatio="none" />`;
		var tgtDG = svgImage.getElementById("distribution");
		removeChildren(tgtDG);
		tgtDG.insertAdjacentHTML("beforeend",imgSrc);
		
		var title="epicenter";
		if ( eqInfo.properties.title){
			title = eqInfo.properties.title;
		}
		var ecSrc =`<use xlink:href="#p0" transform="ref(svg,${100*epiCenter[0]},${-100*epiCenter[1]})" xlink:title="${title}"/>`;
		var tgtCG = svgImage.getElementById("epicenter");
		removeChildren(tgtCG);
		tgtCG.insertAdjacentHTML("beforeend",ecSrc);
		highlightDisplayedEQ(trID,document.getElementById("eqList"));
		changeToDetailMode(trID,eqInfo);
		svgMap.refreshScreen();
	} catch ( e ){
		console.error(e);
	}
}

function changeToDetailMode(trID,eqInfo){
	const epicenters = svgImage.getElementById("epicenters");
	removeChildren(epicenters);
	document.getElementById("eqListMode").style.display="none";
	document.getElementById("eqDetailMode").style.display="";
	eqDetailMode = trID;
	showDetailInfo(eqInfo);
}

function showDetailInfo(eqInfo){
	var dit = document.getElementById("detailInfoTable");
	if ( dit ){dit.remove()}
	
	var table ="<table style='font-size:11px' id='detailInfoTable'>";
	for ( var k in eqInfo.properties){
		if ( k =="products"){continue}
		var val = eqInfo.properties[k];
		if ( k=="time" || k=="updated"){
			val = new Date(val).toLocaleString();
		}
		table+=`<tr><td>${k}</td><td>${val}</td></tr>`;
	}
	var sm = eqInfo.properties.products.shakemap[0]
	for ( var k in sm.properties){
		var val = sm.properties[k];
		table+=`<tr><td>${k}</td><td>${val}</td></tr>`;
	}
	table+="</table>";
	document.getElementById("eqDetailMode").insertAdjacentHTML("beforeend",table);
	document.documentElement.scrollTop=0

	var legendUrl = sm.contents?.["download/mmi_legend.png"].url;
	if (legendUrl){
		legendImg.setAttribute("src",legendUrl);
		legendImg.style.display="";
	} else {
		legendImg.style.display="none";
	}
	
}

function changeToListMode(){
	const epicenter = svgImage.getElementById("epicenter");
	removeChildren(epicenter);
	const epidistribution = svgImage.getElementById("distribution");
	removeChildren(epidistribution);
	eqDetailMode = null;
	highlightDisplayedEQ(null,document.getElementById("eqList"));
	document.getElementById("eqListMode").style.display="";
	document.getElementById("eqDetailMode").style.display="none";
	drawEpiCenters();
}


function getGeoBoundsQuery(){
	var vp = svgImageProps.geoViewBox;
		var q = `&maxlatitude=${Math.ceil((vp.y+vp.height)*1000)/1000}&minlatitude=${Math.floor(vp.y*1000)/1000}&maxlongitude=${Math.ceil((vp.x+vp.width)*1000)/1000}&minlongitude=${Math.floor(vp.x*1000)/1000}`;
	return q;
}

function inViewPort(pos) {
	var vp = svgImageProps.geoViewBox;
	if (
		vp.x <= pos[0] &&
		pos[0] <= vp.x + vp.width &&
		vp.y <= pos[1] &&
		pos[1] <= vp.y + vp.height
	) {
		return true;
	} else {
		return false;
	}
}

function eqShowProperty(target) {
	var metaSchema = null;
	if (target.ownerDocument.firstChild.getAttribute("property")) {
		metaSchema = target.ownerDocument.firstChild
			.getAttribute("property")
			.split(","); // debug 2013.8.27
		console.log("metaSchema:", metaSchema);
	}
	var urlCol = metaSchema.indexOf("url");
	var titleAndLayerName = "";
	if (target.getAttribute("data-title")) {
		titleAndLayerName =
			target.getAttribute("data-title") +
			"/" +
			target.getAttribute("data-layername") +
			"\n";
	}

	if (target.getAttribute("content")) {
		// contentメタデータがある場合
		var metaData = svgMap.parseEscapedCsvLine(target.getAttribute("content"));
		console.log("metaData:", metaData);
		var url = metaData[urlCol];
		if (url) {
			console.log("targetURL:", url);
			//highlightAndScrollToRow(rowID,table)
			//			document.getElementById(`urlID:${url}`);
			highlightAndScrollToRow(
				`urlID:${url}`,
				document.getElementById("eqList")
			);
		}
	}
}

function highlightAndScrollToRow(rowID, table) {
	console.log(table);
	let targetRow;
	if ( rowID){
		targetRow = document.getElementById(rowID);
	}
	
	// すでにハイライトされている行があれば、ハイライトを解除
	const highlightedRows = table.getElementsByClassName("highlighted-row");
	while (highlightedRows.length > 0) {
		highlightedRows[0].classList.remove("highlighted-row");
	}
	
	if (!targetRow) {
		return;
	}

	// 指定された行をハイライト
	targetRow.classList.add("highlighted-row");

	// 指定された行が画面内に表示されるようにスクロール
	targetRow.scrollIntoView({
		//behavior: "smooth", // スムーズスクロール
		block: "center", // 行を画面中央に表示
	});
}

function highlightDisplayedEQ(rowID, table) {
	console.log(table);
	const targetRow = document.getElementById(rowID);
//	const targetBtnCell = targetRow.getElementsByTagName("input")[0].parentElement;

	// すでにハイライトされているセルがあれば、ハイライトを解除
	const highlightedRows = table.getElementsByClassName("displayed-highlighted-button");
	while (highlightedRows.length > 0) {
		highlightedRows[0].classList.remove("displayed-highlighted-button");
	}
	
	if (!targetRow) {
		return;
	}
	
	// クリックでハイライトされている行も解除
	highlightAndScrollToRow(null,table);

	// 指定された行をハイライト
	targetRow.classList.add("displayed-highlighted-button");
}
