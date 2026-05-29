/* ══════════════════════════════════════════════════════════════
   googlePlaces — thin wrapper around the Google Maps JS Places API.

   Activates only when REACT_APP_GOOGLE_MAPS_API_KEY is set. When
   absent, isPlacesEnabled() returns false and the UI falls back to
   the manual add-stop flow — so the app works with or without a key.

   Exposes:
     isPlacesEnabled()        → boolean
     loadPlaces()             → Promise (loads the SDK once)
     autocomplete(query)      → Promise<[{placeId, primary, secondary}]>
     getDetails(placeId)      → Promise<{ name, lat, lng, rating, types,
                                          address }>
   ══════════════════════════════════════════════════════════════ */

const KEY = process.env.REACT_APP_GOOGLE_MAPS_API_KEY || "";

export const isPlacesEnabled = () => !!KEY;

let loadPromise = null;
let autoSvc = null;
let placesSvc = null;
let sessionToken = null;

export const loadPlaces = () => {
  if (!KEY) return Promise.reject(new Error("no-api-key"));
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

export const autocomplete = async (query) => {
  if (!KEY || !query || query.trim().length < 2) return [];
  await ensureServices();
  return new Promise((resolve) => {
    autoSvc.getPlacePredictions(
      { input: query.trim(), sessionToken },
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
};

export const getDetails = async (placeId) => {
  if (!KEY || !placeId) return null;
  await ensureServices();
  return new Promise((resolve) => {
    placesSvc.getDetails(
      { placeId, sessionToken, fields: ["name", "geometry", "rating", "types", "formatted_address"] },
      (place, status) => {
        /* A details call closes the autocomplete session — reset the
           token so the next search starts a fresh (billed) session. */
        sessionToken = null;
        if (status !== "OK" || !place) { resolve(null); return; }
        resolve({
          name: place.name,
          lat: place.geometry?.location?.lat?.() ?? null,
          lng: place.geometry?.location?.lng?.() ?? null,
          rating: place.rating ?? null,
          types: place.types || [],
          address: place.formatted_address || "",
        });
      }
    );
  });
};

const googlePlaces = { isPlacesEnabled, loadPlaces, autocomplete, getDetails };
export default googlePlaces;
