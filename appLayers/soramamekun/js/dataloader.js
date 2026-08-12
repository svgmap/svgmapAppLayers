// License: (MPL v2)
// This Source Code Form is subject to the terms of the Mozilla Public License, v. 2.0.
// If a copy of the MPL was not distributed with this file, You can obtain one at https://mozilla.org/MPL/2.0/.

import { fetchJsonData, fetchCsvData, replaceTemplate } from './util.js';

const DATA_SOURCE_URLS = {
  METADATA: 'https://soramame.env.go.jp/data/sokutei/noudoAll/metadata.json?_t={TT}',
  STATION: 'https://soramame.env.go.jp/data/map/kyokuNoudo/{YYYY}/{MM}/{DD}/01.csv',
  MEASUREMENT: 'https://soramame.env.go.jp/data/sokutei/noudoAll/{YYYY}/{MM}/{DD}/{HH}.csv',
  LEGEND: 'https://soramame.env.go.jp/data/map_legend.json?_={TT}',
};

/** @type {number | null} */
let lastLoadedTime = null;

/** @type {{stations: Map<string, object>, measurements: Map<string, object>, legends: { [kind: string]: object[] }}} */
const caches = {
  stations: new Map(),
  measurements: new Map(),
  legends: {},
};

/**
 * Fetches the latest stations, measurements, and legends data from the server and returns them as a structured object.
 * If the cached data is already up-to-date, it returns the cached data instead.
 * @returns {Promise<{stations: Map<string, object>, measurements: Map<string, object>}>}
 */
const fetchData = async () => {
  try {
    // Fetch the time of latest data published on the server.
    const url = replaceTemplate(DATA_SOURCE_URLS.METADATA, { TT: String(Date.now()) });
    const metadata = await fetchJsonData(window.svgMap.getCORSURL(url));
    const latestTime = new Date(metadata.latest);

    // If the cached data is already up-to-date, skip reloading it.
    if (lastLoadedTime && latestTime.getTime() <= lastLoadedTime) {
      return caches;
    }

    await Promise.all([loadStationsData(latestTime), loadMeasurementsData(latestTime), loadLegendsData(latestTime)]);

    // Update the last loaded time if all data was successfully loaded.
    lastLoadedTime = latestTime.getTime();
  } catch (error) {
    if (error.name !== 'AbortError') {
      console.error(error);
    }
  }

  return caches;
};

/**
 * Loads the stations data for the specified date from the server.
 * @param {Date} latestTime
 * @returns {Promise<void>}
 */
const loadStationsData = async (latestTime) => {
  const url = replaceTemplate(DATA_SOURCE_URLS.STATION, {
    YYYY: String(latestTime.getFullYear()),
    MM: String(latestTime.getMonth() + 1).padStart(2, '0'),
    DD: String(latestTime.getDate()).padStart(2, '0'),
  });
  const records = await fetchCsvData(window.svgMap.getCORSURL(url), { encoding: 'utf-8' });

  caches.stations.clear();
  for (const record of records) {
    caches.stations.set(record['測定局コード'], {
      '測定局コード': record['測定局コード'] || '',
      '測定局名称': record['測定局名称'] || '',
      '所在地': record['所在地'] || '',
      '経度': ['', '-'].includes(record['経度'].trim()) ? Number.NaN : Number(record['経度'].trim()),
      '緯度': ['', '-'].includes(record['緯度'].trim()) ? Number.NaN : Number(record['緯度'].trim()),
    });
  }
};

/**
 * Loads the measurements data for the specified date from the server.
 * @param {Date} latestTime
 * @returns {Promise<void>}
 */
const loadMeasurementsData = async (latestTime) => {
  const url = replaceTemplate(DATA_SOURCE_URLS.MEASUREMENT, {
    YYYY: String(latestTime.getFullYear()),
    MM: String(latestTime.getMonth() + 1).padStart(2, '0'),
    DD: String(latestTime.getDate()).padStart(2, '0'),
    HH: String(latestTime.getHours()).padStart(2, '0'),
  });
  const records = await fetchCsvData(window.svgMap.getCORSURL(url), { encoding: 'utf-8' });

  caches.measurements.clear();
  for (const record of records) {
    caches.measurements.set(record['測定局コード'], {
      '測定局コード': record['測定局コード'] || '',
      'PM2.5': ['', '-', 'NA'].includes(record['PM2.5'].trim()) ? -1 : Number(record['PM2.5'].trim()),
      'SPM': ['', '-', 'NA'].includes(record['SPM'].trim()) ? -1 : Number(record['SPM'].trim()),
      'OX': ['', '-', 'NA'].includes(record['OX'].trim()) ? -1 : Number(record['OX'].trim()),
      'SO2': ['', '-', 'NA'].includes(record['SO2'].trim()) ? -1 : Number(record['SO2'].trim()),
      'NO': ['', '-', 'NA'].includes(record['NO'].trim()) ? -1 : Number(record['NO'].trim()),
      'NO2': ['', '-', 'NA'].includes(record['NO2'].trim()) ? -1 : Number(record['NO2'].trim()),
      'NMHC': ['', '-', 'NA'].includes(record['NMHC'].trim()) ? -1 : Number(record['NMHC'].trim()),
    });
  }
};

/**
 * Loads the legends data from the server.
 * @returns {Promise<void>}
 */
const loadLegendsData = async (latestTime) => {
  const url = replaceTemplate(DATA_SOURCE_URLS.LEGEND, { TT: String(latestTime.getTime()) });
  const legends = await fetchJsonData(window.svgMap.getCORSURL(url));

  caches.legends = Object.fromEntries(
    legends.map((legend) => {
      return [legend.item === 'PM25' ? 'PM2.5' : legend.item, legend.legends];
    })
  );
};

export { fetchData };
