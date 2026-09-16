import { jest } from "@jest/globals";
import { QTCTLayerRenderer } from "../QTCTLayerRenderer.js";
import { csvCodec, parseCsvRow } from "../parseCsv.js";

const key = "00_0_0";
const schema = { lngCol: 0, latCol: 1, titleCol: 2, defaultIconNumber: 0, property: ["lng", "lat", "name"] };
const points = [[139.7, 35.68, ["A,B", 'x"y\nz']]];
function deferred() {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
function createRenderer(Renderer = QTCTLayerRenderer, options = {}) {
  const svgImage = new DOMParser().parseFromString('<svg xmlns="http://www.w3.org/2000/svg"><defs><g id="p0"/></defs><g id="Tkeep" data-preserve="qtct-exclude"/></svg>', "image/svg+xml");
  return new Renderer({ csvCodec, svgImage, svgMap: { refreshScreen: jest.fn(), getGeoViewBox: () => ({ x: 139, y: 35, width: 1, height: 1 }) }, svgImageProps: { scale: 1 }, titleEvaluator: m => m[1], ...options });
}
function setZip(renderer, entry) {
  renderer.isZipMode = true;
  renderer.csvSchema = schema;
  renderer.qtctMapData = { tileIndex: { [key]: true }, csvSchema: schema };
  renderer.zipArchive = { entries: { [key]: entry } };
  renderer.clientSideQTCT.init(renderer.qtctMapData);
}
afterEach(() => jest.restoreAllMocks());

test("ZIP取得中のclearDataは古い結果を破棄しロックを残さない", async () => {
  const renderer = createRenderer();
  const download = deferred();
  setZip(renderer, { json: () => download.promise });
  const pending = renderer.renderAsyncTile(key);
  renderer.clearData();
  download.resolve(points);
  await expect(pending).resolves.toBeUndefined();
  expect(renderer.qtctMapData).toBeNull();
  expect(renderer.isZipMode).toBe(false);
  expect(renderer.zipArchive).toBeNull();
  expect(renderer.loadingTiles).toEqual({});
  expect(renderer.svgImage.querySelector("use")).toBeNull();
  expect(renderer.svgMap.refreshScreen).not.toHaveBeenCalled();
});

test("古いZIPの完了は新しい同名タイルのロックも結果も変更しない", async () => {
  const renderer = createRenderer();
  const old = deferred(), current = deferred();
  setZip(renderer, { json: () => old.promise });
  const a = renderer.renderAsyncTile(key);
  renderer.reset();
  setZip(renderer, { json: () => current.promise });
  const b = renderer.renderAsyncTile(key);
  old.resolve(points);
  await a;
  expect(renderer.loadingTiles[key]).toBe(true);
  expect(renderer.qtctMapData[key]).toBeUndefined();
  current.resolve([[139, 35, ["new", "新地点"]]]);
  await b;
  expect(renderer.loadingTiles).toEqual({});
  expect(renderer.svgImage.querySelector("use").getAttribute("xlink:title")).toBe("新地点");
});

test("存在しないタイルや読込失敗はロックせず、再試行できる", async () => {
  jest.spyOn(console, "warn").mockImplementation(() => {});
  const renderer = createRenderer();
  await renderer.renderAsyncTile(key);
  expect(renderer.loadingTiles).toEqual({});
  const json = jest.fn().mockRejectedValueOnce(new Error("network")).mockResolvedValue(points);
  setZip(renderer, { json });
  await renderer.renderAsyncTile(key);
  expect(renderer.loadingTiles).toEqual({});
  await renderer.renderAsyncTile(key);
  expect(parseCsvRow(renderer.svgImage.querySelector("use").getAttribute("content"))).toEqual(points[0][2]);
});

test("POIコールバック失敗でも部分タイルとロックが残らない", async () => {
  jest.spyOn(console, "warn").mockImplementation(() => {});
  const renderer = createRenderer(QTCTLayerRenderer, { createPoi: () => { throw new Error("marker"); } });
  setZip(renderer, { json: async () => points });
  await renderer.renderAsyncTile(key);
  expect(renderer.loadingTiles).toEqual({});
  expect(renderer.svgImage.getElementById("T" + key)).toBeNull();
});

test("POI生成だけを差し替えてZIP共通描画・属性・後始末を利用できる", async () => {
  const renderer = createRenderer(QTCTLayerRenderer, {
    createPoi: ({ svgImage, metadata }) => {
      const circle = svgImage.createElement("circle");
      circle.setAttribute("data-id", metadata[0]);
      return circle;
    }
  });
  setZip(renderer, { json: async () => points });
  await renderer.renderAsyncTile(key);
  const marker = renderer.svgImage.querySelector("circle");
  expect(marker.getAttribute("data-id")).toBe("A,B");
  expect(parseCsvRow(marker.getAttribute("content"))).toEqual(points[0][2]);
  renderer.reset();
  expect(renderer.svgImage.querySelector("circle")).toBeNull();
  expect(renderer.svgImage.querySelector("defs")).not.toBeNull();
  expect(renderer.svgImage.getElementById("Tkeep")).not.toBeNull();
});

test("QTCT構築は元配列を変更せず、古い構築で新データを上書きしない", async () => {
  jest.spyOn(console, "log").mockImplementation(() => {});
  const renderer = createRenderer();
  const oldRows = [[139.7, 35.68, "旧地点"]];
  const newRows = [[139.8, 35.69, "新地点"]];
  const a = renderer.buildQTCTdata(oldRows, schema, undefined, true);
  const b = renderer.buildQTCTdata(newRows, schema, undefined, true);
  expect(await a).toBe(false);
  expect(await b).toBe(true);
  expect(oldRows[0]).toEqual([139.7, 35.68, "旧地点"]);
  expect(newRows[0]).toEqual([139.8, 35.69, "新地点"]);
  expect(renderer.qtctMapData[key][0][2]).toEqual(["新地点"]);
});
