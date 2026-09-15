// Description:
// parseCsv module
// 概ねRFC4180に対応した CSVパーサ
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
  let rowStarted = false;
  if (text.startsWith("\uFEFF")) text = text.slice(1);

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
        rowStarted = true;
      } else if (char === ',') {
        currentRow.push(currentField);
        currentField = "";
      } else if (char === '\r' || char === '\n') {
        if (rowStarted || currentField !== "" || currentRow.length > 0) {
          currentRow.push(currentField);
          result.push(currentRow);
        }
        currentField = "";
        currentRow = [];
        rowStarted = false;
        if (char === '\r' && text[i + 1] === '\n') {
          i++;
        }
      } else {
        currentField += char;
      }
    }
  }

  // 最後のフィールドと行を処理
  if (rowStarted || currentField !== "" || currentRow.length > 0) {
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
  let cleansedCell = String(cell ?? "").replace(/,/g, ';');

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

// クレンジングを行わず、カンマ・引用符・セル内改行・空文字を保持する。
function serializeCsvRow(row) {
  return row.map(value => {
    const cell = String(value ?? "");
    return cell === "" || cell.startsWith("\uFEFF") || /[",\r\n]/.test(cell)
      ? '"' + cell.replace(/"/g, '""') + '"'
      : cell;
  }).join(",");
}

function serializeCsv(rows, lineEnding = "\r\n") {
  return rows.map(serializeCsvRow).join(lineEnding);
}

// content属性や、改行を含む単一レコードの読み取り用。
function parseCsvRow(text) {
  const rows = parseCsv(text);
  if (rows.length > 1) throw new Error("Expected one CSV record");
  return rows[0] ?? [""];
}

// CsvMapper / QTCTLayerRendererへ渡す、値保持を明示的に選ぶオプション。
const csvCodec = Object.freeze({
  parse: parseCsv, parseRow: parseCsvRow, serialize: serializeCsv, serializeRow: serializeCsvRow
});

export { csvCodec, parseCsv, parseCsvRow, serializeCsv, serializeCsvRow, generateCsv, cleanseCsvCell };
