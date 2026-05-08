import React, { useEffect, useRef } from "react";
import { tripData } from "../data/tripData";
import { cityAbbreviation } from "../data/tripHelpers";

/* ══════════════════════════════════════════════════════════════
   DAY FILTER — Horizontal "Day Scroller" pills
   ──────────────────────────────────────────────────────────────
   Sticky top bar with a horizontally-scrollable list of round
   pills, one per trip day. Each pill shows:
     • the trip-day number (large, bold) — e.g. "1", "15", "31"
     • the city's 3-letter abbreviation (small, below) —
       e.g. "TOK", "OSA", "KYO"

   Active pill = solid fill in the city's accent color.
   Inactive pill = white circle with thin cream border.

   In RTL, day 1 is on the right (reading start) and day 31 is on
   the left (reading end). Bi-directional sync via `selectedDay`:
     - Tap a pill        → onSelectDay(n)
     - selectedDay flips → active pill auto-scrolls into view here
   ══════════════════════════════════════════════════════════════ */

/* City palette (kept inline to avoid a circular import with
   MapComponent — they MUST stay in sync). */
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

const DayFilter = ({ selectedDay, onSelectDay, className = "" }) => {
  const buttonRefs = useRef({});
  const containerRef = useRef(null);

  /* Auto-scroll the active pill into view (centered horizontally). */
  useEffect(() => {
    if (!selectedDay) return;
    const btn = buttonRefs.current[selectedDay];
    if (btn && typeof btn.scrollIntoView === "function") {
      btn.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
    }
  }, [selectedDay]);

  return (
    <div
      ref={containerRef}
      dir="rtl"
      className={`flex items-center gap-3 overflow-x-auto scrollbar-none px-3 py-2.5 bg-cream-50/95 backdrop-blur-sm border-b border-cream-200 ${className}`}
    >
      {tripData.map((d) => {
        const isActive = selectedDay === d.day;
        const c = cityColor(d.city);
        const abbr = cityAbbreviation(d.city);

        return (
          <button
            key={d.day}
            ref={(el) => (buttonRefs.current[d.day] = el)}
            onClick={() => onSelectDay(d.day)}
            title={`יום ${d.day} · ${d.cityHe || d.city}`}
            className={`flex flex-col items-center justify-center flex-shrink-0 w-14 h-14 rounded-full transition-all duration-200
              ${isActive
                ? "shadow-md scale-105"
                : "hover:scale-105 bg-white"
              }`}
            style={
              isActive
                ? { backgroundColor: c.bg, color: c.text, border: `2px solid ${c.bg}` }
                : { backgroundColor: "#FDFBF5", color: "#1C1917", border: `1px solid #E7DFCF` }
            }
          >
            <span
              className="font-bold leading-none"
              style={{ fontSize: "17px", letterSpacing: "-0.02em" }}
            >
              {d.day}
            </span>
            <span
              className="leading-none mt-0.5 font-semibold"
              style={{
                fontSize: "9px",
                opacity: isActive ? 0.92 : 0.55,
                letterSpacing: "0.06em",
              }}
            >
              {abbr}
            </span>
          </button>
        );
      })}
    </div>
  );
};

export default DayFilter;
