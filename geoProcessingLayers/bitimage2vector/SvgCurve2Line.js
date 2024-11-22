// Curve to Polyline conversion for potrace.js
// based on original potrace backend_geojson.c
// Copyright (C) 2024 by Satoru Takagi All Rights Reserved
// Programmed by Satoru Takagi
//
// License: (GPL v3)
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
//  along with this program.  If not, see <http://www.gnu.org/licenses/>.

// history:
//  2024/10/28 : initial
//  2024/11/13 : ごちゃ混ぜのpathによるポリゴンから、包含関係を判別してGIS系のvalidなsimple multi-polygon featureに対応する複数のpathに変換する（今後このロジックをコアフレームワークのcaptureGISgeometriesに取り込む）

// 　https://github.com/svgmap/svgmapjs/issues/12　対策(ph1：最終的にはフレームワークに導入)
import { isPolygonAInPolygonB } from "./isPolygonAInPolygonB.js"; // ポリゴンの完全包含をチェックする関数

class SvgCurve2Line {
	constructor(options) {
		if (options) {
			this.setOptions(options);
		}
	}
	compressSpaces(s) {
		return s.replace(/[\s\r\t\n]+/gm, " ");
	}
	trim(s) {
		return s.replace(/^\s+|\s+$/g, "");
	}

	size = 3; // カーブの変換ではsize(長さ)毎に一点打つ
	tfScale = 1;
	transformMatrix = { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 }; // 1次座標変換
	customTransformer;

	setOptions(opt) {
		if (opt.size && !isNaN(opt.size)) {
			this.size = opt.size;
		}
		if (
			opt.transformMatrix &&
			!isNaN(opt.transformMatrix?.a) &&
			!isNaN(opt.transformMatrix?.b) &&
			!isNaN(opt.transformMatrix?.c) &&
			!isNaN(opt.transformMatrix?.d) &&
			!isNaN(opt.transformMatrix?.e) &&
			!isNaN(opt.transformMatrix?.f)
		) {
			this.transformMatrix = opt.transformMatrix;
		}

		if (opt.customTransformer && typeof opt.customTransformer == "function") {
			this.customTransformer = opt.customTransformer;
		}
	}

	convertNew(d) {
		// svg composite path to valid multi polygon
		// potraceはM,L,Cのみしか使わないようなので、これで対応できる
		//if (d.trim()==""){return("")};
		var d = this.parseD(d);
		var convds = [];
		var idx = 0;
		var command, p0, p1, p2, p3;
		this.tfScale = this.calcTfScale();
		var dIndex = -1;
		while (idx < d.length) {
			var dc = d[idx];
			if (isNaN(dc)) {
				command = dc;
				++idx;
			} else {
				if (!command) {
					++idx;
				}
			}
			switch (command) {
				case "M":
					convds.push([]);
					++dIndex;
					p0 = this.tf(d, idx);
					idx += 2;
					convds[dIndex].push([p0.x, p0.y]);
					break;
				case "L":
					p1 = this.tf(d, idx);
					idx += 2;
					convds[dIndex].push([p1.x, p1.y]);
					p0 = { x: p1.x, y: p1.y };
					break;
				case "C":
					p1 = this.tf(d, idx);
					idx += 2;
					p2 = this.tf(d, idx);
					idx += 2;
					p3 = this.tf(d, idx);
					idx += 2;

					var line = this.curve2polyline(p0, p1, p2, p3, true);
					convds[dIndex].push(...line);
					p0 = { x: p3.x, y: p3.y };
					break;
				default:
					console.warn("OTHER COMMAND....", command);
			}
		}

		/** debug
		var dds=[];
		for ( var sp of convds){
			d="M";
			for ( crd of sp){
				d+= crd.join(",") + " ";
			}
			dds.push(d);
		}
		return dds;
		**/

		//console.log(convds);
		var tree = this.determineTree(convds);
		//console.log(tree);
		var mps = this.buildMultiPolygons(tree, convds);
		var ds = [];
		for (var p of mps) {
			var d = "";
			for (var sp of p) {
				d += "M";
				for (var crd of sp) {
					d += crd.join(",") + " ";
				}
			}
			ds.push(d);
		}
		//console.log(mps,ds);
		return ds;
	}

