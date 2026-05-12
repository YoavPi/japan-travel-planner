/* ══════════════════════════════════════════════════════════════
   TRIP HELPERS — Read-only derived utilities
   ──────────────────────────────────────────────────────────────
   tripData.js stays untouched. This module provides derived
   utilities used by the new mobile-first VerticalFlow + DayFilter:

     • cityAbbreviation()   — 3-letter abbr for the day-pill chip
     • dayItemsInOrder()    — chronological list of stops per day
                              (attractions interleaved with meals)
     • haversineKm()        — straight-line km between two coords
     • transitBetween()     — heuristic mode + minutes between
                              consecutive stops
     • categoryOf()         — heuristic category bucket for an item
     • descriptiveTitleHe() — Hebrew descriptive title (category
                              prefix + nameHe), e.g.
                              "ראמן אפורי בהאראגוקו"
   ══════════════════════════════════════════════════════════════ */

/* ─── City abbreviations (3-letter, used by the Day Scroller) ─── */
const CITY_ABBR = {
  "Tokyo":            "TOK",
  "Tokyo Disney":     "DIS",
  "Tokyo DisneySea":  "TDS",
  "Kanazawa":         "KNZ",
  "Takayama":         "TKY",
  "Matsumoto":        "MTM",
  "Nagoya":           "NGY",
  "Osaka":            "OSA",
  "Osaka Universal":  "USJ",
  "Nara":             "NRA",
  "Kyoto":            "KYO",
  "Kawaguchiko":      "KWG",
  "Hakone":           "HKN",
};

export const cityAbbreviation = (city) => {
  const base = (city || "").replace(/ \d+$/, "");
  return CITY_ABBR[base] || base.slice(0, 3).toUpperCase();
};

/* ─── Item category detector ──────────────────────────────────
   Used for icon picking, descriptive titles, and category filters
   in the new flow. Reads the English `name` and Hebrew `desc`
   together to maximise hit rate. */
const SHOPPING_RX = /market|don quijote|parco|muji|outlet|uniqlo|kappabashi|store|ameyoko|sunshine city|radio kaikan|shopping|חנות|שוק|קניות/i;
const HOTEL_RX    = /hotel|ryokan|מלון|אכסניה/i;
const COFFEE_RX   = /coffee|café|cafe|starbucks|bricolage|anakuma|stumptown|בית קפה|קפה/i;
const ONSEN_RX    = /onsen|hot spring|אונסן|温泉/i;
const SHRINE_RX   = /shrine|temple|inari|pagoda|todai|מקדש|פגוד|טירה|castle/i;
const PARK_RX     = /park|garden|gyoen|bamboo|פארק|גן /i;
const VIEW_RX     = /view|tower|crossing|teamlab|billboard|תצפית|מגדל/i;
const RAMEN_RX    = /ramen|ראמן/i;
const SUSHI_RX    = /sushi|סושי/i;
const FOOD_RX     = /food|soba|gyoza|yakitori|katsu|yakiniku|burger|pizza|pancake|udon|izakaya|duck|מסעדה|המבורגר|פיצה|אודון/i;

export const categoryOf = (item) => {
  const text = `${item?.name || ""} ${item?.nameHe || ""} ${item?.desc || ""}`;
  if (HOTEL_RX.test(text))    return "hotel";
  if (ONSEN_RX.test(text))    return "onsen";
  if (COFFEE_RX.test(text))   return "cafe";
  if (RAMEN_RX.test(text))    return "ramen";
  if (SUSHI_RX.test(text))    return "sushi";
  if (FOOD_RX.test(text))     return "food";
  if (SHRINE_RX.test(text))   return "shrine";
  if (PARK_RX.test(text))     return "park";
  if (SHOPPING_RX.test(text)) return "shopping";
  if (VIEW_RX.test(text))     return "view";
  return "place";
};

/* Hebrew prefix for each category — used by descriptive titles */
const CATEGORY_HE_PREFIX = {
  hotel:    "מלון",
  onsen:    "אונסן",
  cafe:     "בית קפה",
  ramen:    "ראמן",
  sushi:    "סושי",
  food:     "מסעדת",
  shrine:   "מקדש",
  park:     "פארק",
  shopping: "חנות",
  view:     "תצפית",
  place:    "",
};

/* ─── Descriptive Hebrew title ─────────────────────────────────
   Combines a category prefix with the existing Hebrew name so the
   itinerary reads as natural Hebrew sentences:

     "Afuri Harajuku" + nameHe="אפורי האראג'וקו"
                     → "ראמן אפורי האראג'וקו"
     "Anakuma Cafe"  + nameHe="אנאקומה קפה"
                     → "בית קפה אנאקומה" (we strip the redundant
                       'קפה' suffix when the prefix already says it)
   Falls back to nameHe alone when no useful prefix applies. */
export const descriptiveTitleHe = (item) => {
  if (!item) return "";
  const nameHe = item.nameHe || "";
  const cat = categoryOf(item);
  const prefix = CATEGORY_HE_PREFIX[cat];
  if (!prefix) return nameHe;
  /* Avoid duplications when the Hebrew name already starts with
     the same word (e.g., "מקדש מייג'י" + prefix "מקדש"). */
  if (nameHe.startsWith(prefix)) return nameHe;
  /* Strip a redundant trailing word that the prefix already
     covers (e.g., "אנאקומה קפה" + prefix "בית קפה" → drop "קפה"). */
  let cleaned = nameHe;
  if (cat === "cafe" && /\sקפה$/.test(cleaned)) cleaned = cleaned.replace(/\sקפה$/, "");
  return cleaned ? `${prefix} ${cleaned}` : prefix;
};

