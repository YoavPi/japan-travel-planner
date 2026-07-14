/* ══════════════════════════════════════════════════════════════
   googlePlaces — wrapper around the Google Maps JS Places API with
   FinOps + flood protection and a graceful simulation fallback.

   Live path (REACT_APP_GOOGLE_MAPS_API_KEY set AND under the monthly
   budget cap) → real Google Places predictions + details, with every
   billed session metered into finOpsTracker.

   Fallback path (no key / over budget / SDK load failure) → a
   deterministic geometric simulation engine that synthesises
   plausible predictions + details so the search UX (and PlaceInfoCard
   hydration) keeps working with ZERO outbound cost.

   Flood protection: a rolling in-memory rate limiter caps the search
   endpoint at RL_MAX requests per RL_WINDOW; exceeding it throws a
   RateLimitError carrying a Hebrew "too many requests" message.

   Exposes:
     isPlacesEnabled()  → boolean (a live API key is configured)
     isSearchEnabled()  → boolean (search works — live OR simulated)
     loadPlaces()       → Promise (loads the SDK once)
     autocomplete(q)    → Promise<[{placeId, primary, secondary}]>
     getDetails(id)     → Promise<{ name, lat, lng, rating,
                                    ratingCount, types, address, photoUrl }>
   ══════════════════════════════════════════════════════════════ */

import finOpsTracker from "../utils/finOpsTracker";

const KEY = (process.env.REACT_APP_GOOGLE_MAPS_API_KEY || "").trim();

/* A real Google Maps key is a long token (~39 chars). We require a
   length > 10 so empty placeholders or accidental short/garbage values
   never flip the app into billable live mode — paste a real key and it
   lights up immediately. */
const hasLiveKey = () => KEY.length > 10;

/* True when a live API key is configured. */
export const isPlacesEnabled = () => hasLiveKey();

/* Search always works — live when possible, simulated otherwise. */
export const isSearchEnabled = () => true;

/* Live calls are only issued with a key AND while under the budget cap.
   When a key IS configured but the FinOps ceiling has been hit we emit a
   one-shot warning so the silent drop to the simulation layer is visible
   in the console (and never bills a real request). */
let budgetWarned = false;
const liveAvailable = () => {
  if (!hasLiveKey()) return false;
  if (finOpsTracker.checkBudgetAvailable()) { budgetWarned = false; return true; }
  if (!budgetWarned) {
    budgetWarned = true;
    console.warn(
      `[finOps] Monthly Google Places budget cap ($${finOpsTracker.MONTHLY_CAP_USD}) reached ` +
      `— bypassing live API and serving the local simulation fallback.`
    );
  }
  return false;
};

/* ── Client-side rate limiter (flood protection) ─────────────────── */
const RL_WINDOW = 60000; // 60-second rolling window
const RL_MAX = 15;       // max search requests per window
let rlHits = [];

export class RateLimitError extends Error {
  constructor() {
    super("אנא המתינו דקה לפני החיפוש הבא");
    this.name = "RateLimitError";
    this.code = "rate-limited";
  }
}

const enforceRateLimit = () => {
  const now = Date.now();
  rlHits = rlHits.filter((t) => now - t < RL_WINDOW);
  if (rlHits.length >= RL_MAX) throw new RateLimitError();
  rlHits.push(now);
};

/* ── SDK loader + service singletons ─────────────────────────────── */
let loadPromise = null;
let autoSvc = null;
let placesSvc = null;
let sessionToken = null;

