import React from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

/* ══════════════════════════════════════════════════════════════
   SiteFooter — shared marketing/legal footer.

   Surfaces the legal + info pages (privacy, terms, accessibility,
   credits) plus discovery links. Used on the landing pages and on
   every legal page, so the compliance pages are always one click
   away (a requirement for the accessibility statement's reachability).

   Brand-matched to the "מסלול" landing: ink + orange, Noto Sans
   Hebrew, RTL. Columns stack on narrow screens via the scoped CSS.
   ══════════════════════════════════════════════════════════════ */

const T = {
  bg: "#FFFFFF", ink: "#0D0F11", ink2: "#2A3036", ink3: "#6B7178", ink4: "#A4AAB1",
  line: "rgba(20,20,20,0.09)", accent: "#E0533F",
  font: "'Noto Sans Hebrew','Inter',system-ui,sans-serif",
};

/* Popular destinations → start a NEW map with this place pre-chosen.
   Each city maps to the wizard's country id (its first step) so the
   destination arrives pre-filled; `city` pre-adds the city itself.
   (Only cities that map to a supported country are listed.) */
const DESTINATIONS = [
  { city: "רומא", dest: "it" },
  { city: "פריז", dest: "fr" },
  { city: "ברצלונה", dest: "es" },
  { city: "ניו יורק", dest: "us" },
  { city: "טוקיו", dest: "jp" },
  { city: "דובאי", dest: "ae" },
];

const SiteFooter = () => {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();

  /* Choose a destination → the new-map wizard with it pre-filled. Guests are
     sent through login first, and land back on the pre-filled wizard (AuthView
     honors state.from, preserving the query the ProtectedRoute would drop). */
  const startTrip = (d) => {
    const target = `/create?dest=${d.dest}&city=${encodeURIComponent(d.city)}`;
    if (isAuthenticated) navigate(target);
    else navigate("/auth", { state: { from: target } });
  };

  const Col = ({ title, links }) => (
    <div style={{ minWidth: 140 }}>
      <div style={{ fontSize: 14, fontWeight: 800, color: T.ink, marginBottom: 14 }}>{title}</div>
      <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 10 }}>
        {links.map((l) => (
          <li key={l.label}>
            <button
              onClick={l.onClick}
              style={{ border: "none", background: "transparent", padding: 0, color: T.ink3, fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", textAlign: "start" }}
              onMouseEnter={(e) => (e.currentTarget.style.color = T.ink)}
              onMouseLeave={(e) => (e.currentTarget.style.color = T.ink3)}
            >
              {l.label}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );

  return (
    <footer dir="rtl" style={{ width: "100%", background: T.bg, borderTop: `1px solid ${T.line}`, fontFamily: T.font }}>
      <style>{`
        .sf-grid { display:flex; flex-wrap:wrap; gap:40px 64px; justify-content:flex-start; }
        @media (max-width: 640px){ .sf-grid{ gap:28px 40px; } .sf-bottom{ flex-direction:column; align-items:flex-start !important; gap:10px; } }
      `}</style>
      <div style={{ maxWidth: 1240, margin: "0 auto", padding: "56px 32px 28px" }}>
        <div className="sf-grid">
          <Col
            title="מקומות פופולריים"
            links={DESTINATIONS.map((d) => ({ label: d.city, onClick: () => startTrip(d) }))}
          />
          <Col
            title="גלו"
            links={[
              { label: "מפות של אחרים", onClick: () => navigate("/gallery") },
              { label: "תכנון טיול", onClick: () => navigate(isAuthenticated ? "/create" : "/auth") },
              { label: "טיול לדוגמה (יפן)", onClick: () => navigate("/japan") },
              { label: isAuthenticated ? "המפות שלי" : "התחברות", onClick: () => navigate(isAuthenticated ? "/dashboard" : "/auth") },
            ]}
          />
          <Col
            title="מידע ותנאים"
            links={[
              { label: "מדיניות פרטיות", onClick: () => navigate("/privacy") },
              { label: "תנאי שימוש", onClick: () => navigate("/terms") },
              { label: "הצהרת נגישות", onClick: () => navigate("/accessibility") },
              { label: "קרדיטים ורישיונות", onClick: () => navigate("/credits") },
            ]}
          />
        </div>

        <div className="sf-bottom" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 44, paddingTop: 22, borderTop: `1px solid ${T.line}` }}>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 8, fontSize: 15, fontWeight: 800, color: T.ink }}>
            <span aria-hidden style={{ width: 24, height: 24, borderRadius: 8, background: T.ink, color: T.bg, display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 13 }}>◈</span>
            מסלול
          </span>
          <span style={{ fontSize: 13, color: T.ink4 }}>© {new Date().getFullYear()} מסלול · תכנון טיולים חכם · נבנה בישראל 🇮🇱</span>
        </div>
      </div>
    </footer>
  );
};

export default SiteFooter;
