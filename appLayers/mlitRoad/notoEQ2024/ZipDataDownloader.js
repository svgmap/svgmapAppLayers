// ZipDataDownloader: zip.jsをasync/awaitなどでモダンに使えるようにする
//
// Programmed by Satoru Takagi
// 
// License: (MPL v2)
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.
//
//
// 2023/01/26 1st rel.
// 2024/05/01 support sjis (shift-jis) text ( option:{encoding:"sjis"} )

class ZipDataDownloader{
	
	#zip; // zipLib
	
	constructor(zipLib){
		this.#zip = zipLib;
		this.#zip.useWebWorkers = false;
	}
	
	download = async function(url, options ){
		var progressCallBack = options?.progress;
		var encoding = options?.encoding;
		var httpHeaders = options?.headers;
		
		var response = await fetch(url, {headers:httpHeaders});
		console.log(response);
		if ( !response.ok){
			throw( "ERROR: "+ response.status);
		}
		var abuf = await this.#downloadBinaryData(response, progressCallBack);
		var zrdr = await this.#getZipReader(abuf);
		var parentDirURL="";
		var storeResult = await this.#storeContents(zrdr,parentDirURL, progressCallBack, encoding);
		return ( storeResult);
	}
	
	// Use the reader to read each of the files inside the zip
	// and put them into the offline cache.
	#storeContents(reader, parentDirURL, progressCallBack, encoding) {
		return new Promise(function(fulfill, reject) {
			reader.getEntries(function(entries) {
				var entLen = entries.length;
				var storeCount=0;
				//console.log('Installing', entries.length, 'files from zip');
				Promise.all(
					entries.map(
						async function(entry){ // asyncが無くて動きがおかしくなっていたのを修正 2020/6/23
							var ret = await this.#storeEntryToIDB(entry,parentDirURL, encoding);
							++ storeCount;
							if ( progressCallBack ){
								progressCallBack( storeCount / entLen );
							}
							
							return ( ret );
						}.bind(this)
					)
				).then(fulfill, reject);
			}.bind(this));
		}.bind(this));
	}
	
	#storeEntryToIDB = async function (entry,parentDirURL, encoding){
			if (entry.directory) { return({result:"skip"}) };
		var cBlob = await this.#getUnzippedData(entry);
//		console.log("dir:",parentDirURL," fName:",entry.filename," contentBlob:",cBlob);
		var cURL = parentDirURL + entry.filename;
		//var ret = await cacheDB.put({result:"success", idCol:cURL, contentBlob:cBlob});
		var ret;
		//console.log("dataBlob:",cBlob," url:",cURL);
		if ( cBlob.type.indexOf("image")>=0){
			ret = await this.#blobToDataURL(cBlob);
			//console.log(await this.#blobToDataURL(cBlob));
		} else {
			ret = await this.#getText(cBlob, encoding);
			if ( cBlob.type.indexOf("json")>=0){
				if ( ret ){
					ret = JSON.parse(ret);
				} else {
					ret = null;
				}
			}
			//console.log(await this.#getText(cBlob));
		}
		return ( {path:cURL, content:ret, type:cBlob.type} );
	}
	
	#getUnzippedData(entry){
		return new Promise(function(resolve){
			//console.log("entry:",entry);
			entry.getData(new this.#zip.BlobWriter(this.#getContentType(entry.filename)),resolve);
		}.bind(this));
	}
	
	#downloadBinaryData = async function(response, progressCallBack){
		// 進捗がresponse.arrayBuffer()だとわからないので
		// response.arrayBuffer();の代わりに、プログレス表示可能なものを作った
		// https://javascript.info/fetch-progress を参考に
		var total = response.headers.get('content-length'); // なんかnullになるぞ
		// この理由は、apacheのmod-deflateが効いていると、ある程度大きいときにこれが不確定になるため
		// zipはそもそも圧縮不要なので切れば良い（下記）
		//      SetEnvIfNoCase Request_URI \.(?:gif|jpe?g|png|zip|ico)$ no-gzip dont-vary
		const reader = response.body.getReader();
		let receivedLength = 0;
		let chunks = [];
		while(true) {
			const {done, value} = await reader.read();
			if (done) {
				break;
			}
			chunks.push(value);
			receivedLength += value.length;
			var progress = receivedLength;
			if ( total ){
				progress = progress / total;
			}
			if ( progressCallBack ){
				progressCallBack ( progress );
			}
//			console.log(`Received ${receivedLength} of ${total}`)
		}
		let abuf = new Uint8Array(receivedLength);
		let position = 0;
		for(let chunk of chunks) {
			abuf.set(chunk, position);
			position += chunk.length;
		}
//		console.log("abuf:",abuf);
		return ( abuf );
	}
	
	#getZipReader(data) {
		return new Promise(function(fulfill, reject) {
			this.#zip.createReader(new this.#zip.ArrayBufferReader(data), fulfill, reject);
		}.bind(this));
	}
	#contentTypesByExtension = {
		'css': 'text/css',
		'js': 'application/javascript',
		'png': 'image/png',
		'jpg': 'image/jpeg',
		'jpeg': 'image/jpeg',
		'html': 'text/html',
		'htm': 'text/html',
		'svg': 'image/svg+xml',
		'json': 'application/json',
		'geojson': 'application/json'
	}
	#getContentType(filename) {
		var tokens = filename.split('.');
		var extension = tokens[tokens.length - 1];
		return this.#contentTypesByExtension[extension] || 'text/plain';
	}
	
	// https://qiita.com/koushisa/items/4a3e98358a7ce110aeec
	#getText(blob, encoding){
		var fileReader = new FileReader();
		
		return new Promise((resolve, reject) => {
			fileReader.onerror = () => {
				fileReader.abort();
				reject();
			};
			
			fileReader.onload = () => {
				resolve(fileReader.result);
			};
			if ( encoding ){
				fileReader.readAsText(blob, encoding);
			} else {
				fileReader.readAsText(blob);
			}
		});
	}
	//https://stackoverflow.com/questions/68725158/converting-blob-to-data-url
	#getDataURL(blob){
		var ret = URL.createObjectURL(blob);
		return ( ret );
	}
	#blobToDataURL(blob) {
		return new Promise(function(callback) {
			var a = new FileReader();
			a.onload = function(e) {callback(e.target.result);}
			a.readAsDataURL(blob);
		});
	}
}
export {ZipDataDownloader};