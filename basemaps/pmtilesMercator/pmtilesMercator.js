// pmtilesMercator.js
// MapLibre GL JS + PMTiles を使用して、画面いっぱいの背景地図イメージを生成する LaWA / S-LaWA Layer
//
// License: (MPL v2)
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.

let map = null;
let containerEl = null;
let mapLoaded = false;
let currentRenderId = 0;

// 描画負荷を抑えるための最大長辺ピクセル数
const MAX_RENDER_EDGE = 1600;

// ===== S-LaWA互換ヘルパー =====
// S-LaWAでは svgMap は SandboxSvgMap であり、
// getMapCanvasSize / getTransformedBox が存在しない。
// また svgImageProps.CRS は transform 関数を持たないプレーンオブジェクトの場合がある。

// TransformLib.js の Mercator と同じ正規化メルカトル変換
// lng:-180..180 -> x:0..1, lat:85.05..-85.05 -> y:0..1 (Y下向き)
function mercatorTransform(lng, lat) {
	const sinLat = Math.sin((lat * Math.PI) / 180.0);
	return {
		x: (lng + 180.0) / 360.0,
		y: 0.5 - Math.log((1 + sinLat) / (1.0 - sinLat)) / (4 * Math.PI),
	};
}

// geoViewBox(経緯度) -> レイヤーCRS座標のbbox を得る互換関数
function getTransformedBoxCompat(geoBox, crs) {
	if (typeof svgMap.getTransformedBox === "function") {
		// レガシーLaWA: コアのAPIをそのまま利用
		return svgMap.getTransformedBox(geoBox, crs);
	}
	// S-LaWA: CRS.transform が関数ならそれを使い、
	// 未解決ならメルカトルとして自前変換（四隅+辺中央をサンプル）
	const tf =
		crs && typeof crs.transform === "function"
			? (x, y) => crs.transform({ x, y })
			: mercatorTransform;
	const xs = [],
		ys = [];
	const N = 4;
	for (let iy = 0; iy <= N; iy++) {
		for (let ix = 0; ix <= N; ix++) {
			const p = tf(
				geoBox.x + (ix * geoBox.width) / N,
				geoBox.y + (iy * geoBox.height) / N
			);
			xs.push(p.x);
			ys.push(p.y);
		}
	}
	const x = Math.min(...xs),
		y = Math.min(...ys);
	return {
		x,
		y,
		width: Math.max(...xs) - x,
		height: Math.max(...ys) - y,
	};
}

// キャンバスサイズの互換取得。S-LaWAでは取得APIが無いので null を返す
function getMapCanvasSizeCompat() {
	if (typeof svgMap.getMapCanvasSize === "function") {
		return svgMap.getMapCanvasSize();
	}
	return null;
}

// XMLDocumentでも確実に動くid検索
function svgGetById(id) {
	if (typeof svgImage.getElementById === "function") {
		const el = svgImage.getElementById(id);
		if (el) return el;
	}
	return svgImage.querySelector(`[id="${id}"]`);
}

// スタイル内のベクタソースから最小ズームレベルを取得（国土地理院は4、OSMは0）
function getEffectiveMinZoom() {
	if (!map) return 0;
	const style = map.getStyle();
	if (!style || !style.sources) return 0;
	let minZoom = 0;
	for (const src of Object.values(style.sources)) {
		if (src.type === "vector") {
			if (typeof src.minzoom === "number") {
				minZoom = Math.max(minZoom, src.minzoom);
			} else if (
				typeof src.url === "string" &&
				src.url.includes("optimal_bvmap")
			) {
				minZoom = Math.max(minZoom, 4);
			}
		}
	}
	return minZoom;
}

function initPMTilesBasemap(styleUrlOrObj, onStatusChange) {
	const protocol = new pmtiles.Protocol();
	maplibregl.addProtocol("pmtiles", protocol.tile);

	containerEl = document.createElement("div");
	containerEl.style.position = "fixed";
	containerEl.style.left = "-9999px";
	containerEl.style.top = "-9999px";
	containerEl.style.width = "512px";
	containerEl.style.height = "512px";
	containerEl.style.visibility = "hidden";
	containerEl.style.pointerEvents = "none";
	document.body.appendChild(containerEl);

	map = new maplibregl.Map({
		container: containerEl,
		preserveDrawingBuffer: true,
		pixelRatio: 1,
		interactive: false,
		localIdeographFontFamily:
			"'Hiragino Kaku Gothic ProN', 'Yu Gothic', 'Meiryo', sans-serif",
		style: styleUrlOrObj,
		center: [139.767, 35.6812],
		zoom: 12,
	});

	map.once("load", () => {
		mapLoaded = true;
		// S-LaWAではイベントはwindowにdispatchされる。
		// レガシーLaWAでもdocument発火イベントはwindowまで伝播するため両対応。
		window.addEventListener(
			"zoomPanMap",
			() => zoomPanMapFunc(onStatusChange),
			false
		);
		zoomPanMapFunc(onStatusChange);
	});
}

