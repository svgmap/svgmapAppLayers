"use strict";

const IOT100_API_BASE = "https://iot100.uchida.co.jp/iot100api/public/";
const IOT100_ENDPOINTS = {
  dataTypes: IOT100_API_BASE + "info/weatherdatatype/",
  nodes: IOT100_API_BASE + "getnodelist/",
  weather: IOT100_API_BASE + "getweather/",
  scene: IOT100_API_BASE + "getscene/"
};
const NODE_PROPERTIES = [
  "NodeID",
  "名称",
  "緯度",
  "経度",
  "最新気温",
  "モデル",
  "センサー設置方法",
  "カメラ撮影方位",
  "景観"
];
const DATA_LABELS_JA = {
  Temperature: "気温",
  Humidity: "湿度",
  AtmosphericPressure: "気圧",
  WindDirection: "風向",
  WindSpeed: "風速",
  WindSpeedMaximumMoment: "最大瞬間風速",
  RainFall: "雨量",
  WindDirectionMaximumMoment: "最大瞬間風向",
  Humidity_test: "湿度（テスト）",
  Battery: "バッテリー電圧",
  BatteryStatus: "バッテリー状態",
  RainFallHour: "1時間雨量",
  RainFallDay: "日雨量",
  Rssi: "受信信号強度",
  Luminosity: "照度"
};
const FALLBACK_UNITS = {
  Temperature: "℃",
  Humidity: "%",
  AtmosphericPressure: "hPa",
  WindDirection: "deg",
  WindSpeed: "m/s",
  WindSpeedMaximumMoment: "m/s",
  RainFall: "mm",
  WindDirectionMaximumMoment: "deg",
  Humidity_test: "%",
  Battery: "mv",
  BatteryStatus: "bool",
  RainFallHour: "mm",
  RainFallDay: "mm",
  Rssi: "dBm",
  Luminosity: "lx"
};
const DETAIL_FIELD_ORDER = Object.keys(DATA_LABELS_JA);
const RANGE_FIELDS = [
  "Temperature",
  "Humidity",
  "AtmosphericPressure",
  "WindSpeed",
  "WindSpeedMaximumMoment",
  "RainFallHour",
  "RainFallDay",
  "Luminosity"
];

let allNodes = [];
let dataTypes = [];
let unitsByLabel = Object.assign({}, FALLBACK_UNITS);
let listRequest = null;
let detailRequest = null;
let detailRequestSerial = 0;
let readyStatus = "";

onload = function(){
  initPoiDialog();
  document.getElementById("refreshButton").addEventListener("click", refreshPublicData);
  document.getElementById("nodeSearch").addEventListener("input", drawFilteredNodes);
  document.getElementById("deviceTypeFilter").addEventListener("change", drawFilteredNodes);
  void refreshPublicData();
};
window.addEventListener("beforeunload", shutdownIot100WeatherBox);

function initPoiDialog(){
  if (typeof svgMap !== "undefined" && typeof layerID !== "undefined") {
    svgMap.setShowPoiProperty(showWeatherBoxDialog, layerID);
  }
  if (typeof svgImageProps !== "undefined") {
    svgImageProps.isClickable = { value: true, hilightStrokeStyle: {} };
  }
}

async function refreshPublicData(){
  abortRequest(listRequest);
  listRequest = new AbortController();
  setRefreshDisabled(true);
  setStatus("地点一覧とデータ種別を取得中…", false);

  const results = await Promise.allSettled([
    fetchPublicJson(IOT100_ENDPOINTS.dataTypes, listRequest.signal),
    fetchPublicJson(IOT100_ENDPOINTS.nodes, listRequest.signal)
  ]);

  const errors = [];
  const typeResult = results[0];
  const nodeResult = results[1];

  if (typeResult.status === "fulfilled") {
    try {
      dataTypes = normalizeDataTypes(typeResult.value);
      unitsByLabel = buildUnitsMap(dataTypes);
      renderDataTypes(dataTypes);
    } catch (error) {
      console.error(error);
      errors.push("データ種別: " + error.message);
      renderDataTypes([]);
    }
  } else if (typeResult.reason && typeResult.reason.name !== "AbortError") {
    console.error(typeResult.reason);
    errors.push("データ種別: " + typeResult.reason.message);
    renderDataTypes([]);
  }

  if (nodeResult.status === "fulfilled") {
    try {
      allNodes = normalizeNodes(nodeResult.value);
      drawFilteredNodes();
    } catch (error) {
      console.error(error);
      errors.push("地点一覧: " + error.message);
      allNodes = [];
      drawFilteredNodes();
    }
  } else if (nodeResult.reason && nodeResult.reason.name !== "AbortError") {
    console.error(nodeResult.reason);
    errors.push("地点一覧: " + nodeResult.reason.message);
    allNodes = [];
    drawFilteredNodes();
  }

  if (errors.length) {
    readyStatus = errors.join(" / ");
    setStatus(readyStatus, true);
  } else {
    readyStatus = "公開データを更新しました（" + formatLocalTime(new Date()) + "）";
    setStatus(readyStatus, false);
  }

  listRequest = null;
  setRefreshDisabled(false);
}

