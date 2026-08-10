# 令和8年熊本地震 復旧・支援活動 LaWA

九州地方整備局の対応状況ページから、給水・入浴・トイレ・照明・復旧活動を抽出して表示するT-LaWAです。

- データ: `https://www.qsr.mlit.go.jp/bousai_joho/r80728kumamotozisinn.html`（HTML）
- 確認日: 2026-08-05
- CORS: `www.qsr.mlit.go.jp` の `/bousai_joho/` を `svgMap.getCORSURL()` 経由で取得します。
- 取得失敗時: 2026-08-05確認時の内蔵スナップショットを明示して表示します。

HTML内に地点名があり、登録済み地点と一致する活動だけを地図化します。同じ地点の複数活動は1点に集約します。地点座標は施設・自治体代表点で、活動範囲を示すものではありません。

```sh
npm test -- --config appLayers/r8kumamoto/supportActivities/jest.config.js --runInBand
```
