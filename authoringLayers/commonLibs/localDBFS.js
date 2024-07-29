// localDBFS: ローカルのindexedDBを POSTとindex取得、removeができるだけのphpによる簡易ファイルシステム代わりに使う
//

async function localDBFS(dirName){
	if ( !dirName || !getDB){return null}
	
	var indexDB = getDB({dbName:dirName,tableName:"files"});
	await indexDB.connect();
	
	async function getIndex(byObj){
		var ret = await indexDB.get("indexData");
		if (!ret){return null}
		if ( byObj ){ return ret.data };
		var ans = "";
		var firstCol = true;
		for ( var rowKey in ret.data){
			var row = ret.data[rowKey];
			//console.log(row,row.title);
			if ( firstCol ){
				firstCol = false;
			} else {
				ans += "\n";
			}
			ans += rowKey + ","+row.buildTime+","+row.title;
		}
		return ans;
	}
	
	async function postContent(contentObject){
		//console.log("post",contentObject);
		if ( !contentObject.svgmapdata || !contentObject.title){
			console.warn("No nec. data", contentObject.svgmapdata,contentObject.title );
			return
		}
		
		var contentTitle =contentObject.title.replaceAll(",","，");
		contentTitle = contentTitle.replaceAll("\n","::");
		
		var fname;
		
		var ftype = "svg";
		if ( contentObject.type){
			ftype = contentObject.type;
		}
		
		var dt = new Date();
		var dts = dt.toLocaleDateString('sv-SE').replaceAll("-","");
		dts += dt.toLocaleTimeString('sv-SE').replaceAll(":","");
		
		//console.log(dts,ftype);
		
		if ( contentObject.filename && contentObject.filename!="indexData"){
			fname = contentObject.filename;
		} else {
			fname = dts + "_"+ Math.floor(Math.random()*100000)+"." + ftype;
		}
		
		var idx = await getIndex(true);
		if ( !idx ){
			idx ={};
		}
		//console.log(idx);
		idx[fname]={fileName:fname,buildTime:dts,title:contentTitle}
		
		var ret0 = await indexDB.put({idCol:fname,data:{content:contentObject.svgmapdata, metadata:idx[fname]}});
		//console.log(ret0);
		var ret1 = await indexDB.put({idCol:"indexData",data:idx});
		//console.log(ret1);
	}
	
	async function getContent(fname){
		var ret = await indexDB.get(fname);
		if ( !ret){
			return null ;
		}
		return ret.data.content;
	}
	
	async function removeContent(fname){
		if ( fname=="indexData"){return}
		var ret = await indexDB.delete(fname);
		await sync();
		return ret;
	}
	
	async function sync(){
		var keys = await indexDB.getAllKeys();
		var idx = await getIndex(true);
		//console.log(keys);
		//console.log(idx);
		var trueIdx = {};
		for ( var key of keys){
			if ( key=="indexData"){continue}
			if ( idx[key] ){
				trueIdx[key]=idx[key];
			} else {
				console.warn(key + " データのインデックスデータがありません。 オリジナルのメタデータからインデックスを回復します。");
				// 不正データなのですがどうしよう・・コンテンツに入っているメタデータを使って復帰させることにする
				//await indexDB.delete(key);
				var orgData = await getContent(key);
				var orgMeta = orgData.data.metadata;
				trueIdx[key]=orgMeta;
			}
		}
		var ret1 = await indexDB.put({idCol:"indexData",data:trueIdx});
	}
	
	return{
		getIndex:getIndex,
		post:postContent,
		get:getContent,
		remove:removeContent,
		sync: sync,
	}
}