async function fetchPublicJson(url, signal){
  const requestUrl = getCorsUrl(url);
  let response;
  try {
    response = await fetch(requestUrl, { cache: "no-store", signal: signal });
  } catch (error) {
    if (error.name === "AbortError") {
      throw error;
    }
    const message = requestUrl === url ?
      "ブラウザから直接取得できません（CORS）。CORSプロキシを設定してください" :
      "CORSプロキシ経由の通信に失敗しました。プロキシで iot100.uchida.co.jp を許可してください";
    throw new Error(message);
  }

  if (!response.ok) {
    if (requestUrl !== url && response.status === 403) {
      throw new Error("CORSプロキシで iot100.uchida.co.jp が許可されていません（403）");
    }
    throw new Error(response.status + " " + response.statusText);
  }

  try {
    return await response.json();
  } catch (error) {
    throw new Error("APIレスポンスをJSONとして解析できませんでした");
  }
}

function getCorsUrl(url){
  if (typeof svgMap !== "undefined" && typeof svgMap.getCORSURL === "function") {
    try {
      return svgMap.getCORSURL(url);
    } catch (error) {
      console.warn("CORS URLの生成に失敗しました", error);
    }
  }
  return url;
}

function normalizeDataTypes(value){
  if (!Array.isArray(value)) {
    throw new Error("データ種別APIの形式が不正です");
  }
  return value.filter(function(item){
    return item && typeof item.Label === "string";
  }).map(function(item){
    return {
      Label: item.Label,
      Data: item.Data == null ? "" : String(item.Data)
    };
  });
}

function buildUnitsMap(items){
  const result = Object.assign({}, FALLBACK_UNITS);
  for (const item of items) {
    result[item.Label] = item.Data;
  }
  return result;
}

function normalizeNodes(value){
  if (!Array.isArray(value)) {
    throw new Error("地点一覧APIの形式が不正です");
  }
  return value.filter(function(node){
    const latitude = Number(node && node.Latitude);
    const longitude = Number(node && node.Longitude);
    return node && node.NodeID != null && Number.isFinite(latitude) && Number.isFinite(longitude) &&
      latitude >= -90 && latitude <= 90 && longitude >= -180 && longitude <= 180;
  });
}

function renderDataTypes(items){
  const rows = document.getElementById("dataTypeRows");
  document.getElementById("dataTypeCount").textContent = items.length + "種";
  if (!items.length) {
    rows.innerHTML = '<tr><td colspan="3">取得できませんでした</td></tr>';
    return;
  }
  rows.innerHTML = items.map(function(item){
    return "<tr><td>" + escapeHtml(getJapaneseDataLabel(item.Label)) + "</td>" +
      "<td>" + escapeHtml(item.Label) + "</td>" +
      "<td>" + escapeHtml(item.Data || "-") + "</td></tr>";
  }).join("");
}

