// License: MPL-2.0
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.

export const LAYER_KEYS = Object.freeze({
  ROAD: "road",
  ETC: "etc",
  TRAVEL: "travel"
});

export const ROAD_PROPERTY_SCHEMA = Object.freeze([
  "名称",
  "県名",
  "市町村名",
  "道路種別",
  "路線名",
  "始点",
  "終点",
  "規制種別",
  "規制理由",
  "規制開始日時",
  "規制内容",
  "規制方向",
  "規制延長(km)"
]);

const DEFAULT_STYLE = Object.freeze({
  road: { color: "#777777", opacity: 0.85, weight: 6, dashArray: "" },
  etc: { color: "#0000ff", opacity: 1, weight: 4, dashArray: "" },
  travel: { color: "#c0504d", opacity: 1, weight: 4, dashArray: "" }
});
const MAX_INVALID_RATIO = 0.25;
const YIELD_EVERY = 1500;

export function classifyArchiveEntryName(entryName) {
  const normalized = String(entryName || "").replaceAll("\\", "/");
  const basename = normalized.split("/").pop() || "";
  if (!basename || basename.startsWith(".")) return null;
  if (/^dourokisei\.geojson$/i.test(basename)) return LAYER_KEYS.ROAD;
  if (/^ETC2\.0_speed_data\d*\.geojson$/i.test(basename)) return LAYER_KEYS.ETC;
  if (/^tukoujisseki\.geojson$/i.test(basename)) return LAYER_KEYS.TRAVEL;
  return null;
}

export function groupArchiveEntryNames(entryNames) {
  const grouped = { road: [], etc: [], travel: [], ignored: [] };
  for (const entryName of entryNames) {
    const layer = classifyArchiveEntryName(entryName);
    if (layer) grouped[layer].push(entryName);
    else grouped.ignored.push(entryName);
  }
  grouped.road.sort();
  grouped.etc.sort();
  grouped.travel.sort();
  return grouped;
}

export function validateLineStringFeature(feature) {
  if (!feature || feature.type !== "Feature") return false;
  if (!feature.geometry || feature.geometry.type !== "LineString") return false;
  const coordinates = feature.geometry.coordinates;
  if (!Array.isArray(coordinates) || coordinates.length < 2) return false;
  return coordinates.every((coordinate) => {
    if (!Array.isArray(coordinate) || coordinate.length < 2) return false;
    const longitude = coordinate[0];
    const latitude = coordinate[1];
    return (
      typeof longitude === "number" &&
      typeof latitude === "number" &&
      Number.isFinite(longitude) &&
      Number.isFinite(latitude) &&
      longitude >= -180 &&
      longitude <= 180 &&
      latitude >= -90 &&
      latitude <= 90
    );
  });
}

export async function prepareFeatureCollection(documents, layerKey, options = {}) {
  const docs = Array.isArray(documents) ? documents : [documents];
  const sourceFeatures = [];
  for (const document of docs) {
    if (!document || document.type !== "FeatureCollection" || !Array.isArray(document.features)) {
      throw new Error("GeoJSONがFeatureCollectionではありません");
    }
    for (const feature of document.features) sourceFeatures.push(feature);
  }

  const originalCount = sourceFeatures.length;
  const features = [];
  const fingerprintBuckets = new Map();
  let invalidCount = 0;
  let duplicateCount = 0;

  for (let index = 0; index < sourceFeatures.length; index++) {
    if (options.signal?.aborted) throw abortError();
    const feature = sourceFeatures[index];
    if (!validateLineStringFeature(feature)) {
      invalidCount++;
    } else {
      const canonical = canonicalFeatureString(feature);
      const fingerprint = fingerprintString(canonical);
      const bucket = fingerprintBuckets.get(fingerprint);
      let duplicate = false;
      if (bucket) {
        duplicate = bucket.some((candidate) => canonicalFeatureString(candidate) === canonical);
      }
      if (duplicate) {
        duplicateCount++;
      } else {
        if (bucket) bucket.push(feature);
        else fingerprintBuckets.set(fingerprint, [feature]);
        features.push(normalizeFeature(feature, layerKey));
      }
    }

    if (typeof options.onProgress === "function" && index % YIELD_EVERY === 0) {
      options.onProgress(index, originalCount);
    }
    if (options.cooperative !== false && index > 0 && index % YIELD_EVERY === 0) {
      await yieldToBrowser();
    }
  }

  if (originalCount > 0 && invalidCount / originalCount > MAX_INVALID_RATIO) {
    throw new Error(
      `不正Featureが多すぎます（${invalidCount}/${originalCount}件）`
    );
  }

  return {
    type: "FeatureCollection",
    features,
    stats: {
      originalCount,
      validCount: originalCount - invalidCount,
      uniqueCount: features.length,
      duplicateCount,
      invalidCount
    }
  };
}

