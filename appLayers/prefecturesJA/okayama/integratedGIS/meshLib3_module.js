// ===================================================================================
// 以下は地域基準メッシュ(+α)の標準ライブラリ
// Programmed by Satoru Takagi
// 参考:http://www.npli.jp/get_mesh/mesh.pdf

// License: (MPL v2)
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.


// 2024/09/30: Class & ESM化

class MeshLib{
	
	m1LatSpan = 1/1.5;
	m1LngSpan = 1; //  4digits
	m2LatSpan = this.m1LatSpan/8;
	m2LngSpan = this.m1LngSpan/8; // ~10Km 6digits
	m3LatSpan = this.m2LatSpan/10;
	m3LngSpan = this.m2LngSpan/10; // ~1Km 8digits
	m4LatSpan = this.m3LatSpan/2;
	m4LngSpan = this.m3LngSpan/2; // H(arf) 1/2メッシュ ~500m 9digits (SW:1,SE:2,NW:3,NE:4)
// var m5LatSpan = this.m3LatSpan/4, this.m4LngSpan = this.m3LngSpan/4; // Q(uarter) 1/4メッシュ ~250m 10digits (SW:1,SE:2,NW:3,NE:4) 現在非対応(1/10メッシュと符合長が同じのため・・・)
	m6LatSpan = this.m3LatSpan/10;
	m6LngSpan = this.m3LngSpan/10; // T(enth) 1/10メッシュ ~100m 10digits

	meshOrigin={
		lat:0,
		lng:100,
		latitude:0,
		longitude:100
	};

	meshSpan={
		lat:[this.m1LatSpan,this.m2LatSpan,this.m3LatSpan,this.m4LatSpan,null,this.m6LatSpan],
		lng:[this.m1LngSpan,this.m2LngSpan,this.m3LngSpan,this.m4LngSpan,null,this.m6LngSpan],
	};

	meshExtent = { // 地域基準メッシュの有効な領域と言える範囲
		lat:{
			min:24,
			max:46
		},
		lng:{
			min:122,
			max:149
		},
		mesh1:{
			min:"3622",
			max:"6848", // メッシュ領域としてはこれが最大
			nax2:"6949" // 北東端経緯度を求めるにはこれ
		}
	};

	mesh2GridPix( meshStr ){
		// メッシュコードから、メッシュ原点からのリニアなメッシュ単位のXY値を出す
		// メッシュ原点：lon:北緯０°、lat:東経１００°（地域メッシュの定義より）
		var m6mul = 10;
		var m4mul = 2;
		var m3mul = 10;
		var m2mul = 8;
		var level = 1;
		
		// mesh4だけ特殊ルール・・・
		var latPx,lngPx; // south,east 
		if ( meshStr.length > 3){
			var m1Lat = Number(meshStr.substring(0,2));
			var m1Lng = Number(meshStr.substring(2,4));
			latPx  = m1Lat;
			lngPx = m1Lng;
			if ( !latPx || !lngPx ){
				return {y:-1,x:-1,level:-1};
			}
			if ( meshStr.length > 5 ){
				level = 2;
				var m2Lat = Number(meshStr.substring(4,5));
				var m2Lng = Number(meshStr.substring(5,6));
				latPx = latPx * m2mul + m2Lat;
				lngPx = lngPx * m2mul + m2Lng;
				if ( meshStr.length > 7 ){
					level = 3;
					var m3Lat = Number(meshStr.substring(6,7));
					var m3Lng = Number(meshStr.substring(7,8));
					latPx = latPx * m3mul + m3Lat;
					lngPx = lngPx * m3mul + m3Lng;
					if ( meshStr.length == 9 ){
						level = 4;
						var m4 = meshStr.substring(8);
						switch(m4){
						case "1":
							latPx = latPx * m4mul;
							lngPx = lngPx * m4mul;
							break;
						case "2":
							latPx = latPx * m4mul;
							lngPx = lngPx * m4mul + 1;
							break;
						case "3":
							latPx = latPx * m4mul + 1;
							lngPx = lngPx * m4mul;
							break;
						case "4":
							latPx = latPx * m4mul + 1;
							lngPx = lngPx * m4mul + 1;
							break;
						}
					} else if ( meshStr.length == 10 ){
						level = 6;
						var m6Lat = Number(meshStr.substring(8,9));
						var m6Lng = Number(meshStr.substring(9,10));
						latPx = latPx * m6mul + m6Lat;
						lngPx = lngPx * m6mul + m6Lng;
					}
				}
			}
		}
		return {y:latPx,x:lngPx,level:level};
	}

