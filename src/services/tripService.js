/* ══════════════════════════════════════════════════════════════
   tripService — dynamic data-layer factory.

   Decouples every component from the hardcoded tripData.js import.
   All methods are async and return Promises so the UI can show
   loading skeletons; a small artificial lag mimics real network
   latency, guaranteeing the skeleton paths are exercised. The
   persistence engine is window.localStorage with JSON
   serialization — a drop-in that can later be replaced by Supabase
   / Vercel Postgres by swapping ONLY the bodies of these methods.

   Trip record shape (matches the design blueprints' state spec):
     {
       id, title, cover, days (number), meta, role,
       owner: { id, name },
       collaborators: [{ id, name, email, role, avatar }],
       sharedBy?: string,
       lastEdited: ISO string,
       settings: { destination, dateRange, ... },
       data: {                      // the actual itinerary payload
         tripData: [...],           // per-day attractions
         cityTransitions: [...],    // inter-city legs
         lodgingOverrides: {...},
       }
     }
   ══════════════════════════════════════════════════════════════ */

import { tripData, routePath, HOTEL_COORDINATES } from "../data/tripData";
import { cityTransitions, lodgingOverrides } from "../data/transportData";
import { supabase, getSupabaseUser } from "../lib/supabase";
import { addInboxPlaces } from "./googleSavedPlaces";

/* ── Sprint 26 — Supabase persistence layer ─────────────────────
   Every CRUD method now branches: with a live Supabase session the
   `trips` table is the source of truth (RLS scopes rows to the
   owner); without one (mock/demo sessions, backend not provisioned
   yet) the legacy localStorage engine below keeps working
   unchanged. Row ⇄ app-record mapping is centralised here. */

const rowToTrip = (r) => r && ({
  id: r.id,
  title: r.title,
  cover: r.cover || null,
  days: r.days || 0,
  meta: r.meta || "",
  role: "owner",
  readOnly: !!r.read_only,
  owner: { id: r.owner_id, name: r.owner_name || "" },
  collaborators: r.collaborators || [],
  tripMemo: r.trip_memo || undefined,
  lastEdited: r.last_edited || r.created_at,
  center: r.settings?.center || null,
  settings: r.settings || {},
  data: r.data || { tripData: [], cityTransitions: [], lodgingOverrides: {} },
});

const tripPatchToRow = (patch = {}) => {
  const row = {};
  if ("title" in patch) row.title = patch.title;
  if ("cover" in patch) row.cover = patch.cover;
  if ("days" in patch) row.days = patch.days;
  if ("meta" in patch) row.meta = patch.meta;
  if ("readOnly" in patch) row.read_only = patch.readOnly;
  if ("collaborators" in patch) row.collaborators = patch.collaborators;
  if ("tripMemo" in patch) row.trip_memo = patch.tripMemo ?? null;
  if ("settings" in patch) row.settings = patch.settings;
  if ("data" in patch) row.data = patch.data;
  row.last_edited = nowISO();
  return row;
};

/* Sprint 26 — shared skeleton rebuild (used by BOTH persistence
   engines): re-stamp day count + city headers, preserving each day's
   attractions by day number and folding orphans into the last day. */
const rebuildSkeletonDays = (prev, { days: dayCount, cityRanges = [] }) => {
  const prevDays = prev.data?.tripData || [];
  const n = Math.max(1, Number(dayCount) || prevDays.length || 1);
  const fallback = {
    city: prev.settings?.destination || prev.title || "",
    cityHe: prev.settings?.destinationHe || prev.title || "",
  };
  const cityForDay = (dayNum) => {
    const r = cityRanges.find((x) => dayNum >= x.fromDay && dayNum <= x.toDay);
    return r ? { city: r.city, cityHe: r.cityHe || r.city } : fallback;
  };
  const byDay = new Map(prevDays.map((d) => [d.day, d]));
  const nextDays = Array.from({ length: n }, (_, i) => {
    const dayNum = i + 1;
    const existing = byDay.get(dayNum);
    return {
      ...(existing || {}),
      day: dayNum,
      ...cityForDay(dayNum),
      attractions: [...(existing?.attractions || [])],
    };
  });
  const orphans = prevDays.filter((d) => d.day > n).flatMap((d) => d.attractions || []);
  /* Sprint 27 #4 — data-safety layer: pinned PLACES orphaned by a
     shrinking skeleton are NOT dropped and NOT silently folded — they
     are re-routed to the Places Inbox ("בנק נקודות") for later
     re-assignment. Only coordinate-less nodes (transit legs, memos)
     that cannot live in the inbox fold into the last day. */
  const inboxable = orphans.filter((a) => !a._transit && a.coordinates &&
    Number.isFinite(a.coordinates.lat) && Number.isFinite(a.coordinates.lng));
  const foldable = orphans.filter((a) => !inboxable.includes(a));
  if (foldable.length) {
    const last = nextDays[nextDays.length - 1];
    last.attractions = [...last.attractions, ...foldable];
  }
  return { n, nextDays, inboxable };
};

