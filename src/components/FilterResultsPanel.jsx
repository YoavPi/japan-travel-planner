import React, { useMemo } from "react";
import { tripData } from "../data/tripData";
import { vibeDescriptions } from "../data/landmarkImages";
import { ActivityIcons } from "../data/illustrations";
import { getLocationPhoto } from "../data/photoMap";
import TripPhoto from "./TripPhoto";

/* ══════════════════════════════════════════════════════════════
   FILTER RESULTS PANEL  (Single-Select)
   Shows a city-grouped grid of ALL matching locations when a
   category filter is active. Respects the optional city filter
   passed down from the chronological path buttons.
   ══════════════════════════════════════════════════════════════ */

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

/* ── Shopping keyword matcher ── */
const SHOPPING_KEYWORDS = [
  "market","don quijote","parco","muji","outlet","uniqlo",
  "kappabashi","shopping","store","ameyoko","sunshine city","radio kaikan",
];
const isShopping = (name) => {
  const n = name.toLowerCase();
  return SHOPPING_KEYWORDS.some((kw) => n.includes(kw));
};

const gmapsUrl = (name) =>
  `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(name + " Japan")}`;

/* ── Activity icon picker ── */
const getActivityIcon = (name) => {
  const n = name.toLowerCase();
  if (n.includes("shrine") || n.includes("temple") || n.includes("inari") || n.includes("pagoda") || n.includes("todai")) return ActivityIcons.shrine;
  if (n.includes("park") || n.includes("gyoen") || n.includes("garden") || n.includes("bamboo")) return ActivityIcons.park;
  if (n.includes("coffee") || n.includes("café") || n.includes("cafe") || n.includes("starbucks") || n.includes("bricolage")) return ActivityIcons.coffee;
  if (n.includes("shinkansen") || n.includes("train")) return ActivityIcons.train;
  if (n.includes("onsen") || n.includes("hot spring")) return ActivityIcons.onsen;
  if (n.includes("market") || n.includes("don quijote") || n.includes("parco") || n.includes("muji") || n.includes("outlet") || n.includes("uniqlo") || n.includes("kappabashi")) return ActivityIcons.shopping;
  if (n.includes("view") || n.includes("billboard") || n.includes("crossing") || n.includes("tower") || n.includes("gov")) return ActivityIcons.viewpoint;
  if (n.includes("ramen") || n.includes("food") || n.includes("sushi") || n.includes("soba") || n.includes("gyoza") || n.includes("yakitori") || n.includes("katsu") || n.includes("yakiniku")) return ActivityIcons.food;
  if (n.includes("teamlab") || n.includes("uzu")) return ActivityIcons.viewpoint;
  if (n.includes("photo") || n.includes("camera")) return ActivityIcons.camera;
  return ActivityIcons.walk;
};

const GoogleMapsPin = ({ color = "#4285F4" }) => (
  <svg width={12} height={12} viewBox="0 0 24 24" fill={color}>
    <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5a2.5 2.5 0 1 1 0-5 2.5 2.5 0 0 1 0 5z"/>
  </svg>
);

