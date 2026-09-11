import React, { useState } from "react";
import { computeTransit } from "../utils/transit";
import { readableInkOn } from "../utils/contrast";
import Icon from "./Icon";

/* Redesigned per spec §4.7-§4.8 (Task B4) as an "axis connector": 44px hit /
   28px visible pill, no border, Icon glyphs replacing emoji, visible Hebrew
   mode labels in the popover (not title-only), and the override marker on
   the icon's colour instead of a border. Hover-inversion (unreachable on
   touch) has been deleted — the pill has exactly two visual states:
   default and menuOpen. */
const RAIL_MENU = [
  { mode: "walk", label: "הליכה" },
  { mode: "car", label: "רכב / מונית" },
  { mode: "transit", label: "רכבת" },
  { mode: "bus", label: "אוטובוס" },
];

/* Mode → Icon.jsx glyph name. `transit` (the internal mode key, historically
   meaning "train/public transit") maps to the `train` glyph. */
const modeIconFor = (mode) => ({ walk: "walk", car: "car", transit: "train", bus: "bus" }[mode] || "train");

export default function TransitConnector({ a, b, override = null, onSetMode, units, editable = true, P }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const seg = computeTransit(a?.coordinates, b?.coordinates, override, units);
  if (!seg) return null;
  const iconColor = seg.overridden ? P.accent : P.ink3;
  const inner = (
    <>
      <Icon name={modeIconFor(seg.mode)} size={13} color={iconColor} />
      <b style={{ color: P.ink2, fontWeight: 700, fontSize: 12 }}>{seg.minutesLabel}</b>
      <span style={{ color: P.ink4 }}>·</span>
      <span style={{ color: P.ink3, fontWeight: 600, fontSize: 12 }}>{seg.distLabel}</span>
      {editable && <Icon name="chevronDown" size={11} color={P.ink3} style={{ marginInlineStart: 2 }} />}
    </>
  );
  /* Visible 28px pill drawn on an inner span; the outer <button> carries the
     44px hit box via padding-block so the target grows without the pill
     looking oversized. */
  const pillStyle = {
    display: "inline-flex", alignItems: "center", gap: 6,
    padding: "0 10px", height: 28, borderRadius: 999,
    background: menuOpen ? P.surface2 : P.surface,
    color: P.ink3, fontSize: 11, fontFamily: "inherit",
    transition: "background 0.18s ease",
  };
  return (
    <div style={{ display: "flex", justifyContent: "center", padding: "2px 0", position: "relative" }}>
      {editable ? (
        <>
          <button
            onClick={() => setMenuOpen((v) => !v)}
            aria-haspopup="menu" aria-expanded={menuOpen}
            aria-label={`${seg.minutesLabel} ${seg.he}, ${seg.distLabel} — שינוי אופן המעבר`}
            title="שינוי אופן המעבר"
            style={{
              display: "inline-flex", alignItems: "center", justifyContent: "center",
              border: "none", background: "transparent", cursor: "pointer",
              paddingBlock: 8, fontFamily: "inherit",
            }}
          >
            <span style={pillStyle}>{inner}</span>
          </button>
          {menuOpen && (
            <>
              <div onClick={() => setMenuOpen(false)} style={{ position: "fixed", inset: 0, zIndex: 20 }} />
              <div role="menu" className="tp-pop" dir="rtl" style={{
                position: "absolute", top: "100%", marginTop: 4, zIndex: 21,
                display: "flex", gap: 4, padding: 4, background: P.panel,
                borderRadius: 16, border: `1px solid ${P.line}`,
                boxShadow: "0 10px 30px rgba(0,0,0,0.16)",
              }}>
                {RAIL_MENU.map((m) => {
                  const on = seg.mode === m.mode;
                  const fg = on ? readableInkOn(P.ink) : P.ink2;
                  return (
                    <button key={m.mode} role="menuitemradio" aria-checked={on}
                      onClick={() => { onSetMode && onSetMode(m.mode); setMenuOpen(false); }}
                      style={{
                        width: 48, height: 56, borderRadius: 12, cursor: "pointer",
                        border: "none", background: on ? P.ink : P.surface, color: fg,
                        display: "inline-flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 4,
                        fontFamily: "inherit", transition: "background 0.15s, color 0.15s",
                      }}>
                      <Icon name={modeIconFor(m.mode)} size={20} color={fg} />
                      <span style={{ fontSize: 10, fontWeight: 700 }}>{m.label}</span>
                    </button>
                  );
                })}
              </div>
            </>
          )}
        </>
      ) : (
        <span style={pillStyle}>{inner}</span>
      )}
    </div>
  );
}