/* Fire-and-forget rescue of orphaned places into the inbox. */
const rescueOrphansToInbox = (inboxable) => {
  if (!inboxable?.length) return;
  addInboxPlaces(inboxable.map((a) => ({
    name: a.name,
    nameHe: a.nameHe || a.name,
    category: a.category || "אטרקציה",
    rating: a.rating || "",
    lat: a.coordinates.lat,
    lng: a.coordinates.lng,
    source: "skeleton-update",
  }))).catch(() => { /* rescue is best-effort; the places also remain recoverable via undo-less re-add */ });
};

const STORAGE_KEY = "tp_trips_v2"; // bump to re-seed (Dubai now has sample stops)
const ACTIVE_KEY = "tp_active_trip_v1"; // the currently "live" trip id
/* Custom event broadcast on every active-trip mutation so any
   mounted screen (dashboard cards, AppChrome quick-entry) can react
   instantly — no hard reload, works within the same tab where the
   native `storage` event never fires. */
export const ACTIVE_TRIP_EVENT = "tp:active-trip-changed";

/* SaaS tier ceiling — a single account may hold at most this many
   active trip maps. The dashboard + wizard read it to gate the
   "create new trip" flow; deleting a trip frees a slot instantly. */
export const MAX_ACTIVE_TRIPS = 5;

const LAG = 450; // ms — simulated network latency

const delay = (ms) => new Promise((res) => setTimeout(res, ms));
const nowISO = () => new Date().toISOString();
const uid = (p = "trip") => `${p}_${Math.random().toString(36).slice(2, 9)}`;

/* ── Seed data ────────────────────────────────────────────────
   The existing hardcoded Japan itinerary becomes the first
   (read-only example) trip in the store. Two extra sample trips
   give the dashboard a realistic multi-trip grid. */
const buildJapanSeed = () => ({
  id: "japan-demo",
  title: "ירח דבש ביפן",
  cover: "/photos/source/day01_harajuku.jpg",
  days: tripData.length,
  meta: "31 ימים · 9 ערים · פברואר–מרץ 2024",
  role: "owner",
  readOnly: true, /* the canonical example — not user-editable */
  owner: { id: "u_michali", name: "מיכלי דמרי פינטל" },
  collaborators: [],
  lastEdited: "2024-04-01T10:00:00.000Z",
  settings: { destination: "Japan", destinationHe: "יפן" },
  data: {
    tripData,
    cityTransitions,
    lodgingOverrides,
    routePath,
    HOTEL_COORDINATES,
  },
});

const SAMPLE_TRIPS = [
  {
    id: "dubai-2026",
    title: "הטיול שלי לדובאי",
    /* No cover yet — MapCard falls back to the themed Dubai gradient
       + landmark glyph. Better than borrowing a Japan photo. */
    cover: null,
    days: 5,
    meta: "5 ימים · דובאי · 2026",
    role: "owner",
    readOnly: false,
    owner: { id: "u_michali", name: "מיכלי דמרי פינטל" },
    collaborators: [],
    lastEdited: "2026-03-12T08:30:00.000Z",
    settings: { destination: "Dubai", destinationHe: "דובאי" },
    /* Seeded with a couple of real days so the editor's day-strip,
       stop rows, drag-reorder, and auto-transit rails have live
       content to demonstrate without the Places flow. */
    data: {
      tripData: [
        {
          day: 1, city: "Dubai", cityHe: "דובאי",
          coordinates: { lng: 55.2744, lat: 25.1972 },
          attractions: [
            { name: "Burj Khalifa", nameHe: "בורג' ח'ליפה", category: "אטרקציה", rating: "9.4/10", coordinates: { lng: 55.2744, lat: 25.1972 } },
            { name: "Dubai Mall", nameHe: "דובאי מול", category: "קניות", coordinates: { lng: 55.2796, lat: 25.1985 } },
            { name: "Dubai Fountain", nameHe: "מזרקת דובאי", category: "אטרקציה", coordinates: { lng: 55.2754, lat: 25.1956 } },
            { name: "At.mosphere", nameHe: "מסעדת אטמוספיר", category: "מסעדה", rating: "9/10", coordinates: { lng: 55.2742, lat: 25.1971 } },
          ],
        },
        {
          day: 2, city: "Dubai", cityHe: "דובאי",
          coordinates: { lng: 55.1853, lat: 25.1412 },
          attractions: [
            { name: "Palm Jumeirah", nameHe: "פאלם ג'ומיירה", category: "אטרקציה", coordinates: { lng: 55.1390, lat: 25.1124 } },
            { name: "Atlantis The Palm", nameHe: "אטלנטיס", category: "מלון", rating: "9/10", coordinates: { lng: 55.1175, lat: 25.1304 } },
          ],
        },
      ],
      cityTransitions: [],
      lodgingOverrides: {},
    },
  },
  {
    id: "paris-weekend",
    title: "סופ\"ש בפריז",
    cover: null,
    days: 3,
    meta: "3 ימים · פריז · שותף איתך",
    role: "edit",
    readOnly: false,
    owner: { id: "u_friend", name: "יותם" },
    sharedBy: "יותם",
    collaborators: [
      { id: "u_michali", name: "מיכלי", email: "michali.pintel@gmail.com", role: "edit", avatar: null },
    ],
    lastEdited: "2026-02-20T19:15:00.000Z",
    settings: { destination: "Paris", destinationHe: "פריז" },
    data: { tripData: [], cityTransitions: [], lodgingOverrides: {} },
  },
];

