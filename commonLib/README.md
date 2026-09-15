# LaWA / S-LaWA 共通処理

今回の実装範囲は`commonLib/`内のみ。既存LaWAのソース・依存リンク・ルートのテスト設定は変更しない。アプリの共通ライブラリへの移行は別途行う。

## CSVを値を失わずに扱う

```js
import { csvCodec, parseCsv, parseCsvRow, serializeCsv, serializeCsvRow } from "./parseCsv.js";

const rows = parseCsv('id,name\n1,"A,B"');
const csvText = serializeCsv(rows);
const content = serializeCsvRow(["station,1", '名称"A"', "1行目\n2行目"]);
const metadata = parseCsvRow(content);
```

- `serializeCsv`は2次元配列からCSVを生成する。レコード区切りの既定値はCRLF。第2引数で変更できる。
- `serializeCsvRow`は1レコードを生成する。引用符・カンマ・セル内改行をエスケープし、値を置換しない。数値などは文字列化、null/undefinedは空セルになる。
- `parseCsvRow`は1レコード用。引用符内の改行を保持し、複数レコードを渡すと例外になる。
- 旧`generateCsv`と`CsvMapper.simplifyCsv`はクレンジング用として残している。値の保持が必要な処理には使用しない。

値を保持する場合は、`new CsvMapper({ svgMap, svgImage, svgImageProps, layerID, csvCodec })`のように`csvCodec`を指定する。`QTCTLayerRenderer`単体でも同じオプションを使用する。`initCsv`・`editCsv`・POIのcontent・CSV復元がコーデックを共有する。

**未指定時は従来のCSV形式を維持する。** `CsvMapper`はクレンジングとカンマ区切りを使用し、既存の`split(",")`利用者を維持する。値保持への移行時には、アプリ側の読み取り・表示・保存もまとめて対応する。

`csvCodec`指定時、`getCsv`の配列要素は**1つのCSVレコード**であり、セル内改行を含むことがある。`split(",")`や改行での再分割をせず、`parseCsvRow`を使用する。

新規の呼び出しは通常CSV・ZIP共通の`await mapper.getCsvAsync(progressCallback)`を使用する。旧`getCsv`は互換用で、ZIP時のみPromiseを返す。出力中にデータが切り替わった場合は`AbortError`になるため、保存や送信を中止する。

`tinyFileManagerForCsv.registMap`は同期・非同期の取得コールバックに対応する。既存のCSV表示・ダウンロード・保存UIの呼び出し変更は今回行っていない。ZIP出力を利用するUIは、移行時に`getCsvAsync`の完了を待つ必要がある。

## POIの図形だけを変更する

```js
import { QTCTLayerRenderer } from "./QTCTLayerRenderer.js";
import { csvCodec } from "./parseCsv.js";

const renderer = new QTCTLayerRenderer({
  svgMap, svgImage, svgImageProps, layerID, csvCodec,
  iconIdEvaluator: metadata => "p0",
  titleEvaluator: metadata => metadata[1],
  createPoi: ({ svgImage, metadata }) => {
    const circle = svgImage.createElement("circle");
    circle.setAttribute("cx", 0);
    circle.setAttribute("cy", 0);
    circle.setAttribute("r", 7);
    circle.setAttribute("class", "clickable");
    circle.setAttribute("data-station-id", metadata[0]);
    return circle;
  }
});
```

`createPoi`は`svgImage, longitude, latitude, metadata, iconId, title`を受け取り、未接続のElementを返す。nullを返すとその地点の描画を省略する。非同期コールバックは使用しない。

共通処理がtitle・CSV content・座標transformを付与し、親タイルを接続してからPOIを追加する。通常タイル・ZIPタイルで同じコールバックを使用する。指定しなければ従来の`use`を生成する。`CsvMapper`のコンストラクターにも同じオプションを渡せる。

後日の移行では、`ShareCycleQtctRenderer`等の個別実装を、このオプションによるPOI生成へ置き換えられる。今回、既存の個別レンダラーは変更していない。

S-LaWAでベクトルをクリックするには、親コンテナ側のanimationにも`class="clickable"`などのクリック設定が必要。子側の`svgImageProps.isClickable`設定だけでは親に伝わらない。本体のベクトル`use`クリック通知は今回変更していない。

## データの切替と後始末

- `clearData()`はデータ・ZIP状態を消去し、進行中の取得・構築を旧世代として無効化する。描画済みDOMは保持する。
- `reset()`は`clearData()`に加えてQTCTのタイルDOMを削除する。defs・保護グループは保持する。
- `buildQTCTdata()`と`initZippedTile()`は開始時にresetする。完了時はtrue、別の読み込みやクリアで無効になった場合はfalseを返す。実際の読み込みエラーはrejectする。
- `buildQTCTdata(..., removeLatLngMeta=true)`でも入力配列を変更しない。
- 取得済みタイルの反映時とエクスポート時に世代を検査する。旧タイルの完了は、新しい同名タイルのロックを解除しない。
- 無効化は結果の破棄によるもので、HTTP Range通信自体の即時中断を保証しない。

## 配置と検証

`QTCTLayerRenderer.js` / `CsvMapper.js`の静的な依存ファイルは増やしていない。既存のシンボリックリンク経由の読み込みに追加リンクは不要。`csvCodec`を利用するアプリは、移行時に`commonLib/parseCsv.js`を明示的にimportする。

共通ライブラリのテストは、リポジトリルートで次を実行する。

```sh
npm test -- --config commonLib/jest.config.js --runInBand --silent
```

テスト・Jest設定・setupも`commonLib/`内に配置する。Jestのみ、vendored unzipitのNode用CommonJS参照を補うsetupを使用する。ブラウザー用ライブラリはモックへ置換していない。通常の`npm test -- --runInBand`による既存テスト設定は変更しない。

2026-09-11の検証結果：共通ライブラリ19件、既存Leaflet14件、既存シェアサイクル17件が成功。実ブラウザー（Chrome 152）では通常LaWA、クロスオリジンのS-LaWA、CDN版S-LaWA（親@dev2・子@latest）でCSVの往復・従来形式での編集・ZIP取得中のreset・初期化の無効化・非同期出力・既存8か所の別名パスからのimportを確認した。ローカル本体のS-LaWAでは地図上のcircleを実際にクリックし、カンマ入りIDと引用符・改行入り名称の保持を確認した。共通処理を呼ぶ検証用ページでの確認であり、既存LaWA全画面の操作試験ではない。

今回の実装は共通化の第1段階。S-LaWAでの親・子レイヤー情報取得、SVGMap本体のクリック通知、HTTP取得処理と汎用タイル削除範囲は別途対応する。本体の旧`parseEscapedCsvLine`は引用符の完全な復元に対応していないため、値を厳密に読むアプリでは新しい`parseCsvRow`を使用する。
