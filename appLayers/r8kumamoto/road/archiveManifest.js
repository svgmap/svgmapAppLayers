// License: (MPL v2)
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.

export const SOURCE_PAGE_URL =
  "https://www.mlit.go.jp/road/saigai/r8kumamoto/index.html";

const ARCHIVE_DIRECTORY = "https://www.mlit.go.jp/road/saigai/r8kumamoto/";
const ARCHIVE_FILE_PATTERN = /^(?:map|\d{6}(?:\d{4})?data)\.zip$/i;
const HISTORY_FILE_PATTERN = /^(\d{2})(\d{2})(\d{2})(?:(\d{2})(\d{2}))?data\.zip$/i;
const UNKNOWN_AS_OF = "公式掲載ページ参照";

// 掲載ページを取得できない場合も「最新」の map.zip は再取得できるようにする。
// 日時別一覧は、最後に動作確認できた最小限のフォールバックである。
export const ARCHIVES = Object.freeze([
  fallbackLatestArchive(),
  {
    id: "202607290800",
    label: "2026-07-29 08:00",
    shortLabel: "7/29 08:00",
    asOf: "2026-07-29 08:00",
    roadAsOf: "収録なし",
    probePeriod: "ZIP内に個別時刻属性なし",
    url: `${ARCHIVE_DIRECTORY}260729data.zip`,
    expectedMissing: ["road", "travel"]
  },
  ...[
    ["202607291200", "2026-07-29 12:00", "2607291200data.zip", ["travel"]],
    ["202607300800", "2026-07-30 08:00", "2607300800data.zip"],
    ["202607301200", "2026-07-30 12:00", "2607301200data.zip"],
    ["202607301600", "2026-07-30 16:00", "2607301600data.zip"],
    ["202607310800", "2026-07-31 08:00", "2607310800data.zip"],
    ["202607311600", "2026-07-31 16:00", "2607311600data.zip"],
    ["202608011800", "2026-08-01 18:00", "2608011800data.zip"],
    ["202608021800", "2026-08-02 18:00", "2608021800data.zip"],
    ["202608031200", "2026-08-03 12:00", "2608031200data.zip"],
    ["202608031600", "2026-08-03 16:00", "2608031600data.zip"]
  ].map(([id, label, filename, expectedMissing]) =>
    historyArchive(id, label, `${ARCHIVE_DIRECTORY}${filename}`, expectedMissing)
  )
]);

/**
 * 国土交通省の掲載ページから最新データと全日時別ZIPを組み立てる。
 * URLは公式ホストの対象ディレクトリかつ既知のファイル名形式だけを受け入れる。
 */
export function parseArchiveIndex(html) {
  const parser = new DOMParser();
  const document = parser.parseFromString(String(html || ""), "text/html");
  const pageText = document.body?.textContent || "";
  const currentAsOf = parseCurrentAsOf(pageText);
  const historyById = new Map();
  let currentUrl = null;

  for (const anchor of document.querySelectorAll("a[href]")) {
    const url = normalizeArchiveUrl(anchor.getAttribute("href"));
    if (!url) continue;
    const filename = new URL(url).pathname.split("/").pop() || "";
    if (/^map\.zip$/i.test(filename)) {
      if (!currentUrl || /現時点/.test(anchor.textContent || "")) currentUrl = url;
      continue;
    }

    const archive = parseHistoryArchive(filename, anchor.textContent || "", url);
    if (archive) historyById.set(archive.id, archive);
  }

  if (!currentUrl) throw new Error("現時点データのZIPリンクが見つかりません");
  const histories = [...historyById.values()].sort((left, right) => left.id.localeCompare(right.id));
  const asOf = currentAsOf || histories.at(-1)?.asOf || UNKNOWN_AS_OF;
  const latest = latestArchive(currentUrl, asOf, histories.at(-1)?.id || asOf);
  return Object.freeze([latest, ...histories]);
}

export function getArchiveById(id, archives = ARCHIVES) {
  return archives.find((archive) => archive.id === id) || archives[0] || fallbackLatestArchive();
}

export function isAllowedArchiveUrl(value) {
  const url = safeUrl(value);
  if (!url) return false;
  const directory = new URL(ARCHIVE_DIRECTORY);
  if (url.protocol !== "https:" || url.origin !== directory.origin) return false;
  if (url.username || url.password || url.search || url.hash) return false;
  if (!url.pathname.startsWith(directory.pathname)) return false;
  const relativePath = url.pathname.slice(directory.pathname.length);
  return !relativePath.includes("/") && ARCHIVE_FILE_PATTERN.test(relativePath);
}

