import { QTCTLayerRenderer } from "../../../../commonLib/QTCTLayerRenderer.js";
import { ShareCycleQtctRenderer } from "../shareCycleQtctRenderer.js";
import {
  PROPERTY_SCHEMA,
  buildStationDetailHtml,
  createQtctRecord,
  createStationTitle,
  resolveStationId
} from "../shareCyclePresentation.js";

function renderPoi(options = {}, Renderer = ShareCycleQtctRenderer) {
  const svgImage = document.implementation.createDocument(
    "http://www.w3.org/2000/svg",
    "svg",
    null
  );
  const renderer = new Renderer({
    svgMap: { getGeoViewBox: () => ({}) },
    svgImage,
    svgImageProps: { scale: 1 },
    layerID: "share-cycle-test",
    iconIdEvaluator: () => "p2",
    titleEvaluator: (metadata) => metadata[1],
    ...options
  });
  renderer.clientSideQTCT = {
    getTileSet: () => ({ test: true })
  };
  renderer.setQtctMapData({
    test: [[139.7, 35.6, ["station-1", "テストステーション"]]]
  });
  renderer.preRenderFunction();
  return { svgImage, renderer };
}

test("shareCycleGbfsではS-LaWA用のステーションIDを持つcircleを直接描画する", () => {
  const { svgImage } = renderPoi();
  const marker = svgImage.querySelector("circle");

  expect(marker).not.toBeNull();
  expect(marker.getAttribute("class")).toBe("clickable");
  expect(marker.getAttribute("data-station-id")).toBe("station-1");
  expect(marker.getAttribute("content")).toBe("station-1,テストステーション");
  expect(marker.getAttribute("fill")).toBe("rgb(22,163,74)");
  expect(marker.getAttribute("xlink:title")).toBe("テストステーション");
  expect(marker.getAttribute("transform")).toBe("ref(svg,13969.999999999998,-3560)");
  expect(svgImage.querySelector("use")).toBeNull();
});

test("共通レンダラー単体では従来どおりuse要素を描画する", () => {
  const { svgImage } = renderPoi({}, QTCTLayerRenderer);
  const marker = svgImage.querySelector("use");

  expect(marker).not.toBeNull();
  expect(marker.getAttribute("xlink:href")).toBe("#p2");
  expect(marker.getAttribute("content")).toBe("station-1,テストステーション");
});

describe("シェアサイクルのタイル更新", () => {
  test("再描画しても同じステーション・タイトルを重複生成しない", () => {
    const { svgImage, renderer } = renderPoi();
    const originalMarker = svgImage.querySelector("circle");

    renderer.preRenderFunction();
    renderer.preRenderFunction();

    expect(svgImage.querySelectorAll("g")).toHaveLength(1);
    expect(svgImage.querySelectorAll("circle")).toHaveLength(1);
    expect(svgImage.querySelector("circle")).toBe(originalMarker);
    expect(originalMarker.getAttribute("xlink:title")).toBe("テストステーション");
  });

  test("空き状況更新時に先頭タイルも削除して最新タイトルだけを残す", () => {
    const { svgImage, renderer } = renderPoi();
    renderer.titleEvaluator = () => "テストステーション（利用可能 2台）";

    renderer.removePrevTiles();
    expect(svgImage.querySelectorAll("circle")).toHaveLength(0);
    renderer.preRenderFunction();

    expect(svgImage.querySelectorAll("circle")).toHaveLength(1);
    expect(svgImage.querySelector("circle").getAttribute("xlink:title")).toBe(
      "テストステーション（利用可能 2台）"
    );
  });

  test("表示範囲外になった先頭タイルを残さない", () => {
    const { svgImage, renderer } = renderPoi();
    renderer.clientSideQTCT.getTileSet = () => ({});

    renderer.preRenderFunction();

    expect(svgImage.querySelectorAll("g")).toHaveLength(0);
    expect(svgImage.querySelectorAll("circle")).toHaveLength(0);
  });
});

test("タイル削除時もdefs・保護されたグループ・タイル以外のグループは維持する", () => {
  const { svgImage, renderer } = renderPoi();
  const defs = svgImage.createElement("defs");
  const icon = svgImage.createElement("g");
  icon.setAttribute("id", "p2");
  defs.appendChild(icon);
  svgImage.documentElement.insertBefore(defs, svgImage.documentElement.firstChild);
  const preserved = svgImage.createElement("g");
  preserved.setAttribute("id", "Tpreserved");
  preserved.setAttribute("data-preserve", "qtct-exclude");
  svgImage.documentElement.appendChild(preserved);
  const unrelated = svgImage.createElement("g");
  svgImage.documentElement.appendChild(unrelated);

  renderer.removePrevTiles();

  expect(svgImage.querySelectorAll("circle")).toHaveLength(0);
  expect(svgImage.querySelectorAll("g")).toHaveLength(3);
  expect(icon.parentNode).toBe(defs);
  expect(preserved.parentNode).toBe(svgImage.documentElement);
  expect(unrelated.parentNode).toBe(svgImage.documentElement);
});

