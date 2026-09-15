import { jest } from "@jest/globals";
import { CsvMapper } from "../CsvMapper.js";
import { csvCodec, parseCsv, parseCsvRow, serializeCsv, serializeCsvRow, generateCsv } from "../parseCsv.js";

afterEach(() => jest.restoreAllMocks());

test("CSVは引用符・カンマ・改行・空セルと数値を保持して往復する", () => {
  const rows = [["A,B", 'x"y\r\nz', "", 0, null], [""], ["\uFEFF文字列"], ["  ", "'quoted'"]];
  expect(parseCsv(serializeCsv(rows))).toEqual(rows.map(row => row.map(v => String(v ?? ""))));
  expect(parseCsv('\uFEFFlatitude,longitude\r\n0,139\r\n')).toEqual([["latitude", "longitude"], ["0", "139"]]);
  expect(parseCsvRow(serializeCsvRow(rows[0]))).toEqual(["A,B", 'x"y\r\nz', "", "0", ""]);
  expect(() => parseCsvRow("a\nb")).toThrow("one CSV record");
});

test("既存のgenerateCsvはクレンジング仕様を維持する", () => {
  expect(generateCsv([["A,B", 'x"y\nz', 0, null]])).toBe("A;B,xyz,0,");
});

function createMapper(options = {}) {
  const svgImage = new DOMParser().parseFromString('<svg xmlns="http://www.w3.org/2000/svg"><defs><g id="p0"/></defs></svg>', "image/svg+xml");
  const svgMap = { refreshScreen: jest.fn(), getGeoViewBox: () => ({ x: 139, y: 35, width: 1, height: 1 }) };
  return new CsvMapper({ csvCodec, svgImage, svgMap, svgImageProps: { scale: 1 }, ...options });
}

test.each([false, true])("CsvMapperの通常/QTCT描画と出力がセル内容を保持する（QTCT=%s）", async (qtct) => {
  jest.spyOn(console, "log").mockImplementation(() => {});
  const mapper = createMapper();
  if (qtct) mapper.QTCTth = 1;
  const rows = [["latitude", "longitude", "name", "note"], ["35.68", "139.7", '地点,"A"', "1行目\n2行目"]];
  await mapper.initCsv(serializeCsv(rows), 0, 1, 2, 0, undefined, 1);
  if (qtct) mapper.preRenderFunction();
  const marker = mapper.svgImage.querySelector("use");
  expect(marker.getAttribute("xlink:title")).toBe('地点,"A"');
  expect(parseCsvRow(marker.getAttribute("content"))).toEqual(rows[1]);
  expect(parseCsv((await mapper.getCsvAsync()).join("\n"))).toEqual(rows);
  if (qtct) {
    mapper.csv = null;
    expect(parseCsv((await mapper.getCsvAsync()).join("\n"))).toEqual(rows);
  }
});

test("0座標を描画し、空欄・Infinityは欠損として除外する", async () => {
  const mapper = createMapper();
  await mapper.initCsv("lat,lng,name\n0,139,赤道\n35,0,本初子午線\n,139,空欄\nInfinity,139,無限", 0, 1, 2, 0, undefined, 1);
  expect(Array.from(mapper.svgImage.querySelectorAll("use"), e => e.getAttribute("xlink:title"))).toEqual(["赤道", "本初子午線"]);
});

test("生成コールバックはCsvMapperでも利用でき、clearMapで削除される", async () => {
  const mapper = createMapper({ createPoi: ({ svgImage }) => svgImage.createElement("circle") });
  mapper.svgImage.insertBefore(mapper.svgImage.createComment("header"), mapper.svgImage.documentElement);
  await mapper.initCsv("lat,lng,name\n35,139,A", 0, 1, 2, 0, undefined, 1);
  expect(mapper.svgImage.querySelector("circle")).not.toBeNull();
  mapper.clearMap();
  expect(mapper.svgImage.querySelector("circle")).toBeNull();
  expect(mapper.svgImage.querySelector("defs")).not.toBeNull();
});

test("CSV編集も引用符と改行を失わず検索・更新・削除する", async () => {
  const mapper = createMapper();
  const original = ["35", "139", "A,B"];
  const replacement = ["35", "139", 'A"B\nC'];
  await mapper.initCsv(serializeCsv([["lat", "lng", "name"], original]), 0, 1, 2, 0, undefined, 1);
  expect(await mapper.editCsv("replace", serializeCsvRow(replacement), serializeCsvRow(original))).toBe(true);
  expect(parseCsvRow(mapper.getCsv()[1])).toEqual(replacement);
  expect(await mapper.editCsv("delete", serializeCsvRow(replacement))).toBe(true);
  expect(mapper.getCsv()).toHaveLength(1);
});

test("通常CSVも非同期出力の途中でクリアされたら古い行を返さない", async () => {
  const mapper = createMapper();
  mapper.csv = ["lat,lng,name", "35,139,old"];
  const pending = mapper.getCsvAsync();
  mapper.clearMap();
  await expect(pending).rejects.toMatchObject({ name: "AbortError" });
});

test.each([false, true])("コーデック未指定時は既存CSVの形式を維持する（QTCT=%s）", async qtct => {
  const mapper = createMapper({ csvCodec: undefined });
  if (qtct) mapper.QTCTth = 1;
  await mapper.initCsv('lat,lng,name\n35,139,"A,B"', 0, 1, 2, 0, undefined, 1);
  if (qtct) mapper.preRenderFunction();
  expect(mapper.getCsv()).toEqual(["lat,lng,name", "35,139,A;B"]);
  expect(mapper.svgImage.querySelector("use").getAttribute("content").split(",")).toEqual(["35", "139", "A;B"]);
  if (qtct) {
    mapper.csv = null;
    expect(await mapper.getCsvAsync()).toEqual(["lat,lng,name", "35,139,A;B"]);
  } else {
    expect(await mapper.editCsv("replace", '35,139,"C,D"', '35,139,"A,B"')).toBe(true);
    expect(mapper.getCsv()[1]).toBe("35,139,C;D");
  }
});