	gridPix2Mesh( px,py,lvl ){
		var m6mul = 10;
		var m4mul = 2;
		var m3mul = 10;
		var m2mul = 8;
		var level = 1;
		
		var m1x,m1y;
		var m2x,m2y;
		var m3x,m3y;
		var m4x,m4y;
		var m6x,m6y;
		
		
		if ( lvl == 6 ){
			m6x = px % m6mul;
			m6y = py % m6mul;
			px = (px - m6x)/m6mul;
			py = (py - m6y)/m6mul;
		} else if ( lvl == 4 ){
			m4x = px % m4mul;
			m4y = py % m4mul;
			px = (px - m4x)/m4mul;
			py = (py - m4y)/m4mul;
		}
		
		if ( lvl >=3 ){
			m3x = px % m3mul;
			m3y = py % m3mul;
			px = (px - m3x)/m3mul;
			py = (py - m3y)/m3mul;
		}
		if ( lvl >=2 ){
			m2x = px % m2mul;
			m2y = py % m2mul;
			px = (px - m2x)/m2mul;
			py = (py - m2y)/m2mul;
		}
		m1x = px;
		m1y = py;
		if ( lvl == 6 ){
			return ( m1y.toString() + m1x.toString() + m2y.toString() + m2x.toString() + m3y.toString() + m3x.toString() + m6y.toString() + m6x.toString() );
		} else if ( lvl == 4 ){
			var m4num = 1 + m4x + m4y*2;
			return ( m1y.toString() + m1x.toString() + m2y.toString() + m2x.toString() + m3y.toString() + m3x.toString() + m4num.toString() );
		} else if ( lvl == 3 ){
			return ( m1y.toString() + m1x.toString() + m2y.toString() + m2x.toString() + m3y.toString() + m3x.toString());
		} else if ( lvl == 2 ){
			return ( m1y.toString() + m1x.toString() + m2y.toString() + m2x.toString());
		} else {
			return ( m1y.toString() + m1x.toString());
		}
	}

	gridPix2latLng( px, py, level){
		
		if ( level == 1 ){
			latSpan = this.m1LatSpan;
			lngSpan = this.m1LngSpan;
		} else if ( level == 2 ){
			latSpan = this.m2LatSpan;
			lngSpan = this.m2LngSpan;
		} else if ( level == 3 ){
			latSpan = this.m3LatSpan;
			lngSpan = this.m3LngSpan;
		} else if ( level == 4 ){
			latSpan = this.m4LatSpan;
			lngSpan = this.m4LngSpan;
		} else if ( level == 6 ){
			latSpan = this.m6LatSpan;
			lngSpan = this.m6LngSpan;
		} else {
			return null;
		}
		
		var latitude = this.meshOrigin.latitude + py * latSpan;
		var longitude = this.meshOrigin.longitude + px * lngSpan;
		
		return {longitude, latitude, lngSpan, latSpan};
	}

	latLng2gridPix( latitude, longitude, level){
		
		if ( level == 1 ){
			latSpan = this.m1LatSpan;
			lngSpan = this.m1LngSpan;
		} else if ( level == 2 ){
			latSpan = this.m2LatSpan;
			lngSpan = this.m2LngSpan;
		} else if ( level == 3 ){
			latSpan = this.m3LatSpan;
			lngSpan = this.m3LngSpan;
		} else if ( level == 4 ){
			latSpan = this.m4LatSpan;
			lngSpan = this.m4LngSpan;
		} else if ( level == 6 ){
			latSpan = this.m6LatSpan;
			lngSpan = this.m6LngSpan;
		} else {
			return null;
		}
		
		var y = Math.floor((latitude - this.meshOrigin.latitude)/latSpan);
		var x = Math.floor((longitude - this.meshOrigin.longitude)/lngSpan);
		
		return {x,y};
	}


	mesh2LatLng( meshStr ){
		// mesh4だけルールが違う・・
		var latitude,longitude; // south,east corne
		var latSpan,lngSpan;
		var m1Lat,m1Lng,m2Lat,m2Lng,m3Lat,m3Lng,m4,m6Lat,m6Lng;
		if ( meshStr.length > 3){
			m1Lat = Number(meshStr.substring(0,2));
			m1Lng = Number(meshStr.substring(2,4));
			latitude  = this.meshOrigin.latitude + m1Lat / 1.5;
			longitude = this.meshOrigin.longitude + m1Lng;
			latSpan = this.m1LatSpan;
			lngSpan = this.m1LngSpan;
			if ( !latitude || !longitude ){
				return {
					latitude : null,
					longitude : null
				}
			}
			if ( meshStr.length > 5 ){
				m2Lat = Number(meshStr.substring(4,5));
				m2Lng = Number(meshStr.substring(5,6));
				latitude  += m2Lat * this.m2LatSpan;
				longitude += m2Lng * this.m2LngSpan;
				latSpan = this.m2LatSpan;
				lngSpan = this.m2LngSpan;
				if ( meshStr.length > 7 ){
					m3Lat = Number(meshStr.substring(6,7));
					m3Lng = Number(meshStr.substring(7,8));
					latitude  += m3Lat * this.m3LatSpan;
					longitude += m3Lng * this.m3LngSpan;
					latSpan = this.m3LatSpan;
					lngSpan = this.m3LngSpan;
					if ( meshStr.length == 9 ){
						m4 = meshStr.substring(8);
						switch(m4){
						case "1":
							// do nothing
							break;
						case "2":
							longitude += this.m4LngSpan;
							break;
						case "3":
							latitude += this.m4LatSpan;
							break;
						case "4":
							latitude += this.m4LatSpan;
							longitude += this.m4LngSpan;
							break;
						}
						latSpan = this.m4LatSpan;
						lngSpan = this.m4LngSpan;
					} else if ( meshStr.length == 10 ){
						m6Lat = Number(meshStr.substring(8,9));
						m6Lng = Number(meshStr.substring(9,10));
						latitude  += m6Lat * this.m6LatSpan;
						longitude += m6Lng * this.m6LngSpan;
						latSpan = this.m6LatSpan;
						lngSpan = this.m6LngSpan;
					}
				}
			}
		}
		return {
			latitude: latitude,
			longitude: longitude,
			latSpan : latSpan,
			lngSpan : lngSpan
		}
	}

