// 国交省道路情報 全国統一版(2024年11月更新) データをSVGMapに変換するロジックです
// https://www.mlit.go.jp/road/roadinfo/ から、
// http://www.road-info-prvs.mlit.go.jp/roadinfo/pc/ に更新されたもの(2023/4)
//  Programmed by Satoru Takagi
//
// 2023年に更新されたのに、さっそく2024に更新している・・・しかもなんかメカニズム的には退行しているんじゃないか？
//
// Programmed by Satoru Takagi
// 
// License: (MPL v2)
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.
//

var camInfo =
	"https://www.road-info-prvs.mlit.go.jp/roadinfo/pc/pcImage_83_1.html";

const cameraTiles = [
	"81",
	"82",
	"83",
	"84",
	"85",
	"86",
	"87",
	"88",
	"89",
	"90",
];

async function getCameraData() {
	var json = await getIndexRoadJson(camInfo);
	var areaDataPs = [];
	for (var area of cameraTiles) {
		if (!json.data[area]) {
			var url = `${json.jsonDirPath}/ImageList/${area}.json`;
			areaDataPs.push(getJson(url, area));
		}
	}
	var areaDatas = await Promise.all(areaDataPs);
	//console.log(areaDatas);
	for (var adata of areaDatas) {
		json.data[adata.key] = adata.json;
	}
	//console.log(json);
	return json;
}

async function getJson(url, key) {
	var json = await (await fetch(svgMap.getCORSURL(url))).json();
	return { key, json };
}

async function getIndexRoadJson(idxUrl) {
	// 83区画が汚くhtmlにembedされている
	var htxt = await (
		await fetch(svgMap.getCORSURL(idxUrl) + `?t=${new Date().getTime()}`)
	).text();
	//console.log(htxt);
	var dom = new DOMParser().parseFromString(htxt, "text/html");
	var jsonTxt = dom.getElementById("kokudoJson").getAttribute("value");
	var json = JSON.parse(jsonTxt);
	
	const {jsonDirPath,dateInfo} = getBackupDataPath(dom,idxUrl);
	
	return { data: { 83: json }, dateInfo, jsonDirPath };
}

function parseDate(dateString) {
	// 年、月、日、時、分、秒を取り出す
	const year = parseInt(dateString.substring(0, 4), 10);
	const month = parseInt(dateString.substring(4, 6), 10) - 1; // 月は0から始まるので1を引く
	const day = parseInt(dateString.substring(6, 8), 10);
	const hours = parseInt(dateString.substring(8, 10), 10);
	const minutes = parseInt(dateString.substring(10, 12), 10);
	const seconds = parseInt(dateString.substring(12, 14), 10);

	// Dateオブジェクトを生成
	return new Date(year, month, day, hours, minutes, seconds);
}

function generate5minTimeString() {
	const now = new Date();
	// 分を5で割って切り捨て、5分単位にする
	const minutes = Math.floor(now.getMinutes() / 5) * 5;
	now.setMinutes(minutes);
	// 年月日時分を文字列に変換
	const year = now.getFullYear();
	const month = String(now.getMonth() + 1).padStart(2, "0"); // 月は0から始まるため+1
	const day = String(now.getDate()).padStart(2, "0");
	const hours = String(now.getHours()).padStart(2, "0");
	const formattedMinutes = String(minutes).padStart(2, "0");
	// 連結して文字列を生成
	return `${year}${month}${day}${hours}${formattedMinutes}`;
}

function getBackupDataPath(dom,idxUrl){
	var scripts = dom.getElementsByTagName("script");

	var dataPath;
	for (var i = 0; i < scripts.length; i++) {
		var oneScript = scripts[i];
		var srcAttr = oneScript.getAttribute("src");
		//console.log(srcAttr);
		if (srcAttr && srcAttr.indexOf("/backup/") > 0) {
			dataPath = srcAttr;
			break;
		}
	}

	var didx = dataPath.indexOf("/backup/");
	var dateInfo = parseDate(dataPath.substring(didx + 8, didx + 8 + 8 + 6));
	var jsonDirPath = new URL(
		dataPath.substring(0, dataPath.lastIndexOf("/")),
		idxUrl
	).href;
	return {jsonDirPath,dateInfo};
}

async function getDataDirUrl(indexContentsURL){
	var htxt = await (
		await fetch(svgMap.getCORSURL(indexContentsURL) + `?t=${new Date().getTime()}`)
	).text();
	var dom = new DOMParser().parseFromString(htxt, "text/html");
	const {jsonDirPath,dateInfo} = getBackupDataPath(dom,indexContentsURL);
	return {jsonDirPath,dateInfo};
}

export { getCameraData, generate5minTimeString,getDataDirUrl  };
