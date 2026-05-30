/* ══════════════════════════════════════════════════════════════
   mapsUrl.js — single source of truth for Google Maps links.

   Every component that renders a "Google Maps" button MUST go
   through mapsUrlFor() so curated CSV `link` URLs in tripData are
   honored. Pre-fix history: each component defined its own
   `gmapsUrl(name)` that built a Hebrew name-search URL,
   completely ignoring item.link — so even when the data was
   correct, the buttons opened a search instead of the curated
   place. Centralising this prevents the bug from recurring.

   Resolution order:
     1. item.link  — if it's a real http(s) URL (curated)
     2. coordinates → /maps/search/?query=lat,lng  (precise)
     3. name + " Japan" → /maps/search/?query=<name>+Japan  (last)
   ══════════════════════════════════════════════════════════════ */

const isHttpUrl = (s) => typeof s === "string" && /^https?:\/\//i.test(s);

export const mapsUrlFor = (itemOrName) => {
  if (!itemOrName) return null;

  // Plain string fallback — only when we truly have nothing else.
  if (typeof itemOrName === "string") {
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(itemOrName + " Japan")}`;
  }

  const item = itemOrName;
  if (isHttpUrl(item.link)) return item.link;

  // Accept both nested `coordinates: {lng,lat}` and flat `lng`/`lat`
  // shapes — different surfaces (StoryFlow stops vs map markers)
  // have historically used different conventions.
  const lng = item.coordinates?.lng ?? item.lng;
  const lat = item.coordinates?.lat ?? item.lat;
  if (Number.isFinite(lng) && Number.isFinite(lat)) {
    return `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
  }

  const name = item.name || item.nameEn || item.nameHe || "";
  if (name) {
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(name + " Japan")}`;
  }
  return null;
};

export default mapsUrlFor;
