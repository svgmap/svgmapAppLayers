// layerLister: svgMap.jsの自分のレイヤー以外のレイヤーを指定したselect要素2個にリストアップする
// Programmed by Satoru Takagi
// License : GPL3
//
// 2021/12/22 rasterGISから独立・ライブラリ化
// 2022/06/17 listVisibleLayers debug

//   layerLister.listVisiblePoiCoverLayers("targetPoiLayer","targetCoverLayer");
//   document.addEventListener("screenRefreshed", layerLister.listVisiblePoiCoverLayers , false);
//
// set custom items
//	var customItems=[
//		{title:"4次メッシュ陸部",value:"int*m4*land"},
//		{title:"4次メッシュ",value:"int*m4"},
//		{title:"3次メッシュ陸部",value:"int*m3*land"},
//		{title:"3次メッシュ"],value:"int*m3"}
//	];
//   layerLister.listVisiblePoiCoverLayers("targetPoiLayer","targetCoverLayer",customItems);



( function ( window , undefined ) { 
	var document = window.document;
	var navigator = window.navigator;
	var location = window.location;

	layerLister = ( function(){ 

		function getTargetLayerId(seledtTagId){
			var sel = document.getElementById(seledtTagId);
			var layerTitle = sel.options[sel.selectedIndex].value;
			if ( customItemsValDict[layerTitle]){
				return( layerTitle);
			}else{
				if ( layerTitle ){
					return( svgMap.getLayerId(layerTitle));
				} else {
					sel.selectedIndex==1; // これはポリゴンの自分のレイヤーで編集してるとき
					return (layerID);
				}
			}
		}

		function getTargetLayers(excludeSelf,excludedNames){
			var targetLayers=[];
			var rlr = svgMap.getRootLayersProps();
			for ( var i = rlr.length - 1 ; i >= 0 ; i-- ){
				var lr = rlr[i];
				if (lr.visible){
					if ( excludeSelf && lr.id == layerID){
						// skip
					} else if ( excludedNames && excludedNames.indexOf(lr.title)>=0){
						// skip
					} else {
						targetLayers.push(lr.title);
					}
				}
			}
			return ( targetLayers );
		}
		
		var prevTargetLayers=[];
		var targetSelId1, targetSelId2;
		var customItems_int=[];
		var customItemsValDict={};
		function listVisiblePoiCoverLayers(targetSelectId1, targetSelectId2, customItems){
			if ( typeof(targetSelectId1)=="string" && typeof(targetSelectId2)=="string" ){
				targetSelId1 = targetSelectId1;
				targetSelId2 = targetSelectId2;
				if ( customItems ){
					customItems_int = customItems;
				}
			}
			
			
			var targetLayers=getTargetLayers(true);
			/**
			var targetLayers=[];
			var layers = svgMap.getLayers();
			for ( var i = layers.length -1  ; i >=0 ; i-- ){
				if ( layers[i].getAttribute("visibility")!="hidden" && layers[i].getAttribute("iid")!=layerID){
					var lTitle = layers[i].getAttribute("title");
		//			console.log(lTitle);
					targetLayers.push(lTitle);
				}
			}
			**/
			
			// check changed
		//	console.log("targetLayers:",targetLayers);
			var changed = false;
			if ( prevTargetLayers.length != targetLayers.length ){
				changed = true;
			} else {
				for ( var i = 0 ; i < prevTargetLayers ; i++ ){
					if ( prevTargetLayers[i] != targetLayers[i]){
						changed = true;
						break;
					}
				}
			}
			
			if ( changed ){
				var l = listVisibleLayers(targetSelId1,targetLayers,null,getCustomItems(),true);
				listVisibleLayers(targetSelId2,targetLayers,l);
			}
			prevTargetLayers = targetLayers;
		}
		
		var excludeLayerNameArray_int;
		function listTargetLayers(targetSelectId1,excludeLayerNameArray){
			if ( typeof(targetSelectId1)=="string" ){
				targetSelId1 = targetSelectId1;
			}
			if ( Array.isArray(excludeLayerNameArray)){ 
				excludeLayerNameArray_int = excludeLayerNameArray;
			}
			var targetLayers=getTargetLayers(true,excludeLayerNameArray_int);
			var changed = false;
			if ( prevTargetLayers.length != targetLayers.length ){
				changed = true;
			} else {
				for ( var i = 0 ; i < prevTargetLayers ; i++ ){
					if ( prevTargetLayers[i] != targetLayers[i]){
						changed = true;
						break;
					}
				}
			}
			
			if ( changed ){
				 listVisibleLayers(targetSelId1,targetLayers,null);
			}
		}

		function listVisibleLayers(selectId,targetLayers,selectedLayerName,customItems,excludeCustomSel){
			//console.log("called listVisibleLayers ",selectedLayerName," =====  targetLayers:",targetLayers);
			if ( !selectId){return}
			targetList = document.getElementById(selectId);
			var selName ="";
			if ( targetList.options.length > 0 ){
				selName = targetList.options[targetList.selectedIndex].value;
			}
			
			//console.log("listVisibleLayers: selName : ",selName);
			removeChildren(targetList);
			
			var Kasuga2201=0;
			var firstLayerIndex = 0;
			if ( customItems ){
				for ( var ci of customItems ){
					targetList.appendChild(ci);
					++firstLayerIndex;
				}
			}
			for ( var i = 0 ; i < targetLayers.length ; i++ ){
				var opt = document.createElement("option");
				var lTitle = targetLayers[i];
				opt.setAttribute("value",lTitle);
				opt.innerHTML=lTitle;
				targetList.appendChild(opt);
			}
			var alreadySelected=false;
			for ( var i = 0 ; i < targetList.options.length ; i++ ){
				var opt = targetList.options[i];
				var lTitle = opt.getAttribute("value");
				//console.log( "ck:",selName,lTitle,selName==lTitle);
				if ( selName && lTitle == selName ){
					opt.selected = true;
					alreadySelected = true;
					break;
				}
				if ( !alreadySelected && (!selectedLayerName || (selectedLayerName && lTitle != selectedLayerName)) ){
					if ( (excludeCustomSel && i>=firstLayerIndex) || (!excludeCustomSel)){
						opt.selected = true;
						alreadySelected = true;
					}
				}
			}
			if (!alreadySelected){
				selName = targetList.options[0].value;
				targetList.options[0].selected = true;
			} else {
				selName = targetList.options[targetList.selectedIndex].value;
			}
			//console.log("listVisibleLayers:",selName);
			return ( selName );
		}
		
		function getCustomItems(){
			var ret =[];
			customItemsValDict={};
			for ( var i = 0 ; i < customItems_int.length ; i++ ){
				var opt = document.createElement("option");
				opt.value=customItems_int[i].value;
				opt.innerText=customItems_int[i].title;
				ret.push(opt);
				customItemsValDict[customItems_int[i].value]=true;
			}
			return ( ret );
		}
		
		function removeChildren( parent ){
			for (var i =parent.childNodes.length-1; i>=0; i--) {
				parent.removeChild(parent.childNodes[i]);
			}
		}
		
		return {
			getTargetLayerId,
			listVisiblePoiCoverLayers,
			listTargetLayers
		}
	})();

	window.layerLister = layerLister;

})( window );