test("複数マーカーでもカンマを含むステーションIDとタイトルを保持する", () => {
  const { svgImage, renderer } = renderPoi();
  renderer.removePrevTiles();
  renderer.setQtctMapData({
    test: [
      [139.7, 35.6, ["station,1", "名称,1"]],
      [139.8, 35.7, ["station-2", "名称2"]]
    ]
  });

  renderer.preRenderFunction();

  const markers = Array.from(svgImage.querySelectorAll("circle"));
  expect(markers.map((marker) => marker.getAttribute("data-station-id"))).toEqual([
    "station,1", "station-2"
  ]);
  expect(markers.map((marker) => marker.getAttribute("xlink:title"))).toEqual([
    "名称,1", "名称2"
  ]);
  expect(svgImage.querySelector("use")).toBeNull();
});

test("集約画像を再利用し、ポイントタイルとの切り替えで重複しない", () => {
  const { svgImage, renderer } = renderPoi();
  renderer.clientSideQTCT.getTileSet = () => ({ image: true });
  renderer.clientSideQTCT.getGeoBound = () => ({ x: 139, y: 35, width: 1, height: 2 });
  renderer.setQtctMapData({
    ...renderer.getQtctMapData(),
    image: "data:image/png;base64,test"
  });

  renderer.preRenderFunction();
  const image = svgImage.querySelector("image");
  renderer.preRenderFunction();

  expect(svgImage.querySelectorAll("g")).toHaveLength(1);
  expect(svgImage.querySelector("circle")).toBeNull();
  expect(svgImage.querySelector("image")).toBe(image);
  expect(image.getAttribute("xlink:href")).toBe("data:image/png;base64,test");
  expect(image.getAttribute("x")).toBe("13900");
  expect(image.getAttribute("y")).toBe("-3700");

  renderer.clientSideQTCT.getTileSet = () => ({ test: true });
  renderer.preRenderFunction();

  expect(svgImage.querySelectorAll("circle")).toHaveLength(1);
  expect(svgImage.querySelectorAll("g")).toHaveLength(1);
  expect(svgImage.querySelector("image")).toBeNull();
});

test("S-LaWAの差分同期向けにタイルを追加してからcircleを追加する", () => {
  const { svgImage, renderer } = renderPoi();
  renderer.removePrevTiles();
  const observer = new MutationObserver(() => {});
  observer.observe(svgImage.documentElement, { childList: true, subtree: true });

  renderer.preRenderFunction();
  const records = observer.takeRecords();
  observer.disconnect();

  expect(records).toHaveLength(2);
  for (const record of records) {
    expect(record.removedNodes).toHaveLength(0);
    expect(record.addedNodes).toHaveLength(1);
  }
  const tile = records[0].addedNodes[0];
  expect(records[0].target).toBe(svgImage.documentElement);
  expect(tile.nodeName).toBe("g");
  expect(records[1].target).toBe(tile);
  expect(records[1].addedNodes[0].nodeName).toBe("circle");
  expect(tile.querySelectorAll("circle")).toHaveLength(1);
  expect(tile.querySelector("use")).toBeNull();
});

test("QTCTメタデータの項目順をproperty定義と揃える", () => {
  const station = {
    id: "station-1",
    name: "富山駅",
    address: "富山市",
    capacity: 12,
    lon: 137.2,
    lat: 36.7
  };
  const provider = { sourceName: "提供元", systemId: "toyama" };

  expect(PROPERTY_SCHEMA).toEqual([
    "ステーションID",
    "名称",
    "住所",
    "収容台数",
    "提供元",
    "システムID"
  ]);
  expect(createQtctRecord(station, provider)).toEqual([
    137.2,
    36.7,
    "station-1",
    "富山駅",
    "富山市",
    12,
    "提供元",
    "toyama"
  ]);
});

test("詳細対象IDはS-LaWA用属性を優先し、通常マーカーのcontentにも対応する", () => {
  const target = {
    getAttribute: (name) =>
      name === "data-station-id" ? "direct-marker" : "legacy-marker,名称"
  };
  const legacyTarget = {
    getAttribute: (name) => (name === "content" ? "legacy-marker,名称" : "")
  };

  expect(resolveStationId(target)).toBe("direct-marker");
  expect(resolveStationId(legacyTarget)).toBe("legacy-marker");
});

test("タイトルと詳細HTMLを状態から生成し、外部値をエスケープする", () => {
  const station = {
    id: "station-1",
    name: "<script>駅</script>",
    address: "A&B",
    capacity: 10,
    rentalUrl: "https://example.com/?a=1&b=2"
  };
  const status = {
    available: 4,
    docksAvailable: 6,
    renting: true,
    returning: false,
    installed: true,
    lastReported: 1700000000
  };
  const statuses = new Map([[station.id, status]]);
  const provider = { sourceName: "提供<元>" };

  expect(createStationTitle([station.id, station.name], statuses)).toBe(
    "<script>駅</script>（利用可能 4台）"
  );
  const html = buildStationDetailHtml(station, status, provider);
  expect(html).toContain("&lt;script&gt;駅&lt;/script&gt;");
  expect(html).toContain("A&amp;B");
  expect(html).toContain("提供&lt;元&gt;");
  expect(html).toContain("https://example.com/?a=1&amp;b=2");
  expect(html).not.toContain("<script>");
});
