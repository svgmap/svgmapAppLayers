// License: MPL-2.0
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.

const XLINK_NAMESPACE = "http://www.w3.org/1999/xlink";

export function bboxIntersects(bounds, viewBox) {
  const right = viewBox.x + viewBox.width;
  const top = viewBox.y + viewBox.height;
  return !(
    bounds[2] < viewBox.x ||
    bounds[0] > right ||
    bounds[3] < viewBox.y ||
    bounds[1] > top
  );
}

export function geoToPixel(longitude, latitude, viewBox, width, height) {
  return [
    ((longitude - viewBox.x) / viewBox.width) * width,
    ((viewBox.y + viewBox.height - latitude) / viewBox.height) * height
  ];
}

export function createLineGridIndex(features, gridSize = 48) {
  if (!features.length) {
    return { features, cells: new Map(), bounds: null, gridSize };
  }
  const bounds = [Infinity, Infinity, -Infinity, -Infinity];
  for (const feature of features) {
    const bbox = feature.bbox;
    bounds[0] = Math.min(bounds[0], bbox[0]);
    bounds[1] = Math.min(bounds[1], bbox[1]);
    bounds[2] = Math.max(bounds[2], bbox[2]);
    bounds[3] = Math.max(bounds[3], bbox[3]);
  }
  const spanX = Math.max(Number.EPSILON, bounds[2] - bounds[0]);
  const spanY = Math.max(Number.EPSILON, bounds[3] - bounds[1]);
  const cells = new Map();
  features.forEach((feature, featureIndex) => {
    const [minX, minY, maxX, maxY] = feature.bbox;
    const x0 = cellCoordinate(minX, bounds[0], spanX, gridSize);
    const x1 = cellCoordinate(maxX, bounds[0], spanX, gridSize);
    const y0 = cellCoordinate(minY, bounds[1], spanY, gridSize);
    const y1 = cellCoordinate(maxY, bounds[1], spanY, gridSize);
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const key = `${x}:${y}`;
        const entries = cells.get(key);
        if (entries) entries.push(featureIndex);
        else cells.set(key, [featureIndex]);
      }
    }
  });
  return { features, cells, bounds, gridSize, spanX, spanY };
}

export function queryLineGridIndex(index, viewBox, paddingRatio = 0.02) {
  if (!index.bounds || viewBox.width <= 0 || viewBox.height <= 0) return [];
  const padded = {
    x: viewBox.x - viewBox.width * paddingRatio,
    y: viewBox.y - viewBox.height * paddingRatio,
    width: viewBox.width * (1 + paddingRatio * 2),
    height: viewBox.height * (1 + paddingRatio * 2)
  };
  if (!bboxIntersects(index.bounds, padded)) return [];
  const x0 = cellCoordinate(padded.x, index.bounds[0], index.spanX, index.gridSize);
  const x1 = cellCoordinate(
    padded.x + padded.width,
    index.bounds[0],
    index.spanX,
    index.gridSize
  );
  const y0 = cellCoordinate(padded.y, index.bounds[1], index.spanY, index.gridSize);
  const y1 = cellCoordinate(
    padded.y + padded.height,
    index.bounds[1],
    index.spanY,
    index.gridSize
  );
  const candidates = new Set();
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      for (const featureIndex of index.cells.get(`${x}:${y}`) || []) {
        candidates.add(featureIndex);
      }
    }
  }
  return [...candidates]
    .map((featureIndex) => index.features[featureIndex])
    .filter((feature) => bboxIntersects(feature.bbox, padded));
}

export function fitCanvasSize(canvasSize, options = {}) {
  const cssWidth = Math.max(1, Number(canvasSize?.width) || 1);
  const cssHeight = Math.max(1, Number(canvasSize?.height) || 1);
  const pixelRatio = Math.min(options.maxPixelRatio || 1.5, options.pixelRatio || 1);
  let width = cssWidth * pixelRatio;
  let height = cssHeight * pixelRatio;
  const maxDimension = options.maxDimension || 1600;
  const maxPixels = options.maxPixels || 2200000;
  const dimensionScale = Math.min(1, maxDimension / width, maxDimension / height);
  width *= dimensionScale;
  height *= dimensionScale;
  const pixelScale = Math.min(1, Math.sqrt(maxPixels / (width * height)));
  width = Math.max(1, Math.round(width * pixelScale));
  height = Math.max(1, Math.round(height * pixelScale));
  return { width, height, lineScale: width / cssWidth };
}

