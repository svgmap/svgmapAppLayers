// License: (MPL v2)
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.

"use strict";

const KANTO_BUS_DATA_SOURCES = {
  vehicle: {
    endpoint: "/gtfs/kantobus/vehicles",
    label: "車両位置",
    countLabel: "表示車両数",
    unit: "台",
    emptyMessage: "位置情報を持つ車両がありません"
  },
  trip: {
    endpoint: "/gtfs/kantobus/trip",
    label: "ルート更新情報",
    countLabel: "更新便数",
    unit: "便",
    emptyMessage: "現在、ルート更新情報はありません"
  },
  alert: {
    endpoint: "/gtfs/kantobus/alert",
    label: "運行情報",
    countLabel: "運行情報件数",
    unit: "件",
    emptyMessage: "現在、運行情報はありません"
  }
};
const KANTO_BUS_REFRESH_INTERVAL = 30 * 1000;
const STALE_VEHICLE_SECONDS = 5 * 60;
const VEHICLE_PROPERTIES = [
  "エンティティID",
  "車両ID",
  "車両表示名",
  "ナンバープレート",
  "路線ID",
  "便ID",
  "運行方向ID",
  "始発時刻",
  "運行日",
  "次停留所ID",
  "停留所通過順",
  "運行状態",
  "混雑度",
  "乗車率",
  "車いす対応",
  "緯度",
  "経度",
  "方位",
  "速度(km/h)",
  "車両データ時刻"
];

let refreshTimer = null;
let currentRequest = null;
let requestSerial = 0;
let activeTripUpdates = [];
let activeAlerts = [];
let vehicleElementsById = new Map();
let selectedVehicleId = "";
let selectedVehicleElement = null;
let selectedVehicleHighlightElement = null;

window.addEventListener("load", initializeKantoBusLayer);
window.addEventListener("beforeunload", shutdownKantoBusLayer);

function initializeKantoBusLayer(){
  let PROXY_URL = ".";
  if ( svgImageProps.hash.indexOf("proxy=")>0){
    PROXY_URL = svgImageProps.hash.substring(svgImageProps.hash.indexOf("proxy=")+6);
  }
  KANTO_BUS_DATA_SOURCES.vehicle.endpoint = PROXY_URL + KANTO_BUS_DATA_SOURCES.vehicle.endpoint;
  KANTO_BUS_DATA_SOURCES.trip.endpoint = PROXY_URL + KANTO_BUS_DATA_SOURCES.trip.endpoint;
  KANTO_BUS_DATA_SOURCES.alert.endpoint = PROXY_URL + KANTO_BUS_DATA_SOURCES.alert.endpoint;

  initializePoiDialog();
  document.getElementById("dataTypeSelect").addEventListener("change", handleDataTypeChange);
  document.getElementById("refreshButton").addEventListener("click", refreshSelectedData);
  document.getElementById("resultFilter").addEventListener("input", filterResultCards);
  document.getElementById("resultList").addEventListener("toggle", handleResultToggle, true);
  updateDataTypeUi();
  void refreshSelectedData();
}

function initializePoiDialog(){
  if (typeof svgMap !== "undefined" && typeof layerID !== "undefined") {
    svgMap.setShowPoiProperty(showVehicleDialog, layerID);
  }
  if (typeof svgImageProps !== "undefined") {
    svgImageProps.isClickable = { value: true, hilightStrokeStyle: {} };
  }
}

