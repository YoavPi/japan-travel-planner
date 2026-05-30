import React, { useCallback, useRef, useEffect, useMemo, useState } from "react";
import Map, {
  Marker,
  Source,
  Layer,
  Popup,
  NavigationControl,
} from "react-map-gl/maplibre";
import "maplibre-gl/dist/maplibre-gl.css";
import { tripData, routePath, HOTEL_COORDINATES } from "../data/tripData";
import { FILTERS, getChronologicalCityPath } from "./ItineraryList";
import { vibeDescriptions } from "../data/landmarkImages";
import { CityIllustrations, cityToHeroIllustration, ActivityIcons } from "../data/illustrations";
import { getLocationPhoto } from "../data/photoMap";
import { mapsUrlFor } from "../utils/mapsUrl";

/* ══════════════════════════════════════════════
   CONSTANTS & CONFIG
   ══════════════════════════════════════════════ */

// Free CARTO Positron tiles — no API key
const MAP_STYLE =
  "https://basemaps.cartocdn.com/gl/positron-gl-style/style.json";

// City color palette — "Modern Vintage" Japanese accent colors
const CITY_COLORS = {
  "Tokyo":           { bg: "#D94025", text: "#fff", border: "#B8331E", light: "#FEF0EE" },
  "Tokyo Disney":    { bg: "#E87D6E", text: "#fff", border: "#D94025", light: "#FEF0EE" },
  "Tokyo DisneySea": { bg: "#F09080", text: "#fff", border: "#E85A45", light: "#FEF0EE" },
  "Kanazawa":        { bg: "#5C7A2E", text: "#fff", border: "#3D5A1A", light: "#F2F5ED" },
  "Takayama":        { bg: "#728F45", text: "#fff", border: "#5C7A2E", light: "#F2F5ED" },
  "Matsumoto":       { bg: "#93B06A", text: "#fff", border: "#728F45", light: "#F2F5ED" },
  "Nagoya":          { bg: "#C4A048", text: "#fff", border: "#A08030", light: "#FBF8EE" },
  "Osaka":           { bg: "#B8331E", text: "#fff", border: "#8F2818", light: "#FEF0EE" },
  "Osaka Universal": { bg: "#E85A45", text: "#fff", border: "#D94025", light: "#FEF0EE" },
  "Nara":            { bg: "#D4B86C", text: "#292524", border: "#C4A048", light: "#FBF8EE" },
  "Kyoto":           { bg: "#8F2818", text: "#fff", border: "#6B1E12", light: "#FEF0EE" },
  "Kawaguchiko":     { bg: "#4A7FB5", text: "#fff", border: "#3A6A9A", light: "#EEF4FA" },
  "Hakone":          { bg: "#6B8E5A", text: "#fff", border: "#4A6B3E", light: "#F2F5ED" },
};

const getCityColor = (city) => {
  const base = city.replace(/ \d+$/, "");
  return CITY_COLORS[base] || CITY_COLORS[city] || { bg: "#D94025", text: "#fff", border: "#B8331E", light: "#FEF0EE" };
};

/* ── City flyTo anchors (Google-Maps-verified central points) ──
   Used when the user clicks a city pill with no category filter.
   These override the geometric centroid (which drifted toward
   wherever the trip happened to cluster, e.g. Roppongi for Tokyo).
   Each entry is the canonical "downtown" the user expects to see. */
const CITY_CENTERS = {
  "Tokyo":             { lng: 139.7454, lat: 35.6586, zoom: 12 },   // Tokyo Tower / central
  "Tokyo Disney":      { lng: 139.8804, lat: 35.6329, zoom: 13.5 }, // Tokyo Disney Resort
  "Tokyo DisneySea":   { lng: 139.8884, lat: 35.6267, zoom: 14 },   // DisneySea park centre
  "Kanazawa":          { lng: 136.6562, lat: 36.5613, zoom: 13 },   // Kanazawa Station
  "Takayama":          { lng: 137.2531, lat: 36.1404, zoom: 14 },   // Old town
  "Matsumoto":         { lng: 137.9721, lat: 36.2381, zoom: 13.5 }, // Matsumoto Castle
  "Nagoya":            { lng: 136.9066, lat: 35.1815, zoom: 12.5 }, // Nagoya Station
  "Osaka":             { lng: 135.5023, lat: 34.6937, zoom: 12 },   // Umeda
  "Osaka Universal":   { lng: 135.4323, lat: 34.6655, zoom: 14 },   // USJ
  "Nara":              { lng: 135.8048, lat: 34.6851, zoom: 14 },   // Nara Park
  "Kyoto":             { lng: 135.7681, lat: 35.0116, zoom: 12.5 }, // Central Kyoto
  "Kawaguchiko":       { lng: 138.7529, lat: 35.5172, zoom: 13 },   // Lake Kawaguchi
  "Hakone":            { lng: 139.0261, lat: 35.2326, zoom: 12.5 }, // Hakone-Yumoto
};

/* ══════════════════════════════════════════════
   CUSTOM SVG MARKER — Minimalist colored dot
   No numeric label (per spec). City color is preserved so users
   can still distinguish regions at a glance, and the dot grows +
   gets a white inner ring on hover/select.
   ══════════════════════════════════════════════ */
const DayMarkerSVG = ({ colors, isSelected, isHovered }) => {
  const size = isSelected ? 22 : isHovered ? 18 : 14;
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* Outer ring (white halo for legibility on the map tiles) */}
      <circle cx="12" cy="12" r="10" fill="#FDFBF5" opacity="0.85" />
      {/* Color dot */}
      <circle
        cx="12"
        cy="12"
        r="7"
        fill={colors.bg}
        stroke={isSelected ? "#FDFBF5" : colors.border}
        strokeWidth={isSelected ? 2.5 : 1.25}
      />
      {/* Inner pip on selection */}
      {isSelected && <circle cx="12" cy="12" r="2.5" fill="#FDFBF5" />}
    </svg>
  );
};

/* ──────────────────────────────────────────────
   Sub-location marker — small dot for specific places
   ────────────────────────────────────────────── */
const SubLocationMarker = () => (
  <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
    <circle cx="10" cy="10" r="7" fill="#D94025" fillOpacity="0.9" stroke="#FDFBF5" strokeWidth="2" />
    <circle cx="10" cy="10" r="3" fill="#FDFBF5" />
  </svg>
);

/* ══════════════════════════════════════════════
   MAP COMPONENT
   ══════════════════════════════════════════════ */
/* ── Google Maps URL helper — re-exports the SHARED resolver so
   every popup respects curated item.link URLs. Accepts either a
   full item (preferred) or just a name (legacy fallback). */
const gmapsUrl = (itemOrName) => mapsUrlFor(itemOrName);

/* ── Parent city mapping (matches FilterResultsPanel) ── */
const PARENT_CITY_MAP = {
  "Tokyo Disney":      "Tokyo",
  "Tokyo DisneySea":   "Tokyo",
  "Universal Studios": "Osaka",
  "Osaka Universal":   "Osaka",
};
const normalizeCityKey = (city) => {
  const base = (city || "").replace(/ \d+$/, "");
  return PARENT_CITY_MAP[base] || base;
};

/* ── Shopping keyword matcher (matches FilterResultsPanel) ── */
const SHOPPING_KEYWORDS = [
  "market","don quijote","parco","muji","outlet","uniqlo",
  "kappabashi","shopping","store","ameyoko","sunshine city","radio kaikan",
];
const isShoppingName = (name) => {
  const n = (name || "").toLowerCase();
  return SHOPPING_KEYWORDS.some((kw) => n.includes(kw));
};

/* ── Food keyword matcher ──
   tripData now treats attractions[] as the chronological source of
   truth; food items are interleaved with regular stops. The Food
   filter on the map looks for keywords that signal restaurants,
   cafes, ramen-yas etc. in the English / Hebrew / desc text. */
