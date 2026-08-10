# 令和8年熊本地震 道路状況LaWA 作成プロンプト

あなたはSVGMapとLaWA（Layers as Web Apps）に詳しいシニアWeb/GISエンジニアです。
現在開いているsvgmapAppLayersリポジトリへ、国土交通省「令和8年熊本地震 通れるマップ」の道路状況を表示する、実運用できるLaWAを追加してください。
調査やサンプル提示だけで終わらず、実装、テスト、README、Container.svgへの登録、ローカル環境での動作確認まで完了してください。

## 今回の入力

- LaWA名: 令和8年熊本地震 道路状況
- 目的・利用者ができること:
  - 国土交通省が公開する道路規制、ETC2.0平均速度、民間プローブ通行実績をSVGMap上で確認する
  - 3種類の表示を個別に切り替える
  - 道路規制区間をクリックし、路線、区間、規制内容、理由、開始日時などを確認する
  - 最新データを手動更新する
  - 公開済みの日時別アーカイブを選んで過去時点を表示する
  - データ時点、集計期間、取得時刻、件数、出典、注意事項をUIで確認する
- データ提供元: 国土交通省
- 掲載ページ: https://www.mlit.go.jp/road/saigai/r8kumamoto/index.html
- 最新データ一式: https://www.mlit.go.jp/road/saigai/r8kumamoto/map.zip
- 対象地域: 熊本県を中心とする九州中部・南部（実データ範囲は周辺県を含む）
- 地物・データ形式: ZIP内のUTF-8 GeoJSON FeatureCollection。全レイヤーがLineString
- 表示したい情報:
  - 道路規制情報: 配信GeoJSONの色・透明度・線幅を尊重し、クリック詳細を表示
  - ETC2.0平均速度: 橙=`時速20km以下`、青=`時速21km以上`
  - 民間プローブ通行実績: 赤茶色の通行実績線
  - 公式凡例と注意事項を日本語UIに表示
- 必要な操作: レイヤー別表示切替、時点選択、最新へ戻る、手動更新、読み込み中止、道路規制のクリック詳細
- 更新頻度: 不定期。提供元に更新間隔・レート制限の明記なし。自動ポーリングは行わず、初回取得と手動更新だけにする
- 想定データ件数: 最新データは道路規制44件、ETC2.0 58,576件、通行実績70,749件。ただし後二者は完全重複を多数含む
- 配置希望: `appLayers/r8kumamoto/road/`
- Container.svgの分類・タイトル:
  - 分類: `国交省道路情報`
  - タイトル: `令和8年熊本地震 通れるマップ（道路状況）`
  - 外部取得にプロキシが必要なため `data-cross-origin-proxy-required="true"`
  - 道路規制のクリック詳細があるため `clickable`
- 認証・プロキシ条件: 認証不要。`www.mlit.go.jp` はCORS許可ヘッダーを返さないため `svgMap.getCORSURL()` とContainer.svgのプロキシ指定が必須
- 参考LaWA:
  - `appLayers/mlitRoad/notoEQ2024/`: 同じ国土交通省の災害道路データを扱う既存例。ただし旧式の`onload`依存やHTML文字列挿入はそのまま模倣しない
  - `appLayers/prefecturesJA/okinawa/`: `layerWebAppReady`後の初期化例
  - `appLayers/publicTransportation/shareCycleGbfs/`: UI、通信中断、状態表示、テスト構成の参考
  - `commonLib/unzipit.module.js`: リポジトリ内に同梱済みのZIP展開ライブラリ
- 対応範囲外:
  - 経路探索、通行可否の保証、カーナビ用途
  - 地理院タイルの再実装（SVGMap側のベースマップを使用する）
  - サーバー側でのデータ再配布、定期収集、独自APIの新設
  - 推測による規制状態や速度値の補完
- その他の制約:
  - MPL-2.0ヘッダーを既存規約に合わせて付ける
  - 外部CDNへ新規依存せず、同梱ライブラリを優先する
  - ユーザーの未コミット変更を保持し、特にContainer.svgは対象行だけを編集する

## 2026年8月4日に確認済みのデータソース情報

実装時にも公式ページと実レスポンスを再確認し、READMEの確認日を更新してください。以下の値を永久に固定された仕様とは扱わないでください。

### 公開ページと現在時点