export class LineRasterRenderer {
  constructor(options) {
    this.svgImage = options.svgImage;
    this.svgMap = options.svgMap;
    this.imageId = options.imageId;
    this.features = [];
    this.index = createLineGridIndex([]);
    this.visible = true;
    this.dataRevision = 0;
    this.lastRenderKey = "";
  }

  setData(features) {
    this.features = features || [];
    this.index = createLineGridIndex(this.features);
    this.dataRevision++;
    this.lastRenderKey = "";
    if (!this.features.length) this.clearImage();
  }

  setVisible(visible) {
    this.visible = Boolean(visible);
    const image = this.getImageElement();
    if (image) image.setAttribute("visibility", this.visible ? "visible" : "hidden");
    if (this.visible) this.lastRenderKey = "";
  }

  render(viewBox, canvasSize) {
    if (!this.visible || !this.features.length) return { visibleCount: 0, skipped: true };
    const fitted = fitCanvasSize(canvasSize, {
      pixelRatio: globalThis.devicePixelRatio || 1,
      maxPixelRatio: 1.5,
      maxDimension: 1600,
      maxPixels: 2200000
    });
    const renderKey = [
      this.dataRevision,
      viewBox.x.toFixed(7),
      viewBox.y.toFixed(7),
      viewBox.width.toFixed(7),
      viewBox.height.toFixed(7),
      fitted.width,
      fitted.height
    ].join(":");
    if (renderKey === this.lastRenderKey) return { skipped: true };

    const startedAt = performanceNow();
    const visibleFeatures = queryLineGridIndex(this.index, viewBox);
    const canvas = document.createElement("canvas");
    canvas.width = fitted.width;
    canvas.height = fitted.height;
    const context = canvas.getContext("2d", { alpha: true });
    if (!context) throw new Error("Canvas 2Dを初期化できません");
    context.lineCap = "round";
    context.lineJoin = "round";

    let previousStyleKey = "";
    for (const feature of visibleFeatures) {
      const style = feature.properties._style;
      const styleKey = `${style.color}:${style.opacity}:${style.weight}:${style.dashArray}`;
      if (styleKey !== previousStyleKey) {
        context.strokeStyle = style.color;
        context.globalAlpha = style.opacity;
        context.lineWidth = Math.max(0.5, style.weight * fitted.lineScale);
        context.setLineDash(parseDashArray(style.dashArray, fitted.lineScale));
        previousStyleKey = styleKey;
      }
      const coordinates = feature.geometry.coordinates;
      context.beginPath();
      coordinates.forEach(([longitude, latitude], index) => {
        const [x, y] = geoToPixel(
          longitude,
          latitude,
          viewBox,
          fitted.width,
          fitted.height
        );
        if (index === 0) context.moveTo(x, y);
        else context.lineTo(x, y);
      });
      context.stroke();
    }

    const image = this.getImageElement();
    image.setAttributeNS(XLINK_NAMESPACE, "xlink:href", canvas.toDataURL("image/png"));
    image.setAttribute("x", String(viewBox.x * 100));
    image.setAttribute("y", String(-(viewBox.y + viewBox.height) * 100));
    image.setAttribute("width", String(viewBox.width * 100));
    image.setAttribute("height", String(viewBox.height * 100));
    image.setAttribute("visibility", "visible");
    image.setAttribute("preserveAspectRatio", "none");
    this.lastRenderKey = renderKey;
    return {
      skipped: false,
      visibleCount: visibleFeatures.length,
      width: fitted.width,
      height: fitted.height,
      durationMs: performanceNow() - startedAt
    };
  }

  clearImage() {
    const image = this.getImageElement();
    if (!image) return;
    image.removeAttributeNS(XLINK_NAMESPACE, "href");
    image.removeAttribute("xlink:href");
    image.setAttribute("visibility", "hidden");
    this.lastRenderKey = "";
  }

  destroy() {
    this.features = [];
    this.index = createLineGridIndex([]);
    this.clearImage();
  }

  getImageElement() {
    const image = this.svgImage.getElementById(this.imageId);
    if (!image) throw new Error(`画像要素がありません: ${this.imageId}`);
    return image;
  }
}

function cellCoordinate(value, origin, span, gridSize) {
  const coordinate = Math.floor(((value - origin) / span) * gridSize);
  return Math.max(0, Math.min(gridSize - 1, coordinate));
}

function parseDashArray(value, scale) {
  if (!value) return [];
  return value
    .split(/[ ,]+/)
    .map(Number)
    .filter((part) => Number.isFinite(part) && part >= 0)
    .map((part) => part * scale);
}

function performanceNow() {
  return globalThis.performance?.now?.() ?? Date.now();
}

