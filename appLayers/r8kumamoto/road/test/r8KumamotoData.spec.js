// License: MPL-2.0

import { describe, expect, test } from "@jest/globals";
import {
  LAYER_KEYS,
  classifyArchiveEntryName,
  encodeSvgMapMetadata,
  groupArchiveEntryNames,
  normalizeRoadProperties,
  prepareFeatureCollection,
  sanitizeStyle,
  validateLineStringFeature
} from "../r8KumamotoData.js";
import { featureCollection, lineFeature } from "./fixtures.js";

describe("ZIPエントリー分類", () => {
  test("直下・json配下・任意1階層とETC2.0分割ファイルを分類する", () => {
    const grouped = groupArchiveEntryNames([
      "dourokisei.geojson",
      "json/ETC2.0_speed_data1.geojson",
      "json/ETC2.0_speed_data4.geojson",
      "2608011800date/tukoujisseki.geojson"
    ]);
    expect(grouped.road).toEqual(["dourokisei.geojson"]);
    expect(grouped.etc).toHaveLength(2);
    expect(grouped.travel).toEqual(["2608011800date/tukoujisseki.geojson"]);
  });

  test("ドットだけのファイル・未知ファイル・ディレクトリを無視する", () => {
    const grouped = groupArchiveEntryNames([
      "json/.geojson",
      ".zip",
      "img/usage_guide.png",
      "unknown.geojson",
      "json/"
    ]);
    expect(grouped).toMatchObject({ road: [], etc: [], travel: [] });
    expect(grouped.ignored).toHaveLength(5);
    expect(classifyArchiveEntryName("json/.geojson")).toBeNull();
  });
});

describe("GeoJSON検証", () => {
  test("正常なLineStringだけを受け付ける", () => {
    expect(validateLineStringFeature(lineFeature([[130, 32], [131, 33]]))).toBe(true);
  });

  test.each([
    ["Featureでない", { type: "Other" }],
    ["geometry欠損", { type: "Feature" }],
    ["LineString以外", lineFeature([[130, 32], [131, 33]])],
    ["点不足", lineFeature([[130, 32]])],
    ["NaN", lineFeature([[Number.NaN, 32], [131, 33]])],
    ["null", lineFeature([[null, 32], [131, 33]])],
    ["数値文字列", lineFeature([["130", 32], [131, 33]])],
    ["経度範囲外", lineFeature([[181, 32], [131, 33]])],
    ["緯度範囲外", lineFeature([[130, -91], [131, 33]])]
  ])("%sを拒否する", (label, feature) => {
    if (label === "LineString以外") feature.geometry.type = "Point";
    expect(validateLineStringFeature(feature)).toBe(false);
  });

  test("FeatureCollectionでない文書を拒否する", async () => {
    await expect(
      prepareFeatureCollection({ type: "Feature", features: [] }, LAYER_KEYS.ROAD, {
        cooperative: false
      })
    ).rejects.toThrow("FeatureCollection");
  });

  test("空のFeatureCollectionを0件として受け付ける", async () => {
    const prepared = await prepareFeatureCollection(featureCollection([]), LAYER_KEYS.ETC, {
      cooperative: false
    });
    expect(prepared.features).toEqual([]);
    expect(prepared.stats).toEqual({
      originalCount: 0,
      validCount: 0,
      uniqueCount: 0,
      duplicateCount: 0,
      invalidCount: 0
    });
  });

  test("未知プロパティを含むFeatureも構造が正しければ受け付ける", async () => {
    const prepared = await prepareFeatureCollection(
      featureCollection([lineFeature([[130, 32], [131, 33]], { unknown: "value" })]),
      LAYER_KEYS.ETC,
      { cooperative: false }
    );
    expect(prepared.stats.uniqueCount).toBe(1);
  });

  test("不正率25%までは不正Featureだけを除外する", async () => {
    const prepared = await prepareFeatureCollection(
      featureCollection([
        lineFeature([[130, 32], [131, 33]]),
        lineFeature([[130, 32.1], [131, 33.1]]),
        lineFeature([[130, 32.2], [131, 33.2]]),
        lineFeature([[999, 32], [131, 33]])
      ]),
      LAYER_KEYS.ETC,
      { cooperative: false }
    );
    expect(prepared.stats.invalidCount).toBe(1);
    expect(prepared.stats.uniqueCount).toBe(3);
  });

  test("不正率が25%を超えるデータを拒否する", async () => {
    await expect(
      prepareFeatureCollection(
        featureCollection([
          lineFeature([[130, 32], [131, 33]]),
          lineFeature([[999, 32], [131, 33]])
        ]),
        LAYER_KEYS.ETC,
        { cooperative: false }
      )
    ).rejects.toThrow("不正Featureが多すぎます");
  });

  test("中止済みsignalでは処理を開始しない", async () => {
    const controller = new AbortController();
    controller.abort();
    await expect(
      prepareFeatureCollection(
        featureCollection([lineFeature([[130, 32], [131, 33]])]),
        LAYER_KEYS.ETC,
        { cooperative: false, signal: controller.signal }
      )
    ).rejects.toMatchObject({ name: "AbortError" });
  });
});

