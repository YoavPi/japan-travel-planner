import React, { useEffect, useRef, useState } from "react";
import tripService from "../services/tripService";
import { listFavoriteTrips } from "../services/favoritesService";
import Icon from "./Icon";
import usePlacePhotos, { photoKey } from "../utils/usePlacePhotos";
import { photoStrict, onPhotoErrorStrict } from "../utils/placePhoto";

/* ══════════════════════════════════════════════════════════════
   ReferenceMapsPanel — "מפות נוספות".

   Load ANOTHER of the user's maps (own / shared-with-me / favorite)
   as a distinct-colour overlay on the current editor map, browse its
   points, and transfer chosen ones into the current trip (to the
   active day or the bank) — with or without their notes.

   Shared by mobile (EditorView) and desktop (EditorDesktop); the
   `desktop` prop switches between a bottom sheet and a side drawer.
   The overlay markers themselves render in EditorMap via the parent
   (which holds `overlayMap` state and gets it through onOverlayChange).

   Props:
     open, onClose(), dark, desktop
     currentTripId   — exclude this map from the picker
     favorites       — Set of favorited trip ids (for the "מועדפות" tab)
     activeDay       — number, shown on the "add to day" target
     onOverlayChange(map|null)  — { id, title, color, points } | null
     onTransfer(points[], { target:"day"|"bank", includeNotes })
   ══════════════════════════════════════════════════════════════ */

const FONT = "'Noto Sans Hebrew','Inter','Noto Sans JP',system-ui,sans-serif";
const OVERLAY_COLOR = "#0C8B94";
const CAT_EMOJI = (c = "") =>
  /מלון|לינה/.test(c) ? "🏨" : /אוכל|מסעד/.test(c) ? "🍽️" : /קפה/.test(c) ? "☕" :
  /קניו|קניות|חנות/.test(c) ? "🛍️" : /טבע|פארק|גן/.test(c) ? "🌳" : /מוזי/.test(c) ? "🖼️" : "📍";

/* Flatten a trip's tripData into transferable points (skip transit nodes). */
const tripToPoints = (trip) => {
  const days = trip?.data?.tripData || [];
  const seen = new Set();
  const out = [];
  days.forEach((d) => (d.attractions || []).forEach((a) => {
    if (a._transit) return;
    const c = a.coordinates;
    if (!c || !Number.isFinite(c.lat) || !Number.isFinite(c.lng)) return;
    const key = a.place_id || `${c.lat.toFixed(5)},${c.lng.toFixed(5)}`;
    if (seen.has(key)) return;
    seen.add(key);
    out.push({
      key, name: a.name, nameHe: a.nameHe || a.name, category: a.category,
      rating: a.rating, note: a.note, place_id: a.place_id,
      lat: c.lat, lng: c.lng, coordinates: { lat: c.lat, lng: c.lng },
      _day: d.day,
    });
  }));
  return out;
};

