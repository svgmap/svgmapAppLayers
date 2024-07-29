// ColoringLib.js
// 塗分けライブラリ
//  Programmed by Satoru Takagi
//  
//  Copyright (C) 2024 by Satoru Takagi @ KDDI CORPORATION
//  
// License: (GPL v3)
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

// 数値->Hue->色変換関数(ヒートマップ) : getColor
// 文字列->色変換関数(適当なハッシュ関数) : stringToColour , stringToColour2


function getColor(val, mode,minval,maxval,hue0,byRGBintval){
	var hue;
	if ( mode == -1 ){ // direct
		var ans = colourNameToHex(val,byRGBintval);
		if ( !ans ){ // フォールバックとして適当な色を付ける
			ans = stringToColour2(String(val),byRGBintval);
		}
		return ( ans );
	} else if ( mode == 0 ){ // inverse HSV 270...0
		hue = (1-((val - minval)/(maxval-minval)))*270;
		vv = 1;
	} else if ( mode == 1 ){ // HSV 0...270
		hue = (val - minval)/(maxval-minval)*270;
		vv = 1;
	} else if ( mode == 2 ){ // 特定色の明度
		hue = hue0;
		vv = (val - minval)/(maxval-minval);
	} else if ( mode == 3 ){ // 文字列->色
		return (stringToColour2(String(val),byRGBintval));
	}
	var rgb = hsvToRgb(hue,1,vv);
	if ( byRGBintval ){
		return ( rgb );
	} else {
		var color ="#"+zeroPadding(rgb[0].toString(16),2)+zeroPadding(rgb[1].toString(16),2)+zeroPadding(rgb[2].toString(16),2);
		return ( color );
	}
}

function hsvToRgb(H,S,V) {
	// https://qiita.com/hachisukansw/items/633d1bf6baf008e82847
	//https://en.wikipedia.org/wiki/HSL_and_HSV#From_HSV

	var C = V * S;
	var Hp = H / 60;
	var X = C * (1 - Math.abs(Hp % 2 - 1));

	var R, G, B;
	if (0 <= Hp && Hp < 1) {
		R=C;
		G=X;
		B=0;
	};
	if (1 <= Hp && Hp < 2) {
		R=X;
		G=C;
		B=0;
	};
	if (2 <= Hp && Hp < 3) {
		R=0;
		G=C;
		B=X;
	};
	if (3 <= Hp && Hp < 4) {
		R=0;
		G=X;
		B=C;
		
	};
	if (4 <= Hp && Hp < 5) {
		R=X;
		G=0;
		B=C;
	};
	if (5 <= Hp && Hp < 6) {
		R=C;
		G=0;
		B=X;
	};

	var m = V - C;
	R = R+m;
	G = G+m;
	B = B+m;

	R = Math.floor(R * 255);
	G = Math.floor(G * 255);
	B = Math.floor(B * 255);

	return [R ,G, B];
}

function zeroPadding(num,length){
    return ('0000000000' + num).slice(-length);
}