function setBasemapStyle(styleUrlOrObj, onStatusChange) {
	if (!map) return;
	map.setStyle(styleUrlOrObj);
	map.once("idle", () => {
		zoomPanMapFunc(onStatusChange);
	});
}

function renderMapToDataUrl(bbox) {
	return new Promise((resolve) => {
		map.once("idle", () => {
			resolve(map.getCanvas().toDataURL("image/png"));
		});

		map.fitBounds(bbox, {
			padding: 0,
			animate: false,
		});
	});
}

async function zoomPanMapFunc(onStatusChange) {
	if (
		!mapLoaded ||
		typeof svgMap === "undefined" ||
		typeof svgImage === "undefined" ||
		typeof svgImageProps === "undefined"
	) {
		return;
	}

	const renderId = ++currentRenderId;

	const cs = getMapCanvasSizeCompat();
	const geoViewBox = svgMap.getGeoViewBox();
	if (!geoViewBox) return;

	const mercatorVB = getTransformedBoxCompat(geoViewBox, svgImageProps.CRS);
	if (mercatorVB.width <= 0 || mercatorVB.height <= 0) return;

	const mercatorAspect = mercatorVB.width / mercatorVB.height;
	let pxWidth, pxHeight;
	if (cs && cs.width > 0 && cs.height > 0) {
		// レガシーLaWA: キャンバス幅を基準にメルカトル縦横比で高さを決定
		pxWidth = cs.width;
		pxHeight = Math.max(1, Math.round(cs.width / mercatorAspect));
	} else {
		// S-LaWA: キャンバスサイズが取れないため長辺上限から逆算
		if (mercatorAspect >= 1) {
			pxWidth = MAX_RENDER_EDGE;
			pxHeight = Math.max(1, Math.round(MAX_RENDER_EDGE / mercatorAspect));
		} else {
			pxHeight = MAX_RENDER_EDGE;
			pxWidth = Math.max(1, Math.round(MAX_RENDER_EDGE * mercatorAspect));
		}
	}

	// 長辺が上限を超える場合は比率を保ったまま縮小
	if (Math.max(pxWidth, pxHeight) > MAX_RENDER_EDGE) {
		if (pxWidth >= pxHeight) {
			pxWidth = MAX_RENDER_EDGE;
			pxHeight = Math.max(1, Math.round(MAX_RENDER_EDGE / mercatorAspect));
		} else {
			pxHeight = MAX_RENDER_EDGE;
			pxWidth = Math.max(1, Math.round(MAX_RENDER_EDGE * mercatorAspect));
		}
	}

	const bbox = [
		[geoViewBox.x, geoViewBox.y],
		[geoViewBox.x + geoViewBox.width, geoViewBox.y + geoViewBox.height],
	];

	// 先にコンテナサイズを確定させ、タイル読み込み前にズームレベルを同期計算する
	containerEl.style.width = `${pxWidth}px`;
	containerEl.style.height = `${pxHeight}px`;
	map.resize();

	const cam = map.cameraForBounds(bbox, { padding: 0 });
	const minZoom = getEffectiveMinZoom();

	if (cam && typeof cam.zoom === "number" && cam.zoom < minZoom) {
		// 範囲が広すぎる場合は描画をスキップし、既存の画像を消去して通知する
		const prevImg = svgGetById("pmtilesSingleImage");
		if (prevImg) {
			prevImg.remove();
			await svgMap.refreshScreen();
		}
		if (typeof onStatusChange === "function") {
			onStatusChange(
				`範囲が広すぎます（ズームインしてください / ZL:${cam.zoom.toFixed(1)}）`
			);
		}
		return;
	}

	if (typeof onStatusChange === "function") {
		onStatusChange(`描画中 (${pxWidth}x${pxHeight})...`);
	}

	const dataUrl = await renderMapToDataUrl(bbox);

	if (renderId !== currentRenderId) return;

	// 注意: createElementNSではなくcreateElementを使うこと。
	// S-LaWAではcreateElementにdata-slawa-id自動付番パッチが当たっており、
	// このIDが無いと親への差分転送(applySvgDiff)対象にならない。
	const si = svgImage.createElement("image");
	si.setAttributeNS("http://www.w3.org/1999/xlink", "xlink:href", dataUrl);
	si.setAttribute("xlink:href", dataUrl);
	si.setAttribute("href", dataUrl);
	si.setAttribute("x", mercatorVB.x);
	si.setAttribute("y", mercatorVB.y);
	si.setAttribute("width", mercatorVB.width);
	si.setAttribute("height", mercatorVB.height);
	si.setAttribute("preserveAspectRatio", "none");
	si.setAttribute("id", "pmtilesSingleImage");

	const prevImg = svgGetById("pmtilesSingleImage");
	if (prevImg) {
		prevImg.remove();
	}
	const mapContents = svgGetById("mapContents");
	if (mapContents) {
		mapContents.appendChild(si);
	}

	// S-LaWAではrefreshScreenは非同期(差分をpostMessageで親へ送信)
	await svgMap.refreshScreen();

	if (typeof onStatusChange === "function") {
		onStatusChange(`完了 (${pxWidth}x${pxHeight}px)`);
	}
}

export { initPMTilesBasemap, setBasemapStyle };
