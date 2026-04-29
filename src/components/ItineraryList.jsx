import React, { useRef, useEffect, useCallback, useMemo } from "react";
import { tripData } from "../data/tripData";
import DayCard from "./DayCard";
import FilterResultsPanel from "./FilterResultsPanel";
import { ActivityIcons } from "../data/illustrations";
import { cityTransitions } from "../data/transportData";

/* ══════════════════════════════════════════════
   CITY GROUPING HELPERS
   ══════════════════════════════════════════════ */

// Group days by city for section headers (raw, consecutive)
const getCityGroups = () => {
  const groups = [];
  let currentCity = null;
  tripData.forEach((d) => {
    const cityKey = d.city.replace(/ \d+$/, "");
    if (cityKey !== currentCity) {
      currentCity = cityKey;
      groups.push({ city: cityKey, cityHe: d.cityHe, startDay: d.day });
    }
  });
  return groups;
};

/* ── Disney/Universal → parent city mapping ── */
const PARENT_CITY_MAP = {
  "Tokyo Disney":    "Tokyo",
  "Tokyo DisneySea": "Tokyo",
  "Universal Studios": "Osaka",
  "Osaka Universal": "Osaka",
};
const normalizeCityKey = (city) => {
  const base = city.replace(/ \d+$/, "");
  return PARENT_CITY_MAP[base] || base;
};

/* ── Build CHRONOLOGICAL city path (Tokyo #1 → Kanazawa → ... → Tokyo #2) ── */
export const getChronologicalCityPath = () => {
  const path = [];
  let lastNorm = null;
  const instanceCount = {};

  tripData.forEach((d) => {
    const norm = normalizeCityKey(d.city);
    if (norm !== lastNorm) {
      instanceCount[norm] = (instanceCount[norm] || 0) + 1;
      path.push({
        city: norm,
        cityHe: d.cityHe,
        startDay: d.day,
        instance: instanceCount[norm],
      });
      lastNorm = norm;
    }
  });

  // Build display keys — add #N suffix only for cities that appear more than once
  const totalVisits = {};
  path.forEach((p) => {
    totalVisits[p.city] = Math.max(totalVisits[p.city] || 0, p.instance);
  });
  path.forEach((p) => {
    p.repeated = totalVisits[p.city] > 1;
    p.key = p.repeated ? `${p.city}#${p.instance}` : p.city;
    p.label = p.repeated ? `${p.city} #${p.instance}` : p.city;
  });

  return path;
};

/* ── Get day range for a city path entry ── */
const getCityDayRange = (entry, allPath) => {
  const idx = allPath.indexOf(entry);
  const startDay = entry.startDay;
  const nextEntry = allPath[idx + 1];
  const endDay = nextEntry ? nextEntry.startDay - 1 : tripData[tripData.length - 1].day;
  return { startDay, endDay };
};

/* ══════════════════════════════════════════════
   FILTER CATEGORIES (includes Hotels)
   ══════════════════════════════════════════════ */

