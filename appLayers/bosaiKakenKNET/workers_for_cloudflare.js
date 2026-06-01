// 防災科研 K-NET API用 Cloudflare Workers プロキシ (複数ドメイン制限付き)
// License: (MPL v2)
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.

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
			"Access-Control-Allow-Methods": "GET, POST, OPTIONS",
			"Access-Control-Allow-Headers": "Content-Type",
			"Content-Type": "application/json; charset=utf-8",
		};

		// CORSプリフライト（OPTIONSメソッド）への即時応答
		if (request.method === "OPTIONS") {
			return new Response(null, { headers: corsHeaders });
		}

		const url = new URL(request.url);

		// ==========================================
		// ルーティング1: /getTokens.php の処理
		// ==========================================
		if (url.pathname.endsWith("/getTokens.php")) {
			const targetUrl = "https://www.kyoshin.bosai.go.jp/ja/eqdownload/";

			try {
				const res = await fetch(targetUrl);
				const text = await res.text();

				const match1 = text.match(
					/name="csrfmiddlewaretoken"\s+value="([^"]+)"/
				);
				const token1 = match1 ? match1[1] : "";

				let token2 = "";
				const setCookies = res.headers.getSetCookie
					? res.headers.getSetCookie()
					: [res.headers.get("Set-Cookie")];

				for (const c of setCookies) {
					if (c && c.includes("csrftoken=")) {
						const match2 = c.match(/csrftoken=([^;]+)/);
						if (match2) {
							token2 = "csrftoken=" + match2[1];
							break;
						}
					}
				}

				return new Response(JSON.stringify({ token1, token2 }), {
					headers: corsHeaders,
				});
			} catch (e) {
				return new Response(JSON.stringify({ error: e.message }), {
					status: 500,
					headers: corsHeaders,
				});
			}
		}

		// ==========================================
		// ルーティング2: /getData.php の処理
		// ==========================================
		else if (url.pathname.endsWith("/getData.php")) {
			const path = url.searchParams.get("path") || "";
			const cookieStr = url.searchParams.get("cookie") || "";

			if (!path) {
				return new Response(JSON.stringify({ error: "API path is missing." }), {
					status: 400,
					headers: corsHeaders,
				});
			}

			const BASE_URL = "https://www.kyoshin.bosai.go.jp/ja/";
			const targetUrl = BASE_URL + path.replace(/^\//, "");

			let csrfToken = "";
			const urlEncodedData = new URLSearchParams();

			if (request.method === "POST") {
				try {
					const formData = await request.formData();
					for (const [key, value] of formData.entries()) {
						urlEncodedData.append(key, value);
						if (key === "csrfmiddlewaretoken") {
							csrfToken = value;
						}
					}
				} catch (e) {}
			}

			const fetchHeaders = new Headers();
			fetchHeaders.set("X-CSRFToken", csrfToken);
			fetchHeaders.set("X-Requested-With", "XMLHttpRequest");
			fetchHeaders.set("Referer", BASE_URL);
			fetchHeaders.set("Cookie", cookieStr);
			fetchHeaders.set("Content-Type", "application/x-www-form-urlencoded");

			try {
				const res = await fetch(targetUrl, {
					method: "POST",
					headers: fetchHeaders,
					body: urlEncodedData.toString(),
				});

				// K-NETからの生レスポンスを返す際に、共通のCORSヘッダーを付与
				const response = new Response(res.body, res);
				response.headers.set("Access-Control-Allow-Origin", allowOriginHeader);
				return response;
			} catch (e) {
				return new Response(
					JSON.stringify({ error: "Fetch Error: " + e.message }),
					{
						status: 500,
						headers: corsHeaders,
					}
				);
			}
		}

		// ==========================================
		// エラーハンドリング (URLが一致しない場合)
		// ==========================================
		return new Response(
			JSON.stringify({
				error: "Not Found. Use /getTokens.php or /getData.php",
			}),
			{
				status: 404,
				headers: corsHeaders,
			}
		);
	},
};
