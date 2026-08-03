// License: MPL-2.0
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.

import { QTCTLayerRenderer } from "../../commonLib/QTCTLayerRenderer.js";
import { unzip } from "../../commonLib/unzipit.module.js";
import {
  ACTIVITY_CATEGORIES,
  ACTIVITY_CATEGORY_BY_ID,
  SOURCE_PAGE_URL,
  buildRegionOptions,
  createDetailElement,
  detectPayloadFormat,
  extractLatestDataset,
  filterRecords,
  normalizeDataset
} from "./kayoinobaCore.js";

const PROPERTY_SCHEMA = [
  "識別子",
  "名称",
  "都道府県",
  "市区町村",
  "活動内容",
  "活動分類"
];
const META_INDEX = Object.freeze({
  id: 0,
  name: 1,
  city: 3,
  activityCategory: 5
});
const FILTER_DEBOUNCE_MS = 280;
const PAGE_TIMEOUT_MS = 25_000;
const DATA_TIMEOUT_MS = 90_000;
const MAX_PAYLOAD_BYTES = 100 * 1024 * 1024;

let initialized = false;
let shuttingDown = false;
let svgMap;
let svgImage;
let svgImageProps;
let layerID;
let qtctRenderer = null;
let allRecords = [];
let recordsById = new Map();
let regionOptions = [];
let datasetSummary = null;
let datasetMetadata = null;
let fetchedAt = null;
let activeLoadController = null;
let filterTimer = null;
let pendingRenderJob = null;
let renderLoopPromise = null;
let renderVersion = 0;
const eventCleanups = [];

const ui = {};

window.preRenderFunction = () => {
  qtctRenderer?.preRenderFunction();
  queueMicrotask(updateRenderedRepresentation);
};

window.addEventListener("layerWebAppReady", initializeLayer, { once: true });
window.addEventListener("beforeunload", shutdownLayer, { once: true });

// layerWebAppReadyより前にモジュールが評価されるのが通常だが、再利用時の
// 読み込み順が逆でも二重初期化せず開始できるようにする。
if (window.svgMap && window.svgImage && window.svgImageProps) {
  queueMicrotask(initializeLayer);
}

async function initializeLayer() {
  if (initialized || shuttingDown) return;
  if (!window.svgMap || !window.svgImage || !window.svgImageProps) return;
  initialized = true;

  svgMap = window.svgMap;
  svgImage = window.svgImage;
  svgImageProps = window.svgImageProps;
  layerID = window.layerID;
  cacheUi();
  configureActivityOptions();
  bindUi();
  initializePoiDialog();
  await loadDataset();
}

function cacheUi() {
  for (const id of [
    "filterFieldset",
    "prefectureFilter",
    "cityFilter",
    "keywordFilter",
    "activityFilter",
    "feeFilter",
    "shuttleFilter",
    "resetButton",
    "reloadButton",
    "status",
    "qtctProgress",
    "sourceCount",
    "matchedCount",
    "mapTargetCount",
    "renderedCount",
    "invalidCount",
    "duplicateCount",
    "dataPeriod",
    "outputDate",
    "fetchedAt",
    "payloadFormat",
    "dataFileLink"
  ]) {
    ui[id] = document.getElementById(id);
  }
}

function configureActivityOptions() {
  for (const category of ACTIVITY_CATEGORIES) {
    ui.activityFilter.add(new Option(category.label, category.id));
  }
}

function bindUi() {
  listen(ui.prefectureFilter, "change", () => {
    populateCityOptions();
    requestFilteredRender();
  });
  listen(ui.cityFilter, "change", requestFilteredRender);
  for (const element of [
    ui.keywordFilter,
    ui.activityFilter,
    ui.feeFilter,
    ui.shuttleFilter
  ]) {
    listen(element, element === ui.keywordFilter ? "input" : "change", () => {
      scheduleFilteredRender();
    });
  }
  listen(ui.resetButton, "click", resetFilters);
  listen(ui.reloadButton, "click", () => {
    void loadDataset();
  });
}

function listen(element, type, listener) {
  element.addEventListener(type, listener);
  eventCleanups.push(() => element.removeEventListener(type, listener));
}

function initializePoiDialog() {
  if (typeof svgMap.setShowPoiProperty === "function") {
    svgMap.setShowPoiProperty(showPlaceDetails, layerID);
  }
  svgImageProps.isClickable = {
    value: true,
    hilightStrokeStyle: { stroke: "#111827", "stroke-width": 3 }
  };
}

