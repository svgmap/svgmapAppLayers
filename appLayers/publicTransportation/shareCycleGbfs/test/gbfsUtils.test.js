import test from "node:test";
import assert from "node:assert/strict";
import {
  STATUS_CATEGORY,
  findSystemInCatalog,
  getFeedUrls,
  getRefreshIntervalMilliseconds,
  getStatusCategory,
  localizeText,
  normalizeStatus,
  parseCsv,
  parseGbfsTimestamp,
  summarizeStatuses
} from "../gbfsUtils.js";

test("CSVの引用符と日本のSystem IDを解釈する", () => {
  const csv = [
    "Country Code,Name,Location,System ID,URL,Auto-Discovery URL",
    'JP,"Example, Bike","Tokyo, JP",example,https://example.com,https://example.com/gbfs.json',
    "US,Other,Elsewhere,other,https://other.example,https://other.example/gbfs.json"
  ].join("\r\n");

  assert.equal(parseCsv(csv)[1][1], "Example, Bike");
  assert.deepEqual(findSystemInCatalog(csv, "example"), {
    countryCode: "JP",
    systemId: "example",
    name: "Example, Bike",
    location: "Tokyo, JP",
    discoveryUrl: "https://example.com/gbfs.json"
  });
});

test("GBFS 2.3と3.0のDiscoveryからフィードURLを得る", () => {
  const v23 = {
    data: {
      ja: {
        feeds: [{ name: "station_status", url: "https://example.com/v2/status" }]
      }
    }
  };
  const v30 = {
    data: {
      feeds: [{ name: "station_information", url: "https://example.com/v3/info" }]
    }
  };

  assert.equal(getFeedUrls(v23).station_status, "https://example.com/v2/status");
  assert.equal(
    getFeedUrls(v30).station_information,
    "https://example.com/v3/info"
  );
});

test("GBFS 3.0の多言語文字列を日本語優先で得る", () => {
  assert.equal(
    localizeText([
      { text: "Toyama", language: "en" },
      { text: "富山", language: "ja" }
    ]),
    "富山"
  );
});

test("GBFS 2.3/3.0の利用可能車両数を正規化する", () => {
  assert.equal(
    normalizeStatus({ station_id: "1", num_bikes_available: 4 }).available,
    4
  );
  assert.equal(
    normalizeStatus({ station_id: "2", num_vehicles_available: 5 }).available,
    5
  );
  assert.equal(
    normalizeStatus({
      station_id: "3",
      vehicle_types_available: [{ count: 2 }, { count: 3 }]
    }).available,
    5
  );
});

test("空き状況を5分類する", () => {
  const station = { capacity: 10 };
  assert.equal(getStatusCategory(null, station), STATUS_CATEGORY.UNKNOWN);
  assert.equal(
    getStatusCategory({ installed: false, renting: false, available: 5 }, station),
    STATUS_CATEGORY.UNAVAILABLE
  );
  assert.equal(
    getStatusCategory({ installed: true, renting: true, available: 0 }, station),
    STATUS_CATEGORY.EMPTY
  );
  assert.equal(
    getStatusCategory({ installed: true, renting: true, available: 2 }, station),
    STATUS_CATEGORY.LOW
  );
  assert.equal(
    getStatusCategory({ installed: true, renting: true, available: 6 }, station),
    STATUS_CATEGORY.AVAILABLE
  );
});

test("集計値と更新間隔を計算する", () => {
  const stations = [
    { id: "a", capacity: 10 },
    { id: "b", capacity: 10 },
    { id: "c", capacity: 10 }
  ];
  const statuses = new Map([
    ["a", { available: 6, docksAvailable: 4, installed: true, renting: true }],
    ["b", { available: 1, docksAvailable: 9, installed: true, renting: true }],
    ["c", { available: 0, docksAvailable: 10, installed: true, renting: true }]
  ]);
  const summary = summarizeStatuses(stations, statuses);

  assert.equal(summary.vehicles, 7);
  assert.equal(summary.docks, 23);
  assert.equal(summary.available, 1);
  assert.equal(summary.low, 1);
  assert.equal(summary.empty, 1);
  assert.equal(getRefreshIntervalMilliseconds(1), 60000);
  assert.equal(getRefreshIntervalMilliseconds(900), 300000);
});

test("Unix秒とISO 8601の更新時刻を解釈する", () => {
  assert.equal(parseGbfsTimestamp(1700000000)?.getTime(), 1700000000000);
  assert.equal(
    parseGbfsTimestamp("2026-07-28T01:31:40.942Z")?.toISOString(),
    "2026-07-28T01:31:40.942Z"
  );
});

