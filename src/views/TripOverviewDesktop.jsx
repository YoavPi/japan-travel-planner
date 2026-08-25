import React from "react";
import Icon from "../components/Icon";

/* ══════════════════════════════════════════════════════════════
   TripOverviewDesktop — the ≥1024px trip preview, built full-bleed
   like a real web page: a full-width cover banner, then a two-column
   body — the day-by-day itinerary (main, left) beside a sticky
   summary + actions rail (right). No centered "wide phone" column,
   no fixed floating bottom action bar (actions live in the rail).

   Pure presentation; all data + handlers are threaded from
   TripOverviewView, which keeps the mobile layout + modals. Mobile
   never mounts this.
   ══════════════════════════════════════════════════════════════ */

const FONT = "'Noto Sans Hebrew','Inter','Noto Sans JP',system-ui,sans-serif";
const ACCENT = "#E0533F";

const Metric = ({ P, value, label }) => (
  <div style={{ textAlign: "center" }}>
    <div style={{ fontSize: 26, fontWeight: 800, color: P.ink, lineHeight: 1.1, fontVariantNumeric: "tabular-nums", letterSpacing: "-0.02em" }}>{value}</div>
    <div style={{ fontSize: 12.5, color: P.ink3, marginTop: 4 }}>{label}</div>
  </div>
);

