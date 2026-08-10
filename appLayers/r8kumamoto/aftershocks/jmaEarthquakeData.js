// License: MPL-2.0

export const JMA_FEED_URL = "https://www.data.jma.go.jp/developer/xml/feed/eqvol.xml";
export const MAIN_SHOCK_SOURCE = "https://www.data.jma.go.jp/eew/data/mech/fig/mc2026072816270000N323600E13042000100071.html";

export const MAIN_SHOCK = Object.freeze({
  id: "main-202607281627",
  originTime: "2026-07-28T16:27:00+09:00",
  areaName: "熊本県熊本地方",
  lat: 32.6,
  lon: 130.7,
  depthKm: 10,
  magnitude: 7.1,
  maxIntensity: "7",
  sourceUrl: MAIN_SHOCK_SOURCE,
  kind: "main"
});

export function parseAtomFeed(xmlText) {
  const document = parseXml(xmlText, "フィード");
  const entries = [];
  const seen = new Set();
  for (const entry of byLocalName(document, "entry")) {
    const title = textOf(entry, "title");
    if (title !== "震源・震度に関する情報") continue;
    const id = textOf(entry, "id");
    if (!isAllowedJmaDataUrl(id) || seen.has(id)) continue;
    seen.add(id);
    entries.push({ id, updated: textOf(entry, "updated"), title });
  }
  return entries;
}

export function parseJmaEarthquake(xmlText, sourceUrl = "") {
  const document = parseXml(xmlText, "地震情報");
  const earthquake = byLocalName(document, "Earthquake")[0];
  if (!earthquake) throw new Error("Earthquake要素がありません");
  const hypocenter = byLocalName(earthquake, "Hypocenter")[0];
  const area = hypocenter ? byLocalName(hypocenter, "Area")[0] : null;
  const coordinate = area ? textOf(area, "Coordinate") : "";
  const position = parseJmaCoordinate(coordinate);
  const magnitude = Number(textOf(earthquake, "Magnitude"));
  const originTime = textOf(earthquake, "OriginTime");
  const areaName = area ? textOf(area, "Name") : "";
  const observation = byLocalName(document, "Observation")[0];
  const maxIntensity = observation ? textOf(observation, "MaxInt") : "不明";
  if (!originTime || !areaName || !Number.isFinite(magnitude) || !position) {
    throw new Error("必須の震源情報がありません");
  }
  return {
    id: sourceUrl || `${originTime}:${position.lat}:${position.lon}`,
    originTime,
    areaName,
    ...position,
    magnitude,
    maxIntensity: maxIntensity || "不明",
    sourceUrl,
    kind: "feed"
  };
}

export function parseJmaCoordinate(value) {
  const match = String(value ?? "").trim().match(/^([+-]\d+(?:\.\d+)?)([+-]\d+(?:\.\d+)?)([+-]\d+(?:\.\d+)?)?\/$/);
  if (!match) return null;
  const lat = Number(match[1]);
  const lon = Number(match[2]);
  const depthKm = match[3] ? Math.abs(Number(match[3])) / 1000 : 0;
  if (![lat, lon, depthKm].every(Number.isFinite) || Math.abs(lat) > 90 || Math.abs(lon) > 180) return null;
  return { lat, lon, depthKm };
}

export function isKumamotoSequenceEvent(event) {
  if (!event || !Number.isFinite(event.lat) || !Number.isFinite(event.lon)) return false;
  return event.originTime >= "2026-07-28T16:27:00+09:00" &&
    event.lat >= 31.8 && event.lat <= 33.3 &&
    event.lon >= 129.8 && event.lon <= 131.5;
}

export function isAllowedJmaDataUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" &&
      url.origin === "https://www.data.jma.go.jp" &&
      /^\/developer\/xml\/data\/[A-Za-z0-9_]+\.xml$/.test(url.pathname);
  } catch {
    return false;
  }
}

export function intensityColor(intensity) {
  const colors = {
    "1": "#dbeafe", "2": "#7dd3fc", "3": "#3b82f6", "4": "#facc15",
    "5-": "#fb923c", "5+": "#f97316", "6-": "#ef4444", "6+": "#991b1b", "7": "#7f1d1d",
    "5弱": "#fb923c", "5強": "#f97316", "6弱": "#ef4444", "6強": "#991b1b"
  };
  return colors[intensity] ?? "#64748b";
}

function parseXml(xmlText, label) {
  if (typeof xmlText !== "string" || !xmlText.trim()) throw new Error(`${label}が空です`);
  const document = new DOMParser().parseFromString(xmlText, "application/xml");
  if (byLocalName(document, "parsererror").length) throw new Error(`${label}XMLが不正です`);
  return document;
}

function byLocalName(root, name) {
  return [...root.getElementsByTagNameNS("*", name)];
}

function textOf(root, name) {
  return byLocalName(root, name)[0]?.textContent?.trim() ?? "";
}
