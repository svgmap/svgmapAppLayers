// Description:
// csvInputUI_r*.js : CSV入力UI for CSVレイヤー
// 
//  Programmed by Satoru Takagi
//  
// Description: Dynamic  plate carree Tile Pyramid Layer for SVGMap 
//
// Programmed by Satoru Takagi
// 
// License: (MPL v2)
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.
//
// history:
// 2024/3/6 ISSUE対応のためXHTML化とともに、jsを別ファイルに　いろいろお行儀もよくなった

// ISSUE:
// textAreaに大きなファイルを入れると異常に遅くなる：FIXED
// 　https://stackoverflow.com/questions/16736198/typing-in-textarea-super-slow-when-lots-of-text-inside
// 　シークレットウィンド内だと全然遅くない。　Extension等が余計な処理で重くしていることは明白・・
// ⇒ DeepL Extensionが原因だった。 xhtmlに対しては問題が起きないことが判明 ⇒ xhtml化
//

const txtAreaTh = 100000; // ロードしたコンテンツをtextAreaに何行まで表示させるか

var isReady=false;
window.onload = function(){
	initUI();
	setTestCsv(testCsv0);
	if ( window.opener?.openCsvSubwindow_ph2 ){
		window.opener.openCsvSubwindow_ph2();
	}
	isReady=true;
}

var csvArea,csvStatus,geoCoderUI,Tsv2CsvBtn,fileLoadInputUI  ;

function initUI(){ // 初期化
	Tsv2CsvBtn  = document.getElementById("Tsv2CsvBtn");
	fileLoadInputUI  = document.getElementById("fileLoadInputUI");
	geoCoderUI = document.getElementById("geoCoderUI");
	csvStatus = document.getElementById("csvStatus");
	csvArea = document.getElementById("csvArea");
	csvArea.addEventListener("input",setSchema,false);
	csvArea.addEventListener("click", showCursorPointLocation,false);
	csvArea.addEventListener("focusout", hilightCsvAreaLine,false);
	setSchema();
	
	// GSIジオコーダ用のProxy(不要な気はするが・・)設置
	if ( window.opener ){
		useProxy = function(url){ var pxurl = window.opener.svgMap.getCORSURL(url); return pxurl;};
//		txtAreaTh = window.opener.csvMapper.QTCTth;
	}
	// ローカルジオコーダ追加 そのイニシャライズ
	if ( typeof tokoro != "undefined" && typeof oazaGeocoder != "undefined" ){
		tokoro({ data: "/csvLocalGeocoder/data" });
		oazaGeocoder.setDBpath("/csvLocalGeocoder/chomokuData/");
	}
}


function setSchema(presetSchema){
	var carea = csvArea;
	var csvData = carea.value;
	var schema = csvData.split(String.fromCharCode(10))[0].split(",");
	console.log("Set Schema : ", schema);
	
	var dataLength = schema.length;
	var latCol = -1;
	var lngCol = -1;
	var nameCol = -1;
	var addrCol = -1;
	if ( presetSchema ){
		latCol = presetSchema.latCol;
		lngCol = presetSchema.lngCol;
		nameCol = presetSchema.titleCol;
	} else {
		for ( var i = 0 ; i < dataLength ; i++ ){
			switch( schema[i] ){
			case "latitude":
			case "lat":
			case "lati":
			case "緯度":
				if ( latCol == -1 ){
					latCol = i;
				}
				break;
			case "longitude":
			case "lon":
			case "lng":
			case "long":
			case "経度":
				if ( lngCol == -1){
					lngCol = i;
				}
				break;
			case "title":
			case "name":
			case "タイトル":
			case "名称":
			case "名前":
				if ( nameCol == -1 ){
					nameCol = i;
				}
				break;
			case "address":
			case "addr":
			case "アドレス":
			case "所在地":
			case "住所":
				if ( addrCol == -1 ){
					addrCol = i;
				}
				break;
			}
		}
	}
	console.log("Schema : latCol:",latCol,"  lngCol:",lngCol,"  nameCol:",nameCol);
	
	refreshSelect( document.getElementById("nameCol") , "", schema, nameCol);
	refreshSelect( document.getElementById("latCol") , "", schema, latCol);
	refreshSelect( document.getElementById("lngCol") , "", schema, lngCol);
	refreshSelect( document.getElementById("addrCol") , "", schema, addrCol);
	
	if ( window.opener ){
		initIconSelection(schema, window.opener.svgImage);
	}
}

function refreshSelect( sel, message, schema, selected ){
	removeChildren(sel);
	var length = schema.length;
	for ( var i = -1 ; i < length ; i++ ){
		var opt = document.createElement("option");
		opt.setAttribute("value",i);
		if ( i == -1 ){
			opt.innerText= message + "-";
		} else {
			opt.innerText= message + i+":"+schema[i];
		}
		if ( i == selected ){
			opt.setAttribute("selected",true);
		}
		sel.appendChild(opt);
	}
}


function removeChildren(parent){
	for ( var i = parent.childNodes.length -1; i>=0 ; i-- ){
		parent.removeChild(parent.childNodes[i]);
	}
}

function addCsvRecord(line){
	if ( fullCsvBackup[fullCsvBackup.length-1] == "\n" || fullCsvBackup[fullCsvBackup.length-1] == "\r" ){
		fullCsvBackup += line;
	} else {
		fullCsvBackup += "\n"+line;
	}
	updateCsvArea();
}

