import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import tripService from "../services/tripService";
import EditorBottomSheet from "../components/EditorBottomSheet";
import EditorMap from "../components/EditorMap";
import AddStopSheet from "../components/AddStopSheet";
import AddTransitSheet from "../components/AddTransitSheet";
import StopActionsSheet from "../components/StopActionsSheet";
import EditorSearchBar from "../components/EditorSearchBar";
import PlaceInfoCard from "../components/PlaceInfoCard";
import NoteSheet from "../components/NoteSheet";
import { computeTransit } from "../utils/transit";
import { dedupeDayStops } from "../utils/classify";
import { readPrefs } from "../services/prefsService";
import { listInboxPlaces, addInboxPlaces, removeInboxPlace } from "../services/googleSavedPlaces";
import useActiveTrip from "../utils/useActiveTrip";
import Icon from "../components/Icon";

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
const CITY_COLOR = {
  Tokyo: "#D04A3E", "Tokyo Disney": "#D04A3E", "Tokyo DisneySea": "#D04A3E",
  Osaka: "#D04A3E", "Osaka Universal": "#D04A3E",
  Hakone: "#5A8C5F", Kanazawa: "#5A8C5F", Kyoto: "#5A8C5F", Takayama: "#5A8C5F",
  Matsumoto: "#5A8C5F", Kawaguchiko: "#4E9E94",
  Nara: "#C09445", Nagoya: "#C09445",
};
const cityColor = (c) => CITY_COLOR[(c || "").replace(/ \d+$/, "")] || T.ink;
const cityAbbr = (c) => (c || "").slice(0, 3).toUpperCase();

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

