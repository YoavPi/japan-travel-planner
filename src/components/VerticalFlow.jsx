import React, { forwardRef, useImperativeHandle, useMemo, useRef, useState } from "react";
import { tripData } from "../data/tripData";
import { ActivityIcons } from "../data/illustrations";
import {
  cityAbbreviation,
  categoryOf,
  descriptiveTitleHe,
  dayItemsInOrder,
  transitBetween,
  transitLabelHe,
  formatKm,
} from "../data/tripHelpers";

/* ══════════════════════════════════════════════════════════════
   VERTICAL FLOW — Mobile-first itinerary (sprint 6)
   ──────────────────────────────────────────────────────────────
   Visual model: a chronological "day journal".
     - Day rows are collapsed by default (just header + city)
     - Tapping a day expands its full chronological sequence
     - No Morning/Afternoon/Evening phase headers — items appear
       in the order they were experienced
     - Each item: descriptive Hebrew title (primary), English name
       (secondary), category icon, optional rating badge
     - Between consecutive items: a small transit chip (mode +
       minutes + distance)
     - When a category filter is active, the layout switches into
       a city-grouped browse mode (no per-day expansion)

   Strict design rules:
     - REMOVE all Japanese characters / nameJa from the rendered output
     - REMOVE tips / expenses
     - REMOVE hero illustrations on day rows
     - Hebrew first, English secondary
     - Pointer-cursor only on items that have `coordinates`
   ══════════════════════════════════════════════════════════════ */

/* ─── Small icon picker built on top of the shared library ── */
const pickIcon = (item) => {
  const cat = categoryOf(item);
  switch (cat) {
    case "cafe":     return ActivityIcons.coffee;
    case "onsen":    return ActivityIcons.onsen;
    case "shrine":   return ActivityIcons.shrine;
    case "park":     return ActivityIcons.park;
    case "shopping": return ActivityIcons.shopping;
    case "view":     return ActivityIcons.viewpoint;
    case "ramen":    return ActivityIcons.food;
    case "sushi":    return ActivityIcons.food;
    case "food":     return ActivityIcons.food;
    case "hotel":    return ActivityIcons.shrine; // no hotel icon yet
    default:         return ActivityIcons.walk;
  }
};

const phaseAccentColor = (kind) => {
  if (kind === "lunch")  return "#C4A048";
  if (kind === "dinner") return "#D94025";
  return "#1C1917";
};

/* ─── Star rating badge ─── */
const RatingBadge = ({ rating }) =>
  rating && rating !== "—" ? (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-gold-50 border border-gold-200 text-gold-700 font-semibold text-xs">
      <svg width="11" height="11" viewBox="0 0 24 24" fill="#C4A048" stroke="#C4A048" strokeWidth="1.5">
        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
      </svg>
      {rating}
    </span>
  ) : null;

/* ─── Transit chip between two consecutive items ─── */
const TransitIcon = ({ mode, size = 12, color = "#A39E96" }) => {
  if (mode === "walk") {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <circle cx="13" cy="4" r="2" />
        <path d="M10 22l1-7" />
        <path d="M17 14l-4-1-2-4-3 4 4 1 1 5" />
        <path d="M7 9l3-1" />
      </svg>
    );
  }
  if (mode === "shinkansen") {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M5 17h14l2-6V7a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v4l2 6z" />
        <line x1="5" y1="17" x2="3" y2="21" />
        <line x1="19" y1="17" x2="21" y2="21" />
      </svg>
    );
  }
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="4" y="3" width="16" height="14" rx="2" />
      <line x1="4" y1="11" x2="20" y2="11" />
      <line x1="12" y1="3" x2="12" y2="11" />
      <circle cx="8" cy="20" r="1" />
      <circle cx="16" cy="20" r="1" />
    </svg>
  );
};

const TransitChip = ({ transit }) => {
  if (!transit) return null;
  return (
    <div className="pr-12 my-1.5 flex items-center gap-2 text-[11px] text-sumi-400" dir="rtl">
      <div className="flex-shrink-0 w-px h-3 bg-cream-300" />
      <TransitIcon mode={transit.mode} />
      <span>{transit.minutes} דק׳ {transitLabelHe(transit.mode)}</span>
      <span className="text-sumi-300">·</span>
      <span>{formatKm(transit.km)}</span>
    </div>
  );
};

