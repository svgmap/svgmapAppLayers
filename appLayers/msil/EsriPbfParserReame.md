EsriPbfParser.js Readme

* 概要
このライブラリは、OSS https://github.com/rowanwins/arcgis-pbf-parser をbrowserifyして構築しています。 (2023/04/28)
同OSSのライセンスは、Apache-2.0 です。

* ブラウザ用パッケージ構築手順

```shell
npm install browserify
npm install arcgis-pbf-parser
browserify EsriPBF2.js -o EsriPbfParser.js
```

```javascript EsriPBF2.js
const arcgisPbfDecode = require('arcgis-pbf-parser')
window.arcgisPbfDecode = arcgisPbfDecode;
```