export const loadPlaces = () => {
  if (!hasLiveKey()) return Promise.reject(new Error("no-api-key"));
  if (window.google?.maps?.places) return Promise.resolve(window.google);
  if (loadPromise) return loadPromise;

  loadPromise = new Promise((resolve, reject) => {
    const cbName = "__tpPlacesReady";
    window[cbName] = () => resolve(window.google);
    const s = document.createElement("script");
    s.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(KEY)}&libraries=places&language=he&loading=async&callback=${cbName}`;
    s.async = true;
    s.defer = true;
    s.onerror = () => reject(new Error("places-load-failed"));
    document.head.appendChild(s);
  });
  return loadPromise;
};

const ensureServices = async () => {
  const google = await loadPlaces();
  if (!autoSvc) autoSvc = new google.maps.places.AutocompleteService();
  if (!placesSvc) placesSvc = new google.maps.places.PlacesService(document.createElement("div"));
  if (!sessionToken) sessionToken = new google.maps.places.AutocompleteSessionToken();
  return google;
};

/* ── Geometric fallback simulation engine ────────────────────────── */
const SIM_CENTER = { lat: 35.0116, lng: 135.7681 }; // Kyoto anchor
const SIM_SUFFIXES = ["מרכז", "תחנה", "פארק", "שוק", "מקדש", "מוזיאון", "גן", "רובע"];
const SIM_TYPES = [
  ["restaurant", "food"],
  ["cafe"],
  ["lodging"],
  ["tourist_attraction", "point_of_interest"],
  ["museum"],
  ["park"],
];

const hash = (str) => {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) >>> 0;
  return h;
};

const simAutocomplete = (query) => {
  const q = query.trim();
  const base = hash(q);
  return Array.from({ length: 5 }).map((_, i) => {
    const sfx = SIM_SUFFIXES[(base + i) % SIM_SUFFIXES.length];
    return {
      placeId: `sim:${base}:${i}:${encodeURIComponent(q)}`,
      primary: `${q} ${sfx}`,
      secondary: "תוצאה מדומה · ללא חיוב",
    };
  });
};

const simDetails = (placeId) => {
  const parts = String(placeId).split(":");
  const idx = parseInt(parts[2] || "0", 10) || 0;
  const q = decodeURIComponent(parts[3] || "מקום");
  const base = hash(String(placeId));
  /* Geometric radial offset from the anchor — deterministic per id. */
  const angle = ((base % 360) * Math.PI) / 180;
  const rad = 0.02 + (base % 50) / 1000;
  const lat = SIM_CENTER.lat + Math.cos(angle) * rad;
  const lng = SIM_CENTER.lng + Math.sin(angle) * rad;
  const types = SIM_TYPES[base % SIM_TYPES.length];
  const sfx = SIM_SUFFIXES[(hash(q) + idx) % SIM_SUFFIXES.length];
  return {
    name: `${q} ${sfx}`,
    lat,
    lng,
    rating: Math.round((3.6 + (base % 14) / 10) * 10) / 10, // 3.6–5.0
    ratingCount: 50 + (base % 1950),
    types,
    address: "כתובת מדומה לצורכי הדגמה",
    photoUrl: null,
  };
};

/* ── Public query surface ────────────────────────────────────────── */
export const autocomplete = async (query, opts = {}) => {
  if (!query || query.trim().length < 2) return [];
  enforceRateLimit(); // throws RateLimitError on flood

  if (!liveAvailable()) return simAutocomplete(query);

  /* Optional prediction restriction. Sprint 18.3: the wizard city
     scaffold passes { types: ['(cities)'] } so the skeleton-setup
     search only ever returns locality / administrative-area results,
     never POIs or addresses. */
  const types = Array.isArray(opts.types) && opts.types.length ? opts.types : null;

  try {
    await ensureServices();
    return await new Promise((resolve) => {
      autoSvc.getPlacePredictions(
        { input: query.trim(), sessionToken, ...(types ? { types } : {}) },
        (predictions, status) => {
          if (status !== "OK" || !predictions) { resolve([]); return; }
          resolve(predictions.map((p) => ({
            placeId: p.place_id,
            primary: p.structured_formatting?.main_text || p.description,
            secondary: p.structured_formatting?.secondary_text || "",
          })));
        }
      );
    });
  } catch {
    /* SDK load / runtime failure — degrade to simulation. */
    return simAutocomplete(query);
  }
};

export const getDetails = async (placeId) => {
  if (!placeId) return null;

  /* Simulated predictions (or any non-live state) resolve locally. */
  if (String(placeId).startsWith("sim:") || !liveAvailable()) {
    return simDetails(placeId);
  }

  try {
    await ensureServices();
    return await new Promise((resolve) => {
      placesSvc.getDetails(
        {
          placeId,
          sessionToken,
          fields: [
            "name", "geometry", "rating", "types",
            "formatted_address", "user_ratings_total", "photos",
            /* Sprint 31 #2 — the official Google short description snippet
               ("מזרקה מוכרת, יעד תיירותי"). Free with the details call —
               no extra billed request. */
            "editorial_summary",
          ],
        },
        (place, status) => {
          /* A details call closes the autocomplete session — reset the
             token so the next search starts a fresh (billed) session. */
          sessionToken = null;
          if (status !== "OK" || !place) { resolve(null); return; }

          /* Meter the now-closed billed session (autocomplete + details). */
          try {
            finOpsTracker.recordSession();
            finOpsTracker.recordDetails();
          } catch { /* metering is best-effort */ }

          /* Extract the first photo URL synchronously while the Place
             object is still in scope. */
          let photoUrl = null;
          try {
            if (place.photos?.length) photoUrl = place.photos[0].getUrl({ maxWidth: 600 });
          } catch { /* photo unavailable */ }

          resolve({
            name: place.name,
            lat: place.geometry?.location?.lat?.() ?? null,
            lng: place.geometry?.location?.lng?.() ?? null,
            rating: place.rating ?? null,
            ratingCount: place.user_ratings_total ?? null,
            types: place.types || [],
            address: place.formatted_address || "",
            photoUrl,
            /* Sprint 31 #2 — Google editorial summary snippet. */
            description: place.editorial_summary?.overview || "",
          });
        }
      );
    });
  } catch {
    return simDetails(placeId);
  }
};

const googlePlaces = {
  isPlacesEnabled,
  isSearchEnabled,
  loadPlaces,
  autocomplete,
  getDetails,
  RateLimitError,
};
export default googlePlaces;