async function refreshSelectedData(){
  clearRefreshTimer();
  abortCurrentRequest();

  const requestId = ++requestSerial;
  const dataType = getSelectedDataType();
  const selectedSource = dataType === "vehicle" ? null : KANTO_BUS_DATA_SOURCES[dataType];
  currentRequest = new AbortController();
  setLoadingState(true);
  setStatus(selectedSource ? "車両位置と" + selectedSource.label + "を取得中…" : "車両位置を取得中…", false);

  try {
    const vehiclePromise = fetchRealtimeFeed(KANTO_BUS_DATA_SOURCES.vehicle, currentRequest.signal);
    const selectedPromise = selectedSource ? fetchRealtimeFeed(selectedSource, currentRequest.signal) : Promise.resolve(null);
    const results = await Promise.allSettled([vehiclePromise, selectedPromise]);
    if (requestId !== requestSerial) {
      return;
    }

    const messages = [];
    const errors = [];
    const vehicleResult = results[0];
    if (vehicleResult.status === "fulfilled") {
      const vehicleFeed = vehicleResult.value;
      const vehicleEntities = vehicleFeed.entities.filter(function(entity){ return Boolean(entity.vehicle); });
      const vehicleCount = drawVehicles(vehicleEntities);
      const vehicleTimestamp = getDataTimestamp(vehicleFeed);
      setText("vehicleMapCount", vehicleCount + "台");
      setText("vehicleDataTimestamp", vehicleTimestamp ? formatDateTime(vehicleTimestamp) : "不明");
      if (!vehicleCount) {
        messages.push(KANTO_BUS_DATA_SOURCES.vehicle.emptyMessage);
      }
    } else if (vehicleResult.reason.name !== "AbortError") {
      console.error(vehicleResult.reason);
      errors.push("車両位置を取得できませんでした: " + vehicleResult.reason.message);
    }

    if (selectedSource) {
      const selectedResult = results[1];
      if (selectedResult.status === "fulfilled") {
        const displayedCount = displaySelectedFeed(dataType, selectedResult.value);
        const dataTimestamp = getDataTimestamp(selectedResult.value);
        setText("countValue", displayedCount + selectedSource.unit);
        setText("dataTimestamp", dataTimestamp ? formatDateTime(dataTimestamp) : "不明");
        if (!displayedCount) {
          messages.push(selectedSource.emptyMessage);
        }
      } else if (selectedResult.reason.name !== "AbortError") {
        console.error(selectedResult.reason);
        errors.push(selectedSource.label + "を取得できませんでした: " + selectedResult.reason.message);
      }
    } else {
      clearResultList();
    }

    setText("lastFetched", formatDateTime(Date.now() / 1000));
    setStatus(errors.concat(messages).join(" / "), errors.length > 0);
  } catch (error) {
    if (error.name !== "AbortError" && requestId === requestSerial) {
      console.error(error);
      setStatus("リアルタイム情報を取得できませんでした: " + error.message, true);
    }
  } finally {
    if (requestId === requestSerial) {
      currentRequest = null;
      setLoadingState(false);
      scheduleRefresh();
    }
  }
}

async function fetchRealtimeFeed(source, signal){
  const response = await fetch(source.endpoint, { cache: "no-store", signal });
  if (!response.ok) {
    throw new Error(response.status + " " + response.statusText);
  }
  return GtfsRealtimeDecoder.decodeFeedMessage(await response.arrayBuffer());
}

function displaySelectedFeed(dataType, feed){
  if (dataType === "trip") {
    const tripEntities = feed.entities.filter(function(entity){ return Boolean(entity.tripUpdate); });
    renderTripUpdates(tripEntities);
    return tripEntities.length;
  }

  const alertEntities = feed.entities.filter(function(entity){ return Boolean(entity.alert); });
  renderAlerts(alertEntities);
  return alertEntities.length;
}

function drawVehicles(entities){
  const drawableEntities = entities.filter(function(entity){
    return isValidPosition(entity.vehicle && entity.vehicle.position || {});
  });
  vehicleElementsById = new Map();
  selectedVehicleElement = null;
  selectedVehicleHighlightElement = null;
  if (typeof svgImage === "undefined" || typeof svgMap === "undefined") {
    return drawableEntities.length;
  }

  const parentElement = svgImage.getElementById("mapContents");
  removeChildren(parentElement);
  svgImage.documentElement.setAttribute("property", VEHICLE_PROPERTIES.join(","));

  for (const entity of drawableEntities) {
    const vehiclePosition = entity.vehicle || {};
    const position = vehiclePosition.position || {};
    const title = getVehicleTitle(entity);
    const useElement = svgImage.createElement("use");
    useElement.setAttribute("xlink:href", getVehicleSymbol(vehiclePosition));
    useElement.setAttribute("x", 0);
    useElement.setAttribute("y", 0);
    useElement.setAttribute("transform", "ref(svg," + position.longitude + "," + (-position.latitude) + ")");
    useElement.setAttribute("content", getCsvContent(getVehicleProperties(entity)));
    useElement.setAttribute("xlink:title", title);
    useElement.setAttribute("data-title", title);
    const vehicleId = getPrimaryVehicleId(entity);
    if (vehicleId) {
      useElement.setAttribute("data-vehicle-id", vehicleId);
    }
    parentElement.appendChild(useElement);
    registerVehicleElement(entity, useElement);
  }

  applySelectedVehicleHighlight(false);
  svgMap.refreshScreen();
  return drawableEntities.length;
}

