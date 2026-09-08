// geojsonTransform.js
// GeoJSON内の全幾何座標（メルカトル等）に対して変換関数を一括適用する座標変換ユーティリティ
//
// License: (MPL v2)
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.

function geojsonTransform(geojson, transformFunc){
	if ( geojson.type){
		if ( geojson.type=="Feature" && geojson.geometry ){
			var geom = geojson.geometry;
			var crd = geom.coordinates;
			if ( geom.type=="Point"){ // point
				geom.coordinates = transformFunc(crd);
			} else if (geom.type=="LineString"){ 
				for ( var i = 0 ; i < crd.length ; i++){
					geom.coordinates[i]=transformFunc(crd[i]);
				}
			} else if (geom.type=="Polygon"){ 
				for ( var i = 0 ; i < crd.length ; i++){
					for ( var j = 0 ; j < crd[i].length ; j++){
						geom.coordinates[i][j]=transformFunc(crd[i][j]);
					}
				}
			} else if (geom.type=="MultiPoint"){ 
				for ( var i = 0 ; i < crd.length ; i++){
					geom.coordinates[i]=transformFunc(crd[i]);
				}
			} else if (geom.type=="MultiLineString"){ 
				for ( var i = 0 ; i < crd.length ; i++){
					for ( var j = 0 ; j < crd[i].length ; j++){
						geom.coordinates[i][j]=transformFunc(crd[i][j]);
					}
				}
			} else if (geom.type=="MultiPolygon"){ 
				for ( var i = 0 ; i < crd.length ; i++){
					for ( var j = 0 ; j < crd[i].length ; j++){
						for ( var k = 0 ; k < crd[i][j].length ; k++){
							geom.coordinates[i][j][k]=transformFunc(crd[i][j][k]);
						}
					}
				}
			}
		} else if (geojson.type=="FeatureCollection" && geojson.features){
			for ( var i = geojson.features.length -1 ; i >=0  ; i--){
				var ft = geojson.features[i];
				if ( ft.type=="Feature" && ft.geometry===null){
					//console.warn("NULL geometry!");
					geojson.features.splice(i,1);
					continue;
				}
				geojsonTransform(ft, transformFunc);
			}
		}
	} else {
		for ( var key in geojson ){
			geojsonTransform(geojson[key], transformFunc);
		}
	}
}

export{geojsonTransform};