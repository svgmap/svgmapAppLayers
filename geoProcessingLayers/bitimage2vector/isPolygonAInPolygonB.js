function isPointInPolygon(point, polygon) {
	let x = point[0],
		y = point[1];
	let inside = false;
	for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
		let xi = polygon[i][0],
			yi = polygon[i][1];
		let xj = polygon[j][0],
			yj = polygon[j][1];

		let intersect =
			yi > y != yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;
		if (intersect) inside = !inside;
	}
	return inside;
}

function doEdgesIntersect(edge1, edge2) {
	// https://qiita.com/ykob/items/ab7f30c43a0ed52d16f2
	const ax = edge1[0][0];
	const ay = edge1[0][1];
	const bx = edge1[1][0];
	const by = edge1[1][1];
	const cx = edge2[0][0];
	const cy = edge2[0][1];
	const dx = edge2[1][0];
	const dy = edge2[1][1];
	var ta = (cx - dx) * (ay - cy) + (cy - dy) * (cx - ax);
	var tb = (cx - dx) * (by - cy) + (cy - dy) * (cx - bx);
	var tc = (ax - bx) * (cy - ay) + (ay - by) * (ax - cx);
	var td = (ax - bx) * (dy - ay) + (ay - by) * (ax - dx);

	return tc * td < 0 && ta * tb < 0;
//	return tc * td <= 0 && ta * tb <= 0; // 端点を含む場合
};

function isPolygonAInPolygonB(polygonA, polygonB) {
	// return 1: A in B,  -1: B in A, 0: Unrelated, false: intersects
	// Step 1: Check if all vertices of polygonA are inside polygonB
	var AisInsideMode=undefined;
	var BisInsideMode = undefined;
	
	for (let point of polygonA) {
		var isInside = isPointInPolygon(point, polygonB)
		if ( AisInsideMode === undefined ){
			AisInsideMode = isInside;
		} else if ( AisInsideMode ){
			if ( !isInside){ return false } // 交差
			// AisInsideModeなら通過
		} else {
			if ( isInside){ return false }
			// 無関係なら通過
		}
	}
	//console.log("AisInsideMode",AisInsideMode);
	// この段階でAisInsideModeならBisInsideModeの判定不要
	// AisInsideModeでないときは、無関係かBisInsideModeのどちらか
	if ( !AisInsideMode){
		for (let point of polygonB) {
			var isInside = isPointInPolygon(point, polygonA);
			if ( BisInsideMode === undefined ){
				BisInsideMode = isInside;
			} else if ( BisInsideMode ){
				if ( !isInside){ return false } // 交差
				// BisInsideModeなら通過
			} else {
				if ( isInside){ return false }
				// 無関係なら通過
			}
		}
	}
	//console.log("BisInsideMode",BisInsideMode);

	// Step 2: Check if any edges of polygonA intersect with edges of polygonB
	for (let i = 0; i < polygonA.length; i++) {
		let edgeA = [polygonA[i], polygonA[(i + 1) % polygonA.length]];
		for (let j = 0; j < polygonB.length; j++) {
			let edgeB = [polygonB[j], polygonB[(j + 1) % polygonB.length]];
			//console.log(edgeA,edgeB);
			if (doEdgesIntersect(edgeA, edgeB)) return false; // 交差
		}
	}

	if ( AisInsideMode){
		return 1;
	} else if ( BisInsideMode ){
		return -1;
	} else {
		return 0;
	}
}

export { isPolygonAInPolygonB };
