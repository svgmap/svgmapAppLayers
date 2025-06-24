// Description:
// JaGeocoder.js
// jageocoderを用いたジオコーダ
//
// Programmed by Satoru Takagi
// 
// License: (MPL v2)
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.
//

class JaGeocoder{
	endPointURL=null;
	type="tiny"; // ひとまずはtinyオンリー
	
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
	constructor(endPointURL, type){
		if ( endPointURL ){
			this.endPointURL=endPointURL;
		} else {
			console.warn("サーバのエンドポイントが不明です");
		}
		if ( type && type=="tiny" ){
			this.type = "tiny";
		}
		if ( this.type=="tiny"){
			console.log(`サーバに以下のクエリでアドレス検索します：${endPointURL}[検索文字列]`);
		}
	}
	
	geocode=async function(address){
		var req = `${this.endPointURL}${address}`;
		var res = await fetch(req);
		var ret = await res.json();
		return ( ret );
	}
	
}

export {JaGeocoder}