/**
 * odptCkanScraper.js
 * ODPT CKAN データカタログからのバス等公共交通リアルタイムデータ配信データセット・リソース解析モジュール
 */
// License: (MPL v2)
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.

"use strict";

const OdptCkanScraper = (function () {
	const CKAN_BASE = "https://ckan.odpt.org";

	/**
	 * CKAN からリアルタイムデータデータセット且つ基本ライセンス||CCBYのものの一覧（全ページ）を取得
	 */
	async function fetchDatasetList() {
		const datasetsMap = new Map(); // 重複排除のためのMap
		const licenseQueries = [
			"license_id=odpt-ptodbl", // 公共交通オープンデータ基本ライセンス
			"license_id=CC-BY-4.0", // CC-BY-4.0
			"license_id=other-noauth", // その他ライセンス（GTFS-RU等）
		];

		for (const query of licenseQueries) {
			let page = 1;
			while (true) {
				// formatとlicense_idを指定して検索
				const url = svgMap.getCORSURL(`${CKAN_BASE}/dataset/?res_format=Protocol+Buffers&${query}&page=${page}`);
				const response = await fetch(url);
				if (!response.ok) {
					throw new Error(
						`CKAN 一覧の取得に失敗しました (HTTP ${response.status})`
					);
				}

				const htmlText = await response.text();
				const parser = new DOMParser();
				const doc = parser.parseFromString(htmlText, "text/html");

				const items = doc.querySelectorAll(".dataset-list .dataset-item");
				if (!items || items.length === 0) {
					break; // このライセンスのページは終了
				}

				for (const item of items) {
					const aTag = item.querySelector(".dataset-heading a");
					if (aTag) {
						const path = aTag.getAttribute("href");
						const datasetId = path.replace("/dataset/", "").trim();
						const rawTitle = aTag.textContent || "";
						const title = cleanTitle(rawTitle);

						// 既に取得済みでなければ追加
						if (!datasetsMap.has(datasetId)) {
							datasetsMap.set(datasetId, {
								id: datasetId,
								title: title,
								path: path,
							});
						}
					}
				}

				const nextBtn = doc.querySelector(
					".pagination a[href*='page=" + (page + 1) + "']"
				);
				if (!nextBtn) {
					break;
				}
				page++;
			}
		}

		// Mapの値を配列に戻してタイトル順にソート
		return Array.from(datasetsMap.values()).sort((a, b) =>
			a.title.localeCompare(b.title, "ja")
		);
	}

	/**
	 * 選択されたデータセットの個別HTMLを取得し、各リソース個別ページから正確なエンドポイント名を判定
	 * @param {string} datasetPath 例: "/dataset/b_bus_gtfs_rt-toei"
	 * @returns {Promise<{vehicle: string|null, trip: string|null, alert: string|null}>}
	 */
	async function fetchDatasetResources(datasetPath) {
		const url = svgMap.getCORSURL(`${CKAN_BASE}${datasetPath}`);
		const response = await fetch(url);
		if (!response.ok) {
			throw new Error(
				`データセット詳細の取得に失敗しました (HTTP ${response.status})`
			);
		}

		const htmlText = await response.text();
		const parser = new DOMParser();
		const doc = parser.parseFromString(htmlText, "text/html");

		// データセット個別ページからライセンス表記を抽出
		let licenseName = "公共交通オープンデータ基本ライセンス";
		let licenseUrl = "https://developer.odpt.org/terms";

		const licenseSection = doc.querySelector("section.license");
		if (licenseSection) {
			const licenseLink = licenseSection.querySelector("a");
			if (licenseLink) {
				licenseName = licenseLink.textContent.trim() || licenseName;
				licenseUrl = licenseLink.getAttribute("href") || licenseUrl;
			} else {
				// <a>タグがない場合（「その他ライセンス」等）
				const span = licenseSection.querySelector("[property='dc:rights']");
				if (span) {
					licenseName = span.textContent.trim();
					// odptBusLoc.jsを変更しないため、データセット自体のURLをリンク先にする
					licenseUrl = `${CKAN_BASE}${datasetPath}`;
				}
			}
		}

		// 「その他ライセンス」の場合、概要文の中にGTFS-RUのリンクがあればそれを優先
		if (licenseName.includes("その他") || licenseName.includes("Other")) {
			const notesLink = doc.querySelector(".notes a[href*='GTFS-RU']");
			if (notesLink) {
				licenseName = "GTFS-RUライセンス";
				licenseUrl = notesLink.getAttribute("href");
			}
		}

		const resources = {
			vehicle: null,
			trip: null,
			alert: null,
			licenseName: licenseName,
			licenseUrl: licenseUrl,
		};

		// 1. データセット内のリソースリンク一覧を取得
		const resourceLinks = doc.querySelectorAll(
			"#dataset-resources .resource-item a.heading"
		);
		const foundResourceNames = [];

		// 各リソースの個別の説明ページから正確なURLを抽出
		for (const link of resourceLinks) {
			const resourcePath = link.getAttribute("href"); // 例: /dataset/.../resource/4c440b4d...
			if (!resourcePath) continue;

			try {
				const resUrl = svgMap.getCORSURL(`${CKAN_BASE}${resourcePath}`);
				const resResponse = await fetch(resUrl);
				if (!resResponse.ok) continue;

				const resHtml = await resResponse.text();
				const resDoc = parser.parseFromString(resHtml, "text/html");

				// <a class="resource-url-analytics"> から正確な URL をピンポイント取得
				const analyticsAnchor = resDoc.querySelector(
					"a.resource-url-analytics"
				);
				const href = analyticsAnchor
					? analyticsAnchor.getAttribute("href")
					: "";

				// URL 末尾のキャメルケース識別名を抽出 (例: ToeiBus や odpt_JoshinHire_AllLines_vehicle)
				const match = href.match(/\/gtfs\/realtime\/([a-zA-Z0-9_-]+)/);
				if (match) {
					const resourceName = match[1];
					foundResourceNames.push(resourceName);

					if (resourceName.endsWith("_vehicle")) {
						resources.vehicle = resourceName;
					} else if (resourceName.endsWith("_trip_update")) {
						resources.trip = resourceName;
					} else if (resourceName.endsWith("_alert")) {
						resources.alert = resourceName;
					}
				}
			} catch (e) {
				console.warn("リソース詳細の解析をスキップ:", resourcePath, e);
			}
		}

		// 2. 特殊パターン対応（ToeiBus などのように _vehicle 等のサフィックスが付いていない単体名の場合）
		if (!resources.vehicle && foundResourceNames.length > 0) {
			// 見つかった名前をそのまま vehicle 用として割り当てる
			resources.vehicle = foundResourceNames[0];
		}

		// 3. 万が一ページから読み取れなかった場合のフォールバック (HTML全テキストから検索)
		if (!resources.vehicle) {
			const allMatches = Array.from(
				htmlText.matchAll(/\/gtfs\/realtime\/([a-zA-Z0-9_-]+)/g)
			);
			for (const m of allMatches) {
				const name = m[1];
				if (name.endsWith("_vehicle") && !resources.vehicle)
					resources.vehicle = name;
				if (name.endsWith("_trip_update") && !resources.trip)
					resources.trip = name;
				if (name.endsWith("_alert") && !resources.alert) resources.alert = name;
			}
			if (!resources.vehicle && allMatches.length > 0) {
				resources.vehicle = allMatches[0][1];
			}
		}

		return resources;
	}

	function cleanTitle(rawTitle) {
		if (!rawTitle) return "";
		let title = rawTitle.replace(/【リアルタイム情報】/g, "").trim();
		if (title.includes(" / ")) {
			title = title.split(" / ")[0];
		}
		return title;
	}

	return {
		fetchDatasetList,
		fetchDatasetResources,
	};
})();
