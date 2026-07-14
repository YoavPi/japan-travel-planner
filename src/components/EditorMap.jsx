import React, { useEffect, useMemo, useRef, useState } from "react";
import Map, { Marker } from "react-map-gl/maplibre";
import "maplibre-gl/dist/maplibre-gl.css";
import Icon from "./Icon";

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
  /* Sprint 15.6 — Map Lock: freeze all user pan/zoom/rotate gestures
     while leaving programmatic flyTo (preview, day-fit) fully working. */
  locked = false,
  /* Sprint 22 #7 — mock Google Saved Places overlay. Rendered as
     distinct NEUTRAL, semi-transparent star markers so they can never
     be confused with the active itinerary's numbered route pins. */
  savedPlaces = [],
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
}) => {
  const mapRef = useRef(null);
  const [hoverCoord, setHoverCoord] = useState(null); // ghost pin while pinning
  /* The trip marker whose detail BOTTOM SHEET is open (Sprint 29 #1 —
     replaces the outdated MapLibre Popup / InfoWindow pattern). */
  const [selected, setSelected] = useState(null);
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
    const c = stop?.coordinates;
    const provided = stop?.maps_url || stop?.mapsUrl;
    const coordUrl = (c && Number.isFinite(c.lat) && Number.isFinite(c.lng))
      ? `https://www.google.com/maps/search/?api=1&query=${c.lat},${c.lng}`
      : null;
    const url = (provided && isSafeHttpUrl(provided)) ? provided : coordUrl;
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
    if (!map || pts.length > 0 || !center) return;
    map.flyTo({ center: [center.lng, center.lat], zoom: center.zoom ?? 6, duration: 800 });
  }, [center, pts.length]);

  /* Sprint 7 — fly to a previewed place coordinate. */
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !flyToCoord) return;
    map.flyTo({ center: [flyToCoord.lng, flyToCoord.lat], zoom: 15, duration: 750 });
  }, [flyToCoord]);

  /* Fit/fly to the active day's cluster whenever it changes. */
  useEffect(() => {
    const map = mapRef.current;
    if (!map || pts.length === 0) return;
    if (pts.length === 1) {
      map.flyTo({ center: [pts[0].coordinates.lng, pts[0].coordinates.lat], zoom: 14, duration: 700 });
      return;
    }
    let minLng = Infinity, minLat = Infinity, maxLng = -Infinity, maxLat = -Infinity;
    pts.forEach(({ coordinates: c }) => {
      minLng = Math.min(minLng, c.lng); maxLng = Math.max(maxLng, c.lng);
      minLat = Math.min(minLat, c.lat); maxLat = Math.max(maxLat, c.lat);
    });
    try {
      map.fitBounds([[minLng, minLat], [maxLng, maxLat]], { padding: 80, maxZoom: 15, duration: 700 });
    } catch { /* noop */ }
  }, [pts]);

  return (
   <>
    <Map
      ref={mapRef}
      initialViewState={{
        longitude: pts[0]?.coordinates.lng ?? center?.lng ?? 139.7,
        latitude: pts[0]?.coordinates.lat ?? center?.lat ?? 35.6,
        zoom: pts[0] ? 12 : (center?.zoom ?? 6),
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
        panToCoord(e.lngLat.lng, e.lngLat.lat);
      }}
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

      {/* Sprint 22 #7 — saved-places inbox markers (neutral ★, semi-
          transparent gray, no number) — visually subordinate to the
          itinerary route pins. */}
      {savedPlaces.map((p) => (
        Number.isFinite(p.lat) && Number.isFinite(p.lng) ? (
          <Marker key={p.id} longitude={p.lng} latitude={p.lat} anchor="center">
            <div title={p.nameHe || p.name} style={{
              width: 24, height: 24, borderRadius: "50%",
              background: "rgba(107,113,120,0.72)", color: "#fff",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 12, border: "2px solid rgba(255,255,255,0.85)",
              boxShadow: "0 2px 6px rgba(0,0,0,0.2)", opacity: 0.85,
            }}>★</div>
          </Marker>
        ) : null
      ))}

      {pts.map((s, i) => {
        const isSel = selected && selected.idx === i;
        return (
          <Marker key={`${s.name}-${i}`} longitude={s.coordinates.lng} latitude={s.coordinates.lat} anchor="center"
            onClick={(e) => {
              /* Stop the click reaching the map (which would treat it as a
                 blank-area tap and dismiss the popup). */
              e.originalEvent?.stopPropagation();
              setSelected({ idx: i, stop: s });
              panToCoord(s.coordinates.lng, s.coordinates.lat);
              if (onMarkerClick) onMarkerClick(s, i);
            }}
          >
            <div style={{
              width: 26, height: 26, borderRadius: "50%", background: color,
              color: "#fff", display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 12, fontWeight: 800, border: `2px solid #fff`,
              boxShadow: isSel ? `0 0 0 3px ${ACCENT}, 0 4px 12px rgba(0,0,0,0.3)` : "0 2px 6px rgba(0,0,0,0.25)",
              fontFamily: "'Noto Sans Hebrew','Inter',sans-serif",
              cursor: "pointer", transform: isSel ? "scale(1.15)" : "scale(1)",
              transition: "transform 0.18s ease, box-shadow 0.18s ease",
            }}>{i + 1}</div>
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
    </Map>

    {/* ══ Sprint 29 #1 — marker detail BOTTOM SHEET (replaces the
        outdated MapLibre Popup / Google InfoWindow). Rendered outside the
        map canvas so its lifecycle never re-renders the map. ══ */}
    {selected && selected.stop && (
      <div style={{ position: "fixed", inset: 0, zIndex: 58, display: "flex", alignItems: "flex-end", justifyContent: "center", fontFamily: "'Noto Sans Hebrew','Inter',sans-serif" }}>
        <div onClick={() => setSelected(null)} className="tp-fade" style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.35)" }} />
        <div dir="rtl" className="tp-sheet-up" style={{
          position: "relative", width: "100%", maxWidth: 560, background: "#fff",
          borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: "10px 18px 24px",
          boxShadow: "0 -20px 60px rgba(0,0,0,0.24)", maxHeight: "82vh", overflowY: "auto",
        }}>
          <div style={{ display: "flex", justifyContent: "center", marginBottom: 12 }}>
            <div style={{ width: 44, height: 5, borderRadius: 999, background: "rgba(20,20,20,0.18)" }} />
          </div>

          {/* Sprint 31 #1 — wide preview photo as a true <img> mapped to
              the location's Google photo (photoUrl / photo_url / image_url
              / google_photo — first available). A travel-themed gradient +
              glyph scales in only when no URL exists natively, or if the
              image fails to load. */}
          {(() => {
            const photo = selected.stop.photoUrl || selected.stop.photo_url || selected.stop.image_url || selected.stop.google_photo || "";
            return (
              <div style={{ height: 160, borderRadius: 16, marginBottom: 14, position: "relative", overflow: "hidden", background: `linear-gradient(145deg, ${color}, ${color}99)` }}>
                {photo && (
                  <img
                    src={photo}
                    alt={selected.stop.nameHe || selected.stop.name || ""}
                    onError={(e) => { e.currentTarget.style.display = "none"; }}
                    style={{ width: "100%", height: "100%", objectFit: "cover", display: "block", borderRadius: 16 }}
                  />
                )}
                {!photo && (
                  <span aria-hidden style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 46, opacity: 0.6, filter: "drop-shadow(0 3px 8px rgba(0,0,0,0.3))" }}>🏙️</span>
                )}
                <button onClick={() => setSelected(null)} aria-label="סגירה"
                  style={{ position: "absolute", top: 10, insetInlineStart: 10, width: 32, height: 32, borderRadius: "50%", border: "none", background: "rgba(0,0,0,0.42)", backdropFilter: "blur(6px)", color: "#fff", cursor: "pointer", display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
                  <Icon name="x" size={14} strokeWidth={2.2} />
                </button>
              </div>
            );
          })()}

          {/* Title + category chip */}
          <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
            <span style={{ flexShrink: 0, width: 26, height: 26, borderRadius: "50%", background: color, color: "#fff", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 800, marginTop: 2 }}>{selected.idx + 1}</span>
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
            <span aria-hidden>🗺️</span> פתח ב-Google Maps
          </button>

          {/* Sprint 27 #3 — map→timeline quick-edit bridge (kept) */}
          {hasTransit && onEditTransit && (
            <button onClick={() => { setSelected(null); onEditTransit(); }}
              style={{ marginTop: 10, width: "100%", height: 46, borderRadius: 999, border: "1.5px dashed #E0533F", background: "rgba(224,83,63,0.06)", color: "#E0533F", fontSize: 13.5, fontWeight: 800, cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
              ✈️ ערוך מעבר
            </button>
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
