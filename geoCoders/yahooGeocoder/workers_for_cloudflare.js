// Yahoo!ジオコーダAPI用 Cloudflare Workers プロキシ
// License: (MPL v2)
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.

// [ClientID] を Yahoo! の管理画面で発行した ID に書き換える
// Yahoo! の管理画面： (https://e.developer.yahoo.co.jp/dashboard)
// allowedOrigins に自分のサイトのドメインを書き入れる
// container.svgのyahooGeocoderのレイヤーのリンク(animation要素)のhrefに以下を記載
// yahooGeocoder.svg#proxy=[デプロイしたCloudflare WorkersのURL]

export default {
	async fetch(request, env, ctx) {
		// ==========================================
		// 0. セキュリティ: アクセス元ドメインの制限
		// ==========================================
		// 許可するドメインのリスト（www有無・サブドメイン対応）
		const allowedOrigins = [
			"svgmap.org",
			"svgmap.github.io",
		];
		const appId = "[ClientID]"; // ※YahooのClientIDをここに設定

		const origin = request.headers.get("Origin");
		const referer = request.headers.get("Referer");
		const clientUrl = origin || referer || "";

		let isAllowed = false;
		let allowOriginHeader = "";

		if (clientUrl) {
			try {
				const urlObj = new URL(clientUrl);
				const hostname = urlObj.hostname;

				for (const domain of allowedOrigins) {
					if (hostname === domain || hostname.endsWith("." + domain)) {
						isAllowed = true;
						// 許可された場合、CORS応答用に正規のオリジン文字列を保持
						allowOriginHeader = origin || `${urlObj.protocol}//${hostname}`;
						break;
					}
				}
			} catch (e) {
				// URLの解析に失敗した場合は弾く
			}
		}

		// 許可されていないドメイン、または直接URLを叩かれた場合は 403 エラーで終了
		if (!isAllowed) {
			return new Response(
				JSON.stringify({ error: "Access Denied: Unauthorized Domain." }),
				{
					status: 403,
					headers: { "Content-Type": "application/json; charset=utf-8" },
				}
			);
		}

		// ==========================================
		// 共通のCORSヘッダー設定 ＆ OPTIONS処理
		// ==========================================
		const corsHeaders = {
			"Access-Control-Allow-Origin": allowOriginHeader,
			"Access-Control-Allow-Methods": "GET, OPTIONS", // ジオコーダは基本GET通信
			"Access-Control-Allow-Headers": "Content-Type",
		};

		// CORSプリフライト（OPTIONSメソッド）への即時応答
		if (request.method === "OPTIONS") {
			return new Response(null, { headers: corsHeaders });
		}

		// ==========================================
		// 1. Yahoo APIへの転送処理
		// ==========================================
		const endpoint = "https://map.yahooapis.jp/geocode/V1/geoCoder";

		// クライアントからのリクエストURLを解析してクエリパラメータを取得
		const requestUrl = new URL(request.url);
		const searchParams = new URLSearchParams(requestUrl.search);

		// ClientIDをサーバー側のものに設定（上書き）
		searchParams.set("appid", appId);

		// outputが未指定ならデフォルトでjsonにする
		if (!searchParams.has("output")) {
			searchParams.set("output", "json");
		}

		// 最終的なターゲットURLを生成
		const targetUrl = `${endpoint}?${searchParams.toString()}`;

		try {
			// Yahoo API へリクエストを実行
			const yahooResponse = await fetch(targetUrl, {
				method: "GET",
			});

			// Yahooから返ってきた Content-Type を取得（指定がなければデフォルトでJSON）
			const contentType =
				yahooResponse.headers.get("Content-Type") ||
				"application/json; charset=utf-8";

			// レスポンスボディを取得
			const responseBody = await yahooResponse.arrayBuffer();

			// クライアントに返すヘッダーを構築（CORSヘッダー ＋ Yahooから取得したContent-Type）
			const responseHeaders = new Headers(corsHeaders);
			responseHeaders.set("Content-Type", contentType);

			// Yahooのステータスコードとデータをそのまま返す
			return new Response(responseBody, {
				status: yahooResponse.status,
				headers: responseHeaders,
			});
		} catch (error) {
			// 通信エラー時のハンドリング
			return new Response(
				JSON.stringify({ error: "Fetch Error: " + error.message }),
				{
					status: 500,
					headers: {
						...corsHeaders,
						"Content-Type": "application/json; charset=utf-8",
					},
				}
			);
		}
	},
};
