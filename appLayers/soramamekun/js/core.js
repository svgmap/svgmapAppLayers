// License: (MPL v2)
// This Source Code Form is subject to the terms of the Mozilla Public License, v. 2.0.
// If a copy of the MPL was not distributed with this file, You can obtain one at https://mozilla.org/MPL/2.0/.

import { startInterval, stopInterval } from './util.js';
import { fetchData } from './dataloader.js';
import { drawDataOnMap, updateLayerHtml, drawTooltip } from './renderer.js';

/** @type {number | null} */
let refreshTimerId = null;

/**
 * Initializes the layer and starts the rendering process.
 * @returns {void}
 */
const initializeLayer = () => {
  if (!window.svgMap || !window.svgImage || !window.svgImageProps) {
    return;
  }

  // Register the layer with main application to handle POI click events.
  window.svgMap.setShowPoiProperty(drawTooltip, window.layerID || null);

  // Make POIs on the layer clickable.
  window.svgImageProps.isClickable = { value: true, hilightStrokeStyle: {} };

  // Start application main process with periodic refresh.
  refreshTimerId = startInterval(render, 5 * 60 * 1000, true);

  // Register rerendering trigger when the select box value changes.
  setRerenderingTrigger(window.document.getElementById('indicator'), 'change');
};

/**
 * Shuts down the layer and stops any ongoing processes.
 * @returns {void}
 */
const shutdownLayer = () => {
  stopInterval(refreshTimerId);
};

/**
 * Sets up a trigger to rerender the layer when the specified element changes.
 * @param {HTMLElement} element
 * @param {string} eventType
 * @returns {void}
 */
const setRerenderingTrigger = (element, eventType = 'change') => {
  if (element) {
    element.addEventListener(eventType, render);
  }
};

/**
 * Render the layer.
 * @returns {Promise<void>}
 */
const render = async () => {
  /** @type {HTMLSelectElement} */
  const selectElement = window.document.getElementById('indicator');
  if (!selectElement) {
    return;
  }

  const { stations, measurements, legends } = await fetchData();

  updateLayerHtml(selectElement.value, legends);

  drawDataOnMap(selectElement.value, stations, measurements, legends);
};

export { initializeLayer, shutdownLayer };
