// Description: customShowPoiProperty for 放射線モニタリング情報(原子力規制委員会)レイヤー
//
// Programmed by Satoru Takagi
// 
// License: (MPL v2)
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.

function customShowPoiProperty(target){
	// デフォルトパネルにリンクや画像貼り付け機能を付加した 
	//console.log ( "Target:" , target , "  parent:", target.parentNode );

	var metaSchema = null;
	if ( target.ownerDocument.firstChild.getAttribute("property") ){
		metaSchema = target.ownerDocument.firstChild.getAttribute("property").split(","); // debug 2013.8.27
	}

	var message="<table border='1' style='word-break: break-all;table-layout:fixed;width:100%;border:solid orange;border-collapse: collapse;font-size:11px'>";
	
	var titleAndLayerName ="";
	if ( target.getAttribute("data-title")){
		titleAndLayerName = target.getAttribute("data-title") + "/" + target.getAttribute("data-layername") + "\n";
	}
	
	var obsStationId, siteAreaCode;
	if ( target.getAttribute("content") ){ // contentメタデータがある場合
		
		var metaData = svgMap.parseEscapedCsvLine(target.getAttribute("content"));
		
		message += "<tr><th style='width=25%'>name</th><th>value</th></tr>";
		if ( titleAndLayerName != ""){
			message += "<tr><td>title/Layer</td><td> " + titleAndLayerName + "</td></tr>";
		}
		
		let subMessage="";
		if ( metaSchema && metaSchema.length == metaData.length ){
			for ( var i = 0 ; i < metaSchema.length ; i++ ){
				if ( metaSchema[i]=="newsMapDisp"){continue}
				if ( metaSchema[i]=="obsStationId"){obsStationId=metaData[i]}
				if ( metaSchema[i]=="searchSiteAreaCode"){siteAreaCode=metaData[i]}
				var data = "--";
				if ( metaData[i]!=""){
					data = metaData[i];
				}
				if ( data!="--"){
					subMessage += "<tr><td>"+metaSchema[i] + " </td><td> " + getHTMLval(data) + "</td></tr>";
				}
			}
		}
		
		var inputSrc = getPostOpenWindowInputSrc(obsStationId, siteAreaCode);
		message += "<tr><td>測定データ詳細</td> <td>" + inputSrc + "</td></tr>";
		
		message += subMessage;
	}
	
	if ( svgMap.getHyperLink(target) ){
		message += "<tr><td>link</td> <td><a href='" + svgMap.getHyperLink(target).href + "' target='_blank'>" +  svgMap.getHyperLink(target).href + "</a></td></tr>";
	}
	
	if ( target.getAttribute("lat") ){
		message += "<tr><td>latitude</td> <td>" + getFormattedPoi(target.getAttribute("lat")) + "</td></tr>";
		message += "<tr><td>longitude</td> <td>" + getFormattedPoi(target.getAttribute("lng")) + "</td></tr>";
	}
	
	
	message += "</table>";
	svgMap.showModal(message,400,600);
}

function getFormattedPoi( prop ){
	var rangeStr = prop.split(",");
	var ans =0;
	for ( var i = 0 ; i < rangeStr.length ; i++ ){
		ans += Number(rangeStr[i]);
	}
	ans = ans / rangeStr.length;
	return ( ans.toFixed(6) );
}

function getHTMLval( val ){
	val = unescape(val);
	var ans;
	if ( val.indexOf("src=")<0 && (val.toLowerCase().indexOf(".png")>=0 || val.toLowerCase().indexOf(".jpg")>=0 || val.toLowerCase().indexOf(".jpeg")>=0 || val.toLowerCase().indexOf(".gif")>=0 || val.toLowerCase().indexOf(".svg")>=0)){
		ans ="<a target='img' href='"+ val +"'><img style='opacity:1' src='" + val +"' width='100%'/></a>";
	} else if ( (val.indexOf("<div")<0 && val.indexOf("<span")<0 )&& (val.indexOf("http://")==0 || val.indexOf("https://")==0 || val.toLowerCase().indexOf(".html")>=0 || val.indexOf(".htm")>=0)){
		ans ="<a target='htmlContent' href='"+val+"'>"+val+"</a>";
	} else {
		ans = val;
	}
	return ( ans );
}

function unescape(str){
	var ans = str.replace(/&apos;/g, "'")
		.replace(/&quot;/g, '"')
		.replace(/&gt;/g, '>')
		.replace(/&lt;/g, '<')
		.replace(/&amp;/g, '&')
		.replace(/&#x2c;/g, ',')
		.replace(/&#039;/g, "'");
	return ( ans );
}

// 2026/5
function getPostOpenWindowInputSrc(obsStationId, siteAreaCode){
	// 新しいURL体系に合わせて単純なURL生成に書き換え
	// obs_station_unique_code パラメータのみでグラフが表示可能
	var url = "https://www.ramis.nra.go.jp/map/monitoring?mode=graph&obs_station_unique_code=" + obsStationId;
	
	var isrc = `
<input type="button" value="グラフを開く" onclick='window.open("${url}", "_blank", "width=1000,height=800,resizable=yes,scrollbars=yes");'></input>
`;
	return isrc;
}