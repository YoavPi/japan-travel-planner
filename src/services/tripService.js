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
import { track } from "../analytics/posthog";
import { summarize } from "../utils/budget";

/* ── Sprint 26 — Supabase persistence layer ─────────────────────
   Every CRUD method now branches: with a live Supabase session the
   `trips` table is the source of truth (RLS scopes rows to the
   owner); without one (mock/demo sessions, backend not provisioned
   yet) the legacy localStorage engine below keeps working
   unchanged. Row ⇄ app-record mapping is centralised here. */

export const rowToTrip = (r) => r && ({
  id: r.id,
  title: r.title,
  cover: r.cover || null,
  days: r.days || 0,
  meta: r.meta || "",
  role: "owner",
  readOnly: !!r.read_only,
  owner: { id: r.owner_id, name: r.owner_name || "" },
  /* Sprint 66 — the share list lives in `trip_shares` (per-recipient
     RLS), NOT on the trips row, so a recipient can never read another
     recipient's email. Owners load it via tripService.listShares(). */
  tripMemo: r.trip_memo || undefined,
  lastEdited: r.last_edited || r.created_at,
  center: r.settings?.center || null,
  settings: r.settings || {},
  data: r.data || { tripData: [], cityTransitions: [], lodgingOverrides: {} },
  /* Lifted OUT of `data` so it survives the `data` strip that fetchAllTrips
     performs — the dashboard grid renders its budget mini-indicator from this
     and never loads the full item list. */
  budgetSummary: r.data?.budget?.summary || null,
  isPublic: !!r.is_public,
  galleryCategory: r.gallery_category || null,
  galleryDescription: r.gallery_description || null,
  publishedAt: r.published_at || null,
  favoritesCount: r.favorites_count || 0,
});

