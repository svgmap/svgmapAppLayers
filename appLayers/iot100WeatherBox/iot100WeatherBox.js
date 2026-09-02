// License: (MPL v2)
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.
"use strict";

const IOT100_API_BASE = "https://iot100.uchida.co.jp/iot100api/public/";
const IOT100_ENDPOINTS = {
  dataTypes: IOT100_API_BASE + "info/weatherdatatype/",
  nodes: IOT100_API_BASE + "getnodelist/",
  weather: IOT100_API_BASE + "getweather/",
  scene: IOT100_API_BASE + "getscene/"
};
const MEASUREMENT_DEFINITIONS = {
  Temperature: { label: "気温", unit: "℃", showInSummary: true, showRange: true },
  Humidity: { label: "湿度", unit: "%", showInSummary: true, showRange: true },
  AtmosphericPressure: { label: "気圧", unit: "hPa", showInSummary: true, showRange: true },
  WindDirection: { label: "風向", unit: "deg" },
  WindSpeed: { label: "風速", unit: "m/s", showInSummary: true, showRange: true },
  WindSpeedMaximumMoment: { label: "最大瞬間風速", unit: "m/s", showRange: true },
  RainFall: { label: "雨量", unit: "mm" },
  WindDirectionMaximumMoment: { label: "最大瞬間風向", unit: "deg" },
  Humidity_test: { label: "湿度（テスト）", unit: "%" },
  Battery: { label: "バッテリー電圧", unit: "mv" },
  BatteryStatus: { label: "バッテリー状態", unit: "bool" },
  RainFallHour: { label: "1時間雨量", unit: "mm", showInSummary: true, showRange: true },
  RainFallDay: { label: "日雨量", unit: "mm", showRange: true },
  Rssi: { label: "受信信号強度", unit: "dBm" },
  Luminosity: { label: "照度", unit: "lx", showRange: true }
};
const DETAIL_FIELD_ORDER = Object.keys(MEASUREMENT_DEFINITIONS);
const RANGE_FIELDS = DETAIL_FIELD_ORDER.filter(function(key){
  return MEASUREMENT_DEFINITIONS[key].showRange;
});
const SUMMARY_FIELDS = DETAIL_FIELD_ORDER.filter(function(key){
  return MEASUREMENT_DEFINITIONS[key].showInSummary;
});
const TEMPERATURE_BANDS = [
  { maximum: 10, color: "#1976d2" },
  { maximum: 20, color: "#2e7d32" },
  { maximum: 30, color: "#f9a825" },
  { maximum: 35, color: "#ef6c00" },
  { maximum: Infinity, color: "#c62828" }
];
const NODE_METADATA_FIELDS = [
  { name: "NodeID", getValue: function(node){ return node.NodeID; } },
  { name: "名称", getValue: function(node){ return node.NodeName; } },
  { name: "緯度", getValue: function(node){ return node.Latitude; } },
  { name: "経度", getValue: function(node){ return node.Longitude; } },
  { name: "最新気温", getValue: function(node){ return formatMeasurementValue("Temperature", node.NewestTemperature); } },
  { name: "モデル", getValue: function(node){ return getDeviceTypeLabel(node.DeviceType); } },
  { name: "センサー設置方法", getValue: getMeasurementMethodLabel },
  { name: "カメラ撮影方位", getValue: function(node){ return node.CameraOrientation; } },
  { name: "景観", getValue: function(node){ return formatLandscape(node.LandscapeTexts); } }
];
const NODE_PROPERTIES = NODE_METADATA_FIELDS.map(function(field){
  return field.name;
});
const state = {
  nodes: [],
  unitsByLabel: createFallbackUnits(),
  listRequest: null,
  detailRequest: null,
  readyStatus: ""
};
let initialized = false;