/* ─── Single chronological item ─── */
const FlowItem = ({ item, onClick }) => {
  const interactive = !!item.coordinates;
  const Icon = pickIcon(item);
  const accent = phaseAccentColor(item.kind);
  const titleHe = descriptiveTitleHe(item) || item.name;

  return (
    <button
      type="button"
      disabled={!interactive}
      onClick={interactive ? onClick : undefined}
      dir="rtl"
      className={`flex items-start gap-3 w-full text-right py-2.5 pr-2 pl-3 rounded-xl transition-colors
        ${interactive
          ? "cursor-pointer hover:bg-vermillion-50/50"
          : "cursor-default"
        }`}
    >
      {/* Icon disc */}
      <span
        className="flex-shrink-0 mt-0.5 inline-flex items-center justify-center rounded-full"
        style={{
          width: 34,
          height: 34,
          backgroundColor: "rgba(250,246,232,0.85)",
          border: "1px solid #EDE5D0",
        }}
        aria-hidden
      >
        <Icon size={17} color={accent} />
      </span>

      <span className="flex-1 min-w-0">
        {/* Hebrew descriptive title (primary) */}
        <span className="block text-base md:text-lg font-bold text-sumi-800 leading-snug">
          {titleHe}
        </span>
        {/* English name (secondary) */}
        {item.name && item.name !== titleHe && (
          <span className="block text-xs text-sumi-400 mt-0.5 font-medium tracking-wide">
            {item.name}
          </span>
        )}
        {/* Rating badge — pulled out as its own row when present */}
        {item.rating && item.rating !== "—" && (
          <span className="inline-flex mt-1.5">
            <RatingBadge rating={item.rating} />
          </span>
        )}
      </span>
    </button>
  );
};

/* ─── Filter helpers (UI-side only — data unchanged) ─── */
const isShoppingName = (name = "") => {
  const n = name.toLowerCase();
  return ["market", "don quijote", "parco", "muji", "outlet", "uniqlo",
          "kappabashi", "shopping", "store", "ameyoko", "sunshine city",
          "radio kaikan"].some((kw) => n.includes(kw));
};

const itemMatchesFilter = (item, filter) => {
  if (!filter) return true;
  if (filter === "food") return item.kind === "lunch" || item.kind === "dinner";
  if (filter === "hotels") return false; // hotels handled at city level, not as items
  if (filter === "shopping") return item.kind === "attraction" && isShoppingName(item.name);
  if (filter === "attractions") return item.kind === "attraction" && !isShoppingName(item.name);
  return true;
};

/* ══════════════════════════════════════════════════════════════
   DAY SECTION — collapsible
   ══════════════════════════════════════════════════════════════ */
