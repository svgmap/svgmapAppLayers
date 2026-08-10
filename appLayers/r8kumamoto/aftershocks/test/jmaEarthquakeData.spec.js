/** @jest-environment jsdom */

import {
  intensityColor,
  isAllowedJmaDataUrl,
  isKumamotoSequenceEvent,
  parseAtomFeed,
  parseJmaCoordinate,
  parseJmaEarthquake
} from "../jmaEarthquakeData.js";

const detailXml = `<?xml version="1.0"?><Report xmlns="urn:test" xmlns:jmx_eb="urn:basis"><Body><Earthquake>
  <OriginTime>2026-08-01T12:34:00+09:00</OriginTime><Hypocenter><Area><Name>熊本県熊本地方</Name>
  <jmx_eb:Coordinate>+32.6+130.7-10000/</jmx_eb:Coordinate></Area></Hypocenter><jmx_eb:Magnitude>4.3</jmx_eb:Magnitude>
  </Earthquake><Intensity><Observation><MaxInt>4</MaxInt></Observation></Intensity></Body></Report>`;

describe("jmaEarthquakeData", () => {
  test("Atomから震源・震度情報だけを抽出・重複除去する", () => {
    const url = "https://www.data.jma.go.jp/developer/xml/data/20260801000000_0_VXSE53_010000.xml";
    const xml = `<feed xmlns="http://www.w3.org/2005/Atom"><entry><title>震源・震度に関する情報</title><id>${url}</id><updated>x</updated></entry><entry><title>降灰予報</title><id>${url}</id></entry></feed>`;
    expect(parseAtomFeed(xml)).toEqual([{ id: url, updated: "x", title: "震源・震度に関する情報" }]);
  });

  test("気象庁座標と地震XMLを解析する", () => {
    expect(parseJmaCoordinate("+32.6+130.7-10000/")).toEqual({ lat: 32.6, lon: 130.7, depthKm: 10 });
    expect(parseJmaCoordinate("不正")).toBeNull();
    expect(parseJmaEarthquake(detailXml, "source")).toMatchObject({ areaName: "熊本県熊本地方", magnitude: 4.3, maxIntensity: "4" });
  });

  test("空・壊れたXMLを拒否する", () => {
    expect(() => parseAtomFeed("")).toThrow("空");
    expect(() => parseJmaEarthquake("<broken>")).toThrow("XML");
  });

  test("対象範囲・URL・震度色を判定する", () => {
    const event = parseJmaEarthquake(detailXml, "source");
    expect(isKumamotoSequenceEvent(event)).toBe(true);
    expect(isKumamotoSequenceEvent({ ...event, lon: 140 })).toBe(false);
    expect(isAllowedJmaDataUrl("https://www.data.jma.go.jp/developer/xml/data/a.xml")).toBe(true);
    expect(isAllowedJmaDataUrl("https://evil.example/developer/xml/data/a.xml")).toBe(false);
    expect(intensityColor("7")).toBe("#7f1d1d");
  });
});
