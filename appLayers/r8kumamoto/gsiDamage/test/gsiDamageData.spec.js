// License: (MPL v2)
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.

import {
  GSI_LAYERS,
  chooseZoom,
  expandTileUrl,
  intersectView,
  isAllowedGsiUrl,
  parseGsiDamagePage,
  representativeTileUrl,
  tileBounds,
  tileForPoint,
  tilesForView
} from "../gsiDamageData.js";

describe("gsiDamageData", () => {
  test("許可対象を熊本地震の地理院タイルに限定する", () => {
    expect(isAllowedGsiUrl("https://maps.gsi.go.jp/xyz/20260729kumamoto_x/2/3/1.geojson")).toBe(false);
    expect(isAllowedGsiUrl("https://maps.gsi.go.jp/xyz/20260806kumamoto_newarea_0806do/18/226010/105969.png")).toBe(true);
    expect(isAllowedGsiUrl("https://maps.gsi.go.jp/xyz/std/2/3/1.png")).toBe(false);
    expect(isAllowedGsiUrl("https://example.com/xyz/20260729kumamoto_x/2/3/1.geojson")).toBe(false);
    expect(GSI_LAYERS.every((layer) => layer.kind === "raster" && isAllowedGsiUrl(layer.url))).toBe(true);
  });

  test("ズーム値を配信範囲に収める", () => {
    expect(chooseZoom(0, 10, 18)).toBe(10);
    expect(chooseZoom(1024, 10, 18)).toBe(17);
    expect(chooseZoom(1e9, 10, 18)).toBe(18);
  });

  test("表示範囲から有限個のタイルを作る", () => {
    const tiles = tilesForView({ x: 130.5, y: 32.4, width: 0.2, height: 0.2 }, 12);
    expect(tiles.length).toBeGreaterThan(0);
    expect(tiles.length).toBeLessThan(30);
    expect(expandTileUrl("https://a/{z}/{x}/{y}.png", tiles[0])).toMatch(/12\/\d+\/\d+\.png$/);
    expect(tileBounds(3533, 1657, 12).north).toBeGreaterThan(tileBounds(3533, 1657, 12).south);
  });

  test("掲載ページの中心座標から取得確認用の代表タイルを作る", () => {
    expect(tileForPoint(32.840366, 130.755157, 14)).toMatchObject({ x: 14142, y: 6608, zoom: 14 });
    expect(representativeTileUrl({
      kind: "raster",
      url: "https://maps.gsi.go.jp/xyz/20260729kumamoto_kumamoto1_0803do/{z}/{x}/{y}.png",
      minZoom: 10,
      maxZoom: 18,
      center: { lat: 32.840366, lng: 130.755157 }
    })).toBe("https://maps.gsi.go.jp/xyz/20260729kumamoto_kumamoto1_0803do/14/14142/6608.png");
  });

  test("配信範囲外ではタイル要求を作らない", () => {
    const bounds = { west: 130.5, east: 130.8, south: 32.5, north: 32.8 };
    expect(intersectView({ x: 134, y: 35, width: 1, height: 1 }, bounds)).toBeNull();
    expect(intersectView({ x: 130.6, y: 32.6, width: 1, height: 1 }, bounds)).toEqual({ x: 130.6, y: 32.6, width: expect.any(Number), height: expect.any(Number) });
  });

  test("掲載ページから正射画像だけを動的に抽出する", () => {
    const html = `
      <div class="base_txt">
        ○八代地区（熊本県八代市）（7/29撮影）<br>
        <a href="https://maps.gsi.go.jp/#12/32.445464/130.584183/&amp;base=std&amp;ls=std%7C20260729kumamoto_yatsushiro_0729do">閲覧</a><br>
        ○熊本１地区（熊本県熊本市）（8/3撮影）<br>
        <a href="https://maps.gsi.go.jp/#12/32.840366/130.755157/&amp;base=std&amp;ls=std%7C20260729kumamoto_kumamoto1_0803do">閲覧</a><br>
        ○垂直写真（8/3撮影）<br>
        <a href="https://maps.gsi.go.jp/#12/32.8/130.7/&amp;base=std&amp;ls=std%7C20260729kumamoto_kumamoto1_0803suichoku">閲覧</a>
      </div>
      <div class="base_txt">
        <strong>○令和8年7月30日発表</strong><br>
        八代地区（7/29撮影の空中写真から7/29判読）<br>
        <a href="https://maps.gsi.go.jp/#11/32.411270/130.634308/&amp;base=std&amp;ls=std%7C20260729kumamoto_syamenhoukai_dosekiryu_taiseki_yatsushiro">閲覧</a><br>
        <strong>○令和8年8月4日発表</strong><br>
        熊本３地区（7/31、8/1撮影の空中写真から8/4判読）<br>
        <a href="https://maps.gsi.go.jp/#12/32.684411/130.693609/&amp;base=std&amp;ls=std%7C20260729kumamoto_syamenhoukai_taiseki_kumamoto3">閲覧</a>
      </div>`;
    const layers = parseGsiDamagePage(html);
    expect(layers.map((layer) => layer.id)).toEqual([
      "20260729kumamoto_kumamoto1_0803do",
      "20260729kumamoto_yatsushiro_0729do"
    ]);
    expect(layers[0]).toMatchObject({
      kind: "raster",
      title: "正射画像 熊本1地区（8/3撮影）",
      updated: "2026-08-03",
      center: { lat: 32.840366, lng: 130.755157 }
    });
    expect(layers.every((layer) => layer.kind === "raster")).toBe(true);
  });

  test("斜面レイヤーがなくても正射画像を抽出できる", () => {
    const html = `<div class="base_txt">○熊本４地区（7/30撮影）<br>
      <a href="https://maps.gsi.go.jp/#12/32.611616/130.660400/&amp;base=std&amp;ls=std%7C20260729kumamoto_kumamoto4_0730do">閲覧</a></div>`;
    expect(parseGsiDamagePage(html)).toHaveLength(1);
  });

  test("掲載ページに対象レイヤーが不足する場合は拒否する", () => {
    expect(() => parseGsiDamagePage("<p>対象データなし</p>")).toThrow("正射画像");
  });
});