const DaySection = forwardRef(({ day, isSelected, onSelectDay, onSelectLocation, activeFilter, isLast, expanded, onToggleExpand }, ref) => {
  const baseCity = day.city.replace(/ \d+$/, "");
  const orderedItems = useMemo(() => dayItemsInOrder(day), [day]);
  const visibleItems = useMemo(
    () => orderedItems.filter((it) => itemMatchesFilter(it, activeFilter)),
    [orderedItems, activeFilter]
  );

  if (activeFilter && visibleItems.length === 0) return null;

  const handleItemClick = (item) => {
    if (!item.coordinates) return;
    if (onSelectLocation) {
      onSelectLocation({
        lng: item.coordinates.lng,
        lat: item.coordinates.lat,
        name: item.name,
      });
    }
  };

  const handleHeaderClick = () => {
    onSelectDay(day.day);
    onToggleExpand && onToggleExpand(day.day);
  };

  return (
    <section ref={ref} className="relative">
      {/* Continuous timeline line (right edge in RTL) */}
      {expanded && !isLast && (
        <div className="absolute right-3 top-12 bottom-[-32px] w-px bg-vermillion-300/40" aria-hidden />
      )}

      {/* Day header — tap to expand/collapse + flyTo */}
      <button
        type="button"
        onClick={handleHeaderClick}
        dir="rtl"
        className="relative pr-8 pl-2 pb-2 pt-2 mb-2 w-full text-right cursor-pointer hover:bg-cream-100/40 rounded-lg transition-colors flex items-center gap-3"
      >
        {/* Day node circle */}
        <div
          className={`absolute right-1 top-3 w-4 h-4 rounded-full border-2 z-10 transition-colors
            ${isSelected
              ? "bg-vermillion-500 border-vermillion-500"
              : "bg-cream-50 border-vermillion-400"
            }`}
        />

        <div className="flex-1 min-w-0">
          <h2 className="text-2xl md:text-3xl font-bold tracking-tight text-sumi-800 leading-tight font-serif">
            יום {day.day}
            <span className="text-sumi-400 font-light"> · </span>
            <span>{day.cityHe || baseCity}</span>
          </h2>
          <p className="text-[11px] text-sumi-400 mt-0.5 font-medium tracking-wider uppercase">
            {cityAbbreviation(day.city)} · {visibleItems.length} עצירות
          </p>
        </div>

        {/* Chevron expand/collapse indicator */}
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="#A39E96"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="flex-shrink-0 transition-transform"
          style={{ transform: expanded ? "rotate(180deg)" : "rotate(0deg)" }}
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {/* Expanded body — chronological list with transit chips */}
      {expanded && (
        <div className="space-y-0">
          {visibleItems.map((item, i) => {
            const next = visibleItems[i + 1];
            const transit = next ? transitBetween(item.coordinates, next.coordinates) : null;
            return (
              <React.Fragment key={`${item.kind}-${i}`}>
                <FlowItem item={item} onClick={() => handleItemClick(item)} />
                {transit && <TransitChip transit={transit} />}
              </React.Fragment>
            );
          })}
        </div>
      )}

      {/* Spacer between days */}
      <div className="h-4" />
    </section>
  );
});
DaySection.displayName = "DaySection";

/* ══════════════════════════════════════════════════════════════
   CITY-GROUPED VIEW — used when a category filter is active
   ══════════════════════════════════════════════════════════════ */
const PARENT_CITY_MAP = {
  "Tokyo Disney":      "Tokyo",
  "Tokyo DisneySea":   "Tokyo",
  "Universal Studios": "Osaka",
  "Osaka Universal":   "Osaka",
};
const normalizeCity = (city) => {
  const base = (city || "").replace(/ \d+$/, "");
  return PARENT_CITY_MAP[base] || base;
};

const collectFilteredItems = (filter, activeCity) => {
  const baseCityKey = activeCity ? activeCity.split("#")[0] : null;
  const items = [];
  tripData.forEach((day) => {
    const dayItems = dayItemsInOrder(day).map((it) => ({
      ...it,
      day: day.day,
      cityHe: it.cityHe || day.cityHe,
      city: normalizeCity(it.city || day.city),
    }));
    dayItems.forEach((it) => {
      if (baseCityKey && it.city !== baseCityKey) return;
      if (!itemMatchesFilter(it, filter)) return;
      items.push(it);
    });
  });
  return items;
};

