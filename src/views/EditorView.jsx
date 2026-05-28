import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import tripService from "../services/tripService";
import EditorBottomSheet from "../components/EditorBottomSheet";
import { computeTransit } from "../utils/transit";

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

/* ── Transit rail (sits ON the connecting axis between two stops) ──
   Renders the auto-computed mode + minutes + distance. Tapping it
   cycles the manual override walk → transit → car → auto (spec §7). */
const TransitRail = ({ a, b, override, onCycle }) => {
  const seg = computeTransit(a?.coordinates, b?.coordinates, override);
  if (!seg) return null;
  return (
    <div style={{ display: "flex", justifyContent: "center", padding: "2px 0" }}>
      <button
        onClick={onCycle}
        title="לחצו לשינוי אופן התחבורה"
        style={{
          display: "inline-flex", alignItems: "center", gap: 6,
          padding: "4px 10px", borderRadius: 999,
          border: `1px solid ${T.line}`, background: "#fff",
          fontSize: 11, color: T.ink3, cursor: "pointer", fontFamily: "inherit",
        }}
      >
        <span aria-hidden>{seg.emoji}</span>
        <b style={{ color: T.ink2, fontWeight: 700 }}>{seg.minutesLabel}</b>
        <span style={{ color: T.ink4 }}>·</span>
        <span>{seg.he}</span>
        <span style={{ color: T.ink4 }}>·</span>
        <span>{seg.distLabel}</span>
        {seg.overridden && <span style={{ color: T.accent, fontSize: 9 }}>•</span>}
      </button>
    </div>
  );
};

/* ── Day stop list with pointer-based drag-reorder (spec §6) ──
   Long-/click-drag the ≡ handle to re-sort. On release the new
   order is committed via onReorder, which persists + re-renders
   the transit rails in real time. */
const OVERRIDE_CYCLE = [null, "walk", "transit", "car"];

