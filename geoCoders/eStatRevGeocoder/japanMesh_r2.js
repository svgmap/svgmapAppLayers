// https://www.stat.go.jp/data/mesh/m_itiran.html
// を読み取って、3次メッシュデータベースを構築する
//
// Programmed by Satoru Takagi
// 
//  Copyright (C) 2020-2021 by Satoru Takagi @ KDDI CORPORATION
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
// DevLog:
//  2021/9/9 ライブラリ化
//  2021/9/21 メモリ消費を少なく（特にCSV DL時）IndexedDBを使うので、indexDBpromiseを必須とする
//  ToDo IndexedDB改良（このデータをもとにした軽いリバースジオコーダ実装を可能にしたい）

var corsProxy= "ProxieForNonSvgMapEnv";
var statBaseURL="https://www.stat.go.jp/data/mesh/";

function stdJpMesh(mDB){ // rev2では、indexDBpromiseのgetDBで得たDB(=mDB)を使う
	
	var meshDB = mDB;
	
	var _okCallback, _ngCallback;
	var _progressCallback;
	
	
	function buildMeshData(progressCallback, forceReload, altStatBaseURL) {
		if ( progressCallback ){
			_progressCallback = progressCallback;
		}
		if ( altStatBaseURL ){
			statBaseURL = altStatBaseURL;
		}
		return new Promise(async function(okCallback, ngCallback) {
			var csvKeys = (await meshDB.get("csvDataIndex"));
			if ( csvKeys && !forceReload){
				console.log("already db exists.");
				loadedCsvKeys = csvKeys.data;
				okCallback(true);
			} else {
				_okCallback = okCallback;
				_ngCallback = ngCallback;
				// https://www.stat.go.jp/data/mesh/m_itiran.html
				// https://www.stat.go.jp/data/mesh/m_itiran.html
				// loadContent(getCsvList,"statProxy.php?file=m_itiran.html",true,true); // ?? うまく動かなくなった？ブロックされた？
				loadContent(getCsvList,statBaseURL+"m_itiran.html",true,true);
			}
		});
	}
	
	function buildMeshData_(){
		// https://www.stat.go.jp/data/mesh/m_itiran.html
		loadContent(getCsvList,"statProxy.php?file=m_itiran.html",true,true);
	}
	
	function getCsvList(doc){
		if ( _progressCallback ){
			_progressCallback({
				progress: 0,
				message:"CSV読み込み開始",
			});
		}
		var aTags= doc.getElementsByTagName("a");
		var csvList =[];
		for ( var i = 0 ; i < aTags.length ; i++ ){
			var href = aTags[i].getAttribute("href");
			var name = aTags[i].innerText;
			if ( name.indexOf("（")>=0){
				name = name.substring(0,name.indexOf("（"));
			}
			if ( href.endsWith(".csv")){
				csvList.push({name:name,href:href});
			}
		}
		console.log("csvList:",csvList);
		
		meshDB.clear();
		
		loadedCsvKeys ={};
		csvDataLength = csvList.length;
		for ( var i = 0 ; i < csvList.length ; i++ ){
			loadContent(
				function(key,name){
					var ans = function(csv){
						getCsv(csv,key,name);
					}
					return ( ans );
				}(csvList[i].href,csvList[i].name)
				,new URL(csvList[i].href,statBaseURL).href,false,true);
//(				,"statProxy.php?file="+csvList[i].href,false,true);
		}
		
	}

	var loadedCsvKeys={};
	
	async function getCsv(csv,key,name){ // csv:csvデータ, key:href, name:
//		csvData[key]={data:parseCsv(csv),name:name};
		await meshDB.put({idCol:key,data:parseCsv(csv),name:name});
		loadedCsvKeys[key]=true;
		console.log("added:",key);
		var loadItems = Object.keys(loadedCsvKeys).length;
		if ( loadItems == csvDataLength){
			completeCsvLoad();
		} else {
			if ( _progressCallback ){
				_progressCallback({
					progress: 0.5 * loadItems / csvDataLength,
					message:"CSV読み込み中:"+ loadItems + " / " + csvDataLength,
				});
			}
		}
	}

	var csvDataLength;
//	var csvData={};
	async function completeCsvLoad(){
		if ( _progressCallback ){
			_progressCallback({
				progress: 0.5,
				message:"CSVデータの読み込みが完了しました",
			});
		}
		await meshDB.put({idCol:"csvDataIndex",data:loadedCsvKeys});
		await buildTiledMeshDB();
		if ( _progressCallback ){
			_progressCallback({
				progress: 1,
				message:"データの読み込みが完了しました",
			});
		}
		_okCallback();
	}
	
	var mesh1keys;
	async function buildTiledMeshDB(){
		mesh1keys ={
			idCol:"mesh1Codes",
		}
		var loadedCsvKeysLen = Object.keys(loadedCsvKeys).length;
		var loadedCsvCount=0;
		for ( key in loadedCsvKeys ){
			
			var m1TileData={}; // DBから取り出したmeshLevel1でタイリングしたデータ
			
			var pref = (await meshDB.get(key));
			for ( var i = 1 ; i < pref.data.length ; i++ ){
				var line = pref.data[i];
				var lgCode = line[0]; // 都道府県市区町村コード
				var prefName = prefNames[lgCode.substring(0,2)];
				var lgName = line[1]; // 市町村名
				var mesh3Code = line[2];
				var mesh1Code = mesh3Code.substring(0,4);
				var mesh2Code = mesh3Code.substring(0,6);
				
				if ( !m1TileData[mesh1Code] ){
					var m1db =await meshDB.get("m1:"+mesh1Code);
					if ( !m1db ){
						m1db = {
							idCol:"m1:"+mesh1Code
						};
					}
					m1TileData[mesh1Code] = m1db;
				}
				
				var m3data = m1TileData[mesh1Code][mesh3Code];
				if ( ! m3data ){
					m3data = {};
					m1TileData[mesh1Code][mesh3Code] = m3data;
				}
				
				m3data[lgCode]={
					pref:prefName,
					lg:lgName
				};
				
				var m2data = m1TileData[mesh1Code][mesh2Code];
				if ( ! m2data ){
					m2data = {};
					m1TileData[mesh1Code][mesh2Code] = m2data;
				}
				
				m2data[lgCode]={
					pref:prefName,
					lg:lgName
				};
				if ( !mesh1keys[mesh1Code]){
					mesh1keys[mesh1Code]=true;
				}
				
			}
			await meshDB.put(mesh1keys);
			for ( var m1c in m1TileData ){
				await meshDB.put(m1TileData[m1c]);
			}
			++ loadedCsvCount;
			if ( _progressCallback ){
				_progressCallback({
					progress: 0.5 + loadedCsvCount/loadedCsvKeysLen,
					message:"DB格納中 " + loadedCsvCount + "/" + loadedCsvKeysLen,
				});
			}
		}
	}
	
	// isLandMesh用　キャッシュ
	// 最近検索したm1番号のデータを最大m1TileDataCacheSize個キャッシュする
	m1TileDataCacheSize=5;
	m1TileDataCacheHist=[];
	m1TileDataCache={};
	async function isLandMesh(mesh){ // 指定したメッシュ番号のメッシュが陸かどうか、どの県・自治体に属しているかを検索する。
		// メッシュ番号は、2次メッシュ、3次メッシュのいずれか
		var mesh1Code = mesh.substring(0,4);
		
		if (!mesh1keys){
			mesh1keys=await meshDB.get("mesh1Codes");
		}
		if (!mesh1keys[mesh1Code] ){
			return(undefined);
		}
		var m1TileData = m1TileDataCache[mesh1Code];
		if (!m1TileData){
			m1TileData = await meshDB.get("m1:"+mesh1Code);
			m1TileDataCache[mesh1Code]=m1TileData;
			console.log("load from DB:",mesh1Code, " for ", mesh, " caches:",m1TileDataCache,m1TileDataCacheHist);
		}
		
		// キャッシュ処理
		var m1h =  m1TileDataCacheHist.indexOf(mesh1Code);
		if ( m1h >=0 ){
			m1TileDataCacheHist.splice(m1h,1);
		}
		m1TileDataCacheHist.push(mesh1Code);
		if ( m1TileDataCacheHist.length > m1TileDataCacheSize ){
			var rmCacheKey = m1TileDataCacheHist.shift();
			delete m1TileDataCache[rmCacheKey];
		}
		
		var ans = m1TileData[mesh];
		return(ans);
	}
	
	async function getMeshArray(meshLevel){
		var ans = {}; // オブジェクトよりSetの方が良いのかね？　https://qiita.com/kei-nakoshi/items/7d02eae7a0609faab85e
		if (!mesh1keys){
			mesh1keys=await meshDB.get("mesh1Codes");
		}
		if ( meshLevel == 1 ){
			return ((mesh1keys));
		}
		for ( var m1 in mesh1keys){
			var m1TileData = await meshDB.get("m1:"+m1);
			for ( mcode in m1TileData){
				if ( meshLevel == 2 && mcode.length==6){
					ans[mcode]=true;
				} else {
					ans[mcode]=true;
				}
			}
		}
		return ( (ans) );
	}
	
	function toArray(aarray){
		var ans = [];
		for ( var mcode in aarray){
			ans.push(mcode);
		}
		return (ans);
	}
	
	async function doCalc(govLevel, meshLevel){ // 集計関数
		// govLevel:  0:全国, 1:県, 2:市区町村
		// meshLevel: 0:メッシュ無し, 1:1次メッシュ, 2:2次メッシュ, 3:3次メッシュ
		
		loadedCsvKeys = (await meshDB.get("csvDataIndex")).data;
		console.log("loadedCsvKeys:",loadedCsvKeys);
		var meshList = buildMeshList(govLevel,meshLevel); // 県単位、2次メッシュ
		if (Object.keys(loadedCsvKeys).length <1){
			console.error("まずawait buildMeshData()してください");
			return(null);
		}
		return ( meshList );
	}
	
	var prefNames={
		"01":"北海道","25":"滋賀県","02":"青森県","26":"京都府","03":"岩手県","27":"大阪府","04":"宮城県","28":"兵庫県",
		"05":"秋田県","29":"奈良県","06":"山形県","30":"和歌山県","07":"福島県","31":"鳥取県","08":"茨城県","32":"島根県",
		"09":"栃木県","33":"岡山県","10":"群馬県","34":"広島県","11":"埼玉県","35":"山口県","12":"千葉県","36":"徳島県",
		"13":"東京都","37":"香川県","14":"神奈川県","38":"愛媛県","15":"新潟県","39":"高知県","16":"富山県","40":"福岡県",
		"17":"石川県","41":"佐賀県","18":"福井県","42":"長崎県","19":"山梨県","43":"熊本県","20":"長野県","44":"大分県",
		"21":"岐阜県","45":"宮崎県","22":"静岡県","46":"鹿児島県","23":"愛知県","47":"沖縄県","24":"三重県"
	};

	async function buildMeshList(govLevel,meshLevel){
		// govLevel:  0:全国, 1:都道府県, 2:市区町村
		// meshLevel: 0:なし, 1:1次メッシュ, 2:2次メッシュ, 3:3次メッシュ
		console.log("buildMeshList:");
		if ( govLevel == undefined ){
			govLevel = 0; // 全国
		}
		if ( meshLevel == undefined || meshLevel<0 || meshLevel>3){
			meshLevel = 1; // 1次メッシュ
		}
		var mesh2Hash ={};
		for ( key in loadedCsvKeys ){
			var pref = (await meshDB.get(key));
			var prefName = (pref.name.split(" "))[1];
			//console.log("pref:",pref,"  pref.data.length:",pref.data.length,prefName);
			for ( var i = 1 ; i < pref.data.length ; i++ ){ // 1行目はスキーマなので・・
				var line = pref.data[i];
				var lgCode = line[0]; // 都道府県市区町村コード
				var prefName = prefNames[lgCode.substring(0,2)];
				var lgName = line[1]; // 市町村名
				var meshCode = line[2];
				if ( meshLevel == 0 ){
					meshCode = "0";
				} else if ( meshLevel == 1 ){
					meshCode = meshCode.substring(0,4);
				} else if ( meshLevel == 2 ){
					meshCode = meshCode.substring(0,6);
				}
				
				var areaName = "日本"
				if ( govLevel == 0 ){ // 全国一律
					areaCode = 0;
				} else if ( govLevel == 1 ){ // 県ごとなので、県コード
					areaCode = lgCode.substring(0,2);
					areaName += ","+prefName;
				} else if ( govLevel == 2 ){ // 市町村
					areaCode = lgCode;
					areaName += ","+prefName+","+lgName;
				}
				if ( !mesh2Hash[areaCode] ){
					mesh2Hash[areaCode]={};
					mesh2Hash[areaCode].name = areaName;
					mesh2Hash[areaCode].mesh = [];
				}
				(mesh2Hash[areaCode]).mesh[meshCode]=true;
			}
		}
		//console.log("mesh2Hash:",mesh2Hash);
		var meshList = {};
		for ( area in mesh2Hash ){
			meshList[area]={};
			meshList[area].name = mesh2Hash[area].name;
			meshList[area].mesh = [];
			for ( meshCode in mesh2Hash[area].mesh ){
				meshList[area].mesh.push(meshCode);
			}
			meshList[area].mesh.sort();
		}
		//console.log("meshList:",meshList);
		return ( meshList ); 
	}


	function printMeshList(meshList){
		var table = document.createElement("table");
		table.border="1";
		table.style.fontSize="11px";
		var tr = document.createElement("tr");
		var th1=document.createElement("th");
		th1.innerText="自治体コード:名称";
		th1.style.width="150px";
		var th2=document.createElement("th");
		th2.innerText="メッシュコードリスト";
		tr.appendChild(th1);
		tr.appendChild(th2);
		table.appendChild(tr);
		
		var keys = Object.keys(meshList).sort();
		for ( var j = 0 ; j < keys.length ; j++ ){
			var area = keys[j];
			var name = meshList[area].name;
			
			tr = document.createElement("tr");
			var td1 = document.createElement("td");
			td1.innerText=area+":"+name;
			var td2 = document.createElement("td");
			var codes;
			for ( var i = 0 ; i < meshList[area].mesh.length ; i++ ){
				if ( i== 0 ){
					codes = meshList[area].mesh[i];
				} else {
					codes += ", "+meshList[area].mesh[i];
				}
			}
			td2.innerText=codes;
			tr.appendChild(td1);
			tr.appendChild(td2);
			table.appendChild(tr);
		}
		return(table);
	}




	function parseCsv(csv){
		csv = csv.split("\n");
		var ans =[];
		for ( var i = 0 ; i < csv.length ; i++ ){
			if ( csv[i]==""){
				continue;
			}
			var line = csv[i].split(",");
			var col = [];
			for ( var j = 0 ; j < line.length ; j++){
				col.push(line[j].trim());
			}
			ans.push(col);
		}
		return ( ans );
	}

	function loadContent(cbFunc, url, isDoc, forceSjis){
		if ( typeof(svgMap)=="object"){
			url = svgMap.getCORSURL(url);
		} else {
			url = corsProxy + url;
		}
	//	console.log("loadJSON : SRC: ", url);
		var httpObj = new XMLHttpRequest();
		httpObj.onreadystatechange = function(){
			loadDoc_ph2( this , cbFunc );
		} ;
		if ( isDoc ){
			httpObj.responseType = "document";
			if ( forceSjis ){
				httpObj.overrideMimeType("text/html; charset=Shift_JIS");
			}
		} else {
			if ( forceSjis ){
				httpObj.overrideMimeType("text/plain; charset=Shift_JIS");
			}
		}
		httpObj.open("GET", url , true );
		httpObj.send(null);
	}

	function loadDoc_ph2( httpRes , cbFunc ){
		if ( httpRes.readyState == 4 ){
			if ( httpRes.status == 403 || httpRes.status == 404 || httpRes.status == 500 || httpRes.status == 503 ){
				console.log( "loadDoc : File get failed : stat : ", httpRes.status);
				return;
			}
	//		console.log(httpRes.response);
			cbFunc(httpRes.response);
		}
	}

	return {
		buildMeshData:buildMeshData,
		doCalc:doCalc,
		getMeshArray:getMeshArray,
		getTable:printMeshList,
		isLandMesh:isLandMesh,
		buildTiledMeshDB:buildTiledMeshDB,
		//getRawData:getRawData,
		//setRawData:setRawData,
	}
}