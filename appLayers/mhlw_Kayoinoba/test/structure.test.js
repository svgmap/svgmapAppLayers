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
const repositoryDirectory = path.resolve(layerDirectory, "../..");

test("SVG・HTML・Container参照が有効である", () => {
  const svgText = fs.readFileSync(
    path.join(layerDirectory, "kayoinoba.svg"),
    "utf8"
  );
  const svgDom = new JSDOM(svgText, { contentType: "image/svg+xml" });
  const svgRoot = svgDom.window.document.documentElement;
  assert.match(svgRoot.getAttribute("data-controller"), /^kayoinoba\.html#/);
  assert.equal(
    svgRoot.querySelector("globalCoordinateSystem")?.getAttribute("srsName"),
    "http://purl.org/crs/84"
  );
  for (let index = 0; index < 7; index += 1) {
    assert.ok(svgRoot.querySelector(`#p${index}`));
  }

  const containerText = fs.readFileSync(
    path.join(repositoryDirectory, "Container.svg"),
    "utf8"
  );
  const containerDom = new JSDOM(containerText, {
    contentType: "image/svg+xml"
  });
  const entries = [
    ...containerDom.window.document.querySelectorAll("animation")
  ].filter(
    (entry) =>
      entry.getAttribute("xlink:href") ===
      "./appLayers/mhlw_Kayoinoba/kayoinoba.svg"
  );
  assert.equal(entries.length, 1);
  assert.equal(entries[0].getAttribute("title"), "厚労省 通いの場");
  assert.equal(entries[0].getAttribute("class"), "poi clickable");
  assert.equal(
    entries[0].getAttribute("data-cross-origin-proxy-required"),
    "true"
  );
});

test("UIのフォーム、状態、外部リンクがアクセシブルである", () => {
  const htmlText = fs.readFileSync(
    path.join(layerDirectory, "kayoinoba.html"),
    "utf8"
  );
  const documentObject = new JSDOM(htmlText).window.document;
  assert.equal(
    documentObject.querySelector(
      'script[src*="svgmapjs"][src$="svgMapLayerLib.js"]'
    ) !== null,
    true
  );
  assert.equal(
    documentObject.querySelector('script[type="module"][src="./kayoinoba.js"]') !==
      null,
    true
  );
  assert.equal(documentObject.querySelector("#status")?.getAttribute("role"), "status");
  assert.equal(
    documentObject.querySelector("#status")?.getAttribute("aria-live"),
    "polite"
  );
  for (const control of documentObject.querySelectorAll("input, select")) {
    assert.ok(control.id, "フォーム要素にはidが必要です");
    assert.ok(
      documentObject.querySelector(`label[for="${control.id}"]`),
      `${control.id}のlabelが必要です`
    );
  }
  for (const link of documentObject.querySelectorAll('a[target="_blank"]')) {
    const rel = new Set((link.getAttribute("rel") || "").split(/\s+/));
    assert.ok(rel.has("noopener"));
    assert.ok(rel.has("noreferrer"));
  }
});

test("コントローラーはlayerWebAppReadyと終了処理を備えparentへ依存しない", () => {
  const scriptText = fs.readFileSync(
    path.join(layerDirectory, "kayoinoba.js"),
    "utf8"
  );
  assert.match(scriptText, /layerWebAppReady/);
  assert.match(scriptText, /beforeunload/);
  assert.match(scriptText, /AbortController/);
  assert.doesNotMatch(scriptText, /window\.parent/);
  for (const fileName of [
    "kayoinoba.svg",
    "kayoinoba.html",
    "kayoinoba.js",
    "kayoinobaCore.js",
    "README.md"
  ]) {
    assert.equal(fs.existsSync(path.join(layerDirectory, fileName)), true);
  }
});
