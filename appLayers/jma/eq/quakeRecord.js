// 気象庁　震度データベースページ
// https://www.data.jma.go.jp/svd/eqdb/data/shindo/index.html
//を可視化する
//  Programmed by Satoru Takagi
//  
//  Copyright (C) 2024 by Satoru Takagi @ KDDI CORPORATION
//  
// License: (GPL v3)
//  This program is free software: you can redistribute it and/or modify
//  it under the terms of the GNU General Public License version 3 as
//  published by the Free Software Foundation.
//  
//  This program is distributed in the hope that it will be useful,
//  but WITHOUT ANY WARRANTY; without even the implied warranty of
//  MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
//  GNU General Public License for more details.
//  
//  You should have received a copy of the GNU General Public License
//  along with this program.  If not, see <http://www.gnu.org/licenses/>.


var APIURI = "https://www.data.jma.go.jp/svd/eqdb/data/shindo/api/api.php";
//1919/1/1-

var yearSel , monthSel, eqSel, maxiSel;


onload = function () {
	initUI();
	//await getIndexData();
	selectMonth();
	if ( typeof svgMap == "object"){
		svgMap.setShowPoiProperty(customDialog, layerID);
	}
};

var selectedEventId;
function customDialog(target){
	selectedQuakeId=null;
	var poiCat = target.parentElement.id;
	console.log("poiCat:",poiCat);
	var metaData = target.getAttribute("content").split(",");
	var metaSchema = target.ownerDocument.firstChild.getAttribute("property").split(",");
	var message;
	if ( poiCat == "quakes"){
		selectedEventId = target.getAttribute("data-eventID");
		message="<table border='1' style='word-break: break-all;table-layout:fixed;width:400px;border:solid orange;border-collapse: collapse'>"
		if ( metaSchema && metaSchema.length == metaData.length ){
			for ( var i = 0 ; i < metaSchema.length ; i++ ){
				var data = "--";
				if ( metaData[i]!=""){
					data = metaData[i];
				}
				message += "<tr><td>"+metaSchema[i] + " </td><td> " + (data) + "</td></tr>";
			}
		}
		message += "</table>";
		if (!selectedEventId){
			svgMap.showModal(message,400,200);
		} else {
			svgMap.setCustomModal(message,["震度分布表示","CLOSE"],dialogProcessCB);
		}
	} else {
		message="<table border='1' style='word-break: break-all;table-layout:fixed;width:100%;border:solid orange;border-collapse: collapse'>"
		message+=`<tr><td>震度</td><td>${metaData[0]}</td></tr>`;
		message+=`<tr><td>場所</td><td>${metaData[1]}</td></tr>`;
		message+=`<tr><td>CODE</td><td>${metaData[2]}</td></tr>`;
		message += "</table>";
		svgMap.showModal(message,400,200);
	}
}

function dialogProcessCB(param){ // 震源標示から震度分布表示に遷移させる機能を実装
	console.log("dialogProcessCB:",param);
	if (param==0){
		eqSel.selectedIndex=searchEventIndex(selectedEventId);
		selectEq();
	}
}

function searchEventIndex(evId){
	for ( var i = 0 ; i < eqSel.options.length ; i++){
		if ( eqSel.options[i].value==evId){
			return i;
		}
	}
}

