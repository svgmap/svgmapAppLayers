// IndexedDBのPromise版オブジェクト生成関数
// 2021.10.11 close, mput, mget

function getDB(dbName_tableName){ // IndexedDBのPromise版オブジェクト生成関数 一個のテーブルが一個のIndexedDBに作られるパターンのみ(今のところ)
	var DBNAME=dbName_tableName.dbName;
	var VERSION=1;
	var DOCNAME=dbName_tableName.tableName;
	var IDNAME="idCol";
	var db = null;
	async function connectDB(){
		db = await connect(DBNAME, VERSION);
	}
	function closeDB(){
		db.close();
	}
	// IndexedDBのPromise化
	// https://qiita.com/41semicolon/items/c0bbace5eafc422f988a
	function connect(dbname, version) {
		const dbp = new Promise((resolve, reject) => {
			const req = indexedDB.open(dbname, version);
			req.onsuccess = ev => resolve(ev.target.result);
			req.onerror = ev => reject('fails to open db');
			req.onupgradeneeded = ev => schemeDef(ev.target.result);
		});
		dbp.then(d => d.onerror = ev => alert("error: " + ev.target.errorCode));
		/** こういうことはできないんだね・・・ createできるのはあくまでonupgradeneeded時だけなので、バージョン上げて追加するとかだけだけど、もう面倒なので1DB1Tableに
		dbp.then(function(db){
			console.log("objectStoreNames:",db.objectStoreNames,"  db:",db);
			if (!(db.objectStoreNames).contains(DOCNAME)){
				schemeDef(db);
			}
		});
		**/
		return dbp;
	}
	async function put(obj) { // returns obj in IDB
		return new Promise((resolve, reject) => {
			const docs = db.transaction([DOCNAME], 'readwrite').objectStore(DOCNAME);
			const req = docs.put(obj);
			req.onsuccess = () => resolve({ [IDNAME]: req.result, ...obj });
			req.onerror = reject;
		});
	}
	async function get(id) { // NOTE: if not found, resolves with undefined.
		return new Promise((resolve, reject) => {
			const docs = db.transaction([DOCNAME, ]).objectStore(DOCNAME);
			const req = docs.get(id);
			req.onsuccess = () => resolve(req.result);
			req.onerror = reject;
		});
	}
	async function mput(objArray) { // 2021/10/11 1トランザクションで複数のput。未検証です
		return new Promise((resolve, reject) => {
			const docs = db.transaction([DOCNAME], 'readwrite').objectStore(DOCNAME);
			var reqs = [];
			var i = 0 ;
			for ( var obj of objArray){
				const req = docs.put(obj);
				req.onerror = reject;
				req.onsuccess = function(){ 
					reqs.push ( i );
					if ( reqs.length == objArray.length){
						resolve({ [IDNAME]: req.result, ...objArray });
					}
				}
				++i;
			}
			//req.onsuccess = () => resolve({ [IDNAME]: req.result, ...objArray });
		});
	}
	async function mget(idArray) { // 2021/10/11 1トランザクションで複数のget。未検証です
		return new Promise((resolve, reject) => {
			const docs = db.transaction([DOCNAME, ]).objectStore(DOCNAME);
			var resArray=[];
			var totalSuccess = 0;
			var i = 0;
			for ( var id of idArray ){
				const req = docs.get(id);
				req.onerror = reject;
				req.onsuccess = function(rindex){
					return function(){
						resArray[rindex]=req.result;
						++ totalSuccess;
						if ( totalSuccess == idArray.length ){
							resolve(resArray);
						}
					}
				}(i);
				++i;
			}
		});
	}

	async function getAll(){
		return new Promise((resolve, reject) => {
			const docs = db.transaction([DOCNAME, ]).objectStore(DOCNAME);
			const req = docs.getAll();
			req.onsuccess = () => resolve(req.result);
			req.onerror = reject;
		});
	}
	
	async function getAllKeys(){ // 2021.9.21
		return new Promise((resolve, reject) => {
			const docs = db.transaction([DOCNAME, ]).objectStore(DOCNAME);
			const req = docs.getAllKeys();
			req.onsuccess = () => resolve(req.result);
			req.onerror = reject;
		});
	}
	
	async function deleteRecord(id){
		return new Promise((resolve, reject) => {
			const docs = db.transaction([DOCNAME], 'readwrite').objectStore(DOCNAME);
			const req = docs.delete(id);
			req.onsuccess = () => resolve(req.result);
			req.onerror = reject;
		});
	}
	
	async function clear(){
		return new Promise((resolve, reject) => {
			const docs = db.transaction([DOCNAME], 'readwrite').objectStore(DOCNAME);
			const req = docs.clear();
			req.onsuccess = () => resolve(req.result);
			req.onerror = reject;
		});
	}
	
	function schemeDef(db) {
	  db.createObjectStore(DOCNAME, { keyPath: IDNAME, autoIncrement: true });
	}
	return {
		get: get,
		put: put,
		getAll: getAll,
		getAllKeys: getAllKeys,
		close: closeDB,
		connect: connectDB,
		clear: clear,
		delete: deleteRecord,
		mget: mget,
		mput: mput,
	}
};
