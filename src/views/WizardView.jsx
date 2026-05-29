import React, { useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import tripService from "../services/tripService";

/* ──────────────────────────────────────────────────────────────
   WizardView — dynamic global onboarding (3 steps + summary).
     1. Destination  — global picker; captures center {lng,lat,zoom}
     2. Duration     — tactile horizontal day bar, 1–45 days
     3. City routing — map city milestones to day ranges (optional)
     → Summary       — styled breakdown + inline edit per section
   On "התחילו לבנות" → createNewTrip(dynamic payload) → editor.
   Trip-pace / companions screens removed per spec.
   ────────────────────────────────────────────────────────────── */

const T = {
  ink: "#0D0F11", ink2: "#2A3036", ink3: "#6B7178", ink4: "#A4AAB1",
  line: "rgba(20,20,20,0.08)", surface: "#F6F6F4", accent: "#E0533F",
  font: "'Noto Sans Hebrew','Inter','Noto Sans JP',system-ui,sans-serif",
};

/* Global destinations with map center + default zoom (drives the
   editor's dynamic viewport instead of the hardcoded Japan view). */
const DESTINATIONS = [
  { id: "jp", flag: "🇯🇵", name: "יפן", en: "Japan", sub: "אסיה · 4–14 ימים", center: { lng: 138.2529, lat: 36.2048, zoom: 5 }, popular: true },
  { id: "it", flag: "🇮🇹", name: "איטליה", en: "Italy", sub: "אירופה · 7–14 ימים", center: { lng: 12.5674, lat: 41.8719, zoom: 5.4 } },
  { id: "pt", flag: "🇵🇹", name: "פורטוגל", en: "Portugal", sub: "אירופה · 7–10 ימים", center: { lng: -8.2245, lat: 39.5, zoom: 6 } },
  { id: "gr", flag: "🇬🇷", name: "יוון", en: "Greece", sub: "אירופה · 5–10 ימים", center: { lng: 23.7, lat: 38.5, zoom: 5.8 } },
  { id: "th", flag: "🇹🇭", name: "תאילנד", en: "Thailand", sub: "אסיה · 10–21 ימים", center: { lng: 100.9925, lat: 15.87, zoom: 5 } },
  { id: "vn", flag: "🇻🇳", name: "וייטנאם", en: "Vietnam", sub: "אסיה · 10–14 ימים", center: { lng: 108.2772, lat: 16.0, zoom: 5.2 } },
  { id: "ae", flag: "🇦🇪", name: "דובאי", en: "Dubai", sub: "המפרץ · 4–7 ימים", center: { lng: 55.2708, lat: 25.2048, zoom: 9 } },
  { id: "fr", flag: "🇫🇷", name: "צרפת", en: "France", sub: "אירופה · 5–10 ימים", center: { lng: 2.2137, lat: 46.2276, zoom: 5.2 } },
  { id: "es", flag: "🇪🇸", name: "ספרד", en: "Spain", sub: "אירופה · 7–12 ימים", center: { lng: -3.7492, lat: 40.0, zoom: 5.4 } },
  { id: "us", flag: "🇺🇸", name: "ארה״ב", en: "USA", sub: "צפון אמריקה · 10–21 ימים", center: { lng: -98.5, lat: 39.8, zoom: 3.6 } },
];

const Pip = ({ state }) => (
  <span style={{ width: state === "active" ? 22 : 7, height: 7, borderRadius: 999, background: state === "done" ? T.ink : state === "active" ? T.accent : "rgba(20,20,20,0.14)", transition: "all 0.2s" }} />
);

const Cta = ({ children, onClick, disabled }) => (
  <div style={{ padding: "12px 18px 24px" }}>
    <button onClick={onClick} disabled={disabled}
      style={{ width: "100%", height: 56, borderRadius: 999, border: "none", background: disabled ? "#D1CCC5" : T.ink, color: "#fff", fontSize: 16, fontWeight: 700, cursor: disabled ? "default" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, fontFamily: "inherit" }}>
      {children}
    </button>
  </div>
);

const WizardView = () => {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);          // 0..2 wizard, 3 = summary
  const [query, setQuery] = useState("");
  const [destId, setDestId] = useState("jp");
  const [dur, setDur] = useState(9);
  const [cities, setCities] = useState([]);      // [{ name, fromDay, toDay }]
  const [creating, setCreating] = useState(false);
  const dayBarRef = useRef(null);

  const dest = useMemo(() => DESTINATIONS.find((d) => d.id === destId), [destId]);
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return DESTINATIONS;
    return DESTINATIONS.filter((d) => d.name.includes(q) || d.en.toLowerCase().includes(q));
  }, [query]);

  const back = () => (step === 0 ? navigate("/dashboard") : setStep((s) => s - 1));

  /* City-routing helpers */
  const addCity = () => {
    const used = cities.reduce((m, c) => Math.max(m, c.toDay), 0);
    const from = Math.min(used + 1, dur);
    setCities([...cities, { name: "", fromDay: from, toDay: Math.min(from + 1, dur) }]);
  };
  const updateCity = (i, patch) => setCities(cities.map((c, idx) => (idx === i ? { ...c, ...patch } : c)));
  const removeCity = (i) => setCities(cities.filter((_, idx) => idx !== i));

  const finish = async () => {
    setCreating(true);
    /* Build day→city ranges payload (only rows with a name). */
    const cityRanges = cities
      .filter((c) => c.name.trim())
      .map((c) => ({ city: c.name.trim(), cityHe: c.name.trim(), fromDay: c.fromDay, toDay: c.toDay }));
    const trip = await tripService.createNewTrip({
      title: dest.name,
      destination: dest.en,
      destinationHe: dest.name,
      center: dest.center,
      days: dur,
      cityRanges,
      meta: `${dur} ימים · ${dest.name}`,
    });
    setCreating(false);
    navigate(`/map/edit/${trip.id}`);
  };

  /* Compact city-timeline string for the summary. */
  const cityTimeline = useMemo(() => {
    const named = cities.filter((c) => c.name.trim());
    if (!named.length) return null;
    return named
      .slice()
      .sort((a, b) => a.fromDay - b.fromDay)
      .map((c) => `${c.name.trim()} (${c.toDay - c.fromDay + 1} ימים)`)
      .join(" ← ");
  }, [cities]);

  return (
    <div dir="rtl" style={{ minHeight: "100vh", background: "#EDEDEC", fontFamily: T.font }}>
      <div style={{ maxWidth: 560, margin: "0 auto", background: "#fff", minHeight: "100vh", display: "flex", flexDirection: "column" }}>
        {/* Head */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 18px 6px" }}>
          <button onClick={back} style={{ width: 36, height: 36, borderRadius: "50%", border: "none", background: T.surface, cursor: "pointer", fontSize: 17, fontFamily: "inherit" }}>
            {step === 0 ? "✕" : "›"}
          </button>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            {[0, 1, 2].map((i) => <Pip key={i} state={i < Math.min(step, 3) ? "done" : i === step ? "active" : "todo"} />)}
          </div>
          <button onClick={() => setStep(step === 2 ? 3 : Math.min(3, step + 1))} style={{ border: "none", background: "none", color: T.ink3, fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", visibility: step === 2 ? "visible" : (step < 2 ? "hidden" : "hidden") }}>
            דלגו
          </button>
        </div>

        <div style={{ flex: 1, overflowY: "auto", padding: "10px 22px 0" }}>
          {/* STEP 1 — Destination */}
          {step === 0 && (
            <>
              <h1 style={{ fontSize: 26, fontWeight: 800, letterSpacing: "-0.022em", color: T.ink, margin: "6px 0 6px" }}>
                לאן <span style={{ color: T.accent }}>בא לכם</span> השנה?
              </h1>
              <p style={{ fontSize: 14, color: T.ink3, lineHeight: 1.55, marginBottom: 16 }}>בחרו יעד — נבנה שלד מסלול ונכוון את המפה למדינה.</p>
              <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "11px 14px", borderRadius: 16, background: T.surface, border: `1px solid ${T.line}`, marginBottom: 16 }}>
                <span aria-hidden>🔍</span>
                <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="חיפוש מדינה או עיר"
                  style={{ flex: 1, border: "none", background: "transparent", fontSize: 16, fontFamily: "inherit", direction: "rtl", textAlign: "right" }} />
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {filtered.map((c) => {
                  const on = destId === c.id;
                  return (
                    <button key={c.id} onClick={() => setDestId(c.id)}
                      style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", borderRadius: 16, cursor: "pointer", fontFamily: "inherit", textAlign: "right", border: `1.5px solid ${on ? T.ink : T.line}`, background: on ? "rgba(13,15,17,0.03)" : "#fff" }}>
                      <div style={{ fontSize: 26 }}>{c.flag}</div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 15, fontWeight: 800, color: T.ink }}>{c.name}{c.popular && <span style={{ fontSize: 10, fontWeight: 700, color: T.accent, marginInlineStart: 6 }}>פופולרי</span>}</div>
                        <div style={{ fontSize: 12, color: T.ink3 }}>{c.sub}</div>
                      </div>
                      <span style={{ color: on ? T.ink : T.ink4, fontSize: 18 }}>{on ? "✓" : "‹"}</span>
                    </button>
                  );
                })}
              </div>
            </>
          )}

          {/* STEP 2 — Duration (tactile day bar) */}
          {step === 1 && (
            <>
              <h1 style={{ fontSize: 26, fontWeight: 800, letterSpacing: "-0.022em", color: T.ink, margin: "6px 0 6px" }}>
                כמה <span style={{ color: T.accent }}>זמן</span> תטוסו?
              </h1>
              <p style={{ fontSize: 14, color: T.ink3, lineHeight: 1.55, marginBottom: 18 }}>החליקו לבחירת מספר הימים — בין 1 ל־45.</p>
              <div style={{ textAlign: "center", marginBottom: 18 }}>
                <span style={{ fontSize: 56, fontWeight: 800, color: T.ink, letterSpacing: "-0.03em", fontVariantNumeric: "tabular-nums" }}>{dur}</span>
                <span style={{ fontSize: 18, fontWeight: 700, color: T.ink3, marginInlineStart: 8 }}>ימים</span>
              </div>
              {/* Horizontal day bar */}
              <div ref={dayBarRef} style={{ display: "flex", gap: 6, overflowX: "auto", padding: "8px 2px 14px" }} className="scrollbar-hide">
                {Array.from({ length: 45 }, (_, i) => i + 1).map((n) => {
                  const on = n === dur;
                  const inRange = n <= dur;
                  return (
                    <button key={n} onClick={() => setDur(n)}
                      style={{ flexShrink: 0, width: 44, height: 56, borderRadius: 14, cursor: "pointer", fontFamily: "inherit", fontSize: 15, fontWeight: 800, fontVariantNumeric: "tabular-nums",
                        border: `1.5px solid ${on ? T.ink : (inRange ? T.accent + "44" : T.line)}`,
                        background: on ? T.ink : (inRange ? T.accent + "12" : "#fff"),
                        color: on ? "#fff" : (inRange ? T.accent : T.ink3) }}>
                      {n}
                    </button>
                  );
                })}
              </div>
              <div style={{ display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
                {[5, 7, 10, 14, 21, 30].map((d) => (
                  <button key={d} onClick={() => setDur(d)} style={{ padding: "8px 14px", borderRadius: 999, cursor: "pointer", fontFamily: "inherit", fontSize: 13, fontWeight: 600, border: `1px solid ${dur === d ? T.ink : T.line}`, background: dur === d ? T.ink : "#fff", color: dur === d ? "#fff" : T.ink2 }}>{d}</button>
                ))}
              </div>
            </>
          )}

          {/* STEP 3 — City routing */}
          {step === 2 && (
            <>
              <h1 style={{ fontSize: 26, fontWeight: 800, letterSpacing: "-0.022em", color: T.ink, margin: "6px 0 6px" }}>
                חלוקת <span style={{ color: T.accent }}>ערים</span> לפי ימים
              </h1>
              <p style={{ fontSize: 14, color: T.ink3, lineHeight: 1.55, marginBottom: 18 }}>אופציונלי — מפו ערים לטווחי ימים, ונמלא את כותרות הימים מראש.</p>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {cities.map((c, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 12px", borderRadius: 16, border: `1px solid ${T.line}`, background: "#fff" }}>
                    <input value={c.name} onChange={(e) => updateCity(i, { name: e.target.value })} placeholder="עיר (למשל טוקיו)"
                      style={{ flex: 1, minWidth: 0, border: "none", background: "transparent", fontSize: 15, fontFamily: "inherit", direction: "rtl", textAlign: "right" }} />
                    <span style={{ fontSize: 12, color: T.ink3 }}>ימים</span>
                    <select value={c.fromDay} onChange={(e) => updateCity(i, { fromDay: Math.min(+e.target.value, c.toDay) })} style={{ border: `1px solid ${T.line}`, borderRadius: 8, padding: "5px 6px", fontFamily: "inherit", fontSize: 13 }}>
                      {Array.from({ length: dur }, (_, k) => k + 1).map((n) => <option key={n} value={n}>{n}</option>)}
                    </select>
                    <span style={{ color: T.ink4 }}>–</span>
                    <select value={c.toDay} onChange={(e) => updateCity(i, { toDay: Math.max(+e.target.value, c.fromDay) })} style={{ border: `1px solid ${T.line}`, borderRadius: 8, padding: "5px 6px", fontFamily: "inherit", fontSize: 13 }}>
                      {Array.from({ length: dur }, (_, k) => k + 1).map((n) => <option key={n} value={n}>{n}</option>)}
                    </select>
                    <button onClick={() => removeCity(i)} style={{ border: "none", background: "transparent", color: T.ink4, cursor: "pointer", fontSize: 16, fontFamily: "inherit" }}>✕</button>
                  </div>
                ))}
              </div>
              <button onClick={addCity} style={{ marginTop: 12, width: "100%", padding: 14, borderRadius: 16, border: `2px dashed ${T.line}`, background: "transparent", color: T.ink2, fontSize: 14, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
                ＋ הוסף עיר
              </button>
            </>
          )}

          {/* SUMMARY */}
          {step === 3 && (
            <>
              <div style={{ display: "inline-flex", alignItems: "center", gap: 6, background: T.surface, padding: "5px 12px", borderRadius: 999, fontSize: 11.5, fontWeight: 700, letterSpacing: "0.06em", color: T.ink2, marginTop: 4 }}>
                ✨ המסלול שלכם מוכן
              </div>
              <h1 style={{ fontSize: 26, fontWeight: 800, letterSpacing: "-0.022em", color: T.ink, margin: "12px 0 16px" }}>
                {dest.flag} {dest.name} · <span style={{ color: T.accent }}>{dur} ימים</span>
              </h1>

              {/* Summary cards with inline edit */}
              <SummaryRow label="יעד" value={`${dest.flag} ${dest.name}`} onEdit={() => setStep(0)} />
              <SummaryRow label="משך" value={`${dur} ימים`} onEdit={() => setStep(1)} />
              <SummaryRow label="חלוקת ערים" value={cityTimeline || "לא הוגדרה — נבנה תוך כדי"} onEdit={() => setStep(2)} muted={!cityTimeline} />

              <div style={{ display: "flex", gap: 10, marginTop: 18, alignItems: "flex-start" }}>
                {[
                  { ic: "🗺", t: "מפה דינמית", s: `נתכוונן ל${dest.name} אוטומטית` },
                  { ic: "🔎", t: "הוספת תחנות", s: "חיפוש / פין ידני בכל יום" },
                  { ic: "🚆", t: "זמנים אוטומטיים", s: "הליכה/תחבורה בין תחנות" },
                ].map((h, i) => (
                  <div key={i} style={{ flex: 1, textAlign: "center" }}>
                    <div style={{ width: 40, height: 40, borderRadius: 12, background: T.surface, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, margin: "0 auto 6px" }}>{h.ic}</div>
                    <div style={{ fontSize: 12.5, fontWeight: 700, color: T.ink }}>{h.t}</div>
                    <div style={{ fontSize: 11, color: T.ink3, marginTop: 2, lineHeight: 1.4 }}>{h.s}</div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Footer CTA */}
        {step < 2 && <Cta onClick={() => setStep(step + 1)}>המשך{step === 1 ? ` · ${dur} ימים` : ""} <span aria-hidden>←</span></Cta>}
        {step === 2 && <Cta onClick={() => setStep(3)}>סקירה אחרונה <span aria-hidden>←</span></Cta>}
        {step === 3 && <Cta onClick={finish} disabled={creating}>{creating ? "יוצר…" : "התחילו לבנות"} <span aria-hidden>←</span></Cta>}
      </div>
    </div>
  );
};

/* Summary row with an inline edit affordance. */
const SummaryRow = ({ label, value, onEdit, muted }) => (
  <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 16px", borderRadius: 16, border: `1px solid ${T.line}`, background: "#fff", marginBottom: 10 }}>
    <div style={{ flex: 1, minWidth: 0 }}>
      <div style={{ fontSize: 11, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.06em", color: T.ink3, marginBottom: 3 }}>{label}</div>
      <div style={{ fontSize: 15, fontWeight: 700, color: muted ? T.ink4 : T.ink }}>{value}</div>
    </div>
    <button onClick={onEdit} style={{ border: `1px solid ${T.line}`, background: T.surface, borderRadius: 999, padding: "6px 14px", fontSize: 12.5, fontWeight: 700, color: T.ink2, cursor: "pointer", fontFamily: "inherit" }}>
      עריכה
    </button>
  </div>
);

export default WizardView;
