import { jest } from "@jest/globals";
import { readFileSync } from "node:fs";
import vm from "node:vm";

function context() {
  const ctx = vm.createContext({ document, console, addEventListener: jest.fn() });
  ctx.window = ctx;
  return ctx;
}

test("保存処理は非同期CSVの解決を待って文字列を送信する", async () => {
  document.body.innerHTML = '<input id="title" value="テスト"><div id="message"></div>';
  const ctx = context();
  vm.runInContext(readFileSync(new URL("../tinyFileManagerForCsv.js", import.meta.url), "utf8"), ctx);
  let resolve;
  ctx._int_getSource = () => new Promise(yes => { resolve = yes; });
  ctx.sendData = jest.fn();
  const pending = ctx.registMap("title", "message", "csv");
  expect(ctx.sendData).not.toHaveBeenCalled();
  resolve('{"csv":"a,b"}');
  await pending;
  expect(ctx.sendData.mock.calls[0][0]).toEqual({ title: "テスト", svgmapdata: '{"csv":"a,b"}', type: "csv" });
});

test("CSV出力中にクリアされた場合は保存を送信しない", async () => {
  document.body.innerHTML = '<input id="title" value="テスト"><div id="message"></div>';
  const ctx = context();
  vm.runInContext(readFileSync(new URL("../tinyFileManagerForCsv.js", import.meta.url), "utf8"), ctx);
  ctx._int_getSource = async () => { throw new DOMException("cleared", "AbortError"); };
  ctx.sendData = jest.fn();
  await ctx.registMap("title", "message", "csv");
  expect(ctx.sendData).not.toHaveBeenCalled();
  expect(document.getElementById("message").innerText).toContain("FAIL");
});

test("保存処理は既存の同期コールバックにも対応する", async () => {
  document.body.innerHTML = '<input id="title" value="テスト"><div id="message"></div>';
  const ctx = context();
  vm.runInContext(readFileSync(new URL("../tinyFileManagerForCsv.js", import.meta.url), "utf8"), ctx);
  ctx._int_getSource = () => "a,b";
  ctx.sendData = jest.fn();
  await ctx.registMap("title", "message", "csv");
  expect(ctx.sendData.mock.calls[0][0]).toEqual({ title: "テスト", svgmapdata: "a,b", type: "csv" });
});
