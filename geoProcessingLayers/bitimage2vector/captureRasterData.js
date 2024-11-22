async function captureRasterData(targetLayerID,options){
	if ( !targetLayerID && options.targetLayerID){
		console.warn("You should set targetLayerID");
	}
	if ( !options){
		options ={};
	}
	options.targetLayerID = targetLayerID;
	
	var cGeom = await captureCoverageGeometry(options);
	console.log(cGeom);
	var ans = await processCapturedGeom(cGeom,options);
	return ans;
}

async function processCapturedGeom(geom,options) {
	var svgImagesProps = svgMap.getSvgImagesProps();
	var targetCoverages = [];
	for (var layerId in geom) {
		if (svgImagesProps[layerId].rootLayer == options.targetLayerID) {
			for (var i = 0; i < geom[layerId].length; i++) {
				if (geom[layerId][i].type == "Coverage") {
					targetCoverages.push(geom[layerId][i]);
				}
			}
		}
	}
	
	var sipd =[];
	for ( var targetCoverage of targetCoverages){
		if (targetCoverage && targetCoverage.href) {
			sipd.push(registImagePixelData(targetCoverage));
//			targetCoverage.imageData = await getImagePixelData(targetCoverage);
		}
	}
	await Promise.all(sipd);
	console.log("targetCoverages:",targetCoverages);
	return targetCoverages
}

async function registImagePixelData(targetCoverage){
	targetCoverage.imageData = await getImagePixelData(targetCoverage);
}

function getImagePixelData(svgMapGisGeometry,extParam){
	return new Promise(function(okCB){
		svgMapGIStool.getImagePixelData(
			svgMapGisGeometry,
			function(data,width,height,params){
				const ans = {data,width,height};
				if ( params ){
					ans.params = params;
				}
				//console.log("getImagePixelData:",ans);
				okCB(ans);
			},
			extParam
		); // okCB(pixData,w,h,extParam)
	});
}

function captureCoverageGeometry(options){
	return new Promise(function(okCB){
		svgMap.captureGISgeometriesOption(true); // カバレッジが必要
		svgMap.captureGISgeometries(okCB,options);
	});
}
	
export {captureRasterData};