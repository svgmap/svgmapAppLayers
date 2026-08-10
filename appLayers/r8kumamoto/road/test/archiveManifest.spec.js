// License: MPL-2.0

import { describe, expect, test } from "@jest/globals";
import {
  ARCHIVES,
  archiveRequestUrl,
  getArchiveById,
  isAllowedArchiveUrl,
  parseArchiveIndex
} from "../archiveManifest.js";

const INDEX_HTML = `<!doctype html>
  <html><body>
    <p>2026年8月5日13時00分時点の最新の情報を掲載しています。</p>
    <a href="map.zip">[現時点データ一式　ダウンロード]</a>
    <a href="260729data.zip">[7月29日8時時点データ　ダウンロード]</a>
    <a href="2608031600data.zip">[8月3日16時時点データ　ダウンロード]</a>
    <a href="2608051300data.zip">[8月5日13時時点データ　ダウンロード]</a>
    <a href="2608051300data.zip">重複リンク</a>
    <a href="https://example.com/2608060900data.zip">外部リンク</a>
    <a href="sub/2608060900data.zip">サブディレクトリ</a>
  </body></html>`;

describe("archive manifest", () => {
  test("掲載ページ取得失敗時のフォールバックを定義する", () => {
    expect(ARCHIVES).toHaveLength(12);
    expect(ARCHIVES[0].id).toBe("latest");
    const historyIds = ARCHIVES.slice(1).map((archive) => archive.id);
    expect(historyIds).toEqual([...historyIds].sort());
    expect(historyIds.at(-1)).toBe("202608031600");
    expect(getArchiveById("unknown").id).toBe("latest");
  });

  test("掲載ページから追加された日時別ZIPと最新時点を動的に取得する", () => {
    const archives = parseArchiveIndex(INDEX_HTML);
    expect(archives.map((archive) => archive.id)).toEqual([
      "latest",
      "202607290800",
      "202608031600",
      "202608051300"
    ]);
    expect(archives[0]).toMatchObject({
      label: "最新（2026-08-05 13:00掲載）",
      asOf: "2026-08-05 13:00",
      url: "https://www.mlit.go.jp/road/saigai/r8kumamoto/map.zip",
      revision: "202608051300"
    });
    expect(getArchiveById("202608051300", archives).url.endsWith("2608051300data.zip")).toBe(true);
  });

  test("時点表記がなくても最新の日時別ZIPから掲載時点を補う", () => {
    const archives = parseArchiveIndex(`
      <a href="map.zip">現時点データ</a>
      <a href="2608060900data.zip">8月6日9時時点データ</a>
    `);
    expect(archives[0].asOf).toBe("2026-08-06 09:00");
  });

  test("現時点データのリンクがないページを拒否する", () => {
    expect(() => parseArchiveIndex('<a href="2608051300data.zip">履歴</a>')).toThrow(
      "現時点データのZIPリンクが見つかりません"
    );
  });

  test("不正な日時のZIPリンクを一覧へ追加しない", () => {
    const archives = parseArchiveIndex(`
      <p>2026年8月5日13時00分時点の最新情報</p>
      <a href="map.zip">現時点データ</a>
      <a href="2699322500data.zip">不正日時</a>
    `);
    expect(archives).toHaveLength(1);
  });

  test("国土交通省の対象ディレクトリとZIP命名規則だけを許可する", () => {
    for (const archive of ARCHIVES) {
      expect(isAllowedArchiveUrl(archive.url)).toBe(true);
      expect(new URL(archive.url).hostname).toBe("www.mlit.go.jp");
    }
    expect(isAllowedArchiveUrl("https://www.mlit.go.jp/road/saigai/r8kumamoto/2608051300data.zip")).toBe(true);
    expect(isAllowedArchiveUrl("https://example.com/map.zip")).toBe(false);
    expect(isAllowedArchiveUrl("https://www.mlit.go.jp/road/saigai/r8kumamoto/sub/map.zip")).toBe(false);
    expect(isAllowedArchiveUrl("https://www.mlit.go.jp/road/saigai/r8kumamoto/map.zip?redirect=x")).toBe(false);
  });

  test("最新ZIPだけキャッシュ回避用のクエリを付ける", () => {
    expect(archiveRequestUrl(ARCHIVES[0], "test-revision")).toBe(
      "https://www.mlit.go.jp/road/saigai/r8kumamoto/map.zip?_svgmap_updated=test-revision"
    );
    expect(archiveRequestUrl(ARCHIVES[1], "unused")).toBe(ARCHIVES[1].url);
  });

  test("収録欠落が確認済みの履歴を明示する", () => {
    expect(getArchiveById("202607290800").expectedMissing).toEqual(["road", "travel"]);
    expect(getArchiveById("202607291200").expectedMissing).toEqual(["travel"]);
  });
});
