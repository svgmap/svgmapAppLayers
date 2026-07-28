import { QTCTLayerRenderer } from "../../../commonLib/QTCTLayerRenderer.js";
import {
  findSystemInCatalog,
  getFeedUrls,
  getRefreshIntervalMilliseconds,
  getStatusCategory,
  localizeText,
  normalizeStation,
  normalizeStatus,
  parseGbfsTimestamp,
  summarizeStatuses
} from "./gbfsUtils.js";
import {
  GBFS_PROVIDERS,
  MOBILITY_DATA_LICENSE,
  MOBILITY_DATA_SYSTEMS_URL,
  getProvider
} from "./gbfsProviders.js";

const PROPERTY_SCHEMA = [
  "ステーションID",
  "名称",
  "住所",
  "収容台数",
  "提供元",
  "システムID"
];
const META_INDEX = {
  stationId: 0,
  name: 1
};
const STATUS_COLORS = [
  [220, 38, 38],
  [245, 158, 11],
  [22, 163, 74],
  [107, 114, 128],
  [37, 99, 235]
];
const MINIMUM_RETRY_INTERVAL = 60 * 1000;

let svgMap;
let svgImage;
let svgImageProps;
let layerID;
let provider;
let discoveryUrl;
let feedUrls = {};
let qtctRenderer = null;
let stations = [];
let stationsById = new Map();
let statusesById = new Map();
let statusTimer = null;
let activeController = null;
let refreshPromise = null;

window.addEventListener("load", initializeLayer);
window.addEventListener("beforeunload", shutdownLayer);

window.preRenderFunction = function () {
  qtctRenderer?.preRenderFunction();
};

async function initializeLayer() {
  svgMap = window.svgMap;
  svgImage = window.svgImage;
  svgImageProps = window.svgImageProps;
  layerID = window.layerID;
  provider = getProvider(getRequestedSystemId());
  discoveryUrl = provider.discoveryUrl;

  configureUi();
  initializePoiDialog();
  document.getElementById("refreshButton").addEventListener("click", () => {
    void refreshStatuses();
  });
  document.getElementById("reloadButton").addEventListener("click", () => {
    void loadLayer();
  });
  document.getElementById("autoRefresh").addEventListener("change", (event) => {
    clearStatusTimer();
    if (event.target.checked) {
      scheduleStatusRefresh(MINIMUM_RETRY_INTERVAL);
    }
  });

  await loadLayer();
}

