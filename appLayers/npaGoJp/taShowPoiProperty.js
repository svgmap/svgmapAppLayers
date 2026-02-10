// Description: taShowPoiProperty
//
// Programmed by Satoru Takagi
// 
// License: (MPL v2)
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.
//

import {translateRow} from "./taDataGenerator.js";


function initTaShowPoiProperty(codeTables,schemaParam){
	schema = schemaParam;
	console.log("initTaShowPoiProperty:", schema.lngCol, schema.latCol);
	metaCodeTables = buildMetaCodeTables(codeTables,schema);
	svgMap.setShowPoiProperty(customShowPoiProperty, layerID);
	console.log(schema);
}

var metaCodeTables;
var schema;
function buildMetaCodeTables(codeTables,schema){
	// codeTablesは緯度経度カラムを含むが、SVGMapコンテンツは子のカラムは消費済みでmetadataからは消えている。
	// そこでこれを消したmetaCodeTablesを生成して、customShowPoiPropertyで用いる
	const metaCodeTables=[];
	var idx=0;
	for ( var ct of codeTables){
		if ( idx == schema.lngCol || idx == schema.latCol){
		} else {
			metaCodeTables.push(ct);
		}
		++idx;
	}
	
	console.log("metaCodeTables:",metaCodeTables);
	return metaCodeTables;
}

function customShowPoiProperty(target){
	//console.log(target);
	if ( !target.getAttribute("content") ){ 
		console.log("NO metadata exit");
		return;
	}
	var metaData = svgMap.parseEscapedCsvLine(target.getAttribute("content"));
	//console.log(metaData, metaCodeTables);
	var message="<table border='1' style='font-size:11px;word-break: break-all;table-layout:fixed;width:100%;border:solid orange;border-collapse: collapse'>";
	
	metaData = translateRow(metaData, metaCodeTables);
	//console.log(metaData);
	
	var datetime="";
	for ( var i = 0 ; i < metaData.length ; i++ ){
		 if ( schema.metaSchema[i].indexOf("発生日時")>=0){
			if ( schema.metaSchema[i].indexOf("分")>=0){
				datetime +=metaData[i];
				message += `<tr><td>発生日時</td><td>${datetime}</td></tr>`;
			} else {
				if ( schema.metaSchema[i].indexOf("　時")>=0){
					datetime +=metaData[i]+":";
				} else if ( schema.metaSchema[i].indexOf("　日")>=0){
					datetime +=metaData[i]+" ";
				} else {
					datetime +=metaData[i]+"/";
				}
			}
			continue;
		 } else {
			message += `<tr><td>${schema.metaSchema[i]}</td><td>${metaData[i]}</td></tr>`;
		 }
	}
	
	if ( target.getAttribute("lat") ){
		message += `<tr><td>latitude</td> <td>${dpRound(target.getAttribute("lat"))}</td></tr>`;
		message += `<tr><td>longitude</td> <td>${dpRound(target.getAttribute("lng"))}</td></tr>`;
	}
	
	message += "</table>";
	svgMap.showModal(message,400,600);
}

function dpRound(value, base) {
	if (!base){base = 1000000};
	return Math.round(Number(value) * base) / base;
}


export{initTaShowPoiProperty, buildMetaCodeTables}