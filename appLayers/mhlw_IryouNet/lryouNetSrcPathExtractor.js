// Programmed by Satoru Takagi
// 
// License: (MPL v2)
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.

/**
 * 全角文字を半角に変換する関数
 * @param {string} str - 変換する文字列
 * @returns {string} 半角に変換された文字列
 */
function toHalfWidth(str) {
	return str
		.replace(/[！-～]/g, function (s) {
			return String.fromCharCode(s.charCodeAt(0) - 0xfee0);
		})
		.replace(/　/g, " "); // 全角スペースも半角に
}

/**
 * 日付文字列から年月日を抽出する関数
 * @param {string} text - 日付を含むテキスト（例：「2025年６月１日時点」）
 * @returns {Date|null} Dateオブジェクト、または null
 */
function parseDateFromText(text) {
	// まず全角を半角に変換
	const normalizedText = toHalfWidth(text);

	// 「YYYY年M月D日時点」のパターンをマッチング
	const match = normalizedText.match(/(\d{4})年(\d{1,2})月(\d{1,2})日時点/);

	if (!match) {
		return null;
	}

	const year = parseInt(match[1]);
	const month = parseInt(match[2]);
	const day = parseInt(match[3]);

	// 有効な日付かチェック
	if (
		isNaN(year) ||
		isNaN(month) ||
		isNaN(day) ||
		month < 1 ||
		month > 12 ||
		day < 1 ||
		day > 31
	) {
		return null;
	}

	return new Date(year, month - 1, day);
}

/**
 * ファイル名から日付文字列(YYYYMMDD)を抽出する関数
 * @param {string} filename - ファイル名（例：「01-1_hospital_facility_info_20250601.zip」）
 * @returns {string|null} 日付文字列、または null
 */
function extractDateFromFilename(filename) {
	// _(YYYYMMDD).zip のパターンをマッチング
	const match = filename.match(/_(\d{8})\.zip$/);
	return match ? match[1] : null;
}

/**
 * 日付文字列(YYYYMMDD)をDateオブジェクトに変換
 * @param {string} dateString - YYYYMMDD形式の日付文字列
 * @returns {Date|null} Dateオブジェクト、または null
 */
function parseDateString(dateString) {
	if (!/^\d{8}$/.test(dateString)) {
		return null;
	}

	const year = parseInt(dateString.substring(0, 4));
	const month = parseInt(dateString.substring(4, 6));
	const day = parseInt(dateString.substring(6, 8));

	if (month < 1 || month > 12 || day < 1 || day > 31) {
		return null;
	}

	return new Date(year, month - 1, day);
}

/**
 * ファイル名からデータセット名を抽出する関数
 * @param {string} filename - ファイル名
 * @returns {string|null} データセット名、または null
 */
function extractDatasetName(filename) {
	// パターン: (datasetName)_YYYYMMDD.zip
	// 例: 01-2_hospital_speciality_hours_20250601.zip → 01-2_hospital_speciality_hours
	const match = filename.match(/(.+?)_(\d{8})\.zip$/);
	return match ? match[1] : null;
}

/**
 * HTMLソースコード（文字列）から最新のzipファイルURLを取得する関数
 * @param {string} htmlString - HTMLソースコード文字列
 * @returns {Object} データセット名をキーとした最新zipファイルのURL、または null
 */