const TripOverviewDesktop = ({
  P, trip, lm, country, totalDays, totalStops, cities,
  visibleDays, expanded, toggleDay, showAllDays, setShowAllDays, hiddenDays,
  navigate, goEdit, isActive, stopTrip, onActivate, activating,
}) => {
  return (
    <div dir="rtl" style={{ minHeight: "100vh", background: P.page, fontFamily: FONT }}>
      <style>{`
        @keyframes tovGlow { 0%,100%{box-shadow:0 6px 22px ${ACCENT}55,0 0 0 0 ${ACCENT}44} 50%{box-shadow:0 10px 30px ${ACCENT}77,0 0 0 8px ${ACCENT}00} }
        .tov-glow{animation:tovGlow 2.4s ease-in-out infinite}
      `}</style>

      {/* ── Full-bleed cover banner ───────────────────────────── */}
      <div style={{
        position: "relative", width: "100%", height: 320,
        background: trip.cover
          ? `center/cover url(${trip.cover}), linear-gradient(145deg, ${lm.g[0]}, ${lm.g[1]})`
          : `linear-gradient(145deg, ${lm.g[0]}, ${lm.g[1]})`,
      }}>
        {!trip.cover && (
          <span aria-hidden style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 120, opacity: 0.5, filter: "drop-shadow(0 4px 12px rgba(0,0,0,0.3))" }}>{lm.e}</span>
        )}
        <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to bottom, rgba(0,0,0,0.42) 0%, rgba(0,0,0,0.05) 34%, rgba(0,0,0,0.55) 100%)" }} />
        {/* Top bar over the banner */}
        <div style={{ position: "absolute", top: 0, left: 0, right: 0, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "20px 32px" }}>
          <button onClick={() => navigate("/dashboard")} title="חזרה למפות שלי" className="tp-press"
            style={{ display: "inline-flex", alignItems: "center", gap: 8, height: 40, padding: "0 16px", borderRadius: 999, border: "none", background: "rgba(0,0,0,0.42)", backdropFilter: "blur(8px)", color: "#fff", cursor: "pointer", fontFamily: "inherit", fontSize: 13.5, fontWeight: 700 }}>
            <Icon name="chevronStart" size={16} strokeWidth={2.2} /> המפות שלי
          </button>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "rgba(0,0,0,0.42)", backdropFilter: "blur(8px)", color: "#fff", fontSize: 12.5, fontWeight: 700, borderRadius: 999, padding: "7px 14px" }}>
            <Icon name="globe" size={13} strokeWidth={2} />{country}
          </span>
        </div>
        {/* Title over the banner */}
        <div style={{ position: "absolute", bottom: 0, left: 0, right: 0 }}>
          <div style={{ maxWidth: 1200, margin: "0 auto", padding: "0 32px 26px" }}>
            <div style={{ fontSize: 12.5, fontWeight: 700, color: "rgba(255,255,255,0.85)", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 8 }}>סקירת מסלול</div>
            <h1 style={{ margin: 0, fontSize: "clamp(38px, 4.4vw, 60px)", fontWeight: 800, color: "#fff", lineHeight: 1.08, letterSpacing: "-0.03em", textShadow: "0 2px 20px rgba(0,0,0,0.4)" }}>{trip.title}</h1>
          </div>
        </div>
      </div>

      {/* ── Two-column body ───────────────────────────────────── */}
      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "36px 32px 80px", display: "flex", gap: 32, alignItems: "flex-start", flexDirection: "row-reverse" }}>

        {/* Summary + actions rail (sticky). row-reverse puts it on the LEFT. */}
        <aside style={{ width: 320, flexShrink: 0, position: "sticky", top: 24, display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ background: P.panel, border: `1px solid ${P.line}`, borderRadius: 20, padding: 22 }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
              <Metric P={P} value={totalDays} label='סה"כ ימים' />
              <div style={{ width: 1, background: P.line }} />
              <Metric P={P} value={totalStops} label="עצירות" />
              <div style={{ width: 1, background: P.line }} />
              <Metric P={P} value={cities.length || 1} label="ערים" />
            </div>
          </div>

          <div style={{ background: P.panel, border: `1px solid ${P.line}`, borderRadius: 20, padding: 22 }}>
            <div style={{ fontSize: 12, fontWeight: 800, color: P.ink3, letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 12 }}>מה תכננו</div>
            <p style={{ margin: 0, fontSize: 15, lineHeight: 1.65, color: P.ink2 }}>
              {totalStops > 0
                ? <>מסלול בן <b style={{ color: P.ink }}>{totalDays} ימים</b> ב{country}, עם <b style={{ color: P.ink }}>{totalStops} עצירות</b>{cities.length > 1 ? <> לאורך <b style={{ color: P.ink }}>{cities.length} ערים</b></> : null}.</>
                : <>שלד מסלול בן <b style={{ color: P.ink }}>{totalDays} ימים</b> ב{country} — עדיין ללא עצירות.</>}
            </p>
            {cities.length > 0 && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 7, marginTop: 14 }}>
                {cities.map((c, i) => (
                  <span key={c} style={{ display: "inline-flex", alignItems: "center", gap: 6, background: P.surface, color: P.ink2, fontSize: 12.5, fontWeight: 700, borderRadius: 999, padding: "5px 11px" }}>
                    <span style={{ width: 17, height: 17, borderRadius: "50%", background: P.ink, color: P.panel, display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 9.5, fontWeight: 800 }}>{i + 1}</span>{c}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Actions */}
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <button onClick={goEdit} className="tp-press tov-glow"
              style={{ height: 52, borderRadius: 14, border: "none", background: ACCENT, color: "#fff", fontSize: 15.5, fontWeight: 800, cursor: "pointer", fontFamily: "inherit", display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8, boxShadow: `0 6px 22px ${ACCENT}55` }}>
              <Icon name="edit" size={17} strokeWidth={2.1} /> עריכת מסלול
            </button>
            {isActive ? (
              <button onClick={stopTrip} className="tp-press"
                style={{ height: 46, borderRadius: 14, border: `1.5px solid ${ACCENT}`, background: `${ACCENT}12`, color: ACCENT, fontSize: 13.5, fontWeight: 800, cursor: "pointer", fontFamily: "inherit", display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 7 }}>
                <span aria-hidden>🛑</span> עצירת מסלול
              </button>
            ) : (
              <button onClick={onActivate} disabled={activating} className="tp-press"
                style={{ height: 46, borderRadius: 14, border: `1px solid ${P.line}`, background: activating ? "#1FA67A" : P.panel, color: activating ? "#fff" : P.ink2, fontSize: 13.5, fontWeight: 800, cursor: activating ? "default" : "pointer", fontFamily: "inherit", display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 7 }}>
                <Icon name={activating ? "check" : "sparkle"} size={15} strokeWidth={2.2} /> {activating ? "מפעיל…" : "הפעל מסלול"}
              </button>
            )}
          </div>
        </aside>

        {/* Itinerary main column */}
        <main style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 800, color: P.ink3, letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 16 }}>מה קורה בכל יום</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: 14, alignItems: "start" }}>
            {visibleDays.map((d) => {
              const stops = (d.attractions || []).filter((a) => a.nameHe || a.name);
              const cityHe = d.cityHe || d.city || "";
              const open = expanded.has(d.day);
              const hasStops = stops.length > 0;
              return (
                <div key={d.day} style={{ background: P.panel, border: `1px solid ${P.line}`, borderRadius: 16, overflow: "hidden", alignSelf: "start" }}>
                  <button onClick={() => hasStops && toggleDay(d.day)}
                    style={{ display: "flex", alignItems: "center", gap: 14, width: "100%", textAlign: "right", padding: "16px", border: "none", background: "transparent", cursor: hasStops ? "pointer" : "default", fontFamily: FONT }}>
                    <span style={{ flexShrink: 0, width: 44, height: 44, borderRadius: 13, background: P.ink, color: P.panel, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", lineHeight: 1 }}>
                      <span style={{ fontSize: 9.5, fontWeight: 700, opacity: 0.7 }}>יום</span>
                      <span style={{ fontSize: 17, fontWeight: 800 }}>{d.day}</span>
                    </span>
                    <span style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 5 }}>
                      <span style={{ fontSize: 16.5, fontWeight: 800, color: P.ink }}>{cityHe || "—"}</span>
                      <span style={{ display: "inline-flex", alignItems: "center", alignSelf: "flex-start", gap: 6, background: hasStops ? P.surface : "transparent", color: hasStops ? P.ink2 : P.ink4, fontSize: 12.5, fontWeight: 700, borderRadius: 999, padding: hasStops ? "4px 11px" : 0 }}>
                        {hasStops && <Icon name="pin" size={12} strokeWidth={2} />}{hasStops ? `${stops.length} נקודות עניין` : "ללא עצירות"}
                      </span>
                    </span>
                    {hasStops && (
                      <span style={{ flexShrink: 0, color: P.ink3, transform: open ? "rotate(180deg)" : "none", transition: "transform 0.25s ease", display: "inline-flex" }}>
                        <Icon name="chevronDown" size={18} strokeWidth={2} />
                      </span>
                    )}
                  </button>
                  {open && hasStops && (
                    <div style={{ padding: "2px 16px 16px", display: "flex", flexDirection: "column", gap: 8 }}>
                      {stops.map((a, i) => (
                        <div key={i} style={{ display: "flex", alignItems: "center", gap: 11, padding: "10px 13px", borderRadius: 12, background: P.surface }}>
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
          {!showAllDays && hiddenDays > 0 && (
            <button onClick={() => setShowAllDays(true)} className="tp-press"
              style={{ display: "inline-flex", alignItems: "center", gap: 8, margin: "20px 0 0", border: "none", background: "transparent", color: ACCENT, fontSize: 15, fontWeight: 800, cursor: "pointer", fontFamily: FONT, padding: "6px 0" }}>
              הציגו את כל הימים (+{hiddenDays} נוספים) <Icon name="chevronDown" size={16} strokeWidth={2.4} />
            </button>
          )}
        </main>
      </div>
    </div>
  );
};

export default TripOverviewDesktop;
