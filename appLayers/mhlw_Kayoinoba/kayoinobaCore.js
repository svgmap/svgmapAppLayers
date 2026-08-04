// License: MPL-2.0
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.

import { parseCsv } from "../../commonLib/parseCsv.js";

export const SOURCE_PAGE_URL =
  "https://www.mhlw.go.jp/stf/kayoinoba_opendata_00002.html";

export const ACTIVITY_CATEGORIES = Object.freeze([
  {
    id: "exercise",
    label: "体操・運動",
    color: [0, 112, 166],
    keywords: [
      "体操",
      "運動",
      "スポーツ",
      "ウォーキング",
      "歩行",
      "ヨガ",
      "ストレッチ",
      "筋力",
      "リハビリ",
      "ダンス"
    ]
  },
  {
    id: "prevention",
    label: "介護・認知症予防",
    color: [118, 70, 172],
    keywords: ["認知", "脳トレ", "介護予防", "口腔", "健康", "フレイル"]
  },
  {
    id: "social",
    label: "交流・茶話",
    color: [0, 135, 108],
    keywords: [
      "茶話",
      "交流",
      "サロン",
      "カフェ",
      "おしゃべり",
      "つどい",
      "集い",
      "多世代"
    ]
  },
  {
    id: "meal",
    label: "食事・栄養",
    color: [211, 84, 0],
    keywords: ["会食", "食事", "調理", "料理", "栄養", "ランチ", "喫茶"]
  },
  {
    id: "hobby",
    label: "趣味・文化",
    color: [180, 53, 122],
    keywords: [
      "趣味",
      "レクリエーション",
      "カラオケ",
      "手芸",
      "囲碁",
      "将棋",
      "園芸",
      "音楽",
      "歌",
      "折り紙",
      "書道",
      "麻雀"
    ]
  },
  {
    id: "other",
    label: "その他",
    color: [89, 101, 111],
    keywords: []
  },
  {
    id: "unknown",
    label: "記載なし",
    color: [117, 117, 117],
    keywords: []
  }
]);

export const ACTIVITY_CATEGORY_BY_ID = new Map(
  ACTIVITY_CATEGORIES.map((category, index) => [
    category.id,
    Object.freeze({ ...category, index })
  ])
);

const FIELD_NAMES = Object.freeze({
  no: "No",
  prefectureCode: "都道府県コード",
  prefecture: "都道府県名",
  cityCode: "市区町村コード",
  city: "市区町村名",
  note: "備考",
  nameKana: "名称（ふりがな）",
  name: "名称",
  postalCode: "郵便番号",
  address: "所在地（都道府県から番地まで）",
  building: "所在地（建物名・部屋番号等）",
  phone: "電話番号",
  audience: "対象者",
  activity: "活動内容",
  weekdayStart: "運営日（平日）－開始",
  weekdayEnd: "運営日（平日）－終了",
  saturdayStart: "運営日（土曜）－開始",
  saturdayEnd: "運営日（土曜）－終了",
  sundayStart: "運営日（日曜）－開始",
  sundayEnd: "運営日（日曜）－終了",
  holidayStart: "運営日（祝日）－開始",
  holidayEnd: "運営日（祝日）－終了",
  closedDays: "定休日",
  capacity: "定員",
  fee: "料金体系",
  mealProvided: "飲食の提供の有無",
  mealBring: "飲食持ち込みの可否",
  shuttle: "送迎の有無",
  targetArea: "対象エリア",
  comprehensiveProject: "総合事業実施の有無",
  other: "その他",
  corporationNumberPresence: "法人番号の有無",
  corporationNumber: "法人番号",
  corporationNameKana: "法人名称（ふりがな）",
  corporationName: "法人名称",
  status: "ステータス",
  latitude: "緯度",
  longitude: "経度"
});

const REQUIRED_FIELDS = Object.freeze([
  "no",
  "prefectureCode",
  "prefecture",
  "cityCode",
  "city",
  "name",
  "address",
  "activity",
  "fee",
  "shuttle",
  "latitude",
  "longitude"
]);

export function normalizeText(value) {
  return String(value ?? "")
    .normalize("NFKC")
    .replace(/^\uFEFF/, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function normalizeSearchText(value) {
  return normalizeText(value).toLocaleLowerCase("ja-JP");
}

function normalizeHeader(value) {
  return normalizeText(value)
    .replace(/[‐‑‒–—―−]/g, "-")
    .replace(/\s/g, "");
}

function decodeHtmlEntities(value) {
  return String(value)
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) =>
      String.fromCodePoint(Number.parseInt(code, 16))
    );
}