const ReferenceMapsPanel = ({ open, onClose, dark = false, desktop = false, currentTripId, favorites, onOverlayChange, onPointClick, onAddRequest, addedKeys, focusedKey }) => {
  const [view, setView] = useState("picker"); // "picker" | "points"
  const [maps, setMaps] = useState(null);
  /* Gallery favorites (other people's PUBLIC maps the user starred). These are
     NOT part of fetchAllTrips (own + shared), so the "מועדפות" tab loads them
     from the trip_favorites table directly. null = not loaded yet. */
  const [favMaps, setFavMaps] = useState(null);
  const [tab, setTab] = useState("mine"); // mine | shared | favorite
  const [loadingPts, setLoadingPts] = useState(false);
  const [selMap, setSelMap] = useState(null);
  const [points, setPoints] = useState([]);
  const [selected, setSelected] = useState(() => new Set());
  const [error, setError] = useState("");
  const [minimized, setMinimized] = useState(false); // mobile: peek so the map shows
  /* Drag (not tap) to minimize/expand the mobile grabber — a stray tap while
     scrolling the list no longer collapses the sheet. */
  const grabRef = useRef({ y: 0, active: false });
  const onGrabDown = (e) => { grabRef.current = { y: e.clientY, active: true }; try { e.currentTarget.setPointerCapture?.(e.pointerId); } catch { /* noop */ } };
  const onGrabUp = (e) => {
    if (!grabRef.current.active) return;
    const dy = e.clientY - grabRef.current.y;
    grabRef.current.active = false;
    if (dy > 22) setMinimized(true);        // dragged down → minimize
    else if (dy < -22) setMinimized(false); // dragged up → expand
    /* a near-static press (tap) intentionally does nothing */
  };
  const addedSet = addedKeys || new Set(); // which keys were already added (from parent)

  const favs = favorites || new Set();
  const ptPhotos = usePlacePhotos(points);

  /* Fresh open always starts expanded. */
  useEffect(() => { if (open) setMinimized(false); }, [open]);

  /* Load the maps list when the picker opens. */
  useEffect(() => {
    if (!open || maps !== null) return;
    tripService.fetchAllTrips()
      .then((list) => setMaps((list || []).filter((t) => t.id !== currentTripId)))
      .catch(() => setMaps([]));
  }, [open, maps, currentTripId]);

  /* Load the user's gallery favorites for the "מועדפות" tab. */
  useEffect(() => {
    if (!open || favMaps !== null) return;
    listFavoriteTrips()
      .then((list) => setFavMaps((list || []).filter((t) => t.id !== currentTripId)))
      .catch(() => setFavMaps([]));
  }, [open, favMaps, currentTripId]);

  if (!open) return null;

  const T = dark
    ? { panel: "#191B1F", surface: "#24272C", ink: "#F3F4F6", ink2: "#C7CBD1", ink3: "#8B9198", line: "rgba(255,255,255,0.12)", page: "#0F1113" }
    : { panel: "#FFFFFF", surface: "#F6F6F4", ink: "#0D0F11", ink2: "#2A3036", ink3: "#6B7178", line: "rgba(20,20,20,0.12)", page: "#FFFFFF" };

  /* The favorite tab draws from the separately-loaded gallery favorites; the
     other tabs slice the own/shared list. `favs` (device-local) is no longer
     the source of truth for favorites. */
  const tabMaps = tab === "favorite"
    ? (favMaps || [])
    : (maps || []).filter((m) => (tab === "mine" ? m.role === "owner" : m.role !== "owner"));
  /* Which underlying list is still loading for the active tab. */
  const tabLoading = tab === "favorite" ? favMaps === null : maps === null;

  const pickMap = async (m) => {
    setLoadingPts(true); setError(""); setSelMap(m); setSelected(new Set());
    try {
      const full = await tripService.fetchTripById(m.id);
      const pts = tripToPoints(full);
      setPoints(pts);
      onOverlayChange && onOverlayChange({ id: m.id, title: m.title, color: OVERLAY_COLOR, points: pts });
      setView("points");
    } catch {
      setError("לא הצלחנו לטעון את המפה. נסו אחרת.");
    } finally { setLoadingPts(false); }
  };

  const backToPicker = () => { setView("picker"); setPoints([]); setSelected(new Set()); setMinimized(false); onOverlayChange && onOverlayChange(null); };
  const close = () => { onOverlayChange && onOverlayChange(null); onClose && onClose(); };

  const toggleSel = (key) => setSelected((prev) => { const n = new Set(prev); if (n.has(key)) n.delete(key); else n.add(key); return n; });

  /* Ask the parent to open the "bank / specific day" chooser for these points. */
  const requestAdd = (pts) => { if (pts.length && onAddRequest) onAddRequest(pts); };
  const requestAddSelected = () => { requestAdd(points.filter((p) => selected.has(p.key))); setSelected(new Set()); };

  const photoFor = (p) => { const k = photoKey(p); return (k && ptPhotos[k]) || photoStrict(p); };

  /* Shell — side drawer (desktop) or bottom sheet (mobile). */
  const shell = desktop
    /* Match the editor's itinerary column width (400px) and sit exactly over it,
       so it reads as that panel switching to the reference view — never a
       narrower drawer half-covering it. The map (with the overlay) stays fully
       visible + interactive to its side. */
    ? { position: "fixed", top: 0, bottom: 0, insetInlineStart: 0, width: 400, zIndex: 210, borderInlineEnd: `1px solid ${T.line}`, boxShadow: "10px 0 44px rgba(0,0,0,0.22)" }
    : { position: "fixed", left: 0, right: 0, bottom: 0, maxHeight: minimized ? "auto" : "82vh", zIndex: 210, borderTopLeftRadius: 22, borderTopRightRadius: 22, boxShadow: "0 -20px 60px rgba(0,0,0,0.28)" };

  const seg = (on) => ({ flex: 1, height: 34, borderRadius: 999, border: `1px solid ${on ? T.ink : T.line}`, background: on ? T.ink : T.panel, color: on ? "#fff" : T.ink2, fontSize: 12.5, fontWeight: 800, cursor: "pointer", fontFamily: "inherit" });

  return (
    <>
      {/* Backdrop only when expanded — minimized/peek lets the map show through. */}
      {!desktop && !minimized && <div onClick={close} style={{ position: "fixed", inset: 0, zIndex: 205, background: "rgba(8,10,14,0.35)" }} />}
      <div dir="rtl" className={desktop ? "" : "tp-sheet-up"} style={{ ...shell, background: T.panel, color: T.ink, fontFamily: FONT, display: "flex", flexDirection: "column" }}>

        {/* Mobile grabber — DRAG up/down to expand/minimize (peek at the map). */}
        {!desktop && (
          <div onPointerDown={onGrabDown} onPointerUp={onGrabUp} onPointerCancel={() => { grabRef.current.active = false; }}
            aria-label={minimized ? "גררו להרחבה" : "גררו למזעור"}
            style={{ flexShrink: 0, cursor: "grab", touchAction: "none", padding: "9px 0 5px", display: "flex", flexDirection: "column", alignItems: "center", gap: 3 }}>
            <span style={{ width: 40, height: 5, borderRadius: 999, background: T.line }} />
            <span style={{ fontSize: 10.5, fontWeight: 700, color: T.ink3 }}>{minimized ? "גררו למעלה להרחבה" : "גררו למטה למזעור — לראות על המפה"}</span>
          </div>
        )}

        {/* Header */}
        <div style={{ flexShrink: 0, display: "flex", alignItems: "center", gap: 8, padding: "14px 16px", borderBottom: `1px solid ${T.line}` }}>
          {view === "points" && (
            <button onClick={backToPicker} aria-label="חזרה" style={{ width: 30, height: 30, borderRadius: 8, border: "none", background: T.surface, color: T.ink2, cursor: "pointer", fontFamily: "inherit", fontSize: 15 }}>›</button>
          )}
          <span aria-hidden style={{ width: 24, height: 24, borderRadius: 6, background: OVERLAY_COLOR, display: "inline-flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 12 }}><Icon name="layers" size={13} strokeWidth={2} /></span>
          <span style={{ fontSize: 15, fontWeight: 800 }}>{view === "picker" ? "מפות נוספות" : (selMap?.title || "נקודות")}</span>
          <div style={{ flex: 1 }} />
          <button onClick={close} aria-label="סגירה" style={{ width: 30, height: 30, borderRadius: 8, border: "none", background: T.surface, color: T.ink2, cursor: "pointer", fontFamily: "inherit", fontSize: 15, fontWeight: 800 }}>✕</button>
        </div>

        {/* ── PICKER ── */}
        {!minimized && view === "picker" && (
          <>
            <div style={{ flexShrink: 0, display: "flex", gap: 4, padding: "10px 12px 0" }}>
              {[{ id: "mine", label: "שלי" }, { id: "shared", label: "שותפו איתי" }, { id: "favorite", label: "מועדפות ⭐" }].map((t) => (
                <button key={t.id} onClick={() => setTab(t.id)} style={seg(tab === t.id)}>{t.label}</button>
              ))}
            </div>
            <div style={{ padding: "6px 12px 8px", fontSize: 12, color: T.ink3 }}>בחרו מפה לטעינה על גבי המפה הנוכחית.</div>
            <div style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: "0 12px 16px" }}>
              {tabLoading ? (
                <div style={{ textAlign: "center", color: T.ink3, fontSize: 13, padding: "30px 0" }}>טוען מפות…</div>
              ) : tabMaps.length === 0 ? (
                <div style={{ textAlign: "center", color: T.ink3, fontSize: 13, padding: "30px 12px", lineHeight: 1.6 }}>
                  {tab === "mine" ? "אין עוד מפות שלך." : tab === "shared" ? "אין מפות ששותפו איתך." : "לא סימנת מפות כמועדפות."}
                </div>
              ) : tabMaps.map((m) => (
                <button key={m.id} onClick={() => pickMap(m)} disabled={loadingPts}
                  className="tp-press"
                  style={{ width: "100%", textAlign: "start", display: "flex", alignItems: "center", gap: 10, padding: "11px 12px", marginBottom: 8, borderRadius: 12, border: `1px solid ${T.line}`, background: T.panel, cursor: "pointer", fontFamily: "inherit" }}>
                  <span aria-hidden style={{ flexShrink: 0, width: 34, height: 34, borderRadius: 9, background: T.surface, display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 17 }}>🗺️</span>
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <span dir="auto" style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 14, fontWeight: 800, color: T.ink }}>
                      {favs.has(m.id) && <span aria-hidden style={{ color: "#F5A623" }}>★</span>}
                      <span style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{m.title}</span>
                    </span>
                    <span style={{ display: "block", fontSize: 11.5, color: T.ink3, marginTop: 1 }}>
                      {[m.days ? `${m.days} ימים` : "", m.role === "owner" ? "מפה שלי" : `שותף · ${m.sharedBy || ""}`].filter(Boolean).join(" · ")}
                    </span>
                  </span>
                  <span aria-hidden style={{ color: T.ink3 }}>‹</span>
                </button>
              ))}
            </div>
          </>
        )}

        {/* ── POINTS ── */}
        {!minimized && view === "points" && (
          <>
            {/* Hint — how the list behaves */}
            <div style={{ flexShrink: 0, padding: "9px 14px", borderBottom: `1px solid ${T.line}`, fontSize: 12, color: T.ink3, lineHeight: 1.5 }}>
              לחצו על נקודה כדי לפתוח אותה על המפה — ומשם להוסיף ליום או לבנק · <span style={{ color: OVERLAY_COLOR, fontWeight: 700 }}>☑︎</span> לבחירה מרובה.
            </div>

            <div style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: "8px 12px 16px" }}>
              {loadingPts ? (
                <div style={{ textAlign: "center", color: T.ink3, fontSize: 13, padding: "30px 0" }}>טוען נקודות…</div>
              ) : error ? (
                <div style={{ textAlign: "center", color: "#C0392B", fontSize: 13, padding: "24px 0" }}>{error}</div>
              ) : points.length === 0 ? (
                <div style={{ textAlign: "center", color: T.ink3, fontSize: 13, padding: "30px 12px" }}>אין נקודות עם מיקום במפה הזו.</div>
              ) : points.map((p) => {
                const isAdded = addedSet.has(p.key);
                const isSel = selected.has(p.key);
                const isFocused = focusedKey && focusedKey === p.key;
                return (
                  <div key={p.key}
                    style={{ display: "flex", alignItems: "flex-start", gap: 9, padding: "9px 10px", marginBottom: 7, borderRadius: 12, border: `1px solid ${isSel || isFocused ? OVERLAY_COLOR : T.line}`, background: isSel || isFocused ? "rgba(12,139,148,0.06)" : T.panel, boxShadow: isFocused ? `0 0 0 1px ${OVERLAY_COLOR}` : "none" }}>
                    <button onClick={() => toggleSel(p.key)} aria-pressed={isSel} title="בחירה מרובה"
                      style={{ flexShrink: 0, width: 22, height: 22, marginTop: 2, borderRadius: 6, border: `1.5px solid ${isSel ? OVERLAY_COLOR : T.line}`, background: isSel ? OVERLAY_COLOR : "transparent", color: "#fff", cursor: "pointer", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontFamily: "inherit" }}>{isSel ? "✓" : ""}</button>
                    {/* Click the photo+name → focus the point on the map (fly + card).
                        On mobile also minimise the sheet so the map is visible. */}
                    <button onClick={() => { if (onPointClick) onPointClick(p); if (!desktop) setMinimized(true); }} title="הצג על המפה"
                      style={{ flex: 1, minWidth: 0, display: "flex", alignItems: "flex-start", gap: 9, border: "none", background: "transparent", padding: 0, cursor: "pointer", fontFamily: "inherit", textAlign: "start" }}>
                      <img src={photoFor(p)} alt="" loading="lazy" onError={onPhotoErrorStrict()} style={{ flexShrink: 0, width: 42, height: 42, borderRadius: 9, objectFit: "cover", background: T.surface }} />
                      <span style={{ flex: 1, minWidth: 0 }}>
                        <span dir="auto" style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13.5, fontWeight: 800, color: T.ink }}>
                          <span aria-hidden style={{ fontSize: 13 }}>{CAT_EMOJI(p.category)}</span>
                          <span style={{ minWidth: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{p.nameHe || p.name}</span>
                        </span>
                        <span style={{ display: "block", fontSize: 11, color: T.ink3, marginTop: 1 }}>{[p.rating ? `★ ${p.rating}` : "", p.category].filter(Boolean).join(" · ")}</span>
                        {p.note && <span dir="auto" style={{ display: "block", fontSize: 11.5, color: T.ink2, background: T.surface, borderRadius: 7, padding: "4px 7px", marginTop: 5, lineHeight: 1.4, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>📝 {p.note}</span>}
                      </span>
                    </button>
                    {isAdded ? (
                      <span style={{ flexShrink: 0, alignSelf: "center", height: 28, padding: "0 9px", borderRadius: 8, background: "#E4EFE5", color: "#2B7B71", fontSize: 11.5, fontWeight: 800, display: "inline-flex", alignItems: "center", gap: 3 }}>✓ נוסף</span>
                    ) : (
                      <span aria-hidden style={{ flexShrink: 0, alignSelf: "center", color: OVERLAY_COLOR, fontSize: 16, fontWeight: 800 }}>‹</span>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Multi-select action bar */}
            {selected.size > 0 && (
              <div style={{ flexShrink: 0, padding: "10px 12px", borderTop: `1px solid ${T.line}`, background: T.panel }}>
                <button onClick={requestAddSelected}
                  style={{ width: "100%", height: 46, borderRadius: 12, border: "none", background: OVERLAY_COLOR, color: "#fff", fontSize: 14.5, fontWeight: 800, cursor: "pointer", fontFamily: "inherit" }}>
                  הוספת {selected.size} נקודות…
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </>
  );
};

export default ReferenceMapsPanel;
