	// Dynamic Csv POI Layer for SVGMap Sample for SVGMapLevel0.1 > r8
	// Programmed by Satoru Takagi
	// 
	// License: (MPL v2)
	// This Source Code Form is subject to the terms of the Mozilla Public
	// License, v. 2.0. If a copy of the MPL was not distributed with this
	// file, You can obtain one at https://mozilla.org/MPL/2.0/.
	//
	// XHRで外部のcsvデータを読み取りPOIとして表示するwebApps　csvはタイリングを想定していない単純なもの。
	// SVGMapLv0.1_r8で使える。
	// ○CSVの形式：
	//   最初の行に属性名を記入 次の行からデータを入れる
	//   緯度と経度(WGS84)の桁が必須
	//   タイトルの桁が必須
	//   その他の桁は任意(用意できていない場合は適当な桁を指定しておくと良いでしょう・・・)
	// ○このファイル(svg)のコンテナでのリンクの張り方:
	//   csvXhr.svg#csvPath=refuge.csv&latCol=9&lngCol=10&titleCol=6
	//     ハッシュの後に、サーチパートと同じような書き方をします。
	//     csvPathとして読み込むcsvのパスを記述
	//     latColに緯度の桁(base 0)
	//     lngColに経度の桁
	//     titleColにタイトルの桁
	//     iconにアイコンの番号(0..5) - optional
	//     variableIcon  指定カラムに応じてアイコンが振られる：カラム番号[,Th(LL.L),Th(L.M),Th(M.H),Th(H.HH)]  (LL:p0, L:p1, M:p2, H:p3, HH:p4のアイコンが振られる) - optional
	//
	// 2013/04/20 : 1st ver. ( Dynamic SVGMap LayerのテンプレートApps)
	// 2014/06/26 : 1st ver. XHRによってCSVを読み込むレイヤーを開発
	// fork from rev3 : asynchronous >rev10 framework
	// 2017/02/17 Edge不具合対策 svgネームスペース文書操作全排除
	// 2019/06/10 : from rev3 アイコンをプロパティ値によって変化
	// 2019/09/11 : from 2a iconColの値が列挙型文字列の場合でも、値に応じて適当にアイコンを割り付ける
	// 2019/10/28 : いろいろバグフィックス　CSV手入力UIを高機能化(アイコンの色指定、指定カラムの値で可変)
	// 2022/01/20 : svgのscriptをhtmlに移設
	// 2022/04/xx : CSVの手入力・ジオコーダ部を　別ウィンドに切り離し・UI改善＆モジュール化
	// 2022/12/01 : iconCol系いろいろデバッグ  FileAPIでローカルファイル読み込み->csvInputUI_r17.html
	// 2022/12/13 : データのサイズに応じて、オンメモリQuadTreeComposite Tilingを実装
	// 2024/08/01 : 複数のcsvのサブレイヤーでの同時表示をサポートできるよう、インスタンスを複数立ち上げ、ターゲットのドキュメントも個別に指定できる機能を追加する
	// 2025/06/13 : editCsv
	
	// Issues:
	//    iconCol系の実装(9/11の)が、未検証多々あります！
	//    windowObjがQTCTrendererを持つことを想定しているなどいろいろ整理ができてない
/**
windowObjから直接取得している(整理できていない)リソースは以下の通り
	useQTCT
	parent.location.href
	svgImage
	messageDiv
	removePrevTiles()
	clearQTCTdata()
	buildQTCTdata()
	removePrevTiles()
	clearQTCTdata()
	clientSideQTCT
**/
	// ToDo:
	//    from 2a: ｘｘKm圏の円(楕円)を表示する機能(circleRadius),(radiusCol)
	//
	
