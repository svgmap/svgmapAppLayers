export function decodeText(buffer) {
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(buffer).replace(/^\uFEFF/, "");
  } catch {
    return new TextDecoder("shift_jis").decode(buffer).replace(/^\uFEFF/, "");
  }
}

export function normalizeForMap(csvText) {
  const rows = parseCsv(csvText);
  if (!rows.length) throw new Error("データが空です。");

  const headerIndex = rows.findIndex(row => {
    const columns = coordinateColumns(row);
    return columns.lat >= 0 && columns.lng >= 0;
  });
  if (headerIndex < 0) throw new Error("緯度・経度列を特定できません。");

  const headers = rows[headerIndex].map(value => String(value ?? "").replace(/^\uFEFF/, "").trim());
  let { lat: latCol, lng: lngCol } = coordinateColumns(headers);
  const titleCol = titleColumn(headers, latCol, lngCol);
  const expectedColumns = headers.length;
  const dataRows = rows.slice(headerIndex + 1).filter(row => !String(row[0] || "").trim().startsWith("#"));
  const swapped = coordinatesAreSwapped(dataRows, latCol, lngCol);
  if (swapped) [latCol, lngCol] = [lngCol, latCol];

  const output = [headers.map(cleanCell).join(",")];
  let skipped = 0;
  for (const row of dataRows) {
    if (row.length !== expectedColumns) {
      skipped++;
      continue;
    }
    const latText = String(row[latCol] ?? "").trim();
    const lngText = String(row[lngCol] ?? "").trim();
    const lat = Number(latText);
    const lng = Number(lngText);
    if (!latText || !lngText || !Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180 || (lat === 0 && lng === 0)) {
      skipped++;
      continue;
    }
    output.push(row.map(cleanCell).join(","));
  }
  if (output.length === 1) throw new Error("有効な位置情報がありません。");

  return {
    csv: output.join("\n"),
    latCol,
    lngCol,
    titleCol,
    count: output.length - 1,
    skipped,
    swapped
  };
}

export function prepareAddressRows(csvText, defaultPrefecture = "沖縄県") {
  const rows = parseCsv(csvText);
  if (!rows.length) throw new Error("データが空です。");

  const headerIndex = rows.findIndex(row => row.length > 1 && addressColumns(row).length > 0);
  if (headerIndex < 0) throw new Error("住所・所在地列を特定できません。");

  const headers = rows[headerIndex].map(value => String(value ?? "").replace(/^\uFEFF/, "").trim());
  const addressCols = addressColumns(headers);
  const expectedColumns = headers.length;
  const records = [];
  let skipped = 0;

  for (const row of rows.slice(headerIndex + 1)) {
    if (String(row[0] || "").trim().startsWith("#")) continue;
    if (row.length !== expectedColumns) {
      skipped++;
      continue;
    }
    const address = buildAddress(row, addressCols, defaultPrefecture);
    if (!address) {
      skipped++;
      continue;
    }
    records.push({ row, address });
  }
  if (!records.length) throw new Error("ジオコーディングできる住所がありません。");

  return {
    headers,
    records,
    addressCols,
    titleCol: titleColumn(headers, -1, -1),
    skipped
  };
}

export function normalizeGeocodedRows(prepared, results) {
  if (prepared.records.length !== results.length) throw new Error("ジオコーディング結果の件数が一致しません。");

  const latCol = prepared.headers.length;
  const lngCol = latCol + 1;
  const headers = [...prepared.headers, "緯度", "経度", "ジオコード住所"];
  const output = [headers.map(cleanCell).join(",")];
  let skipped = prepared.skipped;

  results.forEach((result, index) => {
    const lat = Number(result?.lat);
    const lng = Number(result?.lng);
    if (!result || !Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180 || (lat === 0 && lng === 0)) {
      skipped++;
      return;
    }
    const row = [
      ...prepared.records[index].row,
      String(lat),
      String(lng),
      result.resolvedAddress || prepared.records[index].address
    ];
    output.push(row.map(cleanCell).join(","));
  });

  if (output.length === 1) throw new Error("住所から有効な位置情報を取得できませんでした。");
  return {
    csv: output.join("\n"),
    latCol,
    lngCol,
    titleCol: prepared.titleCol,
    count: output.length - 1,
    skipped,
    swapped: false,
    geocoded: true
  };
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = "";
  let quoted = false;

  for (let index = 0; index < text.length; index++) {
    const char = text[index];
    const next = text[index + 1];
    if (char === '"') {
      if (quoted && next === '"') {
        cell += '"';
        index++;
      } else {
        quoted = !quoted;
      }
    } else if (char === "," && !quoted) {
      row.push(cell);
      cell = "";
    } else if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && next === "\n") index++;
      row.push(cell);
      if (row.some(value => String(value).trim())) rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += char;
    }
  }
  if (cell || row.length) {
    row.push(cell);
    if (row.some(value => String(value).trim())) rows.push(row);
  }
  return rows;
}