	buildMultiPolygons(tree, convds) {
		function traceTree(tree, depth, mp, targetPolygon) {
			for (var pn in tree) {
				if (depth % 2 == 0) {
					// 塗りのレベル
					targetPolygon = [];
					mp.push(targetPolygon);
				}
				var crds = convds[pn];
				targetPolygon.push(crds);
				if (typeof tree[pn] == "object") {
					traceTree(tree[pn], depth + 1, mp, targetPolygon);
				}
			}
		}
		var mp = []; // multipolygon coords
		traceTree(tree, 0, mp);
		return mp;
	}

	// ポリゴン同士の親子関係を分析する
	determineTree(convds) {
		// potraceでは、convdsは親になるものが子(穴)になるものよりも先に入ることはないという法則を持つらしいが・・F/W用の汎用性のために、そう想定しないでやってみるか・・・
		//console.log("determineTree convds:",convds);
		var cpRel = {};
		for (var j = 0; j < convds.length - 1; j++) {
			var polygonB = convds[j];
			for (var i = j + 1; i < convds.length; i++) {
				var polygonA = convds[i];
				var rel = isPolygonAInPolygonB(polygonA, polygonB);
				switch (rel) {
					case 0: // unrelated
						break;
					case 1: // A in B
						if (!cpRel[i]) {
							cpRel[i] = {};
						}
						cpRel[i][j] = true;
						break;
					case -1: // B in A
						if (!cpRel[j]) {
							cpRel[j] = {};
						}
						cpRel[j][i] = true;
						break;
					default: // invalid data
						console.warn(`P:${j} vs P:${i} invalid`);
						break;
				}

				if (rel === false || rel == 0) {
				} else {
					// console.log(j,i,rel);
				}
			}
		}

		// 直接の親以外を消す
		for (var cn in cpRel) {
			for (var pn in cpRel[cn]) {
				// 親の番号 ～ このうちどれか一つだけが直親
				var p = cpRel[pn]; // 親のそのまた親のツリー
				for (var ppn in p) {
					// 更にその親の番号
					if (cpRel[cn][ppn]) {
						delete cpRel[cn][ppn];
					}
				}
			}
		}

		//console.log("determineTree cpRel:",cpRel); // 子⇒親関係

		var tree = {};

		function traceTree(subTree) {}

		for (var j = 0; j < convds.length; j++) {
			if (!cpRel[j]) {
				tree[j] = {};
			}
		}

		var stree = {};
		for (var n in cpRel) {
			var pn = Object.keys(cpRel[n])[0];
			if (!stree[pn]) {
				stree[pn] = {};
			}
			stree[pn][n] = true;
		}
		for (var pn in stree) {
			for (var cn in stree[pn]) {
				if (stree[cn]) {
					stree[pn][cn] = stree[cn];
				} else {
					stree[pn][cn] = true;
				}
			}
		}

		for (var tn in tree) {
			if (stree[tn]) {
				tree[tn] = stree[tn];
			}
		}

		//		console.log(stree);
		//console.log(tree);
		return tree;
	}

	convert(d) {
		// potraceはM,L,Cのみしか使わないようなので、これで対応できる
		//if (d.trim()==""){return("")};
		var d = this.parseD(d);
		var convd = [];
		var idx = 0;
		var command, p0, p1, p2, p3;
		this.tfScale = this.calcTfScale();

		while (idx < d.length) {
			var dc = d[idx];
			if (isNaN(dc)) {
				command = dc;
				++idx;
			} else {
				if (!command) {
					++idx;
				}
			}
			switch (command) {
				case "M":
					p0 = this.tf(d, idx);
					idx += 2;
					convd.push(command, p0.x, p0.y);
					break;
				case "L":
					p1 = this.tf(d, idx);
					idx += 2;
					convd.push(command, p1.x, p1.y);
					p0 = { x: p1.x, y: p1.y };
					break;
				case "C":
					p1 = this.tf(d, idx);
					idx += 2;
					p2 = this.tf(d, idx);
					idx += 2;
					p3 = this.tf(d, idx);
					idx += 2;

					var line = this.curve2polyline(p0, p1, p2, p3);
					convd.push(...line);
					//convd.push(command,p1x,p1y,p2x,p2y,p3x,p3y);

					p0 = { x: p3.x, y: p3.y };
					break;
			}
		}

		// console.log(convd);
		return convd.join(" ");
	}

