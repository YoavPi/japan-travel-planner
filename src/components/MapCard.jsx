import React, { useEffect, useRef, useState } from "react";

/* ══════════════════════════════════════════════════════════════
   MapCard — rich trip card (premium profile dashboard).

   Country-illustrated thumb + dark time badge · standalone overlay
   SHARE button (immediate clipboard copy) · body (title, meta,
   role tag, collaborator avatars) · ellipsis menu (open / delete).
   Light + dark palettes. Shared by DashboardView & ProfileView.

   Props:
     trip, index
     dark            — palette toggle
     onOpen()
     onCopyLink(trip) optional — if given, renders the overlay share
                       (the component still copies + shows feedback)
     onShare(trip)   optional — adds a "שיתוף" menu item (invite sheet)
     onDelete(trip)  optional — adds a destructive "מחק מפה" menu item
   ══════════════════════════════════════════════════════════════ */

const LIGHT = { panel: "#fff", ink: "#0D0F11", ink2: "#2A3036", ink3: "#6B7178", ink4: "#A4AAB1", line: "rgba(20,20,20,0.08)", surface: "#F6F6F4", surface2: "#EFEFEC" };
const DARK  = { panel: "#16191D", ink: "#F5F6F7", ink2: "#C7CCD1", ink3: "#8B9198", ink4: "#6B7178", line: "rgba(255,255,255,0.09)", surface: "#1F242A", surface2: "#262B31" };

const NATURE_SOFT = "#E4EFE5", NATURE_DEEP = "#2B7B71", DANGER = "#C0392B";
const FONT = "'Noto Sans Hebrew','Inter','Noto Sans JP',system-ui,sans-serif";

const ROLE = {
  owner: { label: "בעלים", icon: "👤", bg: "#0D0F11", fg: "#fff" },
  edit:  { label: "עריכה", icon: "✏", bg: NATURE_SOFT, fg: NATURE_DEEP },
  view:  { label: "צפייה", icon: "👁", bg: "#EFEFEC", fg: "#2A3036" },
};

/* Country → landmark glyph + themed gradient for the thumb. */
const LANDMARKS = {
  japan:    { e: "⛩️", g: ["#E0533F", "#B83A2B"] },
  italy:    { e: "🏛️", g: ["#5A8C5F", "#3E6B45"] },
  portugal: { e: "🚋", g: ["#4A7FB5", "#345C86"] },
  greece:   { e: "🏺", g: ["#4E9E94", "#2B7B71"] },
  thailand: { e: "🛕", g: ["#C9A03F", "#9C7826"] },
  vietnam:  { e: "🛶", g: ["#5A8C5F", "#3E6B45"] },
  dubai:    { e: "🕌", g: ["#C9A03F", "#9C7826"] },
  france:   { e: "🗼", g: ["#4A7FB5", "#345C86"] },
  spain:    { e: "💃", g: ["#E0533F", "#B83A2B"] },
  usa:      { e: "🗽", g: ["#4A7FB5", "#345C86"] },
};
const landmarkFor = (trip) => {
  const en = (trip.settings?.destination || "").toLowerCase();
  const he = `${trip.title || ""} ${trip.settings?.destinationHe || ""}`;
  const map = [
    ["japan", /japan|יפן/i], ["italy", /italy|איטל/i], ["portugal", /portugal|פורטוג/i],
    ["greece", /greece|יוון/i], ["thailand", /thailand|תאיל/i], ["vietnam", /vietnam|וייטנא/i],
    ["dubai", /dubai|uae|דובאי|איחוד/i], ["france", /france|צרפת|פריז/i],
    ["spain", /spain|ספרד|ברצלונה/i], ["usa", /usa|united states|ארה|ניו יורק/i],
  ];
  for (const [key, rx] of map) if (rx.test(en) || rx.test(he)) return LANDMARKS[key];
  return { e: "🗺️", g: ["#8A94A0", "#5E6772"] };
};

const Initial = ({ name, i }) => (
  <span style={{ width: 24, height: 24, borderRadius: "50%", border: "2px solid #fff", background: "#EFEFEC", color: "#2A3036", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 800, marginInlineStart: i ? -8 : 0 }}>
    {(name || "?").trim().slice(0, 1)}
  </span>
);

