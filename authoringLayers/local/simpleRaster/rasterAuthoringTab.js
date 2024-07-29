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