function replaceCsvRecord(line, prevLine){
	var hitLine = fullCsvBackup.indexOf(prevLine);
	console.log("replaceCsvRecord: line:",line, " prevLine:", prevLine,"  hit?:",hitLine);
	if ( hitLine >=0){
		fullCsvBackup = fullCsvBackup.replace(prevLine,line); // まったく同じ内容のレコードがある場合は失敗するが大目に見てくださいｗ・・・
	}
	updateCsvArea();
}

function deleteCsvRecord(prevLine){
	var tl = "\n" + prevLine;
	var hitLine = fullCsvBackup.indexOf(tl);
	console.log("deleteCsvRecord: prevLine:", prevLine,"  hit?:",hitLine);
	if ( hitLine >=0 ){
		fullCsvBackup = fullCsvBackup.replace(tl,""); // これだけだと改行が残る(最後のレコード以外)
	}
	updateCsvArea();
}

function updateCsvArea(){ 
	var carea = csvArea;
	if ( carea.getAttribute("data-partial")=="true"){
		carea.value = getPartCsv(fullCsvBackup,txtAreaTh);
	} else {
		carea.value = fullCsvBackup;
	}
	//viewCsv();
}

function viewCsv(){
	// 表示させるviewボタンを押したときの機能
	// ISSUE:
	// 2024/10/02 : もしファイルから読み込んだものに対して、再度viewを押したならば、そこからはそのファイルではない新しいファイルという位置づけになるべき。そうしたらファイルが選択されている状態はおかしい
	if ( !window.opener ){
		console.warn("NO window.opener");
		return;
	}
	
	var carea = csvArea;
	var csvData;
	if ( carea.getAttribute("data-partial")=="true"){
		csvData = fullCsvBackup;
	} else {
		csvData = carea.value;
		fullCsvBackup = csvData;
	}
	
	var latC = Number(document.getElementById("latCol").selectedIndex)-1;
	var lngC = Number(document.getElementById("lngCol").selectedIndex)-1;
	var titleC = Number(document.getElementById("nameCol").selectedIndex)-1;
	var iconIndex = Number(document.getElementById("iconSetup").selectedIndex);
	var varIconTh = null;
	var customIconPreview = (document.getElementById("customIconPreview"));
	if ( iconIndex == iconsLength){ // カスタムアイコンを使う
		console.log("USE custom Icon");
		var customIconSrc =  customIconPreview.getAttribute("src");
		if ( !customIconSrc ){
			customIconSrc = nullPin;
		}
		varIconTh = null;
		iconIndex = customIconSrc; // カスタムアイコンを指定する場合は、iconIndexにアイコンのソースを設定する
	} else if ( iconIndex >= iconsLength +1){ // 属性の値によってアイコンを変化させる
		varIconTh = []; // varIconThに空配列を設定すると、適当にやってくれる
		// TBD: Th(LL.L),Th(L.M),Th(M.H),Th(H.HH)
		iconIndex = iconIndex - (iconsLength +1); // この場合はiconIndexに、属性番号を設定する
		console.log("change icon based property... Number:",iconIndex);
	} // else 通常の場合は、iconIndexにはアイコンの番号を設定する
	
//	console.log("csvData:",csvData);
	console.log("latC:",latC," lngC:",lngC," titleC:",titleC,"  len_csvData:",csvData.length," iconIndex:", iconIndex, "  varIconTh:",varIconTh);
	window.opener.svgImageProps.hash=""; // 2024/10/02
	window.opener.csvMapper.initCsv(csvData, latC,lngC,titleC,iconIndex,varIconTh, 1);
	window.opener.svgMap.refreshScreen();
}

var nullPin = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAoAAAAKAQMAAAC3/F3+AAABhGlDQ1BJQ0MgcHJvZmlsZQAAKJF9kT1Iw0AcxV9TtVIqDhYRcchQnSyIijhKFYtgobQVWnUwufQLmjQkKS6OgmvBwY/FqoOLs64OroIg+AHi7OCk6CIl/i8ptIjx4Lgf7+497t4BQqPCVLNrAlA1y0jFY2I2tyoGXiFgED0IQpSYqSfSixl4jq97+Ph6F+VZ3uf+HH1K3mSATySeY7phEW8Qz2xaOud94jArSQrxOfG4QRckfuS67PIb56LDAs8MG5nUPHGYWCx2sNzBrGSoxNPEEUXVKF/Iuqxw3uKsVmqsdU/+wlBeW0lzneYI4lhCAkmIkFFDGRVYiNKqkWIiRfsxD/+w40+SSyZXGYwcC6hCheT4wf/gd7dmYWrSTQrFgO4X2/4YBQK7QLNu29/Htt08AfzPwJXW9lcbwOwn6fW2FjkC+reBi+u2Ju8BlzvA0JMuGZIj+WkKhQLwfkbflAMGboHgmttbax+nD0CGulq+AQ4OgbEiZa97vLu3s7d/z7T6+wFINHKW8FfxtwAAAAZQTFRFZwAAwwD/Dn1BuQAAAAF0Uk5TAEDm2GYAAAABYktHRACIBR1IAAAACXBIWXMAAC4jAAAuIwF4pT92AAAAB3RJTUUH6AIWBg8siLxk8gAAABl0RVh0Q29tbWVudABDcmVhdGVkIHdpdGggR0lNUFeBDhcAAAAXSURBVAjXY5BjYKhvAKH/BxAIIiLHAACoxAs1dqDiZwAAAABJRU5ErkJggg==";

