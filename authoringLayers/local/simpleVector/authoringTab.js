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
	aToolDiv = document.getElementById("genericToolDiv");
	initGenericAuthoringUI();
});

var authoringToolProps;
function initGenericAuthoringUI(){
	console.log("initGenericAuthoringUI");
	try{
		svgMapAuthoringTool.clearTools();
	}catch(e){}
	authoringToolProps = svgMapAuthoringTool.initGenericTool(aToolDiv,layerID,testAuthToolsCB,"PARAM_GEN",{withBufferedTools:true});
}


function testAuthToolsCB(stat,param){
	console.log("called testAuthToolsCB:",stat,param);
}

