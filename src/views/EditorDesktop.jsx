import React, { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence, useReducedMotion, Reorder } from "motion/react";
import { useParams, useNavigate } from "react-router-dom";
import EditorMap from "../components/EditorMap";
import ReferenceMapsPanel from "../components/ReferenceMapsPanel";
import OverlayAddChoice from "../components/OverlayAddChoice";
import EditorSearchBar from "../components/EditorSearchBar";
import AddTransitSheet from "../components/AddTransitSheet";
import FavoriteButton from "../components/FavoriteButton";
import NearbySearchSheet from "../components/NearbySearchSheet";
import { listFavoriteIds } from "../services/favoritesService";
import { fullDateLabel } from "../utils/tripDates";
import { track } from "../analytics/posthog";
import Icon from "../components/Icon";
import { categoryEmoji, classifyLocation, ratingToBadge, CATEGORY_META } from "../utils/classify";
import { boundsForDestination, getDetails, nearbySearch } from "../services/googlePlaces";
import { uploadAttachment } from "../services/attachmentService";
import useEditorState from "../hooks/useEditorState";
import mapsUrlFor from "../utils/mapsUrl";
import { photoStrict, onPhotoErrorStrict } from "../utils/placePhoto";
import { readPrefs } from "../services/prefsService";
import usePlacePhotos, { photoKey } from "../utils/usePlacePhotos";

/* Stable per-object identity for Reorder keys/values: a stop's array index
   changes as it's dragged, so we key by the attraction object itself via a
   WeakMap of lazily-assigned ids. Same reference → same id for its lifetime. */
const ROW_KEYS = new WeakMap();
let ROW_KEY_SEQ = 0;
const rowKey = (obj) => {
  if (!obj || typeof obj !== "object") return "row-x";
  let k = ROW_KEYS.get(obj);
  if (!k) { k = "row-" + (++ROW_KEY_SEQ); ROW_KEYS.set(obj, k); }
  return k;
};

/* ══════════════════════════════════════════════════════════════
   EditorDesktop — the desktop "planning cockpit" (Stage 2, WIP).

   A three-pane, mouse-first layout that reuses the SHARED brain
   (useEditorState) and the SAME map component as mobile — only the
   presentation differs:

     ┌──────────────── top bar (title · days · back) ───────────────┐
     │  itinerary panel (right, RTL)  │        map (left)           │
     │  ┌ day rail ┐                  │   EditorMap (big, mouse      │
     │  │ 1 2 3 …  │                  │   scroll-zoom, markers,      │
     │  └──────────┘                  │   dashed route polyline)     │
     │  active-day stop list          │                             │
     └──────────────────────────────────────────────────────────────┘

   This is the read-first skeleton (real trip data, day switching,
   click-a-stop → fly the map). Editing tools (add / drag-reorder /
   right-click / multi-select) arrive in the next slices. Mobile is
   entirely untouched — this file is purely additive.
   ══════════════════════════════════════════════════════════════ */

const CHARCOAL = "#1E1E24";
const ACCENT = "#E0533F";
const T = {
  ink: "#111114", ink2: "#2A3036", ink3: "#6B7178", ink4: "#A4AAB1",
  line: "#ECECEF", surface: "#F0F0F3",
  font: "'Noto Sans Hebrew','Inter','Noto Sans JP',system-ui,sans-serif",
};

/* Deterministic per-city accent (mirrors the mobile palette's spirit). */
const CITY_COLORS = ["#1E1E24", "#C0392B", "#2E7D57", "#5B6BB5", "#B5762E", "#8E5BA6"];
/* A faint translucent tint of a hex color — used for the whole-trip day
   header bands so each day reads as its own section. */
/* Straight-line (haversine) km between two {lat,lng} points. */
const haversineKm = (A, B) => {
  if (!A || !B || !Number.isFinite(A.lat) || !Number.isFinite(B.lat)) return null;
  const R = 6371, toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(B.lat - A.lat), dLng = toRad(B.lng - A.lng);
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(A.lat)) * Math.cos(toRad(B.lat)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(s), Math.sqrt(1 - s));
};
/* An ESTIMATED leg between two stops from the straight-line distance. Roads
   aren't straight, so we inflate ×1.3; short hops read as a walk, longer as a
   drive. It's a rough planning estimate (no routing API), clearly marked "~". */
const legEstimate = (A, B, units = "km") => {
  const straight = haversineKm(A, B);
  if (straight == null) return null;
  const km = straight * 1.3;
  const walk = km <= 1.6;
  const speed = walk ? 4.8 : km < 12 ? 26 : 70; // km/h: walk / city drive / intercity
  const mins = Math.max(1, Math.round((km / speed) * 60));
  /* Distance formatted in the user's chosen unit (Settings → יחידות מרחק). */
  const dist = units === "mi"
    ? (() => { const mi = km * 0.621371; return mi < 0.19 ? `${Math.round(mi * 5280)} ft` : `${mi.toFixed(mi < 10 ? 1 : 0)} מייל`; })()
    : (km < 1 ? `${Math.round(km * 1000)} מ׳` : `${km.toFixed(km < 10 ? 1 : 0)} ק״מ`);
  const time = mins >= 60 ? `${Math.floor(mins / 60)}:${String(mins % 60).padStart(2, "0")} שעות` : `${mins} דק׳`;
  return { walk, label: `${walk ? "🚶" : "🚗"} ~${time} · ${dist}` };
};

const hexTint = (hex, a = 0.08) => {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex || "");
  if (!m) return `rgba(30,30,36,${a})`;
  return `rgba(${parseInt(m[1], 16)},${parseInt(m[2], 16)},${parseInt(m[3], 16)},${a})`;
};
const cityColor = (city = "") => {
  let h = 0;
  for (let i = 0; i < city.length; i++) h = (h * 31 + city.charCodeAt(i)) >>> 0;
  return CITY_COLORS[h % CITY_COLORS.length];
};

const PANEL_WIDTH = 400;