function drawFilteredNodes(){
  const query = document.getElementById("nodeSearch").value.trim().toLowerCase();
  const deviceType = document.getElementById("deviceTypeFilter").value;
  const filteredNodes = allNodes.filter(function(node){
    const matchesQuery = !query || String(node.NodeName || "").toLowerCase().includes(query);
    const matchesType = deviceType === "all" || String(node.DeviceType) === deviceType;
    return matchesQuery && matchesType;
  });

  document.getElementById("nodeCount").textContent = "表示 " + filteredNodes.length + " / 全 " + allNodes.length + "地点";
  if (typeof svgImage === "undefined" || typeof svgMap === "undefined") {
    return;
  }

  const mapContents = svgImage.getElementById("mapContents");
  removeChildren(mapContents);
  svgImage.documentElement.setAttribute("property", NODE_PROPERTIES.join(","));

  for (const node of filteredNodes) {
    const marker = svgImage.createElement("use");
    const latitude = Number(node.Latitude);
    const longitude = Number(node.Longitude);
    marker.setAttribute("xlink:href", getTemperatureSymbol(node.NewestTemperature));
    marker.setAttribute("x", 0);
    marker.setAttribute("y", 0);
    marker.setAttribute("transform", "ref(svg," + longitude + "," + (-latitude) + ")");
    marker.setAttribute("data-node-id", String(node.NodeID));
    marker.setAttribute("data-title", getNodeTitle(node));
    marker.setAttribute("xlink:title", getNodeTitle(node));
    marker.setAttribute("content", getCsvContent(getNodeProperties(node)));
    mapContents.appendChild(marker);
  }

  svgMap.refreshScreen();
}

function getTemperatureSymbol(value){
  if (value === null || value === undefined || value === "" || !Number.isFinite(Number(value))) {
    return "#temperatureUnavailable";
  }
  const temperature = Number(value);
  if (temperature < 10) {
    return "#temperatureCold";
  }
  if (temperature < 20) {
    return "#temperatureCool";
  }
  if (temperature < 30) {
    return "#temperatureWarm";
  }
  if (temperature < 35) {
    return "#temperatureHot";
  }
  return "#temperatureVeryHot";
}

function getNodeTitle(node){
  const temperature = formatMeasurementValue("Temperature", node.NewestTemperature, true);
  return temperature ? String(node.NodeName || "名称未設定") + "（" + temperature + "）" : String(node.NodeName || "名称未設定");
}

function getNodeProperties(node){
  return [
    node.NodeID,
    node.NodeName,
    node.Latitude,
    node.Longitude,
    formatMeasurementValue("Temperature", node.NewestTemperature, true),
    getDeviceTypeLabel(node.DeviceType),
    getMeasurementMethodLabel(node),
    node.CameraOrientation,
    formatLandscape(node.LandscapeTexts)
  ];
}

function showWeatherBoxDialog(target){
  const selected = getSelectedNode(target);
  if (!selected.nodeId) {
    const message = "選択した地点のNodeIDを取得できませんでした。";
    svgMap.showModal(buildWeatherErrorDialog("IoT百葉箱", message), 420, 320);
    setStatus("観測詳細: " + message, true);
    return;
  }

  const node = selected.node;
  setSelectedSummaryLoading(node);
  setStatus((node.NodeName || "NodeID " + selected.nodeId) + " の観測詳細を取得中…", false);
  svgMap.showModal(buildWeatherLoadingDialog(node), 420, 260);
  void loadAndShowWeatherBoxDetail(selected.nodeId, node);
}

async function loadAndShowWeatherBoxDetail(nodeId, node){

  abortRequest(detailRequest);
  detailRequest = new AbortController();
  const requestId = ++detailRequestSerial;

  try {
    const weather = await fetchPublicJson(IOT100_ENDPOINTS.weather + encodeURIComponent(nodeId), detailRequest.signal);
    if (requestId !== detailRequestSerial) {
      return;
    }
    const records = normalizeWeatherRecords(weather);
    const latest = getLatestRecord(records);
    renderSelectedSummary(node, latest);
    svgMap.showModal(buildWeatherDetailDialog(node, weather, records, latest), 500, 680);
    setStatus(readyStatus || "観測詳細を取得しました", false);
  } catch (error) {
    if (error.name === "AbortError" || requestId !== detailRequestSerial) {
      return;
    }
    console.error(error);
    renderSelectedSummaryError(node, error.message);
    svgMap.showModal(buildWeatherErrorDialog(node.NodeName || "IoT百葉箱", error.message), 420, 340);
    setStatus("観測詳細: " + error.message, true);
  } finally {
    if (requestId === detailRequestSerial) {
      detailRequest = null;
    }
  }
}

