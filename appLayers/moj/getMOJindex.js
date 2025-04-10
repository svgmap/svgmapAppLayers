// getMOJindex, getDistribution module
//
// Programmed by Satoru Takagi
// 
// License: (MPL v2)
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.
//

import {CsisGeocoder} from "./csisGeocoder.js";

var cg;

async function getMOJindex(path, progressCbf){
	var indexData = await readCsvSJIS(path);
	//console.log(indexData);
	var proxy ; // 不要でした
	cg = new CsisGeocoder(proxy);
	if ( progressCbf ){
		progressCbf("インデックスデータを読み込み中");
	}
	var prefCodes = await readJSON("./prefCode.json");
	console.log("prefCode:",prefCode);
	var prefCode = path.substring(path.lastIndexOf("/")+1,path.lastIndexOf("/")+3);
	console.log("prefCode:",prefCode);
	for ( var p of prefCodes){
		if ( prefCode == p[0]){
			pref = p[1];
			break;
		}
	}
	if ( !pref){
		console.error("県名がわからないため中断・・");
		return ( null );
	}
	
	var fileNameDict = buildFileNameDict(indexData);
	//console.log(indexData);
	if ( progressCbf ){
		progressCbf("代表点のジオコーディング中");
	}
	await doGeoCode(fileNameDict, progressCbf);
	return ( {roughIndex:fileNameDict, fullIndex:makeFullIndex(indexData)});
}

function makeFullIndex(indexData){
	var ans={};
	for ( var d of indexData){
		var fnKey = d[0];
		if ( fnKey.indexOf(".zip")>0){
			if ( !ans[fnKey] ){
				ans[fnKey]=[];
			}
			ans[fnKey].push(d);
		}
	}
	return ans;
}

async function getDistribution(areaIndex, progressCbf){
	console.log("getDistribution:",areaIndex);
	var idx = pickIndexes(areaIndex.length , 50);
	console.log("getDistribution: idx",idx);
	var dist=[];
	for ( var i of idx ){
		dist.push(areaIndex[i]);
	}
	await doGeoCode(dist, progressCbf);
	return ( dist );
}

function pickIndexes(len, maxCount){
	var ans={};
	for ( var i = 0 ; i < maxCount ; i++){
		var idx = Math.floor(len * Math.random());
		if ( !ans[idx]){
			ans[idx]=true;
		}
	}
	//console.log(ans);
	var ret=[];
	for ( var is in ans){
		ret.push(Number(is));
	}
	ret = ret.sort();
	return ret;
}

function buildFileNameDict(dat){
	var ans = {};
	for ( var row of dat ){
		var fileName = row[0]
		var chiban = row[3];
		var kuiki = row[2];
		var nen = row[1];
		//console.log(chiban);
		if ( !ans[fileName] ){
			if (chiban ==""){
				ans[fileName]=[nen,kuiki,""];
			} else if ( chiban == undefined ){
				// skip
			} else if ( chiban.match(/^[0-9\-]+$/)){
				ans[fileName]=[nen,kuiki,chiban];
			} else {
				// skip
			}
		} else {
			if (chiban !="" && chiban.match(/^[0-9\-]+$/)){
				ans[fileName]=[nen,kuiki,chiban];
			}
		}
	}
//	var rep =[['ZIPファイル名', '出力年月日・時刻', '地番区域', '地番']];
	var rep =[];
	for ( var fn in ans ){
		var pr = ans[fn];
		rep.push([fn,pr[0],pr[1],pr[2]]);
	}
	return ( rep );
}


var pref;
var doGeoCodeProgress;
async function doGeoCode(dat, progressCbf){
	//console.log("doGeoCode : ",dat);
	var ans = [];
	doGeoCodeProgress={
		total: Object.keys(dat).length,
		progress:0
	}
	for ( var row of dat){
//		var addr = pref + " " + row[2]+" " + row[3];
		var addr = pref  + row[2] + row[3];
//		var addr = pref + " " + row[2]+" " + row[3];
		//console.log(addr);
		ans.push(genericGeoCode(addr,"csis",progressCbf));
	}
	var ans = await Promise.all(ans);
	//console.log(dat,ans);
	
	for ( var i=0 ; i < dat.length; i++){
		dat[i].push(ans[i][0]);
		dat[i].push(ans[i][1]);
	}
}

async function readCsvSJIS(path){
	//http://var.blog.jp/archives/79094563.html
	var res = await fetch(path);
	const ab = await res.arrayBuffer();
	const td = new TextDecoder("Shift_JIS");
	var str = td.decode(ab);
	var rows = str.split("\n");
	var csvData=[];
	for ( var row of rows){
		var cols = (row.trim()).split(",");
		var rowData = [];
		for ( var col of cols){
			rowData.push(col.trim());
		}
		csvData.push(rowData);
	}
	return ( csvData );
}



function hankaku2Zenkaku(str) {
    return str.replace(/[A-Za-z0-9]/g, function(s) {
        return String.fromCharCode(s.charCodeAt(0) + 0xFEE0);
    });
}

async function genericGeoCode(address, geoCodeType, progressCbf){
	if ( geoCodeType == "gsi"){
		address=address.replaceAll(/\s/g,"　");
		address=address.replaceAll(/-/g,"－");
		address=hankaku2Zenkaku(address);
		var ans = await gsiGeoCode(address);
		if ( progressCbf ){
			doGeoCodeProgress.progress++;
			progressCbf(`ジオコーディング中: ${Math.floor(100*doGeoCodeProgress.progress / doGeoCodeProgress.total) }%`);
		}
		//console.log("address:",address,"  ans:",ans);
		if ( !ans || ans.length == 0 ){
			return null;
		} else {
			var certainty="Certainly";
			if (ans.length >1){
				certainty="Uncertain";
			}
			return [ans[0].geometry.coordinates[1],ans[0].geometry.coordinates[0],certainty,ans[0].properties.title];
		}
	} else if( geoCodeType == "csis"){
		var ret = await cg.geocode(address);
		if ( progressCbf ){
			doGeoCodeProgress.progress++;
			progressCbf(`ジオコーディング中: ${Math.floor(100*doGeoCodeProgress.progress / doGeoCodeProgress.total) }%`);
		}
		if ( !ret.candidate ){
			console.warn("検索できませんでした");
			return [];
		}
		var ans;
		if ( ret.candidate instanceof Array ){ // 回答が複数ある
			ans=[ret.candidate[0].latitude,ret.candidate[0].longitude,ret.candidate[0].address];
		} else {
			ans=[ret.candidate.latitude,ret.candidate.longitude,ret.candidate.address];
		}
		return ( ans );
		
	}
}

function compositeLocalGeoCode(address) {
	return new Promise(function(okCallback) {
		compositeGeocoder.getPosition(address, okCallback);
	});
}

async function readJSON(path){
	var res = await fetch(path);
	var js = await res.json();
	return ( js );
}

export {getMOJindex, getDistribution}