function registerVehicleElement(entity, element){
  for (const vehicleId of getVehicleLookupIds(entity)) {
    if (!vehicleElementsById.has(vehicleId)) {
      vehicleElementsById.set(vehicleId, element);
    }
  }
}

function getVehicleLookupIds(entity){
  const vehiclePosition = entity.vehicle || {};
  const descriptor = vehiclePosition.vehicle || {};
  const ids = [descriptor.id, descriptor.label, entity.id].filter(Boolean).map(String);
  if (entity.id && String(entity.id).startsWith("VE_")) {
    ids.push(String(entity.id).slice(3));
  }
  return Array.from(new Set(ids));
}

function getPrimaryVehicleId(entity){
  const vehiclePosition = entity.vehicle || {};
  const descriptor = vehiclePosition.vehicle || {};
  return valueOrEmpty(descriptor.id || descriptor.label || entity.id);
}

function selectVehicleForTrip(entity, content){
  const update = entity && entity.tripUpdate || {};
  const vehicleId = valueOrEmpty(update.vehicle && update.vehicle.id);
  const message = content.querySelector(".vehicle-selection-message");
  if (!vehicleId) {
    if (message) {
      message.textContent = "この便には対象車両IDがありません。";
      message.classList.add("error");
    }
    return;
  }

  selectedVehicleId = vehicleId;
  const selected = applySelectedVehicleHighlight(true);
  if (message) {
    message.textContent = selected ?
      "車両 " + vehicleId + " を地図上で選択しました。" :
      "車両 " + vehicleId + " は現在の車両位置情報にありません。";
    message.classList.toggle("error", !selected);
  }
}

function applySelectedVehicleHighlight(showDetails){
  if (!selectedVehicleId || typeof svgImage === "undefined" || typeof svgMap === "undefined") {
    return false;
  }
  const target = vehicleElementsById.get(String(selectedVehicleId));
  if (!target) {
    return false;
  }

  removeVehicleHighlight();
  selectedVehicleElement = target;
  target.setAttribute("data-selected", "true");

  const highlight = svgImage.createElement("use");
  highlight.setAttribute("id", "selectedVehicleHighlight");
  highlight.setAttribute("xlink:href", "#vehicleSelection");
  highlight.setAttribute("x", 0);
  highlight.setAttribute("y", 0);
  highlight.setAttribute("transform", target.getAttribute("transform"));
  highlight.setAttribute("pointer-events", "none");
  svgImage.getElementById("mapContents").appendChild(highlight);
  selectedVehicleHighlightElement = highlight;

  if (showDetails) {
    svgMap.refreshScreen();
    showVehicleDialog(target);
  }
  return true;
}

function clearVehicleSelection(){
  selectedVehicleId = "";
  removeVehicleHighlight();
  if (typeof svgMap !== "undefined") {
    svgMap.refreshScreen();
  }
}

function removeVehicleHighlight(){
  if (selectedVehicleElement && typeof selectedVehicleElement.removeAttribute === "function") {
    selectedVehicleElement.removeAttribute("data-selected");
  }
  if (selectedVehicleHighlightElement && selectedVehicleHighlightElement.parentNode) {
    selectedVehicleHighlightElement.parentNode.removeChild(selectedVehicleHighlightElement);
  }
  selectedVehicleElement = null;
  selectedVehicleHighlightElement = null;
}

