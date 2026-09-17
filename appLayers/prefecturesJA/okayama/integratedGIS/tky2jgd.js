// tky2jgd.js
// 国土地理院のtky2jgdのパラメータファイル(TKY2JGD.par)を用いて、
// 旧測地系(東京ベッセル)からGRS80(JGD2000)緯度経度座標系に変換する関数
// データが無い場所は(例えば関空とかセントレアとか)Molodensky法による簡易変換を行う
// 逆変換も持つ
//
// License: (MPL v2)
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.

// Ported from tky2jgd.java
// Programmed by Satoru Takagi @ KDDI

import { unzip, HTTPRangeReader } from "./unzipit.module.js";
import { MeshLib } from "./meshLib3_module.js";

class Tky2jgd {
	constructor() {}
	/**
	public static void main(String[] args) {
		tky2jgd t2j = new tky2jgd();
		
		double lon = 140.0;
		double lat = 36.0;
		if ( args.length > 1 ){
			lat = Double.parseDouble(args[0]);
			lon = Double.parseDouble(args[1]);
		}
		Point2D.Double p = t2j.transform(lat,lon);
		
		
		System.out.println( "In:" + lon + "," +  lat + " Out:" + p );
		
	}
	**/

	meshLib = new MeshLib();

	tky2jgdTable = {};

	transform(lat, lon) {
		var pos = this.#BL2WGS({ latitude: lat, longitude: lon });
		return { y: pos.latitude, x: pos.longitude };
	}

	transformS(lat, lon) {
		var lat0, lng0;
		var meshcode0 = this.meshLib.latLng2Mesh(lat, lon, 3);
		var box = this.#getMeshBox(meshcode0);
		// 四隅の３次メッシュのズレ量を得る
		// データベースに存在しない場合は、ノーマルな変換関数で該当する部分のズレ量を計算する
		var crd0 = this.tky2jgdTable[box.z];
		var crdU = this.tky2jgdTable[box.u];
		var crdR = this.tky2jgdTable[box.r];
		var crdUR = this.tky2jgdTable[box.ur];
		//		console.log(box);
		//		console.log(crd0,crdU,crdR,crdUR);
		if (!crd0 || !crdU || !crdR || !crdUR) {
			console.warn("ERR!!!!!", crd0, crdU, crdR, crdUR, lat, lon);
			var pos = this.#BL2WGS({ latitude: lat, longitude: lon });
			return { x: pos.longitude, y: pos.latitude, accuracy: "low" };
		}
		//バイリニア補間
		var m0latlng = this.meshLib.mesh2LatLng(meshcode0);
		//		console.log(m0latlng);
		const a = (lon - m0latlng.longitude) / (45.0 / 3600.0); // 経度方向の変位
		const b = (lat - m0latlng.latitude) / (30.0 / 3600.0); // 緯度方向の変位
		//		console.log( "a(lon)" + a + " b(lat):" + b);

		//補間式を展開したもの
		const x =
			crd0.x +
			(crdU.x - crd0.x) * b +
			(crdR.x - crd0.x) * a +
			(crdUR.x - crdR.x - crdU.x + crd0.x) * b * a;
		const y =
			crd0.y +
			(crdU.y - crd0.y) * b +
			(crdR.y - crd0.y) * a +
			(crdUR.y - crdR.y - crdU.y + crd0.y) * b * a;
		//		console.log(x,y);

		const lonr = x / 3600.0 + lon;
		const latr = y / 3600.0 + lat;
		return { x: lonr, y: latr };
	}

	// WGS84(JGD2000)から旧日本測地系(Tokyo Datum)への逆変換（外部呼び出し用）
	inverseTransform(lat, lon) {
		var pos = this.#WGS2BL({ latitude: lat, longitude: lon });
		return { y: pos.latitude, x: pos.longitude };
	}

	// LUT方式を用いた高精度な逆変換 (WGS84 -> 旧測地系)
	// パラメータファイルは順変換用のため、不動点反復法による収束計算を行う
	inverseTransformS(latWGS, lonWGS) {
		// 1. まずMolodensky法で精度の高い初期推測値(Tokyo)を作る
		let initGuess = this.inverseTransform(latWGS, lonWGS);
		let latTKY = initGuess.y;
		let lonTKY = initGuess.x;

		const maxIter = 5; // 通常2〜3回で十分収束する
		const tolerance = 1e-10; // 許容誤差(度)

		for (let i = 0; i < maxIter; i++) {
			// 現在の推測値(Tokyo)をLUTで順変換(WGS84)してみる
			let fw = this.transformS(latTKY, lonTKY);

			// LUT範囲外でMolodenskyにフォールバックした場合はそのまま返す
			if (fw.accuracy === "low") {
				return { x: lonTKY, y: latTKY, accuracy: "low" };
			}

			// 目標のWGS84座標とのズレ(残差)を計算
			let dLat = latWGS - fw.y;
			let dLon = lonWGS - fw.x;

			// 推測値を補正
			latTKY += dLat;
			lonTKY += dLon;

			// 誤差が十分に小さくなったら完了
			if (Math.abs(dLat) < tolerance && Math.abs(dLon) < tolerance) {
				break;
			}
		}

		return { x: lonTKY, y: latTKY };
	}

