import React, { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import tripService from "../services/tripService";

/* ──────────────────────────────────────────────────────────────
   WizardView — 4-step "create itinerary" flow (home-wizard.jsx).
     1. Destination (search + popular list)
     2. Dates / duration chips
     3. Style (pace + companions, skippable)
     4. Result → createNewTrip(settings) → editor
   RTL Hebrew, white premium surface, step-pip progress, 60px CTA.
   ────────────────────────────────────────────────────────────── */

const T = {
  ink: "#0D0F11", ink2: "#2A3036", ink3: "#6B7178", ink4: "#A4AAB1",
  line: "rgba(20,20,20,0.08)", surface: "#F6F6F4", accent: "#E0533F",
  font: "'Noto Sans Hebrew','Inter','Noto Sans JP',system-ui,sans-serif",
};

const COUNTRIES = [
  { id: "jp", flag: "🇯🇵", name: "יפן", en: "Japan", sub: "אסיה · 4–14 ימים מומלץ", popular: true },
  { id: "pt", flag: "🇵🇹", name: "פורטוגל", en: "Portugal", sub: "אירופה · 7–10 ימים" },
  { id: "it", flag: "🇮🇹", name: "איטליה", en: "Italy", sub: "אירופה · 7–14 ימים" },
  { id: "gr", flag: "🇬🇷", name: "יוון", en: "Greece", sub: "אירופה · 5–10 ימים" },
  { id: "th", flag: "🇹🇭", name: "תאילנד", en: "Thailand", sub: "אסיה · 10–21 ימים" },
  { id: "vn", flag: "🇻🇳", name: "וייטנאם", en: "Vietnam", sub: "אסיה · 10–14 ימים" },
  { id: "ae", flag: "🇦🇪", name: "דובאי", en: "Dubai", sub: "המפרץ · 4–7 ימים" },
  { id: "fr", flag: "🇫🇷", name: "צרפת", en: "France", sub: "אירופה · 5–10 ימים" },
];

const Pip = ({ state }) => (
  <span style={{
    width: state === "active" ? 22 : 7, height: 7, borderRadius: 999,
    background: state === "done" ? T.ink : state === "active" ? T.accent : "rgba(20,20,20,0.14)",
    transition: "all 0.2s",
  }} />
);

const StepHead = ({ step, onBack, onSkip }) => (
  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 18px 6px" }}>
    <button onClick={onBack} style={{ width: 36, height: 36, borderRadius: "50%", border: "none", background: T.surface, cursor: "pointer", fontSize: 17, fontFamily: "inherit" }}>
      {step === 0 ? "✕" : "›"}
    </button>
    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
      {[0, 1, 2].map((i) => <Pip key={i} state={i < step ? "done" : i === step ? "active" : "todo"} />)}
    </div>
    <button onClick={onSkip} style={{ border: "none", background: "none", color: T.ink3, fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
      {onSkip ? "דלגו" : ""}
    </button>
  </div>
);

const Cta = ({ children, onClick, disabled }) => (
  <div style={{ padding: "12px 18px 24px" }}>
    <button onClick={onClick} disabled={disabled}
      style={{ width: "100%", height: 56, borderRadius: 999, border: "none", background: disabled ? "#D1CCC5" : T.ink, color: "#fff", fontSize: 16, fontWeight: 700, cursor: disabled ? "default" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, fontFamily: "inherit" }}>
      {children}
    </button>
  </div>
);

const DURATIONS = [5, 7, 9, 10, 14, 21];
const PACES = [
  { id: "relaxed", ic: "🍵", lbl: "רגוע", desc: "2–3 תחנות ביום" },
  { id: "balanced", ic: "⚖️", lbl: "מאוזן", desc: "3–5 תחנות ביום" },
  { id: "intense", ic: "⚡", lbl: "אינטנסיבי", desc: "5+ תחנות ביום" },
  { id: "flex", ic: "🍃", lbl: "גמיש", desc: "בלי לוחות זמנים" },
];
const COMPANIONS = [
  { id: "solo", ic: "🚶", lbl: "סולו", desc: "נסיעה עצמאית" },
  { id: "couple", ic: "👫", lbl: "זוגי", desc: "שניכם רק" },
  { id: "family", ic: "👨‍👩‍👧", lbl: "משפחה", desc: "עם ילדים" },
  { id: "friends", ic: "👥", lbl: "חברים", desc: "קבוצה קטנה" },
];

const WizardView = () => {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [query, setQuery] = useState("");
  const [dest, setDest] = useState("jp");
  const [dur, setDur] = useState(9);
  const [pace, setPace] = useState("balanced");
  const [comp, setComp] = useState("couple");
  const [creating, setCreating] = useState(false);

  const country = useMemo(() => COUNTRIES.find((c) => c.id === dest), [dest]);
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return COUNTRIES;
    return COUNTRIES.filter((c) => c.name.includes(q) || c.en.toLowerCase().includes(q));
  }, [query]);

  const back = () => (step === 0 ? navigate("/dashboard") : setStep((s) => s - 1));
  const next = () => setStep((s) => Math.min(3, s + 1));

  const finish = async () => {
    setCreating(true);
    const trip = await tripService.createNewTrip({
      title: country.name,
      destination: country.en,
      destinationHe: country.name,
      days: dur,
      pace, companion: comp,
      meta: `${dur} ימים · ${country.name}`,
    });
    setCreating(false);
    navigate(`/map/edit/${trip.id}`);
  };

  const OptGrid = ({ options, value, onPick }) => (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 22 }}>
      {options.map((o) => {
        const on = value === o.id;
        return (
          <button key={o.id} onClick={() => onPick(o.id)}
            style={{ textAlign: "right", padding: "14px", borderRadius: 16, cursor: "pointer", fontFamily: "inherit",
              border: `1.5px solid ${on ? T.ink : T.line}`, background: on ? "rgba(13,15,17,0.03)" : "#fff" }}>
            <div style={{ fontSize: 22, marginBottom: 6 }}>{o.ic}</div>
            <div style={{ fontSize: 15, fontWeight: 800, color: T.ink }}>{o.lbl}</div>
            <div style={{ fontSize: 12, color: T.ink3, marginTop: 2 }}>{o.desc}</div>
          </button>
        );
      })}
    </div>
  );

  return (
    <div dir="rtl" style={{ minHeight: "100vh", background: "#EDEDEC", fontFamily: T.font }}>
      <div style={{ maxWidth: 560, margin: "0 auto", background: "#fff", minHeight: "100vh", display: "flex", flexDirection: "column" }}>
        <StepHead step={step} onBack={back} onSkip={step === 2 ? next : (step === 1 ? next : null)} />

        <div style={{ flex: 1, overflowY: "auto", padding: "10px 22px 0" }}>
          {/* Step 1 — Destination */}
          {step === 0 && (
            <>
              <h1 style={{ fontSize: 26, fontWeight: 800, letterSpacing: "-0.022em", color: T.ink, margin: "6px 0 6px" }}>
                לאן <span style={{ color: T.accent }}>בא לכם</span> השנה?
              </h1>
              <p style={{ fontSize: 14, color: T.ink3, lineHeight: 1.55, marginBottom: 16 }}>בחרו יעד כדי שנבנה לכם שלד מסלול מותאם.</p>
              <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "11px 14px", borderRadius: 16, background: T.surface, border: `1px solid ${T.line}`, marginBottom: 16 }}>
                <span aria-hidden>🔍</span>
                <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="חיפוש מדינה או עיר"
                  style={{ flex: 1, border: "none", background: "transparent", fontSize: 16, fontFamily: "inherit", direction: "rtl", textAlign: "right" }} />
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {filtered.map((c) => {
                  const on = dest === c.id;
                  return (
                    <button key={c.id} onClick={() => setDest(c.id)}
                      style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", borderRadius: 16, cursor: "pointer", fontFamily: "inherit", textAlign: "right",
                        border: `1.5px solid ${on ? T.ink : T.line}`, background: on ? "rgba(13,15,17,0.03)" : "#fff" }}>
                      <div style={{ fontSize: 26 }}>{c.flag}</div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 15, fontWeight: 800, color: T.ink }}>
                          {c.name}{c.popular && <span style={{ fontSize: 10, fontWeight: 700, color: T.accent, marginInlineStart: 6 }}>פופולרי</span>}
                        </div>
                        <div style={{ fontSize: 12, color: T.ink3 }}>{c.sub}</div>
                      </div>
                      <span style={{ color: on ? T.ink : T.ink4, fontSize: 18 }}>{on ? "✓" : "‹"}</span>
                    </button>
                  );
                })}
              </div>
            </>
          )}

          {/* Step 2 — Duration */}
          {step === 1 && (
            <>
              <h1 style={{ fontSize: 26, fontWeight: 800, letterSpacing: "-0.022em", color: T.ink, margin: "6px 0 6px" }}>
                כמה <span style={{ color: T.accent }}>זמן</span> תטוסו?
              </h1>
              <p style={{ fontSize: 14, color: T.ink3, lineHeight: 1.55, marginBottom: 18 }}>בחרו משך מועדף — אפשר לעדכן אחר כך.</p>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {DURATIONS.map((d) => {
                  const on = dur === d;
                  return (
                    <button key={d} onClick={() => setDur(d)}
                      style={{ padding: "12px 18px", borderRadius: 999, cursor: "pointer", fontFamily: "inherit", fontSize: 15, fontWeight: 700,
                        border: `1.5px solid ${on ? T.ink : T.line}`, background: on ? T.ink : "#fff", color: on ? "#fff" : T.ink2 }}>
                      {d} ימים
                    </button>
                  );
                })}
              </div>
            </>
          )}

          {/* Step 3 — Style */}
          {step === 2 && (
            <>
              <h1 style={{ fontSize: 26, fontWeight: 800, letterSpacing: "-0.022em", color: T.ink, margin: "6px 0 6px" }}>
                איך תרגישו <span style={{ color: T.accent }}>בטיול</span>?
              </h1>
              <p style={{ fontSize: 14, color: T.ink3, lineHeight: 1.55, marginBottom: 18 }}>אופציונלי — עוזר לנו לכוון את בניית הימים.</p>
              <div style={{ fontSize: 11, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.08em", color: T.ink3, marginBottom: 10 }}>קצב הטיול</div>
              <OptGrid options={PACES} value={pace} onPick={setPace} />
              <div style={{ fontSize: 11, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.08em", color: T.ink3, marginBottom: 10 }}>עם מי</div>
              <OptGrid options={COMPANIONS} value={comp} onPick={setComp} />
            </>
          )}

          {/* Step 4 — Result */}
          {step === 3 && (
            <>
              <div style={{ display: "inline-flex", alignItems: "center", gap: 6, background: T.surface, padding: "5px 12px", borderRadius: 999, fontSize: 11.5, fontWeight: 700, letterSpacing: "0.06em", color: T.ink2, marginTop: 4 }}>
                ✨ המסלול שלכם מוכן
              </div>
              <h1 style={{ fontSize: 26, fontWeight: 800, letterSpacing: "-0.022em", color: T.ink, margin: "12px 0 6px" }}>
                {country.name} · <span style={{ color: T.accent }}>{dur} ימים</span>
              </h1>
              <p style={{ fontSize: 14, color: T.ink3, lineHeight: 1.55, marginBottom: 16 }}>
                המסגרת מוכנה. עכשיו תוסיפו מקומות יום אחר יום — חיפוש/פין ידני, גרירה, וזמני נסיעה אוטומטיים.
              </p>
              <div style={{ display: "flex", gap: 8, overflowX: "auto", padding: "4px 0 14px" }} className="scrollbar-hide">
                {Array.from({ length: dur }, (_, i) => i + 1).map((n) => (
                  <div key={n} style={{ flexShrink: 0, width: 48, height: 48, borderRadius: "50%", background: n === 1 ? T.ink : T.surface, color: n === 1 ? "#fff" : T.ink, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", fontWeight: 700, border: n === 1 ? "none" : `1px solid ${T.line}` }}>
                    <span style={{ fontSize: 8, opacity: 0.7 }}>יום</span>
                    <span style={{ fontSize: 15 }}>{n}</span>
                  </div>
                ))}
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 4 }}>
                {[
                  { ic: "🔎", t: "חיפוש / פין ידני", s: "הוסיפו מסעדה, מקדש או נקודת תצפית למפה." },
                  { ic: "↕", t: "גרירה לסידור", s: "סדרו את התחנות — המפה מתעדכנת בזמן אמת." },
                  { ic: "🚆", t: "זמנים אוטומטיים", s: "נחשב הליכה/תחבורה בין כל שתי תחנות." },
                ].map((h, i) => (
                  <div key={i} style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                    <div style={{ width: 32, height: 32, borderRadius: 10, background: T.surface, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{h.ic}</div>
                    <div style={{ flex: 1, paddingTop: 2 }}>
                      <div style={{ fontSize: 13.5, fontWeight: 700, color: T.ink }}>{h.t}</div>
                      <div style={{ fontSize: 12, color: T.ink3, marginTop: 2, lineHeight: 1.5 }}>{h.s}</div>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Footer CTA */}
        {step < 3 ? (
          <Cta onClick={next}>
            המשך{step === 1 ? ` · ${dur} ימים` : ""} <span aria-hidden>←</span>
          </Cta>
        ) : (
          <Cta onClick={finish} disabled={creating}>
            {creating ? "יוצר…" : "התחילו לבנות"} <span aria-hidden>←</span>
          </Cta>
        )}
      </div>
    </div>
  );
};

export default WizardView;
