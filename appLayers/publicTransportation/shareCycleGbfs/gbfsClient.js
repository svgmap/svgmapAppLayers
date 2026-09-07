// License: (MPL v2)
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.

import { findSystemInCatalog, getFeedUrls } from "./gbfsUtils.js";
import { MOBILITY_DATA_SYSTEMS_URL } from "./gbfsProviders.js";

export class GbfsClient {
  constructor({ fetchFn, getCorsUrl = (url) => url, logger = console }) {
    this.fetchFn = fetchFn;
    this.getCorsUrl = getCorsUrl;
    this.logger = logger;
  }

  async loadDataset(provider, signal) {
    const catalogSystem = await this.#resolveCatalogSystem(provider.systemId, signal);
    const discoveryUrl = catalogSystem?.discoveryUrl || provider.discoveryUrl;
    const discoveryDocument = await this.fetchJson(discoveryUrl, signal);
    const feedUrls = getFeedUrls(discoveryDocument);
    requireFeed(feedUrls, "station_information");
    requireFeed(feedUrls, "station_status");

    const [informationDocument, statusDocument, systemDocument] = await Promise.all([
      this.fetchJson(feedUrls.station_information, signal),
      this.fetchJson(feedUrls.station_status, signal),
      this.#loadOptionalSystemInformation(feedUrls.system_information, signal)
    ]);

    return {
      catalogSystem,
      feedUrls,
      informationDocument,
      statusDocument,
      systemDocument
    };
  }

  loadStatuses(url, signal) {
    return this.fetchJson(url, signal);
  }

  async fetchJson(url, signal, cache = "no-store") {
    const response = await this.#fetchResponse(url, { cache, signal });
    return response.json();
  }

  async #resolveCatalogSystem(systemId, signal) {
    try {
      const response = await this.#fetchResponse(MOBILITY_DATA_SYSTEMS_URL, {
        cache: "force-cache",
        signal
      });
      return findSystemInCatalog(await response.text(), systemId);
    } catch (error) {
      if (isAbortError(error)) {
        throw error;
      }
      this.logger.warn("MobilityData systems.csvを取得できませんでした", error);
      return null;
    }
  }

  async #loadOptionalSystemInformation(url, signal) {
    if (!url) {
      return null;
    }
    try {
      return await this.fetchJson(url, signal);
    } catch (error) {
      if (isAbortError(error)) {
        throw error;
      }
      this.logger.warn("system_informationを取得できませんでした", error);
      return null;
    }
  }

  async #fetchResponse(url, options) {
    const response = await this.fetchFn(this.getCorsUrl(url), options);
    if (!response.ok) {
      throw new Error(`${response.status} ${response.statusText}`);
    }
    return response;
  }
}

export function isAbortError(error) {
  return error?.name === "AbortError";
}

function requireFeed(feedUrls, feedName) {
  if (!feedUrls[feedName]) {
    throw new Error(`GBFSに${feedName}フィードがありません`);
  }
}
