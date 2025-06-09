// Description:
// tinyFileManagerForCsv.jsをvectorFileLoaderレイヤで使用するためのファクトリ関数
// Programmed by Satoru Takagi
// 
// License: (MPL v2)
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.

var _targetSvgContentGrpId;

function getSource(){
	svgsrc = xml2Str(svgImage);
//	svgsrc = svgsrc.replace(/<!-- symbols[\s\S]*endSymbols -->/ , "" );
//	svgsrc = svgsrc.replace(/<!-- markers[\s\S]*endMarkers -->/ , "" );
	svgsrc = svgsrc.replace(/><svg/,">\n<svg");
	svgsrc = svgsrc.replaceAll(/iid="[\w]*"/g , "" );
	return ( svgsrc );
}

async function  showMapEmbed(rawData){
	console.log("showMapEmbed:");
	if (typeof svgImage=="object"){
		var targetGrp = _targetSvgContentGrpId;
		const parser = new DOMParser();
		const srcSvgMapDom = await parser.parseFromString(rawData, "text/xml");
		console.log(srcSvgMapDom);
		var metaProp=srcSvgMapDom.documentElement.getAttribute("property");
		var impN = srcSvgMapDom.getElementById(_targetSvgContentGrpId);
		var toImpN = svgImage.importNode(impN, true);
		console.log(toImpN);
		
		var impGrp = svgImage.getElementById(_targetSvgContentGrpId);
		if ( impGrp){
			impGrp.parentNode.removeChild(impGrp);
		}
		svgImage.documentElement.setAttribute("property",metaProp);
		svgImage.documentElement.appendChild(toImpN);
		/**
		impGrp = svgImage.getElementById(_targetSvgContentGrpId);
		var fileName=url.split("/");
		fileName=fileName[fileName.length-1];
//		fileName = fileName.split(".");
//		fileName = fileName[0];
		console.log(fileName);
		impGrp.setAttribute("data-contentUrl",fileName);
		**/
		svgMap.refreshScreen();
	}
}

function clearMap(){
	var impGrp = svgImage.getElementById(_targetSvgContentGrpId);
	if ( impGrp){
		while( impGrp.firstChild ){
			impGrp.removeChild( impGrp.firstChild );
		}
	}
	svgMap.refreshScreen();
}