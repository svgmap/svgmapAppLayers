const fs = require('fs');
const path = require('path');

describe('Leaflet Overlay LaWA Unit Tests', () => {
  let target;
  let LeafletFileUploader;
  let LeafletSyncManager;
  let LeafletGeoJsonExtractor;

  beforeAll(() => {
    // DOMのモック設定
    document.body.innerHTML = `
      <iframe id="leaflet-iframe"></iframe>
      <div id="mode-verification"></div>
      <div id="mode-production"></div>
      <div id="message-box"></div>
      <div id="marks"></div>
    `;

    // グローバル変数のモック
    window.svgMap = {};
    window.svgImage = {
      getElementById: (id) => null
    };

    // leafletOverlay.js の読み込みと実行
    const scriptPath = path.resolve(__dirname, '../leafletOverlay.js');
    const scriptContent = fs.readFileSync(scriptPath, 'utf8');
    eval(scriptContent);

    // テスト対象オブジェクトの取得
    target = window.__LeafletOverlayLaWA_Test__;
    LeafletFileUploader = target.LeafletFileUploader;
    LeafletSyncManager = target.LeafletSyncManager;
    LeafletGeoJsonExtractor = target.LeafletGeoJsonExtractor;
  });

  describe('1. LeafletFileUploader', () => {
    describe('validateLeafletHTML', () => {
      it('有効なLeaflet.jsとL.map初期化コードを含むHTMLを正しく検証できること', () => {
        const validHTML = `
          <!DOCTYPE html>
          <html>
          <head>
            <link rel="stylesheet" href="https://unpkg.com/leaflet/dist/leaflet.css" />
            <script src="https://unpkg.com/leaflet/dist/leaflet.js"></script>
          </head>
          <body>
            <div id="map"></div>
            <script>
              var map = L.map('map').setView([51.505, -0.09], 13);
            </script>
          </body>
          </html>
        `;
        expect(LeafletFileUploader.validateLeafletHTML(validHTML)).toBe(true);
      });

      it('L.Map (大文字) で初期化されたコードも正しく検証できること', () => {
        const validHTML = `
          <script src="leaflet.js"></script>
          <script>
            const myMap = new L.Map('map-container');
          </script>
        `;
        expect(LeafletFileUploader.validateLeafletHTML(validHTML)).toBe(true);
      });

      it('Leaflet.jsのスクリプトタグが無いHTMLは無効と判定されること', () => {
        const invalidHTML = `
          <div id="map"></div>
          <script>
            var map = L.map('map');
          </script>
        `;
        expect(LeafletFileUploader.validateLeafletHTML(invalidHTML)).toBe(false);
      });

      it('L.map初期化コードが無いHTMLは無効と判定されること', () => {
        const invalidHTML = `
          <script src="leaflet.js"></script>
          <div id="map"></div>
        `;
        expect(LeafletFileUploader.validateLeafletHTML(invalidHTML)).toBe(false);
      });
    });
  });

  describe('2. LeafletSyncManager', () => {
    describe('findLeafletMap', () => {
      it('L.Map._maps に登録されているインスタンスを優先して特定できること', () => {
        class DummyMap {}
        const mockMapInstance = new DummyMap();
        
        // モックの iframeWindow を構築
        const mockWindow = {
          L: {
            Map: DummyMap
          }
        };
        // Leaflet 内部レジストリを再現
        mockWindow.L.Map._maps = {
          "map-123": mockMapInstance
        };

        const result = LeafletSyncManager.findLeafletMap(mockWindow);
        expect(result).toBe(mockMapInstance);
      });

      it('グローバル変数に代入された L.Map インスタンスを型判定で特定できること', () => {
        class DummyMap {}
        const mockMapInstance = new DummyMap();
        
        const mockWindow = {
          L: {
            Map: DummyMap
          },
          myCustomNamedMap: mockMapInstance // 任意の名前のグローバル変数
        };

        const result = LeafletSyncManager.findLeafletMap(mockWindow);
        expect(result).toBe(mockMapInstance);
      });

      it('マップインスタンスが存在しない場合は null を返すこと', () => {
        class DummyMap {}
        const mockWindow = {
          L: {
            Map: DummyMap
          },
          someOtherVariable: "hello world"
        };

        const result = LeafletSyncManager.findLeafletMap(mockWindow);
        expect(result).toBeNull();
      });
    });
  });


  describe('3. LeafletGeoJsonExtractor', () => {
    class DummyMap {
      constructor(layers = []) {
        this.layers = layers;
      }
      eachLayer(callback) {
        this.layers.forEach(layer => callback(layer));
      }
    }

    describe('extractGeoJSON', () => {
      it('マップ上の各レイヤーから toGeoJSON() を呼び出して FeatureCollection を抽出できること', () => {
        // レイヤーのモック
        const mockLayer1 = {
          toGeoJSON: () => ({
            type: "Feature",
            geometry: { type: "Point", coordinates: [139.7, 35.6] },
            properties: {}
          })
        };
        const mockLayer2 = {
          toGeoJSON: () => ({
            type: "Feature",
            geometry: { type: "LineString", coordinates: [[139.7, 35.6], [139.8, 35.7]] },
            properties: {}
          })
        };

        const mockMap = new DummyMap([mockLayer1, mockLayer2]);
        const mockWindow = {
          L: { Map: DummyMap },
          map: mockMap
        };

        const geojson = LeafletGeoJsonExtractor.extractGeoJSON(mockWindow);
        expect(geojson).not.toBeNull();
        expect(geojson.type).toBe("FeatureCollection");
        expect(geojson.features).toHaveLength(2);
        expect(geojson.features[0].geometry.type).toBe("Point");
        expect(geojson.features[1].geometry.type).toBe("LineString");
      });

      it('ポップアップ情報がバインドされている場合、properties.popupContent に格納できること', () => {
        const mockLayer = {
          toGeoJSON: () => ({
            type: "Feature",
            geometry: { type: "Point", coordinates: [139.7, 35.6] },
            properties: {}
          }),
          getPopup: () => ({
            getContent: () => "避難所 A"
          })
        };

        const mockMap = new DummyMap([mockLayer]);
        const mockWindow = {
          L: { Map: DummyMap },
          map: mockMap
        };

        const geojson = LeafletGeoJsonExtractor.extractGeoJSON(mockWindow);
        expect(geojson.features[0].properties.popupContent).toBe("避難所 A");
      });

      it('ポップアップがHTMLElementオブジェクトである場合、そのinnerHTMLが正しく文字列として抽出されること', () => {
        const mockDiv = {
          nodeType: 1,
          nodeName: "DIV",
          innerHTML: "<strong>避難所 B</strong>"
        };
        const mockLayer = {
          toGeoJSON: () => ({
            type: "Feature",
            geometry: { type: "Point", coordinates: [139.7, 35.6] },
            properties: {}
          }),
          getPopup: () => ({
            getContent: () => mockDiv
          })
        };

        const mockMap = new DummyMap([mockLayer]);
        const mockWindow = {
          L: { Map: DummyMap },
          map: mockMap
        };

        const geojson = LeafletGeoJsonExtractor.extractGeoJSON(mockWindow);
        expect(geojson.features[0].properties.popupContent).toBe("<strong>避難所 B</strong>");
      });

      it('ベクターレイヤーが無い、または toGeoJSON を持たないレイヤーのみの場合は null を返すこと', () => {
        const mockTileLayer = {
          // toGeoJSON を持たない（TileLayerなどをモック）
          options: { maxZoom: 18 }
        };

        const mockMap = new DummyMap([mockTileLayer]);
        const mockWindow = {
          L: { Map: DummyMap },
          map: mockMap
        };

        const geojson = LeafletGeoJsonExtractor.extractGeoJSON(mockWindow);
        expect(geojson).toBeNull();
      });
    });

    describe('renderGeoJSONToSVGMap', () => {
      it('GeoJSONデータがある場合、SvgMapGIS または svgMapGIStool / svgMapGIS をフォールバック探索し、drawGeoJsonを正しく呼び出して描画すること', () => {
        let drawGeoJsonCalled = false;
        let passedGeojson = null;

        // SvgMapGIS の一時的なモック/スパイを設定
        window.SvgMapGIS = {
          drawGeoJson: (geojson, targetId, strokeColor, strokeWidth, fillColor, POIiconId, poiTitle, metadata, parentElm) => {
            drawGeoJsonCalled = true;
            passedGeojson = geojson;
          }
        };

        const mockGeoJSON = {
          type: "FeatureCollection",
          features: [
            {
              type: "Feature",
              geometry: { type: "Point", coordinates: [139.7, 35.6] },
              properties: { popupContent: "避難所" }
            }
          ]
        };

        // 一時的に window.svgMapGIStool を未定義にして SvgMapGIS を使わせるテスト
        const originalGIStool = window.svgMapGIStool;
        delete window.svgMapGIStool;

        try {
          // レンダーラー実行
          LeafletGeoJsonExtractor.renderGeoJSONToSVGMap(mockGeoJSON, window.svgMap);

          expect(drawGeoJsonCalled).toBe(true);
          expect(passedGeojson).toBe(mockGeoJSON);
        } finally {
          // 元に戻す
          window.svgMapGIStool = originalGIStool;
          delete window.SvgMapGIS;
        }
      });
    });
  });
});
