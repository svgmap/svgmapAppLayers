// License: (MPL v2)
// This Source Code Form is subject to the terms of the Mozilla Public License, v. 2.0.
// If a copy of the MPL was not distributed with this file, You can obtain one at https://mozilla.org/MPL/2.0/.

import { jest } from '@jest/globals';
import { parseCsv, replaceTemplate, startInterval, stopInterval } from '../js/util.js';

describe('replaceTemplate', () => {
  test('should replace template placeholders with corresponding values.', () => {
    expect(replaceTemplate('{a}-{a}-{b}', { a: 'x', b: 'y' })).toBe('x-x-y');
    expect(replaceTemplate('{YYYY}/{MM}/{DD}.csv', { YYYY: '2026', MM: '08', DD: '11' })).toBe('2026/08/11.csv');

    expect(replaceTemplate('{known}-{unknown}', { known: 'ok' })).toBe('ok-{unknown}');
  });
});

describe('parseCsv', () => {
  test('should parse CSV into an array of objects.', () => {
    const result = parseCsv('code,name\n001, A \n\n002,B\n003');
    expect(result).toEqual([
      { code: '001', name: 'A' },
      { code: '002', name: 'B' },
    ]);

    expect(parseCsv('code,name')).toEqual([]);
    expect(parseCsv('')).toEqual([]);
  });
});

describe('startInterval', () => {
  test('should start interval.', () => {
    const callback = jest.fn();
    jest.useFakeTimers();

    const intervalId = startInterval(callback, 1000, true);
    expect(callback).toHaveBeenCalledTimes(1);

    jest.advanceTimersByTime(3000);
    expect(callback).toHaveBeenCalledTimes(4);

    stopInterval(intervalId);

    jest.useRealTimers();
  });
});

describe('stopInterval', () => {
  test('should stop interval.', () => {
    const callback = jest.fn();
    jest.useFakeTimers();

    const intervalId = startInterval(callback, 1000, false);

    jest.advanceTimersByTime(3000);
    expect(callback).toHaveBeenCalledTimes(3);

    stopInterval(intervalId);

    jest.advanceTimersByTime(3000);
    expect(callback).toHaveBeenCalledTimes(3);

    jest.useRealTimers();
  });
});
