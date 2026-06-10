import React from "react";

/* ══════════════════════════════════════════════════════════════
   HeroRouteAnimation — landing-page hero visual.

   A stylised map with a route line that draws itself through five
   city pins, then a small paper-plane glides along the route on a
   gentle loop. RTL-aware: the journey starts on the RIGHT (where
   Hebrew reading begins) and ends on the LEFT.

   Motion follows the project tokens captured in DESIGN.md:
     • ease-out enters, 180–500ms micro durations, ~2.6s draw-in
     • Honors prefers-reduced-motion (skips all animation, shows the
       finished state)
     • Single accent color #E0533F, no extra palette additions

   Self-contained: keyframes are declared inline so the component
   travels with its own CSS.
   ══════════════════════════════════════════════════════════════ */

const ACCENT = "#E0533F";
const INK = "#0D0F11";
const INK3 = "#6B7178";
const LINE = "rgba(20,20,20,0.10)";
const SURFACE = "#F6F6F4";

/* Right→left pin order so the journey reads naturally in Hebrew.
   x coordinates are in the SVG's 600-wide viewBox; the path
   connects them with a smooth catmull-style curve. */
const PINS = [
  { x: 520, y: 78,  label: "טוקיו" },
  { x: 410, y: 118, label: "האקונה" },
  { x: 305, y: 70,  label: "קנזאווה" },
  { x: 195, y: 122, label: "קיוטו" },
  { x: 80,  y: 88,  label: "הירושימה" },
];

/* Smooth quadratic-through-points: each segment bends toward the
   midpoint of the next, which gives the route a hand-drawn feel
   without needing a real geographic shape. */
const buildPath = (pts) => {
  let d = `M ${pts[0].x} ${pts[0].y}`;
  for (let i = 1; i < pts.length; i++) {
    const prev = pts[i - 1];
    const curr = pts[i];
    const cx = (prev.x + curr.x) / 2;
    const cy = (prev.y + curr.y) / 2 - 18; /* arc upward slightly */
    d += ` Q ${cx} ${cy} ${curr.x} ${curr.y}`;
  }
  return d;
};

const PATH_D = buildPath(PINS);
/* Approximate path length — used for the stroke-dasharray draw-in.
   The exact length is computed at runtime in the ref callback so
   the dashes match perfectly across browsers. */
const PATH_LENGTH_HINT = 1100;

