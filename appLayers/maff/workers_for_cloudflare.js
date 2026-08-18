// eMAFF専用プロキシ (Cloudflare Workers用)
// License: (MPL v2)
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.

export default {
	async fetch(request, env, ctx) {
		// ========================================================
		// アクセス元（Origin）フィルター ＆ CORS共通処理
		// ========================================================
		// 許可するドメインのリスト（www有無・サブドメイン対応）
		const allowedOrigins = [
			"svgmap.org",
			"sssvgmap.stars.ne.jp",
			"svgmap.github.io",
		];

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
						allowOriginHeader = origin || `${urlObj.protocol}//${hostname}`;
						break;
					}
				}
			} catch (e) {
				// URLのパース失敗時は弾く
			}
		}

		// 許可されていない、または直接叩かれた場合は 403 Forbidden
		if (!isAllowed) {
			return new Response(
				JSON.stringify({ error: "Access Denied: Invalid Origin/Referer" }),
				{
					status: 403,
					headers: { "Content-Type": "application/json; charset=utf-8" },
				}
			);
		}

		const corsHeaders = {
			"Access-Control-Allow-Origin": allowOriginHeader,
			"Access-Control-Allow-Methods": "POST, OPTIONS", // eMAFFはPOSTメソッドのみ使用
			"Access-Control-Allow-Headers": "Content-Type",
			"Content-Type": "application/json; charset=utf-8",
		};

		// プリフライト（OPTIONSメソッド）への即時応答
		if (request.method === "OPTIONS") {
			return new Response(null, { headers: corsHeaders });
		}

		// ========================================================
		// ターゲット(eMAFF)への転送処理
		// ========================================================
		// eMAFFはPOST通信のみ受け付けるため、それ以外は弾く
		if (request.method !== "POST") {
			return new Response(
				JSON.stringify({ error: "Method Not Allowed. Use POST." }),
				{
					status: 405,
					headers: corsHeaders,
				}
			);
		}

		const targetUrl =
			"https://map-internal.api.maff.go.jp/mobileapi/getBasicLayerGeometry";

		// フロントエンド(LaWA)から送られてきたJSONペイロードを取得
		const jsonPayload = await request.text();

		// MAFFへ送るためのヘッダーを構築
		const maffHeaders = new Headers({
			"Content-Type": "application/json",
			Origin: "https://map.maff.go.jp",
			Referer: "https://map.maff.go.jp/",
			Authorization: "undefined",
			"User-Agent":
				"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36",
		});

		try {
			// リクエスト実行
			const maffResponse = await fetch(targetUrl, {
				method: "POST",
				headers: maffHeaders,
				body: jsonPayload,
			});

			// レスポンスをそのまま取得（Cloudflareは自動でgzip解凍してくれます）
			const responseBody = await maffResponse.arrayBuffer();

			// MAFFから返ってきたHTTPステータスコードをそのままクライアントに返す
			return new Response(responseBody, {
				status: maffResponse.status,
				headers: corsHeaders,
			});
		} catch (error) {
			// 通信エラー時のハンドリング
			return new Response(JSON.stringify({ error: error.message }), {
				status: 500,
				headers: corsHeaders,
			});
		}
	},
};