const DayStopList = ({
  stops, color, onReorder, onOpenActions, editable = true,
  /* Sprint 11 — live field-ops mode (only when this trip is the
     "active"/live trip). Reveals per-stop check-off + rollover. */
  liveOps = false, onToggleComplete, onRollover, onMoveForward, nextDayNum = null,
  /* Sprint 21 — Trip-Mode gated affordances. `tripActive` (the green
     "טיול פעיל" badge state) reveals the per-stop completion checkbox and
     the explicit "העבר ליום הבא" move button. `onEditNote` exposes a
     fast pencil note trigger on every card. `onNavigate` makes tapping a
     card body fly the map to that stop + collapse the sheet. */
  tripActive = false, onEditNote, onNavigate,
  /* Sprint 27 #3 — tapping a transit block opens its edit sheet. */
  onEditTransit,
  /* Sprint 30 — persist an inline commute-mode choice on the origin stop
     of a rail (idx → walk/car/transit/bus). */
  onSetTransitMode,
}) => {
  const [items, setItems] = useState(stops);
  const [dragIdx, setDragIdx] = useState(-1); // position within the SCHEDULE section
  const rowRefs = useRef([]);
  const dragRef = useRef({ active: false });
  const units = readPrefs().units; // km | mi distance labels on rails

  useEffect(() => { setItems(stops); }, [stops]);

  /* ── Sprint 22 #5 — semantic segmentation ──
     The day's flat payload renders as THREE distinct visual blocks:
       a) מהלך היום        — standard places / POIs / custom stops
       b) מעברים ולוגיסטיקה — user-added transit segments (_transit)
       c) עוגן הלינה        — lodging nodes (hotel category / _hotelSpan),
                              anchored in a locked block at the bottom.
     Every row keeps its ORIGINAL index into the day's attractions array
     (`idx`) so all parent callbacks (actions / complete / note / move)
     stay index-correct regardless of presentation grouping. */
  const isTransitNode = (a) => !!a._transit;
  const isLodgingNode = (a) => !a._transit && (!!a._hotelGroup || /מלון|לינה/.test(a.category || ""));
  const withIdx = items.map((a, idx) => ({ a, idx }));
  const scheduleRows = withIdx.filter(({ a }) => !isTransitNode(a) && !isLodgingNode(a));
  const transitRows = withIdx.filter(({ a }) => isTransitNode(a));
  const lodgingRows = withIdx.filter(({ a }) => isLodgingNode(a));

  const onHandleDown = (pos) => (e) => {
    if (!editable) return;
    e.preventDefault();
    e.stopPropagation();
    dragRef.current = { active: true };
    setDragIdx(pos);
    try { e.target.setPointerCapture?.(e.pointerId); } catch { /* noop */ }
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
      /* Reorder WITHIN the schedule section, then recombine the full
         array (schedule → transit → lodging) so the committed order
         matches the segmented presentation. */
      setItems((prev) => {
        const sched = prev.filter((a) => !isTransitNode(a) && !isLodgingNode(a));
        const trans = prev.filter((a) => isTransitNode(a));
        const lodg = prev.filter((a) => isLodgingNode(a));
        const next = sched.slice();
        const [moved] = next.splice(dragIdx, 1);
        next.splice(target, 0, moved);
        return [...next, ...trans, ...lodg];
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
                key={`${a.name}-${idx}`}
                onClick={() => editable && onEditTransit && onEditTransit(idx)}
                title={editable ? "עריכת מעבר" : undefined}
                style={{
                  display: "flex", gap: 12, padding: isFlight ? "12px 0" : "7px 0",
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
                  position: "relative", zIndex: 1, alignSelf: isFlight ? "flex-start" : "center",
                }}>
                  <Icon name={g.icon} size={isFlight ? 15 : 13} strokeWidth={1.9} />
                </div>

                {isFlight ? (
                /* Sprint 27 #2 — prominent flight card: generous padding,
                   larger route/timetable type, wrap-safe layout (nothing
                   overlaps or renders too small), roomy reference chip. */
                <div style={{
                  flex: 1, minWidth: 0, border: `1.5px dashed ${T.accent}55`,
                  borderRadius: 16, background: `${T.accent}08`, padding: "13px 15px",
                  boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
                }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", minWidth: 0 }}>
                    <span style={{ flexShrink: 0, display: "inline-flex", alignItems: "center", gap: 6, fontSize: 11, fontWeight: 800, letterSpacing: "0.04em", textTransform: "uppercase", color: "#fff", background: T.accent, borderRadius: 999, padding: "4px 11px" }}>
                      <Icon name={g.icon} size={12} strokeWidth={2.1} />{g.he}
                    </span>
                    <span style={{ fontSize: 15.5, fontWeight: 800, color: T.ink, direction: "ltr", minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{route}</span>
                  </div>
                  {/* Timetable matrix — departure / arrival */}
                  {(a.departTime || a.arriveTime) && (
                    <div style={{ display: "flex", gap: 22, marginTop: 12, alignItems: "flex-end" }}>
                      <div>
                        <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: "0.06em", textTransform: "uppercase", color: T.ink4, marginBottom: 2 }}>יציאה</div>
                        <div style={{ fontSize: 17, fontWeight: 800, color: T.ink, fontVariantNumeric: "tabular-nums", direction: "ltr", lineHeight: 1 }}>{a.departTime || "—"}</div>
                      </div>
                      <div style={{ alignSelf: "center", color: `${T.accent}99`, display: "inline-flex" }}>
                        <Icon name="chevronEnd" size={15} strokeWidth={2.2} />
                      </div>
                      <div>
                        <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: "0.06em", textTransform: "uppercase", color: T.ink4, marginBottom: 2 }}>הגעה</div>
                        <div style={{ fontSize: 17, fontWeight: 800, color: T.ink, fontVariantNumeric: "tabular-nums", direction: "ltr", lineHeight: 1 }}>{a.arriveTime || "—"}</div>
                      </div>
                    </div>
                  )}
                  {/* Reference id (flight / seat) — roomy, never cramped */}
                  {a.refId && (
                    <div style={{ display: "inline-flex", alignItems: "center", gap: 6, marginTop: 11, fontSize: 12.5, fontWeight: 700, color: T.ink2, background: "#fff", border: `1px solid ${T.line}`, borderRadius: 999, padding: "5px 12px", direction: "ltr" }}>
                      <Icon name="plane" size={12} strokeWidth={1.9} color={T.ink4} />{a.refId}
                    </div>
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
                  <div style={{ alignSelf: "center", display: "flex", alignItems: "center" }}>
                    <button
                      onClick={(e) => { e.stopPropagation(); onOpenActions && onOpenActions(idx); }}
                      title="פעולות" aria-label="פעולות"
                      style={{ width: 30, height: 32, border: "none", background: "transparent", color: T.ink4, cursor: "pointer", fontFamily: "inherit", display: "inline-flex", alignItems: "center", justifyContent: "center" }}
                    >
                      <Icon name="more" size={16} strokeWidth={1.6} />
                    </button>
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
        const note = a.note || a.annotation || a.quote; // personal logbook line
        /* Sprint 18.4 — multi-night hotel continuity. A stop stamped with
           `_hotelGroup` is part of a multi-day stay; `_hotelSpan` carries
           {from, to, total}. We draw a slim accent edge bracket on the
           inline-start of the row plus a "X לילות" badge. */
        const hotelSpan = a._hotelGroup ? a._hotelSpan : null;
        const dragging = pos != null && dragIdx === pos;
        return (
          <div
            ref={(el) => { if (pos != null) rowRefs.current[pos] = el; }}
            style={{
              display: "flex", gap: 12, padding: "10px 0",
              paddingInlineStart: hotelSpan ? 10 : 0,
              borderBottom: dragging ? "none" : `1px solid ${T.line}`,
              background: dragging ? "#fff" : (done ? "rgba(20,20,20,0.035)" : "transparent"),
              borderRadius: dragging ? 14 : (done ? 12 : 0),
              transform: dragging ? "scale(1.025)" : "scale(1)",
              boxShadow: dragging ? "0 8px 28px rgba(0,0,0,0.13), 0 2px 6px rgba(0,0,0,0.06)" : "none",
              zIndex: dragging ? 2 : "auto",
              position: "relative",
              transition: dragging ? "none" : "transform 0.2s ease, box-shadow 0.2s ease, background 0.25s ease",
            }}
          >
            {/* Multi-night hotel continuity bracket (inline-start edge). */}
            {hotelSpan && (
              <span aria-hidden style={{ position: "absolute", insetInlineStart: 0, top: 6, bottom: 6, width: 4, borderRadius: 999, background: T.accent, opacity: 0.85 }} />
            )}
            <div style={{
              width: 30, height: 30, borderRadius: "50%", flexShrink: 0,
              background: done ? T.ink4 : color, color: "#fff", display: "flex", alignItems: "center",
              justifyContent: "center", fontSize: 13, fontWeight: 800,
              position: "relative", zIndex: 1,
              transition: "background 0.25s ease",
            }}>{lodging ? "🏨" : pos + 1}</div>
            <div
              onClick={() => canNavigate && onNavigate(a)}
              title={canNavigate ? "מעבר למיקום על המפה" : undefined}
              style={{ flex: 1, minWidth: 0, opacity: done ? 0.5 : 1, transition: "opacity 0.25s ease", cursor: canNavigate ? "pointer" : "default" }}
            >
              <div style={{
                fontSize: 15, fontWeight: 700, color: T.ink, direction: "ltr", textAlign: "right",
                textDecoration: done ? "line-through" : "none",
                textDecorationColor: done ? T.ink4 : "transparent",
                textDecorationThickness: 1.5,
                transition: "text-decoration-color 0.25s ease",
              }}>{a.name}</div>
              {a.nameHe && a.nameHe !== a.name && (
                <div style={{ fontSize: 12, color: T.ink3, marginTop: 1, textDecoration: done ? "line-through" : "none" }}>{a.nameHe}</div>
              )}
              {a.category && (
                <div style={{ display: "inline-block", marginTop: 6, fontSize: 11, fontWeight: 600, color, background: `${color}14`, border: `1px solid ${color}30`, borderRadius: 999, padding: "2px 9px" }}>
                  {a.category}{a.rating ? ` · ${a.rating}` : ""}
                </div>
              )}
              {/* Multi-night stay continuity badge. */}
              {hotelSpan && (
                <div style={{ display: "inline-flex", alignItems: "center", gap: 5, marginTop: 6, marginInlineStart: 6, fontSize: 11, fontWeight: 800, color: T.accent, background: `${T.accent}12`, border: `1px solid ${T.accent}40`, borderRadius: 999, padding: "2px 9px", direction: "rtl" }}>
                  🏨 {hotelSpan.total} לילות · ימים {hotelSpan.from}–{hotelSpan.to}
                </div>
              )}
              {/* Sprint 31 #2 — official Google editorial snippet, rendered
                  directly below the title as clean muted secondary text.
                  Distinct element from the user's note (below) — the note
                  is never overwritten. */}
              {(a.description || a.editorial_summary || a.snippet) && (
                <div style={{
                  marginTop: 5, fontFamily: T.font,
                  fontSize: 12.5, lineHeight: 1.45, fontWeight: 500, color: T.ink3,
                  direction: "rtl",
                }}>
                  {a.description || a.editorial_summary || a.snippet}
                </div>
              )}
              {/* Personal logbook footnote — inherits the same modern
                  sans-serif family + color hierarchy as the location text
                  (Sprint 20 #2b: no more cursive/italic serif). */}
              {/* Sprint 27 #2 — note typography now mirrors the location
                  heading styling: identical family, ink color and a solid
                  weight (one size down for hierarchy). */}
              {note && (
                <div style={{
                  marginTop: 6, fontFamily: T.font,
                  fontSize: 13.5, lineHeight: 1.5, fontWeight: 600, color: T.ink,
                  direction: "rtl",
                }}>
                  {note}
                </div>
              )}
              {/* Sprint 28 #2 — enriched metadata: official Google Places
                  fields (address / rating) rendered BENEATH the user's own
                  note in a clearly-muted secondary block — smaller size,
                  lighter ink — never replacing or dropping the note. */}
              {(a.address || a.formatted_address) && (
                <div style={{
                  marginTop: note ? 3 : 6, display: "flex", alignItems: "flex-start", gap: 4,
                  fontSize: 11.5, lineHeight: 1.45, fontWeight: 500, color: T.ink4,
                  direction: "rtl",
                }}>
                  <span style={{ marginTop: 1, flexShrink: 0, display: "inline-flex" }}><Icon name="pin" size={10.5} strokeWidth={1.8} /></span>
                  <span>{a.address || a.formatted_address}{!a.category && a.rating ? ` · ★ ${a.rating}` : ""}</span>
                </div>
              )}
              {/* Sprint 21 #2 — Trip-Mode "Move Day Forward". Replaces the old
                  `+1d` chip with a clean, explicit Hebrew text button; only
                  rendered while the trip is in active Trip Mode. */}
              {tripActive && !done && onMoveForward && (
                <div style={{ marginTop: 8 }}>
                  <button
                    onClick={(e) => { e.stopPropagation(); onMoveForward(idx); }}
                    style={{ border: `1px solid ${T.line}`, background: "#fff", padding: "6px 12px", borderRadius: 999, cursor: "pointer", fontFamily: "inherit", fontSize: 12.5, fontWeight: 700, color: T.ink2, display: "inline-flex", alignItems: "center", gap: 5 }}
                  >
                    <Icon name="chevronEnd" size={13} strokeWidth={2.2} /> העבר ליום הבא
                  </button>
                </div>
              )}
              {/* Rollover link — incomplete stop on a live day that
                  still has a "tomorrow" to push the stop into. Suppressed in
                  Trip Mode where the explicit move button above takes over. */}
              {liveOps && !tripActive && !done && nextDayNum != null && (
                <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 8 }}>
                  <button
                    onClick={(e) => { e.stopPropagation(); onRollover && onRollover(idx, nextDayNum); }}
                    style={{ border: "none", background: "transparent", padding: 0, cursor: "pointer", fontFamily: "inherit", fontSize: 12, fontWeight: 700, color: T.accent, display: "inline-flex", alignItems: "center", gap: 4 }}
                  >
                    <Icon name="chevronEnd" size={13} strokeWidth={2.2} /> העבירו ליום המחרת
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); onOpenActions && onOpenActions(idx); }}
                    style={{ border: "none", background: "transparent", padding: 0, cursor: "pointer", fontFamily: "inherit", fontSize: 12, fontWeight: 600, color: T.ink3 }}
                  >
                    ליום אחר
                  </button>
                </div>
              )}
            </div>
            {/* Location-level completion checkbox — Trip Mode (or live
                field-ops) only. Tapping toggles the visited state, which
                dims this card's content (handled above via `done`). */}
            {showCompletion && (
              <button
                onClick={(e) => { e.stopPropagation(); onToggleComplete && onToggleComplete(idx); }}
                title={done ? "בטלו סימון ביקור" : "סמנו כבוצע"}
                aria-label={done ? "בטלו סימון ביקור" : "סמנו כבוצע"}
                aria-pressed={done}
                style={{
                  alignSelf: "center", flexShrink: 0, width: 26, height: 26, borderRadius: "50%",
                  border: `1.5px solid ${done ? "#1FA67A" : T.ink4}`,
                  background: done ? "#1FA67A" : "transparent",
                  color: "#fff", cursor: "pointer", display: "inline-flex",
                  alignItems: "center", justifyContent: "center", padding: 0,
                  transition: "background 0.2s ease, border-color 0.2s ease",
                }}
              >
                {done && <Icon name="check" size={15} strokeWidth={2.6} />}
              </button>
            )}
            {/* Drag handle + 3-dot actions — hidden in trip (read) mode */}
            {editable && (
              <div style={{ alignSelf: "center", display: "flex", alignItems: "center" }}>
                {/* Sprint 21 #3 — fast note access: a pencil trigger right on
                    the card face, opening the note input immediately (no longer
                    buried in the 3-dots menu). */}
                {onEditNote && (
                  <button
                    onClick={(e) => { e.stopPropagation(); onEditNote(idx); }}
                    title={note ? "עריכת הערה" : "הוספת הערה"}
                    aria-label={note ? "עריכת הערה" : "הוספת הערה"}
                    style={{ width: 30, height: 32, border: "none", background: "transparent", color: note ? T.accent : T.ink4, cursor: "pointer", fontFamily: "inherit", display: "inline-flex", alignItems: "center", justifyContent: "center" }}
                  >
                    <Icon name="edit" size={15} strokeWidth={1.9} />
                  </button>
                )}
                <button
                  onClick={(e) => { e.stopPropagation(); onOpenActions && onOpenActions(idx); }}
                  title="פעולות"
                  aria-label="פעולות"
                  style={{ width: 30, height: 32, border: "none", background: "transparent", color: T.ink4, cursor: "pointer", fontFamily: "inherit", display: "inline-flex", alignItems: "center", justifyContent: "center" }}
                >
                  <Icon name="more" size={16} strokeWidth={1.6} />
                </button>
                {/* Drag handle — schedule rows only; the lodging anchor
                    block is locked (its position is semantic, not sorted). */}
                {!lodging && pos != null && (
                  <button
                    onPointerDown={onHandleDown(pos)}
                    title="גררו לסידור מחדש"
                    style={{ width: 30, height: 32, border: "none", background: "transparent", color: T.ink4, cursor: "grab", touchAction: "none", fontSize: 16, fontFamily: "inherit" }}
                  >
                    ≡
                  </button>
                )}
              </div>
            )}
          </div>
        );
  };

  /* ── Sprint 22 #5 — the three semantic timeline blocks ── */
  return (
    <div onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}>
      {/* a) מהלך היום — the day's schedule of places */}
      {scheduleRows.length > 0 && (
        <>
          {sectionHeader("מהלך היום")}
          <div style={{ position: "relative" }}>
            {/* Central timeline spine — a continuous hairline that passes
                mathematically through the centre of every numbered disc
                (disc = 30px wide → centre is 15px from the RTL start edge,
                so a 2px line at insetInlineEnd:14px is dead-centred). */}
            {scheduleRows.length > 1 && (
              <div aria-hidden style={{
                position: "absolute", insetInlineEnd: 14, top: 25, bottom: 46,
                width: 2, background: `${color}33`, borderRadius: 2, zIndex: 0,
              }} />
            )}
            {scheduleRows.map(({ a, idx }, pos) => (
              <React.Fragment key={`${a.name}-${idx}`}>
                {renderPlaceRow(a, idx, pos)}
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
            ))}
          </div>
        </>
      )}

      {/* b) Sprint 30 — MACRO structural transits only: flights & long
          cross-city legs added via the explicit "+" button. Inner-city
          commuting is handled implicitly by the inline rails above, so
          this section never appears for regular inner-city stops. */}
      {transitRows.length > 0 && (
        <>
          {sectionHeader("טיסות ומעברים בין ערים")}
          {transitRows.map(({ a, idx }) => renderTransitRow(a, idx))}
        </>
      )}

      {/* c) עוגן הלינה — the night's accommodation, visually anchored in
          a distinct locked block at the bottom of the day card. */}
      {lodgingRows.length > 0 && (
        <>
          {sectionHeader("עוגן הלינה")}
          <div style={{ border: `1.5px solid ${T.line}`, borderRadius: 16, background: T.surface, padding: "2px 12px", marginBottom: 4 }}>
            {lodgingRows.map(({ a, idx }) => (
              <React.Fragment key={`${a.name}-${idx}`}>{renderPlaceRow(a, idx, null, true)}</React.Fragment>
            ))}
          </div>
        </>
      )}
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
  const [inboxFilterOpen, setInboxFilterOpen] = useState(false);
  const [isPinning, setIsPinning] = useState(false);
  /* Sprint 15.6 — Map Lock: freezes user pan/zoom on the canvas while
     programmatic flyTo (preview / day-fit) keeps working. */
  const [mapLocked, setMapLocked] = useState(false);
  const [pendingCoord, setPendingCoord] = useState(null);
  const [showAddStop, setShowAddStop] = useState(false);
  const [showAddTransit, setShowAddTransit] = useState(false); // transit segment sheet
  const [actionsIdx, setActionsIdx] = useState(-1);
  /* Sprint 18.1 — other owned, editable trips the user can copy a stop
     into (cross-trip location copying). Read-only example maps are
     excluded since saveTrip rejects them. */
  const [otherTrips, setOtherTrips] = useState([]);
  const sheetRef = useRef(null);
  const dayStripRef = useRef(null);
  /* Dual-state bottom sheet (Sprint 19b.4): track the sheet's snap so the
     map omnibox + schedule collapse together. "peek" = collapsed (only the
     day chips float over a fully-open map); half/full = expanded. */
  const [sheetSnap, setSheetSnap] = useState("half");
  const sheetCollapsed = sheetSnap === "peek";

  /* Sprint 7 — Places preview state */
  const [previewPlace, setPreviewPlace]   = useState(null); // raw getDetails() result
  const [flyToCoord,   setFlyToCoord]     = useState(null); // { lat, lng }
  /* Sprint 21 #3 — index of the active-day stop whose note is being edited
     in the quick NoteSheet (-1 = closed). */
  const [noteEditIdx, setNoteEditIdx]     = useState(-1);

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
    sheetRef.current?.snapTo?.("half");
  }, [trip, activeDay, commitDays]);

  const handleReorder = useCallback((newStops) => {
    commitDays((days) => days.map((d) => d.day === activeDay ? { ...d, attractions: newStops } : d));
  }, [activeDay, commitDays]);

  /* Sprint 21 #4 — list→map link. Tapping a stop card flies the map to its
     coordinates and collapses the sheet to peek so the pin is fully visible. */
  const navigateToStop = useCallback((stop) => {
    const c = stop?.coordinates;
    if (!c || !Number.isFinite(c.lat) || !Number.isFinite(c.lng)) return;
    setFlyToCoord({ lat: c.lat, lng: c.lng });
    sheetRef.current?.snapTo?.("peek");
  }, []);

  /* Sprint 34 — ASSIGN an unassigned inbox place to a day (single-home
     model): the stop moves INTO the day AND leaves the unassigned pile,
     so the unified inbox shows it once — now with a "✓ שובץ במסלול (יום X)"
     badge instead of the assign CTA. */
  const assignInboxPlace = useCallback((p, dayNum) => {
    if (!p || !dayNum) return;
    const stop = {
      name: p.name, nameHe: p.nameHe, category: p.category, rating: p.rating,
      note: p.note, coordinates: { lat: p.lat, lng: p.lng },
    };
    commitDays((days) => days.map((d) =>
      d.day === dayNum ? { ...d, attractions: dedupeDayStops([...d.attractions, stop]) } : d
    ));
    setInboxPlaces((prev) => (prev || []).filter((x) => x.id !== p.id));
    removeInboxPlace(p.id);
  }, [commitDays]);

  /* Sprint 34 — UNASSIGN a day stop back to the generic pile: remove it
     from the day (disappears from the timeline) and add it to the
     unassigned inbox, where its badge reverts to "📅 שבץ במסלול". */
  const unassignToInbox = useCallback((dayNum, idxInDay) => {
    /* Read the stop from CURRENT state synchronously (the commitDays
       updater runs later, so we can't capture it from inside). */
    const day = (trip?.data?.tripData || []).find((d) => d.day === dayNum);
    const moved = day?.attractions?.[idxInDay];
    if (!moved) return;
    commitDays((days) => days.map((d) =>
      d.day === dayNum ? { ...d, attractions: d.attractions.filter((_, i) => i !== idxInDay) } : d
    ));
    if (moved.coordinates && Number.isFinite(moved.coordinates.lat)) {
      addInboxPlaces([{
        name: moved.name, nameHe: moved.nameHe || moved.name,
        category: moved.category || "אטרקציה", rating: moved.rating || "",
        note: moved.note, lat: moved.coordinates.lat, lng: moved.coordinates.lng,
        source: "unassigned",
      }]).then((saved) => setInboxPlaces((prev) => ([...saved, ...(prev || [])]))).catch(() => {});
    }
  }, [trip, commitDays]);

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
      }]);
      setInboxPlaces((prev) => (prev ? [...saved, ...prev] : prev));
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

  /* Sprint 21 #3 — persist a note on the active-day stop at `index`
     (driven by the fast pencil trigger + NoteSheet). */
  const saveNoteAt = useCallback((index, text) => {
    const note = (text || "").trim();
    commitDays((days) => days.map((d) =>
      d.day === activeDay
        ? { ...d, attractions: d.attractions.map((a, i) => i === index ? { ...a, note: note || undefined } : a) }
        : d
    ));
    setNoteEditIdx(-1);
  }, [activeDay, commitDays]);

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

  const setStopAsLodging = useCallback(() => {
    commitDays((days) => days.map((d) => {
      if (d.day !== activeDay) return d;
      const list = [...d.attractions];
      const [stop] = list.splice(actionsIdx, 1);
      if (stop) { stop.category = "מלון"; list.push(stop); } /* move to bottom */
      return { ...d, attractions: list };
    }));
    setActionsIdx(-1);
  }, [activeDay, actionsIdx, commitDays]);

  const deleteStop = useCallback(() => {
    commitDays((days) => days.map((d) =>
      d.day === activeDay ? { ...d, attractions: d.attractions.filter((_, i) => i !== actionsIdx) } : d
    ));
    setActionsIdx(-1);
  }, [activeDay, actionsIdx, commitDays]);

  /* Sprint 18.4 — multi-day hotel: reclassify the active stop as a
     lodging node and stamp a copy of it onto every chosen day. A shared
     `_hotelGroup` id ties the copies together so the timeline can draw a
     continuity bracket marking a multi-night stay. */
  const setStopAsMultiDayHotel = useCallback((dayNums) => {
    const chosen = Array.from(new Set([activeDay, ...(dayNums || [])])).sort((a, b) => a - b);
    const base = (trip?.data?.tripData || []).find((d) => d.day === activeDay)?.attractions?.[actionsIdx];
    if (!base) { setActionsIdx(-1); return; }
    const groupId = `hotel-${Date.now()}`;
    const span = { from: chosen[0], to: chosen[chosen.length - 1], total: chosen.length };
    commitDays((days) => days.map((d) => {
      if (!chosen.includes(d.day)) return d;
      const node = { ...base, category: "מלון", _hotelGroup: groupId, _hotelSpan: span };
      if (d.day === activeDay) {
        /* Replace the original in-place (keep its position). */
        const list = d.attractions.map((a, i) => (i === actionsIdx ? node : a));
        return { ...d, attractions: list };
      }
      return { ...d, attractions: dedupeDayStops([...d.attractions, node]) };
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

  const days = useMemo(() => trip?.data?.tripData ?? [], [trip]);

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
  const activeDayData = useMemo(
    () => days.find((d) => d.day === activeDay) || null,
    [days, activeDay]
  );

  const selectDay = (n) => {
    setActiveDay(n);
    sheetRef.current?.snapTo?.("half");
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
    () => (activeDayData?.attractions ?? []).filter((s) => !s._transit),
    [activeDayData]
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

  return (
    <div dir="rtl" style={{ height: "100vh", overflow: "hidden", position: "relative", fontFamily: T.font, background: "#E9EBEC" }}>
      {/* Real keyless MapLibre canvas */}
      <div style={{ position: "absolute", inset: 0 }}>
        <EditorMap
          stops={mapStops}
          color={cityColor(activeDayData?.city)}
          isPinning={isPinning}
          center={trip?.center || trip?.settings?.center || null}
          pendingPin={pendingCoord}
          onMapPick={(coord) => { setPendingCoord(coord); setIsPinning(false); setShowAddStop(true); }}
          previewPin={previewPlace?.lat != null ? { lat: previewPlace.lat, lng: previewPlace.lng } : null}
          flyToCoord={flyToCoord}
          locked={mapLocked}
          savedPlaces={inboxMode && inboxPlaces ? inboxPlaces : []}
          onSaveCustomPin={editable ? handleSaveCustomPin : undefined}
          days={days.map((d) => ({ day: d.day, cityHe: d.cityHe, city: d.city }))}
          hasTransit={editable && (activeDayData?.attractions || []).some((a) => a._transit)}
          onEditTransit={() => {
            const i = (activeDayData?.attractions || []).findIndex((a) => a._transit);
            if (i >= 0) setEditTransitIdx(i);
          }}
        />
      </div>

      {/* Map Lock toggle — restores a dedicated "נעילת מפה" control that
          dynamically freezes/restores the viewport pan & zoom.
          Sprint 18.6: lifted into the top header row (insetInlineEnd) so it
          sits cleanly ABOVE the absolute search-bar omnibox wrapper (top:64)
          and never overlaps the autocomplete results that drop below it. */}
      {trip && !isPinning && (
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
            position: "absolute", top: 72, insetInlineEnd: 16, zIndex: 29,
            display: "inline-flex", alignItems: "center", justifyContent: "center",
            width: 40, height: 40, padding: 0, borderRadius: 999,
            border: `1.5px solid ${mapLocked ? T.accent : T.line}`,
            background: mapLocked ? T.accent : "#fff",
            color: mapLocked ? "#fff" : T.ink2,
            fontSize: 16, lineHeight: 1, cursor: "pointer", fontFamily: "inherit",
            boxShadow: "0 2px 8px rgba(0,0,0,0.10)",
            transition: "background 0.2s ease, color 0.2s ease, border-color 0.2s ease",
          }}
        >
          <span aria-hidden style={{ fontSize: 16 }}>{mapLocked ? "🔒" : "🔓"}</span>
        </button>
      )}

      {/* Pinning-mode banner (replaces the search bar while pinning) */}
      {isPinning ? (
        <div style={{ position: "absolute", top: 64, insetInlineStart: 16, insetInlineEnd: 16, zIndex: 45, background: T.ink, color: "#fff", borderRadius: 12, padding: "10px 14px", fontSize: 13, textAlign: "center" }}>
          לחצו על המפה כדי לנעוץ סיכה · <button onClick={() => setIsPinning(false)} style={{ background: "none", border: "none", color: "#fff", textDecoration: "underline", cursor: "pointer", fontFamily: "inherit", fontSize: 13 }}>ביטול</button>
        </div>
      ) : (
        /* Sprint 27 #5 — search quick-adds are INTERCEPTED: instead of a
           silent drop into the active day, a routing prompt offers the
           generic Places Inbox or an explicit day. */
        trip && editable && !sheetCollapsed && <EditorSearchBar onAddStop={(stop) => setPendingStop(stop)} onPreview={handlePreview} activeDay={activeDay} />
      )}

      {/* Top bar — exit + trip title */}
      <header style={{
        position: "absolute", top: 0, insetInlineStart: 0, insetInlineEnd: 0, zIndex: 40,
        display: "flex", alignItems: "center", gap: 8, padding: "12px 16px",
      }}>
        {/* Sprint 26 #1 — workspace exit: a clear Home affordance that
            opens a confirmation modal instead of routing instantly. */}
        <button onClick={() => setConfirmExit(true)} title="יציאה למסך הראשי" aria-label="יציאה למסך הראשי"
          style={{ width: 40, height: 40, borderRadius: "50%", border: `1px solid ${T.line}`, background: "#fff", cursor: "pointer", fontFamily: "inherit", boxShadow: "0 2px 8px rgba(0,0,0,0.08)", color: T.ink, display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
          <Icon name="home" size={17} strokeWidth={1.9} />
        </button>
        {trip && (
          <div style={{ background: "#fff", borderRadius: 999, padding: "8px 14px", boxShadow: "0 2px 8px rgba(0,0,0,0.08)", fontSize: 14, fontWeight: 800, color: T.ink, display: "flex", alignItems: "center", gap: 8, flexShrink: 0, whiteSpace: "nowrap" }}>
            <span>{trip.title}{trip.days ? ` · ${trip.days} ימים` : ""}</span>
            {saving && <span style={{ fontSize: 11, fontWeight: 600, color: T.ink3 }}>נשמר…</span>}
          </div>
        )}

        {/* Sprint 22 #6 — triple-segmented view-state controller:
            תכנון (PLAN) · רשימת נקודות (INBOX) · טיול (GO).
            Sits at the RTL end (left) so it never crowds the title. */}
        {trip && (
          <div style={{ marginInlineStart: "auto", display: "flex", background: "#fff", borderRadius: 999, padding: 3, boxShadow: "0 2px 8px rgba(0,0,0,0.08)", gap: 2 }}>
            {[
              { id: "design", label: "תכנון", title: "מצב תכנון — עריכה מלאה של המסלול" },
              { id: "inbox", label: "רשימת נקודות", title: "ניהול נקודות שמורות — שיבוץ למסלול" },
            ].map((m) => {
              const on = mode === m.id;
              return (
                <button key={m.id} onClick={() => {
                    setMode(m.id);
                    /* Entering the inbox opens the map wide (peek) so the
                       neutral saved-place markers are fully visible. */
                    if (m.id === "inbox") sheetRef.current?.snapTo?.("peek");
                  }}
                  title={m.title}
                  aria-pressed={on}
                  style={{
                    border: "none", borderRadius: 999, padding: "6px 12px", cursor: "pointer",
                    fontFamily: "inherit", fontSize: 12, fontWeight: 700, whiteSpace: "nowrap",
                    background: on ? T.ink : "transparent", color: on ? "#fff" : T.ink3,
                    transition: "background 0.2s ease, color 0.2s ease",
                  }}>
                  {m.label}
                </button>
              );
            })}
          </div>
        )}

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
          onSnapChange={setSheetSnap}
          header={
            <div style={{ padding: "0 16px 12px" }}>
              {/* Day strip + collapse/expand toggle (dual-state control).
                  Collapsed → only the day chips float over the open map;
                  expanded → full schedule + the map search omnibox. */}
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              {days.length > 0 ? (
                <div ref={dayStripRef} style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 4, direction: "rtl", flex: 1, minWidth: 0 }} className="scrollbar-hide">
                  {days.map((d) => {
                    const col = cityColor(d.city);
                    const on = d.day === activeDay;
                    const dayDone = !!d._dayDone;
                    return (
                      <button key={d.day} onClick={() => selectDay(d.day)}
                        style={{
                          flexShrink: 0, position: "relative", width: 52, height: 52, borderRadius: "50%",
                          border: `1.5px solid ${on ? "transparent" : col + "55"}`,
                          background: on ? col : "transparent", color: on ? "#fff" : col,
                          cursor: "pointer", display: "flex", flexDirection: "column",
                          alignItems: "center", justifyContent: "center", fontFamily: "inherit", lineHeight: 1.05,
                          opacity: dayDone && !on ? 0.55 : 1,
                        }}>
                        <span style={{ fontSize: 16, fontWeight: 800 }}>{d.day}</span>
                        <span style={{ fontSize: 8, fontWeight: 600, opacity: 0.85 }}>{cityAbbr(d.city)}</span>
                        {/* Completed-day indicator (Sprint 20 #5c) */}
                        {dayDone && (
                          <span aria-hidden style={{
                            position: "absolute", top: -2, insetInlineEnd: -2,
                            width: 18, height: 18, borderRadius: "50%",
                            background: "#1FA67A", border: "2px solid #fff", color: "#fff",
                            display: "inline-flex", alignItems: "center", justifyContent: "center",
                          }}>
                            <Icon name="check" size={10} strokeWidth={3} />
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div style={{ fontSize: 13, color: T.ink3, padding: "4px 0", flex: 1 }}>מסלול חדש — עדיין אין ימים</div>
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
                    {g.items.map((a, i) => (
                      <div key={`${a.name}-${i}`} style={{ display: "flex", gap: 12, padding: "9px 0", borderBottom: `1px solid ${T.line}` }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 14.5, fontWeight: 700, color: T.ink, direction: "ltr", textAlign: "right" }}>{a.name}</div>
                          {a.nameHe && a.nameHe !== a.name && <div style={{ fontSize: 12, color: T.ink3 }}>{a.nameHe}</div>}
                          <div style={{ fontSize: 11, color: T.ink4, marginTop: 2 }}>יום {a._day}{a.category ? ` · ${a.category}` : ""}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                ))
              ) : (
                <div style={{ textAlign: "center", color: T.ink3, padding: "32px 0", fontSize: 13.5 }}>אין תוצאות בקטגוריה זו</div>
              )
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
                    <div style={{ display: "flex", alignItems: "baseline", gap: 8, opacity: activeDayData._dayDone ? 0.55 : 1, transition: "opacity 0.25s ease" }}>
                      <span style={{ fontSize: 22, fontWeight: 800, letterSpacing: "-0.02em", color: cityColor(activeDayData.city) }}>
                        {activeDayData.cityHe || activeDayData.city}
                      </span>
                      <span style={{ fontSize: 13, color: T.ink3 }}>יום {activeDayData.day}</span>
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
                    onEditNote={(i) => setNoteEditIdx(i)}
                    onNavigate={navigateToStop}
                    onEditTransit={(i) => setEditTransitIdx(i)}
                    onSetTransitMode={setTransitMode}
                    nextDayNum={nextDayNum}
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

                {/* Sprint 22 #4 — global skeleton-edit trigger: re-enter the
                    wizard against THIS trip to mutate city order / day
                    allocation; inner-day place nodes are preserved by
                    tripService.applySkeleton. */}
                {editable && (
                  <button
                    onClick={() => navigate(`/create?edit=${trip.id}`)}
                    style={{
                      marginTop: 10, width: "100%", padding: 12, borderRadius: 16,
                      border: `1px solid ${T.line}`, background: T.surface,
                      color: T.ink2, fontSize: 13.5, fontWeight: 700, cursor: "pointer",
                      fontFamily: "inherit", display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                    }}
                  >
                    🔧 עריכת שלד הטיול
                  </button>
                )}
              </>
            )}
          </div>
        </EditorBottomSheet>
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
          onClose={() => { setPreviewPlace(null); setFlyToCoord(null); sheetRef.current?.snapTo?.("half"); }}
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

      {/* Sprint 22 #7 — Saved-Places INBOX drawer ("רשימת נקודות"). A side
          panel over the map hosting the mock Google Saved Places list:
          connect CTA → fetch → neutral map markers + per-item placement. */}
      {trip && inboxMode && (
        /* Sprint 28 #6 — the inbox is no longer a floating overlay: it is
           ANCHORED as a full-height right-sidebar panel (inline-start =
           right in RTL), toggled by the רשימת נקודות tab. */
        <aside dir="rtl" className="tp-fade" style={{
          position: "absolute", top: 64, bottom: 0, insetInlineStart: 0,
          width: "min(82vw, 330px)", zIndex: 33, display: "flex", flexDirection: "column",
          background: "#fff", borderRadius: "18px 0 0 0",
          boxShadow: "-12px 0 40px rgba(0,0,0,0.14)",
          borderInlineEnd: `1px solid ${T.line}`, overflow: "hidden",
        }}>
          <div style={{ padding: "14px 16px 10px", borderBottom: `1px solid ${T.line}`, display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 15, fontWeight: 800, color: T.ink, flex: 1 }}>בנק הנקודות</span>
            {/* Sprint 34 — count = unassigned / all stops of this trip. */}
            <span title="נקודות שטרם שובצו" style={{ fontSize: 11, fontWeight: 800, color: T.ink3, background: T.surface, borderRadius: 999, padding: "2px 9px", fontVariantNumeric: "tabular-nums" }}>
              {unifiedStops.filter((s) => s.assignedDay == null).length}/{unifiedStops.length}
            </span>
          </div>
          {/* Collapsible category filter for triaging the stops. */}
          {unifiedStops.length > 0 && (
            <div style={{ padding: "10px 14px 4px" }}>
              <CollapsibleFilter
                open={inboxFilterOpen}
                onToggle={() => setInboxFilterOpen((v) => !v)}
                value={inboxFilter}
                onChange={setInboxFilter}
                label="סינון נקודות"
              />
            </div>
          )}
          <div style={{ flex: 1, overflowY: "auto", padding: "12px 14px" }}>
            {unifiedStops.length === 0 ? (
              /* Sprint 29 #3 — clean minimalist empty state. */
              <div style={{ textAlign: "center", padding: "40px 18px", display: "flex", flexDirection: "column", alignItems: "center", gap: 14 }}>
                <div style={{ width: 60, height: 60, borderRadius: "50%", background: T.surface, color: T.ink4, display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 26 }}>🗂️</div>
                <div style={{ fontSize: 13, color: T.ink3, lineHeight: 1.6, maxWidth: 240 }}>
                  בנק הנקודות ריק. חפשו מקומות במפה או בעריכת השלד כדי לשמור אותם כאן
                </div>
              </div>
            ) : (() => {
              /* Sprint 34 — unified list: every trip stop with real-time
                 assignment status. Category filter applies across both
                 buckets. */
              const visible = unifiedStops.filter((s) => inboxFilter === "all" || categoryBucket(s.category) === inboxFilter);
              if (!visible.length) return (
                <div style={{ textAlign: "center", color: T.ink3, fontSize: 13, padding: "22px 6px", lineHeight: 1.5 }}>
                  אין נקודות בקטגוריה זו
                </div>
              );
              return visible.map((s) => {
                const assigned = s.assignedDay != null;
                return (
                  <div key={s.key} style={{ border: `1px solid ${T.line}`, borderRadius: 14, padding: "10px 12px", marginBottom: 8, opacity: assigned ? 0.72 : 1, transition: "opacity 0.25s ease" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span aria-hidden style={{ width: 22, height: 22, borderRadius: "50%", background: "rgba(107,113,120,0.15)", color: T.ink3, display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 11, flexShrink: 0 }}>★</span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13.5, fontWeight: 800, color: T.ink, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{s.nameHe || s.name}</div>
                        <div style={{ fontSize: 11, color: T.ink3, marginTop: 1 }}>{s.category}{s.rating ? ` · ★ ${s.rating}` : ""}</div>
                      </div>
                    </div>
                    {assigned ? (
                      <div style={{ display: "flex", gap: 6, marginTop: 8, alignItems: "center" }}>
                        {/* Sprint 34 — assigned success badge with the day #. */}
                        <span role="status" style={{ flex: 1, height: 34, boxSizing: "border-box", borderRadius: 14, border: "1px solid rgba(31,166,122,0.35)", background: "rgba(31,166,122,0.10)", color: "#177A5B", fontSize: 12, fontWeight: 800, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 5 }}>
                          ✓ שובץ במסלול (יום {s.assignedDay})
                        </span>
                        {/* Unassign → back to the generic pile. */}
                        <button
                          onClick={() => unassignToInbox(s.assignedDay, s.dayIndex)}
                          title="החזרה לבנק הנקודות (הסרה מהיום)" aria-label="החזרה לבנק הנקודות"
                          style={{ flexShrink: 0, width: 34, height: 34, borderRadius: 12, border: `1px solid ${T.line}`, background: T.surface, color: T.ink3, cursor: "pointer", fontFamily: "inherit", display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
                          <Icon name="x" size={13} strokeWidth={2.2} />
                        </button>
                      </div>
                    ) : (
                      /* Prominent contextual CTA — instant day-assign menu. */
                      <select
                        value=""
                        onChange={(e) => { const dn = Number(e.target.value); if (dn) assignInboxPlace(s, dn); }}
                        aria-label="שיבוץ מיידי ליום במסלול"
                        style={{ marginTop: 8, width: "100%", height: 34, borderRadius: 14, border: `1.5px solid ${T.ink}`, background: T.ink, color: "#fff", fontSize: 12, fontWeight: 800, cursor: "pointer", fontFamily: "inherit", padding: "0 12px", appearance: "none", WebkitAppearance: "none", textAlign: "center" }}>
                        <option value="" style={{ color: T.ink }}>📅 שבץ במסלול</option>
                        {days.map((d) => (
                          <option key={d.day} value={d.day} style={{ color: T.ink }}>יום {d.day} · {d.cityHe || d.city}</option>
                        ))}
                      </select>
                    )}
                  </div>
                );
              });
            })()}
          </div>
        </aside>
      )}

      {/* Sprint 28 #6 — the floating target-day modal was replaced by the
          per-card instant drop-menu inside the anchored inbox sidebar. */}

      {/* Sprint 21 #3 — fast note editor (opened from the card pencil). */}
      {noteEditIdx >= 0 && activeDayData?.attractions?.[noteEditIdx] && (
        <NoteSheet
          title="הערה על המקום"
          initialValue={activeDayData.attractions[noteEditIdx].note || ""}
          placeholder="הוסיפו הערה אישית למקום…"
          onSave={(t) => saveNoteAt(noteEditIdx, t)}
          onClose={() => setNoteEditIdx(-1)}
        />
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
          onSetMultiDayHotel={setStopAsMultiDayHotel}
          onMoveNextDay={moveStopToNextDay}
          onSplitDay={splitDayFromStop}
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
      `}</style>
    </div>
  );
};

export default EditorView;
