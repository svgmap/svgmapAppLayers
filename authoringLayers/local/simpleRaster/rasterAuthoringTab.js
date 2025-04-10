// Description: raster authoring tab 
//
// Programmed by Satoru Takagi
// 
// License: (MPL v2)
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.
//

var aToolDiv;
addEventListener("load",function(){
	aToolDiv = document.getElementById("freeHandToolDiv");
	initFreeHandAuthoringUI();
});

var authoringToolProps;
function initFreeHandAuthoringUI(){
	console.log("initGenericAuthoringUI");
	try{
		svgMapAuthoringTool.clearTools();
	}catch(e){}
	authoringToolProps = svgMapAuthoringTool.initFreeHandTool(aToolDiv,layerID,testAuthToolsCB,"PARAM_GEN",{});
}


function testAuthToolsCB(stat,param){
	console.log("called testAuthToolsCB:",stat,param);
}

