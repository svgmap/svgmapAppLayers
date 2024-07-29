// HEX文字列形式に文字列データ(UTF-8で)エンコード・デコードする (あえてBase64ではなく)
function hexStr2utf8Str(hexStr){
	let bytes = [...hexStr.matchAll(/[0-9a-f]{2}/g)].map(a => parseInt(a[0], 16));
	var ans = new TextDecoder().decode(new Uint8Array(bytes))
	return ans;
}

function utf8Str2hexStr(instr) {
	function i2hex(i) {
		return ('0' + i.toString(16)).slice(-2);
	}
	//this is the same as unescape(encodeURIComponent(instr))
	const binAry = (new TextEncoder().encode(instr));
	ans = binAry.reduce(function(memo, i) {return memo + i2hex(i)}, '');
	console.log(ans);
	return ans
}