function getRequestedSystemId() {
  const hash = String(window.svgImageProps?.hash || "").replace(/^#/, "");
  return new URLSearchParams(hash).get("system") || "docomo-cycle";
}

function configureUi() {
  document.title = provider.name;
  setText("layerTitle", provider.name);
  setText("location", provider.location);
  setText("sourceName", provider.sourceName);
  setLink("sourceLink", provider.sourceUrl);
  setText("licenseName", provider.licenseName);
  setLink("licenseLink", provider.licenseUrl);
  setLink("termsLink", provider.termsUrl);

  const guidelineLink = document.getElementById("guidelineLink");
  if (provider.guidelineUrl) {
    guidelineLink.hidden = false;
    guidelineLink.href = provider.guidelineUrl;
  } else {
    guidelineLink.hidden = true;
  }

  setText("catalogCredit", MOBILITY_DATA_LICENSE.attribution);
  setLink("catalogLink", MOBILITY_DATA_LICENSE.url);
}

function initializePoiDialog() {
  if (svgMap && layerID !== undefined) {
    svgMap.setShowPoiProperty(showStationDetails, layerID);
  }
  if (svgImageProps) {
    svgImageProps.isClickable = { value: true, hilightStrokeStyle: {} };
  }
}

async function loadLayer() {
  clearStatusTimer();
  activeController?.abort();
  const controller = new AbortController();
  activeController = controller;
  setLoading(true);
  setStatus("MobilityDataカタログとGBFSを確認中…", false);

  try {
    const catalogSystem = await resolveCatalogSystem(controller.signal);
    if (catalogSystem?.discoveryUrl) {
      discoveryUrl = catalogSystem.discoveryUrl;
      setText("catalogState", "日本向けsystems.csvから取得");
    } else {
      setText("catalogState", "内蔵URLへフォールバック");
    }

    const discoveryDocument = await fetchJson(discoveryUrl, controller.signal);
    feedUrls = getFeedUrls(discoveryDocument);
    requireFeed("station_information");
    requireFeed("station_status");

    setStatus("ステーション情報と空き状況を取得中…", false);
    const [informationDocument, statusDocument, systemResult] = await Promise.all([
      fetchJson(feedUrls.station_information, controller.signal),
      fetchJson(feedUrls.station_status, controller.signal),
      feedUrls.system_information
        ? fetchJson(feedUrls.system_information, controller.signal).catch((error) => {
            console.warn("system_informationを取得できませんでした", error);
            return null;
          })
        : Promise.resolve(null)
    ]);

    updateLicenseFromSystemInformation(systemResult);
    stations = (informationDocument?.data?.stations || [])
      .map(normalizeStation)
      .filter(isDrawableStation);
    stationsById = new Map(stations.map((station) => [station.id, station]));
    statusesById = buildStatusMap(statusDocument);

    if (!stations.length) {
      throw new Error("位置情報を持つステーションがありません");
    }

    await buildQtctLayer();
    updateSummary();
    updateTimestamp(statusDocument?.last_updated);
    setText("lastFetched", formatDateTime(new Date()));
    setStatus(
      `${stations.length.toLocaleString("ja-JP")}件をClient-Side QTCTで表示しています`,
      false
    );
    scheduleStatusRefresh(
      getRefreshIntervalMilliseconds(statusDocument?.ttl)
    );
  } catch (error) {
    if (error.name !== "AbortError") {
      console.error(error);
      setStatus(`読み込みに失敗しました: ${error.message}`, true);
      scheduleStatusRefresh(MINIMUM_RETRY_INTERVAL);
    }
  } finally {
    if (activeController === controller) {
      activeController = null;
      setLoading(false);
    }
  }
}

async function resolveCatalogSystem(signal) {
  try {
    const response = await fetchWithProxy(MOBILITY_DATA_SYSTEMS_URL, {
      cache: "force-cache",
      signal
    });
    const csvText = await response.text();
    return findSystemInCatalog(csvText, provider.systemId);
  } catch (error) {
    if (error.name === "AbortError") {
      throw error;
    }
    console.warn("MobilityData systems.csvを取得できませんでした", error);
    return null;
  }
}

function requireFeed(feedName) {
  if (!feedUrls[feedName]) {
    throw new Error(`GBFSに${feedName}フィードがありません`);
  }
}

async function buildQtctLayer() {
  svgImage.documentElement.setAttribute("property", PROPERTY_SCHEMA.join(","));
  if (!qtctRenderer) {
    qtctRenderer = new QTCTLayerRenderer({
      svgMap,
      svgImage,
      svgImageProps,
      layerID,
      iconIdEvaluator: (metadata) => `p${categoryForMetadata(metadata)}`,
      colorIndexEvaluator: (metadata) => categoryForMetadata(metadata),
      titleEvaluator: (metadata) => titleForMetadata(metadata)
    });
    STATUS_COLORS.forEach((color, index) => {
      qtctRenderer.colors[index] = color;
    });
  }

  const records = stations.map((station) => [
    station.lon,
    station.lat,
    station.id,
    station.name,
    station.address,
    station.capacity ?? "",
    provider.sourceName,
    provider.systemId
  ]);
  const schema = {
    lngCol: 0,
    latCol: 1,
    titleCol: -1,
    defaultIconNumber: 0,
    maxTilePoints: provider.maxTilePoints
  };

  await qtctRenderer.buildQTCTdata(
    records,
    schema,
    (message) => setText("qtctProgress", message),
    true
  );
  qtctRenderer.removePrevTiles();
  qtctRenderer.preRenderFunction();
  svgMap.refreshScreen();
  setText("qtctProgress", "");
}

function categoryForMetadata(metadata) {
  const stationId = String(metadata?.[META_INDEX.stationId] ?? "");
  return getStatusCategory(statusesById.get(stationId), stationsById.get(stationId));
}

function titleForMetadata(metadata) {
  const stationId = String(metadata?.[META_INDEX.stationId] ?? "");
  const name = String(metadata?.[META_INDEX.name] || stationId);
  const status = statusesById.get(stationId);
  const availability =
    Number.isFinite(status?.available) ? `利用可能 ${status.available}台` : "空き状況不明";
  return `${name}（${availability}）`;
}

async function refreshStatuses() {
  if (refreshPromise) {
    return refreshPromise;
  }
  refreshPromise = refreshStatusesInternal().finally(() => {
    refreshPromise = null;
  });
  return refreshPromise;
}

async function refreshStatusesInternal() {
  clearStatusTimer();
  if (!feedUrls.station_status) {
    await loadLayer();
    return;
  }

  const controller = new AbortController();
  activeController = controller;
  setLoading(true);
  setStatus("最新の空き状況を取得中…", false);
  let nextInterval = MINIMUM_RETRY_INTERVAL;

  try {
    const statusDocument = await fetchJson(feedUrls.station_status, controller.signal);
    statusesById = buildStatusMap(statusDocument);
    updateSummary();
    updateTimestamp(statusDocument?.last_updated);
    setText("lastFetched", formatDateTime(new Date()));
    nextInterval = getRefreshIntervalMilliseconds(statusDocument?.ttl);

    await refreshQtctColors();
    setStatus(
      `空き状況を更新しました。次回更新は約${Math.round(
        nextInterval / 1000
      )}秒後です`,
      false
    );
  } catch (error) {
    if (error.name !== "AbortError") {
      console.error(error);
      setStatus(`空き状況を更新できませんでした: ${error.message}`, true);
    }
  } finally {
    if (activeController === controller) {
      activeController = null;
      setLoading(false);
    }
    scheduleStatusRefresh(nextInterval);
  }
}

async function refreshQtctColors() {
  if (!qtctRenderer) {
    return;
  }
  setText("qtctProgress", "QTCT集約タイルの色を更新中…");
  const clientSideQtct = qtctRenderer.clientSideQTCT;
  const images = await clientSideQtct.buildLowResTiles();
  for (const [tileKey, imageUrl] of Object.entries(images)) {
    clientSideQtct.setTileData(tileKey, imageUrl);
  }
  qtctRenderer.setQtctMapData(clientSideQtct.getTliedData());
  qtctRenderer.removePrevTiles();
  qtctRenderer.preRenderFunction();
  svgMap.refreshScreen();
  setText("qtctProgress", "");
}

function buildStatusMap(document) {
  return new Map(
    (document?.data?.stations || [])
      .map(normalizeStatus)
      .filter((status) => status.id)
      .map((status) => [status.id, status])
  );
}

function updateSummary() {
  const summary = summarizeStatuses(stations, statusesById);
  setText("stationCount", summary.total.toLocaleString("ja-JP"));
  setText("vehicleCount", summary.vehicles.toLocaleString("ja-JP"));
  setText("dockCount", summary.docks.toLocaleString("ja-JP"));
  setText("availableCount", summary.available.toLocaleString("ja-JP"));
  setText("lowCount", summary.low.toLocaleString("ja-JP"));
  setText("emptyCount", summary.empty.toLocaleString("ja-JP"));
  setText("unavailableCount", summary.unavailable.toLocaleString("ja-JP"));
  setText("unknownCount", summary.unknown.toLocaleString("ja-JP"));
}

function updateTimestamp(value) {
  const date = parseGbfsTimestamp(value);
  setText("dataTimestamp", date ? formatDateTime(date) : "不明");
}

function updateLicenseFromSystemInformation(document) {
  const system = document?.data;
  if (!system) {
    return;
  }
  const systemName = localizeText(system.name);
  if (systemName) {
    setText("gbfsSystemName", systemName);
  }
  if (system.license_url) {
    setLink("licenseLink", system.license_url);
  }
  const termsUrl = localizeText(system.terms_url);
  if (termsUrl) {
    setLink("termsLink", termsUrl);
  }
}

function showStationDetails(target) {
  const content = String(target?.getAttribute("content") || "");
  const stationId = content.split(",")[0];
  const station = stationsById.get(stationId);
  const status = statusesById.get(stationId);
  if (!station) {
    return;
  }

  const rows = [
    ["名称", station.name],
    ["ステーションID", station.id],
    ["住所", station.address || "記載なし"],
    ["利用可能車両", formatCount(status?.available, "台")],
    ["返却可能枠", formatCount(status?.docksAvailable, "台")],
    ["収容台数", formatCount(station.capacity, "台")],
    ["貸出", formatBoolean(status?.renting)],
    ["返却", formatBoolean(status?.returning)],
    ["設置状態", formatBoolean(status?.installed)],
    ["ステーション更新時刻", formatTimestamp(status?.lastReported)],
    ["データ提供", provider.sourceName]
  ];
  const tableRows = rows
    .map(
      ([label, value]) =>
        `<tr><th>${escapeHtml(label)}</th><td>${escapeHtml(value)}</td></tr>`
    )
    .join("");
  const detailLink = isHttpUrl(station.rentalUrl)
    ? `<p><a href="${escapeHtml(station.rentalUrl)}" target="_blank" rel="noopener noreferrer">提供元のステーション詳細</a></p>`
    : "";
  const html = `
    <div style="font-family:sans-serif;font-size:13px">
      <table style="width:100%;border-collapse:collapse" border="1">${tableRows}</table>
      ${detailLink}
      <p style="color:#555">空き状況は遅延することがあります。データの正確性・完全性・継続提供は保証されません。</p>
    </div>`;
  svgMap.showModal(html, 480, 620);
}

function formatCount(value, unit) {
  return Number.isFinite(value) ? `${value}${unit}` : "不明";
}

function formatBoolean(value) {
  if (value === undefined || value === null) return "不明";
  return value ? "可" : "不可";
}

function formatTimestamp(value) {
  const date = parseGbfsTimestamp(value);
  return date ? formatDateTime(date) : "不明";
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

function isDrawableStation(station) {
  return (
    station.id &&
    Number.isFinite(station.lat) &&
    Number.isFinite(station.lon) &&
    station.lat >= -90 &&
    station.lat <= 90 &&
    station.lon >= -180 &&
    station.lon <= 180
  );
}

async function fetchJson(url, signal) {
  const response = await fetchWithProxy(url, {
    cache: "no-store",
    signal
  });
  return response.json();
}

async function fetchWithProxy(url, options) {
  const requestUrl =
    svgMap && typeof svgMap.getCORSURL === "function" ? svgMap.getCORSURL(url) : url;
  const response = await fetch(requestUrl, options);
  if (!response.ok) {
    throw new Error(`${response.status} ${response.statusText}`);
  }
  return response;
}

function scheduleStatusRefresh(interval) {
  clearStatusTimer();
  if (!document.getElementById("autoRefresh").checked) {
    return;
  }
  statusTimer = window.setTimeout(() => {
    void refreshStatuses();
  }, interval);
}

function clearStatusTimer() {
  if (statusTimer !== null) {
    window.clearTimeout(statusTimer);
    statusTimer = null;
  }
}

function shutdownLayer() {
  clearStatusTimer();
  activeController?.abort();
}

function setLoading(loading) {
  document.getElementById("refreshButton").disabled = loading;
  document.getElementById("reloadButton").disabled = loading;
}

function setStatus(message, isError) {
  const element = document.getElementById("statusMessage");
  element.textContent = message;
  element.classList.toggle("error", isError);
}

function setText(id, value) {
  const element = document.getElementById(id);
  if (element) {
    element.textContent = value ?? "";
  }
}

function setLink(id, url) {
  const element = document.getElementById(id);
  if (element && isHttpUrl(url)) {
    element.href = url;
  }
}

function isHttpUrl(value) {
  return /^https?:\/\//i.test(String(value || ""));
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export { GBFS_PROVIDERS };
