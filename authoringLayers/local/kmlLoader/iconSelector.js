// Description:
// アイコンを選択するためのUI
//
// Programmed by Satoru Takagi
//
// License: (MPL v2)
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.
//

var iconsLength = -1;
let iconSetupElement, iconSampleElement, customIconPreviewElement;

function initIconSelection(iconSelectElement, iconSampleDiv, customIconPreviewImgElement, schema,svgImage){
	if ( typeof iconSelectElement != "object" || iconSelectElement.tagName != "SELECT" || typeof iconSampleDiv !="object" || (iconSampleDiv.tagName !="DIV" && iconSampleDiv.tagName !="SPAN") || typeof customIconPreviewImgElement != "object" || customIconPreviewImgElement.tagName !="IMG" ){
		console.error("必要なエレメントが指定されていません : ",  iconSelectElement,  iconSampleDiv );
		return;
	}
	removeChildren(iconSelectElement);
	removeChildren(iconSampleDiv);
	
	/**
	var ci = svgImage.getElementById("customIcon");
	if ( ci ){
		ci.parentElement.removeChild(ci);
	}
	**/
	customIconPreviewElement = customIconPreviewImgElement;
	var defs=svgImage.getElementsByTagName("defs")[0];
	var icons=getChildren(defs, ["customIcon"]);
	iconSampleElement = iconSampleDiv;
	iconSetupElement = iconSelectElement;
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
			iconSampleElement.appendChild(img);
		} else {
			console.log("icon is Not img:",icons[i]);
			var svspan=document.createElement("svg");
			svspan.appendChild(icons[i]);
			iconSampleElement.appendChild(svspan);
		}
		var opt=document.createElement("option");
		opt.value="icon_"+i;
		opt.innerText="No"+i+"⇒";
		iconSetupElement.appendChild(opt);
		
	}
	
	iconSetupElement.insertAdjacentHTML("beforeend",`<option vlaue="customIcon">カスタム</option>`);
	
	if ( schema ){
		for ( var i = 0 ; i < schema.length ; i++ ){
			var opt = document.createElement("option");
			opt.value="schema_"+i;
			opt.innerText=i+":"+schema[i];
			iconSetupElement.appendChild(opt);
		}
	}
	
	setIconSelection();
}

function setIconSelection(){
	var iconIndex = Number(iconSetupElement.selectedIndex);
	var iconSampleChildren = getChildren(iconSampleElement);
	var customIconPreview = customIconPreviewElement;
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

function selectIcon(input) {
	if (!iconSetupElement) return;
	if (typeof input === "string" && input.startsWith("data:")) {
		if (customIconPreviewElement) {
			customIconPreviewElement.setAttribute("src", input);
		}
		iconSetupElement.selectedIndex = iconsLength;
		
	} else if (typeof input === "number" || !isNaN(input)) {
		input = Number(input);
		if (input < 0 || input >= iconSetupElement.options.length) {
			console.warn("アイコン選択範囲外:", input);
			return;
		}
		iconSetupElement.selectedIndex = input;
	} else {
		console.warn("不正な入力値です。数値またはDataURLを指定してください:", input);
		return;
	}
	setIconSelection();
}

const iconSize = {
	width:20,
	height:20
}
function loadLocalImage(event){ // カスタムアイコンをローカルから読み込む
	// https://www.html5rocks.com/ja/tutorials/file/dndfiles//
	console.log("loadLocalImage:",event.target.files[0]);
	const localBitImageFileName = event.target.files[0].name;
	var fileReader = new FileReader() ;
	fileReader.onload = async function() {
		var dataUri = this.result ;
		var orgSize = await getNaturalImageSize(dataUri);
		if ( orgSize.width > iconSize.width * 2  && orgSize.height > iconSize.height * 2){
			console.log("icon is too large, build shrinked icon image :  original size : ", orgSize);
			dataUri = await thumbnail(dataUri,iconSize.width,iconSize.height);
		}
		console.log("onload file");
		var customImg = customIconPreviewElement;
		/**
		customBgimg.style.backgroundImage=`url(${dataUri})`; 
		var customCk = document.getElementById("customIconPreview");
		**/
		customImg.setAttribute("src", dataUri);
		// カスタムアイコンを選択する
		iconSetupElement.selectedIndex = iconsLength;
		setIconSelection();
	}
	var targetFile = event.target.files[0]
	if ( targetFile.type.match('image.*') ){
		fileReader.readAsDataURL( targetFile ) ;
	} else {
		console.log("NOT image file");
	}
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

function getNaturalImageSize(dataUri){
	return new Promise(function(okCallback, ngCallback) {
		var orgImg = new Image();
		orgImg.onload=function(){
			okCallback({width:orgImg.naturalWidth,height:orgImg.naturalHeight});
		}
		orgImg.src=dataUri;
	});
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

function getSelectedIcon(){
	var iconIndex = Number(iconSetupElement.selectedIndex);
	var varIconTh = null;
	var customIconPreview = customIconPreviewElement;
	let ans = {};
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
		ans.varIconTh = varIconTh;
	} // else 通常の場合は、iconIndexにはアイコンの番号を設定する
	ans.iconIndex = iconIndex;
	return ans;
}

const nullPin = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAoAAAAKAQMAAAC3/F3+AAABhGlDQ1BJQ0MgcHJvZmlsZQAAKJF9kT1Iw0AcxV9TtVIqDhYRcchQnSyIijhKFYtgobQVWnUwufQLmjQkKS6OgmvBwY/FqoOLs64OroIg+AHi7OCk6CIl/i8ptIjx4Lgf7+497t4BQqPCVLNrAlA1y0jFY2I2tyoGXiFgED0IQpSYqSfSixl4jq97+Ph6F+VZ3uf+HH1K3mSATySeY7phEW8Qz2xaOud94jArSQrxOfG4QRckfuS67PIb56LDAs8MG5nUPHGYWCx2sNzBrGSoxNPEEUXVKF/Iuqxw3uKsVmqsdU/+wlBeW0lzneYI4lhCAkmIkFFDGRVYiNKqkWIiRfsxD/+w40+SSyZXGYwcC6hCheT4wf/gd7dmYWrSTQrFgO4X2/4YBQK7QLNu29/Htt08AfzPwJXW9lcbwOwn6fW2FjkC+reBi+u2Ju8BlzvA0JMuGZIj+WkKhQLwfkbflAMGboHgmttbax+nD0CGulq+AQ4OgbEiZa97vLu3s7d/z7T6+wFINHKW8FfxtwAAAAZQTFRFZwAAwwD/Dn1BuQAAAAF0Uk5TAEDm2GYAAAABYktHRACIBR1IAAAACXBIWXMAAC4jAAAuIwF4pT92AAAAB3RJTUUH6AIWBg8siLxk8gAAABl0RVh0Q29tbWVudABDcmVhdGVkIHdpdGggR0lNUFeBDhcAAAAXSURBVAjXY5BjYKhvAKH/BxAIIiLHAACoxAs1dqDiZwAAAABJRU5ErkJggg==";

export {setIconSelection, initIconSelection, loadLocalImage, getSelectedIcon,selectIcon};