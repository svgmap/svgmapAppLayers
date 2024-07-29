// from /home/svg2/public_html/devinfo/devkddi/lvl0.1/etcLayers/moj/MojMapGML2GeoJSON_r1.5.js
import {xml2json} from "./xml2json.js";
class CsisGeocoder{
	levelDict={
		"1": ["都道府県",300],
		"2": ["郡・支庁・振興局",100],
		"3": ["市町村・特別区（東京23区）",10],
		"4": ["政令市の区",30],
		"5": ["大字",10],
		"6": ["丁目・小字",2],
		"7": ["街区・地番",0.5],
		"8": ["号・枝番",0.1],
		"0": ["レベル不明",300],
		"-1": ["座標不明",1000]
	}
	constructor(proxy, charset, geosys){
		if ( proxy ){
			this.proxy=proxy;
		}
		if ( charset ){
			this.charset = charset;
		} else {
			this.charset = "UTF8";
		}
		if ( geosys ){
			this.geosys = geosys;
		} else {
			this.geosys = "world";
		}
	}
	
	geocode=async function(address, constraint){
		var geosysParam ="";
		if ( this.geosys != "world"){
			geosysParam =`&geosys=${this.geosys}`;
		}
		var constraintParam ="";
		if ( constraint ){
			constraintParam = `&constraint=${constraint}`;
		}
		var charsetParam = `&charset=${this.charset}`
		var req = `https://geocode.csis.u-tokyo.ac.jp/cgi-bin/simple_geocode.cgi?addr=${address}${charsetParam}${geosysParam}${constraintParam}`;
		if ( this.proxy ){
			req = this.proxy + req;
		}
		var res = await fetch(req);
		var xmlTxt = await res.text();
		var xml = new DOMParser().parseFromString(xmlTxt, "text/xml");
		//console.log(xml);
		var ret = xml2json.xml2js(xml);
		return ( ret );
	}
	
}

export {CsisGeocoder}