import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { JSDOM } from "jsdom";
import {
  buildRegionOptions,
  classifyActivity,
  classifyFee,
  createDetailElement,
  detectPayloadFormat,
  extractLatestDataset,
  filterRecords,
  normalizeDataset,
  normalizeFlag,
  normalizeSearchText
} from "../kayoinobaCore.js";

const fixtureUrl = new URL("./fixtures/", import.meta.url);

const minimalHeaders = [
  "No",
  "都道府県コード",
  "都道府県名",
  "市区町村コード",
  "市区町村名",
  "名称",
  "所在地（都道府県から番地まで）",
  "活動内容",
  "料金体系",
  "送迎の有無",
  "緯度",
  "経度"
];

function quoteCsv(value) {
  const text = String(value ?? "");
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function makeCsv(objects, headers = minimalHeaders) {
  const fieldByHeader = {
    No: "no",
    都道府県コード: "prefectureCode",
    都道府県名: "prefecture",
    市区町村コード: "cityCode",
    市区町村名: "city",
    名称: "name",
    "所在地（都道府県から番地まで）": "address",
    活動内容: "activity",
    料金体系: "fee",
    送迎の有無: "shuttle",
    緯度: "latitude",
    経度: "longitude"
  };
  return [
    headers.map(quoteCsv).join(","),
    ...objects.map((object) =>
      headers
        .map((header) => quoteCsv(object[fieldByHeader[header]] ?? ""))
        .join(",")
    )
  ].join("\r\n");
}

function sampleRecord(overrides = {}) {
  return {
    no: "1",
    prefectureCode: "13",
    prefecture: "東京都",
    cityCode: "13101",
    city: "千代田区",
    name: "丸の内 体操会",
    address: "千代田区丸の内1-1",
    activity: "体操（運動）、茶話会",
    fee: "無料",
    shuttle: "1",
    latitude: "35.681",
    longitude: "139.767",
    ...overrides
  };
}

test("掲載ページから最新URL・対象年月・出力日を抽出する", () => {
  const html = fs.readFileSync(new URL("latest-page.html", fixtureUrl), "utf8");
  assert.deepEqual(
    extractLatestDataset(html, "https://www.mhlw.go.jp/example/page.html"),
    {
      url: "https://www.mhlw.go.jp/content/12300000/202606.csv",
      dataYear: 2026,
      dataMonth: 6,
      dataPeriod: "2026年6月末",
      outputDate: "2026-07-09"
    }
  );
  assert.throws(
    () => extractLatestDataset("<html>構造変更</html>"),
    /検出できません/
  );
});

test("バイト内容からCSV・ZIP・HTMLを判定する", () => {
  const csv = new TextEncoder().encode("\uFEFFNo,名称\r\n1,例");
  const zip = Uint8Array.from([0x50, 0x4b, 0x03, 0x04, 0, 0]);
  const html = new TextEncoder().encode("<!doctype html><p>error</p>");
  assert.equal(detectPayloadFormat(csv), "csv");
  assert.equal(detectPayloadFormat(zip), "zip");
  assert.equal(detectPayloadFormat(html), "unknown");
  assert.equal(detectPayloadFormat(new Uint8Array()), "unknown");
});

test("BOM、引用符、カンマ、空値、未知列、列順変更を解析する", () => {
  const csv = fs.readFileSync(new URL("sample.csv", fixtureUrl), "utf8");
  const result = normalizeDataset(csv);
  assert.equal(result.sourceRowCount, 3);
  assert.equal(result.normalizedCount, 2);
  assert.equal(result.duplicateRows, 1);
  assert.equal(result.invalidCoordinates, 1);
  assert.equal(result.records[0].name, "交流, 体操の会");
  assert.equal(result.records[0].activity, "体操（運動）、茶話会");
  assert.equal(result.records[0].feeCategory, "free");
  assert.equal(result.records[0].shuttle, "yes");
});

test("必須列欠損と空データを拒否する", () => {
  assert.throws(
    () => normalizeDataset("No,名称\r\n1,例"),
    /必須列がありません/
  );
  assert.throws(
    () => normalizeDataset(`${minimalHeaders.join(",")}\r\n`),
    /データ行がありません/
  );
});

test("座標の欠損・型違い・値域外・日本域外を理由別に除外する", () => {
  const csv = makeCsv([
    sampleRecord({ no: "1" }),
    sampleRecord({ no: "2", latitude: "", longitude: "" }),
    sampleRecord({ no: "3", latitude: "北緯35", longitude: "139" }),
    sampleRecord({ no: "4", latitude: "91", longitude: "139" }),
    sampleRecord({ no: "5", latitude: "0", longitude: "0" })
  ]);
  const result = normalizeDataset(csv);
  assert.equal(result.drawableCount, 1);
  assert.deepEqual(result.coordinateReasons, {
    missing: 1,
    notNumeric: 1,
    outOfRange: 1,
    outsideJapan: 1
  });
});

test("同一Noを優先し、Noなしは複合キーで重複を除く", () => {
  const csv = makeCsv([
    sampleRecord({ no: "10", name: "先の行" }),
    sampleRecord({ no: "10", name: "後の行" }),
    sampleRecord({ no: "", name: "Noなし" }),
    sampleRecord({ no: "", name: "Noなし" })
  ]);
  const result = normalizeDataset(csv);
  assert.equal(result.records.length, 2);
  assert.equal(result.records[0].name, "先の行");
  assert.equal(result.duplicateRows, 2);
});

test("フラグは1・0だけをあり・なしにする", () => {
  assert.equal(normalizeFlag("1"), "yes");
  assert.equal(normalizeFlag("０"), "no");
  assert.equal(normalizeFlag(""), "unknown");
  assert.equal(normalizeFlag("2"), "unknown");
  assert.equal(normalizeFlag("あり"), "unknown");
});

test("料金を明記内容だけで無料・有料・不明へ分類する", () => {
  assert.equal(classifyFee("無料"), "free");
  assert.equal(classifyFee("参加費なし"), "free");
  assert.equal(classifyFee("月500円"), "paid");
  assert.equal(classifyFee("材料費実費"), "paid");
  assert.equal(classifyFee("無料（材料費あり）"), "paid");
  assert.equal(classifyFee("自治体による"), "unknown");
  assert.equal(classifyFee(""), "unknown");
});

test("活動内容を複数カテゴリへ分類する", () => {
  assert.deepEqual(classifyActivity("体操と茶話会"), ["exercise", "social"]);
  assert.deepEqual(classifyActivity("俳句の会"), ["other"]);
  assert.deepEqual(classifyActivity(""), ["unknown"]);
});

test("都道府県・市区町村候補と複合フィルターが連動する", () => {
  const result = normalizeDataset(
    makeCsv([
      sampleRecord({ no: "1" }),
      sampleRecord({
        no: "2",
        prefectureCode: "01",
        prefecture: "北海道",
        cityCode: "01101",
        city: "札幌市中央区",
        name: "札幌 趣味会",
        address: "札幌市",
        activity: "カラオケ",
        fee: "100円",
        shuttle: "0",
        latitude: "43.06",
        longitude: "141.35"
      })
    ])
  );
  const regions = buildRegionOptions(result.records);
  assert.deepEqual(
    regions.map((prefecture) => prefecture.name),
    ["北海道", "東京都"]
  );
  assert.equal(regions[0].cities[0].name, "札幌市中央区");
  assert.equal(
    filterRecords(result.records, {
      prefectureCode: "01",
      cityCode: "01101",
      keyword: "札幌 カラオケ",
      activity: "hobby",
      fee: "paid",
      shuttle: "no"
    })[0].name,
    "札幌 趣味会"
  );
  assert.equal(
    normalizeSearchText("  ＡＢＣ　ｶﾀｶﾅ "),
    "abc カタカナ"
  );
});

test("詳細表示は外部文字列をHTMLとして解釈しない", () => {
  const dom = new JSDOM("<!doctype html><body></body>");
  const result = normalizeDataset(
    makeCsv([
      sampleRecord({
        name: '<img src=x onerror="alert(1)">',
        activity: "<script>danger()</script>"
      })
    ])
  );
  const detail = createDetailElement(dom.window.document, result.records[0], {
    dataPeriod: "2026年6月末",
    fetchedAt: "2026/07/31 12:00"
  });
  assert.equal(detail.querySelectorAll("img,script").length, 0);
  assert.match(detail.textContent, /<img src=x onerror="alert\(1\)">/);
  assert.match(detail.textContent, /<script>danger\(\)<\/script>/);
});
