import { tripData, HOTEL_COORDINATES } from "./tripData";
import { cityTransitions } from "./transportData";
import {
  cityAbbreviation,
  categoryOf,
  transitBetween,
  haversineKm,
} from "./tripHelpers";

/* ══════════════════════════════════════════════════════════════
   STORY BUILDER — derives the Travel-Story timeline structure
   ──────────────────────────────────────────────────────────────
   tripData.js is read-only. This module converts the raw day
   array + city-transition table into the flat STORY[] sequence
   that <StoryFlow /> renders.

   Output item shapes:
     { type: 'day-header', day, cityHe, cityEn, city, subtitleHe,
       meta, date, collapsed? }
     { type: 'stop',  city, icon, stopNum, titleHe, titleEn,
       tagHe, descHe, note?, coordinates, rating?,
       stopId }
     { type: 'transit',     mode, min, dist }
     { type: 'hotel',  city, nameHe, nameEn, neighborhoodHe,
       nightsLabel, checkin, checkout, coordinates }
     { type: 'city-transit', fromCity, toCity, mode, lineHe,
       lineEn, duration, distance?, depart, arrive, note? }
   ══════════════════════════════════════════════════════════════ */

/* ─── City registry (used by StoryFlow for accent colours) ─── */
export const STORY_CITIES = [
  { code: "TOK", nameEn: "Tokyo",            nameHe: "טוקיו",        color: "#C0392B" },
  { code: "DIS", nameEn: "Tokyo Disney",     nameHe: "טוקיו דיסני",  color: "#E87D6E" },
  { code: "TDS", nameEn: "Tokyo DisneySea",  nameHe: "דיסני סי",     color: "#F09080" },
  { code: "KNZ", nameEn: "Kanazawa",         nameHe: "קנזוואה",      color: "#2E7D52" },
  { code: "TKY", nameEn: "Takayama",         nameHe: "טקיאמה",       color: "#5C7A2E" },
  { code: "MTM", nameEn: "Matsumoto",        nameHe: "מטסומוטו",     color: "#728F45" },
  { code: "NGY", nameEn: "Nagoya",           nameHe: "נגויה",        color: "#C4A048" },
  { code: "OSA", nameEn: "Osaka",            nameHe: "אוסקה",        color: "#B8331E" },
  { code: "USJ", nameEn: "Osaka Universal",  nameHe: "יוניברסל",     color: "#E85A45" },
  { code: "NRA", nameEn: "Nara",             nameHe: "נארה",         color: "#C4A048" },
  { code: "KYO", nameEn: "Kyoto",            nameHe: "קיוטו",        color: "#8F2818" },
  { code: "KWG", nameEn: "Kawaguchiko",      nameHe: "קוואגוצ׳יקו",  color: "#1A5276" },
  { code: "HKN", nameEn: "Hakone",           nameHe: "האקונה",       color: "#6B8E5A" },
];

const cityIndexByName = (city) => {
  const base = (city || "").replace(/ \d+$/, "");
  const idx = STORY_CITIES.findIndex((c) => c.nameEn === base);
  return idx >= 0 ? idx + 1 : 1; /* fallback to TOK */
};

/* ─── Normalize for city-instance grouping ──
   Day-trips and sub-parks share the parent city: Tokyo Disney/
   DisneySea group with Tokyo, Universal groups with Osaka. */
const PARENT_MAP = {
  "Tokyo Disney":    "Tokyo",
  "Tokyo DisneySea": "Tokyo",
  "Osaka Universal": "Osaka",
};
const normalizedCityName = (city) => {
  const base = (city || "").replace(/ \d+$/, "");
  return PARENT_MAP[base] || base;
};

/** Build the chronological "visit path" used by the city filter:
    one entry per consecutive run of days in the same (normalized)
    city. Cities visited more than once are numbered ("Tokyo 1",
    "Tokyo 2", …); single-visit cities use their bare name.
    Each entry: { key, label, labelHe, cityIdx, instance,
                   startDay, endDay, color } */
