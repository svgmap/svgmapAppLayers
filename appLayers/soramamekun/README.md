# そらまめくんLaWA

「[そらまめくん](https://soramame.env.go.jp/)」が公開する測定局データを取得し、PM2.5やSPM、光化学オキシダントといった、大気汚染状況を地図上に可視化するレイヤーです。

## 主な機能

- 大気汚染状況の測定局を地図上にマーカー表示し、数値に応じて色分けして可視化します。
- 微小粒子状物質(PM2.5)、浮遊粒子状物質(SPM)、光化学オキシダント(OX)、二酸化硫黄(SO2)、一酸化窒素(NO)、二酸化窒素(NO2)、非メタン炭化水素(NMHC)の7指標を切り替えて表示可能です。
- 地図中のマーカーをクリックすることで測定局の名前や所在地、全指標の値を表形式で表示します。

## 利用方法

このディレクトリをダウンロードして、任意のパスに配置してください。  
その後、SVGMapアプリケーションの `Container.svg` において、 `<animation>` タグを追加しレイヤーを読み込んでください。

```xml
<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="125, -47, 20, 20" >
  <globalCoordinateSystem srsName="http://purl.org/crs/84" transform="matrix(1,0,0,-1,0,0)" />
  <!-- 中略 -->
  <animation xlink:href="/your/path/to/soramamekun.svg" x="-3000" y="-3000" width="6000" height="6000" title="そらまめくん" class="グループ名" visibility="hidden"/>
</svg>
```

他のLaWAと同様ですが、CORS制約回避のためのプロキシーサーバーは以下のように設定できます。

```html
<script type="module">
  import { svgMap } from 'https://cdn.jsdelivr.net/gh/svgmap/svgmapjs@latest/SVGMapLv0.1_r18module.js';
  import { CorsProxy } from 'https://cdn.jsdelivr.net/gh/svgmap/svgmapjs@latest/CorsProxyModule.js';
  window.svgMap = svgMap;
  window.corsProxy = new CorsProxy();
  window.corsProxy.setService('<プロキシーサーバーURL>', null, true, false);
  window.svgMap.setProxyURLFactory(null, null, null, window.corsProxy.getURLfunction(), true);
</script>
```

## データ取得API

- データの配信時刻: `https://soramame.env.go.jp/data/sokutei/noudoAll/metadata.json` (JSON)
- 測定局一覧: `https://soramame.env.go.jp/data/map/kyokuNoudo/{YYYY}/{MM}/{DD}/01.csv` (CSV)
- 測定値: `https://soramame.env.go.jp/data/sokutei/noudoAll/{YYYY}/{MM}/{DD}/{HH}.csv` (CSV)
- 凡例: `https://soramame.env.go.jp/data/map_legend.json` (JSON)

## ファイル構成

- `soramamekun.svg`: SVGMapの本体から参照されるレイヤーのエントリーポイント。レイヤーのUIに関する定義やGIS情報の設定が記述されています。
- `soramamekun.html`: レイヤーのベースUI。
- `js/*`: 外部データの取得や地図への描画処理など、レイヤーのコアとなるJavaScriptコード。初期化や再レンダリングなど、レイヤー全体のライフサイクル管理までを担っています。
- `css/*`: レイヤーUIのスタイル設定。
- `test/*`: JavaScriptコードのユニットテスト。現状はUIに依存しないutils関数のテストのみ実装されています。

## 制限事項

- そらまめくんにはCORSの制約がされているため、利用する際にはプロキシーを経由する必要があります。
- 表示はそらまめくんが配信する最新の情報に限られ、過去時点のアーカイブ表示には対応していません。
- 測定局の位置情報（経度・緯度）が欠落しているなど、データに不備がある場合はその測定局を表示しません。
- 表示するデータがあまり多くないため、QTCT(Quad Tree Composite Tiling)のようなタイル分割は行っていません。
- 開発時点(2026年8月)でのAPIの仕様に基づいているため、URLやレスポンス形式、CSVの列構成などが変更されると正常に動作しなくなる可能性があります。
