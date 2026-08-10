// License: MPL-2.0

import { describe, expect, test } from "@jest/globals";
import {
  bboxIntersects,
  createLineGridIndex,
  fitCanvasSize,
  geoToPixel,
  queryLineGridIndex
} from "../r8KumamotoRasterRenderer.js";

function feature(id, bbox) {
  return {
    id,
    bbox,
    geometry: { type: "LineString", coordinates: [] },
    properties: { _style: {} }
  };
}

describe("bboxと空間索引", () => {
  test("bboxの境界を交差として扱い、離れた範囲を除外する", () => {
    const viewBox = { x: 130, y: 32, width: 1, height: 1 };
    expect(bboxIntersects([131, 33, 132, 34], viewBox)).toBe(true);
    expect(bboxIntersects([132, 34, 133, 35], viewBox)).toBe(false);
  });

  test("表示範囲内の線だけを取得する", () => {
    const inside = feature("inside", [130.2, 32.2, 130.4, 32.4]);
    const outside = feature("outside", [135, 35, 136, 36]);
    const index = createLineGridIndex([inside, outside], 8);
    expect(queryLineGridIndex(index, { x: 130, y: 32, width: 1, height: 1 }, 0)).toEqual([
      inside
    ]);
  });

  test("表示範囲の少量の余白に入る線を取得する", () => {
    const near = feature("near", [131.01, 32.2, 131.015, 32.3]);
    const index = createLineGridIndex([near], 8);
    expect(queryLineGridIndex(index, { x: 130, y: 32, width: 1, height: 1 }, 0)).toEqual([]);
    expect(queryLineGridIndex(index, { x: 130, y: 32, width: 1, height: 1 }, 0.02)).toEqual([
      near
    ]);
  });

  test("パン後のviewBoxごとに対象集合が変わる", () => {
    const west = feature("west", [130.1, 32.1, 130.2, 32.2]);
    const east = feature("east", [132.1, 32.1, 132.2, 32.2]);
    const index = createLineGridIndex([west, east], 8);
    expect(queryLineGridIndex(index, { x: 130, y: 32, width: 1, height: 1 }, 0)).toEqual([
      west
    ]);
    expect(queryLineGridIndex(index, { x: 132, y: 32, width: 1, height: 1 }, 0)).toEqual([
      east
    ]);
  });

  test("空の索引は常に空配列を返す", () => {
    expect(
      queryLineGridIndex(createLineGridIndex([]), { x: 130, y: 32, width: 1, height: 1 })
    ).toEqual([]);
  });
});

describe("ラスタ座標とサイズ", () => {
  test("CRS84座標をCanvasのY反転座標へ変換する", () => {
    const viewBox = { x: 130, y: 32, width: 2, height: 1 };
    expect(geoToPixel(130, 33, viewBox, 1000, 500)).toEqual([0, 0]);
    expect(geoToPixel(132, 32, viewBox, 1000, 500)).toEqual([1000, 500]);
  });

  test("Canvasの辺長と総ピクセル数を上限内へ収める", () => {
    const size = fitCanvasSize(
      { width: 4000, height: 3000 },
      { pixelRatio: 2, maxPixelRatio: 1.5, maxDimension: 1600, maxPixels: 2200000 }
    );
    expect(size.width).toBeLessThanOrEqual(1600);
    expect(size.height).toBeLessThanOrEqual(1600);
    expect(size.width * size.height).toBeLessThanOrEqual(2200000);
  });
});
