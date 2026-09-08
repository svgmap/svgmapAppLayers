// TileExistence.js
// データが存在しない空タイル（Void Tile）のキーを記憶し、無駄なリクエストを防止するキャッシュ管理クラス
//
// License: (MPL v2)
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.

class TileExistence{
	//xyz地図タイル(図法とか関係なく)の地図について、小縮尺のデータをもとに存在をチェックする
	constructor(initialData){ // タイル元データで初期化するとそれを使う
		this.minZ = 99;
		this.maxZ = 0;
		if (initialData){
			if ( initialData instanceof Set){
				this.voidTiles=initialData;
			} else if ( Array.isArray(initialData) ){
				this.voidTiles=new Set(initialData);
			}
			// x_y_zの文字列がSetの中身である必要がある
			this.#checKeys();
		} else {
			this.voidTiles=new Set();
		}
		
	}
	
	#checKeys(){
		for (var key of this.voidTiles){
			this.#updateMinMaxZ(key);
		}
	}
	
	#updateMinMaxZ(key){
		key = this.#getTileNumber(key);
		this.minZ = Math.min(this.minZ, key[2]);
		this.maxZ = Math.max(this.maxZ, key[2]);
	}
	
	addVoidTile(tileKey){
		this.voidTiles.add(this.#getTileKey(tileKey));
		this.#updateMinMaxZ(tileKey)
	}
	#getTileNumber(tileKey){
		if ( Array.isArray(tileKey)){ //[x,y,z]
			// skip
		} else {
			tileKey = tileKey.split("_");
			tileKey[0]=Number(tileKey[0]);
			tileKey[1]=Number(tileKey[1]);
			tileKey[2]=Number(tileKey[2]);
		}
		return (tileKey);
	}
	#getTileKey(tileKey){
		if ( Array.isArray(tileKey)){ //[x,y,z]
			tileKey = `${tileKey[0]}_${tileKey[1]}_${tileKey[2]}`;
		}
		return tileKey;
	}
	isVoidTile(tileKey){
		// そのタイルが空白なのかどうかを返却する
		// より小縮尺の空白タイル存在情報があるとtrueを返す
		tileKey = this.#getTileNumber(tileKey);
		if(tileKey[2]<this.minZ){return false}
		var tx=tileKey[0];
		var ty=tileKey[1];
		for ( var tz = tileKey[2] ; tz >=this.minZ ; tz--){
			if ( this.voidTiles.has(this.#getTileKey([tx,ty,tz]))){
//				console.log("void :",tileKey);
				return true;
			}
			tx = Math.floor(tx/2);
			ty = Math.floor(ty/2);
		}
//		console.log("NOT void : ",tileKey);
		return false;
	}
	getVoidData(asSet){
		if ( asSet ){
			return this.voidTiles;
		} else {
			return [...this.voidTiles];
		}
	}
}
export{TileExistence};