function extractLatestMedicalDataUrls(htmlString, sourceURL) {
	let baseUrl = "https://www.mhlw.go.jp";
	if (sourceURL) {
		baseUrl = new URL(sourceURL).origin;
	}

	try {
		// DOMParserでHTMLを解析
		const parser = new DOMParser();
		const doc = parser.parseFromString(htmlString, "text/html");

		// l-contentMain内のh3要素を全て取得
		const contentMain = doc.querySelector(".l-contentMain");

		if (!contentMain) {
			console.error("l-contentMain要素が見つかりません");
			return null;
		}

		const h3Elements = contentMain.querySelectorAll("h3.m-hdgLv3__hdg");

		if (h3Elements.length === 0) {
			console.error("データセクションが見つかりません");
			return null;
		}

		// 各h3から日付を抽出して最新のものを見つける
		let latestDate = null;
		let latestH3 = null;

		h3Elements.forEach((h3) => {
			const text = h3.textContent.trim();
			const date = parseDateFromText(text);

			if (date && (!latestDate || date > latestDate)) {
				latestDate = date;
				latestH3 = h3;
			}
		});

		if (!latestH3) {
			console.error("日付を含むh3要素が見つかりません");
			return null;
		}

		console.log("最新データの日付:", latestDate.toLocaleDateString("ja-JP"));

		// 最新のh3の次の要素（pタグ）を取得
		let latestSection = latestH3.nextElementSibling;

		// 空白ノードをスキップ
		while (latestSection && latestSection.nodeType !== 1) {
			latestSection = latestSection.nextSibling;
		}

		if (!latestSection) {
			console.error("最新データのリンクセクションが見つかりません");
			return null;
		}

		// リンクを抽出
		const links = latestSection.querySelectorAll("a");

		if (links.length === 0) {
			console.error("リンクが見つかりません");
			return null;
		}

		// データセット名をキーとしたURL辞書を作成
		const datasetUrls = {};

		links.forEach((link) => {
			const href = link.getAttribute("href");

			if (!href || !href.endsWith(".zip")) {
				return;
			}

			// ファイル名を取得
			const filename = href.split("/").pop();

			// データセット名を抽出
			const datasetName = extractDatasetName(filename);

			if (datasetName) {
				// 相対パスを絶対URLに変換
				const fullUrl = href.startsWith("http") ? href : baseUrl + href;

				// データセット名をキーとして保存
				datasetUrls[datasetName] = fullUrl;
			}
		});

		// 取得できたデータセット数を表示
		console.log(
			`${Object.keys(datasetUrls).length}個のデータセットを取得しました`,
		);

		return { url: datasetUrls, date: latestDate };
	} catch (error) {
		console.error("HTMLの解析中にエラーが発生しました:", error);
		return null;
	}
}

/**
 * 取得したURLを整形して表示する関数
 * @param {Object} urls - URL一覧（データセット名がキー）
 */
function displayUrls(urls) {
	if (!urls) {
		console.log("URLが取得できませんでした");
		return;
	}

	console.log("\n=== 医療情報ネット 最新オープンデータ ===\n");

	// データセット名でソート
	const sortedKeys = Object.keys(urls).sort();

	for (const datasetName of sortedKeys) {
		console.log(`[${datasetName}]`);
		console.log(`${urls[datasetName]}\n`);
	}
}

/**
 * URLからバイナリデータを取得し、進行状況をコールバックで報告します。
 *
 * @param {string} url - 取得するリソースのURL。
 * @param {function(number, number): void} onProgress - 進捗報告コールバック (ダウンロードされたバイト数, 合計バイト数)。
 * @returns {Promise<ArrayBuffer>} - ダウンロードされたバイナリデータを含むPromise。
 */
async function fetchBinaryDataWithProgress(url, onProgress) {
	const response = await fetch(url);
	if (!response.ok) {
		throw new Error(`HTTP error! status: ${response.status}`);
	}
	const totalBytes = parseInt(response.headers.get("Content-Length"), 10);
	if (isNaN(totalBytes)) {
		console.warn(
			"Content-Length header is missing or invalid. Progress will be reported without total size.",
		);
	}
	const reader = response.body.getReader();
	const chunks = [];
	let receivedBytes = 0;

	// データを読み込むループ
	while (true) {
		const { done, value } = await reader.read();
		if (done) {
			break;
		}
		chunks.push(value);
		receivedBytes += value.length;
		// totalBytesがNaNでもreceivedBytesは報告する
		onProgress(receivedBytes, totalBytes);
	}
	const finalBuffer = new Uint8Array(receivedBytes);
	let offset = 0;
	for (const chunk of chunks) {
		finalBuffer.set(chunk, offset);
		offset += chunk.length;
	}
	return finalBuffer.buffer;
}

export { extractLatestMedicalDataUrls, fetchBinaryDataWithProgress };