// https://stackoverflow.com/questions/1573053/javascript-function-to-convert-color-names-to-hex-codes
var coloursTable = {
	"aliceblue":"#f0f8ff","antiquewhite":"#faebd7","aqua":"#00ffff","aquamarine":"#7fffd4","azure":"#f0ffff",
	"beige":"#f5f5dc","bisque":"#ffe4c4","black":"#000000","blanchedalmond":"#ffebcd","blue":"#0000ff","blueviolet":"#8a2be2","brown":"#a52a2a","burlywood":"#deb887",
	"cadetblue":"#5f9ea0","chartreuse":"#7fff00","chocolate":"#d2691e","coral":"#ff7f50","cornflowerblue":"#6495ed","cornsilk":"#fff8dc","crimson":"#dc143c","cyan":"#00ffff",
	"darkblue":"#00008b","darkcyan":"#008b8b","darkgoldenrod":"#b8860b","darkgray":"#a9a9a9","darkgreen":"#006400","darkkhaki":"#bdb76b","darkmagenta":"#8b008b","darkolivegreen":"#556b2f",
	"darkorange":"#ff8c00","darkorchid":"#9932cc","darkred":"#8b0000","darksalmon":"#e9967a","darkseagreen":"#8fbc8f","darkslateblue":"#483d8b","darkslategray":"#2f4f4f","darkturquoise":"#00ced1",
	"darkviolet":"#9400d3","deeppink":"#ff1493","deepskyblue":"#00bfff","dimgray":"#696969","dodgerblue":"#1e90ff",
	"firebrick":"#b22222","floralwhite":"#fffaf0","forestgreen":"#228b22","fuchsia":"#ff00ff",
	"gainsboro":"#dcdcdc","ghostwhite":"#f8f8ff","gold":"#ffd700","goldenrod":"#daa520","gray":"#808080","green":"#008000","greenyellow":"#adff2f",
	"honeydew":"#f0fff0","hotpink":"#ff69b4",
	"indianred ":"#cd5c5c","indigo":"#4b0082","ivory":"#fffff0","khaki":"#f0e68c",
	"lavender":"#e6e6fa","lavenderblush":"#fff0f5","lawngreen":"#7cfc00","lemonchiffon":"#fffacd","lightblue":"#add8e6","lightcoral":"#f08080","lightcyan":"#e0ffff","lightgoldenrodyellow":"#fafad2",
	"lightgrey":"#d3d3d3","lightgreen":"#90ee90","lightpink":"#ffb6c1","lightsalmon":"#ffa07a","lightseagreen":"#20b2aa","lightskyblue":"#87cefa","lightslategray":"#778899","lightsteelblue":"#b0c4de",
	"lightyellow":"#ffffe0","lime":"#00ff00","limegreen":"#32cd32","linen":"#faf0e6",
	"magenta":"#ff00ff","maroon":"#800000","mediumaquamarine":"#66cdaa","mediumblue":"#0000cd","mediumorchid":"#ba55d3","mediumpurple":"#9370d8","mediumseagreen":"#3cb371","mediumslateblue":"#7b68ee",
	"mediumspringgreen":"#00fa9a","mediumturquoise":"#48d1cc","mediumvioletred":"#c71585","midnightblue":"#191970","mintcream":"#f5fffa","mistyrose":"#ffe4e1","moccasin":"#ffe4b5",
	"navajowhite":"#ffdead","navy":"#000080",
	"oldlace":"#fdf5e6","olive":"#808000","olivedrab":"#6b8e23","orange":"#ffa500","orangered":"#ff4500","orchid":"#da70d6",
	"palegoldenrod":"#eee8aa","palegreen":"#98fb98","paleturquoise":"#afeeee","palevioletred":"#d87093","papayawhip":"#ffefd5","peachpuff":"#ffdab9","peru":"#cd853f","pink":"#ffc0cb","plum":"#dda0dd","powderblue":"#b0e0e6","purple":"#800080",
	"rebeccapurple":"#663399","red":"#ff0000","rosybrown":"#bc8f8f","royalblue":"#4169e1",
	"saddlebrown":"#8b4513","salmon":"#fa8072","sandybrown":"#f4a460","seagreen":"#2e8b57","seashell":"#fff5ee","sienna":"#a0522d","silver":"#c0c0c0","skyblue":"#87ceeb","slateblue":"#6a5acd","slategray":"#708090","snow":"#fffafa","springgreen":"#00ff7f","steelblue":"#4682b4",
	"tan":"#d2b48c","teal":"#008080","thistle":"#d8bfd8","tomato":"#ff6347","turquoise":"#40e0d0",
	"violet":"#ee82ee",
	"wheat":"#f5deb3","white":"#ffffff","whitesmoke":"#f5f5f5",
	"yellow":"#ffff00","yellowgreen":"#9acd32"
};
var colorRe=/^#([0-9a-fA-F][0-9a-fA-F])([0-9a-fA-F][0-9a-fA-F])([0-9a-fA-F][0-9a-fA-F])$/ ;

function colourNameToHex(colour,byRGBintval)
{
	var ans;
	if ( colour.match(colorRe) ){ // もっといいやり方あるけど面倒なので・・・
		ans = colour.toLowerCase();
	} else {
		ans = coloursTable[colour.toLowerCase()];
	}
	if (typeof ans == 'undefined'){
		return ( null );
	}
	
	if ( byRGBintval ){
		var r = parseInt(ans.substring(1,3),16);
		var g = parseInt(ans.substring(3,5),16);
		var b = parseInt(ans.substring(5),16);
		return ( [r,g,b] );
	} else {
		return ( ans );
	}
}


// https://stackoverflow.com/questions/3426404/create-a-hexadecimal-colour-based-on-a-string-with-javascript
// 任意の文字列から、適当な色をつくる・・・　もっといいのを作った覚えがうっすらあるのだが・・・
// 適当なそこそこのハッシュ分散のハッシュ関数を使って
// https://stackoverflow.com/questions/7616461/generate-a-hash-from-string-in-javascript
var stringToColour0 = function(str, byRGBintval) {
  var hash = 0;
  for (var i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  var colour = '#';
	if ( byRGBintval){
		colour=[];
	}
  for (var i = 0; i < 3; i++) {
    var value = (hash >> (i * 8)) & 0xFF;
  	if ( byRGBintval){
  		colour.push(value);
  	} else {
	    colour += ('00' + value.toString(16)).substr(-2);
  	}
  }
  return colour;
}

const cyrb53 = function(str, seed = 0) {
    let h1 = 0xdeadbeef ^ seed, h2 = 0x41c6ce57 ^ seed;
    for (let i = 0, ch; i < str.length; i++) {
        ch = str.charCodeAt(i);
        h1 = Math.imul(h1 ^ ch, 2654435761);
        h2 = Math.imul(h2 ^ ch, 1597334677);
    }
    h1 = Math.imul(h1 ^ (h1>>>16), 2246822507) ^ Math.imul(h2 ^ (h2>>>13), 3266489909);
    h2 = Math.imul(h2 ^ (h2>>>16), 2246822507) ^ Math.imul(h1 ^ (h1>>>13), 3266489909);
    return 4294967296 * (2097151 & h2) + (h1>>>0);
};
function stringToColour2(str, byRGBintval){ // こちらのほうが良い分散になっていると思います・・
	if ( !byRGBintval){
		return ("#"+("00" + cyrb53(str).toString(16)).substr(-6));
	} else {
		var val = cyrb53(str);
		var ans = [];
		ans.push(val>>16 & 0xff);
		ans.push(val>>8 & 0xff);
		ans.push(val & 0xff);
		return ( ans );
	}
}
