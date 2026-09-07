// License: (MPL v2)
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.

import { getProvider } from "./gbfsProviders.js";
import { ShareCycleApp } from "./shareCycleApp.js";

let app = null;

window.addEventListener("layerWebAppReady", initializeLayer);
window.addEventListener("beforeunload", shutdownLayer);

window.preRenderFunction = () => app?.preRender();

async function initializeLayer() {
  if (app) {
    return;
  }
  const provider = getProvider(getRequestedSystemId(window.svgImageProps));
  app = new ShareCycleApp({
    svgMap: window.svgMap,
    svgImage: window.svgImage,
    svgImageProps: window.svgImageProps,
    layerID: window.layerID,
    provider,
    document,
    fetchFn: window.fetch.bind(window)
  });
  await app.initialize();
}

function shutdownLayer() {
  app?.shutdown();
  app = null;
}

export function getRequestedSystemId(svgImageProps) {
  const hash = String(svgImageProps?.hash || "").replace(/^#/, "");
  return new URLSearchParams(hash).get("system") || "docomo-cycle";
}

export { GBFS_PROVIDERS } from "./gbfsProviders.js";
export { createStationPoi } from "./shareCyclePresentation.js";
