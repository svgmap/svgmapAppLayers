# IoT百葉箱 LaWA

内田洋行「IoT百葉箱」の公開APIをSVGMap上で表示するLaWAです。

## 使用API

- データ種別・単位: `https://iot100.uchida.co.jp/iot100api/public/info/weatherdatatype/`
- 観測地点一覧: `https://iot100.uchida.co.jp/iot100api/public/getnodelist/`
- 地点別の直近24時間: `https://iot100.uchida.co.jp/iot100api/public/getweather/[NodeID]`
- 撮影画像: `https://iot100.uchida.co.jp/iot100api/public/getscene/[NodeID]/1/original/[YYYYMMDDHHmm]/`

地点一覧はレイヤー表示時に取得し、地点別データと最新観測時刻に対応する撮影画像はピンをクリックした時だけ取得します。

各ピンは地点固有の`NodeID`を持つ`circle.clickable`として描画しています。これは、`svgImageProps.isClickable`が親側へ共有されず、`use`要素の参照先がクリック対象になるS-LaWAでも、選択地点の観測詳細表示を有効にするためです。

## CORS

2026年7月22日の確認時点で、APIレスポンスに`Access-Control-Allow-Origin`がなく、ブラウザからの直接取得はCORSで失敗します。

このLaWAはJSON APIの取得に`svgMap.getCORSURL()`を使用します。撮影画像は`img`要素で表示します。通常LaWAでは親SVGMapのCORSプロキシを、S-LaWAではコントローラー相対またはオリジンルートの`slawa-config.json`を使用します。どちらの場合も、プロキシ側で`iot100.uchida.co.jp`を許可してください。

## テスト

ルートディレクトリで`npm test -- --runInBand`を実行します。地点マーカーのS-LaWA互換性、絞り込み、メタデータ解析、通常LaWA／S-LaWA共通のPOI登録、連続リクエスト時の競合を確認します。

## 利用上の注意

出典を明記し、公開データを加工して表示しています。公式サイトの案内に従い、教育研究目的で利用してください。防災目的の気象観測値としては使用できません。