export const getChronologicalCityPath = () => {
  const path = [];
  let current = null;
  const counts = {};

  tripData.forEach((day) => {
    const norm = normalizedCityName(day.city);
    if (!current || current.norm !== norm) {
      if (current) path.push(current);
      counts[norm] = (counts[norm] || 0) + 1;
      current = {
        norm,
        cityIdx: STORY_CITIES.findIndex((c) => c.nameEn === norm) + 1 || 1,
        instance: counts[norm],
        startDay: day.day,
        endDay: day.day,
      };
    } else {
      current.endDay = day.day;
    }
  });
  if (current) path.push(current);

  const total = {};
  path.forEach((p) => {
    total[p.norm] = (total[p.norm] || 0) + 1;
  });
  path.forEach((p) => {
    const rec = STORY_CITIES[p.cityIdx - 1] || STORY_CITIES[0];
    p.color = rec.color;
    if (total[p.norm] > 1) {
      p.key     = `${p.norm}#${p.instance}`;
      p.label   = `${rec.nameEn} ${p.instance}`;
      p.labelHe = `${rec.nameHe} ${p.instance}`;
    } else {
      p.key     = p.norm;
      p.label   = rec.nameEn;
      p.labelHe = rec.nameHe;
    }
  });
  return path;
};

/* Resolve a city-key (e.g. "Tokyo#2" or "Kanazawa") to its day-range. */
const dayRangeForCityKey = (cityKey) => {
  if (!cityKey) return null;
  const path = getChronologicalCityPath();
  /* Support both "Tokyo#2" and bare "Tokyo" (= first instance) */
  const direct = path.find((p) => p.key === cityKey);
  if (direct) return { start: direct.startDay, end: direct.endDay };
  const baseName = cityKey.split("#")[0];
  const first = path.find((p) => p.norm === baseName);
  if (first) return { start: first.startDay, end: first.endDay };
  return null;
};

/* ─── Category filter (shopping/attractions/food/hotels) ─── */
const isShoppingName = (name = "") => {
  const n = name.toLowerCase();
  return ["market", "don quijote", "parco", "muji", "outlet", "uniqlo",
          "kappabashi", "shopping", "store", "ameyoko", "sunshine city",
          "radio kaikan"].some((kw) => n.includes(kw));
};

const stopMatchesCategory = (stop, category) => {
  if (!category) return true;
  if (category === "food")        return stop.kind === "lunch" || stop.kind === "dinner";
  if (category === "shopping")    return stop.kind === "attraction" && isShoppingName(stop.titleEn || stop.name);
  if (category === "attractions") return stop.kind === "attraction" && !isShoppingName(stop.titleEn || stop.name);
  if (category === "hotels")      return false; /* hotels handled separately as their own row */
  return true;
};

/* ─── Calendar dates ─── */
const TRIP_START = new Date(2024, 1, 18); // Feb 18, 2024 = Day 1
const HE_MONTH = [
  "ינואר", "פברואר", "מרץ", "אפריל", "מאי", "יוני",
  "יולי", "אוגוסט", "ספטמבר", "אוקטובר", "נובמבר", "דצמבר",
];
const dateLabelHe = (dayNumber) => {
  const d = new Date(TRIP_START);
  d.setDate(d.getDate() + (dayNumber - 1));
  return `${d.getDate()} ${HE_MONTH[d.getMonth()]}`;
};

/* ─── Icon glyph mapping ─────────────────────────────────────
   Maps an item to one of the v3 glyph names. */
const SHRINE_RX = /shrine|temple|inari|pagoda|todai|gate|torii|מקדש|פגוד|שער/i;
const CASTLE_RX = /castle|tower|טירה|מגדל/i;
const SUSHI_RX  = /sushi|סושי/i;
const RAMEN_RX  = /ramen|udon|soba|noodle|ראמן|אודון|סובה/i;
const CAFE_RX   = /coffee|café|cafe|starbucks|bricolage|anakuma|stumptown|בית קפה|קפה/i;
const BAR_RX    = /bar|izakaya|golden gai|בר|אזקאיה/i;
const PARK_RX   = /park|garden|gyoen|forest|פארק|גן /i;
const VIEW_RX   = /view|crossing|teamlab|sky deck|observation|תצפית|חציית/i;
const SHOPPING_RX = /market|don quijote|parco|muji|outlet|uniqlo|kappabashi|store|ameyoko|shopping|חנות|שוק|קניות/i;

