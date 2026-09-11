import React, { useState } from "react";
import { computeTransit } from "../utils/transit";

/* Extracted verbatim from EditorView.jsx's TransitRail (Sprint 30) as a
   behaviour-preserving no-op — see docs/superpowers/plans/2026-09-11-
   mobile-stop-card-implementation-plan.md Task A5. Redesigned per spec
   §4.7-§4.8 in Task B4; this file intentionally still looks like the old
   inline version except every T.xxx became P.xxx. */
const RAIL_MENU = [
  { mode: "walk", emoji: "🚶", label: "הליכה" },
  { mode: "car", emoji: "🚗", label: "רכב / מונית" },
  { mode: "transit", emoji: "🚆", label: "רכבת" },
  { mode: "bus", emoji: "🚌", label: "אוטובוס" },
];

export default function TransitConnector({ a, b, override = null, onSetMode, units, editable = true, P }) {
  const [hover, setHover] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const seg = computeTransit(a?.coordinates, b?.coordinates, override, units);
  if (!seg) return null;
  const active = hover && editable && !menuOpen;
  const inner = (
    <>
      <span aria-hidden>{seg.emoji}</span>
      <b style={{ color: active ? "#fff" : P.ink2, fontWeight: 700 }}>{seg.minutesLabel}</b>
      <span style={{ color: active ? "rgba(255,255,255,0.7)" : P.ink4 }}>·</span>
      <span>{seg.he}</span>
      <span style={{ color: active ? "rgba(255,255,255,0.7)" : P.ink4 }}>·</span>
      <span>{seg.distLabel}</span>
      {editable && (
        <span aria-hidden style={{ display: "inline-flex", marginInlineStart: 2, fontSize: 9, opacity: hover ? 1 : 0.55 }}>▾</span>
      )}
    </>
  );
  const baseStyle = {
    display: "inline-flex", alignItems: "center", gap: 6,
    padding: "4px 10px", borderRadius: 999,
    border: `1px solid ${active ? P.ink : (override ? P.accent : P.line)}`,
    background: active ? P.ink : P.panel,
    color: active ? "#fff" : P.ink3,
    fontSize: 11, fontFamily: "inherit",
    transition: "background 0.18s ease, color 0.18s ease, border-color 0.18s ease",
  };
  return (
    <div style={{ display: "flex", justifyContent: "center", padding: "2px 0", position: "relative" }}>
      {editable ? (
        <>
          <button
            onClick={() => setMenuOpen((v) => !v)}
            onMouseEnter={() => setHover(true)}
            onMouseLeave={() => setHover(false)}
            aria-haspopup="menu" aria-expanded={menuOpen}
            aria-label="שינוי אופן המעבר"
            title="שינוי אופן המעבר"
            style={{ ...baseStyle, cursor: "pointer" }}
          >
            {inner}
          </button>
          {menuOpen && (
            <>
              <div onClick={() => setMenuOpen(false)} style={{ position: "fixed", inset: 0, zIndex: 20 }} />
              <div role="menu" className="tp-pop" dir="rtl" style={{
                position: "absolute", top: "100%", marginTop: 4, zIndex: 21,
                display: "flex", gap: 4, padding: 4, background: P.panel,
                borderRadius: 999, border: `1px solid ${P.line}`,
                boxShadow: "0 10px 30px rgba(0,0,0,0.16)",
              }}>
                {RAIL_MENU.map((m) => {
                  const on = seg.mode === m.mode;
                  return (
                    <button key={m.mode} role="menuitemradio" aria-checked={on}
                      title={m.label}
                      onClick={() => { onSetMode && onSetMode(m.mode); setMenuOpen(false); }}
                      style={{
                        width: 34, height: 34, borderRadius: "50%", cursor: "pointer",
                        border: `1px solid ${on ? P.ink : P.line}`, background: on ? P.ink : P.panel,
                        fontSize: 16, lineHeight: 1, display: "inline-flex", alignItems: "center", justifyContent: "center",
                        fontFamily: "inherit", transition: "background 0.15s, border-color 0.15s",
                      }}>
                      <span aria-hidden style={{ filter: on ? "none" : "grayscale(0.15)" }}>{m.emoji}</span>
                    </button>
                  );
                })}
              </div>
            </>
          )}
        </>
      ) : (
        <span style={baseStyle}>{inner}</span>
      )}
    </div>
  );
}
