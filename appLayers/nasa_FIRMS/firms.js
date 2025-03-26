// NASA FIRMS (リモートセンシングによる火災マップ)レイヤー
//  Programmed by Satoru Takagi
//  
//  Copyright (C) 2025 by Satoru Takagi @ KDDI CORPORATION

// License:
//  This program is free software: you can redistribute it and/or modify
//  it under the terms of the GNU General Public License version 3 as
//  published by the Free Software Foundation.
//
//  This program is distributed in the hope that it will be useful,
//  but WITHOUT ANY WARRANTY; without even the implied warranty of
//  MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
//  GNU General Public License for more details.
//
//  You should have received a copy of the GNU General Public License
//  along with this program.  If not, see (http://www.gnu.org/licenses/) .
//
// History: 
// 2025/02/27 : initial　基本的な表示機能
// 2025/03/03 : いくつかの表示オプションを設定可能にした

const basicURL="https://firms.modaps.eosdis.nasa.gov/mapserver/wmts/";

let timeSpan ="24hrs";
let scale ="fires";

onload=function(){
	addEventListener("zoomPanMap",zpmFunc);
	changeScaleSelect.addEventListener("change",scaleSel);
	changeTimeSpanSelect.addEventListener("change",tsSel);
	fromDatePicker.addEventListener("change",customSpanSel);
	toDatePicker.addEventListener("change",customSpanSel);
	zpmFunc();
}

function tsSel(){
	console.log(changeTimeSpanSelect.options[changeTimeSpanSelect.selectedIndex].value);
	switch(changeTimeSpanSelect.options[changeTimeSpanSelect.selectedIndex].value){
	case "today":
		customSpan.style.display="none";
		timeSpan = "today";
		break;
	case "24hrs":
		customSpan.style.display="none";
		timeSpan = "24hrs";
		break;
	case "7days":
		customSpan.style.display="none";
		timeSpan = "7days";
		break;
	case "custom":
		customSpan.style.display="";
		setDefaultCustomSpan();
		break;
	}
	clearAllTiles();
	zpmFunc();
}

function customSpanSel(event){
	trimDate(event.target);
	const csStr = getCustomSpanStr();
	console.log("customSpanSel:",csStr);
	timeSpan = csStr;
	clearAllTiles();
	zpmFunc();
}

function trimDate(targetElm){
	const today = new Date();
	//console.log("trimDate:",new Date(targetElm.value) , today);
	if (new Date(targetElm.value) > today){
		targetElm.value = today.toISOString().split('T')[0]; 
	}
}

function getCustomSpanStr(){
	let ans;
	if ( new Date(fromDatePicker.value) > new Date(toDatePicker.value)){
		ans = `${toDatePicker.value},${fromDatePicker.value}`;
	} else {
		ans = `${fromDatePicker.value},${toDatePicker.value}`;
	}
	return ans;
}

function setDefaultCustomSpan(){
	const today = new Date();
	const sevenDaysAgo = new Date(today);
	sevenDaysAgo.setDate(today.getDate() - 7);
	console.log(today,sevenDaysAgo);
	fromDatePicker.value = sevenDaysAgo.toISOString().split('T')[0]; 
	toDatePicker.value = today.toISOString().split('T')[0]; 
	console.log("setDefaultCustomSpan:",fromDatePicker.value, toDatePicker.value);
	timeSpan = getCustomSpanStr();
}

function scaleSel(){
	console.log(changeScaleSelect.options[changeScaleSelect.selectedIndex].value);
	switch(changeScaleSelect.options[changeScaleSelect.selectedIndex].value){
	case "simple":
		fire_basic_fires_legend.style.display="";
		clk_legend_hourly.style.display="none";
		clk_legend_daily.style.display="none";
		scale = "fires";
		break;
	case "timeH":
		fire_basic_fires_legend.style.display="none";
		clk_legend_hourly.style.display="";
		clk_legend_daily.style.display="none";
		scale = "time_since_detection_6";
		break;
	case "timeD":
		fire_basic_fires_legend.style.display="none";
		clk_legend_hourly.style.display="none";
		clk_legend_daily.style.display="";
		scale = "days_since_detection_6";
		break;
	}
	clearAllTiles();
	zpmFunc();
}

function clearAllTiles(){
	var tiles = svgImage.getElementsByTagName("image");
	for ( var i = tiles.length -1 ; i >=0 ; i-- ){
		let tile = tiles[i];
		tile.remove();
	}
}

function zpmFunc(){
	var level = Math.floor( Math.LOG2E * Math.log(svgImageProps.scale) + 6.5);
	if ( level < 2){level=2}
	if ( level > 13){level=13}
	var ts = getTileSet(svgImageProps.geoViewBox, level);
	console.log(ts);
	removeUnusedTiles(ts.tiles,ts.slevel);
	
	for ( var tileKey of ts.tiles){
		drawTile(tileKey, ts.slevel, ts.size);
	}
	svgMap.refreshScreen();
}

function removeUnusedTiles(tks,lvl){
	var tiles = svgImage.getElementsByTagName("image");
	var keys=[];
	for ( var tk of tks){
		var tid = `t_${lvl}_${tk[0]}_${tk[1]}`;
		keys.push(tid);
	}
	for ( var i = tiles.length -1 ; i >=0 ; i-- ){
		let tile = tiles[i];
		tid = tile.getAttribute("id");
		if ( tid.indexOf(keys)>=0){
		} else {
			console.log("remove:",tid);
			tile.remove();
		}
	}
}

function drawTile(tk,lvl,size){
	var tid = `t_${lvl}_${tk[0]}_${tk[1]}`;
	if ( svgImage.getElementById(tid)){
		return;
	}
	var cl = svgImage.createElement("image");
	cl.setAttribute("x" , (tk[0]*size-180)*100 );
	cl.setAttribute("y" , -(90-tk[1]*size)*100 );
	cl.setAttribute("width" , size*100);
	cl.setAttribute("height" , size*100);
	cl.setAttribute("id",tid);
	cl.setAttribute("xlink:href" , `${basicURL}${scale}/${timeSpan}/${lvl}/${tk[1]}/${tk[0]}`);
	svgImage.documentElement.appendChild(cl);
	console.log(cl);
//	cl.setAttribute("metadata" , tileURL.Key);
}

function getTileSet(vb,level){
	var bl= getTileCrds(vb.x,vb.y,level);
	var tr= getTileCrds(vb.x+vb.width,vb.y+vb.height,level);
	console.log(bl,tr,level);
	var tiles = [];
	var size = bl.size;
	var slevel = bl.slevel;
	for ( var tx = Math.min(bl.tx,tr.tx) ; tx <= Math.max(bl.tx,tr.tx); tx++){
		for ( var ty = Math.min(bl.sty,tr.sty) ; ty <= Math.max(bl.sty,tr.sty); ty++){
			tiles.push([tx,ty]);
		}
	}
	return {tiles,slevel,size};
}


function getTileCrds( x, y, level, getIntTileCrds ){
	//座標pos.x,yのタイル番号、およびタイル内での相対座標
	x = x + 180;
	y = -y + 180;
	var div = 360 / Math.pow(2,level);

	if ( getIntTileCrds ){
		var ix = (x % div)/div;
		var iy = (y % div)/div;
		return {
			ix:ix,iy:iy,
			size:div,
		}
	} else {
		var tx = Math.floor(x / div);
		var ty = Math.floor(y / div);
		var sty = ty - Math.floor(Math.pow(2,level)/4);
		return {
			tx:tx,ty:ty,sty:sty,slevel:level-1,
			size:div,
		}
	}
}
