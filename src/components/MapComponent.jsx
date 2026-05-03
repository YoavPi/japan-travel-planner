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
   CUSTOM SVG MARKER — Minimalist Torii-inspired pin
   ══════════════════════════════════════════════ */
const DayMarkerSVG = ({ day, colors, isSelected, isHovered }) => {
  const size = isSelected ? 42 : isHovered ? 38 : 34;
  return (
    <svg width={size} height={size + 10} viewBox="0 0 40 50" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* Drop shadow */}
      <ellipse cx="20" cy="47" rx="7" ry="2.5" fill="rgba(0,0,0,0.12)" />
      {/* Pin body */}
      <path
        d="M20 46 C20 46 36 30 36 18 C36 9.16 28.84 2 20 2 C11.16 2 4 9.16 4 18 C4 30 20 46 20 46Z"
        fill={colors.bg}
        stroke={isSelected ? "#FDFBF5" : colors.border}
        strokeWidth={isSelected ? "2.5" : "1.5"}
      />
      {/* Inner circle */}
      <circle cx="20" cy="18" r="11" fill="#FDFBF5" />
      {/* Day number */}
      <text
        x="20"
        y="22"
        textAnchor="middle"
        fontSize="12"
        fontWeight="800"
        fontFamily="Montserrat, sans-serif"
        fill={colors.bg}
      >
        {day}
      </text>
      {/* Torii gate accent on top */}
      {isSelected && (
        <>
          <line x1="14" y1="5" x2="26" y2="5" stroke="#FDFBF5" strokeWidth="1.5" strokeLinecap="round" />
          <line x1="16" y1="5" x2="16" y2="8" stroke="#FDFBF5" strokeWidth="1" />
          <line x1="24" y1="5" x2="24" y2="8" stroke="#FDFBF5" strokeWidth="1" />
        </>
      )}
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
/* ── Google Maps URL helper ── */
const gmapsUrl = (name) =>
  `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(name + " Japan")}`;

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
      ["lunch", "dinner"].forEach((m) => {
        const meal = day[m];
        if (meal && meal.place && meal.place !== "—" && meal.coordinates && cityMatchesItem(meal, day)) {
          coords.push([meal.coordinates.lng, meal.coordinates.lat]);
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
        if (!isShoppingName(a.name) && a.coordinates && cityMatchesItem(a, day)) {
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
        ["lunch", "dinner"].forEach((m) => {
          const meal = day[m];
          if (meal && meal.place && meal.place !== "—" && meal.coordinates && itemCityMatches(meal, day)) {
            items.push({
              key: `${day.day}-${m}`,
              day: day.day,
              type: m,
              emoji: "🍜",
              lng: meal.coordinates.lng,
              lat: meal.coordinates.lat,
              name: meal.place,
              nameJa: meal.nameJa,
              nameHe: meal.nameHe,
              desc: meal.desc,
              rating: meal.rating,
            });
          }
        });
      } else if (activeFilter === "attractions") {
        (day.attractions || []).forEach((a, i) => {
          if (a.coordinates && !isShoppingName(a.name) && itemCityMatches(a, day)) {
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
            {/* ─── Day-to-day dashed path ─── */}
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

            {/* ─── Main route: solid vermillion line ─── */}
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

            {/* ─── Intra-day dashed path (local movement) ─── */}
            {intraDayPathGeoJSON && (
              <Source id="intra-day-path" type="geojson" data={intraDayPathGeoJSON}>
                <Layer
                  id="intra-day-path-line"
                  type="line"
                  paint={{
                    "line-color": "#D94025",
                    "line-width": 2,
                    "line-dasharray": [2, 3],
                    "line-opacity": 0.5,
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

        {/* ─── Day markers (custom SVG) — hidden when a category filter is
              active because emoji markers (below) take over to keep the
              map readable. ─── */}
        {!activeFilter && tripData.map((d) => {
          const isSelected = selectedDay === d.day;
          const isHovered = hoveredDay === d.day;
          const colors = getCityColor(d.city);

          return (
            <Marker
              key={d.day}
              longitude={d.coordinates.lng}
              latitude={d.coordinates.lat}
              anchor="bottom"
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
                  transform: isSelected ? "scale(1.15)" : isHovered ? "scale(1.1)" : "scale(1)",
                  zIndex: isSelected ? 100 : isHovered ? 50 : 1,
                }}
              >
                {/* Pulse ring */}
                {isSelected && (
                  <div
                    style={{
                      position: "absolute",
                      left: "50%",
                      bottom: "12px",
                      transform: "translateX(-50%)",
                      width: "40px",
                      height: "40px",
                      borderRadius: "50%",
                      backgroundColor: colors.bg,
                      opacity: 0.3,
                      animation: "ping 1.5s cubic-bezier(0,0,0.2,1) infinite",
                    }}
                  />
                )}
                <DayMarkerSVG
                  day={d.day}
                  colors={colors}
                  isSelected={isSelected}
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

        {/* ─── Info card popup: Day overview ─── */}
        {popupData && !activeSubLoc && (
          <Popup
            longitude={popupData.coordinates.lng}
            latitude={popupData.coordinates.lat}
            anchor="bottom"
            closeButton={false}
            closeOnClick={false}
            offset={50}
            maxWidth="280px"
          >
            <DayInfoCard
              data={popupData}
              onSelectBullet={(bullet) => {
                // Fly map to the bullet location, then swap the day popup
                // for the unified sub-location info card (pinned).
                if (mapRef.current) {
                  mapRef.current.flyTo({
                    center: [bullet.lng, bullet.lat],
                    zoom: 16,
                    padding: getPopupPadding(),
                    duration: 1000,
                    essential: true,
                  });
                }
                setActivePopupDay(null);
                setHoveredSubLoc(null);
                setPinnedSubLoc(bullet);
              }}
            />
          </Popup>
        )}

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
                fontFamily: "Montserrat, sans-serif",
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
                fontFamily: "Montserrat, Noto Sans JP, sans-serif",
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
                fontFamily: "Noto Sans JP, sans-serif",
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
            <span style={{ fontSize: "9px", color: "#57534E", fontFamily: "Montserrat, sans-serif", fontWeight: 600 }}>
              Travel Route
            </span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <div style={{ width: "20px", height: "0", borderTop: "2px dashed #DED4BA" }} />
            <span style={{ fontSize: "9px", color: "#57534E", fontFamily: "Montserrat, sans-serif", fontWeight: 600 }}>
              Daily Path
            </span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <div style={{ width: "20px", height: "0", borderTop: "2px dashed #D94025", opacity: 0.5 }} />
            <span style={{ fontSize: "9px", color: "#57534E", fontFamily: "Montserrat, sans-serif", fontWeight: 600 }}>
              In-Day Route
            </span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <svg width="14" height="14" viewBox="0 0 20 20" fill="none">
              <circle cx="10" cy="10" r="6" fill="#D94025" stroke="#FDFBF5" strokeWidth="2" />
              <circle cx="10" cy="10" r="2.5" fill="#FDFBF5" />
            </svg>
            <span style={{ fontSize: "9px", color: "#57534E", fontFamily: "Montserrat, sans-serif", fontWeight: 600 }}>
              Location
            </span>
          </div>
        </div>
      </div>

      {/* ═══ City color legend (bottom-left) ═══ */}
      <div className="absolute bottom-6 left-12 bg-cream-50/95 backdrop-blur-sm rounded-lg px-3 py-2.5 shadow-lg border border-cream-300 hidden lg:block">
        <p style={{ fontSize: "8px", fontWeight: 700, color: "#78716C", fontFamily: "Montserrat", textTransform: "uppercase", letterSpacing: "1px", marginBottom: "4px" }}>
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
                <span style={{ fontSize: "8px", color: "#57534E", fontFamily: "Montserrat", fontWeight: 600 }}>
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
    <div style={{ fontFamily: "Noto Sans JP, sans-serif", overflow: "hidden", borderRadius: "10px", maxWidth: "280px" }}>
      {/* Line-art hero header */}
      <div style={{ width: "100%", height: "70px", overflow: "hidden", position: "relative", backgroundColor: "#FAF8F3" }}>
        <div style={{ position: "absolute", right: "4px", top: "50%", transform: "translateY(-50%)", opacity: 0.3 }}>
          {Illustration && <Illustration w={120} h={70} />}
        </div>
        <div style={{ position: "absolute", bottom: "6px", left: "10px", display: "flex", alignItems: "center", gap: "6px" }}>
          <div style={{
            width: "24px", height: "24px", borderRadius: "4px", backgroundColor: colors.bg,
            display: "flex", alignItems: "center", justifyContent: "center",
            color: colors.text, fontSize: "10px", fontWeight: 800, fontFamily: "Montserrat",
            border: "1.5px solid " + colors.border,
          }}>
            {data.day}
          </div>
          <div>
            <p style={{ fontWeight: 700, fontSize: "12px", color: "#1C1917", margin: 0, fontFamily: "Montserrat" }}>
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
              <span style={{ fontSize: "8px", fontWeight: 800, color: "#C4A048", textTransform: "uppercase", letterSpacing: "0.5px", fontFamily: "Montserrat" }}>Lunch 昼食</span>
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
              <span style={{ fontSize: "8px", fontWeight: 800, color: "#D94025", textTransform: "uppercase", letterSpacing: "0.5px", fontFamily: "Montserrat" }}>Dinner 夕食</span>
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
              <span style={{ fontSize: "8px", fontWeight: 800, color: "#5C7A2E", textTransform: "uppercase", letterSpacing: "0.5px", fontFamily: "Montserrat" }}>Hotel ホテル</span>
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
  const typeLabel = loc.type === "lunch" ? "Lunch · 昼食" : loc.type === "dinner" ? "Dinner · 夕食" : "Attraction · 観光";
  const typeColor = loc.type === "lunch" ? "#C4A048" : loc.type === "dinner" ? "#D94025" : "#8F2818";
  const Icon = loc.type === "lunch" || loc.type === "dinner" ? ActivityIcons.food : getPopupIcon(loc.name);
  // Curated `desc` from tripData wins; `vibeDescriptions` is fallback only.
  // This keeps the map popup, sidebar, and modal showing identical text.
  const vibe = loc.desc || vibeDescriptions[loc.name];
  const fallbackDesc = null;
  const photo = getLocationPhoto(loc.name);

  return (
    <div
      style={{
        fontFamily: "Noto Sans JP, sans-serif",
        overflow: "hidden",
        borderRadius: "12px",
        width: "280px",
        maxHeight: "420px",
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* Photo banner — click to open the same unified detail Modal as the sidebar */}
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
          {/* Subtle gradient for legibility if ever overlaid */}
          <div style={{ position: "absolute", inset: 0, background: "linear-gradient(180deg, rgba(0,0,0,0) 60%, rgba(0,0,0,0.12) 100%)" }} />
          {onOpenFullDetail && (
            <div style={{
              position: "absolute", bottom: "6px", right: "6px",
              padding: "3px 7px", borderRadius: "6px",
              backgroundColor: "rgba(28,25,23,0.55)", color: "#FDFBF5",
              fontSize: "9px", fontWeight: 700, letterSpacing: "0.4px",
              fontFamily: "Montserrat", display: "inline-flex", alignItems: "center", gap: "4px",
            }}>
              ↗ View Details
            </div>
          )}
        </div>
      )}

      {/* Scrollable content (expands with description length) */}
      <div
        style={{
          padding: "12px 14px 14px",
          overflowY: "auto",
          flex: "1 1 auto",
          minHeight: 0,
        }}
      >
        {/* Category badge + rating */}
        <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px", flexWrap: "wrap" }}>
          <div style={{
            display: "inline-flex", alignItems: "center", gap: "6px",
            padding: "3px 8px", borderRadius: "6px",
            backgroundColor: `${typeColor}12`, border: `1px solid ${typeColor}35`,
          }}>
            <Icon size={12} color={typeColor} />
            <span style={{
              fontSize: "9px", fontWeight: 800, color: typeColor,
              textTransform: "uppercase", letterSpacing: "0.8px", fontFamily: "Montserrat",
            }}>
              {typeLabel}
            </span>
          </div>
          {loc.rating && loc.rating !== "—" && (
            <span style={{
              display: "inline-flex", alignItems: "center", gap: "3px",
              padding: "3px 7px", borderRadius: "6px",
              backgroundColor: "#FBF8EE", border: "1px solid #F5EDCE",
              fontSize: "10px", fontWeight: 800, color: "#C4A048",
            }}>★ {loc.rating}</span>
          )}
        </div>

        {/* Trilingual name */}
        {loc.nameJa && (
          <p style={{ fontSize: "10px", color: "#A39E96", margin: 0, fontFamily: "Noto Sans JP" }}>{loc.nameJa}</p>
        )}
        <p style={{
          fontSize: "15px", fontWeight: 800, color: "#1C1917",
          margin: "2px 0 2px", fontFamily: "Montserrat, Noto Sans JP",
          lineHeight: 1.25,
        }}>
          {loc.name}
        </p>
        {loc.nameHe && (
          <p style={{ fontSize: "11px", color: "#78716C", margin: 0 }} dir="rtl">{loc.nameHe}</p>
        )}

        {/* Full Hebrew vibe description — no truncation, neutral grey */}
        {vibe && (
          <div style={{
            marginTop: "10px",
            padding: "10px 11px",
            borderRadius: "10px",
            backgroundColor: "#FAF6E8",
            border: "1px solid #F1E9CE",
          }}>
            <p
              dir="rtl"
              style={{
                fontSize: "12px",
                color: "#44403C",
                margin: 0,
                lineHeight: 1.55,
                fontFamily: "Noto Sans JP, sans-serif",
              }}
            >
              {vibe}
            </p>
          </div>
        )}

        {/* Fallback short description (only when no vibe available) */}
        {fallbackDesc && (
          <p
            dir="rtl"
            style={{
              fontSize: "12px",
              color: "#44403C",
              margin: "10px 0 0",
              lineHeight: 1.55,
            }}
          >
            {fallbackDesc}
          </p>
        )}

        {/* Actions: Full Details + Google Maps */}
        <div style={{ display: "flex", gap: "8px", marginTop: "12px", flexWrap: "wrap" }}>
          {onOpenFullDetail && (
            <button
              onClick={(e) => { e.stopPropagation(); onOpenFullDetail(loc); }}
              style={{
                display: "inline-flex", alignItems: "center", gap: "5px",
                padding: "6px 10px", borderRadius: "8px",
                backgroundColor: "#FEF0EE", border: "1px solid #FDDCD8",
                color: "#B8331E", fontSize: "10px", fontWeight: 700,
                fontFamily: "Montserrat", cursor: "pointer",
              }}
            >
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>
              </svg>
              View Details
            </button>
          )}
          <a
            href={gmapsUrl(loc.name)}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            style={{
              display: "inline-flex", alignItems: "center", gap: "5px",
              padding: "6px 10px", borderRadius: "8px",
              backgroundColor: "#FFFFFF", border: "1px solid #E7DFCF",
              color: "#44403C", fontSize: "10px", fontWeight: 700,
              textDecoration: "none", fontFamily: "Montserrat",
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
