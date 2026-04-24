// Description: bitmapVectorizer (Vanilla JSによる軽量ラスタベクタ変換モジュール)
// 輪郭抽出: Moore Neighbor Tracingによる1-bit重複排除スキャン
// 階層化: RDP前の生ピクセル(pts[0])を用いた確実な包含判定によるMultiPolygon構築
// 最適化: RDP法による頂点間引きと、不正な包含(ダブルフィル)の完全排除
//
// License: (MPL v2)
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.

function extractPolygons(data, W, H, binarizerFunc, { epsilon = 1.0, minArea = 4, transformMatrix = null } = {}) {
	const bin = new Uint8Array(W * H);
	for (let i = 0; i < W * H; i++) {
		const r = data[i*4], g = data[i*4+1], b = data[i*4+2], a = data[i*4+3];
		bin[i] = (binarizerFunc(r, g, b, a) < 128) ? 1 : 0;
	}

	const idx = (x, y) => y * W + x;
	const get = (x, y) => (x < 0 || x >= W || y < 0 || y >= H) ? 0 : bin[idx(x, y)];

	const DX = [1, 1, 0,-1,-1,-1, 0, 1];
	const DY = [0, 1, 1, 1, 0,-1,-1,-1];
	const visited = new Uint8Array(W * H);
	const contours = [];

	// 重複のない輪郭抽出
	for (let y = 0; y < H; y++) {
		for (let x = 0; x < W; x++) {
			if (!bin[idx(x, y)]) continue;
			if (visited[idx(x, y)]) continue; // 訪問済みはスキップ

			if (!get(x, y-1)) {
				const pts = mooreTrace(x, y, bin, visited, W, H, DX, DY, 0); // 外枠
				if (pts) contours.push({ pts, isHole: false });
			} else if (!get(x, y+1)) {
				const pts = mooreTrace(x, y, bin, visited, W, H, DX, DY, 4); // 穴
				if (pts) contours.push({ pts, isHole: true });
			}
		}
	}

	const outers = [];
	const holes = [];
	for (const c of contours) {
		const area = Math.abs(shoelace(c.pts));
		if (area < minArea) continue;
		if (c.isHole) holes.push({ pts: c.pts, area });
		else outers.push({ pts: c.pts, area, holes: [] });
	}

	// 面積が小さい外枠から優先して親判定
	outers.sort((a, b) => a.area - b.area);

	// 穴のヒモ付け（実際の頂点 pts[0] を使用）
	for (const hole of holes) {
		const testPt = hole.pts[0]; 
		let parent = null;
		for (const outer of outers) {
			if (isPointInPolygon(testPt, outer.pts)) {
				parent = outer;
				break;
			}
		}
		if (parent) {
			parent.holes.push(hole.pts);
		}
	}

	// 重複ポリゴンの排除（実際の頂点 pts[0] を使用）
	const validOuters = [];
	for (let i = outers.length - 1; i >= 0; i--) {
		const outer = outers[i];
		const testPt = outer.pts[0]; 
		let isInvalidOverlap = false;

		for (const valid of validOuters) {
			// 外枠が、別の確定済み外枠の中に完全に含まれているか？
			if (isPointInPolygon(testPt, valid.pts)) {
				let inHole = false;
				for (const h of valid.holes) {
					if (isPointInPolygon(testPt, h)) {
						inHole = true; // 穴の中の「島」ならセーフ
						break;
					}
				}
				if (!inHole) {
					isInvalidOverlap = true; // 穴の中じゃない＝不正なダブルフィルなので破棄
					break;
				}
			}
		}
		
		if (!isInvalidOverlap) {
			validOuters.push(outer);
		}
	}

	// 行列変換とWinding Orderの適用
	const applyTransformAndWinding = (pts, isInner) => {
		let simplified = rdp(pts, epsilon);
		if (simplified.length < 3) return null;

		if (transformMatrix) {
			const { a, b, c, d, e, f } = transformMatrix;
			simplified = simplified.map(p => [
				a * p[0] + c * p[1] + e,
				b * p[0] + d * p[1] + f
			]);
		}

		const finalArea = shoelace(simplified);
		// GeoJSON仕様: 外枠は反時計回り(正)、穴は時計回り(負)
		if (!isInner && finalArea < 0) simplified.reverse();
		if (isInner && finalArea > 0) simplified.reverse();

		return simplified;
	};

	// 描画用のSVG Path文字列生成
	const resultSvgPaths = [];
	for (const outer of validOuters) {
		const po = applyTransformAndWinding(outer.pts, false);
		if (!po) continue;
		
		let dStr = `M ${po[0][0]},${po[0][1]} `;
		for (let i = 1; i < po.length; i++) dStr += `L ${po[i][0]},${po[i][1]} `;
		dStr += "Z ";

		for (const h of outer.holes) {
			const ph = applyTransformAndWinding(h, true);
			if (!ph) continue;
			dStr += `M ${ph[0][0]},${ph[0][1]} `;
			for (let i = 1; i < ph.length; i++) dStr += `L ${ph[i][0]},${ph[i][1]} `;
			dStr += "Z ";
		}
		resultSvgPaths.push(dStr);
	}

	return { paths: resultSvgPaths };
}

