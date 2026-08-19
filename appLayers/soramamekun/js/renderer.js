// License: (MPL v2)
// This Source Code Form is subject to the terms of the Mozilla Public License, v. 2.0.
// If a copy of the MPL was not distributed with this file, You can obtain one at https://mozilla.org/MPL/2.0/.

const UNITS = {
  'PM2.5': 'µg/m3',
  'SPM': 'mg/m3',
  'OX': 'ppm',
  'SO2': 'ppm',
  'NO': 'ppm',
  'NO2': 'ppm',
  'NMHC': 'ppmC',
};

/**
 * Draws the station markers on the map.
 * @param {string} indicator
 * @param {Map<string, object>} stations
 * @param {Map<string, object>} measurements
 * @param {{ [indicator: string]: { color: string; value: string; min: number; max: number }[] }} legends
 * @returns {void}
 */
const drawDataOnMap = (indicator, stations, measurements, legends) => {
  /** @type {SVGGElement} */
  const containerElement = window.svgImage.getElementById('container');

  // Clear existing DOM elements to refresh the display.
  while (containerElement.firstChild) {
    containerElement.removeChild(containerElement.firstChild);
  }

  for (const [code, station] of stations) {
    if (Number.isNaN(station['経度']) || Number.isNaN(station['緯度'])) {
      continue;
    }
    const measurement = measurements.get(code);
    if (!measurement || Number.isNaN(measurement[indicator])) {
      continue;
    }

    // Convert the station's geographic coordinates into this layer's local SVG coordinates.
    const { x, y } = window.svgMap.transform(station['経度'], station['緯度'], window.svgImageProps.CRS);

    // Determine the station's color based on its measurement and legends.
    const { color = '#dddddd' } =
      (legends[indicator] || []).find((legend) => {
        return legend.min <= measurement[indicator] && measurement[indicator] <= legend.max;
      }) || {};

    // Prepare the content to be displayed in the tooltip.
    const contents = {
      '測定局名称': station['測定局名称'] || '-',
      '所在地': station['所在地'] || '-',
      'PM2.5': measurement['PM2.5'] ? `${measurement['PM2.5']} ${UNITS['PM2.5'] || ''}` : '-',
      'SPM': measurement['SPM'] ? `${measurement['SPM']} ${UNITS['SPM'] || ''}` : '-',
      'OX': measurement['OX'] ? `${measurement['OX']} ${UNITS['OX'] || ''}` : '-',
      'SO2': measurement['SO2'] ? `${measurement['SO2']} ${UNITS['SO2'] || ''}` : '-',
      'NO': measurement['NO'] ? `${measurement['NO']} ${UNITS['NO'] || ''}` : '-',
      'NO2': measurement['NO2'] ? `${measurement['NO2']} ${UNITS['NO2'] || ''}` : '-',
      'NMHC': measurement['NMHC'] ? `${measurement['NMHC']} ${UNITS['NMHC'] || ''}` : '-',
    };

    // Add a marker for the station on the map.
    const markerElement = window.svgImage.createElement('use');
    markerElement.setAttribute('xlink:href', '#station');
    markerElement.setAttribute('xlink:title', station['測定局名称'] || '');
    markerElement.setAttribute('x', 0);
    markerElement.setAttribute('y', 0);
    markerElement.setAttribute('transform', `ref(svg,${x},${y})`);
    markerElement.setAttribute('fill', color);
    markerElement.setAttribute('content', JSON.stringify(contents));
    containerElement.appendChild(markerElement);
  }

  // Refresh the screen to reflect the changes.
  window.svgMap.refreshScreen();
};

/**
 * Updates the HTML content of the layer.
 * @param {string} indicator
 * @param {{ [indicator: string]: { color: string; value: string; min: number; max: number }[] }} legends
 * @returns {void}
 */
const updateLayerHtml = (indicator, legends) => {
  const containerElement = window.document.getElementById('legend');
  if (!containerElement) {
    return;
  }

  // Update the layer's HTML content with the latest information.
  containerElement.innerHTML = (legends[indicator] || [])
    .map((legend) => {
      return `<div class="legend-item"><div class="legend-color" style="background: ${legend.color};"></div><div class="legend-label">${legend.value}</div></div>`;
    })
    .join('\n');
};

/**
 * Draws the tooltip for the specified station element.
 * @param {SVGGElement} element
 * @returns {boolean}
 */
const drawTooltip = (element) => {
  const contents = JSON.parse(element.getAttribute('content') || '{}');

  // Display a table in a modal as tooltip.
  const htmls = [
    '<table border="1" style="border-collapse: collapse; font-size: 14px; width: 100%; color: #212927;">',
    '<tr><th style="background: #c1e3cf; padding: 4px 6px; text-align: left; border: none; border-top: 1px solid #212927; border-bottom: 1px solid #212927;">項目</th><th style="background: #c1e3cf; padding: 4px 6px; text-align: left; border: none; border-top: 1px solid #212927; border-bottom: 1px solid #212927;">値</th></tr>',
    ...Object.entries(contents).map(([label, value]) => {
      return `<tr><td style="background: #ffffff; padding: 4px 6px; border: none; border-bottom: 1px solid #212927;">${label}</td><td style="background: #ffffff; padding: 4px 6px; border: none; border-bottom: 1px solid #212927;">${value}</td></tr>`;
    }),
    '</table>',
  ];
  window.svgMap.showModal(htmls.join(''), 320, 291);

  // Returns a value other than `false` to suppress SVGMap's default POI display.
  return true;
};

export { drawDataOnMap, updateLayerHtml, drawTooltip };
