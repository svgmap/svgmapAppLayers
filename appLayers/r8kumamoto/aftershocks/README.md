# 令和8年熊本地震 本震・最新地震活動 LaWA

気象庁防災情報XMLの高頻度（地震火山）フィードから「震源・震度に関する情報」を取得し、熊本周辺の地震を表示するT-LaWAです。

- フィード: `https://www.data.jma.go.jp/developer/xml/feed/eqvol.xml`
- 詳細: `https://www.data.jma.go.jp/developer/xml/data/*.xml`
- 形式: Atom XML / JMAXML
- 確認日: 2026-08-05
- CORS: `www.data.jma.go.jp` の `/developer/xml/feed/` と `/developer/xml/data/` を `svgMap.getCORSURL()` 経由で取得します。

公開フィードは全期間アーカイブではないため、表示は保持期間内に限られます。本震（2026-07-28 16:27、M7.1）は気象庁の発震機構解を固定表示します。

```sh
npm test -- --config appLayers/r8kumamoto/aftershocks/jest.config.js --runInBand
```