export default function EditorDesktop() {
  const { tripId } = useParams();
  const navigate = useNavigate();
  const editor = useEditorState(tripId);
  const distUnits = readPrefs().units; // km | mi — Settings → יחידות מרחק
  const { trip, error, days, activeDay, setActiveDay, activeDayData, mapStops, editable,
    deleteStopAt, duplicateStopAt, moveStopToDay, setStopNote, addStopToDay, setDayOrder,
    addTransitToDay, updateStopAt, addAttachmentToStop, removeAttachmentAt, insertAt,
    addDay, deleteDay, saveStartDate, applyDateRange, moveStopToInbox, saveCustomPin, addSearchedToInbox,
    inbox, inboxLoading, loadInbox, assignInboxToDay, removeFromInbox, updateInboxNote } = editor;

  const [flyToCoord, setFlyToCoord] = useState(null);
  /* Live map viewport bounds ({west,south,east,north}) so search biases to the
     area the user is looking at FIRST, then widens to the country. */
  const viewportRef = useRef(null);
  /* Live search-result pins on the map (from the search bar's Text Search). */
  const [searchResults, setSearchResults] = useState([]);
  /* "מצא לי X באזור" — the origin point whose picker sheet is open (null = closed)
     and the origin coordinate the map auto-fits around once results arrive. */
  const [nearbyOrigin, setNearbyOrigin] = useState(null);
  const [searchOrigin, setSearchOrigin] = useState(null);
  const runNearby = async (origin, query) => {
    const c = origin?.coordinates || (Number.isFinite(origin?.lat) ? { lat: origin.lat, lng: origin.lng } : null);
    setNearbyOrigin(null);
    if (!c) return;
    /* Close the origin's anchored card so it doesn't cover the results. */
    setPreview(null); setFocusStop(null);
    setSearchOrigin(c);
    const res = await nearbySearch(c, query);
    setSearchResults(res); // EditorMap fits to origin + results
    track("nearby_search", { ...query, results: res.length });
  };
  /* Skeleton editing: the dates modal (start/end → day count) + per-day delete. */
  const [datesOpen, setDatesOpen] = useState(false);
  const [datesStart, setDatesStart] = useState("");
  const [datesEnd, setDatesEnd] = useState("");
  const [confirmDelDay, setConfirmDelDay] = useState(null); // day number pending delete
  const [hoverDay, setHoverDay] = useState(null); // day chip under the cursor (reveals ×)
  const openDatesModal = () => {
    const startIso = trip?.settings?.startDate ? String(trip.settings.startDate).slice(0, 10) : "";
    let endIso = "";
    if (startIso && days.length > 0) {
      const s = new Date(startIso); s.setDate(s.getDate() + days.length - 1);
      endIso = s.toISOString().slice(0, 10);
    }
    setDatesStart(startIso); setDatesEnd(endIso); setDatesOpen(true);
  };
  /* Places-Inbox side drawer (saved points → drop into a day). Lazy-loaded. */
  const [inboxOpen, setInboxOpen] = useState(false);
  /* Bank scope — "trip" shows points near THIS trip's places (default),
     "all" shows every saved point across all maps. */
  const [bankScope, setBankScope] = useState("trip");
  const [bankFilter, setBankFilter] = useState(""); // free-text filter over saved bank points
  /* Opening the bank drawer closes any open point card first — otherwise the
     anchored map popup overlaps the drawer (the UI glitch Yoav saw). */
  const openInbox = () => { setPreview(null); setFocusStop(null); setInboxOpen(true); if (inbox === null) loadInbox(); };
  /* Points currently in the bank — drives the bank button's count + accent
     "has content" state. */
  const bankCount = Array.isArray(inbox) ? inbox.length : 0;

  /* Favorite state for a public map the viewer doesn't own (view-only). */
  const isPublicView = !!trip?.public && trip?.role !== "owner";
  const [isFav, setIsFav] = useState(false);
  useEffect(() => {
    if (!trip?.public || trip?.role === "owner") return;
    let live = true;
    listFavoriteIds().then((ids) => { if (live) setIsFav(ids.has(tripId)); }).catch(() => {});
    return () => { live = false; };
  }, [trip?.public, trip?.role, tripId]);
  /* "מפות נוספות" — load another map as a distinct-colour overlay + transfer
     points into this trip. */
  const [refMapsOpen, setRefMapsOpen] = useState(false);
  const [overlayMap, setOverlayMap] = useState(null);
  const [overlaySel, setOverlaySel] = useState(null);   // point whose map popup is open
  const [addChoice, setAddChoice] = useState(null);     // points awaiting a bank/day pick
  const [addedKeys, setAddedKeys] = useState(() => new Set()); // keys added this session
  const refFavorites = useMemo(() => { try { return new Set(JSON.parse(localStorage.getItem("tp_favorites_v1") || "[]")); } catch { return new Set(); } }, []);
  /* Loading a different reference map (or clearing it) resets the popup + adds. */
  const applyOverlayMap = (m) => { setOverlayMap(m); setOverlaySel(null); setAddChoice(null); setAddedKeys(new Set()); };
  const closeRefMaps = () => { setRefMapsOpen(false); applyOverlayMap(null); };
  const focusOverlayPoint = (p) => { if (p && Number.isFinite(p.lat) && Number.isFinite(p.lng)) setFlyToCoord({ lat: p.lat, lng: p.lng }); setOverlaySel(p); };
  /* Add overlay points to the trip. target = "bank" | <dayNumber>. */
  const addOverlayPoints = (pts, target, includeNotes = true) => {
    (pts || []).forEach((p) => {
      const stop = { name: p.name, nameHe: p.nameHe || p.name, category: p.category || "אטרקציה", rating: p.rating || undefined, coordinates: { lat: p.lat, lng: p.lng }, place_id: p.place_id || undefined, note: includeNotes ? (p.note || undefined) : undefined };
      if (target === "bank") addSearchedToInbox(stop); else addStopToDay(target, stop);
    });
    setAddedKeys((prev) => { const n = new Set(prev); (pts || []).forEach((p) => n.add(p.key)); return n; });
  };
  /* 👁️ eye — project ALL saved bank points onto the map as gray ★ markers
     (parity with the mobile eye FAB). Loads the bank lazily when turned on. */
  /* Default ON — the saved-points bank shows on the map from the start. */
  const [showAllSaved, setShowAllSaved] = useState(true);
  const toggleAllSaved = () => { setShowAllSaved((v) => { const n = !v; if (n && inbox === null) loadInbox(); return n; }); };
  /* Load the bank once on mount so the default-on markers actually appear. */
  useEffect(() => {
    if (showAllSaved && inbox === null) loadInbox();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  /* Switching days must clear any point card left open from another day, so a
     stale marker/popup from the previous day never lingers on the new day. */
  useEffect(() => {
    setFocusStop(null);
    setPreview(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeDay]);
  /* Desktop superpower — the map can show the ACTIVE DAY only, or the WHOLE
     TRIP at once (every stop across every day), fit to the full geography. */
  const [showAllOnMap, setShowAllOnMap] = useState(false);
  /* Transit/flight editor sheet. { idx, initial, insertIdx } — idx === -1
     appends; insertIdx (when set) inserts at that REAL index. null = closed. */
  const [transitEdit, setTransitEdit] = useState(null);
  /* Inline "+" quick-insert popover between rows: { idx } = insert position. */
  const [insertMenu, setInsertMenu] = useState(null);
  /* Search PREVIEW (Map Discovery Invariant): a picked search result is NOT
     committed — it flies the map, drops a pin, and opens an info card that
     lets the user read it and choose which day to add it to. */
  const [preview, setPreview] = useState(null);   // normalized stop | null
  const [previewDay, setPreviewDay] = useState(null); // chosen target day
  /* Clicking an existing stop flies+zooms the map and opens its detail card
     (info + picture). Mutually exclusive with the search preview card. */
  const [focusStop, setFocusStop] = useState(null);

  /* Real per-place photos from Google Street View (by coordinates — never
     expires, always the ACTUAL location). Covers the active day's stops PLUS
     whatever point is currently previewed/focused, so its card shows a real
     image too. `bestPhoto` = Street View → trusted stored photo → neutral
     "no photo" placeholder (utils/placePhoto). We never show a misleading
     category stock image. */
  const photoItems = useMemo(
    () => [...(activeDayData?.attractions || []), preview, focusStop].filter(Boolean),
    [activeDayData, preview, focusStop]
  );
  const freshPhotos = usePlacePhotos(photoItems);
  const bestPhoto = (a) => { const k = photoKey(a); return (k && freshPhotos[k]) || photoStrict(a); };

  /* Bank list photos + this-trip scoping. `tripBounds` is the trip's stop
     bounding box (+margin) so "this trip" shows only nearby saved points. */
  const bankPhotos = usePlacePhotos(Array.isArray(inbox) ? inbox : []);
  const bankPhotoFor = (p) => { const k = photoKey(p); return (k && bankPhotos[k]) || photoStrict(p); };
  const tripBounds = useMemo(() => {
    const pts = (days || []).flatMap((d) => (d.attractions || []).filter((a) => a && a.coordinates && Number.isFinite(a.coordinates.lat)).map((a) => a.coordinates));
    if (!pts.length) return null;
    let n = -90, s = 90, e = -180, w = 180;
    pts.forEach((c) => { n = Math.max(n, c.lat); s = Math.min(s, c.lat); e = Math.max(e, c.lng); w = Math.min(w, c.lng); });
    return { north: n + 0.6, south: s - 0.6, east: e + 0.6, west: w - 0.6 }; // ~65km margin
  }, [days]);
  const visibleInbox = (Array.isArray(inbox) ? inbox : []).filter((p) =>
    bankScope === "all" || !tripBounds ||
    (Number.isFinite(p.lat) && Number.isFinite(p.lng) && p.lat >= tripBounds.south && p.lat <= tripBounds.north && p.lng >= tripBounds.west && p.lng <= tripBounds.east));

  /* Free-text filter over the EXISTING bank points (name / note / category) —
     this is a search WITHIN the bank, not a Google "search + save" (that lives
     in the main top search bar). */
  const bankQ = bankFilter.trim().toLowerCase();
  const filteredInbox = bankQ
    ? visibleInbox.filter((p) => [p.nameHe, p.name, p.note, p.category].filter(Boolean).some((s) => String(s).toLowerCase().includes(bankQ)))
    : visibleInbox;

  /* Float the open info card ON its point. Clicking any point crop-CENTERS it
     in the map pane (see EditorMap flyToStop), so the point is reliably at the
     pane's centre — we place the card horizontally centred there and just below
     that centre, so it reads as attached to the point instead of a lost corner.
     Deterministic (no fragile per-frame projection). */

  const focusOnStop = (a) => {
    if (!a) return;
    setPreview(null);
    setFocusStop(a);
    const c = a.coordinates;
    if (c && Number.isFinite(c.lat) && Number.isFinite(c.lng)) setFlyToCoord({ lat: c.lat, lng: c.lng });
  };

  /* Open a saved bank point (flat lat/lng) exactly like a search result: the
     map crop-CENTERS on it and its anchored preview card opens (info + day
     picker + "add to day" + open-in-Maps). Used by BOTH the gray map markers
     and the bank drawer rows, so a bank point always centers on click. When
     opened from the drawer we close the drawer so the anchored card (hidden
     while the drawer is open) becomes visible over the centered point. */
  const openSavedPoint = (p, { fromDrawer = false } = {}) => {
    if (!p || !Number.isFinite(p.lat) || !Number.isFinite(p.lng)) return;
    if (fromDrawer) setInboxOpen(false);
    setFocusStop(null);
    setPreview({ ...p, coordinates: { lat: p.lat, lng: p.lng }, _fromInbox: true });
    setPreviewDay(activeDay);
    setFlyToCoord({ lat: p.lat, lng: p.lng });
  };

  /* ── Desktop keyboard navigation ──────────────────────────────
     A real planning surface answers to the keyboard — this is a
     desktop-only affordance (mobile has no hardware keys to spare).
       • digit 1–9  → jump straight to that day (if it exists)
       • Esc        → back out of the top-most open layer, one at a
                      time: quick-insert → transit sheet → preview
                      card → focus card → inbox drawer → whole-trip.
     Arrow keys are intentionally NOT bound — MapLibre owns them for
     panning the map, so day-stepping would fight the map. Ignored
     while typing in a field or with a modifier held, so text entry
     and Cmd/Ctrl browser shortcuts are never hijacked. */
  useEffect(() => {
    const onKey = (e) => {
      const el = e.target;
      if (el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable)) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      if (e.key === "Escape") {
        if (insertMenu) setInsertMenu(null);
        else if (transitEdit) setTransitEdit(null);
        else if (preview) setPreview(null);
        else if (focusStop) setFocusStop(null);
        else if (inboxOpen) setInboxOpen(false);
        else if (showAllOnMap) setShowAllOnMap(false);
        else return;
        e.preventDefault();
        return;
      }

      if (/^[1-9]$/.test(e.key)) {
        const n = parseInt(e.key, 10);
        if (days.some((d) => d.day === n)) {
          setShowAllOnMap(false);
          setActiveDay(n);
          e.preventDefault();
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [days, setActiveDay, preview, focusStop, insertMenu, transitEdit, inboxOpen, showAllOnMap]);

  const openInMaps = (a) => {
    // Resolve to the real place listing (link → place_id → name),
    // coordinates only as a last resort — see utils/mapsUrl.
    const url = mapsUrlFor(a);
    if (url) window.open(url, "_blank", "noopener,noreferrer");
  };

  const openPreview = (d) => {
    if (!d) return;
    const { category, he } = classifyLocation(d.types || []);
    const stop = {
      name: d.name, nameHe: d.name,
      /* Keep the Google place_id so the place's OWN Google Maps photo can be
         re-fetched (and persists) instead of decaying to a Street View. */
      place_id: d.place_id || d.placeId || undefined,
      category: category === "unknown" ? CATEGORY_META.attraction.he : he,
      rating: ratingToBadge(d.rating) || undefined,
      coordinates: (d.lat != null && d.lng != null) ? { lat: d.lat, lng: d.lng } : null,
      address: d.address || d.formatted_address || "",
      photoUrl: d.photoUrl || d.photo_url || "",
    };
    setPreview(stop);
    setPreviewDay(activeDay);
    if (stop.coordinates) setFlyToCoord({ lat: stop.coordinates.lat, lng: stop.coordinates.lng });
  };
  const commitPreview = () => {
    if (!preview) return;
    const day = previewDay ?? activeDay;
    const withNote = { ...preview, note: (preview.note || "").trim() || undefined };
    // A bank point (opened by clicking its gray map marker) is ASSIGNED to the
    // day (which also removes it from the bank); a searched place is just added.
    if (withNote._fromInbox) assignInboxToDay(withNote, day);
    else addStopToDay(day, withNote);
    setPreview(null);
  };
  /* Per-stop file attachments. A hidden input is triggered from the context
     menu; the picked stop's REAL index is held in a ref until the file lands. */
  const fileInputRef = useRef(null);
  const attachTargetRef = useRef(null); // REAL attractions index awaiting a file
  const [attachBusy, setAttachBusy] = useState(false);
  const [attachToast, setAttachToast] = useState(""); // upload-failure micro-toast
  useEffect(() => {
    if (!attachToast) return;
    const t = setTimeout(() => setAttachToast(""), 2400);
    return () => clearTimeout(t);
  }, [attachToast]);

  const promptAttach = (idx) => { attachTargetRef.current = idx; if (fileInputRef.current) fileInputRef.current.click(); };
  const onFilePicked = async (e) => {
    const file = e.target.files && e.target.files[0];
    e.target.value = ""; // allow re-picking the same file
    const idx = attachTargetRef.current;
    if (!file || idx == null) return;
    setAttachBusy(true);
    try {
      const meta = await uploadAttachment(trip?.id, file);
      if (meta) addAttachmentToStop(activeDay, idx, meta);
    } catch (err) {
      /* A real Supabase-backed upload failure (or an oversized file) — do NOT
         persist anything onto the stop; surface it instead. */
      setAttachToast(/too large/.test(err?.message || "") ? "הקובץ גדול מדי (מקס' 15MB)" : "העלאת הקובץ נכשלה, נסו שוב");
    }
    finally { setAttachBusy(false); attachTargetRef.current = null; }
  };
  /* Mouse-first editing: a right-click / ⋯ context menu at a cursor position,
     and a quick note editor. `idx` is the REAL index into the day's attractions. */
  const [ctxMenu, setCtxMenu] = useState(null);   // { x, y, idx, a } | null
  const reduceMotion = useReducedMotion();        // hook — must precede any early return
  const [ctxDaysOpen, setCtxDaysOpen] = useState(false);
  const [noteEdit, setNoteEdit] = useState(null); // { idx, draft } | null

  /* Pointer-native drag-reorder within the active day (Apple-grade: 1:1
     finger-follow via motion's Reorder, spring reflow of the siblings, commit
     on release). `dragOrder` holds the live working order (an array of the
     SAME attraction object references) while a drag is in flight — the timeline
     derives from it so transit/note nodes reflow in lockstep — then it's
     committed via setDayOrder and cleared. `reorderInDay` is retained for the
     inbox assign path. */
  const [dragOrder, setDragOrder] = useState(null);   // attraction[] mid-drag, else null
  const [draggingKey, setDraggingKey] = useState(null); // key of the lifted row

  const commitDrag = () => {
    if (dragOrder) setDayOrder(activeDay, dragOrder);
    setDragOrder(null);
    setDraggingKey(null);
  };

  const openCtx = (e, idx, a) => {
    e.preventDefault(); e.stopPropagation();
    if (!editable) return;
    const pad = 8;
    const x = Math.min(e.clientX, window.innerWidth - 230);
    const y = Math.min(e.clientY, window.innerHeight - 260);
    setCtxDaysOpen(false);
    setCtxMenu({ x: Math.max(pad, x), y: Math.max(pad, y), idx, a });
  };

  /* Active-day trajectory polyline for the map (matches the mobile dashed line). */
  const routePath = useMemo(
    () => mapStops.map((s) => [s.coordinates.lng, s.coordinates.lat]),
    [mapStops]
  );

  /* Whole-trip view — every plottable stop across every day, globally
     numbered (_seq) so the pins read 1..N along the full itinerary. */
  const allMapStops = useMemo(() => {
    let seq = 0;
    return (days || []).flatMap((d) => (d.attractions || [])
      .filter((s) => !s._transit && s.coordinates
        && Number.isFinite(s.coordinates.lat) && Number.isFinite(s.coordinates.lng))
      .map((s) => ({ ...s, _seq: (seq += 1) })));
  }, [days]);
  const allRoutePath = useMemo(
    () => allMapStops.map((s) => [s.coordinates.lng, s.coordinates.lat]),
    [allMapStops]
  );

  /* Which set feeds the map + its polyline + pin color. */
  const mapPaneStops = showAllOnMap ? allMapStops : mapStops;
  const mapPaneRoute = showAllOnMap ? allRoutePath : routePath;
  const mapPaneColor = showAllOnMap ? CHARCOAL : cityColor(activeDayData?.city || "");

  /* Visible schedule rows for the active day (numbered, non-transit). Each row
     keeps its REAL index into the day's attractions so edit handlers hit the
     right element even when transit nodes are interleaved. */
  const rows = useMemo(() => {
    let n = 0;
    return (activeDayData?.attractions || [])
      .map((a, idx) => ({ a, idx }))
      .filter(({ a }) => !a._transit)
      .map(({ a, idx }) => ({ a, idx, n: (n += 1) }));
  }, [activeDayData]);

  /* The full day timeline: stops AND transit segments, interleaved in real
     order. Stops carry a running number `n`; transit segments render as
     distinct coral blocks. Both keep their REAL index for edit handlers. */
  const timeline = useMemo(() => {
    let n = 0;
    // While a pointer-drag is in flight, render from the live working order so
    // every row (including interleaved transit/note) reflows in lockstep.
    const src = dragOrder || (activeDayData?.attractions || []);
    return src.map((a, idx) => {
      if (a._transit) return { kind: "transit", a, idx };
      if (a._noteNode) return { kind: "note", a, idx };
      n += 1;
      return { kind: "stop", a, idx, n };
    });
  }, [activeDayData, dragOrder]);

  /* Whole-trip "route in sequence" for the itinerary panel — every day with
     its stops, globally numbered, shown when the map is in whole-trip mode. */
  const wholeTrip = useMemo(() => {
    let seq = 0;
    return (days || []).map((d) => ({
      day: d,
      items: (d.attractions || []).map((a, idx) => {
        if (a._transit) return { kind: "transit", a, idx };
        seq += 1;
        return { kind: "stop", a, idx, n: seq };
      }),
    }));
  }, [days]);

  /* The single info card, rendered as a maplibre Popup anchored to its point
     (see EditorMap). `cardCoord` = the open point; `renderAnchoredCard` = the
     card body. Preview (search/bank pick) takes precedence over a focused stop. */
  const cardCoord = inboxOpen ? null : ((preview && preview.coordinates) || (focusStop && focusStop.coordinates) || null);
  const CARD_SHELL = { width: 340, maxWidth: "86vw", background: "rgba(255,255,255,0.94)", backdropFilter: "blur(24px) saturate(180%)", WebkitBackdropFilter: "blur(24px) saturate(180%)", borderRadius: 18, border: "1px solid rgba(255,255,255,0.6)", boxShadow: "0 20px 55px rgba(0,0,0,0.28)", overflow: "hidden", fontFamily: T.font };
  const renderAnchoredCard = () => {
    if (preview) return (
      <div dir="rtl" className="tp-frost" style={CARD_SHELL}>
        {/* Prefer the fresh Google photo from the search (valid this session),
            then the re-hydrated best photo. */}
        <div style={{ height: 120, background: `center/cover url(${preview.photoUrl || bestPhoto(preview)}), ${T.surface}` }} />
        <div style={{ padding: "14px 16px 16px" }}>
          <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
            <span aria-hidden style={{ flexShrink: 0, width: 34, height: 34, borderRadius: 9, background: T.surface, display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}>{categoryEmoji(preview.category)}</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div dir="auto" style={{ fontSize: 16, fontWeight: 800, letterSpacing: "-0.012em", color: T.ink, lineHeight: 1.25, wordBreak: "break-word" }}>{preview.nameHe || preview.name}</div>
              <div style={{ fontSize: 12, color: T.ink3, marginTop: 2 }}>{[preview.rating ? `★ ${preview.rating}` : "", preview.category].filter(Boolean).join(" · ")}</div>
            </div>
            <button onClick={() => setPreview(null)} title="ביטול" aria-label="ביטול" style={{ flexShrink: 0, width: 28, height: 28, borderRadius: 8, border: "none", background: T.surface, color: T.ink2, cursor: "pointer", fontFamily: "inherit", fontSize: 14, fontWeight: 800 }}>✕</button>
          </div>
          {preview.address && (
            <div dir="auto" style={{ fontSize: 12, color: T.ink3, marginTop: 8, lineHeight: 1.45 }}>{preview.address}</div>
          )}
          {/* Personal note — carried onto the stop and into the bank, exactly like
              the mobile add card. Stored on the preview object so it commits and
              clears with it. */}
          <textarea
            value={preview.note || ""}
            onChange={(e) => setPreview((p) => (p ? { ...p, note: e.target.value, _noteSaved: false } : p))}
            placeholder="הוסיפו הערה אישית (לא חובה)…"
            rows={2}
            style={{ width: "100%", boxSizing: "border-box", marginTop: 10, padding: "9px 11px", borderRadius: 10, border: `1px solid ${preview.note ? CHARCOAL : T.line}`, background: "#fff", fontSize: 13, fontFamily: "inherit", color: T.ink, direction: "rtl", textAlign: "right", resize: "none", lineHeight: 1.5, transition: "border-color 0.15s" }}
          />
          {/* Bank point → the note edits its BANK entry (persist + show in the list). */}
          {preview._fromInbox && preview.id && (
            <button onClick={() => { updateInboxNote(preview.id, preview.note || ""); setPreview((p) => ({ ...p, _noteSaved: true })); }}
              style={{ marginTop: 8, width: "100%", height: 40, borderRadius: 10, border: "none", background: preview._noteSaved ? "#E4EFE5" : CHARCOAL, color: preview._noteSaved ? "#2B7B71" : "#fff", fontSize: 13, fontWeight: 800, cursor: "pointer", fontFamily: "inherit", display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 7, transition: "background 0.15s" }}>
              {preview._noteSaved ? "✓ ההערה נשמרה בבנק" : "שמירת ההערה בבנק"}
            </button>
          )}
          <div style={{ fontSize: 11.5, fontWeight: 800, color: T.ink4, margin: "14px 0 6px" }}>לאיזה יום להוסיף?</div>
          <div style={{ display: "flex", gap: 5, flexWrap: "wrap", marginBottom: 12 }}>
            {days.map((d) => {
              const on = (previewDay ?? activeDay) === d.day;
              return (
                <button key={d.day} onClick={() => setPreviewDay(d.day)}
                  title={d.cityHe || d.city || `יום ${d.day}`}
                  style={{ minWidth: 34, height: 34, borderRadius: 9, cursor: "pointer", border: `1px solid ${on ? CHARCOAL : T.line}`, background: on ? CHARCOAL : "#fff", color: on ? "#fff" : T.ink2, fontFamily: "inherit", fontSize: 13, fontWeight: 800 }}>
                  {d.day}
                </button>
              );
            })}
          </div>
          <button onClick={commitPreview}
            style={{ width: "100%", height: 46, borderRadius: 12, border: "none", background: CHARCOAL, color: "#fff", fontSize: 14.5, fontWeight: 800, cursor: "pointer", fontFamily: "inherit", display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
            ＋ הוספה ליום {previewDay ?? activeDay}
          </button>
          {/* A bank point can be discarded straight from its card (mirrors the
              mobile card's "מחיקה מהבנק"). */}
          {preview._fromInbox && preview.id && (
            <button onClick={() => { removeFromInbox(preview.id); setPreview(null); }}
              style={{ marginTop: 8, width: "100%", height: 42, borderRadius: 12, border: `1px solid ${T.line}`, background: "#fff", color: T.ink3, fontSize: 13.5, fontWeight: 800, cursor: "pointer", fontFamily: "inherit", display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 7 }}>
              <Icon name="trash" size={15} strokeWidth={2} color={T.ink3} /> מחיקה מהבנק
            </button>
          )}
          {!preview._fromInbox && (
            <button onClick={() => { addSearchedToInbox({ ...preview, note: (preview.note || "").trim() || undefined }); setPreview(null); }}
              style={{ marginTop: 8, width: "100%", height: 42, borderRadius: 12, border: `1px solid ${T.line}`, background: "#fff", color: T.ink2, fontSize: 13.5, fontWeight: 800, cursor: "pointer", fontFamily: "inherit", display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 7 }}>
              <Icon name="folder" size={15} strokeWidth={2} color={T.ink2} /> שמירה לבנק הנקודות
            </button>
          )}
          {/* Always offer the real Google Maps listing for the point. */}
          {(preview.coordinates || preview.place_id) && (
            <button onClick={() => openInMaps(preview)}
              style={{ marginTop: 8, width: "100%", height: 40, borderRadius: 12, border: `1px solid ${T.line}`, background: "#fff", color: T.ink2, fontSize: 13, fontWeight: 800, cursor: "pointer", fontFamily: "inherit", display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 7 }}>
              <Icon name="map" size={15} strokeWidth={2} color={T.ink2} /> פתח ב-Google Maps
            </button>
          )}
          {/* "מצא לי X באזור" — search around this point. */}
          {(preview.coordinates || Number.isFinite(preview.lat)) && (
            <button onClick={() => setNearbyOrigin(preview)}
              style={{ marginTop: 8, width: "100%", height: 40, borderRadius: 12, border: `1px solid ${T.line}`, background: "#fff", color: T.ink2, fontSize: 13, fontWeight: 800, cursor: "pointer", fontFamily: "inherit", display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 7 }}>
              <Icon name="search" size={15} strokeWidth={2} color={T.ink2} /> מצא מקומות באזור
            </button>
          )}
        </div>
      </div>
    );
    if (focusStop) return (
      <div dir="rtl" className="tp-frost" style={CARD_SHELL}>
        <div style={{ height: 140, background: `center/cover url(${bestPhoto(focusStop)}), ${T.surface}` }} />
        <div style={{ padding: "14px 16px 16px" }}>
          <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
            <span aria-hidden style={{ flexShrink: 0, width: 34, height: 34, borderRadius: 9, background: T.surface, display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}>{categoryEmoji(focusStop.category)}</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div dir="auto" style={{ fontSize: 16, fontWeight: 800, color: T.ink, lineHeight: 1.25, wordBreak: "break-word" }}>{focusStop.nameHe || focusStop.name}</div>
              <div style={{ fontSize: 12, color: T.ink3, marginTop: 2 }}>{[focusStop.rating ? `★ ${focusStop.rating}` : "", focusStop.category].filter(Boolean).join(" · ")}</div>
            </div>
            <button onClick={() => setFocusStop(null)} title="סגירה" aria-label="סגירה" style={{ flexShrink: 0, width: 28, height: 28, borderRadius: 8, border: "none", background: T.surface, color: T.ink2, cursor: "pointer", fontFamily: "inherit", fontSize: 14, fontWeight: 800 }}>✕</button>
          </div>
          {(focusStop.address || focusStop.formatted_address) && (
            <div dir="auto" style={{ fontSize: 12, color: T.ink3, marginTop: 8, lineHeight: 1.45 }}>{focusStop.address || focusStop.formatted_address}</div>
          )}
          {focusStop.note && (
            <div dir="auto" style={{ fontSize: 12.5, color: "#4A4A55", background: T.surface, borderRadius: 8, padding: "8px 10px", marginTop: 10, lineHeight: 1.45, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>{focusStop.note}</div>
          )}
          {focusStop.coordinates && (
            <button onClick={() => openInMaps(focusStop)}
              style={{ marginTop: 12, width: "100%", height: 44, borderRadius: 12, border: "none", background: CHARCOAL, color: "#fff", fontSize: 14, fontWeight: 800, cursor: "pointer", fontFamily: "inherit", display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 7 }}>
              <Icon name="map" size={16} strokeWidth={2} color="#fff" /> פתח ב-Google Maps
            </button>
          )}
          {/* "מצא לי X באזור" — search around this stop. */}
          {focusStop.coordinates && (
            <button onClick={() => setNearbyOrigin(focusStop)}
              style={{ marginTop: 8, width: "100%", height: 42, borderRadius: 12, border: `1px solid ${T.line}`, background: "#fff", color: T.ink2, fontSize: 13.5, fontWeight: 800, cursor: "pointer", fontFamily: "inherit", display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 7 }}>
              <Icon name="search" size={15} strokeWidth={2} color={T.ink2} /> מצא מקומות באזור
            </button>
          )}
        </div>
      </div>
    );
    return null;
  };

  if (error) {
    return (
      <Shell>
        <div style={{ margin: "auto", textAlign: "center", color: T.ink3, fontFamily: T.font }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>🗺️</div>
          <div style={{ fontSize: 15, fontWeight: 700 }}>לא ניתן לטעון את הטיול</div>
          <button onClick={() => navigate("/dashboard")}
            style={{ marginTop: 16, height: 42, padding: "0 18px", borderRadius: 10, border: "none", background: CHARCOAL, color: "#fff", fontSize: 14, fontWeight: 800, cursor: "pointer", fontFamily: T.font }}>
            חזרה ללוח
          </button>
        </div>
      </Shell>
    );
  }

  if (!trip) {
    return (
      <Shell>
        <div style={{ margin: "auto", color: T.ink3, fontSize: 14, fontFamily: T.font }}>טוען את הטיול…</div>
      </Shell>
    );
  }

  const dest = trip.settings?.destinationHe || trip.settings?.destination || "";

  // ── Apple-grade spring motion (desktop cockpit only; mobile never mounts
  //    this file). Interruptible springs, origin-anchored, honoring the
  //    viewer's reduced-motion preference (reduceMotion resolved above). ──
  const SPRING = { type: "spring", stiffness: 460, damping: 36, mass: 0.9 };
  const SPRING_SOFT = { type: "spring", stiffness: 380, damping: 34, mass: 1 };
  // Popovers / modals — pop from center.
  const popMotion = reduceMotion ? {} : {
    initial: { opacity: 0, scale: 0.92, y: -6 },
    animate: { opacity: 1, scale: 1, y: 0 },
    exit: { opacity: 0, scale: 0.95, y: -4 },
    transition: SPRING,
  };
  const scrimMotion = reduceMotion ? {} : {
    initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 },
    transition: { duration: 0.16 },
  };
  // Side drawer — anchored on the RTL inline-start (right) edge, so it
  // slides in from off-screen right (positive x) and back out the same way.
  const drawerMotion = reduceMotion ? {} : {
    initial: { x: "100%" }, animate: { x: 0 }, exit: { x: "100%" },
    transition: SPRING_SOFT,
  };

  return (
    <Shell>
      {/* ── Top bar ─────────────────────────────────────────────── */}
      <header className="tp-frost" style={{
        flexShrink: 0, height: 56, display: "flex", alignItems: "center", gap: 12,
        padding: "0 16px", background: "rgba(255,255,255,0.72)", backdropFilter: "blur(20px) saturate(180%)", WebkitBackdropFilter: "blur(20px) saturate(180%)",
        borderBottom: `1px solid rgba(255,255,255,0.5)`, boxShadow: `0 1px 0 ${T.line}`,
        fontFamily: T.font,
        /* Lift the whole top bar (and thus the search-results dropdown that
           floats out of it) above the grid/panel below, so results never
           render behind the day pills or stop cards. */
        position: "relative", zIndex: 60,
      }}>
        <button onClick={() => navigate("/dashboard")} title="חזרה ללוח" aria-label="חזרה ללוח"
          style={{ flexShrink: 0, width: 40, height: 40, borderRadius: 8, border: "none", background: CHARCOAL, color: "#fff", cursor: "pointer", display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
          <Icon name="home" size={18} strokeWidth={2} color="#fff" />
        </button>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 16, fontWeight: 800, letterSpacing: "-0.01em", color: T.ink, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{trip.title}</div>
          <div style={{ fontSize: 12, color: T.ink3, marginTop: 1 }}>{dest ? `${dest} · ` : ""}{days.length} ימים{attachBusy ? " · מעלה קובץ…" : editor.saving ? " · נשמר…" : ""}</div>
        </div>
        {/* Add-a-place search — the core planning action. A pick commits the
            stop straight into the active day (onAddStop, no preview flow). */}
        {editable ? (
          <div style={{ flex: 1, minWidth: 0, maxWidth: 520, margin: "0 8px" }}>
            <EditorSearchBar
              activeDay={activeDay}
              floatResults
              onPreview={openPreview}
              onResults={setSearchResults}
              getBias={() => viewportRef.current || boundsForDestination(trip?.settings?.destination || trip?.settings?.destinationHe || "") || null}
            />
          </div>
        ) : (
          /* Read-only (shared "view" collaborator): no add-search bar — surface a
             clear "view only" banner in its place, mirroring the mobile editor. */
          <div style={{ flex: 1, minWidth: 0, display: "flex", justifyContent: "center", alignItems: "center", gap: 8, margin: "0 8px" }}>
            <div style={{ maxWidth: 360, height: 40, background: T.surface, borderRadius: 999, padding: "0 16px", display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 7, fontSize: 13, fontWeight: 700, color: T.ink2 }}>
              <Icon name="eye" size={15} strokeWidth={1.9} color={T.ink3} />
              <span dir="auto" style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                צפייה בלבד{trip?.sharedBy ? ` · שותף ע״י ${trip.sharedBy}` : ""}
              </span>
            </div>
            {isPublicView && (
              <FavoriteButton tripId={tripId} favorited={isFav} onChange={setIsFav} returnTo={`/map/edit/${tripId}`} size={20} />
            )}
          </div>
        )}
        {editable && (
          <button onClick={() => (inboxOpen ? setInboxOpen(false) : openInbox())}
            title="בנק נקודות שמורות" aria-label="בנק נקודות"
            style={{
              flexShrink: 0, height: 40, display: "inline-flex", alignItems: "center", gap: 7, padding: "0 13px",
              borderRadius: 10, cursor: "pointer", fontFamily: "inherit", fontSize: 13, fontWeight: 800,
              /* Accent "has content" state once the bank holds saved points, so
                 the first save is visible on the button itself (not only a badge). */
              border: `1px solid ${inboxOpen ? CHARCOAL : (bankCount > 0 ? ACCENT : T.line)}`,
              background: inboxOpen ? CHARCOAL : (bankCount > 0 ? "#E0533F14" : "#fff"),
              color: inboxOpen ? "#fff" : (bankCount > 0 ? ACCENT : T.ink2),
            }}>
            <Icon name="folder" size={16} strokeWidth={2} color={inboxOpen ? "#fff" : (bankCount > 0 ? ACCENT : T.ink2)} />
            <span>בנק נקודות</span>
            {bankCount > 0 && (
              <span style={{ minWidth: 18, height: 18, borderRadius: 999, padding: "0 5px", background: inboxOpen ? "#fff" : ACCENT, color: inboxOpen ? CHARCOAL : "#fff", fontSize: 11, fontWeight: 800, display: "inline-flex", alignItems: "center", justifyContent: "center" }}>{bankCount}</span>
            )}
          </button>
        )}
        {editable && (
          <button onClick={() => setRefMapsOpen((o) => !o)}
            title="טעינת מפה נוספת והעברת נקודות" aria-label="מפות נוספות"
            style={{
              flexShrink: 0, height: 40, display: "inline-flex", alignItems: "center", gap: 7, padding: "0 13px",
              borderRadius: 10, border: `1px solid ${refMapsOpen ? "#0C8B94" : T.line}`, cursor: "pointer", fontFamily: "inherit",
              background: refMapsOpen ? "#0C8B94" : "#fff", color: refMapsOpen ? "#fff" : T.ink2, fontSize: 13, fontWeight: 800,
            }}>
            <Icon name="layers" size={15} strokeWidth={2} />
            <span>מפות נוספות</span>
          </button>
        )}
      </header>

      {/* ── Workspace: itinerary (right) + map (left) ──────────────── */}
      <div dir="rtl" style={{ flex: 1, minHeight: 0, display: "grid", gridTemplateColumns: `${PANEL_WIDTH}px 1fr`, gridTemplateRows: "minmax(0, 1fr)" }}>
        {/* Itinerary panel — minHeight/overflow:hidden so its inner list is the
            scroller (esp. whole-trip mode with many rows), not the whole panel. */}
        <aside style={{ minWidth: 0, minHeight: 0, overflow: "hidden", display: "flex", flexDirection: "column", background: "#fff", borderInlineStart: `1px solid ${T.line}`, fontFamily: T.font }}>
          {/* Day rail */}
          <div style={{ flexShrink: 0, display: "flex", gap: 6, overflowX: "auto", padding: "12px 14px", borderBottom: `1px solid ${T.line}` }} className="tp-noscrollbar">
            {days.map((d) => {
              const on = d.day === activeDay;
              const col = cityColor(d.city || d.cityHe || "");
              return (
                <div key={d.day} style={{ position: "relative", flexShrink: 0 }}
                  onMouseEnter={() => setHoverDay(d.day)} onMouseLeave={() => setHoverDay(null)}>
                  <button onClick={() => { setShowAllOnMap(false); setActiveDay(d.day); }}
                    onContextMenu={editable && days.length > 1 ? (e) => { e.preventDefault(); setConfirmDelDay(d.day); } : undefined}
                    title={editable ? "לחיצה — מעבר ליום · קליק ימני — מחיקה" : (d.cityHe || d.city || `יום ${d.day}`)}
                    style={{
                      flexShrink: 0, minWidth: 44, height: 44, borderRadius: 10, cursor: "pointer",
                      border: "none", fontFamily: "inherit",
                      background: on ? CHARCOAL : T.surface, color: on ? "#fff" : T.ink2,
                      display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 1,
                      transition: "background 0.15s, color 0.15s",
                    }}>
                    <span style={{ fontSize: 15, fontWeight: 800 }}>{d.day}</span>
                    <span style={{ width: 5, height: 5, borderRadius: "50%", background: on ? "#fff" : col }} />
                  </button>
                  {/* Hover-reveal delete badge — a discoverable alternative to the
                      right-click. Never on the last remaining day. */}
                  {editable && days.length > 1 && hoverDay === d.day && (
                    <button onClick={(e) => { e.stopPropagation(); setConfirmDelDay(d.day); }}
                      title={`מחיקת יום ${d.day}`} aria-label={`מחיקת יום ${d.day}`}
                      style={{ position: "absolute", top: -6, insetInlineStart: -6, width: 18, height: 18, borderRadius: "50%", border: "1.5px solid #fff", background: "#C0392B", color: "#fff", cursor: "pointer", fontFamily: "inherit", fontSize: 11, fontWeight: 800, lineHeight: 1, display: "inline-flex", alignItems: "center", justifyContent: "center", padding: 0, boxShadow: "0 1px 4px rgba(0,0,0,0.25)" }}>
                      ×
                    </button>
                  )}
                </div>
              );
            })}
            {/* Add a new day on the fly — persists to the skeleton immediately. */}
            {editable && (
              <button onClick={addDay} title="הוספת יום" aria-label="הוספת יום"
                style={{ flexShrink: 0, minWidth: 44, height: 44, borderRadius: 10, cursor: "pointer", border: `1.5px dashed ${T.ink4}`, background: "#fff", color: T.ink3, fontFamily: "inherit", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 20, fontWeight: 700 }}>
                ＋
              </button>
            )}
            {editable && (
              /* Skeleton editing — start/end dates ⇒ day count (the desktop
                 equivalent of the mobile dates modal). */
              <button onClick={openDatesModal} title="עריכת תאריכים ושלד המסלול" aria-label="עריכת תאריכים"
                style={{ flexShrink: 0, minWidth: 44, height: 44, borderRadius: 10, cursor: "pointer", border: `1px solid ${T.line}`, background: "#fff", color: T.ink2, fontFamily: "inherit", display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
                <Icon name="calendar" size={18} strokeWidth={2} color={T.ink2} />
              </button>
            )}
          </div>

          {/* Active-day header (hidden in whole-trip mode) */}
          {!showAllOnMap && activeDayData && (
            <div style={{ flexShrink: 0, display: "flex", alignItems: "center", gap: 8, padding: "12px 16px 8px" }}>
              <span style={{ fontSize: 17, fontWeight: 800, letterSpacing: "-0.012em", color: cityColor(activeDayData.city || ""), whiteSpace: "nowrap" }}>
                {activeDayData.cityHe || activeDayData.city || `יום ${activeDayData.day}`}
              </span>
              <span style={{ fontSize: 12.5, color: T.ink4 }}>·</span>
              <span style={{ fontSize: 13, fontWeight: 700, color: T.ink3 }}>יום {activeDayData.day}</span>
              {trip?.settings?.startDate && (
                <>
                  <span style={{ fontSize: 12.5, color: T.ink4 }}>·</span>
                  <span style={{ fontSize: 13, fontWeight: 700, color: T.ink3, whiteSpace: "nowrap" }}>{fullDateLabel(trip.settings.startDate, activeDayData.day)}</span>
                </>
              )}
              <div style={{ flex: 1 }} />
              {editable && (
                <button onClick={() => setTransitEdit({ idx: -1, initial: null })} title="הוספת טיסה או מעבר"
                  style={{ display: "inline-flex", alignItems: "center", gap: 5, height: 28, padding: "0 10px", borderRadius: 999, border: `1px solid ${T.line}`, background: "#fff", color: T.ink2, cursor: "pointer", fontFamily: "inherit", fontSize: 12, fontWeight: 800 }}>
                  <Icon name="plane" size={13} strokeWidth={2} color="#FF6B6B" /> מעבר
                </button>
              )}
              <span style={{ fontSize: 12, fontWeight: 700, color: T.ink4, marginInlineStart: 8 }}>{rows.length} תחנות</span>
            </div>
          )}
          {showAllOnMap && (
            <div style={{ flexShrink: 0, display: "flex", alignItems: "baseline", gap: 8, padding: "12px 16px 8px" }}>
              <span style={{ fontSize: 16, fontWeight: 800, letterSpacing: "-0.012em", color: T.ink }}>כל המסלול ברצף</span>
              <span style={{ fontSize: 12, fontWeight: 700, color: T.ink4 }}>{days.length} ימים · {allMapStops.length} תחנות</span>
            </div>
          )}

          {/* Whole-trip sequence — every day, grouped, clickable to fly + focus. */}
          {showAllOnMap ? (
            <div style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: "4px 12px 20px" }}>
              {wholeTrip.map(({ day: d, items }) => {
                const dc = cityColor(d.city || "");
                return (
                <div key={d.day} style={{ marginBottom: 14, borderRadius: 14, border: `1px solid ${T.line}`, background: "#fff", overflow: "hidden", boxShadow: "0 1px 3px rgba(16,20,24,0.05)" }}>
                  {/* Day header bar — city-tinted, clearly separates each day. */}
                  <button onClick={() => { setShowAllOnMap(false); setActiveDay(d.day); }}
                    className="tp-desk-row"
                    style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", textAlign: "start", border: "none", borderInlineStart: `3px solid ${dc}`, background: hexTint(dc, 0.08), cursor: "pointer", fontFamily: "inherit", padding: "9px 12px" }}>
                    <span style={{ flexShrink: 0, width: 24, height: 24, borderRadius: 7, background: dc, color: "#fff", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 800 }}>{d.day}</span>
                    <span style={{ fontSize: 14, fontWeight: 800, color: T.ink }}>{d.cityHe || d.city || `יום ${d.day}`}</span>
                    <span style={{ marginInlineStart: "auto", fontSize: 11, fontWeight: 700, color: T.ink4 }}>{(items.filter((it) => it.kind === "stop")).length} תחנות</span>
                  </button>
                  <div style={{ padding: "8px 10px 10px" }}>
                  {items.length === 0 ? (
                    <div style={{ fontSize: 11.5, color: T.ink4, padding: "2px 6px" }}>— אין תחנות —</div>
                  ) : items.map((it) => it.kind === "transit" ? (
                    <div key={`t-${it.idx}`} style={{ display: "flex", alignItems: "center", gap: 8, padding: "7px 10px", marginBottom: 5, borderRadius: 10, border: "1px dashed #FF6B6B", background: "rgba(255,107,107,0.05)", fontSize: 12, fontWeight: 700, color: "#C0392B" }}>
                      <Icon name="plane" size={12} strokeWidth={2} color="#FF6B6B" />{[it.a.from, it.a.to].filter(Boolean).join(" ← ") || (it.a.nameHe || it.a.name)}
                    </div>
                  ) : (
                    <div key={`s-${it.idx}`}
                      onClick={() => focusOnStop(it.a)}
                      className="tp-desk-row"
                      style={{ display: "flex", alignItems: "flex-start", gap: 9, padding: "8px 10px", marginBottom: 5, borderRadius: 10, border: `1px solid ${T.line}`, background: "#fff", cursor: "pointer" }}>
                      <span style={{ flexShrink: 0, width: 24, height: 24, borderRadius: 7, background: CHARCOAL, color: "#fff", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 11.5, fontWeight: 800, marginTop: 1 }}>{it.n}</span>
                      <img src={bestPhoto(it.a)} alt="" loading="lazy" onError={onPhotoErrorStrict()} style={{ flexShrink: 0, width: 34, height: 34, borderRadius: 7, objectFit: "cover", background: T.surface }} />
                      <span style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 2 }}>
                        <span dir="auto" style={{ fontSize: 13, fontWeight: 700, color: T.ink, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{it.a.nameHe || it.a.name}</span>
                        {it.a.note ? (
                          <span dir="auto" style={{ fontSize: 11.5, color: T.ink3, background: T.surface, borderRadius: 6, padding: "3px 7px", whiteSpace: "pre-wrap", wordBreak: "break-word", lineHeight: 1.45 }}>{it.a.note}</span>
                        ) : null}
                      </span>
                    </div>
                  ))}
                  </div>
                </div>
              );})}
            </div>
          ) : (
          /* Stop list */
          <div style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: "4px 12px 20px" }}>
            {timeline.length === 0 ? (
              <div style={{ textAlign: "center", color: T.ink3, fontSize: 13, padding: "36px 16px", lineHeight: 1.7 }}>
                <div aria-hidden style={{ fontSize: 30, marginBottom: 8 }}>🗺️</div>
                <div style={{ fontSize: 13.5, fontWeight: 800, color: T.ink2, marginBottom: 4 }}>היום הזה עדיין ריק</div>
                {editable
                  ? <>חפשו מקום בשורת החיפוש למעלה,<br />או פתחו את <b style={{ color: T.ink2 }}>בנק הנקודות</b> וגררו נקודה שמורה.</>
                  : <>אין תחנות מתוכננות ליום זה.</>}
              </div>
            ) : (
            <Reorder.Group axis="y" values={timeline.map((t) => t.a)} onReorder={(next) => setDragOrder(next)} as="div" style={{ listStyle: "none", margin: 0, padding: 0 }}>
            {timeline.map((item, i) => {
              if (item.kind === "transit") {
                const t = item.a;
                const route = [t.from, t.to].filter(Boolean).join(" ← ");
                const times = [t.departTime, t.arriveTime].filter(Boolean).join(" – ");
                return (
                  <Reorder.Item key={rowKey(item.a)} value={item.a} as="div"
                    dragListener={editable}
                    onDragStart={() => setDraggingKey(rowKey(item.a))}
                    onDragEnd={commitDrag}
                    whileDrag={reduceMotion ? undefined : { scale: 1.025, boxShadow: "0 14px 34px rgba(0,0,0,0.22)" }}
                    onClick={() => { if (editable) setTransitEdit({ idx: item.idx, initial: t }); }}
                    className="tp-desk-row"
                    style={{ position: "relative", display: "flex", alignItems: "center", gap: 10, padding: "9px 34px 9px 12px", marginBottom: 6, borderRadius: 12, border: "1px dashed #FF6B6B", background: "rgba(255,107,107,0.05)", cursor: editable ? "grab" : "default", fontFamily: "inherit", zIndex: draggingKey === rowKey(item.a) ? 40 : undefined }}>
                    <span aria-hidden style={{ flexShrink: 0, width: 30, height: 30, borderRadius: 8, background: "rgba(255,107,107,0.14)", display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
                      <Icon name="plane" size={15} strokeWidth={2} color="#FF6B6B" />
                    </span>
                    <span style={{ flex: 1, minWidth: 0 }}>
                      <span dir="auto" style={{ display: "block", fontSize: 13, fontWeight: 800, color: "#C0392B", lineHeight: 1.3, wordBreak: "break-word" }}>{route || t.nameHe || t.name || "מעבר"}</span>
                      {times && <span style={{ display: "block", fontSize: 11, color: T.ink3, marginTop: 2 }}>{times}{t.refId ? ` · ${t.refId}` : ""}</span>}
                    </span>
                    {editable && (
                      <button className="tp-row-more" onClick={(e) => { e.stopPropagation(); deleteStopAt(activeDay, item.idx); }}
                        title="מחיקת מעבר" aria-label="מחיקת מעבר"
                        style={{ position: "absolute", insetInlineStart: 6, top: 8, width: 26, height: 26, borderRadius: 7, border: "none", background: "rgba(255,107,107,0.14)", color: "#C0392B", cursor: "pointer", display: "inline-flex", alignItems: "center", justifyContent: "center", fontFamily: "inherit", fontSize: 13 }}>🗑</button>
                    )}
                  </Reorder.Item>
                );
              }
              if (item.kind === "note") {
                const nt = item.a;
                return (
                  <Reorder.Item key={rowKey(item.a)} value={item.a} dragListener={false} as="div"
                    onClick={() => { if (editable) setNoteEdit({ idx: item.idx, draft: nt.note || "", kind: "editNode" }); }}
                    className="tp-desk-row"
                    style={{ position: "relative", display: "flex", alignItems: "flex-start", gap: 9, padding: "9px 34px 9px 12px", marginBottom: 6, borderRadius: 12, border: `1px solid ${T.line}`, background: "#FFFBEB", cursor: editable ? "pointer" : "default", fontFamily: "inherit" }}>
                    <span aria-hidden style={{ flexShrink: 0, fontSize: 15, marginTop: 1 }}>📝</span>
                    <span dir="auto" style={{ flex: 1, minWidth: 0, fontSize: 12.5, color: "#5A4A15", lineHeight: 1.5, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>{nt.note}</span>
                    {editable && (
                      <button className="tp-row-more" onClick={(e) => { e.stopPropagation(); deleteStopAt(activeDay, item.idx); }}
                        title="מחיקת הערה" aria-label="מחיקת הערה"
                        style={{ position: "absolute", insetInlineStart: 6, top: 8, width: 26, height: 26, borderRadius: 7, border: "none", background: T.surface, color: T.ink3, cursor: "pointer", display: "inline-flex", alignItems: "center", justifyContent: "center", fontFamily: "inherit", fontSize: 13 }}>🗑</button>
                    )}
                  </Reorder.Item>
                );
              }
              const { a, idx, n } = item;
              const hasCoord = a.coordinates && Number.isFinite(a.coordinates.lat) && Number.isFinite(a.coordinates.lng);
              const photo = bestPhoto(a); // fresh real photo → stored → category fallback
              /* Estimated leg from the previous located stop (rough, no routing API). */
              let prevStop = null;
              for (let j = i - 1; j >= 0; j--) {
                const p = timeline[j];
                if (p.kind === "stop" && p.a.coordinates && Number.isFinite(p.a.coordinates.lat)) { prevStop = p.a; break; }
              }
              const leg = hasCoord && prevStop ? legEstimate(prevStop.coordinates, a.coordinates, distUnits) : null;
              return (
                <Reorder.Item key={rowKey(a)} value={a} as="div"
                  dragListener={editable}
                  onDragStart={() => setDraggingKey(rowKey(a))}
                  onDragEnd={commitDrag}
                  whileDrag={reduceMotion ? undefined : { scale: 1.025, boxShadow: "0 14px 34px rgba(0,0,0,0.22)" }}
                  role="button" tabIndex={0}
                  onClick={() => focusOnStop(a)}
                  onContextMenu={(e) => openCtx(e, idx, a)}
                  className="tp-desk-row"
                  style={{
                    position: "relative",
                    display: "flex", alignItems: "flex-start", gap: 10, width: "100%", textAlign: "start",
                    padding: "10px 34px 10px 10px", marginBottom: 6, borderRadius: 12, border: `1px solid ${T.line}`,
                    background: "#fff", cursor: hasCoord ? "pointer" : "default", fontFamily: "inherit",
                    zIndex: draggingKey === rowKey(a) ? 40 : undefined,
                  }}>
                  <span aria-hidden style={{ flexShrink: 0, width: 26, height: 26, borderRadius: 8, background: CHARCOAL, color: "#fff", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 12.5, fontWeight: 800, marginTop: 1 }}>{n}</span>
                  <img src={photo} alt="" loading="lazy" draggable={false} onError={onPhotoErrorStrict()}
                    style={{ flexShrink: 0, width: 44, height: 44, borderRadius: 8, objectFit: "cover", background: T.surface }} />
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <span dir="auto" style={{ display: "block", fontSize: 14, fontWeight: 800, color: T.ink, lineHeight: 1.3, wordBreak: "break-word" }}>{a.nameHe || a.name}</span>
                    <span style={{ display: "block", fontSize: 11.5, color: T.ink3, marginTop: 2 }}>
                      {[a.rating ? `★ ${a.rating}` : "", a.category].filter(Boolean).join(" · ")}
                    </span>
                    {leg && (
                      <span dir="rtl" title="הערכה על בסיס מרחק אווירי" style={{ display: "inline-flex", alignItems: "center", gap: 4, marginTop: 5, fontSize: 11, fontWeight: 700, color: T.ink3, background: T.surface, borderRadius: 999, padding: "3px 9px" }}>
                        {leg.label} <span style={{ color: T.ink4, fontWeight: 600 }}>· מהקודמת</span>
                      </span>
                    )}
                    {a.note && (
                      <span dir="auto" style={{ display: "block", fontSize: 11.5, color: "#4A4A55", background: T.surface, borderRadius: 6, padding: "5px 7px", marginTop: 5, lineHeight: 1.4, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>{a.note}</span>
                    )}
                    {Array.isArray(a.attachments) && a.attachments.length > 0 && (
                      <span style={{ display: "flex", flexWrap: "wrap", gap: 5, marginTop: 6 }}>
                        {a.attachments.map((f, fi) => (
                          <span key={fi} style={{ display: "inline-flex", alignItems: "center", gap: 4, maxWidth: "100%", background: T.surface, border: `1px solid ${T.line}`, borderRadius: 999, padding: "3px 4px 3px 9px", fontSize: 11 }}>
                            <button onClick={(e) => { e.stopPropagation(); const u = f.url || ""; if (/^(https?:|blob:)/.test(u)) window.open(u, "_blank", "noopener,noreferrer"); }}
                              title={f.name} style={{ maxWidth: 150, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", border: "none", background: "transparent", color: T.ink2, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", padding: 0 }}>📎 {f.name}</button>
                            {editable && (
                              <button onClick={(e) => { e.stopPropagation(); removeAttachmentAt(activeDay, idx, fi); }}
                                title="הסרת קובץ" aria-label="הסרת קובץ" style={{ flexShrink: 0, width: 16, height: 16, borderRadius: "50%", border: "none", background: "transparent", color: T.ink4, cursor: "pointer", fontFamily: "inherit", fontSize: 12, lineHeight: 1 }}>×</button>
                            )}
                          </span>
                        ))}
                      </span>
                    )}
                  </span>
                  {/* Hover ⋯ — the mouse-visible entry to the same context menu. */}
                  {editable && (
                    <button className="tp-row-more" onClick={(e) => openCtx(e, idx, a)}
                      title="פעולות" aria-label="פעולות"
                      style={{ position: "absolute", insetInlineStart: 6, top: 8, width: 26, height: 26, borderRadius: 7, border: "none", background: T.surface, color: T.ink2, cursor: "pointer", display: "inline-flex", alignItems: "center", justifyContent: "center", fontFamily: "inherit" }}>
                      <Icon name="more" size={15} strokeWidth={1.9} />
                    </button>
                  )}
                  {/* Hover grip — signals the row is draggable to reorder. */}
                  {editable && (
                    <span className="tp-row-grip" aria-hidden title="גרור לשינוי סדר"
                      style={{ position: "absolute", insetInlineEnd: 8, bottom: 8, color: T.ink4, cursor: "grab", display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
                      <Icon name="arrowUpDown" size={14} strokeWidth={1.9} />
                    </span>
                  )}
                  {/* Inline "+" between stops — insert a transit/note right after this row. */}
                  {editable && (
                    <button className="tp-row-plus" onClick={(e) => { e.stopPropagation(); setInsertMenu({ idx: idx + 1 }); }}
                      title="הוספת מעבר או הערה כאן" aria-label="הוספת מעבר או הערה"
                      style={{ position: "absolute", left: "50%", transform: "translateX(-50%)", bottom: -11, width: 22, height: 22, borderRadius: "50%", border: "2px solid #fff", background: "#FF6B6B", color: "#fff", cursor: "pointer", display: "inline-flex", alignItems: "center", justifyContent: "center", fontFamily: "inherit", fontSize: 14, fontWeight: 700, lineHeight: 1, zIndex: 3, opacity: 0, transition: "opacity 0.12s" }}>＋</button>
                  )}
                </Reorder.Item>
              );
            })}
            </Reorder.Group>
            )}
            {editable && timeline.length > 0 && (
              <button onClick={() => setInsertMenu({ idx: (activeDayData?.attractions?.length || 0) })}
                style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6, width: "100%", height: 34, marginTop: 2, borderRadius: 10, border: `1.5px dashed ${T.line}`, background: "#fff", color: T.ink3, cursor: "pointer", fontFamily: "inherit", fontSize: 12.5, fontWeight: 800 }}>
                ＋ הוספת מעבר או הערה
              </button>
            )}
          </div>
          )}
        </aside>

        {/* Map pane */}
        <div style={{ position: "relative", minWidth: 0 }}>
          <EditorMap
            stops={mapPaneStops}
            color={mapPaneColor}
            center={trip.center || trip.settings?.center || null}
            flyToCoord={flyToCoord}
            onViewportChange={(b) => { viewportRef.current = b; }}
            searchResults={searchResults}
            searchOrigin={searchOrigin}
            onSearchResultClick={async (p) => { const d = await getDetails(p.placeId); if (d) openPreview(d); /* keep the other result pins so several can be reviewed/added */ }}
            cropOnClick={true}
            holdView={!!preview || !!focusStop || inboxOpen || refMapsOpen}
            /* "מפות נוספות" — the loaded reference map drawn as a teal overlay. */
            overlayPlaces={refMapsOpen ? (overlayMap?.points || []) : []}
            overlayColor={overlayMap?.color || "#0C8B94"}
            overlaySelected={overlaySel}
            onOverlaySelect={setOverlaySel}
            overlayActiveDay={activeDay}
            onOverlayAddDay={(p, day) => { addOverlayPoints([p], day); setOverlaySel(null); }}
            onOverlayAddBank={(p) => { addOverlayPoints([p], "bank"); setOverlaySel(null); }}
            /* Clicking a map pin opens the SAME single cockpit card as clicking
               a list row — never EditorMap's own internal sheet (suppressed on
               desktop by cropOnClick), so only ONE card is ever open. */
            onMarkerClick={(s) => focusOnStop(s)}
            /* The single info card, anchored to its point via a maplibre Popup. */
            cardCoord={cardCoord}
            renderCard={renderAnchoredCard}
            routePath={mapPaneRoute}
            fitPadding={{ top: 70, bottom: 70, left: 70, right: 70 }}
            days={editable ? days : []}
            onSaveCustomPin={editable ? saveCustomPin : undefined}
            previewPin={preview && preview.coordinates ? { lat: preview.coordinates.lat, lng: preview.coordinates.lng } : null}
            savedPlaces={showAllSaved && Array.isArray(inbox) ? inbox : []}
            savedLabels={showAllSaved}
            onSavedClick={(p) => openSavedPoint(p)}
          />

          {/* 👁️ eye toggle — show/hide all saved bank points on the map */}
          <button onClick={toggleAllSaved}
            title={showAllSaved ? "הסתרת הנקודות השמורות מהמפה" : "הצגת בנק הנקודות על המפה"}
            aria-label="הצגת נקודות שמורות על המפה" aria-pressed={showAllSaved}
            className="tp-frost"
            style={{ position: "absolute", top: 16, insetInlineStart: 16, zIndex: 15, width: 42, height: 42, borderRadius: 12, cursor: "pointer", fontFamily: "inherit", display: "inline-flex", alignItems: "center", justifyContent: "center", border: `1px solid rgba(255,255,255,0.6)`, boxShadow: "0 4px 18px rgba(0,0,0,0.16)", background: showAllSaved ? CHARCOAL : "rgba(255,255,255,0.82)", backdropFilter: "blur(18px) saturate(180%)", WebkitBackdropFilter: "blur(18px) saturate(180%)" }}>
            <Icon name="eye" size={19} strokeWidth={1.9} color={showAllSaved ? "#fff" : T.ink} />
          </button>

          {/* "מצא לי X באזור" — clear-results chip; result pins persist until this
              (or a new search) so several can be reviewed/added. */}
          {searchResults.length > 0 && (
            <button onClick={() => { setSearchResults([]); setSearchOrigin(null); }} className="tp-press"
              style={{ position: "absolute", top: 16, insetInlineStart: 66, zIndex: 16, height: 42, padding: "0 16px", borderRadius: 999, border: "none", background: CHARCOAL, color: "#fff", fontSize: 13, fontWeight: 800, cursor: "pointer", fontFamily: "inherit", display: "inline-flex", alignItems: "center", gap: 7, boxShadow: "0 4px 18px rgba(0,0,0,0.2)" }}>
              ✕ נקה תוצאות ({searchResults.length})
            </button>
          )}

          {/* Active-day ⇄ whole-trip map toggle (a desktop-only overview). */}
          <div className="tp-frost" style={{ position: "absolute", top: 12, left: "50%", transform: "translateX(-50%)", zIndex: 15, display: "inline-flex", background: "rgba(255,255,255,0.8)", backdropFilter: "blur(18px) saturate(180%)", WebkitBackdropFilter: "blur(18px) saturate(180%)", borderRadius: 999, border: `1px solid rgba(255,255,255,0.6)`, boxShadow: "0 4px 18px rgba(0,0,0,0.14)", padding: 3, fontFamily: T.font }}>
            {[
              { on: !showAllOnMap, label: "היום הפעיל", set: () => setShowAllOnMap(false) },
              { on: showAllOnMap, label: "כל הטיול", set: () => setShowAllOnMap(true) },
            ].map((seg) => (
              <button key={seg.label} onClick={seg.set}
                style={{ height: 30, padding: "0 14px", borderRadius: 999, border: "none", cursor: "pointer", fontFamily: "inherit", fontSize: 12.5, fontWeight: 800, background: seg.on ? CHARCOAL : "transparent", color: seg.on ? "#fff" : T.ink3, transition: "background 0.15s, color 0.15s" }}>
                {seg.label}
              </button>
            ))}
          </div>

          {/* Empty hint — the map has no pins to show, so a soft centered card
              explains how to fill it instead of a blank expanse. */}
          {mapPaneStops.length === 0 && (
            <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", pointerEvents: "none", zIndex: 10 }}>
              <div dir="rtl" className="tp-frost" style={{ pointerEvents: "none", maxWidth: 320, textAlign: "center", background: "rgba(255,255,255,0.82)", backdropFilter: "blur(20px) saturate(180%)", WebkitBackdropFilter: "blur(20px) saturate(180%)", borderRadius: 16, border: `1px solid rgba(255,255,255,0.55)`, boxShadow: "0 10px 34px rgba(0,0,0,0.14)", padding: "20px 22px", fontFamily: T.font }}>
                <div aria-hidden style={{ fontSize: 32, marginBottom: 8 }}>📍</div>
                <div style={{ fontSize: 14.5, fontWeight: 800, color: T.ink, marginBottom: 5 }}>אין עדיין נקודות על המפה</div>
                <div style={{ fontSize: 12.5, color: T.ink3, lineHeight: 1.6 }}>
                  {editable
                    ? "הוסיפו תחנות דרך החיפוש למעלה או מבנק הנקודות — הן יופיעו כאן על המפה."
                    : "ליום זה אין תחנות עם מיקום להצגה."}
                </div>
              </div>
            </div>
          )}

          {/* The search-PREVIEW and focused-stop cards are no longer floated in
              this corner — they render as a maplibre Popup anchored to their
              point (renderAnchoredCard, passed to EditorMap above). */}

          {/* ── Places-Inbox drawer (saved points → drop into the active day) ── */}
          <AnimatePresence>
          {inboxOpen && (
            <motion.aside key="inbox-drawer" {...drawerMotion} dir="rtl" className="tp-frost" style={{
              position: "absolute", insetInlineStart: 0, top: 0, bottom: 0, width: 320, zIndex: 20,
              background: "rgba(255,255,255,0.82)", backdropFilter: "blur(24px) saturate(180%)", WebkitBackdropFilter: "blur(24px) saturate(180%)",
              borderInlineEnd: `1px solid rgba(255,255,255,0.5)`, boxShadow: "8px 0 40px rgba(0,0,0,0.14)",
              display: "flex", flexDirection: "column", fontFamily: T.font,
            }}>
              <div style={{ flexShrink: 0, display: "flex", alignItems: "center", gap: 8, padding: "13px 14px", borderBottom: `1px solid ${T.line}` }}>
                <Icon name="folder" size={17} strokeWidth={2} color={T.ink2} />
                <span style={{ fontSize: 14.5, fontWeight: 800, color: T.ink }}>בנק נקודות</span>
                {Array.isArray(inbox) && inbox.length > 0 && (
                  <span style={{ fontSize: 12, fontWeight: 700, color: T.ink4 }}>· {inbox.length}</span>
                )}
                <div style={{ flex: 1 }} />
                <button onClick={() => setInboxOpen(false)} title="סגירה" aria-label="סגירה"
                  style={{ width: 30, height: 30, borderRadius: 8, border: "none", background: T.surface, color: T.ink2, cursor: "pointer", display: "inline-flex", alignItems: "center", justifyContent: "center", fontFamily: "inherit", fontSize: 15, fontWeight: 800 }}>✕</button>
              </div>

              {/* This-trip / all-maps scope toggle. */}
              <div style={{ flexShrink: 0, display: "flex", gap: 4, padding: "10px 12px 0" }}>
                {[{ id: "trip", label: "הבנק לטיול זה" }, { id: "all", label: "כל הנקודות שלי" }].map((t) => {
                  const on = bankScope === t.id;
                  const count = t.id === "trip" ? visibleInbox.length : (Array.isArray(inbox) ? inbox.length : 0);
                  return (
                    <button key={t.id} onClick={() => setBankScope(t.id)}
                      style={{ flex: 1, border: `1px solid ${on ? T.ink : T.line}`, background: on ? T.ink : "#fff", color: on ? "#fff" : T.ink2, borderRadius: 999, padding: "7px 8px", fontSize: 12, fontWeight: 800, cursor: "pointer", fontFamily: "inherit" }}>
                      {t.label} {Array.isArray(inbox) && <span style={{ opacity: 0.7 }}>· {count}</span>}
                    </button>
                  );
                })}
              </div>

              {/* Filter WITHIN the saved bank (not a Google search — that's the
                  main top search bar). Matches name / note / category. */}
              {Array.isArray(inbox) && inbox.length > 0 && (
                <div style={{ flexShrink: 0, padding: "10px 12px", borderBottom: `1px solid ${T.line}` }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, height: 40, padding: "0 12px", borderRadius: 10, background: "#fff", border: `1px solid ${T.line}` }}>
                    <Icon name="search" size={15} strokeWidth={2} color={T.ink3} />
                    <input
                      value={bankFilter}
                      onChange={(e) => setBankFilter(e.target.value)}
                      placeholder="חיפוש בבנק הנקודות…"
                      style={{ flex: 1, border: "none", outline: "none", background: "transparent", fontSize: 13.5, fontFamily: "inherit", direction: "rtl", textAlign: "right", color: T.ink }}
                    />
                    {bankFilter && (
                      <button onClick={() => setBankFilter("")} aria-label="ניקוי" style={{ width: 20, height: 20, borderRadius: "50%", border: "none", background: T.surface, color: T.ink2, cursor: "pointer", fontFamily: "inherit", fontSize: 11 }}>✕</button>
                    )}
                  </div>
                </div>
              )}

              <div style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: "10px 12px 20px" }}>
                {inboxLoading ? (
                  <div style={{ textAlign: "center", color: T.ink3, fontSize: 13, padding: "36px 12px" }}>טוען נקודות…</div>
                ) : !Array.isArray(inbox) || inbox.length === 0 ? (
                  <div style={{ textAlign: "center", padding: "28px 14px", lineHeight: 1.7 }}>
                    <div style={{ fontSize: 34, marginBottom: 8 }}>📍</div>
                    <div style={{ fontSize: 13.5, fontWeight: 800, color: T.ink, marginBottom: 4 }}>בנק הנקודות ריק</div>
                    <div style={{ fontSize: 12.5, color: T.ink3 }}>
                      חפשו מקום למעלה כדי לשמור אותו,<br />
                      עשו <b style={{ color: T.ink2 }}>לחיצה ארוכה על המפה</b> לסמן נקודה,<br />
                      או העבירו תחנה מהמסלול לכאן (⋯ → העבר לבנק).
                    </div>
                  </div>
                ) : bankQ && filteredInbox.length === 0 ? (
                  <div style={{ textAlign: "center", padding: "28px 14px", lineHeight: 1.7 }}>
                    <div style={{ fontSize: 30, marginBottom: 8 }}>🔍</div>
                    <div style={{ fontSize: 13, color: T.ink3 }}>לא נמצאו נקודות בבנק שתואמות ל"{bankFilter.trim()}".</div>
                  </div>
                ) : visibleInbox.length === 0 ? (
                  <div style={{ textAlign: "center", padding: "28px 14px", lineHeight: 1.7 }}>
                    <div style={{ fontSize: 30, marginBottom: 8 }}>🗺️</div>
                    <div style={{ fontSize: 13, color: T.ink3, marginBottom: 12 }}>אין נקודות שמורות באזור הטיול הזה.</div>
                    <button onClick={() => setBankScope("all")} className="tp-press"
                      style={{ padding: "9px 16px", borderRadius: 999, border: "none", background: T.ink, color: T.panel, fontSize: 12.5, fontWeight: 800, cursor: "pointer", fontFamily: "inherit" }}>
                      הצגת כל הנקודות שלי
                    </button>
                  </div>
                ) : (
                  filteredInbox.map((p) => {
                    const hasCoord = Number.isFinite(p.lat) && Number.isFinite(p.lng);
                    return (
                      <div key={p.id}
                        onClick={() => openSavedPoint(p, { fromDrawer: true })}
                        className="tp-desk-row"
                        style={{
                          display: "flex", alignItems: "flex-start", gap: 10, padding: "9px 10px", marginBottom: 6,
                          borderRadius: 12, border: `1px solid ${T.line}`, background: "#fff",
                          cursor: hasCoord ? "pointer" : "default", transition: "background 0.14s, border-color 0.14s",
                        }}>
                        <img src={bankPhotoFor(p)} alt="" loading="lazy" onError={onPhotoErrorStrict()}
                          style={{ flexShrink: 0, width: 50, height: 50, borderRadius: 10, objectFit: "cover", background: T.surface }} />
                        <span style={{ flex: 1, minWidth: 0 }}>
                          <span dir="auto" style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13.5, fontWeight: 800, color: T.ink, lineHeight: 1.3 }}>
                            <span aria-hidden style={{ fontSize: 14, flexShrink: 0 }}>{categoryEmoji(p.category)}</span>
                            <span dir="auto" style={{ minWidth: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{p.nameHe || p.name}</span>
                          </span>
                          <span style={{ display: "block", fontSize: 11, color: T.ink3, marginTop: 2 }}>
                            {[p.rating ? `★ ${p.rating}` : "", p.category].filter(Boolean).join(" · ")}
                          </span>
                          {p.note && (
                            <span dir="auto" style={{ display: "block", fontSize: 11.5, color: T.ink2, background: T.surface, borderRadius: 8, padding: "5px 8px", marginTop: 6, lineHeight: 1.45, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>📝 {p.note}</span>
                          )}
                          <span style={{ display: "flex", gap: 6, marginTop: 7 }}>
                            <button onClick={(e) => { e.stopPropagation(); assignInboxToDay(p, activeDay); }}
                              style={{ height: 30, padding: "0 11px", borderRadius: 8, border: "none", background: CHARCOAL, color: "#fff", fontSize: 12, fontWeight: 800, cursor: "pointer", fontFamily: "inherit", display: "inline-flex", alignItems: "center", gap: 4 }}>
                              ＋ שבץ ליום {activeDay}
                            </button>
                            <button onClick={(e) => { e.stopPropagation(); removeFromInbox(p.id); }}
                              title="הסרה מהבנק" aria-label="הסרה"
                              style={{ width: 30, height: 30, borderRadius: 8, border: `1px solid ${T.line}`, background: "#fff", color: T.ink3, cursor: "pointer", fontFamily: "inherit", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 13 }}>🗑</button>
                          </span>
                        </span>
                      </div>
                    );
                  })
                )}
              </div>
            </motion.aside>
          )}
          </AnimatePresence>
        </div>
      </div>

      {/* ── Right-click / ⋯ context menu ─────────────────────────── */}
      {ctxMenu && (
        <>
          <div onClick={() => { setCtxMenu(null); setCtxDaysOpen(false); }} onContextMenu={(e) => { e.preventDefault(); setCtxMenu(null); }}
            style={{ position: "fixed", inset: 0, zIndex: 500 }} />
          <motion.div {...popMotion} dir="rtl" className="tp-pop" style={{
            position: "fixed", top: ctxMenu.y, insetInlineStart: undefined, left: ctxMenu.x, zIndex: 501,
            minWidth: 210, background: "#fff", borderRadius: 12, border: `1px solid ${T.line}`, transformOrigin: "top right",
            boxShadow: "0 12px 40px rgba(0,0,0,0.22)", padding: 6, fontFamily: T.font, overflow: "hidden",
          }}>
            <div dir="auto" style={{ padding: "6px 10px 8px", fontSize: 12.5, fontWeight: 800, color: T.ink, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", borderBottom: `1px solid ${T.line}`, marginBottom: 4 }}>{ctxMenu.a.nameHe || ctxMenu.a.name}</div>
            {!ctxDaysOpen ? (
              <>
                <CtxItem icon="note" label={ctxMenu.a.note ? "עריכת הערה" : "הוספת הערה"} onClick={() => { setNoteEdit({ idx: ctxMenu.idx, draft: ctxMenu.a.note || "" }); setCtxMenu(null); }} />
                <CtxItem emoji="📋" label="שכפל מיקום" onClick={() => { duplicateStopAt(activeDay, ctxMenu.idx); setCtxMenu(null); }} />
                <CtxItem emoji="📎" label="צירוף קובץ" onClick={() => { const i = ctxMenu.idx; setCtxMenu(null); promptAttach(i); }} />
                {ctxMenu.a.coordinates && <CtxItem emoji="📥" label="העבר לבנק הנקודות" onClick={() => { moveStopToInbox(activeDay, ctxMenu.idx); setCtxMenu(null); }} />}
                {days.length > 1 && <CtxItem emoji="📅" label="העברה ליום…" onClick={() => setCtxDaysOpen(true)} trailing="‹" />}
                <div style={{ height: 1, background: T.line, margin: "4px 0" }} />
                <CtxItem emoji="🗑️" label="מחיקה" danger onClick={() => { deleteStopAt(activeDay, ctxMenu.idx); setCtxMenu(null); }} />
              </>
            ) : (
              <div style={{ maxHeight: 220, overflowY: "auto" }}>
                <div style={{ padding: "4px 10px 6px", fontSize: 11.5, fontWeight: 800, color: T.ink3 }}>העברה ליום…</div>
                {days.filter((d) => d.day !== activeDay).map((d) => (
                  <CtxItem key={d.day} emoji="📅" label={`יום ${d.day} · ${d.cityHe || d.city || ""}`}
                    onClick={() => { moveStopToDay(activeDay, ctxMenu.idx, d.day); setCtxMenu(null); setCtxDaysOpen(false); }} />
                ))}
              </div>
            )}
          </motion.div>
        </>
      )}

      {/* ── Quick note editor ────────────────────────────────────── */}
      {noteEdit && (
        <motion.div {...scrimMotion} dir="rtl" onClick={() => setNoteEdit(null)}
          style={{ position: "fixed", inset: 0, zIndex: 510, background: "rgba(10,12,15,0.4)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20, fontFamily: T.font }}>
          <motion.div {...popMotion} onClick={(e) => e.stopPropagation()} className="tp-pop" style={{ width: "100%", maxWidth: 460, background: "#fff", borderRadius: 16, padding: 18, boxShadow: "0 24px 70px rgba(0,0,0,0.4)" }}>
            <div style={{ fontSize: 15, fontWeight: 800, color: T.ink, marginBottom: 10 }}>{noteEdit.kind === "node" ? "הערה חדשה במסלול" : "הערה למקום"}</div>
            <textarea autoFocus value={noteEdit.draft} onChange={(e) => setNoteEdit((s) => ({ ...s, draft: e.target.value }))}
              placeholder="שעת פתיחה, טיפ, כל דבר שכדאי לזכור…" rows={4}
              style={{ width: "100%", boxSizing: "border-box", padding: "11px 13px", borderRadius: 12, border: `1.5px solid ${T.line}`, background: "#fff", fontSize: 14, fontFamily: "inherit", color: T.ink, direction: "rtl", textAlign: "right", resize: "vertical", lineHeight: 1.5 }} />
            <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
              <button onClick={() => setNoteEdit(null)} style={{ flex: 1, height: 44, borderRadius: 12, border: `1px solid ${T.line}`, background: "#fff", color: T.ink2, fontSize: 14, fontWeight: 800, cursor: "pointer", fontFamily: "inherit" }}>ביטול</button>
              <button onClick={() => {
                const clean = (noteEdit.draft || "").trim();
                if (noteEdit.kind === "node") { if (clean) insertAt(activeDay, noteEdit.insertIdx, { _noteNode: true, note: clean, name: clean, nameHe: clean }); }
                else if (noteEdit.kind === "editNode") { updateStopAt(activeDay, noteEdit.idx, { _noteNode: true, note: clean, name: clean, nameHe: clean }); }
                else setStopNote(activeDay, noteEdit.idx, noteEdit.draft);
                setNoteEdit(null);
              }} style={{ flex: 1, height: 44, borderRadius: 12, border: "none", background: CHARCOAL, color: "#fff", fontSize: 14, fontWeight: 800, cursor: "pointer", fontFamily: "inherit" }}>שמירה</button>
            </div>
          </motion.div>
        </motion.div>
      )}

      {/* Inline quick-insert menu (from the "+ הוספת מעבר או הערה"): choose
          transit/flight or a free note, inserted at the chosen position. */}
      {insertMenu && (
        <motion.div {...scrimMotion} dir="rtl" onClick={() => setInsertMenu(null)}
          style={{ position: "fixed", inset: 0, zIndex: 520, background: "rgba(10,12,15,0.4)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20, fontFamily: T.font }}>
          <motion.div {...popMotion} onClick={(e) => e.stopPropagation()} className="tp-pop" style={{ width: "100%", maxWidth: 320, background: "#fff", borderRadius: 16, padding: 16, boxShadow: "0 24px 70px rgba(0,0,0,0.4)" }}>
            <div style={{ fontSize: 14.5, fontWeight: 800, color: T.ink, marginBottom: 12 }}>מה להוסיף כאן?</div>
            <button onClick={() => { const i = insertMenu.idx; setInsertMenu(null); setTransitEdit({ idx: -1, initial: null, insertIdx: i }); }}
              style={{ display: "flex", alignItems: "center", gap: 10, width: "100%", height: 46, borderRadius: 12, border: `1px solid ${T.line}`, background: "#fff", color: T.ink, cursor: "pointer", fontFamily: "inherit", fontSize: 14, fontWeight: 800, padding: "0 14px", marginBottom: 8 }}>
              <Icon name="plane" size={16} strokeWidth={2} color="#FF6B6B" /> מעבר / טיסה
            </button>
            <button onClick={() => { const i = insertMenu.idx; setInsertMenu(null); setNoteEdit({ kind: "node", insertIdx: i, draft: "" }); }}
              style={{ display: "flex", alignItems: "center", gap: 10, width: "100%", height: 46, borderRadius: 12, border: `1px solid ${T.line}`, background: "#fff", color: T.ink, cursor: "pointer", fontFamily: "inherit", fontSize: 14, fontWeight: 800, padding: "0 14px" }}>
              <span aria-hidden style={{ fontSize: 16 }}>📝</span> הערה חופשית
            </button>
          </motion.div>
        </motion.div>
      )}

      {/* Hidden file picker for per-stop attachments (triggered from the ⋯ menu). */}
      <input ref={fileInputRef} type="file" onChange={onFilePicked}
        accept="image/*,application/pdf,.pdf,.doc,.docx" style={{ display: "none" }} />

      {/* ── Transit / flight editor (reuses the mobile sheet component) ─── */}
      {transitEdit && (
        <AddTransitSheet
          initial={transitEdit.initial}
          onClose={() => setTransitEdit(null)}
          onAdd={(t) => {
            if (transitEdit.insertIdx != null) insertAt(activeDay, transitEdit.insertIdx, t);
            else if (transitEdit.idx >= 0) updateStopAt(activeDay, transitEdit.idx, t);
            else addTransitToDay(activeDay, t);
            setTransitEdit(null);
          }}
        />
      )}

      {/* ── "מפות נוספות" — reference-map overlay + point transfer ─── */}
      <ReferenceMapsPanel
        desktop
        open={refMapsOpen}
        onClose={closeRefMaps}
        dark={false}
        currentTripId={tripId}
        favorites={refFavorites}
        onOverlayChange={applyOverlayMap}
        onPointClick={focusOverlayPoint}
        onAddRequest={(pts) => setAddChoice(pts)}
        addedKeys={addedKeys}
        focusedKey={overlaySel?.key}
      />
      {addChoice && (
        <OverlayAddChoice
          points={addChoice}
          days={days}
          activeDay={activeDay}
          dark={false}
          onPick={(target, includeNotes) => { addOverlayPoints(addChoice, target, includeNotes); setAddChoice(null); }}
          onClose={() => setAddChoice(null)}
        />
      )}

      {/* ── Dates / skeleton editor (start + end → day count) ─── */}
      {datesOpen && (
        <div dir="rtl" onClick={() => setDatesOpen(false)} style={{ position: "fixed", inset: 0, zIndex: 300, display: "flex", alignItems: "center", justifyContent: "center", padding: 20, background: "rgba(8,10,14,0.5)", fontFamily: T.font }}>
          <div onClick={(e) => e.stopPropagation()} className="tp-pop" style={{ width: "100%", maxWidth: 420, background: "#fff", borderRadius: 20, border: `1px solid ${T.line}`, boxShadow: "0 30px 80px rgba(0,0,0,0.4)", padding: 22 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
              <span style={{ width: 34, height: 34, borderRadius: "50%", background: T.surface, display: "inline-flex", alignItems: "center", justifyContent: "center" }}><Icon name="calendar" size={17} strokeWidth={2} color={T.ink2} /></span>
              <div style={{ flex: 1, fontSize: 18, fontWeight: 800, color: T.ink }}>תאריכי הטיול</div>
              <button onClick={() => setDatesOpen(false)} aria-label="סגירה" style={{ width: 34, height: 34, borderRadius: "50%", border: "none", background: T.surface, color: T.ink3, cursor: "pointer", fontFamily: "inherit", fontSize: 15 }}>✕</button>
            </div>
            <div style={{ fontSize: 13, color: T.ink3, lineHeight: 1.6, marginBottom: 16 }}>
              קביעת תאריך התחלה וסיום. מספר הימים במסלול יתעדכן אוטומטית לפי הטווח — הוספת ימים ריקים בסוף, או קיפול ימים עודפים אל היום האחרון (בלי לאבד נקודות).
            </div>
            <div style={{ display: "flex", gap: 12 }}>
              <label style={{ flex: 1, fontSize: 12.5, fontWeight: 800, color: T.ink3 }}>
                התחלה
                <input type="date" value={datesStart} onChange={(e) => setDatesStart(e.target.value)}
                  style={{ display: "block", width: "100%", boxSizing: "border-box", marginTop: 6, height: 44, padding: "0 12px", borderRadius: 12, border: `1.5px solid ${T.line}`, background: "#fff", color: T.ink, fontSize: 14, fontFamily: "inherit" }} />
              </label>
              <label style={{ flex: 1, fontSize: 12.5, fontWeight: 800, color: T.ink3 }}>
                סיום
                <input type="date" value={datesEnd} min={datesStart || undefined} onChange={(e) => setDatesEnd(e.target.value)}
                  style={{ display: "block", width: "100%", boxSizing: "border-box", marginTop: 6, height: 44, padding: "0 12px", borderRadius: 12, border: `1.5px solid ${T.line}`, background: "#fff", color: T.ink, fontSize: 14, fontFamily: "inherit" }} />
              </label>
            </div>
            <button onClick={() => { applyDateRange(datesStart || null, datesEnd || null); setDatesOpen(false); }} disabled={!datesStart} className="tp-press"
              style={{ width: "100%", height: 48, marginTop: 18, borderRadius: 999, border: "none", background: datesStart ? T.ink : T.surface, color: datesStart ? "#fff" : T.ink4, fontSize: 15, fontWeight: 800, cursor: datesStart ? "pointer" : "default", fontFamily: "inherit" }}>
              שמירה
            </button>
            {trip?.settings?.startDate && (
              <button onClick={() => { saveStartDate(null); setDatesOpen(false); }}
                style={{ width: "100%", height: 42, marginTop: 8, borderRadius: 999, border: `1px solid ${T.line}`, background: "#fff", color: T.ink3, fontSize: 13.5, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
                הסרת התאריכים
              </button>
            )}
          </div>
        </div>
      )}

      {/* ── Delete-day confirmation ─── */}
      {confirmDelDay != null && (
        <div dir="rtl" onClick={() => setConfirmDelDay(null)} style={{ position: "fixed", inset: 0, zIndex: 300, display: "flex", alignItems: "center", justifyContent: "center", padding: 20, background: "rgba(8,10,14,0.5)", fontFamily: T.font }}>
          <div onClick={(e) => e.stopPropagation()} className="tp-pop" style={{ width: "100%", maxWidth: 360, background: "#fff", borderRadius: 20, border: `1px solid ${T.line}`, boxShadow: "0 30px 80px rgba(0,0,0,0.4)", padding: 22, textAlign: "center" }}>
            <div style={{ fontSize: 17, fontWeight: 800, color: T.ink, marginBottom: 8 }}>למחוק את יום {confirmDelDay}?</div>
            <div style={{ fontSize: 13.5, color: T.ink3, lineHeight: 1.6, marginBottom: 18 }}>
              היום וכל הנקודות שבו יימחקו. שאר הימים ימוספרו מחדש.
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => setConfirmDelDay(null)}
                style={{ flex: 1, height: 46, borderRadius: 999, border: `1px solid ${T.line}`, background: "#fff", color: T.ink2, fontSize: 14.5, fontWeight: 800, cursor: "pointer", fontFamily: "inherit" }}>
                ביטול
              </button>
              <button onClick={() => { deleteDay(confirmDelDay); setConfirmDelDay(null); }} className="tp-press"
                style={{ flex: 1, height: 46, borderRadius: 999, border: "none", background: "#C0392B", color: "#fff", fontSize: 14.5, fontWeight: 800, cursor: "pointer", fontFamily: "inherit" }}>
                מחיקה
              </button>
            </div>
          </div>
        </div>
      )}

      {/* "מצא לי X באזור" — category picker; picks feed nearbySearch → map pins. */}
      {nearbyOrigin && (
        <NearbySearchSheet
          point={nearbyOrigin}
          onPick={(q) => runNearby(nearbyOrigin, q)}
          onClose={() => setNearbyOrigin(null)}
        />
      )}

      {/* Attachment-upload failure micro-toast (auto-dismiss ~2.4s). */}
      {attachToast && (
        <div dir="rtl" role="status" aria-live="polite" style={{
          position: "fixed", top: "calc(env(safe-area-inset-top, 0px) + 70px)", left: "50%", transform: "translateX(-50%)",
          zIndex: 260, maxWidth: "min(90vw, 360px)", background: "#C0392B", color: "#fff",
          borderRadius: 999, padding: "8px 16px", fontFamily: T.font, fontSize: 13, fontWeight: 700,
          boxShadow: "0 8px 24px rgba(0,0,0,0.28)", display: "inline-flex", alignItems: "center", gap: 8,
          whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
        }}>
          <span aria-hidden>⚠️</span>{attachToast}
        </div>
      )}

      <style>{`
        .tp-desk-row:hover { background: ${T.surface} !important; border-color: ${T.ink4} !important; box-shadow: 0 1px 4px rgba(0,0,0,0.06); }
        .tp-row-more { opacity: 0; transition: opacity 0.14s; }
        .tp-desk-row:hover .tp-row-more { opacity: 1; }
        .tp-row-grip { opacity: 0; transition: opacity 0.14s; }
        .tp-desk-row:hover .tp-row-grip { opacity: 0.75; }
        .tp-desk-row:hover .tp-row-plus { opacity: 1 !important; }
        /* Apple-grade press response: instant highlight on pointer-down.
           Brightness (not transform) so positioned buttons never jump. */
        .tp-cockpit button:not(:disabled):active { filter: brightness(0.93); }
        .tp-cockpit button:not(:disabled) { transition: filter 90ms ease-out, background 0.15s, color 0.15s, border-color 0.15s; }
        .tp-desk-row:active { transform: scale(0.996); }
        .tp-desk-row { transition: background 0.14s, border-color 0.14s, box-shadow 0.14s, opacity 0.14s, transform 90ms ease-out; }
        @media (prefers-reduced-motion: reduce) {
          .tp-desk-row:active { transform: none; }
        }
        /* Translucent chrome degrades to solid when the viewer prefers it. */
        @media (prefers-reduced-transparency: reduce) {
          .tp-frost { background: #fff !important; backdrop-filter: none !important; }
        }
        .tp-ctx-item:hover { background: ${T.surface}; }
        .tp-noscrollbar { scrollbar-width: none; }
        .tp-noscrollbar::-webkit-scrollbar { display: none; }
      `}</style>
    </Shell>
  );
}

function Shell({ children }) {
  return (
    <div className="tp-cockpit" style={{ position: "fixed", inset: 0, display: "flex", flexDirection: "column", background: "#E9EBEC" }}>
      {children}
    </div>
  );
}

/* A single row in the desktop context menu. */
function CtxItem({ icon, emoji, label, danger, trailing, onClick }) {
  return (
    <button onClick={onClick} className="tp-ctx-item"
      style={{
        display: "flex", alignItems: "center", gap: 9, width: "100%", textAlign: "start",
        padding: "9px 10px", border: "none", background: "transparent", cursor: "pointer",
        borderRadius: 8, fontFamily: T.font, fontSize: 13.5, fontWeight: 700,
        color: danger ? "#C0392B" : T.ink,
      }}>
      <span aria-hidden style={{ width: 18, textAlign: "center", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 15 }}>
        {icon ? <Icon name={icon} size={15} strokeWidth={1.9} color={danger ? "#C0392B" : T.ink2} /> : emoji}
      </span>
      <span style={{ flex: 1, minWidth: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{label}</span>
      {trailing && <span aria-hidden style={{ color: T.ink4, fontSize: 14 }}>{trailing}</span>}
    </button>
  );
}
