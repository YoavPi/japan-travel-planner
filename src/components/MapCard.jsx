import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Icon from "./Icon";

/* ══════════════════════════════════════════════════════════════
   MapCard — rich trip card (premium profile dashboard).

   Country-illustrated thumb + dark time badge · body (title, meta,
   role tag, standalone SHARE button, collaborator avatars) ·
   ellipsis menu (open / delete). Light + dark palettes. Shared by
   DashboardView.

   Props:
     trip, index
     dark            — palette toggle
     onOpen()
     onCopyLink(trip) optional — if given, renders the in-meta share
                       button (the component still copies + shows
                       feedback)
     onShare(trip)   optional — adds a "שיתוף" menu item (invite sheet)
     onDelete(trip)  optional — adds a destructive "מחק מפה" menu item
   ══════════════════════════════════════════════════════════════ */

const LIGHT = { panel: "#fff", ink: "#0D0F11", ink2: "#2A3036", ink3: "#6B7178", ink4: "#A4AAB1", line: "rgba(20,20,20,0.08)", surface: "#F6F6F4", surface2: "#EFEFEC" };
const DARK  = { panel: "#16191D", ink: "#F5F6F7", ink2: "#C7CCD1", ink3: "#8B9198", ink4: "#6B7178", line: "rgba(255,255,255,0.09)", surface: "#1F242A", surface2: "#262B31" };

const NATURE_SOFT = "#E4EFE5", NATURE_DEEP = "#2B7B71", DANGER = "#C0392B", ACCENT = "#E0533F";
/* Ownership colorways — owned trips read in the signature accent
   (warm coral), shared-with-me trips in a distinct collaborative
   blue so the two are instantly separable in a mixed grid. */
const SHARED_DEEP = "#4A7FB5";
const FONT = "'Noto Sans Hebrew','Inter','Noto Sans JP',system-ui,sans-serif";