- 掲載ページは「2026年8月3日16時00分時点の最新情報」と表示している
- 公式凡例画像の注記では、道路規制は2026年8月3日14時00分時点、ETC2.0平均速度と通行実績は8月3日13時〜16時の集計
- HTTPの`Last-Modified`は公開・アップロード時刻であり、データ生成時刻や集計期間とは区別する
- 最新ページは後日修正の可能性を明記している。UIとREADMEにも正確性・完全性・即時性を保証しない旨を表示する

### 最新データの実レスポンス

- `map.zip`
  - HTTP 200
  - `Content-Type: application/zip`
  - 約8.39MB、展開後は約124MB
  - `Accept-Ranges: bytes`
- 個別GeoJSON URL:
  - `https://www.mlit.go.jp/road/saigai/r8kumamoto/map/json/dourokisei.geojson`
  - `https://www.mlit.go.jp/road/saigai/r8kumamoto/map/json/ETC2.0_speed_data.geojson`
  - `https://www.mlit.go.jp/road/saigai/r8kumamoto/map/json/tukoujisseki.geojson`
  - いずれもHTTP 200だが`Content-Type: application/octet-stream`
  - JSON用Content-Typeでないため、既知の公式URLに限ってoctet-streamを許容し、その後にJSON構文、FeatureCollection、geometry、座標を厳格に検証する
- `Access-Control-Allow-Origin`は、通常リクエストでもOrigin付きリクエストでも確認できなかった。ブラウザーからの直接取得を前提にしない
- 認証、APIキー、ページネーションはない
- レート制限・推奨更新間隔は明記されていない。自動更新を実装しない

### 最新GeoJSONの実データ概要

1. `dourokisei.geojson`
   - 298,762 bytes、44 Feature、全てLineString、3,708頂点
   - bbox: `[130.425272, 31.858202, 131.328246, 32.92495]`
   - 不正座標0、完全重複Feature 0。同じgeometryで属性が異なるものが1組あるため、geometryだけで重複除去しない
   - 主な属性:
     - `name`, `県名`, `市町村名`, `道路種別`, `路線名`
     - `始点住所`, `終点住所`, `始点`, `終点`
     - `規制種別`, `規制理由`, `規制開始_日時`, `規制開始_内容`, `規制内容`, `規制方向`
     - `規制延長_Km`, `延長_Km`, `始点緯度経度`, `終点緯度経度`
     - `_color`, `_opacity`, `_weight`, `_dashArray`
   - スキーマがFeatureごとに揺れる。欠損を許容し、`規制開始_内容`と`規制内容`、`始点住所`と`始点`、`終点住所`と`終点`、`規制延長_Km`と`延長_Km`を安全に正規化する
   - 確認時の色は`#999999`が27件、`#990000`が17件。色だけから規制状態を推測せず、配信スタイルとテキスト属性を併記する
2. `ETC2.0_speed_data.geojson`
   - 55,777,103 bytes、58,576 Feature、全てLineString、594,410頂点
   - bbox: `[130.380137, 32.098469, 131.218834, 33.159769]`
   - 属性は`_color`, `_opacity`, `_weight`だけ
   - `#0000ff` 48,983件、`#ff9900` 9,593件
   - 完全重複が44,497件。`geometry + properties`の完全一致だけを除去すると14,079件、152,934頂点になる
   - 個別区間の速度数値、時刻、名称は含まれない。色から公式凡例の2区分を示すだけにし、架空の速度値や道路名を表示しない
3. `tukoujisseki.geojson`
   - 64,478,966 bytes、70,749 Feature、全てLineString、677,134頂点
   - bbox: `[130.403133, 32.086778, 131.247633, 33.126331]`
   - 属性は`_color`, `_opacity`, `_weight`だけ
   - 全件`#c0504d`
   - 完全重複が51,970件。`geometry + properties`の完全一致だけを除去すると18,779件、179,829頂点になる
   - 通行実績は一般車の通行可否を保証しない。工事車両等の実績が含まれる可能性を表示する

### 日時別アーカイブ

掲載ページが案内する以下のURLを、固定のホワイトリスト兼選択肢として実装してください。ページHTMLを毎回スクレイピングしてURLを生成しないでください。ただし実装時にリンクの存続と時点表記を再確認してください。

