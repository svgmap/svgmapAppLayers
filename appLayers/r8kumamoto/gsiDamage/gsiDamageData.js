// License: (MPL v2)
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.

export const GSI_SOURCE_PAGE = "https://www.gsi.go.jp/BOUSAI/20260728_kumamoto_earthquake.html";
const MAX_DISCOVERED_LAYERS = 24;
const DEFAULT_BOUNDS = Object.freeze({ west: 130.0, east: 131.4, south: 32.0, north: 33.3 });

export const GSI_LAYERS = Object.freeze([
  {
    id: "20260729kumamoto_kumamoto1_0803do",
    kind: "raster",
    title: "正射画像 熊本1地区（8/3撮影）",
    url: "https://maps.gsi.go.jp/xyz/20260729kumamoto_kumamoto1_0803do/{z}/{x}/{y}.png",
    minZoom: 10,
    maxZoom: 18,
    center: { lat: 32.833443, lng: 130.770264 },
    bounds: { west: 130.48, east: 131.0, south: 32.48, north: 32.98 },
    updated: "2026-08-03"
  },
  {
    id: "20260729kumamoto_kumamoto2_0729_0802do",
    kind: "raster",
    title: "正射画像 熊本2地区（7/29・8/2撮影）",
    url: "https://maps.gsi.go.jp/xyz/20260729kumamoto_kumamoto2_0729_0802do/{z}/{x}/{y}.png",
    minZoom: 10,
    maxZoom: 18,
    center: { lat: 32.759562, lng: 130.726318 },
    bounds: { west: 130.48, east: 131.0, south: 32.48, north: 32.98 },
    updated: "2026-08-02"
  },
  {
    id: "20260729kumamoto_kumamoto3_0731_0801do",
    kind: "raster",
    title: "正射画像 熊本3地区（7/31・8/1撮影）",
    url: "https://maps.gsi.go.jp/xyz/20260729kumamoto_kumamoto3_0731_0801do/{z}/{x}/{y}.png",
    minZoom: 10,
    maxZoom: 18,
    center: { lat: 32.687643, lng: 130.702286 },
    bounds: { west: 130.52, east: 130.84, south: 32.54, north: 32.84 },
    updated: "2026-08-01"
  },
  {
    id: "20260729kumamoto_kumamoto4_0730do",
    kind: "raster",
    title: "正射画像 熊本4地区（7/30撮影）",
    url: "https://maps.gsi.go.jp/xyz/20260729kumamoto_kumamoto4_0730do/{z}/{x}/{y}.png",
    minZoom: 10,
    maxZoom: 18,
    center: { lat: 32.611616, lng: 130.6604 },
    bounds: { west: 130.48, east: 131.0, south: 32.48, north: 32.98 },
    updated: "2026-07-30"
  },
  {
    id: "20260729kumamoto_yatsushiro_0729do",
    kind: "raster",
    title: "正射画像 八代地区（7/29撮影）",
    url: "https://maps.gsi.go.jp/xyz/20260729kumamoto_yatsushiro_0729do/{z}/{x}/{y}.png",
    minZoom: 10,
    maxZoom: 18,
    center: { lat: 32.44532, lng: 130.584183 },
    bounds: { west: 130.42, east: 130.78, south: 32.22, north: 32.63 },
    updated: "2026-07-29"
  },
  {
    id: "20260729kumamoto_yatsushiro_0729do_sokuho",
    kind: "raster",
    title: "正射画像 八代地区（7/29撮影・速報）",
    url: "https://maps.gsi.go.jp/xyz/20260729kumamoto_yatsushiro_0729do_sokuho/{z}/{x}/{y}.png",
    minZoom: 10,
    maxZoom: 18,
    center: { lat: 32.42634, lng: 130.57251 },
    bounds: { west: 130.42, east: 130.78, south: 32.22, north: 32.63 },
    updated: "2026-07-29"
  }
]);

export function getLayer(id, layers = GSI_LAYERS) {
  return layers.find((layer) => layer.id === id) ?? null;
}

export function isAllowedGsiUrl(value) {
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || url.origin !== "https://maps.gsi.go.jp") return false;
    const match = decodeURIComponent(url.pathname).match(/^\/xyz\/([^/]+)\/([^/]+)\/([^/]+)\/([^/]+)$/);
    if (!match || classifyLayerId(match[1]) !== "raster") return false;
    const [, , zoom, x, file] = match;
    const templateOrNumber = (part, token) => part === `{${token}}` || /^\d+$/.test(part);
    if (!templateOrNumber(zoom, "z") || !templateOrNumber(x, "x")) return false;
    if (/^\{y\}\.(?:png|jpg|jpeg|webp)$/i.test(file)) return true;
    return /^\d+\.(?:png|jpg|jpeg|webp)$/i.test(file);
  } catch {
    return false;
  }
}