/* ─── Chronological day items ─────────────────────────────────
   Returns the day's stops in the order:
     [first half of attractions] → lunch → [second half] → dinner
   This mirrors the previous Morning/Afternoon split but flattens
   it into a single linear sequence (no phase headers).
   Each entry is `{ ...item, kind: 'attraction'|'lunch'|'dinner' }` */
export const dayItemsInOrder = (day) => {
  if (!day) return [];
  const attractions = day.attractions || [];
  const splitIdx = Math.ceil(attractions.length / 2);
  const morning  = attractions.slice(0, splitIdx).map((a) => ({ ...a, kind: "attraction" }));
  const afternoon = attractions.slice(splitIdx).map((a) => ({ ...a, kind: "attraction" }));

  const list = [...morning];
  if (day.lunch && day.lunch.place && day.lunch.place !== "—") {
    list.push({ ...day.lunch, name: day.lunch.place, kind: "lunch" });
  }
  list.push(...afternoon);
  if (day.dinner && day.dinner.place && day.dinner.place !== "—") {
    list.push({ ...day.dinner, name: day.dinner.place, kind: "dinner" });
  }
  return list;
};

/* ─── Haversine distance in kilometres ─────────────────────── */
export const haversineKm = (a, b) => {
  if (!a || !b) return null;
  const toRad = (deg) => (deg * Math.PI) / 180;
  const R = 6371; // earth radius (km)
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const x =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(x));
};

/* ─── Transit heuristic between two consecutive stops ───────
   Returns { mode, minutes, label } where:
     - <0.4km  → walk, ~12 min/km pace
     - <2.5km  → walk OR short subway (we still call it "walk"
                 because tourists usually choose to walk)
     - <25km   → subway/train, ~28 km/h average
     - else    → train/shinkansen, ~80 km/h
   Returns null when either coord is missing. */
export const transitBetween = (a, b) => {
  const km = haversineKm(a, b);
  if (km == null) return null;
  if (km < 2.5) {
    const minutes = Math.max(1, Math.round(km * 12));
    return { mode: "walk", minutes, km };
  }
  if (km < 25) {
    const minutes = Math.max(5, Math.round((km / 28) * 60));
    return { mode: "train", minutes, km };
  }
  const minutes = Math.max(20, Math.round((km / 80) * 60));
  return { mode: "shinkansen", minutes, km };
};

/* Format helpers for the transit chip in the UI */
export const formatKm = (km) => {
  if (km == null) return "";
  if (km < 1) return `${Math.round(km * 1000)}מ׳`;
  return `${km.toFixed(1)} ק״מ`;
};

export const transitLabelHe = (mode) => {
  switch (mode) {
    case "walk":       return "הליכה";
    case "train":      return "רכבת";
    case "shinkansen": return "שינקנסן";
    default:           return "מעבר";
  }
};

/* ══════════════════════════════════════════════════════════════
   ATMOSPHERE PHOTO PER DAY
   ──────────────────────────────────────────────────────────────
   Hand-picked "vibe shot" for each trip-day — a landscape, street
   scene, garden, castle, or other scenery photo. Surfaced at the
   top of each day's section in StoryFlow as a hero image.

   All filenames already exist under public/photos/source/ so no
   asset copying is required. tripData.js stays untouched.
   ══════════════════════════════════════════════════════════════ */
const ATMOSPHERE_FILE = {
   1: "day01_harajuku.jpg",
   2: "day02_shinjuku-gyoen.jpg",
   3: "day03_pirates.jpg",
   4: "day04_tower-of-terror.jpg",
   5: "day05_3d-billboard.jpg",
   6: "day06_kenrokuen.jpg",
   7: "day07_shirakawago.jpg",
   8: "day08_hirayu-ski.jpg",
   9: "day09_matsumoto-castle.jpg",
  10: "day10_osaka-castle.jpg",
  11: "day11_nintendo-world.jpg",
  12: "day12_dotonbori.jpg",
  13: "day13_nara-deer.jpg",
  14: "day14_maruyama.jpg",
  15: "day15_fushimi-inari.jpg",
  16: "day16_stumptown.jpg",
  17: "day17_arashiyama-bamboo.jpg",
  18: "day18_hokanji-morning.jpg",
  19: "day19_shimokitazawa.jpg",
  20: "day20_ueno-park.jpg",
  21: "day21_akihabara.jpg",
  22: "day22_teamlab-planets.jpg",
  23: "day23_lake-kawaguchiko.jpg",
  24: "day24_the-park.jpg",
  25: "day25_fuji-view.jpg",
  26: "day26_tmg-building.jpg",
  27: "day27_muji.jpg",
  28: "day28_aquarium.jpg",
  29: "day29_starbucks-reserve.jpg",
  30: "day30_nakameguro.jpg",
  31: "day31_harajuku-last.jpg",
};

/** Returns the public URL of the atmosphere photo for a given
    trip day, or null when no curated photo is mapped. */
export const atmospherePhotoFor = (dayNumber) => {
  const file = ATMOSPHERE_FILE[dayNumber];
  return file ? `/photos/source/${file}` : null;
};