function getSelectedNode(target){
  const metadata = getTargetMetadata(target);
  const nodeId = getTargetAttribute(target, "data-node-id") || metadata.NodeID || "";
  const node = allNodes.find(function(item){
    return String(item.NodeID) === String(nodeId);
  });

  if (node) {
    return { nodeId: String(nodeId), node: node };
  }

  const title = getTargetAttribute(target, "data-title") ||
    getTargetAttribute(target, "xlink:title") || metadata["名称"] || "IoT百葉箱";
  return {
    nodeId: String(nodeId),
    node: {
      NodeID: nodeId,
      NodeName: title,
      Latitude: metadata["緯度"] || "",
      Longitude: metadata["経度"] || "",
      NewestTemperature: "",
      DeviceType: "",
      MeasurementMethod: "",
      CameraOrientation: metadata["カメラ撮影方位"] || "",
      LandscapeTexts: metadata["景観"] || ""
    }
  };
}

function getTargetMetadata(target){
  const content = getTargetAttribute(target, "content");
  if (!content) {
    return {};
  }
  const values = typeof svgMap.parseEscapedCsvLine === "function" ?
    svgMap.parseEscapedCsvLine(content) : content.split(",");
  const metadata = {};
  for (let i = 0; i < NODE_PROPERTIES.length; i++) {
    metadata[NODE_PROPERTIES[i]] = values[i] || "";
  }
  return metadata;
}

function getTargetAttribute(target, name){
  if (!target || typeof target.getAttribute !== "function") {
    return "";
  }
  return target.getAttribute(name) || "";
}

function buildWeatherLoadingDialog(node){
  return '<div style="font-family:sans-serif;font-size:13px;line-height:1.5">' +
    '<h3 style="margin:0 0 8px">' + escapeHtml(node.NodeName || "IoT百葉箱") + "</h3>" +
    '<p style="margin:0">NodeID ' + escapeHtml(node.NodeID) + " の観測詳細を取得中です…</p></div>";
}

function buildWeatherErrorDialog(title, message){
  return '<div style="font-family:sans-serif;font-size:13px;line-height:1.5">' +
    '<h3 style="margin:0 0 8px">' + escapeHtml(title) + "</h3>" +
    '<p style="margin:0 0 8px;color:#b00020">観測詳細を取得できませんでした。</p>' +
    '<p style="margin:0">' + escapeHtml(message) + "</p></div>";
}

function normalizeWeatherRecords(weather){
  if (!weather || !Array.isArray(weather.TargetDatas)) {
    throw new Error("観測詳細APIの形式が不正です");
  }
  return weather.TargetDatas.filter(function(record){
    return record && typeof record === "object";
  });
}

function getLatestRecord(records){
  if (!records.length) {
    return null;
  }
  return records.reduce(function(latest, record){
    if (!latest) {
      return record;
    }
    return String(record.RecordedTime || "") >= String(latest.RecordedTime || "") ? record : latest;
  }, null);
}

function buildWeatherDetailDialog(node, weather, records, latest){
  let html = '<div style="font-family:sans-serif;font-size:13px;line-height:1.45">';
  html += '<h3 style="margin:0 0 7px">' + escapeHtml(weather.NodeName || node.NodeName || "IoT百葉箱") + "</h3>";
  html += buildNodeInformationTable(node);

  if (!latest) {
    html += '<p style="padding:8px;background:#f5f5f5">観測データがありません。</p>';
  } else {
    html += buildSceneImage(node, latest);
    html += '<h4 style="margin:10px 0 5px">最新の観測値</h4>';
    html += '<p style="margin:0 0 5px">観測時刻: ' + escapeHtml(latest.RecordedTime || "不明") + "</p>";
    html += buildLatestValuesTable(latest);
    html += buildRangeTable(records);
  }

  html += '<p style="margin:9px 0 0;font-size:12px">出典: <a target="_blank" rel="noopener" href="https://iot100.uchida.co.jp/">内田洋行 IoT百葉箱</a>（公開データを加工して表示）</p>';
  html += '<p style="margin:5px 0 0;font-size:11px;color:#555">本データは教育研究向けです。防災目的の気象観測値としては使用できません。</p></div>';
  return html;
}

