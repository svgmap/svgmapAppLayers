// Description:
// parseCsv module
// Geminiに開発を依頼したRFC4180 CSVパーサをもとに、ChatGPTで改良したらしい
//
// License: (MPL v2)
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.
// 

function parseCsv(text) {
  const result = [];
  let currentField = "";
  let inQuote = false;
  let currentRow = [];

  for (let i = 0; i < text.length; i++) {
    const char = text[i];

    if (inQuote) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          currentField += '"';
          i++;
        } else {
          inQuote = false;
        }
      } else {
        currentField += char;
      }
    } else {
      if (char === '"') {
        inQuote = true;
      } else if (char === ',') {
        currentRow.push(currentField);
        currentField = "";
      } else if (char === '\r' || char === '\n') {
        if (currentField !== "" || currentRow.length > 0) {
          currentRow.push(currentField);
          result.push(currentRow);
        }
        currentField = "";
        currentRow = [];
        if (char === '\r' && text[i + 1] === '\n') {
          i++;
        }
      } else {
        currentField += char;
      }
    }
  }

  // 最後のフィールドと行を処理
  if (currentField !== "" || currentRow.length > 0) {
    currentRow.push(currentField);
    result.push(currentRow);
  }

	/**
	var lc=0;
	result.forEach(function(line){
		if(lc!=line.length){
			console.log("length err",line.length,line);
		}
		lc = line.length;
		line.forEach(function(cell){
			if (cell.indexOf(`"`)>=0){
				console.log("has double quote :", cell);
			} else if (cell.indexOf(`\n`)>=0 || cell.indexOf(`\r`)>=0){
				console.log("has cr or lf :", cell);
			} else if (cell.indexOf(`,`)>=0){
				console.log("has comma :", cell);
			}
		});
	});
	**/
  return result;
}


// CSVのセルをクレンジングする関数
function cleanseCsvCell(cell) {
  // カンマをセミコロンに置き換え
  let cleansedCell = cell.replace(/,/g, ';');

  // ダブルクオーテーション、改行を削除
  cleansedCell = cleansedCell.replace(/[\"\r\n]/g, '');

  return cleansedCell;
}

// 二次元配列からクレンジング済みCSV文字列を生成する関数
function generateCsv(data) {
  return data
    .map(row => row
      .map(cell => cleanseCsvCell(cell))
      .join(",") // カンマ区切りで1行を生成
    )
    .join("\r\n"); // 行をCRLFで結合
}

export{parseCsv, generateCsv, cleanseCsvCell}