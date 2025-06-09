// Description: captureRasterData module
//
// Programmed by Satoru Takagi
// 
// License: (MPL v2)
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.
//
/**
 * 指定したレイヤーIDにあるラスターデータを取得する
 *
 * @param {*} targetLayerID
 * @param {*} options
 * @return {*} 
 */
async function captureRasterData(targetLayerID, options) {
	if (!targetLayerID && options.targetLayerID) {
		console.warn("You should set targetLayerID");
	}
	if (!options) {
		options = {};
	}
	options.targetLayerID = targetLayerID;

	var cGeom = await captureCoverageGeometry(options);
	console.log(cGeom);
	var ans = await processCapturedGeom(cGeom, options);
	return ans;
}
/**
 * 与えられたカバレッジジオメトリを一つ一つ処理して画僧データを与えていく
 *
 * @param {*} geom
 * @param {*} options
 * @return {*}
 */
async function processCapturedGeom(geom, options) {
	var svgImagesProps = svgMap.getSvgImagesProps();
	var targetCoverages = [];
	for (var layerId in geom) {
		if (svgImagesProps[layerId].rootLayer == options.targetLayerID) {
			for (var i = 0; i < geom[layerId].length; i++) {
				if (geom[layerId][i].type == "Coverage") {
					targetCoverages.push(geom[layerId][i]);
				}
			}
		}
	}

	var sipd = [];
	for (var targetCoverage of targetCoverages) {
		if (targetCoverage && targetCoverage.href) {
			sipd.push(registImagePixelData(targetCoverage));
			//			targetCoverage.imageData = await getImagePixelData(targetCoverage);
		}
	}
	await Promise.all(sipd);
	console.log("targetCoverages:", targetCoverages);
	return targetCoverages;
}
/**
 * targetCoverageに画像データを登録する
 *
 * @param {*} targetCoverage
 */
async function registImagePixelData(targetCoverage) {
	targetCoverage.imageData = await getImagePixelData(targetCoverage);
}
/**
 *　画像データを取得する非同期関数
 *
 * @param {*} svgMapGisGeometry
 * @param {*} extParam
 * @return {*}
 */
function getImagePixelData(svgMapGisGeometry, extParam) {
	return new Promise(function (okCB) {
		svgMapGIStool.getImagePixelData(
			svgMapGisGeometry,
			function (data, width, height, params) {
				const ans = { data, width, height };
				if (params) {
					ans.params = params;
				}
				//console.log("getImagePixelData:",ans);
				okCB(ans);
			},
			extParam
		); // okCB(pixData,w,h,extParam)
	});
}
/**
 * カバレッジ型のジオメトリを取得する非同期関数
 *
 * @param {*} options
 * @return {*}
 */
function captureCoverageGeometry(options) {
	return new Promise(function (okCB) {
		svgMap.captureGISgeometriesOption(true); // カバレッジが必要
		svgMap.captureGISgeometries(okCB, options);
	});
}

export { captureRasterData };
