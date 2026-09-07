// License: (MPL v2)
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.

import {
  getRefreshIntervalMilliseconds,
  getStatusCategory,
  normalizeStation,
  normalizeStatus,
  summarizeStatuses
} from "./gbfsUtils.js";
import { GbfsClient, isAbortError } from "./gbfsClient.js";
import {
  STATION_DETAIL_SIZE,
  buildStationDetailHtml,
  createStationTitle,
  getMetadataStationId,
  isDrawableStation,
  resolveStationId
} from "./shareCyclePresentation.js";
import { ShareCycleRenderer } from "./shareCycleRenderer.js";
import { ShareCycleView } from "./shareCycleView.js";

export const MINIMUM_RETRY_INTERVAL = 60 * 1000;

export class ShareCycleApp {
  constructor({
    svgMap,
    svgImage,
    svgImageProps,
    layerID,
    provider,
    document,
    fetchFn,
    logger = console,
    client,
    renderer,
    view
  }) {
    this.svgMap = svgMap;
    this.svgImageProps = svgImageProps;
    this.layerID = layerID;
    this.provider = provider;
    this.window = document.defaultView || globalThis;
    this.logger = logger;
    this.view = view || new ShareCycleView(document);
    this.client =
      client ||
      new GbfsClient({
        fetchFn,
        getCorsUrl: (url) => svgMap?.getCORSURL?.(url) ?? url,
        logger
      });
    this.renderer =
      renderer ||
      new ShareCycleRenderer({
        svgMap,
        svgImage,
        svgImageProps,
        layerID,
        getCategory: (metadata) => this.#getCategory(metadata),
        getTitle: (metadata) => createStationTitle(metadata, this.statusesById),
        setProgress: (message) => this.view.setProgress(message)
      });

    this.feedUrls = {};
    this.stations = [];
    this.stationsById = new Map();
    this.statusesById = new Map();
    this.statusTimer = null;
    this.activeRequest = null;
    this.refreshPromise = null;
    this.initialized = false;
    this.destroyed = false;
  }

  async initialize() {
    if (this.initialized) {
      return;
    }
    this.initialized = true;
    this.view.configureProvider(this.provider);
    this.#initializePoiDialog();
    this.view.bindControls({
      onRefresh: () => this.refreshStatuses(),
      onReload: () => this.loadLayer(),
      onAutoRefreshChange: (enabled) => this.#handleAutoRefreshChange(enabled)
    });
    await this.loadLayer();
  }

  preRender() {
    this.renderer.preRender();
  }

  shutdown() {
    this.destroyed = true;
    this.#clearStatusTimer();
    this.activeRequest?.controller.abort();
    this.activeRequest = null;
    this.view.unbindControls();
  }

