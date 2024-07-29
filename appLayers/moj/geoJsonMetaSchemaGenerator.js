// ../jma2021/svgMapGeoJson_r2.js　から抜き出し。
// geoJsonの正規化メタデータ辞書を構築するライブラリ
// svgMapGISにマージ予定
	var styleDict =["title","description","marker-size","marker-symbol","marker-color","stroke","stroke-width","fill","opacity"];

	function generateMetaSchema(json){
		var metaDict = {};
		function metaParse(json){
			var metaParsed=false;
			if ( json.properties){
				for (mkey in json.properties ){
					metaParsed=true;
					metaDict[mkey]=true;;
				}
			} else {
				for (key in json ){
					if ( typeof(json[key])=="object"){
						metaParsed = metaParse(json[key]);
					}
				}
			}
			return ( metaParsed );
		}
		
		metaParse(json);
		var keys = Object.keys(metaDict);
		keys.sort();
		var hitMeta=[];
		//console.log("keys:",keys);
		if ( keys.indexOf("title")>=0){
			hitMeta.push("title");
		}
		if ( keys.indexOf("名称")>=0){
			hitMeta.push("名称");
		}
		for(var key of keys) {
			if ( key!="名称" && (key.indexOf("名")>=0||key.indexOf("name")>=0)){
				hitMeta.push(key);
			}
		}
		if ( keys.indexOf("id")>=0){
			hitMeta.push("id");
		}
		for(var key of keys) {
			if ( styleDict.indexOf(key) >=0 ){
				// skip
			} else if ( hitMeta.indexOf(key)>=0){
				// skip
			} else {
				hitMeta.push(key);
			}
		}
		//console.log("metaDict:",metaDict,"  hitMeta:",hitMeta);
		return ( hitMeta );
	}

	function setMetaProp(metaSchema,svgImage, nameDict){
		var metaSchemaStr =metaSchema[0];
		if ( nameDict[metaSchema[0]]){metaSchemaStr =nameDict[metaSchema[0]]}
		for ( var i = 1 ; i < metaSchema.length ; i++ ){
			if ( nameDict[metaSchema[i]]){
				metaSchemaStr+=","+nameDict[metaSchema[i]];
			} else {
				metaSchemaStr+=","+metaSchema[i];
			}
		}
		console.log("metaSchemaStr:",metaSchemaStr);
		var svgMapRootElm = svgImage.documentElement;
		svgMapRootElm.setAttribute("property",metaSchemaStr);
	}
