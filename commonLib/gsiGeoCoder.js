/**
地理院ジオコーダを使ってジオコードする
https://msearch.gsi.go.jp/address-search/AddressSearch?q=東京都港区芝公園４丁目２−８
https://mreversegeocoder.gsi.go.jp/reverse-geocoder/LonLatToAddress?lat=35.658649&lon=139.745468
**/
//
// Programmed by Satoru Takagi
// 
// License: (MPL v2)
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.
//

var useProxy=null;
var geoCodeUrl="https://msearch.gsi.go.jp/address-search/AddressSearch?q=[ADDR]";
var revCodeUrl="https://mreversegeocoder.gsi.go.jp/reverse-geocoder/LonLatToAddress?lat=[LAT]&lon=[LON]";


async function gsiGeoCode(address){
	var url = geoCodeUrl.replace("[ADDR]",encodeURIComponent(address));
	if ( useProxy  ){
		url = useProxy(url);
	}
	//console.log("url:",url);
	try{
		var response = await fetch(url);
		if (response.status!=200){
			throw "Fetch ERROR";
		}
		var json = await response.json();
		//console.log(json);
		return ( json );
	} catch ( e ){
		return ( null );
	}
}

async function gsiRevGeoCode(lat,lng){
	var url = revCodeUrl.replace("[LAT]",encodeURIComponent(lat));
	url = url.replace("[LON]",encodeURIComponent(lng));
	if ( useProxy ){
		url = useProxy(url);
	}
	console.log("url:",url);
	try{
		var response = await fetch(url);
		if (response.status!=200){
			throw "Fetch ERROR";
		}
		var json = await response.json();
		if ( json.results ){
			var muni=GSI.MUNI_ARRAY[json.results.muniCd];
			json.results.muni=muni.split(",");
		}
		console.log(json);
		return ( json );
	} catch ( e ){
		return ( null );
	}
}

