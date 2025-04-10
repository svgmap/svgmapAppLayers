// Description: plus code geocoder lib. module
// requires window.OpenLocationCode
//
// Programmed by Satoru Takagi
// 
// License: (MPL v2)
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.
//

import {CsisGeocoder} from "./csisGeocoder.js";

var cg, OpenLocationCode;
addEventListener("load", function(){
	cg = new CsisGeocoder();
	OpenLocationCode = window.OpenLocationCode;
});

async function  decode(pcodeInp){
	var pcre=`([0-9A-Z]+\\+[0-9A-Z]*)(.*)`;
	pcodeInp=pcodeInp.trim();
	var pcode = pcodeInp.match(pcre);
	var ans;
	if ( pcode ){
		if(pcode[1][8]=="+"){
			// 完全なプラスコード
			ans = OpenLocationCode.decode(pcode[1]);
		} else {
			// 短縮コードなので補完が必要
			var complementStr = pcode[2];
			var ret = await cg.geocode(complementStr); 
			var nearLat, nearLng;
			if ( !ret.candidate ){
				console.warn("短縮コードにおいて、ヒントの場所情報を解決できませんでした・・・");
			} else if ( ret.candidate instanceof Array ){ // 回答が複数ある
				nearLat = Number(ret.candidate[0].latitude);
				nearLng = Number(ret.candidate[0].longitude);
			} else {
				nearLat = Number(ret.candidate.latitude);
				nearLng = Number(ret.candidate.longitude);
			}
			
			if ( nearLat ){
				var complementedCode = OpenLocationCode.recoverNearest(pcode[1], nearLat, nearLng);
				ans = OpenLocationCode.decode(complementedCode);
			}
		}
	}
	return ans;
}

function encode(latlngstr){
	latlngstr = latlngstr.trim().split(",");
	var ans;
	if ( latlngstr.length >1){
		var lat = Number(latlngstr[0].trim());
		var lng = Number(latlngstr[1].trim());
		if ( isNaN(lat) == false && isNaN(lng) == false ){
			ans = OpenLocationCode.encode(lat,lng,12);
		}
	}
	return ans;
}

export {decode, encode};