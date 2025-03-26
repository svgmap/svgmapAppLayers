// Extended KML renderer for svgmap based on svgMapGIStool.drawKml()
//
//  Copyright (C) 2025 by Satoru Takagi @ KDDI CORPORATION

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
//

class KMLrenderer{
	
	#svgMap;
	
	constructor(svgMapOject){
		this.#svgMap = svgMapOject;
	}
	/*
		Styleは実装～してないように見えます
		Point     : title = name, metadata = descrptionとして格納
		LineString: metadata = name, descriptionとして格納
	*/

	drawKml(
		kml,
		targetSvgDocId,
		strokeColor,
		strokeWidth,
		fillColor,
		POIiconId,
		poiTitle,
		metadata,
		parentElm,
		styleData,
		recursiveCalled
	) {
		console.log("kml draw method.");
		var svgImages = this.#svgMap.getSvgImages();
		var svgImagesProps = this.#svgMap.getSvgImagesProps();
		var svgImage = svgImages[targetSvgDocId];
		var svgImagesProp = svgImagesProps[targetSvgDocId];
		var crs = svgImagesProp.CRS;
		//フォルダについて文法解釈
		var folders = kml.querySelectorAll("Folder");
		console.log(folders);
		if ( !recursiveCalled){
			this.#processStyleUrls(kml);
		}
		if (folders.length > 0) {
			var fld = Array.prototype.slice.call(folders, 0);
			//NodeListのループ
			//Firefox/Chrome
			//folders.forEach(folder => {
			//case IE Edge
			//Array.prototype.forEach.call(folders, (folder) => {
			//case IE11
			//fld.forEach(function(folder,index){
			fld.forEach((folder, index) => {
				var kmlName = this.#getNameFromKML(folder);
				var kmlDescription = this.#getDescriptionFromKML(folder);
				var kmlStyle = this.#getStyleFromKML(folder);
				//console.log('FOLDER',folder);
				if ( kmlStyle?.LineStyle?.color?.color){
					strokeColor = kmlStyle.LineStyle.color.color;
				}
				//console.log("kmlStyle:",kmlStyle,"  strokeColor:",strokeColor);
				this.drawKml(
					folder,
					targetSvgDocId,
					strokeColor,
					strokeWidth,
					fillColor,
					POIiconId,
					kmlName,
					kmlDescription,
					parentElm,
					styleData,
					true
				);
			});
		} else {
			//Placemarkについて文法解釈
			var placemarkAll = kml.querySelectorAll("Placemark");
			//console.log(placemarkAll);
			var plm = Array.prototype.slice.call(placemarkAll, 0);
			let arr_metadata = [];
			plm.forEach((placemark, index) => {
				var kmlName = this.#getNameFromKML(placemark);
				var kmlDescription = this.#getDescriptionFromKML(placemark);
				var kmlStyle = this.#getStyleFromKML(placemark);
				//console.log('FOLDER',folder);
				if ( kmlStyle?.LineStyle?.color?.color){
					strokeColor = kmlStyle.LineStyle.color.color;
				}
				if (kmlName === null && kmlDescription === null) {
					kmlName = poiTitle;
					kmlDescription = metadata;
				}
				var kmlGeometory = this.#getGeometryFromKML(placemark);
				var kmlCoordinate = this.#getCordinamteFromKML(placemark);

				if (kmlGeometory == "point") {
					this.#putPoint(
						kmlCoordinate,
						svgImage,
						crs,
						POIiconId,
						kmlName,
						[kmlDescription],
						parentElm
					);
				} else if (kmlGeometory == "linestring") {
					arr_metadata.push(kmlName);
					arr_metadata.push(kmlDescription);
					this.#putLineString(
						kmlCoordinate,
						svgImage,
						crs,
						strokeColor,
						strokeWidth,
						arr_metadata,
						parentElm
					);
				} else if (kmlGeometory == "linearring") {
					arr_metadata.push(kmlName);
					arr_metadata.push(kmlDescription);
					this.#putLineString(
						kmlCoordinate,
						svgImage,
						crs,
						strokeColor,
						strokeWidth,
						arr_metadata,
						parentElm
					);
				} else if (kmlGeometory == "polygon") {
				} else if (kmlGeometory == "multigeometry") {
				}
			});
		}
	}

	#getNameFromKML(item) {
		var nameTag = item.querySelector("name");
		if (nameTag) {
			return nameTag.textContent.trim();
		} else {
			return null;
		}
	}

	#getDescriptionFromKML(item) {
		var nameTag = item.querySelector("description");
		if (nameTag) {
			return nameTag.textContent.trim();
		} else {
			return null;
		}
	}
	
	#getTextContent(element, tagName) {
		const el = element.getElementsByTagName(tagName)[0];
		return el ? el.textContent : null;
	}
	
	#kmlColorToRgba(kmlColor) {
		if (!kmlColor || kmlColor.length !== 8) {
			return null;
		}
		const a = parseInt(kmlColor.substring(0, 2), 16) / 255;
		const b = parseInt(kmlColor.substring(2, 4), 16);
		const g = parseInt(kmlColor.substring(4, 6), 16);
		const r = parseInt(kmlColor.substring(6, 8), 16);
		return `rgba(${r}, ${g}, ${b}, ${a})`;
	}
	
	#kmlColorToSvgAttributes(kmlColor) {
		if (!kmlColor || kmlColor.length !== 8) {
			return null;
		}
		const a = parseInt(kmlColor.substring(0, 2), 16) / 255;
		const b = parseInt(kmlColor.substring(2, 4), 16).toString(16).padStart(2, '0');
		const g = parseInt(kmlColor.substring(4, 6), 16).toString(16).padStart(2, '0');
		const r = parseInt(kmlColor.substring(6, 8), 16).toString(16).padStart(2, '0');
		return {
			color: `#${r}${g}${b}`,
			opacity: a
		};
	}	
	
	#processStyleUrls(kml){
		var styleUrls = kml.getElementsByTagName("styleUrl");
		console.log(styleUrls);
		if ( styleUrls.length < 1){
			return;
		}
		var styles=kml.getElementsByTagName("Style");
		var styleDict ={};
		for ( var st of styles ){
			var stid = st.getAttribute("id");
			st.removeAttribute("id");
			if (stid){
				styleDict["#"+stid]=st;
			}
		}
		console.log(styleDict);
		if ( Object.keys(styleDict)<1){
			return;
		}
		console.log(styleUrls);
		for ( var su of styleUrls){
			var se = styleDict[su.textContent.trim()];
			if ( se ){
				su.parentElement.appendChild(se.cloneNode(true));
			} else {
				console.log("UN Hit style : ",su.textContent.trim());
			}
		}
		console.log("styled kml:",kml);
	}
	
	#getStyleFromKML(item){
		// Parse IconStyle
		const styleElement = item.getElementsByTagName('Style')[0];
		if (!styleElement){
			return {};
		}
		const iconStyleElement = styleElement.getElementsByTagName('IconStyle')[0];
		const styleObject={};
		if (iconStyleElement) {
			const color = this.#kmlColorToSvgAttributes(this.#getTextContent(iconStyleElement, 'color'));
			const scale = parseFloat(this.#getTextContent(iconStyleElement, 'scale'));
			const href = this.#getTextContent(iconStyleElement.getElementsByTagName('Icon')[0], 'href');
			if ( color || scale || href ){
				styleObject.IconStyle = {};
				if ( color ){
					styleObject.IconStyle.color = color;
				}
				if ( scale ){
					styleObject.IconStyle.scale = scale;
				}
				if ( href ){
					styleObject.IconStyle.href = href;
				}
			}
		}

		// Parse LabelStyle
		const labelStyleElement = styleElement.getElementsByTagName('LabelStyle')[0];
		if (labelStyleElement) {
			const color= this.#kmlColorToSvgAttributes(this.#getTextContent(labelStyleElement, 'color'));
			const scale= parseFloat(this.#getTextContent(labelStyleElement, 'scale'));
			if ( color || scale ){
				styleObject.LabelStyle = {};
				if ( color ){
					styleObject.LabelStyle.color = color;
				}
				if ( scale ){
					styleObject.LabelStyle.scale = scale;
				}
			}
		}

		// Parse LineStyle
		const lineStyleElement = styleElement.getElementsByTagName('LineStyle')[0];
		if (lineStyleElement) {
			const color = this.#kmlColorToSvgAttributes(this.#getTextContent(lineStyleElement, 'color'));
			const width = parseFloat(this.#getTextContent(lineStyleElement, 'width'));
			if ( color || width ){
				styleObject.LineStyle = {};
				if ( color ){
					styleObject.LineStyle.color = color;
				}
				if ( width ){
					styleObject.LineStyle.width = width;
				}
			}
		}

		// Parse PolyStyle
		const polyStyleElement = styleElement.getElementsByTagName('PolyStyle')[0];
		if (polyStyleElement) {
			const color = this.#kmlColorToSvgAttributes(this.#getTextContent(polyStyleElement, 'color'));
			const colorMode = this.#getTextContent(polyStyleElement, 'colorMode');
			const fill = (parseInt(this.#getTextContent(polyStyleElement, 'fill'), 10) || null);
			if ( color || colorMode || fill ){
				styleObject.PolyStyle = {};
				if ( color ){
					styleObject.PolyStyle.color = color;
				}
				if ( colorMode ){
					styleObject.PolyStyle.colorMode = colorMode;
				}
				if ( fill ){
					styleObject.PolyStyle.fill = fill;
				}
			}
		}
		return styleObject;
	}

	#getGeometryFromKML(item) {
		if (item.querySelector("Placemark")) {
			return "placemark";
		} else if (item.querySelector("Polygon")) {
			return "polygon";
		} else if (item.querySelector("Point")) {
			return "point";
		} else if (item.querySelector("LineString")) {
			return "linestring";
		} else if (item.querySelector("LinearRing")) {
			return "linearring";
		} else if (item.querySelector("MultiGeometry")) {
			return "multigeometry";
		}
	}

	#getCordinamteFromKML(item) {
		var geoArray = [];
		var coordinates = item
			.querySelector("coordinates")
			.textContent.trim()
			.replace(/\n/g, " ")
			.replace(/\t/g, " ")
			.split(" ");
		for (var i = 0; i < coordinates.length; i++) {
			let coordinate = coordinates[i].trim().split(",");
			geoArray.push([coordinate[0], coordinate[1]]);
		}
		return geoArray;
	}

	#putPoint(
		coordinates,
		svgImage,
		crs,
		POIiconId,
		poiTitle,
		metadata,
		parentElm,
		metaDictionary
	) {
		var metastyle = this.#getSvgMapSimpleMeta(metadata, metaDictionary);
		// console.log("putPoint: style:",metastyle.styles,"  metadata:",metadata,"  metaDictionary:",metaDictionary);
		var metaString = this.#array2string(metastyle.normalized);
		if (!metaString && metastyle.styles.description) {
			metaString = metastyle.styles.description;
		}
		if (!POIiconId) {
			POIiconId = "p0"; // 適当だ・・
		}
		if (metastyle.styles["marker-symbol"]) {
			POIiconId = metastyle.styles["marker-symbol"];
		}
		var fill, stroke;
		var opacity = 1;
		var strokeWidth = 0;
		if (metastyle.styles.opacity) {
			opacity = Number(metastyle.styles.opacity);
		}
		if (metastyle.styles.fill) {
			fill = metastyle.styles.fill;
		}
		if (metastyle.styles["marker-color"]) {
			fill = metastyle.styles["marker-color"];
		}
		if (metastyle.styles.stroke) {
			stroke = metastyle.styles.stroke;
			strokeWidth = 1;
		}
		if (metastyle.styles["stroke-width"]) {
			strokeWidth = metastyle.styles["stroke-width"];
		}

		if (metastyle.styles.title != null && metastyle.styles.title != undefined) {
			poiTitle = metastyle.styles.title + "";
		} else {
			if (metadata.title) {
				poiTitle = metadata.title + "";
			}
		}

		var poie = svgImage.createElement("use");
		var svgc = this.#getSVGcoord(coordinates, crs);
		if (!svgc) {
			return null;
		}
		poie.setAttribute("x", "0");
		poie.setAttribute("y", "0");
		poie.setAttribute("transform", "ref(svg," + svgc.x + "," + svgc.y + ")");
		poie.setAttribute("xlink:href", "#" + POIiconId);
		if (poiTitle) {
			poie.setAttribute("xlink:title", poiTitle);
		}
		if (metaString) {
			poie.setAttribute("content", metaString);
		}
		if (fill) {
			poie.setAttribute("fill", fill);
		}
		if (strokeWidth > 0) {
			poie.setAttribute("stroke", stroke);
			poie.setAttribute("stroke-width", strokeWidth);
			poie.setAttribute("vector-effect", "non-scaling-stroke");
		} else {
			poie.setAttribute("stroke", "none");
		}
		if (opacity < 1) {
			poie.setAttribute("opacity", opacity);
		}
		//console.log(poie);
		if (parentElm) {
			parentElm.appendChild(poie);
		} else {
			svgImage.documentElement.appendChild(poie);
		}
		return poie;
	}

	#putLineString(
		coordinates,
		svgImage,
		crs,
		strokeColor,
		strokeWidth,
		metadata,
		parentElm,
		metaDictionary
	) {
		var metastyle = this.#getSvgMapSimpleMeta(metadata, metaDictionary);
		var metaString = this.#array2string(metastyle.normalized);
		if (!metaString && metastyle.styles.description) {
			metaString = metastyle.styles.description;
		}
		if (!strokeColor) {
			strokeColor = "blue";
		}
		if (!strokeWidth) {
			strokeWidth = 3;
		}
		var opacity = 1;
		if (metastyle.styles.opacity) {
			opacity = Number(metastyle.styles.opacity);
		}

		if (metastyle.styles.stroke) {
			strokeColor = metastyle.styles.stroke;
		}
		if (metastyle.styles["stroke-width"]) {
			strokeWidth = metastyle.styles["stroke-width"];
		}
		var title;
		if (metastyle.styles.title) {
			title = metastyle.styles.title;
		}

		var pe = svgImage.createElement("path");
		var pathD = this.#getPathD(coordinates, crs);
		pe.setAttribute("d", pathD);
		pe.setAttribute("fill", "none");
		pe.setAttribute("stroke", strokeColor);
		pe.setAttribute("stroke-width", strokeWidth);
		pe.setAttribute("vector-effect", "non-scaling-stroke");
		if (opacity < 1) {
			pe.setAttribute("opacity", opacity);
		}
		if (title) {
			pe.setAttribute("xlink:title", title);
		}
		if (metaString) {
			pe.setAttribute("content", metaString);
		}
		if (parentElm) {
			parentElm.appendChild(pe);
		} else {
			svgImage.documentElement.appendChild(pe);
		}
		//		console.log("putLineString:",pe);
		return pe;
	}

	#putPolygon(
		coordinates,
		svgImage,
		crs,
		fillColor,
		metadata,
		parentElm,
		metaDictionary
	) {
		var metastyle = this.#getSvgMapSimpleMeta(metadata, metaDictionary);
		var metaString = this.#array2string(metastyle.normalized);
		if (!metaString && metastyle.styles.description) {
			metaString = metastyle.styles.description;
		}
		if (coordinates.length == 0) {
			return;
		}
		var strokeColor = "none";
		var strokeWidth = 0;
		if (!fillColor) {
			fillColor = "orange";
		}

		if (metastyle.styles.fill) {
			fillColor = metastyle.styles.fill;
		}

		if (metastyle.styles.stroke) {
			strokeWidth = 1;
			strokeColor = metastyle.styles.stroke;
		}

		if (metastyle.styles["stroke-width"]) {
			strokeWidth = metastyle.styles["stroke-width"];
		}

		var opacity = 1;
		if (metastyle.styles.opacity) {
			opacity = Number(metastyle.styles.opacity);
		}

		var title;
		if (metastyle.styles.title) {
			title = metastyle.styles.title;
		}

		var pe = svgImage.createElement("path");

		var pathD = "";
		for (var i = 0; i < coordinates.length; i++) {
			pathD += this.#getPathD(coordinates[i], crs) + "z ";
		}

		pe.setAttribute("d", pathD);
		pe.setAttribute("fill", fillColor);
		pe.setAttribute("fill-rule", "evenodd");
		if (strokeWidth > 0) {
			pe.setAttribute("stroke", strokeColor);
			pe.setAttribute("stroke-width", strokeWidth);
			pe.setAttribute("vector-effect", "non-scaling-stroke");
		} else {
			pe.setAttribute("stroke", "none");
		}
		if (opacity < 1) {
			pe.setAttribute("opacity", opacity);
		}
		if (title) {
			pe.setAttribute("xlink:title", title);
		}
		if (metaString) {
			pe.setAttribute("content", metaString);
		}
		if (parentElm) {
			parentElm.appendChild(pe);
		} else {
			svgImage.documentElement.appendChild(pe);
		}
		return pe;
	}

	#getPathD(geoCoords, crs) {
		if (geoCoords.length == 0) {
			return " ";
		}
		var ans = "M";
		var svgc = this.#getSVGcoord(geoCoords[0], crs);
		if (svgc) {
			ans += svgc.x + "," + svgc.y + " L";
			for (var i = 1; i < geoCoords.length; i++) {
				svgc = this.#getSVGcoord(geoCoords[i], crs);
				if (svgc) {
					ans += svgc.x + "," + svgc.y + " ";
				}
			}
		} else {
			ans = " ";
		}
		return ans;
	}

	#getSVGcoord(geoCoord, crs) {
		// DEBUG 2017.6.12 geojsonの座標並びが逆だった 正しくは経度,緯度並び
		if (geoCoord.length > 1) {
			if ( crs.a){
				return {
					x: geoCoord[0] * crs.a + geoCoord[1] * crs.c + crs.e,
					y: geoCoord[0] * crs.b + geoCoord[1] * crs.d + crs.f,
				};
			} else {
				console.warn("まだ非線形変換は対応してない。。。:",crs,geoCoord);
			}
		} else {
			return null;
		}
	}


	// geoJsonのpropertyに以下の予約語が入っていたらスタイルと見做す(mapboxのgeojson拡張Simplestyleをベース)
	// See https://github.com/mapbox/simplestyle-spec
	// この実装では、opacity追加、"marker-size"の実装をどうしようか考え中です・・
	static #styleDict = {
		title: 0,
		description: 1,
		"marker-size": 2,
		"marker-symbol": 3,
		"marker-color": 4,
		stroke: 5,
		"stroke-width": 6,
		fill: 7,
		opacity: 8,
	};

	#getSvgMapSimpleMeta(metadata, metaDictionary) {
		var others = {};
		var hitMeta = [];
		var style = {};
		if (Array.isArray(metadata)) {
			hitMeta = metadata;
		} else {
			if (metaDictionary) {
				if (!metaDictionary.hashMap) {
					this.#buildMetaDictHash(metaDictionary);
				}
				hitMeta = new Array(metaDictionary.length);
				for (var key in metadata) {
					var idx = metaDictionary.hashMap[key];
					if (idx != undefined) {
						// hit
						hitMeta[idx] = metadata[key];
					} else {
						if (SvgMapGIS.#styleDict[key] != undefined) {
							style[key] = metadata[key];
						} else {
							// ユーザメタデータにもスタイルにもヒットしない
							others[key] = metadata[key];
						}
					}
				}
			} else {
				// Prop Name(Key)順にソートしてならべるのが良いかと・・
				//				console.log("sort by prop name");
				var keys = Object.keys(metadata);
				keys.sort();
				for (var key of keys) {
					if (SvgMapGIS.#styleDict[key] != undefined) {
						style[key] = metadata[key];
					} else {
						hitMeta.push(metadata[key]);
					}
				}
			}
		}
		var ans = {
			normalized: hitMeta,
			others: others,
			styles: style,
		};

		//		console.log("getSvgMapSimpleMeta:",ans);
		return ans;
	}

	#buildMetaDictHash(metaDictionary) {
		// metaDictionary indexOf不使用化 2022/03/01
		metaDictionary.hashMap = {};
		for (var i = 0; i < metaDictionary.length; i++) {
			metaDictionary.hashMap[metaDictionary[i]] = i;
		}
	}

	#array2string(arr) {
		var ans;
		if (arr.length == 0) {
			return null;
		}
		for (var i = 0; i < arr.length; i++) {
			var s = "";
			if (arr[i] != null && arr[i] != undefined) {
				s = arr[i].toString();
			}
			if (s.indexOf(",") >= 0) {
				s = s.replaceAll(",", "&#x2c;");
			}
			if (i == 0) {
				ans = s;
			} else {
				ans += "," + s;
			}
		}
		return ans;
	}

}

export {KMLrenderer};