- 2026-07-29 08:00: `https://www.mlit.go.jp/road/saigai/r8kumamoto/260729data.zip`
- 2026-07-29 12:00: `https://www.mlit.go.jp/road/saigai/r8kumamoto/2607291200data.zip`
- 2026-07-30 08:00: `https://www.mlit.go.jp/road/saigai/r8kumamoto/2607300800data.zip`
- 2026-07-30 12:00: `https://www.mlit.go.jp/road/saigai/r8kumamoto/2607301200data.zip`
- 2026-07-30 16:00: `https://www.mlit.go.jp/road/saigai/r8kumamoto/2607301600data.zip`
- 2026-07-31 08:00: `https://www.mlit.go.jp/road/saigai/r8kumamoto/2607310800data.zip`
- 2026-07-31 16:00: `https://www.mlit.go.jp/road/saigai/r8kumamoto/2607311600data.zip`
- 2026-08-01 18:00: `https://www.mlit.go.jp/road/saigai/r8kumamoto/2608011800data.zip`
- 2026-08-02 18:00: `https://www.mlit.go.jp/road/saigai/r8kumamoto/2608021800data.zip`
- 2026-08-03 12:00: `https://www.mlit.go.jp/road/saigai/r8kumamoto/2608031200data.zip`
- 2026-08-03 16:00: `https://www.mlit.go.jp/road/saigai/r8kumamoto/2608031600data.zip`

確認時のFeature数は次のとおりです。件数は検証・負荷試験の目安であり、完全一致を必須にしないでください。

| 時点 | 道路規制 | ETC2.0 | 通行実績 |
|---|---:|---:|---:|
| 7/29 08:00 | 0 | 15,778 | 0 |
| 7/29 12:00 | 29 | 26,110 | 0 |
| 7/30 08:00 | 43 | 42,765 | 44,058 |
| 7/30 12:00 | 43 | 48,159 | 63,597 |
| 7/30 16:00 | 43 | 20,382 | 63,597 |
| 7/31 08:00 | 55 | 47,065 | 38,715 |
| 7/31 16:00 | 55 | 15,171 | 24,426 |
| 8/1 18:00 | 55 | 23,185 | 24,701 |
| 8/2 18:00 | 44 | 17,934 | 48,458 |
| 8/3 12:00 | 44 | 44,319 | 48,387 |
| 8/3 16:00 | 44 | 58,576 | 70,749 |

アーカイブ内の構造は一定ではありません。

- GeoJSONがZIP直下、`json/`配下、`2608011800date/`配下のいずれかにある
- 7月29日のETC2.0は`ETC2.0_speed_data1.geojson`〜`4.geojson`のように分割されるため、全該当ファイルをマージする
- 7月29日8時には道路規制と通行実績がなく、7月29日12時には通行実績がない。欠落をエラーではなく「この時点では収録なし」と表示する
- 掲載ページの説明は履歴対象を道路規制とETC2.0としているが、7月30日以降の実ZIPには通行実績も含まれる。実際のZIP内容を表示し、存在しないデータを推測しない
- `.geojson`、`.zip`、`.png`のようなドットだけの未説明ファイルが一部ZIPに混在する。文書化されたbasenameに一致するGeoJSONだけを対象にし、これらを自動採用しない
- パス全体を固定せず、ZIP内を再帰的に列挙し、basenameで次を分類する:
  - `dourokisei.geojson`
  - `ETC2.0_speed_data*.geojson`
  - `tukoujisseki.geojson`

### 利用条件と出典

- 国土交通省サイトの利用条件: https://www.mlit.go.jp/link.html
- 公共データ利用規約（第1.0版、PDL1.0）: https://www.digital.go.jp/resources/open_data/public_data_license_v1.0
- 国土交通省サイトは、特記がないコンテンツをPDL1.0準拠で利用できるとし、出典記載と、加工時の加工表示を求めている
- UIとREADMEに、少なくとも次を表示する:
  - `出典：国土交通省「令和8年熊本地震 通れるマップ」（掲載ページURL）`
  - `国土交通省公開GeoJSONを重複除去・表示範囲処理して表示`
  - `PDL1.0`と国土交通省の利用条件へのリンク
