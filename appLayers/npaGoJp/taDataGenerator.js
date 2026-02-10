// 警察庁交通事故統計情報のオープンデータのRAW Dataを読み込み、コード表を適用して可読性のあるデータを構築する
//
// Programmed by Satoru Takagi
// 
// License: (MPL v2)
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.
//
// history 
//  Rev1: 2023/03/02 1st release
//  Rev2: 2023/03/07 スキーマをPOIクリック時に適用するよう変更

import {parseCsv} from "./csvParser.js";


var codeTableFiles=[
	"1_koudohyou_siryoukubun.csv",
	"2_koudohyou_todouhukenkoudo.csv",
	"3_koudohyou_keisatusyotoukoudo.csv",
	"4_koudohyou_honpyoubangou.csv",
	"5_koudohyou_jikonaiyou.csv",
	"6_koudohyou_sisyasuu.csv",
	"7_koudohyou_husyousyasuu.csv",
	"8_koudohyou_rosenkoudo.csv",
	"9_koudohyou_rosen_kousokujidousya_jidousyasenyou.csv",
	"10_koudohyou_jyougesen.csv",
	"11_koudohyou_titenkoudo.csv",
	"12_koudohyou_sikutyousonkoudo.csv",
	"13_koudohyou_hasseinitiji.csv",
	"14_koudohyou_tyuuya.csv",
	"15_koudohyou_tenkou.csv",
	"16_koudohyou_tikei.csv",
	"17_koudohyou_romenjyoutai.csv",
	"18_koudohyou_dourokeijyou.csv",
	"19_koudohyou_kanjyoukousatennotyokkei.csv",
	"20_koudohyou_singouki.csv",
	"21_koudohyou_itijiteisikisei_hyousiki.csv",
	"22_koudohyou_itijiteisikisei_hyouji.csv",
	"23_koudohyou_syadouhukuin.csv",
	"24_koudohyou_dourosenkei.csv",
	"25_koudohyou_syoutotutiten.csv",
	"26_koudohyou_zoonkisei.csv",
	"27_koudohyou_tyuuoubunritaisisetutou.csv",
	"28_koudohyou_hosyadoukubun.csv",
	"29_koudohyou_jikoruikei.csv",
	"30_koudohyou_nenrei.csv",
	"31_koudohyou_toujisyasyuetu.csv",
	"32_koudohyou_youtobetu.csv",
	"33_koudohyou_syaryoukeijyou.csv",
	"34_koudohyou_sokudokisei_siteinomi.csv",
	"35_koudohyou_syaryounosyoutotubui.csv",
	"36_koudohyou_syaryounosonkaiteido.csv",
	"37_koudohyou_eabagunosoubi.csv",
	"38_koudohyou_saidoeabagunosoubi.csv",
	"39_koudohyou_jinsinsonsyouteido.csv",
	"40_koudohyou_titen_ido_hokui.csv",
	"41_koudohyou_titen_keido_toukei.csv",
	"42_koudohyou_youbi.csv",
	"43_koudohyou_syukujitu.csv",
	"44_koudohyou_hojyuuhyoubangou.csv",
	"45_koudohyou_jyousyabetu.csv",
	"46_koudohyou_jyousyatounokubun.csv",
	"47_koudohyou_hasseititen.csv",
	"48_koudohyou_dourokanrisyakubun.csv",
	"49_koudohyou_dourokubun.csv",
	"50_koudohyou_dourokouzou.csv",
	"51_koudohyou_kyokusenhankei.csv",
	"52_koudohyou_jyudankoubai.csv",
	"53_koudohyou_tonnerubangou.csv",
	"54_koudohyou_toujisyaryoudaisuu.csv",
	"55_koudohyou_jikoruikei.csv", // このデータは高速票用(TBD)
	"56_koudohyou_syaryoutandokujikonotaisyoubutu.csv",
	"57_koudohyou_rinjisokudokiseinoumu.csv",
	"58_koudohyou_sokudokisei_rinjinomi.csv",
	"59_koudohyou_tonneruentyoukyori.csv",
];

var codesDict={};