const FOOD_KEYWORDS = [
  "ramen", "sushi", "udon", "soba", "noodle", "gyoza", "yakitori",
  "yakiniku", "katsu", "burger", "pizza", "pancake", "izakaya",
  "duck", "konbini", "lawson", "mcdonald", "cafe", "café", "coffee",
  "starbucks", "bricolage", "anakuma", "stumptown", "buffet",
  "restaurant", "ראמן", "סושי", "אודון", "סובה", "גיוזה", "מסעדה",
  "מסעדת", "ארוחה", "המבורגר", "פיצה", "פנקייק", "באר", "אזקאיה",
  "בית קפה", "קפה", "מאפייה", "קונביני",
];
const isFoodName = (item) => {
  const t = `${item.name || ""} ${item.nameHe || ""} ${item.desc || ""}`.toLowerCase();
  return FOOD_KEYWORDS.some((kw) => t.includes(kw));
};

/* ── Per-item city resolver ──
   An attraction/meal can override the day's city via its own `city`
   field (used when the activity happened in a different city than
   where the night's hotel sits — e.g. Day 9 slept Nagoya but the
   morning was in Matsumoto). Hotels never override. */
const resolveCity = (item, day) =>
  normalizeCityKey(item?.city || day.city);

/* ── Extract filter-matching coordinates ── */
/* ── Popup-friendly fitBounds/flyTo padding ──
   The popup grows upward from its marker, so we always reserve a
   generous top inset. On mobile the BottomSheet covers the bottom
   ~140px (peek = 110, plus breathing room) so the bottom inset must
   also account for the sheet — otherwise the marker lands underneath
   the sheet and the popup is hidden. */
const getPopupPadding = () => {
  const isMobile = typeof window !== "undefined" && window.innerWidth < 1024;
  return isMobile
    ? { top: 220, bottom: 160, left: 40, right: 40 }
    : { top: 280, bottom: 40, left: 40, right: 40 };
};

const collectFilteredCoords = (filter, cityKey) => {
  const coords = [];
  // Accept cityKey as either "Tokyo" or "Tokyo#1" (chronological instance).
  // For bounds-fitting we match by base city name across all instances —
  // good enough for a bird's-eye; per-instance day-range filtering only
  // matters in the sidebar list.
  const baseCityKey = cityKey ? cityKey.split("#")[0] : null;
  const cityMatchesItem = (item, day) =>
    !baseCityKey || resolveCity(item, day) === baseCityKey;
  const cityMatchesHotel = (day) =>
    !baseCityKey || normalizeCityKey(day.city) === baseCityKey;

  tripData.forEach((day) => {
    // No category filter → collect ALL points (attractions + meals + hotel)
    // so city-only selection still produces a meaningful fit.
    if (!filter) {
      day.attractions.forEach((a) => {
        if (a.coordinates && cityMatchesItem(a, day)) coords.push([a.coordinates.lng, a.coordinates.lat]);
      });
      ["lunch", "dinner"].forEach((m) => {
        const meal = day[m];
        if (meal && meal.place && meal.place !== "—" && meal.coordinates && cityMatchesItem(meal, day)) {
          coords.push([meal.coordinates.lng, meal.coordinates.lat]);
        }
      });
      if (day.hotel && day.hotel !== "—" && cityMatchesHotel(day)) {
        const h = HOTEL_COORDINATES[day.hotel] || day.coordinates;
        if (h) coords.push([h.lng, h.lat]);
      }
      return;
    }

    if (filter === "food") {
      /* Food = restaurants / cafes / bars / konbini found anywhere
         in attractions. Also picks up legacy lunch/dinner slots
         when present, so older days still surface their meals. */
      day.attractions.forEach((a) => {
        if (a.coordinates && isFoodName(a) && cityMatchesItem(a, day)) {
          coords.push([a.coordinates.lng, a.coordinates.lat]);
        }
      });
      ["lunch", "dinner"].forEach((m) => {
        const meal = day[m];
        if (meal && meal.place && meal.place !== "—" && meal.coordinates && cityMatchesItem(meal, day)) {
          /* Skip if already covered by an attraction with the same name */
          const already = (day.attractions || []).some((a) => a.name === meal.place);
          if (!already) coords.push([meal.coordinates.lng, meal.coordinates.lat]);
        }
      });
    } else if (filter === "shopping") {
      day.attractions.forEach((a) => {
        if (isShoppingName(a.name) && a.coordinates && cityMatchesItem(a, day)) {
          coords.push([a.coordinates.lng, a.coordinates.lat]);
        }
      });
    } else if (filter === "attractions") {
      day.attractions.forEach((a) => {
        if (!isShoppingName(a.name) && !isFoodName(a) && a.coordinates && cityMatchesItem(a, day)) {
          coords.push([a.coordinates.lng, a.coordinates.lat]);
        }
      });
    } else if (filter === "hotels") {
      if (day.hotel && day.hotel !== "—" && cityMatchesHotel(day)) {
        const h = HOTEL_COORDINATES[day.hotel] || day.coordinates;
        if (h) coords.push([h.lng, h.lat]);
      }
    }
  });
  return coords;
};

/* ══════════════════════════════════════════════
   MOBILE MAP FILTERS — floating overlay (mobile-only)
   Renders inside the map panel, top-aligned. Categories as
   pill chips + horizontal scrollable city row. Semi-transparent
   background keeps the map legible underneath. All handlers
   delegate to App-level state via onFilterChange / onCityChange
   so the sidebar Trip Roadmap stays in perfect sync.
   ══════════════════════════════════════════════ */
