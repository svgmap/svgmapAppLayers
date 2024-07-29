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

