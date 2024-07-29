// 自治体コード -> 自治体名＆3次メッシュ群データ生成関数(クロージャオブジェクト)
// ジオコーダ、緯度経度検索機能を持つ
//  Programmed by Satoru Takagi
//  
//  Copyright (C) 2024 by Satoru Takagi @ KDDI CORPORATION
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

async function lgMesh(japanMeshDbName, forceReload){
	const meshLevel = 3;
	var forceReloadInt=false;
	if ( forceReload ){
		forceReloadInt=true;
	}
	
	var meshList = await getLgMeshList();
	
	var lgCoderData = generateLGcoderData(meshList);
	
	async function getLgMeshList(){
		var meshDB=getDB(japanMeshDbName);
		await meshDB.connect();
		var mr = stdJpMesh(meshDB);
		console.log("onload japanMesh_r3 :mr:",mr);
		var meshList = await getDataFromStatGo(mr);
		// await buildMeshHash();
		return ( meshList );
	}
	
	function getMeshList(){
		return ( meshList );
	}
	
	async function getDataFromStatGo(mr){
		msgDiv.innerText="stat.go.jpからメッシュデータCSV読み込み中:";
		
		await mr.buildMeshData(progressCallBackFn, forceReloadInt);
		var meshList = await generateMeshList(mr);
		msgDiv.innerText="";
		return ( meshList );
	}

	function progressCallBackFn(ans){
		console.log(ans);
		msgDiv.innerText=ans.message;
	}

	async function generateMeshList(mr){
		console.log("Do CALC");
		var govLevel = 2;
//		var meshLevel = 3;
		// govLevel:  0:全国, 1:都道府県, 2:市区町村
		// meshLevel: 0:なし, 1:1次メッシュ, 2:2次メッシュ, 3:3次メッシュ
		var meshList=await mr.doCalc(govLevel, meshLevel);
		//var table=mr.getTable(meshList);
		return ( meshList );
	}

	function generateLGcoderData(meshList){
		// 自治体フル表記->自治体コードテーブル生成
		var ans = {};
		for ( var lgCode in meshList){
			var lgName = meshList[lgCode].name;
			ans[lgName]=lgCode;
		}
		return ( ans );
	}
	
	function getMeshLevel(){
		return (meshLevel);
	}
	
	// 平成27年10月1日以降の改正自治体名もしくは間違いやすい名称
	// https://www.soumu.go.jp/main_content/000562726.pdf
	var changeNameList={
		"宝塚市":"宝塚市",
		"那珂川市":"那珂川町",
		"富谷市":"富谷町",
	}
	
	
	function geoCode(lgName){
		// かなり何でも一致させる部分一致でジオコード⇒結構ちゃんと絞り込んだジオコードに変更
		// 入力：lgName: 自治体名 or 自治体コード(自治体コードの場合もテストする)
		// 返答：.code:自治体コード, .name:フルネーム
		//   
		if ( lgName.match(/^\d{5}$/)){ // 自治体コード
			var ans = meshList[lgName];
			if ( ans ){
				return [{code:lgName,name:ans.name}];
			} else {
				return [];
			}
		} else if ( lgName.match(/^\d{2}$/)){ // 自治体コード～県コード
			var ans =[];
			for ( var lgCode in meshList){
				if ( lgCode.substring(0,2)==lgName ){
					ans.push({code:lgCode,name:meshList[lgCode].neme});
				}
			}
			if ( ans.length>0){
				return ( ans );
			}
		} else { // 自治体名
			lgName = lgName.replaceAll(/(\s|,|-|:|)/g,""); // スペース他余計な文字を削除
			var res = lgName.replaceAll(/(都|道|府|県|市|町|村|区|郡|振興局|支庁)/g,"$1.*"); // 検索用正規表現文字列生成(区切り文字)
			if ( res.endsWith(".*")){
				res = res.substring(0,res.length-2);
			}
			/** これだと緩すぎかな・・・
			var res = "";
			for ( var i = 0 ; i < lgName.length-1 ; i++ ){
				res += lgName[i]+".*";
			}
			res += lgName[lgName.length-1];
			**/
			//console.log("res:",res);
			var gcRe = new RegExp(res);
			//console.log(gcRe);
			ans = [];
			for ( var lgNameD in lgCoderData){
				if ( lgNameD.match(gcRe)){
					ans.push({code:lgCoderData[lgNameD],name:lgNameD});
				}
			}
			if ( ans.length ==0 ){
				for ( var akey in changeNameList){ // 自治体の統廃合などで変更があるもの
					if ( res.indexOf(akey)>0){
						gcRe = new RegExp(res.replace(akey,changeNameList[akey]));
						for ( var lgNameD in lgCoderData){
							if ( lgNameD.match(gcRe)){
								ans.push({code:lgCoderData[lgNameD],name:lgNameD});
							}
						}
						break;
					}
				}
			} 
			// ここまででかなり緩い一致（部分一致）ができた
			
			if ( ans.length > 1 ){ // 結果が1個以上の時はさらに絞り込み
				// 元データ区切り文字で区切った個々の要素が厳密に一致しているものを選び出している
				// これでほぼ確実な結果となるのでは？
				var nans = [];
				for ( var oneAns of ans ){
					var names = oneAns.name.split(",");
					var lgNames = names[2].replaceAll(/(市|町|村|区|郡|振興局|支庁)/g,"$1,").split(",");
					//console.log(names);
					var reStr = `(${names[0]}|)(${names[1]}|)`;
					for ( var i = 0 ; i < lgNames.length - 1 ; i++ ){
						reStr+=`(${lgNames[i]}|)`;
					}
					var lgRe = new RegExp(reStr);
					//console.log(lgRe,  lgName.match(lgRe));
					if ( lgName.match(lgRe)[0]==lgName ){
						nans.push(oneAns);
					}
				}
				//console.log(nans);
				ans = nans;
			}
			/**
			// 配列番号の若い（短い一致の）ほうが、より正しそうな答　⇒　上の絞り込みで全部確からしい値なのでやめた
			ans.sort(function(a,b){
				return(a.name.length - b.name.length);
			});
			**/
			return ( ans );
		}
	}
	
	function searchPos(geoXY){
		var meshCode = latLng2Mesh(geoXY.y, geoXY.x, meshLevel);
		var ans ={};
		for ( var lgCode in meshList){
			var lgData = meshList[lgCode];
			for ( mcode of lgData.mesh ){
				if ( meshCode == mcode){
					ans[lgCode]={
						name:lgData.name,
					}
					break;
				}
			}
		}
		return ( ans );
	}
	
	return {
		getMeshList:getMeshList,
		geoCode:geoCode,
		getMeshLevel:getMeshLevel,
		searchPos:searchPos,
		getLgCoderData: function() {return lgCoderData},
	}
}
