import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import tripService from "../services/tripService";
import EditorBottomSheet from "../components/EditorBottomSheet";
import EditorMap from "../components/EditorMap";
import ReferenceMapsPanel from "../components/ReferenceMapsPanel";
import OverlayAddChoice from "../components/OverlayAddChoice";
import AddStopSheet from "../components/AddStopSheet";
import AddTransitSheet from "../components/AddTransitSheet";
import StopActionsSheet from "../components/StopActionsSheet";
import EditorSearchBar from "../components/EditorSearchBar";
import PlaceInfoCard from "../components/PlaceInfoCard";
import NoteSheet from "../components/NoteSheet";
import NearbySearchSheet from "../components/NearbySearchSheet";
import NearbyResultsPanel from "../components/NearbyResultsPanel";
import FavoriteButton from "../components/FavoriteButton";
import { listFavoriteIds } from "../services/favoritesService";
import { track } from "../analytics/posthog";
import { boundsForDestination, autocomplete, getDetails, isPlacesEnabled, nearbySearch } from "../services/googlePlaces";
import { computeTransit } from "../utils/transit";
import { dedupeDayStops, categoryEmoji, classifyLocation } from "../utils/classify";
import { readPrefs } from "../services/prefsService";
import { listInboxPlaces, addInboxPlaces, removeInboxPlace, updateInboxPlace } from "../services/googleSavedPlaces";
import { uploadAttachment, removeStoredFile } from "../services/attachmentService";
import TripFilesSheet from "../components/TripFilesSheet";
import { newFileId, remapFileDays } from "../utils/tripFiles";
import useActiveTrip from "../utils/useActiveTrip";
import Icon from "../components/Icon";
import { setDocTitle, titleForTrip, DEFAULT_TITLE } from "../utils/docTitle";
import mapsUrlFor from "../utils/mapsUrl";
import { photoStrict, onPhotoErrorStrict } from "../utils/placePhoto";
import usePlacePhotos, { photoKey } from "../utils/usePlacePhotos";
import { pillDateLabel, fullDateLabel, dateRangeLabel, numericDate, parseStartDate } from "../utils/tripDates";
import CalendarRangePicker from "../components/CalendarRangePicker";

/* ──────────────────────────────────────────────────────────────
   EditorView — mobile-first trip workspace.

   PHASE 3 (shell): a full-viewport map placeholder behind a 3-snap
   EditorBottomSheet. The sheet hosts the day strip + the active
   day's stop list rendered from the loaded trip payload, with an
   "add stop" affordance and an empty-state for brand-new trips.

   Next: real MapLibre canvas + Google Places search / manual pin
   drop / drag-reorder / transit calc (spec §4–§7).
   ────────────────────────────────────────────────────────────── */

const T = {
  ink: "#0D0F11", ink2: "#2A3036", ink3: "#6B7178", ink4: "#A4AAB1",
  line: "rgba(20,20,20,0.08)", surface: "#F6F6F4", accent: "#E0533F",
  font: "'Noto Sans Hebrew','Inter','Noto Sans JP',system-ui,sans-serif",
};

/* City → accent color (mirrors blueprint city tokens). */
/* Sprint 37 #5 — robust city→color map. Each region gets a distinct SOFT,
   readable hue (white text sits on top of these as pill/disc backgrounds).
   Tokyo → soft purple, Kyoto → soft green, Osaka → soft orange, etc.
   Cities not listed fall back to a deterministic pastel derived from the
   name so every day-pill still shows a stable, distinct color (never the
   old flat dark ink). */
const CITY_COLOR = {
  Tokyo: "#8B7BC7", "Tokyo Disney": "#8B7BC7", "Tokyo DisneySea": "#8B7BC7",
  Kyoto: "#5FA36A", Arashiyama: "#5FA36A",
  Osaka: "#E0915A", "Osaka Universal": "#E0915A",
  Nara: "#C7A24E", Nagoya: "#C79A4E",
  Hakone: "#4E9E94", Kawaguchiko: "#4E9E94", "Mt Fuji": "#4E9E94",
  Kanazawa: "#C77BA6", Takayama: "#7FA05A", Matsumoto: "#6E8BC4",
  Hiroshima: "#D67B7B", Miyajima: "#D67B7B",
  Sapporo: "#6FB0C4", Fukuoka: "#C4886E", Nikko: "#7BAF8A",
};
/* Deterministic soft fallback: hash the base city name → a fixed-S/L hue so
   unknown cities get a consistent, legible color instead of dark ink. */
const cityHashColor = (name) => {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) % 360;
  return `hsl(${h}, 48%, 58%)`;
};
const cityColor = (c) => {
  const base = (c || "").replace(/ \d+$/, "").trim();
  if (!base) return T.ink;
  return CITY_COLOR[base] || cityHashColor(base);
};
const cityAbbr = (c) => (c || "").slice(0, 3).toUpperCase();

/* Sprint 61 #2 — a fresh per-instance UUID so the SAME place can appear on
   several days without React key collisions or shared-state bleed. */
