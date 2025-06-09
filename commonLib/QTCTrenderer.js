// Client Side QTCT SVGMap Renderer
// Programmed by Satoru Takagi
//
// License: (MPL v2)
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.
//
// 2024/08/01 : クラス化して、クラスファイルを分離


import { QTCTrendererClass } from './QTCTrendererClass_r1.js';

var QTCTrenderer = new QTCTrendererClass(window);
window.clientSideQTCT = QTCTrenderer.clientSideQTCT; // for debug
window.useQTCT=false; // trueの時のみQTCT表示させる
window.buildQTCTdata = QTCTrenderer.buildQTCTdata;
window.clearQTCTdata = QTCTrenderer.clearData;
window.preRenderFunction=QTCTrenderer.preRenderFunction;
window.removePrevTiles = QTCTrenderer.removePrevTiles;
window.getQtctMapData = QTCTrenderer.getQtctMapData;
window.setQtctMapData = QTCTrenderer.setQtctMapData;
window.restoreCsvData = QTCTrenderer.restoreCsvData;