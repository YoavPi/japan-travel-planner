// src/components/NearbySearchSheet.jsx
import React, { useEffect, useState } from "react";
import { NEARBY_CATEGORIES } from "../utils/nearbyCategories";

/* ══════════════════════════════════════════════════════════════
   NearbySearchSheet — "מצא לי X באזור" picker. Fixed category chips
   + a free-text field. Presentational: hands the chosen query up via
   onPick({ type }) or onPick({ keyword }); the parent runs the search.
   ══════════════════════════════════════════════════════════════ */

const T = {
  panel: "#fff", ink: "#0D0F11", ink2: "#2A3036", ink3: "#6B7178",
  line: "rgba(20,20,20,0.10)", surface: "#F6F6F4", accent: "#E0533F",
  font: "'Noto Sans Hebrew','Inter',system-ui,sans-serif",
};

const NearbySearchSheet = ({ point, onPick, onClose }) => {
  const [kw, setKw] = useState("");
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, []);
  const name = point?.nameHe || point?.name || "הנקודה";
  const submitKw = () => { const v = kw.trim(); if (v) onPick({ keyword: v }); };

  return (
    <div dir="rtl" onClick={onClose}
      style={{ position: "fixed", inset: 0, zIndex: 120, display: "flex", alignItems: "flex-end", justifyContent: "center", background: "rgba(0,0,0,0.5)", fontFamily: T.font }}>
      <div className="tp-sheet-up" onClick={(e) => e.stopPropagation()}
        style={{ width: "100%", maxWidth: 520, background: T.panel, borderTopLeftRadius: 22, borderTopRightRadius: 22, boxShadow: "0 -18px 55px rgba(0,0,0,0.3)", padding: "16px 18px 22px" }}>
        <div style={{ display: "flex", justifyContent: "center", marginBottom: 10 }}>
          <div style={{ width: 44, height: 5, borderRadius: 999, background: T.line }} />
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
          <div style={{ flex: 1, fontSize: 16, fontWeight: 800, color: T.ink, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            מצא ליד <span style={{ color: T.accent }}>{name}</span>
          </div>
          <button onClick={onClose} aria-label="סגירה"
            style={{ width: 32, height: 32, borderRadius: "50%", border: "none", background: T.surface, color: T.ink2, cursor: "pointer", fontFamily: T.font, fontSize: 14 }}>✕</button>
        </div>

        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {NEARBY_CATEGORIES.map((c) => (
            <button key={c.id} onClick={() => onPick({ type: c.type })}
              style={{ display: "inline-flex", alignItems: "center", gap: 7, padding: "10px 14px", borderRadius: 999, border: `1.5px solid ${T.line}`, background: "#fff", color: T.ink2, fontSize: 14, fontWeight: 800, cursor: "pointer", fontFamily: T.font }}>
              <span aria-hidden>{c.emoji}</span> {c.label}
            </button>
          ))}
        </div>

        <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
          <input
            value={kw} onChange={(e) => setKw(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") submitKw(); }}
            placeholder="אחר… (למשל: ראמן, מכבסה)"
            style={{ flex: 1, height: 46, boxSizing: "border-box", borderRadius: 12, border: `1px solid ${T.line}`, background: T.surface, padding: "0 14px", fontSize: 14.5, fontFamily: T.font, color: T.ink, direction: "rtl", textAlign: "right" }}
          />
          <button onClick={submitKw} disabled={!kw.trim()}
            style={{ height: 46, padding: "0 18px", borderRadius: 12, border: "none", background: T.ink, color: "#fff", fontSize: 14.5, fontWeight: 800, cursor: kw.trim() ? "pointer" : "default", opacity: kw.trim() ? 1 : 0.5, fontFamily: T.font }}>
            חיפוש
          </button>
        </div>
      </div>
    </div>
  );
};

export default NearbySearchSheet;
