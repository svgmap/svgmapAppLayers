import { jest } from "@jest/globals";
import { GbfsClient } from "../gbfsClient.js";
import { MOBILITY_DATA_SYSTEMS_URL } from "../gbfsProviders.js";

function jsonResponse(value) {
  return {
    ok: true,
    json: jest.fn().mockResolvedValue(value)
  };
}

function textResponse(value) {
  return {
    ok: true,
    text: jest.fn().mockResolvedValue(value)
  };
}

test("カタログ、Discovery、必須フィードを順に解決する", async () => {
  const catalogDiscoveryUrl = "https://catalog.example/gbfs.json";
  const feeds = {
    station_information: "https://feed.example/information.json",
    station_status: "https://feed.example/status.json",
    system_information: "https://feed.example/system.json"
  };
  const responses = new Map([
    [
      MOBILITY_DATA_SYSTEMS_URL,
      textResponse(
        [
          "Country Code,Name,Location,System ID,URL,Auto-Discovery URL",
          `JP,Example,Tokyo,example,https://example.com,${catalogDiscoveryUrl}`
        ].join("\n")
      )
    ],
    [
      catalogDiscoveryUrl,
      jsonResponse({
        data: { feeds: Object.entries(feeds).map(([name, url]) => ({ name, url })) }
      })
    ],
    [feeds.station_information, jsonResponse({ data: { stations: [{ station_id: "1" }] } })],
    [feeds.station_status, jsonResponse({ data: { stations: [{ station_id: "1" }] } })],
    [feeds.system_information, jsonResponse({ data: { name: "Example" } })]
  ]);
  const fetchFn = jest.fn((url) => Promise.resolve(responses.get(url.replace("proxy:", ""))));
  const client = new GbfsClient({
    fetchFn,
    getCorsUrl: (url) => `proxy:${url}`
  });

  const result = await client.loadDataset(
    {
      systemId: "example",
      discoveryUrl: "https://fallback.example/gbfs.json"
    },
    new AbortController().signal
  );

  expect(result.catalogSystem.discoveryUrl).toBe(catalogDiscoveryUrl);
  expect(result.feedUrls).toEqual(feeds);
  expect(result.informationDocument.data.stations).toHaveLength(1);
  expect(result.systemDocument.data.name).toBe("Example");
  expect(fetchFn).toHaveBeenCalledWith(
    `proxy:${MOBILITY_DATA_SYSTEMS_URL}`,
    expect.objectContaining({ cache: "force-cache" })
  );
});

test("カタログ取得失敗時は内蔵Discovery URLへフォールバックする", async () => {
  const fallbackUrl = "https://fallback.example/gbfs.json";
  const logger = { warn: jest.fn() };
  const fetchFn = jest.fn((url) => {
    if (url === MOBILITY_DATA_SYSTEMS_URL) {
      return Promise.resolve({ ok: false, status: 503, statusText: "Unavailable" });
    }
    if (url === fallbackUrl) {
      return Promise.resolve(
        jsonResponse({
          data: {
            feeds: [
              { name: "station_information", url: "https://feed.example/info" },
              { name: "station_status", url: "https://feed.example/status" }
            ]
          }
        })
      );
    }
    return Promise.resolve(jsonResponse({ data: { stations: [] } }));
  });
  const client = new GbfsClient({ fetchFn, logger });

  const result = await client.loadDataset(
    { systemId: "example", discoveryUrl: fallbackUrl },
    new AbortController().signal
  );

  expect(result.catalogSystem).toBeNull();
  expect(result.systemDocument).toBeNull();
  expect(logger.warn).toHaveBeenCalledTimes(1);
});

test("必須フィードがないDiscoveryはエラーにする", async () => {
  const fetchFn = jest
    .fn()
    .mockResolvedValueOnce({ ok: false, status: 503, statusText: "Unavailable" })
    .mockResolvedValueOnce(
      jsonResponse({
        data: {
          feeds: [{ name: "station_information", url: "https://feed.example/info" }]
        }
      })
    );
  const client = new GbfsClient({
    fetchFn,
    logger: { warn: jest.fn() }
  });

  await expect(
    client.loadDataset(
      { systemId: "example", discoveryUrl: "https://fallback.example/gbfs.json" },
      new AbortController().signal
    )
  ).rejects.toThrow("station_status");
});

test("中断エラーではカタログのフォールバックを実行しない", async () => {
  const abortError = new DOMException("中断", "AbortError");
  const logger = { warn: jest.fn() };
  const client = new GbfsClient({
    fetchFn: jest.fn().mockRejectedValue(abortError),
    logger
  });

  await expect(
    client.loadDataset(
      { systemId: "example", discoveryUrl: "https://fallback.example/gbfs.json" },
      new AbortController().signal
    )
  ).rejects.toBe(abortError);
  expect(logger.warn).not.toHaveBeenCalled();
});
