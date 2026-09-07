// License: (MPL v2)
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.

import { ShareCycleQtctRenderer } from "./shareCycleQtctRenderer.js";
import {
  PROPERTY_SCHEMA,
  STATUS_COLORS,
  createQtctRecord
} from "./shareCyclePresentation.js";

export class ShareCycleRenderer {
  constructor({
    svgMap,
    svgImage,
    svgImageProps,
    layerID,
    getCategory,
    getTitle,
    setProgress
  }) {
    this.svgMap = svgMap;
    this.svgImage = svgImage;
    this.svgImageProps = svgImageProps;
    this.layerID = layerID;
    this.getCategory = getCategory;
    this.getTitle = getTitle;
    this.setProgress = setProgress;
    this.renderer = null;
  }

  async build(stations, provider) {
    this.#ensureRenderer();
    this.svgImage.documentElement.setAttribute("property", PROPERTY_SCHEMA.join(","));
    const records = stations.map((station) => createQtctRecord(station, provider));
    const schema = {
      lngCol: 0,
      latCol: 1,
      titleCol: -1,
      defaultIconNumber: 0,
      maxTilePoints: provider.maxTilePoints
    };

    try {
      await this.renderer.buildQTCTdata(
        records,
        schema,
        (message) => this.setProgress(message),
        true
      );
      this.#renderCurrentTiles();
    } finally {
      this.setProgress("");
    }
  }

  async refreshColors() {
    if (!this.renderer) {
      return;
    }
    this.setProgress("QTCT集約タイルの色を更新中…");
    try {
      const clientSideQtct = this.renderer.clientSideQTCT;
      const images = await clientSideQtct.buildLowResTiles();
      for (const [tileKey, imageUrl] of Object.entries(images)) {
        clientSideQtct.setTileData(tileKey, imageUrl);
      }
      this.renderer.setQtctMapData(clientSideQtct.getTliedData());
      this.#renderCurrentTiles();
    } finally {
      this.setProgress("");
    }
  }

  preRender() {
    this.renderer?.preRenderFunction();
  }

  #ensureRenderer() {
    if (this.renderer) {
      return;
    }
    this.renderer = new ShareCycleQtctRenderer({
      svgMap: this.svgMap,
      svgImage: this.svgImage,
      svgImageProps: this.svgImageProps,
      layerID: this.layerID,
      iconIdEvaluator: (metadata) => `p${this.getCategory(metadata)}`,
      colorIndexEvaluator: (metadata) => this.getCategory(metadata),
      titleEvaluator: (metadata) => this.getTitle(metadata)
    });
    this.renderer.colors = STATUS_COLORS.map((color) => [...color]);
  }

  #renderCurrentTiles() {
    this.renderer.removePrevTiles();
    this.renderer.preRenderFunction();
    this.svgMap.refreshScreen();
  }
}
