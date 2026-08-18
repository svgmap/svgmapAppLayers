// geojson2csvExtension.js
// GeoJSONからPointフィーチャを抽出し、プロパティを正規化してCSV化する拡張機能
//
// License: (MPL v2)
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.
//

function loadGeoJsonFile(event) {
	const file = event.target.files[0];
	if (!file) return;

	const reader = new FileReader();
	reader.onload = function (evt) {
		try {
			const geojson = JSON.parse(evt.target.result);
			processGeoJson(geojson);
		} catch (e) {
			alert("GeoJSONのパースに失敗しました: " + e.message);
		}
		// 同じファイルを再度選べるようにリセット
		event.target.value = "";
	};
	reader.readAsText(file, "UTF-8");
}

function processGeoJson(geojson) {
	if (!geojson || !geojson.features) {
		alert("有効なGeoJSON (FeatureCollection) ではありません。");
		return;
	}

	const features = geojson.features;
	const totalCount = features.length;
	const pointFeatures = [];

	// Pointフィーチャの抽出
	for (let i = 0; i < totalCount; i++) {
		const geom = features[i].geometry;
		if (geom && geom.type === "Point") {
			pointFeatures.push(features[i]);
		}
	}

	const pointCount = pointFeatures.length;
	alert(
		`全${totalCount}フィーチャ中、${pointCount}個のPointフィーチャを抽出しました。`
	);

	if (pointCount === 0) return;

	// ----------------------------------------------------
	// プロパティの正規化（全Pointフィーチャのプロパティキーを網羅して収集）
	// ----------------------------------------------------
	const allKeys = new Set();
	pointFeatures.forEach((f) => {
		if (f.properties) {
			Object.keys(f.properties).forEach((k) => allKeys.add(k));
		}
	});
	const propertyNames = Array.from(allKeys);

	// サニタイズ用関数（, -> ; / 改行 -> スペース / " -> スペース）
	const sanitize = (val) => {
		if (val === null || val === undefined) return "";
		let str = String(val);
		return str.replace(/,/g, ";").replace(/\r?\n/g, " ").replace(/"/g, " ");
	};

	// ----------------------------------------------------
	// CSVの構築
	// ----------------------------------------------------
	let csvString = "latitude,longitude";
	if (propertyNames.length > 0) {
		// ヘッダ行も念のためサニタイズ
		csvString += "," + propertyNames.map(sanitize).join(",");
	}
	csvString += "\n";

	pointFeatures.forEach((f) => {
		const coords = f.geometry.coordinates;
		const lng = coords[0]; // 経度
		const lat = coords[1]; // 緯度
		let row = `${lat},${lng}`;

		if (propertyNames.length > 0) {
			const props = f.properties || {};
			// 全てのキーに対して値を取得（なければ空文字になる）
			const propValues = propertyNames.map((key) => sanitize(props[key]));
			row += "," + propValues.join(",");
		}
		csvString += row + "\n";
	});

	// 既存のCSV読み込みパイプライン（csvInputUI_r20.jsの関数）に流し込む
	if (typeof setCsvSource === "function") {
		setCsvSource(csvString);
		document.getElementById("csvStatus").innerText =
			`GeoJSONから ${pointCount} レコードを変換・ロードしました。`;
	} else {
		console.error("setCsvSource関数が見つかりません。");
	}
}
