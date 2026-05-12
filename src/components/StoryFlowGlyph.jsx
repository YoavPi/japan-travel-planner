import React from "react";

/* ══════════════════════════════════════════════════════════════
   GLYPHS — Travel-Story v3 icon set
   ──────────────────────────────────────────────────────────────
   Pure SVG line icons, no library. Stroke-based so they pick up
   whatever colour you pass. Used by:
     - StopRow medallion (stop's category)
     - TransitSegment pill (walk/train/etc)
     - CityTransit centre disc (shinkansen/bus/car/...)
   ══════════════════════════════════════════════════════════════ */

export const Glyph = ({ name, color = "#FDFCF7", size = 18, strokeWidth = 1.6 }) => {
  const props = {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: color,
    strokeWidth,
    strokeLinecap: "round",
    strokeLinejoin: "round",
    "aria-hidden": true,
  };
  switch (name) {
    case "walk":
      return (
        <svg {...props}>
          <circle cx="13" cy="4.5" r="1.6" />
          <path d="M9 21l2-5 3-3-2-4-3 2-2 3" />
          <path d="M14 13l3 2 2 3" />
        </svg>
      );
    case "torii":
      return (
        <svg {...props}>
          <path d="M3 7h18M5 9h14M7 4h10M7 4v3M17 4v3M9 9v12M15 9v12" />
        </svg>
      );
    case "noodle":
      return (
        <svg {...props}>
          <path d="M4 11h16a8 8 0 01-8 8 8 8 0 01-8-8z" />
          <path d="M7 8c1-2 3-2 4 0M13 7c1-2 3-2 4 0M10 6c1-2 3-2 4 0" />
        </svg>
      );
    case "cup":
      return (
        <svg {...props}>
          <path d="M5 8h12v6a4 4 0 01-4 4H9a4 4 0 01-4-4V8zM17 9h2a2 2 0 010 4h-2M7 4v2M11 4v2M15 4v2" />
        </svg>
      );
    case "tower":
      return (
        <svg {...props}>
          <path d="M12 3v18M9 8h6M7 13h10M5 19h14" />
        </svg>
      );
    case "sushi":
      return (
        <svg {...props}>
          <ellipse cx="12" cy="14" rx="8" ry="4" />
          <path d="M4 14v2a8 4 0 0016 0v-2" />
          <path d="M9 11l1-3M14 11l1-3" />
        </svg>
      );
    case "glass":
      return (
        <svg {...props}>
          <path d="M6 4h12l-2 8a4 4 0 01-8 0L6 4zM12 16v4M9 20h6" />
        </svg>
      );
    case "hotel":
      return (
        <svg {...props}>
          <path d="M3 21V8l9-5 9 5v13" />
          <path d="M9 21v-7h6v7M3 21h18" />
          <circle cx="12" cy="11" r="1" />
        </svg>
      );
    case "shinkansen":
      return (
        <svg {...props}>
          <path d="M3 8c0-2 2-4 9-4s9 2 9 4v8a2 2 0 01-2 2H5a2 2 0 01-2-2V8z" />
          <path d="M3 12h18M7 8l-2-3M17 8l2-3" />
          <circle cx="7" cy="15" r="0.8" />
          <circle cx="17" cy="15" r="0.8" />
        </svg>
      );
    case "subway":
      return (
        <svg {...props}>
          <rect x="5" y="3" width="14" height="14" rx="2" />
          <path d="M5 13h14M9 17l-2 4M15 17l2 4" />
          <circle cx="9" cy="8" r="0.8" />
          <circle cx="15" cy="8" r="0.8" />
        </svg>
      );
    case "train":
      return (
        <svg {...props}>
          <rect x="5" y="3" width="14" height="16" rx="2" />
          <path d="M5 11h14" />
          <circle cx="9" cy="15" r="0.8" />
          <circle cx="15" cy="15" r="0.8" />
          <path d="M8 19l-2 3M16 19l2 3" />
        </svg>
      );
    case "bus":
      return (
        <svg {...props}>
          <rect x="4" y="5" width="16" height="13" rx="2" />
          <path d="M4 11h16" />
          <circle cx="8" cy="15" r="1" />
          <circle cx="16" cy="15" r="1" />
          <path d="M8 18v2M16 18v2" />
        </svg>
      );
    case "taxi":
    case "car":
      return (
        <svg {...props}>
          <path d="M3 13l2-6h14l2 6v5H3v-5z" />
          <circle cx="7" cy="17" r="1.3" />
          <circle cx="17" cy="17" r="1.3" />
          <path d="M9 7V4h6v3" />
        </svg>
      );
    default:
      return (
        <svg {...props}>
          <circle cx="12" cy="12" r="6" />
        </svg>
      );
  }
};

/* Smaller meta icons for buttons / headers */
export const MetaIcon = ({ name, size = 14, color = "currentColor" }) => {
  const props = {
    width: size, height: size, viewBox: "0 0 24 24",
    fill: "none", stroke: color, strokeWidth: 1.8,
    strokeLinecap: "round", strokeLinejoin: "round",
    "aria-hidden": true,
  };
  switch (name) {
    case "arrow":  return <svg {...props}><path d="M5 12h14M13 6l6 6-6 6"/></svg>;
    case "back":   return <svg {...props}><path d="M19 12H5M11 6l-6 6 6 6"/></svg>;
    case "plus":   return <svg {...props}><path d="M12 5v14M5 12h14"/></svg>;
    case "minus":  return <svg {...props}><path d="M5 12h14"/></svg>;
    case "expand": return <svg {...props}><path d="M9 3H3v6M15 3h6v6M9 21H3v-6M15 21h6v-6"/></svg>;
    case "home":   return <svg {...props}><path d="M3 11l9-8 9 8M5 9v11h14V9"/></svg>;
    case "globe":  return <svg {...props}><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 010 18M12 3a14 14 0 000 18"/></svg>;
    case "pin":    return <svg {...props}><path d="M12 22s7-7 7-13a7 7 0 10-14 0c0 6 7 13 7 13z"/><circle cx="12" cy="9" r="2.5"/></svg>;
    case "close":  return <svg {...props}><path d="M18 6 6 18M6 6l12 12"/></svg>;
    case "chev":   return <svg {...props}><polyline points="6 9 12 15 18 9"/></svg>;
    default: return null;
  }
};

export const TRANSIT_LABEL_HE = {
  walk: "הליכה",
  subway: "מטרו",
  train: "רכבת",
  bus: "אוטובוס",
  taxi: "מונית",
  car: "רכב",
  shinkansen: "שינקנסן",
};