addEventListener("layerWebAppReady", function(){
  if (initialized) {
    return;
  }
  initialized = true;
  initPoiDialog();
  document.getElementById("refreshButton").addEventListener("click", refreshPublicData);
  document.getElementById("nodeSearch").addEventListener("input", drawFilteredNodes);
  document.getElementById("deviceTypeFilter").addEventListener("change", drawFilteredNodes);
  void refreshPublicData();
});
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
  abortRequest(state.listRequest);
  const request = new AbortController();
  state.listRequest = request;
  setRefreshDisabled(true);
  setStatus("地点一覧とデータ種別を取得中…", false);

  try {
    const results = await Promise.allSettled([
      fetchPublicJson(IOT100_ENDPOINTS.dataTypes, request.signal),
      fetchPublicJson(IOT100_ENDPOINTS.nodes, request.signal)
    ]);
    if (state.listRequest !== request || request.signal.aborted) {
      return;
    }

    const errors = [];
    applySettledResult(results[0], {
      label: "データ種別",
      normalize: normalizeDataTypes,
      onSuccess: function(items){
        state.unitsByLabel = buildUnitsMap(items);
        renderDataTypes(items);
      },
      onError: function(){
        state.unitsByLabel = createFallbackUnits();
        renderDataTypes([]);
      }
    }, errors);
    applySettledResult(results[1], {
      label: "地点一覧",
      normalize: normalizeNodes,
      onSuccess: function(nodes){
        state.nodes = nodes;
        drawFilteredNodes();
      },
      onError: function(){
        state.nodes = [];
        drawFilteredNodes();
      }
    }, errors);

    state.readyStatus = errors.length ?
      errors.join(" / ") :
      "公開データを更新しました（" + formatLocalTime(new Date()) + "）";
    setStatus(state.readyStatus, errors.length > 0);
  } finally {
    if (state.listRequest === request) {
      state.listRequest = null;
      setRefreshDisabled(false);
    }
  }
}

function applySettledResult(result, options, errors){
  if (result.status === "rejected") {
    if (!isAbortError(result.reason)) {
      reportResultError(options, result.reason, errors);
    }
    return;
  }
  try {
    options.onSuccess(options.normalize(result.value));
  } catch (error) {
    reportResultError(options, error, errors);
  }
}

function reportResultError(options, error, errors){
  console.error(error);
  errors.push(options.label + ": " + getErrorMessage(error));
  options.onError();
}

function getErrorMessage(error){
  return error && error.message ? error.message : String(error);
}