async function genericGeoCode(address, geoCodeType){
	if ( geoCodeType == "gsi"){
		var ans = await gsiGeoCode(address);
		if ( !ans || ans.length == 0 ){
			return null;
		} else {
			var certainty="Certainly";
			if (ans.length >1){
				certainty="Uncertain";
			}
			return [ans[0].geometry.coordinates[1],ans[0].geometry.coordinates[0],certainty,ans[0].properties.title];
		}
	} else {
		var ans=null;
		try{
			ans = compositeLocalGeoCode(address);
		} catch(e){
			console.warn("Fail compositeLocalGeoCode skip :",e);
		}
		return ( ans );
	}
}

function compositeLocalGeoCode(address) {
	return new Promise(function(okCallback) {
		compositeGeocoder.getPosition(address, okCallback);
	});
}

var geoCoderGlobalObj={
	simultaneousCoders : 5, // ジオコーダに同時リクエストする数
	geocodeMax : 1000, // この回数を超えると、一旦停止
	geoCodeHalt : false,
	geoCodePause : false
}

async function geoCode(coder){
	console.log("geoCode:",coder);
	var geoCodeBtn1 = document.getElementById("geoCodeBtn1");
	var geoCodeBtn2 = document.getElementById("geoCodeBtn2");
	if  ( geoCodeBtn2.value=="処理を進める" && coder=="local"){ // きたない・・
		geoCoderGlobalObj.geoCodePause=false;
		return;
	} else if ( geoCodeBtn1.value=="キャンセル" ){
		geoCoderGlobalObj.geoCodeHalt=true;
		pass=true;
		return;
	}
	var addrCol = Number(document.getElementById("addrCol").selectedIndex)-1;
	console.log("geoCode:addrCol:",addrCol);
	if ( addrCol <0 ){
		return 
	}
	
	geoCodeBtn1.value="キャンセル";
	geoCodeBtn2.style.display="none";
	var carea = csvArea;
	var csvData = carea.value;
	csvData = csvData.split(String.fromCharCode(10));
	csvData[0]+=",latitude,longitude,resolvedLevel";
	var geoCodePromise=[];
	var loopIndex =[];
	var geoCodedCsvData = [];
	for ( var i = 1 ; i < csvData.length ; i++){
		var splitRow = csvData[i].split(",");
		if ( splitRow.length > addrCol ){
			var addr = splitRow[addrCol].trim();
			if ( addr ){
				if ( geoCoderGlobalObj.geoCodeHalt ){
					geoCodedCsvData[i]=",---,---,---";
				} else {
					geoCodePromise.push( await genericGeoCode(addr,coder) );
					loopIndex.push(i);
				}
			} else {
				geoCodedCsvData[i]=",---,---,---";
			}
		}
		if ( geoCodePromise.length == geoCoderGlobalObj.simultaneousCoders || i == csvData.length-1){
			var codes = await Promise.all(geoCodePromise);
			console.log("codes:",codes);
			for ( var j = 0 ; j < codes.length ; j++ ){
				var code = codes[j];
				if ( code ){
					geoCodedCsvData[loopIndex[j]]= ","+code[0]+","+code[1]+","+code[2];
				} else {
					geoCodedCsvData[loopIndex[j]]=",---,---,---";
				}
			}
			updateGeocodingTextArea(csvData, geoCodedCsvData);
			document.getElementById("gcPrg").innerText=(i+1)+"/"+csvData.length;
			geoCodePromise=[];
			loopIndex =[];
		}
		if ( coder !="local" &&  i % geoCoderGlobalObj.geocodeMax==0){
			console.log("geocodeLimit pause");
			await waitRestartGeocode();
			//await sleep(3000);
		}
	}
	console.log("geocode finished");
	setSchema();
	initGeoCodeUI();
}

function initGeoCodeUI(){
	console.log("initGeoCodeUI");
	var geoCodeBtn1 = document.getElementById("geoCodeBtn1");
	var geoCodeBtn2 = document.getElementById("geoCodeBtn2");
	geoCodeBtn1.value="GSIジオコード";
	geoCodeBtn2.value="LOCALジオコード";
	geoCodeBtn2.style.display="";
	geoCoderGlobalObj.geoCodeHalt=false;
	geoCoderGlobalObj.geoCodePause=false;
}

function waitRestartGeocode(){
	var geoCodeBtn2 = document.getElementById("geoCodeBtn2");
	console.log("waitRestartGeocode");
	geoCoderGlobalObj.geoCodePause = true;
	geoCodeBtn2.value="処理を進める"
	geoCodeBtn2.style.display="";
	return new Promise(async function(okCb,ngCb){
		var cancel = false;
		while (geoCoderGlobalObj.geoCodePause){
			if ( geoCoderGlobalObj.geoCodeHalt ){
				cancel=true;
				break;
			}
			await sleep(10);
		}
		if ( cancel ){
			geoCodeBtn2.style.display="";
		} else {
			geoCodeBtn2.style.display="none";
		}
		okCb();
	});
}