  async loadLayer() {
    this.#clearStatusTimer();
    const request = this.#beginRequest();
    this.view.setLoading(true);
    this.view.setStatus("MobilityDataカタログとGBFSを確認中…");

    try {
      const dataset = await this.client.loadDataset(
        this.provider,
        request.controller.signal
      );
      if (!this.#isCurrentRequest(request)) {
        return;
      }

      const nextStations = (dataset.informationDocument?.data?.stations || [])
        .map(normalizeStation)
        .filter(isDrawableStation);
      if (!nextStations.length) {
        throw new Error("位置情報を持つステーションがありません");
      }

      this.feedUrls = dataset.feedUrls;
      this.stations = nextStations;
      this.stationsById = new Map(
        nextStations.map((station) => [station.id, station])
      );
      this.statusesById = buildStatusMap(dataset.statusDocument);

      this.view.setCatalogState(
        dataset.catalogSystem?.discoveryUrl
          ? "日本向けsystems.csvから取得"
          : "内蔵URLへフォールバック"
      );
      this.view.updateLicense(dataset.systemDocument);
      this.view.setStatus("ステーション情報をQTCTへ変換中…");
      await this.renderer.build(this.stations, this.provider);
      if (!this.#isCurrentRequest(request)) {
        return;
      }

      this.#updateStatusDisplay(dataset.statusDocument);
      this.view.setStatus(
        `${this.stations.length.toLocaleString("ja-JP")}件をClient-Side QTCTで表示しています`
      );
      this.#scheduleStatusRefresh(
        getRefreshIntervalMilliseconds(dataset.statusDocument?.ttl)
      );
    } catch (error) {
      if (!isAbortError(error) && this.#isCurrentRequest(request)) {
        this.logger.error(error);
        this.view.setStatus(`読み込みに失敗しました: ${error.message}`, true);
        this.#scheduleStatusRefresh(MINIMUM_RETRY_INTERVAL);
      }
    } finally {
      this.#finishRequest(request);
    }
  }

  refreshStatuses() {
    if (this.refreshPromise) {
      return this.refreshPromise;
    }
    this.refreshPromise = this.#refreshStatuses().finally(() => {
      this.refreshPromise = null;
    });
    return this.refreshPromise;
  }

  showStationDetails(target) {
    const stationId = resolveStationId(target);
    const station = this.stationsById.get(stationId);
    if (!station) {
      return;
    }
    const html = buildStationDetailHtml(
      station,
      this.statusesById.get(stationId),
      this.provider
    );
    this.svgMap.showModal(
      html,
      STATION_DETAIL_SIZE.width,
      STATION_DETAIL_SIZE.height
    );
  }

  async #refreshStatuses() {
    this.#clearStatusTimer();
    if (!this.feedUrls.station_status) {
      await this.loadLayer();
      return;
    }

    const request = this.#beginRequest();
    this.view.setLoading(true);
    this.view.setStatus("最新の空き状況を取得中…");

    try {
      const statusDocument = await this.client.loadStatuses(
        this.feedUrls.station_status,
        request.controller.signal
      );
      if (!this.#isCurrentRequest(request)) {
        return;
      }
      this.statusesById = buildStatusMap(statusDocument);
      this.#updateStatusDisplay(statusDocument);
      await this.renderer.refreshColors();
      if (!this.#isCurrentRequest(request)) {
        return;
      }

      const nextInterval = getRefreshIntervalMilliseconds(statusDocument?.ttl);
      this.view.setStatus(
        `空き状況を更新しました。次回更新は約${Math.round(
          nextInterval / 1000
        )}秒後です`
      );
      this.#scheduleStatusRefresh(nextInterval);
    } catch (error) {
      if (!isAbortError(error) && this.#isCurrentRequest(request)) {
        this.logger.error(error);
        this.view.setStatus(`空き状況を更新できませんでした: ${error.message}`, true);
        this.#scheduleStatusRefresh(MINIMUM_RETRY_INTERVAL);
      }
    } finally {
      this.#finishRequest(request);
    }
  }

  #initializePoiDialog() {
    if (this.svgMap && this.layerID !== undefined) {
      this.svgMap.setShowPoiProperty(
        (target) => this.showStationDetails(target),
        this.layerID
      );
    }
    if (this.svgImageProps) {
      this.svgImageProps.isClickable = { value: true, hilightStrokeStyle: {} };
    }
  }

  #getCategory(metadata) {
    const stationId = getMetadataStationId(metadata);
    return getStatusCategory(
      this.statusesById.get(stationId),
      this.stationsById.get(stationId)
    );
  }

  #updateStatusDisplay(statusDocument) {
    this.view.updateSummary(summarizeStatuses(this.stations, this.statusesById));
    this.view.updateTimestamp(statusDocument?.last_updated);
    this.view.setLastFetched(new Date());
  }

  #handleAutoRefreshChange(enabled) {
    this.#clearStatusTimer();
    if (enabled) {
      this.#scheduleStatusRefresh(MINIMUM_RETRY_INTERVAL);
    }
  }

  #beginRequest() {
    this.activeRequest?.controller.abort();
    const request = {
      controller: new AbortController()
    };
    this.activeRequest = request;
    return request;
  }

  #isCurrentRequest(request) {
    return !this.destroyed && this.activeRequest === request;
  }

  #finishRequest(request) {
    if (this.activeRequest === request) {
      this.activeRequest = null;
      this.view.setLoading(false);
    }
  }

  #scheduleStatusRefresh(interval) {
    this.#clearStatusTimer();
    if (this.destroyed || !this.view.isAutoRefreshEnabled()) {
      return;
    }
    this.statusTimer = this.window.setTimeout(() => {
      void this.refreshStatuses();
    }, interval);
  }

  #clearStatusTimer() {
    if (this.statusTimer !== null) {
      this.window.clearTimeout(this.statusTimer);
      this.statusTimer = null;
    }
  }
}

export function buildStatusMap(document) {
  return new Map(
    (document?.data?.stations || [])
      .map(normalizeStatus)
      .filter((status) => status.id)
      .map((status) => [status.id, status])
  );
}
