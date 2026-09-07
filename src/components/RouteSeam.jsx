import React from "react";

/* ══════════════════════════════════════════════════════════════
   RouteSeam — the page's spine (homepage spec §1.5).

   The brand mark is "a planned route bending from an open start
   point to a destination pin" (src/brand/README.md), and the
   product IS a route. So one continuous vermillion line runs down
   the INLINE-START margin (the right edge in RTL), entering at the
   hero and terminating in a pin at the closing fold.

   Deliberately NOT a decorative divider:
     • it amplifies an asset the brand already owns
     • it is RTL-native by construction — the journey starts on the
       right, matching HeroRouteAnimation.jsx's existing choice
     • it is cheap: no document-height measurement, no scroll-linked
       layout thrash, and it survives folds whose height depends on
       fetched data

   The dash-draw technique is harvested from HeroRouteAnimation.jsx
   (getTotalLength + a --routeLen custom property), which is retired
   from `/` but kept in the repo for exactly this.
   ══════════════════════════════════════════════════════════════ */

/* Alternating bends so the line reads as a route, not a rule. */
const PATHS = [
  "M52 0 C52 26, 30 34, 30 58 L30 76",
  "M30 0 C30 24, 50 32, 50 56 L50 76",
  "M50 0 C50 26, 26 32, 26 58 L26 76",
  "M26 0 C26 24, 46 34, 46 58 L46 76",
  "M46 0 C46 26, 30 32, 30 56 L30 74",
];

const RouteSeam = ({ variant = 0, terminal = false, onDark = false }) => {
  const d = PATHS[variant % PATHS.length];
  /* Where the stroke ends — the pin sits here. */
  const endX = Number(d.slice(d.lastIndexOf("L") + 1).trim().split(" ")[0]);
  const stroke = "#E0533F";

  return (
    <div
      aria-hidden="true"
      style={{
        display: "flex",
        justifyContent: "flex-start",
        paddingInlineStart: "clamp(16px, 4vw, 52px)",
        background: onDark ? "transparent" : "transparent",
        pointerEvents: "none",
      }}
    >
      <svg width="72" height="84" viewBox="0 0 72 84" style={{ display: "block", overflow: "visible" }}>
        <path
          className="tp-seam-path"
          d={d}
          fill="none"
          stroke={stroke}
          strokeWidth="2.5"
          strokeLinecap="round"
        />
        {terminal ? (
          /* Geometry matched to BrandMark's pin so the page's full stop
             is the brand mark itself, not a generic dot. */
          <g transform={`translate(${endX - 9}, 74) scale(0.75)`}>
            <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" fill={stroke} />
            <circle cx="12" cy="10" r="3.2" fill={onDark ? "#14110E" : "#FDFCF7"} />
          </g>
        ) : (
          <circle cx={endX} cy="79" r="3.5" fill={stroke} />
        )}
      </svg>
    </div>
  );
};

export default RouteSeam;
