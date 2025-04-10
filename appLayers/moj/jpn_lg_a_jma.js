// Description:
// 日本の市区町村ポリゴンに色塗りする感じのSVGMap WebAppレイヤー SVGMapFrame準拠の外部操作APIも備える
//
// Programmed by Satoru Takagi
// 
// License: (MPL v2)
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.
//

// 2023/4/27 自治体ポリゴンとしてJMAの注意報・警報システムのデータを利用する版(ただし、ひとまずジオコーダ機能はついていない限定版)
// 2023/4/27 ESM化

import {getColor} from "./ColoringLib_esm.js";
import {initLgArea} from "./lgAreaViewerJMA.js";

window.drawData = drawData;

// 以下の二つの文字列変数をセットしてdrawData()すると描画されます
window.currentContent=""; // csvで　データを入れる col0はKey, col1はVal
                       // Key: 自治体5桁コード、漢字自治体名称、(都道府県)(郡支庁振興局)市区町村(区)
                       // Val: 下のcurrentcolormap次第の値
window.currentcolormap;   // "direct"(#RRGGBB) | "hue"(青～赤のヒートマップ:値域は自動演算) | "数字"(H値指定で濃淡:値域は自動演算)

// もしくは、rootMessageのrootMessage.textContent,rootMessage.colormapに設定してrootMessage.update();

// 市区町村コード
// https://ecitizen.jp/Sac/27
// 空白削除：p.replaceAll(/\s+/,"")
// 5桁市町村コードチェック：n.match(/^\d{5}$/) で[0]あるかどうか
// だったが　こちらのほうが公式だと思う(統計に用いる標準地域コード)
// https://www.soumu.go.jp/toukei_toukatsu/index/seido/9-5.htm
// e-stat 一番下のDL
//https://www.e-stat.go.jp/municipalities/cities/areacode

// 地図データは地球地図の自治体ポリゴンを以下で変換
// Shape2SVGMap.bat -micrometa2 4 3 7 -simplify 0.003 D:\downloads\gm-jpn-bnd_u_2_1\polbnda_jpn.dbf

var parsedData, currentContentSchema; // 元データをパースしたもの

var rootMessage={ // svgMapFrameを使っている。rootMessageにはルートのhtmlから送られてくる情報が入る
	update(){
		console.log("updated jpn_pref_a", this);
		checkUpdate();
	}
}

var lgDB; // 

const prefDict={"01":"北海道","25":"滋賀県","02":"青森県","26":"京都府","03":"岩手県","27":"大阪府","04":"宮城県","28":"兵庫県","05":"秋田県","29":"奈良県","06":"山形県","30":"和歌山県","07":"福島県","31":"鳥取県","08":"茨城県","32":"島根県","09":"栃木県","33":"岡山県","10":"群馬県","34":"広島県","11":"埼玉県","35":"山口県","12":"千葉県","36":"徳島県","13":"東京都","37":"香川県","14":"神奈川県","38":"愛媛県","15":"新潟県","39":"高知県","16":"富山県","40":"福岡県","17":"石川県","41":"佐賀県","18":"福井県","42":"長崎県","19":"山梨県","43":"熊本県","20":"長野県","44":"大分県","21":"岐阜県","45":"宮崎県","22":"静岡県","46":"鹿児島県","23":"愛知県","47":"沖縄県","24":"三重県"};

addEventListener("load", async function(){
	console.log("Hello this is jpn_pref.svg  this:", this);
	await getLgCodeTable();
	if ( typeof(svgMap)=="object" ){
		await initLgArea();
		buildDBfromJmaContent();
	}
	console.log("lgDB:",lgDB);
});

function checkUpdate(){
	console.log(rootMessage.textContent,rootMessage.colormap);
	if (window.currentContent != rootMessage.textContent || window.currentcolormap != rootMessage.colormap){
		window.currentContent = rootMessage.textContent;
		window.currentcolormap = rootMessage.colormap;
		if ( window.currentContent ){
			drawData();
		}
	}
}

function setData(csvTxt, colorMap){
	window.currentContent = csvTxt;
	window.currentcolormap = colorMap;
}

