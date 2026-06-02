import React from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useDarkMode } from "../utils/theme";

/* ══════════════════════════════════════════════════════════════
   SideMenu — slide-in navigation drawer (hamburger menu).

   RTL: slides in from the RIGHT over a dimmed backdrop. Shows the
   signed-in identity + nav (profile / my maps / settings / sign
   out). For signed-out users it offers sign-in + the example trip.

   Props: open (bool), onClose ()
   ══════════════════════════════════════════════════════════════ */

const FONT = "'Noto Sans Hebrew','Inter','Noto Sans JP',system-ui,sans-serif";

const SideMenu = ({ open, onClose }) => {
  const navigate = useNavigate();
  const { isAuthenticated, user, signOut } = useAuth();
  const { P } = useDarkMode();

  const Item = ({ icon, label, onClick, danger }) => (
    <button onClick={onClick}
      style={{ display: "flex", alignItems: "center", gap: 12, width: "100%", padding: "14px 18px", border: "none", background: "transparent", cursor: "pointer", fontFamily: "inherit", textAlign: "right", color: danger ? P.danger : P.ink, fontSize: 15, fontWeight: 600, borderBottom: `1px solid ${P.line}` }}>
      <span style={{ width: 34, height: 34, borderRadius: 10, background: danger ? "rgba(192,57,43,0.12)" : P.surface, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, flexShrink: 0 }}>{icon}</span>
      <span style={{ flex: 1 }}>{label}</span>
      <span style={{ color: P.ink4 }}>‹</span>
    </button>
  );

  const go = (path) => { onClose(); navigate(path); };

  return (
    <div aria-hidden={!open} style={{ position: "fixed", inset: 0, zIndex: 90, overflow: "hidden", pointerEvents: open ? "auto" : "none" }}>
      {/* Backdrop */}
      <div onClick={onClose}
        style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.35)", opacity: open ? 1 : 0, transition: "opacity 0.25s" }} />

      {/* Drawer (right side in RTL) */}
      <div dir="rtl" style={{
        position: "absolute", top: 0, bottom: 0, insetInlineStart: 0,
        width: "82%", maxWidth: 340, background: P.panel,
        /* Drawer is anchored to the RIGHT edge (insetInlineStart:0 in
           RTL). To hide it we slide OFF-SCREEN to the right, i.e.
           translateX(+100%). Using -100% slid it leftward INTO view,
           so it never appeared to close. */
        transform: open ? "translateX(0)" : "translateX(100%)",
        transition: "transform 0.3s cubic-bezier(0.22,1,0.36,1)",
        boxShadow: "8px 0 40px rgba(0,0,0,0.18)",
        display: "flex", flexDirection: "column", fontFamily: FONT,
      }}>
        {/* Identity / header */}
        <div style={{ padding: "20px 18px", borderBottom: `1px solid ${P.line}`, display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{ width: 52, height: 52, borderRadius: "50%", background: P.ink, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, fontWeight: 800, flexShrink: 0 }}>
            {isAuthenticated ? (user?.name || "?").trim().slice(0, 1) : "?"}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            {isAuthenticated ? (
              <>
                <div style={{ fontSize: 16, fontWeight: 800, color: P.ink }}>{user?.name}</div>
                <div style={{ fontSize: 12.5, color: P.ink3, direction: "ltr", textAlign: "right", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{user?.email}</div>
              </>
            ) : (
              <div style={{ fontSize: 16, fontWeight: 800, color: P.ink }}>אורח/ת</div>
            )}
          </div>
          <button onClick={onClose} style={{ width: 32, height: 32, borderRadius: "50%", border: "none", background: P.surface, cursor: "pointer", fontSize: 15, fontFamily: "inherit" }}>✕</button>
        </div>

        {/* Nav */}
        <nav style={{ flex: 1, overflowY: "auto" }}>
          <Item icon="🏠" label="עמוד הבית" onClick={() => go("/")} />
          {isAuthenticated ? (
            <>
              <Item icon="👤" label="הפרופיל שלי" onClick={() => go("/profile")} />
              <Item icon="🗺" label="המפות שלי" onClick={() => go("/dashboard")} />
              <Item icon="➕" label="מסלול חדש" onClick={() => go("/create")} />
              <Item icon="⚙" label="הגדרות וניהול" onClick={() => go("/settings")} />
              <Item icon="🌸" label="טיול לדוגמה (יפן)" onClick={() => go("/japan")} />
            </>
          ) : (
            <>
              <Item icon="🔑" label="התחברות" onClick={() => go("/auth")} />
              <Item icon="🌸" label="טיול לדוגמה (יפן)" onClick={() => go("/japan")} />
            </>
          )}
        </nav>

        {/* Footer */}
        {isAuthenticated && (
          <div style={{ borderTop: `1px solid ${P.line}` }}>
            <Item icon="⎋" label="התנתקות" danger onClick={() => { onClose(); signOut(); navigate("/"); }} />
          </div>
        )}
      </div>
    </div>
  );
};

export default SideMenu;