export function archiveRequestUrl(archive, cacheKey = Date.now()) {
  if (!isAllowedArchiveUrl(archive?.url)) throw new Error("許可されていないデータURLです");
  const url = new URL(archive.url);
  if (archive.isCurrent) url.searchParams.set("_svgmap_updated", String(cacheKey));
  return url.href;
}

function normalizeArchiveUrl(href) {
  const url = safeUrl(href, SOURCE_PAGE_URL);
  if (!url) return null;
  url.hash = "";
  if (!isAllowedArchiveUrl(url.href)) return null;
  return url.href;
}

function parseHistoryArchive(filename, anchorText, url) {
  const match = filename.match(HISTORY_FILE_PATTERN);
  if (!match) return null;
  const [, yearPart, monthPart, dayPart, fileHour, fileMinute] = match;
  const textTime = parseJapaneseAnchorTime(anchorText, Number(monthPart), Number(dayPart));
  const hour = fileHour || textTime?.hour;
  const minute = fileMinute || textTime?.minute;
  if (hour === undefined || minute === undefined) return null;
  if (!isValidTimestamp(2000 + Number(yearPart), Number(monthPart), Number(dayPart), Number(hour), Number(minute))) {
    return null;
  }
  const id = `20${yearPart}${monthPart}${dayPart}${hour}${minute}`;
  const label = `${id.slice(0, 4)}-${id.slice(4, 6)}-${id.slice(6, 8)} ${id.slice(8, 10)}:${id.slice(10, 12)}`;
  return historyArchive(id, label, url, id === "202607290800" ? ["road", "travel"] : []);
}

function parseJapaneseAnchorTime(text, expectedMonth, expectedDay) {
  const match = String(text).match(/(\d{1,2})月\s*(\d{1,2})日\s*(\d{1,2})時(?:\s*(\d{1,2})分)?\s*時点/);
  if (!match || Number(match[1]) !== expectedMonth || Number(match[2]) !== expectedDay) return null;
  return { hour: String(Number(match[3])).padStart(2, "0"), minute: String(Number(match[4] || 0)).padStart(2, "0") };
}

function parseCurrentAsOf(text) {
  const match = String(text).match(
    /(\d{4})年\s*(\d{1,2})月\s*(\d{1,2})日\s*(\d{1,2})時\s*(\d{1,2})分\s*時点\s*(?:の\s*)?最新/
  );
  if (!match) return null;
  const [, year, month, day, hour, minute] = match;
  if (!isValidTimestamp(Number(year), Number(month), Number(day), Number(hour), Number(minute))) {
    return null;
  }
  return `${year}-${pad(month)}-${pad(day)} ${pad(hour)}:${pad(minute)}`;
}

function latestArchive(url, asOf, revision) {
  return Object.freeze({
    id: "latest",
    label: asOf === UNKNOWN_AS_OF ? "最新" : `最新（${asOf}掲載）`,
    shortLabel: "最新",
    asOf,
    roadAsOf: "ZIP内に個別時刻属性なし",
    probePeriod: "ZIP内に個別時刻属性なし",
    url,
    revision,
    isCurrent: true,
    expectedMissing: []
  });
}

function fallbackLatestArchive() {
  return latestArchive(`${ARCHIVE_DIRECTORY}map.zip`, UNKNOWN_AS_OF, "fallback");
}

function historyArchive(id, label, url, expectedMissing = []) {
  return Object.freeze({
    id,
    label,
    shortLabel: label.slice(5),
    asOf: label,
    roadAsOf: `${label}掲載分`,
    probePeriod: "ZIP内に個別時刻属性なし",
    url,
    expectedMissing,
    isCurrent: false
  });
}

function safeUrl(value, base) {
  try {
    return new URL(String(value || ""), base);
  } catch {
    return null;
  }
}

function pad(value) {
  return String(Number(value)).padStart(2, "0");
}

function isValidTimestamp(year, month, day, hour, minute) {
  if (![year, month, day, hour, minute].every(Number.isInteger)) return false;
  const date = new Date(Date.UTC(year, month - 1, day, hour, minute));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day &&
    date.getUTCHours() === hour &&
    date.getUTCMinutes() === minute
  );
}
