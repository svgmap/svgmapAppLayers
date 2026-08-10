// License: MPL-2.0

import {
  GSI_LAYERS,
  GSI_SOURCE_PAGE,
  chooseZoom,
  expandTileUrl,
  getLayer,
  intersectView,
  isAllowedGsiUrl,
  parseGsiDamagePage,
  representativeTileUrl,
  tilesForView
} from "./gsiDamageData.js";

const FETCH_TIMEOUT_MS = 90000;
const MAX_INDEX_BYTES = 2 * 1024 * 1024;
const MAX_TILE_BYTES = 5 * 1024 * 1024;

const ui = {
  ortho: document.getElementById("orthoSelect"),
  opacity: document.getElementById("opacityRange"),
  opacityValue: document.getElementById("opacityValue"),
  reload: document.getElementById("reloadButton"),
  status: document.getElementById("statusMessage"),
  summary: document.getElementById("dataSummary")
};

let initialized = false;
let svgMap;
let svgImage;
let svgImageProps;
let activeController;
let activeTimeout;
let renderedTileSignature = "";
let currentLayers = GSI_LAYERS;
let currentCatalogSource = "内蔵一覧";

window.addEventListener("layerWebAppReady", initializeLayer);
window.addEventListener("beforeunload", () => activeController?.abort());

async function initializeLayer() {
  if (initialized) return;
  initialized = true;
  ({ svgMap, svgImage, svgImageProps } = window);
  bindUi();
  window.preRenderFunction = renderRasterTiles;
  applyLayerCatalog(currentLayers);
  renderRasterTiles();
  await refreshLatestData();
}

function bindUi() {
  ui.ortho.addEventListener("change", () => {
    renderedTileSignature = "";
    renderRasterTiles();
    svgMap.refreshScreen();
  });
  ui.opacity.addEventListener("input", () => {
    const opacity = Number(ui.opacity.value) / 100;
    svgImage.getElementById("orthoTiles").setAttribute("opacity", String(opacity));
    ui.opacityValue.value = `${ui.opacity.value}%`;
    svgMap.refreshScreen();
  });
  ui.reload.addEventListener("click", () => void refreshLatestData());
}

function renderRasterTiles() {
  if (!svgMap || !svgImage) return;
  const group = svgImage.getElementById("orthoTiles");
  const layer = getLayer(ui.ortho.value, currentLayers);
  if (!layer) {
    group.replaceChildren();
    renderedTileSignature = "none";
    return;
  }
  const zoom = chooseZoom(svgImageProps.scale, layer.minZoom, layer.maxZoom);
  const clippedView = intersectView(svgMap.getGeoViewBox(), layer.bounds);
  const tiles = clippedView ? tilesForView(clippedView, zoom) : [];
  const signature = `${layer.id}:${tiles.map((tile) => tile.key).join("|")}`;
  if (signature === renderedTileSignature) return;
  renderedTileSignature = signature;
  const fragment = svgImage.createDocumentFragment();
  for (const tile of tiles) {
    const rawUrl = expandTileUrl(layer.url, tile);
    if (!isAllowedGsiUrl(rawUrl)) continue;
    const image = svgImage.createElement("image");
    image.setAttribute("x", String(tile.west * 100));
    image.setAttribute("y", String(-tile.north * 100));
    image.setAttribute("width", String((tile.east - tile.west) * 100));
    image.setAttribute("height", String((tile.north - tile.south) * 100));
    image.setAttribute("preserveAspectRatio", "none");
    image.setAttribute("metadata", tile.key);
    image.setAttribute("xlink:href", svgMap.getCORSURL(rawUrl));
    image.addEventListener("error", () => image.remove(), { once: true });
    fragment.appendChild(image);
  }
  group.replaceChildren(fragment);
}

async function refreshLatestData() {
  activeController?.abort();
  const controller = new AbortController();
  let timedOut = false;
  activeController = controller;
  const timeoutId = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, FETCH_TIMEOUT_MS);
  activeTimeout = timeoutId;
  ui.reload.disabled = true;
  setStatus("国土地理院の掲載ページから最新の正射画像を確認しています", "");

  try {
    const { layers, unavailable } = await fetchLatestLayerCatalog(controller.signal);
    throwIfAborted(controller.signal);
    applyLayerCatalog(layers, "掲載ページ");
    if (unavailable.length) {
      console.warn("取得できない正射画像を一覧から除外しました", unavailable);
      setStatus(`取得可能な最新の正射画像${layers.length}件を表示しました（取得不可${unavailable.length}件を除外）`, "warning");
    } else {
      setStatus(`取得可能な最新の正射画像${layers.length}件を表示しました`, "");
    }
  } catch (error) {
    if (error?.name === "AbortError") {
      setStatus(timedOut ? "最新データの確認がタイムアウトしました" : "最新データの確認を中止しました", "error");
      return;
    }
    console.warn("国土地理院の最新正射画像を取得できませんでした", error);
    setStatus(`最新データを取得できないため、表示中の一覧を維持します: ${error.message}`, "warning");
  } finally {
    finishRequest(controller, timeoutId);
  }
}