const ROLE = {
  owner: { label: "בעלים", icon: "user", bg: "#0D0F11", fg: "#fff" },
  edit:  { label: "עריכה", icon: "edit", bg: NATURE_SOFT, fg: NATURE_DEEP },
  view:  { label: "צפייה", icon: "eye",  bg: "#EFEFEC", fg: "#2A3036" },
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

const MapCard = ({ trip, index = 0, dark = false, active = false, onOpen, onCopyLink, onShare, onDelete, onSaveMemo }) => {
  const P = dark ? DARK : LIGHT;
  const role = ROLE[trip.role] || ROLE.view;
  const lm = landmarkFor(trip);
  const collabs = trip.collaborators || [];
  const shown = collabs.slice(0, 3);
  const extra = collabs.length - shown.length;
  const isOwner = trip.role === "owner";
  /* Signature accent for this card's ownership state — drives the
     resting border, the corner ownership badge, and the left edge
     bar. Active (live) cards always win with the live ACCENT ring. */
  const ownAccent = isOwner ? ACCENT : SHARED_DEEP;

  const [menuOpen, setMenuOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  /* menuRef = the trigger area inside the card; popRef = the portaled
     popover (rendered to <body> so it escapes the card's overflow:hidden
     clip — otherwise the dropdown is cut off at the card's bottom edge
     and "מחק מפה" becomes invisible + unclickable). */
  const menuRef = useRef(null);
  const triggerRef = useRef(null);
  const popRef = useRef(null);
  const [menuPos, setMenuPos] = useState(null);

  /* Sprint 19.3 — per-trip sticky memo (a personal logistical reminder
     editable straight from the dashboard card). */
  const memoTriggerRef = useRef(null);
  const memoPopRef = useRef(null);
  const [memoOpen, setMemoOpen] = useState(false);
  const [memoPos, setMemoPos] = useState(null);
  const [memoDraft, setMemoDraft] = useState(trip.tripMemo || "");

  useEffect(() => { setMemoDraft(trip.tripMemo || ""); }, [trip.tripMemo]);

  useEffect(() => {
    if (!memoOpen) return;
    const onDown = (e) => {
      if (memoTriggerRef.current && memoTriggerRef.current.contains(e.target)) return;
      if (memoPopRef.current && memoPopRef.current.contains(e.target)) return;
      setMemoOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [memoOpen]);

  const toggleMemo = (e) => {
    e.stopPropagation();
    if (!memoOpen && memoTriggerRef.current) {
      const r = memoTriggerRef.current.getBoundingClientRect();
      const width = 248;
      const left = Math.min(Math.max(8, r.left - width + r.width), window.innerWidth - width - 8);
      setMemoPos({ top: Math.round(r.bottom + 6), left: Math.round(left) });
      setMemoDraft(trip.tripMemo || "");
    }
    setMemoOpen((v) => !v);
  };

  const saveMemo = (e) => {
    e.stopPropagation();
    onSaveMemo && onSaveMemo(trip, memoDraft.trim());
    setMemoOpen(false);
  };

  useEffect(() => {
    if (!menuOpen) return;
    const onDown = (e) => {
      if (menuRef.current && menuRef.current.contains(e.target)) return;
      if (popRef.current && popRef.current.contains(e.target)) return;
      setMenuOpen(false);
    };
    const onScroll = () => setMenuOpen(false);
    document.addEventListener("mousedown", onDown);
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", onScroll);
    return () => {
      document.removeEventListener("mousedown", onDown);
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onScroll);
    };
  }, [menuOpen]);

  /* Toggle the options menu, measuring the trigger so the portaled
     popover can be fixed-positioned just beneath it. */
  const toggleMenu = (e) => {
    e.stopPropagation();
    if (!menuOpen && triggerRef.current) {
      const r = triggerRef.current.getBoundingClientRect();
      const width = 168;
      /* Keep the popover within the viewport's inline bounds. */
      const left = Math.min(Math.max(8, r.left), window.innerWidth - width - 8);
      setMenuPos({ top: Math.round(r.bottom + 4), left: Math.round(left) });
    }
    setMenuOpen((v) => !v);
  };

  const copyLink = async (e) => {
    e.stopPropagation();
    const url = trip.readOnly ? `${window.location.origin}/map?demo=1` : `${window.location.origin}/map/edit/${trip.id}`;
    try { await navigator.clipboard.writeText(url); } catch { /* noop */ }
    setCopied(true); setTimeout(() => setCopied(false), 1400);
    onCopyLink && onCopyLink(trip);
  };

  /* Standalone Share button → open the full permissions modal.
     Explicitly catch + stop propagation so the card's onOpen
     (row click → trip overview) never fires underneath it. */
  const openShare = (e) => {
    e.stopPropagation();
    onShare && onShare(trip);
  };

  const MenuItem = ({ icon, label, danger, onClick }) => (
    <button onClick={(e) => { e.stopPropagation(); setMenuOpen(false); onClick && onClick(); }}
      style={{ display: "flex", alignItems: "center", gap: 10, width: "100%", textAlign: "right", padding: "11px 14px", border: "none", background: "transparent", cursor: "pointer", fontFamily: FONT, fontSize: 13.5, fontWeight: 600, color: danger ? DANGER : P.ink, borderBottom: `1px solid ${P.line}` }}>
      <span style={{ width: 18, display: "inline-flex", alignItems: "center", justifyContent: "center", color: danger ? DANGER : P.ink3 }}>
        <Icon name={icon} size={15} strokeWidth={1.9} />
      </span>{label}
    </button>
  );

  return (
    <div
      className="tp-card tp-fade-up"
      onClick={onOpen}
      style={{
        position: "relative", display: "flex", gap: 14, padding: 12, overflow: "hidden",
        borderRadius: 20,
        border: `1px solid ${active ? ACCENT : (dark ? P.line : `${ownAccent}40`)}`,
        background: active ? P.panel : (dark ? P.panel : (isOwner ? "#FFFCFB" : "#FAFCFE")),
        boxShadow: active
          ? `0 0 0 1px ${ACCENT}, 0 10px 30px ${ACCENT}40, 0 2px 8px rgba(0,0,0,0.06)`
          : (dark ? "0 8px 28px rgba(0,0,0,0.4)" : "0 1px 2px rgba(0,0,0,.04), 0 8px 28px rgba(0,0,0,.05)"),
        cursor: "pointer", textAlign: "right", fontFamily: FONT, width: "100%",
        animationDelay: `${Math.min(index, 8) * 55}ms`,
      }}
    >
      {/* Ownership edge bar — a slim signature stripe on the inline-start
          edge: coral for owned, collaborative blue for shared. Hidden
          while live (the ACCENT ring already owns the frame). */}
      {!active && (
        <span aria-hidden style={{ position: "absolute", insetBlock: 0, insetInlineStart: 0, width: 4, background: ownAccent, opacity: isOwner ? 0.9 : 0.75 }} />
      )}
      {/* Thumb — real cover photo when present, otherwise a tinted
          gradient with a quieter landmark glyph (low-opacity SVG-
          stroke-style) so a grid of cards never reads as emoji art. */}
      <div style={{
        width: 92, height: 92, borderRadius: 14, flexShrink: 0, position: "relative", overflow: "hidden",
        background: trip.cover ? `center/cover url(${trip.cover}), linear-gradient(145deg, ${lm.g[0]}, ${lm.g[1]})` : `linear-gradient(145deg, ${lm.g[0]}, ${lm.g[1]})`,
      }}>
        {!trip.cover && (
          <span aria-hidden style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 46, opacity: 0.60, filter: "drop-shadow(0 2px 4px rgba(0,0,0,0.25))" }}>{lm.e}</span>
        )}
        {trip.days ? (
          <span style={{ position: "absolute", bottom: 6, insetInlineStart: 6, background: "rgba(13,15,17,0.82)", color: "#fff", fontSize: 10.5, fontWeight: 700, padding: "2px 7px", borderRadius: 999 }}>{trip.days} ימים</span>
        ) : null}
        {active && (
          <span aria-hidden style={{ position: "absolute", inset: 0, boxShadow: `inset 0 0 0 2px ${ACCENT}`, borderRadius: 14 }} />
        )}
        {/* Ownership badge — minimalist crown (owned) / users (shared)
            chip pinned to the thumb's top inline-end corner. */}
        <span style={{ position: "absolute", top: 6, insetInlineEnd: 6, display: "inline-flex", alignItems: "center", gap: 3, background: ownAccent, color: "#fff", fontSize: 9, fontWeight: 800, letterSpacing: "0.01em", padding: "3px 6px", borderRadius: 999, boxShadow: "0 2px 6px rgba(0,0,0,0.28)" }}>
          <Icon name={isOwner ? "crown" : "users"} size={10} strokeWidth={2.2} />
          {isOwner ? "מפה שלי" : "שותף איתי"}
        </span>
      </div>

      {/* Body */}
      <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column" }}>
        {active && (
          <span style={{ display: "inline-flex", alignItems: "center", gap: 5, alignSelf: "flex-start", background: ACCENT, color: "#fff", fontSize: 10.5, fontWeight: 800, letterSpacing: "0.02em", borderRadius: 999, padding: "3px 9px", marginBottom: 5 }}>
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#fff", boxShadow: "0 0 0 0 rgba(255,255,255,0.7)", animation: "tpLivePulse 1.6s ease-in-out infinite" }} />
            לייב כרגע
          </span>
        )}
        <div style={{ fontSize: 15.5, fontWeight: 800, color: P.ink, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", paddingInlineEnd: 30 }}>{trip.title}</div>
        <div style={{ fontSize: 12, color: P.ink3, marginTop: 2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
          {trip.role !== "owner" && trip.sharedBy ? `שותף ע״י ${trip.sharedBy} · ` : ""}{trip.meta}
        </div>
        {trip.tripMemo && (
          <div style={{ marginTop: 6, display: "flex", alignItems: "flex-start", gap: 6, background: P.surface, border: `1px solid ${P.line}`, borderRadius: 8, padding: "5px 8px" }}>
            <span style={{ fontSize: 11, color: P.ink3, lineHeight: 1.4, overflow: "hidden", textOverflow: "ellipsis", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>{trip.tripMemo}</span>
          </div>
        )}
        <div style={{ marginTop: "auto", paddingTop: 8, display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 10.5, fontWeight: 800, letterSpacing: "0.02em", background: role.bg, color: role.fg, borderRadius: 999, padding: "4px 9px" }}>
            <Icon name={role.icon} size={11} strokeWidth={2.2} />{role.label}
          </span>
          {/* Standalone Share button — lives in the meta block next to
              the role tag (out of the photo, industry-standard glyph).
              When onShare is wired it opens the full permissions modal;
              otherwise it falls back to copy-link feedback.
              Sprint 18.1: sharing is an owner-only privilege — collaborators
              on a shared map never see the share affordance. */}
          {isOwner && (onShare || onCopyLink) && (
            <button onClick={onShare ? openShare : copyLink} title={onShare ? "שיתוף וניהול הרשאות" : (copied ? "הקישור הועתק" : "העתקת קישור")} aria-label="שיתוף" className="tp-press"
              style={{ display: "inline-flex", alignItems: "center", gap: 5, height: 24, padding: "0 10px", borderRadius: 999, border: `1px solid ${copied ? NATURE_DEEP : P.line}`, background: copied ? NATURE_SOFT : P.surface, color: copied ? NATURE_DEEP : P.ink2, cursor: "pointer", fontFamily: FONT, fontSize: 10.5, fontWeight: 800, letterSpacing: "0.02em", transition: "background 0.2s, color 0.2s, border-color 0.2s" }}>
              <Icon name={copied ? "check" : "share"} size={12} strokeWidth={2.2} />
              {copied ? "הועתק" : "שיתוף"}
            </button>
          )}
          {onSaveMemo && (
            <button ref={memoTriggerRef} onClick={toggleMemo} title={trip.tripMemo ? "עריכת הערה" : "הוספת הערה"} aria-label="הערה" className="tp-press"
              style={{ display: "inline-flex", alignItems: "center", gap: 5, height: 24, padding: "0 10px", borderRadius: 999, border: `1px solid ${trip.tripMemo ? P.ink2 : P.line}`, background: P.surface, color: trip.tripMemo ? P.ink : P.ink2, cursor: "pointer", fontFamily: FONT, fontSize: 10.5, fontWeight: 800, letterSpacing: "0.02em", transition: "background 0.2s, color 0.2s, border-color 0.2s" }}>
              <Icon name="edit" size={12} strokeWidth={1.9} />
              הערה
            </button>
          )}
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
          <span ref={triggerRef} onClick={toggleMenu} title="אפשרויות" aria-label="פעולות נוספות" className="tp-press"
            style={{ width: 30, height: 30, borderRadius: "50%", background: menuOpen ? P.surface2 : P.surface, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: P.ink2 }}>
            <Icon name="more" size={16} strokeWidth={1.5} />
          </span>
          {menuOpen && menuPos && createPortal(
            <div ref={popRef} className="tp-pop" dir="rtl" style={{ position: "fixed", top: menuPos.top, left: menuPos.left, zIndex: 1000, minWidth: 168, background: P.panel, border: `1px solid ${P.line}`, borderRadius: 14, boxShadow: "0 16px 40px rgba(0,0,0,0.22)", overflow: "hidden", fontFamily: FONT }}>
              <MenuItem icon="map" label="פתיחה" onClick={onOpen} />
              {isOwner && onShare && <MenuItem icon="share" label="שיתוף" onClick={() => onShare(trip)} />}
              {isOwner && !trip.readOnly && onDelete && <MenuItem icon="trash" label="מחק מפה" danger onClick={() => onDelete(trip)} />}
            </div>,
            document.body
          )}
        </div>
      )}

      {/* Sprint 19.3 — sticky-memo editor, portaled to <body> so it
          escapes the card's overflow:hidden clip. */}
      {memoOpen && memoPos && createPortal(
        <div ref={memoPopRef} className="tp-pop" dir="rtl" onClick={(e) => e.stopPropagation()}
          style={{ position: "fixed", top: memoPos.top, left: memoPos.left, zIndex: 1000, width: 248, background: P.panel, border: `1px solid ${P.line}`, borderRadius: 14, boxShadow: "0 16px 40px rgba(0,0,0,0.22)", padding: 12, fontFamily: FONT }}>
          <div style={{ fontSize: 12, fontWeight: 800, color: P.ink, marginBottom: 8 }}>הערה על הטיול</div>
          <textarea
            value={memoDraft}
            onChange={(e) => setMemoDraft(e.target.value)}
            placeholder="למשל: לבדוק ויזה · להזמין טיסות פנים"
            rows={3}
            style={{ width: "100%", boxSizing: "border-box", padding: "8px 10px", borderRadius: 10, border: `1px solid ${P.line}`, background: P.surface, fontSize: 13, fontFamily: FONT, color: P.ink, direction: "rtl", textAlign: "right", resize: "vertical", lineHeight: 1.5 }}
          />
          <button onClick={saveMemo}
            style={{ marginTop: 8, width: "100%", height: 38, borderRadius: 10, border: "none", background: P.ink, color: P.panel, fontSize: 13, fontWeight: 800, cursor: "pointer", fontFamily: FONT }}>
            שמירת הערה
          </button>
        </div>,
        document.body
      )}
    </div>
  );
};

export default MapCard;
