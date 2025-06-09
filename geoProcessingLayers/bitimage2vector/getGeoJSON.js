// Description: getGeoJSON , saveText module
//
// Programmed by Satoru Takagi
// 
// License: (MPL v2)
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.
//
/**
 * GoeJSONのジオメトリタイプの配列を取得する
 *
 * @return {*}
 */
function captureGISgeometries() {
	return new Promise(function (okCB) {
		svgMap.captureGISgeometries(okCB);
	});
}
/**
 * 指定したレイヤIDの一応ちゃんとしたGeoJSONデータを得る
 *
 * @param {*} layerID
 * @return {*}
 */
async function getGeoJSON(layerID) {
	var allGeom = await captureGISgeometries();
	var targetGeom = allGeom[layerID];
	//console.log(allGeom,layerID,targetGeom);
	if (!targetGeom) {
		console.warn("No target geomerty: layerID:", layerID);
		return null;
	}
	var ans = {
		type: "FeatureCollection",
		features: [],
	};
	for (var geom of targetGeom) {
		if (geom.type && geom.coordinates) {
			var ft = {
				type: geom.type,
				coordinates: geom.coordinates,
			};
			if (geom.properties) {
				ft.properties = geom.properties;
			}
			ans.features.push(ft);
		}
	}
	return ans;
}
/**
 * テキストファイルを保存する
 *
 * @param {*} txt
 * @param {*} fileName
 */
function saveText(txt, fileName) {
	// https://norm-nois.com/blog/archives/5502
	if (!fileName) {
		fileName = "output.csv";
	}
	var blob = new Blob([txt], { type: "text/csv" });

	// <a id="downloadAnchor" style="display:none"></a> 想定
	var dla = document.getElementById("downloadAnchor");
	if (!dla) {
		dla = document.createElement("a");
		dla.setAttribute("id", "downloadAnchor");
		dla.style.display = "none";
		document.documentElement.appendChild(dla);
	}
	dla.href = window.URL.createObjectURL(blob);
	dla.setAttribute("download", fileName);
	dla.click();
}

export { getGeoJSON, saveText };
