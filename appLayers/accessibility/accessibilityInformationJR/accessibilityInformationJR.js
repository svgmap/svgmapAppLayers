// JR駅バリアフリー情報CSVをSVGMapのPOIとして動的に描画する。

const accessibilityInformationJRService = "https://www.hokoukukan.go.jp/uploads/22/10/mlit_jr_sta1.csv";
let csvRows = [];
const displayColumns = [
  "鉄道事業者名",
  "鉄道駅の名称",
  "路線名",
  "都道府県",
  "市",
  "町村",
  "段差への対応",
  "プラットホームの数",
  "段差が解消されているプラットホームの数",
  "エレベーターの設置基数",
  "移動等円滑化基準に適合しているエレベーターの設置基数",
  "エスカレーターの設置基数",
  "移動等円滑化基準に適合しているエスカレーターの設置基数",
  "傾斜路の設置箇所数",
  "移動等円滑化基準に適合している傾斜路の設置箇所数",
  "視覚障害者誘導用ブロックの設置の有無",
  "案内設備の設置の有無",
  "障害者対応型便所の設置の有無",
  "障害者対応型改札口の設置の有無",
  "障害者対応型券売機の設置の有無",
  "車いす使用者の円滑な乗降が可能なプラットホームの数",
  "転落防止のための設備の設置の有無",
  "緯度",
  "経度",
  "場所情報コード"
];

onload = function(){
  initPoiDialog();
  void loadAndDrawAccessibilityInformationJR();
};

function initPoiDialog(){
  if (typeof svgMap !== "undefined" && typeof layerID !== "undefined") {
    svgMap.setShowPoiProperty(showStationDialog, layerID);
  }
  if (typeof svgImageProps !== "undefined") {
    svgImageProps.isClickable = { value: true, hilightStrokeStyle: {} };
  }
}

async function loadAndDrawAccessibilityInformationJR(){
  setMessage("CSVを読み込み中...");
  setCount("-");
  try {
    const csvText = await fetchCsvText(accessibilityInformationJRService);
    csvRows = parseCsv(csvText);
    drawStations(csvRows);
    setMessage("");
  } catch (error) {
    console.error(error);
    setMessage("CSVを読み込めませんでした: " + error.message);
  }
}

async function fetchCsvText(url){
  let response = await fetch(svgMap.getCORSURL(url), { cache: "no-cache" });

  if (!response.ok) {
    throw new Error(response.status + " " + response.statusText);
  }

  const buffer = await response.arrayBuffer();
  try {
    return new TextDecoder("shift-jis").decode(buffer);
  } catch (error) {
    return new TextDecoder("utf-8").decode(buffer);
  }
}

function parseCsv(csvText){
  const rows = [];
  let row = [];
  let field = "";
  let inQuote = false;

  for (let i = 0; i < csvText.length; i++) {
    const char = csvText[i];
    const next = csvText[i + 1];

    if (char === '"') {
      if (inQuote && next === '"') {
        field += '"';
        i++;
      } else {
        inQuote = !inQuote;
      }
    } else if (char === "," && !inQuote) {
      row.push(field);
      field = "";
    } else if ((char === "\n" || char === "\r") && !inQuote) {
      if (char === "\r" && next === "\n") {
        i++;
      }
      row.push(field);
      if (row.some(function(value){ return value !== ""; })) {
        rows.push(row);
      }
      row = [];
      field = "";
    } else {
      field += char;
    }
  }

  row.push(field);
  if (row.some(function(value){ return value !== ""; })) {
    rows.push(row);
  }
  return rows;
}

