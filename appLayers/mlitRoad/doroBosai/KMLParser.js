// Description:
// KMLをGeoJSONに変換するパーサー (svgmapjsの同名モジュールに対する強化版 2026/08/21時点)
// 
// 【主な改良点】
// 1. <styleUrl> の事前解決機能を追加し、ドキュメント全体の共有スタイルを適用可能に。
// 2. MultiGeometry に対応。Placemark内の全図形要素をスキャンし、GeoJSONの GeometryCollection に変換。
// 3. IconStyle 等のパースを追加し、simplestyle-spec へのマッピングを拡充。
//
// License: (MPL v2)
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.
//

class KMLParser {
	static kmlToGeoJson(xmlDoc) {
		// パース開始前に、KML内の <styleUrl> を実体の <Style> に展開しておく
		this._resolveStyleUrls(xmlDoc);

		const features = [];
		// ルートから再帰的にパースを開始
		this._parseKmlRecursive(xmlDoc, null, null, features);

		// スキーマ（プロパティのキー一覧）を抽出
		const schemaKeys = new Set(["title", "name", "description"]);
		features.forEach((f) => {
			Object.keys(f.properties).forEach((k) => schemaKeys.add(k));
		});

		return {
			type: "FeatureCollection",
			features: features,
			schema: Array.from(schemaKeys),
		};
	}

	/**
	 * <styleUrl> をたどって実体の <Style> ノードをPlacemark内にクローンする
	 */
	static _resolveStyleUrls(xmlDoc) {
		const styles = xmlDoc.getElementsByTagName("Style");
		const styleDict = {};
		for (let st of styles) {
			const stid = st.getAttribute("id");
			if (stid) {
				styleDict["#" + stid] = st;
			}
		}
		const styleUrls = xmlDoc.getElementsByTagName("styleUrl");
		for (let su of styleUrls) {
			const ref = su.textContent.trim();
			if (styleDict[ref]) {
				su.parentElement.appendChild(styleDict[ref].cloneNode(true));
			}
		}
	}

	/**
	 * 再帰的パース処理
	 */
	static _parseKmlRecursive(node, parentTitle, parentMeta, features) {
		const folders = Array.from(node.children || []).filter(
			(n) => n.tagName === "Folder" || n.tagName === "Document",
		);

		if (folders.length > 0) {
			folders.forEach((folder) => {
				const kmlName = this._getNameFromKML(folder) || parentTitle;
				const kmlDescription = this._getDescriptionFromKML(folder) || parentMeta;
				this._parseKmlRecursive(folder, kmlName, kmlDescription, features);
			});
		} else {
			const placemarkAll = node.querySelectorAll("Placemark");
			const plm = Array.prototype.slice.call(placemarkAll, 0);

			plm.forEach((placemark) => {
				let kmlName = this._getNameFromKML(placemark);
				let kmlDescription = this._getDescriptionFromKML(placemark);

				if (kmlName === null && kmlDescription === null) {
					kmlName = parentTitle;
					kmlDescription = parentMeta;
				}

				const styleProps = this._extractStyle(placemark);
				const properties = {
					title: kmlName,
					name: kmlName,
					description: kmlDescription,
					...styleProps,
				};

				// MultiGeometry対応：Placemark直下・階層下問わずすべての図形を取得
				const geomNodes = placemark.querySelectorAll("Point, LineString, LinearRing, Polygon");
				const geometries = [];

				geomNodes.forEach((geomNode) => {
					const type = geomNode.tagName;
					// 図形要素自身を渡して座標をパース
					const kmlCoordinates = this._getCoordinateFromKML(geomNode); 
					if (!kmlCoordinates || kmlCoordinates.length === 0) return;

					let geoJsonGeometry = null;
					if (type === "Point") {
						geoJsonGeometry = { type: "Point", coordinates: kmlCoordinates[0] };
					} else if (type === "LineString" || type === "LinearRing") {
						geoJsonGeometry = { type: "LineString", coordinates: kmlCoordinates };
					} else if (type === "Polygon") {
						geoJsonGeometry = { type: "Polygon", coordinates: [kmlCoordinates] };
					}

					if (geoJsonGeometry) {
						geometries.push(geoJsonGeometry);
					}
				});

				// 図形の数に応じて GeoJSON の Feature を構築
				if (geometries.length === 1) {
					// 単一ジオメトリ
					features.push({
						type: "Feature",
						properties: properties,
						geometry: geometries[0],
					});
				} else if (geometries.length > 1) {
					// 複数ジオメトリ (MultiGeometryを GeoJSON の GeometryCollection にマッピング)
					features.push({
						type: "Feature",
						properties: properties,
						geometry: {
							type: "GeometryCollection",
							geometries: geometries
						}
					});
				}
			});
		}
	}

