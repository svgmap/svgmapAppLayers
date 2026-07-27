import { CsvMapper } from "https://svgmap.github.io/svgmapAppLayers/commonLib/CsvMapper.js";
import { geocodeAddresses } from "./addressGeocoder.js";
import { decodeText, normalizeForMap, normalizeGeocodedRows, prepareAddressRows } from "./csvNormalizer.js";
import { DEFAULT_DATASET_ICON, iconForDataset } from "./iconClassifier.js";

// 2026-07-15 に沖縄県の全CSVリソースのヘッダーを検査し、
// 緯度・経度列の双方が確認できたデータセット。
const VERIFIED_DATASET_IDS = new Set([
  "5a2f661e-5f4f-4a2e-8229-5730cb3fa094", // 「おきなわ食材の店」登録店舗一覧
  "cee1c1e9-e32d-44ec-bc2e-cb6229073b1a", // おきなわの名木百選一覧
  "841ac2e1-39da-43a7-b71e-71be68360b74", // 教育施設一覧
  "5cb9163d-0a59-4a20-a583-91b113be7895", // 新規食品営業許可・届出一覧（月別）
  "9f1b0d23-53d9-4bbc-8175-3b7890c7b940", // 沖縄県 子育て施設一覧
  "d1a1fca0-d974-49cc-bbba-d2783524c284", // 沖縄県における不在者投票施設一覧
  "55c0bcf2-b656-4e75-ac9f-dbf06796acac", // 沖縄県イベント一覧
  "70c87745-835e-4941-ba60-77c9f5834e75", // 沖縄県公共施設一覧
  "f7a48359-cc9b-4575-92d4-c5337afe435d", // 沖縄県公営駐車場一覧
  "d99032ee-bd2c-41af-9fd5-391819dcf7b0", // 沖縄県公衆無線LANアクセスポイント一覧
  "18c561bd-c2b3-4a19-a23a-e1ea3fc8f7c9", // 沖縄県内慰霊塔（碑）管理状況等実態調査結果
  "872c00c8-efc5-4dd3-83dc-41662f8d7f5c", // 沖縄県医療機関一覧
  "d8301a57-c280-4fb1-9bf0-26f55abd0c9d", // 沖縄県指定介護サービス施設・事業所一覧
  "5f9f1214-be55-4af5-acc6-c6577f07d1af", // 沖縄県文化財一覧
  "b8f43b75-efaf-49a9-99d0-c88d2b54931c", // 美ら島おきなわ・花と緑の名所100選一覧
  "d6df3581-015c-457a-ab5b-b1683e777042", // 観光ポイント一覧
  "1491f4e0-4631-45c2-b5d9-ecbce3206a01"  // 食品等営業許可・届出全一覧
]);

const CKAN_API = "https://data.bodik.jp/api/3/action/package_search";
const ORGANIZATION_QUERY = "organization:470007";
const SUPPORTED_FORMATS = new Set(["CSV", "XLS", "XLSX", "EXCEL"]);
const DEFAULT_ICON = DEFAULT_DATASET_ICON.index;

let csvMapper;
let datasets = [];
let layerPreRender = () => {};
let usingSavedMetadata = false;

const ui = {
  filter: document.getElementById("filterInput"),
  datasets: document.getElementById("datasetList"),
  resources: document.getElementById("resourceList"),
  status: document.getElementById("status"),
  download: document.getElementById("downloadBtn"),
  details: document.getElementById("details"),
  meta: document.getElementById("metaContent"),
  notes: document.getElementById("notesContent")
};

window.preRenderFunction = () => layerPreRender();

ui.filter.addEventListener("input", renderDatasetList);
ui.datasets.addEventListener("change", handleDatasetChange);
ui.resources.addEventListener("change", () => drawSelectedResource());
ui.download.addEventListener("click", () => processSelectedResource("download"));

addEventListener("layerWebAppReady", async () => {
  csvMapper = new CsvMapper({
    svgMap: window.svgMap,
    svgImage: window.svgImage,
    svgImageProps: window.svgImageProps,
    layerID: window.layerID,
    messageDivElm: null
  });
  layerPreRender = csvMapper.preRenderFunction;
  csvMapper.onload();
  window.svgMap.setGeoCenter(26.268168 , 127.27652, 5);
  await fetchMetadata();
});

function setStatus(text, className) {
  ui.status.textContent = text;
  ui.status.className = className;
  ui.status.title = text;
}

function normalizedFormat(resource) {
  return String(resource.format || "").trim().toUpperCase();
}

function compatibleResources(dataset) {
  return dataset.resources.filter(resource => SUPPORTED_FORMATS.has(normalizedFormat(resource)));
}

function hasPositionTag(dataset) {
  return dataset.tags?.some(tag => tag.name === "位置情報") === true;
}

