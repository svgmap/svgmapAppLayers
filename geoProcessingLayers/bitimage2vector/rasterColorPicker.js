// rasterColorPicker: svgMap.jsの指定のビットイメージレイヤーの指定ポイントの色をピックアップする
// Programmed by Satoru Takagi
// License : GPL3
//
// 2021/12 rasterGISから独立・ライブラリ化
// 


( function ( window , undefined ) { 
	var document = window.document;
	var navigator = window.navigator;
	var location = window.location;
	
	rasterColorPicker = ( function(){ 
		var pickerResultDiv, sourceCoverId;
		var pickerSymbolId = "syl0";
		var pickerIconId = "colorPickIcon";
		var authoringToolProps;
		var alsoTargetsVectorCoverage = false;
		var svgImagesProps;
		var skipClearPoints = false;
		
		function initColorPicker(pickerUiDivId,pickerResultDivId){
			var pickerUiDiv;
			preparePickerIcon();
			if ( ! pickerResultDivId){
				var pickerParent = document.getElementById(pickerUiDivId);
				pickerUiDiv = document.createElement("div");
				pickerResultDiv = document.createElement("div");
				
				pickerParent.appendChild(pickerUiDiv);
				pickerParent.appendChild(pickerResultDiv);
			} else {
				pickerUiDiv = document.getElementById(pickerUiDivId);
				pickerResultDiv = document.getElementById(pickerResultDivId)
			}
			authoringToolProps = svgMapAuthoringTool.initPOIregistTool(
				pickerUiDiv,
				layerID,
				pickerIconId,
				pickerSymbolId,
				"colorPoint",
				"",
				pickColorUiCbf,
				null,
				true
			);
		}
		
		function setOption(options){
			if (options?.alsoTargetsVectorCoverage==true){
				alsoTargetsVectorCoverage =true;
			} else {
				alsoTargetsVectorCoverage =false;
			}
		}
		
		function setPickTargetLayerId(layerId){
			sourceCoverId = layerId;
		}
		
		function pickColorUiCbf( stat ){
			console.log("pickColorUiCbf:",stat);
			if ( stat != "Cancel"){
				pickColors();
			}
		}

		function pickColors(){
			if ( skipClearPoints==true){
			} else {
				clearCircles();
			}
			/** これどうしようか・・・
			stopContSearch();
			**/
			//sourceCoverId = getTargetLayerId("targetCoverLayer");
			console.log("pickColors:",layerID, sourceCoverId);
			if ( alsoTargetsVectorCoverage ){
				backupSourceCoverClickableAndDisableHighlight(sourceCoverId);
				svgMap.captureGISgeometriesOption(true,null,false,true);
			}
			svgMapGIStool.getInRangePoints( layerID, sourceCoverId , null, pickColorsPh2 , null , progrssCallback );
		}
		function progrssCallback(pg){
			console.log("colorPicker progrssCallback:",pg);
		}

		var targetRange = []; // H値を入れる。 [[30,36],[10,20]]みたいな感じ

		function pickColorsPh2(ans){
			console.log("pickColorsPh2:",ans);
			svgImagesProps = svgMap.getSvgImagesProps();
			if ( alsoTargetsVectorCoverage ){
				restoreSourceCoverClickable(sourceCoverId);
				svgMap.captureGISgeometriesOption(true,null,false,false);
			}
			clearElementsByTagName("use");
			console.log("complete pickColors... ",ans);
			for ( var i = 0 ; i < ans.length ; i++ ){
				var r = ("0" + ans[i].hsv.r.toString(16)).slice(-2);
				var g = ("0" + ans[i].hsv.g.toString(16)).slice(-2);
				var b = ("0" + ans[i].hsv.b.toString(16)).slice(-2);
				var span = document.createElement("span");
				span.innerHTML="&nbsp;&nbsp;";
				span.style.backgroundColor="#"+r+g+b;
				console.log(pickerResultDiv,span);
				pickerResultDiv.appendChild(span);
				var cRange = [ans[i].hsv.h - 5, ans[i].hsv.h + 5];
				targetRange.push(cRange);
			}
			console.log(targetRange);
		}

		function clearPickColors(){
			if ( skipClearPoints==true){
			} else {
				clearCircles();
			}
			/**
			stopContSearch();
			svgMap.refreshScreen();
			**/
			targetRange = [];
			pickerResultDiv.innerHTML="&nbsp;";
			//document.getElementById("ansArea").value="";
		}

		function clearElementsByTagName(tagName){
			var svgDoc = svgImage
			var svgImageRoot = svgDoc.documentElement;
			var circles = svgDoc.getElementsByTagName(tagName);
			for ( var i = circles.length - 1 ; i >= 0 ; i-- ){
				circles[i].parentNode.removeChild(circles[i]);
			}
		}
		
		function clearCircles(){
			var docChild=svgImage.documentElement.children;
			for ( var i = docChild.length -1 ; i >=0 ; i-- ){
				var ce = docChild[i];
				if (ce.nodeName=="defs" || ce.nodeName=="globalCoordinateSystem" || ce.nodeName=="metadata" || ce.getAttribute("id")==pickerIconId){
					console.log("stay:",ce);
				} else {
					ce.parentElement.removeChild(ce);
				}
			}
		}
		
		function preparePickerIcon(){
			var defs= svgImage.getElementsByTagName("defs")[0];
			var symbol = svgImage.getElementById(pickerSymbolId);
			//ちょっと雑だが・・
			if (!defs){
				defs = svgImage.createElement("defs");
				svgImage.documentElement.appendChild(defs);
			}
			if(!symbol){
				symbol = svgImage.createElement("circle");
				symbol.setAttribute("cx",0);
				symbol.setAttribute("cy",0);
				symbol.setAttribute("r",4);
				symbol.setAttribute("fill","blue");
				symbol.setAttribute("id",pickerSymbolId);
				defs.appendChild(symbol);
			}
		}
		
		var sourceCoverClickableBackup;
		function backupSourceCoverClickableAndDisableHighlight(sourceCoverId){
			svgImagesProps = svgMap.getSvgImagesProps();
			if ( svgImagesProps[sourceCoverId].isClickable){
				// オリジナルをバックアップしたうえで、ハイライトのスタイルを無くする
				sourceCoverClickableBackup = structuredClone(svgImagesProps[sourceCoverId].isClickable);
				svgImagesProps[sourceCoverId].isClickable={hilightFillStyle:{}};
			} else {
				sourceCoverClickableBackup = null;
			}
		}

		function restoreSourceCoverClickable(sourceCoverId){
			if ( sourceCoverClickableBackup){
				svgImagesProps[sourceCoverId].isClickable=sourceCoverClickableBackup;
				sourceCoverClickableBackup = null;
			}
		}
		
		function setSkipClearPointsFlag(val){
			skipClearPoints = val;
		}
		
		return { // rasterPoiGis. で公開する関数のリスト
			clearPickColors: clearPickColors,
			initColorPicker: initColorPicker,
			getTargetRange: function(){
				return (targetRange);
			},
			setOption: setOption,
			setPickTargetLayerId: setPickTargetLayerId,
			setSkipClearPointsFlag: setSkipClearPointsFlag,
		}

	})();

	window.rasterColorPicker = rasterColorPicker;
	
})( window );