csvMapperClass = function (windowObj){
	var svgImage;
	var csv; // このデータがこのクラスのインスタンスにおける基幹のCSV生データ
	var currentSchema; // 現在のこのオブジェクトが処理しているデータのスキーマ
	var messageDivElm;
	
	var hashParamCsvSchema={
		latCol:null ,
		lngCol:null ,
		titleCol:0,
		titleCol2:-1,
		varIconCol:-1,
		varIconTh:[]
	}
	
	var csvPath, docPath;
	var csvIndex;
	var defaultIconNumber = 0;
	var tokyoDatum = false;
	
	var iconColMatch = null;
	
	var CR = String.fromCharCode(13);
	var LF = String.fromCharCode(10);

	var category =[];
	var QTCTth = 1000; // ClientSideQuadTreeCompositeTilingに移行するスレッショルドポイント数
	var customIconId = "customIcon";

	
	function getHashParams( hash ){
		hash = hash.substring(1);
		hash = hash.split("&");
		for ( var i = 0 ; i < hash.length ; i++ ){
			if ( hash[i].indexOf("=") >0 ){
				var hName = hash[i].substring(0,hash[i].indexOf("="));
				var hVal = hash[i].substring(hash[i].indexOf("=")+1);
				hash[i] = [hName,hVal];
				hash[hName] =hVal;
			} else {
				hash[hash[i]] = true;
			}
		}
//		console.warn(hash);
		return ( hash );
	}
	
	
	function getCsv(progressCallBack){
		console.log("getCsv:csv:",csv);
		if ( !csv && windowObj.useQTCT ){
			if ( globalObj.restoreCsvDataFromZipFile ){ // QTCTrenderer_r2の関数(モジュール化すべき)
				return restoreCsvArrayFromZipFile(progressCallBack); //この場合はpromiseが返ってくる
			} else {
				var csvdat = globalObj.restoreCsvData(); // QTCTrendererの関数(モジュール化すべき)
				for ( var i = 0 ; i < csvdat.length; i++){
					csvdat[i]= csvdat[i].join(",");
				}
			}
			return ( csvdat );
		} else {
			return ( csv );
		}
	}
	
	async function restoreCsvArrayFromZipFile(progressCallBack){
		// ２次元配列をレコードごとに配列になったcsvの1次元配列に変換
		var csvdat = await globalObj.restoreCsvDataFromZipFile(progressCallBack);
		for ( var i = 0 ; i < csvdat.length ; i++){
			csvdat[i]= csvdat[i].join(",");
		}
		return csvdat;
	}
	
	function getSchema(){
		return ( currentSchema );
	}
	
	function getHtmlDirHref(){
		var ans = new URL(controllerSrc,windowObj.parent.location.href).href;
		//var ans = docPath;
		if ( ans.lastIndexOf("#") >0){
			ans = ans.substring(0,ans.lastIndexOf("#"));
		}
		if ( ans.lastIndexOf("?") >0){
			ans = ans.substring(0,ans.lastIndexOf("?"));
		}
		if ( ans.lastIndexOf("/") >0){
			ans = ans.substring(0,ans.lastIndexOf("/"));
		} else {
			ans ="";
		}
		return ( ans );
	}
	
	function setMessageDiv(mdiv){
		messageDivElm = mdiv;
	}
	
	function onload(options){
		console.log("ONLOAD APP");
		if ( options?.svgImage ){ // 別のsvgImageを設定することができる 2024/08/01
			svgImage = options.svgImage;
		} else {
			svgImage = windowObj.svgImage;
		}
		messageDivElm = windowObj.messageDiv;
		var docHref=new URL(controllerSrc,windowObj.parent.location.href).href;
		var hParams = getHashParams(svgImageProps.script.location.hash);
		docPath = svgImageProps.script.location.pathname;
		console.log("hParams:",hParams," docPath:",docPath," docHref:",docHref);
		if ( hParams.csvPath ){
			csvPath = new URL(hParams.csvPath,docHref).href;
			console.log("csvPath:",csvPath);
		}
		var csvCharset=null;
		if ( hParams.charset){
			csvCharset = hParams.charset;
		}
		if (hParams.csvIndex ){
			if ( hParams.csvIndex.startsWith("http")){
				csvIndex = hParams.csvIndex;
			} else {
				csvIndex = getHtmlDirHref() + "/"+ hParams.csvIndex;
			}
			console.log("csvIndex:",csvIndex);
		}
		hashParamCsvSchema.latCol = Number(hParams.latCol);
		hashParamCsvSchema.lngCol = Number(hParams.lngCol);
		
		if ( hParams.datum && hParams.datum == "tokyo" ){
			tokyoDatum = true;
		}
		
		if ( hParams.titleCol ){
			if ( hParams.titleCol.indexOf("/")>=0){
				var tc = hParams.titleCol.split("/");
				hashParamCsvSchema.titleCol = Number(tc[0]);
				hashParamCsvSchema.titleCol2 = Number(tc[1]);
			} else {
				hashParamCsvSchema.titleCol = Number(hParams.titleCol);
			}
		}
		
		if ( hParams.schema ){
			var schemaTxt=hParams.schema;
			console.log("schea:",schemaTxt);
			svgImage.getElementsByTagName("svg")[0].setAttribute("property",schemaTxt);
		}
		
		if ( hParams.variableIcon ){
			// variableIconクエリ: カンマ区切り、カラム番号,Th(LL.L),Th(L.M),Th(M.H),Th(H.HH)
			var viParam = hParams.variableIcon;
			viParam=viParam.split(",");
			hashParamCsvSchema.varIconCol = Number(viParam[0]);
			hashParamCsvSchema.varIconTh = new Array();
			if ( viParam.length > 1 ){
	//			viParam.length
				for ( var i = 0 ; i < viParam.length -1 ; i++){
					hashParamCsvSchema.varIconTh[i] = Number(viParam[i+1]);
				}
			}
//			console.log("param:",viParam,"  col:",hashParamCsvSchema.varIconCol,"  th:",hashParamCsvSchema.varIconTh);
		}
		
		if ( hParams.iconColMatch ){
			iconColMatch = new RegExp(hParams.iconColMatch);
		} 
		
		if ( hParams.icon ){
			defaultIconNumber = Number(hParams.icon);
		}
		
		
//		console.log("csvxhr: addEventListener zoomPanMap ");
		document.addEventListener("zoomPanMap",testZP);
		
		if ( csvPath ){
			removeAllPOIs();
			loadCSV(csvPath, csvCharset);
		}
		
		buildInitialCategory();
	}
	var iconsLength;
	
	function buildInitialCategory(){
		category =[];
		allocatedIconNumb = 0;
		iconColData2Category ={};
		var defs=svgImage.getElementsByTagName("defs")[0];
		var icons=getChildren(defs);
		console.log("icons:",icons);
		iconsLength = icons.length;
		for ( var i = 0 ; i < iconsLength ; i++ ){
			category.push(icons[i].getAttribute("id"));
		}
	}
	
	function getChildren(parent){
		var ans =[];
		var cn = parent.childNodes;
		for ( var i = 0 ; i < cn.length ; i++ ){
			if (cn[i].nodeType==1){
				ans.push(cn[i]);
			}
		}
		return ( ans );
	}
	
	function testZP(e){
//		console.log( "called testZP:",e);
	}
	
	function TestFunc(param){
		console.log("testFunc",param);
	}
	
	function checkVarIconTh(csv,firstRecord,cs){
		//console.log("called: checkVarIconTh: firstRecord:",firstRecord,"  category.length:",category.length,"  iconsLength:", iconsLength);
		var minVal = 1e99;
		var maxVal =-1e99;
		var minSet = false;
		var maxSet = false;
		
		for ( var i = firstRecord ; i < csv.length ; i++ ){
			var strTxt = csv[i].split(",");
			if ( strTxt.length > 2 && strTxt[cs.varIconCol]){
				var iconVal = strTxt[cs.varIconCol] ;
				//console.log(iconVal);
				if ( isNaN(iconVal)){
					continue;
				} else {
					iconVal = Number(iconVal);
					if ( minVal > iconVal ){
						minSet = true;
						minVal = iconVal;
					}
					if ( maxVal < iconVal ){
						maxSet = true;
						maxVal = iconVal;
					}
				}
			}
		}
		if ( maxSet && minSet ){
			for ( var i = 0 ; i < iconsLength-1 ; i++ ){
				cs.varIconTh.push(minVal + (i+1) * ( maxVal - minVal ) / iconsLength);
			}
		}
		//console.log("varIconTh:",cs.varIconTh," min,max:",minVal,maxVal);
	}
	
	function parseSchema(sline){
		var scols = sline.split(",");
		var latCol=-1, lngCol=-1, titleCol=-1, titleCol2=-1, varIconCol=-1, varIconTh=[];
		for ( var i = 0 ; i < scols.length ; i++ ){
			var col = scols[i].toLowerCase();
			if ( latCol==-1 &&(col.indexOf("lat")>=0 || col.indexOf("latitude")>=0 || col.indexOf("緯度")>=0 )){
				latCol = i;
			} else if ( lngCol==-1 && (col.indexOf("lng")>=0 || col.indexOf("lon")>=0 || col.indexOf("longitude")>=0 || col.indexOf("経度")>=0 )){
				lngCol = i;
			} else if ( titleCol==-1 && (col.indexOf("title")>=0 || col.indexOf("名称")>=0 || col.endsWith("name") || col.endsWith("名") || col.indexOf("タイトル")>=0) ){
				titleCol = i;
			} else if ( titleCol2==-1 && (col.indexOf("title")>=0 || col.indexOf("名称")>=0 || col.endsWith("name") || col.endsWith("名") || col.indexOf("タイトル")>=0) ){
				titleCol2 = i;
			} else if ( col.indexOf("icon")>=0 || col.indexOf("アイコン")>=0 ){
				//varIconCol = i;
			}
		}
		if ( titleCol==-1){
			titleCol=0;
		}
		var ans = {
			latCol:latCol,
			lngCol:lngCol,
			titleCol:titleCol,
			titleCol2:titleCol2,
			varIconCol:varIconCol,
			varIconTh:varIconTh,
			csvLength:scols.length,
			property:scols
		};
		//console.log("parseSchema:",ans);
		return ( ans );
	}
	
	function getSchemaTxt(schemaObj,csvLength){
		var ans =[];
		for ( var i = 0 ; i < csvLength ; i++){
			if ( i == schemaObj.latCol ){
				ans.push("latitude");
			} else if ( i == schemaObj.lngCol ){
				ans.push("longitude");
			} else if ( i == schemaObj.titleCol ){
				ans.push("title");
			} else if ( i == schemaObj.titleCol2 ){
				ans.push("subTitle");
			} else if ( i == schemaObj.varIconCol ){
				ans.push("category");
			} else {
				ans.push("prop"+i);
			}
		}
		var ret="";
		var fitstCol = true;
		for ( var i = 0 ; i < ans.length ; i++){
			if ( fitstCol){
				fitstCol = false;
				ret = ans[i];
			} else {
				ret += ","+ans[i]
			}
		}
		return ( ret );
	}
	
	var sleep = ms => new Promise(res => setTimeout(res, ms));
	
	// csv生データの割り切った簡単化
	function simplifyCsv(csv){
		var eCsv="";
		// 改行コードの正規化を行っておく
		csv = csv.replace(/\r\n/g, "\n");
		if (csv.endsWith("\n")) {
		    csv = csv.slice(0, -1);
		}
		
		// ダブルクオーテーションによるエスケープを消す
		// そのとき、ダブルクオーテーションはシングルクォーテーションに、　カンマは;に、　改行は除去する
//		csv = csv.replace(/¥"¥"/g, "&#034;");
		csv = csv.replace(/\"\"/g, "'");
		var prevPos = 0;
		var startPos = 0;
		while ( startPos >=0 ){
			startPos = csv.indexOf('"',prevPos);
			if ( startPos >=0 ){
				var endPos = csv.indexOf('"',startPos+1);
				if ( endPos <0 ){break}
				eCsv += csv.substring(prevPos,startPos);
				var escStr = csv.substring(startPos+1,endPos);
				escStr = escStr.replace(/\r?\n/g,"");
//				escStr = escStr.replace(/,/g, "&#044;");
				escStr = escStr.replace(/,/g, ";");
				eCsv += escStr;
				prevPos = endPos + 1;
			} else {
				eCsv += csv.substring(prevPos);
			}
			
		}
		
		csv = eCsv;
		csv = csv.replace(/"/g, "'");
		return csv;
	}
	
	async function initCsv(inputCsv, latC,lngC,titleC,iconIndexOrCustomIconDataURL, varIconThParam, firstRecordParam){
		console.log("called: initCsv",iconIndexOrCustomIconDataURL,varIconThParam, firstRecordParam);
		var iconIndex;
		var customIconDataURL;
		if ( typeof iconIndexOrCustomIconDataURL =="string"){
			customIconDataURL = iconIndexOrCustomIconDataURL;
		} else {
			iconIndex = iconIndexOrCustomIconDataURL;
		}
		messageDivElm.innerText="Start Visualization";
		await sleep(10);
		windowObj.removePrevTiles();
		removeAllPOIs();
		windowObj.clearQTCTdata();
		svgImage.firstChild.setAttribute("property","");
		
		// CSVを準備する
		if(inputCsv){
			csv = inputCsv;
		}
		
		csv = simplifyCsv(csv);
		
		csv = csv.split(LF); // CSVデータは、1次元配列、配列の要素は、1レコード分のCSVデータ（2次元配列ではない・・）
		//console.log("CSV:",csv);
//		console.log("initCsv:length",csv.length);
//		console.log("verIE:",verIE);
		var firstRecord=0;
		
		if ( firstRecordParam ){
			firstRecord = firstRecordParam;
		}
		
		// スキーマを求める
		var cs={
			latCol:-1 ,
			lngCol:-1 ,
			titleCol:-1,
			titleCol2:-1,
			varIconCol:-1,
			varIconTh:[],
			defaultIconNumber:0,
		}
		removeCustomIcon();
		buildInitialCategory();
		if(inputCsv){
			if ( latC != undefined || latC != null ){
				cs.latCol = latC;
			}
			if ( lngC != undefined || lngC != null ){
				cs.lngCol = lngC;
			}
			if ( titleC != undefined || titleC != null ){
				cs.titleCol = titleC;
			}
			if ( varIconThParam ){
				cs.varIconCol = iconIndex;
				cs.varIconTh = varIconThParam;
				//console.log("initCsv: change icon based property... iconCol:",cs.varIconCol,"  varIconTh:",cs.varIconTh );
			} else if ( customIconDataURL ){
				cs.defaultIconNumber = customIconDataURL;
				cs.varIconCol = -1;
				cs.varIconTh = [];
				buildCustomIconDefs(customIconDataURL);
			} else {
				cs.defaultIconNumber = iconIndex;
				cs.varIconCol = -1;
				cs.varIconTh = [];
			}
		} else if (hashParamCsvSchema.latCol>=0){
			cs = hashParamCsvSchema;
		}
		
		if ( cs.latCol == null || cs.latCol == -1){
			cs = parseSchema(csv[0]);
			svgImage.firstChild.setAttribute("property",csv[0]);
			firstRecord=1;
		}
		cs.firstRecord = firstRecord;

		//console.log("Csv Schema:",cs);
		if ( cs.latCol == -1 || cs.lngCol == -1 ){
			console.warn("initCsv: Can't resolve latCol or lngCol exit");
			return;
		} else {
		}
		
		if ( cs.varIconCol != -1 && cs.varIconTh.length == 0){
			checkVarIconTh(csv,firstRecord,cs);
		}
		
		
		if ( firstRecord !=0 && !svgImage.firstChild.getAttribute("property") ){
			svgImage.firstChild.setAttribute("property",csv[0]);
		}
		
		var qtctData;
		windowObj.useQTCT=false;
		if ( csv.length > QTCTth){
			windowObj.useQTCT=true;
			qtctData = [];
		}
		
		// console.log(windowObj.useQTCT,csv);
		let properPoints =0;
		for ( var i = firstRecord ; i < csv.length ; i++ ){
			var strTxt = csv[i].split(",");
//			console.log("strTxt",strTxt);
//			console.log("wgPos",strTxt[cs.latCol],strTxt[cs.lngCol]);
			
			if ( strTxt.length > 2 ){
				var wgPos;
				if ( i==0 ){
					var stxt;
					if (isNaN(strTxt[cs.latCol])|| isNaN(strTxt[cs.lngCol])) {
						// 0行目はスキーマ行だった
						stxt = csv[i];
					} else {
						stxt = getSchemaTxt(cs,strTxt.length);
					}
					svgImage.firstChild.setAttribute("property",stxt);
				}
				if ( tokyoDatum ){
					wgPos = toWGS( Number(strTxt[cs.latCol]) , Number(strTxt[cs.lngCol]));
				} else {
					wgPos = { lat: Number( strTxt[cs.latCol] ) , lng: Number( strTxt[cs.lngCol]) };
				}
//				var wgPos = toWGS( strTxt[2] * 1.0 , strTxt[1] * 1.0);
				if ( isNaN(wgPos.lat) || isNaN(wgPos.lng) ){
					continue;
				}
				if ( wgPos && wgPos.lat && wgPos.lng){
					if ( windowObj.useQTCT ){
						strTxt[cs.latCol] = wgPos.lat;
						strTxt[cs.lngCol] = wgPos.lng;
						qtctData.push(strTxt);
					} else {
						var title;
						if ( cs.titleCol2 >= 0 ){
							title = strTxt[cs.titleCol] + "/" + strTxt[cs.titleCol2]
						} else {
							title = strTxt[cs.titleCol];
						}
						var addPOI = getPOI( wgPos.lat , wgPos.lng , title , strTxt, cs); 
						// console.log(addPOI);
						if ( addPOI ){
							svgImage.getElementsByTagName("svg")[0].appendChild(addPOI);
						}
					}
					++properPoints;
				}
			}
		}
		
		cs.property = svgImage.firstChild.getAttribute("property").split(",");
		currentSchema = cs;
		
		if ( windowObj.useQTCT ){
			await drawQTCTmap(qtctData, cs);
		} else{
			messageDivElm.innerText="";
			svgMap.refreshScreen();
		}
		
		if(typeof initCsvCallback == "function"){
			initCsvCallback({properPoints});
		}
	
	}
	var initCsvCallback;
	
	function removeCustomIcon(){
		console.log("removeCustomIcon");
		var ci = svgImage.getElementById(customIconId);
		if ( ci ){
			ci.parentElement.removeChild(ci);
		}
	}
	
	function buildCustomIconDefs(customIconDataURL){
		removeCustomIcon();
		console.log("buildCustomIconDefs");
		
		var defs=svgImage.getElementsByTagName("defs")[0];
		var grp = svgImage.createElement("g");
		grp.setAttribute("id",customIconId);
		
		var cimg = svgImage.createElement("image");
		cimg.setAttribute("xlink:href",customIconDataURL);
		cimg.setAttribute("preserveAspectRatio","none");
		cimg.setAttribute("x","-10");
		cimg.setAttribute("y","-10");
		cimg.setAttribute("width","20");
		cimg.setAttribute("height","20");
		
		grp.appendChild(cimg);
		defs.appendChild(grp);
	}
	
	async function drawQTCTmap(qtctData, cs){
		console.log("drawQTCTmap:");
		//messageDivElm.innerText="データの可視化処理中";
		//messageDivElm.style.display="";
		await windowObj.buildQTCTdata(qtctData, cs, progressFunc);
		svgMap.refreshScreen();
		messageDivElm.innerText="";
	}
	
	function clearMap(){
		windowObj.removePrevTiles();
		removeAllPOIs();
		windowObj.clearQTCTdata();
		svgImage.firstChild.setAttribute("property","");
		csv=null;
		currentSchema=null;
		svgMap.refreshScreen();
	}
	
	function progressFunc(msg){
		messageDivElm.innerText=msg;
	}
	
	function loadCSV(csvPath, charset){
		console.log("loadCSV csvPath:" , csvPath, " \ndocPath:",docPath);
		var httpObj = new XMLHttpRequest();
		if ( httpObj ) {
			httpObj.onreadystatechange = function(){ handleResult( this) } ; // 非同期に変更(for >rev10) 2015.6.2
			httpObj.open("GET", csvPath , true );
			if ( charset ){
				httpObj.overrideMimeType('text/plain; charset='+charset);
			}
			httpObj.send(null);
		}
	}
	
	function handleResult( httpRes , cbf){
		if (( httpRes.readyState == 4 ) ){
			if ( httpRes.status == 403 || httpRes.status == 404 || httpRes.status == 500 || httpRes.status == 503 ){
				console.log( "File get failed: ",  httpRes.status);
				return;
			}
//			console.log("xhrRes:",httpRes.responseText);
			csv = httpRes.responseText;
			initCsv();
			if ( svgMap.refreshScreen ){
//				svgMap.refreshScreen();
			}
		}
	}
	
	function getIconNumber( val, th ){
		var ans=0;
//		console.log( ans , val ,  th[ans],th);
		
		while ( val > th[ans] && ans <= th.length ){
			++ans;
		}
//		console.log( val , ans );
		return ( ans );
	}
	
	var allocatedIconNumb = 0;
	var iconColData2Category ={};
	function getIconId(metadata, csvSchema, byIndex){ // iconColの内容が数字以外だったら連想配列で処理する 2018/06
		
		var icon = csvSchema.defaultIconNumber;
		if ( typeof icon =="string"){ // added 2024/2/22 カスタムアイコン
			if ( byIndex ){ // QTCTのLowRes表示の色マップのインデックスを決める数字(QTCTrendererのbuildQTCTdataで呼んでいる)だが・・・これは0番の色を決め打っていていい加減(TBD)
				// 本来ならカスタムアイコンの平均的な色合いを基に色を決めて設定する感じのちょっと難しいロジックがあるべき？
				return 0;
			} else {
				return customIconId;
			}
		}
		if ( csvSchema.varIconCol != -1 ){
			icon = metadata[csvSchema.varIconCol] ;
			if ( iconColMatch && !iconColMatch.test(icon) ){
				return null;
			}
		}
		
		if ( csvSchema.varIconTh.length > 0 ){ // 数値の閾値に応じたアイコン番号変更
			icon = getIconNumber(Number(icon),csvSchema.varIconTh);
		}
		
		// iconの内容が文字の場合、アイコンの数分だけ、連想配列を割り付ける。超えてしまったら、最初のアイコンに戻って繰り返し割り付ける
		//console.log("getIconId: category:",category,"  icon:",icon, " metadata, csvSchema:",metadata, csvSchema);
		
		var ansIconIndex = null;
		
		if ( category[icon] ){
				ansIconIndex = Number(icon);
		} else {
			var iconNumb = iconColData2Category[icon];
			if ( iconNumb != undefined){
				ansIconIndex = iconNumb;
			} else {
				iconColData2Category[icon] = allocatedIconNumb;
				ansIconIndex = allocatedIconNumb;
				++ allocatedIconNumb;
				if ( allocatedIconNumb >= iconsLength ){
					allocatedIconNumb = 0;
				}
			}
		}
		if ( byIndex ){
			return ( ansIconIndex );
		} else {
			return ( category[ansIconIndex] );
		}
	}
	
	function getPOI( latitude , longitude , title , metadata , csvSchema){
		var iconId = getIconId(metadata , csvSchema);
		if ( iconId === null){return  null};
		var tf = "ref(svg," + (longitude * 100) + "," + ( latitude * -100 ) + ")";
		
		var cl;
		cl = svgImage.createElement("use"); // Edgeで不具合発生＆すべてのケースでもはやdocumentはSVG文書ではなく単なるwell formed XML文書化したためSVGネームスペース宣言不要
		cl.setAttribute("x" , 0);
		cl.setAttribute("y" , 0);
		cl.setAttribute("transform" , tf);
		cl.setAttribute("xlink:href" , "#"+ iconId );
		cl.setAttribute("xlink:title" , title);
		if ( metadata ){
			cl.setAttribute("content" , metadata);
		}
//		cl.setAttribute("opacity" , "0.5");
		return ( cl );
	}
	
	function toWGS(jlat , jlng){ // 雑すぎる旧測地系からWGS84への変換関数(TBD)
		var glat = jlat - 0.00010695 * jlat + 0.000017464 * jlng + 0.0046017;
		var glng = jlng - 0.000046038 * jlat - 0.000083043 * jlng + 0.010040;
		return{
			lat: glat ,
			lng: glng
		}
	}
	
	function removeAllPOIs(){
		console.log("removeAllPOIs");
		var pois=svgImage.getElementsByTagName("use");
		if ( pois.length >0){
			for ( var i = pois.length -1  ; i >=0 ; i-- ){
				(pois[i].parentElement).removeChild(pois[i]);
			}
		}
	}
	
	// アイコンの図形・画像～文字列：もしくは配列(varIconTh>0のとき) 2025/6/12
	function getUsedIcon(){
		if (!currentSchema){return}
		if ( currentSchema.varIconTh.length > 1 ){
			// TBD
			// カラム番号の値(currentSchema.varIconCol)によってアイコンが変わるケース
			return ["現在のところ値による可変アイコンの提供は未対応です"];
		} else {
			if ( typeof currentSchema.defaultIconNumber =="string"){
				return currentSchema.defaultIconNumber; // dataURLが入るはず
			} else {
				var iconElmg = svgImage.getElementById(category[currentSchema.defaultIconNumber]);
				var iconImg =  iconElmg.getElementsByTagName("image");
				if (iconImg.length > 0){
					return iconImg[0].getAttribute("xlink:href"); // 登録済みアイコンのケース
				} else {
					return iconElmg; // ベクトルアイコンのケースはElementが入る・・・
				}
			}
		}
	}
	
	// CSVを操作する 2025/06
	// action:
	// "add": lineが必要
	// "replace": line, prevLineが必要
	// "delete": lineが必要
	// useQTCTではない場合は、オーサリングツールが静的なsvgコンテンツ実体を編集していることを前提とし、再レンダリングしない制約がある
	async function editCsv(action,line,prevLine){
		let q,stat=true;
		if (!line){return false}
		line = simplifyCsv(line);
		if ( action.toLowerCase()=="add"){
			csv.push(line);
			if ( windowObj.useQTCT ){
				q = line.split(",");
				stat = await windowObj.clientSideQTCT.registOneData(q);
			}
		} else if ( action.toLowerCase()=="replace"){
			if ( !prevLine){return false};
			prevLine = simplifyCsv(prevLine);
			const hitLine = csv.indexOf(prevLine);
			if ( hitLine >=0){
				csv[hitLine]=line; // まったく同じ内容のレコードがある場合は失敗するが大目に見てくださいｗ・・・
			} else {
				return false;
			}
			if ( windowObj.useQTCT ){
				q = prevLine.split(",");
				stat = await windowObj.clientSideQTCT.deleteOneData(q);
				q = line.split(",");
				stat = await windowObj.clientSideQTCT.registOneData(q);
			}
		} else if (action.toLowerCase()=="delete"){
			const hitLine = csv.indexOf(line);
			if ( hitLine >=0){
				csv.splice(hitLine,1); 
			} else {
				return false;
			}
			if ( windowObj.useQTCT ){
				q = line.split(",");
				stat = await windowObj.clientSideQTCT.deleteOneData(q);
			}
		}
		return stat;
	}
	
	
	return{
		getIconId:getIconId,
		initCsv:initCsv,
		onload:onload,
		get csvPath(){
			return csvPath;
		},
		get csvIndex(){
			return csvIndex;
		},
		get customIconId(){
			return customIconId;
		},
		loadCsv:loadCSV,
		getCsv:getCsv,
		getSchema:getSchema,
		get QTCTth(){
			return QTCTth;
		},
		setInitCsvCallback(cbf){
			initCsvCallback = cbf;
		},
		setMessageDiv:setMessageDiv,
		clearMap:clearMap,
		buildCustomIconDefs,
		getUsedIcon,
		editCsv,
		simplifyCsv,
	}
};

csvMapper = csvMapperClass(window);