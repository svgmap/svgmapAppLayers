// ===================================================================================
// 以下は地域基準メッシュ(+α)の標準ライブラリ
// Programmed by Satoru Takagi
//  Copyright (C) 2024 by Satoru Takagi @ KDDI CORPORATION
//  

var m1LatSpan = 1/1.5, m1LngSpan = 1;
var m2LatSpan = m1LatSpan/8, m2LngSpan = m1LngSpan/8;
var m3LatSpan = m2LatSpan/10, m3LngSpan = m2LngSpan/10;
var m4LatSpan = m3LatSpan/2, m4LngSpan = m3LngSpan/2;
var m6LatSpan = m3LatSpan/10, m6LngSpan = m3LngSpan/10;

meshOrigin={
	lat:0,
	lng:100
};

meshSpan={
	lat:[m1LatSpan,m2LatSpan,m3LatSpan,m4LatSpan,null,m6LatSpan],
	lng:[m1LngSpan,m2LngSpan,m3LngSpan,m4LngSpan,null,m6LngSpan],
};

function mesh2GridPix( meshStr ){
	// メッシュコードから、メッシュ原点からのリニアなメッシュ単位のXY値を出す
	// メッシュ原点：lon:北緯０°、lat:東経１００°（地域メッシュの定義より）
	var m6mul = 10;
	var m4mul = 2;
	var m3mul = 10;
	var m2mul = 8;
	var level = 1;
	
	// mesh4はひどいローカルルール・・・　要改善です
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

function gridPix2Mesh( px,py,lvl ){
	var m4mul = 2;
	var m3mul = 10;
	var m2mul = 8;
	var level = 1;
	
	var m1x,m1y;
	var m2x,m2y;
	var m3x,m3y;
	var m4x,m4y;
	
	
	if ( lvl == 4 ){
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
	if ( lvl == 4 ){
		// ちょっと後回しね・・
		return ( m1y.toString() + m1x.toString() + m2y.toString() + m2x.toString() + m3y.toString() + m3x.toString() + m4y.toString() + m4x.toString() );
	} else if ( lvl == 3 ){
		return ( m1y.toString() + m1x.toString() + m2y.toString() + m2x.toString() + m3y.toString() + m3x.toString());
	} else if ( lvl == 2 ){
		return ( m1y.toString() + m1x.toString() + m2y.toString() + m2x.toString());
	} else {
		return ( m1y.toString() + m1x.toString());
	}
}

function mesh2LatLng( meshStr ){
	// mesh4はひどいローカルルール・・・　要改善です
	var latitude,longitude; // south,east corne
	var latSpan,lngSpan;
	var m1Lat,m1Lng,m2Lat,m2Lng,m3Lat,m3Lng,m4;
	if ( meshStr.length > 3){
		m1Lat = Number(meshStr.substring(0,2));
		m1Lng = Number(meshStr.substring(2,4));
		latitude  = m1Lat / 1.5;
		longitude = 100 + m1Lng;
		latSpan = m1LatSpan;
		lngSpan = m1LngSpan;
		if ( !latitude || !longitude ){
			return {
				latitude : null,
				longitude : null
			}
		}
		if ( meshStr.length > 5 ){
			m2Lat = Number(meshStr.substring(4,5));
			m2Lng = Number(meshStr.substring(5,6));
			latitude  += m2Lat * m2LatSpan;
			longitude += m2Lng * m2LngSpan;
			latSpan = m2LatSpan;
			lngSpan = m2LngSpan;
			if ( meshStr.length > 7 ){
				m3Lat = Number(meshStr.substring(6,7));
				m3Lng = Number(meshStr.substring(7,8));
				latitude  += m3Lat * m3LatSpan;
				longitude += m3Lng * m3LngSpan;
				latSpan = m3LatSpan;
				lngSpan = m3LngSpan;
				if ( meshStr.length == 9 ){
					m4 = meshStr.substring(8);
					switch(m4){
					case "1":
						// do nothing
						break;
					case "2":
						longitude += m4LngSpan;
						break;
					case "3":
						latitude += m4LatSpan;
						break;
					case "4":
						latitude += m4LatSpan;
						longitude += m4LngSpan;
						break;
					}
					latSpan = m4LatSpan;
					lngSpan = m4LngSpan;
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

function latLng2Mesh(lat,lng,meshLevel){
	// meshLevel4はひどいローカルルール・・・　要改善です
	lat = lat*1.5;
	lng = lng - 100;
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



function getMeshArray(geoBbox, meshLevel){
	var latStep, lngStep;
	if ( meshLevel == 1 ){
		latStep = m1LatSpan;
		lngStep = m1LngSpan;
	} else if ( meshLevel == 2 ){
		latStep = m2LatSpan;
		lngStep = m2LngSpan;
	} else if ( meshLevel == 3 ){
		latStep = m3LatSpan;
		lngStep = m3LngSpan;
	} else if ( meshLevel == 4 ){
		latStep = m4LatSpan;
		lngStep = m4LngSpan;
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
			ans[latLng2Mesh(my,mx,meshLevel)]=true;
		}
	}
	
	var ans2=[];
	for ( mesh in ans ){
		ans2.push(mesh);
	}
	
	return ( ans2 );
}