function drawStations(rows){
  removeChildren(svgImage.getElementById("mapContents"));
  if (!rows || rows.length < 2) {
    setCount("0");
    return;
  }

  const header = rows[0].map(function (value) {
    return value.trim();
  });
  const latCol = header.indexOf("緯度");
  const lngCol = header.indexOf("経度");
  const stationNameCol = header.indexOf("鉄道駅の名称");
  const lineNameCol = header.indexOf("路線名");
  const lineUnitCol = header[3] === "単位" ? 3 : -1;
  const stepFreeCol = header.indexOf("段差への対応");
  const propertyColumns = getExistingDisplayColumns(header);

  if (latCol < 0 || lngCol < 0) {
    throw new Error("緯度・経度列が見つかりません");
  }

  svgImage.documentElement.setAttribute("property", propertyColumns.join(","));

  const parentElement = svgImage.getElementById("mapContents");
  let drawnCount = 0;
  for (let i = 1; i < rows.length; i++) {
    const row = normalizeRow(rows[i], header.length);
    const lat = Number(row[latCol]);
    const lng = Number(row[lngCol]);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      continue;
    }

    const useElement = svgImage.createElement("use");
    useElement.setAttribute("xlink:href", getSymbolId(row[stepFreeCol]));
    useElement.setAttribute("content", getContentValue(getDisplayRow(row, header, propertyColumns)));
    useElement.setAttribute("x", 0);
    useElement.setAttribute("y", 0);
    useElement.setAttribute("transform", "ref(svg," + lng + "," + (-lat) + ")");
    useElement.setAttribute("xlink:title", getStationTitle(row, stationNameCol, lineNameCol, lineUnitCol));
    parentElement.appendChild(useElement);
    drawnCount++;
  }

  setCount(drawnCount + "件");
  svgMap.refreshScreen();
}

function showStationDialog(target){
  const schemaText = target.ownerDocument.documentElement.getAttribute("property") || "";
  const metaSchema = schemaText ? schemaText.split(",") : [];
  const metaData = target.getAttribute("content") ? svgMap.parseEscapedCsvLine(target.getAttribute("content")) : [];
  const title = target.getAttribute("data-title") || target.getAttribute("xlink:title") || "JR駅";
  let message = "<table border='1' style='word-break: break-all;table-layout:fixed;width:100%;border-collapse: collapse;font-size:12px'>";
  message += "<tr><th style='width:40%'>項目</th><th>値</th></tr>";
  message += "<tr><td>名称</td><td>" + escapeHtml(title) + "</td></tr>";

  for (let i = 0; i < metaSchema.length; i++) {
    const value = metaData[i] || "";
    if (value === "") {
      continue;
    }
    message += "<tr><td>" + escapeHtml(metaSchema[i]) + "</td><td>" + escapeHtml(value) + "</td></tr>";
  }

  message += "</table>";
  svgMap.showModal(message, 400, 600);
}

function getContentValue(values){
  return values.map(escapeCsvField).join(",");
}

function escapeCsvField(value){
  value = value == null ? "" : String(value);
  if (value.indexOf(",") >= 0 || value.indexOf('"') >= 0 || value.indexOf("\n") >= 0 || value.indexOf("\r") >= 0) {
    return '"' + value.replace(/"/g, '""') + '"';
  }
  return value;
}

function escapeHtml(value){
  return String(value).replace(/[&<>"']/g, function(char){
    return {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    }[char];
  });
}

function getExistingDisplayColumns(header){
  return displayColumns.filter(function(columnName){
    return header.indexOf(columnName) >= 0;
  });
}

function getDisplayRow(row, header, propertyColumns){
  return propertyColumns.map(function(columnName){
    return row[header.indexOf(columnName)] || "";
  });
}

function normalizeRow(row, length){
  const normalized = row.slice(0, length);
  while (normalized.length < length) {
    normalized.push("");
  }
  return normalized;
}

function getSymbolId(stepFreeValue){
  if (stepFreeValue === "○") {
    return "#stationStepFree";
  }
  if (stepFreeValue === "×") {
    return "#stationNotStepFree";
  }
  return "#stationUnknown";
}

function getStationTitle(row, stationNameCol, lineNameCol, lineUnitCol){
  const stationName = stationNameCol >= 0 ? row[stationNameCol] : "";
  const lineName = lineNameCol >= 0 ? row[lineNameCol] : "";
  const lineUnit = lineUnitCol >= 0 ? row[lineUnitCol] : "";
  let routeName = lineName;
  if (lineName && lineUnit && !lineName.endsWith(lineUnit)) {
    routeName = lineName + lineUnit;
  }
  if (stationName && lineName) {
    return stationName + "駅 (" + routeName + ")";
  }
  return stationName || lineName || "JR駅";
}

function removeChildren(element){
  while (element && element.firstChild) {
    element.removeChild(element.firstChild);
  }
}

function setMessage(message){
  if (typeof messageDiv !== "undefined") {
    messageDiv.innerText = message;
  }
}

function setCount(count){
  if (typeof countCell !== "undefined") {
    countCell.innerText = count;
  }
}