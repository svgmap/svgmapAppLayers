// Description:
// geoJsonをCSVに変換する
//
// Programmed by Satoru Takagi
//
// License: (MPL v2)
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.
//

class geoJson2Csv {
	constructor(options) {
		this.options = options;
	}

	setOptions(options) {
		this.options = options;
	}

	options = {};

	getSchemaFromAllData(geoJson) {
		const schema = {};
		let titleName;
		for (const ft of geoJson.features) {
			for (const propName in ft.properties) {
				if (!schema[propName]) {
					if (this.options?.titleName && this.options?.titleName == propName) {
						titleName = propName;
					} else {
						schema[propName] = true;
					}
				}
			}
		}
		const ans = Object.keys(schema);
		if (titleName) {
			ans.unshift(titleName);
		}
		return ans;
	}

	convert(geoJson) {
		if (!geoJson.features) {
			return null;
		}
		let schema = [];
		if (this.options.traceAllSchema) {
			schema = this.getSchemaFromAllData(geoJson);
		}
		const data = [];
		let firstRecord = true;
		let latCol, lngCol;
		for (const ft of geoJson.features) {
			if (ft.properties && ft.geometry && ft.geometry.type != "Point") {
				console.warn("Only supprt point");
				continue;
			}
			if (firstRecord) {
				if (!this.options.traceAllSchema) {
					let titleName;
					for (const propName in ft.properties) {
						if (
							!titleName &&
							(propName == this.options?.titleName ||
								propName == "title" ||
								propName == "name")
						) {
							titleName = propName;
						} else {
							schema.push(propName);
						}
					}
					if (titleName) {
						schema.unshift(titleName);
					}
				}
				firstRecord = false;
			}

			const record = [];
			for (const propName of schema) {
				let propValue = ft.properties[propName] + "";
				propValue = propValue
					.replaceAll(",", "，")
					.replaceAll("\n", "")
					.replaceAll("\r", ""); // 適当正規化・・・
				if (
					this.options?.processor &&
					typeof this.options?.processor[propName] == "function"
				) {
					propValue = this.options.processor[propName](propValue);
				}
				record.push(propValue);
			}
			record.push(ft.geometry.coordinates[0]);
			record.push(ft.geometry.coordinates[1]);
			data.push(record);
		}
		if (this.options && this.options.propertyNameDictionary) {
			for (var i = 0; i < schema.length; i++) {
				if (this.options.propertyNameDictionary[schema[i]]) {
					schema[i] = this.options.propertyNameDictionary[schema[i]];
				}
			}
		}
		schema.push("longitude");
		schema.push("latitude");
		lngCol = schema.length - 2; // debug(あるべきものが無かった・・・) 2025/12/03
		latCol = schema.length - 1;
		const titleCol = this.searchTitleCol(schema);
		const ans = { schema, data, latCol, lngCol, titleCol };
		return ans;
	}

	searchTitleCol(schema) {
		var idx = 0;
		for (const cname of schema) {
			if (
				cname == "title" ||
				cname == "名前" ||
				cname == "タイトル" ||
				cname == "name"
			) {
				return idx;
			}
			++idx;
		}
		return 0;
	}

	/**
	 * GeoJSONをPointデータとそれ以外（Line, Polygon等）に分離する
	 * @param {Object} geoJson - 元のFeatureCollection
	 * @returns {Object} - { points: FeatureCollection, complex: FeatureCollection }
	 */
	splitFeaturesByType(geoJson) {
		const points = {
			type: "FeatureCollection",
			features: [],
			schema: geoJson.schema,
		};
		const complex = {
			type: "FeatureCollection",
			features: [],
			schema: geoJson.schema,
		};

		if (!geoJson.features) return { points, complex };

		for (const ft of geoJson.features) {
			const type = ft.geometry?.type;

			if (type === "Point") {
				// 純粋なPointのみ
				points.features.push(ft);
			} else {
				// LineString, Polygon, MultiPoint, MultiLineString, MultiPolygon, GeometryCollection
				// これらはすべて「複雑なデータ」として扱う
				complex.features.push(ft);
			}
		}

		return { points, complex };
	}
}

export { geoJson2Csv };