function htmlToText(value) {
  return normalizeText(
    decodeHtmlEntities(String(value).replace(/<[^>]*>/g, " "))
  );
}

function parseJapaneseDate(text, includesEndOfMonth = false) {
  const normalized = normalizeText(text);
  const suffix = includesEndOfMonth ? "\\s*月\\s*(?:末|末時点)" : "\\s*月";
  const match = normalized.match(
    new RegExp(`(\\d{4})\\s*年\\s*(\\d{1,2})${suffix}`)
  );
  if (!match) return null;
  return {
    year: Number(match[1]),
    month: Number(match[2])
  };
}

function parseOutputDate(text) {
  const normalized = normalizeText(text);
  const match = normalized.match(
    /出力日\s*[:：]\s*(\d{4})\s*年\s*(\d{1,2})\s*月\s*(\d{1,2})\s*日/
  );
  if (!match) return null;
  return `${match[1]}-${String(match[2]).padStart(2, "0")}-${String(
    match[3]
  ).padStart(2, "0")}`;
}

export function extractLatestDataset(html, baseUrl = SOURCE_PAGE_URL) {
  if (!String(html || "").trim()) {
    throw new Error("掲載ページが空です");
  }

  const candidates = [];
  const itemPattern = /<li\b[^>]*>([\s\S]*?)<\/li>/gi;
  for (const match of String(html).matchAll(itemPattern)) {
    const itemHtml = match[1];
    const anchor = itemHtml.match(
      /<a\b[^>]*\bhref\s*=\s*(["'])(.*?)\1[^>]*>([\s\S]*?)<\/a>/i
    );
    if (!anchor) continue;

    const href = decodeHtmlEntities(anchor[2]).trim();
    if (!/\.(?:csv|zip)(?:[?#]|$)/i.test(href)) continue;

    const label = htmlToText(anchor[3]);
    const itemText = htmlToText(itemHtml);
    const period = parseJapaneseDate(label, true);
    if (!period || period.month < 1 || period.month > 12) continue;

    let url;
    try {
      url = new URL(href, baseUrl).href;
    } catch {
      continue;
    }

    const outputDate = parseOutputDate(itemText);
    candidates.push({
      url,
      dataYear: period.year,
      dataMonth: period.month,
      dataPeriod: `${period.year}年${period.month}月末`,
      outputDate
    });
  }

  if (!candidates.length) {
    throw new Error("掲載ページから公表データのURLと対象年月を検出できません");
  }
  candidates.sort(
    (left, right) =>
      right.dataYear - left.dataYear ||
      right.dataMonth - left.dataMonth ||
      String(right.outputDate || "").localeCompare(
        String(left.outputDate || "")
      )
  );
  return { ...candidates[0] };
}

function toUint8Array(payload) {
  if (payload instanceof Uint8Array) return payload;
  if (payload instanceof ArrayBuffer) return new Uint8Array(payload);
  if (ArrayBuffer.isView(payload)) {
    return new Uint8Array(
      payload.buffer,
      payload.byteOffset,
      payload.byteLength
    );
  }
  throw new TypeError("ArrayBufferまたはTypedArrayが必要です");
}

export function detectPayloadFormat(payload) {
  const bytes = toUint8Array(payload);
  if (!bytes.length) return "unknown";
  if (
    bytes.length >= 4 &&
    bytes[0] === 0x50 &&
    bytes[1] === 0x4b &&
    ((bytes[2] === 0x03 && bytes[3] === 0x04) ||
      (bytes[2] === 0x05 && bytes[3] === 0x06) ||
      (bytes[2] === 0x07 && bytes[3] === 0x08))
  ) {
    return "zip";
  }

  const prefix = new TextDecoder("utf-8").decode(
    bytes.subarray(0, Math.min(bytes.length, 65_536))
  );
  const text = prefix.replace(/^\uFEFF/, "").trimStart();
  if (/^(?:<!doctype\s+html|<html\b|<\?xml\b)/i.test(text)) {
    return "unknown";
  }
  const firstLine = text.split(/\r?\n/, 1)[0] || "";
  return firstLine.includes(",") ? "csv" : "unknown";
}

export function normalizeFlag(value) {
  const normalized = normalizeText(value);
  if (normalized === "1") return "yes";
  if (normalized === "0") return "no";
  return "unknown";
}

export function classifyFee(value) {
  const normalized = normalizeSearchText(value).replace(/\s/g, "");
  if (
    !normalized ||
    /^(?:不明|未定|要問合せ|問い合わせ|自治体による|団体による)[。.]?$/.test(
      normalized
    )
  ) {
    return "unknown";
  }

  const freeExpression =
    /(?:無料|無償|不要|参加費なし|会費なし|料金なし|費用なし|負担なし|^なし[。.]?$|^無し[。.]?$|^(?:0|0円|￥0)[。.]?$)/;
  const explicitCharge =
    /(?:有料|実費|材料費|会費制|利用料|月額|年額|集金|[1-9][0-9,.]*円)/;
  if (freeExpression.test(normalized) && !explicitCharge.test(normalized)) {
    return "free";
  }
  if (
    explicitCharge.test(normalized) ||
    /(?:参加費|会費|料金)\s*[:：]?[1-9]/.test(normalized)
  ) {
    return "paid";
  }
  return "unknown";
}

export function classifyActivity(value) {
  const normalized = normalizeSearchText(value);
  if (!normalized) return ["unknown"];

  const matched = ACTIVITY_CATEGORIES.filter(
    (category) =>
      category.keywords.length > 0 &&
      category.keywords.some((keyword) =>
        normalized.includes(normalizeSearchText(keyword))
      )
  ).map((category) => category.id);
  return matched.length ? matched : ["other"];
}

function stableHash(value) {
  let hash = 0x811c9dc5;
  for (const character of String(value)) {
    hash ^= character.codePointAt(0);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

function displayValue(value) {
  return String(value ?? "").replaceAll("（改行）", "\n").trim();
}

function coordinateState(latitudeText, longitudeText) {
  if (!normalizeText(latitudeText) || !normalizeText(longitudeText)) {
    return { drawable: false, reason: "missing" };
  }
  const latitude = Number(normalizeText(latitudeText));
  const longitude = Number(normalizeText(longitudeText));
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return { drawable: false, reason: "notNumeric" };
  }
  if (
    latitude < -90 ||
    latitude > 90 ||
    longitude < -180 ||
    longitude > 180
  ) {
    return { drawable: false, reason: "outOfRange" };
  }
  // 対象は日本全国。0,0など世界座標としては有効でも日本の地点ではない値を除外する。
  if (
    latitude < 20 ||
    latitude > 46 ||
    longitude < 122 ||
    longitude > 154
  ) {
    return { drawable: false, reason: "outsideJapan" };
  }
  return { drawable: true, latitude, longitude, reason: null };
}

export function normalizeDataset(csvText) {
  const rows = parseCsv(String(csvText ?? ""));
  if (!rows.length) throw new Error("CSVが空です");

  const normalizedHeaders = rows[0].map(normalizeHeader);
  const headerIndex = new Map();
  normalizedHeaders.forEach((header, index) => {
    if (header && !headerIndex.has(header)) headerIndex.set(header, index);
  });

  const fieldIndexes = {};
  for (const [key, label] of Object.entries(FIELD_NAMES)) {
    fieldIndexes[key] = headerIndex.get(normalizeHeader(label));
  }
  const missingHeaders = REQUIRED_FIELDS.filter(
    (key) => fieldIndexes[key] === undefined
  ).map((key) => FIELD_NAMES[key]);
  if (missingHeaders.length) {
    throw new Error(`必須列がありません: ${missingHeaders.join("、")}`);
  }

  const sourceRows = rows.slice(1).filter((row) =>
    row.some((cell) => normalizeText(cell))
  );
  if (!sourceRows.length) throw new Error("CSVにデータ行がありません");

  const read = (row, key) =>
    fieldIndexes[key] === undefined
      ? ""
      : displayValue(row[fieldIndexes[key]]);
  const records = [];
  const seenKeys = new Set();
  const coordinateReasons = {
    missing: 0,
    notNumeric: 0,
    outOfRange: 0,
    outsideJapan: 0
  };
  let duplicateRows = 0;

  for (const row of sourceRows) {
    const no = read(row, "no");
    const fallbackParts = [
      read(row, "prefectureCode"),
      read(row, "cityCode"),
      normalizeSearchText(read(row, "name")),
      normalizeSearchText(read(row, "address")),
      normalizeText(read(row, "latitude")),
      normalizeText(read(row, "longitude"))
    ];
    const deduplicationKey = no
      ? `no:${no}`
      : `fallback:${fallbackParts.join("|")}`;
    if (seenKeys.has(deduplicationKey)) {
      duplicateRows += 1;
      continue;
    }
    seenKeys.add(deduplicationKey);

    const name = read(row, "name");
    const activity = read(row, "activity");
    const activityCategories = classifyActivity(activity);
    const coordinate = coordinateState(
      read(row, "latitude"),
      read(row, "longitude")
    );
    if (!coordinate.drawable) coordinateReasons[coordinate.reason] += 1;

    const values = Object.fromEntries(
      Object.keys(FIELD_NAMES).map((key) => [key, read(row, key)])
    );
    const fallbackId = stableHash(fallbackParts.join("|"));
    const id = no ? `no-${no}` : `fallback-${fallbackId}`;
    const searchText = normalizeSearchText(
      [
        name,
        values.nameKana,
        values.address,
        values.building,
        activity,
        values.other
      ].join(" ")
    );

    records.push({
      id,
      no,
      name,
      prefectureCode: values.prefectureCode,
      prefecture: values.prefecture,
      cityCode: values.cityCode,
      city: values.city,
      activity,
      activityCategories,
      primaryActivityCategory: activityCategories[0],
      feeCategory: classifyFee(values.fee),
      shuttle: normalizeFlag(values.shuttle),
      searchText,
      drawable: coordinate.drawable,
      coordinateReason: coordinate.reason,
      latitude: coordinate.latitude,
      longitude: coordinate.longitude,
      values
    });
  }

  const invalidCoordinates = Object.values(coordinateReasons).reduce(
    (total, count) => total + count,
    0
  );
  return {
    records,
    sourceRowCount: sourceRows.length,
    normalizedCount: records.length,
    drawableCount: records.length - invalidCoordinates,
    invalidCoordinates,
    coordinateReasons,
    duplicateRows,
    headers: rows[0].map((header) => normalizeText(header))
  };
}

export function buildRegionOptions(records) {
  const prefectureMap = new Map();
  for (const record of records || []) {
    if (!record.prefectureCode || !record.prefecture) continue;
    if (!prefectureMap.has(record.prefectureCode)) {
      prefectureMap.set(record.prefectureCode, {
        code: record.prefectureCode,
        name: record.prefecture,
        cityMap: new Map()
      });
    }
    if (record.cityCode && record.city) {
      prefectureMap
        .get(record.prefectureCode)
        .cityMap.set(record.cityCode, record.city);
    }
  }

  return [...prefectureMap.values()]
    .sort((left, right) =>
      left.code.localeCompare(right.code, "ja", { numeric: true })
    )
    .map((prefecture) => ({
      code: prefecture.code,
      name: prefecture.name,
      cities: [...prefecture.cityMap]
        .map(([code, name]) => ({ code, name }))
        .sort((left, right) =>
          left.code.localeCompare(right.code, "ja", { numeric: true })
        )
    }));
}

export function filterRecords(records, criteria = {}) {
  const keywordTokens = normalizeSearchText(criteria.keyword)
    .split(/\s+/)
    .filter(Boolean);
  return (records || []).filter((record) => {
    if (
      criteria.prefectureCode &&
      record.prefectureCode !== criteria.prefectureCode
    ) {
      return false;
    }
    if (criteria.cityCode && record.cityCode !== criteria.cityCode) {
      return false;
    }
    if (
      criteria.activity &&
      !record.activityCategories.includes(criteria.activity)
    ) {
      return false;
    }
    if (criteria.fee && record.feeCategory !== criteria.fee) {
      return false;
    }
    if (criteria.shuttle && record.shuttle !== criteria.shuttle) {
      return false;
    }
    return keywordTokens.every((token) => record.searchText.includes(token));
  });
}

export function formatFlag(value) {
  if (value === "yes") return "あり";
  if (value === "no") return "なし";
  return "不明";
}

function appendDetailRow(documentObject, tbody, label, value) {
  const text = displayValue(value);
  if (!text) return;
  const row = documentObject.createElement("tr");
  const heading = documentObject.createElement("th");
  const cell = documentObject.createElement("td");
  heading.textContent = label;
  cell.textContent = text;
  heading.setAttribute(
    "style",
    "width:34%;padding:5px;text-align:left;vertical-align:top;background:#f3f4f6"
  );
  cell.setAttribute(
    "style",
    "padding:5px;white-space:pre-wrap;overflow-wrap:anywhere"
  );
  row.append(heading, cell);
  tbody.append(row);
}

function formatHours(start, end) {
  const normalizedStart = displayValue(start);
  const normalizedEnd = displayValue(end);
  if (normalizedStart && normalizedEnd) return `${normalizedStart}〜${normalizedEnd}`;
  return normalizedStart || normalizedEnd;
}

export function createDetailElement(
  documentObject,
  record,
  { dataPeriod = "", fetchedAt = "" } = {}
) {
  const section = documentObject.createElement("section");
  section.setAttribute(
    "style",
    "font:13px/1.5 system-ui,sans-serif;color:#17202a"
  );
  const title = documentObject.createElement("h2");
  title.textContent = record.name || "名称未記載";
  title.setAttribute("style", "margin:0 0 8px;font-size:17px");
  section.append(title);

  const table = documentObject.createElement("table");
  table.setAttribute(
    "style",
    "width:100%;border-collapse:collapse;border:1px solid #d1d5db"
  );
  table.setAttribute("border", "1");
  const tbody = documentObject.createElement("tbody");
  table.append(tbody);
  section.append(table);

  const values = record.values;
  const address = [values.address, values.building].filter(Boolean).join(" ");
  const corporation = [
    values.corporationName,
    values.corporationNumber
      ? `（法人番号: ${values.corporationNumber}）`
      : ""
  ]
    .filter(Boolean)
    .join("");
  appendDetailRow(documentObject, tbody, "ふりがな", values.nameKana);
  appendDetailRow(
    documentObject,
    tbody,
    "所在地",
    [values.postalCode ? `〒${values.postalCode}` : "", address]
      .filter(Boolean)
      .join(" ")
  );
  appendDetailRow(documentObject, tbody, "電話番号", values.phone);
  appendDetailRow(documentObject, tbody, "対象者", values.audience);
  appendDetailRow(documentObject, tbody, "活動内容", values.activity);
  appendDetailRow(
    documentObject,
    tbody,
    "平日",
    formatHours(values.weekdayStart, values.weekdayEnd)
  );
  appendDetailRow(
    documentObject,
    tbody,
    "土曜",
    formatHours(values.saturdayStart, values.saturdayEnd)
  );
  appendDetailRow(
    documentObject,
    tbody,
    "日曜",
    formatHours(values.sundayStart, values.sundayEnd)
  );
  appendDetailRow(
    documentObject,
    tbody,
    "祝日",
    formatHours(values.holidayStart, values.holidayEnd)
  );
  appendDetailRow(documentObject, tbody, "定休日", values.closedDays);
  appendDetailRow(documentObject, tbody, "定員", values.capacity);
  appendDetailRow(documentObject, tbody, "料金体系", values.fee);
  if (values.mealProvided) {
    appendDetailRow(
      documentObject,
      tbody,
      "飲食の提供",
      formatFlag(normalizeFlag(values.mealProvided))
    );
  }
  if (values.mealBring) {
    appendDetailRow(
      documentObject,
      tbody,
      "飲食持ち込み",
      formatFlag(normalizeFlag(values.mealBring))
    );
  }
  if (values.shuttle) {
    appendDetailRow(
      documentObject,
      tbody,
      "送迎",
      formatFlag(normalizeFlag(values.shuttle))
    );
  }
  appendDetailRow(documentObject, tbody, "対象エリア", values.targetArea);
  if (values.comprehensiveProject) {
    appendDetailRow(
      documentObject,
      tbody,
      "総合事業実施",
      formatFlag(normalizeFlag(values.comprehensiveProject))
    );
  }
  appendDetailRow(documentObject, tbody, "その他", values.other);
  appendDetailRow(documentObject, tbody, "法人", corporation);
  appendDetailRow(documentObject, tbody, "公開ステータス", values.status);
  appendDetailRow(documentObject, tbody, "データNo", values.no);
  appendDetailRow(documentObject, tbody, "データ対象年月", dataPeriod);
  appendDetailRow(documentObject, tbody, "アプリ取得日時", fetchedAt);

  const note = documentObject.createElement("p");
  note.textContent =
    "厚生労働省「通いの場のオープンデータ」を検索・正規化して表示しています。最新情報は掲載元や連絡先でもご確認ください。";
  note.setAttribute("style", "margin:8px 0 0;color:#4b5563;font-size:12px");
  section.append(note);
  return section;
}
