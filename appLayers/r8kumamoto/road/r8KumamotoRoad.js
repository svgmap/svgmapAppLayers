// License: (MPL v2)
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.

import { unzip } from "../../../commonLib/unzipit.module.js";
import {
  ARCHIVES,
  SOURCE_PAGE_URL,
  archiveRequestUrl,
  getArchiveById,
  isAllowedArchiveUrl,
  parseArchiveIndex
} from "./archiveManifest.js";
import {
  LAYER_KEYS,
  ROAD_PROPERTY_SCHEMA,
  encodeSvgMapMetadata,
  groupArchiveEntryNames,
  metadataValues,
  prepareFeatureCollection
} from "./r8KumamotoData.js";
import { LineRasterRenderer } from "./r8KumamotoRasterRenderer.js";
import { buildRoadDetailContent } from "./r8KumamotoRoadDetails.js";

const FETCH_TIMEOUT_MS = 120000;
const CATALOG_FETCH_TIMEOUT_MS = 30000;
const MAX_ARCHIVE_BYTES = 128 * 1024 * 1024;
const MAX_UNCOMPRESSED_BYTES = 256 * 1024 * 1024;
const MAX_CATALOG_BYTES = 2 * 1024 * 1024;
const REDRAW_DELAY_MS = 140;

let initialized = false;
let svgMap;
let svgImage;
let svgImageProps;
let layerID;
let activeController = null;
let activeTimeout = null;
let redrawTimer = null;
let renderGeneration = 0;
let currentArchive = null;
let currentRoadFeatures = [];
let etcRenderer = null;
let travelRenderer = null;
let archives = ARCHIVES;

const ui = {
  archive: document.getElementById("archiveSelect"),
  load: document.getElementById("loadButton"),
  refresh: document.getElementById("refreshButton"),
  cancel: document.getElementById("cancelButton"),
  roadToggle: document.getElementById("roadToggle"),
  etcToggle: document.getElementById("etcToggle"),
  travelToggle: document.getElementById("travelToggle"),
  status: document.getElementById("statusMessage"),
  progress: document.getElementById("progressMessage")
};

window.addEventListener("layerWebAppReady", initializeLayer);
window.addEventListener("beforeunload", shutdownLayer);

async function initializeLayer() {
  if (initialized) return;
  initialized = true;
  svgMap = window.svgMap;
  svgImage = window.svgImage;
  svgImageProps = window.svgImageProps;
  layerID = window.layerID;

  populateArchiveOptions();
  bindUi();
  configureRoadDetails();
  etcRenderer = new LineRasterRenderer({
    svgImage,
    svgMap,
    imageId: "etcRasterImage"
  });
  travelRenderer = new LineRasterRenderer({
    svgImage,
    svgMap,
    imageId: "travelRasterImage"
  });
  window.addEventListener("zoomPanMap", scheduleRasterRender);
  const shouldLoad = await refreshArchiveCatalog();
  if (shouldLoad) await loadArchive(getArchiveById("latest", archives));
}

function populateArchiveOptions() {
  ui.archive.replaceChildren();
  for (const archive of archives) {
    ui.archive.add(new Option(archive.label, archive.id));
  }
  ui.archive.value = "latest";
}

function bindUi() {
  ui.load.addEventListener("click", () => loadArchive(getArchiveById(ui.archive.value, archives)));
  ui.refresh.addEventListener("click", () => void refreshLatestArchive());
  ui.cancel.addEventListener("click", () => activeController?.abort());
  ui.roadToggle.addEventListener("change", updateLayerVisibility);
  ui.etcToggle.addEventListener("change", updateLayerVisibility);
  ui.travelToggle.addEventListener("change", updateLayerVisibility);
}

async function refreshLatestArchive() {
  const shouldLoad = await refreshArchiveCatalog();
  if (shouldLoad) await loadArchive(getArchiveById("latest", archives));
}

