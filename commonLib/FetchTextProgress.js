// https://ja.javascript.info/fetch-progress
class FetchTextProgress {
	constructor() {}

	async fetch(url, callback, charset) {
		if (!charset) {
			charset = "utf-8";
		}
		if (!url) {
			return;
		}
		let response = await fetch(url);
		const reader = response.body.getReader();

		const contentLength = +response.headers.get("Content-Length");
		let receivedLength = 0; // その時点の長さ
		let chunks = []; // 受信したバイナリチャンクの配列(本文を構成します)
		while (true) {
			const { done, value } = await reader.read();
			if (done) {
				break;
			}
			chunks.push(value);
			receivedLength += value.length;
			if (callback) {
				if (contentLength) {
					callback(receivedLength, contentLength);
				} else {
					callback(receivedLength);
				}
			}
			//console.log(`Received ${receivedLength} of ${contentLength}`);
		}
		let chunksAll = new Uint8Array(receivedLength);
		let position = 0;
		for (let chunk of chunks) {
			chunksAll.set(chunk, position);
			position += chunk.length;
		}
		// Step 5: 文字列にデコードします
		let result = new TextDecoder(charset).decode(chunksAll);
		return result;
	}
}
export { FetchTextProgress };