- 公式凡例は民間プローブ提供元として、トヨタ自動車株式会社、日産自動車株式会社、本田技研工業株式会社、いすゞ自動車株式会社、日野自動車株式会社（順不同）を記載している。UIとREADMEにもこのクレジットを表示する
- PDL1.0は第三者権利を別途確認するよう求める。アプリにはロゴを転載せず、実行時に公式データを取得・可視化する。公開前に民間プローブ由来データの第三者権利条件が追加公表されていないか再確認し、未確認ならREADMEにリスクを明記する
- SVGMapの既存ベースマップを使い、地理院タイルをこのLaWAから直接取得しない

## 実装方針

### 基本ファイル

少なくとも次を`appLayers/r8kumamoto/road/`に作成してください。責務分割は実装に合わせて調整して構いません。

- `r8KumamotoRoad.svg`: CRS84、`data-controller`、道路規制用ベクターグループ、速度・通行実績用画像グループ
- `r8KumamotoRoad.html`: 日本語UI、凡例、状態、時点選択、出典、注意事項
- `r8KumamotoRoad.js`: LaWAのライフサイクル、取得、描画制御、操作、後片付け
- `r8KumamotoData.js`: ZIPエントリー分類、GeoJSON検証、正規化、完全重複除去、時刻定義
- `r8KumamotoRasterRenderer.js`: 大量LineStringの表示範囲ラスタ描画と空間索引
- `archiveManifest.js`: 最新URLと日時別アーカイブの明示的な定義
- `test/`: 外部通信なしで実行できる純粋処理のJestテストと小さなfixture
- `README.md`

新規依存を追加せず、ZIP展開には原則として`../../../commonLib/unzipit.module.js`の`unzip`を使ってください。`commonLib/ZipDataDownloader.js`は外部CDNをimportするため、今回の第一候補にしないでください。

### LaWAライフサイクル

- SVGルートの`data-controller="r8KumamotoRoad.html#exec=appearOnLayerLoad&amp;requiredHeight=..."`からHTMLを参照する
- HTMLで`svgMapLayerLib.js`を読み込む
- `load`や`onload`だけに依存せず、`layerWebAppReady`後に一度だけ初期化する
- `svgMap`、`svgImage`、`svgImageProps`、`layerID`は準備完了後に参照する
- T-LaWAとS-LaWAの両方で動くようにし、`window.parent`のDOMや同一オリジンに依存しない
- `zoomPanMap`はデバウンスし、描画世代トークンで古い描画結果を破棄する
- `beforeunload`等で通信、イベント、デバウンスタイマー、生成したObject URLやCanvas資源を解除する
- 再読込や時点変更で二重初期化、二重リスナー、古い地物の残留を起こさない

### 取得とZIP処理

- 初回は`map.zip`を1回だけ取得する。約8.39MBのZIPを使い、合計約120MBの個別GeoJSONを3本別々に取得しない
- `fetch(svgMap.getCORSURL(url), { signal })`を使い、タイムアウトと`AbortController`を実装する
- プロキシ越しのHEAD/Range対応を前提にしない。通常GETのResponseをBlobまたはArrayBufferにし、`unzip`へ渡す
- `response.ok`、取得サイズ、ZIP展開結果、対象エントリー、JSON構造を検証する
- 読み込み段階を「ダウンロード中」「ZIP展開中」「JSON解析中」「重複除去中」「表示準備中」に分けて表示する
- 同時取得を1件に制限し、時点変更時は前の取得を中止する
- 最新データはセッション内で再利用してよいが、古い時点を最新と誤認させない
- プロキシや取得に失敗した場合、古い内蔵スナップショットを最新として表示しない。前回成功表示を残す場合も「更新失敗・表示中データの時点」を明示する
- `www.mlit.go.jp`以外の任意URLを入力・取得できるUIを作らない

### 検証・正規化・重複除去

- FeatureCollection、features配列、LineString、2点以上のcoordinates、有限数、経度[-180,180]、緯度[-90,90]を検証する
- 座標順はGeoJSON標準どおり`[longitude, latitude]`。CRS84として描画する
- 不正Featureは全体を壊さず除外数をUIに表示する。ただし異常率が高い場合はデータ全体を失敗扱いにする明確な閾値を設ける
- 完全重複のキーは`geometry + 正規化前のproperties`の安定した内容とする。geometryだけが同じで属性が違う道路規制を消さない
- 重複除去件数と表示対象件数をUIとREADMEで説明する
- 外部由来の文字列を`innerHTML`へ連結しない。道路規制詳細は`textContent`とDOM APIで組み立てる
- 規制日時の形式は揺れるため、元文字列を保持し、確実に解釈できるものだけ整形する。タイムゾーンを勝手にUTCへ変換しない
- `_color`は安全なCSS色だけ、`_opacity`は0〜1、`_weight`は上限付き数値として許可し、それ以外は安全な既定値へ落とす