const MapCard = ({ trip, index = 0, dark = false, onOpen, onCopyLink, onShare, onDelete }) => {
  const P = dark ? DARK : LIGHT;
  const role = ROLE[trip.role] || ROLE.view;
  const lm = landmarkFor(trip);
  const collabs = trip.collaborators || [];
  const shown = collabs.slice(0, 3);
  const extra = collabs.length - shown.length;
  const isOwner = trip.role === "owner";

  const [menuOpen, setMenuOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    if (!menuOpen) return;
    const onDown = (e) => { if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false); };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [menuOpen]);

  const copyLink = async (e) => {
    e.stopPropagation();
    const url = trip.readOnly ? `${window.location.origin}/map?demo=1` : `${window.location.origin}/map/edit/${trip.id}`;
    try { await navigator.clipboard.writeText(url); } catch { /* noop */ }
    setCopied(true); setTimeout(() => setCopied(false), 1400);
    onCopyLink && onCopyLink(trip);
  };

  const MenuItem = ({ icon, label, danger, onClick }) => (
    <button onClick={(e) => { e.stopPropagation(); setMenuOpen(false); onClick && onClick(); }}
      style={{ display: "flex", alignItems: "center", gap: 10, width: "100%", textAlign: "right", padding: "11px 14px", border: "none", background: "transparent", cursor: "pointer", fontFamily: FONT, fontSize: 13.5, fontWeight: 600, color: danger ? DANGER : P.ink, borderBottom: `1px solid ${P.line}` }}>
      <span aria-hidden style={{ width: 18 }}>{icon}</span>{label}
    </button>
  );

  return (
    <div
      className="tp-card tp-fade-up"
      onClick={onOpen}
      style={{
        position: "relative", display: "flex", gap: 14, padding: 12,
        borderRadius: 20, border: `1px solid ${P.line}`, background: P.panel,
        boxShadow: dark ? "0 8px 28px rgba(0,0,0,0.4)" : "0 1px 2px rgba(0,0,0,.04), 0 8px 28px rgba(0,0,0,.05)",
        cursor: "pointer", textAlign: "right", fontFamily: FONT, width: "100%",
        animationDelay: `${Math.min(index, 8) * 55}ms`,
      }}
    >
      {/* Illustrated thumb */}
      <div style={{ width: 92, height: 92, borderRadius: 14, flexShrink: 0, position: "relative", overflow: "hidden", background: `linear-gradient(145deg, ${lm.g[0]}, ${lm.g[1]})` }}>
        <span aria-hidden style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 40, filter: "drop-shadow(0 2px 4px rgba(0,0,0,0.25))" }}>{lm.e}</span>
        {trip.days ? (
          <span style={{ position: "absolute", bottom: 6, insetInlineStart: 6, background: "rgba(13,15,17,0.82)", color: "#fff", fontSize: 10.5, fontWeight: 700, padding: "2px 7px", borderRadius: 999 }}>{trip.days} ימים</span>
        ) : null}
        {/* Standalone overlay SHARE (immediate copy) */}
        {onCopyLink && (
          <button onClick={copyLink} title="העתקת קישור" className="tp-press"
            style={{ position: "absolute", top: 6, insetInlineEnd: 6, width: 26, height: 26, borderRadius: "50%", border: "none", background: "rgba(255,255,255,0.92)", color: "#0D0F11", cursor: "pointer", fontSize: 12, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 2px 6px rgba(0,0,0,0.2)" }}>
            {copied ? "✓" : "↗"}
          </button>
        )}
      </div>

      {/* Body */}
      <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column" }}>
        <div style={{ fontSize: 15.5, fontWeight: 800, color: P.ink, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", paddingInlineEnd: 30 }}>{trip.title}</div>
        <div style={{ fontSize: 12, color: P.ink3, marginTop: 2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
          {trip.role !== "owner" && trip.sharedBy ? `שותף ע״י ${trip.sharedBy} · ` : ""}{trip.meta}
        </div>
        <div style={{ marginTop: "auto", paddingTop: 8, display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 10.5, fontWeight: 800, letterSpacing: "0.02em", background: role.bg, color: role.fg, borderRadius: 999, padding: "4px 9px" }}>
            <span aria-hidden>{role.icon}</span>{role.label}
          </span>
          {isOwner && shown.length > 0 && (
            <span style={{ display: "flex", alignItems: "center", marginInlineStart: "auto" }}>
              {shown.map((c, i) => <Initial key={i} name={c.name} i={i} />)}
              {extra > 0 && <span style={{ width: 24, height: 24, borderRadius: "50%", border: "2px solid #fff", background: "#0D0F11", color: "#fff", fontSize: 9.5, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center", marginInlineStart: -8 }}>+{extra}</span>}
            </span>
          )}
        </div>
      </div>

      {/* Ellipsis menu (open / delete) */}
      {(onShare || onDelete) && (
        <div ref={menuRef} style={{ position: "absolute", top: 12, insetInlineStart: 12 }}>
          <span onClick={(e) => { e.stopPropagation(); setMenuOpen((v) => !v); }} title="אפשרויות" className="tp-press"
            style={{ width: 30, height: 30, borderRadius: "50%", background: menuOpen ? P.surface2 : P.surface, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, cursor: "pointer", color: P.ink2 }}>⋯</span>
          {menuOpen && (
            <div className="tp-pop" style={{ position: "absolute", top: 36, insetInlineStart: 0, zIndex: 10, minWidth: 168, background: P.panel, border: `1px solid ${P.line}`, borderRadius: 14, boxShadow: "0 16px 40px rgba(0,0,0,0.22)", overflow: "hidden" }}>
              <MenuItem icon="🗺" label="פתיחה" onClick={onOpen} />
              {onShare && <MenuItem icon="↗" label="שיתוף" onClick={() => onShare(trip)} />}
              {isOwner && onDelete && <MenuItem icon="🗑" label="מחק מפה" danger onClick={() => onDelete(trip)} />}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default MapCard;
