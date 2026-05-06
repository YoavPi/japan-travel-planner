import React, { forwardRef, useImperativeHandle, useMemo, useRef } from "react";
import { tripData } from "../data/tripData";
import { ActivityIcons } from "../data/illustrations";

/* ══════════════════════════════════════════════════════════════
   VERTICAL FLOW — New itinerary view
   ──────────────────────────────────────────────────────────────
   Clean, airy timeline:
     - Continuous crimson line on the right edge (RTL-friendly)
     - One section per day with a filled day node
     - Phases interleaved by time-of-day:
         בוקר        = first half of attractions
         צהריים      = day.lunch
         אחר הצהריים  = second half of attractions
         ערב         = day.dinner
     - Every item has a category icon next to its name

   Design rules:
     - REMOVE Japanese names from the rendered output
     - REMOVE tips and expenses (data preserved, UI only)
     - REMOVE hero illustrations on top of day rows
     - REMOVE English district summaries — Hebrew only
     - Pointer-cursor only on items that have `coordinates`
     - Typography hierarchy: city 32px+ / item 18px
   ══════════════════════════════════════════════════════════════ */

/* ── Activity icon picker ─────────────────────────────────────
   Maps an item's name to a representative line-art icon from the
   shared ActivityIcons library. The matcher inspects the English
   `name` AND the Hebrew `nameHe` so we work even on items where
   one side is sparse. Falls back to "walk" for generic locations. */
const isHotelName = (n) => /hotel|אכסניה|מלון|ryokan/i.test(n || "");

