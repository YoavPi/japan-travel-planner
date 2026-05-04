import React, { useEffect, useRef } from "react";
import { tripData } from "../data/tripData";

/* ══════════════════════════════════════════════════════════════
   DAY STRIP — Vertical 1–31 quick-jump sidebar
   ──────────────────────────────────────────────────────────────
   A persistent narrow column of day buttons (1, 2, 3, … 31) that
   sits on the inner edge of the side pane on desktop and on the
   left edge of the screen on mobile. Two-way synced via the
   shared `selectedDay` state in ExploreView:

     • Click a number → onSelectDay(n) → map flyTo + flow scroll
       (handled upstream)
     • Map / flow change selectedDay → the matching button gets
       the active style and is auto-scrolled into view here so the
       index stays glanceable.

   Each button is colored by its day's CITY so users can read the
   journey at a glance even before selecting anything (e.g. days
   1–7 in vermillion = Tokyo, 8–9 in green = Kanazawa, etc.).
   ══════════════════════════════════════════════════════════════ */

/* Re-using the city palette from MapComponent — kept inline here
   to avoid a circular import. Update both maps together if you
   ever change the palette. */
const CITY_COLORS = {
  "Tokyo":           { bg: "#D94025", text: "#fff" },
  "Tokyo Disney":    { bg: "#E87D6E", text: "#fff" },
  "Tokyo DisneySea": { bg: "#F09080", text: "#fff" },
  "Kanazawa":        { bg: "#5C7A2E", text: "#fff" },
  "Takayama":        { bg: "#728F45", text: "#fff" },
  "Matsumoto":       { bg: "#93B06A", text: "#fff" },
  "Nagoya":          { bg: "#C4A048", text: "#fff" },
  "Osaka":           { bg: "#B8331E", text: "#fff" },
  "Osaka Universal": { bg: "#E85A45", text: "#fff" },
  "Nara":            { bg: "#D4B86C", text: "#292524" },
  "Kyoto":           { bg: "#8F2818", text: "#fff" },
  "Kawaguchiko":     { bg: "#4A7FB5", text: "#fff" },
  "Hakone":          { bg: "#6B8E5A", text: "#fff" },
};

const cityColor = (city) => {
  const base = (city || "").replace(/ \d+$/, "");
  return CITY_COLORS[base] || { bg: "#D94025", text: "#fff" };
};

const DayStrip = ({ selectedDay, onSelectDay, className = "" }) => {
  const buttonRefs = useRef({});
  const containerRef = useRef(null);

  /* Auto-scroll the strip so the selected day is centered/visible */
  useEffect(() => {
    if (!selectedDay) return;
    const btn = buttonRefs.current[selectedDay];
    if (btn && typeof btn.scrollIntoView === "function") {
      btn.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [selectedDay]);

  return (
    <div
      ref={containerRef}
      dir="rtl"
      className={`flex flex-col items-center gap-1 py-3 px-1.5 overflow-y-auto scrollbar-none bg-cream-50/95 backdrop-blur-sm ${className}`}
      title="קפיצה מהירה ליום"
    >
      <span className="text-[9px] font-bold uppercase text-sumi-400 tracking-widest mb-1">
        ימים
      </span>
      {tripData.map((d) => {
        const isActive = selectedDay === d.day;
        const c = cityColor(d.city);
        return (
          <button
            key={d.day}
            ref={(el) => (buttonRefs.current[d.day] = el)}
            onClick={() => onSelectDay(d.day)}
            title={`יום ${d.day} · ${d.cityHe || d.city}`}
            className={`relative flex items-center justify-center w-7 h-7 rounded-full text-[11px] font-bold transition-all duration-200 flex-shrink-0
              ${isActive
                ? "shadow-md scale-110"
                : "hover:scale-110 opacity-70 hover:opacity-100"
              }`}
            style={
              isActive
                ? { backgroundColor: c.bg, color: c.text, border: `2px solid ${c.bg}` }
                : { backgroundColor: "transparent", color: c.bg, border: `1.5px solid ${c.bg}` }
            }
          >
            {d.day}
          </button>
        );
      })}
    </div>
  );
};

export default DayStrip;