const pickGlyph = (item) => {
  const text = `${item.name || ""} ${item.nameHe || ""} ${item.desc || ""}`;
  if (CAFE_RX.test(text))     return "cup";
  if (RAMEN_RX.test(text))    return "noodle";
  if (SUSHI_RX.test(text))    return "sushi";
  if (BAR_RX.test(text))      return "glass";
  if (SHRINE_RX.test(text))   return "torii";
  if (CASTLE_RX.test(text))   return "tower";
  if (PARK_RX.test(text))     return "torii";
  if (VIEW_RX.test(text))     return "tower";
  if (SHOPPING_RX.test(text)) return "cup"; /* fallback for shopping — no bag glyph yet */
  return "walk";
};

/* ─── Short Hebrew category tag (for the pill under the title) ─── */
const tagHeFor = (item) => {
  const text = `${item.name || ""} ${item.nameHe || ""} ${item.desc || ""}`.toLowerCase();
  if (/castle|טירת|טירה/i.test(text)) return "טירה היסטורית";
  if (/market|שוק|kuromon|nishiki|omicho|ameyoko/i.test(text)) return "שוק מקומי";
  if (/disney|universal|teamlab/i.test(text)) return "פארק שעשועים";
  if (/onsen|hot spring|אונסן/i.test(text)) return "מעיינות חמים";
  if (RAMEN_RX.test(text))  return "מסעדת ראמן";
  if (SUSHI_RX.test(text))  return "מסעדת סושי";
  if (/gyoza/i.test(text))  return "מסעדת גיוזה";
  if (/yakiniku/i.test(text)) return "בשרים על האש";
  if (/burger|המבורגר/i.test(text)) return "המבורגרייה";
  if (/pizza|פיצ/i.test(text)) return "פיצרייה";
  if (/pancake|פנקייק/i.test(text)) return "מסעדת פנקייקים";
  if (/udon|אודון/i.test(text)) return "מסעדת אודון";
  if (/duck|ברווז/i.test(text)) return "מסעדה מיוחדת";
  if (BAR_RX.test(text))    return "באר אינטימי";
  if (CAFE_RX.test(text))   return "בית קפה";
  if (SHRINE_RX.test(text)) return "מקדש שינטו";
  if (CASTLE_RX.test(text)) return "טירה";
  if (PARK_RX.test(text))   return "גן יפני";
  if (VIEW_RX.test(text))   return "תצפית";
  if (SHOPPING_RX.test(text)) return "אזור קניות";
  const cat = categoryOf(item);
  if (cat === "food") return "מסעדה";
  return "מקום";
};

/* ─── Note splitter ─────────────────────────────────────────
   tripData's `desc` field mixes factual prose with personal voice.
   We treat the whole desc as a "personal note" — paper-style
   marginalia — and surface a category-derived informational
   blurb as descHe. */
const personalNote = (item) => {
  if (!item.desc) return null;
  const text = item.desc
    .replace(/\s*ציון[:：]?\s*[\d./]+\s*\/?\s*10?\s*\.?/u, "")
    .trim();
  if (!text) return null;
  /* Author cue derived from the first phrase */
  let author = "מאיתנו";
  if (/^המלצת זהב/.test(item.desc))        author = "אמאלה";
  else if (/^אזהרה|^שימו לב|⚠/.test(item.desc)) author = "אזהרה";
  else if (/^טיפ|^תזמון/.test(item.desc))   author = "טיפ";
  return { author, textHe: text };
};

/* ─── Informational descHe per item ─────────────────────── */
const DESC_BY_CATEGORY = {
  ramen:    "מסעדת ראמן יפנית.",
  sushi:    "מסעדת סושי טרי, סגנון יפני אותנטי.",
  cafe:     "בית קפה מקומי עם עיצוב ייחודי.",
  shrine:   "מקדש שינטו עתיק, נקודה רוחנית בלב העיר.",
  park:     "פארק / גן יפני מטופח להליכה רגועה.",
  shopping: "אזור קניות תוסס.",
  view:     "נקודת תצפית פנורמית.",
  hotel:    "מקום הלינה ליום.",
  onsen:    "מעיינות חמים — חוויית רחצה יפנית מסורתית.",
  food:     "מסעדה מקומית.",
  place:    "",
};
const descHeFor = (item) => DESC_BY_CATEGORY[categoryOf(item)] || "";

