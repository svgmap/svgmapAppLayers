// Description: Geminiを使用して、表示したいレイヤーを検索するモジュール (BYOK版)
// HTML側でこのモジュールを差し替えることで、BYOK方式と自前サーバー方式を切り替え可能。
// 
// License: (MPL v2)
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.

// ==========================================
// 1. セキュリティ・暗号化ロジック (BYOK用)
// ==========================================
const STORAGE_KEY = 'enc_gemini_key';
const cryptoSubtle = crypto.subtle;

async function getAesKey(passphrase, salt) {
	const enc = new TextEncoder();
	const keyMaterial = await cryptoSubtle.importKey(
		"raw", enc.encode(passphrase), {name: "PBKDF2"}, false, ["deriveKey"]
	);
	return await cryptoSubtle.deriveKey(
		{name: "PBKDF2", salt: salt, iterations: 100000, hash: "SHA-256"},
		keyMaterial, {name: "AES-GCM", length: 256}, false, ["encrypt", "decrypt"]
	);
}

export async function saveKey(apiKey, passphrase) {
	const salt = crypto.getRandomValues(new Uint8Array(16));
	const iv = crypto.getRandomValues(new Uint8Array(12));
	const key = await getAesKey(passphrase, salt);
	const encrypted = await cryptoSubtle.encrypt({name: "AES-GCM", iv: iv}, key, new TextEncoder().encode(apiKey));
	
	const encJson = JSON.stringify({ 
		s: Array.from(salt), 
		i: Array.from(iv), 
		d: Array.from(new Uint8Array(encrypted)) 
	});
	localStorage.setItem(STORAGE_KEY, encJson);
}

export async function loadKey(passphrase) {
	const encJson = localStorage.getItem(STORAGE_KEY);
	if (!encJson) throw new Error("キーが保存されていません。");
	
	const obj = JSON.parse(encJson);
	const salt = new Uint8Array(obj.s), iv = new Uint8Array(obj.i), data = new Uint8Array(obj.d);
	const key = await getAesKey(passphrase, salt);
	const decrypted = await cryptoSubtle.decrypt({name: "AES-GCM", iv: iv}, key, data);
	
	return new TextDecoder().decode(decrypted);
}

export function hasKey() {
	return !!localStorage.getItem(STORAGE_KEY);
}

export function removeKey() {
	localStorage.removeItem(STORAGE_KEY);
}

// ==========================================
// 2. AI 検索ロジック
// ==========================================

/**
 * AIを利用してレイヤーを検索する
 * @param {string} query - ユーザーの検索キーワードや要望
 * @param {Array} availableLayers - HTML側から渡される抽出対象のレイヤー一覧 [{name, category}, ...]
 * @param {string} passphrase - 復号用の合言葉 (自前サーバー版では無視される想定)
 * @returns {Promise<Array>} - 推測されたレイヤーの配列 [{name, category}, ...]
 */
export async function searchLayers(query, availableLayers, passphrase) {
	// レイヤーをカテゴリごとにグループ化
	const groupedLayers = {};
	availableLayers.forEach(layer => {
		if (!groupedLayers[layer.category]) groupedLayers[layer.category] = [];
		groupedLayers[layer.category].push(layer.name);
	});

	// プロンプトの構築
const prompt = `
あなたは地図アプリの専門的なレイヤー選択アシスタントです。

【データ構造の説明】
提供する【利用可能なレイヤー一覧】はJSON形式です。
- キー：カテゴリ名（例: "公共施設"）
- 値：そのカテゴリに属するレイヤー名の配列（例: ["病院", "避難所"]）

【タスク】
ユーザーの【要望】に合致する「レイヤー名」を推測して抽出してください。

【⚠️ 抽出（マッチング）のルール】
1. 単語の表面的な一致だけでなく、あなたの一般的な知識（同義語、関連用語、固有名詞など）を最大限に活かして、意味的に関連するレイヤーを幅広く推測してください。
（例：「気象衛星」の要望に対して「ひまわり」を選ぶ、「雨」の要望に対して「降水」を選ぶなど）
2. 関連する可能性が高いレイヤーは出し惜しみせず、可能な限り複数個（上位すべて）抽出してください。

【⚠️ 出力（フォーマット）の厳守ルール】
1. 出力する「レイヤー名」は、【利用可能なレイヤー一覧】内に実在するものを一言一句変えずに（完全一致で）記述してください。決して捏造しないでください。
2. 「カテゴリ名」自体をレイヤー名として抽出してはいけません。
3. 抽出したレイヤーは、ユーザーの要望に対する関連度が高い順に並べてください。
4. 同一のレイヤー名を複数回出力しないでください。
5. 出力は、必ず以下の形式のJSON配列のみとしてください。説明文やマークダウンは一切禁止です。

[{"name": "抽出したレイヤー名", "category": "そのレイヤーが属するカテゴリ名"}]

【利用可能なレイヤー一覧】
${JSON.stringify(groupedLayers)}

【要望】
${query}
`;

	let apiKey = null;
	try {
		// APIキーの復号
		apiKey = await loadKey(passphrase); 
		const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key=${apiKey}`;

		// APIリクエスト
		const response = await fetch(url, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				contents: [{ parts: [{ text: prompt }] }],
				generationConfig: { responseMimeType: "application/json" }
			})
		});

		// セキュリティ: 平文キーをメモリから即時破棄
		apiKey = null; 

		const data = await response.json();
		if (response.ok) {
			// 成功時: JSON配列を返却
			return JSON.parse(data.candidates[0].content.parts[0].text);
		} else {
			// エラーハンドリング
			if (response.status === 429 || (data.error && data.error.message.includes("quota"))) {
				throw new Error("APIの呼び出し制限に達しました。しばらく待ってからお試しください。");
			} else {
				throw new Error(`APIエラー: ${data.error.message}`);
			}
		}
	} catch (error) {
		// 復号失敗やネットワークエラーをキャッチ
		if (error.message.includes("API") || error.message.includes("制限")) {
			throw error; // 上で定義したエラーはそのまま投げる
		}
		throw new Error("復号の失敗、または通信エラーです。合言葉が正しいか確認してください。");
	} finally {
		apiKey = null; // 念のためfinallyでも破棄
	}
}