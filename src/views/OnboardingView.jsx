import React, { useState } from "react";
import { useNavigate } from "react-router-dom";

/* ──────────────────────────────────────────────────────────────
   OnboardingView — first-visit walkthrough (5 steps).

   Each step is a full-screen photo hero with a bottom-aligned
   gradient that holds the headline, body, page dots, and the
   Skip / Next buttons. Persists a localStorage flag once
   completed/skipped so it never shows again.

   Mounted at /welcome. The Landing route detects the flag and
   redirects new visitors here before the real Landing renders.
   ────────────────────────────────────────────────────────────── */

const FLAG_KEY = "tp_onboarded_v1";
export const isOnboarded = () => {
  try { return localStorage.getItem(FLAG_KEY) === "1"; } catch { return false; }
};

const STEPS = [
  {
    img: "/photos/home/hero_couple_fuji.png",
    title: "תכננו את הטיול\nהבא שלכם",
    body: "בנו מסלולים אישיים ליעדים מכל העולם — בלי טבלאות, בלי כאוס.",
  },
  {
    img: "/photos/source/day25_chureito.jpg",
    title: "חיפוש מקומות\nוהוספה למפה",
    body: "מצאו מסעדות, אטרקציות ונקודות תצפית ב־Google Maps או נעצו ידנית.",
  },
  {
    img: "/photos/source/day17_arashiyama-bamboo.jpg",
    title: "סדרו ביום\nאחר יום",
    body: "גררו תחנות לסדר הנכון — זמני הליכה ותחבורה בין כל שתי תחנות נחשבים אוטומטית.",
  },
  {
    img: "/photos/source/day29_starbucks-reserve.jpg",
    title: "שתפו ועבדו\nביחד",
    body: "שלחו קישור ושתפו עריכה או צפייה עם מי שיוצא איתכם — בדיוק כמו ב־Google Sheets.",
  },
  {
    img: "/photos/source/day23_lake-kawaguchiko.jpg",
    title: "צאו לדרך\nבביטחון",
    body: "סנכרון אוטומטי בין המכשירים, גישה גם בלי רשת, וכל המסלול בכיס שלכם.",
  },
];

const FONT = "'Noto Sans Hebrew','Inter','Noto Sans JP',system-ui,sans-serif";
const ACCENT = "#E0533F";

const finish = () => {
  try { localStorage.setItem(FLAG_KEY, "1"); } catch { /* noop */ }
};

const OnboardingView = () => {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const total = STEPS.length;
  const s = STEPS[step];

  const exit = () => { finish(); navigate("/", { replace: true }); };
  const next = () => {
    if (step >= total - 1) return exit();
    setStep((n) => n + 1);
  };

  return (
    <div dir="rtl" style={{ position: "fixed", inset: 0, fontFamily: FONT, background: "#000", overflow: "hidden" }}>
      {/* Full-screen photo */}
      <img
        key={s.img}
        src={s.img}
        alt=""
        className="tp-fade"
        style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }}
      />

      {/* Bottom gradient + copy */}
      <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, padding: "26vh 28px 28px", background: "linear-gradient(to top, rgba(0,0,0,0.92) 0%, rgba(0,0,0,0.85) 35%, rgba(0,0,0,0.55) 70%, rgba(0,0,0,0) 100%)", color: "#fff", textAlign: "center" }}>
        {/* Headline */}
        <h1 key={`t-${step}`} className="tp-fade-up" style={{ fontSize: 32, fontWeight: 800, letterSpacing: "-0.022em", lineHeight: 1.15, margin: 0, whiteSpace: "pre-line" }}>
          {s.title}
        </h1>
        <p key={`b-${step}`} className="tp-fade-up" style={{ fontSize: 14.5, lineHeight: 1.6, color: "rgba(255,255,255,0.85)", margin: "14px auto 20px", maxWidth: 420, animationDelay: "0.08s" }}>
          {s.body}
        </p>

        {/* Page dots */}
        <div style={{ display: "flex", gap: 6, justifyContent: "center", marginBottom: 22 }}>
          {STEPS.map((_, i) => (
            <span key={i}
              style={{
                width: i === step ? 22 : 7, height: 7, borderRadius: 999,
                background: i === step ? "#fff" : "rgba(255,255,255,0.4)",
                transition: "all 0.25s ease",
              }} />
          ))}
        </div>

        {/* Skip / Next */}
        <div style={{ display: "flex", gap: 12, maxWidth: 420, margin: "0 auto" }}>
          <button onClick={exit} className="tp-press"
            style={{ flex: 1, height: 52, borderRadius: 999, border: "none", background: "rgba(255,255,255,0.16)", color: "#fff", fontSize: 15.5, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", backdropFilter: "blur(8px)" }}>
            {step >= total - 1 ? "סיום" : "דלגו"}
          </button>
          <button onClick={next} className="tp-press"
            style={{ flex: 1, height: 52, borderRadius: 999, border: "none", background: "#fff", color: "#0D0F11", fontSize: 15.5, fontWeight: 800, cursor: "pointer", fontFamily: "inherit" }}>
            {step >= total - 1 ? "בואו נתחיל" : "הבא"}
          </button>
        </div>
      </div>

      {/* Step counter top-left */}
      <div style={{ position: "absolute", top: 18, insetInlineStart: 18, fontSize: 12.5, fontWeight: 700, color: "rgba(255,255,255,0.7)", letterSpacing: "0.06em" }}>
        {step + 1} / {total}
      </div>
      <button onClick={exit} className="tp-press"
        style={{ position: "absolute", top: 14, insetInlineEnd: 14, height: 32, padding: "0 14px", borderRadius: 999, border: "1px solid rgba(255,255,255,0.3)", background: "rgba(0,0,0,0.35)", color: "#fff", fontSize: 12.5, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", backdropFilter: "blur(6px)" }}>
        דלגו על ההיכרות
      </button>
    </div>
  );
};

export default OnboardingView;
export { ACCENT };