function drawData(){
	if ( typeof(svgMap)!="object" ){ return }
	if ( !lgDB){
		console.log("Retry");
		setTimeout(drawData,100);
		return;
	}
	console.log("textContent changed");
	clearContent();
	var lines = window.currentContent.split("\n");
	//console.log(lines);
	var datas=[];
	var dataStartLine = 0;
	var lgCodedData = false;
	var colorMode = getColorMode();
	if ( lines[0].trim().toLowerCase().startsWith("key") || lines[0].trim().toLowerCase().startsWith("lgcode") ){
		if (  lines[0].trim().toLowerCase().startsWith("lgcode") ){
			lgCodedData = true;
		}
		dataStartLine = 1;
		currentContentSchema = lines[0].trim().split(",");
		for ( var i = 0 ; i < currentContentSchema.length ; i++){
			currentContentSchema[i]=currentContentSchema[i].trim();
		}
	}
	var minval=1e99, maxval=-1e99;
	for ( var i = dataStartLine ; i < lines.length ; i++ ){
		var line = lines[i].trim();
		if ( line ==""){
			continue;
		}
		var cols = line.split(",");
		var rd = [];
		var meta=[];
		var colorSrcVal;
		var keys=[];
		for ( var j = 0 ; j < cols.length ; j++ ){
			var col = cols[j].trim();
			if ( j==0){ // Keyカラムは0番に固定する
				var lgCodes;
				if ( lgCodedData ){
					lgCodes = [col.trim()];
				} else {
					// lgCodes = lgMeshD.geoCode(col); // 自治体名⇒5桁コードへのジオコード　TBD
				}
				//console.log("geoCode: key:",col,"  ans:",lgCodes);
				if ( lgCodes.length > 0 ){
					for ( var lgCode of lgCodes){
						keys.push(lgCode);
					}
				} else {
					console.warn("Not resolved. query:" ,col, "  result:",lgCode);
					continue;
				}
			} else if ( j==1){ // valが1番固定
				colorSrcVal=col; // 色のためのデータ（もしくは色そのもの(#xxxxxx)でもいいようにしたい）
				if ( colorMode.mode >=0){
					colorSrcVal = Number(colorSrcVal);
					minval = Math.min(colorSrcVal, minval);
					maxval = Math.max(colorSrcVal, maxval);
				}
			} else {
				meta.push(col);
			}
		}
		if ( meta.length >0){
			meta = meta.join(",");
		} else {
			meta=null;
		}
		//if ( keys.length == 0 ){continue};
		for ( var key of keys ){
			datas.push([key,colorSrcVal,meta]);
		}
	}
	console.log("datas:",datas );
	for ( var data of datas ){
		var colorSrcVal = data[1];
		data[1] = getColor(colorSrcVal, colorMode.mode, minval,maxval,colorMode.hue0,false);
	}
	
	if ( datas.length ==0){
		// 表示をしない
	} else {
		parsedData = datas;
		for ( var i = 0 ; i < datas.length ; i++ ){
			var color=datas[i][1];
			setColor_meta(datas[i][0], color, datas[i][2]);
		}
	}
	svgMap.refreshScreen();
}

function setColor_meta(key,val,meta){
	//console.log(key,val,meta);
	var prefData = lgDB[lgCodeTable[key]];
	//console.log("setColor:",key,val,prefData);
	if (!prefData){
		var k0 = key.substring(0,4)+"0";
		var k0i = lgCodeTableAdd.indexOf(k0);
		if ( k0i !=-1){
			prefData = lgDB[lgCodeTableAdd[k0i]];
		}
		if (!prefData ){
			var k1 = key.substring(0,3)+"00";
			var k1i = lgCodeTableAdd.indexOf(k1);
			if ( k1i !=-1){
				prefData = lgDB[lgCodeTableAdd[k1i]];
			}
			if ( !prefData ){
				console.warn("prefDataが解決できませんでした:",key);
				return;
			}
		}
	}
	for ( var i = 0 ; i < prefData.elements.length ; i++ ){
		prefData.elements[i].setAttribute("visibility","visible");
		prefData.elements[i].setAttribute("fill",(val)); // valが色名や色コードの場合 : 最初の
		if ( meta ){
			meta = meta.replaceAll(":","&#58;");
			var metaC = prefData.elements[i].getAttribute("data-meta");
			if ( metaC ){
				metaC = metaC.split(",");
				var smeta = meta.split(",");
				if ( metaC.length == smeta.length ){
					var nm =[];
					for ( var j = 0 ; j < smeta.length ; j++){
						nm.push(metaC[j]+":"+smeta[j]);
					}
					prefData.elements[i].setAttribute("data-meta",nm.join(","));
				} else {
					prefData.elements[i].setAttribute("data-meta",meta);
				}
			} else{
				prefData.elements[i].setAttribute("data-meta",meta);
			}
		}
	}
}

