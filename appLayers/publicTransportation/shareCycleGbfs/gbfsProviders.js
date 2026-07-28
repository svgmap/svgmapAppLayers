export const MOBILITY_DATA_SYSTEMS_URL =
  "https://raw.githubusercontent.com/MobilityData/gbfs/master/systems.csv";

export const MOBILITY_DATA_LICENSE = {
  name: "Creative Commons Attribution 3.0 Unported (CC BY 3.0)",
  url: "https://github.com/MobilityData/gbfs/blob/master/LICENSE",
  attribution: "MobilityData GBFS systems.csv"
};

const ODPT_TERMS_URL =
  "https://developer.odpt.org/terms/center_use_rules.html";
const ODPT_GUIDELINE_URL =
  "https://developer.odpt.org/terms/data_basic_use_guideline.html";
const CC_BY_4_URL = "https://creativecommons.org/licenses/by/4.0/deed.ja";

export const GBFS_PROVIDERS = {
  "docomo-cycle": {
    systemId: "docomo-cycle",
    name: "ドコモ・バイクシェア（全国）",
    location: "日本",
    discoveryUrl:
      "https://api-public.odpt.org/api/v4/gbfs/docomo-cycle/gbfs.json",
    sourceName: "株式会社ドコモ・バイクシェア / 公共交通オープンデータセンター",
    sourceUrl: "https://docomo-cycle.jp/",
    licenseName: "Creative Commons Attribution 4.0 International (CC BY 4.0)",
    licenseUrl: CC_BY_4_URL,
    termsUrl: ODPT_TERMS_URL,
    guidelineUrl: ODPT_GUIDELINE_URL,
    maxTilePoints: 160
  },
  "docomo-cycle-tokyo": {
    systemId: "docomo-cycle-tokyo",
    name: "ドコモ・バイクシェア（東京）",
    location: "東京都",
    discoveryUrl:
      "https://api-public.odpt.org/api/v4/gbfs/docomo-cycle-tokyo/gbfs.json",
    sourceName: "株式会社ドコモ・バイクシェア / 公共交通オープンデータセンター",
    sourceUrl: "https://docomo-cycle.jp/",
    licenseName: "Creative Commons Attribution 4.0 International (CC BY 4.0)",
    licenseUrl: CC_BY_4_URL,
    termsUrl: ODPT_TERMS_URL,
    guidelineUrl: ODPT_GUIDELINE_URL,
    maxTilePoints: 140
  },
  hellocycling: {
    systemId: "hellocycling",
    name: "HELLO CYCLING",
    location: "日本",
    discoveryUrl:
      "https://api-public.odpt.org/api/v4/gbfs/hellocycling/gbfs.json",
    sourceName: "OpenStreet株式会社 / HELLO CYCLING / 公共交通オープンデータセンター",
    sourceUrl: "https://www.hellocycling.jp/",
    licenseName: "Creative Commons Attribution 4.0 International (CC BY 4.0)を選択",
    licenseUrl:
      "https://d1yl7kw204zjxn.cloudfront.net/gbfs/v2/public/hellocycling_gbfs_licence.txt",
    termsUrl: ODPT_TERMS_URL,
    guidelineUrl: ODPT_GUIDELINE_URL,
    maxTilePoints: 180
  },
  toyama: {
    systemId: "toyama",
    name: "CyclOcity（富山）",
    location: "富山市",
    discoveryUrl:
      "https://api.cyclocity.fr/contracts/toyama/gbfs/v3/gbfs.json",
    sourceName: "CyclOcity / JCDecaux",
    sourceUrl: "https://www.cyclocity.jp/",
    licenseName: "Licence Ouverte / Open Licence 1.0",
    licenseUrl: "https://developer.jcdecaux.com/files/Open-Licence-fr.pdf",
    termsUrl: "https://www.cyclocity.jp/ja/documents/cgau/vls",
    guidelineUrl: "",
    maxTilePoints: 80
  }
};

export function getProvider(systemId) {
  return GBFS_PROVIDERS[systemId] || GBFS_PROVIDERS["docomo-cycle"];
}
