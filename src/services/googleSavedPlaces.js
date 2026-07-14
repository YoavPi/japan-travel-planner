/* ══════════════════════════════════════════════════════════════
   googleSavedPlaces — MOCK "Google Saved Places" integration
   (Sprint 22 #7).

   Simulates the user's starred/saved POIs from Google Maps. The
   editor's INBOX view-mode ("רשימת נקודות") calls
   fetchMockGoogleSavedPlaces(center) after the user taps the
   "connect" CTA; the returned POIs render as neutral,
   semi-transparent markers on the map + a sidebar list, each with
   a "שבץ במסלול הטיול" action that clones the POI into a chosen
   day of the active trip.

   A real integration would swap this for the Google Takeout /
   Saved Lists API without touching callers — the shape below is
   the contract: { id, name, nameHe, category, rating, lat, lng }.
   ══════════════════════════════════════════════════════════════ */

import { supabase, getSupabaseUser } from "../lib/supabase";

const delay = (ms) => new Promise((res) => setTimeout(res, ms));

/* Sprint 26 — places_inbox row ⇄ POI mapping. */
const rowToPlace = (r) => ({
  id: r.id,
  name: r.name,
  nameHe: r.name_he || r.name,
  category: r.category || "אטרקציה",
  rating: r.rating || "",
  lat: r.lat,
  lng: r.lng,
});

/* ── Sprint 27 #5 — local Places-Inbox persistence ──────────────
   Without a Supabase session the inbox ("בנק נקודות") persists in
   localStorage, so orphaned places (skeleton updates) and "save for
   later" additions survive reloads in demo/local mode too. */
const LOCAL_INBOX_KEY = "tp_places_inbox_v1";

const readLocalInbox = () => {
  try { return JSON.parse(localStorage.getItem(LOCAL_INBOX_KEY) || "[]"); } catch { return []; }
};
const writeLocalInbox = (list) => {
  try { localStorage.setItem(LOCAL_INBOX_KEY, JSON.stringify(list)); } catch { /* noop */ }
};

/* The user's current inbox — Supabase rows with a session, the local
   store otherwise. Returns [] when empty (NO mock fallback — the mock
   belongs only to the explicit "connect" CTA). */
export async function listInboxPlaces() {
  const sbUser = await getSupabaseUser();
  if (sbUser) {
    const { data, error } = await supabase
      .from("places_inbox").select("*")
      .order("created_at", { ascending: false });
    if (error) { console.warn("places_inbox fetch failed:", error.message); return []; }
    return (data || []).map(rowToPlace);
  }
  return readLocalInbox();
}

/* Add POIs to the inbox (Supabase insert with a session, localStorage
   append otherwise). Accepts app-shape POIs; returns the stored list
   entries (with server ids when persisted remotely). */
export async function addInboxPlaces(places) {
  const clean = (places || []).filter((p) => p && p.name && Number.isFinite(p.lat) && Number.isFinite(p.lng));
  if (!clean.length) return [];
  const sbUser = await getSupabaseUser();
  if (sbUser) {
    const rows = clean.map((p) => ({
      owner_id: sbUser.id,
      name: p.name,
      name_he: p.nameHe || p.name,
      category: p.category || "אטרקציה",
      rating: p.rating || null,
      lat: p.lat, lng: p.lng,
      source: p.source || "manual",
    }));
    const { data, error } = await supabase.from("places_inbox").insert(rows).select();
    if (error) throw new Error(error.message);
    return (data || []).map(rowToPlace);
  }
  const stamped = clean.map((p, i) => ({ ...p, id: p.id || `loc_${Date.now()}_${i}` }));
  writeLocalInbox([...stamped, ...readLocalInbox()]);
  return stamped;
}

/* Sprint 34 — remove a place from the unassigned inbox pile (used when a
   place is ASSIGNED to a day: single-home model, so it leaves the pile).
   Best-effort; ids beginning with "gsp_"/"imp_" that were never persisted
   simply no-op on the DB side. */
export async function removeInboxPlace(id) {
  if (!id) return;
  const sbUser = await getSupabaseUser();
  if (sbUser) {
    /* Only real UUID rows exist server-side; guard the delete so synthetic
       ids don't throw. */
    if (/^[0-9a-f]{8}-[0-9a-f]{4}-/i.test(String(id))) {
      const { error } = await supabase.from("places_inbox").delete().eq("id", id).eq("owner_id", sbUser.id);
      if (error) console.warn("places_inbox delete failed:", error.message);
    }
    return;
  }
  writeLocalInbox(readLocalInbox().filter((p) => p.id !== id));
}

/* Deterministic offsets (≈ a few hundred meters – a few km) spread
   the mock POIs around the trip's map center so they always land in
   the destination the user is actually planning. */
const TEMPLATE = [
  { name: "Hidden Ramen Bar",      nameHe: "בר ראמן נסתר",        category: "מסעדה",    rating: "9.2/10", dLat: 0.010,  dLng: 0.008 },
  { name: "Rooftop Coffee",        nameHe: "קפה על הגג",           category: "בית קפה",  rating: "8.8/10", dLat: -0.006, dLng: 0.012 },
  { name: "Old Town Viewpoint",    nameHe: "תצפית העיר העתיקה",   category: "אטרקציה",  rating: "9.5/10", dLat: 0.014,  dLng: -0.009 },
  { name: "Artisan Market",        nameHe: "שוק אומנים",           category: "קניות",    rating: "8.4/10", dLat: -0.011, dLng: -0.007 },
  { name: "Riverside Izakaya",     nameHe: "איזקאיה על הנהר",      category: "מסעדה",    rating: "9.0/10", dLat: 0.004,  dLng: -0.015 },
  { name: "Botanical Garden Gate", nameHe: "שער הגן הבוטני",       category: "אטרקציה",  rating: "8.6/10", dLat: -0.016, dLng: 0.005 },
];

