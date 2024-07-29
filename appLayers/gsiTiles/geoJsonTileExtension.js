	// dynamicWebTile.js用のgeoJsonTile拡張
	// Programmed by Satoru Takagi
	// Copyrights (C) 2022 by Satoru Takagi @ KDDI CORPORATION All Rights Reserved
	// 
	// License:
	//  This program is free software: you can redistribute it and/or modify
	//  it under the terms of the GNU General Public License version 3 as
	//  published by the Free Software Foundation.
	//
	//  This program is distributed in the hope that it will be useful,
	//  but WITHOUT ANY WARRANTY; without even the implied warranty of
	//  MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
	//  GNU General Public License for more details.
	//
	//  You should have received a copy of the GNU General Public License
	//  along with this program.  If not, see (http://www.gnu.org/licenses/) .

var useCORSproxy = false;

var geoJsonLoadStepCompleted = false; // 無限ループ抑止用

async function setGeoJsonTiles(tileSet){
	if ( geoJsonLoadStepCompleted  ){ //無限ループ抑止
		geoJsonLoadStepCompleted = false;
		return;
	}
	var addTiles=[];
	for ( var tkey in tileSet ){
		if ( ! tileSet[tkey].exist ){
			addTiles.push(getGeoJsonTile( tileSet[tkey].x , tileSet[tkey].y ,  tileSet[tkey].level  ));
		}
	}
	if ( addTiles.length ==0){return}
	var gjTiles = await Promise.all(addTiles);
	console.log("gjTiles:",gjTiles);
	for ( var gjTile of gjTiles){
		if ( gjTile ){
			svgImage.documentElement.appendChild(gjTile);
		}
	}
	console.log("setGeoJsonTiles svgImage:",svgImage);
	geoJsonLoadStepCompleted=true;
	svgMap.refreshScreen();
}

var schema;
async function getGeoJsonTile(x,y,level){
	var tileUrl = dynamicWebTile.getTileURL( x , y , level );
	var grp = svgImage.createElement("g");
	grp.setAttribute("metadata",tileUrl.Key);
	try{
		var geojson = await fetchJson(tileUrl.URL);
		if ( !svgImage.documentElement.getAttribute("property")){
			schema = buildSchema(geojson.features);
		}
		//console.log("getGeoJsonTile:",x,y,level,tileUrl,geojson);
		var color="purple";
		svgMapGIStool.drawGeoJson(geojson,layerID,color,1,color, "p0", "poi", "", grp,schema);
	} catch ( e ){
		// 多分ERR404 タイルない場所
		//console.warn(e);
	}
	return ( grp );
}

async function fetchJson(path){
	var dt = new Date().getTime();
	if (path.indexOf("?")>0){
		path = path + "&time="+dt;
	} else {
		path = path + "?time="+dt;
	}
	if ( useCORSproxy ){
		path = svgMap.getCORSURL(path);
	}
	var response = await fetch(path);
	//console.log("fetchJson:RESP:",response);
	var json = await response.json();
	//console.log("fetchJson:JSON:",json);
	
	return ( json );
}

function buildSchema(features){ // geojsonのfeatureのproprerty名から正規化されたスキーマを生成
	var metaSchema={};
	for ( var feature of features){ // 一応全データをトレース
		for ( var propName in feature.properties){
			if (!metaSchema[propName]){
				metaSchema[propName]=true;
			}
		}
	}
	metaSchema=Object.keys(metaSchema);
	svgImage.documentElement.setAttribute("property",metaSchema.join());
	return ( metaSchema );
}
