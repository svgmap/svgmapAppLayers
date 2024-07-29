// 2021/4/13 SVGMapLv0.1_GIS_r3.jsに反映し、開発終了！

( function ( window , undefined ) { 
var document = window.document;
var navigator = window.navigator;
var location = window.location;

var svgMapGeoJsonRenderer = ( function(){ 
	var svgMap;
	function setSvgMap(obj){
		svgMap = obj;
	}
	
	
	function setMetaProp(metaSchema,svgImage){
		var metaSchemaStr =metaSchema[0];
		for ( var i = 1 ; i < metaSchema.length ; i++ ){
			metaSchemaStr+=","+metaSchema[i];
		}
		console.log("metaSchemaStr:",metaSchemaStr);
		var svgMapRootElm = svgImage.documentElement;
		svgMapRootElm.setAttribute("property",metaSchemaStr);
	}
	
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
	
	// geoJsonレンダラ系
	// geoJsonレンダラ系
	function drawGeoJson( geojson , targetSvgDocId, strokeColor, strokeWidth, fillColor, POIiconId, poiTitle, metadata, parentElm,metaDictionary){
//		console.log("called svgMapGisTool drawGeoJson");
		var svgImages = svgMap.getSvgImages();
		var svgImagesProps = svgMap.getSvgImagesProps();
		var svgImage = svgImages[targetSvgDocId];
		var svgImagesProp = svgImagesProps[targetSvgDocId];
		var crs = svgImagesProp.CRS;
		
		if ( geojson.metadata){ // 2020/1/8
			metadata=geojson.metadata;
//			console.log("Set metadata on drawGeoJson:",metadata)
		} // ISSUE 2020.1.14 本来のgeojsonでは、 properties type:Featureオブジェクト下の "properties"プロパティに{KV,..}としてメタデータを入れる仕様　これをサポートするべき
		
		if (geojson.properties){ // 拡張メタデータ機構：標準geojsonはFeature下のみ許されるがどこでもOKに、下層はそれを継承上書き（デフォ属性可に）
			if (!metadata){
				metadata={};
			}
			for ( var mkey in geojson.properties){
				metadata[mkey]=geojson.properties[mkey];
			}
		}
		
		if ( !geojson.type && geojson.length >0 ){ // これはおそらく本来はエラーだが
			for ( var i = 0 ; i < geojson.length ; i++ ){
				drawGeoJson( geojson[i] , targetSvgDocId, strokeColor, strokeWidth, fillColor, POIiconId, poiTitle, metadata, parentElm,metaDictionary);
			}
		} else if ( geojson.type == "FeatureCollection" ){
			var features = geojson.features;
			for ( var i = 0 ; i < features.length ; i++ ){
				drawGeoJson( features[i] , targetSvgDocId, strokeColor, strokeWidth, fillColor, POIiconId, poiTitle, metadata, parentElm,metaDictionary);
			}
		} else if ( geojson.type == "Feature" ){
			var geom = geojson.geometry;
			/**
			if(geojson.properties){
				metadata = "";
				postMeta = Object.keys(geojson.properties).map(function(key){return geojson.properties[key]});
				for(var i=0; i<postMeta.length; i++){
					metadata = metadata + postMeta[i];
					if(i != postMeta.length - 1){
						metadata = metadata + ",";
					}
				}
			}
			**/
			drawGeoJson( geom , targetSvgDocId, strokeColor, strokeWidth, fillColor, POIiconId, poiTitle, metadata, parentElm,metaDictionary);
		} else if ( geojson.type == "GeometryCollection" ){
			var geoms = geojson.geometries;
			for ( var i = 0 ; i < geoms.length ; i++ ){
				drawGeoJson( geoms[i] , targetSvgDocId, strokeColor, strokeWidth, fillColor, POIiconId, poiTitle, metadata, parentElm,metaDictionary);
			}
		} else if ( geojson.type == "MultiPolygon" ){
			// これは、pathのサブパスのほうが良いと思うが・・
			if ( geojson.coordinates.length >0){
				for ( var i = 0 ; i < geojson.coordinates.length ; i++ ){
					putPolygon(geojson.coordinates[i], svgImage, crs, fillColor, metadata, parentElm,metaDictionary);
				}
			}
		} else if ( geojson.type == "Polygon" ){
			putPolygon(geojson.coordinates, svgImage, crs, fillColor, metadata, parentElm,metaDictionary);
		} else if ( geojson.type == "MultiLineString" ){
			// これは、pathのサブパスのほうが良いと思うが・・
			if ( geojson.coordinates.length >0){			
				for ( var i = 0 ; i < geojson.coordinates.length ; i++ ){
					putLineString(geojson.coordinates[i], svgImage, crs, strokeColor, strokeWidth, metadata, parentElm,metaDictionary);
				}
			}
		} else if ( geojson.type == "LineString" ){
			putLineString(geojson.coordinates, svgImage, crs, strokeColor, strokeWidth, metadata, parentElm,metaDictionary);
			
		} else if ( geojson.type == "MultiPoint" ){
			// グループで囲んで一括でmetadataつけたほうが良いと思うが・・
			if ( geojson.coordinates.length >0){
				for ( var i = 0 ; i < geojson.coordinates.length ; i++ ){
					putPoint(geojson.coordinates[i], svgImage, crs, POIiconId, poiTitle, metadata, parentElm,metaDictionary);
				}
			}
		} else if ( geojson.type == "Point" ){
			putPoint(geojson.coordinates, svgImage, crs, POIiconId, poiTitle, metadata, parentElm,metaDictionary);
		}
		
	}
	
	function putPoint(coordinates, svgImage, crs, POIiconId, poiTitle, metadata, parentElm,metaDictionary){
		var metastyle = getSvgMapSimpleMeta(metadata,metaDictionary);
		//console.log("putPoint: style:",metastyle.styles);
		var metaString = array2string(metastyle.normalized);
		if ( ! metaString && metastyle.styles.description ){
			metaString = metastyle.styles.description
		}
		if ( ! POIiconId ){
			POIiconId = "p0"; // 適当だ・・
		}
		if ( metastyle.styles["marker-symbol"] ){
			POIiconId = metastyle.styles["marker-symbol"];
		}
		var fill,stroke;
		var opacity=1;
		var strokeWidth = 0;
		if ( metastyle.styles.opacity ){
			opacity = Number(metastyle.styles.opacity);
		}
		if ( metastyle.styles.fill ){
			fill = metastyle.styles.fill;
		}
		if ( metastyle.styles["marker-color"] ){
			fill = metastyle.styles["marker-color"];
		}
		if ( metastyle.styles.stroke ){
			stroke = metastyle.styles.stroke;
			strokeWidth = 1;
		}
		if ( metastyle.styles["stroke-width"] ){
			strokeWidth = metastyle.styles["stroke-width"];
		}
		
		if ( metastyle.styles.title !=null && metastyle.styles.title !=undefined  ){
			poiTitle = metastyle.styles.title+"";
		}
		
		
		var poie = svgImage.createElement("use");
		var svgc = getSVGcoord(coordinates,crs);
		poie.setAttribute( "x" , "0" );
		poie.setAttribute( "y" , "0" );
		poie.setAttribute( "transform" , "ref(svg," + svgc.x + "," + svgc.y + ")" );
		poie.setAttribute( "xlink:href" , "#" + POIiconId );
		if ( poiTitle ){
			poie.setAttribute( "xlink:title", poiTitle);
		}
		if ( metaString ){
			poie.setAttribute( "content", metaString);
		}
		if ( fill ){
			poie.setAttribute( "fill", fill);
		}
		if ( strokeWidth > 0 ){
			poie.setAttribute("stroke",stroke);
			poie.setAttribute("stroke-width",strokeWidth);
			poie.setAttribute("vector-effect","non-scaling-stroke");
		} else {
			poie.setAttribute("stroke","none");
		}
		if ( opacity <1){
			poie.setAttribute("opacity",opacity);
		}
		//console.log(poie);
		if ( parentElm ){
			parentElm.appendChild( poie );
		} else {
			svgImage.documentElement.appendChild( poie );
		}
		return ( poie );
	}
	
	function putLineString(coordinates, svgImage, crs, strokeColor, strokeWidth, metadata, parentElm,metaDictionary){
		var metastyle = getSvgMapSimpleMeta(metadata,metaDictionary);
		var metaString = array2string(metastyle.normalized);
		if ( ! metaString && metastyle.styles.description ){
			metaString = metastyle.styles.description
		}
		if ( !strokeColor ){
			strokeColor = "blue";
		}
		if ( !strokeWidth ){
			strokeWidth = 3;
		}
		var opacity=1;
		if ( metastyle.styles.opacity ){
			opacity = Number(metastyle.styles.opacity);
		}
		
		if ( metastyle.styles.stroke ){
			strokeColor = metastyle.styles.stroke;
		}
		if ( metastyle.styles["stroke-width"] ){
			strokeWidth = metastyle.styles["stroke-width"];
		}
		var title;
		if ( metastyle.styles.title ){
			title = metastyle.styles.title;
		}
		
		var pe = svgImage.createElement("path");
		var pathD = getPathD( coordinates , crs );
		pe.setAttribute("d",pathD);
		pe.setAttribute("fill","none");
		pe.setAttribute("stroke",strokeColor);
		pe.setAttribute("stroke-width",strokeWidth);
		pe.setAttribute("vector-effect","non-scaling-stroke");
		if ( opacity <1){
			pe.setAttribute("opacity",opacity);
		}
		if ( title ){
			pe.setAttribute( "xlink:title", title);
		}
		if ( metaString ){
			pe.setAttribute( "content", metaString);
		}
		if ( parentElm ){
			parentElm.appendChild( pe );
		} else {
			svgImage.documentElement.appendChild( pe );
		}
//		console.log("putLineString:",pe);
		return (pe);
	}
	
	function putPolygon(coordinates, svgImage, crs, fillColor, metadata, parentElm,metaDictionary){
		var metastyle = getSvgMapSimpleMeta(metadata,metaDictionary);
		var metaString = array2string(metastyle.normalized);
		if ( ! metaString && metastyle.styles.description ){
			metaString = metastyle.styles.description
		}
		if ( coordinates.length ==0){
			return;
		}
		var strokeColor = "none";
		var strokeWidth = 0;
		if ( !fillColor ){
			fillColor = "orange";
		}
		
		if ( metastyle.styles.fill){
			fillColor = metastyle.styles.fill;
		}
		
		if ( metastyle.styles.stroke ){
			strokeWidth = 1;
			strokeColor = metastyle.styles.stroke;
		}
		
		if ( metastyle.styles["stroke-width"] ){
			strokeWidth = metastyle.styles["stroke-width"];
		}
		
		var opacity=1;
		if ( metastyle.styles.opacity ){
			opacity = Number(metastyle.styles.opacity);
		}
		
		var title;
		if ( metastyle.styles.title ){
			title = metastyle.styles.title;
		}
		
		
		
		var pe = svgImage.createElement("path");
		
		var pathD="";
		for ( var i = 0 ; i < coordinates.length ; i++ ){
			pathD += getPathD( coordinates[i] , crs )+"z ";
		}
		
		pe.setAttribute("d",pathD);
		pe.setAttribute("fill",fillColor);
		pe.setAttribute("fill-rule", "evenodd");
		if ( strokeWidth > 0 ){
			pe.setAttribute("stroke",strokeColor);
			pe.setAttribute("stroke-width",strokeWidth);
			pe.setAttribute("vector-effect","non-scaling-stroke");
		} else {
			pe.setAttribute("stroke","none");
		}
		if ( opacity <1){
			pe.setAttribute("opacity",opacity);
		}
		if ( title ){
			pe.setAttribute( "xlink:title", title);
		}
		if ( metaString ){
			pe.setAttribute( "content", metaString);
		}
		if ( parentElm ){
			parentElm.appendChild( pe );
		} else {
			svgImage.documentElement.appendChild( pe );
		}
		return ( pe);
	}
	
	function getPathD( geoCoords , crs ){
		if ( geoCoords.length ==0){
			return(" ");
		}
		var ans ="M";
		var svgc = getSVGcoord(geoCoords[0],crs);
		ans += svgc.x + "," + svgc.y + " L";
		for ( var i = 1 ; i < geoCoords.length ; i++ ){
			svgc = getSVGcoord(geoCoords[i],crs);
			ans += svgc.x + "," + svgc.y + " ";
		}
		return ( ans );
	}
	
	function getSVGcoord( geoCoord , crs ){
		// DEBUG 2017.6.12 geojsonの座標並びが逆だった 正しくは経度,緯度並び
		return{ 
			x: geoCoord[0] * crs.a + geoCoord[1] * crs.c + crs.e ,
			y: geoCoord[0] * crs.b + geoCoord[1] * crs.d + crs.f
		}
	}
	
	// geoJsonのpropertyに以下の予約語が入っていたらスタイルと見做す(mapboxのgeojson拡張Simplestyleをベース)
	// See https://github.com/mapbox/simplestyle-spec
	// この実装では、opacity追加、"marker-size"の実装をどうしようか考え中です・・
	var styleDict =["title","description","marker-size","marker-symbol","marker-color","stroke","stroke-width","fill","opacity"];
	
	function getSvgMapSimpleMeta(metadata,metaDictionary){
		var others={};
		var hitMeta=[];
		var style={};
		if ( metadata.length ){
			hitMeta = metadata;
		} else {
			if (metaDictionary){
				hitMeta = new Array(metaDictionary.length);
				for ( var key in metadata){
					var idx = metaDictionary.indexOf(key);
					if ( idx >= 0 ){
						// hit
						hitMeta[idx]=metadata[key];
					} else {
						var styleIndex = styleDict.indexOf(key);
						if ( styleIndex >= 0 ){
							style[styleDict[styleIndex]]=metadata[key];
						} else {
							// ユーザメタデータにもスタイルにもヒットしない
							others[key]=metadata[key];
						}
					}
				}
				if ( !style["title"] ){
					style["title"] = metadata[metaDictionary[0]];
				}
			} else {
				// Prop Name(Key)順にソートしてならべるのが良いかと・・
//				console.log("sort by prop name");
				var keys = Object.keys(metadata);
				keys.sort();
				for(var key of keys) {
					if ( styleDict.indexOf(key) >=0 ){
						style[key]=metadata[key];
					} else {
						hitMeta.push(metadata[key]);
					}
				}
				if ( !style["title"] ){
					style["title"] = metadata[keys[0]];
				}
			}
		}
		var ans = {
			normalized: hitMeta,
			others:others,
			styles:style,
		};
		
//		console.log("getSvgMapSimpleMeta:",ans);
		return ans;
	}
	
	function array2string(arr){
		var ans;
		if ( arr.length == 0 ){
			return(null);
		}
		for ( var i = 0 ; i < arr.length ; i++ ){
			var s = "";
			if ( arr[i]!=null && arr[i]!=undefined  ){
				s=svgMap.escape(arr[i].toString());
				s=s.replace(/,/g,"&#x2c;");
			}
			if (i==0){
				ans = s;
			} else {
				ans += "," + s;
			}
		}
		return ( ans );
	}
	
return { // svgMapGIStool. で公開する関数のリスト
	setSvgMap: setSvgMap,
	drawGeoJson : drawGeoJson,
	generateMetaSchema:generateMetaSchema,
	setMetaProp:setMetaProp,
}

})();

window.svgMapGeoJsonRenderer = svgMapGeoJsonRenderer;


})( window );

