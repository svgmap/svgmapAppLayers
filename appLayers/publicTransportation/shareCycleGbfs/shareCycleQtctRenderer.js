// License: (MPL v2)
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.

import { QTCTLayerRenderer } from "../../../commonLib/QTCTLayerRenderer.js";
import { createStationPoi } from "./shareCyclePresentation.js";

// QTCTデータ構築とタイル管理は共通実装を再利用し、SVG描画だけをシェアサイクル用に定義する。
export class ShareCycleQtctRenderer extends QTCTLayerRenderer {
  preRenderFunction = () => {
    if (!this.qtctMapData) {
      return;
    }
    const level = Math.floor(Math.LOG2E * Math.log(this.svgImageProps.scale) + 7.25);
    const tileSet = this.clientSideQTCT.getTileSet(this.svgMap.getGeoViewBox(), level);
    this.removePrevTiles(tileSet);

    for (const tileKey of Object.keys(tileSet)) {
      const group = this.svgImage.createElement("g");
      group.setAttribute("id", `T${tileKey}`);
      // S-LaWAの差分同期に合わせ、共通実装と同じ順序で親・子を追加する。
      this.svgImage.documentElement.appendChild(group);
      const tileData = this.qtctMapData[tileKey];
      if (Array.isArray(tileData)) {
        this.#appendStationMarkers(group, tileData);
      } else {
        this.#appendAggregateImage(group, tileData, tileKey);
      }
    }
  };

  #appendStationMarkers(group, tileData) {
    for (const [longitude, latitude, metadata] of tileData) {
      const marker = createStationPoi({
        svgImage: this.svgImage,
        iconId: this.iconIdEvaluator(metadata),
        metadata
      });
      marker.setAttribute("xlink:title", this.titleEvaluator?.(metadata) ?? "");
      marker.setAttribute("content", metadata.join(","));
      marker.setAttribute(
        "transform",
        `ref(svg,${Number(longitude) * 100},${-Number(latitude) * 100})`
      );
      group.appendChild(marker);
    }
  }

  #appendAggregateImage(group, imageUrl, tileKey) {
    const bounds = this.clientSideQTCT.getGeoBound(tileKey);
    const image = this.svgImage.createElement("image");
    image.setAttribute("xlink:href", imageUrl);
    image.setAttribute("style", "image-rendering:pixelated");
    image.setAttribute("x", bounds.x * 100);
    image.setAttribute("y", -(bounds.y + bounds.height) * 100);
    image.setAttribute("width", bounds.width * 100);
    image.setAttribute("height", bounds.height * 100);
    group.appendChild(image);
  }
}
