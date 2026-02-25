// Description:
// KMLをGeoJSONに変換する　簡易実装
//
// License: (MPL v2)
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.
//

class KMLParser {
	static kmlToGeoJson(xmlDoc) {
		const placards = xmlDoc.getElementsByTagName("Placemark");
		const features = [];
		const schemaKeys = new Set();

		for (const pm of placards) {
			// 基本プロパティとスタイルを統合して抽出
			const props = this.extractProperties(pm);
			const style = this.extractStyle(pm);
			const finalProperties = { ...props, ...style };

			Object.keys(finalProperties).forEach((k) => schemaKeys.add(k));

			const feature = {
				type: "Feature",
				properties: finalProperties,
				geometry: this.extractGeometry(pm),
			};

			if (feature.geometry) features.push(feature);
		}

		return {
			type: "FeatureCollection",
			features: features,
			schema: ["title", "description", ...Array.from(schemaKeys)],
		};
	}

	/**
	 * KMLのStyleタグからdrawGeoJson用のスタイル属性を抽出する
	 */
	static extractStyle(pm) {
		const style = {};
		const styleTag = pm.getElementsByTagName("Style")[0];
		if (!styleTag) return style;

		// --- LineStyle (線のスタイル) ---
		const lineStyle = styleTag.getElementsByTagName("LineStyle")[0];
		if (lineStyle) {
			const kmlColor = lineStyle.getElementsByTagName("color")[0]?.textContent;
			if (kmlColor) {
				const parsed = this.parseKmlColor(kmlColor);
				style["stroke"] = parsed.color;
				style["stroke-opacity"] = parsed.opacity;
			}
			const width = lineStyle.getElementsByTagName("width")[0]?.textContent;
			if (width) style["stroke-width"] = parseFloat(width);

			// outline設定 (0の場合は線を消す)
			const outline = lineStyle.getElementsByTagName("outline")[0]?.textContent;
			if (outline === "0") style["stroke-opacity"] = 0;
		}

		// --- PolyStyle (面のスタイル) ---
		const polyStyle = styleTag.getElementsByTagName("PolyStyle")[0];
		if (polyStyle) {
			const kmlColor = polyStyle.getElementsByTagName("color")[0]?.textContent;
			if (kmlColor) {
				const parsed = this.parseKmlColor(kmlColor);
				style["fill"] = parsed.color;
				style["fill-opacity"] = parsed.opacity;
			}
			// fill設定 (0の場合は塗りを消す)
			const fill = polyStyle.getElementsByTagName("fill")[0]?.textContent;
			if (fill === "0") style["fill-opacity"] = 0;
		}

		// --- IconStyle (点のスタイル) ---
		const iconStyle = styleTag.getElementsByTagName("IconStyle")[0];
		if (iconStyle) {
			const kmlColor = iconStyle.getElementsByTagName("color")[0]?.textContent;
			if (kmlColor) {
				style["marker-color"] = this.parseKmlColor(kmlColor).color;
			}
			// アイコンID (drawGeoJsonのPOIiconId/marker-symbol用)
			// KMLでは通常hrefだが、仕様に合わせてIDとして抽出を試みる
			const href = iconStyle.getElementsByTagName("href")[0]?.textContent;
			if (href) {
				// ファイル名やフラグメントをIDとして使用する例
				style["marker-symbol"] = href.split("/").pop().replace("#", "");
			}
		}

		return style;
	}

	/**
	 * KMLの AABBGGRR 形式を {color: "#RRGGBB", opacity: 0.x} に変換
	 */
	static parseKmlColor(kmlColor) {
		// デフォルト値
		if (!kmlColor || kmlColor.length !== 8)
			return { color: "#000000", opacity: 1 };

		const a = kmlColor.substring(0, 2);
		const b = kmlColor.substring(2, 4);
		const g = kmlColor.substring(4, 6);
		const r = kmlColor.substring(6, 8);

		return {
			color: `#${r}${g}${b}`,
			opacity: parseInt(a, 16) / 255,
		};
	}

