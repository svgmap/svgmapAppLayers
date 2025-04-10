// Description
// 法務省　登記所備付地図オープンデータ（いまさらなGML...）のgeojsonコンバータ
//
// Programmed by Satoru Takagi
// 
// License: (MPL v2)
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.
//
// History:
//  2023/01/26 1st release
//  2023/02/06 ドーナツのポリゴンがあったので対応

import { XY2BL } from "./XY2BL.js";

class MojMapGML2GeoJSON {
	constructor() {
		// 全部static
	}

	static convert(mojMapXmlDOM) {
		var refTable = {};
		var idTable = {};
		var obj = MojMapGML2GeoJSON.xml2js(mojMapXmlDOM, refTable, idTable);
		// console.log("JSOBJ:",obj);
		var geojs = MojMapGML2GeoJSON.moj2geojson(obj, refTable, idTable);
		return geojs;
	}

	static moj2geojson(moj, refTable, idTable) {
		var jsoRoot = {
			geoObjects: {},
			properties: {},
		};

		jsoRoot.properties = MojMapGML2GeoJSON.getRootProps(moj);

		var kei = jsoRoot.properties["座標系"].match(/公共座標([0-9]+)系/);
		if (!kei) {
			kei = -1;
		} else {
			kei = Number(kei[1]);
		}
		//console.log("KEI:",kei);

		// id参照データを実紐づけ
		if (refTable && idTable) {
			for (var refid in refTable) {
				var content = idTable[refid];
				var refs = refTable[refid];
				for (var ref of refs) {
					ref.content = content;
				}
			}
		}
		//
		var thema = moj["主題属性"];
		var bbox = { minx: 9e99, miny: 9e99, maxx: -9e99, maxy: -9e99 };
		for (var themaName in thema) {
			var tds = thema[themaName];
			var geojs = {
				type: "FeatureCollection",
				features: [],
			};
			if (!Array.isArray(tds)) {
				tds = [tds];
			}
			for (var td of tds) {
				var gm = MojMapGML2GeoJSON.getGeometry(td, kei, bbox);
				var props = MojMapGML2GeoJSON.getProperties(td);
				var ft = {
					geometry: gm,
					properties: props,
					type: "Feature",
				};
				geojs.features.push(ft);
			}
			jsoRoot.geoObjects[themaName] = geojs;
		}
		jsoRoot.properties.bbox = bbox;
		return jsoRoot;
	}

	static excludeRootProps = [
		"xmlns",
		"xmlns:xsi",
		"xmlns:zmn",
		"主題属性",
		"図郭",
		"空間属性",
	];
	static getRootProps(mojs) {
		var ans = {};
		for (var key in mojs) {
			if (MojMapGML2GeoJSON.excludeRootProps.indexOf(key) < 0) {
				ans[key] = mojs[key];
			}
		}
		return ans;
	}

	static getProperties(ft) {
		var ans = {};
		for (var key in ft) {
			if (key != "形状") {
				ans[key] = ft[key];
			}
		}
		return ans;
	}

	static GMtypes = {
		"zmn:GM_Point.position": "Point",
		"zmn:GM_Surface.patch": "Polygon",
		"zmn:GM_Curve.segment": "LineString",
	};

	static getGeometry(ft, kei, bbox) {
		var gtype, crds;
		var gmfeature = ft["形状"].content;
		for (var attn in gmfeature) {
			gtype = MojMapGML2GeoJSON.GMtypes[attn];
			if (gtype) {
				crds = MojMapGML2GeoJSON.getCoordinates(gmfeature, kei, null, bbox);
				break;
			}
		}

		crds = MojMapGML2GeoJSON.sumupEndStart(crds);

		if (gtype == "Point") {
			crds = crds[0];
		} else if (gtype == "Polygon") {
			//crds = [crds]; // 2023/02/06 少しちゃんとした処理にしたので不要
		}

		return {
			type: gtype,
			coordinates: crds,
		};
	}

	static sumupEndStart(crds) {
		if (typeof crds[0][0] == "number") {
			var ans = [];
			var prevp = null;
			for (var p of crds) {
				if (prevp && prevp[0] == p[0] && prevp[1] == p[1]) {
				} else {
					ans.push(p);
				}
				prevp = p;
			}
			return ans;
		} else {
			for (var i = 0; i < crds.length; i++) {
				crds[i] = MojMapGML2GeoJSON.sumupEndStart(crds[i]);
			}
			return crds;
		}
	}

	static coordinateKeys = ["zmn:X", "zmn:Y"];

	static PolygonParts = [
		"zmn:GM_SurfaceBoundary",
		"zmn:GM_SurfaceBoundary.exterior",
		"zmn:GM_SurfaceBoundary.interior",
	];