function renderTripUpdates(entities){
  activeAlerts = [];
  activeTripUpdates = entities.slice().sort(compareTripUpdates);
  const resultList = document.getElementById("resultList");
  if (!activeTripUpdates.length) {
    resultList.innerHTML = '<p class="empty-state">現在、ルート更新情報はありません</p>';
    updateFilterCount(0, 0);
    return;
  }

  resultList.innerHTML = activeTripUpdates.map(function(entity, index){
    const update = entity.tripUpdate || {};
    const trip = update.trip || {};
    const vehicle = update.vehicle || {};
    const routeLabel = trip.routeId ? "路線 " + trip.routeId : "路線不明";
    const tripLabel = trip.tripId || entity.id || "便ID不明";
    const delay = getLargestAbsoluteDelay(update);
    const status = formatTripScheduleRelationship(trip.scheduleRelationship);
    const searchText = [routeLabel, tripLabel, trip.startTime, vehicle.id, status].join(" ");
    return '<details class="data-card" data-kind="trip" data-index="' + index + '" data-search="' + escapeHtml(searchText.toLowerCase()) + '">' +
      '<summary><span class="route-badge">' + escapeHtml(routeLabel) + '</span> ' +
      '<span class="summary-main">' + escapeHtml(trip.startTime || "時刻不明") + ' / ' + escapeHtml(tripLabel) + '</span> ' +
      '<span class="delay-badge ' + getDelayClass(delay) + '">' + escapeHtml(formatDelay(delay)) + '</span></summary>' +
      '<div class="detail-content"></div></details>';
  }).join("");
  filterResultCards();
}

function renderAlerts(entities){
  activeTripUpdates = [];
  activeAlerts = entities.slice();
  const resultList = document.getElementById("resultList");
  if (!activeAlerts.length) {
    resultList.innerHTML = '<p class="empty-state">現在、運行情報はありません</p>';
    updateFilterCount(0, 0);
    return;
  }

  resultList.innerHTML = activeAlerts.map(function(entity, index){
    const alert = entity.alert || {};
    const title = getTranslatedText(alert.headerText) || "運行情報 " + (index + 1);
    const description = getTranslatedText(alert.descriptionText);
    const targets = formatAlertTargets(alert.informedEntities);
    const searchText = [title, description, targets, formatAlertCause(alert.cause), formatAlertEffect(alert.effect)].join(" ");
    return '<details class="data-card alert-card" data-kind="alert" data-index="' + index + '" data-search="' + escapeHtml(searchText.toLowerCase()) + '">' +
      '<summary><span class="alert-severity severity-' + valueOrEmpty(alert.severityLevel) + '">' + escapeHtml(formatAlertSeverity(alert.severityLevel)) + '</span> ' +
      '<span class="summary-main">' + escapeHtml(title) + '</span></summary>' +
      '<div class="detail-content"></div></details>';
  }).join("");
  filterResultCards();
}

function handleResultToggle(event){
  const details = event.target;
  if (!details.open || !details.classList.contains("data-card")) {
    return;
  }
  const content = details.querySelector(".detail-content");
  const index = Number(details.dataset.index);
  if (content.dataset.loaded !== "true") {
    content.innerHTML = details.dataset.kind === "trip" ?
      buildTripUpdateDetails(activeTripUpdates[index]) :
      buildAlertDetails(activeAlerts[index]);
    content.dataset.loaded = "true";
  }
  if (details.dataset.kind === "trip") {
    selectVehicleForTrip(activeTripUpdates[index], content);
  }
}

