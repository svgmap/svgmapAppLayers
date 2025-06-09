// Description:
// そのレイヤのポリゴンの指定したプロパティを地図上に表記する
// Programmed by Satoru Takagi
// 
// License: (MPL v2)
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.
//
// 2025/2/27
//

function showSNAME(targetPropName) {
	if (!targetPropName){
		targetPropName ="S_NAME";
	}
	var schema = svgImage.documentElement.getAttribute("property").split(",");
	var pNumb = schema.indexOf(targetPropName);
	console.log("pNumb:",pNumb);
	var paths = svgImage.getElementsByTagName("path");
	var ps = [];
	for (var p of paths) {
		var pd = p.getAttribute("d");
		var name = p.getAttribute("content").split(",")[pNumb].trim();
		if (pd) {
			var v = extractVerticesFromPath(pd);
			var p = calculateRepresentativePoint(v);
			p.push(name);
			ps.push(p);
		}
	}
	console.log("showSNAME:", ps);
	drawName(ps);
}

function drawName(ps){
	var ag = svgImage.getElementById("annotationG");
	if ( ag ){
		ag.remove();
	}
	ag = svgImage.createElement("g");
	ag.setAttribute("id","annotationG");
	svgImage.documentElement.appendChild(ag);
	
	for ( var p of ps ){
		setPointAnnotations([p[0],p[1]], p[2],ag,11);
	}
	svgMap.refreshScreen();
}

function setPointAnnotations(point,title,annotationG,fontSize) {
	if(!fontSize){
		fontSize = 11;
	}
	
	var txtE = svgImage.createElement("text");
	txtE.setAttribute("transform", `ref(svg,${point[0]},${point[1]})`);
	txtE.setAttribute("x", -fontSize*(title.length/4));
	txtE.setAttribute("y", fontSize/2);
	txtE.setAttribute("fill", "black");
	txtE.setAttribute("font-size",fontSize);
	txtE.textContent = title;
	annotationG.appendChild(txtE);
}


window.showSNAME = showSNAME;

function calculateRepresentativePoint(vertices) {
	/**
	 * 多角形の代表点を計算する
	 * @param {number[][]} vertices 多角形の頂点リスト（[[x1, y1], [x2, y2], ...]）
	 * @returns {number[]} 代表点の座標 [x, y]
	 */

	// 1. 凸包の計算（簡易的な実装）
	const convexHull = calculateConvexHull(vertices);

	// 2. 凸包の重心を計算
	const centroid = calculateCentroid(convexHull);

	// 3. 多角形を三角形に分割し、面積加重平均で重心を修正
	const representativePoint = calculateAreaWeightedCentroid(vertices, centroid);

	return representativePoint;
}

function calculateConvexHull(vertices) {
	// 簡易的な凸包計算（実際にはライブラリを使用するのが望ましい）
	// ここでは、y座標の最小値を持つ点を始点とし、角度でソートする簡易的な実装
	const startPoint = vertices.reduce(
		(min, v) => (v[1] < min[1] ? v : min),
		vertices[0]
	);
	const sortedVertices = vertices
		.filter((v) => v !== startPoint)
		.sort((a, b) => {
			const angleA = Math.atan2(a[1] - startPoint[1], a[0] - startPoint[0]);
			const angleB = Math.atan2(b[1] - startPoint[1], b[0] - startPoint[0]);
			return angleA - angleB;
		});
	return [startPoint, ...sortedVertices];
}

function calculateCentroid(vertices) {
	/**
	 * 多角形の重心を計算する
	 * @param {number[][]} vertices 多角形の頂点リスト
	 * @returns {number[]} 重心の座標 [x, y]
	 */
	const xSum = vertices.reduce((sum, v) => sum + v[0], 0);
	const ySum = vertices.reduce((sum, v) => sum + v[1], 0);
	return [xSum / vertices.length, ySum / vertices.length];
}