function coordinateColumns(headers) {
  const normalized = headers.map(normalizeHeader);
  return {
    lat: normalized.findIndex(value => value === "緯度" || value === "latitude" || value === "lat" || value.endsWith("緯度")),
    lng: normalized.findIndex(value => value === "経度" || value === "longitude" || value === "lon" || value === "lng" || value.endsWith("経度"))
  };
}

function addressColumns(headers) {
  const normalized = headers.map(normalizeHeader);
  let fullAddress = -1;
  let fullAddressScore = -1;

  normalized.forEach((value, index) => {
    if (/(コード|番号|郵便|カナ|ふりがな|フリガナ)$/.test(value)) return;
    let score = 0;
    if (["住所", "所在地", "住所連結表記", "所在地連結表記"].includes(value)) score = 120;
    else if (/(住所|所在地)(連結表記)?$/.test(value)) score = 110;
    else if (/^(設置|実施|開催|営業|施設|事業所|店舗|学校|医療機関)?場所$/.test(value)) score = 80;
    if (score > 0 && score > fullAddressScore) {
      fullAddress = index;
      fullAddressScore = score;
    }
  });

  const buildingCols = matchingIndexes(normalized, value => /^(方書|建物名|建物名称|建物名等方書)$/.test(value));
  if (fullAddress >= 0) return [...new Set([fullAddress, ...buildingCols])];

  const groups = [
    value => /^(所在地)?都道府県(名)?$/.test(value),
    value => /^(所在地)?(市区町村|市町村)(名)?$/.test(value),
    value => /^(所在地)?(町字|町名|大字|字)(名)?$/.test(value),
    value => /^(所在地)?(丁目番地号|番地以下|番地)$/.test(value),
    value => /^(方書|建物名|建物名称|建物名等方書)$/.test(value)
  ];
  const componentCols = groups.flatMap(matcher => matchingIndexes(normalized, matcher));
  return componentCols.length >= 2 ? [...new Set(componentCols)] : [];
}

function matchingIndexes(values, matcher) {
  const indexes = [];
  values.forEach((value, index) => {
    if (matcher(value)) indexes.push(index);
  });
  return indexes;
}

function buildAddress(row, addressCols, defaultPrefecture) {
  const address = addressCols
    .map(index => String(row[index] ?? "").trim())
    .filter(Boolean)
    .join("")
    .replace(/[\s　]+/g, "");
  if (!address) return "";
  if (defaultPrefecture && !address.startsWith(defaultPrefecture) && !/^[^0-9]{2,5}[都道府県]/.test(address)) {
    return `${defaultPrefecture}${address}`;
  }
  return address;
}

function normalizeHeader(value) {
  return String(value ?? "").replace(/^\uFEFF/, "").trim().toLowerCase().replace(/[\s_　（）()【】［］\[\]]/g, "");
}

function titleColumn(headers, latCol, lngCol) {
  const preferred = [
    "名称", "施設名称", "営業所名称", "施設名", "公園名", "団地名", "イベント名",
    "教育機関学校名", "学校名", "事業所名", "店舗名", "医療機関名", "塔又は碑名", "name", "title"
  ];
  const excluded = new Set(["地方公共団体名", "都道府県名", "市区町村名", "所在地自治体名"]);
  let bestIndex = -1;
  let bestScore = -1;

  headers.forEach((header, index) => {
    if (index === latCol || index === lngCol) return;
    const value = normalizeHeader(header);
    if (excluded.has(value)) return;
    let score = preferred.includes(value) ? 100 : 0;
    if (!score && /(施設名称|営業所名称|イベント名|学校名|事業所名|店舗名|医療機関名|碑名)$/.test(value)) score = 90;
    if (!score && value.endsWith("名称")) score = 80;
    if (!score && value.endsWith("名")) score = 50;
    if (score > bestScore) {
      bestScore = score;
      bestIndex = index;
    }
  });
  return bestIndex >= 0 ? bestIndex : 0;
}

function coordinatesAreSwapped(rows, latCol, lngCol) {
  let normal = 0;
  let swapped = 0;
  for (const row of rows.slice(0, 50)) {
    const latText = String(row[latCol] ?? "").trim();
    const lngText = String(row[lngCol] ?? "").trim();
    if (!latText || !lngText) continue;
    const lat = Number(latText);
    const lng = Number(lngText);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
    if (lat >= 20 && lat <= 30 && lng >= 120 && lng <= 135) normal++;
    if (lng >= 20 && lng <= 30 && lat >= 120 && lat <= 135) swapped++;
  }
  return swapped > normal;
}

function cleanCell(value) {
  return String(value ?? "")
    .replace(/"/g, "”")
    .replace(/,/g, "、")
    .replace(/[\r\n]+/g, " ")
    .trim();
}
