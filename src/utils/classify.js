/* ══════════════════════════════════════════════════════════════
   classify.js — heuristic tagging + dedup (spec §5).

   classifyLocation(googleTypes) maps a Google Places `types` array
   to the app's coarse category + a Hebrew label + emoji. Food-ish
   types collapse to a single 'food' node; everything else falls to
   the nearest bucket, or 'unknown' (which the UI resolves with the
   4 quick-pick pills).
   ══════════════════════════════════════════════════════════════ */

export const CATEGORY_META = {
  food:       { he: "אוכל",     emoji: "🍜" },
  cafe:       { he: "בית קפה",  emoji: "☕" },
  hotel:      { he: "מלון",     emoji: "🏨" },
  attraction: { he: "אטרקציה",  emoji: "⛩️" },
  unknown:    { he: "מקום",     emoji: "📍" },
};

/* Quick-pick pills shown for ambiguous / manual pins. */
export const QUICK_PICKS = ["attraction", "food", "hotel", "cafe"];

/* Sprint 50 — resolve a stored Hebrew category label to a single leading
   emoji for the ultra-compact list rows (timeline + Places Inbox). Matched by
   substring so specific labels ("טירה", "מוזיאון", "ראמן") map cleanly to a
   family glyph, falling back to a neutral pin. */
export const categoryEmoji = (cat = "") => {
  const s = String(cat);
  if (/שדה תעופה|נמל תעופה|טיסה|מטוס/.test(s)) return "✈️";
  if (/מלון|לינה|אכסניה|צימר|הוסטל/.test(s)) return "🏨";
  if (/קפה/.test(s)) return "☕";
  if (/בר\b|פאב/.test(s)) return "🍺";
  if (/ראמן|סושי|אודון|סובה|גיוזה|מסעד|אוכל|המבורגר|פיצה|פנקייק|קינוח|קונביני|מאפייה|שוק אוכל|דוכן/.test(s)) return "🍜";
  if (/אגם|נהר|מפל|חוף|ים|טבע|הר|גן לאומי|יער/.test(s)) return "🏞️";
  if (/פארק|גן /.test(s)) return "🌳";
  if (/מקדש|מנזר|טורי|קדוש|כנסייה/.test(s)) return "⛩️";
  if (/טירה|ארמון/.test(s)) return "🏯";
  if (/מוזיאון|גלריה|אמנות/.test(s)) return "🏛️";
  if (/אקווריום/.test(s)) return "🐠";
  if (/זו|ספארי|חיות/.test(s)) return "🦁";
  if (/אונסן|מרחצאות|ספא/.test(s)) return "♨️";
  if (/קניות|חנות|קניון|שוק|יד שנייה/.test(s)) return "🛍️";
  if (/משחקים|ארקיד|אנימה|בידור|לונה/.test(s)) return "🎮";
  if (/סקי/.test(s)) return "🎿";
  if (/תחנת רכבת|רכבת|מטרו/.test(s)) return "🚉";
  if (/נקודה אישית|אישי/.test(s)) return "📌";
  return "📍";
};

const FOOD_TYPES = new Set([
  "restaurant", "food", "meal_takeaway", "meal_delivery", "bar", "bakery",
]);
const CAFE_TYPES = new Set(["cafe", "coffee_shop"]);
const HOTEL_TYPES = new Set(["lodging", "hotel", "resort_hotel", "guest_house"]);
const ATTRACTION_TYPES = new Set([
  "tourist_attraction", "museum", "park", "art_gallery", "zoo", "aquarium",
  "amusement_park", "shrine", "place_of_worship", "natural_feature",
  "point_of_interest", "landmark",
]);

/* Returns { category, he, emoji }. cafe is checked before food so a
   coffee shop doesn't get swallowed by the generic food bucket. */
export const classifyLocation = (types = []) => {
  const t = (types || []).map((x) => String(x).toLowerCase());
  const has = (set) => t.some((x) => set.has(x));
  let category = "unknown";
  if (has(CAFE_TYPES)) category = "cafe";
  else if (has(FOOD_TYPES)) category = "food";
  else if (has(HOTEL_TYPES)) category = "hotel";
  else if (has(ATTRACTION_TYPES)) category = "attraction";
  return { category, ...CATEGORY_META[category] };
};

/* Normalize a Google rating (0–5) to the app's "/10" badge string
   so map/list badges read consistently (e.g. 4.7 → "9.4/10"). */
export const ratingToBadge = (googleRating) => {
  if (googleRating == null || isNaN(googleRating)) return null;
  const ten = Math.round(googleRating * 2 * 10) / 10; // 1-dp /10
  return `${ten}/10`;
};

/* Render-time rating normalisation for the stop card (spec §2.5, §8.5).
   Three writers disagree on scale/type — this makes the CARD consistent
   without rewriting stored data:
     • a string already ending "/10"  → pass through as-is
     • a bare number ≤ 5              → Google 0-5 scale, reuse ratingToBadge
     • a bare number > 5              → already /10, format directly
   Returns null for anything unparseable; StopCard renders nothing then. */
export const normalizeRating = (raw) => {
  if (raw == null) return null;
  if (typeof raw === "string") {
    const s = raw.trim();
    if (/\/10$/.test(s)) return s;
    const n = parseFloat(s);
    if (!Number.isFinite(n)) return null;
    return n <= 5 ? ratingToBadge(n) : `${Math.round(n * 10) / 10}/10`;
  }
  const n = Number(raw);
  if (!Number.isFinite(n)) return null;
  return n <= 5 ? ratingToBadge(n) : `${Math.round(n * 10) / 10}/10`;
};

/* ── Strict per-day dedup (spec §5) ──
   A location entity can exist once per day. We key by a normalized
   name (case/space-insensitive). When duplicates collide we keep
   the first occurrence and merge any missing fields from the later
   one (so a node that's both "sightseeing" and "lunch" becomes a
   single merged node). For multiple distinct food spots, the first
   food node is the day's primary meal; the rest keep their own
   category (cafe/attraction) — they are NOT dropped. */
const normName = (s) => (s || "").trim().toLowerCase().replace(/\s+/g, " ");

export const dedupeDayStops = (stops = []) => {
  const seen = new Map(); // normName → index in result
  const result = [];
  let primaryMealTaken = false;

  for (const stop of stops) {
    const key = normName(stop.name || stop.nameHe);
    if (key && seen.has(key)) {
      /* Merge into the existing node — fill blanks only. */
      const idx = seen.get(key);
      result[idx] = { ...stop, ...result[idx] };
      continue;
    }
    const node = { ...stop };
    /* First food node = primary meal milestone; later food nodes
       are downgraded to alternative cafe/attraction nodes. */
    if (node.category === "food") {
      if (!primaryMealTaken) {
        primaryMealTaken = true;
        node.isPrimaryMeal = true;
      } else {
        node.isPrimaryMeal = false;
      }
    }
    if (key) seen.set(key, result.length);
    result.push(node);
  }
  return result;
};

/* Sprint (budget Phase B, finding 2) — clone a stop with a FRESH instanceId.
   instanceId is the stable identity a budget item's stopRef points at
   (trip-budget-design §1.5): two stops must never share one, or one
   expense would resolve to two places on the map. `genId` is the caller's
   id generator (e.g. EditorView's genInstanceId), injected so this stays a
   pure, testable helper with no crypto/Date dependency of its own. Every
   other field is preserved untouched. */
export const withFreshInstanceId = (stop, genId) => ({ ...stop, instanceId: genId() });

export default classifyLocation;
