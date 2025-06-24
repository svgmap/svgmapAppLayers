// Description: CSISシンプルジオコーディング実験を利用したジオコーダレイヤ
//
// Programmed by Satoru Takagi
// 
// License: (MPL v2)
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.
//
//
// History: jaGeocoderを自営したケースでも使えるようにしています（同実装のネイティブのjsonが返却されること想定)

import {CsisGeocoder} from "./csisGeocoder.js";
import {JaGeocoder} from "./JaGeocoder.js";

var cg;

var jagcHash="jageocoderEndpoint=";
var jagcEndpoint;

window.onload = function () {
	console.log("ONLOAD");
	var proxy; // 不要でした
	if (  svgImageProps.hash.indexOf(jagcHash)>=0){
		jagcEndpoint = svgImageProps.hash.substring(svgImageProps.hash.indexOf(jagcHash)+jagcHash.length);
		console.log("Use jagcEndpoint:",jagcEndpoint);
	}
	if ( jagcEndpoint ){
		cg = new JaGeocoder(jagcEndpoint);
		pageTitle.innerText="Jageocoder"
		referInfo.innerHTML=`<a href="https://t-sagara.github.io/jageocoder/" target="_blank">Jageocoder</a>によるジオコーダを使用`;
	} else {
		cg = new CsisGeocoder(proxy);
	}
	document.getElementById("searchButton").addEventListener("click",searchAddress);
	document.getElementById("addressInput").addEventListener("keydown",function(event){
		if (event.key === 'Enter') {
			searchAddress();
		}
	});
	window.setCenter = setCenter;
}

async function searchAddress(){
	var msg = document.getElementById("messageDiv");
	var address=document.getElementById("addressInput").value;
	if ( !address ){
		msg.innerText="検索するアドレスを入力してください";
		return;
	} else {
//		msg.innerText="";
		removeChildren(msg);
	}
	var ret = await cg.geocode(address);
	console.log(ret);
	var ans =[];
	if ( !ret.candidate && !ret.candidates ){
		msg.innerText="検索できませんでした";
		return;
	}
	if ( ret.candidate instanceof Array ){ // 回答が複数ある
		for ( var can of ret.candidate ){
			var latitude = Number(can.latitude);
			var longitude = Number(can.longitude);
			var level =  Number(can.iLvl);
			var parsedAddress = can.address;
			ans.push({latitude,longitude,level,parsedAddress});
		}
	} else if ( ret.candidate){
		var latitude = Number(ret.candidate.latitude);
		var longitude = Number(ret.candidate.longitude);
		var level =  Number(ret.candidate.iLvl);
		var parsedAddress = ret.candidate.address;
		ans.push({latitude,longitude,level,parsedAddress});
	} else if ( ret.candidates ){ // Jageocoderからの返答
		for ( var can of ret.candidates ){
			var latitude = Number(can.y);
			var longitude = Number(can.x);
			var level =  Number(can.level);
			var parsedAddress = can.matched;
			ans.push({latitude,longitude,level,parsedAddress});
		}
	}
	
	console.log(ans);
	
	if ( ans.length==1 ){
		if ( window.svgMap){
			setCenter(ans[0].latitude,ans[0].longitude,cg.levelDict[ans[0].level][1]);
		}
	}
	var tbl = document.createElement("table");
	tbl.style.fontSize="11px";
	tbl.insertAdjacentHTML("beforeend","<tr><th>アドレス候補</th><th>レベル</th><th></th></tr>");
	for ( var dat of ans ){
		var lvl=cg.levelDict[dat.level];
		var elm=`<tr><td>${dat.parsedAddress}</td><td>${lvl[0]}</td><td><input value="表示" type="button" onclick="setCenter(${dat.latitude},${dat.longitude},${lvl[1]})"></td></tr>`;
		tbl.insertAdjacentHTML("beforeend",elm);
	}
	msg.appendChild(tbl);
};

function setCenter(lat,lng,radiusKm){
	console.log("setCenter:",lat,lng,radiusKm);
	
	if ( window.svgMap){
		window.svgMap.setGeoCenter(lat,lng,radiusKm/111);
	}
}
function removeChildren(element){
	while (element.firstChild) element.removeChild(element.firstChild);
}