function updateGeocodingTextArea(csvData, geoCodedCsvData){
	var csvOutData="";
	for ( var i = 0 ; i < csvData.length ; i++ ){
		var geoCodedCol = "";
		if ( geoCodedCsvData[i] ){
			geoCodedCol = geoCodedCsvData[i];
		}
		csvOutData += csvData[i] + geoCodedCol + String.fromCharCode(10);
	}
	document.getElementById("gcPrg").innerText="";
	csvArea.value=csvOutData;
}




// アイコンを選択するためのUI
var iconsLength = -1;

function initIconSelection(schema,svgImage){
	removeChildren(document.getElementById("iconSetup"));
	removeChildren(document.getElementById("iconSample"));
	
	/**
	var ci = svgImage.getElementById("customIcon");
	if ( ci ){
		ci.parentElement.removeChild(ci);
	}
	**/
	
	var defs=svgImage.getElementsByTagName("defs")[0];
	var icons=getChildren(defs, ["customIcon"]);
	var iconSample = document.getElementById("iconSample");
	var iconSetup = document.getElementById("iconSetup");
	iconsLength = icons.length;
	for ( var i = 0 ; i < icons.length ; i++ ){
		//console.log(icons[i]);
		var iconFirstChild = getChildren(icons[i])[0]
		if ( iconFirstChild.tagName=="image"){
			var isrc = iconFirstChild.getAttribute("xlink:href");
			//console.log("icon is img:",isrc);
			var img = document.createElement("img");
//			img.width=20;
			img.height=20;
			img.src=isrc;
			img.style.border="2px solid #ffffff";
			img.style.verticalAlign="top";
			iconSample.appendChild(img);
		} else {
			console.log("icon is Not img:",icons[i]);
			var svspan=document.createElement("svg");
			svspan.appendChild(icons[i]);
			iconSample.appendChild(svspan);
		}
		var opt=document.createElement("option");
		opt.value="icon_"+i;
		opt.innerText="No"+i+"⇒";
		iconSetup.appendChild(opt);
		
	}
	
	iconSetup.insertAdjacentHTML("beforeend",`<option vlaue="customIcon">カスタムアイコン</option>`);
	
	for ( var i = 0 ; i < schema.length ; i++ ){
		var opt = document.createElement("option");
		opt.value="schema_"+i;
		opt.innerText=i+":"+schema[i];
		iconSetup.appendChild(opt);
	}
	
	setIconSelection();
}

function setIconSelection(){
	var iconIndex = Number(document.getElementById("iconSetup").selectedIndex);
	var iconSampleChildren = getChildren(document.getElementById("iconSample"));
	var customIconPreview = (document.getElementById("customIconPreview"));
	for ( var i = 0 ; i <iconsLength ; i++ ){
		if ( i == iconIndex ){
			iconSampleChildren[i].style.border="2px solid #ff0000";
		} else {
			iconSampleChildren[i].style.border="2px solid #ffffff";
		}
	}
	if ( iconIndex == iconsLength ){ // カスタムアイコン選択
			customIconPreview.style.border="2px solid #ff0000";
	} else {
			customIconPreview.style.border="2px solid #ffffff";
	}
}

function getChildren(parent, excludeIds){
	var ans =[];
	var cn = parent.childNodes;
	for ( var i = 0 ; i < cn.length ; i++ ){
		if (cn[i].nodeType==1){
			if ( excludeIds &&  cn[i].getAttribute("id") && excludeIds.indexOf(cn[i].getAttribute("id"))>=0 ){continue}
			ans.push(cn[i]);
		}
	}
	return ( ans );
}

const sleep = ms => new Promise(res => setTimeout(res, ms));

function Tsv2Csv(){
	fullCsvBackup = fullCsvBackup.replaceAll("\t",",");
	setCsvSource(fullCsvBackup);
	/**
	var tsv = csvArea.value;
	var csv = tsv.replaceAll("\t",",");
	csvArea.value=csv;
	**/
	setSchema();
}

function setTestCsv(src, presetSchema){ // testなんて書いてあるけれど、この関数が呼び元から使われている
	console.log("setTestCsv:");
	if ( !src ){ src = testCsv0 }
	setCsvSource(src);
	if ( !presetSchema ){
		setSchema();
	} else {
		setSchema(presetSchema);
		setIconSetup(presetSchema);
	}
}

function setIconSetup(presetSchema){
	var iconNumbUI = document.getElementById("iconSetup");
	var customIconPreview = document.getElementById("customIconPreview");
	
	if ( isNaN (presetSchema.defaultIconNumber)){
		// カスタムアイコン
		iconNumbUI.selectedIndex = iconsLength;
		customIconPreview.setAttribute("src",presetSchema.defaultIconNumber);
	} else {
		if ( presetSchema.varIconCol>=0){
			// varIconCol番目の属性の値に応じて良い感じに設定
			iconNumbUI.selectedIndex = iconsLength + 1 + presetSchema.varIconCol;
		} else {
			// defaultIconNumberのアイコンを設定(一番ベーシックな設定)
			iconNumbUI.selectedIndex = presetSchema.defaultIconNumber;
		}
	}
	setIconSelection();
}