function initUI(){
	yearSel = document.getElementById("yearSel");
	monthSel = document.getElementById("monthSel");
	eqSel = document.getElementById("eqSel");
	maxiSel = document.getElementById("maxiSel");
	
	for ( var y = new Date().getFullYear() ; y >=1919 ; y-- ){
		yearSel.insertAdjacentHTML("beforeend", `<option value="${y}">${y}年</option>`);
	}
	yearSel.insertAdjacentHTML("beforeend", `<option value="ALL">全期間</option>`);
	var currentMonth = new Date().getMonth();
	for ( var m = 11 ; m >=0 ; m-- ){
		var ss="";
		if ( m == currentMonth){ ss="selected"};
		monthSel.insertAdjacentHTML("beforeend", `<option ${ss} value="${m}">${m+1}月</option>`);
	}
	monthSel.insertAdjacentHTML("beforeend", `<option value="Y1">～1年間</option>`);
	monthSel.insertAdjacentHTML("beforeend", `<option value="Y5">～5年間</option>`);
	monthSel.insertAdjacentHTML("beforeend", `<option value="Y10">～10年間</option>`);
	monthSel.insertAdjacentHTML("beforeend", `<option value="Y100">～100年間</option>`);
	
	for ( var ks of intK){
		maxiSel.insertAdjacentHTML("beforeend", `<option value="${ks[1]}">震度${ks[0]}以上</option>`);
	}
	
	/**
	yearSel.addEventListener("change",selectMonth);
	monthSel.addEventListener("change",selectMonth);
	**/
	document.getElementById("searchDB").addEventListener("click",selectMonth);
	eqSel.addEventListener("change",selectEq);
}

async function selectMonth(){
	var y = -1;
	var m = -1;
	var yspan = -1;
	
	var ystr = (yearSel.options[yearSel.selectedIndex].value);
	if ( ystr == "ALL" ){
		// 全期間対象
		y = 1919;
		m = 0;
		yspan = 300;
	} else {
		y = Number(ystr);
	}
	
	var mstr = (monthSel.options[monthSel.selectedIndex].value);
	if ( mstr.substring(0,1)=="Y" ){
		yspan = Number(mstr.substring(1));
		m = 0;
	} else {
		m = Number(mstr);
	}
	//console.log(y,m,yspan);
	var ct = new Date();
	var dateFrom = new Date(y, m, 1);
	var dateTo;
	if ( yspan >0){
		dateTo = new Date(y + yspan, 0, 0);
	} else {
		dateTo = new Date(y, m+1, 0); 
	}
	if( y == new Date().getFullYear() && m > new Date().getMonth()  ){ // fromが来月以降なら
		// 今月1日に修正
		dateFrom = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
		// yspan設定でない場合はその月に強制
		if ( yspan ==-1){
			for ( var i = 0 ; i < monthSel.options.length ; i++ ){
				if (monthSel.options[i].value==ct.getMonth()){
					monthSel.selectedIndex=i;
					break;
				}
			}
		}
	}
	if ( dateTo.getTime() > new Date().getTime()-1000*60*60*24*2){ // toが今日の二日前以降なら
		dateTo = new Date(new Date().getTime()-1000*60*60*24*2); // 今日の二日前に修正
	}
	
	var maxi = maxiSel.options[maxiSel.selectedIndex].value;
	//console.log(dateFrom, dateTo,maxi);
	showMessage([dateFrom.toLocaleString()+" - "+dateTo.toLocaleString(),"の期間のインデックスデータ取得中"]);
	var idat = await getIndexData(dateFrom, dateTo,maxi);
	buildIndexTable(idat);
	showMessage(idat.str);
	indexCache = idat;
	if ( typeof svgImage == "object"){
		drawIndexData();
	}
}

function showMessage(msg){
	if ( Array.isArray(msg)){
		for ( var i = 0 ; i < 3 ; i++ ){
			if (  i < msg.length){
				window.document.getElementById(`mspan${i}`).innerText=msg[i];
			} else {
				window.document.getElementById(`mspan${i}`).innerText="";
			}
		}
	} else {
		window.document.getElementById(`mspan0`).innerText=msg;
		for ( var i = 1 ; i < 3 ; i++ ){
			window.document.getElementById(`mspan${i}`).innerText="";
		}
	}
}

function buildIndexTable(idat){
	removeChildren(eqSel);
	eqSel.insertAdjacentHTML("beforeend", `<option value="-">該当期間の震央をすべて表示</option>`);
	for ( var eq of idat.res){
		icolor = getIntColor(hankaku2Zenkaku(eq.maxI.substring(2)));
		//console.log(icolor);
		eqSel.insertAdjacentHTML("beforeend", `<option style="background-color:${icolor}" value="${eq.id}">${eq.ot.substring(0,16)} mag.${eq.mag} 最大${eq.maxI} ${eq.name}</option>`);
	}
}

