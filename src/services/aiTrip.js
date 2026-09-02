/* ══════════════════════════════════════════════════════════════════════
   aiTrip — client side of INITIATIVE 01 (AI trip generation).

   • generateItinerary(payload) → POSTs to the /api/generate-trip serverless
     function and returns a normalized { destination, days:[…] } result.
   • itineraryToTripData(result) → maps that into the app's tripData schema
     (the exact shape createNewTrip / the editor expect).

   Local dev: the CRA dev server does NOT run /api functions, so on localhost
   (only) we fall back to a small DEMO generator using real coordinates, so
   the modal → inject → editor flow can be exercised without any keys. In
   production the real serverless pipeline always runs.
   ══════════════════════════════════════════════════════════════════════ */

import { supabase, isSupabaseEnabled } from "../lib/supabase";
import { track } from "../analytics/posthog";

const isLocalhost = () =>
  typeof window !== "undefined" && /^(localhost|127\.|0\.0\.0\.0)/.test(window.location.hostname);

/* The signed-in user's Supabase access token, so the server can enforce the
   per-user daily cap. Null in mock/local mode. */
const authToken = async () => {
  if (!isSupabaseEnabled()) return null;
  try { const { data } = await supabase.auth.getSession(); return data?.session?.access_token || null; }
  catch { return null; }
};

const PACE_SPOTS = { relaxed: 3, balanced: 4, intense: 4 }; // hard 3–4/day cap (cost)

/* Convert a Google 0–5 rating to the app's "x/10" badge string. */
const ratingBadge = (r) =>
  Number.isFinite(r) && r > 0 ? `${(r * 2).toFixed(1)}/10` : undefined;

const haversineKm = (a, b) => {
  if (!a || !b) return Infinity;
  const R = 6371, toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat), dLng = toRad(b.lng - a.lng);
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
};

/* Choose the leg's transit mode from the traveller's SELECTED modes + the
   distance — so the editor's transit rail reflects their choice (still fully
   editable by tapping to cycle). Form keys → editor modes. */
const MODE_MAP = { walking: "walk", transit: "transit", car: "car" };
const legMode = (km, selected) => {
  const avail = (selected || []).map((m) => MODE_MAP[m] || m).filter(Boolean);
  if (!avail.length) return km <= 1.5 ? "walk" : "transit";
  if (avail.includes("walk") && km <= 1.6) return "walk";
  if (avail.includes("transit")) return "transit";
  if (avail.includes("car")) return "car";
  return avail[0];
};

/* A flight transit node in the app's schema (matches the wizard's flight scaffold). */
const flightNode = (from, to) => ({
  _transit: true, transitType: "flight",
  name: `טיסה · ${from} → ${to}`, nameHe: `טיסה · ${from} → ${to}`,
  from, to, departTime: "", arriveTime: "", refId: "",
});

/* Map the normalized API result into tripData days the editor renders.
   `origin` (optional) adds an arrival flight on day 1 and a departure flight
   on the last day, as transit nodes. */
export const itineraryToTripData = (result, { origin, transport } = {}) => {
  const days = Array.isArray(result?.days) ? result.days : [];
  const org = (origin || "").trim();
  const out = days.map((d, i) => {
    const attractions = (d.spots || []).map((s, j, arr) => {
      // Leg to the NEXT stop → transitMode, reflecting the chosen transport.
      const next = arr[j + 1];
      const tm = next
        ? legMode(haversineKm({ lat: s.lat, lng: s.lng }, { lat: next.lat, lng: next.lng }), transport)
        : undefined;
      // A crowd-magnet gets a visible ⚠️ prefix in its note (shows on the point
      // in the timeline + bank), plus a structured `crowd` field for badges.
      const busy = s.crowd === "high";
      const note = [busy ? "⚠️ עלול להיות עמוס" : "", (s.note || "").trim()].filter(Boolean).join(" · ") || undefined;
      return {
        name: s.name,
        nameHe: s.name,
        category: s.category || "אטרקציה",
        rating: ratingBadge(s.rating),
        coordinates: { lat: s.lat, lng: s.lng },
        place_id: s.place_id || undefined,
        address: s.address || undefined,
        // Photo RESOURCE NAME from Places API (New) — rendered sized (400px)
        // client-side; usePlacePhotos falls back to place_id when absent.
        photoName: s.photo_name || undefined,
        note,
        crowd: s.crowd || undefined,
        transitMode: tm,
        _aiGenerated: true,
      };
    });
    const first = attractions.find((a) => a.coordinates);
    return {
      day: i + 1,
      city: d.city || result.destination || "",
      cityHe: d.city || result.destination || "",
      title: d.title || undefined,
      coordinates: first ? { lat: first.coordinates.lat, lng: first.coordinates.lng } : undefined,
      attractions,
    };
  });
  // Flights: arrival at the start of day 1, departure at the end of the last day.
  if (org && out.length) {
    const firstCity = out[0].city || result.destination || "היעד";
    const lastCity = out[out.length - 1].city || result.destination || "היעד";
    out[0].attractions.unshift(flightNode(org, firstCity));
    out[out.length - 1].attractions.push(flightNode(lastCity, org));
  }
  return out;
};