export async function fetchMockGoogleSavedPlaces(center) {
  /* Sprint 26 — Supabase-first: with a live session, the user's real
     places_inbox rows (RLS-scoped) are the saved-places source. Only
     when the inbox table is empty (or no session) do we fall back to
     the simulated list so the demo flow keeps working. */
  const sbUser = await getSupabaseUser();
  if (sbUser) {
    const { data, error } = await supabase
      .from("places_inbox").select("*")
      .order("created_at", { ascending: false });
    if (!error && data && data.length) return data.map(rowToPlace);
    if (error) console.warn("places_inbox fetch failed:", error.message);
  }
  await delay(700); // simulated OAuth + list fetch
  const base = {
    lat: Number.isFinite(center?.lat) ? center.lat : 35.6812,
    lng: Number.isFinite(center?.lng) ? center.lng : 139.7671,
  };
  return TEMPLATE.map((p, i) => ({
    id: `gsp_${i}`,
    name: p.name,
    nameHe: p.nameHe,
    category: p.category,
    rating: p.rating,
    lat: base.lat + p.dLat,
    lng: base.lng + p.dLng,
  }));
}

/* ══════════════════════════════════════════════════════════════
   Sprint 26 #4 — Google Takeout import architecture.

   parseTakeoutFile(text, filename) understands the three shapes a
   user actually gets out of Takeout / Maps exports:
     • GeoJSON  — "Saved Places.json": features[].geometry.coordinates
                  [lng, lat] + properties.location.name / Title
     • JSON     — a plain array of { name / title, lat, lng, … }
     • CSV      — saved-list exports: Title,Note,URL — coordinates are
                  recovered from the Maps URL (@lat,lng or !3d..!4d..)
   Rows without usable coordinates are skipped (the map/inbox contract
   requires lat+lng). Returns normalized POI objects.
   ══════════════════════════════════════════════════════════════ */
export function parseTakeoutFile(text, filename = "") {
  const out = [];
  const push = (name, lat, lng, extra = {}) => {
    const la = Number(lat), ln = Number(lng);
    if (!name || !Number.isFinite(la) || !Number.isFinite(ln)) return;
    out.push({
      id: `imp_${out.length}_${Date.now()}`,
      name: String(name).trim(),
      nameHe: String(extra.nameHe || name).trim(),
      category: extra.category || "אטרקציה",
      rating: extra.rating || "",
      lat: la, lng: ln,
    });
  };

  const tryJson = () => {
    const doc = JSON.parse(text);
    if (doc && doc.type === "FeatureCollection" && Array.isArray(doc.features)) {
      doc.features.forEach((f) => {
        const c = f?.geometry?.coordinates;
        const p = f?.properties || {};
        const name = p?.location?.name || p?.Title || p?.title || p?.name || p?.location?.address;
        if (Array.isArray(c) && c.length >= 2) push(name, c[1], c[0]);
      });
      return true;
    }
    if (Array.isArray(doc)) {
      doc.forEach((it) => push(
        it.name || it.title || it.Title,
        it.lat ?? it.latitude ?? it.Latitude,
        it.lng ?? it.lon ?? it.longitude ?? it.Longitude,
        { category: it.category, rating: it.rating, nameHe: it.nameHe }
      ));
      return true;
    }
    return false;
  };

  const tryCsv = () => {
    const lines = text.split(/\r?\n/).filter((l) => l.trim());
    if (lines.length < 2) return false;
    const header = lines[0].split(",").map((h) => h.trim().toLowerCase());
    const col = (names) => header.findIndex((h) => names.includes(h));
    const iTitle = col(["title", "name", "שם"]);
    const iLat = col(["lat", "latitude"]);
    const iLng = col(["lng", "lon", "longitude"]);
    const iUrl = col(["url", "link"]);
    if (iTitle === -1) return false;
    lines.slice(1).forEach((line) => {
      /* naive CSV split that respects simple quoted cells */
      const cells = line.match(/("([^"]|"")*"|[^,]*)(,|$)/g)?.map((c) => c.replace(/,$/, "").replace(/^"|"$/g, "").replace(/""/g, '"')) || line.split(",");
      const title = cells[iTitle];
      let lat = iLat !== -1 ? cells[iLat] : null;
      let lng = iLng !== -1 ? cells[iLng] : null;
      if ((!lat || !lng) && iUrl !== -1 && cells[iUrl]) {
        const m = cells[iUrl].match(/@(-?\d+\.\d+),(-?\d+\.\d+)/) || cells[iUrl].match(/!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/);
        if (m) { lat = m[1]; lng = m[2]; }
      }
      push(title, lat, lng);
    });
    return true;
  };

  try {
    if (/\.(json|geojson)$/i.test(filename)) { tryJson(); return out; }
    if (/\.csv$/i.test(filename)) { tryCsv(); return out; }
    /* Unknown extension — sniff: JSON first, CSV second. */
    try { if (tryJson()) return out; } catch { /* not JSON */ }
    tryCsv();
    return out;
  } catch {
    return out;
  }
}

/* Persist imported Takeout POIs — thin wrapper over addInboxPlaces
   (Sprint 27 unified the inbox write path: Supabase with a session,
   the local store otherwise). */
export async function importSavedPlaces(places) {
  return addInboxPlaces((places || []).map((p) => ({ ...p, source: "takeout" })));
}

export default fetchMockGoogleSavedPlaces;