const testCsv0 = `name,addr,latitude,longitude
北海道庁,北海道 札幌市,43.06417,141.34694
青森県庁,青森県 青森市,40.82444,140.74
岩手県庁,岩手県 盛岡市,39.70361,141.1525
宮城県庁,宮城県 仙台市,38.26889,140.87194
秋田県庁,秋田県 秋田市,39.71861,140.1025
山形県庁,山形県 山形市,38.24056,140.36333
福島県庁,福島県 福島市,37.75,140.46778
茨城県庁,茨城県 水戸市,36.34139,140.44667
栃木県庁,栃木県 宇都宮市,36.56583,139.88361
群馬県庁,群馬県 前橋市,36.39111,139.06083
埼玉県庁,埼玉県 さいたま市,35.85694,139.64889
千葉県庁,千葉県 千葉市,35.60472,140.12333
東京都庁,東京都 新宿区,35.68944,139.69167
神奈川県庁,神奈川県 横浜市,35.44778,139.6425
新潟県庁,新潟県 新潟市,37.90222,139.02361
富山県庁,富山県 富山市,36.69528,137.21139
石川県庁,石川県 金沢市,36.59444,136.62556
福井県庁,福井県 福井市,36.06528,136.22194
山梨県庁,山梨県 甲府市,35.66389,138.56833
長野県庁,長野県 長野市,36.65139,138.18111
岐阜県庁,岐阜県 岐阜市,35.39111,136.72222
静岡県庁,静岡県 静岡市,34.97694,138.38306
愛知県庁,愛知県 名古屋市,35.18028,136.90667
三重県庁,三重県 津市,34.73028,136.50861
滋賀県庁,滋賀県 大津市,35.00444,135.86833
京都府庁,京都府 京都市,35.02139,135.75556
大阪府庁,大阪府 大阪市,34.68639,135.52
兵庫県庁,兵庫県 神戸市,34.69139,135.18306
奈良県庁,奈良県 奈良市,34.68528,135.83278
和歌山県庁,和歌山県 和歌山市,34.22611,135.1675
鳥取県庁,鳥取県 鳥取市,35.50361,134.23833
島根県庁,島根県 松江市,35.47222,133.05056
岡山県庁,岡山県 岡山市,34.66167,133.935
広島県庁,広島県 広島市,34.39639,132.45944
山口県庁,山口県 山口市,34.18583,131.47139
徳島県庁,徳島県 徳島市,34.06583,134.55944
香川県庁,香川県 高松市,34.34028,134.04333
愛媛県庁,愛媛県 松山市,33.84167,132.76611
高知県庁,高知県 高知市,33.55972,133.53111
福岡県庁,福岡県 福岡市,33.60639,130.41806
佐賀県庁,佐賀県 佐賀市,33.24944,130.29889
長崎県庁,長崎県 長崎市,32.74472,129.87361
熊本県庁,熊本県 熊本市,32.78972,130.74167
大分県庁,大分県 大分市,33.23806,131.6125
宮崎県庁,宮崎県 宮崎市,31.91111,131.42389
鹿児島県庁,鹿児島県 鹿児島市,31.56028,130.55806
沖縄県庁,沖縄県 那覇市,26.2125,127.68111`;