async function fetchLatestLayerCatalog(signal) {
  const response = await fetch(svgMap.getCORSURL(cacheBustedUrl(GSI_SOURCE_PAGE)), {
    cache: "no-store",
    signal
  });
  if (!response.ok) throw new Error(`掲載ページ: HTTP ${response.status}`);
  validateDeclaredSize(response, MAX_INDEX_BYTES, "掲載ページ");
  const html = await response.text();
  if (!html || html.length > MAX_INDEX_BYTES) throw new Error("掲載ページの取得サイズが不正です");
  const discovered = parseGsiDamagePage(html);
  if (discovered.some((layer) => !isAllowedGsiUrl(layer.url))) {
    throw new Error("掲載ページに許可されていない正射画像URLがあります");
  }

  const checks = await Promise.all(discovered.map(async (layer) => {
    try {
      await verifyRepresentativeTile(layer, signal);
      return { layer };
    } catch (error) {
      if (error?.name === "AbortError") throw error;
      return { layer, error };
    }
  }));
  const layers = checks.filter((result) => !result.error).map((result) => result.layer);
  const unavailable = checks.filter((result) => result.error).map((result) => ({
    title: result.layer.title,
    reason: result.error.message
  }));
  if (!layers.length) throw new Error("掲載されている正射画像を取得できません");
  return { layers, unavailable };
}

async function verifyRepresentativeTile(layer, signal) {
  const url = representativeTileUrl(layer);
  if (!isAllowedGsiUrl(url)) throw new Error("許可されていない正射画像URLです");
  const response = await fetch(svgMap.getCORSURL(url), { cache: "no-store", signal });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const type = (response.headers.get("content-type") ?? "").toLowerCase();
  if (type && !type.startsWith("image/") && !type.includes("application/octet-stream")) {
    throw new Error("画像以外の応答が返されました");
  }
  validateDeclaredSize(response, MAX_TILE_BYTES, layer.title);
  await response.body?.cancel().catch(() => {});
}

function applyLayerCatalog(layers, sourceLabel = currentCatalogSource) {
  const previousRasterId = ui.ortho.value;
  const hadRasterOptions = ui.ortho.options.length > 0;
  const previousNewestRasterId = currentLayers[0]?.id || "";
  const shouldFollowNewest = !hadRasterOptions || previousRasterId === previousNewestRasterId;
  currentLayers = layers;
  currentCatalogSource = sourceLabel;

  ui.ortho.replaceChildren(...layers.map((layer) => new Option(layer.title.replace(/^正射画像\s*/, ""), layer.id)));
  ui.ortho.add(new Option("表示しない", ""));
  const canKeepPrevious = !shouldFollowNewest && (previousRasterId === "" || layers.some((layer) => layer.id === previousRasterId));
  ui.ortho.value = canKeepPrevious ? previousRasterId : layers[0]?.id || "";

  const newest = layers.map((layer) => layer.updated).filter(Boolean).sort().at(-1) || "-";
  ui.summary.textContent = `${sourceLabel}：正射画像${layers.length}件（最新撮影日 ${newest}）`;
  renderedTileSignature = "";
  renderRasterTiles();
  svgMap?.refreshScreen();
}

function cacheBustedUrl(value) {
  const url = new URL(value);
  url.searchParams.set("_svgmap_updated", String(Date.now()));
  return url.href;
}

function validateDeclaredSize(response, maximum, label) {
  const declaredSize = Number(response.headers.get("content-length"));
  if (Number.isFinite(declaredSize) && declaredSize > maximum) throw new Error(`${label}が想定上限を超えています`);
}

function throwIfAborted(signal) {
  if (signal.aborted) throw new DOMException("Aborted", "AbortError");
}

function finishRequest(controller, timeoutId) {
  clearTimeout(timeoutId);
  if (activeController !== controller) return;
  activeController = null;
  if (activeTimeout === timeoutId) activeTimeout = null;
  ui.reload.disabled = false;
}

function setStatus(message, type) {
  ui.status.textContent = message;
  ui.status.className = `status${type ? ` ${type}` : ""}`;
}

export { GSI_SOURCE_PAGE };
