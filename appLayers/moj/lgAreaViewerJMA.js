var fill = "green";
var stroke="pink";
var strokeWidthPx=1.5;

async function initLgArea(showData, fillColor, strokeColor, strokeWidth){
	if ( fillColor ){
		fill = fillColor;
	}
	if ( strokeColor ){
		stroke = strokeColor;
	}
	if ( strokeWidth ){
		strokeWidthPx = strokeWidth;
	}
	var jsons = await getLgShapes();
	console.log(jsons);
	if ( typeof svgMapGIStool == "object"){
		var tileContElement=svgImage.getElementById("areas");
		svgMapGIStool.drawGeoJson(jsons,layerID,"blue",1,"green", "p0", "poi", "", tileContElement, ["name","code","enNane"]);
		if (showData){
			svgMap.refreshScreen();
		}
	}
}

async function getLgShapes(){
	var jsonPromises=[];
	for ( var i = 0 ; i < 10 ; i++ ){
		jsonPromises.push(getJson(`https://www.jma.go.jp/bosai/common/const/geojson/landslides_${i}.json`));
	}
	var jsons =await Promise.all(jsonPromises);
	var ans = {
		type: "FeatureCollection",
		features: [],
		properties:{"stroke-width":strokeWidthPx, fill:fill, stroke:stroke}
	}
	for ( var js of jsons){
		ans.features = ans.features.concat(js.features);
	}
	return ( ans );
}

async function getJson(url){
	var req = await fetch(url);
	var json = await req.json();
	return ( json );
}

export {initLgArea}