	static getCoordinates(obj, kei, parentIds, bbox) {
		// いい加減だが・・このデータの場合、まぁこれで良いのでは・・ 2022/02/06 ポリゴンのドーナツがあったので対尾
		var crds = [];
		if (!parentIds) {
			parentIds = {}; // 循環参照抑止データ
		}
		var pids = {};
		for (var parentId in parentIds) {
			// parentIdsのcopy
			pids[parentId] = true;
		}
		if (obj["id"]) {
			pids[obj["id"]] = true;
		}

		if (
			obj[MojMapGML2GeoJSON.coordinateKeys[0]] &&
			obj[MojMapGML2GeoJSON.coordinateKeys[1]]
		) {
			var x = Number(obj[MojMapGML2GeoJSON.coordinateKeys[0]]);
			var y = Number(obj[MojMapGML2GeoJSON.coordinateKeys[1]]);
			if (kei > 0) {
				var latlng = XY2BL.xyToBl(x, y, kei, "WGS84");
				x = latlng.longitude;
				y = latlng.latitude;
			}
			MojMapGML2GeoJSON.updateBBox(x, y, bbox);
			return [[x, y]];
		} else {
			for (var key in obj) {
				if (typeof obj[key] == "object") {
					if (key == "content" && obj["idref"] && pids[obj["idref"]]) {
						// 循環参照　Skip
					} else if (key == MojMapGML2GeoJSON.PolygonParts[0]) {
						//ポリゴンはドーナツもあった・・・ 2023/2/6
						var extcrds = MojMapGML2GeoJSON.getCoordinates(
							obj[key][MojMapGML2GeoJSON.PolygonParts[1]],
							kei,
							pids,
							bbox
						);
						var crds = [extcrds];
						if (obj[key][MojMapGML2GeoJSON.PolygonParts[2]]) {
							if (Array.isArray(obj[key][MojMapGML2GeoJSON.PolygonParts[2]]) == false){
								obj[key][MojMapGML2GeoJSON.PolygonParts[2]]=[obj[key][MojMapGML2GeoJSON.PolygonParts[2]]];
							}
							for (var ring of obj[key][MojMapGML2GeoJSON.PolygonParts[2]]) {
								crds.push(
									MojMapGML2GeoJSON.getCoordinates(ring, kei, pids, bbox)
								);
							}
						}
					} else {
						var crd = MojMapGML2GeoJSON.getCoordinates(
							obj[key],
							kei,
							pids,
							bbox
						);
						crds = crds.concat(crd);
					}
				}
			}
			return crds;
		}
	}

	static updateBBox(x, y, bbox) {
		bbox.minx = Math.min(x, bbox.minx);
		bbox.miny = Math.min(y, bbox.miny);
		bbox.maxx = Math.max(x, bbox.maxx);
		bbox.maxy = Math.max(y, bbox.maxy);
	}

	static xml2js(xml, refTable, idTable) {
		// XMLを適当なjsonデータ構造に変換・・
		var obj = MojMapGML2GeoJSON.domTraverse(
			xml.documentElement,
			refTable,
			idTable
		);
		return obj;
	}

	static domTraverse(elm, refTable, idTable) {
		var thisObj = {};
		var attrs = elm.attributes;
		if (attrs.length > 0) {
			for (var attr of attrs) {
				thisObj[attr.name] = attr.value;
				if (idTable && attr.name == "id") {
					idTable[attr.value] = thisObj;
				} else if (refTable && attr.name == "idref") {
					if (!refTable[attr.value]) {
						refTable[attr.value] = [];
					}
					refTable[attr.value].push(thisObj);
				}
			}
		}
		var children = elm.children;
		if (children.length > 0) {
			for (var ci = 0; ci < children.length; ci++) {
				var child = children[ci];
				var childObj = MojMapGML2GeoJSON.domTraverse(child, refTable, idTable);
				if (thisObj[child.tagName]) {
					if (!thisObj[child.tagName].length) {
						var tmp = thisObj[child.tagName];
						thisObj[child.tagName] = [];
						thisObj[child.tagName].push(tmp);
						thisObj[child.tagName].push(childObj);
					} else {
						thisObj[child.tagName].push(childObj);
					}
				} else {
					thisObj[child.tagName] = childObj;
				}
			}
		} else {
			// 子要素がない場合
			var textContent = elm.textContent;
			if (textContent != "") {
				if (attrs.length == 0) {
					// 子要素も、属性もないので、textだけ
					thisObj = elm.textContent;
				} else {
					thisObj.textContent = elm.textContent;
				}
			}
		}
		return thisObj;
	}
}

export { MojMapGML2GeoJSON };