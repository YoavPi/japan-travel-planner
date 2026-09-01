import React, { useEffect, useMemo, useRef, useState } from "react";
import Map, { Marker, Source, Layer, Popup } from "react-map-gl/maplibre";
import "maplibre-gl/dist/maplibre-gl.css";
import Icon from "./Icon";
import mapsUrlFor from "../utils/mapsUrl";
import { photoStrict, onPhotoErrorStrict } from "../utils/placePhoto";
import usePlacePhotos, { photoKey } from "../utils/usePlacePhotos";

/* ══════════════════════════════════════════════════════════════
   EditorMap — keyless MapLibre canvas for the trip editor.

   • Renders numbered standalone markers for the active day's stops
     (no connecting route polyline — see Sprint 19.2).
   • flyTo recenters when the active day's stop cluster changes.
   • Pinning mode (spec §4B): when `isPinning` is true the cursor
     becomes a crosshair and a map click reports the lngLat via
     onMapPick — the parent then prompts for a label.
   ══════════════════════════════════════════════════════════════ */

const MAP_STYLE = "https://basemaps.cartocdn.com/gl/positron-gl-style/style.json";

const ACCENT = "#E0533F";

/* Sprint 36 #1 — graceful fallback viewport. A trip with no registered
   markers and no destination center (a freshly created / empty trip)
   defaults to Tokyo, Japan at a comfortable regional zoom instead of
   failing to render the canvas. */
const TOKYO_FALLBACK = { lng: 139.6503, lat: 35.6762, zoom: 10 };
/* Sprint 36 #7 — a single-stop day forces a legible planning zoom
   rather than diving to street level. */
const SINGLE_STOP_ZOOM = 15;
/* Zoom used when a single POINT is clicked (pin or row) — a tight, framed
   "crop" on that place. Higher than the day-cluster fit so a click clearly
   dives in on the point. */
const CROP_ZOOM = 16.5;
/* fitBounds padding buffer so pins are never clipped by floating UI. */
const FIT_PADDING = 70;

/* Relevance filter for the day-context fly-to: of a set of candidate points
   (bank / overlay), which are genuinely NEAR the active day — within the day's
   own spread ×1.5, floored at 3km and capped at 5km of the day's centroid. Lets
   us frame "this day + its nearby points" without a reference map in another
   country zooming the view out to two continents. Distance via haversine (km). */
const nearActiveDay = (dayCoords, candidates) => {
  if (!dayCoords || dayCoords.length === 0) return candidates || [];
  const hav = (a, b) => {
    const R = 6371, tr = (d) => (d * Math.PI) / 180;
    const dLa = tr(b.lat - a.lat), dLo = tr(b.lng - a.lng);
    const s = Math.sin(dLa / 2) ** 2 + Math.cos(tr(a.lat)) * Math.cos(tr(b.lat)) * Math.sin(dLo / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(s));
  };
  const cen = {
    lat: dayCoords.reduce((s, c) => s + c.lat, 0) / dayCoords.length,
    lng: dayCoords.reduce((s, c) => s + c.lng, 0) / dayCoords.length,
  };
  let spread = 0;
  dayCoords.forEach((c) => { spread = Math.max(spread, hav(c, cen)); });
  const relevance = Math.min(5, Math.max(3, spread * 1.5));
  return (candidates || []).filter((c) => hav(c, cen) <= relevance);
};

