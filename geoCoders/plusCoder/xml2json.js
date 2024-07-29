// /home/svg2/public_html/devinfo/devkddi/lvl0.1/etcLayers/moj/MojMapGML2GeoJSON.js　を抜き出し
//
// Copyright 2023 by Satoru Takagi @ KDDI All Rights Reserverd
//
// Programmed by Satoru Takagi
// License GPL v3 : See: https://www.gnu.org/licenses/gpl-3.0.html
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
//  along with this program.  If not, see <http://www.gnu.org/licenses/>.

class xml2json{
	static xml2js(xml, refTable, idTable) {
		// XMLを適当なjsonデータ構造に変換・・
		var obj = xml2json.domTraverse(
			xml.documentElement,
			refTable,
			idTable
		);
		return obj;
	}

	static domTraverse(elm, refTable, idTable) {
		var thisObj = {};
		var attrs = elm.attributes;
		if (attrs.length > 0) {
			for (var attr of attrs) {
				thisObj[attr.name] = attr.value;
				if (idTable && attr.name == "id") {
					idTable[attr.value] = thisObj;
				} else if (refTable && attr.name == "idref") {
					if (!refTable[attr.value]) {
						refTable[attr.value] = [];
					}
					refTable[attr.value].push(thisObj);
				}
			}
		}
		var children = elm.children;
		if (children.length > 0) {
			for (var ci = 0; ci < children.length; ci++) {
				var child = children[ci];
				var childObj = xml2json.domTraverse(child, refTable, idTable);
				if (thisObj[child.tagName]) {
					if (!thisObj[child.tagName].length) {
						var tmp = thisObj[child.tagName];
						thisObj[child.tagName] = [];
						thisObj[child.tagName].push(tmp);
						thisObj[child.tagName].push(childObj);
					} else {
						thisObj[child.tagName].push(childObj);
					}
				} else {
					thisObj[child.tagName] = childObj;
				}
			}
		} else {
			// 子要素がない場合
			var textContent = elm.textContent;
			if (textContent != "") {
				if (attrs.length == 0) {
					// 子要素も、属性もないので、textだけ
					thisObj = elm.textContent;
				} else {
					thisObj.textContent = elm.textContent;
				}
			}
		}
		return thisObj;
	}
}


export {xml2json}