/* ─── Day-level helpers ───────────────────────────────────── */
const districtsFor = (day) => {
  /* Look for common district keywords inside the day's items and
     produce a Hebrew district list. Falls back to "" if nothing
     recognised. */
  const KEYWORDS = {
    Harajuku:"הראג׳וקו", Shibuya:"שיבויה", Shinjuku:"שינג׳וקו",
    Roppongi:"רופונגי", Asakusa:"אסקוסה", Akihabara:"אקיהברה",
    Ginza:"גינזה", Ueno:"אואנו", Shimokitazawa:"שימוקיטאזאווה",
    Nakameguro:"נקאמגורו", Omotesando:"אומוטסנדו", Yoyogi:"יויוגי",
    "Golden Gai":"גולדן גאי", Maihama:"מאיהאמה", Tsukishima:"צוקישימה",
    Gion:"גיון", Higashiyama:"היגאשיאמה", Arashiyama:"אראשיאמה",
    Pontocho:"פונטוצ׳ו", Fushimi:"פושימי", Kinkaku:"קינקאקו",
    Kiyomizu:"קיומיזו", Nishiki:"נישיקי", Maruyama:"מריומה",
    Umeda:"אומדה", Namba:"נמבה", Dotonbori:"דוטונבורי",
    Shinsaibashi:"שינסאיבאשי", Kuromon:"קורומון",
    Higashi:"היגאשי", Omicho:"אומיצ׳ו", Kenrokuen:"קנרוקואן",
    Sanmachi:"סאנמאצ׳י", Hida:"הידה", Shirakawa:"שירקאווה",
    Yumoto:"יומוטו", Gora:"גורה", Sengokuhara:"סנגוקוהארה",
    Gotemba:"גוטמבה", Chureito:"צ׳ורייטו",
  };
  const text = [
    ...(day.attractions || []).map((a) => `${a.name || ""} ${a.nameHe || ""} ${a.desc || ""}`),
    `${day.lunch?.place || ""} ${day.lunch?.desc || ""}`,
    `${day.dinner?.place || ""} ${day.dinner?.desc || ""}`,
    day.title || "",
  ].join(" ");
  const found = [];
  Object.entries(KEYWORDS).forEach(([en, he]) => {
    if (text.includes(en) && !found.includes(he)) found.push(he);
  });
  return found.slice(0, 3);
};

/* ─── Per-day dedup: drop attractions duplicated as meals ─── */
const sameLoc = (a, b) => {
  if (!a || !b) return false;
  const an = (a.name || "").trim().toLowerCase();
  const bn = (b.name || "").trim().toLowerCase();
  if (an && bn && an === bn) return true;
  if (a.coordinates && b.coordinates) {
    if (Math.abs(a.coordinates.lng - b.coordinates.lng) < 0.0003 &&
        Math.abs(a.coordinates.lat - b.coordinates.lat) < 0.0003) return true;
  }
  return false;
};

/* ─── Chronological stops for a day (UI-level dedup applied) ─── */
const stopsForDay = (day) => {
  const attractions = day.attractions || [];
  const lunch  = day.lunch  && day.lunch.place  && day.lunch.place  !== "—" ? day.lunch  : null;
  const dinner = day.dinner && day.dinner.place && day.dinner.place !== "—" ? day.dinner : null;

  const filteredAttractions = attractions.filter((a) => {
    if (lunch  && sameLoc(a, { name: lunch.place,  coordinates: lunch.coordinates }))  return false;
    if (dinner && sameLoc(a, { name: dinner.place, coordinates: dinner.coordinates })) return false;
    return true;
  });

  const splitIdx = Math.ceil(filteredAttractions.length / 2);
  const morning   = filteredAttractions.slice(0, splitIdx);
  const afternoon = filteredAttractions.slice(splitIdx);

  const items = [];
  morning.forEach((a) => items.push({ ...a, kind: "attraction" }));
  if (lunch)  items.push({ ...lunch,  name: lunch.place,  kind: "lunch" });
  afternoon.forEach((a) => items.push({ ...a, kind: "attraction" }));
  if (dinner) items.push({ ...dinner, name: dinner.place, kind: "dinner" });
  return items;
};

