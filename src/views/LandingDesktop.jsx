import React from "react";
import SiteFooter from "../components/SiteFooter";

/* ══════════════════════════════════════════════════════════════
   LandingDesktop — the ≥1024px marketing site, built FULL-BLEED
   like a real web landing (Base44-style) rather than a centered
   ~1080px "wide phone" column on a gray page.

   Every section spans the whole viewport; only the text/content
   inside each section is constrained to a readable max-width and
   centered. Sections alternate background tint to give the page
   the vertical rhythm of a website. Rendered by LandingView only
   when useIsDesktop() is true — mobile is completely untouched.
   ══════════════════════════════════════════════════════════════ */

const T = {
  bg: "#FFFFFF", page: "#F4F3F1", surface: "#F6F6F4", surface2: "#EFEFEC",
  line: "rgba(20,20,20,0.09)", ink: "#0D0F11", ink2: "#2A3036", ink3: "#6B7178", ink4: "#A4AAB1",
  accent: "#E0533F", accentDeep: "#B83A2B",
  font: "'Noto Sans Hebrew','Inter','Noto Sans JP',system-ui,sans-serif",
};

const UNSPLASH = (id) => `https://images.unsplash.com/${id}?auto=format&fit=crop&w=520&q=80`;
const INSPO = [
  { he: "דובאי", e: "🕌", g: ["#C9A03F", "#9C7826"], img: UNSPLASH("photo-1512453979798-5ea266f8880c") },
  { he: "פריז", e: "🗼", g: ["#4A7FB5", "#345C86"], img: UNSPLASH("photo-1502602898657-3e91760cbb34") },
  { he: "יפן", e: "⛩️", g: ["#E0533F", "#B83A2B"], img: UNSPLASH("photo-1493976040374-85c8e12f0c0e") },
  { he: "סנטוריני", e: "🏺", g: ["#4E9E94", "#2B7B71"], img: UNSPLASH("photo-1570077188670-e3a8d69ac5ff") },
  { he: "רומא", e: "🏛️", g: ["#5A8C5F", "#3E6B45"], img: UNSPLASH("photo-1552832230-c0197dd311b5") },
  { he: "תאילנד", e: "🛕", g: ["#C9A03F", "#9C7826"], img: UNSPLASH("photo-1528181304800-259b08848526") },
];
const PILLARS = [
  { e: "📍", title: "סינכרון Google Maps", sub: "חיפוש מקומות אמיתי, יום אחר יום — ישר על המפה החיה." },
  { e: "🗺️", title: "מפה חיה ומסלול רציף", sub: "רואים את כל הטיול על מפה אחת, עם זמני מעבר אוטומטיים בין תחנות." },
  { e: "🤝", title: "שיתוף ועבודה משותפת", sub: "מזמינים חברים לצפות או לערוך — כולם על אותו מסלול, בזמן אמת." },
];

