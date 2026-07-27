# 関東バス リアルタイム運行情報 (LaWA)

[公共交通オープンデータセンター](https://ckan.odpt.org/ja/dataset/odpt_kanto_bus_all_lines)が提供する関東バスのGTFS Realtimeデータを取得し、SVGMap上に表示するレイヤーアプリケーションです。

車両位置は地図上に常時表示し、ルート更新情報または運行情報を選択した場合は、詳細をコントローラー画面の一覧に表示します。

## 主な機能

- 車両位置 (`VehiclePosition`) の地図表示
- 走行中、停車中、5分以上更新のない車両の色分け
- 車両アイコンを選択した際の車両・便・位置情報表示
- ルート更新情報 (`TripUpdate`) の一覧、遅延・到着出発予測の表示
- `TripUpdate` に対応する車両の地図上での選択
- 運行情報 (`Alert`) の一覧、対象・原因・影響・有効期間の表示
- 路線ID、便ID、車両IDなどによる一覧の絞り込み
- 30秒ごとの自動更新と手動更新

## 表示方法

`Container.svg`に次の`animation`要素を追加します。例示した`https://your-proxy.example`は、後述するプロキシのベースURLに置き換えてください。

```xml
<animation
  x="-30000"
  y="-30000"
  width="60000"
  height="60000"
  xlink:href="./appLayers/publicTransportation/odptRealtimeKantoBusAllLinesVehicle/odptRealtimeKantoBusAllLinesVehicle.svg#proxy=https://your-proxy.example"
  data-cross-origin-proxy-required="true"
  class="公共交通"
  title="関東バス リアルタイム運行情報"
  visibility="hidden"/>
```

SVGMapをHTTP(S)サーバーで配信し、レイヤー一覧から「関東バス リアルタイム運行情報」を有効にします。

## 操作方法

「表示データ」から次のいずれかを選択します。

- **車両位置**: 車両アイコンをクリックすると詳細情報を表示します。
- **ルート更新情報**: 便を開くと停留所ごとの到着・出発予測を表示し、対応する車両が存在する場合は地図上で赤色に強調します。
- **運行情報**: 情報を開くと対象路線や停留所、原因、影響、有効期間などを表示します。

車両位置は選択中のデータ種別にかかわらず取得・更新されます。「今すぐ更新」を押すと、自動更新を待たずに最新データを取得します。

### 車両アイコンの凡例

| 色 | 状態 |
| --- | --- |
| 青 | 走行中 |
| オレンジ | 停車中 |
| グレー | 車両データ時刻から5分以上経過 |
| 赤 | `TripUpdate`から選択された車両 |

## プロキシ要件

このレイヤーはODPT APIへ直接アクセスせず、次のエンドポイントを持つプロキシを介してデータを取得します。

| データ | メソッドとパス |
| --- | --- |
| 車両位置 | `GET {PROXY_BASE_URL}/gtfs/kantobus/vehicles` |
| ルート更新情報 | `GET {PROXY_BASE_URL}/gtfs/kantobus/trip` |
| 運行情報 | `GET {PROXY_BASE_URL}/gtfs/kantobus/alert` |

各エンドポイントは、GTFS Realtimeの`FeedMessage`をProtocol Buffersのバイナリ形式で返す必要があります。プロキシ側では次の処理を行ってください。

- ODPT APIのアクセストークンを付与して関東バスの各フィードを取得する
- ブラウザーへProtocol Buffersのレスポンスをそのまま返す
- レイヤーと異なるオリジンで配信する場合は、適切なCORSレスポンスヘッダーを付与する
- アクセストークンをブラウザーへ公開しない

`#proxy=...`を省略した場合、レイヤーはHTMLからの相対パス`./gtfs/kantobus/...`へアクセスします。同一オリジンのサーバーで同じエンドポイントを提供する場合に利用できます。

## データと更新

- 初回表示時とデータ種別の変更時に取得します。
- 表示中は30秒ごとに再取得します。
- ルート更新情報または運行情報の表示時は、選択したフィードと車両位置フィードを取得します。
- 緯度・経度がない、または範囲外の車両は地図に表示しません。
- フィードに含まれない項目は空欄または「不明」として表示します。

表示内容はリアルタイムフィードの配信状況に依存します。運行判断には交通事業者が提供する公式情報を確認してください。

## ファイル構成

- `odptRealtimeKantoBusAllLinesVehicle.svg`: 地図上のシンボルとコントローラー定義
- `odptRealtimeKantoBusAllLinesVehicle.html`: 操作画面とスタイル
- `odptRealtimeKantoBusAllLinesVehicle.js`: データ取得、描画、一覧表示、更新処理
- `gtfsRealtime.js`: このレイヤーで使用するGTFS Realtimeデータのデコーダー

`gtfsRealtime.js`は、このレイヤーが表示に使用するフィールドをデコードするための実装です。汎用的なGTFS Realtimeライブラリとしての利用は想定していません。

## データ利用条件

データの利用前に、公共交通オープンデータセンターの[関東バス株式会社リアルタイム情報](https://ckan.odpt.org/ja/dataset/odpt_kanto_bus_all_lines)に記載された公共交通オープンデータ基本ライセンスおよび特定利用条件を確認してください。

GTFS Realtimeの各項目については、[GTFS Realtimeリファレンス](https://gtfs.org/ja/documentation/realtime/reference/)を参照してください。