function buildTripUpdateDetails(entity){
  const update = entity.tripUpdate || {};
  const trip = update.trip || {};
  const vehicle = update.vehicle || {};
  const rows = [
    ["路線ID", trip.routeId],
    ["便ID", trip.tripId],
    ["運行方向ID", valueOrEmpty(trip.directionId)],
    ["始発", [formatStartDate(trip.startDate), trip.startTime].filter(Boolean).join(" ")],
    ["運行状態", formatTripScheduleRelationship(trip.scheduleRelationship)],
    ["車両ID", vehicle.id],
    ["最大予測差", formatDelay(getLargestAbsoluteDelay(update))],
    ["データ時刻", formatDateTime(update.timestamp)]
  ];
  const stopTimeUpdates = update.stopTimeUpdates || [];
  let html = '<p class="vehicle-selection-message">対象車両を確認中…</p>' + buildMetadataTable(rows);
  if (!stopTimeUpdates.length) {
    return html + '<p class="empty-state">停留所更新情報はありません</p>';
  }

  html += '<div class="table-scroll"><table class="stop-table"><thead><tr>' +
    '<th>順</th><th>停留所ID</th><th>到着予測</th><th>出発予測</th><th>状態</th></tr></thead><tbody>';
  for (const stop of stopTimeUpdates) {
    const assignedStopId = stop.stopTimeProperties && stop.stopTimeProperties.assignedStopId;
    const stopId = assignedStopId || stop.stopId || "";
    html += '<tr><td>' + escapeHtml(valueOrEmpty(stop.stopSequence)) + '</td>' +
      '<td>' + escapeHtml(stopId) + '</td>' +
      '<td>' + escapeHtml(formatStopTimeEvent(stop.arrival)) + '</td>' +
      '<td>' + escapeHtml(formatStopTimeEvent(stop.departure)) + '</td>' +
      '<td>' + escapeHtml(formatStopScheduleRelationship(stop.scheduleRelationship)) + '</td></tr>';
  }
  return html + "</tbody></table></div>";
}

function buildAlertDetails(entity){
  const alert = entity.alert || {};
  const description = getTranslatedText(alert.descriptionText);
  const rows = [
    ["有効期間", formatAlertPeriods(alert.activePeriods)],
    ["対象", formatAlertTargets(alert.informedEntities)],
    ["原因", formatAlertCause(alert.cause)],
    ["影響", formatAlertEffect(alert.effect)],
    ["重要度", formatAlertSeverity(alert.severityLevel)]
  ];
  let html = buildMetadataTable(rows);
  if (description) {
    html += '<div class="alert-description">' + escapeHtml(description) + '</div>';
  }

  const urlText = getTranslatedText(alert.url);
  const safeUrl = getSafeHttpUrl(urlText);
  if (safeUrl) {
    html += '<p><a href="' + escapeHtml(safeUrl) + '" target="_blank" rel="noopener">詳細情報を開く</a></p>';
  }
  return html;
}

function buildMetadataTable(rows){
  return '<table class="metadata-table"><tbody>' + rows.filter(function(row){
    return row[1] !== undefined && row[1] !== null && row[1] !== "";
  }).map(function(row){
    return '<tr><th>' + escapeHtml(row[0]) + '</th><td>' + escapeHtml(row[1]) + '</td></tr>';
  }).join("") + "</tbody></table>";
}

function filterResultCards(){
  const query = document.getElementById("resultFilter").value.trim().toLowerCase();
  const cards = document.querySelectorAll("#resultList .data-card");
  let visibleCount = 0;
  for (const card of cards) {
    const visible = !query || (card.getAttribute("data-search") || "").includes(query);
    card.hidden = !visible;
    if (visible) {
      visibleCount++;
    }
  }
  updateFilterCount(visibleCount, cards.length);
}

function updateFilterCount(visibleCount, totalCount){
  setText("filterCount", totalCount ? visibleCount + " / " + totalCount + "件" : "0件");
}

function compareTripUpdates(a, b){
  const aTrip = a.tripUpdate && a.tripUpdate.trip || {};
  const bTrip = b.tripUpdate && b.tripUpdate.trip || {};
  const aKey = [aTrip.routeId || "", aTrip.startTime || "", aTrip.tripId || ""].join("|");
  const bKey = [bTrip.routeId || "", bTrip.startTime || "", bTrip.tripId || ""].join("|");
  return aKey.localeCompare(bKey, "ja", { numeric: true });
}

function getLargestAbsoluteDelay(update){
  const delays = [];
  if (Number.isFinite(update.delay)) {
    delays.push(update.delay);
  }
  for (const stop of update.stopTimeUpdates || []) {
    for (const event of [stop.arrival, stop.departure]) {
      if (event && Number.isFinite(event.delay)) {
        delays.push(event.delay);
      }
    }
  }
  if (!delays.length) {
    return null;
  }
  return delays.reduce(function(result, delay){
    return Math.abs(delay) > Math.abs(result) ? delay : result;
  }, delays[0]);
}