// --- 内部ヘルパー関数 ---
function mooreTrace(sx, sy, bin, visited, W, H, DX, DY, entryDir) {
	const idx = (x, y) => y * W + x;
	const points = [];
	let cx = sx, cy = sy;
	let dir = (entryDir + 6) % 8;
	let limit = W * H * 2;
	let first = true;

	while (limit-- > 0) {
		visited[idx(cx, cy)] = 1;
		points.push([cx + 0.5, cy + 0.5]);
		
		let found = false;
		for (let i = 0; i < 8; i++) {
			const nd = (dir + i) % 8;
			const nx = cx + DX[nd];
			const ny = cy + DY[nd];
			if (nx < 0 || nx >= W || ny < 0 || ny >= H) continue;
			if (bin[idx(nx, ny)]) {
				dir = (nd + 6) % 8;
				cx = nx; cy = ny;
				found = true;
				break;
			}
		}
		if (!found) break; 
		if (!first && cx === sx && cy === sy) break; 
		first = false;
	}
	return points.length >= 3 ? points : null;
}

function rdp(pts, epsilon) {
	if (pts.length <= 2) return pts;
	let maxDist = 0, maxIdx = 0;
	const [ax, ay] = pts[0];
	const [bx, by] = pts[pts.length - 1];
	const dx = bx - ax, dy = by - ay;
	const len2 = dx*dx + dy*dy;

	for (let i = 1; i < pts.length - 1; i++) {
		let d;
		if (len2 === 0) {
			const ex = pts[i][0]-ax, ey = pts[i][1]-ay;
			d = Math.sqrt(ex*ex + ey*ey);
		} else {
			const t = Math.max(0, Math.min(1, ((pts[i][0]-ax)*dx + (pts[i][1]-ay)*dy) / len2));
			const px = ax + t*dx - pts[i][0];
			const py = ay + t*dy - pts[i][1];
			d = Math.sqrt(px*px + py*py);
		}
		if (d > maxDist) { maxDist = d; maxIdx = i; }
	}

	if (maxDist > epsilon) {
		const left  = rdp(pts.slice(0, maxIdx + 1), epsilon);
		const right = rdp(pts.slice(maxIdx), epsilon);
		return [...left.slice(0, -1), ...right];
	}
	return [pts[0], pts[pts.length - 1]];
}

function shoelace(pts) {
	let s = 0;
	for (let i = 0, n = pts.length; i < n; i++) {
		s += pts[i][0]*pts[(i+1)%n][1] - pts[(i+1)%n][0]*pts[i][1];
	}
	return s / 2;
}

function isPointInPolygon(point, vs) {
	let x = point[0], y = point[1];
	let inside = false;
	for (let i = 0, j = vs.length - 1; i < vs.length; j = i++) {
		let xi = vs[i][0], yi = vs[i][1];
		let xj = vs[j][0], yj = vs[j][1];
		
		// 点が境界線上にぴったり乗っている場合は「内包している」とみなす
		const onSegment = (
			Math.min(xi, xj) <= x && x <= Math.max(xi, xj) &&
			Math.min(yi, yj) <= y && y <= Math.max(yi, yj) &&
			Math.abs((yj - yi) * (x - xi) - (y - yi) * (xj - xi)) < 1e-5
		);
		if (onSegment) return true;

		let intersect = ((yi > y) != (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
		if (intersect) inside = !inside;
	}
	return inside;
}

export { extractPolygons };
