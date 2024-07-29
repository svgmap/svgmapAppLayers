class LocalDBFileManager{
	#indexDB;
	#dbName;
	
	indexData_int={};
	
	constructor(dirName){
		if ( !dirName || !window.getDB){return null}
		this.#dbName=dirName;
		return ( this.#dbName );
	}
	
	get indexData(){
		var ans = {};
		for ( var fn in this.indexData_int){
			var rec = this.indexData_int[fn];
			ans[fn]=[rec.fileName,rec.buildTime,rec.title];
		}
		console.log("indexData:",ans," this.indexData_int:",this.indexData_int); 
		return ( ans );
	}
	
	init = async function(){
		this.#indexDB = window.getDB({dbName:this.#dbName,tableName:"files"});
		await this.#indexDB.connect();
		
		await this.getIndex();
		console.log("LocalDBFileManager init : indexData:", this.indexData_int);
	}.bind(this);
	
	syncIndex = async function(){
		var keys = await this.#indexDB.getAllKeys();
		var idx = await this.getIndex(true);
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
				var orgData = await this.getContent(key);
				var orgMeta = orgData.data.metadata;
				trueIdx[key]=orgMeta;
			}
		}
		var ret1 = await this.#indexDB.put({idCol:"indexData",data:trueIdx});
		this.indexData_int = trueIdx;
	}.bind(this);
	
	getContent = async function(fname){
		var ret = await this.#indexDB.get(fname);
		if ( !ret){
			return null ;
		}
		return ret.data.content;
	}.bind(this);
	
	getIndex = async function(byObj){
		//console.log("getIndex:  this.#indexDB:", this.#indexDB);
		var ret = await this.#indexDB.get("indexData");
		//console.log("getIndex:ret:",ret);
		if ( !ret){ret={}}
		this.indexData_int = ret.data;
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
	}.bind(this);
	
	removeSvgContent = async function(fileName){
		if ( fileName=="indexData"){return}
		var ret = await this.#indexDB.delete(fileName);
		await this.syncIndex();
		return ret;
	}.bind(this);
	
	getDateTime(dt){
		console.log("getDateTime:",dt);
		dt = dt.substring(0,4)+"/"+dt.substring(4,6)+"/"+dt.substring(6,8)+" "+dt.substring(8,10)+":"+dt.substring(10,12);
		return dt;
	}
	
	registSvgContent = async function(svgContentText,contentTitle){
		if ( !svgContentText || !contentTitle ){
			console.warn("no svgContentText or contentTitle");
			return;
		}
		var ans = await this.registContent({
			svgmapdata:svgContentText,
			title:contentTitle
		});
		return ( ans );
	}.bind(this);
	
	registContent = async function(contentObject){
		//console.log("registContent:",contentObject);
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
		
		var idx = await this.getIndex(true);
		if ( !idx ){
			idx ={};
		}
		//onsole.log(idx);
		idx[fname]={fileName:fname,buildTime:dts,title:contentTitle}
		
		var ret0 = await this.#indexDB.put({idCol:fname,data:{content:contentObject.svgmapdata, metadata:idx[fname]}});
		//console.log(ret0);
		var ret1 = await this.#indexDB.put({idCol:"indexData",data:idx});
		this.indexData_int = idx;
		//console.log(ret1);
	}.bind(this);
	
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

export {LocalDBFileManager}
