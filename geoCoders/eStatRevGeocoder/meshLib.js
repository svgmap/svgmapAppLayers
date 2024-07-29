// 以下は地域基準メッシュ(+α)の標準ライブラリ

var m1LatSpan = 1/1.5, m1LngSpan = 1;
var m2LatSpan = m1LatSpan/8, m2LngSpan = m1LngSpan/8;
var m3LatSpan = m2LatSpan/10, m3LngSpan = m2LngSpan/10;
var m4LatSpan = m3LatSpan/2, m4LngSpan = m3LngSpan/2;

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
	
	return (null);
}

var meshSpan={
	"1":{lat:m1LatSpan,lng:m1LngSpan},
	"2":{lat:m2LatSpan,lng:m2LngSpan},
	"3":{lat:m3LatSpan,lng:m3LngSpan},
	"4":{lat:m4LatSpan,lng:m4LngSpan},
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
