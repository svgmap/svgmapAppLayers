// EsriQuery.js
// ArcGIS FeatureServerに対して属性条件や空間範囲（BBOX）を指定してクエリURLを生成するクラス
//
// License: (MPL v2)
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.

class EsriQuery{
	constructor(baseURL, whereQuery, orderByFields, outFields){
		this.baseURL = baseURL;
		this.whereQuery = whereQuery;
		this.orderByFields = orderByFields;
		this.outFields = outFields;
	}
	
	getURL(tileInfo){
		var geomq="";
		var quantq="";
		var offsetq="";
		var resq="";
		var gmtq="";
		var dsrq ="";
		if ( tileInfo){
			var geometry=`${tileInfo.x},${tileInfo.y},${tileInfo.x+tileInfo.width},${tileInfo.y+tileInfo.height}`;
			var quantizationParameters = (`{
				"extent":{
					"xmin":${tileInfo.x},
					"ymin":${tileInfo.y},
					"xmax":${tileInfo.x+tileInfo.width},
					"ymax":${tileInfo.y+tileInfo.height}
				},
				"mode":"view",
				"originPosition":"upperLeft",
				"tolerance":${tileInfo.pixel}
			}`);
			quantizationParameters = this.trim(quantizationParameters);
			
			geomq = `geometry=${encodeURIComponent(geometry)}&`;
			quantq = `quantizationParameters=${encodeURIComponent(quantizationParameters)}&`;
			offsetq = `maxAllowableOffset=${tileInfo.pixel}&`;
			resq = `resultType=tile&`;
			gmtq = `geometryType=esriGeometryEnvelope&`;
			dsrq = `defaultSR=102100`;
		} else {
			dsrq = `outSR=102100`;
		}
		
		var ans = `${this.baseURL}?f=pbf&
		${geomq}
		${offsetq}
		maxRecordCountFactor=4&
		resultOffset=0&
		resultRecordCount=8000&
		where=${encodeURIComponent(this.whereQuery)}&
		orderByFields=${encodeURIComponent(this.orderByFields)}&
		outFields=${encodeURIComponent(this.outFields)}&
		${quantq}
		${resq}
		spatialRel=esriSpatialRelIntersects&
		${gmtq}
		${dsrq}`;
		
		ans = this.trim(ans);
		return ( ans );
	}
	trim(ans){
		ans = ans.replaceAll(/\t/g,"");
		ans = ans.replaceAll(/\r/g,"");
		ans = ans.replaceAll(/\n/g,"");
		return ( ans );
	}
}

export {EsriQuery};