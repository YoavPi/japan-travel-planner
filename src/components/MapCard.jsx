import React, { useEffect, useRef, useState } from "react";

/* ══════════════════════════════════════════════════════════════
   MapCard — trip/map card matching the profile blueprint.

   thumb (cover + days badge) · body (title, meta w/ sharedBy,
   role-tag + collaborator avatar stack) · 3-dot menu (open /
   share / delete). Shared by ProfileView and DashboardView.
   ══════════════════════════════════════════════════════════════ */

const T = {
  ink: "#0D0F11", ink2: "#2A3036", ink3: "#6B7178", ink4: "#A4AAB1",
  line: "rgba(20,20,20,0.08)", surface: "#F6F6F4", surface2: "#EFEFEC",
  natureSoft: "#E4EFE5", natureDeep: "#2B7B71", danger: "#C0392B",
  font: "'Noto Sans Hebrew','Inter','Noto Sans JP',system-ui,sans-serif",
};

const ROLE = {
  owner: { label: "בעלים", icon: "👤", bg: T.ink, fg: "#fff" },
  edit:  { label: "עריכה", icon: "✏", bg: T.natureSoft, fg: T.natureDeep },
  view:  { label: "צפייה", icon: "👁", bg: T.surface2, fg: T.ink2 },
};

const Initial = ({ name, i }) => (
  <span style={{ width: 24, height: 24, borderRadius: "50%", border: "2px solid #fff", background: T.surface2, color: T.ink2, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 800, marginInlineStart: i ? -8 : 0, overflow: "hidden" }}>
    {(name || "?").trim().slice(0, 1)}
  </span>
);

const MapCard = ({ trip, index = 0, onOpen, onShare, onDelete }) => {
  const role = ROLE[trip.role] || ROLE.view;
  const collabs = trip.collaborators || [];
  const shown = collabs.slice(0, 3);
  const extra = collabs.length - shown.length;
  const isOwner = trip.role === "owner";

  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    if (!menuOpen) return;
    const onDown = (e) => { if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false); };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [menuOpen]);

  const MenuItem = ({ icon, label, danger, onClick }) => (
    <button onClick={(e) => { e.stopPropagation(); setMenuOpen(false); onClick && onClick(); }}
      style={{ display: "flex", alignItems: "center", gap: 10, width: "100%", textAlign: "right", padding: "11px 14px", border: "none", background: "transparent", cursor: "pointer", fontFamily: T.font, fontSize: 13.5, fontWeight: 600, color: danger ? T.danger : T.ink, borderBottom: `1px solid ${T.line}` }}>
      <span aria-hidden style={{ width: 18 }}>{icon}</span>{label}
    </button>
  );

  return (
    <div
      className="tp-card tp-fade-up"
      onClick={onOpen}
      style={{
        position: "relative", display: "flex", gap: 14, padding: 12,
        borderRadius: 20, border: `1px solid ${T.line}`, background: "#fff",
        boxShadow: "0 1px 2px rgba(0,0,0,.04), 0 8px 28px rgba(0,0,0,.05)",
        cursor: "pointer", textAlign: "right", fontFamily: T.font, width: "100%",
        animationDelay: `${Math.min(index, 8) * 55}ms`,
      }}
    >
      {/* Thumb */}
      <div style={{ width: 88, height: 88, borderRadius: 14, background: trip.cover ? `center/cover url(${trip.cover})` : T.surface, flexShrink: 0, position: "relative" }}>
        {trip.days ? (
          <span style={{ position: "absolute", bottom: 6, insetInlineStart: 6, background: "rgba(13,15,17,0.82)", color: "#fff", fontSize: 10.5, fontWeight: 700, padding: "2px 7px", borderRadius: 999 }}>{trip.days} ימים</span>
        ) : null}
      </div>

      {/* Body */}
      <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column" }}>
        <div style={{ fontSize: 15.5, fontWeight: 800, color: T.ink, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", paddingInlineEnd: 34 }}>{trip.title}</div>
        <div style={{ fontSize: 12, color: T.ink3, marginTop: 2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
          {trip.role !== "owner" && trip.sharedBy ? `שותף ע״י ${trip.sharedBy} · ` : ""}{trip.meta}
        </div>
        <div style={{ marginTop: "auto", paddingTop: 8, display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 10.5, fontWeight: 800, letterSpacing: "0.02em", background: role.bg, color: role.fg, borderRadius: 999, padding: "4px 9px" }}>
            <span aria-hidden>{role.icon}</span>{role.label}
          </span>
          {isOwner && shown.length > 0 && (
            <span style={{ display: "flex", alignItems: "center", marginInlineStart: "auto" }}>
              {shown.map((c, i) => <Initial key={i} name={c.name} i={i} />)}
              {extra > 0 && (
                <span style={{ width: 24, height: 24, borderRadius: "50%", border: "2px solid #fff", background: T.ink, color: "#fff", fontSize: 9.5, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center", marginInlineStart: -8 }}>+{extra}</span>
              )}
            </span>
          )}
        </div>
      </div>

      {/* 3-dot actions */}
      <div ref={menuRef} style={{ position: "absolute", top: 12, insetInlineStart: 12 }}>
        <span
          onClick={(e) => { e.stopPropagation(); setMenuOpen((v) => !v); }}
          title="אפשרויות"
          className="tp-press"
          style={{ width: 30, height: 30, borderRadius: "50%", background: menuOpen ? T.surface2 : T.surface, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, cursor: "pointer", color: T.ink2 }}
        >
          ⋯
        </span>
        {menuOpen && (
          <div className="tp-pop" style={{ position: "absolute", top: 36, insetInlineStart: 0, zIndex: 10, minWidth: 168, background: "#fff", border: `1px solid ${T.line}`, borderRadius: 14, boxShadow: "0 16px 40px rgba(0,0,0,0.16)", overflow: "hidden" }}>
            <MenuItem icon="🗺" label="פתיחה" onClick={onOpen} />
            {onShare && <MenuItem icon="↗" label="שיתוף" onClick={onShare} />}
            {isOwner && onDelete && <MenuItem icon="🗑" label="מחיקת מסלול" danger onClick={onDelete} />}
          </div>
        )}
      </div>
    </div>
  );
};

export default MapCard;
