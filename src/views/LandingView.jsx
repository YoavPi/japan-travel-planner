import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import useActiveTrip from "../utils/useActiveTrip";
import tripService from "../services/tripService";
import HeroRouteAnimation from "../components/HeroRouteAnimation";
import SwipeBackContainer from "../components/SwipeBackContainer";
import useIsDesktop from "../hooks/useIsDesktop";
import LandingDesktop from "./LandingDesktop";
import SiteFooter from "../components/SiteFooter";

/* ──────────────────────────────────────────────────────────────
   LandingView — the SaaS platform HOME PAGE ("עמוד הבית הראשי").

   Premium magazine-style redesign (Sprint 13): an oversized
   editorial hero with mixed-weight typography, a contextual
   live-companion CTA driven by the global active-trip state, and
   three airy value sections (visual planner preview · feature
   pillars · country-art inspiration). RTL Hebrew throughout, with
   generous breathing space and structural bottom padding so the
   global floating BottomDock never overlaps the content.
   ────────────────────────────────────────────────────────────── */

const T = {
  bg: "#FFFFFF",
  bgPage: "#EDEDEC",
  surface: "#F6F6F4",
  surface2: "#EFEFEC",
  line: "rgba(20,20,20,0.08)",
  ink: "#0D0F11",
  ink2: "#2A3036",
  ink3: "#6B7178",
  ink4: "#A4AAB1",
  accent: "#E0533F",
  accentDeep: "#B83A2B",
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

/* Country → landmark glyph + themed gradient (mirrors MapCard so a
   destination reads with the same identity across the product) +
   an aspirational Unsplash photo. The image sits UNDER the signature
   gradient shroud (mix-blend-multiply) so each card keeps its brand
   tint while gaining crisp photographic depth. If a photo fails to
   load the gradient base still renders — graceful by construction. */
const UNSPLASH = (id) => `https://images.unsplash.com/${id}?auto=format&fit=crop&w=420&q=80`;
const INSPO = [
  { he: "דובאי",   e: "🕌", g: ["#C9A03F", "#9C7826"], img: UNSPLASH("photo-1512453979798-5ea266f8880c") },
  { he: "פריז",    e: "🗼", g: ["#4A7FB5", "#345C86"], img: UNSPLASH("photo-1502602898657-3e91760cbb34") },
  { he: "יפן",     e: "⛩️", g: ["#E0533F", "#B83A2B"], img: UNSPLASH("photo-1493976040374-85c8e12f0c0e") },
  { he: "סנטוריני", e: "🏺", g: ["#4E9E94", "#2B7B71"], img: UNSPLASH("photo-1570077188670-e3a8d69ac5ff") },
  { he: "רומא",    e: "🏛️", g: ["#5A8C5F", "#3E6B45"], img: UNSPLASH("photo-1552832230-c0197dd311b5") },
  { he: "תאילנד",  e: "🛕", g: ["#C9A03F", "#9C7826"], img: UNSPLASH("photo-1528181304800-259b08848526") },
];

/* Hero atmospheric backdrop — a serene aspirational travel scene,
   kept at very low opacity behind a dark scrim so the editorial type
   stays high-contrast and fully readable. */
const HERO_IMG = UNSPLASH("photo-1469854523086-cc02fe5d8800");

/* Core value pillars — flat canvas tones, crisp glyphs. */
const PILLARS = [
  { e: "📍", title: "סינכרון Google Maps", sub: "חיפוש מקומות אמיתי, ישר על המפה" },
  { e: "📱", title: "מצב שטח פעיל", sub: "צ׳ק-ליסט חי תוך כדי הטיול" },
  { e: "🤝", title: "שיתוף הרשאות", sub: "הזמינו חברים לצפות או לערוך" },
];

const LandingView = () => {
  const navigate = useNavigate();
  const { isAuthenticated, user } = useAuth();
  const isDesktop = useIsDesktop(); // widens the marketing column on desktop (additive)
  const activeId = useActiveTrip();

  /* Hydrate the active trip's title + read-only flag so the live
     CTA can show its real name and route correctly (the read-only
     Japan demo opens the static /map?demo=1 environment). */
  const [activeTrip, setActiveTrip] = useState(null);
  useEffect(() => {
    let live = true;
    if (!activeId) { setActiveTrip(null); return; }
    tripService.fetchTripById(activeId)
      .then((t) => { if (live) setActiveTrip(t); })
      .catch(() => { if (live) setActiveTrip(null); });
    return () => { live = false; };
  }, [activeId]);

  const activeRoute = activeTrip?.readOnly ? "/map?demo=1" : `/map/edit/${activeId}`;

  /* ── "Fake door" AI planner waitlist ────────────────────────
     Measures demand for an auto-itinerary feature before we build
     it: every click is logged to localStorage, and the modal
     collects emails into a lightweight in-tab waitlist. */
  const [aiOpen, setAiOpen] = useState(false);
  const [aiEmail, setAiEmail] = useState("");
  const [aiDone, setAiDone] = useState(false);

  /* The AI feature is LIVE now (Sprint 67+). This CTA no longer collects an
     email — it takes the user into the real flow: sign in via SSO if needed,
     then the dashboard opens the actual AI trip-planning form (`tp_open_ai`
     survives the OAuth redirect, so it fires after login too). */
  const openAi = () => {
    try {
      const n = parseInt(localStorage.getItem("tp_metrics_ai_clicks") || "0", 10) || 0;
      localStorage.setItem("tp_metrics_ai_clicks", String(n + 1));
    } catch { /* storage unavailable — noop */ }
    try { sessionStorage.setItem("tp_open_ai", "1"); } catch { /* noop */ }
    if (isAuthenticated) navigate("/dashboard");
    else navigate("/auth", { state: { from: "/dashboard" } });
  };
  const closeAi = () => setAiOpen(false);
  const submitAi = (e) => {
    e?.preventDefault?.();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(aiEmail.trim())) return;
    try {
      const raw = localStorage.getItem("tp_metrics_ai_waitlist");
      const list = raw ? JSON.parse(raw) : [];
      list.push({ email: aiEmail.trim(), at: new Date().toISOString() });
      localStorage.setItem("tp_metrics_ai_waitlist", JSON.stringify(list));
    } catch { /* noop */ }
    setAiDone(true);
  };

  return (
    <SwipeBackContainer>
    <div dir="rtl" style={{ minHeight: "100vh", background: T.bgPage, fontFamily: T.font }}>
      {/* Scoped keyframes + responsive helpers. */}
      <style>{`
        @keyframes lvGlow {
          0%,100% { box-shadow: 0 10px 34px ${T.accent}55, 0 0 0 0 ${T.accent}44; }
          50%     { box-shadow: 0 16px 44px ${T.accent}77, 0 0 0 10px ${T.accent}00; }
        }
        .lv-glow { animation: lvGlow 2.6s ease-in-out infinite; }
        .lv-pillars { display: grid; grid-template-columns: repeat(3, 1fr); gap: 14px; }
        @media (max-width: 560px) {
          .lv-pillars { grid-template-columns: 1fr; gap: 10px; }
        }
        .lv-inspo { display: flex; gap: 12px; overflow-x: auto; padding-bottom: 6px; scrollbar-width: none; }
        .lv-inspo::-webkit-scrollbar { display: none; }
        /* Desktop: the destination carousel wraps into a full-width grid so
           every option shows at once (no horizontal scroll on a wide screen). */
        @media (min-width: 1024px) {
          .lv-inspo { flex-wrap: wrap; overflow-x: visible; gap: 18px; }
        }
        /* Buttery hover zoom on the country photo, frame stays bounded. */
        .lv-inspo-img { transition: transform 0.5s ease; will-change: transform; }
        .lv-inspo-card:hover .lv-inspo-img { transform: scale(1.05); }
        /* AI fake-door button: soft accent halo + a twinkling wand. */
        @keyframes lvSparkle {
          0%,100% { opacity: 0.55; transform: scale(0.9) rotate(0deg); }
          50%     { opacity: 1;    transform: scale(1.12) rotate(8deg); }
        }
        .lv-sparkle { display: inline-block; animation: lvSparkle 1.8s ease-in-out infinite; }
        .lv-ai-btn { transition: border-color 0.2s ease, box-shadow 0.2s ease, background 0.2s ease; }
        .lv-ai-btn:hover { border-color: ${T.accent}; box-shadow: 0 6px 22px ${T.accent}33; background: ${T.accent}0A; }
        .lv-modal-backdrop { animation: lvFade 0.2s ease; }
        @keyframes lvFade { from { opacity: 0; } to { opacity: 1; } }
        @media (prefers-reduced-motion: reduce) {
          .lv-inspo-img { transition: none; }
          .lv-inspo-card:hover .lv-inspo-img { transform: none; }
          .lv-sparkle { animation: none; }
        }
      `}</style>

      {isDesktop ? (
        <LandingDesktop
          navigate={navigate} isAuthenticated={isAuthenticated} user={user}
          activeId={activeId} activeTrip={activeTrip} activeRoute={activeRoute} openAi={openAi}
        />
      ) : (
      <div style={{ maxWidth: 760, margin: "0 auto", background: T.bg, minHeight: "100vh", paddingBottom: 128 /* clear the global floating BottomDock */ }}>

        {/* ── Header — sticky frosted top nav on desktop (Apple material) ── */}
        <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: isDesktop ? "16px 24px" : "22px 24px 8px",
          ...(isDesktop ? {
            position: "sticky", top: 0, zIndex: 30,
            background: "rgba(255,255,255,0.72)", backdropFilter: "blur(20px) saturate(180%)", WebkitBackdropFilter: "blur(20px) saturate(180%)",
            borderBottom: `1px solid ${T.line}`,
          } : null) }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            {isDesktop && (
              <span style={{ display: "inline-flex", alignItems: "center", gap: 7, fontSize: 16, fontWeight: 800, letterSpacing: "-0.02em", color: T.ink }}>
                <span aria-hidden style={{ width: 26, height: 26, borderRadius: 8, background: T.ink, color: T.bg, display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 14 }}>◈</span>
                מסלול
              </span>
            )}
            <div style={{ fontSize: 14, color: T.ink3 }}>
              {isAuthenticated ? <>שלום, <b style={{ color: T.ink }}>{user?.name?.split(" ")[0]}</b></> : "מתכננים טיול?"}
            </div>
          </div>
          <button
            onClick={() => navigate(isAuthenticated ? "/dashboard" : "/auth")}
            style={{ border: `1px solid ${T.line}`, background: T.surface, borderRadius: 999, padding: "8px 16px", fontSize: 13, fontWeight: 600, color: T.ink, cursor: "pointer", fontFamily: "inherit" }}
          >
            {isAuthenticated ? "המפות שלי" : "התחברות"}
          </button>
        </header>

        {/* ── Hero — oversized editorial headline ──────────────── */}
        <section style={{ position: "relative", padding: "32px 24px 40px", overflow: "hidden" }}>
          {/* Atmospheric full-bleed backdrop — locked low opacity +
              blur + dark scrim so it reads as pure texture and never
              competes with the type or the live CTA. aria-hidden &
              non-interactive. */}
          <div aria-hidden style={{ position: "absolute", inset: 0, zIndex: 0, pointerEvents: "none" }}>
            <div style={{
              position: "absolute", inset: 0,
              background: `center/cover url(${HERO_IMG})`,
              opacity: 0.12, filter: "blur(2px)", transform: "scale(1.06)",
            }} />
            {/* Soft fade to the page background at the lower edge so the
                hero melts into Section A. */}
            <div style={{ position: "absolute", inset: 0, background: `linear-gradient(to bottom, ${T.bg}00 55%, ${T.bg} 100%)` }} />
          </div>

          {/* Content layer — sits above the backdrop. On desktop it becomes a
              CENTERED, spacious hero (Base44-style) rather than a right-crammed
              column, so the wide screen reads as a real web hero. */}
          <div style={{ position: "relative", zIndex: 1, ...(isDesktop ? { textAlign: "center", maxWidth: 820, margin: "0 auto", padding: "56px 0 28px" } : null) }}>
          <div className="tp-fade-up" style={{ fontSize: 12.5, fontWeight: 800, letterSpacing: "0.14em", textTransform: "uppercase", color: T.accent, marginBottom: 18 }}>
            פלטפורמת תכנון טיולים
          </div>

          {/* Mixed-weight headline: heavy + light contrast = editorial. */}
          <h1 className="tp-fade-up" style={{ margin: 0, color: T.ink, lineHeight: 1.03, letterSpacing: "-0.035em", fontSize: isDesktop ? "clamp(56px, 6vw, 82px)" : "clamp(40px, 11vw, 60px)", animationDelay: "60ms" }}>
            <span style={{ display: "block", fontWeight: 300 }}>תכננו את</span>
            <span style={{ display: "block", fontWeight: 800 }}>הטיול הבא</span>
            <span style={{ display: "block", fontWeight: 800, color: T.accent }}>שלכם.</span>
          </h1>

          <p className="tp-fade-up" style={{ fontSize: isDesktop ? 19 : 17, color: T.ink2, lineHeight: 1.65, marginTop: 22, maxWidth: isDesktop ? 640 : 520, marginInline: isDesktop ? "auto" : 0, animationDelay: "120ms" }}>
            כלי לבניית מסלולי נסיעה אישיים. מוסיפים מקומות יום אחר יום עם חיפוש מ־Google Maps,
            רואים את המסלול על מפה חיה ומקבלים זמני הליכה אוטומטיים בין תחנות.
          </p>

          {/* Contextual CTA — live companion when a trip is active. */}
          {activeId ? (
            /* Refined live block — no heavy solid fill. A crisp soft
               accent border, a gentle glowing backdrop (shadow-sm),
               and airy padding keep it light and magazine-elegant. */
            <div className="tp-fade-up" style={{
              marginTop: 26, borderRadius: 20, padding: "20px 22px",
              background: T.bg, border: `1px solid ${T.accent}33`,
              boxShadow: `0 1px 3px rgba(0,0,0,0.05), 0 12px 30px ${T.accent}14`,
              animationDelay: "160ms",
              display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap",
            }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "inline-flex", alignItems: "center", gap: 7, fontSize: 11.5, fontWeight: 800, letterSpacing: "0.02em", color: T.accent }}>
                  <span style={{ width: 7, height: 7, borderRadius: "50%", background: T.accent, boxShadow: `0 0 0 0 ${T.accent}99`, animation: "tpLivePulse 1.6s ease-in-out infinite" }} />
                  ⚡ הטיול הפעיל שלך באוויר
                </div>
                <div style={{ fontSize: 21, fontWeight: 800, letterSpacing: "-0.02em", color: T.ink, marginTop: 6, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {activeTrip?.title || "הטיול שלך"}
                </div>
              </div>
              <button
                onClick={() => navigate(activeRoute)}
                className="tp-press"
                style={{ flexShrink: 0, height: 46, padding: "0 20px", borderRadius: 999, border: "none", background: T.accent, color: "#fff", fontSize: 14.5, fontWeight: 800, cursor: "pointer", fontFamily: "inherit", display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8 }}
              >
                חזרה למפת השטח החיה
                <span style={{ display: "inline-flex" }}><ArrowL size={13} /></span>
              </button>
            </div>
          ) : (
            <div className="tp-fade-up" style={{ display: "flex", flexWrap: "wrap", gap: 10, marginTop: 26, justifyContent: isDesktop ? "center" : "flex-start", animationDelay: "160ms" }}>
              {/* Slim solid primary pill — elegant, not blocky. */}
              <button
                onClick={() => navigate(isAuthenticated ? "/create" : "/auth")}
                className="tp-press"
                style={{ flex: "1 1 200px", height: 48, borderRadius: 999, border: "none", background: T.ink, color: "#fff", fontSize: 15, fontWeight: 700, cursor: "pointer", display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8, fontFamily: "inherit" }}
              >
                <span>התחילו לתכנן בחינם</span>
                <span style={{ display: "inline-flex", color: "#fff" }}><ArrowL size={13} /></span>
              </button>
              {/* Crisp ghost outline — premium, lightweight. */}
              <button
                onClick={() => navigate("/japan")}
                className="tp-press"
                style={{ flex: "1 1 160px", height: 48, borderRadius: 999, border: `1.5px solid ${T.ink}`, background: "transparent", color: T.ink, fontSize: 14.5, fontWeight: 700, cursor: "pointer", display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8, fontFamily: "inherit" }}
              >
                צפו בטיול לדוגמה (יפן)
              </button>
              {/* Guest entry to the public gallery. */}
              <button
                onClick={() => navigate("/gallery")}
                className="tp-press"
                style={{ flex: "1 1 160px", height: 48, borderRadius: 999, border: `1.5px solid ${T.line}`, background: "transparent", color: T.ink2, fontSize: 14.5, fontWeight: 700, cursor: "pointer", display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8, fontFamily: "inherit" }}
              >
                מפות של אחרים
              </button>
            </div>
          )}

          {/* ── "Fake door" AI planner CTA — lightweight accent-outline
              pill with a twinkling wand. Always present in the hero. */}
          <button
            onClick={openAi}
            className="tp-press tp-fade-up lv-ai-btn"
            style={{
              marginTop: 12, width: "100%", height: 48, borderRadius: 999,
              border: `1.5px solid ${T.accent}66`, background: `${T.accent}0A`, color: T.accentDeep,
              fontSize: 14.5, fontWeight: 800, cursor: "pointer", fontFamily: "inherit",
              display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8,
              animationDelay: "200ms",
            }}
          >
            <span className="lv-sparkle" aria-hidden style={{ fontSize: 16 }}>🪄</span>
            בנה לי מסלול אוטומטי (AI)
          </button>
          </div>{/* /content layer */}
        </section>

        {/* ── Section A — Visual planner preview ───────────────── */}
        <section style={{ padding: "56px 24px 0" }}>
          <div style={{ fontSize: 11.5, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.1em", color: T.ink3, marginBottom: 14 }}>
            מתכננים על מפה חיה
          </div>
          <div style={{
            borderRadius: 26, background: T.surface, border: `1px solid ${T.line}`,
            padding: 22, boxShadow: "0 24px 60px rgba(0,0,0,0.10), 0 4px 14px rgba(0,0,0,0.05)",
          }}>
            <h2 style={{ margin: "0 0 4px", fontSize: 22, fontWeight: 800, color: T.ink, letterSpacing: "-0.02em" }}>
              כל עצירה הופכת למסלול
            </h2>
            <p style={{ margin: "0 0 16px", fontSize: 14.5, color: T.ink3, lineHeight: 1.6 }}>
              מוסיפים מקומות, גוררים לסדר — והמערכת מציירת את הקו ביניהם אוטומטית.
            </p>
            {/* Stylised route drawing itself across five pins. */}
            <div style={{ borderRadius: 18, overflow: "hidden", background: T.bg }}>
              <HeroRouteAnimation />
            </div>
          </div>
        </section>

        {/* ── Section B — Feature pillars ──────────────────────── */}
        <section style={{ padding: "60px 24px 0" }}>
          <h2 style={{ margin: "0 0 6px", fontSize: 24, fontWeight: 800, color: T.ink, letterSpacing: "-0.02em" }}>
            תכנון חכם, ביצוע בשטח
          </h2>
          <p style={{ margin: "0 0 22px", fontSize: 15, color: T.ink3, lineHeight: 1.6 }}>
            שלושה עקרונות שמלווים אתכם מהרעיון ועד הצעד האחרון.
          </p>
          <div className="lv-pillars">
            {PILLARS.map((p) => (
              <div key={p.title} style={{ padding: "18px 16px", borderRadius: 18, border: `1px solid ${T.line}`, background: T.bg }}>
                <div style={{ fontSize: 26, lineHeight: 1, marginBottom: 12 }} aria-hidden>{p.e}</div>
                <div style={{ fontSize: 15.5, fontWeight: 800, color: T.ink, letterSpacing: "-0.01em" }}>{p.title}</div>
                <div style={{ fontSize: 13, color: T.ink3, marginTop: 5, lineHeight: 1.55 }}>{p.sub}</div>
              </div>
            ))}
          </div>
        </section>

        {/* ── Section C — Inspiration / country art ────────────── */}
        <section style={{ padding: "60px 24px 0" }}>
          <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 16 }}>
            <h2 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: T.ink, letterSpacing: "-0.02em" }}>
              לאן תיקחו את עצמכם?
            </h2>
            <button onClick={() => navigate("/japan")} style={{ border: "none", background: "none", color: T.accent, fontSize: 13.5, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
              ראו דוגמה →
            </button>
          </div>
          <div className="lv-inspo">
            {INSPO.map((c) => (
              <button
                key={c.he}
                onClick={() => navigate(isAuthenticated ? "/create" : "/auth")}
                className="tp-press lv-inspo-card"
                style={{
                  flexShrink: 0, width: 132, height: 158, borderRadius: 20, border: "none", cursor: "pointer",
                  position: "relative", overflow: "hidden", padding: 0, fontFamily: "inherit",
                  background: c.g[1], /* fallback base if the photo fails */
                  boxShadow: "0 12px 30px rgba(0,0,0,0.14)",
                }}
              >
                {/* Crisp travel photo — zooms on hover, frame stays bounded. */}
                <span aria-hidden className="lv-inspo-img" style={{ position: "absolute", inset: 0, background: `center/cover url(${c.img})` }} />
                {/* Signature brand gradient shroud (multiply) keeps each
                    card's identity tint while letting the photo show. */}
                <span aria-hidden style={{ position: "absolute", inset: 0, background: `linear-gradient(150deg, ${c.g[0]}, ${c.g[1]})`, mixBlendMode: "multiply", opacity: 0.72 }} />
                <span aria-hidden style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 52, opacity: 0.55, filter: "drop-shadow(0 3px 8px rgba(0,0,0,0.35))" }}>{c.e}</span>
                <span aria-hidden style={{ position: "absolute", insetInlineStart: 0, insetInlineEnd: 0, bottom: 0, height: "60%", background: "linear-gradient(to top, rgba(0,0,0,0.6), transparent)" }} />
                <span style={{ position: "absolute", bottom: 12, insetInlineStart: 12, insetInlineEnd: 12, textAlign: "right", color: "#fff", fontSize: 15.5, fontWeight: 800, letterSpacing: "-0.01em", display: "flex", alignItems: "center", gap: 6, justifyContent: "flex-end", textShadow: "0 1px 6px rgba(0,0,0,0.4)" }}>
                  {c.he}
                  <Pin size={12} />
                </span>
              </button>
            ))}
          </div>
        </section>

        {/* ── Closing CTA banner ───────────────────────────────── */}
        <section style={{ padding: "56px 24px 0" }}>
          <button
            onClick={() => navigate(activeId ? activeRoute : (isAuthenticated ? "/create" : "/auth"))}
            className="tp-press"
            style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 14, padding: "16px 20px", borderRadius: 16, border: `1.5px solid ${T.ink}`, background: "transparent", color: T.ink, cursor: "pointer", fontFamily: "inherit", textAlign: "right" }}
          >
            <div>
              <div style={{ fontSize: 16.5, fontWeight: 800, letterSpacing: "-0.01em" }}>
                {activeId ? "המשיכו מאיפה שעצרתם" : "תכננו את המסלול שלכם"}
              </div>
              <div style={{ fontSize: 13, color: T.ink3, marginTop: 2 }}>
                {activeId ? "המפה החיה מחכה לכם" : "3 שאלות ויש לכם שלד למסלול"}
              </div>
            </div>
            <span style={{ display: "inline-flex", color: T.ink }}><ArrowL size={18} sw={2} /></span>
          </button>
        </section>

        <SiteFooter />
      </div>
      )}

      {/* ── AI Planner waitlist modal (fake-door) ─────────────────
          Portaled to <body> so it escapes the .tp-route stacking
          context and reliably paints above the global BottomDock
          (z-index 40) + floating FAB (z-index 80). */}
      {aiOpen && createPortal((
        <div
          className="lv-modal-backdrop"
          onClick={closeAi}
          style={{
            position: "fixed", inset: 0, zIndex: 1000,
            background: "rgba(13,15,17,0.55)", backdropFilter: "blur(3px)",
            display: "flex", alignItems: "flex-end", justifyContent: "center",
            padding: 16,
          }}
        >
          <div
            dir="rtl"
            onClick={(e) => e.stopPropagation()}
            className="tp-sheet-up"
            style={{
              width: "100%", maxWidth: 440, background: T.bg,
              borderRadius: 22, padding: "24px 24px 44px", textAlign: "right",
              boxShadow: "0 -2px 8px rgba(0,0,0,0.06), 0 24px 60px rgba(0,0,0,0.28)",
              border: `1px solid ${T.line}`, fontFamily: "inherit",
              marginBottom: "max(16px, env(safe-area-inset-bottom))",
            }}
          >
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
              <div style={{ fontSize: 21, fontWeight: 800, letterSpacing: "-0.01em", color: T.ink, lineHeight: 1.25 }}>
                {aiDone ? "תודה! שמרנו לכם מקום בראש התור 🚀" : "המתכנן האוטומטי שלנו בדרך! 🪄"}
              </div>
              <button
                onClick={closeAi}
                aria-label="סגירה"
                className="tp-press"
                style={{
                  flexShrink: 0, width: 32, height: 32, borderRadius: 999,
                  border: `1px solid ${T.line}`, background: T.surface, color: T.ink3,
                  cursor: "pointer", fontSize: 18, lineHeight: 1, fontFamily: "inherit",
                }}
              >
                ×
              </button>
            </div>

            {!aiDone && (
              <>
                <p style={{ fontSize: 14.5, lineHeight: 1.65, color: T.ink3, marginTop: 12 }}>
                  אנחנו בונים מנגנון בינה מלאכותית חכם שישאל אתכם מספר שאלות קצרות (כמות ימים, קצב נסיעה, העדפה לטבע או לעיר) וירכיב לכם שלד מסלול מושלם באפס מאמץ.
                </p>
                <form onSubmit={submitAi} style={{ marginTop: 18, display: "flex", flexDirection: "column", gap: 10 }}>
                  <input
                    type="email"
                    inputMode="email"
                    dir="ltr"
                    value={aiEmail}
                    onChange={(e) => setAiEmail(e.target.value)}
                    placeholder="name@email.com"
                    autoFocus
                    style={{
                      width: "100%", height: 50, borderRadius: 12, padding: "0 14px",
                      border: `1.5px solid ${T.line}`, background: T.surface,
                      color: T.ink, fontSize: 15, fontFamily: "inherit", outline: "none",
                      textAlign: "left",
                    }}
                  />
                  <button
                    type="submit"
                    className="tp-press"
                    style={{
                      width: "100%", height: 50, borderRadius: 12, border: "none",
                      background: T.accent, color: "#fff", fontSize: 15.5, fontWeight: 800,
                      cursor: "pointer", fontFamily: "inherit",
                    }}
                  >
                    עדכנו אותי כשהפיצ'ר מוכן
                  </button>
                </form>
              </>
            )}

            {aiDone && (
              <p style={{ fontSize: 14.5, lineHeight: 1.65, color: T.ink3, marginTop: 12 }}>
                נהדר! ברגע שהמתכנן האוטומטי יהיה מוכן — תהיו מהראשונים לדעת.
              </p>
            )}
          </div>
        </div>
      ), document.body)}
    </div>
    </SwipeBackContainer>
  );
};

export default LandingView;