	// Molodensky法による WGS84 -> 旧測地系 の内部メソッド
	#WGS2BL(BL) {
		var a_WGS = 6378137.0,
			f_WGS = 1 / 298.257222101;
		var a_BL = 6377397.155,
			f_BL = 1 / 299.152813;
		var DU_WB = 146.3,
			DV_WB = -507.1,
			DW_WB = -681.0;
		// パラメータの順序を逆にして MolodenskyConv に渡す
		return this.#MolodenskyConv(
			BL,
			a_WGS,
			f_WGS,
			a_BL,
			f_BL,
			DU_WB,
			DV_WB,
			DW_WB
		);
	}

	async init() {
		var startData = false;
		var meshCode;
		var x, y;
		var counter = 0;
		console.log("Reading database");

		try {
			var zipArchive = await unzip("000185226.zip");
			//			console.log(zipArchive.entries);
			var csv = await zipArchive.entries["TKY2JGD.par"].text();

			csv = csv.split("\r\n");
			//console.log(csv);
			this.tky2jgdTable = {};
			csv.forEach(
				function (line, idx) {
					var rec = line.split(/\s+/g);
					if (rec.length == 3 && !isNaN(rec[2])) {
						//console.log(rec[0],":",rec[1],":",rec[2]);
						this.tky2jgdTable[rec[0]] = {
							x: Number(rec[2]),
							y: Number(rec[1]),
						};
					}
				}.bind(this)
			);
			//console.log(this.tky2jgdTable);
			console.log(this.tky2jgdTable["36225718"]);
		} catch (e) {
			console.log(e);
			console.log(this.tky2jgdTable);
		}
	}

	#getMeshBox(mesh) {
		var gp = this.meshLib.mesh2GridPix(mesh);
		var u = this.meshLib.gridPix2Mesh(gp.x, gp.y + 1, 3);
		var r = this.meshLib.gridPix2Mesh(gp.x + 1, gp.y, 3);
		var ur = this.meshLib.gridPix2Mesh(gp.x + 1, gp.y + 1, 3);
		return { u, r, ur, z: mesh };
	}

	#BL2WGS(BL) {
		// WGS84(≒JGD2000)<->旧日本測地系(東京BESSEL) 変換のための定数群
		// a:半径 f:扁平率 D*:座標ずれ [m]
		var a_WGS = 6378137.0,
			f_WGS = 1 / 298.257222101;
		var a_BL = 6377397.155,
			f_BL = 1 / 299.152813;
		var DU_WB = 146.3,
			DV_WB = -507.1,
			DW_WB = -681.0;
		var DU_BW = -DU_WB,
			DV_BW = -DV_WB,
			DW_BW = -DW_WB;
		return this.#MolodenskyConv(
			BL,
			a_BL,
			f_BL,
			a_WGS,
			f_WGS,
			DU_BW,
			DV_BW,
			DW_BW
		);
	}

	// Molodensky法による、楕円体を用いた簡易座標系変換
	#MolodenskyConv(POS1, a1, f1, a2, f2, DU, DV, DW) {
		var dtorad = Math.PI / 180.0;
		var from_esq,
			da,
			df,
			slat,
			slon,
			clat,
			clon,
			ssqlat,
			adb,
			rn,
			rm,
			dlat,
			dlon,
			dh;

		dlat = 0.0;
		dlon = 0.0;
		dh = 0.0;

		//緯度・経度・高度の用意
		var Lat = POS1.latitude * dtorad;
		var Lon = POS1.longitude * dtorad;
		var h = 0;
		if (POS1.altitude) {
			h = POS1.altitude; // 高度の扱いに注意
		}
		if (Lat < Math.PI / 2.0 && Lat > -Math.PI / 2.0) {
			from_esq = 2.0 * f1 - f1 * f1;
			da = a2 - a1;
			df = f2 - f1;
			slat = Math.sin(Lat);
			clat = Math.cos(Lat);
			slon = Math.sin(Lon);
			clon = Math.cos(Lon);
			ssqlat = slat * slat;
			adb = 1.0 / (1.0 - f1);
			rn = 1.0 / Math.sqrt(1.0 - from_esq * ssqlat);
			rm =
				(a1 * (1.0 - from_esq)) / Math.pow(1.0 - from_esq * ssqlat, 3.0 / 2.0);
			rn = a1 * rn;

			dlat =
				(-DU * slat * clon -
					DV * slat * slon +
					DW * clat +
					da * ((rn * from_esq * slat * clat) / a1) +
					df * (rm * adb + rn / adb) * slat * clat) /
				(rm + h);
			dlon = (-DU * slon + DV * clon) / ((rn + h) * clat);
			dh =
				DU * clat * clon +
				DV * clat * slon +
				DW * slat -
				da * (a1 / rn) +
				(df * rn * ssqlat) / adb;
		}
		return {
			latitude: (Lat + dlat) / dtorad,
			longitude: (Lon + dlon) / dtorad,
			altitude: h + dh,
		};
	}
}

var tky2jgd = new Tky2jgd();
export { tky2jgd };