/* ── Filter accent themes ── */
const FILTER_THEMES = {
  food: {
    accent: "#C4A048", label: "Food & Dining", labelJa: "食べ物",
    bgHeader: "bg-gold-50", borderHeader: "border-gold-200", textAccent: "text-gold-700",
    bgCard: "bg-cream-50", borderCard: "border-gold-100",
    badgeBg: "bg-gold-50", badgeText: "text-gold-700", badgeBorder: "border-gold-200",
    cityHeaderBg: "bg-gold-50/60", cityHeaderBorder: "border-gold-200", cityHeaderText: "text-gold-800",
  },
  shopping: {
    accent: "#57534E", label: "Shopping", labelJa: "買い物",
    bgHeader: "bg-cream-100", borderHeader: "border-cream-300", textAccent: "text-sumi-700",
    bgCard: "bg-cream-50", borderCard: "border-cream-200",
    badgeBg: "bg-cream-100", badgeText: "text-sumi-600", badgeBorder: "border-cream-300",
    cityHeaderBg: "bg-cream-100/60", cityHeaderBorder: "border-cream-300", cityHeaderText: "text-sumi-700",
  },
  attractions: {
    accent: "#D94025", label: "Attractions", labelJa: "観光地",
    bgHeader: "bg-vermillion-50", borderHeader: "border-vermillion-200", textAccent: "text-vermillion-600",
    bgCard: "bg-vermillion-50/30", borderCard: "border-vermillion-100",
    badgeBg: "bg-vermillion-50", badgeText: "text-vermillion-700", badgeBorder: "border-vermillion-200",
    cityHeaderBg: "bg-vermillion-50/60", cityHeaderBorder: "border-vermillion-200", cityHeaderText: "text-vermillion-700",
  },
  hotels: {
    accent: "#5C7A2E", label: "Hotels & Stays", labelJa: "宿泊",
    bgHeader: "bg-cream-100", borderHeader: "border-cream-300", textAccent: "text-matcha-600",
    bgCard: "bg-cream-50", borderCard: "border-cream-200",
    badgeBg: "bg-cream-100", badgeText: "text-matcha-600", badgeBorder: "border-cream-300",
    cityHeaderBg: "bg-cream-100/60", cityHeaderBorder: "border-cream-300", cityHeaderText: "text-matcha-700",
  },
};

/* ══════════════════════════════════════════════════════════════
   DATA EXTRACTION
   ══════════════════════════════════════════════════════════════ */
/* Per-item city override: an attraction/meal can carry its own
   `city`/`cityHe` when the activity physically happened in a different
   city than where the day's hotel is. Falls back to the day's city
   so existing entries keep working unchanged. */
function extractFoodItems() {
  const items = [];
  tripData.forEach((day) => {
    ["lunch", "dinner"].forEach((mealType) => {
      const meal = day[mealType];
      if (!meal || meal.place === "—" || !meal.place) return;
      items.push({
        name: meal.place, nameJa: meal.nameJa || "", nameHe: meal.nameHe || "",
        desc: meal.desc || "", rating: meal.rating && meal.rating !== "—" ? meal.rating : null,
        coordinates: meal.coordinates || null,
        city: meal.city || day.city,
        cityHe: meal.cityHe || day.cityHe,
        day: day.day, mealType: mealType === "lunch" ? "Lunch" : "Dinner",
        category: mealType === "lunch" ? "lunch" : "dinner",
      });
    });
  });
  return items;
}

function extractShoppingItems() {
  const items = [];
  tripData.forEach((day) => {
    day.attractions.forEach((attr) => {
      if (!isShopping(attr.name)) return;
      items.push({
        name: attr.name, nameJa: attr.nameJa || "", nameHe: attr.nameHe || "",
        desc: attr.desc || "", coordinates: attr.coordinates || null,
        city: attr.city || day.city,
        cityHe: attr.cityHe || day.cityHe,
        day: day.day,
        rating: null, mealType: null, category: "shopping",
      });
    });
  });
  return items;
}

function extractAttractionItems() {
  const items = [];
  tripData.forEach((day) => {
    day.attractions.forEach((attr) => {
      if (isShopping(attr.name)) return;
      items.push({
        name: attr.name, nameJa: attr.nameJa || "", nameHe: attr.nameHe || "",
        desc: attr.desc || "", coordinates: attr.coordinates || null,
        city: attr.city || day.city,
        cityHe: attr.cityHe || day.cityHe,
        day: day.day,
        rating: null, mealType: null, category: "attraction",
      });
    });
  });
  return items;
}