const testCsv=`局名,管轄区域,所在地,〒,電話番号
東京法務局,東京都,東京都千代田区九段南1-1-15 九段第２合同庁舎,102-8225,(03)5213-1234
横浜地方法務局,神奈川県,横浜市中区北仲通5-57横浜第２合同庁舎,231-8411,(045)641-7461
さいたま地方法務局,埼玉県,さいたま市中央区下落合5-12-1 さいたま第２法務総合庁舎,338-8513,(048)851-1000
千葉地方法務局,千葉県,千葉市中央区中央港1-11-3,260-8518,(043)302-1311
水戸地方法務局,茨城県,水戸市北見町1-1　水戸法務総合庁舎,310-0061,(029)227-9911
宇都宮地方法務局,栃木県,宇都宮市小幡2-1-11,320-8515,(028)623-6333
前橋地方法務局,群馬県,前橋市大手町2-3-1　前橋地方合同庁舎,371-8535,(027)221-4466
静岡地方法務局,静岡県,静岡市葵区追手町9-50 静岡地方合同庁舎,420-8650,(054)254-3555
甲府地方法務局,山梨県,甲府市丸の内1－1－18 甲府合同庁舎,400-8520,(055)252-7151
長野地方法務局,長野県,長野市大字長野旭町1108,380-0846,(026)235-6611
新潟地方法務局,新潟県,新潟市中央区西大畑町5191 新潟法務総合庁舎,951-8504,(025)222-1561
阪法務局,大阪府,大阪市中央区谷町2-1-17 大阪第２法務合同庁舎,540-8544,(06)6942-1481
京都地方法務局,京都府,京都市上京区荒神口通河原町東入上生洲町197,602-8577,(075)231-0131
神戸地方法務局,兵庫県,神戸市中央区波止場町1-1 神戸第２地方合同庁舎,650-0042,(078)392-1821
奈良地方法務局,奈良県,奈良市高畑町552,630-8301,(0742)23-5534
大津地方法務局,滋賀県,大津市京町3-1-1 大津びわ湖合同庁舎,520-8516,(077)522-4671
和歌山地方法務局,和歌山県,和歌山市二番丁3 （和歌山地方合同庁舎）,640-8552,(073)422-5131
名古屋法務局,愛知県,名古屋市中区三の丸2-2-1名古屋合同庁舎第１号館,460-8513,(052)952-8111
津地方法務局,三重県,津市丸之内26-8 津合同庁舎,514-8503,(059)228-4191
岐阜地方法務局,岐阜県,岐阜市金竜町5-13,500-8729,(058)245-3181
福井地方法務局,福井県,福井市春山1-1-54 福井春山合同庁舎,910-8504,(0776)22-5090
金沢地方法務局,石川県,金沢市新神田4-3-10 金沢新神田合同庁舎,921-8505,(076)292-7810
富山地方法務局,富山県,富山市牛島新町11-7 富山合同庁舎,930-0856,(076)441-0550
広島法務局,広島県,広島市中区上八丁堀6-30,730-8536,(082)228-5201
山口地方法務局,山口県,山口市中河原町6-16 山口地方合同庁舎２号館,753-8577,(083)922-2295
岡山地方法務局,岡山県,岡山市北区南方1-3-58,700-8616,(086)224-5656
鳥取地方法務局,鳥取県,鳥取市東町2-302 鳥取第２地方合同庁舎,680-0011,(0857)22-2191
松江地方法務局,島根県,松江市東朝日町192番地3,690-0001,(0852)32-4200
福岡法務局,福岡県,福岡市中央区舞鶴3-5-25,810-8513,(092)721-4570
佐賀地方法務局,佐賀県,佐賀市城内2-10-20,840-0041,(0952)26-2148
長崎地方法務局,長崎県,長崎市万才町8-16,850-8507,(095)826-8127
大分地方法務局,大分県,大分市荷揚町7-5大分法務総合庁舎,870-8513,(097)532-3161
熊本地方法務局,熊本県,熊本市中央区大江3-1-53 熊本第２合同庁舎,862-0971,(096)364-2145
鹿児島地方法務局,鹿児島県,鹿児島市鴨池新町1-2,890-8518,(099)259-0680
宮崎地方法務局,宮崎県,宮崎市別府町1番1号 宮崎法務総合庁舎,880-8513,(0985)22-5124
那覇地方法務局,沖縄県,那覇市樋川1-15-15 那覇第１地方合同庁舎,900-8544,(098)854-7950
仙台法務局,宮城県,仙台市青葉区春日町7-25仙台第３法務総合庁舎,980-8601,(022)225-5611
福島地方法務局,福島県,福島市霞町1-46 福島合同庁舎,960-8021,(024)534-1111
山形地方法務局,山形県,山形市緑町1-5-48 山形地方合同庁舎,990-0041,(023)625-1321
盛岡地方法務局,岩手県,盛岡市盛岡駅西通1-9-15 盛岡第２合同庁舎,020-0045,(019)624-1141
秋田地方法務局,秋田県,秋田市山王7-1-3,010-0951,(018)862-6531
青森地方法務局,青森県,青森市長島1-3-5 青森第二合同庁舎,030-8511,(017)776-6231
札幌法務局,最寄りの法務局等へお尋ね下さい。,札幌市北区北8条西2-1-1,060-0808,(011)709-2311
函館地方法務局,函館市新川町25-18 函館地方合同庁舎,040-8533,(0138)23-7511
旭川地方法務局,旭川市宮前１条3-3-15 旭川合同庁舎,078-8502,(0166)38-1111
釧路地方法務局,釧路市幸町10-3,085-8522,(0154)31-5000
高松法務局,香川県,高松市丸の内1-1 高松法務合同庁舎,760-8508,(087)821-6191
徳島地方法務局,徳島県,徳島市徳島町城内6-6 徳島地方合同庁舎,770-8512,(088)622-4171
高知地方法務局,高知県,高知市栄田町2-2-10高知よさこい咲都合同庁舎,780-8509,(088)822-3331
松山地方法務局,愛媛県,松山市宮田町188-6 松山地方合同庁舎,790-8505,(089)932-0888`;


var fullCsvBackup; // 

