# シェアサイクル・マイクロモビリティ GBFS LaWA

MobilityDataの`systems.csv`から日本のGBFSシステムを特定し、各事業者の
`station_information.json`と`station_status.json`をSVGMap上に表示するLaWAです。

大量のポートを通常のDOMマーカーとして全件描画せず、`ClientSideQTCT.js`と
`QTCTLayerRenderer.js`でクライアントサイドQuad Tree Composite Tilingを行います。
ズームレベルと表示範囲に必要なQTCTタイルだけが描画されます。

## 対応レイヤー

`Container.svg`には、1レイヤーを1事業者・地域として次の4レイヤーを登録しています。

| `system` | レイヤー | 2026-07-28確認時のポート数 |
| --- | --- | ---: |
| `docomo-cycle` | ドコモ・バイクシェア（全国） | 6,044 |
| `docomo-cycle-tokyo` | ドコモ・バイクシェア（東京） | 1,873 |
| `hellocycling` | HELLO CYCLING | 14,771 |
| `toyama` | CyclOcity（富山） | 25 |

件数は変動します。実行時には最新のフィードを取得します。

## データ取得

1. [MobilityData systems.csv](https://raw.githubusercontent.com/MobilityData/gbfs/master/systems.csv)を取得する
2. `Country Code=JP`かつ指定された`System ID`の行を検索する
3. `Auto-Discovery URL`の`gbfs.json`を取得する
4. Discovery文書から`system_information`、`station_information`、
   `station_status`のURLを解決する
5. `station_information`を初回QTCT化し、`station_status`を定期更新する

`systems.csv`を取得できない場合だけ、2026-07-28に確認済みのDiscovery URLへ
フォールバックします。GBFS 2.3の言語別DiscoveryとGBFS 3.0の両方に対応します。

## 表示と更新

- 緑: 利用可能車両が3台以上
- オレンジ: 1〜2台、または収容台数の20%以下
- 赤: 利用可能車両が0台
- グレー: 貸出停止または未設置
- 青: 状況不明

`station_status`の`ttl`を参照しますが、提供元への過剰アクセスを避けるため、
更新間隔は60〜300秒に制限します。CyclOcityの`ttl=1`の場合も60秒未満では
ポーリングしません。

空き状況更新時は緯度経度のQTCT分割を再実行せず、現在表示中のPOIと小縮尺の
集約画像タイルの色だけを更新します。画面にはGBFSデータ生成時刻とアプリ取得時刻を
別々に表示します。

## ライセンス・利用条件

以下は2026-07-28に公式URLとGBFS `system_information`を確認した結果です。
法的助言ではありません。公開前にはリンク先の最新版も確認してください。

| データ | 利用可否 | ライセンス | このLaWAでの対応 |
| --- | --- | --- | --- |
| MobilityData `systems.csv` | 利用可 | [CC BY 3.0](https://github.com/MobilityData/gbfs/blob/master/LICENSE) | 「MobilityData GBFS systems.csv」とライセンスへのリンクを表示 |
| ドコモ・バイクシェア（全国・東京） | 利用可 | GBFSが[CC BY 4.0](https://creativecommons.org/licenses/by/4.0/deed.ja)を指定 | ドコモ・バイクシェアとODPTを出典表示し、ライセンスへリンク |
| HELLO CYCLING | 利用可 | [公式ライセンス文](https://d1yl7kw204zjxn.cloudfront.net/gbfs/v2/public/hellocycling_gbfs_licence.txt)はCC BY 4.0、ODC BY 1.0、ODbL 1.0から選択可 | 本LaWAはCC BY 4.0を選び、OpenStreet株式会社、HELLO CYCLING、ODPTを出典表示 |
| CyclOcity（富山） | 利用可 | [Licence Ouverte / Open Licence 1.0](https://developer.jcdecaux.com/files/Open-Licence-fr.pdf) | CyclOcity / JCDecaux、データ更新時刻、ライセンスへのリンクを表示 |
| kotobike | 現在利用不可 | GBFS API停止のため確認不能 | レイヤーには追加しない |

CC BY 4.0とOpen Licence 1.0はいずれも、条件を守れば商用利用・改変・再配布が
可能です。主な条件は出典とライセンスの明示です。Open Licence 1.0では提供元と
最終更新日も示し、提供元による公式な承認を受けたように表示しない必要があります。

HELLO CYCLINGの公式ライセンス文は3ライセンスからの選択を求めています。このLaWAでは
表示条件が明確なCC BY 4.0を選択しています。別のライセンスを選ぶ派生版では、その条件に
合わせて表示を変更してください。

ODPT経由のデータでは、次も遵守してください。

- [ODPT利用規約](https://developer.odpt.org/terms/center_use_rules.html)と
  データ提供者が指定するライセンスに従う
- [ODPT開発者ガイドライン](https://developer.odpt.org/terms/data_basic_use_guideline.html)に従い、
  動的データの生成時刻、ODPT提供であること、正確性・完全性が保証されないこと、
  アプリ開発者の連絡先を表示する
- 最新データを更新間隔に従って使用し、古い動的データを最新情報のように見せない
- 問い合わせ先は交通事業者ではなくアプリ開発者またはODPT事務局とする
- APIに著しい負荷をかけない。アクセス頻度制限やAPI停止の可能性を前提にする

大量アクセスを伴う商用公開では、キャッシュまたは配信用プロキシを用意し、
[ODPT事務局](https://developer.odpt.org/)へ事前相談することを推奨します。

### kotobikeを除外した理由

MobilityDataの`systems.csv`には2026-07-28時点でもkotobikeが掲載されていますが、
[公式のサービス終了案内](https://kotobike.jp/news/260323)では2026-03-31にサービスを
終了し、2026-04-01からチャリチャリへリブランディングしたとされています。
掲載中の`app.kotobike.jp` GBFS APIも名前解決できず、`system_information`の
ライセンスを検証できません。そのため、カタログ行だけを根拠に再利用可能とは判断せず、
実装対象から外しています。

## CORS・プロキシ

取得には`svgMap.getCORSURL()`を使用します。`Container.svg`の各レイヤーには
`data-cross-origin-proxy-required="true"`を設定しています。

配信環境のCORSプロキシでは、少なくとも次のホストを許可してください。

- `raw.githubusercontent.com`
- `api-public.odpt.org`
- `api.cyclocity.fr`

公開API URLに認証情報は含まれていません。将来カタログに認証方式が追加された場合は、
秘密情報をブラウザーへ埋め込まずサーバー側プロキシで付与してください。

## 単独レイヤーとしての指定例

```xml
<animation
  x="-30000" y="-30000" width="60000" height="60000"
  xlink:href="./appLayers/publicTransportation/shareCycleGbfs/shareCycleGbfs.svg#system=hellocycling"
  data-cross-origin-proxy-required="true"
  class="シェアモビリティ clickable"
  title="HELLO CYCLING"
  visibility="hidden"/>
```

`system`には`docomo-cycle`、`docomo-cycle-tokyo`、`hellocycling`、`toyama`を
指定できます。省略時は`docomo-cycle`です。