function buildSceneImage(node, latest){
  const sceneUrl = getSceneImageUrl(node.NodeID, latest.RecordedTime);
  if (!sceneUrl) {
    return '<h4 style="margin:10px 0 5px">IoT百葉箱から撮影した画像</h4>' +
      '<p style="margin:0;color:#555">画像の撮影時刻を特定できませんでした。</p>';
  }

  const title = node.NodeName || "IoT百葉箱";
  const alt = title + "から撮影した画像（" + latest.RecordedTime + "）";
  return '<h4 style="margin:10px 0 5px">IoT百葉箱から撮影した画像</h4>' +
    '<figure style="margin:0">' +
    '<a href="' + escapeHtml(sceneUrl) + '" target="_blank" rel="noopener">' +
    '<img src="' + escapeHtml(sceneUrl) + '" alt="' + escapeHtml(alt) + '" ' +
    'referrerpolicy="no-referrer" style="display:block;width:100%;height:auto;border:1px solid #ccd3d9" ' +
    'onerror="this.hidden=true;this.parentElement.nextElementSibling.hidden=false"></a>' +
    '<p hidden style="margin:0;padding:8px;background:#f5f5f5;color:#555">この時刻の画像を取得できませんでした。</p>' +
    '<figcaption style="margin-top:3px;font-size:11px;color:#555">撮影時刻: ' +
    escapeHtml(latest.RecordedTime) + "（画像をクリックすると原寸表示）</figcaption></figure>";
}

function getSceneImageUrl(nodeId, recordedTime){
  const timestamp = getSceneTimestamp(recordedTime);
  if (nodeId === null || nodeId === undefined || nodeId === "" || !timestamp) {
    return "";
  }
  return IOT100_ENDPOINTS.scene + encodeURIComponent(nodeId) + "/1/original/" + timestamp + "/";
}

function getSceneTimestamp(recordedTime){
  const match = String(recordedTime || "").match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})/);
  return match ? match.slice(1).join("") : "";
}

function buildNodeInformationTable(node){
  const rows = [
    ["NodeID", node.NodeID],
    ["モデル", getDeviceTypeLabel(node.DeviceType)],
    ["センサー設置方法", getMeasurementMethodLabel(node)],
    ["緯度", node.Latitude],
    ["経度", node.Longitude],
    ["カメラ撮影方位", node.CameraOrientation],
    ["景観", formatLandscape(node.LandscapeTexts)]
  ];
  return buildTwoColumnTable(rows, "地点情報");
}

function buildLatestValuesTable(latest){
  const availableFields = DETAIL_FIELD_ORDER.concat(Object.keys(latest).filter(function(key){
    return key !== "RecordedTime" && DETAIL_FIELD_ORDER.indexOf(key) < 0;
  })).filter(function(key, index, array){
    return array.indexOf(key) === index && latest[key] !== null && latest[key] !== undefined && latest[key] !== "";
  });

  const rows = availableFields.map(function(key){
    return [getJapaneseDataLabel(key), formatMeasurementValue(key, latest[key], true)];
  });
  return buildTwoColumnTable(rows, "");
}

function buildRangeTable(records){
  const rows = [];
  for (const key of RANGE_FIELDS) {
    const values = records.filter(function(record){
      return record[key] !== null && record[key] !== undefined && record[key] !== "";
    }).map(function(record){
      return Number(record[key]);
    }).filter(Number.isFinite);
    if (!values.length) {
      continue;
    }
    const minimum = Math.min.apply(null, values);
    const maximum = Math.max.apply(null, values);
    rows.push([
      getJapaneseDataLabel(key),
      formatMeasurementValue(key, minimum, true) + " ～ " + formatMeasurementValue(key, maximum, true)
    ]);
  }
  if (!rows.length) {
    return "";
  }
  return '<h4 style="margin:10px 0 5px">取得期間の最小 ～ 最大（' + records.length + "件）</h4>" + buildTwoColumnTable(rows, "");
}

function buildTwoColumnTable(rows, caption){
  const visibleRows = rows.filter(function(row){
    return row[1] !== null && row[1] !== undefined && row[1] !== "";
  });
  if (!visibleRows.length) {
    return "";
  }
  let html = '<table border="1" style="word-break:break-all;table-layout:fixed;width:100%;border-collapse:collapse;font-size:12px">';
  if (caption) {
    html += '<caption style="text-align:left;font-weight:bold;margin-bottom:4px">' + escapeHtml(caption) + "</caption>";
  }
  html += '<tr><th style="width:42%;padding:4px;background:#eef2f5">項目</th><th style="padding:4px;background:#eef2f5">値</th></tr>';
  for (const row of visibleRows) {
    html += "<tr><td style=\"padding:4px\">" + escapeHtml(row[0]) + "</td><td style=\"padding:4px\">" + escapeHtml(row[1]) + "</td></tr>";
  }
  return html + "</table>";
}

