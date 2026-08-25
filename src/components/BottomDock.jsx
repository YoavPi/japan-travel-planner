import React, { useMemo } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useDarkMode } from "../utils/theme";
import { useAuth } from "../context/AuthContext";
import Icon from "./Icon";

/* ══════════════════════════════════════════════════════════════
   BottomDock — shared floating bottom navigation.

   White (or panel-coloured in dark mode) rounded pill that floats
   above the content. The active item gets a dark-filled circle so
   it reads clearly against the light surface. Auto-detects the
   active item from the current route, so screens just drop
   <BottomDock /> in without props.
   ══════════════════════════════════════════════════════════════ */

/* The dock only renders inside authenticated screens (Dashboard,
   Settings, Notifications, Profile) — ProtectedRoute already
   redirects guests to /auth, so we don't need to gate per-item. */

const BottomDock = () => {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { P } = useDarkMode();
  const { isAuthenticated } = useAuth();

  const active = useMemo(() => {
    if (pathname.startsWith("/settings")) return "settings";
    if (pathname.startsWith("/notifications")) return "notif";
    if (pathname.startsWith("/profile") || pathname.startsWith("/dashboard") || pathname.startsWith("/map/edit")) return "maps";
    if (pathname === "/" || pathname.startsWith("/japan")) return "home";
    return null;
  }, [pathname]);

  /* RTL convention — primary action (Home) anchors the RIGHT edge,
     secondary settings end on the LEFT. Array order is the visual
     order under dir="rtl" (right → left).
     Sprint 66 #3 — the "בית" (Home) button is REDUNDANT once signed in (the
     authenticated home IS the dashboard), so it's shown to guests only and
     hidden for authenticated users to declutter the dock. */
  const items = [
    ...(!isAuthenticated ? [{ id: "home", icon: "home", title: "בית", to: "/" }] : []),
    { id: "maps",     icon: "map",      title: "המסלולים שלי", to: "/dashboard" },
    { id: "notif",    icon: "bell",     title: "התראות", to: "/notifications" },
    { id: "settings", icon: "settings", title: "הגדרות", to: "/settings" },
  ];

  return (
    <nav dir="rtl" aria-label="ניווט תחתון"
      style={{
        position: "fixed", bottom: 18, left: "50%", transform: "translateX(-50%)",
        zIndex: 40, display: "flex", gap: 4, padding: 6, borderRadius: 999,
        background: P.panel,
        border: `1px solid ${P.line}`,
        boxShadow: "0 12px 40px rgba(0,0,0,0.18), 0 2px 6px rgba(0,0,0,0.08)",
        backdropFilter: "blur(6px)",
        fontFamily: "'Noto Sans Hebrew','Inter',sans-serif",
      }}>
      {items.map((it) => {
        const isActive = active === it.id;
        return (
          <button key={it.id}
            onClick={() => navigate(it.to)}
            title={it.title}
            aria-label={it.title}
            aria-current={isActive ? "page" : undefined}
            className="tp-press"
            style={{
              width: 48, height: 48, borderRadius: 999, border: "none", cursor: "pointer",
              fontFamily: "inherit",
              background: isActive ? P.ink : "transparent",
              color: isActive ? P.panel : P.ink2,
              transition: "background 0.18s, color 0.18s",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
            <Icon name={it.icon} size={20} strokeWidth={isActive ? 2 : 1.75} />
          </button>
        );
      })}
    </nav>
  );
};

export default BottomDock;