async function loadDataset() {
  activeLoadController?.abort();
  const controller = new AbortController();
  activeLoadController = controller;
  setLoading(true);
  setStatus("厚生労働省の掲載ページを確認しています…", "loading");
  setText("qtctProgress", "");

  try {
    const pageResponse = await fetchThroughProxy(
      SOURCE_PAGE_URL,
      { cache: "no-store", signal: controller.signal },
      PAGE_TIMEOUT_MS
    );
    const pageContentType = pageResponse.headers.get("content-type") || "";
    if (pageContentType && !/html|text/i.test(pageContentType)) {
      throw new Error(`掲載ページのContent-Typeが不正です: ${pageContentType}`);
    }
    const pageHtml = await pageResponse.text();
    const latest = extractLatestDataset(pageHtml, SOURCE_PAGE_URL);

    setStatus(`${latest.dataPeriod}データを取得しています…`, "loading");
    const dataResponse = await fetchThroughProxy(
      latest.url,
      { cache: "no-store", signal: controller.signal },
      DATA_TIMEOUT_MS
    );
    const declaredLength = Number(
      dataResponse.headers.get("content-length") || 0
    );
    if (declaredLength > MAX_PAYLOAD_BYTES) {
      throw new Error("データサイズが安全上限（100MB）を超えています");
    }
    const payload = await dataResponse.arrayBuffer();
    if (!payload.byteLength) throw new Error("取得したデータが空です");
    if (payload.byteLength > MAX_PAYLOAD_BYTES) {
      throw new Error("データサイズが安全上限（100MB）を超えています");
    }

    const format = detectPayloadFormat(payload);
    const csvText = await extractCsvText(payload, format);
    const normalized = normalizeDataset(csvText);
    if (!normalized.normalizedCount) {
      throw new Error("解析後のデータが0件です");
    }
    if (controller.signal.aborted || activeLoadController !== controller) return;

    allRecords = normalized.records;
    recordsById = new Map(allRecords.map((record) => [record.id, record]));
    regionOptions = buildRegionOptions(allRecords);
    datasetSummary = normalized;
    datasetMetadata = {
      ...latest,
      format,
      contentType: dataResponse.headers.get("content-type") || "不明",
      contentDisposition:
        dataResponse.headers.get("content-disposition") || "なし",
      byteLength: payload.byteLength
    };
    fetchedAt = new Date();

    populatePrefectureOptions();
    updateDatasetInformation();
    await requestFilteredRender();
  } catch (error) {
    if (error.name !== "AbortError" && !controller.signal.aborted) {
      console.error(error);
      setStatus(`読み込みに失敗しました: ${error.message}`, "error");
    }
  } finally {
    if (activeLoadController === controller) {
      activeLoadController = null;
      setLoading(false);
    }
  }
}