const CityGroupedFlow = ({ filter, activeCity, onSelectLocation }) => {
  const items = useMemo(() => collectFilteredItems(filter, activeCity), [filter, activeCity]);
  const groups = useMemo(() => {
    const byCity = new Map();
    items.forEach((it) => {
      const key = it.city;
      if (!byCity.has(key)) byCity.set(key, { city: key, cityHe: it.cityHe, items: [] });
      byCity.get(key).items.push(it);
    });
    return Array.from(byCity.values());
  }, [items]);

  if (items.length === 0) {
    return (
      <div className="px-6 py-12 text-center text-sumi-400">
        אין תוצאות לסינון הנוכחי.
      </div>
    );
  }

  const handleItemClick = (item) => {
    if (!item.coordinates) return;
    onSelectLocation && onSelectLocation({
      lng: item.coordinates.lng,
      lat: item.coordinates.lat,
      name: item.name,
    });
  };

  return (
    <div className="px-2 md:px-4 pt-4 pb-32" dir="rtl">
      {groups.map((g) => (
        <section key={g.city} className="mb-6">
          <header className="px-2 mb-2 flex items-baseline justify-between border-b border-cream-200 pb-1.5">
            <h3 className="text-xl md:text-2xl font-bold text-sumi-800 font-serif">
              {g.cityHe || g.city}
            </h3>
            <span className="text-xs text-sumi-400 font-semibold tracking-wider">
              {g.items.length} מקומות
            </span>
          </header>
          <div className="space-y-0.5">
            {g.items.map((it, i) => (
              <FlowItem
                key={`${g.city}-${i}`}
                item={it}
                onClick={() => handleItemClick(it)}
              />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
};

/* ══════════════════════════════════════════════════════════════
   MAIN COMPONENT
   ══════════════════════════════════════════════════════════════ */
const VerticalFlow = forwardRef(({ selectedDay, onSelectDay, onSelectLocation, activeFilter, activeCity }, ref) => {
  const sectionRefs = useRef({});
  const [expandedDays, setExpandedDays] = useState({});

  /* Auto-expand the selected day */
  React.useEffect(() => {
    if (selectedDay) setExpandedDays((prev) => ({ ...prev, [selectedDay]: true }));
  }, [selectedDay]);

  const onToggleExpand = (dayNum) => {
    setExpandedDays((prev) => ({ ...prev, [dayNum]: !prev[dayNum] }));
  };

  /* When a category filter is active, switch to city-grouped browse */
  const isCategoryFilter = activeFilter === "food" || activeFilter === "shopping" || activeFilter === "attractions";

  /* Day visibility based on city filter (uses chronological key) */
  const visibleDays = useMemo(() => {
    if (!activeCity) return tripData;
    const baseKey = activeCity.split("#")[0];
    let lastBase = null;
    const ranges = [];
    let currentRange = null;
    tripData.forEach((d, idx) => {
      const baseCity = d.city.replace(/ \d+$/, "");
      const norm = PARENT_CITY_MAP[baseCity] || baseCity;
      if (norm !== lastBase) {
        if (currentRange) ranges.push(currentRange);
        currentRange = { base: norm, start: idx, end: idx };
      } else if (currentRange) {
        currentRange.end = idx;
      }
      lastBase = norm;
    });
    if (currentRange) ranges.push(currentRange);

    const matching = ranges.filter((r) => r.base === baseKey);
    let range;
    if (activeCity.includes("#")) {
      const idx = parseInt(activeCity.split("#")[1], 10) - 1;
      range = matching[idx] || matching[0];
    } else {
      range = matching[0];
    }
    if (!range) return tripData;
    return tripData.slice(range.start, range.end + 1);
  }, [activeCity]);

  /* Imperative scrollToDay for parent (map → flow sync) */
  useImperativeHandle(ref, () => ({
    scrollToDay: (day) => {
      const el = sectionRefs.current[day];
      if (el && typeof el.scrollIntoView === "function") {
        el.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    },
  }), []);

  /* CITY-GROUPED MODE */
  if (isCategoryFilter) {
    return (
      <CityGroupedFlow
        filter={activeFilter}
        activeCity={activeCity}
        onSelectLocation={onSelectLocation}
      />
    );
  }

  /* DAY-BY-DAY MODE */
  return (
    <div className="px-3 md:px-4 lg:px-6 pt-4 pb-32 max-w-2xl mx-auto" dir="rtl">
      {visibleDays.map((day, i) => (
        <DaySection
          key={day.day}
          ref={(el) => (sectionRefs.current[day.day] = el)}
          day={day}
          isSelected={selectedDay === day.day}
          onSelectDay={onSelectDay}
          onSelectLocation={onSelectLocation}
          activeFilter={activeFilter}
          isLast={i === visibleDays.length - 1}
          expanded={!!expandedDays[day.day]}
          onToggleExpand={onToggleExpand}
        />
      ))}
    </div>
  );
});
VerticalFlow.displayName = "VerticalFlow";

export default VerticalFlow;