async function fetchMetadata() {
  try {
    const apiUrl = `${CKAN_API}?q=${encodeURIComponent(ORGANIZATION_QUERY)}&rows=1000`;
    let sourceDatasets;
    try {
      const response = await fetchCrossOrigin(apiUrl);
      const payload = await response.json();
      if (!payload.success) throw new Error("CKAN APIが失敗を返しました。");
      sourceDatasets = payload.result.results;
    } catch (liveError) {
      const fallbackResponse = await fetch(new URL("./datasets.json", import.meta.url));
      if (!fallbackResponse.ok) throw liveError;
      sourceDatasets = await fallbackResponse.json();
      usingSavedMetadata = true;
      console.warn("CKAN APIを取得できないため、保存済みメタデータを使用します。", liveError);
    }

    datasets = sourceDatasets
      .filter(dataset =>
        (VERIFIED_DATASET_IDS.has(dataset.id) || hasPositionTag(dataset)) &&
        compatibleResources(dataset).length > 0
      )
      .map(dataset => ({ ...dataset, shortHash: shortHash(dataset.id) }))
      .sort((a, b) => a.title.localeCompare(b.title, "ja"));

    ui.filter.disabled = false;
    ui.datasets.disabled = false;
    renderDatasetList();
    await restoreSelectionFromHash();
  } catch (error) {
    setStatus(`初期化エラー: ${error.message}`, "error");
    console.error(error);
  }
}