const pickIcon = (item) => {
  const text = `${item?.name || ""} ${item?.nameHe || ""} ${item?.desc || ""}`.toLowerCase();

  // Specific food/cafe before generic
  if (/coffee|café|cafe|starbucks|bricolage|anakuma|stumptown/.test(text)) return ActivityIcons.coffee;
  if (/onsen|hot spring|אונסן|温泉/.test(text)) return ActivityIcons.onsen;
  if (/shrine|temple|inari|pagoda|todai|מקדש|פגוד|טירה|castle/.test(text)) return ActivityIcons.shrine;
  if (/park|garden|gyoen|bamboo|פארק|גן /.test(text)) return ActivityIcons.park;
  if (/market|don quijote|parco|muji|outlet|uniqlo|kappabashi|store|ameyoko|sunshine city|radio kaikan|shopping|חנות|שוק|קניות/.test(text)) return ActivityIcons.shopping;
  if (/view|tower|crossing|teamlab|billboard|תצפית|מגדל|tower|פוג'?י/.test(text)) return ActivityIcons.viewpoint;
  if (/ramen|sushi|food|soba|gyoza|yakitori|katsu|yakiniku|burger|pizza|pancake|udon|izakaya|duck|ראמן|סושי|אוכל|המבורגר|פיצה|אודון/.test(text)) return ActivityIcons.food;
  if (/photo|camera|chureito|צילום/.test(text)) return ActivityIcons.camera;
  if (/disney|universal|monsters|pirates|space mountain|tower of terror|haunted|ferris/.test(text)) return ActivityIcons.viewpoint;

  return ActivityIcons.walk;
};

/* Color hint per phase so icons read well at a glance */
const phaseAccentColor = (phase) => {
  switch (phase) {
    case "lunch":  return "#C4A048";
    case "dinner": return "#D94025";
    case "shop":   return "#57534E";
    default:       return "#8F2818";
  }
};

/* ── Phase node (small hollow circle on the timeline) ── */
const PhaseHeader = ({ label }) => (
  <div className="relative pr-8 mb-3 mt-5">
    <div className="absolute right-[7px] top-[6px] w-2.5 h-2.5 rounded-full border border-vermillion-400 bg-cream-50 z-10" />
    <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-sumi-400">
      {label}
    </p>
  </div>
);

/* ── Single flow item (location button) ──
   Icon on the right (reading start in RTL), text on the left.
   The button uses flex with `dir="rtl"` so the icon slot sits at
   the visual right and the text/rating column flows leftward. */
const FlowItem = ({ item, onClick, accentColor }) => {
  const interactive = !!item.coordinates;
  const Icon = pickIcon(item);
  const iconColor = accentColor || (isHotelName(item.name) ? "#5C7A2E" : "#1C1917");

  return (
    <button
      type="button"
      disabled={!interactive}
      onClick={interactive ? onClick : undefined}
      dir="rtl"
      className={`flex items-start gap-3 w-full text-right py-2 px-2 rounded-lg transition-colors
        ${interactive
          ? "cursor-pointer hover:bg-vermillion-50/60"
          : "cursor-default"
        }`}
    >
      {/* Icon disc — soft cream background so the line-art reads */}
      <span
        className="flex-shrink-0 mt-0.5 inline-flex items-center justify-center rounded-full"
        style={{
          width: 30,
          height: 30,
          backgroundColor: "rgba(250,246,232,0.8)",
          border: "1px solid #EDE5D0",
        }}
        aria-hidden
      >
        <Icon size={16} color={iconColor} />
      </span>

      <span className="flex-1 min-w-0">
        <span className="block text-base md:text-lg font-medium text-sumi-700 leading-snug">
          {item.name}
          {item.rating && item.rating !== "—" && (
            <span className="inline-flex items-center gap-1 mr-2 align-middle text-sm font-semibold text-gold-400">
              <svg width="11" height="11" viewBox="0 0 24 24" fill="#C4A048" stroke="#C4A048" strokeWidth="1.5">
                <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
              </svg>
              {item.rating}
            </span>
          )}
        </span>
        {item.nameHe && (
          <span className="block text-sm text-sumi-400 mt-0.5">
            {item.nameHe}
          </span>
        )}
      </span>
    </button>
  );
};

/* ── Filter helpers (UI-side only — data unchanged) ── */
const isShoppingName = (name = "") => {
  const n = name.toLowerCase();
  return ["market", "don quijote", "parco", "muji", "outlet", "uniqlo",
          "kappabashi", "shopping", "store", "ameyoko", "sunshine city",
          "radio kaikan"].some((kw) => n.includes(kw));
};

const filterAttractions = (attractions, activeFilter) => {
  if (!activeFilter || activeFilter === "food" || activeFilter === "hotels") {
    // Hide attractions when food/hotels filter is active (only meals/hotel relevant)
    if (activeFilter === "food" || activeFilter === "hotels") return [];
    return attractions || [];
  }
  if (activeFilter === "shopping") return (attractions || []).filter((a) => isShoppingName(a.name));
  if (activeFilter === "attractions") return (attractions || []).filter((a) => !isShoppingName(a.name));
  return attractions || [];
};

const shouldShowMeal = (meal, activeFilter) => {
  if (!meal || meal.place === "—" || !meal.place) return false;
  if (!activeFilter) return true;
  return activeFilter === "food";
};

/* ── Day section ── */
const DaySection = forwardRef(({ day, isSelected, onSelectDay, onSelectLocation, activeFilter, isLast }, ref) => {
  const baseCity = day.city.replace(/ \d+$/, "");

  /* Time-of-day partition (heuristic on attraction order) */
  const visibleAttractions = filterAttractions(day.attractions, activeFilter);
  const splitIdx = Math.ceil(visibleAttractions.length / 2);
  const morning = visibleAttractions.slice(0, splitIdx);
  const afternoon = visibleAttractions.slice(splitIdx);
  const lunch = shouldShowMeal(day.lunch, activeFilter) ? day.lunch : null;
  const dinner = shouldShowMeal(day.dinner, activeFilter) ? day.dinner : null;

  const hasAny = morning.length || afternoon.length || lunch || dinner;
  if (!hasAny) return null;

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

  return (
    <section ref={ref} className="relative">
      {/* Continuous crimson line (right edge in RTL space) */}
      {!isLast && (
        <div className="absolute right-3 top-9 bottom-[-32px] w-px bg-vermillion-300/40" aria-hidden />
      )}

      {/* Day header — clickable, fills the day node */}
      <button
        type="button"
        onClick={() => onSelectDay(day.day)}
        className="relative pr-8 pl-2 pb-2 pt-1 mb-2 w-full text-right cursor-pointer hover:bg-cream-100/40 rounded-lg transition-colors"
      >
        <div
          className={`absolute right-1 top-2 w-4 h-4 rounded-full border-2 z-20 transition-colors
            ${isSelected
              ? "bg-vermillion-500 border-vermillion-500"
              : "bg-cream-50 border-vermillion-400"
            }`}
        />
        <h2 className="text-3xl md:text-4xl font-bold tracking-tight text-sumi-800 leading-tight font-serif">
          יום {day.day}
          <span className="text-sumi-400 font-light"> · </span>
          <span>{day.cityHe || baseCity}</span>
        </h2>
      </button>

      {/* Phase: Morning */}
      {morning.length > 0 && (
        <>
          <PhaseHeader label="בוקר" />
          <div className="pr-8 pl-2 space-y-1">
            {morning.map((a, i) => (
              <FlowItem key={`m-${i}`} item={a} onClick={() => handleItemClick(a)} />
            ))}
          </div>
        </>
      )}

      {/* Phase: Lunch */}
      {lunch && (
        <>
          <PhaseHeader label="צהריים" />
          <div className="pr-8 pl-2">
            <FlowItem
              item={{ ...lunch, name: lunch.place }}
              onClick={() => handleItemClick({ ...lunch, name: lunch.place })}
              accentColor={phaseAccentColor("lunch")}
            />
          </div>
        </>
      )}

      {/* Phase: Afternoon */}
      {afternoon.length > 0 && (
        <>
          <PhaseHeader label="אחר הצהריים" />
          <div className="pr-8 pl-2 space-y-1">
            {afternoon.map((a, i) => (
              <FlowItem key={`a-${i}`} item={a} onClick={() => handleItemClick(a)} />
            ))}
          </div>
        </>
      )}

      {/* Phase: Dinner */}
      {dinner && (
        <>
          <PhaseHeader label="ערב" />
          <div className="pr-8 pl-2">
            <FlowItem
              item={{ ...dinner, name: dinner.place }}
              onClick={() => handleItemClick({ ...dinner, name: dinner.place })}
              accentColor={phaseAccentColor("dinner")}
            />
          </div>
        </>
      )}

      {/* Spacer between days */}
      <div className="h-10" />
    </section>
  );
});
DaySection.displayName = "DaySection";

/* ══════════════════════════════════════════════════════════════
   MAIN COMPONENT
   ══════════════════════════════════════════════════════════════ */
const VerticalFlow = forwardRef(({ selectedDay, onSelectDay, onSelectLocation, activeFilter, activeCity }, ref) => {
  const sectionRefs = useRef({});

  /* ── Day visibility based on city filter (uses chronological key) ── */
  const visibleDays = useMemo(() => {
    if (!activeCity) return tripData;
    /* Find all consecutive day spans for this chronological key.
       Mirrors the logic in ItineraryList.cityDayRanges but inlined
       to keep this component self-contained. */
    const baseKey = activeCity.split("#")[0];
    /* Build instance count → ranges */
    let instance = 0;
    let lastBase = null;
    const ranges = [];
    let currentRange = null;
    tripData.forEach((d, idx) => {
      const baseCity = d.city.replace(/ \d+$/, "");
      const norm = (
        baseCity === "Tokyo Disney" || baseCity === "Tokyo DisneySea" ? "Tokyo" :
        baseCity === "Universal Studios" || baseCity === "Osaka Universal" ? "Osaka" :
        baseCity
      );
      if (norm !== lastBase) {
        instance = (instance + 1);
        if (currentRange) ranges.push(currentRange);
        currentRange = { key: norm === baseKey ? `${baseKey}${activeCity.includes("#") ? `#${ranges.filter(r => r.base === baseKey).length + 1}` : ""}` : null, base: norm, start: idx, end: idx };
      } else if (currentRange) {
        currentRange.end = idx;
      }
      lastBase = norm;
    });
    if (currentRange) ranges.push(currentRange);

    /* Pick the range matching activeCity (with #N or bare key) */
    const matching = ranges.filter((r) => r.base === baseKey);
    let range;
    if (activeCity.includes("#")) {
      const idx = parseInt(activeCity.split("#")[1], 10) - 1;
      range = matching[idx] || matching[0];
    } else {
      range = matching[0]; // consolidated mode (filter-active path)
    }
    if (!range) return tripData;
    return tripData.slice(range.start, range.end + 1);
  }, [activeCity]);

  /* ── Imperative scrollToDay for parent (map → flow sync) ── */
  useImperativeHandle(ref, () => ({
    scrollToDay: (day) => {
      const el = sectionRefs.current[day];
      if (el && typeof el.scrollIntoView === "function") {
        el.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    },
  }), []);

  return (
    <div className="px-4 md:px-6 lg:px-8 pt-6 pb-32 max-w-2xl mx-auto">
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
        />
      ))}
    </div>
  );
});
VerticalFlow.displayName = "VerticalFlow";

export default VerticalFlow;
