/* ══════════════════════════════════════════════════════════════
   mapsUrl.js — single source of truth for Google Maps links.

   Every component that renders a "Google Maps" button MUST go
   through mapsUrlFor() so we open the actual PLACE (its Google
   listing) rather than a bare coordinate pin.

   Resolution order (place identity first, coordinates last):
     1. item.link        — curated real http(s) URL
     2. item.place_id    — Google place → query_place_id opens the
                            real listing (hours, photos, reviews…)
     3. name (+ area)    — text search that resolves to the place
     4. coordinates      — LAST resort: a dropped pin, no identity
                            (correct only for custom map pins)

   History: call sites used to hardcode `?query=lat,lng`, which
   opens a pin at the coordinate instead of the store/attraction
   the user tapped. Routing everything through here fixes that and
   keeps it fixed. Destination-agnostic (no hardcoded country).
   ══════════════════════════════════════════════════════════════ */

const isHttpUrl = (s) => typeof s === "string" && /^https?:\/\//i.test(s);

// A real Google place_id (starts with "ChI…"); our simulated/local
// ids ("sim:…", "pid:…", "local-…") are NOT resolvable by Maps.
const isRealPlaceId = (s) =>
  typeof s === "string" && s.length > 8 && !/^(sim:|pid:|local[-:]|custom[-:])/i.test(s);

export const mapsUrlFor = (itemOrName) => {
  if (!itemOrName) return null;

  // Plain string — a name search, our weakest signal.
  if (typeof itemOrName === "string") {
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(itemOrName)}`;
  }

  const item = itemOrName;

  // 1. Curated real URL wins outright.
  if (isHttpUrl(item.link)) return item.link;

  const name = item.nameEn || item.name || item.nameHe || "";
  const pid = item.place_id || item.placeId || null;

  // 2. Google place_id → opens the ACTUAL listing, not a pin.
  if (isRealPlaceId(pid)) {
    const q = name ? encodeURIComponent(name) : "place";
    return `https://www.google.com/maps/search/?api=1&query=${q}&query_place_id=${encodeURIComponent(pid)}`;
  }

  // 3. Name search, with city/area context when we have it, so the
  //    right "Starbucks" resolves instead of the nearest one.
  if (name) {
    const ctx = item.city || item.area || item.cityHe || item.destination || "";
    const q = ctx && !name.includes(ctx) ? `${name} ${ctx}` : name;
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`;
  }

  // 4. Coordinates — last resort (a bare pin, no place identity).
  const lng = item.coordinates?.lng ?? item.lng;
  const lat = item.coordinates?.lat ?? item.lat;
  if (Number.isFinite(lng) && Number.isFinite(lat)) {
    return `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
  }
  return null;
};

export default mapsUrlFor;
