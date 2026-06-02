import React, { useMemo } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useDarkMode } from "../utils/theme";

/* ══════════════════════════════════════════════════════════════
   BottomDock — shared floating bottom navigation.

   White (or panel-coloured in dark mode) rounded pill that floats
   above the content. The active item gets a dark-filled circle so
   it reads clearly against the light surface. Auto-detects the
   active item from the current route, so screens just drop
   <BottomDock /> in without props.
   ══════════════════════════════════════════════════════════════ */

const PROTECTED_FOR_GUEST = {
  profile: "/auth",
  notif:   "/auth",
  maps:    "/auth",
};

const BottomDock = () => {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { P } = useDarkMode();

  const active = useMemo(() => {
    if (pathname.startsWith("/profile")) return "profile";
    if (pathname.startsWith("/notifications")) return "notif";
    if (pathname.startsWith("/dashboard") || pathname.startsWith("/map/edit")) return "maps";
    if (pathname === "/" || pathname.startsWith("/japan")) return "home";
    return null;
  }, [pathname]);

  const items = [
    { id: "profile", icon: "👤", title: "פרופיל", to: "/profile" },
    { id: "notif",   icon: "🔔", title: "התראות", to: "/notifications" },
    { id: "maps",    icon: "🗺",  title: "המפות שלי", to: "/dashboard" },
    { id: "home",    icon: "🏠", title: "בית",     to: "/" },
  ];

  return (
    <nav aria-label="ניווט תחתון"
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
            onClick={() => navigate(PROTECTED_FOR_GUEST[it.id] && false ? PROTECTED_FOR_GUEST[it.id] : it.to)}
            title={it.title}
            aria-label={it.title}
            aria-current={isActive ? "page" : undefined}
            className="tp-press"
            style={{
              width: 48, height: 48, borderRadius: 999, border: "none", cursor: "pointer",
              fontSize: 20, fontFamily: "inherit",
              background: isActive ? P.ink : "transparent",
              color: isActive ? P.panel : P.ink2,
              transition: "background 0.18s, color 0.18s",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
            <span style={{ filter: isActive ? "saturate(0) brightness(2.3)" : "none", opacity: isActive ? 1 : 0.85 }}>{it.icon}</span>
          </button>
        );
      })}
    </nav>
  );
};

export default BottomDock;