const HeroRouteAnimation = () => {
  const pathRef = React.useRef(null);

  /* Measure the actual rendered length and write it back as a CSS
     variable so the draw-in animation always covers exactly the
     full route, no matter how the SVG scales. */
  React.useLayoutEffect(() => {
    const el = pathRef.current;
    if (!el) return;
    try {
      const len = el.getTotalLength();
      el.style.setProperty("--routeLen", `${len}`);
    } catch {
      el.style.setProperty("--routeLen", `${PATH_LENGTH_HINT}`);
    }
  }, []);

  return (
    <div
      aria-hidden
      style={{
        position: "relative",
        width: "100%",
        height: 196,
        borderRadius: 22,
        border: `1px solid ${LINE}`,
        background: SURFACE,
        overflow: "hidden",
        marginTop: 22,
      }}
    >
      {/* Scoped keyframes + reduced-motion guard. */}
      <style>{`
        @keyframes hrDraw {
          to { stroke-dashoffset: 0; }
        }
        @keyframes hrPinPop {
          0%   { opacity: 0; transform: translateY(6px) scale(0.4); }
          70%  { opacity: 1; transform: translateY(-1px) scale(1.08); }
          100% { opacity: 1; transform: translateY(0)    scale(1); }
        }
        @keyframes hrLabelIn {
          0%   { opacity: 0; transform: translateY(4px); }
          100% { opacity: 1; transform: translateY(0); }
        }
        @keyframes hrPlane {
          /* Glide along the route, then fade and reset. */
          0%   { offset-distance: 0%;   opacity: 0; }
          8%   { opacity: 1; }
          92%  { opacity: 1; }
          100% { offset-distance: 100%; opacity: 0; }
        }
        @keyframes hrShimmer {
          to { stroke-dashoffset: -60; }
        }
        @keyframes hrTopo {
          0%, 100% { opacity: 0.22; }
          50%      { opacity: 0.32; }
        }

        .hr-route {
          fill: none;
          stroke: ${ACCENT};
          stroke-width: 2.4;
          stroke-linecap: round;
          stroke-linejoin: round;
          stroke-dasharray: var(--routeLen, ${PATH_LENGTH_HINT});
          stroke-dashoffset: var(--routeLen, ${PATH_LENGTH_HINT});
          animation: hrDraw 2.4s cubic-bezier(0.65, 0, 0.35, 1) 0.25s forwards;
          filter: drop-shadow(0 1px 0 rgba(224,83,63,0.18));
        }
        .hr-route-bg {
          fill: none;
          stroke: ${ACCENT};
          stroke-opacity: 0.18;
          stroke-width: 2.4;
          stroke-linecap: round;
          stroke-linejoin: round;
          stroke-dasharray: 4 6;
          animation: hrShimmer 2.4s linear infinite;
          animation-delay: 2.6s;
        }
        .hr-pin {
          transform-box: fill-box;
          transform-origin: center;
          opacity: 0;
          animation: hrPinPop 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
        }
        .hr-label {
          opacity: 0;
          animation: hrLabelIn 0.4s ease-out forwards;
          font-family: 'Noto Sans Hebrew','Inter',sans-serif;
          font-size: 10px;
          font-weight: 700;
          fill: ${INK};
        }
        .hr-label-sub { fill: ${INK3}; font-weight: 600; font-size: 9px; }
        .hr-topo line { animation: hrTopo 6s ease-in-out infinite; }
        .hr-plane {
          offset-path: path("${PATH_D}");
          offset-rotate: auto;
          animation: hrPlane 5.5s cubic-bezier(0.4, 0, 0.6, 1) 2.6s infinite;
          opacity: 0;
        }

        @media (prefers-reduced-motion: reduce) {
          .hr-route, .hr-route-bg, .hr-pin, .hr-label, .hr-plane, .hr-topo line {
            animation: none !important;
          }
          .hr-route { stroke-dashoffset: 0; }
          .hr-pin, .hr-label { opacity: 1; transform: none; }
          .hr-plane { display: none; }
        }
      `}</style>

      {/* Caption pill — anchors the right (RTL start) edge */}
      <div
        style={{
          position: "absolute",
          top: 14,
          insetInlineStart: 14,
          background: "#fff",
          border: `1px solid ${LINE}`,
          borderRadius: 999,
          padding: "5px 11px",
          fontSize: 11,
          fontWeight: 700,
          color: INK,
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          boxShadow: "0 1px 2px rgba(0,0,0,0.04)",
          zIndex: 2,
        }}
      >
        <span
          style={{
            width: 6,
            height: 6,
            borderRadius: "50%",
            background: ACCENT,
            display: "inline-block",
          }}
        />
        מסלול חי · נבנה תוך כדי תכנון
      </div>

      <svg
        viewBox="0 0 600 196"
        width="100%"
        height="100%"
        preserveAspectRatio="xMidYMid slice"
        style={{ display: "block" }}
        role="img"
        aria-label="הדמיית מסלול נסיעה על מפה"
      >
        {/* Topo/contour strokes — very faint, hand-drawn vibe. */}
        <g className="hr-topo" stroke={INK} strokeOpacity="0.06" strokeWidth="1" fill="none" strokeLinecap="round">
          <line x1="0"  y1="40"  x2="600" y2="32"  style={{ animationDelay: "0s" }} />
          <line x1="0"  y1="80"  x2="600" y2="74"  style={{ animationDelay: "0.8s" }} />
          <line x1="0"  y1="120" x2="600" y2="118" style={{ animationDelay: "1.6s" }} />
          <line x1="0"  y1="160" x2="600" y2="158" style={{ animationDelay: "2.4s" }} />
        </g>

        {/* Soft island silhouettes behind the route. */}
        <g fill={INK} opacity="0.04">
          <ellipse cx="120" cy="150" rx="110" ry="32" />
          <ellipse cx="380" cy="150" rx="150" ry="36" />
        </g>

        {/* Underlying dashed "echo" of the route, animates after the
            solid line draws in — gives the feeling of an active
            flight path. */}
        <path className="hr-route-bg" d={PATH_D} />

        {/* Main route — draws itself once via stroke-dashoffset. */}
        <path ref={pathRef} className="hr-route" d={PATH_D} />

        {/* Pins + labels, staggered along the route. The route
            takes ~2.4s to draw; pins pop just after their segment
            is reached. */}
        {PINS.map((p, i) => {
          const popDelay = 0.45 + i * 0.45;
          const labelDelay = popDelay + 0.18;
          return (
            <g key={i}>
              {/* Halo (static white circle behind the dot). */}
              <circle
                className="hr-pin"
                cx={p.x}
                cy={p.y}
                r={9}
                fill="#fff"
                stroke={LINE}
                strokeWidth="1"
                style={{ animationDelay: `${popDelay}s` }}
              />
              {/* Accent dot. */}
              <circle
                className="hr-pin"
                cx={p.x}
                cy={p.y}
                r={4.6}
                fill={ACCENT}
                style={{ animationDelay: `${popDelay + 0.05}s` }}
              />
              {/* Label — placed below the pin, RTL anchored end so
                  longer city names extend leftward consistently. */}
              <text
                className="hr-label"
                x={p.x}
                y={p.y + 22}
                textAnchor="middle"
                style={{ animationDelay: `${labelDelay}s` }}
              >
                {p.label}
              </text>
            </g>
          );
        })}

        {/* Tiny paper-plane glyph that rides the route. Uses CSS
            offset-path so it follows the curve exactly. */}
        <g className="hr-plane">
          <g transform="translate(-7,-6)">
            <path
              d="M 0 6 L 14 0 L 9 6 L 14 12 Z"
              fill={INK}
              stroke="#fff"
              strokeWidth="1"
              strokeLinejoin="round"
            />
          </g>
        </g>
      </svg>
    </div>
  );
};

export default HeroRouteAnimation;