async function fetchPublicJson(url, signal){
  const requestUrl = getCorsUrl(url);
  let response;
  try {
    response = await fetch(requestUrl, { cache: "no-store", signal: signal });
  } catch (error) {
    if (isAbortError(error)) {
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
  const result = createFallbackUnits();
  for (const item of items) {
    result[item.Label] = item.Data;
  }
  return result;
}

function createFallbackUnits(){
  const result = {};
  for (const key of DETAIL_FIELD_ORDER) {
    result[key] = MEASUREMENT_DEFINITIONS[key].unit;
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
  const filteredNodes = filterNodes(state.nodes, query, deviceType);

  document.getElementById("nodeCount").textContent = "表示 " + filteredNodes.length + " / 全 " + state.nodes.length + "地点";
  if (typeof svgImage === "undefined" || typeof svgMap === "undefined") {
    return;
  }

  const mapContents = svgImage.getElementById("mapContents");
  removeChildren(mapContents);
  svgImage.documentElement.setAttribute("property", NODE_PROPERTIES.join(","));

  for (const node of filteredNodes) {
    mapContents.appendChild(createNodeMarker(node));
  }

  svgMap.refreshScreen();
}

function filterNodes(nodes, query, deviceType){
  return nodes.filter(function(node){
    const matchesQuery = !query || String(node.NodeName || "").toLowerCase().includes(query);
    const matchesType = deviceType === "all" || String(node.DeviceType) === deviceType;
    return matchesQuery && matchesType;
  });
}

function createNodeMarker(node){
  const marker = svgImage.createElement("circle");
  const title = getNodeTitle(node);
  setAttributes(marker, {
    cx: 0,
    cy: 0,
    r: 6,
    fill: getTemperatureColor(node.NewestTemperature),
    stroke: "#ffffff",
    "stroke-width": 2,
    transform: "ref(svg," + Number(node.Longitude) + "," + (-Number(node.Latitude)) + ")",
    class: "clickable",
    "data-node-id": String(node.NodeID),
    "data-title": title,
    "xlink:title": title,
    content: getCsvContent(getNodeProperties(node))
  });
  return marker;
}

function setAttributes(element, attributes){
  for (const name of Object.keys(attributes)) {
    element.setAttribute(name, attributes[name]);
  }
}

function getTemperatureColor(value){
  if (isMissingValue(value) || !Number.isFinite(Number(value))) {
    return "#757575";
  }
  const temperature = Number(value);
  for (const band of TEMPERATURE_BANDS) {
    if (temperature < band.maximum) {
      return band.color;
    }
  }
  return TEMPERATURE_BANDS[TEMPERATURE_BANDS.length - 1].color;
}

function getNodeTitle(node){
  const temperature = formatMeasurementValue("Temperature", node.NewestTemperature);
  return temperature ? String(node.NodeName || "名称未設定") + "（" + temperature + "）" : String(node.NodeName || "名称未設定");
}

function getNodeProperties(node){
  return NODE_METADATA_FIELDS.map(function(field){
    return field.getValue(node);
  });
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
  abortRequest(state.detailRequest);
  const request = new AbortController();
  state.detailRequest = request;

  try {
    const weather = await fetchPublicJson(IOT100_ENDPOINTS.weather + encodeURIComponent(nodeId), request.signal);
    if (state.detailRequest !== request) {
      return;
    }
    const records = normalizeWeatherRecords(weather);
    const latest = getLatestRecord(records);
    renderSelectedSummary(node, latest);
    svgMap.showModal(buildWeatherDetailDialog(node, weather, records, latest), 500, 680);
    setStatus(state.readyStatus || "観測詳細を取得しました", false);
  } catch (error) {
    if (isAbortError(error) || state.detailRequest !== request) {
      return;
    }
    const message = getErrorMessage(error);
    console.error(error);
    renderSelectedSummaryError(node, message);
    svgMap.showModal(buildWeatherErrorDialog(node.NodeName || "IoT百葉箱", message), 420, 340);
    setStatus("観測詳細: " + message, true);
  } finally {
    if (state.detailRequest === request) {
      state.detailRequest = null;
    }
  }
}

function getSelectedNode(target){
  const metadata = getTargetMetadata(target);
  const nodeId = getTargetAttribute(target, "data-node-id") || metadata.NodeID || "";
  const node = state.nodes.find(function(item){
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
      DeviceType: parseDeviceType(metadata["モデル"]),
      MeasurementMethod: parseMeasurementMethod(metadata["センサー設置方法"]),
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
  const values = typeof svgMap !== "undefined" && typeof svgMap.parseEscapedCsvLine === "function" ?
    svgMap.parseEscapedCsvLine(content) : parseCsvLine(content);
  const metadata = {};
  for (let i = 0; i < NODE_PROPERTIES.length; i++) {
    metadata[NODE_PROPERTIES[i]] = values[i] || "";
  }
  return metadata;
}

function parseCsvLine(content){
  const values = [];
  let value = "";
  let quoted = false;
  for (let i = 0; i < content.length; i++) {
    const char = content[i];
    if (char === '"') {
      if (quoted && content[i + 1] === '"') {
        value += '"';
        i++;
      } else {
        quoted = !quoted;
      }
    } else if (char === "," && !quoted) {
      values.push(value);
      value = "";
    } else {
      value += char;
    }
  }
  values.push(value);
  return values;
}

function getTargetAttribute(target, name){
  if (!target || typeof target.getAttribute !== "function") {
    return "";
  }
  return target.getAttribute(name) || "";
}

function parseDeviceType(label){
  if (label === "基本気象観測モデル") {
    return 0;
  }
  if (label === "総合気象観測モデル") {
    return 1;
  }
  return "";
}

function parseMeasurementMethod(label){
  if (label === "百葉箱に入っている") {
    return "true";
  }
  if (label === "百葉箱に入っていない") {
    return "false";
  }
  return "";
}

function buildWeatherLoadingDialog(node){
  return buildDialog(
    node.NodeName || "IoT百葉箱",
    '<p style="margin:0">NodeID ' + escapeHtml(node.NodeID) + " の観測詳細を取得中です…</p>"
  );
}

function buildWeatherErrorDialog(title, message){
  return buildDialog(title,
    '<p style="margin:0 0 8px;color:#b00020">観測詳細を取得できませんでした。</p>' +
    '<p style="margin:0">' + escapeHtml(message) + "</p>"
  );
}

function buildDialog(title, body){
  return '<div style="font-family:sans-serif;font-size:13px;line-height:1.5">' +
    '<h3 style="margin:0 0 8px">' + escapeHtml(title) + "</h3>" + body + "</div>";
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
  let body = buildNodeInformationTable(node);

  if (!latest) {
    body += '<p style="padding:8px;background:#f5f5f5">観測データがありません。</p>';
  } else {
    body += buildSceneImage(node, latest);
    body += '<h4 style="margin:10px 0 5px">最新の観測値</h4>';
    body += '<p style="margin:0 0 5px">観測時刻: ' + escapeHtml(latest.RecordedTime || "不明") + "</p>";
    body += buildLatestValuesTable(latest);
    body += buildRangeTable(records);
  }

  body += '<p style="margin:9px 0 0;font-size:12px">出典: <a target="_blank" rel="noopener" href="https://iot100.uchida.co.jp/">内田洋行 IoT百葉箱</a>（公開データを加工して表示）</p>';
  body += '<p style="margin:5px 0 0;font-size:11px;color:#555">本データは教育研究向けです。防災目的の気象観測値としては使用できません。</p>';
  return buildDialog(weather.NodeName || node.NodeName || "IoT百葉箱", body);
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
    return array.indexOf(key) === index && !isMissingValue(latest[key]);
  });

  const rows = availableFields.map(function(key){
    return [getJapaneseDataLabel(key), formatMeasurementValue(key, latest[key])];
  });
  return buildTwoColumnTable(rows, "");
}

function buildRangeTable(records){
  const rows = [];
  for (const key of RANGE_FIELDS) {
    const values = records.filter(function(record){
      return !isMissingValue(record[key]);
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
      formatMeasurementValue(key, minimum) + " ～ " + formatMeasurementValue(key, maximum)
    ]);
  }
  if (!rows.length) {
    return "";
  }
  return '<h4 style="margin:10px 0 5px">取得期間の最小 ～ 最大（' + records.length + "件）</h4>" + buildTwoColumnTable(rows, "");
}

function buildTwoColumnTable(rows, caption){
  const visibleRows = rows.filter(function(row){
    return !isMissingValue(row[1]);
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
  updateSelectedSummary(node, "観測詳細を取得中…", false);
}

function renderSelectedSummary(node, latest){
  if (!latest) {
    updateSelectedSummary(node, "観測データがありません。", false);
    return;
  }
  let content = '<div class="metrics">';
  for (const key of SUMMARY_FIELDS) {
    if (!isMissingValue(latest[key])) {
      content += '<span class="metric">' + escapeHtml(getJapaneseDataLabel(key)) + " " + escapeHtml(formatMeasurementValue(key, latest[key])) + "</span>";
    }
  }
  content += "</div><div>観測時刻: " + escapeHtml(latest.RecordedTime || "不明") + "</div>";
  updateSelectedSummary(node, content, false);
}

function renderSelectedSummaryError(node, message){
  updateSelectedSummary(node, escapeHtml(message), true);
}

function updateSelectedSummary(node, content, isEmpty){
  const summary = document.getElementById("selectedSummary");
  summary.className = isEmpty ? "summary empty" : "summary";
  summary.innerHTML = '<div class="summary-title">' + escapeHtml(node.NodeName || "名称未設定") + "</div>" + content;
}

function formatMeasurementValue(key, value){
  if (isMissingValue(value)) {
    return "";
  }
  let formatted = value;
  if (typeof value === "number" && Number.isFinite(value)) {
    formatted = value.toLocaleString("ja-JP", { maximumFractionDigits: 3 });
  }
  const unit = state.unitsByLabel[key] || "";
  if (!unit || ((key === "WindDirection" || key === "WindDirectionMaximumMoment") && !Number.isFinite(Number(value)))) {
    return String(formatted);
  }
  return String(formatted) + " " + unit;
}

function getJapaneseDataLabel(label){
  return MEASUREMENT_DEFINITIONS[label] ? MEASUREMENT_DEFINITIONS[label].label : label;
}

function getDeviceTypeLabel(value){
  if (Number(value) === 0) {
    return "基本気象観測モデル";
  }
  if (Number(value) === 1) {
    return "総合気象観測モデル";
  }
  return isMissingValue(value) ? "不明" : "種別 " + value;
}

function getMeasurementMethodLabel(node){
  if (Number(node.DeviceType) !== 0 || isMissingValue(node.MeasurementMethod)) {
    return "";
  }
  if (String(node.MeasurementMethod) === "true") {
    return "百葉箱に入っている";
  }
  if (String(node.MeasurementMethod) === "false") {
    return "百葉箱に入っていない";
  }
  return "";
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

function isAbortError(error){
  return Boolean(error && error.name === "AbortError");
}

function isMissingValue(value){
  return value === null || value === undefined || value === "";
}

function shutdownIot100WeatherBox(){
  abortRequest(state.listRequest);
  abortRequest(state.detailRequest);
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
