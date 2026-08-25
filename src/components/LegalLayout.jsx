import React, { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import SiteFooter from "./SiteFooter";

/* ══════════════════════════════════════════════════════════════
   LegalLayout — readable shell for the static legal/info pages
   (privacy, terms, accessibility statement, credits).

   Sticky top bar with the "מסלול" wordmark + back-to-home, a
   centered readable column, and the shared SiteFooter. Brand tokens
   mirror LandingDesktop. Scrolls to top on mount.

   Shared helpers exported for the pages: <H2>, <P>, <Ul>, and the
   CONTACT_EMAIL placeholder (⚠️ set this to a real address).
   ══════════════════════════════════════════════════════════════ */

/* Contact email intentionally omitted until a real work address exists.
   When you have one, set it here and reference {CONTACT_EMAIL} back in the
   privacy / terms / accessibility pages' contact lines. */
export const CONTACT_EMAIL = "";

const T = {
  bg: "#FFFFFF", page: "#F4F3F1", ink: "#0D0F11", ink2: "#2A3036", ink3: "#4A5158",
  line: "rgba(20,20,20,0.09)", accent: "#E0533F",
  font: "'Noto Sans Hebrew','Inter',system-ui,sans-serif",
};

export const H2 = ({ children }) => (
  <h2 style={{ fontSize: 21, fontWeight: 800, color: T.ink, letterSpacing: "-0.01em", margin: "34px 0 12px" }}>{children}</h2>
);
export const P = ({ children }) => (
  <p style={{ fontSize: 15.5, lineHeight: 1.75, color: T.ink2, margin: "0 0 14px" }}>{children}</p>
);
export const Ul = ({ children }) => (
  <ul style={{ margin: "0 0 14px", paddingInlineStart: 22, display: "flex", flexDirection: "column", gap: 8 }}>{children}</ul>
);
export const Li = ({ children }) => (
  <li style={{ fontSize: 15.5, lineHeight: 1.7, color: T.ink2 }}>{children}</li>
);

const LegalLayout = ({ title, updated, children }) => {
  const navigate = useNavigate();
  useEffect(() => { window.scrollTo(0, 0); }, []);

  return (
    <div dir="rtl" style={{ minHeight: "100vh", background: T.page, fontFamily: T.font, color: T.ink }}>
      <nav style={{ position: "sticky", top: 0, zIndex: 40, width: "100%", background: "rgba(255,255,255,0.9)", backdropFilter: "blur(16px)", WebkitBackdropFilter: "blur(16px)", borderBottom: `1px solid ${T.line}` }}>
        <div style={{ maxWidth: 1240, margin: "0 auto", padding: "0 32px", height: 64, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <button onClick={() => navigate("/")} style={{ display: "inline-flex", alignItems: "center", gap: 8, border: "none", background: "transparent", cursor: "pointer", fontFamily: "inherit", fontSize: 18, fontWeight: 800, color: T.ink }}>
            <span aria-hidden style={{ width: 28, height: 28, borderRadius: 9, background: T.ink, color: "#fff", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 15 }}>◈</span>
            מסלול
          </button>
          <button onClick={() => navigate("/")} style={{ border: `1.5px solid ${T.line}`, background: "#fff", color: T.ink2, borderRadius: 999, padding: "8px 18px", fontSize: 14, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
            חזרה לעמוד הבית
          </button>
        </div>
      </nav>

      <main style={{ maxWidth: 780, margin: "0 auto", padding: "48px 32px 72px" }}>
        <h1 style={{ fontSize: "clamp(32px, 4vw, 44px)", fontWeight: 800, letterSpacing: "-0.03em", color: T.ink, margin: "0 0 8px" }}>{title}</h1>
        {updated && <div style={{ fontSize: 13.5, color: "#8A9198", marginBottom: 8 }}>עודכן לאחרונה: {updated}</div>}
        {children}
      </main>

      <SiteFooter />
    </div>
  );
};

export default LegalLayout;