/* ── Bed icon for Hotels filter ── */
const BedIcon = ({ size = 12, color = "#57534E" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M2 4v16"/><path d="M2 8h18a2 2 0 0 1 2 2v10"/><path d="M2 17h20"/><path d="M6 8v9"/>
  </svg>
);

export const FILTERS = [
  {
    key: "attractions",
    label: "Attractions",
    labelHe: "אטרקציות",
    labelJa: "観光",
    icon: ActivityIcons.shrine,
    color: "#D94025",
  },
  {
    key: "food",
    label: "Food",
    labelHe: "אוכל",
    labelJa: "食事",
    icon: ActivityIcons.food,
    color: "#C4A048",
  },
  {
    key: "shopping",
    label: "Shopping",
    labelHe: "קניות",
    labelJa: "買物",
    icon: ActivityIcons.shopping,
    color: "#57534E",
  },
  {
    key: "hotels",
    label: "Hotels",
    labelHe: "מלונות",
    labelJa: "ホテル",
    icon: BedIcon,
    color: "#5C7A2E",
  },
];

// Check if a day has content for a given filter
const dayMatchesFilter = (day, filter) => {
  if (!filter) return true;
  switch (filter) {
    case "attractions":
      return day.attractions && day.attractions.some((a) => {
        const n = a.name.toLowerCase();
        return !isShoppingPlace(n) && !isFoodPlace(n);
      });
    case "food":
      return (
        (day.lunch && day.lunch.place && day.lunch.place !== "—") ||
        (day.dinner && day.dinner.place && day.dinner.place !== "—") ||
        (day.attractions && day.attractions.some((a) => isFoodPlace(a.name.toLowerCase())))
      );
    case "shopping":
      return day.attractions && day.attractions.some((a) => isShoppingPlace(a.name.toLowerCase()));
    case "hotels":
      return day.hotel && day.hotel !== "—";
    default:
      return true;
  }
};

const isShoppingPlace = (n) =>
  n.includes("market") || n.includes("don quijote") || n.includes("parco") ||
  n.includes("muji") || n.includes("outlet") || n.includes("uniqlo") ||
  n.includes("kappabashi") || n.includes("shopping") || n.includes("store") ||
  n.includes("ameyoko") || n.includes("sunshine city") || n.includes("radio kaikan");

const isFoodPlace = (n) =>
  n.includes("ramen") || n.includes("sushi") || n.includes("food") ||
  n.includes("cafe") || n.includes("café") || n.includes("coffee") ||
  n.includes("restaurant") || n.includes("soba") || n.includes("gyoza") ||
  n.includes("katsu") || n.includes("yakitori") || n.includes("izakaya") ||
  n.includes("duck") || n.includes("bricolage") || n.includes("starbucks") ||
  n.includes("mcdonald") || n.includes("pizza") || n.includes("burger") ||
  n.includes("pudding") || n.includes("pancake");

/* ══════════════════════════════════════════════
   TRANSPORT LINE-ART ICONS
   ══════════════════════════════════════════════ */
const TransportIcons = {
  shinkansen: ({ size = 20, color = "#D94025" }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 17h14l2-6V7a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v4l2 6z"/>
      <line x1="5" y1="17" x2="3" y2="21"/><line x1="19" y1="17" x2="21" y2="21"/>
      <circle cx="9" cy="12" r="1.5"/><circle cx="15" cy="12" r="1.5"/>
      <path d="M12 5v-2" strokeWidth="1.2"/>
    </svg>
  ),
  train: ({ size = 20, color = "#D94025" }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="4" y="3" width="16" height="16" rx="2"/><line x1="4" y1="11" x2="20" y2="11"/>
      <line x1="12" y1="3" x2="12" y2="11"/>
      <circle cx="8" cy="15" r="1"/><circle cx="16" cy="15" r="1"/>
      <line x1="6" y1="19" x2="4" y2="22"/><line x1="18" y1="19" x2="20" y2="22"/>
    </svg>
  ),
  bus: ({ size = 20, color = "#D94025" }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="14" rx="2"/><line x1="3" y1="10" x2="21" y2="10"/>
      <circle cx="7" cy="15" r="1.5"/><circle cx="17" cy="15" r="1.5"/>
      <line x1="3" y1="18" x2="3" y2="20"/><line x1="21" y1="18" x2="21" y2="20"/>
    </svg>
  ),
  car: ({ size = 20, color = "#D94025" }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 17h14v-5l-2-5H7l-2 5v5z"/>
      <circle cx="7.5" cy="17" r="2"/><circle cx="16.5" cy="17" r="2"/>
      <line x1="5" y1="12" x2="19" y2="12"/>
    </svg>
  ),
  flight: ({ size = 20, color = "#D94025" }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 16v-2l-8-5V3.5a1.5 1.5 0 0 0-3 0V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5l8 2.5z"/>
    </svg>
  ),
};

/* ══════════════════════════════════════════════
   CITY TRANSITION CARD — Bold full-width banner
   ══════════════════════════════════════════════ */
const CityTransitionCard = ({ transition }) => {
  const IconComp = TransportIcons[transition.icon] || TransportIcons.train;
  return (
    <div className="relative my-4 mx-0">
      <div className="flex items-center gap-2 mb-2">
        <div className="h-px flex-1 border-t border-dashed border-vermillion-300/60" />
        <span className="text-[9px] font-body text-sumi-300 uppercase tracking-widest">移動</span>
        <div className="h-px flex-1 border-t border-dashed border-vermillion-300/60" />
      </div>
      <div className="bg-cream-100 rounded-2xl border-2 border-vermillion-300 shadow-sm overflow-hidden">
        <div className="h-1 bg-gradient-to-r from-vermillion-400 via-vermillion-500 to-vermillion-400" />
        <div className="flex items-center px-3 sm:px-5 py-3 sm:py-4">
          <div className="text-right flex-1 min-w-0">
            <p className="text-base font-display font-black text-sumi-800 truncate">{transition.fromCity}</p>
            <p className="text-xs font-body text-sumi-400 mt-0.5" dir="rtl">{transition.fromCityHe}</p>
          </div>
          <div className="flex flex-col items-center gap-1.5 mx-5 flex-shrink-0">
            <div className="w-10 h-10 rounded-full bg-vermillion-50 border-2 border-vermillion-300 flex items-center justify-center">
              <IconComp size={22} color="#D94025" />
            </div>
            <div className="flex items-center gap-1">
              <div className="w-8 border-t-2 border-dashed border-vermillion-400" />
              <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                <polyline points="2,1 8,5 2,9" stroke="#D94025" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
              </svg>
            </div>
            <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-vermillion-500 text-cream-50 text-[9px] font-display font-bold uppercase tracking-wider shadow-sm">
              {transition.mode}
            </span>
            <div className="text-center">
              <p className="text-[10px] font-body text-sumi-500 font-medium">{transition.modeJa}</p>
              <p className="text-xs font-display font-bold text-vermillion-600">{transition.duration}</p>
            </div>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-base font-display font-black text-sumi-800 truncate">{transition.toCity}</p>
            <p className="text-xs font-body text-sumi-400 mt-0.5" dir="rtl">{transition.toCityHe}</p>
          </div>
        </div>
        <div className="h-1 bg-gradient-to-r from-vermillion-400 via-vermillion-500 to-vermillion-400" />
      </div>
      <div className="flex items-center gap-2 mt-2">
        <div className="h-px flex-1 border-t border-dashed border-vermillion-300/60" />
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#D94025" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" opacity="0.4">
          <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" /><circle cx="12" cy="10" r="3" />
        </svg>
        <div className="h-px flex-1 border-t border-dashed border-vermillion-300/60" />
      </div>
    </div>
  );
};

const getTransitionAfterDay = (day) => cityTransitions.find((t) => t.afterDay === day);

/* ══════════════════════════════════════════════
   MAIN ITINERARY LIST
   ══════════════════════════════════════════════ */
const ItineraryList = ({
  selectedDay,
  onSelectDay,
  onSelectLocation,
  activeFilter,
  activeCity,
  onFilterChange,
  onCityChange,
  onClearFilters,
  onOpenDetail,
}) => {
  const cardRefs = useRef({});
  const scrollContainerRef = useRef(null);
  const cityGroups = getCityGroups();
  const chronoCityPath = useMemo(() => getChronologicalCityPath(), []);

  /* ── Consolidated city path: unique city names, no chronological #N.
        Used in Category (filter) view where the user wants to browse
        all e.g. shopping spots for "Tokyo" as a single bucket,
        independent of the itinerary timeline.            ── */
  const consolidatedCityPath = useMemo(() => {
    const seen = new Set();
    const out = [];
    chronoCityPath.forEach((cp) => {
      if (seen.has(cp.city)) return;
      seen.add(cp.city);
      out.push({
        city: cp.city,
        cityHe: cp.cityHe,
        startDay: cp.startDay,
        key: cp.city,          // bare city name
        label: cp.city,
        repeated: false,
        instance: 1,
      });
    });
    return out;
  }, [chronoCityPath]);

  /* Which path is displayed depends on whether a category filter is active. */
  const displayCityPath = activeFilter ? consolidatedCityPath : chronoCityPath;

  /* Scroll-to-header: snap to top with offset breathing room */
  useEffect(() => {
    if (selectedDay !== null && cardRefs.current[selectedDay]) {
      setTimeout(() => {
        cardRefs.current[selectedDay].scrollIntoView({ behavior: "smooth", block: "start" });
      }, 80);
    }
  }, [selectedDay]);

  const handleCardClick = useCallback(
    (day) => { onSelectDay(selectedDay === day ? null : day); },
    [onSelectDay, selectedDay]
  );

  const isCitySectionStart = (day) => cityGroups.some((g) => g.startDay === day);
  const getCitySectionData = (day) => cityGroups.find((g) => g.startDay === day);

  const hasAnyActiveFilter = activeFilter !== null || activeCity !== null;

  /* ── Count matching days per category filter ── */
  const getFilterCount = useCallback((filterKey) => {
    return tripData.filter((d) => dayMatchesFilter(d, filterKey)).length;
  }, []);

  /* ── Count items per city for the active category (for city sub-filter badges) ── */
  const filterCityCounts = useMemo(() => {
    if (!activeFilter) return {};
    const counts = {};
    tripData.forEach((d) => {
      if (dayMatchesFilter(d, activeFilter)) {
        const cityKey = normalizeCityKey(d.city);
        counts[cityKey] = (counts[cityKey] || 0) + 1;
      }
    });
    return counts;
  }, [activeFilter]);

  /* ── Compute day range for each city path entry ── */
  const cityDayRanges = useMemo(() => {
    const ranges = {};
    chronoCityPath.forEach((cp, idx) => {
      const range = getCityDayRange(cp, chronoCityPath);
      ranges[cp.key] = range;
    });
    return ranges;
  }, [chronoCityPath]);

  /* ── Which days to show (applying city filter) ── */
  const visibleDays = useMemo(() => {
    if (!activeCity) return tripData;

    // Find the matching chronological path entry
    const entry = chronoCityPath.find((cp) => cp.key === activeCity);
    if (!entry) return tripData;

    const range = cityDayRanges[activeCity];
    if (!range) return tripData;

    return tripData.filter((d) => d.day >= range.startDay && d.day <= range.endDay);
  }, [activeCity, chronoCityPath, cityDayRanges]);

  return (
    <div className="h-full flex flex-col bg-cream-50">
      {/* ═══ STICKY HEADER with filters ═══ */}
      <div className="sticky top-0 z-20 bg-cream-50/95 backdrop-blur-md border-b border-cream-300 px-3 sm:px-5 pt-3 sm:pt-4 pb-2.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 border-2 border-sumi-800 rounded flex items-center justify-center flex-shrink-0">
              <span className="text-[9px] font-display font-black text-sumi-800 leading-none tracking-tighter text-center">JP<br/>N</span>
            </div>
            <div>
              <h1 className="text-lg font-display font-black text-sumi-800 tracking-tight">Japan Trip Explorer</h1>
              <p className="text-[10px] text-sumi-400 font-body mt-0.5 flex items-center gap-1.5">
                <span>31 Days</span><span className="text-vermillion-300">•</span>
                <span>9 Cities</span><span className="text-vermillion-300">•</span>
                <span>Feb — Mar 2024</span>
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 bg-vermillion-50 rounded-full px-3 py-1.5 border border-vermillion-200">
            <span className="text-[10px] font-display font-bold text-vermillion-600">
              {selectedDay ? `Day ${selectedDay}` : "日本旅行"}
            </span>
          </div>
        </div>

        {/* ═══ CATEGORY FILTER BAR (Single-Select) ═══ */}
        <div className="flex flex-wrap items-center gap-2 mt-2.5 border-t border-cream-200 pt-2.5">
          <button
            onClick={() => { onFilterChange(null); }}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-display font-semibold transition-all duration-200 border min-h-[36px]
              ${!activeFilter
                ? "bg-vermillion-500 text-white border-vermillion-500 shadow-sm"
                : "bg-cream-100 text-sumi-500 border-cream-300 hover:border-vermillion-300 hover:text-vermillion-600"
              }`}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
              <circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
            </svg>
            All
          </button>

          {FILTERS.map((f) => {
            const isActive = activeFilter === f.key;
            return (
              <button
                key={f.key}
                onClick={() => onFilterChange(f.key)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-display font-semibold transition-all duration-200 border min-h-[36px]
                  ${isActive
                    ? "bg-vermillion-500 text-white border-vermillion-500 shadow-sm"
                    : "bg-cream-100 text-sumi-500 border-cream-300 hover:border-vermillion-300 hover:text-vermillion-600"
                  }`}
              >
                <f.icon size={12} color={isActive ? "#fff" : f.color} />
                <span>{f.label}</span>
                <span className={`text-[8px] ${isActive ? "text-white/70" : "text-sumi-300"}`} dir="rtl">
                  {f.labelHe}
                </span>
              </button>
            );
          })}

          {hasAnyActiveFilter && (
            <button
              onClick={onClearFilters}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-full text-[10px] font-display font-semibold text-vermillion-500 hover:text-vermillion-700 hover:bg-vermillion-50 transition-all duration-200 border border-transparent hover:border-vermillion-200 min-h-[36px]"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
              Reset
            </button>
          )}
        </div>

        {/* ═══ CITY PATH (Single-Select)
               • When a category filter is active → consolidated bare city
                 names (one "Tokyo" button, no #N splits). This is the
                 "browse all shopping in Tokyo across the whole trip" view.
               • Otherwise → chronological path with #N suffixes for
                 cities visited multiple times.              ═══ */}
        <div className="flex flex-wrap items-center gap-1 mt-2">
          {displayCityPath.map((cp, idx) => {
            const isActive = activeCity === cp.key;
            const count = activeFilter ? (filterCityCounts[cp.city] || 0) : null;
            // When category filter active but no results for this city, dim it
            const dimmed = activeFilter && count === 0;
            return (
              <React.Fragment key={cp.key}>
                {idx > 0 && (
                  <svg width="10" height="10" viewBox="0 0 10 10" fill="none" className="flex-shrink-0 opacity-30">
                    <polyline points="3,2 7,5 3,8" stroke="#D94025" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
                  </svg>
                )}
                <button
                  onClick={() => onCityChange(cp.key)}
                  disabled={dimmed}
                  className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-display font-semibold transition-all duration-200 border min-h-[28px]
                    ${dimmed
                      ? "bg-cream-50 text-sumi-300 border-cream-200 cursor-not-allowed opacity-50"
                      : isActive
                        ? "bg-vermillion-500 text-white border-vermillion-500 shadow-sm"
                        : "bg-cream-50 text-sumi-600 border-vermillion-200 hover:border-vermillion-400 hover:text-vermillion-600 hover:bg-vermillion-50"
                    }`}
                >
                  {cp.label}
                  {count != null && count > 0 && (
                    <span className={`inline-flex items-center justify-center min-w-[16px] h-[16px] px-0.5 rounded-full text-[9px] font-bold ${
                      isActive ? "bg-white/20 text-white" : "bg-vermillion-100 text-vermillion-600"
                    }`}>
                      {count}
                    </span>
                  )}
                </button>
              </React.Fragment>
            );
          })}
        </div>
      </div>

      {/* Show FilterResultsPanel when category filter active, OR normal itinerary */}
      {activeFilter ? (
        <>
          {/* Transition band intentionally removed — FilterResultsPanel's
              own header already shows the category label + result count,
              so any wrapper here was pure dead space. */}
          <FilterResultsPanel
            activeFilter={activeFilter}
            activeCity={activeCity}
            chronoCityPath={chronoCityPath}
            consolidatedCityPath={consolidatedCityPath}
            cityDayRanges={cityDayRanges}
            onSelectLocation={onSelectLocation}
            onSelectDay={handleCardClick}
            onClose={() => onFilterChange(null)}
            onOpenDetail={onOpenDetail}
          />
        </>
      ) : (
        <>
          {/* Decorative 旅の記録 transition band removed — results start
              immediately under the sticky header to maximise visible
              itinerary area. */}
          <div ref={scrollContainerRef} className="flex-1 overflow-y-auto overscroll-contain px-3 sm:px-4 pt-2 pb-4 space-y-2.5 scrollbar-thin">
            {visibleDays.map((d) => (
              <React.Fragment key={d.day}>
                {isCitySectionStart(d.day) && (
                  <div className="flex items-center gap-3 pt-5 pb-2 first:pt-0">
                    <div className="h-px flex-1 bg-gradient-to-r from-transparent via-vermillion-200 to-transparent" />
                    <div className="flex items-center gap-2 px-3 py-1.5 bg-cream-100 rounded-full border border-cream-300">
                      <MapPinIcon size={11} className="text-vermillion-500" />
                      <span className="text-xs font-display font-bold text-sumi-700">{getCitySectionData(d.day)?.city}</span>
                      <span className="text-xs text-sumi-300 font-body" dir="rtl">{getCitySectionData(d.day)?.cityHe}</span>
                    </div>
                    <div className="h-px flex-1 bg-gradient-to-r from-transparent via-vermillion-200 to-transparent" />
                  </div>
                )}

                <DayCard
                  ref={(el) => (cardRefs.current[d.day] = el)}
                  data={d}
                  isSelected={selectedDay === d.day}
                  onClick={() => handleCardClick(d.day)}
                  onSelectLocation={onSelectLocation}
                  activeFilter={activeFilter}
                  onOpenDetail={onOpenDetail}
                />

                {getTransitionAfterDay(d.day) && (
                  <CityTransitionCard transition={getTransitionAfterDay(d.day)} />
                )}
              </React.Fragment>
            ))}
            <div className="h-8" />
          </div>
        </>
      )}

      <div className="border-t border-cream-300 px-5 py-2 flex items-center justify-between bg-cream-50">
        <div className="flex items-center gap-3 text-[10px] text-sumi-400 font-display">
          <span className="hover:text-vermillion-500 cursor-pointer transition-colors">Instagram</span>
          <span className="hover:text-vermillion-500 cursor-pointer transition-colors">Facebook</span>
        </div>
        <div className="w-16 h-px bg-vermillion-300 rounded-full" />
      </div>
    </div>
  );
};

const MapPinIcon = ({ size, className }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" /><circle cx="12" cy="10" r="3" />
  </svg>
);

export default ItineraryList;
