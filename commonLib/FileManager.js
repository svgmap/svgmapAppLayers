// Description:
// FileManager class
//
// Programmed by Satoru Takagi
// 
// License: (MPL v2)
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.
//
class FileManager{
	serviceUrl = "./fileManage.php";
	indexUrl = "./index.txt";
	// get sync
	// get remoe=fileName
	// post svgmapdata & title
	
	constructor(){
	}
	
	init = async function(){
		var ret = await this.getIndex();
		return ret;
	}
	
	syncIndex=async function(){
		var res=await fetch(`${this.serviceUrl}?sync`);
		var success = false;
		if ( (await res.text()).toLowerCase().trim().indexOf("success"==0)){
			await this.getIndex();
			success = true;
		} else {
			console.warn("Fail sync");
		}
		return success;
	}.bind(this);
	
	indexData;
	getIndex = async function(){
		var res=await fetch(`${this.indexUrl}?t=${new Date().getTime()}`);
		if ( res.status!=200){
			console.warn("NO Index data exit");
			return null
		}
		var txt = await res.text();
		var dat = this.#updateIndexData(txt);
		console.log("indexData:",dat, "  res:",res)
		return dat;
	}.bind(this);
	
	removeSvgContent = async function(fileName){
		var success = false;
		var res=await fetch(`${this.serviceUrl}?remove=${fileName}`);
		var txt = await res.text();
		console.log("removeSvgContent: ", txt);
		if ( txt.toLowerCase().trim().indexOf("success"==0)){
			success = true;
			await this.getIndex();
		} else {
			console.warn("Fail remove :" , txt);
		}
		return success;
	}.bind(this);
	
	#updateIndexData(csvTxt,append){
		var txt = csvTxt.split("\n");
		var dat ={};
		var colLen = -1;
		for ( var line of txt){
			var row=[];
			line = line.trim();
			if ( !line){continue}
			line = line.split(","); // エスケープはない前提のcsv
			if (colLen < 0 && line.length>0){colLen=line.length}
			if ( line.length != colLen ){continue}
			for ( var cell of line){
				cell = cell.trim();
				row.push(cell);
			}
			dat[row[0]]=row;
		}
		if ( append){
			for ( var k in dat){
				if (this.indexData[k]){
					console.warn("重複している:",k);
				} else {
					this.indexData[k]=dat[k];
				}
			}
		} else {
			this.indexData = dat;
		}
		return this.indexData;
	}
	
	getDateTime(dt){
		dt = dt.substring(0,4)+"/"+dt.substring(4,6)+"/"+dt.substring(6,8)+" "+dt.substring(8,10)+":"+dt.substring(10,12);
		return dt;
	}
	registSvgContent = async function(svgContentText,contentTitle){
		var data ={
			svgmapdata:svgContentText,
			title:contentTitle
		}
		console.log("registSvgContent:",data);
		return new Promise(function(okCallback, ngCallback){
			this.#sendData(data, function(ret){
				if (ret.status =="error"){
					ngCallback(ret)
				} else {
					var resp = this.#updateIndexData(ret.response, true);
					ret.response = resp;
					okCallback(ret);
				}
			}.bind(this));
		}.bind(this));
	}.bind(this);
	
	#sendData(data,cbf) {
		var XHR = new XMLHttpRequest();
		var FD  = new FormData();
		
		for(name in data) {
			FD.append(name, data[name]);
		}
		XHR.addEventListener('load', function(event) {
			console.log("post success:",event,XHR.responseText);
			if (cbf){
				cbf({status:"success", response:XHR.responseText});
			}
		}.bind(this));
		XHR.addEventListener('error', function(event) {
			console.log('Oups! Something goes wrong.');
			if (cbf){
				cbf({status:"error"});
			}
		});
		XHR.open('POST', this.serviceUrl);
		XHR.send(FD);
	}

	xml2Str(xmlNode) {
		try {
			// Gecko- and Webkit-based browsers (Firefox, Chrome), Opera.
			return (new XMLSerializer()).serializeToString(xmlNode);
		}
		catch (e) {
			try {
				// Internet Explorer.
				return xmlNode.xml;
			}
			catch (e) {
				//Other browsers without XML Serializer
				alert('Xmlserializer not supported');
			}
		}
		return false;
	}
	
}
export {FileManager}