### 描画方式

道路規制とプローブデータで方式を分けてください。

1. 道路規制
   - 数十件なのでFeatureごとのSVG pathとして描画し、属性スキーマと`content`の順序を一致させる
   - クリック詳細を有効にし、欠損値を無理に埋めず、存在する項目だけ日本語で表示する
   - 配信された`_color`, `_opacity`, `_weight`, `_dashArray`を検証後に反映する
2. ETC2.0平均速度・通行実績
   - 数万件を`svgMapGIStool.drawGeoJson()`でFeatureごとのSVG pathへ展開しない
   - 完全重複除去後にFeature bboxと軽量な空間索引を構築する
   - `svgMap.getGeoViewBox()`と連動し、表示範囲と少量の余白に交差する線だけをCanvasへ描き、SVGMap上では各データ種別につき少数の`image`要素として表示する
   - Canvas画像の地理範囲をCRS84のSVG座標へ正しく配置する。経度は`x*100`、緯度はY反転を考慮し、既存の`globalCoordinateSystem matrix(100,0,0,-100,0,0)`と整合させる
   - Canvasの最大ピクセル数とdevicePixelRatioに上限を設け、ズーム・パン中のメモリ急増を防ぐ
   - 表示範囲再描画をデバウンスし、同一viewBox・同一設定なら再利用する
   - ラスタ描画でも配信色、透明度、線幅と3レイヤーの重なり順を再現する
   - 道路規制を最前面に置く
   - 低性能端末でもUI操作をブロックし続けないよう、必要に応じて処理を分割してイベントループへ制御を戻す

描画方式を変更する場合は、DOM要素数、初回表示時間、パン・ズーム応答性、メモリの実測結果で同等以上であることをREADMEに説明してください。

### UIとアクセシビリティ

- 小さなLaWAパネルで使えるレスポンシブな日本語UIにする
- 時点選択は「最新」と11件の日時別アーカイブを明確に区別する
- レイヤー切替:
  - 道路規制情報
  - ETC2.0平均速度
  - 民間プローブ通行実績
- 選択時点にデータがないレイヤーは無効化し、「この時点では収録なし」と表示する
- 「最新を再取得」「読み込み中止」を用意し、多重押下を抑止する
- `role="status"`と`aria-live`を使い、読み込み、成功、0件、部分欠落、失敗、中止を区別する
- データ時点、道路規制時点、プローブ集計期間、アプリ取得時刻を別々に表示する
- 元件数、重複除去後件数、除外件数をデータ種別ごとに表示する
- 凡例は線見本と文章を併記し、色だけに依存しない
- ETC2.0は「20km/h以下」「21km/h以上」、通行実績は「走行実績」であることを明示する
- 道路規制の色から状態を独自推定せず、公式属性の規制内容・理由を詳細表示する
- 次の注意を目立ちすぎないが常に確認可能な位置に置く:
  - 災害時の参考情報であり、実際の通行可否は道路管理者・警察等の最新情報を確認する
  - 通行実績には工事車両等が含まれ、一般車が通行できない場合がある
  - 掲載情報は後日修正される場合がある
- 外部リンクはHTTPSの固定URLだけを許可し、`target="_blank" rel="noopener noreferrer"`を付ける

### Container.svgへの登録

既存の`appLayers/mlitRoad/notoEQ2024/notoRoad.svg`登録付近を参考に、次に相当する`animation`を1件だけ追加してください。既存の未コミット変更を保持し、重複登録しないでください。

- `xlink:href="./appLayers/r8kumamoto/road/r8KumamotoRoad.svg"`
- `title="令和8年熊本地震 通れるマップ（道路状況）"`
- `class="国交省道路情報 clickable batch"`
- `data-cross-origin-proxy-required="true"`
- `visibility="hidden"`
- 既存道路レイヤーと整合する範囲・opacity

READMEにはプロキシ許可ホストとして`www.mlit.go.jp`を明記してください。

## テストと動作確認

