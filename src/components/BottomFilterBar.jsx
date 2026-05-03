import React, { useMemo } from "react";
import { FILTERS, getChronologicalCityPath } from "./ItineraryList";

/* ══════════════════════════════════════════════════════════════
   BOTTOM FILTER BAR — Drill-down city → category
   ──────────────────────────────────────────────────────────────
   Two-phase pill bar:
     • Phase A (no city selected): horizontal city pills
     • Phase B (city selected):    "← Back" + active city header,
                                   then horizontal category pills

   The component is presentational. All state lives in the parent
   (ExploreView). Callbacks `onCityChange` and `onFilterChange`
   match the existing prop API of MapComponent / ItineraryList so
   no plumbing rewrites are needed.

   Designed to live in:
     - mobile: header slot of <BottomSheet>
     - desktop: footer-bar of the right side pane

   ══════════════════════════════════════════════════════════════ */

const BottomFilterBar = ({
  activeCity,
  activeFilter,
  onCityChange,
  onFilterChange,
  onClearAll,
}) => {
  /* ── Chronological city path (Tokyo#1, Kanazawa, …, Tokyo#3) ── */
  const cities = useMemo(() => getChronologicalCityPath(), []);
  const phase = activeCity ? "B" : "A";

  /* ── Phase A: city picker ── */
  if (phase === "A") {
    return (
      <div className="bg-cream-50/95 backdrop-blur-sm border-t border-cream-300">
        <div className="flex items-center gap-2 px-3 py-2.5 overflow-x-auto scrollbar-none">
          {/* Reset / All */}
          <button
            onClick={onClearAll}
            className="flex-shrink-0 px-3.5 py-2 rounded-full text-[11px] font-display font-semibold bg-cream-100 text-sumi-500 border border-cream-300 min-h-[40px] hover:border-vermillion-300 hover:text-vermillion-600 transition-colors"
          >
            All Trip
          </button>

          {cities.map((cp) => {
            const isActive = activeCity === cp.key;
            return (
              <button
                key={cp.key}
                onClick={() => onCityChange(cp.key)}
                className={`flex-shrink-0 px-3.5 py-2 rounded-full text-[11px] font-display font-semibold border min-h-[40px] transition-all duration-200
                  ${isActive
                    ? "bg-vermillion-500 text-white border-vermillion-500 shadow-sm"
                    : "bg-cream-50 text-sumi-600 border-vermillion-200 hover:border-vermillion-400 hover:text-vermillion-600 hover:bg-vermillion-50"
                  }`}
              >
                {cp.label}
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  /* ── Phase B: category picker scoped to a city ── */
  const activeCityLabel = cities.find((c) => c.key === activeCity)?.label || activeCity;

  return (
    <div className="bg-cream-50/95 backdrop-blur-sm border-t border-cream-300">
      {/* Context strip — shows current city + back arrow */}
      <div className="flex items-center gap-2 px-3 pt-2 pb-1.5 border-b border-cream-200">
        <button
          onClick={() => onCityChange(activeCity)} /* toggle off */
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-display font-semibold text-sumi-500 hover:text-vermillion-600 hover:bg-cream-100 transition-colors min-h-[32px]"
          title="Back to all cities"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
          Back
        </button>
        <div className="h-4 w-px bg-cream-300" />
        <span className="text-xs font-display font-bold text-vermillion-600 truncate">
          {activeCityLabel}
        </span>
        {activeFilter && (
          <button
            onClick={() => onFilterChange(activeFilter)} /* toggle off */
            className="ml-auto flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-display font-semibold text-sumi-400 hover:text-vermillion-600 transition-colors"
            title="Clear category"
          >
            Clear filter
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        )}
      </div>

      {/* Category pills */}
      <div className="flex items-center gap-2 px-3 py-2 overflow-x-auto scrollbar-none">
        <button
          onClick={() => onFilterChange(null)}
          className={`flex-shrink-0 px-3 py-1.5 rounded-full text-[11px] font-display font-semibold border min-h-[36px] transition-colors
            ${!activeFilter
              ? "bg-sumi-800 text-white border-sumi-800"
              : "bg-cream-50 text-sumi-500 border-cream-300 hover:border-sumi-400"
            }`}
        >
          All
        </button>
        {FILTERS.map((f) => {
          const isActive = activeFilter === f.key;
          return (
            <button
              key={f.key}
              onClick={() => onFilterChange(f.key)}
              className={`flex-shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-display font-semibold border min-h-[36px] transition-colors
                ${isActive
                  ? "bg-vermillion-500 text-white border-vermillion-500 shadow-sm"
                  : "bg-cream-50 text-sumi-500 border-cream-300 hover:border-vermillion-300 hover:text-vermillion-600"
                }`}
            >
              <f.icon size={12} color={isActive ? "#fff" : f.color} />
              <span>{f.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default BottomFilterBar;