async function fetchCrossOrigin(url) {
  const candidates = [];
  if (window.svgMap?.getCORSURL) candidates.push(window.svgMap.getCORSURL(url));
  candidates.push(url);

  let lastError;
  for (const candidate of [...new Set(candidates)]) {
    try {
      const response = await fetch(candidate);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return response;
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError || new Error("データを取得できませんでした。");
}

function renderDatasetList() {
  const selectedId = ui.datasets.value;
  const keywords = ui.filter.value.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const filtered = datasets.filter(dataset => {
    const haystack = `${dataset.title || ""} ${dataset.notes || ""}`.toLowerCase();
    return keywords.every(keyword => haystack.includes(keyword));
  });

  ui.datasets.replaceChildren(new Option("-- データセットを選択 --", ""));
  for (const dataset of filtered) {
    const formats = [...new Set(compatibleResources(dataset).map(normalizedFormat))].join("/");
    ui.datasets.add(new Option(`[${formats}] ${dataset.title}`, dataset.id));
  }
  if (filtered.some(dataset => dataset.id === selectedId)) ui.datasets.value = selectedId;

  if (keywords.length) {
    setStatus(`${datasets.length}件中 ${filtered.length}件`, "filtered");
  } else {
    const suffix = usingSavedMetadata ? "（保存一覧）" : "";
    setStatus(`位置情報データセット ${datasets.length}件${suffix}`, usingSavedMetadata ? "warning" : "success");
  }
}

async function handleDatasetChange() {
  const dataset = selectedDataset();
  ui.resources.replaceChildren();

  if (!dataset) {
    ui.resources.add(new Option("データセットを選択してください", ""));
    ui.resources.disabled = true;
    ui.download.disabled = true;
    ui.details.style.display = "none";
    updateLayerHash("");
    await clearMap();
    renderDatasetList();
    return;
  }

  const resources = compatibleResources(dataset);
  ui.resources.add(new Option("-- データファイルを選択 --", ""));
  for (const resource of resources) {
    const label = `[${normalizedFormat(resource)}] ${resource.name || resource.description || fileName(resource.url)}`;
    ui.resources.add(new Option(label, resource.id));
  }
  ui.resources.disabled = false;
  const preferred = preferredResource(resources);
  ui.resources.value = preferred?.id || "";
  updateDetails(dataset);
  await drawSelectedResource();
}

function preferredResource(resources) {
  const csvResources = resources.filter(resource => normalizedFormat(resource) === "CSV");
  const candidates = csvResources.length ? csvResources : resources;
  return [...candidates].sort((a, b) => resourceTime(b) - resourceTime(a))[0];
}

function resourceTime(resource) {
  return Date.parse(resource.last_modified || resource.created || "") || 0;
}

function updateDetails(dataset) {
  const organization = dataset.organization?.title || "沖縄県";
  const modified = formatDate(dataset.metadata_modified);
  const icon = iconForDataset(dataset);
  ui.meta.replaceChildren();
  const link = document.createElement("a");
  link.href = `https://data.bodik.jp/dataset/${encodeURIComponent(dataset.name)}`;
  link.target = "_blank";
  link.rel = "noopener";
  link.textContent = "カタログ詳細";
  ui.meta.append(`${organization} / 更新: ${modified} / アイコン: ${icon.label} / `, link);
  ui.notes.textContent = dataset.notes?.trim() || "説明はありません。";
  ui.details.style.display = "block";
}

async function drawSelectedResource() {
  const resource = selectedResource();
  ui.download.disabled = !resource;
  if (!resource) {
    await clearMap();
    setStatus("データファイルを選択してください。", "warning");
    return;
  }
  await processSelectedResource("map");
}

async function processSelectedResource(action) {
  const dataset = selectedDataset();
  const resource = selectedResource();
  if (!dataset || !resource) return;

  try {
    setStatus("データ取得・解析中...", "loading");
    const response = await fetchCrossOrigin(resource.url);
    const buffer = await response.arrayBuffer();
    const rawCsv = resourceToCsv(buffer, normalizedFormat(resource));
    const normalized = await normalizeResource(rawCsv);
    const icon = iconForDataset(dataset);

    if (action === "map") {
      await csvMapper.initCsv(
        normalized.csv,
        normalized.latCol,
        normalized.lngCol,
        normalized.titleCol,
        icon.index,
        null,
        1
      );
      updateLayerHash(`${dataset.shortHash}.${shortHash(resource.id)}`);
      const skipped = normalized.skipped ? ` / 除外${normalized.skipped}件` : "";
      const corrected = normalized.swapped ? " / 経緯度逆転を補正" : "";
      const geocoded = normalized.geocoded ? " / 住所から座標化" : "";
      const requestErrors = normalized.requestErrors ? ` / 通信失敗${normalized.requestErrors}件` : "";
      setStatus(`地図表示 ${normalized.count}件 / ${icon.label}アイコン${skipped}${corrected}${geocoded}${requestErrors}`, normalized.skipped || normalized.swapped || normalized.requestErrors ? "warning" : "success");
    } else {
      downloadCsv(normalized.csv, `${safeFileName(dataset.title)}_${safeFileName(resource.name || "data")}.csv`);
      setStatus(`正規化CSV ${normalized.count}件${normalized.geocoded ? "（住所から座標化）" : ""}`, "success");
    }
  } catch (error) {
    setStatus(`処理エラー: ${error.message}`, "error");
    console.error(error);
  }
}

async function normalizeResource(rawCsv) {
  let coordinateError;
  try {
    return normalizeForMap(rawCsv);
  } catch (error) {
    coordinateError = error;
  }

  let prepared;
  try {
    prepared = prepareAddressRows(rawCsv);
  } catch (addressError) {
    throw new Error(`${coordinateError.message} / ${addressError.message}`);
  }

  const uniqueAddressCount = new Set(prepared.records.map(record => record.address)).size;
  setStatus(`住所を座標化中 0/${uniqueAddressCount}住所`, "loading");
  const geocoded = await geocodeAddresses(prepared.records, {
    concurrency: 3,
    onProgress: (completed, total) => setStatus(`住所を座標化中 ${completed}/${total}住所`, "loading")
  });
  return {
    ...normalizeGeocodedRows(prepared, geocoded.results),
    requestErrors: geocoded.requestErrors
  };
}

function resourceToCsv(buffer, format) {
  if (format === "CSV") return decodeText(buffer);
  if (!window.XLSX) throw new Error("Excel変換ライブラリを読み込めませんでした。");
  const workbook = window.XLSX.read(buffer, { type: "array" });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) throw new Error("Excelにシートがありません。");
  return window.XLSX.utils.sheet_to_csv(workbook.Sheets[sheetName]);
}

async function clearMap() {
  if (csvMapper) await csvMapper.initCsv("緯度,経度,名称\n", 0, 1, 2, DEFAULT_ICON, null, 1);
}

function selectedDataset() {
  return datasets.find(dataset => dataset.id === ui.datasets.value);
}

function selectedResource() {
  return selectedDataset()?.resources.find(resource => resource.id === ui.resources.value);
}

async function restoreSelectionFromHash() {
  const hash = window.svgImageProps?.hash || "";
  const match = hash.match(/^#?([0-9a-f]{8})(?:\.([0-9a-f]{8}))?$/i);
  if (!match) return;
  const dataset = datasets.find(item => item.shortHash === match[1]);
  if (!dataset) return;

  ui.datasets.value = dataset.id;
  const resources = compatibleResources(dataset);
  ui.resources.replaceChildren(new Option("-- データファイルを選択 --", ""));
  for (const resource of resources) {
    ui.resources.add(new Option(`[${normalizedFormat(resource)}] ${resource.name || resource.description || fileName(resource.url)}`, resource.id));
  }
  ui.resources.disabled = false;
  const restored = resources.find(resource => shortHash(resource.id) === match[2]);
  ui.resources.value = restored?.id || preferredResource(resources)?.id || "";
  updateDetails(dataset);
  await drawSelectedResource();
}

function updateLayerHash(value) {
  if (window.svgImageProps) window.svgImageProps.hash = value ? `#${value}` : "";
}

function downloadCsv(csv, fileNameValue) {
  const blob = new Blob(["\uFEFF", csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileNameValue;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

function shortHash(value) {
  let hash = 5381;
  for (let index = 0; index < value.length; index++) hash = ((hash << 5) + hash) + value.charCodeAt(index);
  return (hash >>> 0).toString(16).padStart(8, "0");
}

function formatDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "不明";
  return new Intl.DateTimeFormat("ja-JP", { dateStyle: "medium" }).format(date);
}

function fileName(url) {
  try {
    return decodeURIComponent(new URL(url).pathname.split("/").pop() || "data");
  } catch {
    return "data";
  }
}

function safeFileName(value) {
  return String(value).replace(/[\\/:*?"<>|]/g, "_").slice(0, 80);
}