	parseD(d) {
		d = d.replace(/,/gm, " "); // get rid of all commas
		d = d.replace(
			/([MmZzLlHhVvCcSsQqTtAa])([MmZzLlHhVvCcSsQqTtAa])/gm,
			"$1 $2"
		); // separate commands from commands
		d = d.replace(
			/([MmZzLlHhVvCcSsQqTtAa])([MmZzLlHhVvCcSsQqTtAa])/gm,
			"$1 $2"
		); // separate commands from commands
		d = d.replace(/([MmZzLlHhVvCcSsQqTtAa])([^\s])/gm, "$1 $2"); // separate commands from points
		d = d.replace(/([^\s])([MmZzLlHhVvCcSsQqTtAa])/gm, "$1 $2"); // separate commands from points
		d = d.replace(/([0-9])([+\-])/gm, "$1 $2"); // separate digits when no comma
		d = d.replace(/(\.[0-9]*)(\.)/gm, "$1 $2"); // separate digits when no comma
		d = d.replace(/([Aa](\s+[0-9]+){3})\s+([01])\s*([01])/gm, "$1 $3 $4 "); // shorthand elliptical arc path syntax
		d = this.trim(this.compressSpaces(d)).split(" "); // compress multiple spaces
		// console.log(d);
		return d;
	}

	tf(d, idx) {
		const ix = Number(d[idx]);
		const iy = Number(d[idx + 1]);
		if (this.customTransformer) {
			return this.customTransformer(ix, iy);
		} else {
			return {
				x:
					this.transformMatrix.a * ix +
					this.transformMatrix.c * iy +
					this.transformMatrix.e,
				y:
					this.transformMatrix.b * ix +
					this.transformMatrix.d * iy +
					this.transformMatrix.f,
			};
		}
	}

	calcTfScale() {
		const p0 = this.tf([0, 0], 0);
		const p1 = this.tf([1 / Math.sqrt(2), 1 / Math.sqrt(2)], 0);
		return Math.sqrt(
			(p0.x - p1.x) * (p0.x - p1.x) + (p0.y - p1.y) * (p0.y - p1.y)
		);
	}

	curve2polyline(q0, q1, q2, q3, coordinatesMode) {
		// 3次ベジェをポリラインに変換
		var l = Math.sqrt(
			(q3.x - q2.x) * (q3.x - q2.x) + (q3.y - q2.y) * (q3.y - q2.y)
		);
		l += Math.sqrt(
			(q2.x - q1.x) * (q2.x - q1.x) + (q2.y - q1.y) * (q2.y - q1.y)
		);
		l += Math.sqrt(
			(q1.x - q0.x) * (q1.x - q0.x) + (q1.y - q0.y) * (q1.y - q0.y)
		);

		var step = Math.min(Math.floor(l / (this.size * this.tfScale)) + 1, 8);

		var intvl = 1 / step;
		var d = [];
		for (var i = 0; i < step; i++) {
			var t = (i + 1) / step;
			var x = this.besier(t, q0.x, q1.x, q2.x, q3.x);
			var y = this.besier(t, q0.y, q1.y, q2.y, q3.y);
			if (coordinatesMode) {
				d.push([x, y]);
			} else {
				d.push("L", x, y);
			}
		}
		return d;
	}

	besier(t, c0, c1, c2, c3) {
		var s = 1 - t;
		var ans =
			s * s * s * c0 +
			3 * (s * s * t) * c1 +
			3 * (t * t * s) * c2 +
			t * t * t * c3;
		return ans;
	}
}

export { SvgCurve2Line };
