export const DEFAULT_DATASET_ICON = Object.freeze({ index: 0, label: "位置情報", symbol: "location_on" });

const ICON_RULES = [
  { index: 1, label: "店舗・営業", symbol: "storefront", keywords: ["食品営業", "営業許可", "店舗", "事業所"] },
  { index: 2, label: "Wi-Fi", symbol: "wifi", keywords: ["wi-fi", "wifi", "無線lan"] },
  { index: 3, label: "介護", symbol: "elderly", keywords: ["介護", "高齢"] },
  { index: 4, label: "子育て", symbol: "child_care", keywords: ["子育て", "保育", "児童"] },
  { index: 5, label: "医療", symbol: "local_hospital", keywords: ["医療", "病院", "診療", "薬局"] },
  { index: 6, label: "教育", symbol: "school", keywords: ["教育", "学校"] },
  { index: 7, label: "駐車場", symbol: "local_parking", keywords: ["駐車場", "パーキング"] },
  { index: 8, label: "自然・名所", symbol: "park", keywords: ["名木", "花と緑", "公園", "自然"] },
  { index: 9, label: "イベント", symbol: "event", keywords: ["イベント", "催事"] },
  { index: 10, label: "文化・慰霊", symbol: "museum", keywords: ["文化財", "慰霊", "記念碑", "史跡", "塔（碑）"] },
  { index: 11, label: "観光", symbol: "travel_explore", keywords: ["観光", "旅行"] },
  { index: 12, label: "選挙", symbol: "how_to_vote", keywords: ["投票", "選挙"] },
  { index: 13, label: "公共施設", symbol: "account_balance", keywords: ["公共施設", "行政施設", "庁舎"] },
  { index: 14, label: "飲食店", symbol: "restaurant", keywords: ["食材の店", "飲食店", "レストラン"] },
];

export function iconForDataset(dataset) {
  const title = String(dataset?.title || "").toLowerCase();
  const tags = dataset?.tags?.map(tag => tag.name || "").join(" ") || "";
  const metadata = `${dataset?.notes || ""} ${tags}`.toLowerCase();
  return ICON_RULES.find(rule => rule.keywords.some(keyword => title.includes(keyword)))
    || ICON_RULES.find(rule => rule.keywords.some(keyword => metadata.includes(keyword)))
    || DEFAULT_DATASET_ICON;
}