/* ─── Build a `stop` story item from a raw day item ─── */
const buildStop = (item, dayNum, stopNum) => {
  const cityIdx = cityIndexByName(item.city || "");
  const note = personalNote(item);
  const tagHe = tagHeFor(item);
  let tagWithRating = tagHe;
  if (item.rating && item.rating !== "—") {
    tagWithRating = `${tagHe} · ${item.rating}`;
  }

  return {
    type: "stop",
    stopId: `d${dayNum}-${stopNum}`,
    day: dayNum,
    city: cityIdx,
    icon: pickGlyph(item),
    stopNum,
    titleHe: item.nameHe || item.name,
    titleEn: item.name,
    tagHe: tagWithRating,
    descHe: descHeFor(item),
    note,
    coordinates: item.coordinates || null,
    rating: item.rating && item.rating !== "—" ? item.rating : null,
    kind: item.kind,
  };
};

/* ─── Transit item between two consecutive stops ─── */
const buildTransit = (a, b) => {
  const t = transitBetween(a.coordinates, b.coordinates);
  if (!t) return null;
  return {
    type: "transit",
    mode: t.mode,
    min: t.minutes,
    dist: t.km < 1 ? `${Math.round(t.km * 1000)} מ׳` : `${t.km.toFixed(1)} ק״מ`,
  };
};

/* ─── Hotel anchor (end-of-day card) ─── */
const buildHotel = (day, dayIdx, sameHotelStreak) => {
  if (!day.hotel || day.hotel === "—") return null;
  const coords = HOTEL_COORDINATES[day.hotel] || day.coordinates;
  const cityIdx = cityIndexByName(day.city);
  return {
    type: "hotel",
    city: cityIdx,
    nameHe: day.hotel,
    nameEn: day.hotel,
    neighborhoodHe: day.cityHe || day.city,
    nightsLabel: sameHotelStreak.total > 1
      ? `לילה ${sameHotelStreak.index} מתוך ${sameHotelStreak.total}`
      : "לילה אחד",
    checkin: "15:00",
    checkout: "12:00",
    coordinates: coords ? { lng: coords.lng, lat: coords.lat } : null,
  };
};

/* ─── City-transit milestone (Shinkansen / bus / car) ─── */
const TRANSIT_LINE_HE = {
  shinkansen: "הוקוריקו שינקנסן",
  bus:        "אוטובוס מהיר",
  train:      "JR — רכבת מהירה",
  car:        "רכב שכור",
};
const buildCityTransit = (transition) => {
  if (!transition) return null;
  return {
    type: "city-transit",
    fromCity: cityIndexByName(transition.fromCity),
    toCity:   cityIndexByName(transition.toCity),
    fromHe:   transition.fromCityHe || transition.fromCity,
    toHe:     transition.toCityHe   || transition.toCity,
    mode:     transition.icon,
    lineHe:   `${TRANSIT_LINE_HE[transition.icon] || transition.mode} · ${transition.fromCityHe} → ${transition.toCityHe}`,
    lineEn:   `${transition.mode} · ${transition.fromCity} → ${transition.toCity}`,
    duration: transition.duration.replace(/^~\s*/, ""),
    depart:   `${transition.fromCityHe} ▶`,
    arrive:   `◀ ${transition.toCityHe}`,
    note:     transition.modeJa ? `${transition.mode} · ${transition.modeJa}` : "",
  };
};

/* ─── Build hotel-streak metadata (for "Night N of M" labels) ─── */
const buildHotelStreaks = () => {
  const streaks = []; // [{ name, days: [d1,d2,...] }]
  let current = null;
  tripData.forEach((day) => {
    if (!day.hotel || day.hotel === "—") {
      current = null;
      return;
    }
    if (!current || current.name !== day.hotel) {
      current = { name: day.hotel, days: [day.day] };
      streaks.push(current);
    } else {
      current.days.push(day.day);
    }
  });
  return streaks;
};

