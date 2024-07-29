// ESM

import { setData, drawData } from "./jpn_lg_a_jma.js";
//var indexUrl="https://raw.githubusercontent.com/amx-project/kuwanauchi/main/kuwanauchi_datalist.csv";
var indexUrl="https://amx-project.github.io/kuwanauchi/kuwanauchi_datalist.csv";


//var pageBase="https://github.com/amx-project/kuwanauchi";
// https://amx-project.github.io/kuwanauchi01hokkaido/xml/01101-4300-1.zip
var pageBase = "https://amx-project.github.io/kuwanauchi";

// from https://nlftp.mlit.go.jp/ksj/gml/codelist/PrefCd.html
var prefDict={"01":"北海道","25":"滋賀県","02":"青森県","26":"京都府","03":"岩手県","27":"大阪府","04":"宮城県","28":"兵庫県","05":"秋田県","29":"奈良県","06":"山形県","30":"和歌山県","07":"福島県","31":"鳥取県","08":"茨城県","32":"島根県","09":"栃木県","33":"岡山県","10":"群馬県","34":"広島県","11":"埼玉県","35":"山口県","12":"千葉県","36":"徳島県","13":"東京都","37":"香川県","14":"神奈川県","38":"愛媛県","15":"新潟県","39":"高知県","16":"富山県","40":"福岡県","17":"石川県","41":"佐賀県","18":"福井県","42":"長崎県","19":"山梨県","43":"熊本県","20":"長野県","44":"大分県","21":"岐阜県","45":"宮崎県","22":"静岡県","46":"鹿児島県","23":"愛知県","47":"沖縄県","24":"三重県"};

var idxDat;


async function initKuwanauchiIndex(){
	idxDat = await getKuwanauchiIndex();
}

async function showKuwanauchiIndex(){
	await visualizeIndexData(idxDat);
}

function customShowPoiPropertyKuwanauchiFactory(forIndexFunction, forOthersFunction){
	if ( forIndexFunction ){
		customShowPoiPropertyKuwanauchi_indexFunction = forIndexFunction;
	}
	if ( forOthersFunction ){
		customShowPoiPropertyKuwanauchi_othersFunction = forOthersFunction;
	}
	return ( customShowPoiPropertyKuwanauchi );
}
var customShowPoiPropertyKuwanauchi_indexFunction;
var customShowPoiPropertyKuwanauchi_othersFunction;
function customShowPoiPropertyKuwanauchi(ans){
	console.log(ans.parentElement.getAttribute("id"));
	if ( ans.parentElement.getAttribute("id")=="areas"){
		var dat = ans.getAttribute("data-meta").split(",");
		for ( var i = 0 ; i < dat.length ; i++){
			var sd = dat[i].split(":");
			for ( var j = 0 ; j < sd.length ; j++){
				sd[j] = sd[j].replaceAll("&#58;",":");
			}
			dat[i]=sd;
		}
		if ( customShowPoiPropertyKuwanauchi_indexFunction ){
			customShowPoiPropertyKuwanauchi_indexFunction(dat);
		}
	} else {
		if ( customShowPoiPropertyKuwanauchi_othersFunction ){
			customShowPoiPropertyKuwanauchi_othersFunction(ans);
		}
	}
	
}


async function getKuwanauchiIndex(){
	var indexCsv=await getText(indexUrl);
	indexCsv= indexCsv.split("\r\n");
	var idxDat =[];
	var firstRow = true;
	for ( var row of indexCsv){
		if (firstRow){
			
			firstRow = false;
			continue;
		}
		row = row.split(",");
		if ( row.length>2){
			var zipName = row[2].trim().split(".")[0];
			var prefCode = zipName.substring(0,2);
			var lgCode = zipName.substring(0,5);
			var prefNameR = row[0].trim().substring(6);
			if ( prefNameR == "gunma" ){
				var trm = row[0].trim().substring(0,6);
				prefNameR = "gumma";
				 row[0]=trm+prefNameR;
			}
			var prefName = prefDict[prefCode];
			var lgName = row[1].trim().split("（")[0];
			var url = `${pageBase}${prefCode}${prefNameR}/xml/${zipName}-search-list.csv`;
			row.push(url);
			row.push(prefName);
			row.push(lgName);
			row.push(lgCode);
			idxDat.push(row);
		}
	}
	console.log(idxDat);
	return ( idxDat);
}

async function getText(url){
	var res = await fetch(url);
	var txt = await res.text();
	return txt;
}

async function visualizeIndexData(idxDat){
	window.currentContent="lgCode,c,name,zipFileName,zipFileURL\n"; // jpn_lg_aでの可視化対象変数
	window.currentcolormap = "direct";
	for ( var row of idxDat ){
		window.currentContent += `${row[6]},green,${row[1]},${row[2]},${row[3]}\n`;
	}
	//console.log(currentContent);
	if ( typeof(svgImage)=="object"){
		svgImage.documentElement.setAttribute("property","company,phone,href,area");
		await window.drawData();
	}
};


export {initKuwanauchiIndex, showKuwanauchiIndex, customShowPoiPropertyKuwanauchiFactory};