export function parseGsiDamagePage(html) {
  if (typeof html !== "string" || !html.trim()) throw new Error("国土地理院の掲載ページが空です");
  const document = new DOMParser().parseFromString(html, "text/html");
  const discovered = [];
  const seen = new Set();
  let sourceOrder = 0;

  for (const anchor of document.querySelectorAll("a[href]")) {
    const mapInfo = parseGsiMapLink(anchor.getAttribute("href"));
    if (!mapInfo) continue;
    const container = anchor.closest(".base_txt") || anchor.parentElement;
    const lines = textBeforeNode(container, anchor)
      .split(/\n+/)
      .map((line) => line.replace(/\s+/g, " ").trim())
      .filter(Boolean);
    const contextLine = lines.at(-1) || "";
    for (const layerId of mapInfo.layerIds) {
      if (seen.has(layerId) || !isAllowedLayerId(layerId)) continue;
      const kind = classifyLayerId(layerId);
      if (kind !== "raster") continue;
      seen.add(layerId);
      sourceOrder += 1;
      const district = parseDistrict(contextLine) || districtFromLayerId(layerId);
      const shootingDates = parseShootingDates(contextLine, layerId.slice(0, 4));
      const updated = shootingDates.at(-1) || layerId.slice(0, 8).replace(/^(\d{4})(\d{2})(\d{2})$/, "$1-$2-$3");
      discovered.push(Object.freeze({
        id: layerId,
        kind,
        title: rasterTitle(district, shootingDates, layerId),
        url: `https://maps.gsi.go.jp/xyz/${layerId}/{z}/{x}/{y}.png`,
        minZoom: 10,
        maxZoom: 18,
        center: mapInfo.center,
        bounds: boundsForLayer(layerId),
        updated,
        sourceOrder
      }));
      if (discovered.length > MAX_DISCOVERED_LAYERS) throw new Error("掲載レイヤー数が想定上限を超えています");
    }
  }

  if (!discovered.length) throw new Error("正射画像レイヤーが掲載ページに見つかりません");
  const newestFirst = (left, right) =>
    String(right.updated).localeCompare(String(left.updated)) || right.sourceOrder - left.sourceOrder;
  return Object.freeze(discovered.sort(newestFirst));
}

export function chooseZoom(scale, minZoom, maxZoom) {
  const numericScale = Number(scale);
  const raw = Number.isFinite(numericScale) && numericScale > 0
    ? Math.floor(Math.log2(numericScale) + 7.5)
    : minZoom;
  return Math.max(minZoom, Math.min(maxZoom, raw));
}

export function tileBounds(x, y, zoom) {
  const count = 2 ** zoom;
  const west = x / count * 360 - 180;
  const east = (x + 1) / count * 360 - 180;
  const north = tileYToLatitude(y, count);
  const south = tileYToLatitude(y + 1, count);
  return { west, east, north, south };
}

export function tileForPoint(lat, lng, zoom) {
  const numericZoom = Number(zoom);
  const latitude = clamp(Number(lat), -85.05112878, 85.05112878);
  const longitude = clamp(Number(lng), -180, 180);
  if (![latitude, longitude, numericZoom].every(Number.isFinite) || !Number.isInteger(numericZoom) || numericZoom < 0) {
    throw new Error("代表タイルの座標が不正です");
  }
  const count = 2 ** numericZoom;
  const x = clamp(Math.floor((longitude + 180) / 360 * count), 0, count - 1);
  const y = clamp(latitudeToTileY(latitude, count), 0, count - 1);
  return { x, y, zoom: numericZoom, key: `${numericZoom}/${x}/${y}`, ...tileBounds(x, y, numericZoom) };
}

export function representativeTileUrl(layer, preferredZoom = 14) {
  if (!layer || layer.kind !== "raster" || !layer.center) throw new Error("正射画像レイヤーの情報が不正です");
  const zoom = Math.max(layer.minZoom, Math.min(layer.maxZoom, preferredZoom));
  return expandTileUrl(layer.url, tileForPoint(layer.center.lat, layer.center.lng, zoom));
}

export function tilesForView(viewBox, zoom, maxTiles = 180) {
  if (!viewBox || !Number.isFinite(zoom)) return [];
  const west = clamp(Number(viewBox.x), -180, 180);
  const east = clamp(Number(viewBox.x) + Number(viewBox.width), -180, 180);
  const south = clamp(Number(viewBox.y), -85.05112878, 85.05112878);
  const north = clamp(Number(viewBox.y) + Number(viewBox.height), -85.05112878, 85.05112878);
  if (![west, east, south, north].every(Number.isFinite) || east < west || north < south) return [];

  const count = 2 ** zoom;
  const minX = clamp(Math.floor((west + 180) / 360 * count), 0, count - 1);
  const maxX = clamp(Math.floor((east + 180) / 360 * count), 0, count - 1);
  const minY = clamp(latitudeToTileY(north, count), 0, count - 1);
  const maxY = clamp(latitudeToTileY(south, count), 0, count - 1);
  const tiles = [];
  for (let y = minY; y <= maxY; y += 1) {
    for (let x = minX; x <= maxX; x += 1) {
      if (tiles.length >= maxTiles) return tiles;
      tiles.push({ x, y, zoom, key: `${zoom}/${x}/${y}`, ...tileBounds(x, y, zoom) });
    }
  }
  return tiles;
}