function calculateAreaWeightedCentroid(vertices, initialCentroid) {
	/**
	 * 面積加重平均で重心を修正する
	 * @param {number[][]} vertices 多角形の頂点リスト
	 * @param {number[]} initialCentroid 初期重心
	 * @returns {number[]} 修正された重心
	 */
	let totalArea = 0;
	let weightedXSum = 0;
	let weightedYSum = 0;

	for (let i = 0; i < vertices.length; i++) {
		const v1 = vertices[i];
		const v2 = vertices[(i + 1) % vertices.length];
		const area = 0.5 * Math.abs(v1[0] * v2[1] - v2[0] * v1[1]); // 三角形の面積
		totalArea += area;
		weightedXSum += (area * (v1[0] + v2[0] + initialCentroid[0])) / 3; // 三角形の重心のx座標
		weightedYSum += (area * (v1[1] + v2[1] + initialCentroid[1])) / 3; // 三角形の重心のy座標
	}

	return [weightedXSum / totalArea, weightedYSum / totalArea];
}

/**
 * SVGパスのd属性から頂点座標を抽出する関数
 * @param {string} pathData - SVGパスのd属性文字列
 * @returns {Array<Array<number>>} - [x,y]座標ペアの配列
 */
function extractVerticesFromPath(pathData) {
	// パスデータをクリーンアップ
	const cleanPathData = pathData.trim();

	// パスデータをトークンに分割
	// 空白やカンマをセパレータとして使用
	const tokens = cleanPathData
		.replace(/([MLz])/g, " $1 ")
		.replace(/,/g, " ")
		.replace(/\s+/g, " ")
		.trim()
		.split(" ");

	const vertices = [];
	let currentCommand = "";

	for (let i = 0; i < tokens.length; i++) {
		const token = tokens[i];

		// コマンドの場合
		if (token === "M" || token === "L" || token === "z") {
			currentCommand = token;
			if (token === "z") {
				// zコマンドの場合は最初の頂点を追加して閉じる
				if (vertices.length > 0) {
					vertices.push([...vertices[0]]);
				}
			}
		}
		// 数値の場合（座標）
		else if (currentCommand === "M" || currentCommand === "L") {
			// x座標
			const x = parseFloat(token);

			// y座標（次のトークン）
			if (i + 1 < tokens.length) {
				const y = parseFloat(tokens[i + 1]);
				if (!isNaN(x) && !isNaN(y)) {
					vertices.push([x, y]);
					i++; // y座標を処理したのでインデックスを1つ進める
				}
			}
		}
	}

	return vertices;
}

// 提供されたパスデータでテスト
const pathData =
	"M14170.110496129448,-3908.262263427716 L14170.113890255005,-3908.2027415067337 14170.11750578315,-3908.1391431083043 14170.125138914995,-3908.0050885886803 14170.127878155794,-3907.956895119989 14170.159325087476,-3907.7219545333646 14170.34676203574,-3907.542649533901 14170.435984316171,-3907.4572873578127 14170.34632696857,-3907.446560358677 14170.276707063882,-3907.433234742559 14170.197169252146,-3907.401086105052 14170.124023986731,-3907.3638505724416 14170.06940438523,-3907.322078711691 14169.960018664728,-3907.227204607879 14169.87344974831,-3907.1485161983273 14169.76907126795,-3907.066200497556 14169.68270657679,-3907.0038787328995 14169.591643616575,-3906.952928038437 14169.426419789843,-3906.913851622979 14169.29208816469,-3906.8909090798165 14169.126356149107,-3906.875126881439 14169.01011197664,-3906.8784964122087 14168.939052613889,-3906.879015401336 14168.84522800388,-3906.8671094931638 14168.74478199191,-3906.8414010901365 14168.656412389535,-3906.8124579920345 14168.526679706469,-3906.769338418512 14168.419432495179,-3906.7147165238125 14168.366353054535,-3906.6737907042766 14168.320782653527,-3906.698549378973 14168.281639009518,-3906.7053011034054 14168.275107409943,-3906.7064322985602 14168.228919002913,-3906.721905379955 14168.439336153257,-3907.212998315164 14168.50585405343,-3907.455431349669 14168.53456359067,-3907.660338780094 14168.566577662446,-3907.9414337397784 14169.504653999033,-3908.0764696601946 14169.68257285354,-3908.1066031773476 14169.812228356952,-3908.1496804017484 14169.881781491136,-3908.2277983097283 14169.92805682955,-3908.381567631928 14170.111871902,-3908.3866375576513 14170.146385654993,-3908.3875918171116 14170.110496129448,-3908.262263427716 z";

const vertices = extractVerticesFromPath(pathData);
console.log(`頂点数: ${vertices.length}`);
console.log(JSON.stringify(vertices));
