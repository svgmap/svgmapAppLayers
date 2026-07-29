// CSISジオコーダおよびXML変換処理は、appLayers/mojの実装を基に
// このLaWA内へ複製している。
//
// Original code programmed by Satoru Takagi.
// License: MPL v2
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.

class XmlToObject {
  static convert(xml) {
    return XmlToObject.traverse(xml.documentElement);
  }

  static traverse(element) {
    let result = {};
    const attributes = element.attributes;
    for (const attribute of attributes) result[attribute.name] = attribute.value;

    const children = element.children;
    if (children.length > 0) {
      for (const child of children) {
        const childValue = XmlToObject.traverse(child);
        if (result[child.tagName]) {
          if (!Array.isArray(result[child.tagName])) result[child.tagName] = [result[child.tagName]];
          result[child.tagName].push(childValue);
        } else {
          result[child.tagName] = childValue;
        }
      }
    } else if (element.textContent !== "") {
      result = attributes.length === 0
        ? element.textContent
        : { ...result, textContent: element.textContent };
    }
    return result;
  }
}

class CsisGeocoder {
  levelDict = {
    "1": ["都道府県", 300],
    "2": ["郡・支庁・振興局", 100],
    "3": ["市町村・特別区（東京23区）", 10],
    "4": ["政令市の区", 30],
    "5": ["大字", 10],
    "6": ["丁目・小字", 2],
    "7": ["街区・地番", 0.5],
    "8": ["号・枝番", 0.1],
    "0": ["レベル不明", 300],
    "-1": ["座標不明", 1000]
  };

  constructor(proxy, charset = "UTF8", geosys = "world") {
    this.proxy = proxy;
    this.charset = charset;
    this.geosys = geosys;
  }

  async geocode(address, constraint) {
    const geosysParam = this.geosys === "world" ? "" : `&geosys=${this.geosys}`;
    const constraintParam = constraint ? `&constraint=${constraint}` : "";
    const charsetParam = `&charset=${this.charset}`;
    let requestUrl = `https://geocode.csis.u-tokyo.ac.jp/cgi-bin/simple_geocode.cgi?addr=${address}${charsetParam}${geosysParam}${constraintParam}`;
    if (this.proxy) requestUrl = this.proxy + requestUrl;

    const response = await fetch(requestUrl);
    const xmlText = await response.text();
    const xml = new DOMParser().parseFromString(xmlText, "text/xml");
    return XmlToObject.convert(xml);
  }
}

const csisGeocoder = new CsisGeocoder();

// appLayers/moj/getMOJindex.js の genericGeoCode と同じCSIS簡易ジオコーディングを使う。
export async function genericGeoCode(address) {
  const response = await csisGeocoder.geocode(address);
  const candidate = Array.isArray(response?.candidate) ? response.candidate[0] : response?.candidate;
  if (!candidate) return null;

  const lat = Number(candidate.latitude);
  const lng = Number(candidate.longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return {
    lat,
    lng,
    resolvedAddress: candidate.address || address
  };
}

export async function geocodeAddresses(records, options = {}) {
  const geocode = options.geocode || genericGeoCode;
  const concurrency = Math.max(1, Math.min(Number(options.concurrency) || 3, 8));
  const addresses = [...new Set(records.map(record => record.address))];
  const resultByAddress = new Map();
  let cursor = 0;
  let completed = 0;
  let requestErrors = 0;
  let firstError;

  async function worker() {
    while (cursor < addresses.length) {
      const index = cursor++;
      const address = addresses[index];
      try {
        resultByAddress.set(address, await geocode(address));
      } catch (error) {
        resultByAddress.set(address, null);
        requestErrors++;
        if (!firstError) firstError = error;
      } finally {
        completed++;
        options.onProgress?.(completed, addresses.length);
      }
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, addresses.length) }, worker));
  if (requestErrors === addresses.length) {
    throw new Error(`住所ジオコーディングに失敗しました: ${firstError?.message || "通信エラー"}`);
  }
  return {
    results: records.map(record => resultByAddress.get(record.address) || null),
    requestErrors,
    uniqueAddressCount: addresses.length
  };
}