async function refreshArchiveCatalog() {
  abortActiveRequest();
  const controller = new AbortController();
  let timedOut = false;
  activeController = controller;
  activeTimeout = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, CATALOG_FETCH_TIMEOUT_MS);
  setLoading(true);
  setStatus("国土交通省の最新掲載データを確認しています", "");
  setProgress("公開ページからZIP一覧を取得中…");

  try {
    const sourceUrl = new URL(SOURCE_PAGE_URL);
    sourceUrl.searchParams.set("_svgmap_updated", String(Date.now()));
    const response = await fetch(svgMap.getCORSURL(sourceUrl.href), {
      cache: "no-store",
      signal: controller.signal
    });
    if (!response.ok) throw new Error(`掲載ページの取得に失敗しました（HTTP ${response.status}）`);
    const declaredSize = Number(response.headers.get("content-length"));
    if (Number.isFinite(declaredSize) && declaredSize > MAX_CATALOG_BYTES) {
      throw new Error("掲載ページが想定上限を超えています");
    }
    const html = await response.text();
    if (!html || html.length > MAX_CATALOG_BYTES) {
      throw new Error("掲載ページの取得サイズが不正です");
    }
    archives = parseArchiveIndex(html);
    populateArchiveOptions();
    setProgress(`${archives.length - 1}件の日時別データを確認しました`);
    return true;
  } catch (error) {
    if (error?.name === "AbortError") {
      setStatus(
        timedOut ? "最新データの確認がタイムアウトしました" : "最新データの確認を中止しました",
        timedOut ? "error" : "warning"
      );
      setProgress(timedOut ? "ネットワークとプロキシ設定を確認してください。" : "");
      return false;
    }
    console.warn("道路状況の公開ZIP一覧を更新できませんでした", error);
    setStatus("公開ZIP一覧を更新できないため、最新データURLを直接再取得します", "warning");
    setProgress("日時別一覧は前回取得分または内蔵一覧を表示しています。");
    return true;
  } finally {
    if (activeController === controller) {
      activeController = null;
      clearTimeout(activeTimeout);
      activeTimeout = null;
      setLoading(false);
    }
  }
}

function configureRoadDetails() {
  svgImage.documentElement.setAttribute("property", ROAD_PROPERTY_SCHEMA.join(","));
  svgMap.setShowPoiProperty(showRoadDetails, layerID);
  svgImageProps.isClickable = {
    value: true,
    hilightStrokeStyle: { stroke: "#facc15", "stroke-width": 12 }
  };
}

async function loadArchive(archive) {
  if (!isAllowedArchiveUrl(archive.url)) {
    setStatus("許可されていないデータURLです", "error");
    return;
  }
  abortActiveRequest();
  const controller = new AbortController();
  let timedOut = false;
  activeController = controller;
  activeTimeout = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, FETCH_TIMEOUT_MS);
  setLoading(true);
  setStatus(`${archive.label}を読み込んでいます`, "");
  setProgress("ZIPをダウンロード中…");
  const startedAt = performanceNow();

  try {
    const requestUrl = archiveRequestUrl(archive);
    const response = await fetch(svgMap.getCORSURL(requestUrl), {
      cache: archive.isCurrent ? "no-store" : "force-cache",
      signal: controller.signal
    });
    if (!response.ok) throw new Error(`データ取得に失敗しました（HTTP ${response.status}）`);
    validateArchiveContentType(response.headers.get("content-type"));
    const declaredSize = Number(response.headers.get("content-length"));
    if (Number.isFinite(declaredSize) && declaredSize > MAX_ARCHIVE_BYTES) {
      throw new Error("ZIPが想定上限を超えています");
    }
    const blob = await response.blob();
    if (blob.size <= 0 || blob.size > MAX_ARCHIVE_BYTES) {
      throw new Error("ZIPの取得サイズが不正です");
    }

    setProgress("ZIPを展開中…");
    const zipArchive = await unzip(blob);
    const entryNames = Object.keys(zipArchive.entries);
    validateUncompressedSize(zipArchive.entries);
    const groupedNames = groupArchiveEntryNames(entryNames);
    if (!groupedNames.road.length && !groupedNames.etc.length && !groupedNames.travel.length) {
      throw new Error("対象GeoJSONがZIP内にありません");
    }

    const prepared = {};
    for (const layerKey of [LAYER_KEYS.ROAD, LAYER_KEYS.ETC, LAYER_KEYS.TRAVEL]) {
      throwIfAborted(controller.signal);
      const names = groupedNames[layerKey];
      if (!names.length) {
        prepared[layerKey] = emptyPreparedLayer();
        continue;
      }
      setProgress(`${layerLabel(layerKey)}のJSONを解析中…`);
      const documents = [];
      for (const name of names) {
        const entry = zipArchive.entries[name];
        if (!entry || entry.encrypted) throw new Error(`ZIPエントリーを読めません: ${name}`);
        documents.push(await entry.json());
        throwIfAborted(controller.signal);
      }
      setProgress(`${layerLabel(layerKey)}の検証・重複除去中…`);
      prepared[layerKey] = await prepareFeatureCollection(documents, layerKey, {
        cooperative: true,
        signal: controller.signal,
        onProgress: (done, total) => {
          if (done > 0) setProgress(`${layerLabel(layerKey)}を処理中… ${formatNumber(done)}/${formatNumber(total)}`);
        }
      });
    }
    throwIfAborted(controller.signal);

    setProgress("表示を準備中…");
    applyPreparedData(prepared, archive, blob.size);
    const duration = Math.round(performanceNow() - startedAt);
    setStatus(`${archive.label}を表示しました（${duration.toLocaleString("ja-JP")}ms）`, "");
    setProgress(availabilityMessage(prepared));
  } catch (error) {
    if (activeController !== controller) return;
    if (error?.name === "AbortError" && timedOut) {
      setStatus(
        currentArchive
          ? `取得がタイムアウトしました。${currentArchive.label}を表示しています`
          : "データ取得がタイムアウトしました",
        "error"
      );
      setProgress("ネットワークとプロキシ設定を確認してから再試行してください。");
    } else if (error?.name === "AbortError") {
      setStatus(
        currentArchive
          ? `読み込みを中止しました。${currentArchive.label}を表示しています`
          : "読み込みを中止しました",
        "warning"
      );
      setProgress("");
    } else {
      console.error(error);
      setStatus(
        currentArchive
          ? `更新に失敗しました。${currentArchive.label}を表示中: ${error.message}`
          : `読み込みに失敗しました: ${error.message}`,
        "error"
      );
      setProgress("プロキシ設定とwww.mlit.go.jpへの接続を確認してください。");
    }
  } finally {
    if (activeController === controller) {
      activeController = null;
      clearTimeout(activeTimeout);
      activeTimeout = null;
      setLoading(false);
    }
  }
}