describe("完全重複除去", () => {
  test("完全一致だけを除去し、同じgeometryの別属性を保持する", async () => {
    const coordinates = [[130.7, 32.7], [130.8, 32.8]];
    const prepared = await prepareFeatureCollection(
      featureCollection([
        lineFeature(coordinates, { name: "A", _color: "#990000", _weight: 10 }),
        lineFeature(coordinates, { _weight: 10, _color: "#990000", name: "A" }),
        lineFeature(coordinates, { name: "B", _color: "#999999", _weight: 10 })
      ]),
      LAYER_KEYS.ROAD,
      { cooperative: false }
    );
    expect(prepared.stats).toMatchObject({ uniqueCount: 2, duplicateCount: 1 });
    expect(prepared.features.map((feature) => feature.properties["名称"])).toEqual(["A", "B"]);
  });

  test("同じpropertiesでもgeometryが異なるFeatureを保持する", async () => {
    const properties = { _color: "#0000ff", _weight: 4 };
    const prepared = await prepareFeatureCollection(
      featureCollection([
        lineFeature([[130, 32], [131, 33]], properties),
        lineFeature([[130, 32.1], [131, 33.1]], properties)
      ]),
      LAYER_KEYS.ETC,
      { cooperative: false }
    );
    expect(prepared.stats.uniqueCount).toBe(2);
  });
});

describe("道路属性・スタイル正規化", () => {
  test("新旧フィールド名、欠損、日時の元文字列を正規化する", () => {
    const normalized = normalizeRoadProperties({
      name: "整理ID1",
      路線名: "国道57号",
      始点: "A",
      終点住所: "B",
      規制内容: "全面通行止め",
      規制開始_日時: "2026/8/3 14:00頃",
      延長_Km: "1.2"
    });
    expect(normalized).toMatchObject({
      始点: "A",
      終点: "B",
      規制内容: "全面通行止め",
      規制開始日時: "2026/8/3 14:00頃",
      "規制延長(km)": "1.2"
    });
    expect(normalized["規制理由"]).toBe("");
  });

  test("安全な配信スタイルを保持する", () => {
    expect(
      sanitizeStyle(
        { _color: "#ff9900", _opacity: 0.7, _weight: 8, _dashArray: "4, 2" },
        LAYER_KEYS.ETC
      )
    ).toEqual({ color: "#ff9900", opacity: 0.7, weight: 8, dashArray: "4 2" });
  });

  test("危険な色・透明度・線幅・破線を安全な範囲へ落とす", () => {
    expect(
      sanitizeStyle(
        {
          _color: "url(javascript:1)",
          _opacity: -2,
          _weight: 999,
          _dashArray: "1; background:url(x)"
        },
        LAYER_KEYS.ROAD
      )
    ).toEqual({ color: "#777777", opacity: 0, weight: 20, dashArray: "" });
  });

  test("SVGMapメタデータ用にHTMLとカンマをエスケープする", () => {
    expect(encodeSvgMapMetadata(["A,B", "<script>alert('x')</script>"])).toBe(
      "A&#x2c;B,&lt;script&gt;alert(&apos;x&apos;)&lt;/script&gt;"
    );
  });
});
