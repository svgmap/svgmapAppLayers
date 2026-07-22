# Leaflet Overlay Layer Web Application (LaWA)

Leaflet で構築された Web 地図ファイルからスタイル情報を保持したまま GeoJSON データを抽出し、
SVGMap ビューア上へシームレスに重ね合わせ描画（統合）するためのレイヤーモジュールです。

## このレイヤーは何をするものか？（概要）
本モジュールは、既存の Leaflet.js 地図アプリケーション（HTML）を iframe 経由で読み込み、
その内部にあるマップオブジェクトからベクトルデータ（Marker, Polyline, Polygon 等）を直接抽出します。
抽出したデータは、元々の Leaflet 側で指定されていたスタイル（色や線幅、透明度など）を 
Mapbox simplestyle 規格に適合する形で自動変換し、SVGMap の座標系に合わせて動的にマークとして描画します。

これにより、既存の豊富な Leaflet ベースのアセットやローカル of 地理空間データを、
サーバ間通信などを必要とせずに SVGMap の高機能なマルチレイヤー表示機能と統合することができます。

## 導入方法
`Container.svg` に以下の `animation` タグを追記することで、本機能を地図アプリケーションに統合できます。

```xml
<animation xlink:href="./appLayers/leafletOverlay/leafletOverlay.svg" title="Leaflet Overlay" x="-30000" y="-30000" width="60000" height="60000" class="clickable" visibility="hidden"/>
```

## 使い方 (Usage)
1. **Folium・LeafletのHTMLファイルを準備する**
   - 読み込むHTMLには Leaflet.js が含まれ、マップオブジェクト（`L.map` インスタンス）がグローバル変数等で公開されている必要があります（Foliumが出力する標準的なHTMLはそのまま利用可能です）。
2. **レイヤーリストから「Leaflet Overlay」をクリックし起動する**
   - SVGMapビューアのレイヤーリストから該当レイヤーを選択して起動させます。
3. **ドラッグ＆ドロップまたはクリックでファイルを投入する**
   - 右上のサブウインドウ内にあるアップロードエリアに、準備したHTMLファイルをドラッグ＆ドロップするか、エリアをクリックしてファイルを選択し読み込ませます。

## 動作確認済み環境 (Verified Environments)
本モジュールは、以下のバージョンおよび環境において動作検証を行っています。

- **Leaflet.js**: `v1.9.4`
- **Folium** (Python 地図描画ライブラリ): `v0.15.1` (内部で Leaflet v1.9.4 を出力するHTML)

## 注意事項 (Important Notes)
- **大容量ファイルに関する制限**:
  本モジュールは、ブラウザ上（クライアントサイドJavaScript）でHTML内のすべての地図レイヤーを走査・変換し、SVGMapのDOMオブジェクトを動的に生成してレンダリングします。そのため、**非常に大容量のHTMLファイル（数十MB以上の巨大なデータセット）をアップロードした場合、ブラウザの処理負荷が高くなり、一時的に動作が著しく重くなったりフリーズしたりする可能性があります。** 可能な限り、ベクターデータの点数やファイル容量を軽量化したファイルをご利用ください。

## ファイル構成
- `leafletOverlay.html` ── UI レイアウトおよび iframe ホストの定義。
- `leafletOverlay.js` ── Leaflet からの GeoJSON 抽出、スタイルマッピング処理の実装。
- `test/unit.spec.js` ── スタイルマッピング等のロジックを検証する単体テスト。

## 今後
- URLを指定することで運用されているサイトに対しても重畳できるようにする
- タイリングすることでユーザビリティの向上を図る