	static _getNameFromKML(item) {
		const nameTag = item.querySelector("name");
		return nameTag ? nameTag.textContent.trim() : null;
	}

	static _getDescriptionFromKML(item) {
		const descTag = item.querySelector("description");
		return descTag ? descTag.textContent.trim() : null;
	}

	static _getCoordinateFromKML(item) {
		const geoArray = [];
		const coordNode = item.querySelector("coordinates");
		if (!coordNode) return geoArray;

		const coordinates = coordNode.textContent
			.trim()
			.replace(/\n/g, " ")
			.replace(/\t/g, " ")
			.split(" ");

		for (let i = 0; i < coordinates.length; i++) {
			const text = coordinates[i].trim();
			if (!text) continue;

			const coordinate = text.split(",");
			geoArray.push([parseFloat(coordinate[0]), parseFloat(coordinate[1])]);
		}
		return geoArray;
	}

	// スタイル抽出処理の拡充 (opacityやIconStyle対応)
	static _extractStyle(pm) {
		const style = {};
		const styleTag = pm.getElementsByTagName("Style")[0];
		if (!styleTag) return style;

		const lineStyle = styleTag.getElementsByTagName("LineStyle")[0];
		if (lineStyle) {
			const kmlColor = lineStyle.getElementsByTagName("color")[0]?.textContent;
			if (kmlColor) {
				const parsed = this._parseKmlColor(kmlColor);
				style["stroke"] = parsed.color;
				if (parsed.opacity < 1) style["opacity"] = parsed.opacity;
			}
			const width = lineStyle.getElementsByTagName("width")[0]?.textContent;
			if (width) style["stroke-width"] = parseFloat(width);
		}

		const polyStyle = styleTag.getElementsByTagName("PolyStyle")[0];
		if (polyStyle) {
			const kmlColor = polyStyle.getElementsByTagName("color")[0]?.textContent;
			if (kmlColor) {
				const parsed = this._parseKmlColor(kmlColor);
				style["fill"] = parsed.color;
				if (parsed.opacity < 1 && !style["opacity"]) style["opacity"] = parsed.opacity;
			}
		}

		const iconStyle = styleTag.getElementsByTagName("IconStyle")[0];
		if (iconStyle) {
			const kmlColor = iconStyle.getElementsByTagName("color")[0]?.textContent;
			if (kmlColor) style["marker-color"] = this._parseKmlColor(kmlColor).color;
			const href = iconStyle.getElementsByTagName("Icon")[0]?.getElementsByTagName("href")[0]?.textContent;
			if (href) style["marker-symbol"] = href;
		}

		return style;
	}

	static _parseKmlColor(kmlColor) {
		if (!kmlColor || kmlColor.length !== 8)
			return { color: "#000000", opacity: 1 };
		const a = kmlColor.substring(0, 2),
			b = kmlColor.substring(2, 4);
		const g = kmlColor.substring(4, 6),
			r = kmlColor.substring(6, 8);
		return { color: `#${r}${g}${b}`, opacity: parseInt(a, 16) / 255 };
	}
}

export { KMLParser };