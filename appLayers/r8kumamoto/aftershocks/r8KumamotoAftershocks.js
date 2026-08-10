// License: MPL-2.0

import {
  JMA_FEED_URL,
  MAIN_SHOCK,
  intensityColor,
  isAllowedJmaDataUrl,
  isKumamotoSequenceEvent,
  parseAtomFeed,
  parseJmaEarthquake
} from "./jmaEarthquakeData.js";

const ui = {
  refresh: document.getElementById("refreshButton"),
  status: document.getElementById("statusMessage"),
  feedUpdated: document.getElementById("feedUpdated"),
  eventCount: document.getElementById("eventCount")
};

let initialized = false;
let svgMap;
let svgImage;
let svgImageProps;
let layerID;
let events = [MAIN_SHOCK];
let activeController;

window.addEventListener("layerWebAppReady", initializeLayer);
window.addEventListener("beforeunload", () => activeController?.abort());

async function initializeLayer() {
  if (initialized) return;
  initialized = true;
  ({ svgMap, svgImage, svgImageProps, layerID } = window);
  ui.refresh.addEventListener("click", () => void loadFeed());
  configureDetails();
  drawEvents();
  await loadFeed();
}

function configureDetails() {
  svgMap.setShowPoiProperty((target) => {
    const eventId = target?.getAttribute("data-event-id");
    const originTime = (target?.getAttribute("content") ?? "").split(",")[0];
    const event = events.find((item) => item.id === eventId || item.originTime === originTime);
    if (!event) return;
    const rows = [
      ["発生時刻", formatDate(event.originTime)], ["震央地名", event.areaName],
      ["マグニチュード", event.magnitude], ["最大震度", event.maxIntensity],
      ["深さ", `${event.depthKm} km`], ["区分", event.kind === "main" ? "本震" : "公開フィード内の地震"]
    ].map(([label, value]) => `<tr><th>${label}</th><td>${escapeHtml(value)}</td></tr>`).join("");
    const source = event.sourceUrl ? `<p><a href="${escapeHtml(event.sourceUrl)}" target="_blank" rel="noopener noreferrer">気象庁原文</a></p>` : "";
    svgMap.showModal(`<table border="1" style="border-collapse:collapse;width:100%">${rows}</table>${source}`, 470, 310);
  }, layerID);
  svgImageProps.isClickable = { value: true, hilightStrokeStyle: { stroke: "#fde047", "stroke-width": 5 } };
}

async function loadFeed() {
  activeController?.abort();
  const controller = new AbortController();
  activeController = controller;
  ui.refresh.disabled = true;
  setStatus("気象庁フィードを取得しています", "");
  try {
    const response = await fetch(svgMap.getCORSURL(JMA_FEED_URL), { cache: "no-store", signal: controller.signal });
    if (!response.ok) throw new Error(`フィード: HTTP ${response.status}`);
    const xml = await response.text();
    const document = new DOMParser().parseFromString(xml, "application/xml");
    ui.feedUpdated.textContent = document.getElementsByTagNameNS("*", "updated")[0]?.textContent?.trim() ?? "不明";
    const entries = parseAtomFeed(xml).slice(0, 30);
    const settled = await Promise.allSettled(entries.map(async (entry) => {
      if (!isAllowedJmaDataUrl(entry.id)) throw new Error("許可されていないURLです");
      const detail = await fetch(svgMap.getCORSURL(entry.id), { cache: "no-store", signal: controller.signal });
      if (!detail.ok) throw new Error(`地震情報: HTTP ${detail.status}`);
      return parseJmaEarthquake(await detail.text(), entry.id);
    }));
    const latest = settled
      .filter((result) => result.status === "fulfilled")
      .map((result) => result.value)
      .filter(isKumamotoSequenceEvent);
    events = [MAIN_SHOCK, ...deduplicate(latest)];
    drawEvents();
    const failed = settled.filter((result) => result.status === "rejected").length;
    setStatus(`フィード内${entries.length}件を確認し、熊本周辺${latest.length}件を抽出しました${failed ? `（詳細取得失敗 ${failed}件）` : ""}`, failed ? "warning" : "");
  } catch (error) {
    if (error?.name === "AbortError") return;
    console.error(error);
    events = [MAIN_SHOCK];
    drawEvents();
    setStatus(`フィード取得に失敗したため本震のみ表示しています: ${error.message}`, "error");
  } finally {
    if (activeController === controller) activeController = null;
    ui.refresh.disabled = false;
  }
}

function drawEvents() {
  const fragment = svgImage.createDocumentFragment();
  for (const event of events) {
    const circle = svgImage.createElement("circle");
    circle.setAttribute("cx", "0");
    circle.setAttribute("cy", "0");
    circle.setAttribute("r", String(Math.max(5, Math.min(20, event.magnitude * 2.2))));
    circle.setAttribute("transform", `ref(svg,${event.lon * 100},${-event.lat * 100})`);
    circle.setAttribute("fill", intensityColor(event.maxIntensity));
    circle.setAttribute("fill-opacity", event.kind === "main" ? "0.95" : "0.78");
    circle.setAttribute("stroke", event.kind === "main" ? "#111827" : "#ffffff");
    circle.setAttribute("stroke-width", event.kind === "main" ? "3" : "1.5");
    circle.setAttribute("data-event-id", event.id);
    circle.setAttribute("content", `${event.originTime},${event.areaName},${event.magnitude},${event.maxIntensity},${event.depthKm},${event.kind === "main" ? "本震" : "フィード"},気象庁`);
    fragment.appendChild(circle);
  }
  svgImage.getElementById("earthquakePoints").replaceChildren(fragment);
  ui.eventCount.textContent = events.length.toLocaleString("ja-JP");
  svgMap.refreshScreen();
}

function deduplicate(items) {
  const seen = new Set();
  return items.filter((item) => {
    const key = `${item.originTime}:${item.lat}:${item.lon}:${item.magnitude}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function formatDate(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString("ja-JP");
}

function setStatus(message, type) {
  ui.status.textContent = message;
  ui.status.className = `status${type ? ` ${type}` : ""}`;
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]));
}
