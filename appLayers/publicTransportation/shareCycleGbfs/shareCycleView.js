// License: (MPL v2)
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.

import { localizeText, parseGbfsTimestamp } from "./gbfsUtils.js";
import {
  applyStatusColorVariables,
  formatDateTime,
  isHttpUrl
} from "./shareCyclePresentation.js";
import { MOBILITY_DATA_LICENSE } from "./gbfsProviders.js";

const SUMMARY_ELEMENT_IDS = Object.freeze({
  total: "stationCount",
  vehicles: "vehicleCount",
  docks: "dockCount",
  available: "availableCount",
  low: "lowCount",
  empty: "emptyCount",
  unavailable: "unavailableCount",
  unknown: "unknownCount"
});

export class ShareCycleView {
  constructor(document) {
    this.document = document;
    this.handlers = null;
    applyStatusColorVariables(document);
  }

  bindControls({ onRefresh, onReload, onAutoRefreshChange }) {
    this.handlers = {
      refresh: () => void onRefresh(),
      reload: () => void onReload(),
      autoRefresh: (event) => onAutoRefreshChange(event.currentTarget.checked)
    };
    this.#element("refreshButton")?.addEventListener("click", this.handlers.refresh);
    this.#element("reloadButton")?.addEventListener("click", this.handlers.reload);
    this.#element("autoRefresh")?.addEventListener("change", this.handlers.autoRefresh);
  }

  unbindControls() {
    if (!this.handlers) {
      return;
    }
    this.#element("refreshButton")?.removeEventListener("click", this.handlers.refresh);
    this.#element("reloadButton")?.removeEventListener("click", this.handlers.reload);
    this.#element("autoRefresh")?.removeEventListener("change", this.handlers.autoRefresh);
    this.handlers = null;
  }

  configureProvider(provider) {
    this.document.title = provider.name;
    this.setText("layerTitle", provider.name);
    this.setText("location", provider.location);
    this.setText("sourceName", provider.sourceName);
    this.setLink("sourceLink", provider.sourceUrl);
    this.setText("licenseName", provider.licenseName);
    this.setLink("licenseLink", provider.licenseUrl);
    this.setLink("termsLink", provider.termsUrl);

    const guidelineLink = this.#element("guidelineLink");
    if (guidelineLink) {
      guidelineLink.hidden = !provider.guidelineUrl;
      if (provider.guidelineUrl) {
        guidelineLink.href = provider.guidelineUrl;
      }
    }

    this.setText("catalogCredit", MOBILITY_DATA_LICENSE.attribution);
    this.setLink("catalogLink", MOBILITY_DATA_LICENSE.url);
  }

  updateSummary(summary) {
    for (const [key, elementId] of Object.entries(SUMMARY_ELEMENT_IDS)) {
      this.setText(elementId, summary[key].toLocaleString("ja-JP"));
    }
  }

  updateTimestamp(value) {
    const date = parseGbfsTimestamp(value);
    this.setText("dataTimestamp", date ? formatDateTime(date) : "不明");
  }

  updateLicense(systemDocument) {
    const system = systemDocument?.data;
    if (!system) {
      return;
    }
    const systemName = localizeText(system.name);
    if (systemName) {
      this.setText("gbfsSystemName", systemName);
    }
    if (system.license_url) {
      this.setLink("licenseLink", system.license_url);
    }
    const termsUrl = localizeText(system.terms_url);
    if (termsUrl) {
      this.setLink("termsLink", termsUrl);
    }
  }

  setLastFetched(date) {
    this.setText("lastFetched", formatDateTime(date));
  }

  setLoading(loading) {
    const refreshButton = this.#element("refreshButton");
    const reloadButton = this.#element("reloadButton");
    if (refreshButton) refreshButton.disabled = loading;
    if (reloadButton) reloadButton.disabled = loading;
  }

  setStatus(message, isError = false) {
    const element = this.#element("statusMessage");
    if (!element) {
      return;
    }
    element.textContent = message;
    element.classList.toggle("error", isError);
  }

  setProgress(message) {
    this.setText("qtctProgress", message);
  }

  setCatalogState(message) {
    this.setText("catalogState", message);
  }

  isAutoRefreshEnabled() {
    return Boolean(this.#element("autoRefresh")?.checked);
  }

  setText(id, value) {
    const element = this.#element(id);
    if (element) {
      element.textContent = value ?? "";
    }
  }

  setLink(id, url) {
    const element = this.#element(id);
    if (element && isHttpUrl(url)) {
      element.href = url;
    }
  }

  #element(id) {
    return this.document.getElementById(id);
  }
}