function applyPreparedData(prepared, archive, archiveBytes) {
  currentArchive = archive;
  currentRoadFeatures = prepared.road.features;
  drawRoadFeatures(currentRoadFeatures);
  etcRenderer.setData(prepared.etc.features);
  travelRenderer.setData(prepared.travel.features);
  updateLayerAvailability(prepared);
  updateLayerVisibility();
  updateMetadata(archive, archiveBytes);
  updateStats(prepared);
  scheduleRasterRender();
}

function drawRoadFeatures(features) {
  const group = svgImage.getElementById("roadVectorGroup");
  while (group.firstChild) group.removeChild(group.firstChild);
  group.setAttribute("property", ROAD_PROPERTY_SCHEMA.join(","));
  features.forEach((feature, index) => {
    const path = svgImage.createElement("path");
    path.setAttribute("d", lineStringPath(feature.geometry.coordinates));
    path.setAttribute("fill", "none");
    path.setAttribute("stroke", feature.properties._style.color);
    path.setAttribute("stroke-width", String(feature.properties._style.weight));
    path.setAttribute("stroke-opacity", String(feature.properties._style.opacity));
    path.setAttribute("vector-effect", "non-scaling-stroke");
    path.setAttribute("stroke-linecap", "round");
    path.setAttribute("stroke-linejoin", "round");
    if (feature.properties._style.dashArray) {
      path.setAttribute("stroke-dasharray", feature.properties._style.dashArray);
    }
    path.setAttribute("data-road-index", String(index));
    path.setAttribute("content", encodeSvgMapMetadata(metadataValues(feature)));
    path.setAttribute("xlink:title", roadTitle(feature));
    group.appendChild(path);
  });
}

function updateLayerVisibility() {
  svgImage
    .getElementById("roadVectorGroup")
    .setAttribute("visibility", ui.roadToggle.checked ? "visible" : "hidden");
  etcRenderer?.setVisible(ui.etcToggle.checked && !ui.etcToggle.disabled);
  travelRenderer?.setVisible(ui.travelToggle.checked && !ui.travelToggle.disabled);
  scheduleRasterRender();
  svgMap.refreshScreen();
}

function scheduleRasterRender() {
  clearTimeout(redrawTimer);
  const generation = ++renderGeneration;
  redrawTimer = setTimeout(() => {
    if (generation !== renderGeneration || !etcRenderer || !travelRenderer) return;
    try {
      const viewBox = svgMap.getGeoViewBox();
      const canvasSize = svgMap.getMapCanvasSize();
      travelRenderer.render(viewBox, canvasSize);
      etcRenderer.render(viewBox, canvasSize);
      svgMap.refreshScreen();
    } catch (error) {
      console.error("道路状況ラスタの再描画に失敗しました", error);
      setStatus("地図の再描画に失敗しました。ズーム操作をやり直してください。", "warning");
    }
  }, REDRAW_DELAY_MS);
}

function showRoadDetails(target) {
  const rawIndex = target?.getAttribute("data-road-index");
  if (rawIndex === null || rawIndex === undefined) return;
  const index = Number(rawIndex);
  if (!Number.isInteger(index) || index < 0) return;
  const feature = currentRoadFeatures[index];
  if (!feature) return;
  const modalContainer = svgMap.showModal("", 480, 640);
  if (!modalContainer?.ownerDocument) return;
  modalContainer.replaceChildren(
    buildRoadDetailContent(modalContainer.ownerDocument, feature, ROAD_PROPERTY_SCHEMA)
  );
}