const tripPatchToRow = (patch = {}) => {
  const row = {};
  if ("title" in patch) row.title = patch.title;
  if ("cover" in patch) row.cover = patch.cover;
  if ("days" in patch) row.days = patch.days;
  if ("meta" in patch) row.meta = patch.meta;
  if ("readOnly" in patch) row.read_only = patch.readOnly;
  /* `collaborators` intentionally NOT mapped — deprecated column (Sprint 66).
     Sharing goes through tripService.addShare / removeShare / updateShareRole. */
  if ("tripMemo" in patch) row.trip_memo = patch.tripMemo ?? null;
  if ("settings" in patch) row.settings = patch.settings;
  if ("data" in patch) row.data = patch.data;
  if ("isPublic" in patch) row.is_public = patch.isPublic;
  if ("galleryCategory" in patch) row.gallery_category = patch.galleryCategory;
  if ("galleryDescription" in patch) row.gallery_description = patch.galleryDescription;
  if ("publishedAt" in patch) row.published_at = patch.publishedAt;
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

/* Fire-and-forget rescue of orphaned places into the inbox.
   Trip-scoped: these points were pinned in THIS trip's itinerary before the
   day count shrank out from under them, so the rescue keeps them tagged to
   this trip (shows under "הבנק לטיול זה"), not the general/global bank. */
const rescueOrphansToInbox = (inboxable, tripId) => {
  if (!inboxable?.length) return;
  addInboxPlaces(inboxable.map((a) => ({
    name: a.name,
    nameHe: a.nameHe || a.name,
    category: a.category || "אטרקציה",
    rating: a.rating || "",
    lat: a.coordinates.lat,
    lng: a.coordinates.lng,
    source: "skeleton-update",
  })), tripId).catch(() => { /* rescue is best-effort; the places also remain recoverable via undo-less re-add */ });
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
   the dashboard grid stays snappy) — but lift the budget summary out
   first, so the grid can still render its mini-indicator. */
const toSummary = ({ data, ...rest }) => ({
  ...rest,
  budgetSummary: rest.budgetSummary ?? data?.budget?.summary ?? null,
});

/* ── Budget summary: DERIVED, NEVER AUTHORED ─────────────────────
   Any patch carrying a budget gets its `summary` re-derived here,
   before the write. This is deliberately in saveTrip rather than in a
   dedicated budget method: budget-bearing writes also arrive through
   the GENERIC editor path (useEditorState persists `{ data }` after a
   stop mutation), and a summary that only refreshed on a budget-
   specific call would leave the dashboard card showing a stale figure.
   No extra read is needed — the whole budget is already in the patch. */
const withBudgetSummary = (patch) => {
  const b = patch?.data?.budget;
  if (!b) return patch;
  return { ...patch, data: { ...patch.data, budget: { ...b, summary: summarize(b) } } };
};

export const tripService = {
  /* All trips visible to a user (owned + shared-to). For the mock
     we return everything; a real backend would filter by userId. */
  async fetchAllTrips(/* userId */) {
    const sbUser = await getSupabaseUser();
    if (sbUser) {
      let { data, error } = await supabase
        .from("trips").select("*")
        .order("last_edited", { ascending: false });
      /* Sprint 40 / 63 — RESILIENCE: an unscoped scan evaluates every RLS
         policy against every candidate row, so one bad policy (e.g. the
         Sprint 62 collaborator policy's circular sub-query → "infinite
         recursion detected in policy for relation trips") or one malformed row
         can fail the WHOLE query and leave the dashboard empty. Fall back to an
         owner-scoped read (index-backed → only this user's rows are evaluated)
         so the primary trips list still renders. The definitive cure for the
         recursion is supabase_migration_fix_trips_rls.sql. */
      if (error) {
        if (typeof console !== "undefined") console.warn("[trips] unscoped fetch failed, retrying owner-scoped:", error.message);
        const fb = await supabase
          .from("trips").select("*")
          .eq("owner_id", sbUser.id)
          .order("last_edited", { ascending: false });
        if (fb.error) {
          /* Sprint 63 — last-ditch: an even simpler owner-scoped read with no
             ordering, in case the order column / a computed policy is the
             culprit. Only if THIS also fails do we surface the error. */
          const min = await supabase.from("trips").select("*").eq("owner_id", sbUser.id);
          if (min.error) throw new Error(fb.error.message);
          data = min.data;
        } else {
          data = fb.data;
        }
      }
      /* `filter(Boolean)` guards the destructuring map below against a null
         row (rowToTrip returns undefined for falsy input).
         rowToTrip hardcodes role:"owner" (it has no user context), so resolve
         REAL ownership here: a map whose owner is someone else is SHARED, not
         mine. "המפות שלי" = maps I created; a map others shared with me lives
         under "שותפו איתי". */
      const email = (sbUser.email || "").toLowerCase();
      /* Sprint 66 — genuine "shared with me" is decided by `trip_shares`, the
         per-recipient share table. ONE round trip: RLS returns only my own
         rows (recipient-select), so `.eq` on my email is enough. This also
         tells a REAL share apart from a merely-PUBLIC trip — the unscoped
         read above returns every is_public=true row (gallery public-read RLS),
         and those must NOT land in "שותפו איתי" just because I have an account. */
      const myShareRole = {};
      try {
        const { data: shares } = await supabase
          .from("trip_shares").select("trip_id, access_level")
          .eq("shared_with_email", email);
        (shares || []).forEach((s) => { myShareRole[s.trip_id] = s.access_level === "edit" ? "edit" : "view"; });
      } catch { /* table missing in some envs — shared list just stays empty */ }
      return (data || []).map((row) => {
        const trip = rowToTrip(row);
        if (!trip) return null;
        const { data: _d, ...rest } = trip;
        const mine = row.owner_id ? row.owner_id === sbUser.id : (!rest.owner?.id || rest.owner.id === sbUser.id);
        if (mine) return { ...rest, role: "owner", shared: false };
        /* Not mine — a genuine share only if an explicit trip_shares row is
           addressed to my email. Otherwise this row is visible purely because
           it's PUBLIC → keep it out of the dashboard's shared list. */
        const shareRole = myShareRole[row.id];
        if (!shareRole) return null;
        const canEdit = shareRole === "edit";
        return {
          ...rest,
          role: canEdit ? "edit" : "view",
          readOnly: !canEdit,
          shared: true,
          sharedBy: rest.owner?.name || row.owner_name || "משתמש אחר",
        };
      }).filter(Boolean);
    }
    await delay(LAG);
    return readStore().map(toSummary);
  },

  /* Full trip incl. itinerary payload.
     Sprint 39 #4 — resolves BOTH owner and SHARED access so a recipient
     opening a /map/edit/<id> share link renders the itinerary instead of
     crashing with "Trip not found". */
  async fetchTripById(tripId) {
    const sbUser = await getSupabaseUser();
    if (sbUser) {
      /* Sprint 64/66 — SINGLE RLS-GOVERNED READ. Owner AND recipient access are
         both decided by RLS ("Owners can always read own trips" OR the
         "trips: shared read" policy, which consults `trip_shares` through a
         SECURITY DEFINER fn — see supabase_migration_shares_private.sql), so we
         don't scope the read to owner_id (that blocked non-owners from opening
         a shared trip → "לא ניתן לטעון את הטיול"). The row comes back iff the
         viewer is the owner, the owner is null (legacy), the viewer has a
         `trip_shares` row, the trip is public, or the viewer is a global admin. */
      const { data, error } = await supabase
        .from("trips").select("*").eq("id", tripId).maybeSingle();
      if (error) throw new Error(error.message);
      if (data) {
        const trip = rowToTrip(data);
        /* Role resolution — no strict client-side gate; RLS already authorized
           the read. Owners edit fully; 'edit' recipients get a WRITABLE
           editor; everyone else renders read-only. */
        if (data.owner_id && data.owner_id === sbUser.id) {
          trip.role = "owner";
          return trip;
        }
        const email = (sbUser.email || "").toLowerCase();
        /* Sprint 66 — per-recipient role from `trip_shares` (RLS returns only
           my own row here). Replaces the old scan of the trips-row JSONB. */
        let shareRow = null;
        try {
          const { data: sr } = await supabase
            .from("trip_shares").select("access_level")
            .eq("trip_id", tripId).eq("shared_with_email", email).maybeSingle();
          shareRow = sr || null;
        } catch { /* table missing in some envs — fall through to public/read-only */ }
        if (shareRow) {
          /* A real person-to-person share (view/edit). */
          const canEdit = shareRow.access_level === "edit";
          trip.role = canEdit ? "edit" : "view";
          trip.readOnly = !canEdit;
          trip.shared = true;
          trip.sharedBy = data.owner_name || trip.owner?.name || undefined;
          return trip;
        }
        /* Not owner, not a collaborator — RLS still let us read it, so it must be
           a PUBLIC gallery map. Open it read-only ("צפייה בלבד"), WITHOUT a false
           "שותף ע״י" (nobody shared it with this user; it's public). */
        if (data.is_public) {
          trip.role = "view";
          trip.readOnly = true;
          trip.public = true;
          return trip;
        }
        /* Fallthrough (shouldn't happen — RLS would have blocked it). */
        trip.role = "view";
        trip.readOnly = true;
        return trip;
      }
      throw new Error(`Trip not found: ${tripId}`);
    }
    await delay(LAG);
    const trip = readStore().find((t) => t.id === tripId);
    if (!trip) throw new Error(`Trip not found: ${tripId}`);
    return trip;
  },

  /* Persist edits to an existing trip's payload. */
  async saveTrip(tripId, rawPatch) {
    const patch = withBudgetSummary(rawPatch);
    const sbUser = await getSupabaseUser();
    if (sbUser) {
      /* Owner fast-path (defense-in-depth: scope to the owner in addition to
         RLS). */
      const row = tripPatchToRow(patch);
      const { data, error } = await supabase
        .from("trips").update(row)
        .eq("id", tripId).eq("owner_id", sbUser.id).select().maybeSingle();
      if (error) throw new Error(error.message);
      if (data) return rowToTrip(data);
      /* Sprint 64 — not the owner: an 'edit' COLLABORATOR may still persist.
         Retry without the owner scope and let RLS (trips_collab_edit) decide —
         it grants the update only to the owner or an 'edit' collaborator, so a
         viewer or stranger still gets 0 rows and a clean "not found". */
      const fb = await supabase
        .from("trips").update(row)
        .eq("id", tripId).select().maybeSingle();
      if (fb.error) throw new Error(fb.error.message);
      if (!fb.data) throw new Error(`Trip not found: ${tripId}`);
      return rowToTrip(fb.data);
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

  /* Rename a trip (owner via saveTrip's owner-scoped update + collab fallback). */
  async renameTrip(tripId, title) {
    return this.saveTrip(tripId, { title: (title || "").trim() || "מסלול חדש" });
  },
  /* Set the cover — an image URL or an `emoji:<x>` string. */
  async setCover(tripId, cover) {
    return this.saveTrip(tripId, { cover });
  },

  /* ── Sharing (Sprint 66) ─────────────────────────────────────
     The collaborator list lives in `trip_shares`, NOT on the trips
     row — per-recipient RLS means a recipient can only ever read the
     ONE row addressed to their own email, so nobody a map is shared
     with can see the other recipients' addresses. The owner (via
     trips.owner_id) and a global admin see every row for the trip.
     Sharing metadata is not itinerary content, so these are allowed
     even on read-only example trips. ───────────────────────────── */

  /* Owner/admin: everyone this trip is shared with. */
  async listShares(tripId) {
    const sbUser = await getSupabaseUser();
    if (sbUser) {
      const { data, error } = await supabase
        .from("trip_shares")
        .select("id, shared_with_email, access_level, display_name, created_at")
        .eq("trip_id", tripId)
        .order("created_at", { ascending: true });
      if (error) throw new Error(error.message);
      return (data || []).map((r) => ({
        id: r.id,
        email: r.shared_with_email,
        name: r.display_name || (r.shared_with_email || "").split("@")[0],
        role: r.access_level === "edit" ? "edit" : "view",
      }));
    }
    await delay(120);
    const trip = readStore().find((t) => t.id === tripId);
    return Array.isArray(trip?.collaborators) ? trip.collaborators : [];
  },

  /* Owner: add — or re-role — a person by email. Idempotent on
     (trip, email). Returns the normalised share record. */
  async addShare(tripId, email, role = "view") {
    const e = (email || "").trim().toLowerCase();
    const lvl = role === "edit" ? "edit" : "view";
    if (!e) throw new Error("email-required");
    const sbUser = await getSupabaseUser();
    if (sbUser) {
      const { data, error } = await supabase
        .from("trip_shares")
        .upsert(
          { trip_id: tripId, shared_with_email: e, access_level: lvl, display_name: e.split("@")[0] },
          { onConflict: "trip_id,shared_with_email" },
        )
        .select("id, shared_with_email, access_level, display_name")
        .maybeSingle();
      if (error) throw new Error(error.message);
      return data && {
        id: data.id,
        email: data.shared_with_email,
        name: data.display_name || data.shared_with_email.split("@")[0],
        role: data.access_level === "edit" ? "edit" : "view",
      };
    }
    await delay(120);
    const trips = readStore();
    const idx = trips.findIndex((t) => t.id === tripId);
    if (idx === -1) throw new Error(`Trip not found: ${tripId}`);
    const list = Array.isArray(trips[idx].collaborators) ? trips[idx].collaborators : [];
    const rec = { id: `u_${e.replace(/[^a-z0-9]/g, "").slice(0, 10)}_${Date.now().toString(36)}`, name: e.split("@")[0], email: e, role: lvl, avatar: null };
    trips[idx] = { ...trips[idx], collaborators: [...list.filter((c) => (c.email || "").toLowerCase() !== e), rec] };
    writeStore(trips);
    return rec;
  },

  /* Owner: change a share's access level. */
  async updateShareRole(tripId, shareId, role) {
    const lvl = role === "edit" ? "edit" : "view";
    const sbUser = await getSupabaseUser();
    if (sbUser) {
      const { error } = await supabase.from("trip_shares").update({ access_level: lvl }).eq("id", shareId);
      if (error) throw new Error(error.message);
      return;
    }
    await delay(120);
    const trips = readStore();
    const idx = trips.findIndex((t) => t.id === tripId);
    if (idx === -1) return;
    const list = Array.isArray(trips[idx].collaborators) ? trips[idx].collaborators : [];
    trips[idx] = { ...trips[idx], collaborators: list.map((c) => (c.id === shareId ? { ...c, role: lvl } : c)) };
    writeStore(trips);
  },

  /* Owner: revoke a share. */
  async removeShare(tripId, shareId) {
    const sbUser = await getSupabaseUser();
    if (sbUser) {
      const { error } = await supabase.from("trip_shares").delete().eq("id", shareId);
      if (error) throw new Error(error.message);
      return;
    }
    await delay(120);
    const trips = readStore();
    const idx = trips.findIndex((t) => t.id === tripId);
    if (idx === -1) return;
    const list = Array.isArray(trips[idx].collaborators) ? trips[idx].collaborators : [];
    trips[idx] = { ...trips[idx], collaborators: list.filter((c) => c.id !== shareId) };
    writeStore(trips);
  },

  /* Sprint 19.3 — persist a per-trip logistical sticky memo. A memo is
     dashboard metadata (a personal reminder), NOT itinerary content, so
     like the sharing methods it is permitted even on read-only example trips.
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
      rescueOrphansToInbox(inboxable, tripId);
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
    rescueOrphansToInbox(inboxable, tripId);
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
      /* `.select()` returns the rows actually deleted. With RLS enabled a
         missing/incorrect DELETE policy (or an ownership mismatch) removes
         ZERO rows and returns NO error — the old code treated that as success,
         so the trip reappeared on reload. We now require ≥1 deleted row and
         throw otherwise, so the UI can surface a real failure. */
      const { data, error } = await supabase
        .from("trips").delete().eq("id", tripId).eq("owner_id", sbUser.id).select("id");
      if (error) throw new Error(error.message);
      if (!data || data.length === 0) {
        throw new Error("delete-blocked: no rows deleted (check the trips DELETE RLS policy / ownership)");
      }
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
    /* Sprint 67 — AI trip generation. When `seedDays` is supplied (a fully
       built tripData array from /api/generate-trip), we skip the empty
       scaffold and land the generated days directly. `seedDays` is itinerary
       content, not a setting, so it's stripped from the persisted `settings`. */
    const seedDays = Array.isArray(tripSettings.seedDays) && tripSettings.seedDays.length
      ? tripSettings.seedDays : null;
    const { seedDays: _omitSeed, ...cleanSettings } = tripSettings;
    const dayCount = seedDays ? seedDays.length : (Number(tripSettings.days) || 0);
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
    const scaffold = seedDays || Array.from({ length: dayCount }, (_, i) => ({
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
      settings: cleanSettings,
      data: { tripData: scaffold, cityTransitions: [], lodgingOverrides: {} },
    };
    /* Product analytics — "a map was built". Fires for both creation paths
       (AI-generated when seedDays is present, otherwise the manual wizard).
       No-op unless PostHog is configured. */
    track("map_created", {
      source: seedDays ? "ai" : "wizard",
      days: dayCount,
      destination: tripSettings.destinationHe || tripSettings.destination || cityHe || "",
      authed: !!sbUser,
    });

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
        settings: cleanSettings,
        data: trip.data,
        last_edited: nowISO(),
        source: seedDays ? "ai" : "wizard",
      };
      /* Hotfix — INSERT WITHOUT a RETURNING `.select()`.
         `.insert(row).select()` makes PostgREST read the new row back, which
         evaluates every SELECT policy on `trips`. The "trips: shared read"
         policy subqueries `trip_shares`, whose own policy subqueries `trips`
         → Postgres raises "infinite recursion detected in policy" (42P17) and
         the whole insert call rejects, freezing the wizard CTA.
         An INSERT alone only evaluates the WITH CHECK policy (owner_id =
         auth.uid()), so it succeeds cleanly. We already know exactly what we
         wrote, so the record is rebuilt from `row` — no read-back needed. */
      const { error } = await supabase.from("trips").insert(row);
      if (error) throw new Error(error.message);
      return rowToTrip(row);
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
