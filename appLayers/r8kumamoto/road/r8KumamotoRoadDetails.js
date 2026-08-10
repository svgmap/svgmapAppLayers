// License: MPL-2.0
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.

export function buildRoadDetailContent(ownerDocument, feature, propertySchema) {
  const container = ownerDocument.createElement("div");
  container.style.cssText = "font-family:sans-serif;font-size:13px";

  const heading = ownerDocument.createElement("h3");
  heading.textContent =
    feature.properties["路線名"] || feature.properties["名称"] || "道路規制区間";
  container.appendChild(heading);

  const table = ownerDocument.createElement("table");
  table.style.cssText = "width:100%;border-collapse:collapse";
  table.setAttribute("border", "1");
  for (const key of propertySchema) {
    const value = String(feature.properties[key] ?? "");
    if (!value) continue;
    const row = ownerDocument.createElement("tr");
    const labelCell = ownerDocument.createElement("th");
    labelCell.style.cssText = "width:32%;text-align:left;padding:4px";
    labelCell.textContent = key;
    const valueCell = ownerDocument.createElement("td");
    valueCell.style.cssText = "padding:4px";
    valueCell.textContent = value;
    row.append(labelCell, valueCell);
    table.appendChild(row);
  }
  container.appendChild(table);

  const notice = ownerDocument.createElement("p");
  notice.style.color = "#555";
  notice.textContent =
    "災害時の参考情報です。実際の通行可否は道路管理者・警察等の最新情報を確認してください。";
  container.appendChild(notice);
  return container;
}
