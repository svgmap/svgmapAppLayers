// csvに画像データのリンク(ファイル名)があったら、そのファイルを表示できる機能の拡張 - CSV入力パネル用
//
// Programmed by Satoru Takagi
// 
// License: (MPL v2)
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.
//



addEventListener("load",function(){
	if ( window.opener && typeof(window.opener?.imageMetadata) == "object"){
		document.getElementById("imagesLoadUIspan").style.display="";
		document.getElementById("imagesLoadUI").addEventListener("change",loadImageFiles);
	} else {
	}
});

async function loadImageFiles(event){
	const files = event.target.files;
	console.log(event.target,files);
	for ( var file of files){
		var imgBlob = await getBlob(file);
		window.opener?.imageMetadata.addImageBlob(imgBlob, file.name);
	};
}

var restrigcedImageSize = 800;

function getBlob(file){
	return new Promise(function(callback) {
		const reader = new FileReader();
		reader.onload = function (e) {
			const img = new Image();
			img.onload = function () {
				const canvas = document.createElement("canvas");
				const ctx = canvas.getContext("2d");
				
				if ( img.width <= restrigcedImageSize) {
					canvas.width = img.width;
					canvas.height = img.height;
				} else {
					const aspectRatio = img.height / img.width;
					canvas.width = restrigcedImageSize;
					canvas.height = restrigcedImageSize * aspectRatio;
				}

				ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
				
				const mimeType = file.type;
				canvas.toBlob(
					async function (blob) {
						console.log(file.name,blob);
						callback(blob);
					},
					mimeType,
					0.8
				);
			};
			img.src = e.target.result;
		};
		reader.readAsDataURL(file);
	});
}
