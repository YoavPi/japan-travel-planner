import { COUNTRY_EN_TO_ID, COUNTRY_HE_TO_ID } from "../data/destinations";

const CITY_TYPES = new Set(["locality", "postal_town", "sublocality", "administrative_area_level_2"]);
const REGION_TYPES = new Set(["administrative_area_level_1", "archipelago", "natural_feature", "colloquial_area"]);

export function classifyDestScope(types = []) {
  const t = new Set(types || []);
  if (t.has("country")) return "country";
  for (const c of CITY_TYPES) if (t.has(c)) return "city";      // a city inside a region is still a city
  for (const r of REGION_TYPES) if (t.has(r)) return "region";
  return "city";
}

/* Aliases for names Google returns that aren't the curated `en`/`name` field.
   The Places SDK is loaded with `language=he`, so most real picks arrive
   Hebrew-localized — hence the Hebrew aliases alongside "United States". */
const ALIASES = {
  "United States": "us",
  "ארצות הברית": "us",
  "איחוד האמירויות הערביות": "ae",
  "דובאי": "ae",
};

export function matchCuratedCountry(primary = "", secondary = "", types = []) {
  const hay = [secondary, primary].map((s) => ` ${String(s || "")} `);
  const names = { ...COUNTRY_EN_TO_ID, ...COUNTRY_HE_TO_ID, ...ALIASES };
  for (const text of hay) {
    for (const [name, id] of Object.entries(names)) {
      const re = new RegExp(`(^|[\\s,])${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}([\\s,]|$)`, "i");
      if (re.test(text)) return id;
    }
  }
  return null;
}