function parseAcData(dat){
	var aCsv = parseCsv(dat);
	var schemaRow = aCsv.shift();
	//console.log(schemaRow,aCsv);
	// schemaRowをsvgmapのgeojson schemaおよびdocroot-propertyに入れると良いと思います
	var ans =[];
	var codeTables = prepareCodeTables(schemaRow, codesDict);
	console.log("codeTables:",codeTables);
	var latitudeCol,longitudeCol;
	var idx=0;
	for ( var codeTable of codeTables){
		if ( codeTable.latitudeCell ){
			latitudeCol = idx;
		} else if ( codeTable.longitudeCell ){
			longitudeCol = idx;
		}
		++idx;
	}
	console.log({latitudeCol,longitudeCol});
	for ( var row of aCsv){
		if ( row.length < latitudeCol){continue}
		row[latitudeCol] = parseDMS(row[latitudeCol]);
		row[longitudeCol] = parseDMS(row[longitudeCol]);
	}
	
	return ( {data:aCsv, schema:schemaRow, codeTables});
}

function getCellData(row,codeDictObj,index){
	var code = row[index];
	var ans=null;
	var codeDict = codeDictObj.codeDict;
	//console.log(code, codeDict);
	//console.log("getCellData:",{row,code,codeDictObj,index});
	if (codeDictObj.latitudeCell || codeDictObj.longitudeCell){
		ans = parseDMS(code)
	} else if (codeDictObj.useRosenCodeParser ){
		ans = parseRosenCode(code,row[codeDictObj.useRosenCodeParser.prefCodeIndex]);
		if (!ans ){
			ans = "no RosenCode data " +  code;
		}
	} else if ( codeDictObj.thisDataCompositeKeyIndex ){
		var compositeKeyArray =[];
		for ( var kidx of codeDictObj.thisDataCompositeKeyIndex){
			if ( kidx == -1 ){
				compositeKeyArray.push(code);
			} else {
				compositeKeyArray.push(row[kidx]);
			}
		}
		var ansData = codeDict.dict[compositeKeyArray.join(",")];
		var ans;
		if ( ansData ){
			ans = [];
			for ( var i = codeDict.valueIndex ; i < ansData.length ; i++ ){
				ans.push( ansData[i]);
			}
			ans = ans.join("");
		} else {
			ans = "no data " +  compositeKeyArray.join("_");;
			console.warn("NO DATA:",codeDict.propName,ans);
		}
	} else if ( codeDict.keysIndex.length == 0 ){
		ans = (code);
	} else if ( codeDict.keysIndex.length == 1 ){
		const ans0 = codeDict.dict[code];
		if ( ans0){
			ans = ans0[codeDict.keysIndex[0]+1];
		} else {
			console.warn("コード辞書に"+code+"が見つかりません");
		}
	}
	//console.log(ans,codeDict,code,codeDict.keysIndex.length );
	return ans;
}

function parseDMS(dmstr){
	var sl = dmstr.length;
	var sec = Number(dmstr.substring(sl - 5))/1000;
	var min = Number(dmstr.substring(sl-7,sl-5));
	var deg = Number(dmstr.substring(0,sl-7));
	
	var ans = deg + min/60 + sec / 3600;
	return ( ans );
}

function translateRow(row,codeTables){
	if ( row.length != codeTables.length){
		console.warn ( "Mismatch in number of dictionaries and metadata");
		return ( row);
	}
	var ans = [];
	for ( var i = 0 ; i < row.length ; i++ ){
		var val = translateCol(row,codeTables, i);
		ans.push(val);
	}
	return ( ans );
}

function translateCol(row,codeTables, i){
	var codeTable = codeTables[i];
	var val;
	if (codeTable.codeDict){
		val = getCellData(row,codeTable,i);
	} else {
		val = row[i];
	}
	return val;
}

function prepareCodeTables(schemaRow, codesDict){
	var codeTables=[];
	for ( var sKey of schemaRow){
		var codeDict =null;
		if (codesDict[sKey]){
			codeDict = codesDict[sKey];
		} else {
			var altKey1 = sKey.substring(0,sKey.lastIndexOf("（"));
			var altKey2 = sKey.substring(0,sKey.indexOf("（"));
			var altKey3 = sKey.substring(0,sKey.indexOf("("));
			if ( codesDict[altKey1]){
				codeDict =codesDict[altKey1];
			} else if ( codesDict[altKey2]){
				codeDict =codesDict[altKey2];
			} else if ( codesDict[altKey3]){
				codeDict =codesDict[altKey3];
			}
		}
		codeTables.push({codeDict});
	}
	
	for ( var ctbl of codeTables){
		var codeDict = ctbl.codeDict;
		if ( !codeDict ){continue}
		//console.log(codeDict);
		if ( codeDict.propName=="路線コード"){
			ctbl.useRosenCodeParser={};
			var sidx =0;
			for ( var sKey of schemaRow){
				if ( sKey == "都道府県コード"){
					ctbl.useRosenCodeParser.prefCodeIndex=sidx;
					break;
				}
				++sidx;
			}
		} else if ( codeDict.propName.indexOf("緯度")>=0){
			ctbl.latitudeCell = true;
		} else if ( codeDict.propName.indexOf("経度")>=0){
			ctbl.longitudeCell = true;
		} else if ( codeDict.keysIndex.length >1){
			ctbl.thisDataCompositeKeyIndex=[];
			for ( var ki of codeDict.keysIndex){
				if ( ki == codeDict.mainKeyIndex ){
					ctbl.thisDataCompositeKeyIndex.push(-1);
				} else {
					var sidx =0;
					for ( var sKey of schemaRow){
						if ( sKey == codeDict.keySchema[ki] || sKey.replace("コード","") == codeDict.keySchema[ki] ){
							ctbl.thisDataCompositeKeyIndex.push(sidx);
						}
						++sidx;
					}
					
				}
			}
		}
	}
	return codeTables;
}