const ArrowL = ({ size = 15 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <line x1="19" y1="12" x2="5" y2="12" /><polyline points="12 19 5 12 12 5" />
  </svg>
);

/* Full-width section wrapper: the section paints edge-to-edge; the
   inner div constrains the content to a readable, centered column. */
const Section = ({ bg, children, pad = "88px 32px", max = 1160, style }) => (
  <section style={{ width: "100%", background: bg, ...style }}>
    <div style={{ maxWidth: max, margin: "0 auto", padding: pad }}>{children}</div>
  </section>
);

const LandingDesktop = ({ navigate, isAuthenticated, user, activeId, activeTrip, activeRoute, openAi }) => {
  const primaryTo = isAuthenticated ? "/create" : "/auth";

  return (
    <div dir="rtl" style={{ minHeight: "100vh", background: T.page, fontFamily: T.font, color: T.ink }}>
      <style>{`
        @keyframes lvSparkle { 0%,100%{opacity:.6;transform:scale(.9) rotate(0)} 50%{opacity:1;transform:scale(1.12) rotate(8deg)} }
        .ld-sparkle{display:inline-block;animation:lvSparkle 1.8s ease-in-out infinite}
        .ld-inspo-img{transition:transform .5s ease;will-change:transform}
        .ld-card:hover .ld-inspo-img{transform:scale(1.06)}
        .ld-cta:hover{filter:brightness(1.06)}
        @media (prefers-reduced-motion: reduce){.ld-sparkle{animation:none}.ld-inspo-img{transition:none}.ld-card:hover .ld-inspo-img{transform:none}}
      `}</style>

      {/* ── Full-width sticky top nav ─────────────────────────── */}
      <nav style={{ position: "sticky", top: 0, zIndex: 40, width: "100%", background: "rgba(255,255,255,0.82)", backdropFilter: "blur(20px) saturate(180%)", WebkitBackdropFilter: "blur(20px) saturate(180%)", borderBottom: `1px solid ${T.line}` }}>
        <div style={{ maxWidth: 1240, margin: "0 auto", padding: "0 32px", height: 68, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 22 }}>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 8, fontSize: 18, fontWeight: 800, letterSpacing: "-0.02em", color: T.ink }}>
              <span aria-hidden style={{ width: 28, height: 28, borderRadius: 9, background: T.ink, color: T.bg, display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 15 }}>◈</span>
              מסלול
            </span>
            <span style={{ fontSize: 14, color: T.ink3 }}>
              {isAuthenticated ? <>שלום, <b style={{ color: T.ink }}>{user?.name?.split(" ")[0]}</b></> : "פלטפורמת תכנון טיולים"}
            </span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <button onClick={() => navigate("/gallery")} style={{ border: "none", background: "transparent", color: T.ink2, fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", padding: "8px 12px" }}>מפות של אחרים</button>
            <button onClick={() => navigate("/japan")} style={{ border: "none", background: "transparent", color: T.ink2, fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", padding: "8px 12px" }}>טיול לדוגמה</button>
            <button onClick={() => navigate(isAuthenticated ? "/dashboard" : "/auth")} className="ld-cta"
              style={{ border: "none", background: T.ink, color: "#fff", borderRadius: 999, padding: "10px 20px", fontSize: 14, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
              {isAuthenticated ? "המפות שלי" : "התחברות"}
            </button>
          </div>
        </div>
      </nav>

      {/* ── Hero — full-bleed, dotted texture, centered content ── */}
      <section style={{ width: "100%", position: "relative", backgroundImage: `radial-gradient(circle, rgba(20,20,20,0.05) 1px, transparent 1.4px)`, backgroundSize: "24px 24px" }}>
        <div style={{ maxWidth: 900, margin: "0 auto", padding: "100px 32px 84px", textAlign: "center" }}>
          <div style={{ fontSize: 13, fontWeight: 800, letterSpacing: "0.16em", textTransform: "uppercase", color: T.accent, marginBottom: 22 }}>
            תכנון טיולים, פשוט ומדויק
          </div>
          <h1 style={{ margin: 0, lineHeight: 1.02, letterSpacing: "-0.04em", fontSize: "clamp(58px, 6.5vw, 92px)", color: T.ink }}>
            <span style={{ fontWeight: 300 }}>תכננו את </span>
            <span style={{ fontWeight: 800 }}>הטיול הבא</span>
            <br />
            <span style={{ fontWeight: 800, color: T.accent }}>שלכם.</span>
          </h1>
          <p style={{ fontSize: 20, color: T.ink2, lineHeight: 1.6, margin: "26px auto 0", maxWidth: 620 }}>
            בונים מסלול נסיעה אישי יום אחר יום עם חיפוש מ־Google Maps, רואים את הכל על מפה חיה, ומקבלים זמני מעבר אוטומטיים בין תחנות.
          </p>

          {/* Primary CTA cluster */}
          <div style={{ display: "flex", flexWrap: "wrap", gap: 12, justifyContent: "center", marginTop: 34 }}>
            {activeId ? (
              <button onClick={() => navigate(activeRoute)} className="ld-cta"
                style={{ height: 54, padding: "0 30px", borderRadius: 999, border: "none", background: T.accent, color: "#fff", fontSize: 16, fontWeight: 800, cursor: "pointer", fontFamily: "inherit", display: "inline-flex", alignItems: "center", gap: 9 }}>
                חזרה לטיול הפעיל · {activeTrip?.title || "שלך"} <ArrowL />
              </button>
            ) : (
              <button onClick={() => navigate(primaryTo)} className="ld-cta"
                style={{ height: 54, padding: "0 32px", borderRadius: 999, border: "none", background: T.ink, color: "#fff", fontSize: 16, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", display: "inline-flex", alignItems: "center", gap: 9 }}>
                התחילו לתכנן בחינם <ArrowL />
              </button>
            )}
            <button onClick={() => navigate("/japan")}
              style={{ height: 54, padding: "0 28px", borderRadius: 999, border: `1.5px solid ${T.ink}`, background: "transparent", color: T.ink, fontSize: 15.5, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
              צפו בטיול לדוגמה (יפן)
            </button>
            <button onClick={() => navigate("/gallery")}
              style={{ height: 54, padding: "0 28px", borderRadius: 999, border: `1.5px solid ${T.line}`, background: "transparent", color: T.ink2, fontSize: 15.5, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
              מפות של אחרים
            </button>
          </div>
          <button onClick={openAi}
            style={{ marginTop: 14, height: 48, padding: "0 26px", borderRadius: 999, border: `1.5px solid ${T.accent}66`, background: `${T.accent}0A`, color: T.accentDeep, fontSize: 14.5, fontWeight: 800, cursor: "pointer", fontFamily: "inherit", display: "inline-flex", alignItems: "center", gap: 8 }}>
            <span className="ld-sparkle" aria-hidden style={{ fontSize: 16 }}>🪄</span> בנה לי מסלול אוטומטי (AI)
          </button>
        </div>
      </section>

      {/* ── Features — white band, 3-up ───────────────────────── */}
      <Section bg={T.bg} style={{ borderTop: `1px solid ${T.line}`, borderBottom: `1px solid ${T.line}` }}>
        <div style={{ textAlign: "center", marginBottom: 44 }}>
          <div style={{ fontSize: 13, fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase", color: T.accent, marginBottom: 12 }}>איך זה עובד</div>
          <h2 style={{ margin: 0, fontSize: "clamp(30px, 3.4vw, 44px)", fontWeight: 800, letterSpacing: "-0.03em", color: T.ink }}>כל עצירה הופכת למסלול</h2>
          <p style={{ margin: "14px auto 0", maxWidth: 560, fontSize: 17, color: T.ink3, lineHeight: 1.6 }}>מוסיפים מקומות, גוררים לסדר — והמערכת מציירת את הקו ביניהם אוטומטית.</p>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 20 }}>
          {PILLARS.map((p) => (
            <div key={p.title} style={{ background: T.surface, border: `1px solid ${T.line}`, borderRadius: 20, padding: "28px 24px" }}>
              <div aria-hidden style={{ width: 54, height: 54, borderRadius: 15, background: T.bg, border: `1px solid ${T.line}`, display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 26, marginBottom: 16 }}>{p.e}</div>
              <div style={{ fontSize: 19, fontWeight: 800, letterSpacing: "-0.01em", color: T.ink }}>{p.title}</div>
              <div style={{ fontSize: 15, color: T.ink3, lineHeight: 1.6, marginTop: 8 }}>{p.sub}</div>
            </div>
          ))}
        </div>
      </Section>

      {/* ── Destinations — full-width card grid ───────────────── */}
      <Section bg={T.page} max={1240}>
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 26, flexWrap: "wrap", gap: 10 }}>
          <h2 style={{ margin: 0, fontSize: "clamp(26px, 3vw, 38px)", fontWeight: 800, letterSpacing: "-0.03em", color: T.ink }}>השראה ליעד הבא</h2>
          <span style={{ fontSize: 15, color: T.ink3 }}>לחצו על יעד כדי להתחיל</span>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(210px, 1fr))", gap: 18 }}>
          {INSPO.map((c) => (
            <button key={c.he} onClick={() => navigate(primaryTo)} className="ld-card"
              style={{ position: "relative", height: 220, borderRadius: 20, overflow: "hidden", border: "none", cursor: "pointer", padding: 0, background: `linear-gradient(145deg, ${c.g[0]}, ${c.g[1]})` }}>
              <span aria-hidden className="ld-inspo-img" style={{ position: "absolute", inset: 0, background: `center/cover url(${c.img})` }} />
              <span aria-hidden style={{ position: "absolute", inset: 0, background: `linear-gradient(160deg, ${c.g[0]}cc, ${c.g[1]}dd)`, mixBlendMode: "multiply" }} />
              <span aria-hidden style={{ position: "absolute", inset: 0, background: "linear-gradient(to top, rgba(0,0,0,0.45), rgba(0,0,0,0) 55%)" }} />
              <span style={{ position: "absolute", bottom: 14, insetInlineStart: 16, insetInlineEnd: 16, textAlign: "right", color: "#fff", fontSize: 20, fontWeight: 800, letterSpacing: "-0.02em", display: "flex", alignItems: "center", gap: 8, justifyContent: "flex-end", textShadow: "0 1px 8px rgba(0,0,0,0.5)" }}>
                {c.he} <span aria-hidden style={{ fontSize: 22 }}>{c.e}</span>
              </span>
            </button>
          ))}
        </div>
      </Section>

      {/* ── Closing CTA band ──────────────────────────────────── */}
      <section style={{ width: "100%", background: T.ink }}>
        <div style={{ maxWidth: 900, margin: "0 auto", padding: "84px 32px", textAlign: "center" }}>
          <h2 style={{ margin: 0, fontSize: "clamp(32px, 4vw, 52px)", fontWeight: 800, letterSpacing: "-0.03em", color: "#fff", lineHeight: 1.1 }}>מוכנים לתכנן את הטיול הבא?</h2>
          <p style={{ margin: "16px auto 0", maxWidth: 520, fontSize: 18, color: "rgba(255,255,255,0.7)", lineHeight: 1.6 }}>בונים מסלול ראשון תוך דקות — בחינם, בלי כרטיס אשראי.</p>
          <button onClick={() => navigate(primaryTo)} className="ld-cta"
            style={{ marginTop: 30, height: 56, padding: "0 36px", borderRadius: 999, border: "none", background: T.accent, color: "#fff", fontSize: 16.5, fontWeight: 800, cursor: "pointer", fontFamily: "inherit", display: "inline-flex", alignItems: "center", gap: 10 }}>
            התחילו לתכנן בחינם <ArrowL size={16} />
          </button>
        </div>
      </section>

      {/* ── Footer ────────────────────────────────────────────── */}
      <SiteFooter />
    </div>
  );
};

export default LandingDesktop;