function extractHotelItems() {
  const items = [];
  const seen = new Set();
  tripData.forEach((day) => {
    if (!day.hotel || day.hotel === "—") return;
    const key = day.hotel;
    if (seen.has(key)) {
      const existing = items.find((i) => i.name === key);
      if (existing) existing.daysStayed = (existing.daysStayed || 1) + 1;
      return;
    }
    seen.add(key);
    items.push({
      name: day.hotel, nameJa: "", nameHe: "",
      desc: day.expenses ? `${day.expenses.accommodation}` : "",
      coordinates: day.coordinates || null, city: day.city, cityHe: day.cityHe,
      day: day.day, rating: null, mealType: null, category: "hotel", daysStayed: 1,
    });
  });
  return items;
}

function groupByCity(items) {
  const groups = [];
  const seen = {};
  items.forEach((item) => {
    const cityKey = normalizeCityKey(item.city);
    if (!seen[cityKey]) {
      seen[cityKey] = { city: cityKey, cityHe: item.cityHe, items: [] };
      groups.push(seen[cityKey]);
    }
    seen[cityKey].items.push(item);
  });
  return groups;
}

/* ══════════════════════════════════════════════════════════════
   INLINE ICONS
   ══════════════════════════════════════════════════════════════ */
const CloseIcon = ({ size = 20, color = "currentColor" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
  </svg>
);
const StarIcon = ({ size = 12 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="#C4A048" stroke="#C4A048" strokeWidth="1.5">
    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
  </svg>
);

/* ══════════════════════════════════════════════════════════════
   RESULT CARD
   ══════════════════════════════════════════════════════════════ */
const ResultCard = ({ item, theme, onSelectLocation, onSelectDay, onOpenDetail }) => {
  const IconComponent = getActivityIcon(item.name);
  const vibe = vibeDescriptions[item.name];
  const photo = getLocationPhoto(item.name);

  // IMPORTANT ordering: setSelectedDay() in App also clears selectedLocation.
  // We call it FIRST so the subsequent onSelectLocation sticks and the map
  // flies to the precise marker (zoom 16) instead of the day's city (zoom 12).
  const handleClick = () => {
    if (onSelectDay) onSelectDay(item.day);
    if (item.coordinates && onSelectLocation) {
      onSelectLocation({ lng: item.coordinates.lng, lat: item.coordinates.lat, name: item.name });
    }
  };

  const handleOpenDetail = (e) => {
    e.stopPropagation();
    // Sidebar → Map sync: image/View Details also focuses the map.
    if (item.coordinates && onSelectLocation) {
      onSelectLocation({ lng: item.coordinates.lng, lat: item.coordinates.lat, name: item.name });
    }
    if (onOpenDetail) {
      onOpenDetail({
        name: item.name, nameJa: item.nameJa, nameHe: item.nameHe,
        desc: item.desc, day: item.day, city: item.city, cityHe: item.cityHe,
        category: item.category || "attraction", rating: item.rating,
        coordinates: item.coordinates,
      });
    }
  };

  return (
    <button
      onClick={handleClick}
      className={`w-full text-left rounded-xl border ${theme.borderCard} ${theme.bgCard} p-3 transition-all duration-200 hover:shadow-md hover:scale-[1.01] active:scale-[0.99] group cursor-pointer`}
    >
      <div className="flex items-start gap-2.5">
        {photo ? (
          <div className="w-10 h-10 rounded-lg border border-cream-300 overflow-hidden flex-shrink-0 mt-0.5 cursor-zoom-in" onClick={handleOpenDetail}>
            <TripPhoto src={photo} alt={item.name} city={item.city} className="w-full h-full" objectFit="cover" />
          </div>
        ) : (
          <div className="flex-shrink-0 mt-0.5 opacity-70 group-hover:opacity-100 transition-opacity">
            <IconComponent size={20} color={theme.accent} />
          </div>
        )}

        <div className="flex-1 min-w-0">
          <div className="leading-tight">
            {item.nameJa && <span className="block font-body text-[10px] text-sumi-400">{item.nameJa}</span>}
            <span className="block font-display font-bold text-sm text-sumi-800 group-hover:text-vermillion-600 transition-colors truncate">{item.name}</span>
            {item.nameHe && <span className="block font-body text-[10px] text-sumi-400" dir="rtl">{item.nameHe}</span>}
          </div>

          <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
            <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-display font-medium ${theme.badgeBg} ${theme.badgeText} border ${theme.badgeBorder}`}>
              {normalizeCityKey(item.city)} · Day {item.day}
            </span>
            {item.mealType && (
              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-display font-medium bg-gold-50 text-gold-700 border border-gold-200">
                {item.mealType}
              </span>
            )}
            {item.daysStayed > 1 && (
              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-display font-medium bg-cream-100 text-sumi-600 border border-cream-300">
                {item.daysStayed} nights
              </span>
            )}
          </div>

          {item.rating && (
            <div className="flex items-center gap-1 mt-1">
              <StarIcon size={11} />
              <span className="text-[11px] font-display font-medium text-gold-700">{item.rating}</span>
            </div>
          )}

          {item.desc && (
            <p className="text-[11px] font-body text-sumi-500 mt-1 leading-snug line-clamp-2" dir="rtl">{item.desc}</p>
          )}

          {vibe && (
            <p className="text-[10px] font-body text-sumi-500 italic mt-1 leading-snug line-clamp-3" dir="rtl">{vibe}</p>
          )}

          <div className="flex items-center gap-3 mt-1.5">
            <a
              href={gmapsUrl(item.name)} target="_blank" rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="inline-flex items-center gap-1 text-[10px] font-display text-sumi-400 hover:text-blue-600 transition-colors group/gm"
            >
              <GoogleMapsPin color="#4285F4" />
              <span className="group-hover/gm:underline underline-offset-2">Google Maps</span>
              <span className="text-sumi-300">↗</span>
            </a>
            {onOpenDetail && (
              <button
                onClick={handleOpenDetail}
                className="inline-flex items-center gap-1 text-[10px] font-display font-semibold text-vermillion-500 hover:text-vermillion-700 transition-colors"
              >
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>
                </svg>
                Details
              </button>
            )}
          </div>
        </div>
      </div>
    </button>
  );
};

/* ══════════════════════════════════════════════════════════════
   EMPTY STATE
   ══════════════════════════════════════════════════════════════ */
const EmptyState = ({ filterLabel }) => (
  <div className="flex flex-col items-center justify-center py-16 text-sumi-400">
    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#D94025" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" className="mb-4 opacity-30">
      <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
    <span className="text-sm font-display font-semibold text-sumi-500">No results found</span>
    <span className="text-[11px] font-body text-sumi-400 mt-1">結果なし</span>
    <p className="text-[11px] font-body text-sumi-400 mt-2 text-center max-w-[200px]">
      No {filterLabel || "items"} match this city filter.
    </p>
  </div>
);

/* ══════════════════════════════════════════════════════════════
   MAIN COMPONENT
   Props:
     activeFilter      string|null  – category key
     activeCity        string|null  – chronological city key e.g. "Tokyo#1"
     chronoCityPath    array        – from ItineraryList
     cityDayRanges     object       – { cityKey: {startDay, endDay} }
     onSelectLocation  fn
     onSelectDay       fn
     onClose           fn
     onOpenDetail      fn
   ══════════════════════════════════════════════════════════════ */
const FilterResultsPanel = ({
  activeFilter,
  activeCity,
  chronoCityPath,
  cityDayRanges,
  onSelectLocation,
  onSelectDay,
  onClose,
  onOpenDetail,
}) => {
  const theme = FILTER_THEMES[activeFilter] || FILTER_THEMES.attractions;

  /* ── Collect all items for this filter ── */
  const allItems = useMemo(() => {
    if (!activeFilter) return [];
    switch (activeFilter) {
      case "food":        return extractFoodItems();
      case "shopping":    return extractShoppingItems();
      case "attractions": return extractAttractionItems();
      case "hotels":      return extractHotelItems();
      default:            return [];
    }
  }, [activeFilter]);

  /* ── Apply the city filter from the header (activeCity)
        Two modes, distinguished by presence of a "#" in the key:
          • "Tokyo#2" → chronological slice (cityDayRanges date range)
          • "Tokyo"   → consolidated: ALL days whose normalized city
                        matches, regardless of trip segment.
     ── */
  const cityFilteredItems = useMemo(() => {
    if (!activeCity) return allItems;
    const isChrono = typeof activeCity === "string" && activeCity.includes("#");
    if (isChrono) {
      if (!cityDayRanges) return allItems;
      const range = cityDayRanges[activeCity];
      if (!range) return allItems;
      return allItems.filter((item) => item.day >= range.startDay && item.day <= range.endDay);
    }
    // Consolidated mode — match by normalized parent city name.
    return allItems.filter((item) => normalizeCityKey(item.city) === activeCity);
  }, [allItems, activeCity, cityDayRanges]);

  /* ── Results driven entirely by top-level filters from ItineraryList header ── */
  const { items, groups } = useMemo(() => {
    return { items: cityFilteredItems, groups: groupByCity(cityFilteredItems) };
  }, [cityFilteredItems]);

  if (!activeFilter) return null;

  return (
    <div className="h-full flex flex-col bg-cream-50 font-display">
      {/* ── Header bar ── */}
      <div className={`flex-shrink-0 flex items-center justify-between px-4 py-3 ${theme.bgHeader} border-b ${theme.borderHeader}`}>
        <div className="flex items-center gap-2.5">
          <span className={`text-lg font-bold ${theme.textAccent}`}>{theme.label}</span>
          <span className="text-xs font-body text-sumi-400">{theme.labelJa}</span>
          <span className={`ml-1 inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold ${theme.badgeBg} ${theme.badgeText} border ${theme.badgeBorder}`}>
            {items.length}
          </span>
          {activeCity && (
            <span className="text-xs font-body text-sumi-500">
              · {activeCity.includes("#") ? activeCity.replace("#", " #") : activeCity}
            </span>
          )}
        </div>
        <button
          onClick={onClose}
          className="p-1.5 rounded-lg hover:bg-sumi-100 transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center"
          title="Close filter"
        >
          <CloseIcon size={18} color="#57534E" />
        </button>
      </div>

      {/* ── Duplicate panel-level city sub-filter removed (Task 3).
             City filtering is handled exclusively by the chronological city
             path in the sticky header of ItineraryList. ── */}

      {/* ── Results grouped by city ── */}
      <div className="flex-1 overflow-y-auto overscroll-contain px-3 py-3 space-y-4 scrollbar-thin">
        {groups.map((group) => (
          <div key={group.city}>
            <div className={`sticky top-0 z-10 flex items-center gap-2 px-2 py-1.5 rounded-lg ${theme.cityHeaderBg} border ${theme.cityHeaderBorder} backdrop-blur-sm mb-2`}>
              <span className={`text-xs font-display font-bold ${theme.cityHeaderText}`}>{group.city}</span>
              <span className="text-[10px] font-body text-sumi-400" dir="rtl">{group.cityHe}</span>
              <span className="ml-auto text-[10px] font-display text-sumi-400">{group.items.length} spots</span>
            </div>
            <div className="grid grid-cols-1 gap-2">
              {group.items.map((item, idx) => (
                <ResultCard
                  key={`${item.name}-${item.day}-${item.mealType || ""}-${idx}`}
                  item={item} theme={theme}
                  onSelectLocation={onSelectLocation}
                  onSelectDay={onSelectDay}
                  onOpenDetail={onOpenDetail}
                />
              ))}
            </div>
          </div>
        ))}
        {items.length === 0 && <EmptyState filterLabel={theme.label} />}
      </div>
    </div>
  );
};

export default FilterResultsPanel;