function parseRosenCode(rosenCode, prefCode){
	var md = codesDict["路線コード"];
	var sd = codesDict["路線（高速自動車国道,自動車専用道（指定））コード"];
	var codeF = Number(rosenCode.substring(0,4));
	var codeB = Number(rosenCode.substring(4));
	var ans=null;
	var dat;
	var rd;
	for ( rd in md.dict){
		dat = md.dict[rd];
		rd = rd.split(",");
		
		if ( rd[0].indexOf("～")>0){
			var rg = rd[0].split("～");
			if (  Number(rg[0]) <= codeF && codeF <= Number(rg[1])){
				ans = dat[md.keysIndex[0]+1];
				break;
			}
		} else {
			if ( Number(rd[0])== codeF){
				ans = dat[md.keysIndex[0]+1];
				break;
			}
		}
	}
	
	if ( !ans ){ return ( ans )};
	
	//console.log(ans, ans.endsWith("*1") , prefCode);
	if ( ans.endsWith("*1")>0 && prefCode){
		var sdat = sd.dict[prefCode+","+rosenCode.substring(0,4)];
		if ( sdat ){
			ans = ans.substring(0,ans.length-2)+" " + sdat[3];
		} else {
			console.warn("NO motorway info... : ", prefCode+","+rosenCode.substring(0,4));
			ans = ans.substring(0,ans.length-2)+" code" + prefCode + " " + rosenCode.substring(0,4) ;
		}
	}
	
	var ansAdd=null;
	if ( rd[1]!=""){
		if ( rd[1].indexOf("～")>0){
			var rg = rd[1].split("～");
			if (  Number(rg[0]) <= codeB && codeB <= Number(rg[1])){
				ansAdd = dat[md.keysIndex[1]+1];
			}
		} else {
			if ( Number(rd[1])== codeB){
				ansAdd = dat[md.keysIndex[1]+1];
			}
		}
	}
	
	if ( ansAdd ){
		ans += " " + ansAdd;
	}
	return ( ans );
}

async function buildCodesDict(rootPath, forAllData){
	if (!rootPath){
		rootPath ="./schema/";
	}
	codesDict={};
	var dictPromises=[];
	for ( var sname of codeTableFiles){
		dictPromises.push( buildOneCodeDict(rootPath+sname));
	}
	var dicts = await Promise.all(dictPromises);
	
	for ( var dict of dicts){
		var appls = dict.application.split("、");
		for ( var apl of appls){
			if (!codesDict[apl]){
				codesDict[apl]={};
			}
			if ( !codesDict[apl][dict.propName]){
				codesDict[apl][dict.propName]=dict;
			} else {
				console.warn("codesDict dup",dict, codesDict[apl][dict.propName]);
			}
		}
		if ( dict.hasRangeKey ){
			console.warn ( "has RangeKey:",dict);
		}
	}
	if ( !forAllData){
		codesDict = codesDict["本票"];
	}
	console.log("codesDict:",codesDict);
	return codesDict;
}

