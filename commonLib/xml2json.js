// Description: xml2json.js
// かなりいい加減だが、xmlをjsonに変換する
//
// Programmed by Satoru Takagi
// 
// License: (MPL v2)
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.
//

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