/* Compact per-day place list, handed back to the LLM as context for a refine. */
export const summarizeForRefine = (result) =>
  (Array.isArray(result?.days) ? result.days : []).map((d) => ({
    day: d.dayNumber,
    city: d.city,
    places: (d.spots || []).map((s) => s.name),
  }));

/* Call the serverless pipeline. Throws a human-readable Error on failure. */
export const generateItinerary = async (payload) => {
  const body = {
    destination: (payload.destination || "").trim(),
    dayCount: payload.dayCount,
    pace: payload.pace,
    preferences: payload.preferences,
    transport: payload.transport,            // array of modes (multi-select)
    instructions: payload.instructions,      // free-text planning guidance
    party: payload.party,                    // { adults, kids }
    restrictions: payload.restrictions,      // array of chips + free text
    refine: payload.refine,                  // follow-up correction (optional)
    previous: payload.previous,              // prior plan summary, for refine context
    focus: payload.focus || null,            // { cities:[…], label? } → hard (FOCUS) constraint
  };

  /* Analytics — funnel entry. The matching succeeded/failed events below make
     "AI success rate" and "which errors" measurable per generation. `destScope`
     is client-analytics only — it is never sent to the server / prompt. */
  track("ai_generate_started", {
    destination: body.destination,
    days: body.dayCount,
    pace: body.pace,
    refine: !!body.refine,
    focus: !!body.focus,
    destScope: payload.destScope || null,
  });

  /* The actual request/parse pipeline, wrapped so a single try/catch tags every
     outcome — including the localhost demo returns — exactly once. */
  const run = async () => {
    const token = await authToken();
    let res;
    try {
      res = await fetch("/api/generate-trip", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          ...(token ? { authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(body),
      });
    } catch (netErr) {
      if (isLocalhost()) return mockItinerary(body);
      const e = new Error("החיבור לשרת נכשל. נסו שוב.");
      e.code = "network";
      throw e;
    }

    const ct = res.headers.get("content-type") || "";
    const looksLikeApi = ct.includes("application/json");

    // Plain CRA dev server has no /api route → fall back to the demo generator.
    if (!looksLikeApi || res.status === 404 || res.status === 405) {
      if (isLocalhost()) return mockItinerary(body);
    }

    let data = null;
    try { data = await res.json(); } catch { data = null; }

    if (!res.ok || !data) {
      if (isLocalhost()) return mockItinerary(body);
      const msg = (data && (data.message || data.error)) || `שגיאת שרת (${res.status})`;
      const err = new Error(msg);
      err.status = res.status;
      err.code = data && data.error;               // "weekly-limit" | "cooldown" | "auth-required" | …
      err.quota = data ? { limit: data.limit, used: data.used, remaining: data.remaining, resetsAt: data.resetsAt, retryAfterSec: data.retryAfterSec } : null;
      throw err;
    }
    return data;
  };

  try {
    const data = await run();
    track("ai_generate_succeeded", {
      days: Array.isArray(data?.days) ? data.days.length : body.dayCount,
      demo: !!(data && data.meta && data.meta.demo),
    });
    return data;
  } catch (err) {
    track("ai_generate_failed", {
      reason: err?.code || (err?.status ? `http_${err.status}` : "error"),
      status: err?.status || null,
    });
    throw err;
  }
};

/* The signed-in user's WEEKLY AI quota, for the dashboard/modal indicator.
   Returns { limit, used, remaining, resetsAt } or null (guest / local mock). */
export const fetchQuota = async () => {
  const token = await authToken();
  if (!token) return null; // guest or local mock → no server quota to show
  try {
    const res = await fetch("/api/generate-trip", { method: "GET", headers: { authorization: `Bearer ${token}` } });
    const ct = res.headers.get("content-type") || "";
    if (!res.ok || !ct.includes("application/json")) return null;
    return await res.json();
  } catch { return null; }
};

/* ── Local demo generator (localhost only) ───────────────────────────────
   Real, well-known coordinates for a few destinations so the map + route
   ordering look right; a generic Rome set covers anything else. NOT used in
   production — there the serverless LLM+Places pipeline runs. */
const DEMO = {
  rome: { city: "Rome", spots: [
    { name: "Colosseo", category: "אטרקציה", lat: 41.8902, lng: 12.4922, note: "הזמינו כרטיס מראש לדילוג על התור" },
    { name: "Fontana di Trevi", category: "אטרקציה", lat: 41.9009, lng: 12.4833, note: "הכי יפה מוקדם בבוקר" },
    { name: "Pantheon", category: "אטרקציה", lat: 41.8986, lng: 12.4769, note: "כניסה חופשית, שווה ביקור" },
    { name: "Piazza Navona", category: "אטרקציה", lat: 41.8992, lng: 12.4731, note: "כיכר עם מזרקות ואמנים" },
    { name: "Basilica di San Pietro", category: "אטרקציה", lat: 41.9022, lng: 12.4539, note: "לבוש צנוע נדרש" },
    { name: "Trastevere", category: "מסעדה", lat: 41.8890, lng: 12.4694, note: "השכונה הכי טובה לארוחת ערב" },
    { name: "Villa Borghese", category: "טבע", lat: 41.9145, lng: 12.4923, note: "פארק ענק, אפשר להשכיר אופניים" },
    { name: "Campo de' Fiori", category: "קניות", lat: 41.8956, lng: 12.4722, note: "שוק בוקר תוסס" },
  ]},
  tokyo: { city: "Tokyo", spots: [
    { name: "Sensō-ji", category: "אטרקציה", lat: 35.7148, lng: 139.7967, note: "המקדש העתיק בטוקיו" },
    { name: "Shibuya Crossing", category: "אטרקציה", lat: 35.6595, lng: 139.7005, note: "הצומת המפורסם בעולם" },
    { name: "Meiji Jingu", category: "טבע", lat: 35.6764, lng: 139.6993, note: "מקדש בתוך יער בלב העיר" },
    { name: "Tokyo Tower", category: "אטרקציה", lat: 35.6586, lng: 139.7454, note: "נוף עירוני מרהיב בשקיעה" },
    { name: "Tsukiji Outer Market", category: "מסעדה", lat: 35.6654, lng: 139.7707, note: "סושי טרי לארוחת בוקר" },
    { name: "Ueno Park", category: "טבע", lat: 35.7156, lng: 139.7745, note: "פארק עם מוזיאונים ופריחת דובדבן" },
    { name: "Akihabara", category: "קניות", lat: 35.7022, lng: 139.7745, note: "גן עדן לחובבי אלקטרוניקה ואנימה" },
  ]},
  paris: { city: "Paris", spots: [
    { name: "Tour Eiffel", category: "אטרקציה", lat: 48.8584, lng: 2.2945, note: "עלו למעלה או צפו מהשאן דה מארס" },
    { name: "Musée du Louvre", category: "מוזיאון", lat: 48.8606, lng: 2.3376, note: "הזמינו כרטיס מראש" },
    { name: "Cathédrale Notre-Dame", category: "אטרקציה", lat: 48.8530, lng: 2.3499, note: "יפה במיוחד מהגדה השמאלית" },
    { name: "Montmartre", category: "אטרקציה", lat: 48.8867, lng: 2.3431, note: "שכונת אמנים עם נוף לעיר" },
    { name: "Musée d'Orsay", category: "מוזיאון", lat: 48.8600, lng: 2.3266, note: "אמנות אימפרסיוניסטית במבנה תחנת רכבת" },
    { name: "Le Marais", category: "קניות", lat: 48.8590, lng: 2.3620, note: "בוטיקים ובתי קפה קסומים" },
    { name: "Jardin du Luxembourg", category: "טבע", lat: 48.8462, lng: 2.3372, note: "גן מושלם לפיקניק" },
  ]},
};

const pickDemoCity = (destination) => {
  const d = (destination || "").toLowerCase();
  if (/tokyo|יפן|טוקיו|japan/.test(d)) return DEMO.tokyo;
  if (/paris|פריז|france|צרפת/.test(d)) return DEMO.paris;
  return DEMO.rome;
};

const mockItinerary = async (body) => {
  await new Promise((r) => setTimeout(r, 1500)); // simulate real latency so the progress UI shows in dev
  const spotsPerDay = PACE_SPOTS[body.pace] || 4;
  const dayCount = Math.max(1, Math.min(14, Number(body.dayCount) || 3));
  const base = pickDemoCity(body.destination);
  const pool = base.spots;
  const days = [];
  let idx = 0;
  for (let d = 0; d < dayCount; d++) {
    const spots = [];
    for (let s = 0; s < spotsPerDay; s++) {
      const item = pool[idx % pool.length];
      idx++;
      spots.push({
        name: item.name,
        category: item.category,
        note: item.note,
        crowd: (idx % 3 === 1) ? "high" : "none", // demo: mark some as busy
        place_id: `demo_${d}_${s}`,
        address: `${base.city}`,
        lat: item.lat + (d * 0.0006), // tiny per-day offset so markers don't overlap exactly
        lng: item.lng + (d * 0.0006),
        rating: 4.6,
      });
    }
    days.push({ dayNumber: d + 1, city: base.city, title: `יום ${d + 1} · ${base.city}`, spots });
  }
  const base2 = body.refine
    ? `מסלול מעודכן ל${body.destination || base.city} — התאמתי לפי: "${String(body.refine).slice(0, 40)}".`
    : `מסלול ${dayCount} ימים ב${body.destination || base.city}, בנוי סביב מה שאתם אוהבים ומסודר לפי קרבה.`;
  return { destination: body.destination || base.city, dayCount, description: base2, days, meta: { demo: true } };
};

const aiTrip = { generateItinerary, itineraryToTripData, summarizeForRefine, fetchQuota };
export default aiTrip;