function setSelectedSummaryLoading(node){
  const summary = document.getElementById("selectedSummary");
  summary.className = "summary";
  summary.innerHTML = '<div class="summary-title">' + escapeHtml(node.NodeName || "名称未設定") + "</div>観測詳細を取得中…";
}

function renderSelectedSummary(node, latest){
  const summary = document.getElementById("selectedSummary");
  summary.className = "summary";
  let html = '<div class="summary-title">' + escapeHtml(node.NodeName || "名称未設定") + "</div>";
  if (!latest) {
    summary.innerHTML = html + "観測データがありません。";
    return;
  }
  html += '<div class="metrics">';
  for (const key of ["Temperature", "Humidity", "AtmosphericPressure", "WindSpeed", "RainFallHour"]) {
    if (latest[key] !== null && latest[key] !== undefined && latest[key] !== "") {
      html += '<span class="metric">' + escapeHtml(getJapaneseDataLabel(key)) + " " + escapeHtml(formatMeasurementValue(key, latest[key], true)) + "</span>";
    }
  }
  html += "</div><div>観測時刻: " + escapeHtml(latest.RecordedTime || "不明") + "</div>";
  summary.innerHTML = html;
}

function renderSelectedSummaryError(node, message){
  const summary = document.getElementById("selectedSummary");
  summary.className = "summary empty";
  summary.innerHTML = '<div class="summary-title">' + escapeHtml(node.NodeName || "名称未設定") + "</div>" + escapeHtml(message);
}

function formatMeasurementValue(key, value, includeUnit){
  if (value === null || value === undefined || value === "") {
    return "";
  }
  let formatted = value;
  if (typeof value === "number" && Number.isFinite(value)) {
    formatted = value.toLocaleString("ja-JP", { maximumFractionDigits: 3 });
  }
  const unit = includeUnit ? unitsByLabel[key] || "" : "";
  if (!unit || ((key === "WindDirection" || key === "WindDirectionMaximumMoment") && !Number.isFinite(Number(value)))) {
    return String(formatted);
  }
  return String(formatted) + " " + unit;
}

function getJapaneseDataLabel(label){
  return DATA_LABELS_JA[label] || label;
}

function getDeviceTypeLabel(value){
  if (Number(value) === 0) {
    return "基本気象観測モデル";
  }
  if (Number(value) === 1) {
    return "総合気象観測モデル";
  }
  return value === null || value === undefined || value === "" ? "不明" : "種別 " + value;
}

function getMeasurementMethodLabel(node){
  if (Number(node.DeviceType) !== 0 || node.MeasurementMethod === null || node.MeasurementMethod === undefined || node.MeasurementMethod === "") {
    return "";
  }
  return String(node.MeasurementMethod) === "true" ? "百葉箱に入っている" : "百葉箱に入っていない";
}

function formatLandscape(value){
  if (Array.isArray(value)) {
    return value.filter(Boolean).join("、");
  }
  return value == null ? "" : String(value);
}

function getCsvContent(values){
  return values.map(escapeCsvField).join(",");
}

function escapeCsvField(value){
  const text = value == null ? "" : String(value);
  if (/[",\r\n]/.test(text)) {
    return '"' + text.replace(/"/g, '""') + '"';
  }
  return text;
}

function removeChildren(element){
  while (element && element.firstChild) {
    element.removeChild(element.firstChild);
  }
}

function setStatus(message, isError){
  const status = document.getElementById("statusMessage");
  status.textContent = message;
  status.classList.toggle("error", Boolean(isError));
}

function setRefreshDisabled(disabled){
  document.getElementById("refreshButton").disabled = disabled;
}

function formatLocalTime(date){
  return date.toLocaleString("ja-JP", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function abortRequest(controller){
  if (controller) {
    controller.abort();
  }
}

function shutdownIot100WeatherBox(){
  abortRequest(listRequest);
  abortRequest(detailRequest);
}

function escapeHtml(value){
  return String(value).replace(/[&<>"']/g, function(char){
    return {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    }[char];
  });
}