/* Read the whole store, seeding on first run. */
const readStore = () => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {
    /* fall through to seed */
  }
  const seed = [buildJapanSeed(), ...SAMPLE_TRIPS];
  localStorage.setItem(STORAGE_KEY, JSON.stringify(seed));
  return seed;
};

const writeStore = (trips) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(trips));
};

/* Lightweight list projection (omit the heavy `data` payload so
   the dashboard grid stays snappy). */
const toSummary = ({ data, ...rest }) => rest;

export const tripService = {
  /* All trips visible to a user (owned + shared-to). For the mock
     we return everything; a real backend would filter by userId. */
  async fetchAllTrips(/* userId */) {
    const sbUser = await getSupabaseUser();
    if (sbUser) {
      const { data, error } = await supabase
        .from("trips").select("*")
        .order("last_edited", { ascending: false });
      if (error) throw new Error(error.message);
      return (data || []).map(rowToTrip).map(({ data: _d, ...rest }) => rest);
    }
    await delay(LAG);
    return readStore().map(toSummary);
  },

  /* Full trip incl. itinerary payload. */
  async fetchTripById(tripId) {
    const sbUser = await getSupabaseUser();
    if (sbUser) {
      /* VibeSec defense-in-depth: scope to the owner explicitly in
         addition to RLS, so a misconfigured policy can never leak another
         user's row (returns 404-equivalent "not found"). */
      const { data, error } = await supabase
        .from("trips").select("*").eq("id", tripId).eq("owner_id", sbUser.id).maybeSingle();
      if (error) throw new Error(error.message);
      if (!data) throw new Error(`Trip not found: ${tripId}`);
      return rowToTrip(data);
    }
    await delay(LAG);
    const trip = readStore().find((t) => t.id === tripId);
    if (!trip) throw new Error(`Trip not found: ${tripId}`);
    return trip;
  },

  /* Persist edits to an existing trip's payload. */
  async saveTrip(tripId, patch) {
    const sbUser = await getSupabaseUser();
    if (sbUser) {
      const { data, error } = await supabase
        .from("trips").update(tripPatchToRow(patch))
        .eq("id", tripId).eq("owner_id", sbUser.id).select().maybeSingle();
      if (error) throw new Error(error.message);
      if (!data) throw new Error(`Trip not found: ${tripId}`);
      return rowToTrip(data);
    }
    await delay(LAG);
    const trips = readStore();
    const idx = trips.findIndex((t) => t.id === tripId);
    if (idx === -1) throw new Error(`Trip not found: ${tripId}`);
    if (trips[idx].readOnly) throw new Error("This trip is read-only.");
    trips[idx] = { ...trips[idx], ...patch, lastEdited: nowISO() };
    writeStore(trips);
    return trips[idx];
  },

  /* Update a trip's sharing/permissions (collaborator list).
     Sharing metadata is NOT itinerary content, so this is allowed
     even on read-only example trips — only the day payload is
     locked by `readOnly`. Returns the updated summary. */
  async updateSharing(tripId, collaborators) {
    const clean = Array.isArray(collaborators) ? collaborators : [];
    const sbUser = await getSupabaseUser();
    if (sbUser) {
      const { data, error } = await supabase
        .from("trips").update({ collaborators: clean })
        .eq("id", tripId).eq("owner_id", sbUser.id).select().maybeSingle();
      if (error) throw new Error(error.message);
      if (!data) throw new Error(`Trip not found: ${tripId}`);
      const { data: _d, ...summary } = rowToTrip(data);
      return summary;
    }
    await delay(200);
    const trips = readStore();
    const idx = trips.findIndex((t) => t.id === tripId);
    if (idx === -1) throw new Error(`Trip not found: ${tripId}`);
    trips[idx] = { ...trips[idx], collaborators: clean };
    writeStore(trips);
    return toSummary(trips[idx]);
  },

  /* Sprint 19.3 — persist a per-trip logistical sticky memo. A memo is
     dashboard metadata (a personal reminder), NOT itinerary content, so
     like `updateSharing` it is permitted even on read-only example trips.
     Returns the updated summary. */
  async saveTripMemo(tripId, memo) {
    const clean = (memo || "").trim();
    const sbUser = await getSupabaseUser();
    if (sbUser) {
      const { data, error } = await supabase
        .from("trips").update({ trip_memo: clean || null, last_edited: nowISO() })
        .eq("id", tripId).eq("owner_id", sbUser.id).select().maybeSingle();
      if (error) throw new Error(error.message);
      if (!data) throw new Error(`Trip not found: ${tripId}`);
      const { data: _d, ...summary } = rowToTrip(data);
      return summary;
    }
    await delay(200);
    const trips = readStore();
    const idx = trips.findIndex((t) => t.id === tripId);
    if (idx === -1) throw new Error(`Trip not found: ${tripId}`);
    trips[idx] = { ...trips[idx], tripMemo: clean || undefined, lastEdited: nowISO() };
    writeStore(trips);
    return toSummary(trips[idx]);
  },

  /* Sprint 22 #4 — mutate an existing trip's SKELETON (duration + city
     order/day allocation) without losing inner-day place nodes. The day
     array is rebuilt to the new length; each day keeps its existing
     attractions by day number, only the city headers are re-stamped from
     the new ranges. If the trip shrinks, the orphaned days' attractions
     are folded into the (new) last day so no user content is dropped. */
  async applySkeleton(tripId, { days: dayCount, cityRanges = [], title, meta } = {}) {
    const sbUser = await getSupabaseUser();
    if (sbUser) {
      const prev = await this.fetchTripById(tripId);
      if (prev.readOnly) throw new Error("This trip is read-only.");
      const { n, nextDays, inboxable } = rebuildSkeletonDays(prev, { days: dayCount, cityRanges });
      rescueOrphansToInbox(inboxable);
      const patch = {
        title: title || prev.title,
        days: n,
        meta: meta || prev.meta,
        settings: { ...prev.settings, days: n, cityRanges },
        data: { ...prev.data, tripData: nextDays },
      };
      return this.saveTrip(tripId, patch);
    }
    await delay(LAG);
    const trips = readStore();
    const idx = trips.findIndex((t) => t.id === tripId);
    if (idx === -1) throw new Error(`Trip not found: ${tripId}`);
    if (trips[idx].readOnly) throw new Error("This trip is read-only.");
    const prev = trips[idx];
    const { n, nextDays, inboxable } = rebuildSkeletonDays(prev, { days: dayCount, cityRanges });
    rescueOrphansToInbox(inboxable);
    trips[idx] = {
      ...prev,
      title: title || prev.title,
      days: n,
      meta: meta || prev.meta,
      settings: { ...prev.settings, days: n, cityRanges },
      data: { ...prev.data, tripData: nextDays },
      lastEdited: nowISO(),
    };
    writeStore(trips);
    return trips[idx];
  },

  /* Delete a trip from the store. */
  async deleteTrip(tripId) {
    const sbUser = await getSupabaseUser();
    if (sbUser) {
      const { error } = await supabase.from("trips").delete().eq("id", tripId).eq("owner_id", sbUser.id);
      if (error) throw new Error(error.message);
      return true;
    }
    await delay(LAG);
    const trips = readStore().filter((t) => t.id !== tripId);
    writeStore(trips);
    return true;
  },

  /* Create a blank itinerary from wizard settings. When
     `settings.days` is given we scaffold that many empty day
     objects (each with an empty attractions[] keyed to the
     destination city) so the editor's day-strip is ready to fill. */
  async createNewTrip(tripSettings = {}) {
    const sbUser = await getSupabaseUser();
    if (!sbUser) await delay(LAG);
    const trips = sbUser ? [] : readStore();
    const id = uid();
    const dayCount = Number(tripSettings.days) || 0;
    const city = tripSettings.destination || "";
    const cityHe = tripSettings.destinationHe || tripSettings.title || "";
    /* Optional day→city ranges from the wizard's city-routing step.
       Each day picks the range that covers it (fallback = the
       destination country) so timeline headers are pre-populated. */
    const ranges = Array.isArray(tripSettings.cityRanges) ? tripSettings.cityRanges : [];
    const cityForDay = (dayNum) => {
      const r = ranges.find((x) => dayNum >= x.fromDay && dayNum <= x.toDay);
      return r ? { city: r.city, cityHe: r.cityHe || r.city } : { city, cityHe };
    };
    const scaffold = Array.from({ length: dayCount }, (_, i) => ({
      day: i + 1,
      ...cityForDay(i + 1),
      attractions: [],
    }));
    /* Sprint 27 #1 — the wizard captures only a BASIC flight structure
       (origin → landing city, no times/numbers/terminals). It lands as a
       plain transit node on day 1; all deep logistics are optional,
       manual edits inside the timeline editor. */
    const origin = (tripSettings.transitOrigin || "").trim();
    const landing = (tripSettings.transitDestination || "").trim();
    if (scaffold.length && (origin || landing)) {
      const route = [origin, landing].filter(Boolean).join(" → ");
      scaffold[0].attractions.push({
        _transit: true,
        transitType: "flight",
        name: `טיסה · ${route}`,
        nameHe: `טיסה · ${route}`,
        from: origin,
        to: landing,
        departTime: "",
        arriveTime: "",
        refId: "",
      });
    }
    const trip = {
      id,
      title: tripSettings.title || tripSettings.destinationHe || "מסלול חדש",
      cover: tripSettings.cover || null,
      days: dayCount,
      meta: tripSettings.meta || (dayCount ? `${dayCount} ימים · ${cityHe}` : ""),
      role: "owner",
      readOnly: false,
      owner: { id: "u_michali", name: "מיכלי דמרי פינטל" },
      collaborators: [],
      lastEdited: nowISO(),
      /* Map center for dynamic viewport init (the editor flies here
         when a trip has no stops yet). */
      center: tripSettings.center || null,
      /* Travel framing — origin & destination airport/city captured by
         the wizard's opening transit step (top-level on the record so
         the editor and transit segments can read them directly). */
      transitOrigin: tripSettings.transitOrigin || "",
      transitDestination: tripSettings.transitDestination || "",
      settings: tripSettings,
      data: { tripData: scaffold, cityTransitions: [], lodgingOverrides: {} },
    };
    /* Sprint 26 — Supabase-first persistence for authenticated users. */
    if (sbUser) {
      const row = {
        id,
        owner_id: sbUser.id,
        owner_name: sbUser.user_metadata?.full_name || sbUser.email || "",
        title: trip.title,
        cover: trip.cover,
        days: trip.days,
        meta: trip.meta,
        read_only: false,
        collaborators: [],
        settings: tripSettings,
        data: trip.data,
        last_edited: nowISO(),
      };
      const { data, error } = await supabase.from("trips").insert(row).select().single();
      if (error) throw new Error(error.message);
      return rowToTrip(data);
    }
    trips.unshift(trip);
    writeStore(trips);
    return trip;
  },

  /* ── Active "live" trip ─────────────────────────────────────
     A single trip can be flagged as the one the user is currently
     travelling. Persisted under its own key so it survives reloads,
     and broadcast via ACTIVE_TRIP_EVENT for in-tab reactivity. */
  async setActiveTrip(tripId) {
    await delay(120); // light touch — this is a local flag, not a fetch
    try {
      if (tripId) localStorage.setItem(ACTIVE_KEY, tripId);
      else localStorage.removeItem(ACTIVE_KEY);
    } catch { /* storage unavailable — noop */ }
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent(ACTIVE_TRIP_EVENT, { detail: { tripId: tripId || null } }));
    }
  },

  async getActiveTripId() {
    try { return localStorage.getItem(ACTIVE_KEY) || null; } catch { return null; }
  },

  /* Synchronous peek — handy for lazy useState initialisers so a
     screen paints the right state on first render (no flash). */
  getActiveTripIdSync() {
    try { return localStorage.getItem(ACTIVE_KEY) || null; } catch { return null; }
  },

  /* Dev helper — wipe & re-seed (handy while iterating). */
  async resetStore() {
    localStorage.removeItem(STORAGE_KEY);
    return readStore();
  },
};

export default tripService;