/* ══════════════════════════════════════════════════════════════
   PUBLIC API — buildStory()
   Returns the flat STORY[] array consumed by <StoryFlow />.

   Optional filters:
     cityKey    — restrict to a single chronological visit, e.g.
                  "Tokyo#2" or "Kanazawa". Days outside the range
                  are dropped along with the inter-city transit
                  cards that surround them.
     category   — one of: 'food' | 'attractions' | 'shopping' |
                  'hotels'. Inside each day we keep only the
                  matching stops. Transit chips between stops are
                  suppressed (they only make sense for a full day
                  flow). Hotels become the sole content when
                  category === 'hotels'.
   ══════════════════════════════════════════════════════════════ */
export const buildStory = ({ cityKey = null, category = null } = {}) => {
  const items = [];
  const transitionsAfterDay = new Map();
  cityTransitions.forEach((t) => transitionsAfterDay.set(t.afterDay, t));

  const streaks = buildHotelStreaks();
  const streakInfo = (hotelName, dayNum) => {
    const s = streaks.find((x) => x.name === hotelName && x.days.includes(dayNum));
    if (!s) return { index: 1, total: 1 };
    return { index: s.days.indexOf(dayNum) + 1, total: s.days.length };
  };

  const range = dayRangeForCityKey(cityKey);
  const isFiltered = !!(cityKey || category);

  tripData.forEach((day, dayIdx) => {
    /* City filter — drop days outside the chronological range */
    if (range && (day.day < range.start || day.day > range.end)) return;

    const districts = districtsFor(day);
    const cityIdx = cityIndexByName(day.city);
    const cityRec = STORY_CITIES[cityIdx - 1];

    /* Build raw stops + filter by category */
    const rawStops = stopsForDay(day);
    const visibleStops = rawStops
      .map((rawStop, i) => buildStop({ ...rawStop, city: day.city }, day.day, i + 1))
      .filter((stop) => stopMatchesCategory(stop, category));

    /* For 'hotels' category, skip day if no hotel; otherwise show
       only the hotel row anchored under the header. */
    const showHotelOnly = category === "hotels";
    const wantHotel = !!day.hotel && day.hotel !== "—" &&
      (!cityKey || (range && day.day >= range.start && day.day <= range.end));

    /* Skip the entire day when no content survives the filter */
    if (category && !showHotelOnly && visibleStops.length === 0) return;
    if (showHotelOnly && !wantHotel) return;

    /* Day header */
    items.push({
      type: "day-header",
      day: day.day,
      cityHe: day.cityHe || cityRec.nameHe,
      cityEn: cityRec.nameEn,
      city: cityIdx,
      subtitleHe: districts.join(" · "),
      meta: `${cityAbbreviation(day.city)} · יום ${day.day}`,
      date: dateLabelHe(day.day),
    });

    if (!showHotelOnly) {
      visibleStops.forEach((stop, i) => {
        /* Re-stamp stopNum so it reads sequentially after filtering */
        items.push({ ...stop, stopNum: i + 1 });
        /* Transit chips only when no category filter is active —
           otherwise the chain has gaps and the times mislead. */
        if (!category) {
          const next = visibleStops[i + 1];
          if (next && stop.coordinates && next.coordinates) {
            const transit = buildTransit(
              { coordinates: stop.coordinates },
              { coordinates: next.coordinates }
            );
            if (transit) items.push(transit);
          }
        }
      });
    }

    /* Hotel anchor — always render except when category filter
       is active and category !== 'hotels' */
    if (wantHotel && (!category || category === "hotels")) {
      const hotel = buildHotel(day, dayIdx, streakInfo(day.hotel, day.day));
      if (hotel) items.push(hotel);
    }

    /* Inter-city transit AFTER this day — suppressed when filters
       are active (the next day after the transit might be filtered
       out, leaving an orphan transit card). */
    if (!isFiltered) {
      const transition = transitionsAfterDay.get(day.day);
      if (transition) {
        const ct = buildCityTransit(transition);
        if (ct) items.push(ct);
      }
    }
  });

  return items;
};

/* Convenience: list of all stops (used for map sync) */
export const buildStopList = () =>
  buildStory().filter((it) => it.type === "stop");

/* Compute haversine straight-line distance between two stop ids
   for analytics — kept as a stub for now (unused by UI). */
export const distanceBetweenStopIds = (story, idA, idB) => {
  const a = story.find((s) => s.stopId === idA);
  const b = story.find((s) => s.stopId === idB);
  if (!a || !b) return null;
  return haversineKm(a.coordinates, b.coordinates);
};
