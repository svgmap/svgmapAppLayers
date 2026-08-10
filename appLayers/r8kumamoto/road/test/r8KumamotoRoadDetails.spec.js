// License: MPL-2.0

import { expect, test } from "@jest/globals";
import { ROAD_PROPERTY_SCHEMA } from "../r8KumamotoData.js";
import { buildRoadDetailContent } from "../r8KumamotoRoadDetails.js";

test("道路詳細は外部文字列をHTMLとして解釈せず欠損行を省く", () => {
  const modalDocument = document.implementation.createHTMLDocument("道路詳細");
  const dangerousText = '<img src=x onerror="alert(1)">';
  const content = buildRoadDetailContent(
    modalDocument,
    {
      properties: {
        名称: dangerousText,
        路線名: "国道57号",
        規制理由: dangerousText,
        規制内容: "全面通行止め"
      }
    },
    ROAD_PROPERTY_SCHEMA
  );
  expect(content.querySelector("img")).toBeNull();
  expect(content.textContent).toContain(dangerousText);
  expect(content.querySelector("h3").textContent).toBe("国道57号");
  expect(content.querySelectorAll("tr")).toHaveLength(4);
});
