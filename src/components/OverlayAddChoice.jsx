import React, { useState } from "react";

/* ══════════════════════════════════════════════════════════════
   OverlayAddChoice — the "add to bank OR a specific day" chooser
   for "מפות נוספות". Opened when the user taps ＋ הוסף on a
   reference-map point (from the side list, the multi-select bar,
   or the map popup). Shared by mobile + desktop.

   Props:
     points    — array of points being added (1 or many)
     days      — [{ day, city|cityHe }] of the CURRENT trip
     activeDay — number, highlighted as the likely target
     dark      — theme
     onPick(target, includeNotes)  — target = "bank" | <dayNumber>
     onClose()
   ══════════════════════════════════════════════════════════════ */

const FONT = "'Noto Sans Hebrew','Inter','Noto Sans JP',system-ui,sans-serif";
const OVERLAY_COLOR = "#0C8B94";

const OverlayAddChoice = ({ points = [], days = [], activeDay, dark = false, onPick, onClose }) => {
  const [includeNotes, setIncludeNotes] = useState(true);
  if (!points.length) return null;

  const T = dark
    ? { panel: "#191B1F", surface: "#24272C", ink: "#F3F4F6", ink2: "#C7CBD1", ink3: "#8B9198", line: "rgba(255,255,255,0.12)" }
    : { panel: "#FFFFFF", surface: "#F6F6F4", ink: "#0D0F11", ink2: "#2A3036", ink3: "#6B7178", line: "rgba(20,20,20,0.12)" };

  const n = points.length;
  const title = n === 1 ? (points[0].nameHe || points[0].name) : `${n} נקודות`;

  const dayBtn = (d) => {
    const isActive = d.day === activeDay;
    return (
      <button key={d.day} onClick={() => onPick(d.day, includeNotes)}
        className="tp-press"
        style={{
          display: "flex", alignItems: "center", gap: 8, width: "100%", textAlign: "start",
          padding: "11px 13px", borderRadius: 11, cursor: "pointer", fontFamily: "inherit",
          border: `1px solid ${isActive ? OVERLAY_COLOR : T.line}`,
          background: isActive ? "rgba(12,139,148,0.07)" : T.panel, color: T.ink,
        }}>
        <span aria-hidden style={{ flexShrink: 0, width: 26, height: 26, borderRadius: 8, background: T.surface, display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 800, color: T.ink2 }}>{d.day}</span>
        <span style={{ flex: 1, minWidth: 0, fontSize: 14, fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
          יום {d.day}{(d.cityHe || d.city) ? ` · ${d.cityHe || d.city}` : ""}
        </span>
        {isActive && <span style={{ fontSize: 10.5, fontWeight: 800, color: OVERLAY_COLOR }}>נוכחי</span>}
      </button>
    );
  };

  return (
    <div dir="rtl" onClick={onClose}
      style={{ position: "fixed", inset: 0, zIndex: 240, display: "flex", alignItems: "center", justifyContent: "center", padding: 16, background: "rgba(8,10,14,0.5)", fontFamily: FONT }}>
      <div onClick={(e) => e.stopPropagation()} className="tp-pop"
        style={{ width: "100%", maxWidth: 380, maxHeight: "82vh", background: T.panel, color: T.ink, borderRadius: 18, boxShadow: "0 24px 70px rgba(0,0,0,0.4)", display: "flex", flexDirection: "column", overflow: "hidden" }}>

        {/* Header */}
        <div style={{ flexShrink: 0, display: "flex", alignItems: "center", gap: 8, padding: "15px 16px", borderBottom: `1px solid ${T.line}` }}>
          <span aria-hidden style={{ width: 22, height: 22, borderRadius: 6, background: OVERLAY_COLOR, display: "inline-flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 11 }}>◆</span>
          <span style={{ minWidth: 0, flex: 1 }}>
            <span style={{ display: "block", fontSize: 12, color: T.ink3, fontWeight: 700 }}>הוספה למסלול</span>
            <span dir="auto" style={{ display: "block", fontSize: 15, fontWeight: 800, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{title}</span>
          </span>
          <button onClick={onClose} aria-label="סגירה" style={{ flexShrink: 0, width: 30, height: 30, borderRadius: 8, border: "none", background: T.surface, color: T.ink2, cursor: "pointer", fontFamily: "inherit", fontSize: 15, fontWeight: 800 }}>✕</button>
        </div>

        {/* Body */}
        <div style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: "14px 16px", display: "flex", flexDirection: "column", gap: 8 }}>
          {/* Bank */}
          <button onClick={() => onPick("bank", includeNotes)} className="tp-press"
            style={{ display: "flex", alignItems: "center", gap: 10, width: "100%", textAlign: "start", padding: "13px 14px", borderRadius: 12, border: "none", background: OVERLAY_COLOR, color: "#fff", cursor: "pointer", fontFamily: "inherit" }}>
            <span aria-hidden style={{ fontSize: 17 }}>🔖</span>
            <span style={{ flex: 1, fontSize: 15, fontWeight: 800 }}>לבנק הנקודות</span>
            <span style={{ fontSize: 11, fontWeight: 700, opacity: 0.85 }}>שמירה לשיבוץ מאוחר</span>
          </button>

          {days.length > 0 && (
            <div style={{ display: "flex", alignItems: "center", gap: 8, margin: "4px 0 2px" }}>
              <span style={{ flex: 1, height: 1, background: T.line }} />
              <span style={{ fontSize: 11.5, fontWeight: 700, color: T.ink3 }}>או ליום ספציפי</span>
              <span style={{ flex: 1, height: 1, background: T.line }} />
            </div>
          )}
          {days.map(dayBtn)}
        </div>

        {/* Footer — include-notes toggle */}
        <div style={{ flexShrink: 0, padding: "11px 16px", borderTop: `1px solid ${T.line}` }}>
          <button onClick={() => setIncludeNotes((v) => !v)} aria-pressed={includeNotes}
            style={{ display: "inline-flex", alignItems: "center", gap: 9, border: "none", background: "transparent", cursor: "pointer", fontFamily: "inherit", padding: 0 }}>
            <span style={{ width: 40, height: 24, borderRadius: 999, padding: 3, background: includeNotes ? OVERLAY_COLOR : (dark ? "rgba(255,255,255,0.18)" : "rgba(20,20,20,0.18)"), transition: "background 0.2s" }}>
              <span style={{ display: "block", width: 18, height: 18, borderRadius: "50%", background: "#fff", transform: includeNotes ? "translateX(-16px)" : "translateX(0)", transition: "transform 0.2s" }} />
            </span>
            <span style={{ fontSize: 13.5, fontWeight: 700, color: T.ink2 }}>כלול הערות</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default OverlayAddChoice;