function loadCsvFile(event){
	var fileData = event.target.files[0];
	var reader = new FileReader();
	reader.onerror = function() {
		console.log("File Read Failed");
	}
	reader.onload = function(evt) {
		console.log("fileRead onload");
		var data = new Uint8Array(reader.result);
//		var sj_td = new TextDecoder("Shift_JIS");
		var sj_td = new TextDecoder("ms932"); // 結局これでも全角のハイフンみたいな文字は変換できてない・・・"?"になる
		var ut_td = new TextDecoder("UTF-8");
		
		var csv = ut_td.decode(data);
		console.log("fileRead decoded");
		if ( checkMojibake(csv)==false){ // 文字化け判定で、文字コード自動判別＆変換をチャレンジ
			console.log("テキストはUTF-8ではないようです。SJISとして変換してみます");
			csv = sj_td.decode(data);
		}
		console.log("fileRead determine charset");
		csv = csv.replaceAll(/\r\n/g, "\n");
		csv = csv.replaceAll(/"/g, "");
		setCsvSource(csv);
	}
	if (!fileData){
		
	} else {
		reader.readAsArrayBuffer(fileData);
	}
	// reader.readAsText(fileData, 'Shift_JIS');
}

function setCsvSource(csvTxt){
	currentCsvLine=0;
	resetCsvArea();
	var lines = ( csvTxt.match( /\n/g ) || [] ).length; // 行数を調べる
	fullCsvBackup = csvTxt;
	if ( lines < txtAreaTh ){
		// 最大txtAreaTh行までしか表示させないようにして、それを超えたらページ切り替えするような機構をつけたい。できればcustom elementsが良が・・
		csvArea.value=csvTxt;
	} else {
		csvArea.value = getPartCsv(csvTxt,txtAreaTh);
		csvArea.setAttribute("data-partial","true");
		csvArea.setAttribute("readonly","true");
		var startLine="先頭";
		if ( currentCsvLine >0){
			startLine = `${currentCsvLine+1}行目`;
		}
		csvStatus.innerHTML=`<input type="button" onclick="showPartCsv(true)" value="←"></input> <input type="button" onclick="showPartCsv()" value="→"></input> ${lines}レコード中、${startLine}から${txtAreaTh}行を表示。`;
		geoCoderUI.style.display="none";
		Tsv2CsvBtn.style.display="none";
	}
	console.log("set textArea");
	setSchema();
}

var currentCsvLine = 0;

function showPartCsv(prev){
	var lines = ( fullCsvBackup.match( /\n/g ) || [] ).length;
	if(prev){
		currentCsvLine-=txtAreaTh;
		if (currentCsvLine <0){
			currentCsvLine = 0;
//			currentCsvLine = lines-txtAreaTh;
		}
	} else {
		currentCsvLine+=txtAreaTh;
		if (currentCsvLine >= lines){
			currentCsvLine = 0;
		}
	}
	console.log(currentCsvLine,lines,prev);
	csvArea.value = getPartCsv(fullCsvBackup,currentCsvLine+txtAreaTh,currentCsvLine);
	var startLine="先頭";
	if ( currentCsvLine >0){
		startLine = `${currentCsvLine+1}行目`;
	}
	csvStatus.innerHTML=`<input type="button" onclick="showPartCsv(true)" value="←"></input> <input type="button" onclick="showPartCsv()" value="→"></input> ${lines}レコード中、${startLine}から${txtAreaTh}行を表示。`;
}

function resetCsvArea(){
	csvArea.value ="";
	fullCsvBackup=null;
	csvArea.removeAttribute("data-partial");
	csvArea.removeAttribute("readonly");
	csvStatus.innerText="";
	geoCoderUI.style.display="";
	Tsv2CsvBtn.style.display="";
	fileLoadInputUI.value="";
}

function getPartCsv(csv, endLine, startLine){
	if ( !startLine){startLine=0};
	var regObj = RegExp(/\n/g);
	var arr=new Array();
	var count = 0;
	var sidx = 0;
	var lidx = -1;
	
	while((arr=regObj.exec(csv))!=null){
		//console.log(arr.index+"-"+arr.lastIndex+"\t"+arr+"<br \/>");
		++count;
		if ( count== startLine){
			sidx = arr.index+1;
		}
		if (count >=endLine){
			lidx = arr.index;
			break;
		}
	}
	if ( lidx ==-1){
		lidx = csv.length;
	}
	console.log("part index:",sidx," to ",lidx);
	return ( csv.substring(sidx,lidx));
}

const replacementCharacter = '\ufffd';

function checkMojibake(str){ // 文字化けチェック関数
	var status = true;
	for (var i = 0 ; i < str.length; i++) {
		//console.log(str.charCodeAt(i), str[i]);
		if ( replacementCharacter === str[i] ) {
			status = false;
			break;
	    }
	}
	console.log("isNotMojibake:",status);
	return ( status );
}

async function loadJpMountain(){
	var sw = window.open("mountainCsvBuilder.html", "mountainCsvWindow", "height=650,width=800");
	if ( sw.getCsvData){
		var csv = await sw.getCsvData();
		setTestCsv(csv)
	} else {
		sw.addEventListener("load",async function(){
			console.log("loaded", sw)
			var csv = await sw.getCsvData();
			setTestCsv(csv)
		});
	}
	
}

function showCursorPointLocation(){
	var ta=document.getElementById("csvArea");
	var tv = ta.value;
	var tp = getCursorPos(ta);
	console.log(tp);
	var sp = tp.start;
	if ( tv[sp]=="\n" || tv[sp]=="\r" ){
		sp--;
	}
	
	for ( var cp = sp ; cp >=0 ; cp--){
		if ( tv[cp]=="\n" || tv[cp]=="\r" ){
			break;
		}
	}
	var lineStart = cp;
	for ( var cp = sp ; cp < tv.length ; cp++){
		if ( tv[cp]=="\n" || tv[cp]=="\r" ){
			break;
		}
	}
	var lineEnd = cp;
	var csvLine = tv.substring(lineStart + 1, lineEnd);
//	highlightLine(ta,lineStart+1,lineEnd);
	csvSelectedLine={lineStart,lineEnd}
	console.log(lineStart, lineEnd, csvLine);
	var latC = Number(document.getElementById("latCol").selectedIndex)-1;
	var lngC = Number(document.getElementById("lngCol").selectedIndex)-1;
	csvLine = csvLine.split(",");
	if ( !isNaN(csvLine[latC]) && !isNaN(csvLine[lngC]) && window.opener?.svgMap){
		var lat=Number(csvLine[latC]);
		var lng=Number(csvLine[lngC]);
		window.opener.svgMap.setGeoCenter(lat,lng);
	}
}

var csvSelectedLine={
}

function hilightCsvAreaLine(){
	if ( csvSelectedLine.lineStart){
		var ta=document.getElementById("csvArea");
		highlightLine(ta,csvSelectedLine.lineStart+1,csvSelectedLine.lineEnd);
	}
}

function highlightLine(textAreaElement,  startIndex, endIndex){
	// https://stackoverflow.com/questions/71686548/how-to-change-the-highlight-color-of-selected-text-in-a-textarea-using-selectio
	textAreaElement.setSelectionRange( startIndex, endIndex);
}
function highlightTextLine(focusNode){
	// これはtextareaでは使えないんですよね・・・ preで作ったテキストに対してハイライトさせる
	// ただしcssでこんなのが必要
	// .ediv::highlight(my-highlight) {  background-color: yellow;}
	//
	// https://stackoverflow.com/questions/68278858/is-it-any-way-to-highlight-text-in-textarea
	// https://zenn.dev/cybozu_frontend/articles/css-custom-highlight
	// でその行の色を変えてみたい
	if ( typeof Highlight  == "undefined" ){return}
	var hRange = new Range();
	hRange.setStart(focusNode, 0);
	hRange.setEnd(focusNode, focusNode.data.length);
	const highlight = new Highlight(hRange);
	CSS.highlights.set("my-highlight", highlight);
	console.log(hRange,highlight);
}



// https://stackoverflow.com/questions/7745867/how-do-you-get-the-cursor-position-in-a-textarea
function getCursorPos(input) { // textArea 内のカーソル位置を得る関数
	if ("selectionStart" in input && document.activeElement == input) {
		//console.log("selectionStart");
		return {
			start: input.selectionStart,
			end: input.selectionEnd
		};
	}
	else if (input.createTextRange) {
		//console.log("createTextRange");
		var sel = document.selection.createRange();
		if (sel.parentElement() === input) {
			var rng = input.createTextRange();
			rng.moveToBookmark(sel.getBookmark());
			for (var len = 0;
				rng.compareEndPoints("EndToStart", rng) > 0;
				rng.moveEnd("character", -1)) {
					len++;
				}
			rng.setEndPoint("StartToStart", input.createTextRange());
			for (var pos = { start: 0, end: len };
				rng.compareEndPoints("EndToStart", rng) > 0;
				rng.moveEnd("character", -1)) {
					pos.start++;
					pos.end++;
				}
			return pos;
		}
	}
	return -1;
}

function getNaturalImageSize(dataUri){
	return new Promise(function(okCallback, ngCallback) {
		var orgImg = new Image();
		orgImg.onload=function(){
			okCallback({width:orgImg.naturalWidth,height:orgImg.naturalHeight});
		}
		orgImg.src=dataUri;
	});
}

// https://stackoverflow.com/questions/2303690/resizing-an-image-in-an-html5-canvas
async function thumbnail(base64, maxWidth, maxHeight) {
	
	// Max size for thumbnail
	if(typeof(maxWidth) === 'undefined') var maxWidth = 500;
	if(typeof(maxHeight) === 'undefined') var maxHeight = 500;

	// Create and initialize two canvas
	var canvas = document.createElement("canvas");
	var ctx = canvas.getContext("2d");
	var canvasCopy = document.createElement("canvas");
	var copyContext = canvasCopy.getContext("2d");

	// Create original image
	var img = new Image();
	await new Promise((resolve, reject) => {
		img.onload = () => resolve(img);
		img.onerror = (e) => reject(e);
		img.src = base64;
	})
	
	
	// Determine new ratio based on max size
	var ratio = 1;
	if(img.width > maxWidth)
		ratio = maxWidth / img.width;
	else if(img.height > maxHeight)
		ratio = maxHeight / img.height;

	// Draw original image in second canvas
	canvasCopy.width = img.width;
	canvasCopy.height = img.height;
	copyContext.drawImage(img, 0, 0);

	// Copy and resize second canvas to first canvas
	canvas.width = img.width * ratio;
	canvas.height = img.height * ratio;
	ctx.drawImage(canvasCopy, 0, 0, canvasCopy.width, canvasCopy.height, 0, 0, canvas.width, canvas.height);

	return canvas.toDataURL();

}

const iconSize = {
	width:20,
	height:20
}
function loadLocalImage(event){
	// https://www.html5rocks.com/ja/tutorials/file/dndfiles//
	console.log("loadLocalImage:",event.target.files[0]);
	localBitImageFileName = event.target.files[0].name;
	var fileReader = new FileReader() ;
	fileReader.onload = async function() {
		var dataUri = this.result ;
		var orgSize = await getNaturalImageSize(dataUri);
		if ( orgSize.width > iconSize.width * 2  && orgSize.height > iconSize.height * 2){
			console.log("icon is too large, build shrinked icon image :  original size : ", orgSize);
			dataUri = await thumbnail(dataUri,iconSize.width,iconSize.height);
		}
		console.log("onload file");
		var customImg = document.getElementById("customIconPreview");
		/**
		customBgimg.style.backgroundImage=`url(${dataUri})`; 
		var customCk = document.getElementById("customIconPreview");
		**/
		customImg.setAttribute("src", dataUri);
	}
	var targetFile = event.target.files[0]
	if ( targetFile.type.match('image.*') ){
		fileReader.readAsDataURL( targetFile ) ;
	} else {
		console.log("NOT image file");
	}
}