const MobileMapFilters = ({ activeFilter, activeCity, onFilterChange, onCityChange }) => {
  // Consolidated city list (unique names, chronological order)
  const cities = useMemo(() => {
    const chrono = getChronologicalCityPath();
    const seen = new Set();
    const out = [];
    chrono.forEach((cp) => {
      if (!seen.has(cp.city)) { seen.add(cp.city); out.push(cp); }
    });
    return out;
  }, []);

  return (
    <div className="lg:hidden absolute top-2 left-2 right-2 z-[5] pointer-events-none">
      <div className="bg-cream-50/92 backdrop-blur-md rounded-xl border border-cream-300 shadow-md px-2 py-2 pointer-events-auto">
        {/* ── Categories row ── */}
        <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none">
          <button
            onClick={() => onFilterChange && onFilterChange(null)}
            className={`flex items-center gap-1 flex-shrink-0 px-2.5 py-1 rounded-full text-[10px] font-display font-semibold transition-all duration-150 border min-h-[28px]
              ${!activeFilter
                ? "bg-vermillion-500 text-white border-vermillion-500 shadow-sm"
                : "bg-white/80 text-sumi-500 border-cream-300"
              }`}
          >
            All
          </button>
          {FILTERS.map((f) => {
            const isActive = activeFilter === f.key;
            return (
              <button
                key={f.key}
                onClick={() => onFilterChange && onFilterChange(f.key)}
                className={`flex items-center gap-1 flex-shrink-0 px-2.5 py-1 rounded-full text-[10px] font-display font-semibold transition-all duration-150 border min-h-[28px]
                  ${isActive
                    ? "bg-vermillion-500 text-white border-vermillion-500 shadow-sm"
                    : "bg-white/80 text-sumi-500 border-cream-300"
                  }`}
              >
                <f.icon size={11} color={isActive ? "#fff" : f.color} />
                <span>{f.label}</span>
              </button>
            );
          })}
        </div>
        {/* ── Cities row ── */}
        <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none mt-1.5 pt-1.5 border-t border-cream-200">
          <button
            onClick={() => onCityChange && activeCity && onCityChange(activeCity)}
            className={`flex-shrink-0 px-2.5 py-1 rounded-full text-[10px] font-display font-semibold transition-all duration-150 border min-h-[28px]
              ${!activeCity
                ? "bg-sumi-800 text-white border-sumi-800 shadow-sm"
                : "bg-white/80 text-sumi-500 border-cream-300"
              }`}
          >
            All Cities
          </button>
          {cities.map((cp) => {
            const isActive = activeCity === cp.city || activeCity === cp.key;
            const colors = getCityColor(cp.city);
            return (
              <button
                key={cp.city}
                onClick={() => onCityChange && onCityChange(cp.city)}
                className="flex-shrink-0 px-2.5 py-1 rounded-full text-[10px] font-display font-semibold transition-all duration-150 border min-h-[28px] shadow-sm"
                style={{
                  backgroundColor: isActive ? colors.bg : "rgba(255,255,255,0.8)",
                  color: isActive ? colors.text : "#78716C",
                  borderColor: isActive ? colors.border : "#E7E5E4",
                }}
              >
                {cp.city}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};

const MapComponent = ({ selectedDay, onSelectDay, selectedLocation, onOpenDetail, activeFilter, activeCity, onFilterChange, onCityChange, macroSignal }) => {
  const mapRef = useRef(null);
  const [hoveredDay, setHoveredDay] = useState(null);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [activePopupDay, setActivePopupDay] = useState(null);

  /* ─── Fly to selected day (city-level zoom ~11) ─── */
  useEffect(() => {
    if (selectedDay !== null && mapRef.current && !selectedLocation) {
      const dayData = tripData.find((d) => d.day === selectedDay);
      if (dayData) {
        mapRef.current.flyTo({
          center: [dayData.coordinates.lng, dayData.coordinates.lat],
          zoom: 12,
          duration: 1600,
          essential: true,
        });
        setActivePopupDay(selectedDay);
      }
    }
  }, [selectedDay, selectedLocation]);

  /* ─── Dynamic Map Focus: fit bounds to active filter results ─── */
  /* ══════════════════════════════════════════════
     Filter-driven auto-zoom (Bird's-Eye Fit Bounds)
     Runs whenever a Category OR City filter changes.
       • 1 marker   → flyTo zoom 16 (close-up)
       • ≥2 markers → fitBounds with 50px padding
                      (extra top padding on mobile to
                       clear the floating filter overlay)
     ══════════════════════════════════════════════ */
  useEffect(() => {
    if (!mapLoaded || !mapRef.current) return;
    // No active filter at all → let user navigate freely.
    if (!activeFilter && !activeCity) return;

    /* Map-Locking rule (mobile-first sprint):
       When the user activates a CATEGORY filter (food/attractions/
       shopping/hotels), the side pane switches to a city-grouped
       browse view. The map stays at the user's current viewport so
       they can compare list and map without losing context. We
       still allow the city-only flyTo below to run, since picking
       a city is a clear "take me there" gesture. */
    if (activeFilter) return;

    const coords = collectFilteredCoords(activeFilter, activeCity);
    if (coords.length === 0) return;

    if (coords.length === 1) {
      mapRef.current.flyTo({
        center: coords[0],
        zoom: 16,
        duration: 1200,
        essential: true,
      });
      return;
    }

    // City-only selection (no category) → cinematic flyTo to a
    // hand-picked city anchor (CITY_CENTERS). Falls back to centroid
    // if the city isn't in the map (forward-compat for new cities).
    if (activeCity && !activeFilter) {
      const baseCityKey = activeCity.split("#")[0];
      const anchor = CITY_CENTERS[baseCityKey];
      if (anchor) {
        mapRef.current.flyTo({
          center: [anchor.lng, anchor.lat],
          zoom: anchor.zoom,
          duration: 1500,
          essential: true,
        });
      } else {
        const avgLng = coords.reduce((s, c) => s + c[0], 0) / coords.length;
        const avgLat = coords.reduce((s, c) => s + c[1], 0) / coords.length;
        mapRef.current.flyTo({
          center: [avgLng, avgLat],
          zoom: 12.5,
          duration: 1500,
          essential: true,
        });
      }
      return;
    }

    let minLng = coords[0][0], maxLng = coords[0][0];
    let minLat = coords[0][1], maxLat = coords[0][1];
    coords.forEach(([lng, lat]) => {
      if (lng < minLng) minLng = lng;
      if (lng > maxLng) maxLng = lng;
      if (lat < minLat) minLat = lat;
      if (lat > maxLat) maxLat = lat;
    });

    // On mobile the floating filter bar occupies ~80px at top, so inflate
    // top padding so markers don't hide underneath it.
    const isMobile = typeof window !== "undefined" && window.innerWidth < 1024;
    const padding = isMobile
      ? { top: 110, bottom: 50, left: 50, right: 50 }
      : 50;

    mapRef.current.fitBounds(
      [[minLng, minLat], [maxLng, maxLat]],
      { padding, duration: 1400, maxZoom: 14, essential: true }
    );
  }, [activeFilter, activeCity, mapLoaded]);

  /* ─── Macro view trigger (from ExploreView "Whole Trip" button) ───
        Parent increments macroSignal → we fitBounds across all 31
        days' coordinates so the user sees the full journey at once. */
  useEffect(() => {
    if (!mapLoaded || !mapRef.current || !macroSignal) return;
    let minLng = Infinity, maxLng = -Infinity, minLat = Infinity, maxLat = -Infinity;
    tripData.forEach((d) => {
      if (!d.coordinates) return;
      const { lng, lat } = d.coordinates;
      if (lng < minLng) minLng = lng;
      if (lng > maxLng) maxLng = lng;
      if (lat < minLat) minLat = lat;
      if (lat > maxLat) maxLat = lat;
    });
    if (minLng === Infinity) return;
    const isMobile = typeof window !== "undefined" && window.innerWidth < 1024;
    const padding = isMobile
      ? { top: 80, bottom: 130, left: 40, right: 40 }
      : 80;
    mapRef.current.fitBounds(
      [[minLng, minLat], [maxLng, maxLat]],
      { padding, duration: 1800, maxZoom: 7, essential: true }
    );
  }, [macroSignal, mapLoaded]);

  /* ─── Category-emoji markers (filter mode) ───
     When a category filter is active we replace the default day pins
     with emoji markers that show ONLY items matching the active filter
     (food / attractions / shopping / hotels). Each marker carries the
     same payload shape as a sub-location so the existing popup just
     works. Hotels are deduped by name so the same lodging doesn't
     appear N times across N consecutive nights.
     ────────────────────────────────────────── */
  const categoryMarkers = useMemo(() => {
    if (!activeFilter) return [];
    const baseCityKey = activeCity ? activeCity.split("#")[0] : null;
    // Item-level city resolution so an attraction/meal can claim a
    // different city than the day's hotel (Day 9 sleeps Nagoya but
    // the morning was Matsumoto, etc.). Hotels never override.
    const itemCityMatches = (item, day) =>
      !baseCityKey || normalizeCityKey(item?.city || day.city) === baseCityKey;
    const hotelCityMatches = (day) =>
      !baseCityKey || normalizeCityKey(day.city) === baseCityKey;

    const items = [];
    tripData.forEach((day) => {
      if (activeFilter === "food") {
        /* Scan the FULL attractions[] (the chronological order
           list) and emit one marker per food-keyword match. Then
           append any legacy lunch/dinner slots that aren't already
           represented by an attraction with the same name. */
        const seenNames = new Set();
        (day.attractions || []).forEach((a, i) => {
          if (a.coordinates && isFoodName(a) && itemCityMatches(a, day)) {
            seenNames.add(a.name);
            items.push({
              key:    `${day.day}-fa-${i}`,
              day:    day.day,
              type:   "food",
              emoji:  "🍜",
              lng:    a.coordinates.lng,
              lat:    a.coordinates.lat,
              name:   a.name,
              nameJa: a.nameJa,
              nameHe: a.nameHe,
              desc:   a.desc,
              rating: a.rating,
              link:   a.link,
            });
          }
        });
        ["lunch", "dinner"].forEach((m) => {
          const meal = day[m];
          if (meal && meal.place && meal.place !== "—" && meal.coordinates &&
              !seenNames.has(meal.place) && itemCityMatches(meal, day)) {
            items.push({
              key:    `${day.day}-${m}`,
              day:    day.day,
              type:   m,
              emoji:  "🍜",
              lng:    meal.coordinates.lng,
              lat:    meal.coordinates.lat,
              name:   meal.place,
              nameJa: meal.nameJa,
              nameHe: meal.nameHe,
              desc:   meal.desc,
              rating: meal.rating,
              link:   meal.link,
            });
          }
        });
      } else if (activeFilter === "attractions") {
        (day.attractions || []).forEach((a, i) => {
          if (a.coordinates && !isShoppingName(a.name) && !isFoodName(a) && itemCityMatches(a, day)) {
            items.push({
              key: `${day.day}-a-${i}`,
              day: day.day,
              type: "attraction",
              emoji: "⛩️",
              lng: a.coordinates.lng,
              lat: a.coordinates.lat,
              name: a.name,
              nameJa: a.nameJa,
              nameHe: a.nameHe,
              desc: a.desc,
              link: a.link,
            });
          }
        });
      } else if (activeFilter === "shopping") {
        (day.attractions || []).forEach((a, i) => {
          if (a.coordinates && isShoppingName(a.name) && itemCityMatches(a, day)) {
            items.push({
              key: `${day.day}-s-${i}`,
              day: day.day,
              type: "shopping",
              emoji: "🛍️",
              lng: a.coordinates.lng,
              lat: a.coordinates.lat,
              name: a.name,
              nameJa: a.nameJa,
              nameHe: a.nameHe,
              desc: a.desc,
              link: a.link,
            });
          }
        });
      } else if (activeFilter === "hotels") {
        if (day.hotel && day.hotel !== "—" && hotelCityMatches(day)) {
          const h = HOTEL_COORDINATES[day.hotel] || day.coordinates;
          if (h) {
            items.push({
              key: `${day.day}-h`,
              day: day.day,
              type: "hotel",
              emoji: "🏨",
              lng: h.lng,
              lat: h.lat,
              name: day.hotel,
              hotel: day.hotel,
              link: day.hotelLink,
            });
          }
        }
      }
    });

    // Dedupe hotels (same lodging across consecutive nights → one pin)
    if (activeFilter === "hotels") {
      const seen = new Set();
      return items.filter((it) => {
        if (seen.has(it.name)) return false;
        seen.add(it.name);
        return true;
      });
    }
    return items;
  }, [activeFilter, activeCity]);

  /* ─── GeoJSON: Main route polyline (city-to-city) ─── */
  const routeGeoJSON = useMemo(
    () => ({
      type: "Feature",
      properties: {},
      geometry: {
        type: "LineString",
        coordinates: routePath.map((r) => r.coordinates),
      },
    }),
    []
  );

  /* ─── GeoJSON: Day-to-day dashed path ─── */
  const dayPathGeoJSON = useMemo(
    () => ({
      type: "Feature",
      properties: {},
      geometry: {
        type: "LineString",
        coordinates: tripData.map((d) => [d.coordinates.lng, d.coordinates.lat]),
      },
    }),
    []
  );

  /* ─── GeoJSON: Intra-day dashed path (when day selected) ─── */
  const intraDayPathGeoJSON = useMemo(() => {
    if (!selectedDay) return null;
    const dayData = tripData.find((d) => d.day === selectedDay);
    if (!dayData) return null;

    const coords = [];
    // Collect all location coordinates from this day in order
    if (dayData.attractions) {
      dayData.attractions.forEach((a) => {
        if (a.coordinates) coords.push([a.coordinates.lng, a.coordinates.lat]);
      });
    }
    if (dayData.lunch?.coordinates) {
      coords.push([dayData.lunch.coordinates.lng, dayData.lunch.coordinates.lat]);
    }
    if (dayData.dinner?.coordinates) {
      coords.push([dayData.dinner.coordinates.lng, dayData.dinner.coordinates.lat]);
    }

    if (coords.length < 2) return null;

    return {
      type: "Feature",
      properties: {},
      geometry: { type: "LineString", coordinates: coords },
    };
  }, [selectedDay]);

  /* ─── All sub-location markers for selected day ─── */
  const subLocations = useMemo(() => {
    if (!selectedDay) return [];
    const dayData = tripData.find((d) => d.day === selectedDay);
    if (!dayData) return [];

    const locs = [];
    if (dayData.attractions) {
      dayData.attractions.forEach((a) => {
        if (a.coordinates) {
          locs.push({
            name: a.name,
            nameJa: a.nameJa,
            nameHe: a.nameHe,
            desc: a.desc,
            type: "attraction",
            lng: a.coordinates.lng,
            lat: a.coordinates.lat,
          });
        }
      });
    }
    if (dayData.lunch?.coordinates && dayData.lunch.place !== "—") {
      locs.push({
        name: dayData.lunch.place,
        nameJa: dayData.lunch.nameJa,
        nameHe: dayData.lunch.nameHe,
        desc: dayData.lunch.desc,
        rating: dayData.lunch.rating,
        type: "lunch",
        lng: dayData.lunch.coordinates.lng,
        lat: dayData.lunch.coordinates.lat,
      });
    }
    if (dayData.dinner?.coordinates && dayData.dinner.place !== "—") {
      locs.push({
        name: dayData.dinner.place,
        nameJa: dayData.dinner.nameJa,
        nameHe: dayData.dinner.nameHe,
        desc: dayData.dinner.desc,
        rating: dayData.dinner.rating,
        type: "dinner",
        lng: dayData.dinner.coordinates.lng,
        lat: dayData.dinner.coordinates.lat,
      });
    }
    return locs;
  }, [selectedDay]);

  /* ─── Popup state — pinned (click) takes precedence over hovered ─── */
  const [hoveredSubLoc, setHoveredSubLoc] = useState(null);
  const [pinnedSubLoc, setPinnedSubLoc] = useState(null);
  const activeSubLoc = pinnedSubLoc || hoveredSubLoc;

  /* ─── Fly to specific sub-location (zoom ~15) + open info window.
        If the caller passes `focusOnly: true` on the selection payload
        (used by the Accommodation chip in DayCard), we run ONLY the
        flyTo and skip popup creation — navigation decoupled from popup. ─── */
  useEffect(() => {
    if (selectedLocation && mapRef.current) {
      // Extra top padding keeps the popup fully visible — without it,
      // the marker sits at the geometric centre and the popup (which
      // anchors to the bottom of the marker and grows upward) gets
      // clipped by the top edge of the map.
      mapRef.current.flyTo({
        center: [selectedLocation.lng, selectedLocation.lat],
        zoom: 16,
        padding: getPopupPadding(),
        duration: 1400,
        essential: true,
      });
      if (selectedLocation.focusOnly) {
        return; // focus-only: no pinned popup, no state change on popups
      }
      // Find matching sub-location data to show rich popup
      const match = subLocations.find(
        (loc) => Math.abs(loc.lng - selectedLocation.lng) < 0.0005 && Math.abs(loc.lat - selectedLocation.lat) < 0.0005
      );
      if (match) {
        setPinnedSubLoc(match);
      } else {
        // Show a basic popup with the location name
        setPinnedSubLoc({
          name: selectedLocation.name || "Location",
          lng: selectedLocation.lng,
          lat: selectedLocation.lat,
          type: "attraction",
        });
      }
      setActivePopupDay(null);
    }
  }, [selectedLocation, subLocations]);

  const handleMarkerClick = useCallback(
    (day) => {
      onSelectDay(day);
      setActivePopupDay(day);
      setPinnedSubLoc(null);
      setHoveredSubLoc(null);
    },
    [onSelectDay]
  );

  const popupData = activePopupDay
    ? tripData.find((d) => d.day === activePopupDay)
    : null;

  return (
    <div className="w-full h-full relative">
      <Map
        ref={mapRef}
        initialViewState={{
          longitude: 136.5,
          latitude: 35.3,
          zoom: 5.2,
        }}
        style={{ width: "100%", height: "100%" }}
        mapStyle={MAP_STYLE}
        attributionControl={false}
        onLoad={() => setMapLoaded(true)}
        onClick={() => {
          setActivePopupDay(null);
          setHoveredSubLoc(null);
          setPinnedSubLoc(null);
        }}
      >
        <NavigationControl position="top-left" showCompass={false} />

        {mapLoaded && (
          <>
            {/* ─── Global routes — visible only when NO day is selected.
                  Once the user picks a day we drop into "Isolation Mode":
                  the city-to-city polyline and the day-to-day dashed
                  trail are both hidden so the only line on the map is
                  the intra-day path connecting that day's stops. */}
            {!selectedDay && (
              <>
                {/* Day-to-day dashed path */}
                <Source id="day-path" type="geojson" data={dayPathGeoJSON}>
                  <Layer
                    id="day-path-line"
                    type="line"
                    paint={{
                      "line-color": "#DED4BA",
                      "line-width": 1.5,
                      "line-dasharray": [4, 4],
                      "line-opacity": 0.6,
                    }}
                  />
                </Source>

                {/* Main route: solid vermillion line */}
                <Source id="route" type="geojson" data={routeGeoJSON}>
                  <Layer
                    id="route-line"
                    type="line"
                    paint={{
                      "line-color": "#D94025",
                      "line-width": 3,
                      "line-opacity": 0.8,
                    }}
                    layout={{
                      "line-cap": "round",
                      "line-join": "round",
                    }}
                  />
                </Source>
              </>
            )}

            {/* ─── Intra-day dashed path — only renders when a day is
                  selected, by virtue of the underlying memo returning
                  null otherwise. ─── */}
            {intraDayPathGeoJSON && (
              <Source id="intra-day-path" type="geojson" data={intraDayPathGeoJSON}>
                <Layer
                  id="intra-day-path-line"
                  type="line"
                  paint={{
                    "line-color": "#D94025",
                    "line-width": 2.2,
                    "line-dasharray": [2, 3],
                    "line-opacity": 0.7,
                  }}
                  layout={{
                    "line-cap": "round",
                    "line-join": "round",
                  }}
                />
              </Source>
            )}
          </>
        )}

        {/* ─── Day markers (clean dots) ───
              Visibility rules (per spec):
                • category filter active → hidden (emoji markers
                  below take over)
                • a single day is selected → hide ALL 30 other day
                  pins. Sub-location markers for that day take over.
                • otherwise → render all 31 dots (macro view).
              The map effectively "filters by day" automatically once
              the user picks a day from any source. */}
        {!activeFilter && tripData
          .filter((d) => !selectedDay || selectedDay === d.day)
          .map((d) => {
            const isSelected = selectedDay === d.day;
            const isHovered = hoveredDay === d.day;
            const colors = getCityColor(d.city);

            /* When a day is selected we already render rich sub-location
               markers + the map flyTo'd in close — the day pin itself
               can be hidden so it doesn't clutter the close view. */
            if (isSelected) return null;

            return (
              <Marker
                key={d.day}
                longitude={d.coordinates.lng}
                latitude={d.coordinates.lat}
                anchor="center"
                onClick={(e) => {
                  e.originalEvent.stopPropagation();
                  handleMarkerClick(d.day);
                }}
              >
                <div
                  className="cursor-pointer relative"
                  onMouseEnter={() => setHoveredDay(d.day)}
                  onMouseLeave={() => setHoveredDay(null)}
                  style={{
                    transition: "transform 0.25s ease",
                    transform: isHovered ? "scale(1.2)" : "scale(1)",
                    zIndex: isHovered ? 50 : 1,
                  }}
                >
                  <DayMarkerSVG
                    colors={colors}
                    isSelected={false}
                    isHovered={isHovered}
                  />
                </div>
              </Marker>
            );
          })}

        {/* ─── Category-emoji markers (filter mode) ───
              Replace the heavier day pins with an emoji-on-cream chip
              for every item that matches the active filter. Click =
              same flow as a sub-location click: pin popup + flyTo
              with extra top padding so the popup stays fully visible. */}
        {categoryMarkers.map((item) => {
          const isPinned = pinnedSubLoc && pinnedSubLoc.lng === item.lng && pinnedSubLoc.lat === item.lat;
          return (
            <Marker
              key={`cat-${item.key}`}
              longitude={item.lng}
              latitude={item.lat}
              anchor="bottom"
              onClick={(e) => {
                e.originalEvent.stopPropagation();
                setActivePopupDay(null);
                setHoveredSubLoc(null);
                setPinnedSubLoc(item);
                if (mapRef.current) {
                  mapRef.current.flyTo({
                    center: [item.lng, item.lat],
                    zoom: 15.5,
                    padding: getPopupPadding(),
                    duration: 900,
                    essential: true,
                  });
                }
              }}
            >
              <div
                className="cursor-pointer flex flex-col items-center"
                style={{
                  transform: isPinned ? "scale(1.18)" : "scale(1)",
                  transition: "transform 200ms ease",
                  filter: isPinned ? "drop-shadow(0 4px 8px rgba(217,64,37,0.4))" : "drop-shadow(0 2px 4px rgba(0,0,0,0.18))",
                }}
              >
                <div
                  style={{
                    width: 34,
                    height: 34,
                    borderRadius: "50%",
                    backgroundColor: "#FDFBF5",
                    border: `2px solid ${isPinned ? "#D94025" : "#E7DFCF"}`,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 18,
                    lineHeight: 1,
                  }}
                >
                  <span role="img" aria-label={item.type}>{item.emoji}</span>
                </div>
                {/* Tail */}
                <div
                  style={{
                    width: 0,
                    height: 0,
                    borderLeft: "5px solid transparent",
                    borderRight: "5px solid transparent",
                    borderTop: `7px solid ${isPinned ? "#D94025" : "#E7DFCF"}`,
                    marginTop: -1,
                  }}
                />
              </div>
            </Marker>
          );
        })}

        {/* ─── Sub-location markers (when a day is expanded) ─── */}
        {subLocations.map((loc, idx) => {
          const isPinned = pinnedSubLoc && Math.abs(pinnedSubLoc.lng - loc.lng) < 0.0001 && Math.abs(pinnedSubLoc.lat - loc.lat) < 0.0001;
          return (
            <Marker
              key={`sub-${idx}`}
              longitude={loc.lng}
              latitude={loc.lat}
              anchor="center"
              onClick={(e) => {
                e.originalEvent.stopPropagation();
                setPinnedSubLoc(loc);
                setHoveredSubLoc(null);
                if (mapRef.current) {
                  mapRef.current.flyTo({
                    center: [loc.lng, loc.lat],
                    zoom: 16,
                    padding: getPopupPadding(),
                    duration: 900,
                    essential: true,
                  });
                }
              }}
            >
              <div
                className="cursor-pointer"
                onMouseEnter={() => { if (!pinnedSubLoc) setHoveredSubLoc(loc); }}
                onMouseLeave={() => { if (!pinnedSubLoc) setHoveredSubLoc(null); }}
                style={{
                  transition: "transform 0.2s ease",
                  transform: isPinned ? "scale(1.5)" : (selectedLocation && Math.abs(loc.lng - selectedLocation.lng) < 0.0001) ? "scale(1.4)" : "scale(1)",
                }}
              >
                <SubLocationMarker />
              </div>
            </Marker>
          );
        })}

        {/* ─── Selected sub-location marker (pulsing) ─── */}
        {selectedLocation && (
          <Marker
            longitude={selectedLocation.lng}
            latitude={selectedLocation.lat}
            anchor="center"
          >
            <div className="relative">
              <div
                style={{
                  position: "absolute",
                  inset: "-8px",
                  borderRadius: "50%",
                  backgroundColor: "#D94025",
                  opacity: 0.3,
                  animation: "ping 1.5s cubic-bezier(0,0,0.2,1) infinite",
                }}
              />
              <svg width="26" height="26" viewBox="0 0 26 26" fill="none">
                <circle cx="13" cy="13" r="10" fill="#D94025" stroke="#FDFBF5" strokeWidth="3" />
                <circle cx="13" cy="13" r="4" fill="#FDFBF5" />
              </svg>
            </div>
          </Marker>
        )}

        {/* Day-overview popup intentionally removed:
            the bullet-list of every stop in the day duplicated the
            Trip Roadmap panel and crowded the map. We keep individual
            sub-location popups only (rendered below). The day-pin
            click still toggles selectedDay + activePopupDay state so
            the timeline panel scrolls into view, but no overlay UI is
            rendered for the day itself. */}

        {/* ─── Info card popup: Sub-location (click-persistent when pinned) ─── */}
        {activeSubLoc && (
          <Popup
            longitude={activeSubLoc.lng}
            latitude={activeSubLoc.lat}
            anchor="bottom"
            closeButton={!!pinnedSubLoc}
            closeOnClick={false}
            offset={16}
            maxWidth="300px"
            onClose={() => { setPinnedSubLoc(null); setHoveredSubLoc(null); }}
          >
            <SubLocationInfoCard
              loc={activeSubLoc}
              onOpenFullDetail={(l) => {
                if (onOpenDetail) {
                  onOpenDetail({
                    name: l.name,
                    nameJa: l.nameJa || "",
                    nameHe: l.nameHe || "",
                    desc: l.desc || "",
                    day: selectedDay || null,
                    city: "",
                    cityHe: "",
                    category: l.type || "attraction",
                    rating: l.rating || null,
                    coordinates: l.lng && l.lat ? { lng: l.lng, lat: l.lat } : null,
                  });
                }
              }}
            />
          </Popup>
        )}
      </Map>

      {/* Legacy <MobileMapFilters/> removed — the BottomSheet's
          BottomFilterBar (rendered by ExploreView) is now the single
          mobile filter UI. The component definition above is kept
          as dead code so the previous behaviour can be restored
          by re-mounting it here. */}

      {/* ═══ Map overlay — Trip title (top-right, desktop only) ═══ */}
      <div className="hidden lg:block absolute top-4 right-4 bg-cream-50/95 backdrop-blur-sm rounded-lg px-2.5 py-2 sm:px-4 sm:py-3 shadow-lg border-2 border-vermillion-500/20">
        <div className="flex items-center gap-2.5">
          {/* JP N Logo */}
          <div
            style={{
              width: "28px",
              height: "28px",
              border: "2px solid #1C1917",
              borderRadius: "4px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <span
              style={{
                fontSize: "7px",
                fontWeight: 900,
                fontFamily: "inherit",
                color: "#1C1917",
                lineHeight: 1,
                textAlign: "center",
                letterSpacing: "-0.5px",
              }}
            >
              JP<br/>N
            </span>
          </div>
          <div>
            <h2
              style={{
                fontSize: "13px",
                fontWeight: 800,
                fontFamily: "inherit",
                color: "#1C1917",
                margin: 0,
                letterSpacing: "-0.3px",
              }}
            >
              Japan Honeymoon
            </h2>
            <p
              style={{
                fontSize: "9px",
                color: "#78716C",
                margin: "1px 0 0",
                fontFamily: "inherit",
              }}
            >
              31 Days • 9 Cities • 日本旅行
            </p>
          </div>
        </div>
      </div>

      {/* ═══ Legend (bottom-right) — desktop only so it never
              overlaps the mobile BottomSheet at peek (110px tall). ═══ */}
      <div className="hidden lg:block absolute bottom-6 right-4 bg-cream-50/95 backdrop-blur-sm rounded-lg px-3 py-2.5 shadow-lg border border-cream-300">
        <div style={{ display: "flex", flexDirection: "column", gap: "5px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <div style={{ width: "20px", height: "3px", backgroundColor: "#D94025", borderRadius: "2px" }} />
            <span style={{ fontSize: "9px", color: "#57534E", fontFamily: "inherit", fontWeight: 600 }}>
              Travel Route
            </span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <div style={{ width: "20px", height: "0", borderTop: "2px dashed #DED4BA" }} />
            <span style={{ fontSize: "9px", color: "#57534E", fontFamily: "inherit", fontWeight: 600 }}>
              Daily Path
            </span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <div style={{ width: "20px", height: "0", borderTop: "2px dashed #D94025", opacity: 0.5 }} />
            <span style={{ fontSize: "9px", color: "#57534E", fontFamily: "inherit", fontWeight: 600 }}>
              In-Day Route
            </span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <svg width="14" height="14" viewBox="0 0 20 20" fill="none">
              <circle cx="10" cy="10" r="6" fill="#D94025" stroke="#FDFBF5" strokeWidth="2" />
              <circle cx="10" cy="10" r="2.5" fill="#FDFBF5" />
            </svg>
            <span style={{ fontSize: "9px", color: "#57534E", fontFamily: "inherit", fontWeight: 600 }}>
              Location
            </span>
          </div>
        </div>
      </div>

      {/* ═══ City color legend (bottom-left) ═══ */}
      <div className="absolute bottom-6 left-12 bg-cream-50/95 backdrop-blur-sm rounded-lg px-3 py-2.5 shadow-lg border border-cream-300 hidden lg:block">
        <p style={{ fontSize: "8px", fontWeight: 700, color: "#78716C", fontFamily: "inherit", textTransform: "uppercase", letterSpacing: "1px", marginBottom: "4px" }}>
          Cities
        </p>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "3px", maxWidth: "180px" }}>
          {Object.entries(CITY_COLORS)
            .filter(([city]) => !city.includes("Disney") && !city.includes("Universal") && city !== "Tokyo DisneySea")
            .map(([city, c]) => (
              <div
                key={city}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "3px",
                  padding: "1px 5px",
                  borderRadius: "8px",
                  backgroundColor: c.light,
                  border: `1px solid ${c.bg}30`,
                }}
              >
                <div style={{ width: "6px", height: "6px", borderRadius: "50%", backgroundColor: c.bg }} />
                <span style={{ fontSize: "8px", color: "#57534E", fontFamily: "inherit", fontWeight: 600 }}>
                  {city}
                </span>
              </div>
            ))}
        </div>
      </div>
    </div>
  );
};

/* ══════════════════════════════════════════════
   INFO CARD: Day overview popup
   Cream bg, vermillion border, clean typography
   ══════════════════════════════════════════════ */
/* Pick activity icon for popup attractions */
const getPopupIcon = (name) => {
  const n = name.toLowerCase();
  if (n.includes("shrine") || n.includes("temple") || n.includes("inari") || n.includes("pagoda")) return ActivityIcons.shrine;
  if (n.includes("park") || n.includes("garden") || n.includes("bamboo")) return ActivityIcons.park;
  if (n.includes("coffee") || n.includes("café") || n.includes("cafe")) return ActivityIcons.coffee;
  if (n.includes("market") || n.includes("shopping") || n.includes("don quijote")) return ActivityIcons.shopping;
  if (n.includes("view") || n.includes("tower") || n.includes("crossing")) return ActivityIcons.viewpoint;
  if (n.includes("ramen") || n.includes("food") || n.includes("sushi")) return ActivityIcons.food;
  return ActivityIcons.walk;
};

const DayInfoCard = ({ data, onSelectBullet }) => {
  const colors = getCityColor(data.city);
  const cityBase = data.city.replace(/ \d+$/, "");
  const illustrationKey = cityToHeroIllustration[cityBase] || cityToHeroIllustration[data.city] || "Tokyo";
  const Illustration = CityIllustrations[illustrationKey];

  // Each bullet routes to a single handler → map flyTo + sidebar scroll/highlight
  const Bullet = ({ children, onClick }) => (
    <button
      type="button"
      onClick={(e) => { e.stopPropagation(); onClick && onClick(); }}
      style={{
        all: "unset",
        display: "flex", alignItems: "center", gap: "7px",
        padding: "4px 6px", marginBottom: "3px",
        borderRadius: "6px",
        cursor: onClick ? "pointer" : "default",
        transition: "background-color 120ms ease",
        width: "100%", boxSizing: "border-box",
      }}
      onMouseEnter={(e) => { if (onClick) e.currentTarget.style.backgroundColor = "#FEF0EE"; }}
      onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = "transparent"; }}
    >
      {children}
    </button>
  );

  return (
    <div style={{ fontFamily: "inherit", overflow: "hidden", borderRadius: "10px", maxWidth: "280px" }}>
      {/* Line-art hero header */}
      <div style={{ width: "100%", height: "70px", overflow: "hidden", position: "relative", backgroundColor: "#FAF8F3" }}>
        <div style={{ position: "absolute", right: "4px", top: "50%", transform: "translateY(-50%)", opacity: 0.3 }}>
          {Illustration && <Illustration w={120} h={70} />}
        </div>
        <div style={{ position: "absolute", bottom: "6px", left: "10px", display: "flex", alignItems: "center", gap: "6px" }}>
          <div style={{
            width: "24px", height: "24px", borderRadius: "4px", backgroundColor: colors.bg,
            display: "flex", alignItems: "center", justifyContent: "center",
            color: colors.text, fontSize: "10px", fontWeight: 800, fontFamily: "inherit",
            border: "1.5px solid " + colors.border,
          }}>
            {data.day}
          </div>
          <div>
            <p style={{ fontWeight: 700, fontSize: "12px", color: "#1C1917", margin: 0, fontFamily: "inherit" }}>
              {data.city}
            </p>
            <p style={{ fontSize: "9px", color: "#78716C", margin: 0 }} dir="rtl">
              {data.cityHe}
            </p>
          </div>
        </div>
      </div>

      {/* Content — interactive bullets */}
      <div style={{ padding: "8px 10px" }}>
        {/* Attractions with line-art icons */}
        {data.attractions && data.attractions.slice(0, 5).map((a, i) => {
          const Icon = getPopupIcon(a.name);
          const canClick = !!(a.coordinates && onSelectBullet);
          return (
            <Bullet
              key={`a-${i}`}
              onClick={canClick ? () => onSelectBullet({
                name: a.name, nameJa: a.nameJa, nameHe: a.nameHe, desc: a.desc,
                type: "attraction",
                lng: a.coordinates.lng, lat: a.coordinates.lat,
                day: data.day,
              }) : null}
            >
              <div style={{
                width: "24px", height: "24px", borderRadius: "5px", border: "1px solid #EDE5D0",
                backgroundColor: "#FAF8F3", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
              }}>
                <Icon size={14} color={colors.bg} />
              </div>
              <div style={{ minWidth: 0, flex: 1 }}>
                <span style={{ fontSize: "11px", fontWeight: 600, color: "#292524", display: "block", lineHeight: 1.25 }}>{a.name}</span>
                {a.nameHe && <span style={{ fontSize: "9px", color: "#78716C", display: "block" }} dir="rtl">{a.nameHe}</span>}
              </div>
              {canClick && (
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#D94025" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, opacity: 0.6 }}>
                  <polyline points="9 18 15 12 9 6"/>
                </svg>
              )}
            </Bullet>
          );
        })}

        {/* Lunch + Dinner bullets */}
        {data.lunch?.place && data.lunch.place !== "—" && (
          <Bullet
            onClick={data.lunch.coordinates && onSelectBullet ? () => onSelectBullet({
              name: data.lunch.place, nameJa: data.lunch.nameJa, nameHe: data.lunch.nameHe,
              desc: data.lunch.desc, rating: data.lunch.rating, type: "lunch",
              lng: data.lunch.coordinates.lng, lat: data.lunch.coordinates.lat,
              day: data.day,
            }) : null}
          >
            <div style={{
              width: "24px", height: "24px", borderRadius: "5px", border: "1px solid #F5EDCE",
              backgroundColor: "#FBF8EE", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
            }}>
              <ActivityIcons.food size={13} color="#C4A048" />
            </div>
            <div style={{ minWidth: 0, flex: 1 }}>
              <span style={{ fontSize: "8px", fontWeight: 800, color: "#C4A048", textTransform: "uppercase", letterSpacing: "0.5px", fontFamily: "inherit" }}>Lunch 昼食</span>
              <span style={{ fontSize: "11px", fontWeight: 600, color: "#292524", display: "block", lineHeight: 1.25 }}>{data.lunch.place}</span>
            </div>
            {data.lunch.coordinates && onSelectBullet && (
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#C4A048" strokeWidth="2" strokeLinecap="round" style={{ flexShrink: 0, opacity: 0.7 }}>
                <polyline points="9 18 15 12 9 6"/>
              </svg>
            )}
          </Bullet>
        )}
        {data.dinner?.place && data.dinner.place !== "—" && (
          <Bullet
            onClick={data.dinner.coordinates && onSelectBullet ? () => onSelectBullet({
              name: data.dinner.place, nameJa: data.dinner.nameJa, nameHe: data.dinner.nameHe,
              desc: data.dinner.desc, rating: data.dinner.rating, type: "dinner",
              lng: data.dinner.coordinates.lng, lat: data.dinner.coordinates.lat,
              day: data.day,
            }) : null}
          >
            <div style={{
              width: "24px", height: "24px", borderRadius: "5px", border: "1px solid #FDDCD8",
              backgroundColor: "#FEF0EE", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
            }}>
              <ActivityIcons.food size={13} color="#D94025" />
            </div>
            <div style={{ minWidth: 0, flex: 1 }}>
              <span style={{ fontSize: "8px", fontWeight: 800, color: "#D94025", textTransform: "uppercase", letterSpacing: "0.5px", fontFamily: "inherit" }}>Dinner 夕食</span>
              <span style={{ fontSize: "11px", fontWeight: 600, color: "#292524", display: "block", lineHeight: 1.25 }}>{data.dinner.place}</span>
            </div>
            {data.dinner.coordinates && onSelectBullet && (
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#D94025" strokeWidth="2" strokeLinecap="round" style={{ flexShrink: 0, opacity: 0.7 }}>
                <polyline points="9 18 15 12 9 6"/>
              </svg>
            )}
          </Bullet>
        )}

        {/* ── Hotel row — quick view of the day's lodging.
              Click flies to the canonical hotel pin (or day-centre fallback). */}
        {data.hotel && data.hotel !== "—" && (
          <Bullet
            onClick={onSelectBullet ? () => {
              const h = HOTEL_COORDINATES[data.hotel] || data.coordinates;
              onSelectBullet({
                name: data.hotel,
                type: "hotel",
                lng: h.lng,
                lat: h.lat,
                day: data.day,
              });
            } : null}
          >
            <div style={{
              width: "24px", height: "24px", borderRadius: "5px", border: "1px solid #DCE5D0",
              backgroundColor: "#F2F5ED", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
              fontSize: "13px",
            }}>
              🏨
            </div>
            <div style={{ minWidth: 0, flex: 1 }}>
              <span style={{ fontSize: "8px", fontWeight: 800, color: "#5C7A2E", textTransform: "uppercase", letterSpacing: "0.5px", fontFamily: "inherit" }}>Hotel ホテル</span>
              <span style={{ fontSize: "11px", fontWeight: 600, color: "#292524", display: "block", lineHeight: 1.25 }}>{data.hotel}</span>
            </div>
            {onSelectBullet && (
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#5C7A2E" strokeWidth="2" strokeLinecap="round" style={{ flexShrink: 0, opacity: 0.7 }}>
                <polyline points="9 18 15 12 9 6"/>
              </svg>
            )}
          </Bullet>
        )}
      </div>
    </div>
  );
};

/* ══════════════════════════════════════════════
   INFO CARD: Sub-location popup
   ══════════════════════════════════════════════ */
/* ─────────────────────────────────────────────────────────────
   UNIFIED LOCATION CARD — used by the map popup.
   Mirrors the DetailModal layout so the content and hierarchy
   match everywhere (sidebar "View Details" / sidebar image /
   map marker all surface the SAME card design).
   • Photo banner
   • Category + Rating
   • Trilingual name
   • Full Hebrew vibe description (NEVER truncated — scrolls if long)
   • Google Maps link
   ───────────────────────────────────────────────────────────── */
const SubLocationInfoCard = ({ loc, onOpenFullDetail }) => {
  /* Hebrew-only category labels — no Japanese kanji, no English. */
  const typeLabel = loc.type === "lunch" ? "צהריים"
                  : loc.type === "dinner" ? "ערב"
                  : loc.type === "hotel"  ? "מלון"
                  : "אטרקציה";
  const typeColor = loc.type === "lunch" ? "#C4A048"
                  : loc.type === "dinner" ? "#D94025"
                  : loc.type === "hotel"  ? "#5C7A2E"
                  : "#8F2818";
  const Icon = loc.type === "lunch" || loc.type === "dinner" ? ActivityIcons.food : getPopupIcon(loc.name);
  /* Description text is ALWAYS sourced from tripData.desc — the
     exact same field the list views render. vibeDescriptions[]
     is no longer used as a fallback so the map popup and the
     list panel show identical, de-duplicated text everywhere. */
  const vibe = loc.desc || "";
  const photo = getLocationPhoto(loc.name);

  return (
    <div
      dir="rtl"
      style={{
        fontFamily: "inherit",
        overflow: "hidden",
        borderRadius: "12px",
        width: "280px",
        maxHeight: "420px",
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* Photo banner — minimalist tag overlay (no big button-style UI). */}
      {photo && (
        <div
          style={{
            width: "100%", height: "120px", overflow: "hidden", position: "relative",
            flexShrink: 0, cursor: onOpenFullDetail ? "zoom-in" : "default",
          }}
          onClick={(e) => {
            if (!onOpenFullDetail) return;
            e.stopPropagation();
            onOpenFullDetail(loc);
          }}
        >
          <img
            src={photo}
            alt={loc.name}
            style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
            onError={(e) => { e.target.style.display = "none"; }}
          />
          <div style={{ position: "absolute", inset: 0, background: "linear-gradient(180deg, rgba(0,0,0,0) 65%, rgba(0,0,0,0.18) 100%)" }} />
          {/* Small minimalist tag (top-right, plain text + arrow) */}
          {onOpenFullDetail && (
            <div style={{
              position: "absolute", top: "8px", left: "8px",
              padding: "2px 6px", borderRadius: "4px",
              backgroundColor: "rgba(255,255,255,0.85)", color: "#1C1917",
              fontSize: "10px", fontWeight: 600, letterSpacing: "0.02em",
              display: "inline-flex", alignItems: "center", gap: "3px",
            }}>
              פרטים ↗
            </div>
          )}
        </div>
      )}

      {/* Scrollable content */}
      <div
        style={{
          padding: "11px 14px 14px",
          overflowY: "auto",
          flex: "1 1 auto",
          minHeight: 0,
        }}
      >
        {/* Title hierarchy now mirrors the Trip Roadmap card exactly:
            ENGLISH primary (LTR, 16px bold 700) + HEBREW small subtitle
            (11.5px, weight 500). Same colours and line-heights as
            StoryFlow's StopRow so the visual jump between list and
            popup is invisible. */}

        {/* Category tag — pill style matching StoryFlow tagHe */}
        <div style={{
          display: "inline-flex", alignItems: "center", gap: "5px",
          padding: "3px 10px", borderRadius: "14px",
          backgroundColor: `${typeColor}12`, border: `1px solid ${typeColor}30`,
          marginBottom: "8px",
        }}>
          <Icon size={11} color={typeColor} />
          <span style={{
            fontSize: "10px", fontWeight: 600, color: typeColor,
          }}>
            {typeLabel}
          </span>
        </div>

        {/* English name (PRIMARY) — matches StoryFlow's titleEn */}
        <p style={{
          fontSize: "16px", fontWeight: 700, color: "var(--ink)",
          margin: 0, lineHeight: 1.2,
          direction: "ltr", textAlign: "right", unicodeBidi: "plaintext",
        }}>
          {loc.name}
        </p>
        {/* Hebrew name (SECONDARY) — matches StoryFlow's titleHe */}
        {loc.nameHe && loc.nameHe !== loc.name && (
          <p style={{
            fontSize: "11.5px", color: "var(--ink-2)", margin: "2px 0 0",
            fontWeight: 500,
          }}>
            {loc.nameHe}
          </p>
        )}

        {/* Rating row — kept as a distinct pill since StoryFlow's
            inline rating sits inside the category tag, but the popup
            has space for a richer chip. Weights/sizes aligned. */}
        {loc.rating && loc.rating !== "—" && (
          <div style={{
            marginTop: "10px",
            display: "inline-flex", alignItems: "center", gap: "6px",
            padding: "3px 10px", borderRadius: "14px",
            backgroundColor: "#FBF8EE", border: "1px solid #F5EDCE",
          }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="#C4A048" stroke="#C4A048" strokeWidth="1.5">
              <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
            </svg>
            <span style={{ fontSize: "11px", fontWeight: 700, color: "#A08030" }}>
              דירוג {loc.rating}
            </span>
          </div>
        )}

        {/* Description — plain text on transparent background, same
            12.5px / 1.55 lineHeight / var(--ink-2) the Roadmap uses.
            The earlier tinted-box style created a visual divergence. */}
        {vibe && (
          <p
            style={{
              fontSize: "12.5px",
              color: "var(--ink-2)",
              margin: "10px 0 0",
              lineHeight: 1.55,
              textAlign: "right",
            }}
          >
            {vibe}
          </p>
        )}

        {/* Actions row */}
        <div style={{ display: "flex", gap: "8px", marginTop: "12px", flexWrap: "wrap" }}>
          {onOpenFullDetail && (
            <button
              onClick={(e) => { e.stopPropagation(); onOpenFullDetail(loc); }}
              style={{
                display: "inline-flex", alignItems: "center", gap: "5px",
                padding: "6px 11px", borderRadius: "8px",
                backgroundColor: "#FEF0EE", border: "1px solid #FDDCD8",
                color: "#B8331E", fontSize: "11px", fontWeight: 700,
                cursor: "pointer",
              }}
            >
              עוד פרטים
            </button>
          )}
          <a
            href={gmapsUrl(loc) /* loc has link/coords/name → curated URL when available */}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            style={{
              display: "inline-flex", alignItems: "center", gap: "5px",
              padding: "6px 11px", borderRadius: "8px",
              backgroundColor: "#FFFFFF", border: "1px solid #E7DFCF",
              color: "#44403C", fontSize: "11px", fontWeight: 700,
              textDecoration: "none",
            }}
          >
            <svg width="11" height="11" viewBox="0 0 24 24" fill="#4285F4"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5a2.5 2.5 0 1 1 0-5 2.5 2.5 0 0 1 0 5z"/></svg>
            Google Maps ↗
          </a>
        </div>
      </div>
    </div>
  );
};

export default MapComponent;
