// License: MPL-2.0

export const SUPPORT_SOURCE_URL = "https://www.qsr.mlit.go.jp/bousai_joho/r80728kumamotozisinn.html";

export const PLACE_INDEX = Object.freeze([
  { id: "yatsushiro-port", name: "八代港", aliases: ["八代港", "八代油槽所"], lat: 32.5075, lon: 130.5570 },
  { id: "misumi-port", name: "三角港", aliases: ["三角港"], lat: 32.6093, lon: 130.4788 },
  { id: "uto-arena", name: "ecowin宇土アリーナ", aliases: ["宇土アリーナ"], lat: 32.6816, lon: 130.6608 },
  { id: "kagami-branch", name: "八代市鏡支所", aliases: ["八代市役所鏡支所", "八代市鏡支所"], lat: 32.56319, lon: 130.64871 },
  { id: "aeon-kumamoto", name: "イオンモール熊本", aliases: ["イオンモール熊本"], lat: 32.73806, lon: 130.74389 },
  { id: "uki", name: "宇城市", aliases: ["宇城市"], lat: 32.6482, lon: 130.6841 },
  { id: "misato-shimonakagori", name: "美里町 下中郡区地域集会場", aliases: ["下中郡区地域集会場", "美里町 下中郡区"], lat: 32.6415, lon: 130.7865 },
  { id: "kumagawa", name: "球磨川（八代市）", aliases: ["球磨川"], lat: 32.5078, lon: 130.6017 },
  { id: "hikawa", name: "氷川町", aliases: ["氷川町"], lat: 32.58204, lon: 130.67403 },
  { id: "tanoura", name: "田浦IC", aliases: ["田浦IC"], lat: 32.3514, lon: 130.5068 }
]);

export const FALLBACK_ACTIVITIES = Object.freeze([
  fallback("2026-08-05", "八代港での入浴支援のお知らせ", "八代港"),
  fallback("2026-08-04", "三角港での給水・入浴支援のお知らせ", "三角港"),
  fallback("2026-08-01", "八代港で給水支援を実施中", "八代港"),
  fallback("2026-07-31", "宇土アリーナに飲料水が届けられました", "宇土アリーナ"),
  fallback("2026-07-31", "八代市役所鏡支所にコンテナトイレを設置しました", "八代市役所鏡支所"),
  fallback("2026-07-30", "イオンモール熊本に照明車を派遣しました", "イオンモール熊本"),
  fallback("2026-07-30", "コンテナトイレを宇城市に派遣しました", "宇城市"),
  fallback("2026-07-30", "コンテナトイレを美里町 下中郡区地域集会場に派遣しました", "下中郡区地域集会場"),
  fallback("2026-08-02", "球磨川にて緊急復旧工事中", "球磨川")
]);

export function parseSupportActivities(html, baseUrl = SUPPORT_SOURCE_URL) {
  if (typeof html !== "string" || !html.trim()) return [];
  const document = new DOMParser().parseFromString(html, "text/html");
  const activities = [];
  const seen = new Set();
  for (const anchor of document.querySelectorAll("a[href]")) {
    const title = normalizeText(anchor.textContent);
    const type = classifyActivity(title);
    const place = findPlace(title);
    if (!type || !place) continue;
    let url;
    try {
      url = new URL(anchor.getAttribute("href"), baseUrl).href;
    } catch {
      continue;
    }
    if (!url.startsWith("https://") && !url.startsWith("http://")) continue;
    const date = parseActivityDate(title);
    const key = `${date}|${title}|${url}`;
    if (seen.has(key)) continue;
    seen.add(key);
    activities.push({ date, title, type, url, placeId: place.id, placeName: place.name, lat: place.lat, lon: place.lon, isFallback: false });
  }
  return activities.sort((a, b) => b.date.localeCompare(a.date));
}

export function classifyActivity(text) {
  const value = normalizeText(text);
  const types = [];
  if (/給水|飲料水/.test(value)) types.push("給水・物資");
  if (/入浴/.test(value)) types.push("入浴");
  if (/トイレ/.test(value)) types.push("トイレ");
  if (/照明車/.test(value)) types.push("電源・照明");
  if (/復旧|道路開放|段差解消/.test(value)) types.push("復旧");
  if (!types.length && /支援物資|食料/.test(value)) types.push("給水・物資");
  return types.join("／");
}

export function findPlace(text) {
  const value = normalizeText(text);
  return PLACE_INDEX.find((place) => place.aliases.some((alias) => value.includes(alias))) ?? null;
}

export function parseActivityDate(text) {
  const match = normalizeText(text).match(/(\d{1,2})\s*\/\s*(\d{1,2})/);
  if (!match) return "日付不明";
  return `2026-${match[1].padStart(2, "0")}-${match[2].padStart(2, "0")}`;
}

export function groupActivitiesByPlace(activities) {
  const groups = new Map();
  for (const activity of activities ?? []) {
    if (!activity || !Number.isFinite(activity.lat) || !Number.isFinite(activity.lon)) continue;
    const group = groups.get(activity.placeId) ?? {
      placeId: activity.placeId,
      placeName: activity.placeName,
      lat: activity.lat,
      lon: activity.lon,
      types: new Set(),
      activities: []
    };
    group.activities.push(activity);
    for (const type of activity.type.split("／")) {
      if (type) group.types.add(type);
    }
    groups.set(activity.placeId, group);
  }
  return [...groups.values()].map((group) => ({
    ...group,
    types: [...group.types],
    latestDate: group.activities.map((item) => item.date).sort().at(-1) ?? "日付不明"
  }));
}

export function normalizeText(value) {
  return String(value ?? "").replace(/[\s\u200b]+/g, " ").trim();
}

function fallback(date, title, placeQuery) {
  const place = findPlace(placeQuery);
  return {
    date,
    title,
    type: classifyActivity(title),
    url: SUPPORT_SOURCE_URL,
    placeId: place.id,
    placeName: place.name,
    lat: place.lat,
    lon: place.lon,
    isFallback: true
  };
}