async function buildCodesDictFromXLSX(url, forAllData){
	if ( typeof XLSX == "undefined")throw new Error('XLSXライブラリが見つかりません');
	codesDict={};
	const response = await fetch(url);
	if (!response.ok) throw new Error('ファイルの取得に失敗しました');
	const arrayBuffer = await response.arrayBuffer();
	const workbook = XLSX.read(arrayBuffer);
	var dicts=[];
	for ( var sheetName of workbook.SheetNames){
		console.log(sheetName);
		const worksheet = workbook.Sheets[sheetName];
		const csvTxt = XLSX.utils.sheet_to_csv(worksheet);
//		console.log(XLSX.utils.sheet_to_txt(worksheet));
		const csv = trimCsv(parseCsv(csvTxt));
		dicts.push(buildOneCodeDictPh2(csv,sheetName));
//		console.log(sheetName,csv,csvTxt);
	}
	for ( var dict of dicts){
		//console.log(dict);
		var appls = dict.application.split("、");
		for ( var apl of appls){
			if (!codesDict[apl]){
				codesDict[apl]={};
			}
			if ( !codesDict[apl][dict.propName]){
				codesDict[apl][dict.propName]=dict;
			} else {
				console.warn("codesDict dup",dict, codesDict[apl][dict.propName]);
			}
		}
		if ( dict.hasRangeKey ){
			console.warn ( "has RangeKey:",dict);
		}
	}
	if ( !forAllData){
		codesDict = codesDict["本票"];
	}
	console.log("codesDict:",codesDict);
	return codesDict;
}

function trimCsv(csvArray){
	console.log(csvArray);
	var allFirstColsNull =true;
	for ( var line of csvArray){
		for ( var cn =0 ; cn< line.length ; cn++){
			line[cn]=line[cn].trim();
		}
	}
	for ( var line of csvArray){
		if ( line[0].trim()!=""){
			allFirstColsNull = false;
			break;
		}
	}
	if ( allFirstColsNull ){
		var ans = [];
		for ( var line of csvArray){
			ans.push(line.slice(1));
		}
		console.log("trimCsv : allFirstColsNull:",ans);
		return ans;
	} else {
		return csvArray;
	}
}


async function buildOneCodeDict(path){
	var csv = await loadCsv(path);
	return buildOneCodeDictPh2(csv,path);
}
function buildOneCodeDictPh2(csv, path){
	var propName, explanation, application;
	var inBody=false;
	var mainKeyIndex, valueIndex, keySchema;
	var keysIndex=[];
	var dict={};
	var hasRangeKey = false;
	var baseCol = 0;
	for ( var row of csv){
		if ( row.length == 1 ){continue}
		// "コード"がついてたりついてなかったりが雑なデータ
		if ( !inBody){
			if ( !propName && row[0]=="項目名"){
				propName = row[1];
			} else if ( !propName && row[1]=="項目名"){
				baseCol = 1; // 47_koudohyou_hasseititen.csvが不正なので・・・
				propName = row[2];
			} else if(!application && row[baseCol]=="適用"){
				application = row[baseCol+1];
			} else if(!explanation && row[baseCol]=="説明"){
				explanation = row[baseCol+1];
			} else if ( propName && row[baseCol].indexOf("コード")>=0){
				inBody=true;
				if ( row[baseCol]=="コード"){
					mainKeyIndex = 0;
					keysIndex.push(0);
					keySchema = row;
				} else {
					keySchema = [];
					var idx = 0;
					for ( var col of row){
						var coln = col.replace("コード","").replace("）","").replace("（","");
						if ( propName.replace("コード","") == coln){
							mainKeyIndex = idx;
							keysIndex.push(idx);
							keySchema.push(coln);
						} else if(coln!=col){
							keysIndex.push(idx);
							keySchema.push(coln);
						} else if ( !valueIndex && col.indexOf("コード")<0){
							valueIndex=idx;
							keySchema.push(col);
						} else {
							keySchema.push(col);
						}
						++ idx;
					}
				}
				// console.log({propName, explanation, application,keySchema,keysIndex,mainKeyIndex, valueIndex});
			}
		} else {
			if ( row[mainKeyIndex]!=""){
				var key ="";
				var idx = 0;
				for ( var keyIndex of keysIndex){
					var oneKey = row[keyIndex];
					if ( oneKey.indexOf("＊")>=0 ||oneKey.indexOf("*")>=0 || oneKey.indexOf("～")>=0|| oneKey.indexOf("~")>=0){
						hasRangeKey = true;
					}
					if ( idx ==0){
						key += oneKey;
					} else {
						key += "," + oneKey;
					}
					++idx;
				}
				dict[key]=row;
			}
		}
	}
	return{path,propName, explanation, application,keySchema,keysIndex,mainKeyIndex, valueIndex, dict,hasRangeKey};
	
}


async function loadCsv(URL){
	var response = await fetch(URL);
	var txt = await response.text();
	return (parseCsv(txt));
}

export { parseAcData , buildCodesDict , parseDMS , prepareCodeTables, translateRow, buildCodesDictFromXLSX, translateCol};