function getDelayClass(delay){
  if (!Number.isFinite(delay) || delay === 0) {
    return "delay-normal";
  }
  return delay > 0 ? "delay-late" : "delay-early";
}

function formatDelay(delay){
  if (!Number.isFinite(delay)) {
    return "予測差不明";
  }
  if (delay === 0) {
    return "定刻";
  }
  const absolute = Math.abs(Math.round(delay));
  const minutes = Math.floor(absolute / 60);
  const seconds = absolute % 60;
  const duration = (minutes ? minutes + "分" : "") + (seconds ? seconds + "秒" : "");
  return (delay > 0 ? "+" : "-") + duration;
}

function formatStopTimeEvent(event){
  if (!event) {
    return "";
  }
  const time = formatTimeOnly(event.time);
  const delay = Number.isFinite(event.delay) ? formatDelay(event.delay) : "";
  return [time, delay ? "(" + delay + ")" : ""].filter(Boolean).join(" ");
}

function formatTripScheduleRelationship(value){
  return ({
    0: "通常運行",
    1: "追加便",
    2: "臨時便",
    3: "運休",
    5: "複製便",
    6: "削除"
  })[value] || "不明";
}

function formatStopScheduleRelationship(value){
  return ({ 0: "通常", 1: "通過", 2: "情報なし", 3: "臨時" })[value] || "不明";
}

function getTranslatedText(translatedString){
  const translations = translatedString && translatedString.translations || [];
  if (!translations.length) {
    return "";
  }
  const japanese = translations.find(function(translation){
    return (translation.language || "").toLowerCase().startsWith("ja");
  });
  const languageNeutral = translations.find(function(translation){ return !translation.language; });
  return (japanese || languageNeutral || translations[0]).text || "";
}

function formatAlertPeriods(periods){
  if (!periods || !periods.length) {
    return "期間指定なし";
  }
  return periods.map(function(period){
    const start = formatDateTime(period.start) || "開始時刻不明";
    const end = formatDateTime(period.end) || "終了時刻未定";
    return start + " ～ " + end;
  }).join(" / ");
}

function formatAlertTargets(selectors){
  if (!selectors || !selectors.length) {
    return "全体";
  }
  return selectors.map(function(selector){
    const trip = selector.trip || {};
    const parts = [];
    if (selector.agencyId) parts.push("事業者 " + selector.agencyId);
    if (selector.routeId) parts.push("路線 " + selector.routeId);
    if (trip.tripId) parts.push("便 " + trip.tripId);
    if (selector.stopId) parts.push("停留所 " + selector.stopId);
    if (selector.directionId !== undefined) parts.push("方向 " + selector.directionId);
    return parts.join(" / ") || "対象指定なし";
  }).join("、");
}

function formatAlertCause(value){
  return ({
    1: "原因不明",
    2: "その他",
    3: "技術的問題",
    4: "ストライキ",
    5: "デモ",
    6: "事故",
    7: "休日",
    8: "気象",
    9: "保守作業",
    10: "工事",
    11: "警察活動",
    12: "救急対応"
  })[value] || "不明";
}

function formatAlertEffect(value){
  return ({
    1: "運休",
    2: "減便",
    3: "大幅な遅延",
    4: "迂回",
    5: "増便",
    6: "運行変更",
    7: "その他",
    8: "影響不明",
    9: "停留所移動",
    10: "影響なし",
    11: "バリアフリー上の問題"
  })[value] || "不明";
}

function formatAlertSeverity(value){
  return ({ 1: "不明", 2: "お知らせ", 3: "注意", 4: "重大" })[value] || "不明";
}

function getSafeHttpUrl(value){
  if (!value) {
    return "";
  }
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:" ? url.href : "";
  } catch (error) {
    return "";
  }
}

function isValidPosition(position){
  return Number.isFinite(position.latitude) &&
    Number.isFinite(position.longitude) &&
    position.latitude >= -90 && position.latitude <= 90 &&
    position.longitude >= -180 && position.longitude <= 180;
}