const genInstanceId = () => (
  (typeof crypto !== "undefined" && crypto.randomUUID)
    ? crypto.randomUUID()
    : `inst-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
);

/* Sprint 61 #1 — stable identity of a PLACE (not an instance): used to find
   every occurrence of the same location across the itinerary for the note
   cascade. Falls back through Google place_id → stored id → coordinates → name. */
const placeKeyOf = (a) => {
  if (!a) return "";
  if (a.place_id) return `pid:${a.place_id}`;
  if (a.id) return `id:${a.id}`;
  const c = a.coordinates;
  if (c && Number.isFinite(c.lat) && Number.isFinite(c.lng)) return `geo:${c.lat.toFixed(5)},${c.lng.toFixed(5)}`;
  return `name:${(a.nameHe || a.name || "").trim()}`;
};

/* Coarse bucket from the Hebrew category text (spec §8 filters). */
const categoryBucket = (he = "") => {
  if (/מלון|לינה/.test(he)) return "hotels";
  if (/ראמן|סושי|אודון|סובה|גיוזה|מסעד|בית קפה|קפה|בר|אוכל|המבורגר|פיצה|פנקייק|קינוח|קונביני|מאפייה/.test(he)) return "food";
  return "attractions";
};
const FILTERS = [
  { id: "all", label: "הכל" },
  { id: "attractions", label: "אטרקציות" },
  { id: "food", label: "אוכל" },
  { id: "hotels", label: "מלונות" },
];

/* ── Sprint 23 #6 — Collapsible universal category filter ──
   A single sleek trigger ("🏷️ סינון מפה") that expands the category
   pills on demand instead of pinning them permanently to the layout.
   Mounted both on the timeline sheet header AND inside the saved-places
   inbox drawer, so filtering behaves identically everywhere. */
const CollapsibleFilter = ({ open, onToggle, value, onChange, label = "סינון מפה" }) => {
  const active = value !== "all";
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
      <button onClick={onToggle} aria-expanded={open} title="סינון לפי קטגוריה"
        style={{
          flexShrink: 0, display: "inline-flex", alignItems: "center", gap: 6,
          padding: "5px 12px", borderRadius: 999, cursor: "pointer", fontFamily: "inherit",
          border: `1px solid ${active ? T.ink : T.line}`,
          background: active ? T.ink : "#fff", color: active ? "#fff" : T.ink2,
          fontSize: 12, fontWeight: 700, transition: "background 0.2s, color 0.2s",
        }}>
        <span aria-hidden>🏷️</span> {label}
        {active && <span aria-hidden style={{ width: 6, height: 6, borderRadius: "50%", background: T.accent }} />}
        <span aria-hidden style={{ display: "inline-block", transform: open ? "rotate(180deg)" : "none", transition: "transform 0.2s ease", fontSize: 10 }}>⌄</span>
      </button>
      {open && FILTERS.map((f) => {
        const on = value === f.id;
        return (
          <button key={f.id} onClick={() => onChange(f.id)} className="tp-fade"
            style={{
              flexShrink: 0, padding: "5px 12px", borderRadius: 999, cursor: "pointer", fontFamily: "inherit",
              border: `1px solid ${on ? T.ink : T.line}`, background: on ? T.ink : "#fff",
              color: on ? "#fff" : T.ink2, fontSize: 12, fontWeight: 600,
            }}>
            {f.label}
          </button>
        );
      })}
    </div>
  );
};

/* ── Sprint 32 — unified Add trigger ──────────────────────────────
   A single "+" button that toggles a lightweight, absolute-positioned
   dropdown with exactly two options: 📍 add a location (→ the omnibox /
   pin-placement flow) and ✈️ add a major transit (→ AddTransitSheet).
   Replaces the old side-by-side black-plus + dashed-orange-plane pair.
   Used at BOTH entry points (bottom FAB + day-header chip) via the
   `variant` prop, which also drives placement so the menu never
   overflows the sheet.
     • variant "fab"    — 52px solid button, menu opens ABOVE, centered
     • variant "header" — 28px outline chip, menu opens BELOW-left     */
const AddMenu = ({ onAddLocation, onAddTransit, variant = "fab" }) => {
  const [open, setOpen] = useState(false);
  const isFab = variant === "fab";
  const pick = (fn) => { setOpen(false); fn && fn(); };
  const btnStyle = isFab
    ? { width: 52, height: 52, borderRadius: "50%", border: "none", background: T.ink, color: "#fff", boxShadow: "0 4px 14px rgba(0,0,0,0.18)" }
    : { width: 28, height: 28, borderRadius: "50%", border: `1px solid ${T.line}`, background: "#fff", color: T.ink2, boxShadow: "0 1px 4px rgba(0,0,0,0.06)" };
  /* Placement is physical (not logical) to guarantee on-screen fit: the
     bottom FAB is centered with room both sides → open above, centered;
     the header chip sits mid-right in the sheet → anchor the menu's RIGHT
     edge to the button and grow LEFT (toward center) so it never clips
     the viewport's right edge. */
  const menuPos = isFab
    ? { bottom: "calc(100% + 10px)", left: "50%", transform: "translateX(-50%)" }
    : { top: "calc(100% + 8px)", right: 0 };
  return (
    <div style={{ position: "relative", display: "inline-flex" }}>
      <button
        onClick={(e) => { e.stopPropagation(); setOpen((v) => !v); }}
        aria-haspopup="menu" aria-expanded={open}
        title="הוספה למסלול" aria-label="הוספה למסלול"
        className="tp-press"
        style={{ ...btnStyle, cursor: "pointer", fontFamily: "inherit", display: "inline-flex", alignItems: "center", justifyContent: "center", transition: "transform 0.15s ease" }}
      >
        <Icon name="plus" size={isFab ? 22 : 14} strokeWidth={2.2} style={{ transform: open ? "rotate(45deg)" : "none", transition: "transform 0.2s ease" }} />
      </button>
      {open && (
        <>
          {/* click-outside catcher */}
          <div onClick={() => setOpen(false)} style={{ position: "fixed", inset: 0, zIndex: 40 }} />
          <div role="menu" dir="rtl" className="tp-pop" style={{
            position: "absolute", zIndex: 41, minWidth: 224,
            background: "#fff", border: `1px solid ${T.line}`, borderRadius: 16,
            boxShadow: "0 16px 44px rgba(0,0,0,0.18), 0 3px 10px rgba(0,0,0,0.08)",
            padding: 8, ...menuPos,
          }}>
            {[
              { icon: "📍", label: "הוספת לוקיישן", onClick: () => pick(onAddLocation) },
              { icon: "✈️", label: "הוספת מעבר / טיסה", onClick: () => pick(onAddTransit) },
            ].map((o) => (
              <button key={o.label} role="menuitem" onClick={o.onClick}
                onMouseEnter={(e) => { e.currentTarget.style.background = T.surface; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
                style={{
                  display: "flex", alignItems: "center", gap: 11, width: "100%", boxSizing: "border-box",
                  textAlign: "right", padding: "11px 12px", border: "none", borderRadius: 12,
                  background: "transparent", cursor: "pointer", fontFamily: "inherit",
                  fontSize: 14, fontWeight: 700, color: T.ink, transition: "background 0.15s ease",
                }}>
                <span aria-hidden style={{ fontSize: 18, lineHeight: 1, flexShrink: 0 }}>{o.icon}</span>
                {o.label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
};

/* ── Transit rail (sits ON the connecting axis between two stops) ──
   Renders the auto-computed mode + minutes + distance for the IMPLICIT
   inner-city commute between two sequential place stops (Sprint 30).

   Tapping the capsule does NOT open AddTransitSheet or add a row — it
   pops a compact inline mode menu (🚶 / 🚗 / 🚆 / 🚌). Picking a mode
   mutates just this segment's override and recomputes the duration /
   distance metadata; the choice is persisted on the origin stop by the
   parent (onSetMode). Macro-logistics (flights, long cross-city rail)
   stay the domain of the explicit "+" transit button. */
const RAIL_MENU = [
  { mode: "walk", emoji: "🚶", label: "הליכה" },
  { mode: "car", emoji: "🚗", label: "רכב / מונית" },
  { mode: "transit", emoji: "🚆", label: "רכבת" },
  { mode: "bus", emoji: "🚌", label: "אוטובוס" },
];
const TransitRail = ({ a, b, override = null, onSetMode, units, editable = true }) => {
  const [hover, setHover] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const seg = computeTransit(a?.coordinates, b?.coordinates, override, units);
  if (!seg) return null;
  const active = hover && editable && !menuOpen;
  const inner = (
    <>
      <span aria-hidden>{seg.emoji}</span>
      <b style={{ color: active ? "#fff" : T.ink2, fontWeight: 700 }}>{seg.minutesLabel}</b>
      <span style={{ color: active ? "rgba(255,255,255,0.7)" : T.ink4 }}>·</span>
      <span>{seg.he}</span>
      <span style={{ color: active ? "rgba(255,255,255,0.7)" : T.ink4 }}>·</span>
      <span>{seg.distLabel}</span>
      {editable && (
        <span aria-hidden style={{ display: "inline-flex", marginInlineStart: 2, fontSize: 9, opacity: hover ? 1 : 0.55 }}>▾</span>
      )}
    </>
  );
  const baseStyle = {
    display: "inline-flex", alignItems: "center", gap: 6,
    padding: "4px 10px", borderRadius: 999,
    border: `1px solid ${active ? T.ink : (override ? T.accent : T.line)}`,
    background: active ? T.ink : "#fff",
    color: active ? "#fff" : T.ink3,
    fontSize: 11, fontFamily: "inherit",
    transition: "background 0.18s ease, color 0.18s ease, border-color 0.18s ease",
  };
  return (
    <div style={{ display: "flex", justifyContent: "center", padding: "2px 0", position: "relative" }}>
      {editable ? (
        <>
          <button
            onClick={() => setMenuOpen((v) => !v)}
            onMouseEnter={() => setHover(true)}
            onMouseLeave={() => setHover(false)}
            aria-haspopup="menu" aria-expanded={menuOpen}
            title="שינוי אופן המעבר"
            style={{ ...baseStyle, cursor: "pointer" }}
          >
            {inner}
          </button>
          {menuOpen && (
            <>
              {/* tap-catcher to dismiss */}
              <div onClick={() => setMenuOpen(false)} style={{ position: "fixed", inset: 0, zIndex: 20 }} />
              <div role="menu" className="tp-pop" dir="rtl" style={{
                position: "absolute", top: "100%", marginTop: 4, zIndex: 21,
                display: "flex", gap: 4, padding: 4, background: "#fff",
                borderRadius: 999, border: `1px solid ${T.line}`,
                boxShadow: "0 10px 30px rgba(0,0,0,0.16)",
              }}>
                {RAIL_MENU.map((m) => {
                  const on = seg.mode === m.mode;
                  return (
                    <button key={m.mode} role="menuitemradio" aria-checked={on}
                      title={m.label}
                      onClick={() => { onSetMode && onSetMode(m.mode); setMenuOpen(false); }}
                      style={{
                        width: 34, height: 34, borderRadius: "50%", cursor: "pointer",
                        border: `1px solid ${on ? T.ink : T.line}`, background: on ? T.ink : "#fff",
                        fontSize: 16, lineHeight: 1, display: "inline-flex", alignItems: "center", justifyContent: "center",
                        fontFamily: "inherit", transition: "background 0.15s, border-color 0.15s",
                      }}>
                      <span aria-hidden style={{ filter: on ? "none" : "grayscale(0.15)" }}>{m.emoji}</span>
                    </button>
                  );
                })}
              </div>
            </>
          )}
        </>
      ) : (
        <span style={baseStyle}>{inner}</span>
      )}
    </div>
  );
};

/* ── Day stop list with pointer-based drag-reorder (spec §6) ──
   Long-/click-drag the ≡ handle to re-sort. On release the new
   order is committed via onReorder, which persists + re-renders
   the transit rails in real time. */
/* User-added transit segments (spec §4/§5) — transport glyph + label
   per movement type. These render as editorial transit blocks in the
   timeline rather than place cards. */
const TRANSIT_GLYPH = {
  flight: { icon: "plane", he: "טיסה" },
  train:  { icon: "train", he: "רכבת" },
  drive:  { icon: "car",   he: "רכב / מונית" },
  bus:    { icon: "bus",   he: "אוטובוס" },
  ferry:  { icon: "ferry", he: "מעבורת" },
};

/* Sprint 27 #2 — terrestrial transit tones: each ground mode gets a
   SOLID, muted color block (minimalist, compact) so trains/drives read
   at a glance without competing with the accent-dashed flight cards. */
const GROUND_TONES = {
  train: { bg: "#E8EEF5", fg: "#33536E" },
  drive: { bg: "#F2EDE4", fg: "#6E5833" },
  bus:   { bg: "#E9F1E9", fg: "#3E6247" },
  ferry: { bg: "#E5F0F2", fg: "#2F6470" },
};

/* ── Sprint 37 #2 — SwipeableRow: unified touch gesture wrapper ──
   Wraps a single timeline place row and drives four gestures off ONE pointer
   stream, with `touchAction:"pan-y"` so vertical page-scroll stays native:
     • Swipe LEFT  → reveals a red 🗑️ track; a full swipe fires onSwipeLeft
                     (delete + undo toast).
     • Swipe RIGHT → reveals a green 📥 track; a full swipe fires onSwipeRight
                     (snooze back to the Places Inbox).
     • Long press (held, no move) → onLongPress(x, y) opens the context menu.
     • Long press THEN move → onDragStart() hands off to the list's reorder
                     engine (prevents accidental drags while scrolling).
   A trailing click that follows any recognised gesture is swallowed so the
   card's own navigate-to-map tap doesn't also fire. */
const SwipeableRow = ({ children, disabled, onSwipeLeft, onSwipeRight, onLongPress, onDragStart }) => {
  const [tx, setTx] = useState(0);
  /* Sprint 53 #3 — 2-step gesture: `open` is the DOCKED direction, not a bare
     boolean. 0 = closed · -1 = docked-left (red "delete") · 1 = docked-right
     (green "to inbox"). A swipe only ever DOCKS the drawer open; the action
     fires solely when the exposed coloured zone is then tapped. */
  const [open, setOpen] = useState(0);
  const [out, setOut] = useState(false);     // slide-out animation in progress
  const st = useRef({ x0: 0, y0: 0, mode: "idle", armed: false, timer: null, base: 0 });
  const gestured = useRef(false);
  const REVEAL_MAX = 150;   // px the row docks open to expose the full label
  const TRIGGER = 56;       // px of travel needed to dock the drawer open
  const vw = () => (typeof window !== "undefined" ? window.innerWidth : 400);

  const clearTimer = () => { if (st.current.timer) { clearTimeout(st.current.timer); st.current.timer = null; } };

  /* Commit the docked action with a clean slide-out in the docked direction. */
  const doAction = (side) => {
    if (out) return;
    gestured.current = true;
    setOut(true); setOpen(0);
    if (side < 0) { setTx(-vw()); setTimeout(() => { onSwipeLeft && onSwipeLeft(); }, 190); }
    else { setTx(vw()); setTimeout(() => { onSwipeRight && onSwipeRight(); }, 190); }
  };
  const close = () => { setOpen(0); setTx(0); };

  const onPointerDown = (e) => {
    if (disabled || out || (e.pointerType === "mouse" && e.button !== 0)) return;
    st.current.x0 = e.clientX; st.current.y0 = e.clientY;
    st.current.mode = "idle"; st.current.armed = false;
    st.current.base = open === -1 ? -REVEAL_MAX : open === 1 ? REVEAL_MAX : 0; // resume from docked rest
    clearTimer();
    st.current.timer = setTimeout(() => {
      if (st.current.mode === "idle" && open === 0) { st.current.armed = true; }
    }, 340);
  };
  const onPointerMove = (e) => {
    if (disabled || out) return;
    const dx = e.clientX - st.current.x0;
    const dy = e.clientY - st.current.y0;
    if (st.current.mode === "idle") {
      if (st.current.armed) {
        // long-press held; a subsequent move promotes to drag-reorder
        if (Math.abs(dx) > 6 || Math.abs(dy) > 6) {
          st.current.mode = "drag"; gestured.current = true;
          clearTimer();
          onDragStart && onDragStart();
        }
        return;
      }
      /* Horizontal-friction gate: only capture a swipe once travel is clearly
         horizontal, so vertical scrolling of the sheet never slides a row. */
      if (Math.abs(dx) > 12 && Math.abs(dx) > Math.abs(dy) * 1.2) {
        st.current.mode = "swipe"; clearTimer();
      } else if (Math.abs(dy) > 10) {
        st.current.mode = "scroll"; clearTimer(); // yield to native vertical scroll
      }
    }
    if (st.current.mode === "swipe") {
      const pos = Math.max(-REVEAL_MAX, Math.min(REVEAL_MAX, st.current.base + dx));
      setTx(pos);
    }
  };
  const onPointerUp = (e) => {
    clearTimer();
    if (out) return;
    const raw = st.current.base + (e.clientX - st.current.x0);
    if (st.current.mode === "swipe") {
      /* Sprint 53 #3 — release only DOCKS (or closes). It NEVER auto-executes,
         removing the accidental muscle-memory deletion risk. */
      if (raw <= -TRIGGER) { setOpen(-1); setTx(-REVEAL_MAX); gestured.current = true; }
      else if (raw >= TRIGGER) { setOpen(1); setTx(REVEAL_MAX); gestured.current = true; }
      else { close(); }
    } else if (st.current.mode === "idle") {
      if (open !== 0) { gestured.current = true; close(); }       // tap elsewhere closes the drawer
      else if (st.current.armed) { gestured.current = true; onLongPress && onLongPress(e.clientX, e.clientY); }
    }
    st.current.mode = "idle"; st.current.armed = false;
  };
  const onPointerCancel = () => { clearTimer(); if (!out) close(); st.current.mode = "idle"; st.current.armed = false; };

  const progress = Math.min(1, Math.abs(tx) / TRIGGER);
  const revealLeft = tx < 0; // moving left → red delete track on the revealed edge
  const docked = open !== 0;
  const active = tx !== 0;
  return (
    <div style={{ position: "relative", overflow: active ? "hidden" : "visible" }}
      onClickCapture={(e) => {
        /* Let taps on the docked action zone through; swallow the stray click
           that trails a swipe/drag so the card's own navigate never fires. */
        if (e.target.closest && e.target.closest('[data-swipe-action="1"]')) return;
        if (gestured.current) { e.preventDefault(); e.stopPropagation(); gestured.current = false; }
      }}>
      {tx !== 0 && (
        <div
          /* Sprint 53 #3 — STEP 2: while docked, the coloured track is a live
             button. Tapping it commits the action; nothing else does. */
          data-swipe-action={docked ? "1" : undefined}
          onClick={docked ? (e) => { e.stopPropagation(); doAction(open); } : undefined}
          role={docked ? "button" : undefined}
          aria-label={docked ? (open < 0 ? "מחיקה מהמסלול" : "העברה לבנק הנקודות") : undefined}
          style={{
            /* Sprint 59 #2 / 60 #3 — the coloured fill spans the full row (z1);
               the label lives in an inner box sized to the EXPOSED rectangle,
               pinned to the revealed edge and lifted to z10 so the white
               typography is always legible ON TOP of the drag fill (never a
               blank block). */
            position: "absolute", inset: 0, display: "flex",
            justifyContent: revealLeft ? "flex-end" : "flex-start", alignItems: "stretch",
            borderRadius: 12, zIndex: 1,
            background: revealLeft ? `rgba(217,64,37,${docked ? 1 : 0.25 + progress * 0.65})` : `rgba(31,166,122,${docked ? 1 : 0.25 + progress * 0.65})`,
            cursor: docked ? "pointer" : "default",
            pointerEvents: docked ? "auto" : "none",
          }}>
          <div style={{
            /* Sprint 62 #6 — the label box hugs the EXPOSED rectangle, hides any
               overflow, and uses concise text + px-4 padding so it is never
               truncated at the screen edge ("…הנ"). */
            position: "relative", zIndex: 10,
            width: Math.abs(tx), minWidth: 0,
            display: "flex", alignItems: "center", justifyContent: "space-between", gap: 6,
            padding: "0 16px", color: "#fff", fontWeight: 800, fontSize: 14,
            whiteSpace: "nowrap", overflow: "hidden",
            transition: "all 0.2s ease",
          }}>
            <span aria-hidden style={{ fontSize: 20, flexShrink: 0 }}>{revealLeft ? "🗑️" : "📥"}</span>
            <span style={{ flex: 1, textAlign: "center", overflow: "hidden", textOverflow: "ellipsis" }}>
              {(docked || progress >= 0.35) ? (revealLeft ? "מחיקה" : "העבר לבנק") : ""}
            </span>
          </div>
        </div>
      )}
      <div
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerCancel}
        style={{
          /* Sprint 62 #6 — a springy ease so tapping the row (or dragging it
             back) snaps smoothly to the default closed state. */
          position: "relative", transform: `translateX(${tx}px)`,
          transition: (tx === 0 || docked || out) ? "transform 0.28s cubic-bezier(0.22,1,0.36,1)" : "none",
          touchAction: "pan-y",
          /* Transparent at rest so the timeline spine shows through the gaps;
             solid only mid-swipe so the coloured track can't bleed through. */
          background: active ? "#fff" : "transparent",
        }}
      >
        {children}
      </div>
    </div>
  );
};

const DayStopList = ({
  stops, onReorder, onOpenActions, editable = true,
  /* Sprint 36 #10 — on Day 1, pin the flight / macro-transit section to
     the very top of the timeline. */
  flightsFirst = false,
  /* Sprint 11 — live field-ops mode (only when this trip is the
     "active"/live trip). Reveals per-stop check-off + rollover. */
  liveOps = false, onToggleComplete, onRollover, onMoveForward, nextDayNum = null,
  /* Sprint 21 — Trip-Mode gated affordances. `tripActive` (the green
     "טיול פעיל" badge state) reveals the per-stop completion checkbox and
     the explicit "העבר ליום הבא" move button. `onNavigate` makes tapping a
     card body fly the map to that stop + collapse the sheet.
     Sprint 55 #2 — the pencil (note) and clipboard (copy) affordances were
     migrated OFF the card into the ⋯ actions sheet to declutter the row. */
  tripActive = false, onNavigate,
  /* Sprint 27 #3 — tapping a transit block opens its edit sheet. */
  onEditTransit,
  /* Sprint 30 — persist an inline commute-mode choice on the origin stop
     of a rail (idx → walk/car/transit/bus). */
  onSetTransitMode,
  /* Sprint 37 #2 — swipe / long-press gestures. `onRequestDelete(idx)` fires
     on a full left-swipe, `onRequestInbox(idx)` on a full right-swipe, and
     `onOpenContextMenu(idx, x, y)` on a stationary long-press. */
  onRequestDelete, onRequestInbox, onOpenContextMenu,
  /* Sprint 51 #1 — inline quick-add: `onInsertAt(arrayIdx)` opens the insert
     prompt for that gap; `onDeleteInline(arrayIdx)` purges an inline note. */
  onInsertAt, onDeleteInline,
  /* Sprint 61 #1/#5 — tap the gray note ticket to edit it inline; tap a file
     pill to open the attached document. Sprint 65 #6 — quick-attach a file to
     a row (used by the flight/transit card's dedicated 📎 button). */
  onEditNote, onOpenAttachment, onQuickAttach,
}) => {
  const [items, setItems] = useState(stops);
  const [dragIdx, setDragIdx] = useState(-1); // position within the SCHEDULE section
  const rowRefs = useRef([]);
  const dragRef = useRef({ active: false });
  const units = readPrefs().units; // km | mi distance labels on rails

  useEffect(() => { setItems(stops); }, [stops]);

  /* ── Sprint 22 #5 / Sprint 37 #1 — semantic segmentation ──
     The day renders as TWO flows:
       a) מהלך היום        — every place row (POIs, custom stops AND lodging
                              anchors) IN THEIR USER-ASSIGNED ORDER. Lodging
                              is NO LONGER force-sorted to the bottom — a
                              hotel sits exactly where the user put it and
                              drags/reorders like any other stop.
       b) מעברים ולוגיסטיקה — user-added macro transit segments (_transit).
     Every row keeps its ORIGINAL index into the day's attractions array
     (`idx`) so all parent callbacks (actions / complete / note / move)
     stay index-correct regardless of presentation grouping. */
  const isTransitNode = (a) => !!a._transit; // macro flight/leg (own section)
  /* Sprint 51 #1 / 52 #2 — intermediate nodes rendered inline in the path:
     free-text notes (_inlineNote) and 1-tap transit segments (_inlineTransit). */
  const isInlineNode = (a) => !!a._inlineNote || !!a._inlineTransit;
  const isFlowNode = (a) => !isTransitNode(a) && !isInlineNode(a); // draggable place flow
  const isLodgingNode = (a) => !a._transit && (!!a._hotelGroup || /מלון|לינה/.test(a.category || ""));
  const withIdx = items.map((a, idx) => ({ a, idx }));
  const scheduleRows = withIdx.filter(({ a }) => isFlowNode(a)); // POIs + lodging only
  const transitRows = withIdx.filter(({ a }) => isTransitNode(a));
  /* Sprint 51 #1 / 52 #2 — inline nodes preceding each place row (in-gap). */
  const noteRuns = {};
  { let p = 0; let pend = [];
    withIdx.forEach(({ a, idx }) => {
      if (isTransitNode(a)) return;
      if (isInlineNode(a)) { pend.push({ a, idx }); return; }
      noteRuns[p] = pend; pend = []; p++;
    });
    noteRuns.trailing = pend;
  }

  const onHandleDown = (pos) => (e) => {
    if (!editable) return;
    e.preventDefault();
    e.stopPropagation();
    dragRef.current = { active: true };
    setDragIdx(pos);
    try { e.target.setPointerCapture?.(e.pointerId); } catch { /* noop */ }
  };
  /* Sprint 37 #2 — long-press-then-move entry point (no event needed): the
     SwipeableRow calls this to hand its live pointer stream to the list's
     reorder engine. The container's onPointerMove/onUp take over from here. */
  const beginDrag = (pos) => {
    if (!editable) return;
    dragRef.current = { active: true };
    setDragIdx(pos);
  };
  const onMove = (e) => {
    if (!dragRef.current.active || dragIdx < 0) return;
    const y = e.clientY;
    let target = dragIdx;
    rowRefs.current.forEach((el, pos) => {
      if (!el) return;
      const r = el.getBoundingClientRect();
      const mid = r.top + r.height / 2;
      if (pos < dragIdx && y < mid) target = Math.min(target, pos);
      if (pos > dragIdx && y > mid) target = Math.max(target, pos);
    });
    if (target !== dragIdx) {
      /* Sprint 37 #1 — reorder WITHIN the place flow (POIs + lodging together,
         in place), then re-append the macro-transit nodes. Lodging is never
         forced to the bottom: it moves to whatever slot the user drags it. */
      setItems((prev) => {
        const place = prev.filter((a) => isFlowNode(a));
        const rest = prev.filter((a) => !isFlowNode(a)); // transits + inline notes
        const next = place.slice();
        const [moved] = next.splice(dragIdx, 1);
        next.splice(target, 0, moved);
        return [...next, ...rest];
      });
      setDragIdx(target);
    }
  };
  const onUp = () => {
    if (!dragRef.current.active) return;
    dragRef.current.active = false;
    setDragIdx(-1);
    onReorder && onReorder(items);
  };

  /* Small uppercase section label shared by the three timeline blocks. */
  const sectionHeader = (label) => (
    <div style={{ fontSize: 11, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.07em", color: T.ink3, margin: "14px 2px 6px" }}>{label}</div>
  );

  /* Sprint 55 #3 — camouflaged inline quick-add: a thin neutral link-axis line
     runs through the gap between cards with a tiny FRAMELESS "+" centred on the
     track (no round white wrapper). It stays a responsive touch trigger for the
     transit / note insert engine while blending into the path line. */
  const renderInsertBtn = (insertIdx) => (
    <div key={`ins-${insertIdx}`} style={{ position: "relative", height: 22, display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1 }}>
      <span aria-hidden style={{ position: "absolute", insetInlineStart: "50%", top: 0, bottom: 0, width: 2, background: "#E4E4E8", transform: "translateX(-50%)" }} />
      <button
        onClick={() => onInsertAt && onInsertAt(insertIdx)}
        title="הוספת הערת ביניים או מעבר" aria-label="הוספה כאן"
        className="tp-press"
        style={{ position: "relative", width: 30, height: 22, border: "none", background: "transparent", color: T.ink3, cursor: "pointer", fontFamily: "inherit", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 18, lineHeight: 1 }}>+</button>
    </div>
  );

  /* Sprint 51 #1 — DISTINCT intermediate node: a slender, borderless tinted
     row with a leading 📝 and no stop index — blends into the path line. */
  const renderInlineNote = (n, nIdx) => (
    <div key={`note-${nIdx}`} dir="auto" style={{
      /* Sprint 52 #3 — distinct, highly legible intermediate note: soft pastel
         fill + leading edge accent, unrestricted text wrapping (never clipped). */
      display: "flex", alignItems: "flex-start", gap: 8, padding: "9px 12px", margin: "4px 0",
      background: "rgba(138,43,226,0.10)", borderInlineStart: "3px solid rgba(138,43,226,0.5)",
      borderRadius: 8, position: "relative", zIndex: 1,
    }}>
      <span aria-hidden style={{ flexShrink: 0, marginTop: 2, color: "#8a2be2" }}><Icon name="note" size={15} strokeWidth={1.9} /></span>
      <span style={{ flex: 1, minWidth: 0, fontSize: 14, fontWeight: 600, color: T.ink, lineHeight: 1.45, whiteSpace: "pre-wrap", wordBreak: "break-word", overflowWrap: "anywhere" }}>{n.text}</span>
      {editable && onDeleteInline && (
        <button onClick={() => onDeleteInline(nIdx)} title="מחיקת הערת ביניים" aria-label="מחיקת הערת ביניים"
          style={{ flexShrink: 0, border: "none", background: "transparent", color: T.ink4, cursor: "pointer", fontSize: 13, fontFamily: "inherit", marginTop: 1 }}>✕</button>
      )}
    </div>
  );

  /* Sprint 52 #2 — 1-tap transit segment inserted between two stops. Renders a
     clean, stylized inline line item: glyph · route · (baseline distance) · note. */
  const renderInlineTransit = (t, tIdx) => {
    const g = TRANSIT_GLYPH[t.transitType] || TRANSIT_GLYPH.drive;
    const route = t.from && t.to ? `${t.from} → ${t.to}` : (t.from || t.to || g.he);
    /* Sprint 55 #4 — FLAT full-width transit bar: neutral light-gray fill, no
       coloured outline; the vehicle icon carries the single coral accent to
       pace the schedule. */
    const CORAL = "#FF6B6B";
    return (
      <div key={`itr-${tIdx}`} dir="rtl" style={{
        display: "flex", alignItems: "center", gap: 10, padding: "8px 12px", margin: "6px 0",
        background: "#F0F0F3", borderRadius: 10, position: "relative", zIndex: 1,
      }}>
        <span aria-hidden style={{ flexShrink: 0, color: CORAL, display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
          <Icon name={g.icon} size={18} strokeWidth={2.1} />
        </span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 800, color: "#1E1E24", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {g.he}{route ? ` · ${route}` : ""}{Number.isFinite(t.km) ? ` · ~${t.km} ק"מ` : ""}
          </div>
          {t.note && <div dir="auto" style={{ display: "flex", alignItems: "flex-start", gap: 5, fontSize: 12, fontWeight: 600, color: T.ink3, marginTop: 2, whiteSpace: "pre-wrap", wordBreak: "break-word" }}><span style={{ flexShrink: 0, marginTop: 1 }}><Icon name="note" size={12} strokeWidth={1.9} /></span><span style={{ flex: 1, minWidth: 0 }}>{t.note}</span></div>}
        </div>
        {editable && onDeleteInline && (
          <button onClick={() => onDeleteInline(tIdx)} title="מחיקת המעבר" aria-label="מחיקת המעבר"
            style={{ flexShrink: 0, border: "none", background: "transparent", color: T.ink4, cursor: "pointer", fontSize: 13, fontFamily: "inherit" }}>✕</button>
        )}
      </div>
    );
  };

  /* Dispatch an inline node to the right renderer. */
  const renderInlineNode = (n, nIdx) => (n._inlineTransit ? renderInlineTransit(n, nIdx) : renderInlineNote(n, nIdx));

  /* ── Transit / logistics row (section b renderer) ──
     A user-added flight/train/drive/ferry segment. Rendered with a
     dashed track + transport glyph + timetable matrix rather than a
     standard place card. `idx` = original index into the day array. */
  const renderTransitRow = (a, idx) => {
          const g = TRANSIT_GLYPH[a.transitType] || TRANSIT_GLYPH.flight;
          const route = a.from && a.to ? `${a.from} → ${a.to}` : (a.from || a.to || g.he);
          /* Sprint 20 #3a — design tiering. Flights are the trip's
             high-contrast anchors: bold accent dashed card + filled accent
             badge. Every other transit type (train / car / bus / ferry) is a
             low-profile logistics row: compact padding, a quiet solid neutral
             surface, and no loud accent. */
          const isFlight = a.transitType === "flight";
          const tone = GROUND_TONES[a.transitType] || GROUND_TONES.train;
          return (
              <div
                key={`${a.place_id || a.id || a.name}-${idx}`}
                onClick={() => editable && onEditTransit && onEditTransit(idx)}
                title={editable ? "עריכת מעבר" : undefined}
                style={{
                  /* Sprint 65 #6 — tighter vertical footprint for flight rows. */
                  display: "flex", gap: 10, padding: isFlight ? "8px 0" : "6px 0",
                  position: "relative",
                  cursor: editable && onEditTransit ? "pointer" : "default",
                }}
              >
                {/* Glyph disc (replaces the numbered place disc) */}
                <div style={{
                  width: isFlight ? 30 : 26, height: isFlight ? 30 : 26, borderRadius: "50%", flexShrink: 0,
                  background: isFlight ? "#fff" : T.surface,
                  color: isFlight ? T.accent : T.ink3, display: "flex", alignItems: "center",
                  justifyContent: "center",
                  border: isFlight ? `1.5px dashed ${T.accent}` : `1px solid ${T.line}`,
                  position: "relative", zIndex: 1, alignSelf: "center",
                }}>
                  <Icon name={g.icon} size={isFlight ? 15 : 13} strokeWidth={1.9} />
                </div>

                {isFlight ? (
                /* Sprint 66 #1 — ULTRA-COMPACT single-row flight bar (~44px): a
                   coral badge, route, combined time string and a flight-number
                   pill on ONE horizontal line — no more stacked יציאה/הגעה
                   matrix. Scrolls internally on very narrow widths so nothing
                   wraps into a tall card. */
                <div style={{
                  flex: 1, minWidth: 0, border: `1.5px dashed ${T.accent}55`,
                  borderRadius: 12, background: `${T.accent}08`, padding: "7px 12px",
                  display: "flex", alignItems: "center", gap: 8, overflowX: "auto",
                }} className="tp-noscrollbar">
                  <span style={{ flexShrink: 0, display: "inline-flex", alignItems: "center", gap: 5, fontSize: 10.5, fontWeight: 800, letterSpacing: "0.03em", color: "#fff", background: T.accent, borderRadius: 999, padding: "3px 9px", whiteSpace: "nowrap" }}>
                    <Icon name={g.icon} size={11} strokeWidth={2.1} />{g.he}
                  </span>
                  <span style={{ flexShrink: 0, fontSize: 13, fontWeight: 800, color: T.ink, direction: "ltr", whiteSpace: "nowrap" }}>{route}</span>
                  {(a.departTime || a.arriveTime) && (
                    <span style={{ flexShrink: 0, fontSize: 12.5, fontWeight: 700, color: T.ink2, fontVariantNumeric: "tabular-nums", direction: "ltr", whiteSpace: "nowrap" }}>
                      {a.departTime || "—"} - {a.arriveTime || "—"}
                    </span>
                  )}
                  {a.refId && (
                    <span style={{ flexShrink: 0, display: "inline-flex", alignItems: "center", gap: 4, marginInlineStart: "auto", fontSize: 11, fontWeight: 700, color: T.ink2, background: "#fff", border: `1px solid ${T.line}`, borderRadius: 999, padding: "2px 8px", direction: "ltr", whiteSpace: "nowrap" }}>
                      <Icon name="plane" size={11} strokeWidth={1.9} color={T.ink4} />{a.refId}
                    </span>
                  )}
                </div>
                ) : (
                /* Sprint 27 #2 — compact SOLID-color terrestrial row: one
                   muted tone per mode, no border, minimalist single line. */
                <div style={{
                  flex: 1, minWidth: 0,
                  borderRadius: 12, background: tone.bg, padding: "8px 12px",
                  display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap",
                }}>
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 10.5, fontWeight: 800, letterSpacing: "0.03em", color: tone.fg }}>
                    <Icon name={g.icon} size={12} strokeWidth={1.9} color={tone.fg} />{g.he}
                  </span>
                  <span style={{ fontSize: 13.5, fontWeight: 700, color: tone.fg, direction: "ltr", minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{route}</span>
                  {(a.departTime || a.arriveTime) && (
                    <span style={{ marginInlineStart: "auto", fontSize: 12.5, fontWeight: 700, color: tone.fg, opacity: 0.85, fontVariantNumeric: "tabular-nums", direction: "ltr", display: "inline-flex", alignItems: "center", gap: 4 }}>
                      {a.departTime || "—"}
                      <Icon name="chevronEnd" size={11} strokeWidth={2} color={tone.fg} />
                      {a.arriveTime || "—"}
                    </span>
                  )}
                  {a.refId && (
                    <span style={{ fontSize: 11.5, fontWeight: 600, color: tone.fg, opacity: 0.8, direction: "ltr" }}>· {a.refId}</span>
                  )}
                </div>
                )}
                {/* Actions — hidden in read mode (transit rows live in their
                    own logistics section, so no drag handle here). */}
                {editable && (
                  <div style={{ alignSelf: "center", display: "flex", alignItems: "center", gap: 2 }}>
                    {/* Sprint 65 #6 — dedicated 📎 to attach a flight ticket /
                        boarding pass directly on the transit card. */}
                    {onQuickAttach && (
                      <button
                        onClick={(e) => { e.stopPropagation(); onQuickAttach(idx); }}
                        title="צירוף כרטיס / מסמך" aria-label="צירוף כרטיס / מסמך"
                        style={{ width: 30, height: 32, border: "none", background: "transparent", color: isFlight ? T.accent : T.ink4, cursor: "pointer", fontFamily: "inherit", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 15 }}
                      >
                        <span aria-hidden>📎</span>
                      </button>
                    )}
                    <button
                      onClick={(e) => { e.stopPropagation(); onOpenActions && onOpenActions(idx); }}
                      title="פעולות" aria-label="פעולות"
                      style={{ width: 30, height: 32, border: "none", background: "transparent", color: T.ink4, cursor: "pointer", fontFamily: "inherit", display: "inline-flex", alignItems: "center", justifyContent: "center" }}
                    >
                      <Icon name="more" size={16} strokeWidth={1.6} />
                    </button>
                  </div>
                )}
                {/* Sprint 65 #6 — existing attachment pills on the transit row. */}
                {a.attachments && a.attachments.length > 0 && (
                  <div style={{ position: "absolute", insetInlineStart: 42, bottom: -2, display: "flex", gap: 4 }}>
                    {a.attachments.map((f, fi) => (
                      <button key={fi} onClick={(e) => { e.stopPropagation(); onOpenAttachment && onOpenAttachment(f, idx, fi); }}
                        title={f.name || "מסמך מצורף"} aria-label={f.name || "מסמך מצורף"} className="tp-press"
                        style={{ height: 22, padding: "0 6px", border: "none", background: "#1E1E24", color: "#fff", borderRadius: 6, cursor: "pointer", fontFamily: "inherit", fontSize: 10, display: "inline-flex", alignItems: "center", gap: 3 }}>
                        <span aria-hidden style={{ fontSize: 11 }}>📎</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
          );
  };

  /* ── Place card row (sections a + c renderer) ──
     `idx` = original index into the day array (drives all callbacks);
     `pos` = position within the SCHEDULE section (numbering + drag) —
     null for lodging rows, which render in the locked anchor block. */
  const renderPlaceRow = (a, idx, pos, lodging = false) => {
        /* Completion is a Trip-Mode (or live field-ops) concept: only then
           do we surface the per-stop checkbox + dimmed "visited" styling. */
        const showCompletion = tripActive || liveOps;
        const done = showCompletion && !!a.completed;
        const canNavigate = !!(onNavigate && a.coordinates);
        const note = a.note || a.comment || a.annotation || a.quote; // personal logbook line
        const hotelSpan = a._hotelGroup ? a._hotelSpan : null;
        const dragging = pos != null && dragIdx === pos;
        /* Sprint 55 — FLAT 3-COLOUR CARD SYSTEM: solid white blocks, a charcoal
           index badge, and a single coral accent reserved for hotels + high
           ratings. Legacy pastel `_theme` background overrides are dropped. */
        const CHARCOAL = "#1E1E24";
        const CORAL = "#FF6B6B";
        const subtitle = lodging ? `מלון${hotelSpan ? ` · ${hotelSpan.total} לילות` : ""}` : (a.category || "");
        const hasNav = a.coordinates && Number.isFinite(a.coordinates.lat) && Number.isFinite(a.coordinates.lng);
        const rNum = parseFloat(String(a.rating));
        const highRating = Number.isFinite(rNum) && rNum >= 8.5; // /10 scale
        return (
          <div
            ref={(el) => { if (pos != null) rowRefs.current[pos] = el; }}
            /* Sprint 62 #1/#2 — stable DOM hook so day-select can scroll to the
               first row and the stop-detail ✕ return stack can scroll back to
               the exact row the card was opened from. */
            data-stop-idx={idx}
            style={{
              /* Sprint 55 #1 — opaque flat card block: solid fill, uniform 14px
                 corners, crisp neutral edge, no blur / pastel outlines. */
              /* Sprint 65 #7 — tighter vertical rhythm (py-3 → py-1.5) so more
                 stop rows fit on screen without hurting touch targets. */
              display: "flex", flexDirection: "column", gap: note ? 6 : 0,
              padding: "7px 12px", marginBottom: 6,
              userSelect: "none", WebkitUserSelect: "none", msUserSelect: "none", WebkitTouchCallout: "none",
              background: done ? "#F0F0F3" : "#fff",
              border: `1px solid ${dragging ? "transparent" : "#ECECEF"}`,
              borderRadius: 14,
              boxShadow: dragging ? "0 10px 30px rgba(0,0,0,0.16)" : "none",
              transform: dragging ? "scale(1.02)" : "scale(1)",
              zIndex: dragging ? 2 : "auto", position: "relative",
              transition: dragging ? "none" : "transform 0.2s ease, box-shadow 0.2s ease, background 0.2s ease",
            }}
          >
            {/* Sprint 58 #6 — TITLE ROW: badge + full-width title that wraps up
                to two lines (never truncated to a single clipped line). The
                interactive buttons live on a dedicated secondary row below. */}
            <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
              {/* Solid charcoal (coral for lodging) index badge. */}
              <div aria-hidden style={{
                flexShrink: 0, width: 28, height: 28, borderRadius: 8, marginTop: 1,
                background: done ? T.ink4 : (lodging ? CORAL : CHARCOAL), color: "#fff",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 13, fontWeight: 800, fontVariantNumeric: "tabular-nums",
              }}>{lodging ? <Icon name="bed" size={15} strokeWidth={2} color="#fff" /> : (pos != null ? pos + 1 : "•")}</div>

              <div
                onClick={() => canNavigate && onNavigate(a)}
                title={canNavigate ? "מעבר למיקום על המפה" : undefined}
                style={{ flex: 1, minWidth: 0, opacity: done ? 0.55 : 1, cursor: canNavigate ? "pointer" : "default" }}
              >
                <div dir="auto" style={{
                  fontSize: 16, fontWeight: 800, color: "#111114", lineHeight: 1.3,
                  display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical",
                  overflow: "hidden", wordBreak: "break-word",
                  textDecoration: done ? "line-through" : "none", textDecorationColor: done ? T.ink4 : "transparent",
                }}>{a.nameHe || a.name}</div>
              </div>

              {/* Completion checkbox — Trip Mode / live ops only (top-right). */}
              {showCompletion && (
                <button onClick={(e) => { e.stopPropagation(); onToggleComplete && onToggleComplete(idx); }}
                  title={done ? "בטלו סימון ביקור" : "סמנו כבוצע"} aria-label={done ? "בטלו סימון ביקור" : "סמנו כבוצע"} aria-pressed={done}
                  style={{ flexShrink: 0, width: 26, height: 26, borderRadius: "50%", border: `1.5px solid ${done ? "#1FA67A" : T.ink4}`, background: done ? "#1FA67A" : "transparent", color: "#fff", cursor: "pointer", display: "inline-flex", alignItems: "center", justifyContent: "center", padding: 0 }}>
                  {done && <Icon name="check" size={15} strokeWidth={2.6} />}
                </button>
              )}
            </div>

            {/* Sprint 58 #6 — SECONDARY CONTROL ROW: rating/subtitle metadata on
                the reading edge, with the ניווט + ⋯ + drag controls dropped
                beneath the title so they never crowd out the location name. */}
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 6, opacity: done ? 0.55 : 1 }}>
              <div dir="auto" style={{ flex: 1, minWidth: 0, fontSize: 12.5, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                {a.rating && <span style={{ color: highRating ? CORAL : T.ink3, fontWeight: highRating ? 800 : 700 }}>★ {a.rating}</span>}
                {a.rating && subtitle && <span style={{ color: T.ink4, fontWeight: 600 }}> · </span>}
                {subtitle && <span style={{ color: lodging ? CORAL : T.ink3, fontWeight: lodging ? 800 : 600 }}>{subtitle}</span>}
              </div>
              {/* Navigation is a VIEW action (opens Google Maps) — available even
                  in read-only/shared mode; the edit controls below are gated. */}
              {(editable || hasNav) && (
                <div style={{ flexShrink: 0, display: "flex", alignItems: "center", gap: 6 }}>
                  {hasNav && (
                    <button
                      onClick={(e) => { e.stopPropagation(); const u = mapsUrlFor(a); if (u) window.open(u, "_blank", "noopener,noreferrer"); }}
                      title="ניווט ב-Google Maps" aria-label="ניווט ב-Google Maps" className="tp-press"
                      style={{ height: 30, padding: "0 10px", border: "none", background: CHARCOAL, color: "#fff", cursor: "pointer", fontFamily: "inherit", borderRadius: 8, fontSize: 12.5, fontWeight: 800, display: "inline-flex", alignItems: "center", gap: 5 }}>
                      <Icon name="pin" size={13} strokeWidth={2} color="#fff" />ניווט
                    </button>
                  )}
                  {/* Sprint 62 #3 — direct quick-note trigger: opens the
                      NoteSheet for THIS stop without the 3-dots detour. */}
                  {editable && onEditNote && (
                    <button
                      onClick={(e) => { e.stopPropagation(); onEditNote(idx); }}
                      title={a.note ? "עריכת הערה" : "הוספת הערה"} aria-label={a.note ? "עריכת הערה" : "הוספת הערה"}
                      style={{ width: 30, height: 30, border: "none", background: a.note ? "#1E1E24" : "#F0F0F3", color: a.note ? "#fff" : T.ink2, cursor: "pointer", fontFamily: "inherit", borderRadius: 8, display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
                      <Icon name="note" size={15} strokeWidth={1.9} color={a.note ? "#fff" : T.ink2} />
                    </button>
                  )}
                  {editable && (
                    <button
                      onClick={(e) => { e.stopPropagation(); onOpenActions && onOpenActions(idx); }}
                      title="פעולות" aria-label="פעולות"
                      style={{ width: 30, height: 30, border: "none", background: "#F0F0F3", color: T.ink2, cursor: "pointer", fontFamily: "inherit", borderRadius: 8, display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
                      <Icon name="more" size={16} strokeWidth={1.8} />
                    </button>
                  )}
                  {editable && pos != null && (
                    <button
                      onPointerDown={onHandleDown(pos)}
                      title="גררו לסידור מחדש"
                      style={{ width: 24, height: 30, border: "none", background: "transparent", color: T.ink4, cursor: "grab", touchAction: "none", fontSize: 16, fontFamily: "inherit" }}>
                      ≡
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Trip-Mode "move forward" / rollover quick actions. */}
            {tripActive && !done && onMoveForward && (
              <button onClick={(e) => { e.stopPropagation(); onMoveForward(idx); }}
                style={{ marginTop: 6, alignSelf: "flex-start", border: `1px solid ${T.line}`, background: "#fff", padding: "4px 10px", borderRadius: 8, cursor: "pointer", fontFamily: "inherit", fontSize: 12, fontWeight: 700, color: T.ink2, display: "inline-flex", alignItems: "center", gap: 4 }}>
                <Icon name="chevronEnd" size={12} strokeWidth={2.2} /> העבר ליום הבא
              </button>
            )}
            {liveOps && !tripActive && !done && nextDayNum != null && (
              <button onClick={(e) => { e.stopPropagation(); onRollover && onRollover(idx, nextDayNum); }}
                style={{ marginTop: 6, alignSelf: "flex-start", border: "none", background: "transparent", padding: 0, cursor: "pointer", fontFamily: "inherit", fontSize: 12, fontWeight: 700, color: CORAL, display: "inline-flex", alignItems: "center", gap: 4 }}>
                <Icon name="chevronEnd" size={12} strokeWidth={2.2} /> העבירו ליום המחרת
              </button>
            )}

            {/* Sprint 61 #1 — DIRECTLY-INTERACTIVE NOTE TICKET: the light-gray
                panel is now a tap target that opens the rapid inline editor.
                A compact file pill (📎) sits beside it when attachments exist. */}
            {(note || (a.attachments && a.attachments.length)) && (
              <div style={{ display: "flex", alignItems: "stretch", gap: 6, width: "100%" }}>
                <div
                  role={editable && onEditNote ? "button" : undefined}
                  onClick={editable && onEditNote ? (e) => { e.stopPropagation(); onEditNote(idx); } : undefined}
                  dir="auto" title={editable ? "עריכת ההערה" : undefined}
                  style={{
                    display: "flex", alignItems: "flex-start", gap: 6,
                    flex: 1, minWidth: 0, boxSizing: "border-box", background: "#F0F0F3", borderRadius: 8,
                    padding: "8px 10px", fontSize: 12, fontWeight: 500, color: "#4A4A55",
                    lineHeight: 1.45, whiteSpace: "pre-wrap", wordBreak: "break-word", overflowWrap: "anywhere",
                    opacity: done ? 0.6 : 1, cursor: editable && onEditNote ? "pointer" : "default",
                  }}>
                  <span style={{ flexShrink: 0, marginTop: 1, color: T.ink3 }}><Icon name="note" size={13} strokeWidth={1.9} /></span>
                  <span style={{ flex: 1, minWidth: 0 }}>{note || "הוספת הערה…"}</span>
                </div>
                {/* Sprint 61 #5 — attachment pills: tap to open the document. */}
                {a.attachments && a.attachments.map((f, fi) => (
                  <button key={fi} onClick={(e) => { e.stopPropagation(); onOpenAttachment && onOpenAttachment(f, idx, fi); }}
                    title={f.name || "מסמך מצורף"} aria-label={f.name || "מסמך מצורף"} className="tp-press"
                    style={{ flexShrink: 0, alignSelf: "stretch", minWidth: 36, padding: "0 8px", border: "none", background: "#1E1E24", color: "#fff", borderRadius: 8, cursor: "pointer", fontFamily: "inherit", display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 4, fontSize: 11, fontWeight: 800 }}>
                    <span aria-hidden style={{ fontSize: 13 }}>📎</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        );
  };

  /* Sprint 36 #10 — Day 1 flight/transit block, rendered ABOVE the day
     schedule so departures pin to the top of the list. */
  const transitBlock = transitRows.length > 0 ? (
    <>
      {sectionHeader("טיסות ומעברים בין ערים")}
      {transitRows.map(({ a, idx }) => renderTransitRow(a, idx))}
    </>
  ) : null;

  /* ── Sprint 22 #5 — the three semantic timeline blocks ── */
  return (
    <div className="tp-noselect" onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}>
      {/* Sprint 36 #10 — flights first on Day 1. */}
      {flightsFirst && transitBlock}

      {/* a) מהלך היום — the day's schedule of places */}
      {scheduleRows.length > 0 && (
        <>
          {sectionHeader("מהלך היום")}
          <div style={{ position: "relative" }}>
            {/* Sprint 55 #3 — the legacy right-edge spine is retired; the flat
                cards + centred insert-track lines now carry the vertical path. */}
            {scheduleRows.map(({ a, idx }, pos) => {
              const lodging = isLodgingNode(a);
              const row = renderPlaceRow(a, idx, pos, lodging);
              const notes = noteRuns[pos] || [];
              return (
              <React.Fragment key={`${a.place_id || a.id || a.name}-${idx}`}>
                {/* Sprint 51 #1 — inline notes that precede this stop. */}
                {notes.map(({ a: n, idx: nIdx }) => renderInlineNode(n, nIdx))}
                {/* Sprint 51 #1 — permanent inline quick-add BEFORE this stop
                    (also serves as the absolute-top trigger for pos 0). */}
                {editable && onInsertAt && renderInsertBtn(idx)}
                {/* Sprint 37 #2 / Sprint 38 #7 — gesture-wrap every editable
                    row (lodging included; lock removed). */}
                {editable ? (
                  <SwipeableRow
                    onSwipeLeft={() => onRequestDelete && onRequestDelete(idx)}
                    onSwipeRight={() => onRequestInbox && onRequestInbox(idx)}
                    onLongPress={(x, y) => onOpenContextMenu && onOpenContextMenu(idx, x, y)}
                    onDragStart={() => beginDrag(pos)}
                  >
                    {row}
                  </SwipeableRow>
                ) : row}
                {/* Sprint 30 — implicit inline commute rail to the next
                    scheduled stop. Mode override persists on the ORIGIN
                    stop (`transitMode`); tapping cycles it inline. */}
                {pos < scheduleRows.length - 1 && (
                  <TransitRail
                    a={a}
                    b={scheduleRows[pos + 1].a}
                    override={a.transitMode || null}
                    onSetMode={(mode) => onSetTransitMode && onSetTransitMode(idx, mode)}
                    units={units}
                    editable={editable}
                  />
                )}
              </React.Fragment>
              );
            })}
            {/* Sprint 51 #1 — trailing inline notes + the absolute-bottom quick-add. */}
            {(noteRuns.trailing || []).map(({ a: n, idx: nIdx }) => renderInlineNode(n, nIdx))}
            {editable && onInsertAt && scheduleRows.length > 0 && renderInsertBtn(items.length)}
          </div>
        </>
      )}

      {/* b) Sprint 30 — MACRO structural transits (flights / long cross-city
          legs). Rendered here for days 2+; on Day 1 it's pinned to the top
          instead (Sprint 36 #10). Sprint 37 #1: lodging is NO LONGER a
          separate bottom-anchored block — it renders inline above. */}
      {!flightsFirst && transitBlock}
    </div>
  );
};

const EditorView = () => {
  const { tripId } = useParams();
  const navigate = useNavigate();
  const activeId = useActiveTrip(); // the currently "live" trip (field-ops mode)
  const [trip, setTrip] = useState(null);
  const [error, setError] = useState(null);
  const [activeDay, setActiveDay] = useState(1);
  /* Favorite state for a PUBLIC map the viewer doesn't own — lets them
     bookmark it right here (the gallery star, but inside the view-only editor). */
  const [isFav, setIsFav] = useState(false);
  /* Live search-result pins on the map (from the search bar's Text Search). */
  const [searchResults, setSearchResults] = useState([]);
  /* "מצא לי X באזור" — the origin point whose picker sheet is open (null = closed)
     and the origin coordinate the map auto-fits around once results arrive. */
  const [nearbyOrigin, setNearbyOrigin] = useState(null);
  const [searchOrigin, setSearchOrigin] = useState(null);
  const runNearby = useCallback(async (origin, query) => {
    const c = origin?.coordinates || (Number.isFinite(origin?.lat) ? { lat: origin.lat, lng: origin.lng } : null);
    setNearbyOrigin(null);
    if (!c) return;
    /* Close any open point card + collapse the schedule sheet so the results
       + map aren't hidden behind them. */
    setActiveStop(null); setPreviewPlace(null); setInboxCardMenu(null);
    sheetRef.current?.snapTo?.("peek");
    setSearchOrigin(c);
    setNearbyAnchor(origin);
    nearbyQueueRef.current = []; nearbyInFlightRef.current = 0;
    setNearbyDetails({}); setNearbyAdded(new Set());
    const res = await nearbySearch(c, query);
    setSearchResults(res); // EditorMap fits to origin + results (extra bottom pad clears the peek sheet)
    track("nearby_search", { ...query, results: res.length });
  }, []);
  useEffect(() => {
    if (!trip?.public || trip?.role === "owner") return;
    let live = true;
    listFavoriteIds().then((ids) => { if (live) setIsFav(ids.has(tripId)); }).catch(() => {});
    return () => { live = false; };
  }, [trip?.public, trip?.role, tripId]);
  const [saving, setSaving] = useState(false);
  /* Sprint 22 #6 — TERNARY view-state matrix (supersedes the binary
     design/trip toggle):
       • design ("תכנון" / PLAN)        — full CRUD: drag, add, 3-dot menus
       • inbox  ("רשימת נקודות" / INBOX) — saved-places POI management drawer
       • trip   ("טיול" / GO)           — read-only field mode: edit controls
                                          hidden, checkboxes + map emphasized
     Ownership stays the outer gate: read-only example/shared trips are
     never editable regardless of mode (saveTrip rejects them anyway). */
  const [mode, setMode] = useState("design");
  const editable = !trip?.readOnly && mode === "design";
  /* Viewing someone else's PUBLIC map (opened read-only from the gallery). */
  const isPublicView = !!trip?.public && trip?.role !== "owner";
  /* Sprint 28 #1 — the "טיול" tab is GONE: the workspace tabs are a
     clean binary (תכנון / רשימת נקודות). Active/field mode is now
     entered exclusively through "הפעל מסלול" (trip activation), so the
     trip-mode affordances key off the LIVE activation flag. */
  const isActiveTrip = !!trip && activeId === trip.id;
  const tripMode = isActiveTrip;
  const inboxMode = mode === "inbox";
  /* Sprint 22 #7 — mock Google Saved Places inbox. null = not connected
     yet (the drawer shows the connect CTA); [] / [...] = fetched list. */
  const [inboxPlaces, setInboxPlaces] = useState(null);
  /* Sprint 26 #1 — workspace exit confirmation modal. */
  const [confirmExit, setConfirmExit] = useState(false);
  /* Sprint 37 #2 — gesture UI state: row context menu (long-press), its
     open submenu, the swipe-delete undo pill, and a transient flash toast. */
  const [ctxMenu, setCtxMenu] = useState(null);   // { idx, x, y }
  const [ctxSub, setCtxSub] = useState(null);     // "day" | "theme" | null
  const [deleteUndo, setDeleteUndo] = useState(null); // { stop, day, idx }
  /* Sprint 38 #3 — swipe-to-inbox undo pill (10s), tracks the origin day+idx
     and the created inbox entry id so "החזר ליום זה" fully reverses it. */
  const [inboxUndo, setInboxUndo] = useState(null); // { stop, day, idx, inboxId }
  useEffect(() => {
    if (!deleteUndo) return;
    const t = setTimeout(() => setDeleteUndo(null), 5000);
    return () => clearTimeout(t);
  }, [deleteUndo]);
  useEffect(() => {
    if (!inboxUndo) return;
    const t = setTimeout(() => setInboxUndo(null), 10000);
    return () => clearTimeout(t);
  }, [inboxUndo]);
  /* Sprint 37 #3 — fullscreen trip-summary overview modal. */
  const [summaryOpen, setSummaryOpen] = useState(false);
  /* Sprint 47 #4 — Places-Inbox targeted tabs:
       "trip"   → this trip's own unassigned pile (default)
       "global" → every point across ALL my trips, country-matched to the top. */
  const [inboxTab, setInboxTab] = useState("trip");
  /* Lazily-loaded global point bank (null = not fetched yet). */
  const [globalPoints, setGlobalPoints] = useState(null);
  const [globalLoading, setGlobalLoading] = useState(false);
  /* Sprint 37 #6 — one-time welcome/onboarding dialog (localStorage-gated). */
  const [onboardOpen, setOnboardOpen] = useState(false);
  useEffect(() => {
    try {
      if (!localStorage.getItem("jte_onboarded_v1")) setOnboardOpen(true);
    } catch { /* private mode — skip */ }
  }, []);
  const dismissOnboard = useCallback(() => {
    try { localStorage.setItem("jte_onboarded_v1", "1"); } catch { /* ignore */ }
    setOnboardOpen(false);
  }, []);
  /* Sprint 27 #3 — index of the active-day transit segment being edited
     in the transit sheet (-1 = closed). */
  const [editTransitIdx, setEditTransitIdx] = useState(-1);
  /* Sprint 27 #5 — a searched place awaiting routing: the interception
     prompt offers "בנק הנקודות" vs. a specific day. */
  const [pendingStop, setPendingStop] = useState(null);
  const [filter, setFilter] = useState("all");
  /* Sprint 23 #6 — collapsed/expanded state of the two category filter
     controls (timeline sheet + inbox drawer) and the inbox's own filter. */
  const [filterOpen, setFilterOpen] = useState(false);
  const [inboxFilter, setInboxFilter] = useState("all");
  const [isPinning, setIsPinning] = useState(false);
  /* Sprint 15.6 — Map Lock: freezes user pan/zoom on the canvas while
     programmatic flyTo (preview / day-fit) keeps working. */
  const [mapLocked, setMapLocked] = useState(false);
  /* Sprint 59 #6 — live map bearing + a monotonic "reset to north" signal.
     The compass control mounts only while `mapBearing` deviates from 0; a
     click bumps `northKey`, and EditorMap eases the viewport back to true
     north on the change. */
  const [mapBearing, setMapBearing] = useState(0);
  const [northKey, setNorthKey] = useState(0);
  const [pendingCoord, setPendingCoord] = useState(null);
  const [showAddStop, setShowAddStop] = useState(false);
  const [showAddTransit, setShowAddTransit] = useState(false); // transit segment sheet
  /* Sprint 51 #1 — inline quick-add: `insertAt` is the day-array index a new
     node will be spliced into (-1 = closed); `insertText` holds the note draft. */
  const [insertAt, setInsertAt] = useState(-1);
  const [insertText, setInsertText] = useState("");
  /* Sprint 52 #6 — quick-copy micro-toast + map-viewport inbox filter. */
  const [copyToast, setCopyToast] = useState("");
  /* Sprint 65 — plain (no-icon) micro-toast for Trip Files gallery outcomes.
     Kept SEPARATE from `copyToast` (which hardcodes a ✅) so an upload FAILURE
     is never rendered as a success. Auto-dismisses after ~2.5s. */
  const [filesToast, setFilesToast] = useState("");
  const [inboxGeoFilter, setInboxGeoFilter] = useState(null); // {west,south,east,north} | null
  /* Sprint 58 #5 — the inbox grid card whose "➕ שבץ ביום זה" micro-overlay is open. */
  const [inboxCardMenu, setInboxCardMenu] = useState(null);
  /* Real photo for the open saved-point card — the place's OWN Google Maps
     photo, else Street View of its coordinates (utils/usePlacePhotos), matching
     the desktop cockpit instead of a misleading category stock image. */
  const inboxMenuPhotos = usePlacePhotos(inboxCardMenu ? [inboxCardMenu] : []);
  /* Real photos for the bank list cards (own Google photo → Street View). */
  const bankPhotos = usePlacePhotos([...(inboxPlaces || []), ...(globalPoints || [])]);
  const bankPhotoFor = (s) => { const k = photoKey(s); return (k && bankPhotos[k]) || photoStrict(s); };
  /* Sprint 58 #8 — 👁️ overlay: project ALL saved inbox points onto the map. */
  const [showAllSaved, setShowAllSaved] = useState(false);
  /* "מפות נוספות" — load another map as a teal overlay + transfer its points. */
  const [refMapsOpen, setRefMapsOpen] = useState(false);
  const [overlayMap, setOverlayMap] = useState(null);
  const [overlaySel, setOverlaySel] = useState(null);   // point whose map popup is open
  const [addChoice, setAddChoice] = useState(null);     // points awaiting a bank/day pick
  const [addedKeys, setAddedKeys] = useState(() => new Set());
  const refFavorites = useMemo(() => { try { return new Set(JSON.parse(localStorage.getItem("tp_favorites_v1") || "[]")); } catch { return new Set(); } }, []);
  useEffect(() => {
    if (!copyToast) return;
    const t = setTimeout(() => setCopyToast(""), 1600);
    return () => clearTimeout(t);
  }, [copyToast]);
  useEffect(() => {
    if (!filesToast) return;
    const t = setTimeout(() => setFilesToast(""), 2500);
    return () => clearTimeout(t);
  }, [filesToast]);
  const copyName = useCallback((name) => {
    const s = String(name || "").trim();
    if (!s) return;
    try {
      if (navigator.clipboard?.writeText) navigator.clipboard.writeText(s).catch(() => {});
      else {
        const ta = document.createElement("textarea");
        ta.value = s; ta.style.position = "fixed"; ta.style.opacity = "0";
        document.body.appendChild(ta); ta.select();
        try { document.execCommand("copy"); } catch { /* ignore */ }
        document.body.removeChild(ta);
      }
    } catch { /* clipboard blocked — still flash the toast */ }
    setCopyToast(`הועתק: ${s}`);
  }, []);
  const [actionsIdx, setActionsIdx] = useState(-1);
  /* Sprint 18.1 — other owned, editable trips the user can copy a stop
     into (cross-trip location copying). Read-only example maps are
     excluded since saveTrip rejects them. */
  const [otherTrips, setOtherTrips] = useState([]);
  const sheetRef = useRef(null);
  const dayStripRef = useRef(null);
  /* Sprint 59 #3 — debounce timer for the map-first inbox carousel's
     scroll→flyTo panning, so rapid horizontal swipes don't spam the map. */
  const inboxFlyTimer = useRef(null);
  /* Sprint 62 #2 — the active-day row index a stop-detail card was opened from,
     so the ✕ return stack can re-expand the sheet and scroll back to it. */
  const returnStopIdx = useRef(-1);
  /* Sprint 39 #1 — day reorder is now an explicit "Edit Mode" (סדר ימים):
     a normal tap always switches day; reordering happens only via a chip's
     drag handle while `dayEditMode` is on. `from`/`over` drive the live
     insertion indicator, `dx` tracks the grabbed chip under the finger. */
  const [dayEditMode, setDayEditMode] = useState(false);
  /* Sprint 41 #3 — "מסלול רציף": collapse the per-day sections into ONE
     cumulative timeline with globally sequential stop numbers (1..N). */
  const [continuousMode, setContinuousMode] = useState(false);
  /* Sprint 42 #5 — an unassigned inbox place the user flew to on the map,
     shown in a floating "➕ הוספה לטיול שלי" card with a day picker. */
  const [assignCard, setAssignCard] = useState(null); // the unassigned place, or null
  const [assignDaysOpen, setAssignDaysOpen] = useState(false); // day-picker expanded?
  /* Sprint 43 #2 — the trip's calendar start date (ISO yyyy-mm-dd) lives in
     settings.startDate; this modal sets/modifies it at any time. */
  const [datesModalOpen, setDatesModalOpen] = useState(false);
  const [datesDraft, setDatesDraft] = useState(""); // start yyyy-mm-dd being edited
  const [datesEndDraft, setDatesEndDraft] = useState(""); // end yyyy-mm-dd being edited
  /* Sprint 44 #2 — bottom-right FAB speed-dial (skeleton / summary /
     continuous / dates), replacing the removed header buttons. */
  const [fabOpen, setFabOpen] = useState(false);
  /* Sprint 44 #3 — the persistently-selected stop (from timeline or map).
     Kept until the user closes the card or taps empty map. */
  const [activeStop, setActiveStop] = useState(null);
  /* Sprint 47 #3 — live map viewport bounds ({west,south,east,north}), updated
     by EditorMap after every move, consumed as the top-priority search bias. */
  const viewportRef = useRef(null);
  const [dayDrag, setDayDrag] = useState({ from: -1, over: -1, dx: 0 });
  const dayDragRef = useRef({ from: -1, over: -1, dx: 0 });
  const dayDragActive = useRef(false);
  const dayGrabX = useRef(0);
  const dayChipRefs = useRef([]);
  const setDayDragState = (next) => { dayDragRef.current = next; setDayDrag(next); };
  /* Dual-state bottom sheet (Sprint 19b.4): track the sheet's snap so the
     map omnibox + schedule collapse together. "peek" = collapsed (only the
     day chips float over a fully-open map); half/full = expanded. */
  const [sheetSnap, setSheetSnap] = useState("half");
  const sheetCollapsed = sheetSnap === "peek";

  /* Sprint 7 — Places preview state */
  const [previewPlace, setPreviewPlace]   = useState(null); // raw getDetails() result
  const [flyToCoord,   setFlyToCoord]     = useState(null); // { lat, lng }
  /* Sprint 49 #2 — UNMOUNT all map FABs whenever an active-stop context exists
     — a selected stop (`activeStop`) OR an engaged place preview — REGARDLESS
     of whether its card is full, maximized, or minimized to a slim preview bar.
     The FAB wrappers are gated on `!mapFabsHidden`, so they evaluate to null in
     the render cycle and can never paint over any active-place layout variant.
     Sprint 60 #2 — the saved-marker detail card (`inboxCardMenu`) is now part
     of this guard too, so tapping a gray saved marker also fully unmounts the
     z-260 FAB stack + fan + anchor (no controls floating over the card). */
  /* True while the schedule sheet is being dragged — hides the floating map FABs
     so they don't overlap the moving sheet (the "drag makes a problem" glitch). */
  const [sheetDragging, setSheetDragging] = useState(false);
  const mapFabsHidden = !!activeStop || !!previewPlace || !!inboxCardMenu || sheetDragging;
  /* Sprint 50 #3 — global focus-lock context. Either "מסלול רציף" (continuous)
     or "סידור ימים" (day reorder) engages an unbreakable editing framework:
     the active FAB pulses, a sticky top banner appears, and the lock clears on
     empty-map tap / Home / a second FAB tap. */
  const focusActive = !!trip && !inboxMode && (dayEditMode || continuousMode);
  const clearFocusModes = useCallback(() => { setDayEditMode(false); setContinuousMode(false); }, []);
  /* Sprint 53 #2 — day-order snapshot captured when the reorder lock opens, so
     "בטל" can restore the pre-edit order without saving. (Handlers defined
     after `commitDays` below.) */
  const focusSnapshotRef = useRef(null);
  /* Sprint 52 #1 — the instant a focus-lock mode engages, collapse the Options
     FAB so its expansion buttons can never stack under the focus banner. */
  useEffect(() => { if (focusActive) setFabOpen(false); }, [focusActive]);
  /* Sprint 21 #3 — index of the active-day stop whose note is being edited
     in the quick NoteSheet (-1 = closed). */
  const [noteEditIdx, setNoteEditIdx]     = useState(-1);
  /* Sprint 61 #1 — duplicate-note cascade prompt. When a saved note targets a
     place that appears on multiple days, we stash the pending note here and
     ask whether to apply it to every matching instance or only this one. */
  const [notePrompt, setNotePrompt] = useState(null); // { index, note, key, count }
  /* Sprint 61 #5 — file-attachment picker state. `attachIdx` is the active-day
     stop index awaiting a file; `attachBusy` gates the upload spinner. */
  const [attachBusy, setAttachBusy] = useState(false);
  const attachInputRef = useRef(null);
  const attachTargetIdx = useRef(-1);
  /* Sprint 65 #1 — the attachment currently open in the in-app viewer modal.
     { file, idx, fi } — idx is the active-day stop index, fi the attachment
     index within that stop, so the viewer can also delete it. */
  const [attachViewer, setAttachViewer] = useState(null);
  /* Sprint 65 — Trip Files gallery: the bottom-sheet open flag + an upload
     spinner gate shared by every "add file" affordance inside the sheet. */
  const [filesSheetOpen, setFilesSheetOpen] = useState(false);
  const [filesBusy, setFilesBusy] = useState(false);
  /* Sprint 54 #4 — any modal/sheet overlay that sits at the z250 layer. The
     map-anchored FABs (raised to z260) unmount while one is open so they never
     float over an action sheet, the summary, or an insert prompt. */
  /* Sprint 58 #1/#2 — ANY central dialog/modal that must fully suppress the map
     FABs (welcome, dates, summary, actions, insert prompt, note/transit sheets,
     long-press menu). Combined with the peek-only sheet rule below.
     The "מצא ליד" nearby-search sheet (z120) belongs here too — without it the
     z260 map FABs float on top of the sheet's chips + search bar. */
  const overlayOpen = actionsIdx >= 0 || summaryOpen || insertAt >= 0 || !!ctxMenu || datesModalOpen || noteEditIdx >= 0 || editTransitIdx >= 0 || onboardOpen || confirmExit || !!nearbyOrigin;

  /* Generic day-array mutator → updates local state + persists.
     `mutate(daysCopy)` returns the new days array. */
  const commitDays = useCallback((mutate) => {
    setTrip((prev) => {
      if (!prev) return prev;
      const nextDays = mutate((prev.data.tripData || []).map((d) => ({ ...d, attractions: [...(d.attractions || [])] })));
      const nextTrip = { ...prev, data: { ...prev.data, tripData: nextDays } };
      if (!prev.readOnly) {
        setSaving(true);
        tripService.saveTrip(prev.id, { data: nextTrip.data }).catch(() => {}).finally(() => setSaving(false));
      }
      return nextTrip;
    });
  }, []);

  /* Sprint 65 — persist a mutated trip.data for the Trip Files gallery. General
     files live at trip.data.files[]; per-stop files stay on
     day.attractions[].attachments[]. Mirrors commitDays' setTrip + saveTrip
     idiom (local state first, best-effort server write, "נשמר…" chip). */
  const persistTripData = useCallback((mutateData) => {
    setTrip((prev) => {
      if (!prev) return prev;
      const nextData = mutateData(prev.data || {});
      const next = { ...prev, data: nextData };
      if (!prev.readOnly) {
        setSaving(true);
        tripService.saveTrip(prev.id, { data: nextData }).catch(() => {}).finally(() => setSaving(false));
      }
      return next;
    });
  }, []);

  /* Sprint 53 #2 — reorder-lock commit / abort. Commit keeps the live edits;
     abort restores the pre-lock day order snapshot, then both drop the lock. */
  const commitReorder = useCallback(() => { focusSnapshotRef.current = null; clearFocusModes(); }, [clearFocusModes]);
  const abortReorder = useCallback(() => {
    const snap = focusSnapshotRef.current;
    if (snap) commitDays(() => snap.map((d) => ({ ...d, attractions: [...(d.attractions || [])] })));
    focusSnapshotRef.current = null;
    clearFocusModes();
  }, [clearFocusModes, commitDays]);

  /* Sprint 43 #2 — set/modify the trip's calendar start date. Persists into
     settings.startDate (JSONB — no schema change), merged so other settings
     survive; the whole calendar cascade recomputes from this one value. */
  const saveStartDate = useCallback((iso) => {
    setTrip((prev) => {
      if (!prev) return prev;
      const nextSettings = { ...(prev.settings || {}), startDate: iso || null };
      const nextTrip = { ...prev, settings: nextSettings };
      if (!prev.readOnly) {
        setSaving(true);
        tripService.saveTrip(prev.id, { settings: nextSettings }).catch(() => {}).finally(() => setSaving(false));
      }
      return nextTrip;
    });
  }, []);

  /* Sprint 45 #1 — apply a full date RANGE from the editor modal. Sets the
     start date AND, if the span implies a different day count, re-shifts the
     schedule arrays WITHOUT dropping any stop: growing appends empty days
     (inheriting the last city), shrinking folds the trailing days' stops into
     the last kept day. Days are renumbered 1..N. */
  const applyDateRange = useCallback((startISO, endISO) => {
    if (!startISO) { saveStartDate(null); return; }
    const s = parseStartDate(startISO);
    const e = endISO ? parseStartDate(endISO) : null;
    const newCount = (s && e && e >= s) ? Math.round((e - s) / 86400000) + 1 : null;
    if (newCount && newCount >= 1) {
      const prevCount = (trip?.data?.tripData || []).length;
      commitDays((arr) => {
        let next = arr.map((d) => ({ ...d, attractions: [...(d.attractions || [])] }));
        const cur = next.length;
        if (newCount > cur) {
          const last = next[cur - 1] || {};
          for (let i = cur; i < newCount; i++) next.push({ day: i + 1, city: last.city, cityHe: last.cityHe, attractions: [] });
        } else if (newCount < cur) {
          const keep = next.slice(0, newCount);
          const dropped = next.slice(newCount);
          const foldTarget = keep[keep.length - 1];
          dropped.forEach((d) => { foldTarget.attractions = [...foldTarget.attractions, ...(d.attractions || [])]; });
          next = keep;
        }
        return next.map((d, i) => ({ ...d, day: i + 1 }));
      });
      /* Shrinking the trip: any general file tagged to a day beyond the new
         length folds back to כללי (day:null) so it never dangles. */
      if (newCount < prevCount && (trip?.data?.files || []).some((f) => f.day != null)) {
        const mapping = {};
        for (let i = 1; i <= newCount; i++) mapping[i] = i;
        persistTripData((data) => ({ ...data, files: remapFileDays(data.files, mapping, newCount) }));
      }
    }
    saveStartDate(startISO);
  }, [commitDays, saveStartDate, trip, persistTripData]);

  /* Open the dates modal pre-filled with the trip's current start + computed
     end (start + dayCount − 1), so the range picker shows the live span. */
  const openDatesModal = useCallback(() => {
    const startIso = trip?.settings?.startDate ? String(trip.settings.startDate).slice(0, 10) : "";
    let endIso = "";
    if (startIso) {
      const s = parseStartDate(startIso);
      const n = (trip?.data?.tripData?.length) || 1;
      if (s) {
        const en = new Date(s.getFullYear(), s.getMonth(), s.getDate() + (n - 1));
        endIso = `${en.getFullYear()}-${String(en.getMonth() + 1).padStart(2, "0")}-${String(en.getDate()).padStart(2, "0")}`;
      }
    }
    setDatesDraft(startIso); setDatesEndDraft(endIso); setDatesModalOpen(true);
  }, [trip]);

  /* Sprint 7 — Called by AddStopSheet when a Places prediction is tapped:
     minimize the sheet to peek, drop the accent pin, fly the map. */
  const handlePreview = useCallback((details) => {
    setPreviewPlace(details);
    if (details.lat != null && details.lng != null) {
      setFlyToCoord({ lat: details.lat, lng: details.lng });
    }
    setShowAddStop(false);
    sheetRef.current?.snapTo?.("peek");
  }, []);

  /* Sprint 7 — Called by PlaceInfoCard CTA → add to the chosen day, clear preview. */
  const handleAddFromPreview = useCallback((stop, dayIndex) => {
    const daysCopy = trip?.data?.tripData ?? [];
    const targetDay = daysCopy[dayIndex]?.day ?? activeDay;
    commitDays((days) => days.map((d) =>
      d.day === targetDay
        ? { ...d, attractions: dedupeDayStops([...d.attractions, stop]) }
        : d
    ));
    setPreviewPlace(null);
    setFlyToCoord(null);
    /* Keep the map (+ remaining nearby result pins) visible so the user can add
       several in a row; otherwise collapse to the schedule as before. */
    sheetRef.current?.snapTo?.(searchResults.length > 0 ? "peek" : "full");
  }, [trip, activeDay, commitDays, searchResults.length]);

  /* ── "מצא נקודות באזור" results list (mobile bottom sheet) ──
     Anchor point (with name) kept for the sheet header, + lazy per-row
     detail enrichment (Google editorial line, concurrency 2, cached). */
  const [nearbyAnchor, setNearbyAnchor] = useState(null);
  const [nearbyDetails, setNearbyDetails] = useState({});
  const [nearbyAdded, setNearbyAdded] = useState(() => new Set());
  const nearbyDetailsRef = useRef({});
  const nearbyQueueRef = useRef([]);
  const nearbyInFlightRef = useRef(0);
  useEffect(() => { nearbyDetailsRef.current = nearbyDetails; }, [nearbyDetails]);
  const drainNearbyQueue = useCallback(() => {
    while (nearbyInFlightRef.current < 2 && nearbyQueueRef.current.length) {
      const id = nearbyQueueRef.current.shift();
      nearbyInFlightRef.current += 1;
      setNearbyDetails((m) => (m[id] ? m : { ...m, [id]: "loading" }));
      getDetails(id)
        .then((d) => setNearbyDetails((m) => ({ ...m, [id]: d || {} })))
        .catch(() => setNearbyDetails((m) => ({ ...m, [id]: {} })))
        .finally(() => { nearbyInFlightRef.current -= 1; drainNearbyQueue(); });
    }
  }, []);
  const wantNearbyDetails = useCallback((id) => {
    if (!id || nearbyDetailsRef.current[id] || nearbyQueueRef.current.includes(id)) return;
    nearbyQueueRef.current.push(id);
    drainNearbyQueue();
  }, [drainNearbyQueue]);
  const resetNearbyDetails = useCallback(() => {
    nearbyQueueRef.current = []; nearbyInFlightRef.current = 0;
    setNearbyDetails({}); setNearbyAdded(new Set());
  }, []);
  const clearNearby = useCallback(() => {
    setSearchResults([]); setSearchOrigin(null); setNearbyAnchor(null);
    resetNearbyDetails();
  }, [resetNearbyDetails]);
  const addNearbyToDay = useCallback((r) => {
    if (!r) return;
    const { he } = classifyLocation(r.types || []);
    const stop = {
      name: r.name, nameHe: r.name,
      category: he || "אטרקציה",
      rating: r.rating || undefined,
      coordinates: { lat: r.lat, lng: r.lng },
      place_id: r.placeId || undefined,
      instanceId: genInstanceId(),
    };
    commitDays((days) => days.map((d) =>
      d.day === activeDay ? { ...d, attractions: dedupeDayStops([...d.attractions, stop]) } : d
    ));
    setNearbyAdded((s) => { const n = new Set(s); n.add(r.placeId || `${r.lat},${r.lng}`); return n; });
  }, [activeDay, commitDays]);
  const openNearby = useCallback((r) => {
    if (r && Number.isFinite(r.lat) && Number.isFinite(r.lng)) setFlyToCoord({ lat: r.lat, lng: r.lng });
  }, []);

  const handleReorder = useCallback((newStops) => {
    commitDays((days) => days.map((d) => d.day === activeDay ? { ...d, attractions: newStops } : d));
  }, [activeDay, commitDays]);


  /* Sprint 21 #4 — list→map link. Tapping a stop card flies the map to its
     coordinates and collapses the sheet to peek so the pin is fully visible. */
  /* Sprint 62 #1/#2 — smooth-scroll the active-day schedule to a specific stop
     row (by day-array index) via its stable data-attribute hook. `block:"start"`
     pins it to the top; a small delay lets the sheet finish expanding first. */
  const scrollToStopRow = useCallback((idx, block = "start") => {
    if (idx == null || idx < 0) return;
    const run = () => {
      const el = document.querySelector(`[data-stop-idx="${idx}"]`);
      if (el && el.scrollIntoView) el.scrollIntoView({ behavior: "smooth", block });
    };
    /* two RAFs + a timeout so the snap transition + list render settle. */
    requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(run, 120)));
  }, []);

  const navigateToStop = useCallback((stop) => {
    const c = stop?.coordinates;
    if (!c || !Number.isFinite(c.lat) || !Number.isFinite(c.lng)) return;
    /* Sprint 62 #2 — remember which row opened this card so the ✕ return stack
       can scroll back to it. Match by object identity within the active day. */
    const arr = (trip?.data?.tripData || []).find((d) => d.day === activeDay)?.attractions || [];
    returnStopIdx.current = arr.indexOf(stop);
    setFlyToCoord({ lat: c.lat, lng: c.lng });
    /* Sprint 44 #3 — enter the persistent active-stop context so the map
       opens (and keeps) the detail card + highlighted marker. */
    setActiveStop(stop);
    sheetRef.current?.snapTo?.("peek");
  }, [trip, activeDay]);

  /* Sprint 57 #3 — "search saved points around THIS stop": centre the map on
     the stop, apply a spatial box around its coordinates, and reveal the
     Places-Inbox saved markers residing in that cluster. */
  /* "מצא לי X באזור" from a stop's map card — opens the category picker (was the
     old saved-points-nearby query). Clearing the geo-filter keeps that state
     used and removes any stale saved-point filter. */
  const searchAroundStop = useCallback((stop) => {
    const c = stop?.coordinates || (Number.isFinite(stop?.lat) ? { lat: stop.lat, lng: stop.lng } : null);
    if (!c || !Number.isFinite(c.lat) || !Number.isFinite(c.lng)) return;
    setInboxGeoFilter(null);
    setActiveStop(null); // drop the card
    setNearbyOrigin(stop); // open the nearby-places picker
  }, []);

  /* Sprint 34 — ASSIGN an unassigned inbox place to a day (single-home
     model): the stop moves INTO the day AND leaves the unassigned pile,
     so the unified inbox shows it once — now with a "✓ שובץ במסלול (יום X)"
     badge instead of the assign CTA. */
  const assignInboxPlace = useCallback((p, dayNum) => {
    if (!p || !dayNum) return;
    /* Sprint 65 #9 — COVER-PHOTO PERSISTENCE: explicitly carry the Google
       Places photo + editorial metadata (and place_id) into the schedule stop
       JSON so a saved point keeps its image instead of falling back to the
       placeholder icon once it lands on a day. */
    const photoUrl = p.photoUrl || p.photo || p.photo_url || p.image_url || p.google_photo || undefined;
    const stop = {
      name: p.name, nameHe: p.nameHe, category: p.category, rating: p.rating,
      note: p.note, coordinates: { lat: p.lat, lng: p.lng },
      place_id: p.place_id || undefined,
      photoUrl,
      description: p.description || undefined,
      instanceId: genInstanceId(),
    };
    commitDays((days) => days.map((d) =>
      d.day === dayNum ? { ...d, attractions: dedupeDayStops([...d.attractions, stop]) } : d
    ));
    setInboxPlaces((prev) => (prev || []).filter((x) => x.id !== p.id));
    removeInboxPlace(p.id);
  }, [commitDays]);

  /* Sprint 50 #2 — PURGE a point from the master Places-Inbox store entirely
     (explicit 🗑️). Removes it from local state AND the persisted repository. */
  const deleteInboxPlace = useCallback((p) => {
    if (!p || p.id == null) return;
    setInboxPlaces((prev) => (prev || []).filter((x) => x.id !== p.id));
    /* Keep the lazily-loaded global bank in sync if it's already been built. */
    setGlobalPoints((prev) => (prev ? prev.filter((x) => x.key !== `i-${p.id}`) : prev));
    removeInboxPlace(p.id);
  }, []);

  /* Save an EDITED note back to the bank point (persist + reflect in every
     list: the carousel, the global pile, and the open detail card). */
  const saveInboxNote = useCallback((p) => {
    if (!p || p.id == null) return;
    const note = (p.note || "").trim();
    updateInboxPlace(p.id, { note }).catch(() => {});
    setInboxPlaces((prev) => (prev || []).map((x) => (x.id === p.id ? { ...x, note: note || undefined } : x)));
    setGlobalPoints((prev) => (prev ? prev.map((x) => (x.id === p.id ? { ...x, note: note || undefined } : x)) : prev));
    setInboxCardMenu((c) => (c && c.id === p.id ? { ...c, _noteSaved: true } : c));
    setCopyToast("ההערה נשמרה ✓");
  }, []);

  /* Sprint 58 #5 — fast-insert a saved point into the CURRENT active day
     without leaving the 70% side drawer; flashes a confirmation micro-toast. */
  const quickAssignToActiveDay = useCallback((p) => {
    if (!p) return;
    assignInboxPlace(p, activeDay);
    setInboxCardMenu(null);
    setCopyToast(`שובץ ביום ${activeDay} ✓`);
  }, [assignInboxPlace, activeDay]);

  /* Sprint 34 — long-press custom pin. Always creates the stop; a chosen
     day assigns it to the timeline, otherwise it lands in the unassigned
     inbox pile. */
  const handleSaveCustomPin = useCallback((pin, target) => {
    const stop = { name: pin.name, nameHe: pin.name, category: "נקודה אישית", note: pin.note, coordinates: pin.coordinates };
    if (target && target.day != null) {
      commitDays((days) => days.map((d) =>
        d.day === target.day
          ? { ...d, attractions: dedupeDayStops([...d.attractions, stop]) }
          : d
      ));
    } else {
      addInboxPlaces([{
        name: pin.name, nameHe: pin.name, category: "נקודה אישית",
        note: pin.note, lat: pin.coordinates.lat, lng: pin.coordinates.lng,
        source: "map-longpress",
      }]).then((saved) => setInboxPlaces((prev) => ([...saved, ...(prev || [])]))).catch(() => {});
    }
  }, [commitDays]);

  /* Sprint 28 #4 — the SINGLE add-stop entry handler, shared verbatim by
     both placements (day-header [+] and the bottom FAB) so the day
     context (activeDay) is identical wherever the user starts. */
  const openAddStop = useCallback(() => {
    setPendingCoord(null);
    setShowAddStop(true);
  }, []);

  /* Sprint 30 — inline commute-mode cycle: persist the chosen mode on the
     origin stop of the rail (index within the active day). No new rows,
     no AddTransitSheet — a clean inline mutation that recomputes the
     duration/distance metadata on the next render. */
  const setTransitMode = useCallback((index, mode) => {
    commitDays((days) => days.map((d) =>
      d.day === activeDay
        ? { ...d, attractions: d.attractions.map((a, i) => (i === index ? { ...a, transitMode: mode } : a)) }
        : d
    ));
  }, [activeDay, commitDays]);

  /* ── Sprint 37 #2 — index-addressed gesture handlers ──
     These operate on an explicit `idx` (from a swipe / context menu) rather
     than the `actionsIdx` sheet state, so a gesture never depends on the
     3-dot sheet being open. */

  /* Swipe-left → delete with a 5-second Undo window. The removed stop is
     stashed so `undoDelete` can splice it back at its original index. */
  const deleteStopAt = useCallback((idx) => {
    const day = (trip?.data?.tripData || []).find((d) => d.day === activeDay);
    const stop = day?.attractions?.[idx];
    if (!stop) return;
    commitDays((days) => days.map((d) =>
      d.day === activeDay ? { ...d, attractions: d.attractions.filter((_, i) => i !== idx) } : d
    ));
    setDeleteUndo({ stop, day: activeDay, idx });
  }, [trip, activeDay, commitDays]);

  const undoDelete = useCallback(() => {
    setDeleteUndo((u) => {
      if (!u) return null;
      commitDays((days) => days.map((d) => {
        if (d.day !== u.day) return d;
        const list = [...d.attractions];
        list.splice(Math.min(u.idx, list.length), 0, u.stop);
        return { ...d, attractions: list };
      }));
      return null;
    });
  }, [commitDays]);

  /* Sprint 38 #3 — Swipe-right → snooze the stop into the Places Inbox with a
     non-blocking 10-second UNDO pill. We capture the origin day + index and
     (once the async inbox write resolves) its inbox id, so "החזר ליום זה"
     removes the inbox entry and restores the stop to its exact former slot. */
  const requestInboxAt = useCallback((idx) => {
    const day = (trip?.data?.tripData || []).find((d) => d.day === activeDay);
    const moved = day?.attractions?.[idx];
    if (!moved) return;
    commitDays((days) => days.map((d) =>
      d.day === activeDay ? { ...d, attractions: d.attractions.filter((_, i) => i !== idx) } : d
    ));
    setInboxUndo({ stop: moved, day: activeDay, idx, inboxId: null });
    if (moved.coordinates && Number.isFinite(moved.coordinates.lat)) {
      addInboxPlaces([{
        name: moved.name, nameHe: moved.nameHe || moved.name,
        category: moved.category || "אטרקציה", rating: moved.rating || "",
        note: moved.note, lat: moved.coordinates.lat, lng: moved.coordinates.lng,
        source: "unassigned",
      }]).then((saved) => {
        setInboxPlaces((prev) => ([...saved, ...(prev || [])]));
        if (saved && saved[0]) setInboxUndo((u) => (u && u.stop === moved ? { ...u, inboxId: saved[0].id } : u));
      }).catch(() => {});
    }
  }, [trip, activeDay, commitDays]);

  /* Restore a snoozed stop back to its original day + index, dropping the
     inbox copy it created. */
  const restoreFromInbox = useCallback(() => {
    setInboxUndo((u) => {
      if (!u) return null;
      commitDays((days) => days.map((d) => {
        if (d.day !== u.day) return d;
        const list = [...d.attractions];
        list.splice(Math.min(u.idx, list.length), 0, u.stop);
        return { ...d, attractions: list };
      }));
      if (u.inboxId) { setInboxPlaces((prev) => (prev || []).filter((x) => x.id !== u.inboxId)); removeInboxPlace(u.inboxId); }
      return null;
    });
  }, [commitDays]);

  /* Context menu → "Move to Day…". Moves the active-day stop at `idx`. */
  const moveStopIndexToDay = useCallback((idx, toDay) => {
    commitDays((days) => {
      const from = days.find((d) => d.day === activeDay);
      if (!from) return days;
      const [moved] = from.attractions.splice(idx, 1);
      const to = days.find((d) => d.day === toDay);
      if (to && moved) to.attractions = dedupeDayStops([...to.attractions, moved]);
      return days;
    });
  }, [activeDay, commitDays]);

  /* Context menu → "Set as Lodging Anchor" (toggle). Reclassifies IN PLACE
     (Sprint 37 #1 — never bottom-pushed); toggling off restores the prior
     category and clears any multi-day hotel grouping. */
  const toggleLodgingAnchorAt = useCallback((idx) => {
    commitDays((days) => days.map((d) => {
      if (d.day !== activeDay) return d;
      return { ...d, attractions: d.attractions.map((a, i) => {
        if (i !== idx) return a;
        const isLodg = !!a._hotelGroup || /מלון|לינה/.test(a.category || "");
        if (isLodg) {
          const { _hotelGroup, _hotelSpan, _prevCategory, ...rest } = a;
          return { ...rest, category: _prevCategory || "אטרקציה" };
        }
        return { ...a, _prevCategory: a.category, category: "מלון" };
      }) };
    }));
  }, [activeDay, commitDays]);

  /* Context menu → "Change Theme". Stamps a per-stop accent color override. */
  const setStopThemeAt = useCallback((idx, theme) => {
    commitDays((days) => days.map((d) =>
      d.day === activeDay
        ? { ...d, attractions: d.attractions.map((a, i) => i === idx ? { ...a, _theme: theme || undefined } : a) }
        : d
    ));
  }, [activeDay, commitDays]);

  /* Sprint 27 #3 — commit an edited transit segment back onto its slot
     in the active day (opened from the card or the map's "ערוך מעבר"). */
  const updateTransitAt = useCallback((index, segment) => {
    commitDays((days) => days.map((d) =>
      d.day === activeDay
        ? { ...d, attractions: d.attractions.map((a, i) => (i === index ? { ...a, ...segment } : a)) }
        : d
    ));
    setEditTransitIdx(-1);
  }, [activeDay, commitDays]);

  /* Sprint 27 #5 — route a searched place into the generic Places Inbox
     ("בנק הנקודות") instead of a specific day. */
  const saveStopToInbox = useCallback(async (stop) => {
    const c = stop?.coordinates;
    if (!c) return;
    try {
      const saved = await addInboxPlaces([{
        name: stop.name, nameHe: stop.nameHe || stop.name,
        category: stop.category || "אטרקציה", rating: stop.rating || "",
        lat: c.lat, lng: c.lng, source: "map-search",
        /* Carry identity + the personal note so the bank card shows the real
           photo, opens the real Google listing, and keeps the note. */
        place_id: stop.place_id || stop.placeId || undefined,
        photoUrl: stop.photoUrl || undefined,
        note: stop.note || undefined,
      }]);
      /* Always seed from [] when the bank was never opened (prev === null),
         so the FIRST saved point immediately shows on the bank button badge. */
      setInboxPlaces((prev) => [...saved, ...(prev || [])]);
    } catch { /* best-effort — the place remains in the preview flow */ }
    setPendingStop(null);
    setPreviewPlace(null);
    setFlyToCoord(null);
  }, []);

  /* Sprint 27 #5 — place the intercepted stop on a specific day. */
  const placeStopOnDay = useCallback((stop, dayNum) => {
    commitDays((days) => days.map((d) =>
      d.day === dayNum ? { ...d, attractions: dedupeDayStops([...d.attractions, stop]) } : d
    ));
    setPendingStop(null);
  }, [commitDays]);

  /* "מפות נוספות" — reset popup/adds when the loaded map changes (or clears). */
  const applyOverlayMap = useCallback((m) => { setOverlayMap(m); setOverlaySel(null); setAddChoice(null); setAddedKeys(new Set()); }, []);
  const closeRefMaps = useCallback(() => { setRefMapsOpen(false); applyOverlayMap(null); }, [applyOverlayMap]);
  const focusOverlayPoint = useCallback((p) => { if (p && Number.isFinite(p.lat) && Number.isFinite(p.lng)) setFlyToCoord({ lat: p.lat, lng: p.lng }); setOverlaySel(p); }, []);
  /* Add overlay points to the trip. target = "bank" | <dayNumber>. */
  const addOverlayPoints = useCallback((pts, target, includeNotes = true) => {
    (pts || []).forEach((p) => {
      const stop = {
        name: p.name, nameHe: p.nameHe || p.name, category: p.category || "אטרקציה",
        rating: p.rating || undefined, coordinates: { lat: p.lat, lng: p.lng },
        place_id: p.place_id || undefined, photoUrl: p.photoUrl || undefined,
        note: includeNotes ? (p.note || undefined) : undefined,
        instanceId: genInstanceId(),
      };
      if (target === "bank") saveStopToInbox(stop); else placeStopOnDay(stop, target);
    });
    setAddedKeys((prev) => { const n = new Set(prev); (pts || []).forEach((p) => n.add(p.key)); return n; });
    const n = (pts || []).length;
    setCopyToast(`${n} ${n === 1 ? "נקודה נוספה" : "נקודות נוספו"} ${target === "bank" ? "לבנק" : `ליום ${target}`} ✓`);
  }, [saveStopToInbox, placeStopOnDay]);

  /* Sprint 21 #3 — persist a note on the active-day stop at `index`
     (driven by the fast pencil trigger + NoteSheet). */
  /* Sprint 61 #1 — write a note to a SINGLE active-day instance. */
  const writeNoteToInstance = useCallback((index, note) => {
    commitDays((days) => days.map((d) =>
      d.day === activeDay
        ? { ...d, attractions: d.attractions.map((a, i) => i === index ? { ...a, note: note || undefined } : a) }
        : d
    ));
  }, [activeDay, commitDays]);

  /* Sprint 61 #1 — write a note to EVERY instance of the same place across the
     whole itinerary (matched by placeKeyOf). */
  const writeNoteToAllMatching = useCallback((key, note) => {
    commitDays((days) => days.map((d) => ({
      ...d,
      attractions: (d.attractions || []).map((a) => (!a._transit && placeKeyOf(a) === key ? { ...a, note: note || undefined } : a)),
    })));
  }, [commitDays]);

  const saveNoteAt = useCallback((index, text) => {
    const note = (text || "").trim();
    const daysNow = trip?.data?.tripData || [];
    const target = daysNow.find((d) => d.day === activeDay)?.attractions?.[index];
    const key = placeKeyOf(target);
    /* Count how many times this exact place appears across all days. */
    let count = 0;
    daysNow.forEach((d) => (d.attractions || []).forEach((a) => { if (!a._transit && placeKeyOf(a) === key) count += 1; }));
    setNoteEditIdx(-1);
    if (count > 1) {
      /* Sprint 61 #1 — CONDITIONAL CASCADE: ask whether to apply everywhere. */
      setNotePrompt({ index, note, key, count });
    } else {
      writeNoteToInstance(index, note);
    }
  }, [trip, activeDay, writeNoteToInstance]);

  /* Sprint 61 #2 — DUPLICATE a stop: clone it (fresh instanceId) into the
     current day (right after the original) or the next day. Bypasses the
     single-home dedupe so identical places may co-exist. */
  const duplicateStopAt = useCallback((index, toNextDay = false) => {
    const src = (trip?.data?.tripData || []).find((d) => d.day === activeDay)?.attractions?.[index];
    if (!src) return;
    const clone = { ...src, instanceId: genInstanceId() };
    if (toNextDay) {
      commitDays((days) => {
        const sorted = [...days].sort((a, b) => a.day - b.day);
        const from = sorted.find((d) => d.day === activeDay);
        let to = sorted.find((d) => d.day > activeDay);
        if (!to) {
          const maxDay = sorted.reduce((m, d) => Math.max(m, d.day), 0);
          to = { day: maxDay + 1, city: from?.city, cityHe: from?.cityHe, attractions: [] };
          days.push(to);
        }
        to.attractions = [clone, ...to.attractions];
        return days;
      });
    } else {
      commitDays((days) => days.map((d) =>
        d.day === activeDay
          ? { ...d, attractions: [...d.attractions.slice(0, index + 1), clone, ...d.attractions.slice(index + 1)] }
          : d
      ));
    }
    setCopyToast("המיקום שוכפל ✓");
  }, [trip, activeDay, commitDays]);

  /* Sprint 61 #5 — open the native file picker for the active-day stop `index`. */
  const requestAttach = useCallback((index) => {
    attachTargetIdx.current = index;
    if (attachInputRef.current) { attachInputRef.current.value = ""; attachInputRef.current.click(); }
  }, []);

  /* Sprint 61 #5 — a picked file is uploaded (Supabase Storage → durable URL,
     else a session object URL) and appended to the stop's attachments[]. */
  const onAttachFilePicked = useCallback(async (e) => {
    const file = e.target.files && e.target.files[0];
    const index = attachTargetIdx.current;
    if (!file || index < 0) return;
    setAttachBusy(true);
    try {
      const meta = await uploadAttachment(trip?.id, file);
      commitDays((days) => days.map((d) =>
        d.day === activeDay
          ? { ...d, attractions: d.attractions.map((a, i) => i === index ? { ...a, attachments: [...(a.attachments || []), meta] } : a) }
          : d
      ));
      setCopyToast(meta.persisted ? "הקובץ צורף ✓" : "הקובץ צורף (זמני) ✓");
    } catch (err) {
      setCopyToast(/too large/.test(err?.message || "") ? "הקובץ גדול מדי (מקס' 15MB)" : "צירוף הקובץ נכשל");
    } finally {
      setAttachBusy(false);
      attachTargetIdx.current = -1;
    }
  }, [trip, activeDay, commitDays]);

  /* Sprint 61 #5 — open an attached document in a new browser tab. */
  /* Sprint 65 #1 — open the attachment in the IN-APP viewer modal instead of a
     new browser tab. Blob URLs opened via window.open fail on Safari/iOS
     ("WebKitBlobResource error 1"); rendering the blob inline in an <img>/
     <iframe> works reliably. */
  const openAttachment = useCallback((f, idx, fi) => {
    if (f && f.url) setAttachViewer({ file: f, idx, fi });
  }, []);

  /* Sprint 65 #2 — remove an attachment from an active-day stop instance. */
  const deleteAttachmentAt = useCallback((idx, fi) => {
    if (idx == null || idx < 0 || fi == null || fi < 0) return;
    commitDays((days) => days.map((d) =>
      d.day === activeDay
        ? { ...d, attractions: d.attractions.map((a, i) => {
            if (i !== idx || !Array.isArray(a.attachments)) return a;
            const next = a.attachments.filter((_, k) => k !== fi);
            return { ...a, attachments: next.length ? next : undefined };
          }) }
        : d
    ));
    setCopyToast("הקובץ הוסר ✓");
  }, [activeDay, commitDays]);

  /* Sprint 65 — TRIP FILES GALLERY. Derived views over trip.data for the
     <TripFilesSheet>: general files (trip.data.files[]) + a badge count that
     also folds in every per-stop attachment. Editable unless the trip is
     read-only (shared, no write access). */
  const tripFiles = trip?.data?.files || [];
  const filesDayCount = (trip?.data?.tripData || []).length;
  const filesEditable = !!trip && !trip.readOnly;
  const tripFilesCount =
    tripFiles.length +
    (trip?.data?.tripData || []).reduce(
      (n, d) => n + (d.attractions || []).reduce((m, a) => m + ((a.attachments || []).length), 0),
      0,
    );

  /* Upload a picked file into the general bucket (day = null → כללי) or tagged
     to a specific day. Mirrors onAttachFilePicked's upload plumbing; writes the
     new record onto trip.data.files[] via persistTripData. */
  const handleFileUpload = useCallback(async (file, day) => {
    setFilesBusy(true);
    try {
      const meta = await uploadAttachment(trip?.id, file);
      persistTripData((data) => ({
        ...data,
        files: [...(data.files || []), {
          ...meta, id: newFileId(), label: meta.name, day: day ?? null,
          addedAt: new Date().toISOString(),
        }],
      }));
    } catch {
      setFilesToast("שגיאה בהעלאת הקובץ");
    } finally {
      setFilesBusy(false);
    }
  }, [trip, persistTripData]);

  /* Rename a file's label. General → patch trip.data.files[id].label; per-stop →
     patch the attachment label in place on its day/stop. */
  const handleFileRename = useCallback((row, label) => {
    if (row.kind === "general") {
      persistTripData((data) => ({
        ...data,
        files: (data.files || []).map((f) => (f.id === row.id ? { ...f, label } : f)),
      }));
    } else {
      persistTripData((data) => ({
        ...data,
        tripData: (data.tripData || []).map((d) => d.day !== row.dayNum ? d : {
          ...d,
          attractions: d.attractions.map((a, i) => i !== row.stopIdx ? a : {
            ...a,
            attachments: (a.attachments || []).map((f, k) => k === row.fi ? { ...f, label } : f),
          }),
        }),
      }));
    }
  }, [persistTripData]);

  /* Move a GENERAL file between כללי (day = null) and a day tab. Per-stop files
     are anchored to their stop and never move here. */
  const handleFileMove = useCallback((row, day) => {
    if (row.kind !== "general") return;
    persistTripData((data) => ({
      ...data,
      files: (data.files || []).map((f) => (f.id === row.id ? { ...f, day: day ?? null } : f)),
    }));
  }, [persistTripData]);

  /* Delete a file. Best-effort permanent Storage delete first (when it was
     persisted with a path), then drop the record: general → out of
     trip.data.files[]; per-stop → splice from that stop's attachments[]. */
  const handleFileDelete = useCallback((row) => {
    if (row.path) removeStoredFile(row.path).catch((e) => console.warn("removeStoredFile", e));
    if (row.kind === "general") {
      persistTripData((data) => ({ ...data, files: (data.files || []).filter((f) => f.id !== row.id) }));
    } else {
      persistTripData((data) => ({
        ...data,
        tripData: (data.tripData || []).map((d) => d.day !== row.dayNum ? d : {
          ...d,
          attractions: d.attractions.map((a, i) => i !== row.stopIdx ? a : {
            ...a,
            attachments: (a.attachments || []).filter((_, k) => k !== row.fi),
          }),
        }),
      }));
    }
  }, [persistTripData]);

  /* Sprint 62 #5 — open the rich saved-point card and, when a live Google
     Places key is configured, best-effort enrich it with a cover photo +
     editorial summary (autocomplete → details, biased to the point's area).
     Fully graceful: without a key (or on any failure) the metadata-only card
     stays exactly as-is. Merges only if the same card is still open. */
  const openSavedPointCard = useCallback((p) => {
    if (!p) return;
    setInboxCardMenu(p);
    if (Number.isFinite(p.lat) && Number.isFinite(p.lng)) setFlyToCoord({ lat: p.lat, lng: p.lng });
    if (p.photoUrl || p.photo || p.description || !isPlacesEnabled()) return;
    const q = p.nameHe || p.name;
    if (!q) return;
    const same = (c) => c && ((c.id != null && c.id === p.id) || (c.key != null && c.key === p.key) || ((c.nameHe || c.name) === (p.nameHe || p.name)));
    (async () => {
      try {
        const bias = Number.isFinite(p.lat) && Number.isFinite(p.lng)
          ? { bias: { west: p.lng - 0.05, east: p.lng + 0.05, south: p.lat - 0.05, north: p.lat + 0.05 } }
          : {};
        const preds = await autocomplete(q, bias);
        const first = preds && preds[0];
        if (!first) return;
        const d = await getDetails(first.placeId);
        if (!d) return;
        setInboxCardMenu((cur) => (same(cur)
          ? { ...cur, photoUrl: d.photoUrl || cur.photoUrl, description: d.description || cur.description, rating: cur.rating || (d.rating != null ? String(d.rating) : cur.rating) }
          : cur));
      } catch { /* enrichment is best-effort */ }
    })();
  }, []);

  /* Sprint 11 — field check-off: flip `completed` on the active day's
     stop at `index`, persisted through commitDays → saveTrip. */
  const toggleComplete = useCallback((index) => {
    commitDays((days) => days.map((d) =>
      d.day === activeDay
        ? { ...d, attractions: d.attractions.map((a, i) => i === index ? { ...a, completed: !a.completed } : a) }
        : d
    ));
  }, [activeDay, commitDays]);

  /* Sprint 20 #5c — Day Completion. Flip a `_dayDone` flag on a whole
     day. A completed day dims its timeline (handled in render) and shows
     a checkmark on its day chip in the collapsed sheet. */
  const toggleDayComplete = useCallback((dayNum) => {
    commitDays((days) => days.map((d) =>
      d.day === dayNum ? { ...d, _dayDone: !d._dayDone } : d
    ));
  }, [commitDays]);

  /* Sprint 11 — rollover an unvisited stop: splice it out of the
     current day and inject it at the TOP of `toDay`'s list (reset
     its completed flag), then persist. */
  const rolloverStop = useCallback((index, toDay) => {
    commitDays((days) => {
      const from = days.find((d) => d.day === activeDay);
      if (!from) return days;
      const list = [...from.attractions];
      const [moved] = list.splice(index, 1);
      if (!moved) return days;
      from.attractions = list;
      const to = days.find((d) => d.day === toDay);
      if (to) to.attractions = dedupeDayStops([{ ...moved, completed: false }, ...to.attractions]);
      return days;
    });
  }, [activeDay, commitDays]);

  /* Add a stop to the active day (dedup enforced). */
  const handleAddStop = useCallback((stop) => {
    commitDays((days) => days.map((d) =>
      d.day === activeDay ? { ...d, attractions: dedupeDayStops([...d.attractions, stop]) } : d
    ));
    setShowAddStop(false);
    setPendingCoord(null);
    setIsPinning(false);
  }, [activeDay, commitDays]);

  /* Sprint 42 #7 — add a LODGING stop to several days at once. Each selected
     day receives an INDEPENDENT clone (Sprint 38 #7 model — no lock/group),
     appended without dedupe so a hotel can repeat across nights. */
  const handleAddStopToDays = useCallback((stop, dayNums) => {
    const set = new Set((dayNums && dayNums.length ? dayNums : [activeDay]));
    commitDays((days) => days.map((d) =>
      set.has(d.day) ? { ...d, attractions: [...d.attractions, { ...stop }] } : d
    ));
    setShowAddStop(false);
    setPendingCoord(null);
    setIsPinning(false);
  }, [activeDay, commitDays]);

  /* Add a transit/movement segment to the active day. Appended (no
     dedupe) so repeated legs — e.g. a round-trip flight — are allowed.
     The item carries `_transit:true`, so the timeline renders it as a
     transit block and the map projection skips it (no coordinates). */
  const handleAddTransit = useCallback((segment) => {
    commitDays((days) => days.map((d) =>
      d.day === activeDay ? { ...d, attractions: [...d.attractions, segment] } : d
    ));
    setShowAddTransit(false);
  }, [activeDay, commitDays]);

  /* Quick-actions on the active day's stop at index `actionsIdx`. */
  const moveStopToDay = useCallback((toDay) => {
    commitDays((days) => {
      const from = days.find((d) => d.day === activeDay);
      if (!from) return days;
      const [moved] = from.attractions.splice(actionsIdx, 1);
      const to = days.find((d) => d.day === toDay);
      if (to && moved) to.attractions = dedupeDayStops([...to.attractions, moved]);
      return days;
    });
    setActionsIdx(-1);
  }, [activeDay, actionsIdx, commitDays]);

  const copyStopToDay = useCallback((toDay) => {
    commitDays((days) => {
      const from = days.find((d) => d.day === activeDay);
      const stop = from?.attractions[actionsIdx];
      const to = days.find((d) => d.day === toDay);
      if (to && stop) to.attractions = dedupeDayStops([...to.attractions, { ...stop }]);
      return days;
    });
    setActionsIdx(-1);
  }, [activeDay, actionsIdx, commitDays]);

  /* Sprint 51 #2 — TOGGLE lodging designation in place (any stop, even custom),
     capped at a maximum of 2 lodging nodes per day. Toggling off restores the
     previous category and clears any multi-day hotel grouping. */
  const setStopAsLodging = useCallback(() => {
    commitDays((days) => days.map((d) => {
      if (d.day !== activeDay) return d;
      const cur = d.attractions[actionsIdx];
      if (!cur) return d;
      const isLodg = !!cur._hotelGroup || /מלון|לינה/.test(cur.category || "");
      if (!isLodg) {
        const count = d.attractions.filter((a, i) => i !== actionsIdx && !a._transit && (a._hotelGroup || /מלון|לינה/.test(a.category || ""))).length;
        if (count >= 2) return d; // cap: max 2 lodging nodes / day
      }
      return { ...d, attractions: d.attractions.map((a, i) => {
        if (i !== actionsIdx) return a;
        if (isLodg) {
          const { _hotelGroup, _hotelSpan, _prevCategory, ...rest } = a;
          return { ...rest, category: _prevCategory || "אטרקציה" };
        }
        return { ...a, _prevCategory: a.category, category: "מלון" };
      }) };
    }));
    setActionsIdx(-1);
  }, [activeDay, actionsIdx, commitDays]);

  /* Sprint 51 #2 — stamp / clear a persistent pastel theme on the ⋯ stop. */
  const setStopColorForActions = useCallback((color) => {
    if (actionsIdx < 0) return;
    commitDays((days) => days.map((d) =>
      d.day === activeDay
        ? { ...d, attractions: d.attractions.map((a, i) => i === actionsIdx ? { ...a, _theme: color || undefined } : a) }
        : d
    ));
  }, [activeDay, actionsIdx, commitDays]);

  /* Sprint 51 #1 — splice a distinct inline-note node into the active day's
     array at `idx` (between two location stops). No coordinates, no index. */
  const addInlineNoteAt = useCallback((idx, text) => {
    const t = (text || "").trim();
    if (!t || idx < 0) return;
    commitDays((days) => days.map((d) => {
      if (d.day !== activeDay) return d;
      const list = [...d.attractions];
      const at = Math.min(Math.max(0, idx), list.length);
      list.splice(at, 0, { _inlineNote: true, text: t });
      return { ...d, attractions: list };
    }));
    setInsertAt(-1); setInsertText("");
  }, [activeDay, commitDays]);

  /* Sprint 52 #2 — 1-tap transit generator. Inherits origin coords from the
     nearest place stop BEFORE the gap and destination coords from the nearest
     stop AFTER it — zero mandatory typing. Optional free-text note attached. */
  const addTransitAt = useCallback((idx, transitType, note) => {
    if (idx < 0 || !transitType) return;
    commitDays((days) => days.map((d) => {
      if (d.day !== activeDay) return d;
      const list = [...d.attractions];
      const at = Math.min(Math.max(0, idx), list.length);
      const isFlow = (a) => a && !a._transit && !a._inlineNote && !a._inlineTransit;
      let A = null, B = null;
      for (let i = at - 1; i >= 0; i--) { if (isFlow(list[i])) { A = list[i]; break; } }
      for (let i = at; i < list.length; i++) { if (isFlow(list[i])) { B = list[i]; break; } }
      /* Baseline great-circle distance between the two stops (km), when both
         have coordinates — a zero-typing estimate the user can trust. */
      let km;
      const ac = A?.coordinates, bc = B?.coordinates;
      if (ac && bc && Number.isFinite(ac.lat) && Number.isFinite(bc.lat)) {
        const R = 6371, toRad = (x) => (x * Math.PI) / 180;
        const dLat = toRad(bc.lat - ac.lat), dLng = toRad(bc.lng - ac.lng);
        const s = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(ac.lat)) * Math.cos(toRad(bc.lat)) * Math.sin(dLng / 2) ** 2;
        km = Math.round(R * 2 * Math.atan2(Math.sqrt(s), Math.sqrt(1 - s)));
      }
      const node = {
        _inlineTransit: true, transitType,
        from: A ? (A.nameHe || A.name || "") : "",
        to: B ? (B.nameHe || B.name || "") : "",
        fromCoord: ac || null, toCoord: bc || null,
        km: Number.isFinite(km) ? km : undefined,
        note: (note || "").trim() || undefined,
      };
      list.splice(at, 0, node);
      return { ...d, attractions: list };
    }));
    setInsertAt(-1); setInsertText("");
  }, [activeDay, commitDays]);

  const deleteStop = useCallback(() => {
    commitDays((days) => days.map((d) =>
      d.day === activeDay ? { ...d, attractions: d.attractions.filter((_, i) => i !== actionsIdx) } : d
    ));
    setActionsIdx(-1);
  }, [activeDay, actionsIdx, commitDays]);

  /* Sprint 38 #7 — multi-day hotel = INDEPENDENT CLONES (no lock, no shared
     group). The active stop is reclassified as lodging in place; a plain
     duplicate lodging card is appended to each other chosen day, where it
     behaves like any other stop (freely draggable / deletable). Appended
     without dedupe so duplicate lodging cards are allowed. */
  const setStopAsMultiDayHotel = useCallback((dayNums) => {
    const chosen = Array.from(new Set([activeDay, ...(dayNums || [])])).sort((a, b) => a - b);
    const base = (trip?.data?.tripData || []).find((d) => d.day === activeDay)?.attractions?.[actionsIdx];
    if (!base) { setActionsIdx(-1); return; }
    // Strip any legacy lock/group metadata so every copy is standalone.
    const { _hotelGroup, _hotelSpan, ...bare } = base;
    commitDays((days) => days.map((d) => {
      if (!chosen.includes(d.day)) return d;
      if (d.day === activeDay) {
        return { ...d, attractions: d.attractions.map((a, i) => (i === actionsIdx ? { ...bare, category: "מלון" } : a)) };
      }
      return { ...d, attractions: [...d.attractions, { ...bare, category: "מלון" }] };
    }));
    setActionsIdx(-1);
  }, [activeDay, trip, actionsIdx, commitDays]);

  /* Sprint 18.5 — persist a free-text memo note on the active stop.
     Rendered under the stop title in DayStopList (a.note). */
  const setStopNote = useCallback((text) => {
    const note = (text || "").trim();
    commitDays((days) => days.map((d) =>
      d.day === activeDay
        ? { ...d, attractions: d.attractions.map((a, i) => i === actionsIdx ? { ...a, note: note || undefined } : a) }
        : d
    ));
    setActionsIdx(-1);
  }, [activeDay, actionsIdx, commitDays]);

  /* Sprint 18.1 — clone the active stop's location into a chosen day of
     another owned trip. Loads the target's full payload, appends a copy
     (deduped) to the target day, and persists it. */
  const copyStopToOtherTrip = useCallback(async (targetTripId, dayNum) => {
    const base = (trip?.data?.tripData || []).find((d) => d.day === activeDay)?.attractions?.[actionsIdx];
    if (!base || !targetTripId) { setActionsIdx(-1); return; }
    try {
      const target = await tripService.fetchTripById(targetTripId);
      const tData = target?.data?.tripData || [];
      const clone = { ...base, completed: false };
      const nextTripData = tData.map((d) =>
        d.day === dayNum
          ? { ...d, attractions: dedupeDayStops([...(d.attractions || []), clone]) }
          : d
      );
      await tripService.saveTrip(targetTripId, { data: { ...target.data, tripData: nextTripData } });
    } catch { /* best-effort cross-trip copy */ }
    setActionsIdx(-1);
  }, [trip, activeDay, actionsIdx]);

  /* Sprint 19.6 — "העבר ליום הבא": pop the active stop and shift it into
     the next day's block. If the active day is the last one, a fresh day
     block is spun up (same city) so the node has somewhere to land. */
  const moveStopToNextDay = useCallback(() => {
    commitDays((days) => {
      const sorted = [...days].sort((a, b) => a.day - b.day);
      const from = sorted.find((d) => d.day === activeDay);
      if (!from) return days;
      const [moved] = from.attractions.splice(actionsIdx, 1);
      if (!moved) return days;
      let to = sorted.find((d) => d.day > activeDay);
      if (!to) {
        const maxDay = sorted.reduce((m, d) => Math.max(m, d.day), 0);
        to = { day: maxDay + 1, city: from.city, cityHe: from.cityHe, attractions: [] };
        days.push(to);
      }
      to.attractions = dedupeDayStops([moved, ...to.attractions]);
      return days;
    });
    setActionsIdx(-1);
  }, [activeDay, actionsIdx, commitDays]);

  /* Sprint 20 #5d — inline "move to next day" by explicit stop index.
     Powers an always-visible +1d quick action on every location card &
     transit segment (no menu needed). Mirrors moveStopToNextDay but
     targets the row directly instead of the selected actions index. */
  const moveStopForward = useCallback((index) => {
    commitDays((days) => {
      const sorted = [...days].sort((a, b) => a.day - b.day);
      const from = sorted.find((d) => d.day === activeDay);
      if (!from || index < 0 || index >= from.attractions.length) return days;
      const [moved] = from.attractions.splice(index, 1);
      if (!moved) return days;
      let to = sorted.find((d) => d.day > activeDay);
      if (!to) {
        const maxDay = sorted.reduce((m, d) => Math.max(m, d.day), 0);
        to = { day: maxDay + 1, city: from.city, cityHe: from.cityHe, attractions: [] };
        days.push(to);
      }
      to.attractions = dedupeDayStops([moved, ...to.attractions]);
      return days;
    });
  }, [activeDay, commitDays]);

  /* Sprint 19.6 — "פצל יום": take the active stop AND every stop after it
     in the day and move the whole tail into the next day (prepended, so
     their relative order is preserved). Creates a next day if needed. */
  const splitDayFromStop = useCallback(() => {
    commitDays((days) => {
      const sorted = [...days].sort((a, b) => a.day - b.day);
      const from = sorted.find((d) => d.day === activeDay);
      if (!from || actionsIdx < 0 || actionsIdx >= from.attractions.length) return days;
      const tail = from.attractions.splice(actionsIdx); /* removes & returns the tail */
      if (!tail.length) return days;
      let to = sorted.find((d) => d.day > activeDay);
      if (!to) {
        const maxDay = sorted.reduce((m, d) => Math.max(m, d.day), 0);
        to = { day: maxDay + 1, city: from.city, cityHe: from.cityHe, attractions: [] };
        days.push(to);
      }
      to.attractions = dedupeDayStops([...tail, ...to.attractions]);
      return days;
    });
    setActionsIdx(-1);
  }, [activeDay, actionsIdx, commitDays]);

  /* Category filter → snap sheet to full + regroup by city (§8). */
  const applyFilter = useCallback((id) => {
    setFilter(id);
    if (id !== "all") sheetRef.current?.snapTo?.("full");
  }, []);

  useEffect(() => {
    let live = true;
    setTrip(null); setError(null);
    tripService.fetchTripById(tripId)
      .then((t) => { if (live) { setTrip(t); setActiveDay(t.data?.tripData?.[0]?.day ?? 1); setMode("design"); } })
      .catch((e) => { if (live) setError(e.message); });
    return () => { live = false; };
  }, [tripId]);

  /* Sprint 18.1 — candidate destination trips for cross-trip copy:
     owned, editable, and not the trip we're currently in. */
  useEffect(() => {
    let live = true;
    tripService.fetchAllTrips()
      .then((list) => {
        if (!live) return;
        setOtherTrips((list || []).filter((t) => t.role === "owner" && !t.readOnly && t.id !== tripId));
      })
      .catch(() => {});
    return () => { live = false; };
  }, [tripId]);

  /* Sprint 36 #3 — dynamic browser-tab title from the active trip. */
  useEffect(() => {
    setDocTitle(titleForTrip(trip));
    return () => setDocTitle(DEFAULT_TITLE);
  }, [trip]);

  /* Sprint 27 #5 — entering INBOX mode auto-loads the user's real inbox
     (Supabase rows / local store). Only when it's genuinely empty does
     the drawer keep showing the "connect" CTA (mock demo path). */
  useEffect(() => {
    if (!inboxMode || inboxPlaces !== null) return;
    let live = true;
    listInboxPlaces().then((list) => {
      if (live && list.length) setInboxPlaces(list);
    }).catch(() => {});
    return () => { live = false; };
  }, [inboxMode, inboxPlaces]);

  /* Sprint 59 #3 — the map-first inbox explorer. Opening the Places Inbox
     programmatically projects ALL saved points onto the map (eye overlay ON)
     and drops the sheet to peek so the map + carousel own the workspace;
     closing it purges the projected markers and the tapped-card overlay. */
  useEffect(() => {
    if (inboxMode) {
      setShowAllSaved(true);
      sheetRef.current?.snapTo?.("peek");
    } else {
      setShowAllSaved(false);
      setInboxCardMenu(null);
    }
  }, [inboxMode]);

  /* Sprint 47 #4 — GLOBAL point bank: lazily gather every point across ALL of
     the user's trips (plus the shared inbox pile), dedupe, and sort so points
     matching the current trip's destination country float to the top. Fetched
     only once, the first time the "כל הנקודות שלי" tab is opened. */
  useEffect(() => {
    if (!inboxMode || inboxTab !== "global" || globalPoints !== null || globalLoading) return;
    let live = true;
    setGlobalLoading(true);
    (async () => {
      try {
        const curDest = (trip?.settings?.destination || "").toLowerCase();
        const curBounds = boundsForDestination(trip?.settings?.destination || trip?.settings?.destinationHe || "");
        const inCountry = (p) => {
          if (curDest && p.destination && p.destination.toLowerCase() === curDest) return true;
          if (curBounds && Number.isFinite(p.lat) && Number.isFinite(p.lng)
            && p.lat >= curBounds.south && p.lat <= curBounds.north
            && p.lng >= curBounds.west && p.lng <= curBounds.east) return true;
          return false;
        };
        const summaries = await tripService.fetchAllTrips();
        const full = await Promise.all(
          (summaries || []).map((s) => tripService.fetchTripById(s.id).catch(() => null))
        );
        const pts = [];
        full.forEach((t) => {
          if (!t) return;
          const dest = t.settings?.destination || "";
          const destHe = t.settings?.destinationHe || "";
          (t.data?.tripData || []).forEach((d) => (d.attractions || []).forEach((a) => {
            if (a._transit || !a.coordinates || !Number.isFinite(a.coordinates.lat)) return;
            pts.push({
              key: `t-${t.id}-${d.day}-${a.name}`, name: a.name, nameHe: a.nameHe,
              category: a.category, rating: a.rating,
              lat: a.coordinates.lat, lng: a.coordinates.lng,
              tripTitle: t.title || destHe || dest, destination: dest,
              isCurrentTrip: t.id === tripId,
            });
          }));
        });
        try {
          const inbox = await listInboxPlaces();
          inbox.forEach((p) => pts.push({
            key: `i-${p.id}`, name: p.name, nameHe: p.nameHe, category: p.category,
            rating: p.rating, lat: p.lat, lng: p.lng, tripTitle: "בנק כללי",
            destination: "", isCurrentTrip: false,
          }));
        } catch { /* inbox optional */ }
        /* Dedupe by name + rounded coordinates. */
        const seen = new Set();
        const deduped = pts.filter((p) => {
          if (!Number.isFinite(p.lat)) return false;
          const k = `${(p.nameHe || p.name || "").trim()}|${p.lat.toFixed(4)}|${p.lng.toFixed(4)}`;
          if (seen.has(k)) return false;
          seen.add(k); return true;
        }).map((p) => ({ ...p, _match: inCountry(p) }));
        /* Country-matched points to the top (stable within each group). */
        deduped.sort((a, b) => (b._match ? 1 : 0) - (a._match ? 1 : 0));
        if (live) setGlobalPoints(deduped);
      } catch {
        if (live) setGlobalPoints([]);
      } finally {
        if (live) setGlobalLoading(false);
      }
    })();
    return () => { live = false; };
  }, [inboxMode, inboxTab, globalPoints, globalLoading, trip, tripId]);

  const days = useMemo(() => trip?.data?.tripData ?? [], [trip]);
  /* Sprint 43 — the trip's calendar anchor (ISO yyyy-mm-dd) or null. */
  const tripStartDate = trip?.settings?.startDate || null;

  /* Sprint 41 #3 — flattened continuous route: every non-transit stop across
     ALL days, in chronological order, carrying a GLOBAL running number so the
     macro timeline reads Stop 1 → Stop N uninterrupted. */
  const continuousStops = useMemo(() => {
    const out = [];
    let n = 0;
    days.forEach((d) => {
      (d.attractions || []).forEach((a) => {
        if (a._transit) return;
        n += 1;
        out.push({ globalIdx: n, dayNum: d.day, city: d.city, cityHe: d.cityHe, a });
      });
    });
    return out;
  }, [days]);

  /* Sprint 34 — UNIFIED stops list for the "בנק הנקודות" view. It merges
     every place-stop assigned to a day (status: assigned to יום X) with
     the unassigned inbox pile (status: unassigned). Transit nodes are
     excluded. Derived purely from state (`days` + `inboxPlaces`) so any
     timeline CRUD is reflected here in real time. Single-home model — a
     stop is in exactly one bucket, so there are no duplicates. */
  const unifiedStops = useMemo(() => {
    const assigned = [];
    days.forEach((d) => (d.attractions || []).forEach((a, i) => {
      if (a._transit) return;
      if (!a.coordinates || !Number.isFinite(a.coordinates.lat)) return;
      assigned.push({
        key: `day-${d.day}-${i}`,
        name: a.name, nameHe: a.nameHe, category: a.category, rating: a.rating,
        lat: a.coordinates.lat, lng: a.coordinates.lng,
        assignedDay: d.day, dayIndex: i,
      });
    }));
    const unassigned = (inboxPlaces || []).map((p) => ({
      key: `inbox-${p.id}`, ...p, assignedDay: null,
    }));
    return [...assigned, ...unassigned];
  }, [days, inboxPlaces]);
  /* How many points sit in the bank (unassigned to any day) — drives the bank
     FAB's count badge + its accent "has content" state. */
  const bankCount = useMemo(() => unifiedStops.filter((s) => s.assignedDay == null).length, [unifiedStops]);
  const activeDayData = useMemo(
    () => days.find((d) => d.day === activeDay) || null,
    [days, activeDay]
  );

  const selectDay = (n) => {
    /* Sprint 51 #3 — changing the calendar day index is an escape gate: it
       drops any active focus-lock (continuous / reorder) back to standard view. */
    if (focusActive) clearFocusModes();
    setActiveDay(n);
    /* Scroll the tapped day chip to the CENTER of the strip so the neighbours on
       both sides are reachable. */
    const di = days.findIndex((d) => d.day === n);
    if (di >= 0) { try { dayChipRefs.current[di]?.scrollIntoView({ inline: "center", block: "nearest", behavior: "smooth" }); } catch { /* noop */ } }
    /* The map flies to the day's first coordinate (driven by the activeDay
       change); the schedule sheet MINIMIZES to peek so the map + the day's
       route own the screen. The user pulls the sheet up when they want the
       full itinerary — selecting a day is a "show me this day on the map"
       gesture, not a "read the list" one. */
    sheetRef.current?.snapTo?.("peek");
    /* Sprint 62 #1 — synchronize the schedule scroll position with the map: jump
       the timeline back to the TOP (first stop row) of the newly selected day. */
    returnStopIdx.current = -1;
    scrollToStopRow(0, "start");
  };

  /* Sprint 36.5 #4 — DAY-LEVEL reorder. Dragging a day chip moves the WHOLE
     day object (all attractions, transits, notes) to a new chronological
     slot; every day is then renumbered 1..N so the strip stays sequential.
     The currently-viewed day is followed to its new position so the sheet
     doesn't jump to an unrelated day after the move. Defined AFTER `days`
     (the useMemo above) so it never references it in the temporal dead zone. */
  const reorderDays = useCallback((fromIdx, toIdx) => {
    if (fromIdx == null || toIdx == null || fromIdx === toIdx) return;
    if (fromIdx < 0 || fromIdx >= days.length || toIdx < 0 || toIdx >= days.length) return;
    // Track where the active day lands after the splice.
    const order = days.map((_, i) => i);
    const [m] = order.splice(fromIdx, 1);
    order.splice(toIdx, 0, m);
    const oldActiveIdx = activeDay - 1;
    const newActiveIdx = order.indexOf(oldActiveIdx);
    commitDays((arr) => {
      const next = [...arr];
      const [moved] = next.splice(fromIdx, 1);
      next.splice(toIdx, 0, moved);
      // Renumber the chronological `day` field; preserve every other field.
      return next.map((d, i) => ({ ...d, day: i + 1 }));
    });
    /* Follow the same renumbering for general files' `day` tag: old day
       (order[newIdx] + 1) → new day (newIdx + 1). Only writes when a file
       actually carries a day, so a plain reorder stays a single save. */
    if ((trip?.data?.files || []).some((f) => f.day != null)) {
      const mapping = {};
      order.forEach((oldIdx, newIdx) => { mapping[oldIdx + 1] = newIdx + 1; });
      persistTripData((data) => ({ ...data, files: remapFileDays(data.files, mapping, order.length) }));
    }
    if (newActiveIdx >= 0) setActiveDay(newActiveIdx + 1);
  }, [days, activeDay, commitDays, trip, persistTripData]);

  /* Sprint 39 #1 — drag begins ONLY from a chip's handle (rendered in edit
     mode). Pointer capture on the handle keeps the gesture alive even if the
     finger leaves the chip; the grabbed chip tracks the finger via `dx`, and
     `over` (chip geometry, RTL-safe on raw pixel bounds) drives the insertion
     indicator. The reorder + renumber commits once, on release. */
  const onDayHandleDown = (idx) => (e) => {
    if (!editable) return;
    e.preventDefault();
    e.stopPropagation();
    dayDragActive.current = true;
    dayGrabX.current = e.clientX;
    setDayDragState({ from: idx, over: idx, dx: 0 });
    try { navigator.vibrate && navigator.vibrate(50); } catch { /* unsupported — ignore */ }
    try { e.currentTarget.setPointerCapture?.(e.pointerId); } catch { /* no-op */ }
  };
  const onDayPointerMove = (e) => {
    if (!dayDragActive.current) return;
    const x = e.clientX;
    let over = dayDragRef.current.over;
    dayChipRefs.current.forEach((el, i) => {
      if (!el) return;
      const r = el.getBoundingClientRect();
      if (x >= r.left && x <= r.right) over = i;
    });
    setDayDragState({ from: dayDragRef.current.from, over, dx: x - dayGrabX.current });
  };
  const endDayDrag = () => {
    if (!dayDragActive.current) return;
    dayDragActive.current = false;
    const { from, over } = dayDragRef.current;
    if (from >= 0 && over >= 0 && from !== over) reorderDays(from, over);
    setDayDragState({ from: -1, over: -1, dx: 0 });
  };

  /* Filtered, city-grouped projection used when a category filter
     is active (spec §8): groups matching stops by city across all
     days instead of chronologically. */
  const groupedByCity = useMemo(() => {
    if (filter === "all") return null;
    const groups = new Map();
    days.forEach((d) => {
      (d.attractions || []).forEach((a) => {
        if (categoryBucket(a.category) !== filter) return;
        const city = a.cityHe || d.cityHe || d.city || "";
        if (!groups.has(city)) groups.set(city, { city, color: cityColor(a.city || d.city), items: [] });
        groups.get(city).items.push({ ...a, _day: d.day });
      });
    });
    return Array.from(groups.values());
  }, [filter, days]);

  /* Map markers stay tied to the ACTIVE DAY regardless of the
     category filter. Per spec §8 the filter must never recenter or
     refit the map — keeping mapStops day-scoped means EditorMap's
     fitBounds only fires on a day change, never on filtering. */
  const mapStops = useMemo(
    () => {
      /* Sprint 42 #1 — CONTINUOUS mode: the map shows EVERY stop across all
         days at once (fitBounds fires off the enlarged marker set), each
         carrying its GLOBAL sequential number so the pins read 1..N to match
         the continuous timeline instead of resetting per day. */
      if (continuousMode) {
        return continuousStops
          .filter(({ a }) => !a._transit)
          .map(({ a, globalIdx }) => ({ ...a, _seq: globalIdx }));
      }
      return (activeDayData?.attractions ?? []).filter((s) => !s._transit);
    },
    [continuousMode, continuousStops, activeDayData]
  );

  /* Sprint 11 — live field-ops gate + the chronological "tomorrow"
     used by the rollover link. */
  /* isActiveTrip is defined near the mode flags (Sprint 28 #1) — the
     live activation flag now IS trip mode. */

  /* Stand down field-ops mode — clears the global active trip via the
     custom-event engine so every surface reverts immediately. */
  const stopActiveTrip = async () => {
    try {
      await tripService.setActiveTrip(null);
    } catch { /* local flag — non-fatal */ }
  };

  const nextDayNum = useMemo(() => {
    const future = days.filter((d) => d.day > activeDay).map((d) => d.day).sort((a, b) => a - b);
    return future.length ? future[0] : null;
  }, [days, activeDay]);

  /* Sprint 38 #4 — export the itinerary to a clean UTF-8 CSV (opens in Excel
     with Hebrew intact thanks to the ﻿ BOM). Columns: Day, City, Place,
     Type, Transit, Notes — one row per place, transit summarised per day. */
  const exportSummaryCSV = useCallback(() => {
    const esc = (v) => {
      const s = v == null ? "" : String(v);
      return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    /* Sprint 43 #5 — a "תאריך" column mapping the calculated calendar date
       per day index (empty when the trip has no start date). */
    const rows = [["יום", "תאריך", "עיר", "שם המקום", "סוג", "מעבר", "הערות"]];
    (days || []).forEach((d) => {
      const atts = d.attractions || [];
      const transitStr = atts.filter((a) => a._transit)
        .map((a) => (TRANSIT_GLYPH[a.transitType]?.he || a.transitType || "")).join(" / ");
      const places = atts.filter((a) => !a._transit);
      const city = d.cityHe || d.city || "";
      const dateCol = tripStartDate ? numericDate(tripStartDate, d.day) : "";
      if (!places.length) {
        rows.push([d.day, dateCol, city, "", "", transitStr, ""]);
      } else {
        places.forEach((a) => rows.push([d.day, dateCol, city, a.nameHe || a.name || "", a.category || "", transitStr, a.note || ""]));
      }
    });
    const csv = "﻿" + rows.map((r) => r.map(esc).join(",")).join("\r\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${(trip?.title || "itinerary").replace(/[^\p{L}\p{N}_-]+/gu, "_")}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }, [days, trip, tripStartDate]);

  return (
    <div dir="rtl" style={{ height: "100vh", overflow: "hidden", position: "relative", fontFamily: T.font, background: "#E9EBEC" }}>
      {/* Real keyless MapLibre canvas */}
      <div style={{ position: "absolute", inset: 0 }}>
        <EditorMap
          stops={mapStops}
          holdView={mapFabsHidden || refMapsOpen}
          color={cityColor(activeDayData?.city)}
          isPinning={isPinning}
          center={trip?.center || trip?.settings?.center || null}
          pendingPin={pendingCoord}
          onMapPick={(coord) => { setPendingCoord(coord); setIsPinning(false); setShowAddStop(true); }}
          previewPin={previewPlace?.lat != null ? { lat: previewPlace.lat, lng: previewPlace.lng } : null}
          flyToCoord={flyToCoord}
          locked={mapLocked}
          /* Sprint 54 #1 — saved-point markers stay visible on the map after the
             inbox drawer minimizes, filtered to the active viewport bounds so
             only the in-view coordinates are highlighted. */
          savedPlaces={(() => {
            if (!inboxPlaces) return [];
            if (showAllSaved) return inboxPlaces; // Sprint 58 #8 — project ALL
            if (inboxGeoFilter) {
              const b = inboxGeoFilter;
              return inboxPlaces.filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lng) && p.lat >= b.south && p.lat <= b.north && p.lng >= b.west && p.lng <= b.east);
            }
            return inboxMode ? inboxPlaces : [];
          })()}
          savedLabels={showAllSaved}
          /* Sprint 59 #4 / 62 #5 — tapping a gray saved marker opens its RICH
             details card (Places-enriched cover photo + summary) and pans to it. */
          onSavedClick={openSavedPointCard}
          onSaveCustomPin={editable ? handleSaveCustomPin : undefined}
          days={days.map((d) => ({ day: d.day, cityHe: d.cityHe, city: d.city }))}
          /* Sprint 44 #3 — persistent active-stop context. */
          focusStop={activeStop}
          /* Sprint 62 #2 — a MAP-marker selection has no return row, so clear the
             return stack (only a timeline-row tap via navigateToStop sets it). */
          onActiveStop={(s) => { returnStopIdx.current = -1; setActiveStop(s); }}
          /* Sprint 62 #2 — NAVIGATION RETURN STACK: closing a stop-detail card
             that was opened from a timeline row re-expands the schedule to MID
             and scrolls back to that exact row (restoring the user's context).
             Cards opened from the map (returnStopIdx = -1) just dismiss. */
          onClearActive={() => {
            setActiveStop(null);
            const idx = returnStopIdx.current;
            if (idx != null && idx >= 0) {
              /* No mid-state: re-opening a card's schedule expands to FULL, not
                 the initial-only "half". Once the user has moved the sheet, it
                 only ever rests peek/full — never returns to the middle. */
              sheetRef.current?.snapTo?.("full");
              scrollToStopRow(idx, "center");
              returnStopIdx.current = -1;
            }
          }}
          onViewportChange={(b) => { viewportRef.current = b; }}
          searchResults={searchResults}
          searchOrigin={searchOrigin}
          searchFitPadding={{ top: 100, bottom: searchResults.length > 0 ? 400 : 180, left: 40, right: 40 }}
          nearbyActive={searchResults.length > 0}
          onSearchResultClick={async (p) => { const d = await getDetails(p.placeId); if (d) handlePreview(d); /* keep the other result pins so several can be reviewed/added */ }}
          /* Sprint 59 #6 — publish live bearing + accept a reset-north signal. */
          onBearingChange={setMapBearing}
          resetNorthKey={northKey}
          /* Sprint 61 #5 / 62 #4 — trajectory polyline for the active day's
             numbered stops (or the whole trip in continuous overview). Derived
             from mapStops so it re-draws automatically on reorder / day switch. */
          routePath={mapStops
            .filter((s) => s.coordinates && Number.isFinite(s.coordinates.lng) && Number.isFinite(s.coordinates.lat))
            .map((s) => [s.coordinates.lng, s.coordinates.lat])}
          /* Sprint 65 #5 — in continuous overview the sheet sits at MID, so
             frame ALL stops into the visible band above it (extra top padding
             for the search bar, extra bottom for the half-screen sheet). */
          fitPadding={continuousMode
            ? { top: 130, bottom: Math.round((typeof window !== "undefined" ? window.innerHeight : 700) * 0.52), left: 48, right: 48 }
            : null}
          onSearchAround={searchAroundStop}
          onMapBackgroundClick={() => { if (inboxMode) setMode("design"); if (focusActive) clearFocusModes(); }}
          hasTransit={editable && (activeDayData?.attractions || []).some((a) => a._transit)}
          onEditTransit={() => {
            const i = (activeDayData?.attractions || []).findIndex((a) => a._transit);
            if (i >= 0) setEditTransitIdx(i);
          }}
          /* "מפות נוספות" — the loaded reference map drawn as a teal overlay. */
          overlayPlaces={refMapsOpen ? (overlayMap?.points || []) : []}
          overlayColor={overlayMap?.color || "#0C8B94"}
          overlaySelected={overlaySel}
          onOverlaySelect={setOverlaySel}
          overlayActiveDay={activeDay}
          onOverlayAddDay={(p, day) => { addOverlayPoints([p], day); setOverlaySel(null); }}
          onOverlayAddBank={(p) => { addOverlayPoints([p], "bank"); setOverlaySel(null); }}
          compactCard
        />
      </div>

      {/* "מצא נקודות באזור" — results list (bottom sheet). Its header ✕ ends
          the search; result pins persist until then so several can be added. */}
      {trip && !isPinning && searchResults.length > 0 && (
        <NearbyResultsPanel
          variant="sheet"
          origin={nearbyAnchor}
          results={searchResults}
          activeDay={activeDay}
          days={days}
          detailsById={nearbyDetails}
          onWantDetails={wantNearbyDetails}
          onAdd={addNearbyToDay}
          onSetDay={setActiveDay}
          onOpen={openNearby}
          onClose={clearNearby}
          addedKeys={nearbyAdded}
        />
      )}

      {/* Map Lock toggle — restores a dedicated "נעילת מפה" control that
          dynamically freezes/restores the viewport pan & zoom.
          Sprint 18.6: lifted into the top header row (insetInlineEnd) so it
          sits cleanly ABOVE the absolute search-bar omnibox wrapper (top:64)
          and never overlaps the autocomplete results that drop below it. */}
      {trip && !isPinning && !inboxMode && !overlayOpen && !mapFabsHidden && !inboxCardMenu && !refMapsOpen && (
        <button
          onClick={() => setMapLocked((v) => !v)}
          title={mapLocked ? "המפה נעולה — לחצו לשחרור" : "נעילת מפה (הקפאת תזוזה וזום)"}
          aria-label="נעילת מפה"
          aria-pressed={mapLocked}
          className="tp-press"
          style={{
            /* Sprint 21 #5 — Map-lock is now a standalone FAB anchored to the
               TOP-LEFT corner of the map canvas (insetInlineEnd = left edge in
               RTL), aligned with where map zoom/layer controls live. It sits in
               the search-omnibox band (top 64–112) at a z BELOW the omnibox (35)
               and BELOW the bottom sheet (30): when the schedule is expanded the
               omnibox covers it, and the sheet never overlaps it — eliminating
               the collision with the sheet controllers & day chips. When the
               sheet is collapsed (map-focused) the omnibox is hidden and the FAB
               is cleanly visible for panning/zoom locking. */
            position: "absolute", top: 134, insetInlineEnd: 16, zIndex: 29,
            display: "inline-flex", alignItems: "center", justifyContent: "center",
            /* Sprint 57 #1 — premium rounded map-lock: borderless white circle
               (charcoal fill when locked) + elegant soft shadow + lock vector. */
            width: 40, height: 40, padding: 0, borderRadius: "50%",
            border: "none",
            background: mapLocked ? "#1E1E24" : "#fff",
            color: mapLocked ? "#fff" : "#1E1E24",
            lineHeight: 1, cursor: "pointer", fontFamily: "inherit",
            boxShadow: "0 2px 8px rgba(0,0,0,0.10)",
            transition: "background 0.2s ease, color 0.2s ease",
          }}
        >
          <Icon name={mapLocked ? "lock" : "unlock"} size={17} strokeWidth={1.85} color={mapLocked ? "#fff" : "#1E1E24"} />
        </button>
      )}

      {/* 👁️ eye toggle — show/hide ALL saved bank points on the map (distinct
          from the folder FAB, which OPENS the bank). */}
      {trip && !isPinning && !inboxMode && !overlayOpen && !mapFabsHidden && !inboxCardMenu && !refMapsOpen && (
        <button
          onClick={() => setShowAllSaved((v) => {
            const n = !v;
            if (n && inboxPlaces === null) listInboxPlaces().then((list) => { if (list && list.length) setInboxPlaces(list); }).catch(() => {});
            return n;
          })}
          title={showAllSaved ? "הסתרת שכבת הנקודות השמורות" : "הצגת שכבת הנקודות השמורות על המפה"}
          aria-label="שכבת נקודות שמורות" aria-pressed={showAllSaved}
          className="tp-press"
          style={{
            position: "absolute", top: 182, insetInlineEnd: 16, zIndex: 29,
            display: "inline-flex", alignItems: "center", justifyContent: "center",
            width: 40, height: 40, padding: 0, borderRadius: "50%", border: "none",
            background: showAllSaved ? "#1E1E24" : "#fff", color: showAllSaved ? "#fff" : "#1E1E24",
            cursor: "pointer", fontFamily: "inherit", boxShadow: "0 2px 8px rgba(0,0,0,0.10)",
            transition: "background 0.2s ease, color 0.2s ease",
          }}
        >
          <Icon name="eye" size={18} strokeWidth={1.85} color={showAllSaved ? "#fff" : "#1E1E24"} />
        </button>
      )}

      {/* "מפות נוספות" — load another map's points as a teal overlay + transfer.
          Shares the right-edge map-control rail (below the compass slot). */}
      {trip && editable && !isPinning && !inboxMode && !overlayOpen && !mapFabsHidden && !inboxCardMenu && !refMapsOpen && (
        <button
          onClick={() => setRefMapsOpen((o) => !o)}
          title="מפות נוספות — טעינת מפה נוספת והעברת נקודות"
          aria-label="מפות נוספות" aria-pressed={refMapsOpen}
          className="tp-press"
          style={{
            position: "absolute", top: 230, insetInlineEnd: 16, zIndex: 29,
            display: "inline-flex", alignItems: "center", justifyContent: "center",
            width: 40, height: 40, padding: 0, borderRadius: "50%", border: "none",
            background: refMapsOpen ? "#0C8B94" : "#fff", color: refMapsOpen ? "#fff" : "#0C8B94",
            cursor: "pointer", fontFamily: "inherit", boxShadow: "0 2px 8px rgba(0,0,0,0.10)",
            fontSize: 16, fontWeight: 800, transition: "background 0.2s ease, color 0.2s ease",
          }}
        >
          <Icon name="layers" size={20} strokeWidth={2} />
        </button>
      )}

      {/* Sprint 59 #6 — SMOOTH COMPASS reset-north control. Mounts ONLY while
          the map bearing deviates from true north; a tap eases the viewport
          back to 0° so a rotated mobile gesture is instantly corrected. Shares
          the right-edge map-control rail (below the eye toggle). */}
      {trip && !isPinning && Math.abs(mapBearing) > 1 && !overlayOpen && !mapFabsHidden && !inboxCardMenu && !refMapsOpen && (
        <button
          onClick={() => setNorthKey((k) => k + 1)}
          title="איפוס כיוון הצפון" aria-label="איפוס כיוון הצפון"
          className="tp-press tp-pop"
          style={{
            position: "absolute", top: 278, insetInlineEnd: 16, zIndex: 29,
            display: "inline-flex", alignItems: "center", justifyContent: "center",
            width: 40, height: 40, padding: 0, borderRadius: "50%", border: "none",
            background: "#fff", color: "#1E1E24",
            cursor: "pointer", fontFamily: "inherit", boxShadow: "0 2px 8px rgba(0,0,0,0.10)",
          }}
        >
          {/* Rotate the glyph opposite the map bearing so the needle points to
              real north as the user turns the map. */}
          <span aria-hidden style={{ fontSize: 20, lineHeight: 1, display: "inline-block", transform: `rotate(${-mapBearing}deg)`, transition: "transform 0.15s linear" }}>🧭</span>
        </button>
      )}

      {/* Sprint 53 #2 — IMMERSIVE FOCUS-LOCK MODAL, now scoped to DAY-REORDER
          only. Sprint 61 #5 — "מסלול רציף" is no longer a blocking dark modal:
          it became a map-first overview (all stops + polyline on the map, the
          numbered list living in the MID bottom sheet), so the scrim must not
          mount for continuous mode. */}
      {focusActive && dayEditMode && (
        <div dir="rtl" style={{ position: "fixed", inset: 0, zIndex: 150, display: "flex", alignItems: "center", justifyContent: "center", padding: 16, fontFamily: T.font }}>
          {/* Scrim — strict input lockout (no onClick → taps do nothing; the
              opaque layer blocks the map/sheet beneath from receiving events). */}
          <div className="tp-fade" style={{ position: "absolute", inset: 0, background: "rgba(10,12,15,0.55)", backdropFilter: "blur(6px)", WebkitBackdropFilter: "blur(6px)" }} />
          <div className="tp-pop" style={{ position: "relative", width: "100%", maxWidth: 440, maxHeight: "82vh", background: "#fff", borderRadius: 22, display: "flex", flexDirection: "column", overflow: "hidden", boxShadow: "0 24px 70px rgba(0,0,0,0.45)" }}>
            {/* Sprint 59 #5 — flat re-skin: deep charcoal header band with a
                high-contrast ✕ close target in the upper-inline-end margin. */}
            <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "14px 16px", background: "#1E1E24" }}>
              <span aria-hidden style={{ fontSize: 20, lineHeight: 1 }}>{dayEditMode ? "⇅" : "🔢"}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 15.5, fontWeight: 800, color: "#fff" }}>{dayEditMode ? "סידור ימים מחדש" : "מסלול רציף"}</div>
                <div style={{ fontSize: 12, color: "rgba(255,255,255,0.65)", marginTop: 1 }}>{dayEditMode ? "שנו את סדר הימים · לחצו עדכן לשמירה" : "תצוגה רציפה של כל תחנות הטיול"}</div>
              </div>
              <button onClick={dayEditMode ? abortReorder : clearFocusModes} title="סגירה" aria-label="סגירה" className="tp-press"
                style={{ flexShrink: 0, width: 36, height: 36, borderRadius: "50%", border: "none", background: "#fff", color: "#1E1E24", cursor: "pointer", fontFamily: "inherit", fontSize: 15, fontWeight: 800, display: "inline-flex", alignItems: "center", justifyContent: "center" }}>✕</button>
            </div>
            <div style={{ flex: 1, overflowY: "auto", WebkitOverflowScrolling: "touch", padding: "12px 14px" }}>
              {dayEditMode ? (
                days.map((d, i) => {
                  const col = cityColor(d.city);
                  const stopN = (d.attractions || []).filter((a) => !a._transit && !a._inlineNote && !a._inlineTransit).length;
                  return (
                    <div key={d.day} style={{ display: "flex", alignItems: "center", gap: 10, border: `1px solid ${d.day === activeDay ? col : T.line}`, borderRadius: 12, padding: "8px 10px", marginBottom: 8, background: d.day === activeDay ? `${col}12` : "#fff" }}>
                      <span style={{ flexShrink: 0, width: 30, height: 30, borderRadius: "50%", background: col, color: "#fff", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 800 }}>{d.day}</span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 14, fontWeight: 800, color: T.ink, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{d.cityHe || d.city || `יום ${d.day}`}</div>
                        <div style={{ fontSize: 11.5, color: T.ink3, marginTop: 1 }}>{stopN} תחנות{tripStartDate ? ` · ${pillDateLabel(tripStartDate, d.day)}` : ""}</div>
                      </div>
                      <button onClick={() => reorderDays(i, i - 1)} disabled={i === 0} aria-label="הזזה למעלה"
                        style={{ flexShrink: 0, width: 34, height: 34, borderRadius: 10, border: `1px solid ${T.line}`, background: i === 0 ? T.surface : "#fff", color: i === 0 ? T.ink4 : T.ink, cursor: i === 0 ? "default" : "pointer", fontFamily: "inherit", fontSize: 14 }}>▲</button>
                      <button onClick={() => reorderDays(i, i + 1)} disabled={i === days.length - 1} aria-label="הזזה למטה"
                        style={{ flexShrink: 0, width: 34, height: 34, borderRadius: 10, border: `1px solid ${T.line}`, background: i === days.length - 1 ? T.surface : "#fff", color: i === days.length - 1 ? T.ink4 : T.ink, cursor: i === days.length - 1 ? "default" : "pointer", fontFamily: "inherit", fontSize: 14 }}>▼</button>
                    </div>
                  );
                })
              ) : (() => {
                let n = 0; const rows = [];
                days.forEach((d) => (d.attractions || []).forEach((a) => {
                  if (a._transit || a._inlineNote || a._inlineTransit) return;
                  n++; rows.push({ n, day: d.day, name: a.nameHe || a.name, city: d.cityHe || d.city, col: cityColor(d.city) });
                }));
                if (!rows.length) return <div style={{ textAlign: "center", color: T.ink3, fontSize: 13, padding: "30px 6px" }}>אין תחנות במסלול עדיין</div>;
                return rows.map((r) => (
                  <div key={r.n} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 4px", borderBottom: `1px solid ${T.line}` }}>
                    <span style={{ flexShrink: 0, width: 26, height: 26, borderRadius: "50%", background: r.col, color: "#fff", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 800 }}>{r.n}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div dir="auto" style={{ fontSize: 14, fontWeight: 700, color: T.ink, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{r.name}</div>
                      <div style={{ fontSize: 11, color: T.ink3, marginTop: 1 }}>יום {r.day} · {r.city}</div>
                    </div>
                  </div>
                ));
              })()}
            </div>
            <div style={{ display: "flex", gap: 10, padding: "12px 14px", borderTop: `1px solid ${T.line}` }}>
              {dayEditMode ? (
                <>
                  <button onClick={abortReorder} className="tp-press" style={{ flex: 1, height: 46, borderRadius: 14, border: `1px solid ${T.line}`, background: "#fff", color: T.ink2, fontSize: 14.5, fontWeight: 800, cursor: "pointer", fontFamily: "inherit" }}>בטל</button>
                  <button onClick={commitReorder} className="tp-press" style={{ flex: 1, height: 46, borderRadius: 14, border: "none", background: T.ink, color: "#fff", fontSize: 14.5, fontWeight: 800, cursor: "pointer", fontFamily: "inherit" }}>עדכן</button>
                </>
              ) : (
                <button onClick={clearFocusModes} className="tp-press" style={{ flex: 1, height: 46, borderRadius: 14, border: "none", background: T.ink, color: "#fff", fontSize: 14.5, fontWeight: 800, cursor: "pointer", fontFamily: "inherit" }}>סיום</button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Sprint 45 #6 — UNIFIED top row: Home + Search live in one fixed flex
          row (space-between, gap 12, z-index 101) so the Home button is never
          clipped behind or layered under the search bar.
          Sprint 51 #4 — fully UNMOUNTED while the full-screen summary is open so
          it never clips the premium overlay. */}
      {trip && !summaryOpen && (
        <div dir="rtl" style={{
          position: "fixed", top: focusActive ? "calc(env(safe-area-inset-top, 0px) + 52px)" : "calc(env(safe-area-inset-top, 0px) + 12px)",
          insetInlineStart: 16, insetInlineEnd: 16, zIndex: 101,
          display: "flex", alignItems: "center", gap: 12, boxSizing: "border-box",
          transition: "top 0.28s cubic-bezier(0.22,1,0.36,1)",
        }}>
          {/* Sprint 50 #3 — Home also drops the focus lock: if a mode is active,
              the first press clears it (accessible dismissal); otherwise exits. */}
          {/* Sprint 56 #1 — flat solid charcoal square Home asset (no shadow). */}
          <button onClick={() => { if (focusActive) clearFocusModes(); else setConfirmExit(true); }} title={focusActive ? "יציאה ממצב מיקוד" : "יציאה למסך הראשי"} aria-label="יציאה"
            className="tp-press"
            style={{ flexShrink: 0, width: 44, height: 44, borderRadius: 8, border: "none", background: "#1E1E24", cursor: "pointer", fontFamily: "inherit", color: "#fff", display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
            <Icon name="home" size={19} strokeWidth={2} color="#fff" />
          </button>
          {isPinning ? (
            <div style={{ flex: 1, minWidth: 0, height: 48, background: T.ink, color: "#fff", borderRadius: 999, padding: "0 16px", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, boxShadow: "0 4px 20px rgba(0,0,0,0.14)" }}>
              לחצו על המפה לנעיצת סיכה · <button onClick={() => setIsPinning(false)} style={{ background: "none", border: "none", color: "#fff", textDecoration: "underline", cursor: "pointer", fontFamily: "inherit", fontSize: 13, marginInlineStart: 6 }}>ביטול</button>
            </div>
          ) : (
            editable
              ? <EditorSearchBar
                  onAddStop={(stop) => setPendingStop(stop)}
                  onPreview={handlePreview}
                  onResults={setSearchResults}
                  activeDay={activeDay}
                  /* Sprint 47 #3 — location-bias cascade: live viewport →
                     trip's destination country → global (null). */
                  getBias={() => viewportRef.current || boundsForDestination(trip?.settings?.destination || trip?.settings?.destinationHe || "") || null}
                  /* Sprint 51 #3 — focusing the search is an escape gate. */
                  onFocusInput={() => { if (focusActive) clearFocusModes(); }}
                />
              : (
                /* Read-only / shared trip → a clear "view only" banner instead
                   of the (edit-only) search bar. A public map the viewer doesn't
                   own also gets a ⭐ so they can favorite it without leaving. */
                <>
                  <div style={{ flex: 1, minWidth: 0, height: 48, background: "#fff", borderRadius: 999, padding: "0 16px", display: "flex", alignItems: "center", justifyContent: "center", gap: 7, boxShadow: "0 2px 10px rgba(0,0,0,0.08)", fontSize: 13, fontWeight: 700, color: T.ink2 }}>
                    <Icon name="eye" size={15} strokeWidth={1.9} color={T.ink3} />
                    <span dir="auto" style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      צפייה בלבד{trip?.sharedBy ? ` · שותף ע״י ${trip.sharedBy}` : ""}
                    </span>
                  </div>
                  {isPublicView && (
                    <FavoriteButton tripId={tripId} favorited={isFav} onChange={setIsFav} returnTo={`/map/edit/${tripId}`} size={20} />
                  )}
                </>
              )
          )}
        </div>
      )}

      {/* Ambient status row (badge / field-ops), below the top row. */}
      <header className="tp-ed-header" style={{
        position: "absolute", top: 72, insetInlineStart: 0, insetInlineEnd: 0, zIndex: 40,
        boxSizing: "border-box", maxWidth: "100vw",
        display: "flex", alignItems: "center", gap: 8, padding: "12px 16px",
      }}>
        {/* Sprint 44 #2 — title/dates/summary/tabs moved to the FAB speed dial;
            a subtle "saving…" chip stays for feedback. */}
        {saving && (
          <span style={{ fontSize: 11, fontWeight: 700, color: T.ink3, background: "#fff", borderRadius: 999, padding: "5px 10px", boxShadow: "0 2px 8px rgba(0,0,0,0.08)", flexShrink: 0 }}>נשמר…</span>
        )}

        {/* Sprint 65 — TRIP FILES entry point: opens the gallery sheet with every
            file in the trip (general + per-stop). Badge = total file count. */}
        {trip && (
          <button
            onClick={() => setFilesSheetOpen(true)}
            title="קבצי הטיול" aria-label="קבצי הטיול" className="tp-press"
            style={{
              position: "relative", flexShrink: 0,
              width: 44, height: 44, borderRadius: "50%", border: "none",
              background: "#fff", color: "#1E1E24", cursor: "pointer",
              boxShadow: "0 2px 8px rgba(0,0,0,0.08)", fontSize: 17, fontFamily: "inherit",
              display: "inline-flex", alignItems: "center", justifyContent: "center",
            }}>
            <span aria-hidden>🗂️</span>
            {tripFilesCount > 0 && (
              <span style={{ position: "absolute", top: -3, insetInlineStart: -3, minWidth: 18, height: 18, padding: "0 4px", borderRadius: 999, background: T.accent, color: "#fff", fontSize: 10.5, fontWeight: 800, display: "inline-flex", alignItems: "center", justifyContent: "center", border: "2px solid #fff" }}>
                {tripFilesCount}
              </span>
            )}
          </button>
        )}

        {/* Sprint 62 #7 — COLLABORATOR AVATAR INDICATORS for a shared itinerary:
            a stacked cluster of the owner + invited collaborators, shown only
            when the trip actually has collaborators. */}
        {trip && Array.isArray(trip.collaborators) && trip.collaborators.length > 0 && (() => {
          const people = [trip.owner, ...trip.collaborators].filter(Boolean);
          const shown = people.slice(0, 4);
          const extra = people.length - shown.length;
          const initials = (p) => ((p?.name || p?.email || "?").trim().slice(0, 1) || "?").toUpperCase();
          return (
            <div title={`${people.length} משתתפים במסלול`} aria-label="משתתפים במסלול"
              style={{ display: "inline-flex", alignItems: "center", flexShrink: 0, background: "#fff", borderRadius: 999, padding: "3px 8px 3px 5px", boxShadow: "0 2px 8px rgba(0,0,0,0.08)" }}>
              <span style={{ display: "inline-flex", flexDirection: "row-reverse" }}>
                {shown.map((p, i) => (
                  <span key={i} style={{ width: 24, height: 24, borderRadius: "50%", background: i === 0 ? "#1E1E24" : "#FF6B6B", color: "#fff", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 800, border: "2px solid #fff", marginInlineStart: i === 0 ? 0 : -8 }}>{initials(p)}</span>
                ))}
              </span>
              {extra > 0 && <span style={{ fontSize: 11, fontWeight: 800, color: T.ink3, marginInlineStart: 5 }}>+{extra}</span>}
            </div>
          );
        })()}

        {/* Sprint 19b.5 — "Trip Mode" ambient badge. Purely visual: it
            signals the map is ready for on-the-go navigation but locks
            nothing (editing/sorting/notes stay fully active). The green
            dot gently pulses via the shared tp-pulse keyframes. */}
        {trip && tripMode && (
          <div aria-hidden style={{
            display: "inline-flex", alignItems: "center", gap: 7,
            height: 34, padding: "0 13px", borderRadius: 999,
            background: "#fff", border: "1px solid rgba(20,20,20,0.08)",
            boxShadow: "0 2px 8px rgba(0,0,0,0.08)", whiteSpace: "nowrap",
          }}>
            <span style={{ position: "relative", width: 9, height: 9, display: "inline-flex" }}>
              <span style={{
                position: "absolute", inset: 0, borderRadius: "50%",
                background: "#1FB36B", opacity: 0.45,
                animation: "tp-pulse 1.6s ease-out infinite",
              }} />
              <span style={{ position: "absolute", inset: 0, borderRadius: "50%", background: "#1FB36B" }} />
            </span>
            <span style={{ fontSize: 12.5, fontWeight: 800, color: T.ink }}>טיול פעיל</span>
          </div>
        )}

        {/* Live field-ops stand-down — only while this trip is active.
            A clean, minimalist "close field mode (power off)" action. */}
        {isActiveTrip && (
          <button onClick={stopActiveTrip} title="סגירת מצב שטח (כיבוי המסלול הפעיל)" aria-label="סגירת מצב שטח"
            className="tp-press"
            style={{
              marginInlineStart: trip ? 0 : "auto",
              display: "inline-flex", alignItems: "center", gap: 7,
              height: 40, padding: "0 14px", borderRadius: 999,
              border: `1.5px solid ${T.accent}`, background: "#fff", color: T.accent,
              fontSize: 12.5, fontWeight: 800, cursor: "pointer", fontFamily: "inherit",
              boxShadow: "0 2px 8px rgba(0,0,0,0.08)", whiteSpace: "nowrap",
            }}>
            <span aria-hidden style={{ fontSize: 14 }}>🛑</span>
            סגירת מצב שטח
          </button>
        )}
      </header>

      {/* Sprint 39 #3 — Places-Inbox FAB now RIDES the bottom sheet: it floats
          just above the sheet's top border on the map canvas (never over the
          timeline rows). It slides down when the sheet collapses to ~84px, and
          hides entirely when the sheet is expanded to full (where it would
          otherwise occlude stop rows). z-index:100 keeps it above the sheet.
          Sprint 47 #1 — also hidden while a stop card / preview is open.
          Sprint 48 #2 — while the inbox panel is OPEN the floating trigger is
          unmounted entirely; the panel is dismissed via the header ✕ instead.
          Sprint 54 #4 — also unmounts while a focus-lock modal is engaged. */}
      {trip && !isPinning && !inboxMode && !focusActive && !overlayOpen && !mapFabsHidden && !refMapsOpen && sheetSnap === "peek" && (
        <button
          onClick={() => { setMode("inbox"); sheetRef.current?.snapTo?.("peek"); }}
          title="בנק הנקודות"
          aria-label="בנק הנקודות"
          aria-pressed={inboxMode}
          className="tp-press"
          style={{
            /* Sprint 44 #2 — moved to the bottom-LEFT so the new speed-dial
               FAB owns the bottom-right corner.
               Sprint 54 #4 — z ABOVE the sheet (260) so the FAB + its expansion
               menu never clip behind the sheet / day-pill timeline. */
            position: "fixed", zIndex: 260,
            insetInlineStart: 16,
            /* Rest 16px above the sheet's top border for the current snap. */
            bottom: sheetSnap === "peek"
              ? "calc(env(safe-area-inset-bottom, 0px) + 128px)"
              : "calc(50vh + 16px)",
            display: "inline-flex", alignItems: "center", justifyContent: "center",
            /* Premium rounded-full capsule. When the bank holds saved points it
               switches to an accent-tinted fill (+ ring) so the user sees, right
               after saving, that something now lives in the bank. */
            width: 52, height: 52, borderRadius: "50%",
            border: bankCount > 0 ? "1.5px solid #E0533F" : "none",
            background: bankCount > 0 ? "#E0533F14" : "#fff",
            color: bankCount > 0 ? "#E0533F" : "#1E1E24",
            boxShadow: "0 2px 8px rgba(0,0,0,0.10)", cursor: "pointer", fontFamily: "inherit",
            transition: "bottom 320ms cubic-bezier(0.22,1,0.36,1), background 0.2s ease, color 0.2s ease",
          }}
        >
          <Icon name="folder" size={22} strokeWidth={1.75} color={bankCount > 0 ? "#E0533F" : "#1E1E24"} />
          {/* Sprint 57 #1 — count badge pinned to the capsule's upper-right. */}
          {bankCount > 0 && (
            <span style={{ position: "absolute", top: -3, insetInlineStart: -3, minWidth: 20, height: 20, padding: "0 5px", borderRadius: 999, background: "#D94025", color: "#fff", fontSize: 11, fontWeight: 800, display: "inline-flex", alignItems: "center", justifyContent: "center", border: "2px solid #fff" }}>
              {bankCount}
            </span>
          )}
        </button>
      )}

      {/* Sprint 46 #1 — FAB SPEED DIAL floats over the MAP, never over the
          timeline text: at peek it rests at bottom:104px (just above the day
          pills row); at half it lifts above the half-sheet; at FULL it is
          hidden entirely (the schedule reading plane owns the screen). */}
      {trip && !isPinning && !inboxMode && !focusActive && !overlayOpen && !mapFabsHidden && !refMapsOpen && sheetSnap === "peek" && (
        <div style={{
          /* Sprint 54 #4 — above the sheet so the speed-dial and its expansion
             buttons render cleanly instead of clipping behind the day pills. */
          position: "fixed", zIndex: 260, insetInlineEnd: 16,
          bottom: sheetSnap === "peek"
            ? "calc(env(safe-area-inset-bottom, 0px) + 128px)"
            : "calc(50vh + 16px)",
          display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 12, fontFamily: T.font,
          transition: "bottom 320ms cubic-bezier(0.22,1,0.36,1)",
        }}>
          {fabOpen && !focusActive && [
            { icon: "map", label: "תכנון מסלול", onClick: () => sheetRef.current?.snapTo?.(sheetCollapsed ? "full" : "peek") },
            /* Sprint 47 #5 — skeleton editor absorbed into the FAB menu (the
               clipped bottom-of-viewport button was removed). */
            ...(editable ? [{ icon: "wrench", label: "עריכת שלד הטיול", onClick: () => navigate(`/create?edit=${trip.id}`) }] : []),
            ...(days.length > 0 ? [{ icon: "barChart", label: "סכם לי את הטיול", onClick: () => setSummaryOpen(true) }] : []),
            ...(days.length > 1 ? [{ icon: "listOrdered", label: continuousMode ? "תצוגת ימים" : "מסלול רציף", onClick: () => setContinuousMode((v) => { const n = !v; if (n) sheetRef.current?.snapTo?.("full"); return n; }) }] : []),
            { icon: "calendar", label: tripStartDate ? "שינוי תאריכים" : "הגדרת תאריכים", onClick: openDatesModal },
          ].map((a, i) => (
            /* Sprint 57 #1 — premium borderless capsule pill with a soft shadow
               and a lighter monochrome charcoal vector. */
            <button key={i} className="tp-pop tp-press"
              onClick={() => { a.onClick(); setFabOpen(false); }}
              style={{ display: "inline-flex", alignItems: "center", gap: 9, height: 44, padding: "0 16px 0 14px", borderRadius: 999, border: "none", background: "#fff", color: "#1E1E24", boxShadow: "0 2px 8px rgba(0,0,0,0.10)", cursor: "pointer", fontFamily: "inherit", fontSize: 13.5, fontWeight: 800, whiteSpace: "nowrap" }}>
              <Icon name={a.icon} size={17} strokeWidth={1.75} color="#1E1E24" />{a.label}
            </button>
          ))}
          <button
            /* Sprint 52 #1 — the Options FAB and a focus-lock mode must never
               occupy the viewport together: while a focus mode is engaged, any
               tap on the FAB forcibly collapses it (never expands). */
            onClick={() => { if (focusActive) { setFabOpen(false); return; } setFabOpen((v) => !v); }}
            title={fabOpen ? "סגירת התפריט" : "פעולות"}
            aria-label="תפריט פעולות"
            aria-expanded={fabOpen && !focusActive}
            className="tp-press"
            /* Sprint 57 #1 — premium rounded-full charcoal Options FAB with an
               elegant soft shadow and a lighter white vector. */
            style={{ width: 56, height: 56, borderRadius: "50%", border: "none", background: "#1E1E24", color: "#fff", boxShadow: "0 3px 10px rgba(0,0,0,0.16)", cursor: "pointer", fontFamily: "inherit", display: "inline-flex", alignItems: "center", justifyContent: "center", alignSelf: "flex-end", transition: "transform 0.2s ease" }}>
            <Icon name={fabOpen ? "x" : "wrench"} size={23} strokeWidth={1.9} color="#fff" />
          </button>
        </div>
      )}
      {/* Scrim to close the speed dial on outside tap. */}
      {fabOpen && (
        <div onClick={() => setFabOpen(false)} style={{ position: "fixed", inset: 0, zIndex: 259 }} />
      )}

      {/* Sprint 46 #2 — icon-only map FABs for Day Reorder (⇅) + Continuous
          Route (🔢), floating centred above the peek sheet. Active state tints
          the button green for instant visual verification. 44px touch area. */}
      {trip && editable && !inboxMode && !isPinning && !focusActive && !overlayOpen && !mapFabsHidden && !refMapsOpen && sheetSnap === "peek" && days.length > 1 && (
        <div style={{
          /* Sprint 54 #4 — above the sheet; unmounts during focus-lock modes. */
          position: "fixed", zIndex: 260, left: "50%", transform: "translateX(-50%)",
          bottom: sheetSnap === "peek"
            ? "calc(env(safe-area-inset-bottom, 0px) + 128px)"
            : "calc(50vh + 16px)",
          display: "flex", gap: 12, fontFamily: T.font,
          transition: "bottom 320ms cubic-bezier(0.22,1,0.36,1)",
        }}>
          <button
            onClick={() => setDayEditMode((v) => { const n = !v; if (n) { setContinuousMode(false); focusSnapshotRef.current = (trip?.data?.tripData || []).map((d) => ({ ...d, attractions: [...(d.attractions || [])] })); } return n; })}
            title={dayEditMode ? "סיום סידור הימים" : "סידור מחדש של הימים"}
            aria-label="סידור ימים" aria-pressed={dayEditMode}
            className={`tp-press${dayEditMode ? " tp-focus-glow" : ""}`}
            /* Sprint 57 #1 — premium rounded-full; active fills solid charcoal,
               idle is a clean white circle with an elegant soft shadow. */
            style={{ width: 52, height: 52, borderRadius: "50%", border: "none", background: dayEditMode ? "#1E1E24" : "#fff", color: dayEditMode ? "#fff" : "#1E1E24", boxShadow: "0 2px 8px rgba(0,0,0,0.10)", cursor: "pointer", fontFamily: "inherit", display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
            <Icon name={dayEditMode ? "check" : "arrowUpDown"} size={21} strokeWidth={1.85} color={dayEditMode ? "#fff" : "#1E1E24"} />
          </button>
          <button
            onClick={() => setContinuousMode((v) => { const next = !v; if (next) sheetRef.current?.snapTo?.("full"); return next; })}
            title={continuousMode ? "חזרה לתצוגת ימים" : "תצוגת מסלול רציף"}
            aria-label="מסלול רציף" aria-pressed={continuousMode}
            className={`tp-press${continuousMode ? " tp-focus-glow" : ""}`}
            style={{ width: 52, height: 52, borderRadius: "50%", border: "none", background: continuousMode ? "#1E1E24" : "#fff", color: continuousMode ? "#fff" : "#1E1E24", boxShadow: "0 2px 8px rgba(0,0,0,0.10)", cursor: "pointer", fontFamily: "inherit", display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
            <Icon name={continuousMode ? "calendar" : "listOrdered"} size={21} strokeWidth={1.85} color={continuousMode ? "#fff" : "#1E1E24"} />
          </button>
        </div>
      )}

      {error && (
        <div style={{ position: "absolute", top: 70, insetInlineStart: 16, insetInlineEnd: 16, zIndex: 40, color: "#A03325", background: "#fff", borderRadius: 12, padding: 14, fontSize: 14 }}>
          שגיאה בטעינת המסלול: {error}
        </div>
      )}

      {/* Bottom sheet */}
      {trip && (
        <EditorBottomSheet
          ref={sheetRef}
          defaultSnap="half"
          onDraggingChange={setSheetDragging}
          /* Sprint 60 #1 — MUTUALLY EXCLUSIVE bottom viewport states: the Daily
             Schedule Sheet and the map-first inbox carousel can never occupy
             the bottom area together. Opening the inbox force-collapses the
             sheet to peek (inboxMode effect); conversely, expanding the sheet
             to half/full (a day-chip tap or a manual pull-up) instantly closes
             the inbox, unmounting the carousel + its gray markers. Only real
             snap CHANGES reach here, so this never races the open transition. */
          onSnapChange={(snap) => { setSheetSnap(snap); if (inboxMode && snap !== "peek") setMode("design"); }}
          header={
            <div style={{ padding: "0 16px 12px" }}>
              {/* Day strip + collapse/expand toggle (dual-state control).
                  Collapsed → only the day chips float over the open map;
                  expanded → full schedule + the map search omnibox. */}
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              {/* Sprint 65 #8 — HIDE the day-selection strip while "מסלול רציף"
                  is active so users don't mistake the continuous overview for a
                  single day; a clear label takes its place. */}
              {days.length > 0 && !continuousMode ? (
                <div
                  ref={dayStripRef}
                  className="scrollbar-hide"
                  /* Opt out of the sheet's drag-capture so a sideways swipe here
                     scrolls the day strip instead of dragging the whole sheet. */
                  data-no-sheet-drag
                  style={{
                    display: "flex", gap: 8, direction: "rtl", flex: 1, minWidth: 0,
                    /* Sprint 42 #3 — vertical breathing room so lifted/handled
                       chips are never clipped at the top or bottom. */
                    paddingTop: 8, paddingBottom: 8,
                    /* Sprint 42 #4 — in edit mode kill native scroll so drags
                       don't fight momentum; otherwise ultra-fluid momentum. */
                    overflowX: dayEditMode ? "hidden" : "auto",
                    WebkitOverflowScrolling: dayEditMode ? "auto" : "touch",
                    touchAction: dayEditMode ? "none" : "pan-x",
                  }}>
                  {/* Sprint 46 #2 — the "סדר ימים" / "מסלול רציף" text buttons
                      were removed from the strip; the strip now holds ONLY the
                      numeric day circles. Both controls live as icon-only map
                      FABs above the peek sheet (rendered below). */}
                  {days.map((d, i) => {
                    const CHARCOAL = "#1E1E24";
                    const on = d.day === activeDay;
                    const dayDone = !!d._dayDone;
                    const beingDragged = dayDrag.from === i;
                    const dropTarget = dayEditMode && dayDrag.from >= 0 && dayDrag.over === i && dayDrag.from !== i;
                    return (
                      <div
                        key={d.day}
                        role="button"
                        tabIndex={0}
                        ref={(el) => { dayChipRefs.current[i] = el; }}
                        /* Sprint 39 #1 / 47 #5 — normal tap switches day; in edit
                           mode the WHOLE chip is the drag surface (the legacy
                           black ⇅ handle sub-icon was removed for clean pills). */
                        onClick={() => { if (!dayEditMode && !beingDragged) selectDay(d.day); }}
                        onPointerDown={dayEditMode ? onDayHandleDown(i) : undefined}
                        onPointerMove={dayEditMode ? onDayPointerMove : undefined}
                        onPointerUp={dayEditMode ? endDayDrag : undefined}
                        onPointerCancel={dayEditMode ? endDayDrag : undefined}
                        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); selectDay(d.day); } }}
                        title={`יום ${d.day}`}
                        style={{
                          /* Sprint 56 #2 — flat block day chip: inactive = plain
                             gray text, active = solid charcoal rounded rectangle.
                             No soft circles, no drop shadows. */
                          flexShrink: 0, position: "relative", minWidth: 60, height: 60, padding: "0 10px", borderRadius: 14,
                          border: dropTarget ? `2px dashed ${CHARCOAL}` : (dayEditMode && !on && !beingDragged ? "1px solid #E4E4E8" : "none"),
                          background: (on || beingDragged) ? CHARCOAL : (dropTarget ? "rgba(30,30,36,0.06)" : (dayEditMode ? "#fff" : "transparent")),
                          color: (on || beingDragged) ? "#fff" : T.ink3,
                          cursor: dayEditMode ? "default" : "pointer", display: "flex", flexDirection: "column",
                          alignItems: "center", justifyContent: "center", fontFamily: "inherit", lineHeight: 1.05,
                          boxShadow: "none",
                          opacity: beingDragged ? 0.9 : (dayDone && !on ? 0.55 : 1),
                          transform: beingDragged ? `translateX(${dayDrag.dx}px) scale(1.05)` : "scale(1)",
                          transition: dayDrag.from >= 0 ? "none" : "transform 0.18s ease, opacity 0.18s ease",
                          /* Normal mode: pan-x so a swipe that STARTS on a chip still
                             scrolls the strip (a tap is unaffected). Edit mode: none,
                             so the pointer-drag reorder owns the gesture. */
                          touchAction: dayEditMode ? "none" : "pan-x",
                          userSelect: "none", WebkitUserSelect: "none",
                          zIndex: beingDragged ? 5 : "auto",
                        }}>
                        <span style={{ fontSize: tripStartDate ? 15 : 16, fontWeight: 800, lineHeight: 1 }}>{d.day}</span>
                        {/* Sprint 43 #4 — with dates set, show the calendar
                            date + short Hebrew weekday under the day number;
                            otherwise the city abbreviation as before. */}
                        {tripStartDate ? (
                          <span style={{ fontSize: 7.5, fontWeight: 800, opacity: 0.9, lineHeight: 1.1, textAlign: "center", whiteSpace: "nowrap" }}>{pillDateLabel(tripStartDate, d.day)}</span>
                        ) : (
                          <span style={{ fontSize: 8, fontWeight: 600, opacity: 0.85 }}>{cityAbbr(d.city)}</span>
                        )}
                        {/* Completed-day indicator (Sprint 20 #5c) — hidden while reordering. */}
                        {dayDone && !dayEditMode && (
                          <span aria-hidden style={{
                            position: "absolute", top: -2, insetInlineEnd: -2,
                            width: 18, height: 18, borderRadius: "50%",
                            background: "#1FA67A", border: "2px solid #fff", color: "#fff",
                            display: "inline-flex", alignItems: "center", justifyContent: "center",
                          }}>
                            <Icon name="check" size={10} strokeWidth={3} />
                          </span>
                        )}
                        {/* Sprint 47 #5 — the legacy black ⇅ reorder handle
                            sub-icon was removed; the chip itself is the drag
                            surface in edit mode, leaving pills clean (only the
                            day number + calendar date string). */}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div style={{ fontSize: 13.5, fontWeight: continuousMode ? 800 : 400, color: continuousMode ? T.ink : T.ink3, padding: "4px 0", flex: 1, display: "inline-flex", alignItems: "center", gap: 7 }}>
                  {continuousMode
                    ? <><Icon name="listOrdered" size={16} strokeWidth={2} color={T.ink} />מסלול רציף · כל הימים</>
                    : "מסלול חדש — עדיין אין ימים"}
                </div>
              )}

                {/* Collapse ⇄ expand toggle — the explicit 2-state handler.
                    Sprint 21 #1: expanding now MAXIMIZES the sheet ("full"),
                    sliding it up to cover the whole map right below the search
                    omnibox; collapsing drops it back to peek (map-only). */}
                <button
                  onClick={() => sheetRef.current?.snapTo?.(sheetCollapsed ? "full" : "peek")}
                  title={sheetCollapsed ? "הצגת המסלול המלא" : "צמצום — תצוגת מפה מלאה"}
                  aria-label={sheetCollapsed ? "פתיחה" : "צמצום"}
                  aria-expanded={!sheetCollapsed}
                  className="tp-press"
                  style={{
                    flexShrink: 0, width: 36, height: 36, borderRadius: "50%",
                    border: `1px solid ${T.line}`, background: "#fff", cursor: "pointer",
                    color: T.ink2, display: "inline-flex", alignItems: "center", justifyContent: "center",
                    fontSize: 15, fontFamily: "inherit",
                    boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
                  }}>
                  <span aria-hidden style={{ display: "inline-block", transform: sheetCollapsed ? "rotate(180deg)" : "none", transition: "transform 0.24s ease" }}>⌄</span>
                </button>
              </div>

              {/* Sprint 45 #2 — persistent calendar date on the (peek-visible)
                  header bar. Continuous mode shows the whole trip range;
                  otherwise the active day's date. Reactively follows the day. */}
              {tripStartDate && days.length > 0 && (
                <div style={{ marginTop: 8, display: "flex", justifyContent: "center" }}>
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13, fontWeight: 700, color: T.ink2, background: T.surface, borderRadius: 999, padding: "5px 14px", whiteSpace: "nowrap" }}>
                    <span aria-hidden>🗓️</span>
                    {continuousMode
                      ? `${dateRangeLabel(tripStartDate, days.length)}`
                      : `יום ${activeDay} | ${pillDateLabel(tripStartDate, activeDay)}`}
                  </span>
                </div>
              )}

              {/* Sprint 23 #6 — collapsible category filter (§8). A single
                  "🏷️ סינון מפה" trigger replaces the always-visible pills;
                  the categories expand inline on demand. Hidden entirely in
                  the collapsed sheet state (only day chips over the map). */}
              {!sheetCollapsed && (
                <div style={{ marginTop: 10 }}>
                  <CollapsibleFilter
                    open={filterOpen}
                    onToggle={() => setFilterOpen((v) => !v)}
                    value={filter}
                    onChange={applyFilter}
                    label="סינון מפה"
                  />
                </div>
              )}
            </div>
          }
        >
          <div style={{ padding: "4px 16px 120px" }}>
            {filter !== "all" ? (
              /* City-grouped filtered view */
              groupedByCity && groupedByCity.length ? (
                groupedByCity.map((g) => (
                  <div key={g.city} style={{ marginBottom: 20 }}>
                    <div style={{ fontSize: 11, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.08em", color: g.color, margin: "8px 0 8px" }}>{g.city}</div>
                    {g.items.map((a, i) => {
                      const c = a.coordinates;
                      const clickable = c && Number.isFinite(c.lat) && Number.isFinite(c.lng);
                      return (
                      <div key={`${a.place_id || a.id || a.name}-${i}`}
                        onClick={clickable ? () => { setActiveStop(a); setFlyToCoord({ lat: c.lat, lng: c.lng }); sheetRef.current?.snapTo?.("peek"); } : undefined}
                        className={clickable ? "tp-press" : undefined}
                        style={{ display: "flex", alignItems: "center", gap: 12, padding: "9px 0", borderBottom: `1px solid ${T.line}`, cursor: clickable ? "pointer" : "default" }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 14.5, fontWeight: 700, color: T.ink, direction: "ltr", textAlign: "right" }}>{a.name}</div>
                          {a.nameHe && a.nameHe !== a.name && <div style={{ fontSize: 12, color: T.ink3 }}>{a.nameHe}</div>}
                          <div style={{ fontSize: 11, color: T.ink4, marginTop: 2 }}>יום {a._day}{a.category ? ` · ${a.category}` : ""}</div>
                        </div>
                        {clickable && <Icon name="pin" size={15} strokeWidth={2} color={T.ink4} />}
                      </div>
                      );
                    })}
                  </div>
                ))
              ) : (
                <div style={{ textAlign: "center", color: T.ink3, padding: "32px 0", fontSize: 13.5 }}>אין תוצאות בקטגוריה זו</div>
              )
            ) : continuousMode ? (
              /* Sprint 41 #3 — CONTINUOUS ROUTE: one cumulative list of every
                 stop across all days, numbered globally 1..N. */
              <div style={{ paddingTop: 4 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, margin: "6px 2px 14px" }}>
                  <span style={{ fontSize: 20, fontWeight: 800, letterSpacing: "-0.02em", color: T.ink }}>מסלול רציף</span>
                  <span style={{ fontSize: 12, fontWeight: 700, color: T.ink3, background: T.surface, borderRadius: 999, padding: "2px 10px" }}>{continuousStops.length} נקודות · {days.length} ימים</span>
                </div>
                {continuousStops.length === 0 ? (
                  <div style={{ textAlign: "center", color: T.ink3, padding: "32px 0", fontSize: 13.5 }}>אין עדיין נקודות במסלול</div>
                ) : (
                  <div style={{ position: "relative" }}>
                    {continuousStops.length > 1 && (
                      <div aria-hidden style={{ position: "absolute", insetInlineEnd: 15, top: 22, bottom: 22, width: 2, background: T.line, borderRadius: 2, zIndex: 0 }} />
                    )}
                    {continuousStops.map(({ globalIdx, dayNum, city, cityHe, a }, k) => {
                      const col = cityColor(city);
                      const prevDay = k > 0 ? continuousStops[k - 1].dayNum : null;
                      const newDay = dayNum !== prevDay;
                      const canNav = !!a.coordinates;
                      return (
                        <div key={`${a.place_id || a.id || a.name}-${globalIdx}`}>
                          {/* Sprint 65 #8 — HIGH-CONTRAST day divider header
                              ("יום 1 - רומא") between day segments so the
                              continuous list reads as distinct days. */}
                          {newDay && (
                            <div style={{ display: "flex", alignItems: "center", gap: 8, margin: k === 0 ? "0 0 10px" : "16px 0 10px", position: "relative", zIndex: 1 }}>
                              <span style={{ fontSize: 12.5, fontWeight: 800, color: "#fff", background: col, borderRadius: 8, padding: "5px 12px", whiteSpace: "nowrap" }}>
                                יום {dayNum} - {cityHe || city}
                              </span>
                              <span aria-hidden style={{ flex: 1, height: 2, background: `${col}33`, borderRadius: 2 }} />
                            </div>
                          )}
                          <div
                            /* Sprint 61 #5 — overview tap: smooth flyTo the stop
                               WITHOUT collapsing the sheet or opening the card,
                               so the numbered list stays available. */
                            onClick={() => { if (canNav && a.coordinates) setFlyToCoord({ lat: a.coordinates.lat, lng: a.coordinates.lng }); }}
                            title={canNav ? "מעבר למיקום על המפה" : undefined}
                            style={{ display: "flex", alignItems: "flex-start", gap: 12, padding: "9px 0", borderBottom: `1px solid ${T.line}`, cursor: canNav ? "pointer" : "default", position: "relative", zIndex: 1 }}>
                            <div style={{ width: 30, height: 30, borderRadius: "50%", flexShrink: 0, background: a._theme || col, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12.5, fontWeight: 800, fontVariantNumeric: "tabular-nums", marginTop: 1 }}>{globalIdx}</div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div dir="auto" style={{ fontSize: 14.5, fontWeight: 700, color: T.ink, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{a.nameHe || a.name}</div>
                              {a.category && <div style={{ fontSize: 11, color: T.ink3, marginTop: 1 }}>{a.category}{a.rating ? ` · ${a.rating}` : ""}</div>}
                              {/* Sprint 65 #8 — keep the personal note explicitly
                                  expanded and visible under each stop. */}
                              {a.note && (
                                <div dir="auto" style={{ display: "flex", alignItems: "flex-start", gap: 5, marginTop: 5, background: "#F0F0F3", borderRadius: 7, padding: "6px 8px", fontSize: 11.5, fontWeight: 500, color: "#4A4A55", lineHeight: 1.4, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
                                  <span style={{ flexShrink: 0, marginTop: 1, color: T.ink3 }}><Icon name="note" size={12} strokeWidth={1.9} /></span>
                                  <span style={{ flex: 1, minWidth: 0 }}>{a.note}</span>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            ) : (
              <>
                {/* Active day header — with a Day Completion checkbox */}
                {activeDayData && (
                  <div style={{ display: "flex", alignItems: "center", gap: 10, margin: "8px 0 14px" }}>
                    {/* Day-level completion checkbox — Trip Mode only (Sprint 21 #2). */}
                    {tripMode && (
                    <button
                      onClick={() => toggleDayComplete(activeDayData.day)}
                      title={activeDayData._dayDone ? "ביטול סימון היום כהושלם" : "סימון היום כהושלם"}
                      aria-label={activeDayData._dayDone ? "ביטול סימון היום כהושלם" : "סימון היום כהושלם"}
                      aria-pressed={!!activeDayData._dayDone}
                      style={{
                        flexShrink: 0, width: 26, height: 26, borderRadius: 8,
                        border: `1.5px solid ${activeDayData._dayDone ? "#1FA67A" : T.ink4}`,
                        background: activeDayData._dayDone ? "#1FA67A" : "transparent",
                        color: "#fff", cursor: "pointer", display: "inline-flex",
                        alignItems: "center", justifyContent: "center", padding: 0,
                        transition: "background 0.2s ease, border-color 0.2s ease",
                      }}
                    >
                      {activeDayData._dayDone && <Icon name="check" size={15} strokeWidth={2.6} />}
                    </button>
                    )}
                    {/* Sprint 61 #6 — COMPACT single-line header: city · יום N ·
                        date collapse into one horizontal bar so the timeline
                        rows gain the vertical space the old stacked block wasted. */}
                    <div dir="auto" style={{ flex: 1, minWidth: 0, display: "flex", alignItems: "center", gap: 6, flexWrap: "nowrap", overflow: "hidden", opacity: activeDayData._dayDone ? 0.55 : 1, transition: "opacity 0.25s ease" }}>
                      <span style={{ fontSize: 17, fontWeight: 800, letterSpacing: "-0.02em", color: cityColor(activeDayData.city), whiteSpace: "nowrap", flexShrink: 0 }}>
                        {activeDayData.cityHe || activeDayData.city}
                      </span>
                      <span style={{ fontSize: 12.5, color: T.ink4, flexShrink: 0 }}>·</span>
                      <span style={{ fontSize: 13, fontWeight: 700, color: T.ink3, whiteSpace: "nowrap", flexShrink: 0 }}>יום {activeDayData.day}</span>
                      {tripStartDate && (
                        <>
                          <span style={{ fontSize: 12.5, color: T.ink4, flexShrink: 0 }}>·</span>
                          <span style={{ fontSize: 12.5, fontWeight: 700, color: T.ink3, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{pillDateLabel(tripStartDate, activeDayData.day)}</span>
                        </>
                      )}
                    </div>
                    {/* Sprint 32 — Position A: header-level unified add menu
                        (📍 location / ✈️ transit), same handlers + day context
                        as the bottom trigger. */}
                    {editable && (
                      <span style={{ flexShrink: 0 }}>
                        <AddMenu variant="header" onAddLocation={openAddStop} onAddTransit={() => setShowAddTransit(true)} />
                      </span>
                    )}
                  </div>
                )}

                {/* Stop list — drag-reorder + auto transit rails.
                    A completed day dims its whole timeline (Sprint 20 #5c). */}
                {activeDayData?.attractions?.length ? (
                  <div style={{ opacity: activeDayData._dayDone ? 0.5 : 1, transition: "opacity 0.25s ease" }}>
                  <DayStopList
                    stops={activeDayData.attractions}
                    color={cityColor(activeDayData.city)}
                    onReorder={handleReorder}
                    onOpenActions={(i) => setActionsIdx(i)}
                    editable={editable}
                    liveOps={isActiveTrip}
                    tripActive={tripMode}
                    onToggleComplete={toggleComplete}
                    onRollover={rolloverStop}
                    onMoveForward={moveStopForward}
                    onNavigate={navigateToStop}
                    onEditTransit={(i) => setEditTransitIdx(i)}
                    onSetTransitMode={setTransitMode}
                    flightsFirst={activeDayData?.day === (days[0]?.day ?? 1)}
                    nextDayNum={nextDayNum}
                    onRequestDelete={deleteStopAt}
                    onRequestInbox={requestInboxAt}
                    onOpenContextMenu={(idx, x, y) => { setCtxSub(null); setCtxMenu({ idx, x, y }); }}
                    onInsertAt={(arrayIdx) => { setInsertText(""); setInsertAt(arrayIdx); }}
                    onDeleteInline={deleteStopAt}
                    onEditNote={(i) => setNoteEditIdx(i)}
                    onOpenAttachment={openAttachment}
                    onQuickAttach={requestAttach}
                  />
                  </div>
                ) : (
                  <div style={{ textAlign: "center", color: T.ink3, padding: "32px 0", fontSize: 13.5 }}>
                    {days.length === 0 ? "התחילו להוסיף תחנות למסלול" : "אין תחנות ביום זה עדיין"}
                  </div>
                )}

                {/* Sprint 32 — Position B: the two competing FABs (black "+"
                    and dashed-orange ✈️) are MERGED into one unified "+"
                    trigger that opens the add menu. The dashed airplane
                    button is gone entirely. */}
                {editable && (
                  <div style={{ display: "flex", justifyContent: "center", marginTop: 18 }}>
                    <AddMenu variant="fab" onAddLocation={openAddStop} onAddTransit={() => setShowAddTransit(true)} />
                  </div>
                )}

                {/* Sprint 47 #5 — the clipped bottom-of-viewport "עריכת שלד
                    הטיול" button was removed; the skeleton editor now lives
                    inside the Options Menu FAB (🔧). */}
              </>
            )}
          </div>
        </EditorBottomSheet>
      )}

      {/* Sprint 42 #5 — floating "add unassigned inbox place to a day" card.
          Appears when a still-unassigned Places-Inbox point is tapped/flown
          to; the CTA reveals a quick day picker that drops it into the day. */}
      {assignCard && (
        <div dir="rtl" className="tp-fade" style={{
          position: "fixed", left: "50%", transform: "translateX(-50%)",
          bottom: "calc(env(safe-area-inset-bottom, 0px) + 96px)", zIndex: 92,
          width: "min(92vw, 420px)", background: "#fff", borderRadius: 18,
          boxShadow: "0 18px 50px rgba(0,0,0,0.3)", border: `1px solid ${T.line}`,
          padding: "14px 16px", fontFamily: T.font,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span aria-hidden style={{ width: 30, height: 30, borderRadius: "50%", background: "rgba(107,113,120,0.15)", color: T.ink3, display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 14, flexShrink: 0 }}>★</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 14.5, fontWeight: 800, color: T.ink, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{assignCard.nameHe || assignCard.name}</div>
              <div style={{ fontSize: 11.5, color: T.ink3 }}>{assignCard.category || "נקודה שמורה"} · לא משובץ</div>
            </div>
            <button onClick={() => { setAssignCard(null); setAssignDaysOpen(false); }} aria-label="סגירה"
              style={{ width: 30, height: 30, borderRadius: "50%", border: "none", background: T.surface, color: T.ink3, cursor: "pointer", flexShrink: 0, fontFamily: "inherit" }}>✕</button>
          </div>
          {!assignDaysOpen ? (
            <button onClick={() => setAssignDaysOpen(true)} className="tp-press"
              style={{ marginTop: 12, width: "100%", height: 46, borderRadius: 14, border: "none", background: T.ink, color: "#fff", fontSize: 14.5, fontWeight: 800, cursor: "pointer", fontFamily: "inherit", display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
              ➕ הוספה לטיול שלי
            </button>
          ) : (
            <div style={{ marginTop: 12 }}>
              <div style={{ fontSize: 12, fontWeight: 800, color: T.ink3, marginBottom: 8 }}>לאיזה יום להוסיף?</div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", maxHeight: 148, overflowY: "auto" }}>
                {days.map((d) => (
                  <button key={d.day}
                    onClick={() => { assignInboxPlace(assignCard, d.day); setAssignCard(null); setAssignDaysOpen(false); }}
                    className="tp-press"
                    style={{ minWidth: 60, padding: "9px 12px", borderRadius: 12, cursor: "pointer", fontFamily: "inherit", textAlign: "center", border: `1.5px solid ${cityColor(d.city)}55`, background: `${cityColor(d.city)}12`, color: T.ink }}>
                    <span style={{ display: "block", fontSize: 14, fontWeight: 800 }}>יום {d.day}</span>
                    <span style={{ display: "block", fontSize: 10, color: T.ink3, marginTop: 1 }}>{d.cityHe || d.city || ""}</span>
                  </button>
                ))}
                {days.length === 0 && <div style={{ fontSize: 12.5, color: T.ink3, padding: "6px 2px" }}>אין ימים במסלול עדיין</div>}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Add-stop sheet */}
      {showAddStop && (
        <AddStopSheet
          pendingCoord={pendingCoord}
          onStartPin={() => {
            setShowAddStop(false);
            setIsPinning(true);
            /* Sprint 28 #5 — map-picking minimization: collapse the sheet
               to peek (day chips only) so the map claims the whole screen
               while the user drops the pin. */
            sheetRef.current?.snapTo?.("peek");
          }}
          onAdd={handleAddStop}
          onAddToDays={handleAddStopToDays}
          days={days.map((d) => ({ day: d.day, city: d.city, cityHe: d.cityHe }))}
          activeDay={activeDay}
          onClose={() => { setShowAddStop(false); setPendingCoord(null); }}
          onPreview={handlePreview}
        />
      )}

      {/* Add-transit sheet */}
      {showAddTransit && (
        <AddTransitSheet
          onAdd={handleAddTransit}
          onClose={() => setShowAddTransit(false)}
        />
      )}

      {/* Sprint 30 — the auto rail no longer materializes a transit row;
          inner-city commuting is handled implicitly by the inline mode
          cycle on the rail itself. The explicit "+" transit button is
          reserved for macro-logistics (flights / long cross-city rail). */}

      {/* Sprint 27 #3 — EDIT-transit sheet: opened from a transit card in
          the timeline or from the map's "ערוך מעבר" quick-edit bridge. */}
      {editTransitIdx >= 0 && activeDayData?.attractions?.[editTransitIdx]?._transit && (
        <AddTransitSheet
          initial={activeDayData.attractions[editTransitIdx]}
          onAdd={(segment) => updateTransitAt(editTransitIdx, segment)}
          onClose={() => setEditTransitIdx(-1)}
        />
      )}

      {/* Sprint 27 #5 — add-to-trip routing interception: the searched
          place goes to the generic inbox OR to an explicit day. */}
      {pendingStop && (
        <div style={{ position: "fixed", inset: 0, zIndex: 64, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
          <div onClick={() => setPendingStop(null)} className="tp-fade" style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.4)" }} />
          <div dir="rtl" className="tp-pop" style={{ position: "relative", width: "100%", maxWidth: 360, background: "#fff", borderRadius: 20, padding: "20px 18px", boxShadow: "0 30px 80px rgba(0,0,0,0.35)", fontFamily: T.font }}>
            <div style={{ fontSize: 15.5, fontWeight: 800, color: T.ink, marginBottom: 4 }}>לאן לשייך את המקום?</div>
            <div style={{ fontSize: 12.5, color: T.ink3, marginBottom: 14, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{pendingStop.nameHe || pendingStop.name}</div>

            {/* Option A — generic Places Inbox */}
            <button onClick={() => saveStopToInbox(pendingStop)}
              style={{ width: "100%", height: 48, borderRadius: 14, border: `1.5px dashed ${T.line}`, background: T.surface, color: T.ink2, fontSize: 13.5, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, marginBottom: 14 }}>
              🗂️ שמור בבנק הנקודות הכללי
            </button>

            {/* Option B — a specific day */}
            <div style={{ fontSize: 11, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.06em", color: T.ink3, marginBottom: 8 }}>שייך ליום ספציפי</div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", maxHeight: 180, overflowY: "auto" }}>
              {days.map((d) => (
                <button key={d.day} onClick={() => placeStopOnDay(pendingStop, d.day)}
                  style={{ minWidth: 52, padding: "8px 10px", borderRadius: 12, border: `1px solid ${T.line}`, background: T.surface, cursor: "pointer", fontFamily: "inherit", textAlign: "center" }}>
                  <span style={{ display: "block", fontSize: 14, fontWeight: 800, color: T.ink }}>יום {d.day}</span>
                  <span style={{ display: "block", fontSize: 10, color: T.ink3, marginTop: 1 }}>{d.cityHe || d.city}</span>
                </button>
              ))}
            </div>
            <button onClick={() => setPendingStop(null)}
              style={{ marginTop: 14, width: "100%", height: 40, borderRadius: 999, border: `1px solid ${T.line}`, background: "transparent", color: T.ink2, fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
              ביטול
            </button>
          </div>
        </div>
      )}

      {/* Sprint 7 — Place preview card */}
      {previewPlace && (
        <PlaceInfoCard
          place={previewPlace}
          days={days.map((d, i) => ({ dayNum: d.day, cityName: (d.cityHe || d.city || "").slice(0, 6), _index: i }))}
          activeDay={days.findIndex((d) => d.day === activeDay)}
          onAdd={handleAddFromPreview}
          onSaveToInbox={(stop) => saveStopToInbox(stop)}
          onClose={() => { setPreviewPlace(null); setFlyToCoord(null); /* while nearby result pins are shown, stay collapsed so the map + pins remain visible */ sheetRef.current?.snapTo?.(searchResults.length > 0 ? "peek" : "full"); }}
        />
      )}

      {/* Sprint 26 #1 — exit confirmation modal. */}
      {confirmExit && (
        <div style={{ position: "fixed", inset: 0, zIndex: 70, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
          <div onClick={() => setConfirmExit(false)} className="tp-fade" style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.45)" }} />
          <div className="tp-pop" dir="rtl" style={{ position: "relative", width: "100%", maxWidth: 340, background: "#fff", borderRadius: 22, padding: "24px 22px", boxShadow: "0 30px 80px rgba(0,0,0,0.4)", textAlign: "center", fontFamily: T.font }}>
            <div style={{ width: 52, height: 52, borderRadius: "50%", background: T.surface, color: T.ink2, display: "inline-flex", alignItems: "center", justifyContent: "center", marginBottom: 12 }}>
              <Icon name="home" size={24} strokeWidth={1.8} />
            </div>
            <div style={{ fontSize: 18, fontWeight: 800, color: T.ink, marginBottom: 6 }}>האם לצאת למסך הראשי?</div>
            <div style={{ fontSize: 13.5, color: T.ink3, lineHeight: 1.5, marginBottom: 20 }}>
              כל השינויים נשמרו — אפשר לחזור למפה בכל רגע.
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => setConfirmExit(false)}
                style={{ flex: 1, height: 48, borderRadius: 999, border: `1px solid ${T.line}`, background: T.surface, color: T.ink, fontSize: 14.5, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
                ביטול
              </button>
              <button onClick={() => { setConfirmExit(false); navigate("/dashboard"); }}
                style={{ flex: 1, height: 48, borderRadius: 999, border: "none", background: T.ink, color: "#fff", fontSize: 14.5, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
                יציאה
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Sprint 37 #2 — long-press ROW CONTEXT MENU. A tap-scrim closes it;
          the sheet-style card floats bottom-centred (mobile-first) rather
          than at the raw pointer coords so it never clips off-screen. */}
      {ctxMenu && activeDayData?.attractions?.[ctxMenu.idx] && (() => {
        const idx = ctxMenu.idx;
        const stop = activeDayData.attractions[idx];
        const isLodg = !!stop._hotelGroup || /מלון|לינה/.test(stop.category || "");
        const close = () => { setCtxMenu(null); setCtxSub(null); };
        const THEMES = ["#8B7BC7", "#5FA36A", "#E0915A", "#C77BA6", "#6E8BC4", "#D67B7B", T.ink];
        const Item = ({ icon, label, onClick, danger }) => (
          <button onClick={onClick}
            style={{ display: "flex", alignItems: "center", gap: 12, width: "100%", padding: "13px 16px", border: "none", background: "transparent", cursor: "pointer", fontFamily: "inherit", fontSize: 14.5, fontWeight: 700, color: danger ? T.danger || "#D94025" : T.ink, textAlign: "start" }}>
            <span aria-hidden style={{ fontSize: 18, width: 22, textAlign: "center" }}>{icon}</span>{label}
          </button>
        );
        return (
          <div style={{ position: "fixed", inset: 0, zIndex: 250, display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
            <div onClick={close} className="tp-fade" style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.4)" }} />
            <div className="tp-pop" dir="rtl" style={{ position: "relative", width: "100%", maxWidth: 420, background: "#fff", borderRadius: "20px 20px 0 0", padding: "8px 0 max(10px, env(safe-area-inset-bottom))", boxShadow: "0 -12px 40px rgba(0,0,0,0.25)", fontFamily: T.font }}>
              <div style={{ padding: "10px 16px 8px", borderBottom: `1px solid ${T.line}`, display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 14, fontWeight: 800, color: T.ink, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", flex: 1 }}>{stop.nameHe || stop.name}</span>
                <button onClick={close} aria-label="סגירה" style={{ border: "none", background: T.surface, width: 30, height: 30, borderRadius: "50%", cursor: "pointer", color: T.ink3, fontFamily: "inherit" }}>✕</button>
              </div>
              {ctxSub === "day" ? (
                <div style={{ maxHeight: "44vh", overflowY: "auto", padding: "6px 0" }}>
                  <div style={{ padding: "6px 16px", fontSize: 12, fontWeight: 800, color: T.ink3 }}>העברה ליום…</div>
                  {days.filter((d) => d.day !== activeDay).map((d) => (
                    <Item key={d.day} icon="📅" label={`יום ${d.day} · ${d.cityHe || d.city}`}
                      onClick={() => { moveStopIndexToDay(idx, d.day); close(); }} />
                  ))}
                  {days.filter((d) => d.day !== activeDay).length === 0 && (
                    <div style={{ padding: "12px 16px", fontSize: 13, color: T.ink3 }}>אין ימים אחרים במסלול</div>
                  )}
                </div>
              ) : ctxSub === "theme" ? (
                <div style={{ padding: "16px" }}>
                  <div style={{ fontSize: 12, fontWeight: 800, color: T.ink3, marginBottom: 12 }}>בחרו צבע לנקודה</div>
                  <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                    {THEMES.map((c) => (
                      <button key={c} onClick={() => { setStopThemeAt(idx, c === T.ink ? null : c); close(); }}
                        aria-label="צבע" style={{ width: 40, height: 40, borderRadius: "50%", background: c, border: (stop._theme || "") === c ? `3px solid ${T.ink}` : "2px solid #fff", boxShadow: "0 1px 4px rgba(0,0,0,0.2)", cursor: "pointer" }} />
                    ))}
                  </div>
                </div>
              ) : (
                <div style={{ padding: "4px 0" }}>
                  <Item icon="📝" label={stop.note ? "עריכת הערה" : "הוספת הערה"} onClick={() => { close(); setNoteEditIdx(idx); }} />
                  {/* Sprint 61 #3 — duplicate this place into the same day. */}
                  <Item icon="📋" label="שכפל מיקום" onClick={() => { close(); duplicateStopAt(idx); }} />
                  {/* Sprint 61 #7 — attach a confirmation file / PDF. */}
                  <Item icon="📎" label="צרף קובץ/מסמך" onClick={() => { close(); requestAttach(idx); }} />
                  <Item icon="🎨" label="שינוי צבע / נושא" onClick={() => setCtxSub("theme")} />
                  <Item icon="📅" label="העברה ליום…" onClick={() => setCtxSub("day")} />
                  <Item icon={isLodg ? "🏨" : "🛏️"} label={isLodg ? "ביטול עוגן לינה" : "הגדרה כעוגן לינה"} onClick={() => { toggleLodgingAnchorAt(idx); close(); }} />
                  <div style={{ borderTop: `1px solid ${T.line}`, margin: "4px 0" }} />
                  <Item icon="🗑️" label="מחיקת הנקודה" danger onClick={() => { close(); deleteStopAt(idx); }} />
                </div>
              )}
            </div>
          </div>
        );
      })()}

      {/* Sprint 37 #2 — swipe-delete UNDO pill (auto-dismiss after 5s). */}
      {deleteUndo && (
        <div className="tp-fade" dir="rtl" style={{
          position: "fixed", bottom: 28, left: "50%", transform: "translateX(-50%)",
          zIndex: 96, maxWidth: "min(92vw, 420px)", background: T.ink, color: "#fff",
          borderRadius: 14, padding: "10px 12px 10px 16px", fontFamily: T.font,
          boxShadow: "0 14px 40px rgba(0,0,0,0.32)", display: "flex", alignItems: "center", gap: 12,
        }}>
          <span style={{ fontSize: 13.5, fontWeight: 700, flex: 1 }}>הנקודה נמחקה — האם למחוק את הנקודה?</span>
          <button onClick={undoDelete} style={{ border: "none", background: "#fff", color: T.ink, borderRadius: 999, padding: "7px 16px", fontFamily: "inherit", fontSize: 13, fontWeight: 800, cursor: "pointer" }}>בטל</button>
        </div>
      )}

      {/* Sprint 38 #3 — swipe-to-inbox UNDO toast (non-blocking, 10s). */}
      {inboxUndo && (
        <div className="tp-fade" dir="rtl" style={{
          position: "fixed", bottom: 28, left: "50%", transform: "translateX(-50%)",
          zIndex: 97, maxWidth: "min(94vw, 440px)", background: T.ink, color: "#fff",
          borderRadius: 14, padding: "10px 10px 10px 16px", fontFamily: T.font,
          boxShadow: "0 14px 40px rgba(0,0,0,0.32)", display: "flex", alignItems: "center", gap: 10,
        }}>
          <span style={{ fontSize: 13.5, fontWeight: 700, flex: 1 }}>הנקודה הועברה לבנק הנקודות</span>
          <button onClick={restoreFromInbox}
            style={{ border: "none", background: "#fff", color: T.ink, borderRadius: 999, padding: "7px 14px", fontFamily: "inherit", fontSize: 12.5, fontWeight: 800, cursor: "pointer", whiteSpace: "nowrap" }}>
            החזר ליום זה ↩️
          </button>
          <button onClick={() => setInboxUndo(null)} aria-label="סגירה"
            style={{ border: "none", background: "rgba(255,255,255,0.16)", color: "#fff", width: 30, height: 30, borderRadius: "50%", cursor: "pointer", fontFamily: "inherit", flexShrink: 0 }}>✕</button>
        </div>
      )}

      {/* Sprint 37 #3 — TRIP SUMMARY: a fullscreen, high-readability birds-eye
          overview. One clean block per day (day #, city, transit modes, stops
          in order) + a lodging checker that flags nights with no hotel anchor. */}
      {summaryOpen && trip && (
        <div dir="rtl" className="tp-fade tp-summary" style={{ position: "fixed", inset: 0, zIndex: 250, background: "#FBFAF7", display: "flex", flexDirection: "column", fontFamily: T.font }}>
          {/* Sprint 59 #5 — flat re-skin: a deep charcoal header band with a
              high-contrast ✕ close target anchored at the upper-inline-end. */}
          <div className="tp-no-print" style={{ flexShrink: 0, display: "flex", alignItems: "center", gap: 10, padding: "14px 18px", background: "#1E1E24", flexWrap: "wrap" }}>
            <div style={{ flex: 1, minWidth: 140 }}>
              <div style={{ fontSize: 18, fontWeight: 800, color: "#fff", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{trip.title}</div>
              <div style={{ fontSize: 12.5, color: "rgba(255,255,255,0.65)", marginTop: 2 }}>סיכום מלא · {days.length} ימים</div>
            </div>
            {/* Sprint 38 #4 — export suite. */}
            <button onClick={() => window.print()}
              style={{ background: "#fff", color: T.ink, border: "none", borderRadius: 999, padding: "9px 14px", fontSize: 12.5, fontWeight: 800, cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap" }}>
              📄 הדפסה / שמירה כ-PDF
            </button>
            <button onClick={exportSummaryCSV}
              style={{ background: "#177A5B", color: "#fff", border: "none", borderRadius: 999, padding: "9px 14px", fontSize: 12.5, fontWeight: 800, cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap" }}>
              📥 ייצוא ל-Excel (CSV)
            </button>
            <button onClick={() => setSummaryOpen(false)} aria-label="סגירה" title="סגירה" className="tp-press"
              style={{ width: 40, height: 40, borderRadius: "50%", border: "none", background: "#fff", cursor: "pointer", color: "#1E1E24", fontFamily: "inherit", fontSize: 17, fontWeight: 800, flexShrink: 0, display: "inline-flex", alignItems: "center", justifyContent: "center" }}>✕</button>
          </div>
          {/* Print-only heading (chrome hidden in @media print). */}
          <div style={{ display: "none" }} className="tp-print-only">{trip.title}</div>
          <div style={{ flex: 1, overflowY: "auto", padding: "16px", WebkitOverflowScrolling: "touch" }}>
            {/* Sprint 51 #4 — premium statistics band: bold numeric data cards. */}
            {(() => {
              const isLodg = (a) => !a._transit && (!!a._hotelGroup || /מלון|לינה/.test(a.category || ""));
              let stops = 0, lodges = 0, transits = 0;
              days.forEach((d) => (d.attractions || []).forEach((a) => {
                if (a._inlineNote || a._inlineTransit) return; // Sprint 51/52 — not stops
                if (a._transit) transits++;
                else if (isLodg(a)) lodges++;
                else stops++;
              }));
              const cities = new Set(days.map((d) => d.cityHe || d.city).filter(Boolean)).size;
              const stats = [
                { n: days.length, label: "ימים", emoji: "🗓️" },
                { n: stops, label: "עצירות", emoji: "📍" },
                { n: lodges, label: "לינות", emoji: "🏨" },
                { n: transits, label: "מעברים", emoji: "🚄" },
                { n: cities, label: "ערים", emoji: "🏙️" },
              ];
              return (
                <div style={{ maxWidth: 1100, margin: "0 auto 18px", display: "grid", gap: 10, gridTemplateColumns: "repeat(auto-fit, minmax(96px, 1fr))" }}>
                  {stats.map((s) => (
                    <div key={s.label} style={{ background: "#fff", border: `1px solid ${T.line}`, borderRadius: 16, padding: "14px 12px", textAlign: "center", boxShadow: "0 1px 4px rgba(0,0,0,0.05)" }}>
                      <div aria-hidden style={{ fontSize: 18, lineHeight: 1 }}>{s.emoji}</div>
                      <div style={{ fontSize: 26, fontWeight: 800, color: T.ink, marginTop: 4, fontVariantNumeric: "tabular-nums", letterSpacing: "-0.02em" }}>{s.n}</div>
                      <div style={{ fontSize: 11.5, fontWeight: 700, color: T.ink3, marginTop: 1 }}>{s.label}</div>
                    </div>
                  ))}
                </div>
              );
            })()}
            <div className="tp-summary-grid" style={{ display: "grid", gap: 14, gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", maxWidth: 1100, margin: "0 auto" }}>
              {days.map((d) => {
                const atts = d.attractions || [];
                const isLodg = (a) => !a._transit && (!!a._hotelGroup || /מלון|לינה/.test(a.category || ""));
                const transits = atts.filter((a) => a._transit);
                const placeStops = atts.filter((a) => !a._transit && !a._inlineNote && !isLodg(a));
                const lodges = atts.filter(isLodg);
                const col = cityColor(d.city);
                return (
                  <div key={d.day} className="tp-summary-card" style={{ background: "#fff", border: `1px solid ${T.line}`, borderRadius: 16, padding: "14px 16px", boxShadow: "0 1px 4px rgba(0,0,0,0.05)", display: "flex", flexDirection: "column", gap: 10 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <span style={{ width: 34, height: 34, borderRadius: "50%", background: col, color: "#fff", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 15, fontWeight: 800, flexShrink: 0 }}>{d.day}</span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 16, fontWeight: 800, color: T.ink }}>{d.cityHe || d.city || "—"}</div>
                        {/* Sprint 43 #5 — calendar date flows into the summary. */}
                        <div style={{ fontSize: 11.5, color: T.ink3 }}>יום {d.day}{tripStartDate ? ` · ${fullDateLabel(tripStartDate, d.day)}` : ""}</div>
                      </div>
                    </div>
                    {transits.length > 0 && (
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                        {transits.map((t, i) => {
                          const g = TRANSIT_GLYPH[t.transitType] || TRANSIT_GLYPH.flight;
                          return (
                            <span key={i} style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 11.5, fontWeight: 700, color: T.ink2, background: T.surface, border: `1px solid ${T.line}`, borderRadius: 999, padding: "3px 10px" }}>
                              <Icon name={g.icon} size={12} strokeWidth={1.9} />{g.he}{t.from && t.to ? ` · ${t.from}→${t.to}` : ""}
                            </span>
                          );
                        })}
                      </div>
                    )}
                    {placeStops.length > 0 ? (
                      <ol style={{ margin: 0, padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 6 }}>
                        {placeStops.map((a, i) => (
                          <li key={i} style={{ display: "flex", alignItems: "flex-start", gap: 8, fontSize: 13.5, color: T.ink }}>
                            <span style={{ flexShrink: 0, width: 20, height: 20, borderRadius: "50%", background: `${col}18`, color: col, display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 800 }}>{i + 1}</span>
                            <span style={{ fontWeight: 600, lineHeight: 1.35 }}>{a.nameHe || a.name}</span>
                          </li>
                        ))}
                      </ol>
                    ) : (
                      <div style={{ fontSize: 12.5, color: T.ink3, fontStyle: "normal" }}>אין תחנות מתוכננות ליום זה</div>
                    )}
                    {/* Lodging checker */}
                    {lodges.length > 0 ? (
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 2, background: "rgba(31,166,122,0.08)", border: "1px solid rgba(31,166,122,0.28)", borderRadius: 12, padding: "8px 12px", fontSize: 12.5, fontWeight: 700, color: "#177A5B" }}>
                        <span aria-hidden style={{ fontSize: 15 }}>🏨</span>
                        <span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{lodges.map((l) => l.nameHe || l.name).join(" · ")}</span>
                      </div>
                    ) : (
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 2, background: "rgba(217,64,37,0.08)", border: "1px solid rgba(217,64,37,0.3)", borderRadius: 12, padding: "8px 12px", fontSize: 12.5, fontWeight: 800, color: "#B8331E" }}>
                        <span aria-hidden style={{ fontSize: 15 }}>⚠️</span> חסר מקום לינה ליום זה
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Sprint 45 #1 — set/modify trip dates via the visual range picker.
          Changing the span re-shifts the day arrays (no stop is dropped). */}
      {datesModalOpen && trip && (
        <div dir="rtl" style={{ position: "fixed", inset: 0, zIndex: 108, display: "flex", alignItems: "center", justifyContent: "center", padding: 16, fontFamily: T.font }}>
          <div onClick={() => setDatesModalOpen(false)} className="tp-fade" style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.5)" }} />
          <div className="tp-pop" style={{ position: "relative", width: "100%", maxWidth: 400, maxHeight: "92vh", overflowY: "auto", background: "#fff", borderRadius: 22, padding: "20px 20px", boxShadow: "0 30px 80px rgba(0,0,0,0.4)", fontFamily: T.font }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
              <span aria-hidden style={{ fontSize: 22 }}>🗓️</span>
              <div style={{ fontSize: 18, fontWeight: 800, color: T.ink, flex: 1 }}>תאריכי הטיול</div>
              <button onClick={() => setDatesModalOpen(false)} aria-label="סגירה" style={{ width: 40, height: 40, borderRadius: "50%", border: "none", background: T.surface, color: T.ink3, cursor: "pointer", fontFamily: "inherit", fontSize: 16 }}>✕</button>
            </div>
            <CalendarRangePicker
              start={datesDraft}
              end={datesEndDraft}
              onChange={(s, e) => { setDatesDraft(s); setDatesEndDraft(e); }}
            />
            <button onClick={() => { applyDateRange(datesDraft || null, datesEndDraft || null); setDatesModalOpen(false); }} disabled={!datesDraft} className="tp-press"
              style={{ width: "100%", height: 52, marginTop: 14, borderRadius: 999, border: "none", background: datesDraft ? T.ink : "#D1CCC5", color: "#fff", fontSize: 16, fontWeight: 800, cursor: datesDraft ? "pointer" : "default", fontFamily: "inherit" }}>
              שמירת התאריכים
            </button>
            {tripStartDate && (
              <button onClick={() => { saveStartDate(null); setDatesModalOpen(false); }}
                style={{ width: "100%", height: 44, marginTop: 8, borderRadius: 999, border: "none", background: "transparent", color: "#C0392B", fontSize: 14, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
                הסרת התאריכים מהטיול
              </button>
            )}
          </div>
        </div>
      )}

      {/* Sprint 37 #6 — first-open WELCOME / onboarding dialog. */}
      {onboardOpen && (
        <div dir="rtl" style={{ position: "fixed", inset: 0, zIndex: 110, display: "flex", alignItems: "center", justifyContent: "center", padding: 22 }}>
          <div className="tp-fade" style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.5)" }} />
          <div className="tp-pop" style={{ position: "relative", width: "100%", maxWidth: 380, background: "#fff", borderRadius: 22, padding: "26px 24px", boxShadow: "0 30px 80px rgba(0,0,0,0.4)", textAlign: "center", fontFamily: T.font }}>
            <div style={{ fontSize: 42, marginBottom: 8 }}>🗾</div>
            <div style={{ fontSize: 19, fontWeight: 800, color: T.ink, marginBottom: 12, lineHeight: 1.3 }}>ברוכים הבאים למסלול!</div>
            <div style={{ fontSize: 14, color: T.ink2, lineHeight: 1.65, marginBottom: 22 }}>
              מפה זו מיועדת לתכנון הטיול שלכם. ניתן לחפש ולמצוא מקומות ישירות מגוגל, אך מומלץ לחפש מקום שמעניין אתכם, להבין את המיקום המדויק שלו, ואז לאתר ולשמור אותו כאן למסלול.
            </div>
            <button onClick={dismissOnboard}
              style={{ width: "100%", height: 50, borderRadius: 999, border: "none", background: T.ink, color: "#fff", fontSize: 15, fontWeight: 800, cursor: "pointer", fontFamily: "inherit" }}>
              הבנתי, בואו נתחיל! 🚀
            </button>
          </div>
        </div>
      )}

      {/* ══ Sprint 59 #3 — PLACES INBOX = MAP-FIRST CAROUSEL EXPLORER ══
          The old 70% side drawer is replaced by a map-focused workspace:
          opening the inbox projects every saved point across the map (eye
          overlay, wired via the inboxMode effect) and mounts a compact top
          control strip + a bottom horizontal snap-carousel of mini-cards.
          Swiping the carousel pans the map to the centred card's marker. */}
      {trip && inboxMode && (() => {
        const inBounds = (s) => {
          if (!inboxGeoFilter) return true;
          const b = inboxGeoFilter;
          return Number.isFinite(s.lat) && Number.isFinite(s.lng)
            && s.lat >= b.south && s.lat <= b.north && s.lng >= b.west && s.lng <= b.east;
        };
        const tripVisible = unifiedStops
          .filter((s) => s.assignedDay == null)
          .filter((s) => inboxFilter === "all" || categoryBucket(s.category) === inboxFilter)
          .filter(inBounds);
        const items = inboxTab === "global" ? (globalPoints || []) : tripVisible;
        /* Sprint 59 #3 — FLUID FOCUS PANNING: debounce the scroll, find the
           card nearest the carousel centre, and fly the map to its marker. */
        const onCarouselScroll = (e) => {
          const el = e.currentTarget;
          if (inboxFlyTimer.current) clearTimeout(inboxFlyTimer.current);
          inboxFlyTimer.current = setTimeout(() => {
            const rect = el.getBoundingClientRect();
            const cx = rect.left + rect.width / 2;
            let best = null, bestD = Infinity;
            Array.from(el.children).forEach((ch) => {
              const r = ch.getBoundingClientRect();
              const d = Math.abs((r.left + r.width / 2) - cx);
              if (d < bestD) { bestD = d; best = ch; }
            });
            if (best && best.dataset.lat) {
              const lat = parseFloat(best.dataset.lat), lng = parseFloat(best.dataset.lng);
              if (Number.isFinite(lat) && Number.isFinite(lng)) setFlyToCoord({ lat, lng });
            }
          }, 130);
        };
        return (
          <>
            {/* Top control strip — title + count, this-trip / global toggle,
                category chips, ✕ close. Floats over the map (map-first). */}
            <div dir="rtl" className="tp-pop" style={{
              position: "fixed", zIndex: 120,
              top: "calc(env(safe-area-inset-top, 0px) + 68px)",
              insetInlineStart: 12, insetInlineEnd: 12,
              background: "#fff", borderRadius: 16, padding: "10px 12px",
              boxShadow: "0 6px 24px rgba(0,0,0,0.16)", fontFamily: T.font,
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 14.5, fontWeight: 800, color: T.ink }}>בנק הנקודות</span>
                <span title="מספר נקודות" style={{ fontSize: 11, fontWeight: 800, color: T.ink3, background: T.surface, borderRadius: 999, padding: "2px 9px", fontVariantNumeric: "tabular-nums" }}>
                  {inboxTab === "global" ? (globalPoints ? globalPoints.length : "…") : `${tripVisible.length}`}
                </span>
                <div style={{ flex: 1 }} />
                <button onClick={() => setMode("design")} title="סגירת בנק הנקודות" aria-label="סגירת בנק הנקודות" className="tp-press"
                  style={{ flexShrink: 0, width: 34, height: 34, borderRadius: "50%", border: `1px solid ${T.line}`, background: "#fff", color: T.ink2, cursor: "pointer", fontFamily: "inherit", display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
                  <Icon name="x" size={15} strokeWidth={2.2} />
                </button>
              </div>
              <div style={{ display: "flex", gap: 4, marginTop: 8 }}>
                {[{ id: "trip", label: "הבנק לטיול זה" }, { id: "global", label: "כל הנקודות שלי" }].map((t) => {
                  const on = inboxTab === t.id;
                  return (
                    <button key={t.id} onClick={() => setInboxTab(t.id)}
                      style={{ flex: 1, border: `1px solid ${on ? T.ink : T.line}`, background: on ? T.ink : "#fff", color: on ? "#fff" : T.ink2, borderRadius: 999, padding: "7px 8px", fontSize: 12.5, fontWeight: 800, cursor: "pointer", fontFamily: "inherit" }}>
                      {t.label}
                    </button>
                  );
                })}
              </div>
              {inboxTab === "trip" && (
                <div style={{ display: "flex", gap: 6, overflowX: "auto", WebkitOverflowScrolling: "touch", marginTop: 8 }} className="tp-noscrollbar">
                  {[
                    { id: "all", label: "הכל", emoji: "" },
                    { id: "food", label: "אוכל", emoji: "🍜" },
                    { id: "hotels", label: "לינה", emoji: "🏨" },
                    { id: "attractions", label: "אטרקציות", emoji: "🏯" },
                  ].map((c) => {
                    const on = inboxFilter === c.id;
                    return (
                      <button key={c.id} onClick={() => setInboxFilter(c.id)}
                        style={{ flexShrink: 0, height: 30, padding: "0 12px", borderRadius: 999, border: "none", background: on ? "#1E1E24" : "#F0F0F3", color: on ? "#fff" : T.ink2, fontSize: 12, fontWeight: 800, cursor: "pointer", fontFamily: "inherit", display: "inline-flex", alignItems: "center", gap: 5, whiteSpace: "nowrap" }}>
                        {c.emoji && <span aria-hidden>{c.emoji}</span>}{c.label}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Bottom horizontal carousel — premium mini-cards, snap scrolling,
                no static trash icons (destructive lives in the tapped card). */}
            <div dir="rtl" style={{
              position: "fixed", zIndex: 120, insetInlineStart: 0, insetInlineEnd: 0,
              bottom: "calc(env(safe-area-inset-bottom, 0px) + 96px)",
              fontFamily: T.font, pointerEvents: "none",
            }}>
              {inboxTab === "global" && globalLoading ? (
                <div style={{ margin: "0 12px", background: "#fff", borderRadius: 12, padding: "14px 16px", boxShadow: "0 6px 24px rgba(0,0,0,0.16)", fontSize: 13, color: T.ink3, pointerEvents: "auto" }}>טוען את כל הנקודות שלך…</div>
              ) : items.length === 0 ? (
                <div style={{ margin: "0 12px", background: "#fff", borderRadius: 12, padding: "14px 16px", boxShadow: "0 6px 24px rgba(0,0,0,0.16)", fontSize: 13, color: T.ink3, lineHeight: 1.5, pointerEvents: "auto" }}>
                  {inboxTab === "global"
                    ? "עדיין אין נקודות בטיולים אחרים. כל מקום שתשמרו יופיע כאן."
                    : (inboxGeoFilter ? "אין נקודות שמורות בתוך אזור המפה הנוכחי" : "כל הנקודות כבר שובצו במסלול 🎉")}
                </div>
              ) : (
                <div onScroll={onCarouselScroll}
                  className="tp-noscrollbar"
                  style={{ display: "flex", flexDirection: "row", overflowX: "auto", WebkitOverflowScrolling: "touch", scrollSnapType: "x mandatory", gap: 12, padding: "0 12px", pointerEvents: "auto" }}>
                  {items.map((s) => (
                    <button key={s.key}
                      data-lat={Number.isFinite(s.lat) ? s.lat : undefined}
                      data-lng={Number.isFinite(s.lng) ? s.lng : undefined}
                      onClick={() => openSavedPointCard(s)}
                      className="tp-press"
                      style={{ flexShrink: 0, scrollSnapAlign: "center", textAlign: "start", minWidth: 186, width: 186, boxSizing: "border-box", border: "none", background: "#fff", borderRadius: 14, padding: 0, cursor: "pointer", fontFamily: "inherit", display: "flex", flexDirection: "column", boxShadow: "0 4px 16px rgba(0,0,0,0.14)", overflow: "hidden" }}>
                      {/* Cover photo (real Google photo → Street View → neutral tile) */}
                      <div style={{ position: "relative", height: 84, background: T.surface }}>
                        <img src={bankPhotoFor(s)} alt="" loading="lazy" onError={onPhotoErrorStrict()}
                          style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
                        <span aria-hidden style={{ position: "absolute", top: 6, insetInlineStart: 6, fontSize: 15, background: "rgba(255,255,255,0.92)", borderRadius: 8, width: 26, height: 26, display: "inline-flex", alignItems: "center", justifyContent: "center", boxShadow: "0 1px 4px rgba(0,0,0,0.15)" }}>{categoryEmoji(s.category)}</span>
                        {s.rating && <span style={{ position: "absolute", top: 6, insetInlineEnd: 6, fontSize: 10.5, fontWeight: 800, color: "#fff", background: "rgba(0,0,0,0.55)", borderRadius: 999, padding: "2px 7px" }}>★ {s.rating}</span>}
                        {s.tripTitle && inboxTab === "global" && <span dir="auto" style={{ position: "absolute", bottom: 6, insetInlineStart: 6, fontSize: 9.5, fontWeight: 800, color: "#fff", background: "rgba(0,0,0,0.5)", borderRadius: 999, padding: "2px 7px", maxWidth: 150, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{s.tripTitle}</span>}
                      </div>
                      <div style={{ padding: "9px 11px 11px", display: "flex", flexDirection: "column", gap: 4 }}>
                        <div dir="auto" style={{ fontSize: 13, fontWeight: 800, color: "#111114", lineHeight: 1.25, display: "-webkit-box", WebkitLineClamp: 1, WebkitBoxOrient: "vertical", overflow: "hidden", wordBreak: "break-word" }}>{s.nameHe || s.name}</div>
                        {s.note ? (
                          <div dir="auto" style={{ fontSize: 11, color: T.ink3, lineHeight: 1.4, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden", wordBreak: "break-word" }}>📝 {s.note}</div>
                        ) : (
                          <div style={{ fontSize: 11, color: T.ink4 || T.ink3 }}>{s.category || ""}</div>
                        )}
                        <div style={{ fontSize: 11, fontWeight: 800, color: T.accent, display: "inline-flex", alignItems: "center", gap: 4, marginTop: 2 }}>
                          <Icon name="plus" size={13} strokeWidth={2.6} color={T.accent} /> הוסף ליום זה
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </>
        );
      })()}

      {/* Sprint 59 #4 — RICH DETAILS CARD for a tapped saved point (from the
          carousel OR a gray map marker). A floating bottom card with a prominent
          primary "add to THIS day" action; assigning keeps the carousel + map
          overlay fully mounted (the card just dismisses). */}
      {inboxCardMenu && (
        <div onClick={() => setInboxCardMenu(null)} dir="rtl" style={{ position: "fixed", inset: 0, zIndex: 130, background: "rgba(0,0,0,0.28)", display: "flex", alignItems: "flex-end", justifyContent: "center", padding: 12, paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 16px)", fontFamily: T.font }}>
          <div onClick={(e) => e.stopPropagation()} className="tp-pop" style={{ width: "100%", maxWidth: 460, background: "#fff", borderRadius: 16, padding: 16, boxShadow: "0 -8px 34px rgba(0,0,0,0.24)", overflow: "hidden" }}>
            {/* Sprint 60 #5 — rich cover photo block (renders only when the saved
                point carries a real image; a load failure removes the block so
                the card never shows a broken frame). */}
            {(() => (
                <div style={{ margin: "-16px -16px 12px", height: 150, background: T.surface, overflow: "hidden" }}>
                  <img src={(() => { const k = photoKey(inboxCardMenu); return (k && inboxMenuPhotos[k]) || photoStrict(inboxCardMenu); })()} alt="" loading="lazy"
                    onError={onPhotoErrorStrict()}
                    style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
                </div>
            ))()}
            <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
              <span aria-hidden style={{ fontSize: 22, lineHeight: 1 }}>{categoryEmoji(inboxCardMenu.category)}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div dir="auto" style={{ fontSize: 15, fontWeight: 800, color: T.ink, lineHeight: 1.3, wordBreak: "break-word" }}>{inboxCardMenu.nameHe || inboxCardMenu.name}</div>
                <div style={{ fontSize: 11.5, color: T.ink3, marginTop: 2 }}>{[inboxCardMenu.rating ? `★ ${inboxCardMenu.rating}` : "", inboxCardMenu.category, inboxCardMenu.tripTitle].filter(Boolean).join(" · ")}</div>
              </div>
              <button onClick={() => setInboxCardMenu(null)} title="סגירה" aria-label="סגירה"
                style={{ flexShrink: 0, width: 32, height: 32, borderRadius: "50%", border: `1px solid ${T.line}`, background: "#fff", color: T.ink2, cursor: "pointer", fontFamily: "inherit", display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
                <Icon name="x" size={14} strokeWidth={2.2} />
              </button>
            </div>
            {/* Sprint 62 #5 — Google editorial summary snippet (when enriched). */}
            {inboxCardMenu.description && (
              <div dir="auto" style={{ fontSize: 12.5, color: T.ink2, lineHeight: 1.55, marginTop: 10, display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{inboxCardMenu.description}</div>
            )}
            {/* Editable personal note — persists back to the bank on save. */}
            <div style={{ marginTop: 10 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11.5, fontWeight: 800, color: T.ink3, marginBottom: 6 }}>
                <Icon name="note" size={13} strokeWidth={1.9} color={T.ink3} /> הערה אישית
              </div>
              <textarea
                value={inboxCardMenu.note || ""}
                onChange={(e) => setInboxCardMenu((c) => (c ? { ...c, note: e.target.value, _noteSaved: false } : c))}
                placeholder="הוסיפו הערה למקום הזה…" rows={2}
                style={{ width: "100%", boxSizing: "border-box", padding: "9px 11px", borderRadius: 10, border: `1px solid ${inboxCardMenu.note ? T.ink : T.line}`, background: T.surface, fontSize: 13.5, fontFamily: "inherit", color: T.ink, direction: "rtl", textAlign: "right", resize: "none", lineHeight: 1.5 }} />
              <button onClick={() => saveInboxNote(inboxCardMenu)}
                style={{ width: "100%", height: 40, marginTop: 6, borderRadius: 10, border: "none", background: inboxCardMenu._noteSaved ? "#E4EFE5" : "#1E1E24", color: inboxCardMenu._noteSaved ? "#2B7B71" : "#fff", fontSize: 13, fontWeight: 800, cursor: "pointer", fontFamily: "inherit", transition: "background 0.15s" }}>
                {inboxCardMenu._noteSaved ? "✓ ההערה נשמרה" : "שמירת ההערה"}
              </button>
            </div>
            <button onClick={() => quickAssignToActiveDay(inboxCardMenu)}
              style={{ width: "100%", height: 48, marginTop: 12, borderRadius: 12, border: "none", background: "#1E1E24", color: "#fff", fontSize: 14.5, fontWeight: 800, cursor: "pointer", fontFamily: "inherit", display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 7 }}>
              <Icon name="plus" size={16} strokeWidth={2.4} color="#fff" /> הוסף ללו״ז של יום {activeDay}
            </button>
            {/* "מצא לי X באזור" — search around this saved point. */}
            {Number.isFinite(inboxCardMenu.lat) && (
              <button onClick={() => { setNearbyOrigin(inboxCardMenu); setInboxCardMenu(null); }}
                style={{ width: "100%", height: 44, marginTop: 8, borderRadius: 12, border: `1px solid ${T.line}`, background: "#fff", color: T.ink2, fontSize: 13.5, fontWeight: 800, cursor: "pointer", fontFamily: "inherit", display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 7 }}>
                <Icon name="search" size={15} strokeWidth={2} color={T.ink2} /> מצא מקומות באזור
              </button>
            )}
            {/* Open the saved point's real Google Maps listing (place_id/name → pin). */}
            {mapsUrlFor(inboxCardMenu) && (
              <button onClick={() => { const u = mapsUrlFor(inboxCardMenu); if (u) window.open(u, "_blank", "noopener,noreferrer"); }}
                style={{ width: "100%", height: 44, marginTop: 8, borderRadius: 12, border: `1px solid ${T.line}`, background: "#fff", color: T.ink2, fontSize: 13.5, fontWeight: 800, cursor: "pointer", fontFamily: "inherit", display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 7 }}>
                <Icon name="map" size={15} strokeWidth={2} color={T.ink2} /> פתח ב-Google Maps
              </button>
            )}
            <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
              {Number.isFinite(inboxCardMenu.lat) && (
                <button onClick={() => { setFlyToCoord({ lat: inboxCardMenu.lat, lng: inboxCardMenu.lng }); }}
                  style={{ flex: 1, height: 40, borderRadius: 12, border: `1px solid ${T.line}`, background: "#fff", color: T.ink2, fontSize: 12.5, fontWeight: 800, cursor: "pointer", fontFamily: "inherit", display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
                  <Icon name="pin" size={14} strokeWidth={2} color={T.ink2} /> מרכז במפה
                </button>
              )}
              <button onClick={() => { deleteInboxPlace(inboxCardMenu); setInboxCardMenu(null); }}
                style={{ flex: 1, height: 40, borderRadius: 12, border: `1px solid ${T.line}`, background: "#fff", color: T.ink3, fontSize: 12.5, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
                <Icon name="trash" size={14} strokeWidth={2} color={T.ink3} /> מחיקה מהבנק
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Sprint 28 #6 — the floating target-day modal was replaced by the
          per-card instant drop-menu inside the anchored inbox sidebar. */}

      {/* Sprint 21 #3 / 61 #1 — fast note editor (opened from the card pencil OR
          by directly tapping the gray note ticket). */}
      {noteEditIdx >= 0 && activeDayData?.attractions?.[noteEditIdx] && (
        <NoteSheet
          title="הערה על המקום"
          initialValue={activeDayData.attractions[noteEditIdx].note || ""}
          placeholder="הוסיפו הערה אישית למקום…"
          onSave={(t) => saveNoteAt(noteEditIdx, t)}
          onClose={() => setNoteEditIdx(-1)}
        />
      )}

      {/* "מצא לי X באזור" — category picker; picks feed nearbySearch → map pins. */}
      {nearbyOrigin && (
        <NearbySearchSheet
          point={nearbyOrigin}
          onPick={(q) => runNearby(nearbyOrigin, q)}
          onClose={() => setNearbyOrigin(null)}
        />
      )}

      {/* "מפות נוספות" — reference-map overlay + point transfer (bottom sheet). */}
      <ReferenceMapsPanel
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

      {/* Sprint 61 #5 — hidden native file picker (images / PDF) for attachments. */}
      <input ref={attachInputRef} type="file" accept="image/*,application/pdf" style={{ display: "none" }} onChange={onAttachFilePicked} />

      {/* Sprint 65 #1/#2 — IN-APP ATTACHMENT VIEWER. Renders the image/PDF inline
          (blob URLs open reliably in <img>/<iframe> — unlike window.open on
          iOS/Safari) with a high-contrast ✕ close and a 🗑️ remove action. */}
      {attachViewer && attachViewer.file && (() => {
        const f = attachViewer.file;
        const isPdf = /pdf/i.test(f.type || "") || /\.pdf($|\?)/i.test(f.url || "");
        const isImg = /^image\//i.test(f.type || "") || /\.(png|jpe?g|gif|webp|heic|heif)($|\?)/i.test(f.url || "");
        return (
          <div dir="rtl" style={{ position: "fixed", inset: 0, zIndex: 400, display: "flex", flexDirection: "column", background: "rgba(10,12,15,0.92)", fontFamily: T.font, paddingTop: "env(safe-area-inset-top, 0px)", paddingBottom: "env(safe-area-inset-bottom, 0px)" }}>
            <div style={{ flexShrink: 0, display: "flex", alignItems: "center", gap: 10, padding: "12px 14px" }}>
              <span aria-hidden style={{ fontSize: 18 }}>📎</span>
              <div dir="auto" style={{ flex: 1, minWidth: 0, fontSize: 14, fontWeight: 800, color: "#fff", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{f.name || "מסמך מצורף"}</div>
              {attachViewer.idx != null && attachViewer.fi != null && (
                <button onClick={() => { deleteAttachmentAt(attachViewer.idx, attachViewer.fi); setAttachViewer(null); }}
                  title="הסר קובץ" aria-label="הסר קובץ" className="tp-press"
                  style={{ flexShrink: 0, height: 36, padding: "0 12px", borderRadius: 999, border: "none", background: "rgba(255,255,255,0.14)", color: "#fff", cursor: "pointer", fontFamily: "inherit", fontSize: 12.5, fontWeight: 800, display: "inline-flex", alignItems: "center", gap: 5 }}>
                  <span aria-hidden>🗑️</span> הסר קובץ
                </button>
              )}
              <button onClick={() => setAttachViewer(null)} title="סגירה" aria-label="סגירה" className="tp-press"
                style={{ flexShrink: 0, width: 36, height: 36, borderRadius: "50%", border: "none", background: "#fff", color: "#1E1E24", cursor: "pointer", fontFamily: "inherit", fontSize: 16, fontWeight: 800, display: "inline-flex", alignItems: "center", justifyContent: "center" }}>✕</button>
            </div>
            <div style={{ flex: 1, minHeight: 0, display: "flex", alignItems: "center", justifyContent: "center", padding: "0 10px 12px" }}>
              {isImg ? (
                <img src={f.url} alt={f.name || ""} style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain", borderRadius: 10 }} />
              ) : isPdf ? (
                <iframe src={f.url} title={f.name || "מסמך"} style={{ width: "100%", height: "100%", border: "none", borderRadius: 10, background: "#fff" }} />
              ) : (
                <div style={{ textAlign: "center", color: "#fff", padding: 24 }}>
                  <div style={{ fontSize: 40, marginBottom: 10 }}>📄</div>
                  <div style={{ fontSize: 13.5, opacity: 0.85, lineHeight: 1.6 }}>לא ניתן להציג את סוג הקובץ הזה כאן.</div>
                  <a href={f.url} download={f.name || undefined} style={{ display: "inline-block", marginTop: 14, height: 44, lineHeight: "44px", padding: "0 18px", borderRadius: 12, background: "#fff", color: "#1E1E24", fontSize: 14, fontWeight: 800, textDecoration: "none" }}>הורדת הקובץ</a>
                </div>
              )}
            </div>
          </div>
        );
      })()}

      {/* Sprint 65 — TRIP FILES GALLERY sheet: every file in the trip (general +
          per-stop attachments), grouped כללי → יום 1 … יום N. Upload / rename /
          move / delete when the trip is writable; open-only otherwise. */}
      <TripFilesSheet
        open={filesSheetOpen}
        onClose={() => setFilesSheetOpen(false)}
        dark={false}
        tripData={trip?.data?.tripData || []}
        files={tripFiles}
        dayCount={filesDayCount}
        editable={filesEditable}
        busy={filesBusy}
        onUpload={handleFileUpload}
        onRename={handleFileRename}
        onMove={handleFileMove}
        onDelete={handleFileDelete}
      />

      {/* Sprint 61 #1 — DUPLICATE-NOTE CASCADE PROMPT. Shown when a saved note
          targets a place that appears on more than one day. */}
      {notePrompt && (
        <div dir="rtl" style={{ position: "fixed", inset: 0, zIndex: 260, display: "flex", alignItems: "center", justifyContent: "center", padding: 18, fontFamily: T.font }}>
          <div onClick={() => setNotePrompt(null)} className="tp-fade" style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.42)" }} />
          <div className="tp-pop" style={{ position: "relative", width: "100%", maxWidth: 420, background: "#fff", borderRadius: 18, padding: 20, boxShadow: "0 24px 70px rgba(0,0,0,0.4)" }}>
            <div style={{ fontSize: 16, fontWeight: 800, color: T.ink, marginBottom: 6 }}>הערה למקום החוזר במסלול</div>
            <div style={{ fontSize: 13.5, color: T.ink3, lineHeight: 1.6, marginBottom: 16 }}>
              מקום זה מופיע ב־{notePrompt.count} ימים במסלול. האם להחיל את ההערה החדשה על כל הימים או רק על היום הנוכחי?
            </div>
            <button onClick={() => { writeNoteToAllMatching(notePrompt.key, notePrompt.note); setNotePrompt(null); setCopyToast("ההערה עודכנה בכל הימים ✓"); }}
              style={{ width: "100%", height: 48, borderRadius: 12, border: "none", background: "#1E1E24", color: "#fff", fontSize: 14.5, fontWeight: 800, cursor: "pointer", fontFamily: "inherit" }}>
              כל הימים
            </button>
            <button onClick={() => { writeNoteToInstance(notePrompt.index, notePrompt.note); setNotePrompt(null); setCopyToast("ההערה עודכנה ליום זה ✓"); }}
              style={{ width: "100%", height: 46, marginTop: 8, borderRadius: 12, border: `1px solid ${T.line}`, background: "#fff", color: T.ink2, fontSize: 14, fontWeight: 800, cursor: "pointer", fontFamily: "inherit" }}>
              רק על יום זה
            </button>
          </div>
        </div>
      )}

      {/* Sprint 51 #1 — inline quick-add prompt: add an intermediate note or a
          transit segment between two stops. */}
      {insertAt >= 0 && (
        <div dir="rtl" style={{ position: "fixed", inset: 0, zIndex: 250, display: "flex", alignItems: "flex-end", justifyContent: "center", fontFamily: T.font }}>
          <div onClick={() => { setInsertAt(-1); setInsertText(""); }} className="tp-fade" style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.4)" }} />
          <div className="tp-pop" style={{ position: "relative", width: "100%", maxWidth: 460, background: "#fff", borderRadius: "20px 20px 0 0", padding: "14px 16px max(16px, env(safe-area-inset-bottom))", boxShadow: "0 -12px 40px rgba(0,0,0,0.25)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
              <span style={{ fontSize: 15, fontWeight: 800, color: T.ink, flex: 1 }}>הוספה בין תחנות</span>
              <button onClick={() => { setInsertAt(-1); setInsertText(""); }} aria-label="סגירה" style={{ border: "none", background: T.surface, width: 30, height: 30, borderRadius: "50%", cursor: "pointer", color: T.ink3, fontFamily: "inherit" }}>✕</button>
            </div>
            {/* Sprint 52 #2 — 1-tap transit generator: coords inherited from the
                surrounding stops, ZERO mandatory typing. */}
            <div style={{ fontSize: 12, fontWeight: 800, color: T.ink3, marginBottom: 8 }}>מעבר בין התחנות (בחירה מהירה)</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8, marginBottom: 12 }}>
              {[
                { type: "drive", emoji: "🚗", label: "רכב / מונית" },
                { type: "train", emoji: "🚆", label: "רכבת" },
                { type: "flight", emoji: "✈️", label: "טיסה" },
                { type: "bus", emoji: "🚌", label: "אוטובוס" },
              ].map((v) => (
                <button key={v.type} onClick={() => addTransitAt(insertAt, v.type, insertText)}
                  className="tp-press"
                  style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 4, height: 66, borderRadius: 14, border: `1.5px solid ${T.line}`, background: "#fff", cursor: "pointer", fontFamily: "inherit" }}>
                  <span aria-hidden style={{ fontSize: 24, lineHeight: 1 }}>{v.emoji}</span>
                  <span style={{ fontSize: 10.5, fontWeight: 700, color: T.ink2, textAlign: "center", lineHeight: 1.15 }}>{v.label}</span>
                </button>
              ))}
            </div>
            {/* Optional free-text — doubles as the transit note and the inline
                note body (whichever action the user commits). */}
            <div style={{ fontSize: 12, fontWeight: 800, color: T.ink3, marginBottom: 6 }}>הערה למעבר (אופציונלי)</div>
            <textarea
              value={insertText}
              onChange={(e) => setInsertText(e.target.value)}
              placeholder="למשל: טיסה LY802 · רציף 4 · לקנות כרטיסים מראש…"
              rows={2}
              style={{ width: "100%", boxSizing: "border-box", padding: "11px 14px", borderRadius: 14, border: `1.5px solid ${T.line}`, background: "#fff", fontSize: 15, fontFamily: "inherit", color: T.ink, direction: "rtl", textAlign: "right", resize: "vertical", lineHeight: 1.5 }}
            />
            <div aria-hidden style={{ height: 1, background: T.line, margin: "12px 0" }} />
            {/* Secondary path — save the text as a standalone intermediate note. */}
            <button
              onClick={() => addInlineNoteAt(insertAt, insertText)}
              disabled={!insertText.trim()}
              style={{ width: "100%", height: 44, borderRadius: 14, border: `1px solid ${T.line}`, background: "#fff", color: insertText.trim() ? T.ink : T.ink4, fontSize: 14, fontWeight: 800, cursor: insertText.trim() ? "pointer" : "default", fontFamily: "inherit" }}>
              📝 הוספה כהערת ביניים בלבד
            </button>
          </div>
        </div>
      )}

      {/* Sprint 52 #6 — quick-copy micro-toast (auto-dismiss ~1.6s). */}
      {copyToast && (
        <div className="tp-fade" dir="rtl" role="status" aria-live="polite" style={{
          position: "fixed", top: "calc(env(safe-area-inset-top, 0px) + 70px)", left: "50%", transform: "translateX(-50%)",
          zIndex: 260, maxWidth: "min(90vw, 360px)", background: T.ink, color: "#fff",
          borderRadius: 999, padding: "8px 16px", fontFamily: T.font, fontSize: 13, fontWeight: 700,
          boxShadow: "0 8px 24px rgba(0,0,0,0.28)", display: "inline-flex", alignItems: "center", gap: 8,
          whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
        }}>
          <span aria-hidden>✅</span>{copyToast}
        </div>
      )}

      {/* Sprint 65 — Trip Files gallery micro-toast (no icon; used for upload
          failures, so it must never imply success). Auto-dismiss ~2.5s. */}
      {filesToast && (
        <div className="tp-fade" dir="rtl" role="status" aria-live="polite" style={{
          position: "fixed", top: "calc(env(safe-area-inset-top, 0px) + 70px)", left: "50%", transform: "translateX(-50%)",
          zIndex: 260, maxWidth: "min(90vw, 360px)", background: T.ink, color: "#fff",
          borderRadius: 999, padding: "8px 16px", fontFamily: T.font, fontSize: 13, fontWeight: 700,
          boxShadow: "0 8px 24px rgba(0,0,0,0.28)", textAlign: "center",
          whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
        }}>
          {filesToast}
        </div>
      )}

      {/* Quick-actions sheet */}
      {actionsIdx >= 0 && activeDayData?.attractions?.[actionsIdx] && (
        <StopActionsSheet
          stop={activeDayData.attractions[actionsIdx]}
          days={days.map((d) => ({ day: d.day, cityHe: d.cityHe || d.city }))}
          otherTrips={otherTrips}
          onMove={moveStopToDay}
          onCopy={copyStopToDay}
          onCrossCopy={copyStopToOtherTrip}
          onSetNote={setStopNote}
          onSetLodging={setStopAsLodging}
          onSetColor={setStopColorForActions}
          onSetMultiDayHotel={setStopAsMultiDayHotel}
          onMoveNextDay={moveStopToNextDay}
          onSplitDay={splitDayFromStop}
          onCopyName={() => { const s = activeDayData.attractions[actionsIdx]; copyName(s?.nameHe || s?.name); }}
          onDuplicate={() => duplicateStopAt(actionsIdx)}
          onAttach={() => requestAttach(actionsIdx)}
          attachBusy={attachBusy}
          attachmentCount={(activeDayData.attractions[actionsIdx]?.attachments || []).length}
          onRemoveAttachment={() => {
            const list = activeDayData.attractions[actionsIdx]?.attachments || [];
            if (list.length) deleteAttachmentAt(actionsIdx, list.length - 1);
            setActionsIdx(-1);
          }}
          onFindNearby={() => setNearbyOrigin(activeDayData.attractions[actionsIdx])}
          onDelete={deleteStop}
          onClose={() => setActionsIdx(-1)}
        />
      )}

      {!trip && !error && (
        <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: "50vh", background: "#fff", borderTopLeftRadius: 22, borderTopRightRadius: 22, padding: 22 }}>
          <div style={{ height: 52, borderRadius: 16, background: "linear-gradient(90deg,#f0f0ee,#f7f7f5,#f0f0ee)", backgroundSize: "200% 100%", animation: "tpSkeleton 1.2s ease infinite" }} />
        </div>
      )}
      <style>{`
        @keyframes tpSkeleton{0%{background-position:200% 0}100%{background-position:-200% 0}}
        @keyframes tp-pulse{0%{transform:translate(-50%,-50%) scale(0.6);opacity:0.9}70%{transform:translate(-50%,-50%) scale(2.2);opacity:0}100%{opacity:0}}
        /* Sprint 50 #3 — active-mode focus: neon pulsing ring on the live FAB. */
        @keyframes tp-focus-glow{0%,100%{box-shadow:0 6px 20px rgba(0,0,0,0.22),0 0 0 0 rgba(31,166,122,0.55)}50%{box-shadow:0 6px 20px rgba(0,0,0,0.22),0 0 0 9px rgba(31,166,122,0)}}
        .tp-focus-glow{animation:tp-focus-glow 1.4s ease-out infinite;}
        @keyframes tp-banner-in{from{transform:translateY(-100%)}to{transform:translateY(0)}}
        /* Sprint 57 #2 — Places Inbox side-drawer slides in from the RTL-start edge. */
        @keyframes tp-drawer-in{from{transform:translateX(100%);opacity:0.4}to{transform:translateX(0);opacity:1}}
        .tp-drawer-in{animation:tp-drawer-in 0.26s cubic-bezier(0.22,1,0.36,1);}
        /* Sprint 58 #4 — hide the horizontal scrollbar on the inbox chip row. */
        .tp-noscrollbar{scrollbar-width:none;-ms-overflow-style:none;}
        .tp-noscrollbar::-webkit-scrollbar{display:none;}
        .tp-focus-banner{animation:tp-banner-in 0.28s cubic-bezier(0.22,1,0.36,1);}
        /* Sprint 38 #6 — never select/copy-highlight timeline rows/cards on long-press. */
        .tp-noselect, .tp-noselect * { -webkit-user-select:none; -ms-user-select:none; user-select:none; -webkit-touch-callout:none; }
        /* Sprint 38 #1 — day-chip wiggle while a reorder drag is active. */
        @keyframes tp-wiggle{0%{transform:rotate(-1deg)}50%{transform:rotate(1deg)}100%{transform:rotate(-1deg)}}
        .tp-wiggle{animation:tp-wiggle 0.18s ease-in-out infinite;}
        /* Sprint 39 #2 — responsive header: keep the תכנון tab, title and
           summary button on one row on narrow phones without clipping. */
        .tp-ed-header, .tp-ed-header *{box-sizing:border-box;}
        @media (max-width:480px){
          .tp-ed-header{gap:6px !important;padding-left:16px !important;padding-right:16px !important;}
          .tp-ed-title{font-size:12px !important;padding:7px 10px !important;}
          .tp-ed-summary{padding:7px 9px !important;font-size:11px !important;}
          .tp-ed-dates{padding:7px 9px !important;font-size:11px !important;}
          .tp-ed-tabs button{padding:6px 9px !important;font-size:11px !important;}
        }
        @media (max-width:380px){
          /* Ultra-narrow: collapse the date + summary buttons to icon only. */
          .tp-ed-dates-label{display:none !important;}
          .tp-ed-summary-label{display:none !important;}
        }
        /* Sprint 38 #4 — printable Trip Summary (hide app chrome, paginate cleanly). */
        @media print {
          body * { visibility: hidden !important; }
          .tp-summary, .tp-summary * { visibility: visible !important; }
          .tp-summary { position: absolute !important; inset: 0 !important; height: auto !important; overflow: visible !important; background: #fff !important; }
          .tp-summary .tp-no-print { display: none !important; }
          .tp-summary-grid { display: block !important; }
          .tp-summary-card { break-inside: avoid; page-break-inside: avoid; margin-bottom: 12px; box-shadow: none !important; }
        }
      `}</style>
    </div>
  );
};

export default EditorView;
