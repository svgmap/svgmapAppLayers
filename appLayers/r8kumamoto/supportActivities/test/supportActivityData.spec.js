/** @jest-environment jsdom */

import {
  FALLBACK_ACTIVITIES,
  classifyActivity,
  findPlace,
  groupActivitiesByPlace,
  parseActivityDate,
  parseSupportActivities
} from "../supportActivityData.js";

describe("supportActivityData", () => {
  test("公式ページのリンクから地図化可能な活動を抽出する", () => {
    const html = `<a href="https://x.com/a">・8/ 4 三角港での給水・入浴支援のお知らせ</a>
      <a href="/press.pdf">8月4日 防災ヘリを派遣</a>`;
    const result = parseSupportActivities(html);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ date: "2026-08-04", placeName: "三角港" });
    expect(result[0].type).toContain("入浴");
  });

  test("空・不正・未知地点を安全に除外する", () => {
    expect(parseSupportActivities("")).toEqual([]);
    expect(parseSupportActivities(`<a href="javascript:alert(1)">8/1 給水支援</a>`)).toEqual([]);
    expect(parseSupportActivities(`<a href="https://x.com/a">8/1 未登録地で給水支援</a>`)).toEqual([]);
  });

  test("活動種別・日付・地点を判定する", () => {
    expect(classifyActivity("コンテナトイレを設置")).toBe("トイレ");
    expect(parseActivityDate("7/31 宇土アリーナ")).toBe("2026-07-31");
    expect(findPlace("八代市役所鏡支所に設置").id).toBe("kagami-branch");
  });

  test("同地点の活動をまとめる", () => {
    const groups = groupActivitiesByPlace(FALLBACK_ACTIVITIES);
    const port = groups.find((group) => group.placeId === "yatsushiro-port");
    expect(port.activities.length).toBeGreaterThan(1);
    expect(port.latestDate).toBe("2026-08-05");
  });
});
