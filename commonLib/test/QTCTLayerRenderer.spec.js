import { QTCTLayerRenderer } from "../QTCTLayerRenderer.js";

function createRenderer() {
  const svgImage = document.implementation.createDocument(
    "http://www.w3.org/2000/svg",
    "svg",
    null
  );
  const renderer = new QTCTLayerRenderer({
    svgImage,
    svgMap: { getGeoViewBox: () => ({}) },
    svgImageProps: { scale: 1 },
    titleEvaluator: (metadata) => metadata[0]
  });
  renderer.clientSideQTCT = {
    getTileSet: () => ({ "1_0_0": true })
  };
  renderer.setQtctMapData({
    "1_0_0": [[139.7, 35.6, ["東京"]]],
    "1_1_0": [[135.5, 34.7, ["大阪"]]]
  });
  return { svgImage, renderer };
}

test("先頭のgが必要なタイルなら、再描画でタイルとPOIを再利用する", () => {
  const { svgImage, renderer } = createRenderer();
  renderer.preRenderFunction();
  const tile = svgImage.documentElement.firstElementChild;
  const poi = tile.firstElementChild;

  renderer.preRenderFunction();
  renderer.preRenderFunction();

  expect(svgImage.documentElement.children).toHaveLength(1);
  expect(svgImage.documentElement.firstElementChild).toBe(tile);
  expect(svgImage.querySelectorAll("use")).toHaveLength(1);
  expect(svgImage.querySelector("use")).toBe(poi);
});

test("全消去すると先頭のタイルを含めて削除する", () => {
  const { svgImage, renderer } = createRenderer();
  renderer.clientSideQTCT.getTileSet = () => ({ "1_0_0": true, "1_1_0": true });
  renderer.preRenderFunction();

  renderer.removePrevTiles();

  expect(svgImage.documentElement.children).toHaveLength(0);
});

test("表示範囲を変えると不要な先頭タイルだけを削除する", () => {
  const { svgImage, renderer } = createRenderer();
  renderer.clientSideQTCT.getTileSet = () => ({ "1_0_0": true, "1_1_0": true });
  renderer.preRenderFunction();
  const remainingTile = svgImage.getElementById("T1_1_0");
  renderer.clientSideQTCT.getTileSet = () => ({ "1_1_0": true });

  renderer.preRenderFunction();

  expect(svgImage.documentElement.children).toHaveLength(1);
  expect(svgImage.documentElement.firstElementChild).toBe(remainingTile);
  expect(svgImage.querySelector("use").getAttribute("xlink:title")).toBe("大阪");
});

test.each([
  ["全消去", undefined],
  ["表示範囲更新", { "1_1_0": true }]
])("%sでもdefs・補助図形・保護指定を持つグループを保持する", (_, tileSet) => {
  const { svgImage, renderer } = createRenderer();
  svgImage.documentElement.innerHTML = `
    <defs><g id="p0"><g><path d="M0,0 L1,1" /></g></g></defs>
    <g id="complexFeatures" data-preserve="qtct-exclude">
      <g><path d="M0,0 L2,2" /></g>
    </g>
    <g id="Tpreserved" data-preserve="qtct-exclude"><g /></g>
    <g id="meshRects"><g id="Tnested" /></g>
    <g><path d="M0,0 L3,3" /></g>
  `;
  const preserved = Array.from(svgImage.documentElement.children);
  const originalMarkup = preserved.map((element) => element.outerHTML);
  const tile = svgImage.createElement("g");
  tile.setAttribute("id", "T1_0_0");
  svgImage.documentElement.appendChild(tile);

  expect(() => renderer.removePrevTiles(tileSet)).not.toThrow();

  expect(tile.parentNode).toBeNull();
  expect(Array.from(svgImage.documentElement.children)).toEqual(preserved);
  expect(preserved.map((element) => element.outerHTML)).toEqual(originalMarkup);
});