function updateLayerAvailability(prepared) {
  const mapping = [
    [LAYER_KEYS.ROAD, ui.roadToggle, "roadAvailability"],
    [LAYER_KEYS.ETC, ui.etcToggle, "etcAvailability"],
    [LAYER_KEYS.TRAVEL, ui.travelToggle, "travelAvailability"]
  ];
  for (const [key, checkbox, elementId] of mapping) {
    const count = prepared[key].features.length;
    checkbox.disabled = count === 0;
    if (count === 0) checkbox.checked = false;
    setText(elementId, count === 0 ? "（この時点では収録なし）" : `（${formatNumber(count)}件）`);
  }
}

function updateMetadata(archive, bytes) {
  setText("dataAsOf", archive.asOf);
  setText("roadAsOf", archive.roadAsOf);
  setText("probePeriod", archive.probePeriod);
  setText("fetchedAt", formatDateTime(new Date()));
  setText("archiveBytes", formatBytes(bytes));
  ui.archive.value = archive.id;
}

function updateStats(prepared) {
  for (const key of [LAYER_KEYS.ROAD, LAYER_KEYS.ETC, LAYER_KEYS.TRAVEL]) {
    const stats = prepared[key].stats;
    setText(`${key}Original`, formatNumber(stats.originalCount));
    setText(`${key}Unique`, formatNumber(stats.uniqueCount));
    setText(`${key}Duplicate`, formatNumber(stats.duplicateCount));
    setText(`${key}Invalid`, formatNumber(stats.invalidCount));
  }
}

function validateArchiveContentType(contentType) {
  const normalized = String(contentType || "").toLowerCase();
  if (normalized.includes("text/html")) throw new Error("ZIPではなくHTMLが返されました");
  if (
    normalized &&
    !normalized.includes("zip") &&
    !normalized.includes("octet-stream") &&
    !normalized.includes("binary")
  ) {
    throw new Error(`未対応のContent-Typeです: ${contentType}`);
  }
}

function validateUncompressedSize(entries) {
  const total = Object.values(entries).reduce((sum, entry) => sum + (Number(entry.size) || 0), 0);
  if (total <= 0 || total > MAX_UNCOMPRESSED_BYTES) {
    throw new Error("ZIP展開後サイズが想定範囲外です");
  }
}

function emptyPreparedLayer() {
  return {
    type: "FeatureCollection",
    features: [],
    stats: { originalCount: 0, validCount: 0, uniqueCount: 0, duplicateCount: 0, invalidCount: 0 }
  };
}

function lineStringPath(coordinates) {
  return coordinates
    .map(([longitude, latitude], index) => `${index === 0 ? "M" : "L"}${longitude * 100},${-latitude * 100}`)
    .join(" ");
}

function roadTitle(feature) {
  return feature.properties["路線名"] || feature.properties["名称"] || "道路規制区間";
}

function availabilityMessage(prepared) {
  const missing = [LAYER_KEYS.ROAD, LAYER_KEYS.ETC, LAYER_KEYS.TRAVEL]
    .filter((key) => prepared[key].features.length === 0)
    .map(layerLabel);
  return missing.length ? `この時点では収録なし: ${missing.join("、")}` : "3種類のデータを読み込みました";
}

function layerLabel(key) {
  return { road: "道路規制", etc: "ETC2.0平均速度", travel: "通行実績" }[key] || key;
}

function throwIfAborted(signal) {
  if (signal.aborted) throw new DOMException("Aborted", "AbortError");
}

function abortActiveRequest() {
  activeController?.abort();
  activeController = null;
  clearTimeout(activeTimeout);
  activeTimeout = null;
}

function setLoading(loading) {
  ui.load.disabled = loading;
  ui.refresh.disabled = loading;
  ui.archive.disabled = loading;
  ui.cancel.disabled = !loading;
}

function setStatus(message, state) {
  ui.status.textContent = message;
  ui.status.className = `status${state ? ` ${state}` : ""}`;
}

function setProgress(message) {
  ui.progress.textContent = message;
}

function setText(id, value) {
  const element = document.getElementById(id);
  if (element) element.textContent = String(value);
}

function formatNumber(value) {
  return Number(value || 0).toLocaleString("ja-JP");
}

function formatBytes(bytes) {
  if (!Number.isFinite(bytes)) return "不明";
  return bytes >= 1024 * 1024
    ? `${(bytes / (1024 * 1024)).toFixed(2)} MB`
    : `${(bytes / 1024).toFixed(1)} KB`;
}

function formatDateTime(date) {
  return new Intl.DateTimeFormat("ja-JP", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit"
  }).format(date);
}

function performanceNow() {
  return globalThis.performance?.now?.() ?? Date.now();
}

function shutdownLayer() {
  abortActiveRequest();
  clearTimeout(redrawTimer);
  redrawTimer = null;
  window.removeEventListener("zoomPanMap", scheduleRasterRender);
  etcRenderer?.destroy();
  travelRenderer?.destroy();
  currentRoadFeatures = [];
}
