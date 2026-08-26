import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { JSDOM } from "jsdom";

const layerDirectory = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  ".."
);

function createTestWindow(){
  const svgText = fs.readFileSync(
    path.join(layerDirectory, "accessibilityInformationJR.svg"),
    "utf8"
  );
  const svgDom = new JSDOM(svgText, {
    contentType: "image/svg+xml"
  });
  const controllerDom = new JSDOM("<!doctype html><body></body>", {
    runScripts: "outside-only"
  });
  const windowObject = controllerDom.window;
  windowObject.svgImage = svgDom.window.document;
  windowObject.svgMap = {
    refreshScreen(){}
  };
  windowObject.layerID = "test-layer";
  windowObject.eval(
    fs.readFileSync(
      path.join(layerDirectory, "accessibilityInformationJR.js"),
      "utf8"
    )
  );

  return {
    windowObject,
    svgDocument: svgDom.window.document
  };
}

test("標準詳細ダイアログ用の情報をuse要素に保持する", () => {
  const { windowObject, svgDocument } = createTestWindow();
  const rows = [
    ["鉄道事業者名", "鉄道駅の名称", "路線名", "単位", "段差への対応", "緯度", "経度"],
    ["テスト鉄道", "東京", "中央", "線", "○", "35.6812", "139.7671"]
  ];

  windowObject.drawStations(rows);

  const mapContents = svgDocument.getElementById("mapContents");
  const useElement = mapContents.querySelector("use");
  assert.ok(useElement);
  assert.equal(useElement.getAttribute("xlink:href"), "#stationStepFree");
  assert.equal(useElement.getAttribute("data-title"), "東京駅 (中央線)");
  assert.equal(useElement.getAttribute("xlink:title"), "東京駅 (中央線)");
  assert.equal(
    useElement.getAttribute("content"),
    "テスト鉄道,東京,中央,○,35.6812,139.7671"
  );
  assert.equal(
    useElement.getAttribute("transform"),
    "ref(svg,139.7671,-35.6812)"
  );
});

test("S-LaWAで情報が失われる独自詳細コールバックを登録しない", () => {
  const scriptText = fs.readFileSync(
    path.join(layerDirectory, "accessibilityInformationJR.js"),
    "utf8"
  );
  assert.doesNotMatch(scriptText, /setShowPoiProperty\s*\(/);
});