const DayStopList = ({ stops, color, onReorder }) => {
  const [items, setItems] = useState(stops);
  const [dragIdx, setDragIdx] = useState(-1);
  const [overrides, setOverrides] = useState({}); // segIndex → mode
  const rowRefs = useRef([]);
  const dragRef = useRef({ active: false });

  useEffect(() => { setItems(stops); }, [stops]);

  const onHandleDown = (i) => (e) => {
    e.preventDefault();
    e.stopPropagation();
    dragRef.current = { active: true };
    setDragIdx(i);
    try { e.target.setPointerCapture?.(e.pointerId); } catch { /* noop */ }
  };
  const onMove = (e) => {
    if (!dragRef.current.active || dragIdx < 0) return;
    const y = e.clientY;
    let target = dragIdx;
    rowRefs.current.forEach((el, idx) => {
      if (!el) return;
      const r = el.getBoundingClientRect();
      const mid = r.top + r.height / 2;
      if (idx < dragIdx && y < mid) target = Math.min(target, idx);
      if (idx > dragIdx && y > mid) target = Math.max(target, idx);
    });
    if (target !== dragIdx) {
      setItems((prev) => {
        const next = prev.slice();
        const [moved] = next.splice(dragIdx, 1);
        next.splice(target, 0, moved);
        return next;
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

  const cycleOverride = (segIdx) => {
    setOverrides((prev) => {
      const cur = prev[segIdx] ?? null;
      const next = OVERRIDE_CYCLE[(OVERRIDE_CYCLE.indexOf(cur) + 1) % OVERRIDE_CYCLE.length];
      return { ...prev, [segIdx]: next };
    });
  };

  return (
    <div onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}>
      {items.map((a, i) => (
        <React.Fragment key={`${a.name}-${i}`}>
          <div
            ref={(el) => (rowRefs.current[i] = el)}
            style={{
              display: "flex", gap: 12, padding: "10px 0",
              borderBottom: `1px solid ${T.line}`,
              background: dragIdx === i ? "rgba(224,83,63,0.06)" : "transparent",
              borderRadius: dragIdx === i ? 12 : 0,
              transition: "background 0.15s",
            }}
          >
            <div style={{
              width: 30, height: 30, borderRadius: "50%", flexShrink: 0,
              background: color, color: "#fff", display: "flex", alignItems: "center",
              justifyContent: "center", fontSize: 13, fontWeight: 800,
            }}>{i + 1}</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: T.ink, direction: "ltr", textAlign: "right" }}>{a.name}</div>
              {a.nameHe && a.nameHe !== a.name && (
                <div style={{ fontSize: 12, color: T.ink3, marginTop: 1 }}>{a.nameHe}</div>
              )}
              {a.category && (
                <div style={{ display: "inline-block", marginTop: 6, fontSize: 11, fontWeight: 600, color, background: `${color}14`, border: `1px solid ${color}30`, borderRadius: 999, padding: "2px 9px" }}>
                  {a.category}{a.rating ? ` · ${a.rating}` : ""}
                </div>
              )}
            </div>
            {/* Drag handle */}
            <button
              onPointerDown={onHandleDown(i)}
              title="גררו לסידור מחדש"
              style={{ alignSelf: "center", width: 32, height: 32, border: "none", background: "transparent", color: T.ink4, cursor: "grab", touchAction: "none", fontSize: 16, fontFamily: "inherit" }}
            >
              ≡
            </button>
          </div>
          {/* Transit rail to the next stop */}
          {i < items.length - 1 && (
            <TransitRail
              a={a}
              b={items[i + 1]}
              override={overrides[i] ?? null}
              onCycle={() => cycleOverride(i)}
            />
          )}
        </React.Fragment>
      ))}
    </div>
  );
};

const EditorView = () => {
  const { tripId } = useParams();
  const navigate = useNavigate();
  const [trip, setTrip] = useState(null);
  const [error, setError] = useState(null);
  const [activeDay, setActiveDay] = useState(1);
  const [saving, setSaving] = useState(false);
  const sheetRef = useRef(null);
  const dayStripRef = useRef(null);

  /* Commit a reordered stop list for the active day → local state +
     persist via the service (skipped for read-only trips). */
  const handleReorder = useCallback((newStops) => {
    setTrip((prev) => {
      if (!prev) return prev;
      const nextDays = (prev.data.tripData || []).map((d) =>
        d.day === activeDay ? { ...d, attractions: newStops } : d
      );
      const nextTrip = { ...prev, data: { ...prev.data, tripData: nextDays } };
      if (!prev.readOnly) {
        setSaving(true);
        tripService.saveTrip(prev.id, { data: nextTrip.data })
          .catch(() => {})
          .finally(() => setSaving(false));
      }
      return nextTrip;
    });
  }, [activeDay]);

  useEffect(() => {
    let live = true;
    setTrip(null); setError(null);
    tripService.fetchTripById(tripId)
      .then((t) => { if (live) { setTrip(t); setActiveDay(t.data?.tripData?.[0]?.day ?? 1); } })
      .catch((e) => { if (live) setError(e.message); });
    return () => { live = false; };
  }, [tripId]);

  const days = trip?.data?.tripData ?? [];
  const activeDayData = useMemo(
    () => days.find((d) => d.day === activeDay) || null,
    [days, activeDay]
  );

  const selectDay = (n) => {
    setActiveDay(n);
    sheetRef.current?.snapTo?.("half");
  };

  return (
    <div dir="rtl" style={{ height: "100vh", overflow: "hidden", position: "relative", fontFamily: T.font, background: "#E9EBEC" }}>
      {/* Map placeholder (real MapLibre canvas wired in the geocoding phase) */}
      <div style={{
        position: "absolute", inset: 0,
        background: "repeating-linear-gradient(45deg,#E9EBEC 0 18px,#E4E6E8 18px 36px)",
        display: "flex", alignItems: "center", justifyContent: "center",
      }}>
        <span style={{ color: T.ink4, fontSize: 13 }}>אזור המפה</span>
      </div>

      {/* Top bar — exit + trip title */}
      <header style={{
        position: "absolute", top: 0, insetInlineStart: 0, insetInlineEnd: 0, zIndex: 40,
        display: "flex", alignItems: "center", gap: 12, padding: "12px 16px",
      }}>
        <button onClick={() => navigate("/dashboard")} title="חזרה לעמוד הבית"
          style={{ width: 40, height: 40, borderRadius: "50%", border: `1px solid ${T.line}`, background: "#fff", cursor: "pointer", fontSize: 18, fontFamily: "inherit", boxShadow: "0 2px 8px rgba(0,0,0,0.08)" }}>
          ←
        </button>
        {trip && (
          <div style={{ background: "#fff", borderRadius: 999, padding: "8px 16px", boxShadow: "0 2px 8px rgba(0,0,0,0.08)", fontSize: 14, fontWeight: 800, color: T.ink, display: "flex", alignItems: "center", gap: 8 }}>
            <span>{trip.title}{trip.days ? ` · ${trip.days} ימים` : ""}</span>
            {saving && <span style={{ fontSize: 11, fontWeight: 600, color: T.ink3 }}>נשמר…</span>}
          </div>
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
          header={
            <div style={{ padding: "0 16px 12px" }}>
              {/* Day strip */}
              {days.length > 0 ? (
                <div ref={dayStripRef} style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 4, direction: "rtl" }} className="scrollbar-hide">
                  {days.map((d) => {
                    const col = cityColor(d.city);
                    const on = d.day === activeDay;
                    return (
                      <button key={d.day} onClick={() => selectDay(d.day)}
                        style={{
                          flexShrink: 0, width: 52, height: 52, borderRadius: "50%",
                          border: `1.5px solid ${on ? "transparent" : col + "55"}`,
                          background: on ? col : "transparent", color: on ? "#fff" : col,
                          cursor: "pointer", display: "flex", flexDirection: "column",
                          alignItems: "center", justifyContent: "center", fontFamily: "inherit", lineHeight: 1.05,
                        }}>
                        <span style={{ fontSize: 16, fontWeight: 800 }}>{d.day}</span>
                        <span style={{ fontSize: 8, fontWeight: 600, opacity: 0.85 }}>{cityAbbr(d.city)}</span>
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div style={{ fontSize: 13, color: T.ink3, padding: "4px 0" }}>מסלול חדש — עדיין אין ימים</div>
              )}
            </div>
          }
        >
          <div style={{ padding: "4px 16px 120px" }}>
            {/* Active day header */}
            {activeDayData && (
              <div style={{ display: "flex", alignItems: "baseline", gap: 8, margin: "8px 0 14px" }}>
                <span style={{ fontSize: 22, fontWeight: 800, letterSpacing: "-0.02em", color: cityColor(activeDayData.city) }}>
                  {activeDayData.cityHe || activeDayData.city}
                </span>
                <span style={{ fontSize: 13, color: T.ink3 }}>יום {activeDayData.day}</span>
              </div>
            )}

            {/* Stop list — drag-reorder + auto transit rails */}
            {activeDayData?.attractions?.length ? (
              <DayStopList
                stops={activeDayData.attractions}
                color={cityColor(activeDayData.city)}
                onReorder={handleReorder}
              />
            ) : (
              <div style={{ textAlign: "center", color: T.ink3, padding: "32px 0", fontSize: 13.5 }}>
                {days.length === 0 ? "התחילו להוסיף תחנות למסלול" : "אין תחנות ביום זה עדיין"}
              </div>
            )}

            {/* Add stop (stub — Google Places / manual pin next phase) */}
            <button
              onClick={() => alert("הוספת תחנה — חיפוש Google Places / נעיצה ידנית ייבנו בשלב הבא")}
              style={{
                width: "100%", marginTop: 16, padding: 14, borderRadius: 16,
                border: `2px dashed ${T.line}`, background: "transparent",
                color: T.ink2, fontSize: 14, fontWeight: 700, cursor: "pointer",
                fontFamily: "inherit", display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
              }}
            >
              <span style={{ fontSize: 18 }}>＋</span> הוספת תחנה
            </button>
          </div>
        </EditorBottomSheet>
      )}

      {!trip && !error && (
        <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: "50vh", background: "#fff", borderTopLeftRadius: 22, borderTopRightRadius: 22, padding: 22 }}>
          <div style={{ height: 52, borderRadius: 16, background: "linear-gradient(90deg,#f0f0ee,#f7f7f5,#f0f0ee)", backgroundSize: "200% 100%", animation: "tpSkeleton 1.2s ease infinite" }} />
        </div>
      )}
      <style>{`@keyframes tpSkeleton{0%{background-position:200% 0}100%{background-position:-200% 0}}`}</style>
    </div>
  );
};

export default EditorView;
