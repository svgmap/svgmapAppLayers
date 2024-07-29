// UTM MRGS <-> UTM <-> LatLng functions
//  Programmed by Satoru Takagi
//  
//  Copyright (C) 2020- by Satoru Takagi @ KDDI CORPORATION
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
//
// based on https://www.wingfield.gr.jp/archives/6833
// and https://www.gsi.go.jp/chubu/minichishiki10.html
// なんかこの機能ってかなりファジーじゃないかなぁ・・　特に、ゾーンレターが決まっていないと緯度経度に変換できないけれどUTM系の中だけではゾーンレター決められず、一度緯度経度系にしないと決められないというのがダメな気がする

// 2020/12/15 Rev1
// 2020/12/16 Rev2 いろいろ整理
//   このライブラリでは、内部演算では南半球のNorthingはマイナス値を使っている。ただし外部に向けた関数では規格通り　10000Km足した値とする

var method = UTMGrid.prototype;

function UTMGrid(){
	this.utmc = new UTMLatLng();
	this.rGL =[];
	for ( var i = 0 ; i < this.GL.length ; i++ ){
		this.rGL[this.GL[i]]=i;
	}
	this.makeZoneBound();
}


method.makeZoneBound = function(){
	this.GLb=[]; // [[そのゾーンレターがあり得るY値のレンジmin,max, 緯度min,max, ゾーンレター]..]
	var ll = -80;
	var utmyMin,utmyMax;
	var prev_utmyMin,prev_utmyMax;
	
	
	for ( var i = 2 ; i <= 22 ; i++ ){
		var utmxy0 = this.utmc.convertLatLngToUtm(ll,135,2);
		var utmxy1 = this.utmc.convertLatLngToUtm(ll,133,2);
		if ( ll >=0 ){
			utmyMin = Math.min(utmxy0.Northing,utmxy1.Northing);
			utmyMax = Math.max(utmxy0.Northing,utmxy1.Northing);
		} else {
			 // これutmcが南半球でマイナス使わないという正規の仕様のため・・・ こっちはいい加減でマイナスにしてる
			utmyMin = Math.min(utmxy0.Northing-10000000,utmxy1.Northing-10000000);
			utmyMax = Math.max(utmxy0.Northing-10000000,utmxy1.Northing-10000000);
		}
		if ( i > 2 ){
			this.GLb[i-1]=[prev_utmyMin, utmyMax,ll-8,ll,this.GL[i-1]];
		}
		
		prev_utmyMin = utmyMin;
		prev_utmyMax = utmyMax;
		ll+=8;
	}
	
	console.log("GLb:",this.GLb);
}

method.GL=["A","B","C","D","E","F","G","H","J","K","L","M","N","P","Q","R","S","T","U","V","W","X","Y","Z"];
method.getNothernLetter = function(north, zoneNumber){
	if ( !this.checkZone( zoneNumber ) ){
		console.log("ERROR zon number should be positeve integer");
		return(null);
	}
	var isOddZone = false;
	if ( zoneNumber % 2 == 1 ){
		isOddZone = true;
	}
	var i = ( Math.floor(north / 100000) ) ;
	if ( !isOddZone ){
		i+=5;
	}
	i = i % (this.GL.length - 4);
	if ( i < 0 ){
		i = this.GL.length - 4 + i;
	}
	var ans = this.GL[i];
	return ( ans );
}

method.checkZone = function(zoneNumber){
	if ( zoneNumber % 1 ==0 ){
		return ( true );
	} else {
		return ( false );
	}
}

method.getEasternLetter = function(east, zoneNumber){
	if ( !this.checkZone( zoneNumber ) ){
		console.log("ERROR zon number should be positeve integer");
		return(null);
	}
	
	var zoneGroup = (zoneNumber-1) % 3;
	
	var i = zoneGroup * 8 + Math.floor(east / 100000)-1;
	i = i % this.GL.length;
	if ( i == -1 ){
		i = this.GL.length-1;
	}
	return ( this.GL[i]);
	
}

method.getCoordinate = function (crd, len){
	ans = Math.floor(crd % 100000);
	if ( ans < 0 ){
		ans += 100000;
	}
	ans = ('00000' + ans).slice(-5);
	ans = ans.substring(0,len);
	return ( ans );
}

method.getZoneLetter = function(x,y,zn){
	var zl = "N"; // nothern
	if ( y < 0 ){
		zl = "M"; // southern
		y =  10000000+y; // これutmcが南半球でマイナス使わないという正規の仕様のため・・・
	}
	/**
	console.log("latlng:-35,135 -> ",this.utmc.convertLatLngToUtm(-35, 135, 2));
	console.log("latlng:-25,135 -> ",this.utmc.convertLatLngToUtm(-25, 135, 2));
	console.log("latlng:-15,135 -> ",this.utmc.convertLatLngToUtm(-15, 135, 2));
	console.log("latlng:-05,135 -> ",this.utmc.convertLatLngToUtm(-5, 135, 2));
	console.log("latlng:-00,135 -> ",this.utmc.convertLatLngToUtm(-0.000001, 135, 2));
	**/
	var latLng = this.utmc.convertUtmToLatLng(x,y,zn,zl);
	var utmxy = this.utmc.convertLatLngToUtm(latLng.lat, latLng.lng, 2);
//	console.log("getZoneLetter  x:",x," y:",y, " zn:", zn, "   -> latLng:",latLng," utmxy:",utmxy);
	return ( utmxy.ZoneLetter );
}