var lgCoderDB={};

function buildDBfromJmaContent(){
	var ps=svgImage.getElementsByTagName("path");
	lgDB ={};
	for ( var i = 0 ; i < ps.length ; i++ ){
		ps[i].setAttribute("visibility","hidden");
		var meta = (ps[i].getAttribute("content")).split(",");
		var pcodePlus = meta[1].trim();
		var pcode = pcodePlus.substring(0,5);
		var prefCode = pcodePlus.substring(0,2);
		var prefName = prefDict[prefCode];
		var lgName = meta[2];
		var pcodeAdd = pcodePlus.substring(5);
		//console.log("pcode:",pcode);
		
		// 可視化用データを生成する
		var pdata = lgDB[pcode];
		if ( !pdata){
			pdata = {};
			lgDB[pcode] = pdata;
		}
		if ( !pdata.elements ){
			pdata.elements=[];
		}
		pdata.elements.push(ps[i]);
		
		// ジオコーダ用データを生成する
		var coderData = lgCoderDB[pcode];
		if ( !coderData){
			coderData = {prefName,lgNames:[lgName],codes:[pcodePlus]};
			lgCoderDB[pcode] = coderData;
		} else {
			if (coderData.prefName != prefName ){
				console.error("県名が異なっていておかしいです SKIP:", pcode, prefName);
			} else {
				if ( coderData.lgNames.indexOf(lgName) ==-1){
					console.warn("別名あり : ", pcodePlus, lgName);
					coderData.lgNames.push(lgName);
					coderData.codes.push(pcodePlus);
				}
			}
		}
	}
}

var lgCodeTablePath="./AdminiBoundary_CD_mod.csv"; // https://nlftp.mlit.go.jp/ksj/gml/codelist/AdminiBoundary_CD.xlsx を成型した物
var lgCodeTable={};
var lgCodeTableAdd=["01100","04100","11100","12100","14100","14130","14150","15100","22100","22130","23100","26100","27100","27140","28100","33100","34100","40100","40130","43100"];
async function getLgCodeTable(){
	console.log("import.meta.url:",import.meta.url);
	var lgCodeTableCsv = await (await fetch(new URL(lgCodeTablePath,import.meta.url))).text();
	lgCodeTableCsv = lgCodeTableCsv.split("\n");
	for ( var row of lgCodeTableCsv){
		row = row.split(",");
		if (row.length==2){
			lgCodeTable[row[0].trim()]=row[1].trim();
		}
	}
}


function getColorMode(){
	var colorMode = -1;
	var hue0 = -1;
	if ( !window.currentcolormap || window.currentcolormap.toLowerCase()=="direct"){
		colorMode = -1;
	} else if ( window.currentcolormap.toLowerCase()=="hue" ){ // 逆準hue
		colorMode = 0;
		// colorMode:1は省略(正順hue)
	} else if ( Number(window.currentcolormap) ){ // 色調指定の明度変化
		colorMode = 2;
		hue0 = Number(window.currentcolormap);
	} // 3は-1と同じ扱いにする(directColorのフォールバックとしての適当配色)
	return ( {mode:colorMode,hue0:hue0});
}

function clearContent(){
	var ps=document.getElementsByTagName("path");
	for ( var i = 0 ; i < ps.length ; i++ ){
		ps[i].setAttribute("visibility","hidden");
	}
}

export { setData, drawData }; 