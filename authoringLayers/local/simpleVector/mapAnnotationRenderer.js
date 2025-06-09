// Description:
// 地図上のグラフィックスオブジェクトにアノテーションを設置する
// Programmed by Satoru Takagi
// 
// License: (MPL v2)
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.

import {SvgStyleEditor} from "./SvgStyleEditor.js";

var annotationShowing = false;
var annotationCheckbox;
let annotationG;

function initAnnotation(toAppendAnnotationGroup) {
	console.log("initAnnotation:",toAppendAnnotationGroup);
	
	if ( !annotationCheckbox ){
		annotationCheckbox = document.getElementById("annotationCheckbox");
		annotationCheckbox.addEventListener("click", setAnnotation);
	}
	
	if ( toAppendAnnotationGroup){
		annotationCheckbox.checked=false;
		if ( toAppendAnnotationGroup.children?.length>0){
			// 面倒なので手抜きする(インポートしないで(再構築で)いいや・・・・)
			var ae = toAppendAnnotationGroup.children[0];
			if ( ae.tagName.toLowerCase() =="text"){
				// スタイルだけは継承させる・・
				annotationStyle.fill = ae.getAttribute("fill");
				annotationStyle.fontSize = ae.getAttribute("font-size");
				annotationCheckbox.checked=true;
			}
			console.log("ae:",ae, ae.tagName,"  ck:",annotationCheckbox.checked);
		}
		setAnnotation({target:annotationCheckbox});
		console.log("toAppendAnnotationGroup.ch.len:", toAppendAnnotationGroup.children?.length);
	}
	console.log("initAnnotation:", annotationCheckbox);
}

function annotationCallback(stat, param) {
	console.log("annotationCallback:", stat, param);
	setAnnotation({ target: annotationCheckbox });
}

function setAnnotation(event) {
	console.log("setAnnotation  SvgStyleEditor:",SvgStyleEditor,"  event.target.checked:",event.target.checked);
	if (event.target.checked) {
		annotationShowing = true;
		renderAnnotation();
		if ( SvgStyleEditor ){
			setStyleButton(true, event.target);
		}
	} else {
		if (annotationShowing == true) {
			removeAnnotation();
			svgMap.refreshScreen();
		}
		annotationShowing = false;
		if ( SvgStyleEditor ){
			setStyleButton(false, event.target);
		}
	}
	console.log("setAnnotation: annotationShowing: ", annotationShowing);
}

const annotationStyleButtonID = "annotationStyleButton";

let svgStyleEditor;
function setStyleButton(visible, bneforeElement){
	console.log("setStyleButton: bneforeElement:",bneforeElement," visible:",visible);
	var annotationStyleButton = document.getElementById(annotationStyleButtonID);
	if ( !annotationStyleButton){
		annotationStyleButton = document.createElement("input");
		annotationStyleButton.id = annotationStyleButtonID;
		annotationStyleButton.setAttribute("type","button");
		annotationStyleButton.setAttribute("value","スタイル設定");
		bneforeElement.parentElement.appendChild(annotationStyleButton);
		annotationStyleButton.addEventListener("click",showStyleEditor);
		svgStyleEditor = new SvgStyleEditor();
	}
	if ( visible ){
		annotationStyleButton.style.display="";
	} else {
		annotationStyleButton.style.display="none";
	}
}

function showStyleEditor(event){
	console.log("showStyleEditor :",event.target);
	var svgElm = svgImage.createElement("text");
	svgElm.setAttribute("fill",annotationStyle.fill);
	svgElm.setAttribute("font-size", annotationStyle.fontSize);
	var div = document.createElement("div");
	svgStyleEditor.createStyleEditor(svgElm,div,{fontStyle:false});
	svgMap.setCustomModal(
		div,
		["Set", "Cancel"],
		setStyle,
		{
//			targetDoc: document,
			svgElm: svgElm,
//			poiDoc: poiDoc
		},
		{position:event.target}
	);
}

function setStyle(index, opt){
	console.log("setStyle:",index,opt);
	annotationStyle.fontSize = opt.svgElm.getAttribute("font-size");
	annotationStyle.fontWeight = opt.svgElm.getAttribute("font-weight");
	annotationStyle.fontStyle= opt.svgElm.getAttribute("font-style");
	annotationStyle.fill = opt.svgElm.getAttribute("fill");
	console.log("annotationStyle:",annotationStyle);
	renderAnnotation();
}

function renderAnnotation() {
	removeAnnotation();
	setPointAnnotations();
	setPathAnnotations();
	svgMap.refreshScreen();
}


const annotationStyle={
	fontSize: 14,
	fill: "red",
	fontWeight:"", // TBD
	fontStyle:"" // TBD
}

