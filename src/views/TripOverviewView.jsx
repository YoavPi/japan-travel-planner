import React, { useEffect, useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import tripService from "../services/tripService";
import { useDarkMode } from "../utils/theme";
import Icon from "../components/Icon";
import SwipeBackContainer from "../components/SwipeBackContainer";
import useActiveTrip from "../utils/useActiveTrip";
import useIsDesktop from "../utils/useIsDesktop";
import TripOverviewDesktop from "./TripOverviewDesktop";

/* ══════════════════════════════════════════════════════════════
   TripOverviewView — magazine-style Trip Preview / summary screen.

   Reached by clicking a trip card on the dashboard (route
   /trip/overview/:tripId). Acts as a calm review dashboard BEFORE
   the user dives into the full interactive map editor:

     • Cover header — country gradient/photo, title, back link.
     • Floating metrics card — total days · total stops · country.
     • "מה תכננו" — narrative + the distinct city nodes of the trip.
     • "מה קורה בכל יום" — chronological day rows, each an accordion
       showing the day number, city tag and a comma-separated list
       of that day's planned stops (expand → category chips).
     • Sticky action bar — "עריכת מסלול" (→ editor) + the glowing
       "הפעל מסלול" CTA (live-companion engine, wired next sprint).

   The global app chrome (BottomDock + SideMenu) auto-hides on this
   route (see App.jsx SHOW_CHROME), so the screen owns the full
   viewport. ════════════════════════════════════════════════════ */

const FONT   = "'Noto Sans Hebrew','Inter','Noto Sans JP',system-ui,sans-serif";
const ACCENT = "#E0533F";

/* Country → landmark glyph + themed gradient (mirrors MapCard so a
   trip reads with the same identity across the dashboard + overview). */
const LANDMARKS = {
  japan:    { e: "⛩️", g: ["#E0533F", "#B83A2B"] },
  italy:    { e: "🏛️", g: ["#5A8C5F", "#3E6B45"] },
  portugal: { e: "🚋", g: ["#4A7FB5", "#345C86"] },
  greece:   { e: "🏺", g: ["#4E9E94", "#2B7B71"] },
  thailand: { e: "🛕", g: ["#C9A03F", "#9C7826"] },
  vietnam:  { e: "🛶", g: ["#5A8C5F", "#3E6B45"] },
  dubai:    { e: "🕌", g: ["#C9A03F", "#9C7826"] },
  france:   { e: "🗼", g: ["#4A7FB5", "#345C86"] },
  spain:    { e: "💃", g: ["#E0533F", "#B83A2B"] },
  usa:      { e: "🗽", g: ["#4A7FB5", "#345C86"] },
};
const landmarkFor = (trip) => {
  const en = (trip?.settings?.destination || "").toLowerCase();
  const he = `${trip?.title || ""} ${trip?.settings?.destinationHe || ""}`;
  const map = [
    ["japan", /japan|יפן/i], ["italy", /italy|איטל/i], ["portugal", /portugal|פורטוג/i],
    ["greece", /greece|יוון/i], ["thailand", /thailand|תאיל/i], ["vietnam", /vietnam|וייטנא/i],
    ["dubai", /dubai|uae|דובאי|איחוד/i], ["france", /france|צרפת|פריז/i],
    ["spain", /spain|ספרד|ברצלונה/i], ["usa", /usa|united states|ארה|ניו יורק/i],
  ];
  for (const [key, rx] of map) if (rx.test(en) || rx.test(he)) return LANDMARKS[key];
  return { e: "🗺️", g: ["#8A94A0", "#5E6772"] };
};

/* Minimalist inline metric — value over label, no card chrome.
   Sits in a thin divider-separated row beneath the title. */
const Metric = ({ P, value, label }) => (
  <div style={{ textAlign: "center", padding: "0 4px" }}>
    <div style={{ fontSize: 24, fontWeight: 800, color: P.ink, lineHeight: 1.1, fontVariantNumeric: "tabular-nums" }}>{value}</div>
    <div style={{ fontSize: 12.5, color: P.ink3, marginTop: 4, letterSpacing: "0.01em" }}>{label}</div>
  </div>
);

const TripOverviewView = () => {
  const { tripId } = useParams();
  const navigate = useNavigate();
  const { P } = useDarkMode();
  const isDesktop = useIsDesktop();
  const activeId = useActiveTrip(); // globally-active "live" trip
  const isActive = activeId === tripId;
  /* Desktop widens the magazine column and lays the day cards two-up.
     Additive — every `isDesktop` use falls back to the exact mobile value. */
  const OVERVIEW_MAX = isDesktop ? 900 : 720;

  const [trip, setTrip] = useState(null);
  const [error, setError] = useState(null);
  const [expanded, setExpanded] = useState(() => new Set());
  const [showAllDays, setShowAllDays] = useState(false); // progressive disclosure
  const [activating, setActivating] = useState(false); // CTA in-flight + success
  const [toast, setToast] = useState(""); // triumphant success toast
  /* Sprint 28 #1 — activation is INTERCEPTED by an explanatory modal
     (אישור executes, חזרה aborts) instead of firing immediately. */
  const [confirmActivate, setConfirmActivate] = useState(false);

  useEffect(() => {
    let live = true;
    setTrip(null); setError(null);
    tripService.fetchTripById(tripId)
      .then((t) => { if (live) setTrip(t); })
      .catch((e) => { if (live) setError(e.message); });
    return () => { live = false; };
  }, [tripId]);

  const days = useMemo(() => trip?.data?.tripData ?? [], [trip]);
  const totalStops = useMemo(
    () => days.reduce((s, d) => s + (d.attractions?.length || 0), 0),
    [days]
  );
  const cities = useMemo(
    () => [...new Set(days.map((d) => d.cityHe || d.city).filter(Boolean))],
    [days]
  );

  const lm = landmarkFor(trip);
  const totalDays = trip?.days || days.length;
  const country = trip?.settings?.destinationHe || trip?.settings?.destination || "—";

  /* Progressive disclosure — only the first 3 days mount by default. */
  const DAY_PREVIEW = 3;
  const visibleDays = showAllDays ? days : days.slice(0, DAY_PREVIEW);
  const hiddenDays = Math.max(0, days.length - DAY_PREVIEW);

  const toggleDay = (n) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(n) ? next.delete(n) : next.add(n);
      return next;
    });

  /* ONLY the canonical Japan example (id "japan-demo") opens the static
     marketing demo map. Every real trip — owned OR shared, editable OR
     view-only — opens its OWN editor workspace (which renders read-only
     collaborators in view mode). Previously any `readOnly` trip was sent to
     the Japan demo, so a shared VIEW trip (e.g. Italy) opened Japan instead. */
  const isDemoExample = tripId === "japan-demo";
  const mapRoute = isDemoExample ? "/map?demo=1" : `/map/edit/${tripId}`;
  const goEdit = () => navigate(mapRoute);

  /* Flag this trip as the globally-active "live" trip, celebrate,
     then drop the user straight onto the live map workspace canvas
     (NOT back to the dashboard list). */
  const activateTrip = async () => {
    if (activating) return;
    setActivating(true);
    try {
      await tripService.setActiveTrip(tripId);
    } catch { /* local flag — failure is non-fatal */ }
    setToast("הטיול הופעל! מצב שטח פעיל כעת ⚡");
    setTimeout(() => navigate(mapRoute), 1100);
  };

  /* Explicitly stand down the live trip — clears the global active
     state via the custom-event engine, reverting every surface
     (ActiveTripBar, editor field-ops) back to normal. */
  const stopTrip = async () => {
    try {
      await tripService.setActiveTrip(null);
    } catch { /* local flag — failure is non-fatal */ }
    setToast("המסלול הופסק · מצב שטח כבוי 🛑");
  };

  /* ── Loading skeleton ─────────────────────────────────────── */
  if (!trip && !error) {
    return (
      <div dir="rtl" style={{ minHeight: "100vh", background: P.page, fontFamily: FONT }}>
        <div style={{ maxWidth: 720, margin: "0 auto" }}>
          <div style={{ height: 240, background: `linear-gradient(90deg, ${P.surface}, ${P.surface2}, ${P.surface})`, backgroundSize: "200% 100%", animation: "tpSkeleton 1.2s ease infinite" }} />
          <div style={{ padding: "0 20px" }}>
            <div style={{ height: 84, marginTop: -34, borderRadius: 20, background: P.panel, border: `1px solid ${P.line}`, boxShadow: "0 10px 30px rgba(0,0,0,0.10)" }} />
            {[0, 1, 2, 3].map((i) => (
              <div key={i} style={{ height: 64, marginTop: 14, borderRadius: 16, background: `linear-gradient(90deg, ${P.surface}, ${P.surface2}, ${P.surface})`, backgroundSize: "200% 100%", animation: "tpSkeleton 1.2s ease infinite", animationDelay: `${i * 90}ms` }} />
            ))}
          </div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10, padding: 28, color: P.ink3, fontSize: 13.5 }}>
            <span className="tp-spin" style={{ width: 18, height: 18, borderRadius: "50%", border: `2.5px solid ${P.line}`, borderTopColor: ACCENT, display: "inline-block" }} />
            טוען את המסלול…
          </div>
        </div>
      </div>
    );
  }

  /* ── Error state ──────────────────────────────────────────── */
  if (error) {
    return (
      <div dir="rtl" style={{ minHeight: "100vh", background: P.page, fontFamily: FONT, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
        <div style={{ textAlign: "center", maxWidth: 320 }}>
          <div style={{ fontSize: 40, marginBottom: 10 }}>🗺️</div>
          <div style={{ fontSize: 17, fontWeight: 800, color: P.ink, marginBottom: 6 }}>המסלול לא נמצא</div>
          <div style={{ fontSize: 13, color: P.ink3, lineHeight: 1.55, marginBottom: 18 }}>ייתכן שהמסלול נמחק או שהקישור שגוי.</div>
          <button onClick={() => navigate("/dashboard")} className="tp-press"
            style={{ padding: "11px 22px", borderRadius: 999, border: "none", background: P.ink, color: P.panel, fontSize: 13.5, fontWeight: 700, cursor: "pointer", fontFamily: FONT }}>
            חזרה למפות שלי
          </button>
        </div>
      </div>
    );
  }

  /* ── Loaded ───────────────────────────────────────────────── */
  return (
    <SwipeBackContainer>
    <div dir="rtl" style={{ minHeight: "100vh", background: P.page, fontFamily: FONT }}>
      {/* Scoped keyframes for the spinner + the glowing CTA. */}
      <style>{`
        @keyframes tp-spin { to { transform: rotate(360deg); } }
        .tp-spin { animation: tp-spin 0.7s linear infinite; }
        @keyframes tp-glow {
          0%,100% { box-shadow: 0 6px 22px ${ACCENT}66, 0 0 0 0 ${ACCENT}55; }
          50%     { box-shadow: 0 10px 30px ${ACCENT}88, 0 0 0 8px ${ACCENT}00; }
        }
        .tp-glow { animation: tp-glow 2.2s ease-in-out infinite; }
      `}</style>

      {isDesktop ? (
        <TripOverviewDesktop
          P={P} trip={trip} lm={lm} country={country}
          totalDays={totalDays} totalStops={totalStops} cities={cities}
          visibleDays={visibleDays} expanded={expanded} toggleDay={toggleDay}
          showAllDays={showAllDays} setShowAllDays={setShowAllDays} hiddenDays={hiddenDays}
          navigate={navigate} goEdit={goEdit} isActive={isActive} stopTrip={stopTrip}
          onActivate={() => setConfirmActivate(true)} activating={activating}
        />
      ) : (<>
      <div style={{ maxWidth: OVERVIEW_MAX, margin: "0 auto", paddingBottom: 120 /* clear sticky action bar */ }}>

        {/* ── Cover header — pure hero image, no overlapping cards ── */}
        <div style={{
          position: "relative", height: 230,
          background: trip.cover
            ? `center/cover url(${trip.cover}), linear-gradient(145deg, ${lm.g[0]}, ${lm.g[1]})`
            : `linear-gradient(145deg, ${lm.g[0]}, ${lm.g[1]})`,
        }}>
          {!trip.cover && (
            <span aria-hidden style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 96, opacity: 0.5, filter: "drop-shadow(0 4px 12px rgba(0,0,0,0.3))" }}>{lm.e}</span>
          )}
          {/* Soft top scrim so the floating controls stay legible. */}
          <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to bottom, rgba(0,0,0,0.30) 0%, rgba(0,0,0,0) 38%)" }} />

          {/* Back link */}
          <button onClick={() => navigate("/dashboard")} title="חזרה למפות שלי" aria-label="חזרה למפות שלי" className="tp-press"
            style={{ position: "absolute", top: 16, insetInlineStart: 16, width: 38, height: 38, borderRadius: "50%", border: "none", background: "rgba(0,0,0,0.42)", backdropFilter: "blur(6px)", color: "#fff", cursor: "pointer", display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
            <Icon name="chevronStart" size={17} strokeWidth={2.2} />
          </button>

          {/* Country chip */}
          <span style={{ position: "absolute", top: 16, insetInlineEnd: 16, display: "inline-flex", alignItems: "center", gap: 6, background: "rgba(0,0,0,0.42)", backdropFilter: "blur(6px)", color: "#fff", fontSize: 12.5, fontWeight: 700, borderRadius: 999, padding: "5px 12px" }}>
            <Icon name="globe" size={13} strokeWidth={2} />{country}
          </span>
        </div>

        {/* ── Title + minimalist inline metrics ────────────────── */}
        <header style={{ padding: "28px 24px 4px" }}>
          <div style={{ fontSize: 12.5, fontWeight: 700, color: P.ink3, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 8 }}>סקירת מסלול</div>
          <h1 style={{ margin: 0, fontSize: 32, fontWeight: 800, color: P.ink, lineHeight: 1.15, letterSpacing: "-0.02em" }}>{trip.title}</h1>

          {/* Thin divider-separated metric row. */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-start", gap: 22, marginTop: 22 }}>
            <Metric P={P} value={totalDays} label='סה"כ ימים' />
            <div style={{ width: 1, height: 34, background: P.line }} />
            <Metric P={P} value={totalStops} label="כמות עצירות" />
            <div style={{ width: 1, height: 34, background: P.line }} />
            <Metric P={P} value={cities.length || 1} label="ערים" />
          </div>
        </header>

        {/* Hairline divider between header and the body sections. */}
        <div style={{ height: 1, background: P.line, margin: "26px 24px 0" }} />

        {/* ── "מה תכננו" ───────────────────────────────────────── */}
        <section style={{ padding: "28px 24px 0" }}>
          <div style={{ fontSize: 13, fontWeight: 800, color: P.ink3, letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 14 }}>מה תכננו</div>
          <p style={{ margin: 0, fontSize: 16.5, lineHeight: 1.7, color: P.ink2 }}>
            {totalStops > 0 ? (
              <>מסלול בן <b style={{ color: P.ink }}>{totalDays} ימים</b> ב{country}, עם <b style={{ color: P.ink }}>{totalStops} עצירות</b> מתוכננות
              {cities.length > 1 ? <> לאורך <b style={{ color: P.ink }}>{cities.length} ערים</b></> : null}.</>
            ) : (
              <>שלד מסלול בן <b style={{ color: P.ink }}>{totalDays} ימים</b> ב{country} — עדיין ללא עצירות. כנסו לעריכה כדי למלא אותו במקומות.</>
            )}
          </p>
          {cities.length > 0 && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 18 }}>
              {cities.map((c, i) => (
                <span key={c} style={{ display: "inline-flex", alignItems: "center", gap: 7, background: P.surface, color: P.ink2, fontSize: 13.5, fontWeight: 700, borderRadius: 999, padding: "7px 14px" }}>
                  <span style={{ width: 19, height: 19, borderRadius: "50%", background: P.ink, color: P.panel, display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 10.5, fontWeight: 800 }}>{i + 1}</span>
                  {c}
                </span>
              ))}
            </div>
          )}
        </section>

        {/* ── "מה קורה בכל יום" ─────────────────────────────────── */}
        <section style={{ padding: "32px 24px 0" }}>
          <div style={{ fontSize: 13, fontWeight: 800, color: P.ink3, letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 14 }}>מה קורה בכל יום</div>
          <div style={isDesktop
            ? { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, alignItems: "start" }
            : { display: "flex", flexDirection: "column", gap: 12 }}>
            {days.length === 0 && (
              <div style={{ background: P.panel, border: `1px dashed ${P.line}`, borderRadius: 16, padding: 22, textAlign: "center", color: P.ink3, fontSize: 15 }}>
                טרם הוגדרו ימים למסלול זה.
              </div>
            )}
            {visibleDays.map((d) => {
              const stops  = (d.attractions || []).filter((a) => a.nameHe || a.name);
              const cityHe = d.cityHe || d.city || "";
              const open = expanded.has(d.day);
              const hasStops = stops.length > 0;
              return (
                <div key={d.day} className="tp-card tp-fade-up" style={{ background: P.panel, border: `1px solid ${P.line}`, borderRadius: 16, overflow: "hidden" }}>
                  {/* Closed row — day number, city, count badge only. */}
                  <button onClick={() => hasStops && toggleDay(d.day)}
                    style={{ display: "flex", alignItems: "center", gap: 14, width: "100%", textAlign: "right", padding: "16px 16px", border: "none", background: "transparent", cursor: hasStops ? "pointer" : "default", fontFamily: FONT }}>
                    {/* Day badge */}
                    <span style={{ flexShrink: 0, width: 42, height: 42, borderRadius: 13, background: P.ink, color: P.panel, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", lineHeight: 1 }}>
                      <span style={{ fontSize: 9.5, fontWeight: 700, opacity: 0.7 }}>יום</span>
                      <span style={{ fontSize: 17, fontWeight: 800 }}>{d.day}</span>
                    </span>
                    <span style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 5 }}>
                      <span style={{ fontSize: 16.5, fontWeight: 800, color: P.ink }}>{cityHe || "—"}</span>
                      <span style={{ display: "inline-flex", alignItems: "center", alignSelf: "flex-start", gap: 6, background: hasStops ? P.surface : "transparent", color: hasStops ? P.ink2 : P.ink4, fontSize: 12.5, fontWeight: 700, borderRadius: 999, padding: hasStops ? "4px 11px" : 0 }}>
                        {hasStops && <Icon name="pin" size={12} strokeWidth={2} />}
                        {hasStops ? `${stops.length} נקודות עניין` : "ללא עצירות"}
                      </span>
                    </span>
                    {hasStops && (
                      <span style={{ flexShrink: 0, color: P.ink3, transform: open ? "rotate(180deg)" : "none", transition: "transform 0.25s ease", display: "inline-flex" }}>
                        <Icon name="chevronDown" size={18} strokeWidth={2} />
                      </span>
                    )}
                  </button>

                  {/* Expanded — per-stop chips with category, mount on demand. */}
                  {open && hasStops && (
                    <div style={{ padding: "2px 16px 16px 16px", display: "flex", flexDirection: "column", gap: 8 }}>
                      {stops.map((a, i) => (
                        <div key={i} className="tp-fade-up" style={{ display: "flex", alignItems: "center", gap: 11, padding: "10px 13px", borderRadius: 12, background: P.surface, animationDelay: `${Math.min(i, 8) * 40}ms` }}>
                          <span style={{ flexShrink: 0, width: 23, height: 23, borderRadius: "50%", background: P.panel, border: `1px solid ${P.line}`, color: P.ink2, display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 11.5, fontWeight: 800 }}>{i + 1}</span>
                          <span style={{ flex: 1, minWidth: 0, fontSize: 15, fontWeight: 600, color: P.ink, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{a.nameHe || a.name}</span>
                          {a.category && <span style={{ flexShrink: 0, fontSize: 12, fontWeight: 700, color: P.ink3, background: P.panel, border: `1px solid ${P.line}`, borderRadius: 999, padding: "3px 10px" }}>{a.category}</span>}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Progressive disclosure — reveal the remaining days. */}
          {!showAllDays && hiddenDays > 0 && (
            <button onClick={() => setShowAllDays(true)} className="tp-press"
              style={{ display: "inline-flex", alignItems: "center", gap: 8, margin: "18px auto 0", width: "100%", justifyContent: "center", border: "none", background: "transparent", color: ACCENT, fontSize: 15, fontWeight: 800, cursor: "pointer", fontFamily: FONT, padding: "6px 0" }}>
              הציגו את כל מידע הימים (+{hiddenDays} ימים נוספים)
              <Icon name="chevronDown" size={16} strokeWidth={2.4} />
            </button>
          )}
        </section>
      </div>

      {/* ── Sticky action bar ──────────────────────────────────────
          Sprint 28 #1 — INVERTED hierarchy: "עריכת מסלול" is the
          prominent primary action; "הפעל מסלול" is a compact secondary
          control that opens the explanatory activation modal. */}
      <div style={{ position: "fixed", left: 0, right: 0, bottom: 0, zIndex: 50, display: "flex", justifyContent: "center", pointerEvents: "none" }}>
        <div style={{ width: "100%", maxWidth: OVERVIEW_MAX, margin: "0 auto", padding: "12px 20px 18px", background: `linear-gradient(to top, ${P.page} 62%, ${P.page}00)`, display: "flex", gap: 12, pointerEvents: "auto", alignItems: "center" }}>
          <button onClick={goEdit} className="tp-press tp-glow"
            style={{ flex: 1.4, height: 54, borderRadius: 999, border: "none", background: ACCENT, color: "#fff", fontSize: 15.5, fontWeight: 800, cursor: "pointer", fontFamily: FONT, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8, boxShadow: `0 6px 22px ${ACCENT}55` }}>
            <Icon name="edit" size={17} strokeWidth={2.1} />
            עריכת מסלול
          </button>
          {isActive ? (
            /* This trip is the live/active one — offer an explicit
               stand-down control instead of "activate". */
            <button onClick={stopTrip} className="tp-press"
              style={{ flexShrink: 0, height: 44, padding: "0 16px", borderRadius: 999, border: `1.5px solid ${ACCENT}`, background: `${ACCENT}12`, color: ACCENT, fontSize: 13, fontWeight: 800, cursor: "pointer", fontFamily: FONT, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6, transition: "background 0.2s" }}>
              <span aria-hidden style={{ fontSize: 14 }}>🛑</span>
              עצירת מסלול
            </button>
          ) : (
            <button onClick={() => setConfirmActivate(true)} disabled={activating} className="tp-press"
              style={{ flexShrink: 0, height: 44, padding: "0 16px", borderRadius: 999, border: `1px solid ${P.line}`, background: activating ? "#1FA67A" : P.panel, color: activating ? "#fff" : P.ink2, fontSize: 13, fontWeight: 800, cursor: activating ? "default" : "pointer", fontFamily: FONT, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6, transition: "background 0.25s, color 0.25s" }}>
              <Icon name={activating ? "check" : "sparkle"} size={15} strokeWidth={2.2} />
              {activating ? "הופעל!" : "הפעל מסלול"}
            </button>
          )}
        </div>
      </div>
      </>)}

      {/* Sprint 28 #1 — activation interception modal */}
      {confirmActivate && (
        <div style={{ position: "fixed", inset: 0, zIndex: 72, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
          <div onClick={() => setConfirmActivate(false)} className="tp-fade" style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.45)" }} />
          <div className="tp-pop" dir="rtl" style={{ position: "relative", width: "100%", maxWidth: 360, background: P.panel, borderRadius: 22, padding: "24px 22px", boxShadow: "0 30px 80px rgba(0,0,0,0.4)", textAlign: "center", fontFamily: FONT }}>
            <div style={{ width: 52, height: 52, borderRadius: "50%", background: `${ACCENT}14`, color: ACCENT, display: "inline-flex", alignItems: "center", justifyContent: "center", marginBottom: 12 }}>
              <Icon name="sparkle" size={24} strokeWidth={2} />
            </div>
            <div style={{ fontSize: 18, fontWeight: 800, color: P.ink, marginBottom: 8 }}>הפעלת מצב טיול</div>
            <div style={{ fontSize: 13.5, color: P.ink3, lineHeight: 1.6, marginBottom: 20 }}>
              מצב זה נועל את ציר הזמן לשימוש יציב במפה במהלך הטיול ומבצע אופטימיזציה לזמינות מהירה
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => setConfirmActivate(false)}
                style={{ flex: 1, height: 48, borderRadius: 999, border: `1px solid ${P.line}`, background: P.surface, color: P.ink, fontSize: 14.5, fontWeight: 700, cursor: "pointer", fontFamily: FONT }}>
                חזרה
              </button>
              <button onClick={() => { setConfirmActivate(false); activateTrip(); }}
                style={{ flex: 1, height: 48, borderRadius: 999, border: "none", background: ACCENT, color: "#fff", fontSize: 14.5, fontWeight: 800, cursor: "pointer", fontFamily: FONT }}>
                אישור
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Triumphant success toast ───────────────────────────── */}
      {toast && (
        <div className="tp-pop" style={{ position: "fixed", bottom: 92, left: "50%", transform: "translateX(-50%)", zIndex: 70, display: "inline-flex", alignItems: "center", gap: 9, background: P.ink, color: P.panel, borderRadius: 999, padding: "13px 22px", fontSize: 14.5, fontWeight: 800, fontFamily: FONT, boxShadow: `0 10px 30px ${ACCENT}55, 0 4px 14px rgba(0,0,0,0.25)`, whiteSpace: "nowrap" }}>
          <Icon name="check" size={17} strokeWidth={2.4} />
          {toast}
        </div>
      )}
    </div>
    </SwipeBackContainer>
  );
};

export default TripOverviewView;
