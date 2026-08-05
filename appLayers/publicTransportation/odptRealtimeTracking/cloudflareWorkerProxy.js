// Description: ODPT GTFS-Realtime プロキシ for Cloudflare Workers
//   - インライン埋め込みキー ＞ 環境変数 ＞ パブリックAPI の3段階フォールバック対応
//   - パススルー方式による全事業者・変則ID完全対応 (/gtfs/{resource_name})
//   - Origin / Referer 二重アクセス制御
//   - 15秒間のエッジキャッシュ
//
// License: (MPL v2)
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.

// ★ 1. コード内に直接キーを埋め込む場合はここに設定
// (※無効な値のままであれば Cloudflare の環境変数 (env.ODPT_API_KEY) を参照します)
// ----------------------------------------------------------------------------------
// 【Cloudflare Web UIでの環境変数 (ODPT_API_KEY) 設定手順】
//   1. Cloudflare Dashboard にログイン -> [Workers & Pages] を開く
//   2. 対象の Worker を選択 -> [Settings] タブ -> [Variables] を開く
//   3. "Environment Variables" の [Add variable] をクリック
//   4. Variable name: ODPT_API_KEY / Value: (発行されたトークン) を入力して [Save and deploy]
// ----------------------------------------------------------------------------------
const DIRECT_API_KEY = "YOUR_ODPT_API_KEY_HERE";

// 許可するホスト（ドメイン）のリスト
const ALLOWED_HOSTS = ["svgmap.org", "www.svgmap.org", "svgmap.github.io"];

export default {
	async fetch(request, env, ctx) {
		const origin = request.headers.get("Origin");
		const referer = request.headers.get("Referer");

		// リクエスト元のドメイン（ホスト）を抽出するヘルパー関数
		function extractHost(urlStr) {
			if (!urlStr) return null;
			try {
				return new URL(urlStr).hostname;
			} catch (e) {
				return null;
			}
		}

		const originHost = extractHost(origin);
		const refererHost = extractHost(referer);

		const isAllowedOrigin = originHost && ALLOWED_HOSTS.includes(originHost);
		const isAllowedReferer = refererHost && ALLOWED_HOSTS.includes(refererHost);
		const isAllowed = isAllowedOrigin || isAllowedReferer;

		const allowOriginHeader = isAllowed
			? origin || (refererHost ? new URL(referer).origin : "*")
			: "null";

		const corsHeaders = {
			"Access-Control-Allow-Origin": allowOriginHeader,
			"Access-Control-Allow-Methods": "GET, OPTIONS",
			"Access-Control-Allow-Headers": "Content-Type",
		};

		if ((origin || referer) && !isAllowed) {
			return new Response("Forbidden: Access denied for this origin/referer.", {
				status: 403,
				headers: corsHeaders,
			});
		}

		if (request.method === "OPTIONS") {
			return new Response(null, { headers: corsHeaders });
		}

		if (request.method !== "GET") {
			return new Response("Method Not Allowed", {
				status: 405,
				headers: corsHeaders,
			});
		}

		const url = new URL(request.url);
		const pathname = url.pathname;

		// 汎用 GTFS-R パススループロキシ (/gtfs/{resource_name})
		const match = pathname.match(/^\/gtfs\/([a-zA-Z0-9_-]+)$/);
		if (!match) {
			return new Response("Not Found", { status: 404, headers: corsHeaders });
		}

		const resourceName = match[1];

		// 旧関東バスショートカット互換
		let targetResource = resourceName;
		if (resourceName === "kantobus")
			targetResource = "odpt_KantoBus_AllLines_vehicle";
		if (resourceName === "kantobus_trip")
			targetResource = "odpt_KantoBus_AllLines_trip_update";
		if (resourceName === "kantobus_alert")
			targetResource = "odpt_KantoBus_AllLines_alert";

		// ★ APIキーの優先判定ロジック
		// 1) DIRECT_API_KEY が書き換えられていればそれを使用
		// 2) 無ければ Cloudflare の環境変数 (env.ODPT_API_KEY) を使用
		let apiKey = null;
		if (DIRECT_API_KEY && DIRECT_API_KEY !== "YOUR_ODPT_API_KEY_HERE") {
			apiKey = DIRECT_API_KEY;
		} else if (env && env.ODPT_API_KEY) {
			apiKey = env.ODPT_API_KEY;
		}

		// 転送先 URL の決定
		// キーがある場合  : api.odpt.org (認証ありAPI)
		// キーが無い場合  : api-public.odpt.org (認証なしパブリックAPI)
		let targetUrl = "";
		if (apiKey) {
			targetUrl = `https://api.odpt.org/api/v4/gtfs/realtime/${targetResource}?acl:consumerKey=${encodeURIComponent(apiKey)}`;
		} else {
			targetUrl = `https://api-public.odpt.org/api/v4/gtfs/realtime/${targetResource}`;
		}

		// キャッシュ処理（URL単位）
		const cache = caches.default;
		const cacheKeyUrl = new URL(request.url);
		const cacheKey = new Request(cacheKeyUrl.toString(), { method: "GET" });

		let response = await cache.match(cacheKey);

		if (response) {
			const cachedResponse = new Response(response.body, response);
			Object.entries(corsHeaders).forEach(([k, v]) =>
				cachedResponse.headers.set(k, v)
			);
			return cachedResponse;
		}

		try {
			const apiResponse = await fetch(targetUrl, {
				method: "GET",
				headers: { Accept: "application/x-protobuf, application/octet-stream" },
				cf: {
					cacheTtl: 15,
					cacheEverything: true,
				},
			});

			if (!apiResponse.ok) {
				return new Response(
					`ODPT API Error: ${apiResponse.statusText} (${apiResponse.status})`,
					{
						status: apiResponse.status,
						headers: corsHeaders,
					}
				);
			}

			const data = await apiResponse.arrayBuffer();

			response = new Response(data, {
				status: 200,
				headers: {
					...corsHeaders,
					"Content-Type": "application/x-protobuf",
					"Cache-Control": "public, max-age=15",
				},
			});

			ctx.waitUntil(cache.put(cacheKey, response.clone()));

			return response;
		} catch (error) {
			return new Response(`Proxy Error: ${error.message}`, {
				status: 500,
				headers: corsHeaders,
			});
		}
	},
};