async function fetchThroughProxy(url, options, timeoutMilliseconds) {
  if (typeof svgMap?.getCORSURL !== "function") {
    throw new Error("SVGMapのCORSプロキシを利用できません");
  }
  const timeoutController = new AbortController();
  const sourceSignal = options.signal;
  let timedOut = false;
  const forwardAbort = () => timeoutController.abort(sourceSignal.reason);
  if (sourceSignal) {
    if (sourceSignal.aborted) forwardAbort();
    else sourceSignal.addEventListener("abort", forwardAbort, { once: true });
  }
  const timeoutId = window.setTimeout(() => {
    timedOut = true;
    timeoutController.abort();
  }, timeoutMilliseconds);

  try {
    const response = await fetch(svgMap.getCORSURL(url), {
      ...options,
      signal: timeoutController.signal
    });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status} ${response.statusText}`.trim());
    }
    return response;
  } catch (error) {
    if (timedOut) {
      throw new Error(
        `${Math.round(timeoutMilliseconds / 1000)}秒で通信がタイムアウトしました`
      );
    }
    throw error;
  } finally {
    window.clearTimeout(timeoutId);
    sourceSignal?.removeEventListener("abort", forwardAbort);
  }
}

async function extractCsvText(payload, format) {
  if (format === "csv") {
    try {
      return new TextDecoder("utf-8", { fatal: true }).decode(payload);
    } catch {
      throw new Error("CSVをUTF-8として読み取れません");
    }
  }
  if (format === "zip") {
    let archive;
    try {
      archive = await unzip(payload);
    } catch {
      throw new Error("ZIPデータを展開できません");
    }
    const csvEntries = Object.entries(archive.entries)
      .filter(([name]) => /\.csv$/i.test(name))
      .sort(([left], [right]) => left.localeCompare(right, "ja"));
    if (!csvEntries.length) {
      throw new Error("ZIP内にCSVファイルがありません");
    }
    if (csvEntries.length > 1) {
      throw new Error("ZIP内にCSVが複数あり、対象を安全に特定できません");
    }
    try {
      const csvBuffer = await csvEntries[0][1].arrayBuffer();
      return new TextDecoder("utf-8", { fatal: true }).decode(csvBuffer);
    } catch {
      throw new Error("ZIP内のCSVをUTF-8として読み取れません");
    }
  }
  throw new Error("取得内容をCSVまたはZIPとして判定できません");
}

function populatePrefectureOptions() {
  const previousValue = ui.prefectureFilter.value;
  ui.prefectureFilter.replaceChildren(new Option("全国", ""));
  for (const prefecture of regionOptions) {
    ui.prefectureFilter.add(new Option(prefecture.name, prefecture.code));
  }
  if (
    regionOptions.some((prefecture) => prefecture.code === previousValue)
  ) {
    ui.prefectureFilter.value = previousValue;
  }
  populateCityOptions();
}

function populateCityOptions() {
  const previousValue = ui.cityFilter.value;
  const selectedPrefecture = regionOptions.find(
    (prefecture) => prefecture.code === ui.prefectureFilter.value
  );
  ui.cityFilter.replaceChildren(
    new Option(selectedPrefecture ? "すべての市区町村" : "都道府県を選択", "")
  );
  for (const city of selectedPrefecture?.cities || []) {
    ui.cityFilter.add(new Option(city.name, city.code));
  }
  ui.cityFilter.disabled = !selectedPrefecture;
  if (
    selectedPrefecture?.cities.some((city) => city.code === previousValue)
  ) {
    ui.cityFilter.value = previousValue;
  }
}

function currentCriteria() {
  return {
    prefectureCode: ui.prefectureFilter.value,
    cityCode: ui.cityFilter.value,
    keyword: ui.keywordFilter.value,
    activity: ui.activityFilter.value,
    fee: ui.feeFilter.value,
    shuttle: ui.shuttleFilter.value
  };
}

function scheduleFilteredRender() {
  if (filterTimer !== null) window.clearTimeout(filterTimer);
  filterTimer = window.setTimeout(() => {
    filterTimer = null;
    void requestFilteredRender();
  }, FILTER_DEBOUNCE_MS);
}

function requestFilteredRender() {
  if (!datasetSummary) return Promise.resolve();
  if (filterTimer !== null) {
    window.clearTimeout(filterTimer);
    filterTimer = null;
  }
  const matchedRecords = filterRecords(allRecords, currentCriteria());
  const drawableRecords = matchedRecords.filter((record) => record.drawable);
  const version = ++renderVersion;
  pendingRenderJob = { version, matchedRecords, drawableRecords };
  setText("matchedCount", formatCount(matchedRecords.length));
  setText("mapTargetCount", "更新中");
  setText("renderedCount", "更新中");
  setText("qtctProgress", "検索条件を地図へ反映しています…");

  if (!renderLoopPromise) {
    renderLoopPromise = runRenderLoop().finally(() => {
      renderLoopPromise = null;
    });
  }
  return renderLoopPromise;
}

async function runRenderLoop() {
  while (pendingRenderJob && !shuttingDown) {
    const job = pendingRenderJob;
    pendingRenderJob = null;

    if (!job.drawableRecords.length) {
      clearQtctLayer();
      if (job.version !== renderVersion) continue;
      finishRender(job);
      continue;
    }

    await buildQtctLayer(job.drawableRecords);
    if (pendingRenderJob || job.version !== renderVersion || shuttingDown) {
      continue;
    }
    qtctRenderer.removePrevTiles();
    qtctRenderer.preRenderFunction();
    svgMap.refreshScreen();
    finishRender(job);
  }
}

async function buildQtctLayer(records) {
  svgImage.documentElement.setAttribute("property", PROPERTY_SCHEMA.join(","));
  if (!qtctRenderer) {
    qtctRenderer = new QTCTLayerRenderer({
      svgMap,
      svgImage,
      svgImageProps,
      layerID,
      iconIdEvaluator: (metadata) =>
        `p${activityCategory(metadata)?.index ?? 6}`,
      colorIndexEvaluator: (metadata) =>
        activityCategory(metadata)?.index ?? 6,
      titleEvaluator: (metadata) => {
        const name = String(metadata?.[META_INDEX.name] || "名称未記載");
        const city = String(metadata?.[META_INDEX.city] || "");
        return city ? `${name}（${city}）` : name;
      }
    });
    for (const [index, category] of ACTIVITY_CATEGORIES.entries()) {
      qtctRenderer.colors[index] = category.color;
    }
  }

  const qtctRecords = records.map((record) => [
    record.longitude,
    record.latitude,
    record.id,
    record.name,
    record.prefecture,
    record.city,
    record.activity,
    record.primaryActivityCategory
  ]);
  await qtctRenderer.buildQTCTdata(
    qtctRecords,
    {
      lngCol: 0,
      latCol: 1,
      titleCol: -1,
      defaultIconNumber: 0,
      maxTilePoints: 120
    },
    (message) => {
      if (!pendingRenderJob) setText("qtctProgress", message);
    },
    true
  );
}

function activityCategory(metadata) {
  return ACTIVITY_CATEGORY_BY_ID.get(
    String(metadata?.[META_INDEX.activityCategory] || "unknown")
  );
}

function clearQtctLayer() {
  if (qtctRenderer) {
    qtctRenderer.removePrevTiles();
    qtctRenderer.clearData();
  }
  svgMap.refreshScreen();
}

function finishRender(job) {
  const displayed = job.drawableRecords.length;
  setText("mapTargetCount", formatCount(displayed));
  setText("qtctProgress", "");
  updateRenderedRepresentation();

  if (!job.matchedRecords.length) {
    setStatus(
      "条件に一致する地点はありません。条件を変更してください。",
      "empty"
    );
  } else if (!displayed) {
    setStatus(
      `${formatCount(
        job.matchedRecords.length
      )}が該当しましたが、座標が不正なため地図表示できません。`,
      "warning"
    );
  } else {
    const excluded = job.matchedRecords.length - displayed;
    const suffix = excluded
      ? `（該当中${formatCount(excluded)}を座標不正で除外）`
      : "";
    setStatus(
      `${formatCount(displayed)}をQTCTで地図対象にしました${suffix}`,
      excluded ? "warning" : "success"
    );
  }
}

function updateRenderedRepresentation() {
  if (!ui.renderedCount || !svgImage) return;
  const individualPoints = svgImage.getElementsByTagName("use").length;
  let aggregateImages = 0;
  for (const image of svgImage.getElementsByTagName("image")) {
    if (image.closest("defs")) continue;
    aggregateImages += 1;
  }
  setText(
    "renderedCount",
    aggregateImages
      ? `${formatCount(individualPoints)}／集約画像${aggregateImages}枚`
      : formatCount(individualPoints)
  );
}

function resetFilters() {
  ui.prefectureFilter.value = "";
  populateCityOptions();
  ui.keywordFilter.value = "";
  ui.activityFilter.value = "";
  ui.feeFilter.value = "";
  ui.shuttleFilter.value = "";
  void requestFilteredRender();
}

function showPlaceDetails(target) {
  const content = String(target?.getAttribute("content") || "");
  const id = content.split(",", 1)[0];
  const record = recordsById.get(id);
  if (!record) return;
  const detail = createDetailElement(document, record, {
    dataPeriod: datasetMetadata?.dataPeriod || "",
    fetchedAt: formatDateTime(fetchedAt)
  });
  svgMap.showModal(detail.outerHTML, 540, 700);
}

function updateDatasetInformation() {
  setText("sourceCount", formatCount(datasetSummary.sourceRowCount));
  setText("invalidCount", formatCount(datasetSummary.invalidCoordinates));
  setText("duplicateCount", formatCount(datasetSummary.duplicateRows));
  setText("dataPeriod", datasetMetadata.dataPeriod);
  setText("outputDate", datasetMetadata.outputDate || "記載なし");
  setText("fetchedAt", formatDateTime(fetchedAt));
  setText(
    "payloadFormat",
    `${datasetMetadata.format.toUpperCase()}・${formatBytes(
      datasetMetadata.byteLength
    )}`
  );
  ui.dataFileLink.href = datasetMetadata.url;
  ui.dataFileLink.textContent = "今回検出したデータ";
}

function setLoading(loading) {
  ui.filterFieldset.disabled = loading;
  ui.reloadButton.disabled = loading;
  ui.resetButton.disabled = loading;
}

function setStatus(message, state) {
  ui.status.textContent = message;
  ui.status.className = `status ${state}`;
}

function setText(id, value) {
  if (ui[id]) ui[id].textContent = value ?? "";
}

function formatCount(value) {
  return `${Number(value).toLocaleString("ja-JP")}件`;
}

function formatDateTime(value) {
  if (!(value instanceof Date) || Number.isNaN(value.getTime())) return "";
  return new Intl.DateTimeFormat("ja-JP", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit"
  }).format(value);
}

function formatBytes(value) {
  const bytes = Number(value);
  if (!Number.isFinite(bytes)) return "不明";
  return `${(bytes / 1024 / 1024).toFixed(1)}MB`;
}

function shutdownLayer() {
  if (shuttingDown) return;
  shuttingDown = true;
  activeLoadController?.abort();
  if (filterTimer !== null) window.clearTimeout(filterTimer);
  filterTimer = null;
  pendingRenderJob = null;
  renderVersion += 1;
  for (const cleanup of eventCleanups.splice(0)) cleanup();
  qtctRenderer?.removePrevTiles();
  qtctRenderer?.clearData();
  qtctRenderer = null;
  window.preRenderFunction = () => {};
}
