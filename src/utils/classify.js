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

export default classifyLocation;
