// License: (MPL v2)
// This Source Code Form is subject to the terms of the Mozilla Public License, v. 2.0.
// If a copy of the MPL was not distributed with this file, You can obtain one at https://mozilla.org/MPL/2.0/.

/**
 * Fetches JSON data from the specified URL.
 * @param {string} url
 * @param {RequestInit | undefined} options
 * @return {object}
 */
const fetchJsonData = async (url, options = {}) => {
  const response = await fetch(url, options);
  if (response.status >= 400) {
    throw new Error(`Failed to fetch data from [${url}]: ${response.status}(${response.statusText})`);
  }
  return await response.json();
};

/**
 * Fetches CSV data from the specified URL and parses it into an array of records.
 * @param {string} url
 * @param {RequestInit & { encoding?: string } | undefined} [options]
 * @return {object[]}
 */
const fetchCsvData = async (url, options = {}) => {
  const response = await fetch(url, options);
  if (response.status >= 400) {
    throw new Error(`Failed to fetch data from [${url}]: ${response.status}(${response.statusText})`);
  }

  try {
    const buffer = await response.arrayBuffer();
    const text = new TextDecoder(options.encoding || 'utf-8', {
      fatal: true,
    }).decode(buffer);
    return parseCsv(text);
  } catch (error) {
    throw new Error(`Failed to decode CSV text as [${options.encoding || 'utf-8'}]: `, error);
  }
};

/**
 * Parses CSV text into an array of object, keyed by the header row.
 * @param {string} text
 * @return {object[]}
 */
const parseCsv = (text) => {
  const rows = text.split(/\r?\n/);
  if (rows.length < 2) {
    return [];
  }

  const keys = rows[0].split(',').map((key) => key.trim());
  const records = [];
  rows.forEach((row, index) => {
    // Skip the first row and empty rows.
    if (index === 0 || row.trim() === '') {
      return;
    }
    if (row.split(',').length !== keys.length) {
      console.warn(`Skipped the row [${index + 1}] because it has a different number of columns than the header.`);
      return;
    }
    records.push(Object.fromEntries(row.split(',').map((value, i) => [keys[i], value.trim()])));
  });
  return records;
};

/**
 * Replaces "{key}" placeholders in the template with the corresponding value from replacements.
 * Placeholders with no matching key are left untouched.
 * @param {string} template
 * @param {Record<string, string>} replacements
 * @return {string}
 */
const replaceTemplate = (template, replacements) => {
  return Object.entries(replacements).reduce((result, [key, value]) => {
    return result.replaceAll(`{${key}}`, value);
  }, template);
};

/**
 * Starts a timer that calls the specified callback function at the specified interval.
 * @param {function} callback
 * @param {number} interval
 * @param {boolean} immediate
 * @returns {number}
 */
const startInterval = (callback, interval, immediate = false) => {
  if (immediate) {
    callback();
  }
  return setInterval(callback, interval);
};

/**
 * Stops the specified interval timer.
 * @param {number | null} intervalId
 * @returns {void}
 */
const stopInterval = (intervalId) => {
  if (intervalId !== null) {
    clearInterval(intervalId);
    intervalId = null;
  }
};

export { fetchJsonData, fetchCsvData, parseCsv, replaceTemplate, startInterval, stopInterval };