最低限、次を実施してください。

1. ZIPエントリー分類:
   - 直下、`json/`、任意の1階層ディレクトリ
   - ETC2.0分割ファイルのマージ
   - ドットだけの未説明ファイルを無視
   - 対象ファイルの欠落と未知ファイル
2. GeoJSON検証:
   - 正常、空、FeatureCollectionでない、geometry欠損、LineString以外、点不足、NaN相当、範囲外座標、未知プロパティ
3. 道路規制正規化:
   - 新旧フィールド名、欠損、日時形式差、危険なHTML文字列、危険な色・線幅
4. 完全重複除去:
   - 完全一致は除去
   - geometry同一・properties差異は保持
   - properties同一・geometry差異は保持
5. 空間索引・表示範囲判定:
   - bbox境界、範囲外、余白、ズーム・パン後の対象集合
6. ラスタ座標変換と色分類の純粋関数テスト
7. archive manifestの時点順、URLホワイトリスト、欠落レイヤー表示
8. 追加Jestテストと既存テストを実行する
9. SVG/XML、HTML、ES moduleパス、Container.svg参照先を検証する
10. ローカルHTTPサーバー上で、初回表示、時点変更、最新復帰、レイヤー切替、道路規制クリック、手動更新、中止、通信失敗を確認する
11. パン・ズームを繰り返し、古い画像、通信、タイマー、イベントリスナーが残らないことを確認する
12. T-LaWAと、可能な環境ではS-LaWAで確認する
13. 実データまたは同等規模fixture生成で、次を記録する:
    - ZIP取得サイズ
    - 展開・JSON解析・重複除去・初回描画の所要時間
    - 重複除去前後のFeature数
    - 生成するSVG DOM要素数
    - パン・ズーム時の応答性

外部プロキシの制約で確認できない項目を確認済みと書かないでください。未確認理由、fixtureによる代替検証、利用者が実環境で確認する手順をREADMEに残してください。

## READMEに必ず含める内容

- LaWAの目的、主な機能、操作方法
- 掲載ページ、最新ZIP、11件の日時別ZIP、確認日
- 3種類のGeoJSON、実測件数、属性、座標系、時点・集計期間
- 可変ZIP構造と分割ETC2.0の扱い
- 完全重複除去の定義と実測効果
- 道路規制のSVG描画と、大量プローブ線の表示範囲ラスタ描画を分けた理由
- CORS、`svgMap.getCORSURL()`、`data-cross-origin-proxy-required`、許可ホスト
- PDL1.0、国土交通省利用条件、出典、加工表示、民間プローブ提供元、第三者権利の注意
- データ時点とHTTP更新時刻を区別する説明
- エラー、中止、欠落レイヤー、古い表示の扱い
- 正確性・完全性・通行可否に関する免責と、実際の道路情報を確認する案内
- ファイル構成、Container.svg登録、テスト手順、ローカル確認手順
- 実測した性能値と既知の制約

## 完了条件

- `appLayers/r8kumamoto/road/`に実装一式が保存されている
- 現行の`data-controller`方式と`layerWebAppReady`で初期化される
- 最新と全11アーカイブの可変ZIP構造を安全に扱える
- CORSプロキシ、認証不要、手動更新方針が実装とREADMEに一致する
- 道路規制は詳細確認でき、プローブ2種は大量DOMを作らず実用的に表示される
- 完全重複だけを除去し、同一geometry・別属性を失わない
- 空、不正、欠落、通信失敗、中止でも既存表示とUIが破綻しない
- 時点、集計期間、取得時刻、出典、加工、民間提供元、注意事項がUIとREADMEに反映される
- Container.svgから参照でき、既存レイヤーと未コミット変更を壊していない
- 関連テストが成功し、ローカルブラウザーで主要操作と性能を確認している
- 未確認事項と公開前の第三者権利再確認が明示されている

## 最終報告

最後に日本語で簡潔に、次の順で報告してください。

1. 完成した機能
2. 追加・変更したファイル
3. データソース、ライセンス、CORS/プロキシ上の重要事項
4. 実施したテスト、ブラウザー確認、性能結果
5. 未確認事項・制限・公開前に必要な作業

説明だけで終わらず、変更ファイルを実際に保存してください。ただし、コミット、push、PR作成、外部公開は明示的に依頼された場合だけ行ってください。