const EditorMap = ({
  stops = [], color = "#0D0F11",
  isPinning = false, onMapPick,
  /* Tapping a trip marker opens a floating detail card; the parent may
     also react (e.g. select the stop in the list). */
  onMarkerClick,
  center = null, pendingPin = null,
  /* Sprint 7 — Places preview */
  previewPin = null,   // { lat, lng } — high-contrast accent pin for a searched place
  flyToCoord = null,   // { lat, lng } — trigger a flyTo when set
  /* When a point/bank card is open the user is focused on ONE place — hold the
     view steady. Prevents the day-fit from yanking the map back to the day's
     cluster on unrelated re-renders (e.g. the mobile keyboard opening while
     editing a saved point's note, which resizes the viewport → recomputes
     fitPadding → re-fit). */
  holdView = false,
  /* Desktop cockpit only — clicking a point (pin or row) crops in on it
     (tight flyTo, never zooming out). Off by default so the MOBILE editor's
     marker-tap keeps its original pan-only behavior, untouched. */
  cropOnClick = false,
  /* Desktop cockpit only — anchor the info card to its point via a native
     maplibre Popup (maplibre owns the projection, so it tracks the point on
     every pan/zoom and flips above/below the edge). `cardCoord` = {lat,lng}
     of the open card; `renderCard()` returns its JSX (styled by the parent). */
  cardCoord = null,
  renderCard = null,
  /* Sprint 15.6 — Map Lock: freeze all user pan/zoom/rotate gestures
     while leaving programmatic flyTo (preview, day-fit) fully working. */
  locked = false,
  /* Sprint 22 #7 — mock Google Saved Places overlay. Rendered as
     distinct NEUTRAL, semi-transparent star markers so they can never
     be confused with the active itinerary's numbered route pins. */
  savedPlaces = [],
  /* Sprint 58 #8 — render legible name badges beside each saved marker. */
  savedLabels = false,
  /* Live search results ({placeId,name,lat,lng,rating}) plotted as numbered
     accent pins so the user sees each hit's location before picking one. */
  searchResults = [],
  onSearchResultClick,
  /* Origin point of a "מצא לי X באזור" search — included in the auto-fit so the
     nearby results AND the point they surround are framed on screen together. */
  searchOrigin = null,
  /* Optional padding override for the search auto-fit (mobile passes extra
     bottom so results aren't framed under the bottom sheet). */
  searchFitPadding = null,
  /* True while the "מצא נקודות באזור" results panel is open. Freezes the
     day-cluster / snap-back auto-fits so the view stays framed on the
     area results and never yanks back out to all the day's stops. */
  nearbyActive = false,
  /* Reference-maps overlay — points of ANOTHER map loaded on top, in a
     distinct color so they read as a separate layer (not this trip, not the
     bank). Tapping one flies to it (onOverlayClick) AND opens an info popup
     with quick "add to day / add to bank" actions (onOverlayAdd). */
  overlayPlaces = [],
  overlayColor = "#0C8B94",
  onOverlayClick,
  overlaySelected,       // the overlay point whose rich card is open (parent-owned)
  onOverlaySelect,       // (point | null) — open/close the card
  overlayActiveDay,      // default day for the "add to day" picker
  onOverlayAddDay,       // (point, dayNumber) → add to a specific day
  onOverlayAddBank,      // (point) → save to the bank
  compactCard = false,   // mobile: render the overlay card tighter
  /* Sprint 27 #3 — quick-edit bridge: when the active day carries a
     transport leg, marker popups expose an "ערוך מעבר" button that jumps
     straight into that segment's edit sheet (no timeline fishing). */
  hasTransit = false,
  onEditTransit,
  /* Sprint 28 #3 / 34 — long-press custom pins. The parent receives
     ({ name, note, coordinates }, target) where target is { day: N } to
     assign to a specific day or { inbox: true } for the unassigned pile. */
  onSaveCustomPin,
  /* Sprint 34 — trip days for the modal's "specific day" selector. */
  days = [],
  /* Sprint 36 #6 — tapping empty map space collapses the Places Inbox. */
  onMapBackgroundClick,
  /* Sprint 44 #3 — persistent active-stop context. `focusStop` (driven by a
     timeline/map selection in the parent) opens + highlights that stop's
     card; `onActiveStop`/`onClearActive` keep the parent's state in sync so
     the highlight survives sheet minimization and clears only on X / empty
     map tap. */
  focusStop = null, onActiveStop, onClearActive,
  /* Sprint 47 #3 — report the live viewport bounds ({west,south,east,north})
     after every move so the parent can bias Places search to what's visible. */
  onViewportChange,
  /* Sprint 57 #3 — "search my saved points around THIS stop" from the card. */
  onSearchAround,
  /* Sprint 59 #6 — compass: report live bearing after every move; when
     `resetNorthKey` changes, smoothly ease the viewport back to true north. */
  onBearingChange, resetNorthKey = 0,
  /* Sprint 59 #4 — tapping a gray saved-point marker opens its rich card. */
  onSavedClick,
  /* Sprint 61 #5 — continuous-overview trajectory: an ordered [[lng,lat],…]
     path drawn as a coral polyline connecting every stop across the trip. */
  routePath = null,
  /* Sprint 65 #5 — fitBounds padding override so a MID bottom sheet + top
     search bar never hide markers ({top,bottom,left,right} or a number). */
  fitPadding = null,
}) => {
  const mapRef = useRef(null);
  const [hoverCoord, setHoverCoord] = useState(null); // ghost pin while pinning
  /* The trip marker whose detail BOTTOM SHEET is open (Sprint 29 #1 —
     replaces the outdated MapLibre Popup / InfoWindow pattern). */
  const [selected, setSelected] = useState(null);
  /* Real photo for the open card — the place's OWN Google Maps photo, else
     Street View of its coordinates (utils/usePlacePhotos), matching the
     desktop cockpit. Falls back to a neutral placeholder (never a misleading
     category stock image). */
  const selPhotos = usePlacePhotos(selected?.stop ? [selected.stop] : []);
  /* Reference-map overlay: the parent owns the open point; we render its photo. */
  const overlaySel = overlaySelected || null;
  const overlaySelPhotos = usePlacePhotos(overlaySel ? [overlaySel] : []);
  /* The day the overlay card's "add" targets — defaults to the active day and
     resets whenever a different overlay point opens. */
  const [overlayDay, setOverlayDay] = useState(null);
  useEffect(() => {
    if (overlaySel) setOverlayDay(overlayActiveDay ?? null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [overlaySel && (overlaySel.key || overlaySel.id)]);
  /* Sprint 44 #3 — the detail card can be minimized to a slim bar while the
     marker stays active/highlighted (Google-Maps style). */
  const [cardMin, setCardMin] = useState(false);
  /* Sprint 47 #1 — a failed/absent Google photo hides the whole image block
     so the text + CTA snap upward (no crossed-out placeholder). */
  /* Sprint 45 #8 — downward-swipe-to-minimize tracker. */
  const cardSwipe = useRef({ y0: 0, active: false });
  /* Sprint 28/29 — draft custom pin: coords captured on a TOUCH
     long-press (Sprint 29 #2 — no contextmenu). A centered modal
     collects שם + הסבר. Kept ENTIRELY inside EditorMap so typing never
     re-renders the parent (or the map canvas props). */
  const [pinDraft, setPinDraft] = useState(null); // { lng, lat }
  const [pinName, setPinName] = useState("");
  const [pinNote, setPinNote] = useState("");
  /* Sprint 34 — where-to-save context: "inbox" (unassigned pile) or a
     specific day number. */
  const [pinSaveMode, setPinSaveMode] = useState("inbox"); // "inbox" | "day"
  const [pinDay, setPinDay] = useState(null); // chosen day number when mode === "day"

  /* Sprint 29 #2 — stable long-press engine. A pointer held still for
     ≥500ms opens the pin modal; any movement past a small slop radius
     (a pan gesture) or an early release cancels it. Pointer events unify
     touch + mouse-hold and never fire a desktop context menu. */
  const lpTimer = useRef(null);
  const lpStart = useRef(null); // { x, y, lngLat }
  const LONGPRESS_MS = 500;
  const LONGPRESS_SLOP = 10; // px

  const clearLongPress = () => {
    if (lpTimer.current) { clearTimeout(lpTimer.current); lpTimer.current = null; }
    lpStart.current = null;
  };

  const openPinDraft = (lngLat) => {
    if (!lngLat) return;
    setSelected(null);
    setPinName("");
    setPinNote("");
    setPinSaveMode("inbox");
    setPinDay(null);
    setPinDraft({ lng: lngLat.lng, lat: lngLat.lat });
  };
  /* Sprint 44 #3 — fully close the detail card + clear the active context. */
  const closeCard = () => {
    setSelected(null);
    setCardMin(false);
    if (onClearActive) onClearActive();
  };
  /* Sprint 45 #8 — a downward swipe anywhere on the card minimizes it. Armed
     only when the scroll area is at the top so mid-content scrolling is not
     hijacked. */
  const onCardTouchStart = (e) => {
    const t = e.touches && e.touches[0];
    if (!t) return;
    cardSwipe.current = { y0: t.clientY, active: (e.currentTarget.scrollTop || 0) <= 2 };
  };
  const onCardTouchMove = (e) => {
    if (cardMin || !cardSwipe.current.active) return;
    const t = e.touches && e.touches[0];
    if (t && t.clientY - cardSwipe.current.y0 > 56) { setCardMin(true); cardSwipe.current.active = false; }
  };
  const onCardTouchEnd = () => { cardSwipe.current.active = false; };
  const cancelPinDraft = () => setPinDraft(null); // clears the temp marker
  const canSavePin = pinDraft && pinName.trim() && (pinSaveMode === "inbox" || pinDay != null);
  const savePinDraft = () => {
    if (!canSavePin) return;
    /* Sprint 34 — always create the stop; assign to a day only if one was
       chosen, otherwise it lands in the unassigned pile (בנק הנקודות). */
    const target = (pinSaveMode === "day" && pinDay != null) ? { day: pinDay } : { inbox: true };
    onSaveCustomPin && onSaveCustomPin({
      name: pinName.trim(),
      note: pinNote.trim() || undefined,
      coordinates: { lat: pinDraft.lat, lng: pinDraft.lng },
    }, target);
    setPinDraft(null);
  };

  /* Open the searched place / marker in the native Google Maps app or
     web (Sprint 29 #1 CTA) — prefers a provided maps_url, else coords.
     VibeSec hardening: a stop's maps_url can originate from arbitrary
     data (custom pins, Takeout import), so we NEVER hand an unvetted
     value to window.open. Only http(s) URLs pass; anything else
     (javascript:, data:, etc.) falls back to the safe coordinate link. */
  const isSafeHttpUrl = (u) => {
    try { return ["http:", "https:"].includes(new URL(u).protocol); }
    catch { return false; }
  };
  const openInGoogleMaps = (stop) => {
    // Prefer a curated maps_url, then the shared resolver (link →
    // place_id → name → coords) so we open the real place listing,
    // not a bare coordinate pin. Coordinates are the last resort.
    const provided = stop?.maps_url || stop?.mapsUrl;
    const url = (provided && isSafeHttpUrl(provided)) ? provided : mapsUrlFor(stop);
    if (url) window.open(url, "_blank", "noopener,noreferrer");
  };

  /* Smoothly recenter the map on a coordinate (used by both blank-area
     taps and marker taps). MapRef proxies maplibre's panTo. */
  const panToCoord = (lng, lat) => {
    const map = mapRef.current;
    if (map && Number.isFinite(lng) && Number.isFinite(lat)) {
      map.panTo([lng, lat], { duration: 600 });
    }
  };

  /* Clicking an actual POINT (map pin or timeline row) should recenter AND
     "crop" onto it — a close, framed view of just that place. We fly to a
     tight zoom but never zoom OUT: if the user is already closer than the
     crop level we keep their zoom, so a click only ever tightens the frame. */
  const flyToStop = (lng, lat) => {
    const map = mapRef.current;
    if (!map || !Number.isFinite(lng) || !Number.isFinite(lat)) return;
    let z = CROP_ZOOM;
    try { z = Math.max(map.getZoom(), CROP_ZOOM); } catch { /* map not ready */ }
    map.flyTo({ center: [lng, lat], zoom: z, duration: 700, essential: true });
  };

  /* Sprint 19.5 — "Logistical-only" nodes: a stop may exist in the day
     timeline without valid coordinates (e.g. a reminder/transit memo).
     Such stops must NEVER feed the map's bounds/markers — require BOTH
     lng AND lat to be finite numbers before a pin is plotted. */
  const pts = useMemo(
    () => stops.filter(
      (s) => s.coordinates &&
        Number.isFinite(s.coordinates.lng) &&
        Number.isFinite(s.coordinates.lat)
    ),
    [stops]
  );

  /* Dynamic viewport: when the active day has no stops, fly to the
     trip's destination center (set by the onboarding wizard) so a
     brand-new global trip opens on the right country instead of the
     hardcoded default. */
  useEffect(() => {
    const map = mapRef.current;
    if (!map || pts.length > 0) return;
    /* Sprint 36 #1 — no markers: use the trip's destination center when
       present, otherwise gracefully fall back to Tokyo. Never leave the
       canvas un-centered / failing. */
    const c = (center && Number.isFinite(center.lng) && Number.isFinite(center.lat)) ? center : TOKYO_FALLBACK;
    try {
      map.flyTo({ center: [c.lng, c.lat], zoom: c.zoom ?? TOKYO_FALLBACK.zoom, duration: 800 });
    } catch { /* map not ready — initialViewState already covers the first paint */ }
  }, [center, pts.length]);

  /* Sprint 47 #3 — publish the live viewport bounds to the parent so Places
     search can bias predictions toward what the user is currently looking at. */
  const reportViewport = () => {
    if (!onViewportChange) return;
    const map = mapRef.current;
    if (!map) return;
    try {
      const b = map.getBounds();
      onViewportChange({ west: b.getWest(), south: b.getSouth(), east: b.getEast(), north: b.getNorth() });
    } catch { /* bounds not ready */ }
  };

  /* Sprint 59 #6 — publish the live bearing so the parent can mount the
     compass control only while the map is rotated away from north. */
  const reportBearing = () => {
    if (!onBearingChange) return;
    const map = mapRef.current;
    if (!map) return;
    try { onBearingChange(map.getBearing()); } catch { /* not ready */ }
  };

  /* Sprint 59 #6 — smoothly reset the viewport orientation to true north
     whenever the parent bumps `resetNorthKey`. */
  useEffect(() => {
    if (!resetNorthKey) return;
    const map = mapRef.current;
    if (!map) return;
    try { map.easeTo({ bearing: 0, pitch: 0, duration: 400 }); } catch { /* not ready */ }
  }, [resetNorthKey]);

  /* Sprint 7 — fly to a previewed place coordinate. */
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !flyToCoord) return;
    if (cropOnClick) flyToStop(flyToCoord.lng, flyToCoord.lat);
    else map.flyTo({ center: [flyToCoord.lng, flyToCoord.lat], zoom: 15, duration: 750 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flyToCoord]);

  /* Keep the open card's point clear of the map edges. The card is a Popup
     anchored ABOVE the point (~320px tall), so if the point sits near the top
     or a side the card gets clipped. After the click's crop settles, if the
     point is outside a comfortable band we ease it toward centre so the whole
     card stays on-screen. Only fires when the anchored POINT changes (a new
     card), never on the user's own pans/zooms. */
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !cardCoord || !Number.isFinite(cardCoord.lat) || !Number.isFinite(cardCoord.lng)) return;
    const t = setTimeout(() => {
      try {
        const p = map.project([cardCoord.lng, cardCoord.lat]);
        const c = map.getContainer();
        const w = c.clientWidth, h = c.clientHeight;
        if (p.x < 190 || p.x > w - 190 || p.y < 340 || p.y > h - 40) {
          map.easeTo({ center: [cardCoord.lng, cardCoord.lat], duration: 420 });
        }
      } catch { /* map not ready */ }
    }, 560); // let the crop flyTo settle first
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cardCoord && cardCoord.lat, cardCoord && cardCoord.lng]);

  /* Fit/fly to the active day's cluster whenever it changes. */
  useEffect(() => {
    const map = mapRef.current;
    if (!map || pts.length === 0) return;
    if (holdView || nearbyActive) return; // a card is open, or nearby results own the view — keep it put
    if (pts.length === 1) {
      /* Sprint 36 #7 — single stop: legible planning zoom, not street level. */
      map.flyTo({ center: [pts[0].coordinates.lng, pts[0].coordinates.lat], zoom: SINGLE_STOP_ZOOM, duration: 700 });
      return;
    }
    let minLng = Infinity, minLat = Infinity, maxLng = -Infinity, maxLat = -Infinity;
    pts.forEach(({ coordinates: c }) => {
      minLng = Math.min(minLng, c.lng); maxLng = Math.max(maxLng, c.lng);
      minLat = Math.min(minLat, c.lat); maxLat = Math.max(maxLat, c.lat);
    });
    try {
      /* Sprint 36 #7 / 65 #5 — padding buffer so pins clear the floating sheet /
         omnibox. `fitPadding` (from the parent) frames the whole trip in the
         visible band above a MID sheet in continuous-overview mode. */
      map.fitBounds([[minLng, minLat], [maxLng, maxLat]], { padding: fitPadding || FIT_PADDING, maxZoom: 15, duration: 700 });
    } catch { /* noop */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pts, fitPadding, nearbyActive]);

  /* "מפות נוספות" — when a reference map is loaded as an overlay, frame the map
     so the CURRENT route AND the loaded points are BOTH visible at once (so the
     user can see where to pull points across). Runs once per overlay load,
     keyed on the overlay's signature; overrides holdView on purpose. */
  const overlaySig = useMemo(
    () => overlayPlaces.map((p) => p.key || p.id || `${p.lat},${p.lng}`).join("|"),
    [overlayPlaces]
  );
  const hadOverlayRef = useRef(false);
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    /* Overlay cleared (panel closed / back-to-picker): snap the view back to
       the current route so the user isn't left on the wide two-route frame. */
    if (!overlaySig) {
      if (hadOverlayRef.current && pts.length > 0 && !nearbyActive) {
        hadOverlayRef.current = false;
        if (pts.length === 1) {
          map.flyTo({ center: [pts[0].coordinates.lng, pts[0].coordinates.lat], zoom: SINGLE_STOP_ZOOM, duration: 700 });
        } else {
          let a = Infinity, b = Infinity, c = -Infinity, d = -Infinity;
          pts.forEach(({ coordinates: p }) => { a = Math.min(a, p.lng); c = Math.max(c, p.lng); b = Math.min(b, p.lat); d = Math.max(d, p.lat); });
          try { map.fitBounds([[a, b], [c, d]], { padding: fitPadding || FIT_PADDING, maxZoom: 15, duration: 700 }); } catch { /* noop */ }
        }
      }
      return;
    }
    hadOverlayRef.current = true;
    const dayCoords = pts.map((s) => s.coordinates).filter((c) => c && Number.isFinite(c.lng) && Number.isFinite(c.lat));
    const overlayCoords = overlayPlaces.filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lng)).map((p) => ({ lat: p.lat, lng: p.lng }));
    /* Frame the active day + only the overlay points that are genuinely NEAR it
       (within the day's spread ×1.5, min 3km, max 5km) — so a reference map in
       another country doesn't zoom the view out to two continents. */
    const coords = [...dayCoords, ...nearActiveDay(dayCoords, overlayCoords)];
    if (coords.length === 0) return;
    let minLng = Infinity, minLat = Infinity, maxLng = -Infinity, maxLat = -Infinity;
    coords.forEach((c) => {
      minLng = Math.min(minLng, c.lng); maxLng = Math.max(maxLng, c.lng);
      minLat = Math.min(minLat, c.lat); maxLat = Math.max(maxLat, c.lat);
    });
    try {
      if (minLng === maxLng && minLat === maxLat) {
        map.flyTo({ center: [minLng, minLat], zoom: SINGLE_STOP_ZOOM, duration: 800 });
      } else {
        map.fitBounds([[minLng, minLat], [maxLng, maxLat]], { padding: fitPadding || FIT_PADDING, maxZoom: 15, duration: 800 });
      }
    } catch { /* noop */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [overlaySig]);

  /* Point-bank fly-to — when the bank markers appear over the active day
     (user opened the bank / toggled "show all saved"), frame the day + only the
     bank points genuinely NEAR it (nearActiveDay), same relevance rule as the
     overlay. Fires on the empty→present transition (the "open" action), not on
     day switches; snaps back to the day when the bank is closed. */
  const savedSig = useMemo(
    () => savedPlaces.map((p) => p.key || p.id || `${p.lat},${p.lng}`).join("|"),
    [savedPlaces]
  );
  const hadSavedRef = useRef(false);
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const dayCoords = pts.map((s) => s.coordinates).filter((c) => c && Number.isFinite(c.lng) && Number.isFinite(c.lat));
    if (!savedSig) {
      /* Bank closed: snap back to the current route so the user isn't left on a
         wide day+bank frame. */
      if (hadSavedRef.current && dayCoords.length > 0 && !nearbyActive) {
        hadSavedRef.current = false;
        if (dayCoords.length === 1) {
          map.flyTo({ center: [dayCoords[0].lng, dayCoords[0].lat], zoom: SINGLE_STOP_ZOOM, duration: 700 });
        } else {
          let a = Infinity, b = Infinity, c = -Infinity, d = -Infinity;
          dayCoords.forEach((p) => { a = Math.min(a, p.lng); c = Math.max(c, p.lng); b = Math.min(b, p.lat); d = Math.max(d, p.lat); });
          try { map.fitBounds([[a, b], [c, d]], { padding: fitPadding || FIT_PADDING, maxZoom: 15, duration: 700 }); } catch { /* noop */ }
        }
      }
      return;
    }
    if (hadSavedRef.current) return; // already framed for this open; don't fight day switches
    hadSavedRef.current = true;
    const savedCoords = savedPlaces.filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lng)).map((p) => ({ lat: p.lat, lng: p.lng }));
    const coords = [...dayCoords, ...nearActiveDay(dayCoords, savedCoords)];
    if (coords.length === 0) return;
    let minLng = Infinity, minLat = Infinity, maxLng = -Infinity, maxLat = -Infinity;
    coords.forEach((c) => {
      minLng = Math.min(minLng, c.lng); maxLng = Math.max(maxLng, c.lng);
      minLat = Math.min(minLat, c.lat); maxLat = Math.max(maxLat, c.lat);
    });
    try {
      if (minLng === maxLng && minLat === maxLat) {
        map.flyTo({ center: [minLng, minLat], zoom: SINGLE_STOP_ZOOM, duration: 800 });
      } else {
        map.fitBounds([[minLng, minLat], [maxLng, maxLat]], { padding: fitPadding || FIT_PADDING, maxZoom: 15, duration: 800 });
      }
    } catch { /* noop */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [savedSig]);

  /* "מצא לי X באזור" — when nearby results appear, FRAME the origin point + all
     result pins so they're on screen at once (results are otherwise off-view).
     Runs once per result set (keyed on the signature); overrides holdView. */
  const searchSig = useMemo(
    () => searchResults.map((p) => p.placeId || `${p.lat},${p.lng}`).join("|"),
    [searchResults]
  );
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !searchSig) return;
    const coords = searchResults
      .filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lng))
      .map((p) => ({ lat: p.lat, lng: p.lng }));
    if (searchOrigin && Number.isFinite(searchOrigin.lat) && Number.isFinite(searchOrigin.lng)) {
      coords.push({ lat: searchOrigin.lat, lng: searchOrigin.lng });
    }
    if (coords.length === 0) return;
    let minLng = Infinity, minLat = Infinity, maxLng = -Infinity, maxLat = -Infinity;
    coords.forEach((c) => {
      minLng = Math.min(minLng, c.lng); maxLng = Math.max(maxLng, c.lng);
      minLat = Math.min(minLat, c.lat); maxLat = Math.max(maxLat, c.lat);
    });
    try {
      if (minLng === maxLng && minLat === maxLat) {
        map.flyTo({ center: [minLng, minLat], zoom: SINGLE_STOP_ZOOM, duration: 700 });
      } else {
        map.fitBounds([[minLng, minLat], [maxLng, maxLat]], { padding: searchFitPadding || fitPadding || FIT_PADDING, maxZoom: 16, duration: 700 });
      }
    } catch { /* noop */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchSig]);

  /* Sprint 44 #3 — sync the parent's active stop into the local detail card +
     marker highlight. Matches by identity, then coordinates, so a timeline tap
     highlights the right pin; unmatched (e.g. another day) still shows a card. */
  useEffect(() => {
    if (!focusStop) { setSelected(null); setCardMin(false); return; }
    const fc = focusStop.coordinates;
    let idx = -1;
    if (fc) {
      idx = pts.findIndex((s) => s === focusStop
        || (s.coordinates && s.coordinates.lat === fc.lat && s.coordinates.lng === fc.lng
          && (s.nameHe || s.name) === (focusStop.nameHe || focusStop.name)));
    }
    setSelected({ idx, stop: idx >= 0 ? pts[idx] : focusStop });
    setCardMin(false);
  }, [focusStop, pts]);

  return (
   <>
    <Map
      ref={mapRef}
      initialViewState={{
        longitude: pts[0]?.coordinates?.lng ?? center?.lng ?? TOKYO_FALLBACK.lng,
        latitude: pts[0]?.coordinates?.lat ?? center?.lat ?? TOKYO_FALLBACK.lat,
        zoom: pts[0] ? 12 : (center?.zoom ?? TOKYO_FALLBACK.zoom),
      }}
      style={{ width: "100%", height: "100%", cursor: isPinning ? "crosshair" : (locked ? "default" : "grab") }}
      mapStyle={MAP_STYLE}
      attributionControl={false}
      /* Map Lock — toggling these viewport-interaction constraints
         dynamically freezes/restores pan, zoom and rotate gestures. */
      dragPan={!locked}
      scrollZoom={!locked}
      doubleClickZoom={!locked}
      touchZoomRotate={!locked}
      dragRotate={!locked}
      keyboard={!locked}
      onClick={(e) => {
        if (isPinning) {
          if (onMapPick) onMapPick({ lng: e.lngLat.lng, lat: e.lngLat.lat });
          return;
        }
        /* Blank-area tap — dismiss any open detail card and smoothly
           recenter the map on the clicked coordinates. Marker taps stop
           propagation, so this only fires for empty map space. */
        setSelected(null);
        setCardMin(false);
        /* Clicking empty map closes an open reference-map overlay popup too. */
        if (overlaySel && onOverlaySelect) onOverlaySelect(null);
        /* Sprint 44 #3 — an empty-map tap clears the active-stop context. */
        if (onClearActive) onClearActive();
        panToCoord(e.lngLat.lng, e.lngLat.lat);
        /* Sprint 36 #6 — tapping empty map collapses the Places Inbox. */
        if (onMapBackgroundClick) onMapBackgroundClick();
      }}
      /* Sprint 47 #3 — publish viewport bounds so the parent can bias search. */
      onLoad={() => { reportViewport(); reportBearing(); }}
      onMoveEnd={() => { reportViewport(); reportBearing(); }}
      /* Sprint 59 #6 — live bearing feedback while the user rotates the map. */
      onRotate={reportBearing}
      onMouseOut={() => setHoverCoord(null)}
      /* Sprint 29 #2 — TOUCH long-press (no contextmenu). Arm on pointer
         down, fire after 500ms if the pointer stayed within the slop
         radius; cancel on any real movement (pan) or early release. */
      onMouseDown={(e) => {
        if (isPinning || !onSaveCustomPin) return;
        const oe = e.originalEvent;
        lpStart.current = { x: oe.clientX, y: oe.clientY, lngLat: e.lngLat };
        clearTimeout(lpTimer.current);
        lpTimer.current = setTimeout(() => { if (lpStart.current) openPinDraft(lpStart.current.lngLat); }, LONGPRESS_MS);
      }}
      onTouchStart={(e) => {
        if (isPinning || !onSaveCustomPin) return;
        const t = e.originalEvent?.touches?.[0];
        lpStart.current = { x: t?.clientX ?? 0, y: t?.clientY ?? 0, lngLat: e.lngLat };
        clearTimeout(lpTimer.current);
        lpTimer.current = setTimeout(() => { if (lpStart.current) openPinDraft(lpStart.current.lngLat); }, LONGPRESS_MS);
      }}
      onMouseMove={(e) => {
        if (isPinning) setHoverCoord({ lng: e.lngLat.lng, lat: e.lngLat.lat });
        if (lpStart.current) {
          const oe = e.originalEvent;
          if (Math.hypot(oe.clientX - lpStart.current.x, oe.clientY - lpStart.current.y) > LONGPRESS_SLOP) clearLongPress();
        }
      }}
      onTouchMove={(e) => {
        if (lpStart.current) {
          const t = e.originalEvent?.touches?.[0];
          if (t && Math.hypot(t.clientX - lpStart.current.x, t.clientY - lpStart.current.y) > LONGPRESS_SLOP) clearLongPress();
        }
      }}
      onMouseUp={clearLongPress}
      onTouchEnd={clearLongPress}
      onTouchCancel={clearLongPress}
      onDragStart={clearLongPress}
    >
      {/* Ghost pin that follows the cursor while pinning (hover preview) */}
      {isPinning && hoverCoord && (
        <Marker longitude={hoverCoord.lng} latitude={hoverCoord.lat} anchor="bottom">
          <div style={{ fontSize: 30, opacity: 0.55, filter: "drop-shadow(0 2px 4px rgba(0,0,0,0.3))", pointerEvents: "none" }}>📍</div>
        </Marker>
      )}

      {/* The pin we just placed (pending — before it's added as a stop) */}
      {pendingPin && (
        <Marker longitude={pendingPin.lng} latitude={pendingPin.lat} anchor="bottom">
          <div style={{ fontSize: 36, filter: "drop-shadow(0 3px 6px rgba(0,0,0,0.35))" }}>📍</div>
        </Marker>
      )}

      {/* Sprint 7 — high-contrast accent pin for a Places search preview */}
      {previewPin && (
        <Marker longitude={previewPin.lng} latitude={previewPin.lat} anchor="bottom">
          <div style={{ position: "relative", display: "flex", flexDirection: "column", alignItems: "center" }}>
            {/* Pulsing ring */}
            <div style={{
              position: "absolute", top: "50%", left: "50%",
              transform: "translate(-50%, -50%)",
              width: 44, height: 44, borderRadius: "50%",
              background: `${ACCENT}28`,
              animation: "tp-pulse 1.6s ease-out infinite",
              pointerEvents: "none",
            }} />
            {/* Filled pin dot */}
            <div style={{
              width: 20, height: 20, borderRadius: "50%",
              background: ACCENT, border: "3px solid #fff",
              boxShadow: `0 0 0 2px ${ACCENT}, 0 4px 12px rgba(224,83,63,0.55)`,
              zIndex: 1,
            }} />
            {/* Stem */}
            <div style={{
              width: 3, height: 10, background: ACCENT,
              borderBottomLeftRadius: 2, borderBottomRightRadius: 2,
              marginTop: -1, zIndex: 1,
            }} />
          </div>
        </Marker>
      )}

      {/* Sprint 19.2 — Route polyline removed. Connecting sequential
          stops with a straight LineString drew long black vector streaks
          across the map when nodes were far apart (different cities /
          logistical gaps). Stops now render as standalone marker pins
          only; the visual order is conveyed by the numbered badges. */}

      {/* Sprint 61 #5 / 62 #4 — TRAJECTORY POLYLINE threading the numbered
          stops in order (1→2→…→N) for the active day (or the whole trip in
          continuous overview). A coral dashed line, beneath the markers so the
          numbered pins always sit on top; it re-derives on reorder / day switch. */}
      {routePath && routePath.length > 1 && (
        <Source id="tp-route-line" type="geojson" data={{ type: "Feature", properties: {}, geometry: { type: "LineString", coordinates: routePath } }}>
          <Layer id="tp-route-line-layer" type="line"
            layout={{ "line-cap": "round", "line-join": "round" }}
            paint={{ "line-color": "#FF6B6B", "line-width": 3, "line-opacity": 0.85, "line-dasharray": [2, 1] }} />
        </Source>
      )}

      {/* Sprint 22 #7 — saved-places inbox markers (neutral ★, semi-
          transparent gray, no number) — visually subordinate to the
          itinerary route pins. */}
      {savedPlaces.map((p) => (
        Number.isFinite(p.lat) && Number.isFinite(p.lng) ? (
          <Marker key={p.id} longitude={p.lng} latitude={p.lat} anchor="center"
            /* Sprint 59 #4 — saved markers are first-class interactive elements:
               a tap opens the rich details card in the parent (with the fast
               "add to this day" action) instead of being inert scenery. */
            onClick={onSavedClick ? (e) => { e.originalEvent?.stopPropagation(); onSavedClick(p); } : undefined}>
            {/* Sprint 58 #8 — subtle gray saved marker; with `savedLabels` a
                legible floating name badge sits directly beside it. */}
            <div style={{ display: "flex", alignItems: "center", gap: 5, cursor: onSavedClick ? "pointer" : "default" }}>
              <div title={p.nameHe || p.name} style={{
                flexShrink: 0, width: 22, height: 22, borderRadius: "50%",
                background: "rgba(107,113,120,0.85)", color: "#fff",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 11, border: "2px solid #fff",
                boxShadow: "0 1px 4px rgba(0,0,0,0.2)",
              }}>★</div>
              {savedLabels && (
                <span dir="auto" style={{ maxWidth: 120, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", fontSize: 11, fontWeight: 800, color: "#1E1E24", background: "rgba(255,255,255,0.92)", borderRadius: 6, padding: "2px 6px", boxShadow: "0 1px 4px rgba(0,0,0,0.18)" }}>{p.nameHe || p.name}</span>
              )}
            </div>
          </Marker>
        ) : null
      ))}

      {/* Reference-map overlay markers — a DISTINCT-color layer (teal by
          default) for points loaded from another of the user's maps. A tap
          opens the transfer card in the parent. Diamond-ish pin so it never
          reads as this trip's numbered route or the gray bank stars. */}
      {overlayPlaces.map((p, i) => {
        if (!Number.isFinite(p.lat) || !Number.isFinite(p.lng)) return null;
        const isSel = overlaySel && (overlaySel.key || overlaySel.id) === (p.key || p.id);
        return (
          <Marker key={p.key || p.id || `ov-${i}`} longitude={p.lng} latitude={p.lat} anchor="center"
            onClick={(e) => { e.originalEvent?.stopPropagation(); onOverlaySelect && onOverlaySelect(p); if (onOverlayClick) onOverlayClick(p); }}>
            <div style={{ display: "flex", alignItems: "center", gap: 5, cursor: "pointer" }}>
              <div title={p.nameHe || p.name} style={{
                flexShrink: 0, width: isSel ? 24 : 20, height: isSel ? 24 : 20, borderRadius: "6px 6px 6px 2px",
                background: overlayColor, color: "#fff", transform: "rotate(45deg)",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 9, fontWeight: 800, border: `2px solid ${isSel ? "#0D0F11" : "#fff"}`,
                boxShadow: isSel ? "0 2px 9px rgba(0,0,0,0.4)" : "0 1px 5px rgba(0,0,0,0.28)", transition: "all 0.12s",
              }}><span style={{ transform: "rotate(-45deg)" }}>◆</span></div>
              <span dir="auto" style={{ maxWidth: 120, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", fontSize: 11, fontWeight: 800, color: "#fff", background: overlayColor, borderRadius: 6, padding: "2px 6px", boxShadow: "0 1px 4px rgba(0,0,0,0.18)" }}>{p.nameHe || p.name}</span>
            </div>
          </Marker>
        );
      })}

      {/* Live search-result markers — numbered accent pins matching the search
          dropdown rows, so the user sees WHERE each result sits before picking.
          A tap previews that result (fly + pin + card) exactly like the list. */}
      {searchResults.map((p, i) => {
        if (!Number.isFinite(p.lat) || !Number.isFinite(p.lng)) return null;
        return (
          <Marker key={p.placeId || `sr-${i}`} longitude={p.lng} latitude={p.lat} anchor="center"
            onClick={(e) => { e.originalEvent?.stopPropagation(); if (onSearchResultClick) onSearchResultClick(p); }}>
            <div style={{ display: "flex", alignItems: "center", gap: 5, cursor: "pointer" }}>
              <div title={p.name} style={{
                flexShrink: 0, width: 24, height: 24, borderRadius: "50%",
                background: "#E0533F", color: "#fff",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 12, fontWeight: 800, border: "2px solid #fff",
                boxShadow: "0 2px 8px rgba(224,83,63,0.5)",
              }}>{i + 1}</div>
              <span dir="auto" style={{ maxWidth: 130, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", fontSize: 11, fontWeight: 800, color: "#fff", background: "#E0533F", borderRadius: 6, padding: "2px 6px", boxShadow: "0 1px 4px rgba(0,0,0,0.18)" }}>{p.name}</span>
            </div>
          </Marker>
        );
      })}

      {/* Overlay point INFO popup — photo, name, rating, note + quick actions
          to add the point to the active day OR the bank (מפות נוספות). */}
      {overlaySel && Number.isFinite(overlaySel.lat) && Number.isFinite(overlaySel.lng) && (
        <Popup longitude={overlaySel.lng} latitude={overlaySel.lat} anchor="bottom" offset={24}
          closeButton={false} closeOnClick={false} maxWidth="280px" className="tp-map-popup"
          onClose={() => onOverlaySelect && onOverlaySelect(null)}>
          {/* Styled like the app's point card: photo header, title, meta, note, action. */}
          <div dir="rtl" style={{ width: compactCard ? 214 : 248, fontFamily: "'Noto Sans Hebrew',system-ui,sans-serif", position: "relative", background: "#fff", borderRadius: 14, overflow: "hidden", boxShadow: "0 10px 34px rgba(0,0,0,0.28)" }}>
            {/* Cover photo */}
            <div style={{ position: "relative", height: compactCard ? 64 : 96, borderRadius: "12px 12px 0 0", overflow: "hidden", background: "#E8E8E6" }}>
              <img src={(overlaySelPhotos[photoKey(overlaySel)]) || photoStrict(overlaySel)} alt="" loading="lazy" onError={onPhotoErrorStrict()}
                style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
              <span aria-hidden style={{ position: "absolute", top: 8, insetInlineEnd: 8, width: 22, height: 22, borderRadius: 6, background: overlayColor, display: "inline-flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 10, boxShadow: "0 1px 4px rgba(0,0,0,0.3)" }}>◆</span>
              <button onClick={() => onOverlaySelect && onOverlaySelect(null)} aria-label="סגירה"
                style={{ position: "absolute", top: 8, insetInlineStart: 8, width: 26, height: 26, borderRadius: "50%", border: "none", background: "rgba(0,0,0,0.5)", color: "#fff", cursor: "pointer", fontFamily: "inherit", fontSize: 13, fontWeight: 800, display: "inline-flex", alignItems: "center", justifyContent: "center", backdropFilter: "blur(4px)" }}>✕</button>
            </div>
            {/* Body — matches the regular searched-point card. */}
            <div style={{ padding: compactCard ? "8px 11px 11px" : "10px 12px 12px", maxHeight: compactCard ? "38vh" : "46vh", overflowY: "auto" }}>
              <div dir="auto" style={{ fontSize: compactCard ? 14 : 15, fontWeight: 800, color: "#0D0F11", lineHeight: 1.25 }}>{overlaySel.nameHe || overlaySel.name}</div>
              <div style={{ fontSize: 11.5, color: "#6B7178", marginTop: 2, fontWeight: 600 }}>{[overlaySel.rating ? `★ ${overlaySel.rating}` : "", overlaySel.category].filter(Boolean).join(" · ") || "מפה נוספת"}</div>
              {overlaySel.note && !compactCard && (
                <div dir="auto" style={{ fontSize: 11.5, color: "#2A3036", background: "#F4F4F2", borderRadius: 8, padding: "6px 9px", marginTop: 8, lineHeight: 1.45, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>📝 {overlaySel.note}</div>
              )}
              {overlaySel.note && compactCard && (
                <div dir="auto" style={{ fontSize: 11, color: "#2A3036", background: "#F4F4F2", borderRadius: 7, padding: "5px 8px", marginTop: 6, lineHeight: 1.4, maxHeight: 44, overflow: "hidden" }}>📝 {overlaySel.note}</div>
              )}
              {/* Day picker — a single HORIZONTAL scroll row (compact even for a
                  long trip, instead of a tall wrapping grid). */}
              {onOverlayAddDay && days.length > 0 && (
                <>
                  <div style={{ fontSize: 11, fontWeight: 800, color: "#8B9198", margin: compactCard ? "8px 0 5px" : "11px 0 6px" }}>לאיזה יום להוסיף?</div>
                  <div style={{ display: "flex", gap: 5, overflowX: "auto", paddingBottom: 4, marginBottom: 8, WebkitOverflowScrolling: "touch" }} className="tp-noscrollbar">
                    {days.map((d) => {
                      const on = (overlayDay ?? overlayActiveDay) === d.day;
                      return (
                        <button key={d.day} onClick={() => setOverlayDay(d.day)} title={d.cityHe || d.city || `יום ${d.day}`}
                          style={{ flexShrink: 0, minWidth: 32, height: 32, borderRadius: 8, cursor: "pointer", border: `1px solid ${on ? overlayColor : "rgba(20,20,20,0.14)"}`, background: on ? overlayColor : "#fff", color: on ? "#fff" : "#2A3036", fontFamily: "inherit", fontSize: 12.5, fontWeight: 800 }}>
                          {d.day}
                        </button>
                      );
                    })}
                  </div>
                  <button onClick={() => onOverlayAddDay(overlaySel, overlayDay ?? overlayActiveDay)}
                    style={{ width: "100%", height: compactCard ? 38 : 42, borderRadius: 11, border: "none", background: overlayColor, color: "#fff", fontSize: 13.5, fontWeight: 800, cursor: "pointer", fontFamily: "inherit" }}>
                    ＋ הוספה ליום {overlayDay ?? overlayActiveDay ?? ""}
                  </button>
                </>
              )}
              {onOverlayAddBank && (
                <button onClick={() => onOverlayAddBank(overlaySel)}
                  style={{ width: "100%", height: 36, marginTop: 7, borderRadius: 11, border: `1px solid ${overlayColor}`, background: "#fff", color: overlayColor, fontSize: 12.5, fontWeight: 800, cursor: "pointer", fontFamily: "inherit" }}>
                  🔖 שמירה לבנק הנקודות
                </button>
              )}
              {/* Google Maps — always available for the real listing. */}
              <button onClick={() => { const u = mapsUrlFor(overlaySel); if (u) window.open(u, "_blank", "noopener,noreferrer"); }}
                style={{ width: "100%", height: 36, marginTop: 7, borderRadius: 11, border: "1px solid rgba(20,20,20,0.14)", background: "#fff", color: "#2A3036", fontSize: 12, fontWeight: 800, cursor: "pointer", fontFamily: "inherit", display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
                <Icon name="map" size={14} strokeWidth={2} color="#2A3036" /> פתח ב-Google Maps
              </button>
            </div>
          </div>
        </Popup>
      )}

      {pts.map((s, i) => {
        const isSel = selected && selected.idx === i;
        const label = s.nameHe || s.name || "";
        /* Sprint 42 #1 — continuous mode passes a GLOBAL `_seq` per stop so
           the pin badge matches the continuous timeline (1..N); otherwise
           fall back to the per-day index. */
        const badgeNum = s._seq ?? (i + 1);
        return (
          /* Sprint 36 #5 — composite render key (id/place_id + index) so the
             SAME place can appear multiple times in a day without React
             key collisions. */
          <Marker key={`${s.place_id || s.id || s.name || "pin"}-${i}`} longitude={s.coordinates.lng} latitude={s.coordinates.lat} anchor="center"
            onClick={(e) => {
              e.originalEvent?.stopPropagation();
              setSelected({ idx: i, stop: s });
              setCardMin(false);
              if (cropOnClick) flyToStop(s.coordinates.lng, s.coordinates.lat);
              else panToCoord(s.coordinates.lng, s.coordinates.lat);
              /* Sprint 44 #3 — mirror into the parent's active-stop context. */
              if (onActiveStop) onActiveStop(s);
              if (onMarkerClick) onMarkerClick(s, i);
            }}
          >
            {/* Sprint 36 #14 — pin + high-contrast NAME LABEL bubble beside
                it (no more anonymous pins). */}
            <div style={{ display: "flex", alignItems: "center", gap: 5, cursor: "pointer", transform: isSel ? "scale(1.08)" : "scale(1)", transition: "transform 0.18s ease" }}>
              {/* Sprint 42 #2 — 40x40 transparent hit-area around the 26px disc
                  (negative margins keep the visual footprint unchanged) so
                  mobile taps land reliably. */}
              <div style={{ width: 40, height: 40, margin: -7, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <div style={{
                width: 26, height: 26, borderRadius: "50%", background: color,
                color: "#fff", display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 12, fontWeight: 800, border: `2px solid #fff`,
                boxShadow: isSel ? `0 0 0 3px ${ACCENT}, 0 4px 12px rgba(0,0,0,0.3)` : "0 2px 6px rgba(0,0,0,0.25)",
                fontFamily: "'Noto Sans Hebrew','Inter',sans-serif",
                transition: "box-shadow 0.18s ease",
              }}>{badgeNum}</div>
              </div>
              {label && (
                <span dir="auto" style={{
                  maxWidth: 128, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                  fontSize: 11.5, fontWeight: 700, lineHeight: 1.3,
                  color: "#0D0F11", background: "rgba(255,255,255,0.94)",
                  border: `1px solid ${isSel ? ACCENT : "rgba(20,20,20,0.10)"}`,
                  borderRadius: 8, padding: "2px 7px",
                  boxShadow: "0 2px 6px rgba(0,0,0,0.18)",
                  fontFamily: "'Noto Sans Hebrew','Inter',sans-serif",
                  /* D6 — alternate the label a few px up/down by stop index so two
                     geographically-adjacent stops (a common itinerary pattern, e.g.
                     a cafe next to a shrine) don't stack their name bubbles on the
                     same screen row and read as one overlapping blob. */
                  transform: `translateY(${i % 2 ? 9 : -9}px)`,
                }}>{label}</span>
              )}
            </div>
          </Marker>
        );
      })}

      {/* Sprint 29 #2 — draft custom pin: the temp marker only. The
          input UI is a centered modal rendered OUTSIDE the map (below),
          so typing never touches the canvas. */}
      {pinDraft && (
        <Marker longitude={pinDraft.lng} latitude={pinDraft.lat} anchor="bottom">
          <div style={{ fontSize: 34, filter: "drop-shadow(0 3px 6px rgba(0,0,0,0.35))", pointerEvents: "none" }}>📍</div>
        </Marker>
      )}

      {/* Desktop cockpit — the info card as a native maplibre Popup anchored to
          the point: maplibre keeps it glued to the coordinate through pans/zooms
          and flips it above↔below near the map edge. The parent styles the card;
          we only strip the default popup chrome (see the <style> below). */}
      {cardCoord && renderCard && Number.isFinite(cardCoord.lat) && Number.isFinite(cardCoord.lng) && (
        <Popup
          longitude={cardCoord.lng}
          latitude={cardCoord.lat}
          anchor="bottom"
          offset={22}
          closeButton={false}
          closeOnClick={false}
          closeOnMove={false}
          maxWidth="none"
          className="tp-map-popup"
        >
          {renderCard()}
        </Popup>
      )}
    </Map>

    {/* Strip maplibre's default popup chrome for our custom card popup — the
        card supplies its own background/radius/shadow; we only kill the white
        bubble, padding and tip so it reads as a clean floating card on the point. */}
    <style>{`
      .tp-map-popup .maplibregl-popup-content { background: transparent !important; padding: 0 !important; box-shadow: none !important; border-radius: 18px !important; }
      .tp-map-popup .maplibregl-popup-tip { display: none !important; }
      .tp-map-popup { z-index: 40; }
    `}</style>

    {/* ══ Sprint 29 #1 — marker detail BOTTOM SHEET (replaces the
        outdated MapLibre Popup / Google InfoWindow). Rendered outside the
        map canvas so its lifecycle never re-renders the map. ══ */}
    {/* Sprint 44 #3 — the detail card is now a bottom-anchored sheet with NO
        blocking backdrop, so the map stays fully tappable behind it (a marker
        stays highlighted while the card is up). It can be MINIMIZED to a slim
        bar, and only the X (or an empty-map tap) clears the active stop. */}
    {selected && selected.stop && !cropOnClick && (
      <div style={{ position: "fixed", insetInlineStart: 0, insetInlineEnd: 0, bottom: 0, zIndex: 58, display: "flex", justifyContent: "center", pointerEvents: "none", fontFamily: "'Noto Sans Hebrew','Inter',sans-serif" }}>
        <div dir="rtl" className="tp-sheet-up"
          onTouchStart={onCardTouchStart} onTouchMove={onCardTouchMove} onTouchEnd={onCardTouchEnd}
          style={{
          pointerEvents: "auto", position: "relative", width: "100%", maxWidth: 560, background: "#fff",
          borderTopLeftRadius: 24, borderTopRightRadius: 24,
          boxShadow: "0 -20px 60px rgba(0,0,0,0.24)", maxHeight: cardMin ? "none" : "82vh", overflowY: cardMin ? "visible" : "auto",
        }}>
          {/* Minimized slim bar. */}
          {cardMin ? (
            <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 16px" }}>
              <span style={{ flexShrink: 0, width: 26, height: 26, borderRadius: "50%", background: color, color: "#fff", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 800 }}>{selected.stop._seq ?? (selected.idx >= 0 ? selected.idx + 1 : "•")}</span>
              <span style={{ flex: 1, minWidth: 0, fontSize: 15, fontWeight: 800, color: "#0D0F11", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{selected.stop.nameHe || selected.stop.name || "תחנה"}</span>
              <button onClick={() => setCardMin(false)} title="הרחבה" aria-label="הרחבה" style={{ width: 34, height: 34, borderRadius: "50%", border: "none", background: "#F6F6F4", color: "#2A3036", cursor: "pointer", fontFamily: "inherit" }}>▴</button>
              <button onClick={closeCard} title="סגירה" aria-label="סגירה" style={{ width: 34, height: 34, borderRadius: "50%", border: "none", background: "#F6F6F4", color: "#2A3036", cursor: "pointer", fontFamily: "inherit" }}>✕</button>
            </div>
          ) : (
          <div style={{ padding: "10px 18px 24px" }}>
          {/* Header: Sprint 45 #8 — 44x44 minimize hit target (centered handle
              wrapped in a full-width tappable band) + explicit ▾ minimize +
              ✕ close controls (always present, independent of the photo). */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", position: "relative", marginBottom: 10 }}>
            <button onClick={() => setCardMin(true)} title="מזעור" aria-label="מזעור"
              style={{ width: 88, height: 44, border: "none", background: "transparent", cursor: "pointer", display: "inline-flex", alignItems: "center", justifyContent: "center", padding: 0 }}>
              <span aria-hidden style={{ width: 44, height: 5, borderRadius: 999, background: "rgba(20,20,20,0.18)" }} />
            </button>
            <button onClick={() => setCardMin(true)} title="מזעור" aria-label="מזעור" style={{ position: "absolute", insetInlineEnd: 44, top: 0, width: 44, height: 44, borderRadius: "50%", border: "none", background: "#F6F6F4", color: "#6B7178", cursor: "pointer", fontFamily: "inherit", fontSize: 16 }}>▾</button>
            {/* Sprint 52 #4 — prominent, high-contrast ✕ close at the sheet's
                top perimeter: instantly unmounts the active place view (works
                alongside the swipe-down gesture). */}
            <button onClick={closeCard} title="סגירה" aria-label="סגירה" className="tp-press" style={{ position: "absolute", insetInlineEnd: 0, top: -2, width: 44, height: 44, borderRadius: "50%", border: "2px solid #fff", background: "#0D0F11", color: "#fff", cursor: "pointer", fontFamily: "inherit", display: "inline-flex", alignItems: "center", justifyContent: "center", boxShadow: "0 3px 12px rgba(0,0,0,0.28)" }}><Icon name="x" size={17} strokeWidth={2.6} /></button>
          </div>

          {/* Sprint 47 #1 — the photo renders ONLY when a real Google image is
              present and loads. On absence/failure the block is display:none so
              the title + CTA snap upward (no crossed-out placeholder). */}
          {(() => {
            // Real Google Maps photo → Street View → neutral placeholder
            // (honest: never a misleading category stock image).
            const k = photoKey(selected.stop);
            const photo = (k && selPhotos[k]) || photoStrict(selected.stop);
            return (
              <div style={{ height: 160, borderRadius: 16, marginBottom: 14, position: "relative", overflow: "hidden", background: `linear-gradient(145deg, ${color}, ${color}99)` }}>
                <img
                  src={photo}
                  alt={selected.stop.nameHe || selected.stop.name || ""}
                  onError={onPhotoErrorStrict()}
                  style={{ width: "100%", height: "100%", objectFit: "cover", display: "block", borderRadius: 16 }}
                />
              </div>
            );
          })()}

          {/* Title + category chip */}
          <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
            <span style={{ flexShrink: 0, width: 26, height: 26, borderRadius: "50%", background: color, color: "#fff", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 800, marginTop: 2 }}>{selected.stop?._seq ?? (selected.idx + 1)}</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 19, fontWeight: 800, color: "#0D0F11", lineHeight: 1.2 }}>{selected.stop.nameHe || selected.stop.name || "תחנה"}</div>
              {selected.stop.name && selected.stop.nameHe && selected.stop.name !== selected.stop.nameHe && (
                <div style={{ fontSize: 12.5, color: "#6B7178", marginTop: 1, direction: "ltr", textAlign: "right" }}>{selected.stop.name}</div>
              )}
            </div>
          </div>

          {/* Metadata row — rating stars + formatted address */}
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 12, alignItems: "center" }}>
            {selected.stop.category && (
              <span style={{ fontSize: 11.5, fontWeight: 700, color: "#2A3036", background: "#F6F6F4", borderRadius: 999, padding: "4px 11px" }}>{selected.stop.category}</span>
            )}
            {selected.stop.rating && (
              <span style={{ fontSize: 11.5, fontWeight: 800, color: "#B87503", background: "#FBF3D9", borderRadius: 999, padding: "4px 11px" }}>★ {selected.stop.rating}</span>
            )}
          </div>
          {/* Sprint 31 #2 — Google editorial snippet (secondary, muted). */}
          {(selected.stop.description || selected.stop.editorial_summary || selected.stop.snippet) && (
            <div style={{ marginTop: 10, fontSize: 13, color: "#6B7178", lineHeight: 1.5 }}>
              {selected.stop.description || selected.stop.editorial_summary || selected.stop.snippet}
            </div>
          )}
          {(selected.stop.address || selected.stop.formatted_address) && (
            <div style={{ display: "flex", alignItems: "flex-start", gap: 6, marginTop: 10, fontSize: 12.5, color: "#6B7178", lineHeight: 1.45 }}>
              <span style={{ marginTop: 1, flexShrink: 0, display: "inline-flex" }}><Icon name="pin" size={13} strokeWidth={1.8} /></span>
              <span>{selected.stop.address || selected.stop.formatted_address}</span>
            </div>
          )}
          {/* User's own note — kept distinct from the Google snippet. */}
          {selected.stop.note && (
            <div style={{ marginTop: 10, fontSize: 13.5, fontWeight: 600, color: "#0D0F11", lineHeight: 1.5 }}>{selected.stop.note}</div>
          )}

          {/* Primary CTA — open in Google Maps */}
          <button onClick={() => openInGoogleMaps(selected.stop)} className="tp-press"
            style={{ marginTop: 16, width: "100%", height: 52, borderRadius: 999, border: "none", background: "#0D0F11", color: "#fff", fontSize: 15, fontWeight: 800, cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
            <Icon name="map" size={17} strokeWidth={2} color="#fff" /> פתח ב-Google Maps
          </button>

          {/* Sprint 57 #3 — spatial query anchored on this committed stop. */}
          {onSearchAround && selected.stop.coordinates && Number.isFinite(selected.stop.coordinates.lat) && (
            <button onClick={() => onSearchAround(selected.stop)} className="tp-press"
              style={{ marginTop: 10, width: "100%", height: 46, borderRadius: 999, border: "1.5px solid #E4E4E8", background: "#fff", color: "#1E1E24", fontSize: 13.5, fontWeight: 800, cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", justifyContent: "center", gap: 7 }}>
              <Icon name="search" size={16} strokeWidth={2} color="#1E1E24" /> מצא מקומות באזור
            </button>
          )}

          {/* Sprint 27 #3 — map→timeline quick-edit bridge (kept) */}
          {hasTransit && onEditTransit && (
            <button onClick={() => { closeCard(); onEditTransit(); }}
              style={{ marginTop: 10, width: "100%", height: 46, borderRadius: 999, border: "1.5px dashed #FF6B6B", background: "rgba(255,107,107,0.06)", color: "#FF6B6B", fontSize: 13.5, fontWeight: 800, cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
              <Icon name="plane" size={15} strokeWidth={2} color="#FF6B6B" /> ערוך מעבר
            </button>
          )}
          </div>
          )}
        </div>
      </div>
    )}

    {/* ══ Sprint 29 #2 — custom-pin CENTERED MODAL (replaces the boxy
        inline popover). Modern: bg-white, heavy shadow, rounded-2xl,
        soft-grey inputs, accented שמור + muted ביטול. ══ */}
    {pinDraft && (
      <div style={{ position: "fixed", inset: 0, zIndex: 60, display: "flex", alignItems: "center", justifyContent: "center", padding: 24, fontFamily: "'Noto Sans Hebrew','Inter',sans-serif" }}>
        <div onClick={cancelPinDraft} className="tp-fade" style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.45)" }} />
        <div dir="rtl" className="tp-pop" style={{
          position: "relative", width: "100%", maxWidth: 360, background: "#fff",
          borderRadius: 24, padding: "22px 20px",
          boxShadow: "0 30px 80px rgba(0,0,0,0.35), 0 6px 20px rgba(0,0,0,0.18)",
        }}>
          <div style={{ fontSize: 18, fontWeight: 800, color: "#0D0F11", marginBottom: 4 }}>רוצה לשמור את הנקודה?</div>
          <div style={{ fontSize: 12.5, color: "#6B7178", marginBottom: 16 }}>נקודה אישית על המפה — הוסיפו שם ותיאור קצר.</div>
          <input
            autoFocus
            value={pinName}
            onChange={(e) => setPinName(e.target.value)}
            placeholder="שם"
            style={{ width: "100%", boxSizing: "border-box", height: 48, borderRadius: 14, border: `1.5px solid ${pinName ? "#0D0F11" : "rgba(20,20,20,0.12)"}`, background: "#F6F6F4", padding: "0 14px", fontSize: 15, fontFamily: "inherit", direction: "rtl", textAlign: "right", marginBottom: 10, transition: "border-color 0.15s" }}
          />
          <input
            value={pinNote}
            onChange={(e) => setPinNote(e.target.value)}
            placeholder="הסבר"
            style={{ width: "100%", boxSizing: "border-box", height: 48, borderRadius: 14, border: "1.5px solid rgba(20,20,20,0.12)", background: "#F6F6F4", padding: "0 14px", fontSize: 15, fontFamily: "inherit", direction: "rtl", textAlign: "right", marginBottom: 16 }}
          />

          {/* Sprint 34 — where-to-save context selector. */}
          <div style={{ fontSize: 12, fontWeight: 800, color: "#6B7178", marginBottom: 8 }}>איפה לשמור?</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: pinSaveMode === "day" ? 10 : 18 }}>
            {[
              { mode: "inbox", label: "📥 בנק הנקודות הכללי (לא משובץ)" },
              { mode: "day", label: "📅 יום ספציפי" },
            ].map((o) => {
              const on = pinSaveMode === o.mode;
              return (
                <button key={o.mode} onClick={() => { setPinSaveMode(o.mode); if (o.mode === "inbox") setPinDay(null); }}
                  aria-pressed={on}
                  style={{
                    display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8,
                    width: "100%", boxSizing: "border-box", padding: "12px 14px", borderRadius: 14, cursor: "pointer",
                    fontFamily: "inherit", fontSize: 13.5, fontWeight: 700, textAlign: "right",
                    border: `1.5px solid ${on ? "#0D0F11" : "rgba(20,20,20,0.12)"}`,
                    background: on ? "rgba(13,15,17,0.04)" : "#fff", color: "#0D0F11",
                    transition: "border-color 0.15s, background 0.15s",
                  }}>
                  <span>{o.label}</span>
                  <span aria-hidden style={{ width: 18, height: 18, borderRadius: "50%", flexShrink: 0, border: `2px solid ${on ? "#0D0F11" : "rgba(20,20,20,0.25)"}`, background: on ? "#0D0F11" : "transparent", display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
                    {on && <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#fff" }} />}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Sprint 34 — scrollable day list when "specific day" is chosen. */}
          {pinSaveMode === "day" && (
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", maxHeight: 132, overflowY: "auto", marginBottom: 18, padding: 2 }}>
              {days.length ? days.map((d) => {
                const on = pinDay === d.day;
                return (
                  <button key={d.day} onClick={() => setPinDay(d.day)}
                    style={{ minWidth: 56, padding: "8px 10px", borderRadius: 12, cursor: "pointer", fontFamily: "inherit", textAlign: "center",
                      border: `1.5px solid ${on ? "#0D0F11" : "rgba(20,20,20,0.12)"}`, background: on ? "#0D0F11" : "#F6F6F4", color: on ? "#fff" : "#0D0F11", transition: "background 0.15s, color 0.15s" }}>
                    <span style={{ display: "block", fontSize: 14, fontWeight: 800 }}>יום {d.day}</span>
                    <span style={{ display: "block", fontSize: 10, opacity: 0.75, marginTop: 1 }}>{d.cityHe || d.city || ""}</span>
                  </button>
                );
              }) : (
                <div style={{ fontSize: 12.5, color: "#8B9198", padding: "8px 2px" }}>אין ימים במסלול עדיין</div>
              )}
            </div>
          )}

          <button onClick={savePinDraft} disabled={!canSavePin} className="tp-press"
            style={{ width: "100%", height: 52, borderRadius: 999, border: "none", background: canSavePin ? ACCENT : "#D1CCC5", color: "#fff", fontSize: 15.5, fontWeight: 800, cursor: canSavePin ? "pointer" : "default", fontFamily: "inherit", boxShadow: canSavePin ? `0 6px 20px ${ACCENT}55` : "none" }}>
            שמור
          </button>
          <button onClick={cancelPinDraft}
            style={{ width: "100%", height: 44, marginTop: 6, borderRadius: 999, border: "none", background: "transparent", color: "#6B7178", fontSize: 14, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
            ביטול
          </button>
        </div>
      </div>
    )}
   </>
  );
};

export default EditorMap;
