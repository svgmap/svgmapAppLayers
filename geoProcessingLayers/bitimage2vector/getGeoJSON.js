function captureGISgeometries(){
	return new Promise(function(okCB){
		svgMap.captureGISgeometries(okCB);
	});
}

async function getGeoJSON(layerID){
	var allGeom=await captureGISgeometries();
	var targetGeom = allGeom[layerID];
	//console.log(allGeom,layerID,targetGeom);
	if (!targetGeom){
		console.warn("No target geomerty: layerID:",layerID);
		return null
	}
	var ans = {
		type:"FeatureCollection",
		features:[]
	}
	for ( var geom of targetGeom){
		if ( geom.type && geom.coordinates ){
			var ft ={
				type:geom.type,
				coordinates:geom.coordinates
			}
			if ( geom.properties){
				ft.properties = geom.properties;
			}
			ans.features.push(ft);
		}
	}
	return ans;
}

function saveText(txt,fileName ){
	// https://norm-nois.com/blog/archives/5502
	if (!fileName){
		fileName = "output.csv";
	}
	var blob = new Blob([txt],{type:"text/csv"});
	
	// <a id="downloadAnchor" style="display:none"></a> 想定
	var dla=document.getElementById("downloadAnchor");
	if (!dla){
		dla = document.createElement("a");
		dla.setAttribute("id","downloadAnchor");
		dla.style.display="none";
		document.documentElement.appendChild(dla);
	}
	dla.href = window.URL.createObjectURL(blob);
	dla.setAttribute("download",fileName);
	dla.click();
}


export { getGeoJSON , saveText}