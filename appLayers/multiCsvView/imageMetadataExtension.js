// csvに画像データのリンク(ファイル名)があったら、そのファイルを表示できる機能の拡張 - メインwebApp部
//
// Programmed by Satoru Takagi
// 
// License: (MPL v2)
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.
//

import {unzip, HTTPRangeReader} from './unzipit.module.js';

class ImageMetadata{
	constructor(Zlib,Encoding, workDir){
		this.Zlib = Zlib;
		this.Encoding = Encoding;
		this.init();
		if ( workDir ){
			this.#workDir = workDir;
		}
	}
	
	restrigcedImageSize = 800;
	#workDir ="./uploadedImagesZip/";
	
	#imageCache=null; // zipを読むときは使わない。登録時にblobが入っている
	
	init(){
		window.addEventListener("load",function(){
			console.log("imageMetadataExt. Load event:");
			
			this.svgMap = window.svgMap;
			this.svgMap.setShowPoiProperty(this.#customShowPoiProperty, window.layerID);
			
		}.bind(this));
	}
	
	clearImageCache(){
		this.clearZipArchive();
		this.#imageCache=null;
	}
	
	
	addImageBlob(blob, fname){
		if ( !this.#imageCache){
			this.#imageCache ={};
		}
		this.#imageCache[fname]=blob;
		this.blobToDataUrl(blob);
		var ourl = URL.createObjectURL(blob);
		console.log(ourl);
	}
	
	async #uploadZipArchive(zipFileName){
		var zipObj =  new Zlib.Zip();
		for ( var fname in this.#imageCache){
			var imgBlob = this.#imageCache[fname]
			var ui8 = new Uint8Array(await imgBlob.arrayBuffer());
			this.#addZip(ui8, fname, zipObj);
		}
		var compressed = zipObj.compress();
		const zipDataBlob = new Blob([compressed], { 'type': 'application/zip' });
		var ret = this.#sendToServer(zipDataBlob,zipFileName);
		return ret;
	}
	
	
	#addZip(ui8, fileName, zipObj){
		//var fname8 = new TextEncoder().encode(fileName);
		var fname8 = this.#getSjisBytes(fileName);
		zipObj.addFile(ui8, {
			filename: fname8
		});
	}
	
	#getSjisBytes(str){
		return this.Encoding.convert(
			this.Encoding.stringToCode(str),
			{
				to: 'SJIS',
				from: 'UNICODE'
			}
		);
	}
	
	#convertToCharset(sjisArray ){ // charsetStr: sjis
		var dc = this.Encoding.detect(sjisArray );
		//console.log(sjisArray,dc);
		var unicodeArray = this.Encoding.convert(sjisArray, {
			to: 'UNICODE',
			from:dc
		});
		var str = Encoding.codeToString(unicodeArray);
	        return ( str );
	}
	
	async #sendToServer(zipDataBlob,zipFileName){
		//var zipFileName ="myFile.zip";
		try{
			var rep = await this.#sendData( zipDataBlob , zipFileName , "zip", true);
			return("SUCCESS : "+ zipFileName) ;
		} catch ( err ){
			document.getElementById("output").innerText="FAIL";
			return(err);
		}
	}

	#sendData(dataBody, dataTitle, dataType , forceFileNameToTitle) {
		// dataType(str): png, svg, zip, json, geojson, csv
		var data = {
			svgmapdata: dataBody,
			title: dataTitle,
	//		filename: fileName,
		}
		if ( forceFileNameToTitle ){
			data.filename = dataTitle;
		}
		if ( dataType){
			data.type = dataType;
		}
		return new Promise(function(okCallback, ngCallback) {
			var XHR = new XMLHttpRequest();
			var FD  = new FormData();
			
			for(name in data) {
				FD.append(name, data[name]);
			}
			XHR.addEventListener('load', function(event) {
				//console.log("post success:",event,this.responseText);
				if (okCallback){
					okCallback("load,"+this.responseText );
				}
			}.bind(this));
			XHR.addEventListener('error', function(event) {
				console.log('Oups! Something goes wrong.');
				if (ngCallback){
					ngCallback("error");
				}
			}.bind(this));
			XHR.open('POST', this.#workDir+'fileManage.php');
			XHR.send(FD);
		}.bind(this));
	}
	
	async registImageMetadata(csvFileName, registMsgId){
		console.log("registImageMetadata: csvFileName: ",csvFileName);
		if ( Object.keys(this.#imageCache).length ==0){
			console.log("No imageMetadata skip")
			return;
		}
		var zipFileName = csvFileName.split(".")[0];
		console.log("zipFileName:",zipFileName);
		document.getElementById(registMsgId).innerText="Uploading Images";
		var ret = await this.#uploadZipArchive(zipFileName);
		document.getElementById(registMsgId).innerText="Success image uploading";
		setTimeout(function(){
			document.getElementById(registMsgId).innerText="";
		}, 2000);
		return ret;
	}
	
	
	#zipArchiveObj=null;
	async #initZipArchive(path){
		this.#zipArchiveObj={};
		try{
			const reader = new HTTPRangeReader(path);
			this.#zipArchiveObj.data =await unzip(reader);
			var imageIndex = await this.#zipArchiveObj.data.entries;
			this.#zipArchiveObj.nameToKey={};
			for ( var fk in imageIndex){
				var fname = this.#convertToCharset(imageIndex[fk].nameBytes);
				this.#zipArchiveObj.nameToKey[fname]=fk;
			}
			console.log("Regist imageMetaZipArchive : ", imageIndex,this.#zipArchiveObj.nameToKey);
		} catch (e){
			console.warn("No zipArchive skip imageMetadataMode:",path,e);
			this.clearZipArchive();
		}
	}
	
	clearZipArchive(){
		this.#zipArchiveObj=null;
	}
	
	async initImageMetadataZip(csvFileName){
		var zipFileName = this.#workDir + "contents/" + csvFileName.split(".")[0]+".zip";
		this.#initZipArchive(zipFileName);
	}
	
	
	#customShowPoiProperty= async  function(target){
		// デフォルトパネルにリンクや画像貼り付け機能を付加した 
		//console.log ( "Target:" , target , "  parent:", target.parentNode );
		
		//console.log("customShowPoiProperty for imgMetaExt.");
		
	//	var metaSchema = target.parentNode.getAttribute("property").split(",");
		var metaSchema = null;
		if ( target.ownerDocument.firstChild.getAttribute("property") ){
			metaSchema = target.ownerDocument.firstChild.getAttribute("property").split(","); // debug 2013.8.27
		}


		var message="<table border='1' style='word-break: break-all;table-layout:fixed;width:100%;border:solid orange;border-collapse: collapse;font-size:12px'>";
		
		var titleAndLayerName ="";
		if ( target.getAttribute("data-title")){
			titleAndLayerName = target.getAttribute("data-title") + "/" + target.getAttribute("data-layername") + "\n";
		}
		
		var metaContent =  target.getAttribute("content")
		if ( metaContent ){ // contentメタデータがある場合
			
			var metaData = this.svgMap.parseEscapedCsvLine(metaContent);
			
			message += "<tr><th style='width=25%'>name</th><th>value</th></tr>";
			if ( titleAndLayerName != ""){
				message += "<tr><td>title/Layer</td><td> " + titleAndLayerName + "</td></tr>";
			}
			
			if ( metaSchema && metaSchema.length == metaData.length ){
				for ( var i = 0 ; i < metaSchema.length ; i++ ){
					if (metaSchema[i].toLowerCase()=="properties"){ // 正規化されてないgeojsonのケースは key:value;....の羅列
						var nprops = metaData[i].split(";");
						for ( var npnv of nprops){
							npnv = npnv.split(":");
							if ( npnv.length==2){
								message += "<tr><td>"+decodeURIComponent(npnv[0]) + "</td><td> " + await this.#getHTMLval(decodeURIComponent(npnv[1])) + "</td></tr>";
							} else {
								message += "<tr><td>" + decodeURIComponent(npnv.join(":")) + "</td></tr>";
							}
						}
						/**
							if ( npnv.length==2){
								message += "<tr><td>"+npnv[0] + " </td><td> " + await this.#getHTMLval(npnv[1]) + "</td></tr>";
							} else {
								message += "<tr><td>--"+</td><td> " + npnv.join() + "</td></tr>";
							}
						}
						**/
					} else {
						var data = "--";
						if ( metaData[i]!=""){
							data = metaData[i];
						}
						message += "<tr><td>"+metaSchema[i] + " </td><td> " + await this.#getHTMLval(data) + "</td></tr>";
					}
				}
			} else {
				for ( var i = 0 ; i < metaData.length ; i++ ){
					var data = "--";
					if ( metaData[i]!=""){
						data = metaData[i];
					}
					message += "<tr><td>"+ i + " </td><td> " + await this.#getHTMLval(data) + "</td></tr>";
				}
			}

		} else { // 無い場合
			var nm = target.attributes;
			for ( var i = 0 ; i < nm.length ; i++ ){
				message += "<tr><td>" + nm.item(i).nodeName + " </td><td> " + target.getAttribute(nm.item(i).nodeName) + "</td></tr>";
			}
		}
		
		if ( this.svgMap.getHyperLink(target) ){
			message += "<tr><td>link</td> <td><a href='" + this.svgMap.getHyperLink(target).href + "' target=`_blank'>" +  this.svgMap.getHyperLink(target).href + "</a></td></tr>";
		}
		
		if ( target.getAttribute("lat") ){
			message += "<tr><td>latitude</td> <td>" + this.#getFormattedRange(target.getAttribute("lat")) + "</td></tr>";
			message += "<tr><td>longitude</td> <td>" + this.#getFormattedRange(target.getAttribute("lng")) + "</td></tr>";
		}
		
		message += "</table>";
		//console.log(message);
		this.svgMap.showModal(message,400,600);

	}.bind(this);
	
	#getFormattedRange( prop ){
		var rangeStr = prop.split(",");
		var ans = "";
		for ( var i = 0 ; i < rangeStr.length ; i++ ){
			ans += this.svgMap.numberFormat(Number(rangeStr[i]),6);
			if ( i < rangeStr.length - 1 ){
				ans += ",";
			}
		}
		return ( ans );
	}
	
	async #getHTMLval( val ){
		var ans;
		if ( val.toLowerCase().indexOf(".png")>=0 || val.toLowerCase().indexOf(".jpg")>=0 || val.toLowerCase().indexOf(".jpeg")>=0 || val.toLowerCase().indexOf(".gif")>=0 || val.toLowerCase().indexOf(".svg")>=0){
			if ( val.indexOf("http://")==0){
				ans =`<a target='img' href='${val}'><img style='opacity:1' src='${this.svgMap.getCORSURL(val)}' crossorigin='anonymous' width='100%'/></a>`;
			} else if ( val.indexOf("https://")==0){
				ans ="<a target='img' href='"+ val +"'><img style='opacity:1' src='" + val +"' width='100%'/></a>";
			} else {
				var fileName = val.split("/");
				fileName=fileName[fileName.length-1];
				ans = await this.#getImageMetaData(fileName);
			}
		} else if ( val.indexOf("http://")==0 || val.indexOf("https://")==0 || val.toLowerCase().indexOf(".html")>=0 || val.indexOf(".htm")>=0){
			ans ="<a target='htmlContent' href='"+val+"'>"+val+"</a>";
		} else {
			ans = val;
		}
		//console.log("getHTMLval:",val, ans);
		return ( ans );
	}
	
	async #getImageMetaData(fileName){
		var ans;
		if ( this.#zipArchiveObj ){ // サーバにzipがある場合(登録済みコンテンツの場合)
			try{
				var fk = this.#zipArchiveObj.nameToKey[fileName]
				//console.log(fileName,fk);
				var blob=await this.#zipArchiveObj.data.entries[fk].blob()
				blob = new Blob([blob],{type:"image/jpg"});
				var blobSrc = await this.blobToDataUrl(blob);
				//console.log(blobSrc);
				ans =`<img style='opacity:1;cursor: pointer;' src='${blobSrc}' width='100%' alt='${fileName}'  onclick='popup = window.open();popup.document.write(\"<img src=\\\"${blobSrc}\\\" />\");'/>`;
			} catch ( e ){
				console.warn(e);
				ans = fileName;
			}
		} else if ( this.#imageCache ){ // ローカルに全部存在している場合(オーサリングしているとき)
			var ib = this.#imageCache[fileName];
			if ( ib ){
				var blobSrc = await this.blobToDataUrl(ib);
				ans =`<img style='opacity:1;cursor: pointer;' src='${blobSrc}' width='100%' alt='${fileName}'  onclick='popup = window.open();popup.document.write(\"<img src=\\\"${blobSrc}\\\" />\");'/>`;
			}else {
				ans = fileName;
			}
		} else {
			ans = fileName;
		}
		return ans;
	}
	
	#blobToImage(blob){
		return new Promise(resolve => {
			const url = URL.createObjectURL(blob)
			let img = new Image()
			img.onload = () => {
				URL.revokeObjectURL(url)
				resolve(img)
			}
			img.src = url
		})
	}
	
	blobToDataUrl(blob){
		return new Promise((resolve, reject) => {
			const reader = new FileReader();
			reader.onloadend = function(){
				//console.log(reader.result);
				resolve(reader.result)
			}.bind(this)
			reader.onerror = reject;
			reader.readAsDataURL(blob);
		});
	}
	
	#blobToDataURL2(blob) {
		return new Promise(function(resolve){
			const reader = new FileReader();
			reader.onload = function(event) {
				resolve(event.target.result);
			};
			reader.readAsDataURL(blob);
		});
	}
}

export{ImageMetadata};