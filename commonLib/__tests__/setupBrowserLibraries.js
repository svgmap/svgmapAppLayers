import { createRequire } from "node:module";
import { TextDecoder, TextEncoder } from "node:util";

// vendored unzipitはNode判定時にCommonJSのmodule.requireを参照する。
// ESMのJest内でも実ライブラリを読み込めるよう、実際のNode requireを渡す。
globalThis.module = { require: createRequire(import.meta.url) };
globalThis.TextDecoder ??= TextDecoder;
globalThis.TextEncoder ??= TextEncoder;
