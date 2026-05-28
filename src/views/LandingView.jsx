import React from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

/* ──────────────────────────────────────────────────────────────
   LandingView — the SaaS platform HOME PAGE ("עמוד הבית הראשי").

   Built from the home-variant-a blueprint (classic/Discover
   direction). RTL Hebrew, white premium surface using the
   blueprint design tokens. Two primary CTAs per the spec:
     • "צפו בטיול לדוגמה (יפן)" → /japan  (read-only example)
     • "בנו מפה משלכם"          → /dashboard (protected → /auth)
   ────────────────────────────────────────────────────────────── */

const T = {
  bg: "#FFFFFF",
  bgPage: "#EDEDEC",
  surface: "#F6F6F4",
  line: "rgba(20,20,20,0.08)",
  ink: "#0D0F11",
  ink2: "#2A3036",
  ink3: "#6B7178",
  ink4: "#A4AAB1",
  accent: "#E0533F",
  font: "'Noto Sans Hebrew','Inter','Noto Sans JP',system-ui,sans-serif",
};

const ArrowL = ({ size = 14, sw = 2.4 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
       strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <line x1="19" y1="12" x2="5" y2="12" /><polyline points="12 19 5 12 12 5" />
  </svg>
);
const Pin = ({ size = 13, sw = 2 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
       strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" /><circle cx="12" cy="10" r="3" />
  </svg>
);

const Step = ({ n, title, sub }) => (
  <div style={{ display: "flex", gap: 14, alignItems: "flex-start" }}>
    <div style={{
      width: 30, height: 30, borderRadius: "50%", flexShrink: 0,
      background: T.ink, color: "#fff", display: "flex", alignItems: "center",
      justifyContent: "center", fontSize: 14, fontWeight: 800,
    }}>{n}</div>
    <div>
      <div style={{ fontSize: 15, fontWeight: 800, color: T.ink, letterSpacing: "-0.014em" }}>{title}</div>
      <div style={{ fontSize: 13, color: T.ink3, marginTop: 2, lineHeight: 1.55 }}>{sub}</div>
    </div>
  </div>
);

const LandingView = () => {
  const navigate = useNavigate();
  const { isAuthenticated, user } = useAuth();

  return (
    <div dir="rtl" style={{ minHeight: "100vh", background: T.bgPage, fontFamily: T.font }}>
      <div style={{ maxWidth: 720, margin: "0 auto", background: T.bg, minHeight: "100vh" }}>
        {/* Header */}
        <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "20px 22px 8px" }}>
          <div style={{ fontSize: 14, color: T.ink3 }}>
            {isAuthenticated ? <>שלום, <b style={{ color: T.ink }}>{user?.name?.split(" ")[0]}</b></> : "מתכננים טיול?"}
          </div>
          <button
            onClick={() => navigate(isAuthenticated ? "/dashboard" : "/auth")}
            style={{ border: `1px solid ${T.line}`, background: T.surface, borderRadius: 999, padding: "7px 14px", fontSize: 12.5, fontWeight: 600, color: T.ink, cursor: "pointer", fontFamily: "inherit" }}
          >
            {isAuthenticated ? "המפות שלי" : "התחברות"}
          </button>
        </header>

        {/* H1 + lede */}
        <div style={{ padding: "12px 22px 0" }}>
          <h1 style={{ fontSize: 30, fontWeight: 800, letterSpacing: "-0.022em", color: T.ink, lineHeight: 1.15, margin: 0 }}>
            תכננו את הטיול<br /><span style={{ color: T.accent }}>הבא שלכם</span>
          </h1>
          <p style={{ fontSize: 14.5, color: T.ink2, lineHeight: 1.6, marginTop: 14 }}>
            כלי לבניית מסלולי נסיעה אישיים. מוסיפים מקומות יום אחר יום עם חיפוש מ־Google Maps,
            רואים את המסלול על מפה ומקבלים זמני הליכה אוטומטיים בין תחנות.
          </p>

          {/* Primary CTAs */}
          <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 18 }}>
            <button
              onClick={() => navigate("/create")}
              style={{ height: 54, borderRadius: 999, border: "none", background: T.ink, color: "#fff", fontSize: 15.5, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 10, fontFamily: "inherit" }}
            >
              <span>בנו מפה משלכם</span>
              <span style={{ display: "inline-flex", color: "#fff" }}><ArrowL /></span>
            </button>
            <button
              onClick={() => navigate("/japan")}
              style={{ height: 54, borderRadius: 999, border: `1px solid ${T.line}`, background: T.surface, color: T.ink, fontSize: 15, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, fontFamily: "inherit" }}
            >
              צפו בטיול לדוגמה (יפן)
            </button>
          </div>
        </div>

        {/* How it works */}
        <section style={{ padding: "28px 22px 0" }}>
          <div style={{ fontSize: 11, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.08em", color: T.ink3, marginBottom: 14 }}>איך זה עובד</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
            <Step n={1} title="ספרו לאן ומתי" sub="יעד, תאריכים ואיתכם מי — שתי דקות, ויש לכם מסגרת לטיול." />
            <Step n={2} title="בנו יום אחר יום" sub="חפשו מקומות ב־Google, גררו לסדר, וקבלו זמני הליכה ונסיעה אוטומטיים." />
            <Step n={3} title="שתפו, שמרו וצאו לדרך" sub="סנכרון בין המכשירים, עבודה לא־מקוונת, ושיתוף עם מי שאיתכם." />
          </div>
        </section>

        {/* Featured example trip — Japan */}
        <section style={{ padding: "28px 22px 0" }}>
          <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 12 }}>
            <h2 style={{ fontSize: 17, fontWeight: 800, color: T.ink, letterSpacing: "-0.014em", margin: 0 }}>טיול לדוגמה</h2>
            <button onClick={() => navigate("/japan")} style={{ border: "none", background: "none", color: T.accent, fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>ראו את כולו →</button>
          </div>
          <button
            onClick={() => navigate("/japan")}
            style={{ position: "relative", width: "100%", height: 200, borderRadius: 22, overflow: "hidden", border: "none", cursor: "pointer", padding: 0, display: "block", background: `center/cover url(/photos/home/hero_couple_fuji.png), #EFEFEC` }}
          >
            <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to top, rgba(0,0,0,0.55), transparent 60%)" }} />
            <div style={{ position: "absolute", top: 12, insetInlineStart: 12, background: "rgba(255,255,255,0.92)", color: T.ink, fontSize: 11, fontWeight: 700, padding: "4px 10px", borderRadius: 999 }}>דוגמה · השראה</div>
            <div style={{ position: "absolute", bottom: 14, insetInlineEnd: 16, insetInlineStart: 16, textAlign: "right", color: "#fff" }}>
              <div style={{ fontSize: 11, opacity: 0.85, letterSpacing: "0.04em", marginBottom: 2 }}>כך נראה מסלול במערכת · יפן</div>
              <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: "-0.02em" }}>31 ימים · 9 ערים</div>
              <div style={{ display: "flex", alignItems: "center", gap: 6, justifyContent: "flex-end", marginTop: 4, fontSize: 12.5, opacity: 0.92 }}>
                <span>טוקיו · האקונה · קנזאווה · קיוטו</span>
                <Pin />
              </div>
            </div>
          </button>
        </section>

        {/* CTA banner */}
        <section style={{ padding: "28px 22px 40px" }}>
          <button
            onClick={() => navigate("/create")}
            style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 14, padding: "18px 20px", borderRadius: 22, border: "none", background: T.ink, color: "#fff", cursor: "pointer", fontFamily: "inherit", textAlign: "right" }}
          >
            <div>
              <div style={{ fontSize: 17, fontWeight: 800 }}>תכננו את המסלול שלכם</div>
              <div style={{ fontSize: 13, opacity: 0.7, marginTop: 2 }}>3 שאלות ויש לכם שלד למסלול</div>
            </div>
            <span style={{ display: "inline-flex", color: "#fff" }}><ArrowL size={18} sw={2} /></span>
          </button>
        </section>
      </div>
    </div>
  );
};

export default LandingView;