export function expandTileUrl(template, tile) {
  return template
    .replace("{z}", String(tile.zoom))
    .replace("{x}", String(tile.x))
    .replace("{y}", String(tile.y));
}

export function intersectView(viewBox, bounds) {
  if (!viewBox || !bounds) return null;
  const west = Math.max(Number(viewBox.x), bounds.west);
  const east = Math.min(Number(viewBox.x) + Number(viewBox.width), bounds.east);
  const south = Math.max(Number(viewBox.y), bounds.south);
  const north = Math.min(Number(viewBox.y) + Number(viewBox.height), bounds.north);
  if (![west, east, south, north].every(Number.isFinite) || east <= west || north <= south) return null;
  return { x: west, y: south, width: east - west, height: north - south };
}

function latitudeToTileY(latitude, count) {
  const radians = latitude * Math.PI / 180;
  return Math.floor((1 - Math.asinh(Math.tan(radians)) / Math.PI) / 2 * count);
}

function tileYToLatitude(y, count) {
  return Math.atan(Math.sinh(Math.PI * (1 - 2 * y / count))) * 180 / Math.PI;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function isAllowedLayerId(value) {
  return /^2026\d{4}kumamoto_[a-z0-9_]+$/.test(String(value || ""));
}

function classifyLayerId(layerId) {
  if (/_\d{4}(?:_\d{4})?do(?:_|$)/.test(layerId)) return "raster";
  return "";
}

function parseGsiMapLink(value) {
  try {
    const url = new URL(String(value || "").replace(/&amp;/g, "&"), GSI_SOURCE_PAGE);
    if (url.origin !== "https://maps.gsi.go.jp") return null;
    const decodedHash = decodeURIComponent(url.hash.slice(1));
    const position = decodedHash.match(/^(\d+)\/(-?\d+(?:\.\d+)?)\/(-?\d+(?:\.\d+)?)\//);
    const queryStart = decodedHash.indexOf("&");
    if (!position || queryStart < 0) return null;
    const params = new URLSearchParams(decodedHash.slice(queryStart + 1));
    const layerIds = String(params.get("ls") || "")
      .split("|")
      .map((part) => part.split(",")[0].trim())
      .filter(isAllowedLayerId);
    if (!layerIds.length) return null;
    return {
      layerIds,
      center: { lat: Number(position[2]), lng: Number(position[3]) }
    };
  } catch {
    return null;
  }
}

function textBeforeNode(container, target) {
  if (!container || !target) return "";
  const parts = [];
  function visit(node) {
    if (node === target) return true;
    if (node.nodeType === 3) parts.push(node.nodeValue || "");
    if (node.nodeType === 1 && node.tagName === "BR") parts.push("\n");
    for (const child of node.childNodes || []) {
      if (visit(child)) return true;
    }
    return false;
  }
  visit(container);
  return parts.join("");
}

function parseDistrict(value) {
  const match = String(value || "").match(/([一-龠々ヶぁ-んァ-ヶーA-Za-z]+[0-9０-９]*地区)/);
  return match?.[1]?.replace(/[０-９]/g, (digit) => String("０１２３４５６７８９".indexOf(digit))) || "";
}

function districtFromLayerId(layerId) {
  if (layerId.includes("yatsushiro")) return "八代地区";
  const kumamoto = layerId.match(/kumamoto(\d+)/);
  if (kumamoto) return `熊本${kumamoto[1]}地区`;
  return "熊本県内";
}

function parseShootingDates(value, year) {
  const beforeShooting = String(value || "").split("撮影")[0];
  const dates = [...beforeShooting.matchAll(/(\d{1,2})\s*[\/]\s*(\d{1,2})/g)]
    .map((match) => formatDate(Number(year), Number(match[1]), Number(match[2])))
    .filter(Boolean);
  return [...new Set(dates)].sort();
}

function formatDate(year, month, day) {
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return "";
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function rasterTitle(district, shootingDates, layerId) {
  const dates = shootingDates.map((value) => `${Number(value.slice(5, 7))}/${Number(value.slice(8, 10))}`).join("・");
  const suffix = layerId.includes("sokuho") ? "・速報" : "";
  return `正射画像 ${district}${dates ? `（${dates}撮影${suffix}）` : suffix ? `（速報）` : ""}`;
}

function boundsForLayer(layerId) {
  if (layerId.includes("yatsushiro")) return { west: 130.42, east: 130.78, south: 32.22, north: 32.63 };
  if (/kumamoto[1234]/.test(layerId)) return { west: 130.48, east: 131.0, south: 32.48, north: 32.98 };
  return { ...DEFAULT_BOUNDS };
}