	latLng2Mesh(lat,lng,meshLevel){
		// mesh4だけルールが違う・・
		lat = lat*1.5;
		lng = lng - this.meshOrigin.longitude;
		var m1Lat = Math.floor(lat);
		var m1Lng = Math.floor(lng);
		
		if ( meshLevel==1){
			return ( m1Lat.toString() + m1Lng.toString() );
		}
		
		lat = lat - m1Lat;
		lng = lng - m1Lng;
		
		lat = lat * 8;
		lng = lng * 8;
		
		var m2Lat = Math.floor(lat);
		var m2Lng = Math.floor(lng);
		
		if ( meshLevel==2){
			return ( m1Lat.toString() + m1Lng.toString() + m2Lat.toString() + m2Lng.toString() );
		}
		
		lat = lat - m2Lat;
		lng = lng - m2Lng;
		
		lat = lat * 10;
		lng = lng * 10;

		var m3Lat = Math.floor(lat);
		var m3Lng = Math.floor(lng);
		
		if ( meshLevel==3){
			return ( m1Lat.toString() + m1Lng.toString() + m2Lat.toString() + m2Lng.toString() + m3Lat.toString() + m3Lng.toString() );
		}
		
		lat = lat - m3Lat;
		lng = lng - m3Lng;
		
		lat = lat * 2;
		lng = lng * 2;

		var m4Lat = Math.floor(lat);
		var m4Lng = Math.floor(lng);
		var m4Num = 1;
		if ( m4Lat==1 ){
			m4Num += 2;
		}
		if ( m4Lng==1 ){
			m4Num += 1;
		}
		
		if ( meshLevel==4){
			return ( m1Lat.toString() + m1Lng.toString() + m2Lat.toString() + m2Lng.toString() + m3Lat.toString() + m3Lng.toString() + m4Num.toString() );
		}
		
		lat = lat * 5; // 2*5=10ということで(m4が変則的・・ m5はもう無視したい・・)
		lng = lng * 5;
		var m6Lat = Math.floor(lat);
		var m6Lng = Math.floor(lng);
		
		if ( meshLevel == 6){ // 100mメッシュ
			return ( m1Lat.toString() + m1Lng.toString() + m2Lat.toString() + m2Lng.toString() + m3Lat.toString() + m3Lng.toString() + m6Lat.toString() + m6Lng.toString());
		}
		
		return (null);
	}



	getMeshArray(geoBbox, meshLevel){
		var latStep, lngStep;
		if ( meshLevel == 1 ){
			latStep = this.m1LatSpan;
			lngStep = this.m1LngSpan;
		} else if ( meshLevel == 2 ){
			latStep = this.m2LatSpan;
			lngStep = this.m2LngSpan;
		} else if ( meshLevel == 3 ){
			latStep = this.m3LatSpan;
			lngStep = this.m3LngSpan;
		} else if ( meshLevel == 4 ){
			latStep = this.m4LatSpan;
			lngStep = this.m4LngSpan;
		} else if ( meshLevel == 6 ){
			latStep = this.m6LatSpan;
			lngStep = this.m6LngSpan;
		} else {
			return ( null );
		}
			
		var ans = [];
		for ( var mx = geoBbox.x ; mx < geoBbox.x + geoBbox.width + lngStep ; mx += lngStep){
			if ( mx > geoBbox.x + geoBbox.width ){
				mx = geoBbox.x + geoBbox.width;
			}
		// geoBbox(.x,.y,.wjdth,.height)を包含する最小のメッシュコードのリストを返す
			for ( var my = geoBbox.y ; my < geoBbox.y + geoBbox.height + latStep ; my += latStep){
				if ( my > geoBbox.y + geoBbox.height ){
					my = geoBbox.y + geoBbox.height;
				}
	//			console.log(mx,my);
				ans[this.latLng2Mesh(my,mx,meshLevel)]=true;
			}
		}
		
		var ans2=[];
		for ( mesh in ans ){
			ans2.push(mesh);
		}
		
		return ( ans2 );
	}
}

const meshLib = new MeshLib(); // staticでも良い気がするが…

export { MeshLib, meshLib };
