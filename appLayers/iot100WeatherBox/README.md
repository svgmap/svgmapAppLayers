# IoT百葉箱 LaWA

内田洋行「IoT百葉箱」の公開APIをSVGMap上で表示するLaWAです。

## 使用API

- データ種別・単位: `https://iot100.uchida.co.jp/iot100api/public/info/weatherdatatype/`
- 観測地点一覧: `https://iot100.uchida.co.jp/iot100api/public/getnodelist/`
- 地点別の直近24時間: `https://iot100.uchida.co.jp/iot100api/public/getweather/[NodeID]`
- 撮影画像: `https://iot100.uchida.co.jp/iot100api/public/getscene/[NodeID]/1/original/[YYYYMMDDHHmm]/`

地点一覧はレイヤー表示時に取得し、地点別データと最新観測時刻に対応する撮影画像はピンをクリックした時だけ取得します。

## CORS

2026年7月22日の確認時点で、APIレスポンスに`Access-Control-Allow-Origin`がなく、ブラウザからの直接取得はCORSで失敗します。

このLaWAはJSON APIの取得に`svgMap.getCORSURL()`を使用します。撮影画像は`img`要素で表示します。親SVGMapにCORSプロキシを設定し、プロキシ側で`iot100.uchida.co.jp`を許可してください。`Container.svg`のレイヤー定義にも`data-cross-origin-proxy-required="true"`を設定しています。

## 利用上の注意

出典を明記し、公開データを加工して表示しています。公式サイトの案内に従い、教育研究目的で利用してください。防災目的の気象観測値としては使用できません。
