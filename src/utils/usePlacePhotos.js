import { useEffect, useState } from "react";
import { getDetails, isPlacesEnabled } from "../services/googlePlaces";

/* ══════════════════════════════════════════════════════════════
   usePlacePhotos — the REAL photo of a place, best source first.

   Priority (what Yoav asked for):
     1. the place's OWN main photo from Google Maps — via the Places
        SDK `getDetails(place_id)` (loads the SDK on demand, keyless
        MapLibre notwithstanding). This is the hero image you see on
        the Google Maps listing (e.g. the villa shot for a hotel).
     2. Google Street View of the coordinates — only when the place
        has no place_id or no Google photo (or a fetch problem).
     3. nothing → the caller shows a neutral "no photo" placeholder.

   Cached per session (module Map), each place resolved ≤1×.
   Returns `{ photoKey(item): url }`. Pair with `photoKey(item)`.
   ══════════════════════════════════════════════════════════════ */

const KEY = (process.env.REACT_APP_GOOGLE_MAPS_API_KEY || "").trim();

const coordsOf = (it) => {
  const lat = it?.coordinates?.lat ?? it?.lat;
  const lng = it?.coordinates?.lng ?? it?.lng;
  return Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : null;
};

const placeIdOf = (it) => it?.place_id || it?.placeId || null;
/* Places API (New) photo RESOURCE NAME carried from the AI pipeline. */
const photoNameOf = (it) => it?.photoName || it?.photo_name || null;
const newPhotoUrl = (name) => `https://places.googleapis.com/v1/${name}/media?maxWidthPx=400&key=${KEY}`;

/* Stable per-place key: the place_id when we have one (so the same
   place shares a photo across days), else the rounded coordinates. */
export const photoKey = (it) => {
  const pid = placeIdOf(it);
  if (pid) return `pid:${pid}`;
  const c = coordsOf(it);
  return c ? `${c.lat.toFixed(5)},${c.lng.toFixed(5)}` : null;
};

const isHttp = (s) => typeof s === "string" && /^https?:\/\//i.test(s);

const svImage = (c) =>
  `https://maps.googleapis.com/maps/api/streetview?size=400x400&location=${c.lat},${c.lng}&fov=80&source=outdoor&key=${KEY}`;
const svMeta = (c) =>
  `https://maps.googleapis.com/maps/api/streetview/metadata?location=${c.lat},${c.lng}&source=outdoor&key=${KEY}`;

// Session cache: key → Promise<string|null>. Each place resolved ≤1×.
const CACHE = new Map();

const resolveOne = (item, key) => {
  if (!CACHE.has(key)) {
    CACHE.set(key, (async () => {
      // 0️⃣ Places API (New) photo reference from the AI pipeline → sized 400px
      //    media URL, with NO extra Place-Details call (the cheap path).
      const pname = photoNameOf(item);
      if (pname && KEY) return newPhotoUrl(pname);
      // 1️⃣ the place's own Google Maps photo (hero image), via getDetails.
      const pid = placeIdOf(item);
      if (pid && isPlacesEnabled()) {
        try {
          const d = await getDetails(pid);
          if (d && isHttp(d.photoUrl)) return d.photoUrl;
        } catch { /* fall through to Street View */ }
      }
      // 2️⃣ Street View of the coordinates (fallback only).
      const c = coordsOf(item);
      if (c && KEY) {
        try {
          const r = await fetch(svMeta(c));
          const j = await r.json();
          if (j && j.status === "OK") return svImage(c);
        } catch { /* no coverage / offline */ }
      }
      return null;
    })());
  }
  return CACHE.get(key);
};

export const usePlacePhotos = (items) => {
  const [map, setMap] = useState({});
  const k = (items || []).map(photoKey).filter(Boolean).join("|");
  useEffect(() => {
    if (!KEY) return;
    let live = true;
    (items || []).forEach((it) => {
      const key = photoKey(it);
      if (!key) return;
      resolveOne(it, key).then((url) => {
        if (live && url) setMap((m) => (m[key] ? m : { ...m, [key]: url }));
      });
    });
    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [k]);
  return map;
};

export default usePlacePhotos;