function getQuakeContent( quake ){
	
	var ans = { 
		mag : Number(quake.mag),
		lat : Number(quake.lat),
		lon : Number(quake.lon),
		depth : Number(quake.dep),
		id : quake.id,
		name : quake.name,
		content:`${quake.mag},${quake.maxI},${quake.dep},${quake.ot},${quake.name},${quake.id}`,
		text:`マグニチュード${quake.mag}, 最大${quake.maxI}, 深さ${quake.dep}, 時刻${quake.ot}, ${quake.name}`,
	};
	return ans;
}

var indexCache;
function drawIndexData(){
	if ( !indexCache ){ return };
	//console.log("drawIndexData:",indexCache);
	removeChildren(window.svgImage.getElementById("obst"));
	removeChildren(window.svgImage.getElementById("quakes"));
	for ( var eq of indexCache.res){
		//icolor = getIntColor(hankaku2Zenkaku(eq.maxI.substring(2)));
		icolor = "blue";
		var content = getQuakeContent(eq)
		if ( isNaN(content.lon)){continue};
		if ( isNaN(content.mag)){ content.mag=0.5}
		var cr = window.svgImage.createElement("circle");
		cr.setAttribute("cy",0);
		cr.setAttribute("cx",0);
		cr.setAttribute("transform",`ref(svg,${content.lon * 100},${ -content.lat * 100})`);
		cr.setAttribute("r",content.mag*2);
		cr.setAttribute("fill",icolor);
		cr.setAttribute("content", content.content);
		cr.setAttribute("data-eventID",content.id);
		window.svgImage.getElementById("quakes").appendChild(cr);
	}
	window.svgMap.refreshScreen();
}

async function selectEq(){
	var eqId = eqSel.options[eqSel.selectedIndex].value;
	//console.log("eqId:",eqId);
	if ( eqId !="-"){
		showMessage("地震データ取得中 :"+eqSel.options[eqSel.selectedIndex].innerText);
		var eqDat = await getEventData(eqId);
		//console.log("eqDat:",eqDat);
		var eqcc = getQuakeContent(eqDat.res.hyp[0]); 
		showMessage(["表示 :", eqcc.text]);
		if ( typeof svgImage == "object"){
			drawObs(eqDat);
		}
	} else {
		drawIndexData();
	}
}

function drawObs(eqDat){
	var obg = window.svgImage.getElementById("obst");
	var qks = window.svgImage.getElementById("quakes")
	removeChildren(obg);
	removeChildren(qks);
	for ( var eqc of eqDat.res.hyp){
		var eqcc = getQuakeContent(eqc);
		var qcUse = window.svgImage.createElement("use");
		qcUse.setAttribute("xlink:href","#qc");
		qcUse.setAttribute("transform",`ref(svg,${eqcc.lon*100},${-eqcc.lat*100})`);
		qcUse.setAttribute("content",eqcc.content);
		qks.appendChild(qcUse);
		
	}
	for ( var i = eqDat.res.int.length -1 ; i >= 0 ; i-- ){
		var obs = eqDat.res.int[i];
		var qcUse = window.svgImage.createElement("use");
		qcUse.setAttribute("xlink:href",getIntColor(hankaku2Zenkaku(obs.int.substring(2)),true)+"v");
		qcUse.setAttribute("transform",`ref(svg,${obs.lon*100},${-obs.lat*100})`);
		qcUse.setAttribute("content",`${obs.int},${obs.name},${obs.code}`);
		obg.appendChild(qcUse);
		//console.log(qcUse);
	}
	window.svgMap.refreshScreen();
}

