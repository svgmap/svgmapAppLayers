import { jest } from "@jest/globals";
import { ShareCycleApp } from "../shareCycleApp.js";

function createView() {
  return {
    bindControls: jest.fn(),
    configureProvider: jest.fn(),
    isAutoRefreshEnabled: jest.fn(() => false),
    setCatalogState: jest.fn(),
    setLastFetched: jest.fn(),
    setLoading: jest.fn(),
    setProgress: jest.fn(),
    setStatus: jest.fn(),
    unbindControls: jest.fn(),
    updateLicense: jest.fn(),
    updateSummary: jest.fn(),
    updateTimestamp: jest.fn()
  };
}

test("初期取得、状態更新、詳細表示を一つの状態として管理する", async () => {
  const provider = {
    systemId: "toyama",
    sourceName: "CyclOcity / JCDecaux",
    maxTilePoints: 80
  };
  const initialStatus = {
    data: {
      stations: [
        {
          station_id: "station-1",
          num_vehicles_available: 4,
          num_docks_available: 6,
          is_installed: true,
          is_renting: true,
          is_returning: true
        }
      ]
    },
    last_updated: 1700000000,
    ttl: 1
  };
  const refreshedStatus = {
    ...initialStatus,
    data: {
      stations: [
        {
          ...initialStatus.data.stations[0],
          num_vehicles_available: 2,
          num_docks_available: 8
        }
      ]
    }
  };
  const client = {
    loadDataset: jest.fn().mockResolvedValue({
      catalogSystem: { discoveryUrl: "https://example.com/gbfs.json" },
      feedUrls: { station_status: "https://example.com/status.json" },
      informationDocument: {
        data: {
          stations: [
            {
              station_id: "station-1",
              name: "富山駅",
              address: "富山市",
              lat: 36.7,
              lon: 137.2,
              capacity: 10
            }
          ]
        }
      },
      statusDocument: initialStatus,
      systemDocument: { data: { name: "CyclOcity" } }
    }),
    loadStatuses: jest.fn().mockResolvedValue(refreshedStatus)
  };
  const renderer = {
    build: jest.fn().mockResolvedValue(undefined),
    preRender: jest.fn(),
    refreshColors: jest.fn().mockResolvedValue(undefined)
  };
  const view = createView();
  let poiHandler;
  const svgMap = {
    setShowPoiProperty: jest.fn((handler) => {
      poiHandler = handler;
    }),
    showModal: jest.fn()
  };
  const svgImageProps = {};
  const app = new ShareCycleApp({
    svgMap,
    svgImage: {},
    svgImageProps,
    layerID: "share-cycle",
    provider,
    document: { defaultView: window },
    fetchFn: jest.fn(),
    logger: { error: jest.fn(), warn: jest.fn() },
    client,
    renderer,
    view
  });

  await app.initialize();

  expect(renderer.build).toHaveBeenCalledWith(
    [expect.objectContaining({ id: "station-1", name: "富山駅" })],
    provider
  );
  expect(view.updateSummary).toHaveBeenLastCalledWith(
    expect.objectContaining({ total: 1, vehicles: 4, docks: 6 })
  );
  expect(svgImageProps.isClickable.value).toBe(true);

  poiHandler({
    getAttribute: (name) => (name === "data-station-id" ? "station-1" : "")
  });
  expect(svgMap.showModal).toHaveBeenCalledWith(
    expect.stringContaining("富山駅"),
    480,
    620
  );

  await app.refreshStatuses();
  expect(client.loadStatuses).toHaveBeenCalledWith(
    "https://example.com/status.json",
    expect.any(AbortSignal)
  );
  expect(renderer.refreshColors).toHaveBeenCalledTimes(1);
  expect(view.updateSummary).toHaveBeenLastCalledWith(
    expect.objectContaining({ vehicles: 2, docks: 8, low: 1 })
  );

  app.shutdown();
  expect(view.unbindControls).toHaveBeenCalledTimes(1);
});
