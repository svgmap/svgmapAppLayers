// Description: Yahoo! ジオコーダプロキシを利用するためのクラス
//
// License: (MPL v2)
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.

/**
 * Yahoo! ジオコーダプロキシを利用するための管理クラス
 */
export class YahooGeocoder {
	constructor(proxyUrl = "./yahooGeocoderProxy.php") {
		this.proxyUrl = proxyUrl;

		// YahooのAddressMatchingLevel(1-6)を [名称, 半径km] にマッピング
		this.levelDict = {
			1: ["都道府県", 50],
			2: ["市区町村", 10],
			3: ["大字", 2],
			4: ["丁目", 1],
			5: ["街区", 0.5],
			6: ["番地・号", 0.3],
		};
	}

	/**
	 * 住所検索の実行
	 * @param {string} address 
	 * @param {Object} options 
	 */
	async geocode(address, options = {}) {
		// outputはjson固定
		const apiParams = { ...options, output: "json" };

		const params = new URLSearchParams();
		params.append("query", address);

		// 有効な値（null/undefined以外）をクエリに追加
		Object.entries(apiParams).forEach(([key, value]) => {
			if (value !== null && value !== undefined) {
				params.append(key, value);
			}
		});

		try {
			const response = await fetch(`${this.proxyUrl}?${params.toString()}`);
			if (!response.ok) throw new Error(`HTTP Error: ${response.status}`);

			const data = await response.json();
			if (data.ResultInfo?.Status !== 200) {
				throw new Error(
					`API Error: ${data.ResultInfo?.Description || "Unknown"}`,
				);
			}
			return data;
		} catch (error) {
			console.error("YahooGeocoder.geocode failed:", error);
			throw error;
		}
	}
}

/**
 * ユーティリティ: Yahooの座標文字列 "lon,lat" を数値の配列 [lon, lat] に変換する
 */
export function parseYahooCoords(coordinatesString) {
	if (!coordinatesString) return [0, 0];
	return coordinatesString.split(",").map(Number);
}

/**
 * クラスをインスタンス化せずにデフォルト設定で検索するショートカット関数
 */
export async function yahooGeocode(address, options = {}) {
	const defaultCoder = new YahooGeocoder();
	return await defaultCoder.geocode(address, options);
}