method.getGridStringFromUTM = function(east, unsignedNorth, zoneNumber, accuracy, zoneLetterOrIsSouthernHemisphere){
	// こちらのAPIでは南半球のunsignedNorthを10000000足した正の値(符号なし数)として入力。その代わり少なくとも南半球かどうかの明示が必要
	// 南半球かどうかだけを示すなら5番目の引数にtrueを入れる。5番目の引数が無い場合は北半球。
	// 5番目の引数にゾーンレターが入っている場合はそれを用いる(正しいかどうかのチェックは行わない)
	// zoneLetterを明示するならその文字列を入れる
	// 
	// accuracy: 1,10,100,1000,10000 [m]
	// 
	var north = unsignedNorth;
	if ( zoneLetterOrIsSouthernHemisphere == undefined ){
		// 北半球と見做す
	} else if ( zoneLetterOrIsSouthernHemisphere == true ){
		north -= 10000000; // 内部処理は南半球を負の値として処理している
		zoneLetterOrIsSouthernHemisphere = undefined;
	} else if ( this.rGL[zoneLetterOrIsSouthernHemisphere] < 12 ){
		north -= 10000000;
	}
	getGridStringFromXYZn(east, north, zoneNumber, accuracy, zoneLetterOrIsSouthernHemisphere);
}

method.getGridStringFromXYZn = function(east, signedNorth, zoneNumber, accuracy, zoneLetter){
	// こちらのAPIでは南半球のsignedNorthを負の値として入力。その代わりzoneLetterはなくても演算する
	var el = this.getEasternLetter(east, zoneNumber);
	var nl = this.getNothernLetter(signedNorth, zoneNumber);
	
	var len = 5 - Math.floor(Math.log10(accuracy));
	
	var ec = this.getCoordinate(east,len);
	var nc = this.getCoordinate(signedNorth,len);
//	console.log("signedNorth:",signedNorth," nc:",nc);
	
	if ( ! zoneLetter ){
		zoneLetter = this.getZoneLetter(east,signedNorth,zoneNumber);
	} else {
		zoneLetter = zoneLetter.toUpperCase();
	}
	
	zoneNumber=('00' + zoneNumber).slice(-2);
	
	var ret = zoneNumber + zoneLetter + el + nl + ec + nc;
	
	return ( ret );
	
}

method.getXYZnFromGridString = function(GridString){
	// Parse GridString
	var zoneNum = (GridString.split(/[A-Z]/))[0];
	var remainder = GridString.substring(zoneNum.length);
	var zoneLetter = (remainder.substring(0,1)).toUpperCase();
	var el = (remainder.substring(1,2)).toUpperCase();
	var nl = (remainder.substring(2,3)).toUpperCase();
	remainder = remainder.substring(3);
	if ( remainder.length % 2 != 0 || remainder.length > 10){
		console.log("data format error exit.");
		return ( null );
	}
	var ec = remainder.substring(0,remainder.length/2);
	var nc = remainder.substring(remainder.length/2);
	
	// make Number
	zoneNum = Number(zoneNum);
	ec = Number(ec)* Math.pow(10, 5 - ec.length);
	nc = Number(nc)* Math.pow(10, 5 - nc.length);
	
	// calc
	var eGr = (zoneNum-1) % 3;
	var nGr = (zoneNum-1) % 2;
	
	var eGd = this.rGL[el] - eGr * 8;
	var nGd = this.rGL[nl] - nGr * 5;
	
	var east = (eGd+1)   * 100000;
	var northN = nGd * 100000;
	
	east   += ec; // X値確定
	northN += nc; // notrhIvの倍数分の不確定(ゾーンレターで確定させる)
	//console.log("nl:",nl, "  nc:",nc,"  nGd:",nGd);
	
	var notrhIv = 2000000;
	
	var zln = this.rGL[zoneLetter]
	
	var nMin = this.GLb[zln][0]; // これは使わない
	var nMax = this.GLb[zln][1];
	
	var ansMin = ( nMin - northN ) / notrhIv; // これは使わない
	var ansMax = ( nMax - northN ) / notrhIv;
	
	var ansN = Math.floor(ansMax);
	var north = northN + ansN * notrhIv;
	
//	console.log("ZN,ZL,el,nl,ec,nc:",zoneNum,zoneLetter,el,nl,ec,nc,"  east:",east,"  northN:",northN,"   ansMin,Max:",ansMin,ansMax,"  dif:",ansMax-ansMin,"nMin,nMax:",nMin,nMax,   "north:",north);
	var unorth = north;
	if ( north < 0 ){ // 2020/12/16 UTMLatLng.jsと仕様を合わせる
		unorth += 10000000;
	}
	return {Easting:east,Northing:unorth,ZoneNumber:zoneNum,ZoneLetter:zoneLetter,signedNorthing:north}
}


method.getGridStringFromLngLat = function(longitude,latitude, accuracy){
	var utmXYZZ = this.utmc.convertLatLngToUtm(latitude, longitude,2);
	var northing = utmXYZZ.Northing;
	if ( latitude < 0 ){
		northing -= 10000000; // これutmcが南半球でマイナス使わないという正規の仕様のため・・・
	}
	var ans = this.getGridStringFromXYZn(utmXYZZ.Easting, northing, utmXYZZ.ZoneNumber, accuracy, utmXYZZ.ZoneLetter);
	ans.utm = utmXYZZ;
	return ( ans );
}

method.getLngLatFromGridString = function(GridString){
	var utmXYZZ = this.getXYZnFromGridString(GridString);
	var ans = this.utmc.convertUtmToLatLng(utmXYZZ.Easting, utmXYZZ.Northing, utmXYZZ.ZoneNumber, utmXYZZ.ZoneLetter);
	ans.utm=utmXYZZ;
	return ( ans );
}
