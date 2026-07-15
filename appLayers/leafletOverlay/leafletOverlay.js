// 
// License: (MPL v2)
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.

// グローバルおよび親コンテキストオブジェクトの取得
// svgMap や svgImageProps は親 (svgMapViewer) から自動的に提供される

let currentMap = null;
let isEnabled = true;
let opacity = 1.0;
let currentBlobUrl = null;

// コンテンツの文字列化ユーティリティ（DOM要素やオブジェクトの文字列化）
const stringifyContent = (content) => {
  if (content === null || content === undefined) return '';
  if (typeof content === 'string') return content;
  if (typeof content === 'object') {
    // HTMLElement（DOMノード）またはそれに類するオブジェクトの場合
    if (content instanceof HTMLElement || (content.nodeType && content.nodeName)) {
      return content.innerHTML || content.textContent || '';
    }
    // 汎用オブジェクトのフォールバック
    return content.outerHTML || content.innerHTML || content.toString() || '';
  }
  return String(content);
};

// 1. LeafletFileUploader
export const LeafletFileUploader = {
  handleUpload(file) {
    if (currentBlobUrl) {
      URL.revokeObjectURL(currentBlobUrl);
    }
    currentBlobUrl = URL.createObjectURL(file);
    return Promise.resolve(currentBlobUrl);
  },

  validateLeafletHTML(htmlContent) {
    // Leaflet.jsのロード、または L.map / new L.Map の存在を確認
    const hasLeafletJs = /leaflet\.js/i.test(htmlContent) || /unpkg\.com\/leaflet/i.test(htmlContent);
    const hasMapInit = /L\.[Mm]ap\s*\(/i.test(htmlContent) || /new\s+L\.[Mm]ap\s*\(/i.test(htmlContent);
    return hasLeafletJs && hasMapInit;
  }
};

// 2. LeafletGeoJsonExtractor
export const LeafletGeoJsonExtractor = {
  extractGeoJSON(iframeWindow) {
    const leafletMap = LeafletSyncManager.findLeafletMap(iframeWindow);
    if (!leafletMap) return null;

    const featureCollection = {
      type: "FeatureCollection",
      features: []
    };

    try {
      leafletMap.eachLayer((layer) => {
        if (layer && typeof layer.toGeoJSON === 'function') {
          try {
            const geojsonFeature = layer.toGeoJSON();

            // ポップアップやツールチップのバインド情報をpropertiesにマージ
            if (layer.getPopup && layer.getPopup()) {
              const popup = layer.getPopup();
              geojsonFeature.properties = geojsonFeature.properties || {};
              const content = typeof popup.getContent === 'function' ? popup.getContent() : null;
              geojsonFeature.properties.popupContent = stringifyContent(content);
            }
            if (layer.getTooltip && layer.getTooltip()) {
              const tooltip = layer.getTooltip();
              geojsonFeature.properties = geojsonFeature.properties || {};
              const content = typeof tooltip.getContent === 'function' ? tooltip.getContent() : null;
              geojsonFeature.properties.tooltipContent = stringifyContent(content);
            }

            // スタイル情報のマッピング（Mapbox simplestyle-specに準拠）
            if (layer.options) {
              geojsonFeature.properties = geojsonFeature.properties || {};
              const opts = layer.options;
              if (opts.color !== undefined) {
                geojsonFeature.properties['stroke'] = opts.color;
              }
              if (opts.weight !== undefined) {
                geojsonFeature.properties['stroke-width'] = opts.weight;
              }
              if (opts.opacity !== undefined) {
                geojsonFeature.properties['stroke-opacity'] = opts.opacity;
              }
              if (opts.fillColor !== undefined) {
                geojsonFeature.properties['fill'] = opts.fillColor;
              }
              if (opts.fillOpacity !== undefined) {
                geojsonFeature.properties['fill-opacity'] = opts.fillOpacity;
              }
              if (opts.fillOpacity !== undefined || opts.opacity !== undefined) {
                const op = opts.fillOpacity !== undefined && opts.opacity !== undefined
                  ? Math.max(opts.fillOpacity, opts.opacity)
                  : (opts.fillOpacity !== undefined ? opts.fillOpacity : opts.opacity);
                geojsonFeature.properties['opacity'] = op;
              }
              if (opts.fill === false) {
                geojsonFeature.properties['fill'] = 'none';
                geojsonFeature.properties['fill-opacity'] = 0;
                geojsonFeature.properties['opacity'] = 0;
              }
            }

            featureCollection.features.push(geojsonFeature);
          } catch (err) {
            console.warn("Layer conversion to GeoJSON failed:", err);
          }
        }
      });
    } catch (e) {
      console.error("eachLayer search failed:", e);
    }

    return featureCollection.features.length > 0 ? featureCollection : null;
  },

  renderGeoJSONToSVGMap(geoJSON, svgMapInstance) {
    if (!geoJSON) return;

    // 既存の動的描画マークをクリアする
    let marksGroup = null;
    try {
      marksGroup = svgImage.getElementById("marks");
    } catch (e) {
      marksGroup = document.getElementById("marks");
    }

    if (marksGroup) {
      while (marksGroup.firstChild) {
        marksGroup.removeChild(marksGroup.firstChild);
      }
    }

    // SvgMapGIS, svgMapGIStool, svgMapGIS のいずれかから drawGeoJson を取得して描画する
    const gisTool = (typeof SvgMapGIS !== 'undefined') ? SvgMapGIS :
                    (typeof svgMapGIStool !== 'undefined') ? svgMapGIStool :
                    (typeof svgMapGIS !== 'undefined') ? svgMapGIS : null;

    if (gisTool && typeof gisTool.drawGeoJson === 'function') {
      try {
        const lId = typeof layerID !== 'undefined' ? layerID : 'leaflet-layer';
        gisTool.drawGeoJson(
          geoJSON,
          lId,
          "#ff0000",
          2,
          "#000000",
          "p0",
          "poi",
          "",
          marksGroup
        );
      } catch (e) {
        console.error("drawGeoJson execution failed:", e);
      }
    } else {
      console.warn("svgMapGIStool / svgMapGIS or drawGeoJson is not available.");
    }

    if (svgMapInstance && typeof svgMapInstance.refreshScreen === 'function') {
      console.log("Refreshing SVGMap screen after GeoJSON rendering.");
      svgMapInstance.refreshScreen();
    }
  }
};

// 3. LeafletSyncManager (マップオブジェクト検出ユーティリティ)
export const LeafletSyncManager = {
  findLeafletMap(iframeWindow) {
    const L = iframeWindow.L;
    if (!L || !L.Map) return null;

    // 優先順位 1: L.Map._maps（内部管理リスト）から探索
    if (L.Map._maps) {
      const maps = Object.values(L.Map._maps);
      if (maps.length > 0) return maps[0];
    }

    // 優先順位 2: グローバル変数走査（型判定）
    for (let key in iframeWindow) {
      try {
        const val = iframeWindow[key];
        if (val && val instanceof L.Map) {
          return val;
        }
      } catch (e) {
        // セキュリティアクセスエラー回避
      }
    }

    // 優先順位 3: DOMコンテナからの逆引き
    try {
      const mapContainer = iframeWindow.document.querySelector('.leaflet-container');
      if (mapContainer && mapContainer._leaflet_id) {
        // Leaflet内部レジストリからのフォールバックが無い場合の最終手段
      }
    } catch (e) {}

    return null;
  }
};

// 4. LeafletOverlayLaWA (UI Controller)
export const LeafletOverlayLaWA = {
  init() {
    this.bindUIEvents();
  },

  bindUIEvents() {
    const fileInput = document.getElementById("file-input");
    const uploadZone = document.getElementById("upload-zone");
    const opacitySlider = document.getElementById("opacity-slider");
    const opacityVal = document.getElementById("opacity-val");
    const visibilityCheckbox = document.getElementById("visibility-checkbox");
    const iframe = document.getElementById("leaflet-iframe");

    // ファイル入力
    uploadZone.addEventListener("click", () => fileInput.click());
    fileInput.addEventListener("change", (e) => this.handleFileSelect(e.target.files[0]));

    // ドラッグ＆ドロップ
    uploadZone.addEventListener("dragover", (e) => {
      e.preventDefault();
      uploadZone.classList.add("dragover");
    });
    uploadZone.addEventListener("dragleave", () => {
      uploadZone.classList.remove("dragover");
    });
    uploadZone.addEventListener("drop", (e) => {
      e.preventDefault();
      uploadZone.classList.remove("dragover");
      if (e.dataTransfer.files.length > 0) {
        this.handleFileSelect(e.dataTransfer.files[0]);
      }
    });

    // 不透明度スライダー
    opacitySlider.addEventListener("input", (e) => {
      const val = e.target.value;
      opacityVal.textContent = `${val}%`;
      this.setOpacity(val / 100);
    });

    // 表示非表示
    visibilityCheckbox.addEventListener("change", (e) => {
      iframe.style.display = e.target.checked ? "block" : "none";
    });

    // iframeのロード完了イベント
    iframe.addEventListener("load", () => {
      if (!iframe.src || iframe.src === "about:blank") return;

      // ロード完了後にマップインスタンスを検索
      setTimeout(() => {
        try {
          const iframeWindow = iframe.contentWindow;
          
          // pointer-events CSSインジェクション（アプローチB）
          this.injectPointerEvents(iframeWindow);

          const map = LeafletSyncManager.findLeafletMap(iframeWindow);
          if (map) {
            currentMap = map;
            this.showMessage("Leafletマップへの接続に成功しました", "success");
            
            // GeoJSONデータの抽出と親地図への描画連携
            const geoJSON = LeafletGeoJsonExtractor.extractGeoJSON(iframeWindow);
            if (geoJSON) {
              console.log("GeoJSON extracted:", geoJSON);
              LeafletGeoJsonExtractor.renderGeoJSONToSVGMap(geoJSON, svgMap);
              this.showMessage(`Leafletから ${geoJSON.features.length} 個の要素を抽出して統合しました。`, "success");
            } else {
              console.log("No vector features found to extract.");
            }
          } else {
            this.showMessage("Leaflet Mapオブジェクトの自動検出に失敗しました。window.mapなどに代入してグローバルに公開されているか確認してください。", "error");
          }
        } catch (e) {
          console.error("Iframe connection error:", e);
          this.showMessage("iframe内のマップ接続時にエラーが発生しました（セキュリティ制限の可能性があります）", "error");
        }
      }, 300);
    });
  },

  handleFileSelect(file) {
    if (!file) return;

    this.showMessage("ファイルを解析中...", "info");

    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target.result;
      
      // 簡易検証
      if (!LeafletFileUploader.validateLeafletHTML(content)) {
        this.showMessage("有効なLeaflet.jsファイルが検出されませんでした（スクリプトタグやMap初期化コードが不足しています）", "error");
        return;
      }

      // Blob URLを生成して iframe へロード
      LeafletFileUploader.handleUpload(file).then((url) => {
        const iframe = document.getElementById("leaflet-iframe");
        iframe.src = url;
      });
    };
    reader.readAsText(file);
  },

  setOpacity(value) {
    opacity = value;
    const iframe = document.getElementById("leaflet-iframe");
    iframe.style.opacity = opacity;
  },

  injectPointerEvents(iframeWindow) {
    try {
      const doc = iframeWindow.document;
      const style = doc.createElement("style");
      style.textContent = `
        /* 地図背景およびコンテナ全体はマウスイベントを透過し、下の親地図に流す */
        .leaflet-container,
        .leaflet-map-pane,
        .leaflet-tile-pane,
        .leaflet-overlay-pane {
          pointer-events: none !important;
        }
        /* レイヤー切り替え、ズームボタン、シークバー、マーカー等のUI・インタラクティブ要素は操作を受け取る */
        .leaflet-control-container,
        .leaflet-control,
        .leaflet-interactive,
        .leaflet-marker-icon,
        .leaflet-popup,
        .leaflet-tooltip {
          pointer-events: auto !important;
        }
      `;
      doc.head.appendChild(style);
      
      // iframe 要素自体の pointer-events を auto にして、インジェクションされたCSSが機能するようにする
      const iframeElement = document.getElementById("leaflet-iframe");
      //iframeElement.style.pointer-events = "auto";
    } catch (e) {
      console.warn("Failed to inject pointer-events CSS:", e);
    }
  },

  showMessage(text, type) {
    const msgBox = document.getElementById("message-box");
    msgBox.className = `message-box ${type}`;
    msgBox.textContent = text;
  }
};

// アプリケーション初期化
if (typeof window !== 'undefined') {
  window.addEventListener("load", () => {
    // テスト環境（MochaやJestのDOM環境）がロードされていない場合のみ自動初期化を実行
    if (!window.mocha && !window.__LeafletOverlayLaWA_Test__) {
      LeafletOverlayLaWA.init();
    }
  });
}

// デフォルトエクスポート
export default LeafletOverlayLaWA;