function getVehicleProperties(entity){
  const vehiclePosition = entity.vehicle || {};
  const descriptor = vehiclePosition.vehicle || {};
  const trip = vehiclePosition.trip || {};
  const position = vehiclePosition.position || {};
  return [
    entity.id,
    descriptor.id,
    descriptor.label,
    descriptor.licensePlate,
    trip.routeId,
    trip.tripId,
    valueOrEmpty(trip.directionId),
    trip.startTime,
    formatStartDate(trip.startDate),
    vehiclePosition.stopId,
    valueOrEmpty(vehiclePosition.currentStopSequence),
    formatVehicleStatus(vehiclePosition.currentStatus),
    formatCongestionLevel(vehiclePosition.congestionLevel),
    formatOccupancy(vehiclePosition.occupancyStatus, vehiclePosition.occupancyPercentage),
    formatWheelchairAccessible(descriptor.wheelchairAccessible),
    position.latitude.toFixed(6),
    position.longitude.toFixed(6),
    formatNumber(position.bearing, 1, "°"),
    Number.isFinite(position.speed) ? (position.speed * 3.6).toFixed(1) : "",
    formatDateTime(vehiclePosition.timestamp)
  ];
}

function getVehicleTitle(entity){
  const vehiclePosition = entity.vehicle || {};
  const descriptor = vehiclePosition.vehicle || {};
  const trip = vehiclePosition.trip || {};
  const vehicleName = descriptor.label || descriptor.id || entity.id || "車両";
  return trip.routeId ? vehicleName + "（路線 " + trip.routeId + "）" : vehicleName;
}

function getVehicleSymbol(vehiclePosition){
  if (vehiclePosition.timestamp && Date.now() / 1000 - vehiclePosition.timestamp > STALE_VEHICLE_SECONDS) {
    return "#busStale";
  }
  if (vehiclePosition.currentStatus === 1) {
    return "#busStopped";
  }
  return "#busMoving";
}

function getDataTimestamp(feed){
  if (feed.header && Number.isFinite(feed.header.timestamp)) {
    return feed.header.timestamp;
  }
  let latestTimestamp = 0;
  for (const entity of feed.entities) {
    const timestamp = entity.vehicle && entity.vehicle.timestamp ||
      entity.tripUpdate && entity.tripUpdate.timestamp;
    if (Number.isFinite(timestamp) && timestamp > latestTimestamp) {
      latestTimestamp = timestamp;
    }
  }
  return latestTimestamp;
}

function showVehicleDialog(target){
  const metaData = target.getAttribute("content") ? svgMap.parseEscapedCsvLine(target.getAttribute("content")) : [];
  const title = target.getAttribute("data-title") || target.getAttribute("xlink:title") || "関東バス車両";
  let message = "<table border='1' style='word-break:break-all;table-layout:fixed;width:100%;border-collapse:collapse;font-size:12px'>";
  message += "<tr><th style='width:40%'>項目</th><th>値</th></tr>";
  message += "<tr><td>名称</td><td>" + escapeHtml(title) + "</td></tr>";

  for (let i = 0; i < VEHICLE_PROPERTIES.length; i++) {
    if (!metaData[i]) {
      continue;
    }
    message += "<tr><td>" + escapeHtml(VEHICLE_PROPERTIES[i]) + "</td><td>" + escapeHtml(metaData[i]) + "</td></tr>";
  }

  message += "</table>";
  svgMap.showModal(message, 420, 620);
}

function handleDataTypeChange(){
  abortCurrentRequest();
  clearRefreshTimer();
  clearVehicleSelection();
  clearResultList();
  document.getElementById("resultFilter").value = "";
  setText("countValue", "-");
  setText("dataTimestamp", "-");
  setText("lastFetched", "-");
  updateDataTypeUi();
  void refreshSelectedData();
}

function updateDataTypeUi(){
  const dataType = getSelectedDataType();
  const source = KANTO_BUS_DATA_SOURCES[dataType];
  const isVehicle = dataType === "vehicle";
  setText("countLabel", source.countLabel);
  document.getElementById("selectedCountRow").hidden = isVehicle;
  document.getElementById("selectedDataTimestampRow").hidden = isVehicle;
  document.getElementById("listTools").hidden = isVehicle;
  document.getElementById("resultList").hidden = isVehicle;
  document.getElementById("resultFilter").placeholder = dataType === "trip" ?
    "路線ID・便ID・車両IDで絞り込み" : "運行情報を絞り込み";
  setText("displayHint", isVehicle ?
    "車両位置を地図上で常時更新します。" :
    "車両位置を地図上で常時更新し、" + source.label + "をこの画面の一覧に表示します。");
}

