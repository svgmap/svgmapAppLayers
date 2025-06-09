// Description: gsiHinanCsv2GJS module
//
// Programmed by Satoru Takagi
//
// License: (MPL v2)
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.
function gsiHinanCsv2GJS(csvTxt){
	var csvArray;
	if ( csvTxt instanceof Array){
		csvArray = csvTxt;
	} else {
		csvArray = csv2Array(csvTxt);
	}
	var schema = csvArray[0];
	var gjs = {
		"type": "FeatureCollection",
		"features": []
	}
	
	for ( var i = 1 ; i < csvArray.length - 1  ; i++){
		var rec=csvArray[i];
		var ft =    {
			"type": "Feature",
			"geometry": {
				"type": "Point",
//				"coordinates": [lng, lat]
			},
			"properties": {
			}
		};
		var lat,lng;
		for ( var c = 0 ; c < schema.length ; c++){
			if ( schema[c]=="緯度"){
				lat = Number(rec[c]);
			} else if ( schema[c]=="経度"){
				lng = Number(rec[c]);
			} else {
				ft.properties[schema[c]]=rec[c];
			}
		}
		ft.geometry.coordinates = [lng,lat];
		gjs.features.push(ft);
	}
	return gjs; // GeoJSONにするには、JSON.stringifyしてね
}

function csv2Array(csvTxt){
	ans = [];
	csvTxt = csvTxt.split("\n");
	csvTxt.forEach(function(line,lidx){
		line = line.trim();
		line = line.split(",");
		line.forEach(function(col,cidx){
			col = col.trim();
			line[cidx]=col;
		});
		if ( line.length >1){
			ans.push(line);
		}
	});
	return ans;
}

export { gsiHinanCsv2GJS }