	static extractProperties(pm) {
		const name = pm.getElementsByTagName("name")[0]?.textContent || "";
		const props = {
			title: name, // drawGeoJsonの仕様に合わせる
			name: name,
			description: pm.getElementsByTagName("description")[0]?.textContent || "",
		};

		// ExtendedDataなどの処理
		const simpleDataNodes = pm.getElementsByTagName("SimpleData");
		for (const node of simpleDataNodes) {
			const key = node.getAttribute("name");
			if (key) props[key] = node.textContent;
		}

		const dataNodes = pm.getElementsByTagName("Data");
		for (const node of dataNodes) {
			const key = node.getAttribute("name");
			const val = node.getElementsByTagName("value")[0]?.textContent;
			if (key) props[key] = val;
		}

		return props;
	}

	// --- extractGeometry, parsePolygon, parseCoords は前回と同じ ---
	static extractGeometry(pm) {
		const polygons = pm.getElementsByTagName("Polygon");
		const lines = pm.getElementsByTagName("LineString");
		const points = pm.getElementsByTagName("Point");

		if (polygons.length > 0) {
			if (polygons.length === 1)
				return { type: "Polygon", coordinates: this.parsePolygon(polygons[0]) };
			return {
				type: "MultiPolygon",
				coordinates: Array.from(polygons).map((p) => this.parsePolygon(p)),
			};
		} else if (lines.length > 0) {
			return {
				type: "LineString",
				coordinates: this.parseCoords(
					lines[0].getElementsByTagName("coordinates")[0].textContent,
				),
			};
		} else if (points.length > 0) {
			return {
				type: "Point",
				coordinates: this.parseCoords(
					points[0].getElementsByTagName("coordinates")[0].textContent,
				)[0],
			};
		}
		return null;
	}

	static parsePolygon(polyTag) {
		const coordsArray = [];
		const outer = polyTag
			.getElementsByTagName("outerBoundaryIs")[0]
			?.getElementsByTagName("coordinates")[0]?.textContent;
		if (outer) coordsArray.push(this.parseCoords(outer));
		const inners = polyTag.getElementsByTagName("innerBoundaryIs");
		for (const inner of inners) {
			const innerCoords =
				inner.getElementsByTagName("coordinates")[0]?.textContent;
			if (innerCoords) coordsArray.push(this.parseCoords(innerCoords));
		}
		return coordsArray;
	}

	static parseCoords(str) {
		return str
			.trim()
			.split(/\s+/)
			.map((pair) => {
				const c = pair.split(",");
				return [parseFloat(c[0]), parseFloat(c[1])];
			});
	}
	
	/**
	 * 入力されたURLから、最適なKML取得用URLを解決する
	 * @param {string} inputUrl - ユーザー入力URL
	 * @returns {Object} - { url: 取得用URL, isTransformedFromMyMapsURL: 判定フラグ }
	 */
	static getKmlUrl(inputUrl) {
		const result = {
			url: inputUrl,
			isTransformedFromMyMapsURL: false,
		};

		try {
			const url = new URL(inputUrl);
			const mid = url.searchParams.get("mid");

			// Google My Maps の閲覧用URLパターンを検知
			if (mid && url.pathname.endsWith("/viewer")) {
				// パスを /kml に書き換え
				url.pathname = url.pathname.replace(/\/viewer$/, "/kml");
				// データ取得用パラメータを付与
				url.searchParams.set("forcekml", "1");

				result.url = url.toString();
				result.isTransformedFromMyMapsURL = true;
			}
		} catch (e) {
			// 不正なURL形式の場合は、入力値をそのまま返す（エラーハンドリングは呼び出し側に委ねる）
			console.warn("URL resolution failed:", e);
		}

		return result;
	}
}

export { KMLParser };