export function normalizeRoadProperties(properties = {}) {
  return {
    名称: cleanText(properties.name),
    県名: cleanText(properties["県名"]),
    市町村名: cleanText(properties["市町村名"]),
    道路種別: cleanText(properties["道路種別"]),
    路線名: cleanText(properties["路線名"]),
    始点: cleanText(properties["始点住所"] ?? properties["始点"]),
    終点: cleanText(properties["終点住所"] ?? properties["終点"]),
    規制種別: cleanText(properties["規制種別"]),
    規制理由: cleanText(properties["規制理由"]),
    規制開始日時: cleanText(properties["規制開始_日時"]),
    規制内容: cleanText(properties["規制開始_内容"] ?? properties["規制内容"]),
    規制方向: cleanText(properties["規制方向"]),
    "規制延長(km)": cleanText(properties["規制延長_Km"] ?? properties["延長_Km"])
  };
}

export function sanitizeStyle(properties = {}, layerKey = LAYER_KEYS.ROAD) {
  const fallback = DEFAULT_STYLE[layerKey] || DEFAULT_STYLE.road;
  return {
    color: sanitizeColor(properties._color, fallback.color),
    opacity: boundedNumber(properties._opacity, 0, 1, fallback.opacity),
    weight: boundedNumber(properties._weight, 0.5, 20, fallback.weight),
    dashArray: sanitizeDashArray(properties._dashArray)
  };
}

export function featureBounds(feature) {
  const bounds = [Infinity, Infinity, -Infinity, -Infinity];
  for (const coordinate of feature.geometry.coordinates) {
    const longitude = Number(coordinate[0]);
    const latitude = Number(coordinate[1]);
    bounds[0] = Math.min(bounds[0], longitude);
    bounds[1] = Math.min(bounds[1], latitude);
    bounds[2] = Math.max(bounds[2], longitude);
    bounds[3] = Math.max(bounds[3], latitude);
  }
  return bounds;
}

export function metadataValues(feature) {
  return ROAD_PROPERTY_SCHEMA.map((key) => String(feature.properties?.[key] ?? ""));
}

export function encodeSvgMapMetadata(values) {
  return values
    .map((value) =>
      String(value ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&apos;")
        .replaceAll(",", "&#x2c;")
    )
    .join(",");
}

function normalizeFeature(feature, layerKey) {
  const style = sanitizeStyle(feature.properties, layerKey);
  const properties =
    layerKey === LAYER_KEYS.ROAD
      ? { ...normalizeRoadProperties(feature.properties), _style: style }
      : { _style: style };
  const coordinates = feature.geometry.coordinates.map((coordinate) => [
    Number(coordinate[0]),
    Number(coordinate[1])
  ]);
  const normalized = {
    type: "Feature",
    geometry: { type: "LineString", coordinates },
    properties
  };
  normalized.bbox = featureBounds(normalized);
  return normalized;
}

function canonicalFeatureString(feature) {
  return JSON.stringify([sortObject(feature.geometry), sortObject(feature.properties || {})]);
}

function sortObject(value) {
  if (Array.isArray(value)) return value.map(sortObject);
  if (!value || typeof value !== "object") return value;
  const sorted = {};
  for (const key of Object.keys(value).sort()) sorted[key] = sortObject(value[key]);
  return sorted;
}

function fingerprintString(value) {
  let hash1 = 2166136261;
  let hash2 = 0x9e3779b9;
  for (let index = 0; index < value.length; index++) {
    const code = value.charCodeAt(index);
    hash1 ^= code;
    hash1 = Math.imul(hash1, 16777619);
    hash2 ^= code + Math.imul(hash2, 33);
  }
  return `${value.length}:${hash1 >>> 0}:${hash2 >>> 0}`;
}

function sanitizeColor(value, fallback) {
  const color = String(value || "").trim();
  return /^#(?:[0-9a-f]{3}|[0-9a-f]{4}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(color)
    ? color
    : fallback;
}

function sanitizeDashArray(value) {
  const dashArray = String(value || "").trim();
  if (!dashArray) return "";
  if (!/^[0-9., ]{1,64}$/.test(dashArray)) return "";
  const parts = dashArray.split(/[ ,]+/).filter(Boolean).map(Number);
  return parts.length && parts.every((part) => Number.isFinite(part) && part >= 0)
    ? parts.join(" ")
    : "";
}

function boundedNumber(value, minimum, maximum, fallback) {
  if (value === null || value === undefined || value === "") return fallback;
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.min(maximum, Math.max(minimum, number));
}

function cleanText(value) {
  if (value === null || value === undefined) return "";
  return String(value).trim();
}

function yieldToBrowser() {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

function abortError() {
  if (typeof DOMException === "function") return new DOMException("Aborted", "AbortError");
  const error = new Error("Aborted");
  error.name = "AbortError";
  return error;
}