function setPointAnnotations() {
	var uses = svgImage.getElementsByTagName("use");
	for (var use of uses) {
		var tf = use.getAttribute("transform");
		var title = use.getAttribute("xlink:title");
		var txtE = svgImage.createElement("text");
		txtE.setAttribute("transform", tf);
		txtE.setAttribute("x", 5);
		txtE.setAttribute("y", -5);
		txtE.setAttribute("fill", annotationStyle.fill);
		txtE.setAttribute("font-size", ((annotationStyle.fontSize+"").replace("px","")).trim());
		txtE.textContent = title;
		annotationG.appendChild(txtE);
	}
}

function setPathAnnotations() {
	var paths = svgImage.getElementsByTagName("path");
	for (var path of paths) {
		if (path.parentElement.tagName == "svg") {
			// svg要素の直下のみ・・・
			var polyD = path
				.getAttribute("d")
				.replaceAll(/[MLzZ,]/g, " ")
				.split(" ");
			var cs = [];
			for (var c of polyD) {
				if (c != "") {
					cs.push(Number(c));
				}
			}
			console.log(cs);
			if (cs.length % 2 == 0) {
				var crds = [];
				for (var i = 0; i < cs.length / 2; i++) {
					crds.push([cs[i * 2], cs[i * 2 + 1]]);
				}
				var cent;
				if ( path.getAttribute("fill")=="none"){
					cent = getPolylineMidpoint(crds);
				} else {
					cent = calculateCentroid(crds);
				}
				console.log(crds, cent);

				var title = path.getAttribute("xlink:title");
				var txtE = svgImage.createElement("text");
				var tf = `ref(svg,${cent[0]},${cent[1]})`;
				txtE.setAttribute("transform", tf);
				//				txtE.setAttribute("x", 5);
				//				txtE.setAttribute("y", -5);
				txtE.setAttribute("fill", annotationStyle.fill);
				txtE.setAttribute("font-size", ((annotationStyle.fontSize+"").replace("px","")).trim());
				txtE.textContent = title;
				annotationG.appendChild(txtE);
			}
		}
		/**
		var tf = use.getAttribute("transform");
		var title = use.getAttribute("xlink:title");
		var txtE = svgImage.createElement("text");
		txtE.setAttribute("transform", tf);
		txtE.setAttribute("x", 5);
		txtE.setAttribute("y", -5);
		txtE.setAttribute("fill", "red");
		txtE.setAttribute("font-size", "14");
		txtE.textContent = title;
		annotationG.appendChild(txtE);
		**/
	}
}

function removeAnnotation() {
	var annotationGs = svgImage.querySelectorAll('[id="annotations"]'); // 無駄なことやってるか？
	console.log("removeAnnotation:",annotationGs);
	for ( var i = annotationGs.length-1 ; i>=0 ; i--){
		annotationGs[i].remove();
	}
	annotationG = svgImage.createElement("g");
	annotationG.setAttribute("id","annotations");
	svgImage.documentElement.appendChild(annotationG);
	//removeChildren(annotationG);
}

function removeChildren(parent) {
	while (parent.firstChild) {
		parent.removeChild(parent.firstChild);
	}
}

function calculateCentroid(polygon) {
	let xSum = 0,
		ySum = 0,
		areaSum = 0;
	const x0 = polygon[0][0];
	const y0 = polygon[0][1];
	for (let i = 0; i < polygon.length; i++) {
		let x1 = polygon[i][0] - x0;
		let y1 = polygon[i][1] - y0;
		let x2 = polygon[(i + 1) % polygon.length][0] - x0;
		let y2 = polygon[(i + 1) % polygon.length][1] - y0;
		let crossProduct = x1 * y2 - x2 * y1;
		xSum += (x1 + x2) * crossProduct;
		ySum += (y1 + y2) * crossProduct;
		areaSum += crossProduct;
	}
	let area = areaSum / 2;
	let centroidX = xSum / (6 * area);
	let centroidY = ySum / (6 * area);
	return [centroidX + x0, centroidY + y0];
}

function getPolylineMidpoint(polyline) {
	if (polyline.length < 2) return null;

	let totalLength = 0;
	let segmentLengths = [];

	// 各線分の長さを計算し、合計を求める
	for (let i = 0; i < polyline.length - 1; i++) {
		let [x1, y1] = polyline[i];
		let [x2, y2] = polyline[i + 1];
		let length = Math.hypot(x2 - x1, y2 - y1);
		segmentLengths.push(length);
		totalLength += length;
	}

	let halfLength = totalLength / 2;
	let accumulatedLength = 0;

	// 中間点を探す
	for (let i = 0; i < segmentLengths.length; i++) {
		let [x1, y1] = polyline[i];
		let [x2, y2] = polyline[i + 1];
		let segmentLength = segmentLengths[i];

		if (accumulatedLength + segmentLength >= halfLength) {
			let ratio = (halfLength - accumulatedLength) / segmentLength;
			let midX = x1 + ratio * (x2 - x1);
			let midY = y1 + ratio * (y2 - y1);
			return [midX, midY];
		}
		accumulatedLength += segmentLength;
	}

	return null;
}

export { initAnnotation, annotationCallback };
