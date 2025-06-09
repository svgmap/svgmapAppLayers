// Description:
// Tiny Csv Data Reader
// 
//  Programmed by Satoru Takagi
// 
// License: (MPL v2)
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.

class CsvFetcher{
	#useCORSproxy = false;

	getCsvSchema(col){
		var latCol=-1,lngCol=-1;
		var metaSchema=[];
		for ( var i = 0 ; i < col.length ; i++ ){
			if (latCol==-1 && (col[i]=="lat" || col[i]=="latitude" || col[i]=="緯度") ){
				latCol = i;
			} else if (lngCol==-1 && (col[i]=="lon" || col[i]=="lng" || col[i]=="longitude" || col[i]=="経度" )){
				lngCol = i;
			} else {
				metaSchema.push(col[i]);
			}
		}
		return {
			latCol:latCol,
			lngCol:lngCol,
			metaSchema:metaSchema
		}
	}

	async fetchCsv(path, useCORSproxyOpt){
		if ( useCORSproxyOpt ){
			this.#useCORSproxy = useCORSproxyOpt;
		}
		var txt = await  this.#fetchText(path)
		return (this.parseCsv(txt));
	}
	
	parseCsv(txt){
		var ans = [];
		txt = txt.split("\n");
		for ( var line of txt ){
			if ( line ){
				// https://www.ipentec.com/document/csharp-read-csv-file-by-regex
				var col = line.split(/,(?=(?:[^"]*"[^"]*")*[^"]*$)/);
				for ( var i=0 ; i < col.length ; i++){
					col[i]=(col[i].replace('"',"")).trim();
				}
				//	console.log(line,col);
				ans.push(col);
			}
		}
		return (ans);
	}

	async #fetchText(path){
		var dt = new Date().getTime();
		if (path.indexOf("?")>0){
			path = path + "&time="+dt;
		} else {
			path = path + "?time="+dt;
		}
		if ( this.#useCORSproxy ){
			path = svgMap.getCORSURL(path);
		}
		var response = await fetch(path);
		var txt = await response.text();
		
		return ( txt );
	}
}
export { CsvFetcher };