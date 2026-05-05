import React, { useEffect, useRef } from "react";
import { tripData } from "../data/tripData";

/* ══════════════════════════════════════════════════════════════
   DAY FILTER — Horizontal "Circle Pill" bar (Dubai-trip style)
   ──────────────────────────────────────────────────────────────
   Sticky top bar with a horizontally-scrollable list of round
   pills, one per trip day. Each pill shows:
     • the calendar day-of-month (large, bold)
     • the Hebrew month abbreviation (small, below)
   Active pill = solid fill in the city's accent color.
   Inactive pill = white circle with thin city-colored border.

   In RTL, day 1 is on the right (reading start) and day 31 is on
   the left (reading end). The container uses `dir="rtl"` and
   horizontal scroll so all 31 pills are reachable on any screen.

   Bi-directional sync via `selectedDay`:
     - Tap a pill        → onSelectDay(n)  (parent flies map + scrolls flow)
     - selectedDay flips → active pill auto-scrolls into view here

   tripData.js is read-only — calendar dates are derived from a
   constant TRIP_START_DATE since the per-day calendar date isn't
   stored on the data records.
   ══════════════════════════════════════════════════════════════ */

/* Trip kickoff: Day 1 = Sunday, Feb 25, 2024.
   (Feb 25 -> Mar 26 = 31 days, matches the "פברואר–מרץ 2024" copy
   already in the side-pane title.) Tweak this constant if the
   real itinerary started on a different day. */
const TRIP_START_DATE = new Date(2024, 1, 25); // month is 0-indexed

const HE_MONTH_ABBR = [
  "ינו׳", "פבר׳", "מרץ", "אפר׳", "מאי", "יוני",
  "יולי", "אוג׳", "ספט׳", "אוק׳", "נוב׳", "דצמ׳",
];

/** Calendar date for Day N of the trip (1-based). */
export const getDateForDay = (dayNumber) => {
  const d = new Date(TRIP_START_DATE);
  d.setDate(d.getDate() + (dayNumber - 1));
  return {
    day: d.getDate(),                // e.g. 25
    monthAbbr: HE_MONTH_ABBR[d.getMonth()], // e.g. "פבר׳"
  };
};

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
        const { day: dayOfMonth, monthAbbr } = getDateForDay(d.day);

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
              style={{ fontSize: "16px", letterSpacing: "-0.02em" }}
            >
              {dayOfMonth}
            </span>
            <span
              className="leading-none mt-0.5"
              style={{
                fontSize: "9px",
                opacity: isActive ? 0.92 : 0.55,
                fontWeight: 500,
              }}
            >
              {monthAbbr}
            </span>
          </button>
        );
      })}
    </div>
  );
};

export default DayFilter;
