export const STATUS_CATEGORY = {
  EMPTY: 0,
  LOW: 1,
  AVAILABLE: 2,
  UNAVAILABLE: 3,
  UNKNOWN: 4
};

export function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = "";
  let quoted = false;

  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    if (character === '"') {
      if (quoted && text[index + 1] === '"') {
        field += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
    } else if (character === "," && !quoted) {
      row.push(field);
      field = "";
    } else if ((character === "\n" || character === "\r") && !quoted) {
      if (character === "\r" && text[index + 1] === "\n") {
        index += 1;
      }
      row.push(field);
      if (row.some((value) => value !== "")) {
        rows.push(row);
      }
      row = [];
      field = "";
    } else {
      field += character;
    }
  }

  if (field !== "" || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

export function findSystemInCatalog(csvText, systemId) {
  const rows = parseCsv(csvText);
  const header = rows.shift() || [];
  const countryIndex = header.indexOf("Country Code");
  const systemIndex = header.indexOf("System ID");
  const discoveryIndex = header.indexOf("Auto-Discovery URL");
  const nameIndex = header.indexOf("Name");
  const locationIndex = header.indexOf("Location");

  const row = rows.find(
    (candidate) =>
      candidate[countryIndex] === "JP" && candidate[systemIndex] === systemId
  );
  if (!row) {
    return null;
  }
  return {
    countryCode: row[countryIndex],
    systemId: row[systemIndex],
    name: row[nameIndex],
    location: row[locationIndex],
    discoveryUrl: row[discoveryIndex]
  };
}

export function getFeedUrls(discoveryDocument) {
  const data = discoveryDocument?.data;
  let feeds = data?.feeds;
  if (!Array.isArray(feeds) && data && typeof data === "object") {
    const localizedData = data.ja || data.en || Object.values(data)[0];
    feeds = localizedData?.feeds;
  }
  if (!Array.isArray(feeds)) {
    return {};
  }
  return Object.fromEntries(
    feeds
      .filter((feed) => feed?.name && feed?.url)
      .map((feed) => [feed.name, feed.url])
  );
}

export function localizeText(value, preferredLanguage = "ja") {
  if (typeof value === "string" || typeof value === "number") {
    return String(value);
  }
  if (!Array.isArray(value)) {
    return "";
  }
  const preferred = value.find(
    (entry) => entry?.language === preferredLanguage && entry?.text
  );
  return String(preferred?.text || value.find((entry) => entry?.text)?.text || "");
}

function finiteNumber(value) {
  if (value === null || value === undefined || value === "") {
    return null;
  }
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function sumCounts(entries) {
  if (!Array.isArray(entries)) {
    return null;
  }
  const counts = entries
    .map((entry) => finiteNumber(entry?.count))
    .filter((count) => count !== null);
  return counts.length ? counts.reduce((sum, count) => sum + count, 0) : null;
}

export function normalizeStation(station) {
  return {
    id: String(station?.station_id ?? ""),
    name: localizeText(station?.name),
    address: localizeText(station?.address),
    lat: finiteNumber(station?.lat),
    lon: finiteNumber(station?.lon),
    capacity: finiteNumber(station?.capacity ?? station?.vehicle_capacity),
    rentalUrl:
      station?.rental_uris?.web ||
      station?.rental_uris?.android ||
      station?.rental_uris?.ios ||
      ""
  };
}

export function normalizeStatus(status) {
  const available =
    finiteNumber(status?.num_vehicles_available ?? status?.num_bikes_available) ??
    sumCounts(status?.vehicle_types_available);
  return {
    id: String(status?.station_id ?? ""),
    available,
    docksAvailable: finiteNumber(status?.num_docks_available),
    installed: status?.is_installed !== false,
    renting: status?.is_renting !== false,
    returning: status?.is_returning !== false,
    lastReported: status?.last_reported ?? null
  };
}

export function getStatusCategory(status, station) {
  if (!status) {
    return STATUS_CATEGORY.UNKNOWN;
  }
  if (!status.installed || !status.renting) {
    return STATUS_CATEGORY.UNAVAILABLE;
  }
  if (status.available === null) {
    return STATUS_CATEGORY.UNKNOWN;
  }
  if (status.available <= 0) {
    return STATUS_CATEGORY.EMPTY;
  }
  const capacity = station?.capacity;
  if (
    status.available <= 2 ||
    (Number.isFinite(capacity) && capacity > 0 && status.available / capacity <= 0.2)
  ) {
    return STATUS_CATEGORY.LOW;
  }
  return STATUS_CATEGORY.AVAILABLE;
}

export function summarizeStatuses(stations, statusesById) {
  const summary = {
    total: stations.length,
    available: 0,
    low: 0,
    empty: 0,
    unavailable: 0,
    unknown: 0,
    vehicles: 0,
    docks: 0
  };
  for (const station of stations) {
    const status = statusesById.get(station.id);
    const category = getStatusCategory(status, station);
    if (category === STATUS_CATEGORY.AVAILABLE) summary.available += 1;
    else if (category === STATUS_CATEGORY.LOW) summary.low += 1;
    else if (category === STATUS_CATEGORY.EMPTY) summary.empty += 1;
    else if (category === STATUS_CATEGORY.UNAVAILABLE) summary.unavailable += 1;
    else summary.unknown += 1;

    if (Number.isFinite(status?.available)) summary.vehicles += status.available;
    if (Number.isFinite(status?.docksAvailable)) summary.docks += status.docksAvailable;
  }
  return summary;
}

export function parseGbfsTimestamp(value) {
  if (value === null || value === undefined || value === "") {
    return null;
  }
  if (typeof value === "number") {
    const milliseconds = value < 100000000000 ? value * 1000 : value;
    const date = new Date(milliseconds);
    return Number.isNaN(date.getTime()) ? null : date;
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function getRefreshIntervalMilliseconds(ttl) {
  const seconds = Number(ttl);
  const normalized = Number.isFinite(seconds) ? seconds : 60;
  return Math.min(300, Math.max(60, normalized)) * 1000;
}

