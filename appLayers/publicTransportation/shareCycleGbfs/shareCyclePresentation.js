// License: (MPL v2)
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.

import { STATUS_CATEGORY, parseGbfsTimestamp } from "./gbfsUtils.js";

const STATION_METADATA_FIELDS = Object.freeze([
  ["stationId", "ステーションID", (station) => station.id],
  ["name", "名称", (station) => station.name],
  ["address", "住所", (station) => station.address],
  ["capacity", "収容台数", (station) => station.capacity ?? ""],
  ["sourceName", "提供元", (_station, provider) => provider.sourceName],
  ["systemId", "システムID", (_station, provider) => provider.systemId]
]);

export const PROPERTY_SCHEMA = Object.freeze(
  STATION_METADATA_FIELDS.map(([, property]) => property)
);

export const META_INDEX = Object.freeze(
  Object.fromEntries(
    STATION_METADATA_FIELDS.map(([key], index) => [key, index])
  )
);

export const STATUS_COLORS = Object.freeze([
  Object.freeze([220, 38, 38]),
  Object.freeze([245, 158, 11]),
  Object.freeze([22, 163, 74]),
  Object.freeze([107, 114, 128]),
  Object.freeze([37, 99, 235])
]);

export const STATION_DETAIL_SIZE = Object.freeze({ width: 480, height: 620 });

const DATE_TIME_FORMATTER = new Intl.DateTimeFormat("ja-JP", {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit"
});

export function createQtctRecord(station, provider) {
  const metadata = STATION_METADATA_FIELDS.map(([, , getValue]) =>
    getValue(station, provider)
  );
  return [station.lon, station.lat, ...metadata];
}

export function getMetadataStationId(metadata) {
  return String(metadata?.[META_INDEX.stationId] ?? "");
}

export function createStationTitle(metadata, statusesById) {
  const stationId = getMetadataStationId(metadata);
  const name = String(metadata?.[META_INDEX.name] || stationId);
  const status = statusesById.get(stationId);
  const availability = Number.isFinite(status?.available)
    ? `利用可能 ${status.available}台`
    : "空き状況不明";
  return `${name}（${availability}）`;
}

export function createStationPoi({ svgImage, iconId, metadata }) {
  const marker = svgImage.createElement("circle");
  const parsedColorIndex = Number(String(iconId).replace(/^p/, ""));
  const color = STATUS_COLORS[parsedColorIndex] || STATUS_COLORS[STATUS_CATEGORY.UNKNOWN];
  setAttributes(marker, {
    cx: 0,
    cy: 0,
    r: 7,
    fill: `rgb(${color.join(",")})`,
    stroke: "#ffffff",
    "stroke-width": 2,
    class: "clickable",
    "data-station-id": getMetadataStationId(metadata)
  });
  return marker;
}

export function resolveStationId(target) {
  const elementStationId = String(target?.getAttribute("data-station-id") || "");
  if (elementStationId) {
    return elementStationId;
  }
  const content = String(target?.getAttribute("content") || "");
  return content.split(",")[0];
}

export function buildStationDetailHtml(station, status, provider) {
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
  return `
    <div style="font-family:sans-serif;font-size:13px">
      <table style="width:100%;border-collapse:collapse" border="1">${tableRows}</table>
      ${detailLink}
      <p style="color:#555">空き状況は遅延することがあります。データの正確性・完全性・継続提供は保証されません。</p>
    </div>`;
}

export function formatDateTime(date) {
  return DATE_TIME_FORMATTER.format(date);
}

export function isDrawableStation(station) {
  return Boolean(
    station.id &&
      Number.isFinite(station.lat) &&
      Number.isFinite(station.lon) &&
      station.lat >= -90 &&
      station.lat <= 90 &&
      station.lon >= -180 &&
      station.lon <= 180
  );
}

export function applyStatusColorVariables(document) {
  const rootStyle = document.documentElement.style;
  const colorVariables = {
    "--status-empty": STATUS_CATEGORY.EMPTY,
    "--status-low": STATUS_CATEGORY.LOW,
    "--status-available": STATUS_CATEGORY.AVAILABLE,
    "--status-unavailable": STATUS_CATEGORY.UNAVAILABLE,
    "--status-unknown": STATUS_CATEGORY.UNKNOWN
  };
  for (const [variable, colorIndex] of Object.entries(colorVariables)) {
    rootStyle.setProperty(variable, `rgb(${STATUS_COLORS[colorIndex].join(",")})`);
  }
}

export function isHttpUrl(value) {
  return /^https?:\/\//i.test(String(value || ""));
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

function setAttributes(element, attributes) {
  for (const [name, value] of Object.entries(attributes)) {
    element.setAttribute(name, value);
  }
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