function getSelectedDataType(){
  const value = document.getElementById("dataTypeSelect").value;
  return KANTO_BUS_DATA_SOURCES[value] ? value : "vehicle";
}

function scheduleRefresh(){
  clearRefreshTimer();
  refreshTimer = window.setTimeout(refreshSelectedData, KANTO_BUS_REFRESH_INTERVAL);
}

function clearRefreshTimer(){
  if (refreshTimer !== null) {
    window.clearTimeout(refreshTimer);
    refreshTimer = null;
  }
}

function abortCurrentRequest(){
  if (currentRequest) {
    currentRequest.abort();
    currentRequest = null;
  }
}

function shutdownKantoBusLayer(){
  clearRefreshTimer();
  abortCurrentRequest();
}

function clearMapContents(){
  if (typeof svgImage === "undefined") {
    return;
  }
  removeChildren(svgImage.getElementById("mapContents"));
  vehicleElementsById = new Map();
  selectedVehicleElement = null;
  selectedVehicleHighlightElement = null;
  svgImage.documentElement.setAttribute("property", "");
  if (typeof svgMap !== "undefined") {
    svgMap.refreshScreen();
  }
}

function clearResultList(){
  activeTripUpdates = [];
  activeAlerts = [];
  const resultList = document.getElementById("resultList");
  if (resultList) {
    resultList.innerHTML = "";
  }
  updateFilterCount(0, 0);
}

function setLoadingState(isLoading){
  document.getElementById("refreshButton").disabled = isLoading;
  document.getElementById("dataTypeSelect").disabled = isLoading;
}

function setStatus(message, isError){
  const element = document.getElementById("statusMessage");
  element.textContent = message;
  element.classList.toggle("error", isError);
}

function setText(id, value){
  document.getElementById(id).textContent = value;
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

function escapeHtml(value){
  return String(value == null ? "" : value).replace(/[&<>"']/g, function(character){
    return {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    }[character];
  });
}

function removeChildren(element){
  while (element && element.firstChild) {
    element.removeChild(element.firstChild);
  }
}

function valueOrEmpty(value){
  return value === undefined || value === null ? "" : String(value);
}

function formatNumber(value, digits, suffix){
  return Number.isFinite(value) ? value.toFixed(digits) + suffix : "";
}

function formatStartDate(value){
  if (typeof value === "string" && /^\d{8}$/.test(value)) {
    return value.slice(0, 4) + "/" + value.slice(4, 6) + "/" + value.slice(6, 8);
  }
  return value || "";
}

function formatDateTime(timestamp){
  if (!Number.isFinite(timestamp) || timestamp <= 0) {
    return "";
  }
  return new Date(timestamp * 1000).toLocaleString("ja-JP");
}

function formatTimeOnly(timestamp){
  if (!Number.isFinite(timestamp) || timestamp <= 0) {
    return "";
  }
  return new Date(timestamp * 1000).toLocaleTimeString("ja-JP", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit"
  });
}

function formatVehicleStatus(status){
  return ({ 0: "停留所に接近中", 1: "停車中", 2: "次の停留所へ移動中" })[status] || "不明";
}

function formatCongestionLevel(level){
  return ({
    0: "不明",
    1: "順調",
    2: "断続的な渋滞",
    3: "渋滞",
    4: "激しい渋滞"
  })[level] || "不明";
}

function formatOccupancy(status, percentage){
  const label = ({
    0: "空席",
    1: "空席多数",
    2: "空席わずか",
    3: "立席あり",
    4: "混雑",
    5: "満員",
    6: "乗車不可",
    7: "情報なし",
    8: "乗車対象外"
  })[status];
  if (Number.isFinite(percentage)) {
    return (label ? label + " / " : "") + percentage + "%";
  }
  return label || "不明";
}

function formatWheelchairAccessible(status){
  return ({ 0: "情報なし", 1: "対応", 2: "非対応" })[status] || "情報なし";
}