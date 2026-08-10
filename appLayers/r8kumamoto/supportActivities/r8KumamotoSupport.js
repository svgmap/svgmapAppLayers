// License: MPL-2.0

import {
  FALLBACK_ACTIVITIES,
  SUPPORT_SOURCE_URL,
  groupActivitiesByPlace,
  parseSupportActivities
} from "./supportActivityData.js";

const COLORS = {
  "給水・物資": "#2563eb",
  "入浴": "#0891b2",
  "トイレ": "#7c3aed",
  "電源・照明": "#d97706",
  "復旧": "#dc2626"
};

const ui = {
  refresh: document.getElementById("refreshButton"),
  status: document.getElementById("statusMessage"),
  fetchedAt: document.getElementById("fetchedAt"),
  activityCount: document.getElementById("activityCount"),
  placeCount: document.getElementById("placeCount"),
  toggles: [...document.querySelectorAll(".typeToggle")]
};

let initialized = false;
let svgMap;
let svgImage;
let svgImageProps;
let layerID;
let groups = [];
let activeController;

window.addEventListener("layerWebAppReady", initializeLayer);
window.addEventListener("beforeunload", () => activeController?.abort());

async function initializeLayer() {
  if (initialized) return;
  initialized = true;
  ({ svgMap, svgImage, svgImageProps, layerID } = window);
  ui.refresh.addEventListener("click", () => void loadActivities());
  ui.toggles.forEach((toggle) => toggle.addEventListener("change", drawGroups));
  configureDetails();
  await loadActivities();
}

function configureDetails() {
  svgMap.setShowPoiProperty((target) => {
    const placeId = target?.getAttribute("data-place-id");
    const placeName = (target?.getAttribute("content") ?? "").split(",")[0];
    const group = groups.find((item) => item.placeId === placeId || item.placeName === placeName);
    if (!group) return;
    const items = group.activities.map((activity) =>
      `<li><b>${escapeHtml(activity.date)}</b> ${escapeHtml(activity.title)}<br><a href="${escapeHtml(activity.url)}" target="_blank" rel="noopener noreferrer">原文</a></li>`
    ).join("");
    svgMap.showModal(`<h3>${escapeHtml(group.placeName)}</h3><ul>${items}</ul>`, 520, 360);
  }, layerID);
  svgImageProps.isClickable = { value: true, hilightStrokeStyle: { stroke: "#facc15", "stroke-width": 5 } };
}

async function loadActivities() {
  activeController?.abort();
  const controller = new AbortController();
  activeController = controller;
  ui.refresh.disabled = true;
  setStatus("九州地方整備局の対応状況を取得しています", "");
  try {
    const response = await fetch(svgMap.getCORSURL(SUPPORT_SOURCE_URL), { cache: "no-store", signal: controller.signal });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const contentType = response.headers.get("content-type") ?? "";
    if (contentType && !contentType.includes("html") && !contentType.includes("text/plain")) throw new Error("HTMLではない応答です");
    const parsed = parseSupportActivities(await response.text());
    if (!parsed.length) throw new Error("地図化できる活動が見つかりません");
    applyActivities(parsed, false);
  } catch (error) {
    if (error?.name === "AbortError") return;
    console.error(error);
    applyActivities(FALLBACK_ACTIVITIES, true);
    setStatus(`最新情報の取得に失敗したため、2026-08-05確認時の内蔵データを表示しています（${error.message}）`, "warning");
  } finally {
    if (activeController === controller) activeController = null;
    ui.refresh.disabled = false;
  }
}

function applyActivities(activities, fallback) {
  groups = groupActivitiesByPlace(activities);
  ui.activityCount.textContent = activities.length.toLocaleString("ja-JP");
  ui.placeCount.textContent = groups.length.toLocaleString("ja-JP");
  ui.fetchedAt.textContent = new Date().toLocaleString("ja-JP");
  drawGroups();
  if (!fallback) setStatus(`${activities.length}件の活動を${groups.length}地点にまとめて表示しました`, "");
}

function drawGroups() {
  const enabled = new Set(ui.toggles.filter((toggle) => toggle.checked).map((toggle) => toggle.value));
  const fragment = svgImage.createDocumentFragment();
  for (const group of groups) {
    const visibleTypes = group.types.filter((type) => enabled.has(type));
    if (!visibleTypes.length) continue;
    const circle = svgImage.createElement("circle");
    circle.setAttribute("cx", "0");
    circle.setAttribute("cy", "0");
    circle.setAttribute("r", String(7 + Math.min(7, group.activities.length)));
    circle.setAttribute("transform", `ref(svg,${group.lon * 100},${-group.lat * 100})`);
    circle.setAttribute("fill", COLORS[visibleTypes[0]] ?? "#475569");
    circle.setAttribute("fill-opacity", "0.88");
    circle.setAttribute("stroke", "#ffffff");
    circle.setAttribute("stroke-width", "2");
    circle.setAttribute("data-place-id", group.placeId);
    circle.setAttribute("content", `${group.placeName},${group.types.join("・")},${group.activities.length},${group.latestDate},${group.activities[0]?.title ?? ""},九州地方整備局`);
    fragment.appendChild(circle);
  }
  svgImage.getElementById("supportPoints").replaceChildren(fragment);
  svgMap.refreshScreen();
}

function setStatus(message, type) {
  ui.status.textContent = message;
  ui.status.className = `status${type ? ` ${type}` : ""}`;
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]));
}