async function getIndexData(fromDate,toDate,maxi) {
	if(!toDate){
		toDate = new Date(new Date().getTime()-1000*60*60*24*2);
	}
	if (!fromDate){
		fromDate = new Date(toDate.getTime()-1000*60*60*24*10);
	}
	var req={
		mode: "search",
		"dateTimeF[]": [getTimeStrs(fromDate),"00:00"],
		"dateTimeT[]": [getTimeStrs(toDate),"23:59"],
		"mag[]": [0.0,9.9],
		"dep[]": ["000","999"],
		"epi[]": 99,
		"pref[]": 99,
		"city[]": 99,
		"station[]": 99,
		obsInt: 1,
		maxInt: maxi,
		additionalC: false,
		Sort: "S0",
		Comp: "C0",
		seisCount: false,
		observed: false,
	}
	var dat = await fetchEqDataAPI(req);
	//console.log(dat);
	return(dat);
}

// APIのmaxInti値
var intK=[
	["1","1"],
	["2","2"],
	["3","3"],
	["4","4"],
	["5弱","A"],
	["5強","B"],
	["6弱","C"],
	["6強","D"],
	["7","7"],
];


function getTimeStrs(dateObj){
	var str = new Date(dateObj.getTime()+9*60*60*1000).toISOString();
	return str.substring(0,10);
}

async function getEventData(eqId) {
	if (!eqId){return null}
	var req={
		mode: "event",
		id: eqId
	}
	var dat = await fetchEqDataAPI(req);
	return(dat);
}

async function fetchEqDataAPI(req) {
	const formData = new FormData();
	for ( var key in req){
		if ( Array.isArray(req[key])){
			//console.log("array:",key);
			for ( var val of req[key]){
				formData.append(key, val);
			}
		} else {
			formData.append(key, req[key]);
		}
	}
	//console.log(req,formData);
	const request = new Request(svgMap.getCORSURL( APIURI), {
		method: "POST",
		headers: {
		},
		body: formData,
	});
	const res = await fetch(request);
	const json = await res.json();
	return ( json);
}

function removeChildren(ele){
	while( ele.firstChild ){
	  ele.removeChild( ele.firstChild );
	}
}

function hankaku2Zenkaku(str) {
    return str.replace(/[Ａ-Ｚａ-ｚ０-９]/g, function(s) {
        return String.fromCharCode(s.charCodeAt(0) - 0xFEE0);
    });
}


// ISSUE 震度5弱,6弱は判明　5強,6強がまだ判明していないので検索できないかも
// 震度記号,色,アイコンID,震度文字列,色2(pngアイコンより取得)
var intLegend=[
	["1","#e0e0ef","#q1","1","#f2f2ff"],
	["2","#80baff","#q2","2","#00aaff"],
	["3","#80a1ff","#q3","3","#0041ff"],
	["4","#fae696","#q4","4","#fae696"],
	["5-","#ffe600","#q5m","5弱","#ffe600"],
	["5+","#ff9900","#q5p","5強","#ff9900"],
	["6-","#ff2800","#q6m","6弱","#ff2800"],
	["6+","#a50021","#q6p","6強","#a50021"],
	["7","#b40068","#q7","7","#b40068"]
]

function getIntColor(int,byIcon){
	//console.log(int);
	if ( !int ){return ( null)}
	for ( var ld of intLegend ){
		if ( ld[0]==int || ld[3]==int){
			if ( byIcon){
				return ( ld[2] );
			} else {
				return ( ld[1] );
			}
		}
	}
	if ( byIcon){
		return ( "#q5p" ); // 震度5強,6強の時が不明なので　とりあえず５強のアイコンを
	} else {
		return ( "#ff0000" ); // 震度5強,6強の時が不明なので　とりあえず赤にしている
	}
}

function showLegend(){
	var tbl = document.getElementById("legendTable");
	tbl.innerHTML="<td style='font-size:12px'>自治体の最大震度</td>";
	for ( var leg of intLegend){
		var td = document.createElement("td");
		td.style.backgroundColor=leg[1];
		td.style.width="20px";
		td.style.fontSize="12px";
		td.innerText=leg[3];
		//console.log(td);
		tbl.appendChild(td);
	}
}
