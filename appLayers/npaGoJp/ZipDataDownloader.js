// ZipDataDownloader
// zip圧縮されたファイルをダウンロードし解凍する。
// zip.js (https://gildas-lormeau.github.io/zip.js/)を簡単に使えるようにする
// 
// Programmed by Satoru Takagi
//  Copyright (C) 2023 by Satoru Takagi @ KDDI CORPORATION
//  
// License: (GPL v3)
//  This program is free software: you can redistribute it and/or modify
//  it under the terms of the GNU General Public License version 3 as
//  published by the Free Software Foundation.
//  
//  This program is distributed in the hope that it will be useful,
//  but WITHOUT ANY WARRANTY; without even the implied warranty of
//  MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
//  GNU General Public License for more details.
//  
//  You should have received a copy of the GNU General Public License
//  along with this program.  If not, see <http://www.gnu.org/licenses/>.
//
// How to use:
// import {ZipDataDownloader} from "./ZipDataDownloader.js";
// var data = await ZipDataDownloader.download(path);
//
// History
// 2022/06 initial rev.
// 2023/01/26 Support for new zip.js(2.6.62), statification

import {
	BlobReader,
	BlobWriter,
	ZipReader,
} from "https://deno.land/x/zipjs@v2.6.62/index.js";

class ZipDataDownloader {
	constructor() {}

	static download = async function (url, options) {
		var progressCallBack;
		var httpHeaders;
		var charsetName;
		if (options) {
			progressCallBack = options.progress;
			httpHeaders = options.headers;
			charsetName = options.charset;
		}

		var response = await fetch(url, { headers: httpHeaders });
		if (!response.ok) {
			throw "ERROR: " + response.status;
		}
		var abuf = await ZipDataDownloader.#downloadBinaryData(
			response,
			progressCallBack
		);
		var zblob = new Blob([abuf]);
		const zipFileReader = new BlobReader(zblob);
		const zipReader = new ZipReader(zipFileReader);

		var parentDirURL = "";
		var storeResult = await ZipDataDownloader.#storeContents(
			zipReader,
			parentDirURL,
			progressCallBack,
			charsetName
		);
		return storeResult;
	};

	// Use the reader to read each of the files inside the zip
	// and put them into the offline cache.
	static #storeContents = async function (
		reader,
		parentDirURL,
		progressCallBack,
		charsetName
	) {
		var entries = await reader.getEntries();
		var entLen = entries.length;
		var storeCount = 0;
		var ans = [];
		for (var entry of entries) {
			var ret = await ZipDataDownloader.#storeEntry(entry, parentDirURL,charsetName);
			++storeCount;
			if (progressCallBack) {
				progressCallBack(storeCount / entLen);
			}
			ans.push(ret);
		}
		return ans;
	};

	static #storeEntry = async function (entry, parentDirURL,charsetName) {
		if (entry.directory) {
			return { result: "skip" };
		}
		var cBlob = await ZipDataDownloader.#getUnzippedData(entry);
		//console.log("dir:",parentDirURL," fName:",entry.filename," contentBlob:",cBlob);
		var cURL = parentDirURL + entry.filename;
		var ret;
		//console.log("dataBlob:",cBlob," url:",cURL);
		if (cBlob.type.indexOf("image") >= 0) {
			ret = await ZipDataDownloader.#blobToDataURL(cBlob);
			//console.log(await ZipDataDownloader.#blobToDataURL(cBlob));
		} else {
			ret = await ZipDataDownloader.#getText(cBlob, charsetName);
			if (cBlob.type.indexOf("json") >= 0) {
				if (ret) {
					ret = JSON.parse(ret);
				} else {
					ret = null;
				}
			}
			//console.log(await ZipDataDownloader.#getText(cBlob));
		}
		return { path: cURL, content: ret, type: cBlob.type };
	};

	static #getUnzippedData = async function (entry) {
		var bw = new BlobWriter(ZipDataDownloader.#getContentType(entry.filename));
		var blob = await entry.getData(bw);
		return blob;
	};

	static #downloadBinaryData = async function (response, progressCallBack) {
		// 進捗がresponse.arrayBuffer()だとわからないので
		// response.arrayBuffer();の代わりに、プログレス表示可能なものを作った
		// https://javascript.info/fetch-progress を参考に
		var total = response.headers.get("content-length"); // なんかnullになるぞ
		// この理由は、apacheのmod-deflateが効いていると、ある程度大きいときにこれが不確定になるため
		// zipはそもそも圧縮不要なので切れば良い（下記）
		//      SetEnvIfNoCase Request_URI \.(?:gif|jpe?g|png|zip|ico)$ no-gzip dont-vary
		const reader = response.body.getReader();
		let receivedLength = 0;
		let chunks = [];
		while (true) {
			const { done, value } = await reader.read();
			if (done) {
				break;
			}
			chunks.push(value);
			receivedLength += value.length;
			var progress = receivedLength;
			if (total) {
				progress = progress / total;
			}
			if (progressCallBack) {
				progressCallBack(progress);
			}
			//			console.log(`Received ${receivedLength} of ${total}`)
		}
		let abuf = new Uint8Array(receivedLength);
		let position = 0;
		for (let chunk of chunks) {
			abuf.set(chunk, position);
			position += chunk.length;
		}
		//		console.log("abuf:",abuf);
		return abuf;
	};

	static #contentTypesByExtension = {
		css: "text/css",
		js: "application/javascript",
		png: "image/png",
		jpg: "image/jpeg",
		jpeg: "image/jpeg",
		html: "text/html",
		htm: "text/html",
		svg: "image/svg+xml",
		json: "application/json",
		geojson: "application/json",
	};
	static #getContentType(filename) {
		var tokens = filename.split(".");
		var extension = tokens[tokens.length - 1];
		return (
			ZipDataDownloader.#contentTypesByExtension[extension] || "text/plain"
		);
	}

	// https://qiita.com/koushisa/items/4a3e98358a7ce110aeec
	static #getText(blob,charsetName) {
		var fileReader = new FileReader();

		return new Promise((resolve, reject) => {
			fileReader.onerror = () => {
				fileReader.abort();
				reject();
			};

			fileReader.onload = () => {
				resolve(fileReader.result);
			};
			
			if ( charsetName ){
				fileReader.readAsText(blob, charsetName);
			} else {
				fileReader.readAsText(blob);
			}
		});
	}
	//https://stackoverflow.com/questions/68725158/converting-blob-to-data-url
	static #getDataURL(blob) {
		var ret = URL.createObjectURL(blob);
		return ret;
	}
	static #blobToDataURL(blob) {
		return new Promise(function (callback) {
			var a = new FileReader();
			a.onload = function (e) {
				callback(e.target.result);
			};
			a.readAsDataURL(blob);
		});
	}
}
export { ZipDataDownloader };
