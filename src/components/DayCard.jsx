import React, { forwardRef } from "react";
import { HOTEL_COORDINATES } from "../data/tripData";
import { vibeDescriptions } from "../data/landmarkImages";
import { CityIllustrations, cityToHeroIllustration, ActivityIcons } from "../data/illustrations";
import { lodgingOverrides } from "../data/transportData";
import { getDayPhoto, getLocationPhoto } from "../data/photoMap";
import TripPhoto from "./TripPhoto";

/* ══════════════════════════════════════════════
   INLINE LINE-ART ICONS — 1.5px stroke weight
   Matches border & typography weight for cohesion
   ══════════════════════════════════════════════ */
const Icons = {
  torii: (p) => (
    <svg width={p.size||16} height={p.size||16} viewBox="0 0 24 24" fill="none" stroke={p.color||"currentColor"} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <line x1="4" y1="7" x2="20" y2="7"/><line x1="3" y1="10" x2="21" y2="10"/><line x1="7" y1="10" x2="7" y2="22"/><line x1="17" y1="10" x2="17" y2="22"/>
    </svg>
  ),
  utensils: (p) => (
    <svg width={p.size||14} height={p.size||14} viewBox="0 0 24 24" fill="none" stroke={p.color||"currentColor"} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2"/><line x1="7" y1="2" x2="7" y2="22"/><path d="M21 15V2a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3v7"/>
    </svg>
  ),
  star: (p) => (
    <svg width={p.size||12} height={p.size||12} viewBox="0 0 24 24" fill={p.fill||"currentColor"} stroke={p.color||"currentColor"} strokeWidth="1.5">
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
    </svg>
  ),
  mapPin: (p) => (
    <svg width={p.size||14} height={p.size||14} viewBox="0 0 24 24" fill="none" stroke={p.color||"currentColor"} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>
    </svg>
  ),
  lightbulb: (p) => (
    <svg width={p.size||14} height={p.size||14} viewBox="0 0 24 24" fill="none" stroke={p.color||"currentColor"} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 18h6"/><path d="M10 22h4"/><path d="M15.09 14c.18-.98.65-1.74 1.41-2.5A4.65 4.65 0 0 0 18 8 6 6 0 0 0 6 8c0 1 .23 2.23 1.5 3.5A4.61 4.61 0 0 1 8.91 14"/>
    </svg>
  ),
  bed: (p) => (
    <svg width={p.size||14} height={p.size||14} viewBox="0 0 24 24" fill="none" stroke={p.color||"currentColor"} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 4v16"/><path d="M2 8h18a2 2 0 0 1 2 2v10"/><path d="M2 17h20"/><path d="M6 8v9"/>
    </svg>
  ),
  wallet: (p) => (
    <svg width={p.size||14} height={p.size||14} viewBox="0 0 24 24" fill="none" stroke={p.color||"currentColor"} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="1" y="4" width="22" height="16" rx="2" ry="2"/><line x1="1" y1="10" x2="23" y2="10"/>
    </svg>
  ),
  compass: (p) => (
    <svg width={p.size||14} height={p.size||14} viewBox="0 0 24 24" fill="none" stroke={p.color||"currentColor"} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"/><polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76"/>
    </svg>
  ),
};

/* ──────────────────────────────────────────────
   Trilingual location name display
   ────────────────────────────────────────────── */
/* Google Maps link helper */
const gmapsUrl = (name) =>
  `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(name + " Japan")}`;

// Title is always plain text. Google Maps link is a SEPARATE, dedicated
// control rendered below the title via <GoogleMapsLink /> — only visible
// in the expanded/focus view of a day card (where AttractionItem and
// FoodSection are rendered).
const TrilingualName = ({ name, nameJa, nameHe, compact = false }) => (
  <div className={compact ? "leading-tight" : "leading-snug"}>
    {nameJa && (
      <span className={`block font-body text-sumi-400 ${compact ? "text-[10px]" : "text-xs"}`}>{nameJa}</span>
    )}
    <span className={`block font-display font-bold text-sumi-800 ${compact ? "text-xs" : "text-sm"}`}>{name}</span>
    {nameHe && (
      <span className={`block font-body text-sumi-400 ${compact ? "text-[10px]" : "text-xs"}`} dir="rtl">{nameHe}</span>
    )}
  </div>
);

/* ──────────────────────────────────────────────
   Dedicated Google Maps link — rendered BELOW the title.
   Only used in expanded / focus mode (AttractionItem, FoodSection,
   hotel row) — never on the collapsed card summary.
   ────────────────────────────────────────────── */
const GoogleMapsLink = ({ name, label = "Open in Google Maps" }) => (
  <a
    href={gmapsUrl(name)}
    target="_blank"
    rel="noopener noreferrer"
    onClick={(e) => e.stopPropagation()}
    className="inline-flex items-center gap-1 mt-1 text-[10px] font-display font-semibold text-blue-600 hover:text-blue-700 hover:underline underline-offset-2 transition-colors"
    title={`View ${name} on Google Maps`}
  >
    <svg width="11" height="11" viewBox="0 0 24 24" fill="#4285F4" className="flex-shrink-0">
      <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5a2.5 2.5 0 1 1 0-5 2.5 2.5 0 0 1 0 5z"/>
    </svg>
    <span>{label}</span>
    <span className="text-sumi-300">↗</span>
  </a>
);

/* ──────────────────────────────────────────────
   Clickable location button
   ────────────────────────────────────────────── */
const LocationButton = ({ coordinates, name, onSelectLocation, children }) => {
  if (!coordinates || !onSelectLocation) return <>{children}</>;
  return (
    <button
      onClick={(e) => { e.stopPropagation(); onSelectLocation({ lng: coordinates.lng, lat: coordinates.lat, name }); }}
      className="location-btn w-full text-left rounded-lg transition-all duration-200 hover:bg-vermillion-50/50 active:scale-[0.98] group/loc"
      title={`📍 Fly to ${name}`}
    >
      <div className="flex items-start gap-2">
        <div className="flex-1">{children}</div>
        <div className="mt-1 opacity-0 group-hover/loc:opacity-100 transition-opacity flex-shrink-0">
          <Icons.mapPin size={14} color="#D94025" />
        </div>
      </div>
    </button>
  );
};

/* ──────────────────────────────────────────────
   Pick a relevant activity icon for an attraction
   ────────────────────────────────────────────── */
const getActivityIcon = (name) => {
  const n = name.toLowerCase();
  if (n.includes("shrine") || n.includes("temple") || n.includes("inari") || n.includes("pagoda") || n.includes("todai")) return ActivityIcons.shrine;
  if (n.includes("park") || n.includes("gyoen") || n.includes("garden") || n.includes("bamboo")) return ActivityIcons.park;
  if (n.includes("coffee") || n.includes("café") || n.includes("cafe") || n.includes("starbucks") || n.includes("bricolage")) return ActivityIcons.coffee;
  if (n.includes("shinkansen") || n.includes("train")) return ActivityIcons.train;
  if (n.includes("onsen") || n.includes("hot spring")) return ActivityIcons.onsen;
  if (n.includes("market") || n.includes("don quijote") || n.includes("parco") || n.includes("muji") || n.includes("outlet") || n.includes("uniqlo") || n.includes("kappabashi")) return ActivityIcons.shopping;
  if (n.includes("view") || n.includes("billboard") || n.includes("crossing") || n.includes("tower") || n.includes("gov")) return ActivityIcons.viewpoint;
  if (n.includes("ramen") || n.includes("food") || n.includes("sushi") || n.includes("soba") || n.includes("gyoza") || n.includes("yakitori") || n.includes("katsu")) return ActivityIcons.food;
  if (n.includes("teamlab") || n.includes("uzu")) return ActivityIcons.viewpoint;
  if (n.includes("photo") || n.includes("camera")) return ActivityIcons.camera;
  return ActivityIcons.walk;
};

/* ──────────────────────────────────────────────
   Attraction item with line-art icon + vibe
   ────────────────────────────────────────────── */
const AttractionItem = ({ attraction, onSelectLocation, onOpenDetail, dayNum, city, cityHe, deepDive }) => {
  const vibe = vibeDescriptions[attraction.name];
  const IconComponent = getActivityIcon(attraction.name);
  const photo = getLocationPhoto(attraction.name);

  // Sidebar → Map sync: clicking the row only focuses the map and lets
  // the map's own popup tooltip handle preview. The full DetailModal
  // is reachable from inside that popup ("View Details" button) so the
  // sidebar click stays lightweight and discoverable.
  const handleDetailClick = (e) => {
    e.stopPropagation();
    if (attraction.coordinates && onSelectLocation) {
      onSelectLocation({
        lng: attraction.coordinates.lng,
        lat: attraction.coordinates.lat,
        name: attraction.name,
      });
    }
  };

  return (
    <button
      type="button"
      onClick={handleDetailClick}
      className="location-btn w-full text-left rounded-lg transition-all duration-200 hover:bg-vermillion-50/50 active:scale-[0.98] group/loc cursor-zoom-in"
      title={`View details — ${attraction.name}`}
    >
      <div className="flex gap-3 py-2 px-2 rounded-lg">
        {/* Photo thumbnail or line-art activity icon */}
        {photo ? (
          <div
            className="group/thumb relative w-9 h-9 rounded-lg border border-cream-300 overflow-hidden flex-shrink-0 mt-0.5"
            title="View details"
          >
            <TripPhoto src={photo} alt={attraction.name} city={city || "Tokyo"} className="w-full h-full" objectFit="cover" />
            {/* Hover badge ↗ — discoverability hint for tap-to-open */}
            <div className="absolute inset-0 bg-sumi-800/40 opacity-0 group-hover/thumb:opacity-100 transition-opacity flex items-center justify-center pointer-events-none">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#FDFBF5" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="7" y1="17" x2="17" y2="7"/><polyline points="7 7 17 7 17 17"/>
              </svg>
            </div>
          </div>
        ) : (
          <div
            className="group/thumb relative w-9 h-9 rounded-lg border border-cream-300 bg-cream-100/50 flex items-center justify-center flex-shrink-0 mt-0.5"
            title="View details"
          >
            <IconComponent size={18} color="#D94025" />
            <div className="absolute inset-0 bg-sumi-800/40 opacity-0 group-hover/thumb:opacity-100 transition-opacity flex items-center justify-center pointer-events-none rounded-lg">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#FDFBF5" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="7" y1="17" x2="17" y2="7"/><polyline points="7 7 17 7 17 17"/>
              </svg>
            </div>
          </div>
        )}
        <div className="flex-1 min-w-0">
          <TrilingualName name={attraction.name} nameJa={attraction.nameJa} nameHe={attraction.nameHe} compact />
          {vibe && (
            <p className="text-[11px] text-sumi-700 italic mt-1 font-body leading-snug line-clamp-3" dir="rtl">{vibe}</p>
          )}
          {attraction.desc && (
            <p className="text-[11px] text-sumi-400 mt-0.5 font-body" dir="rtl">{attraction.desc}</p>
          )}
          {/* ── Action row: Google Maps only. Detail modal now opens via the thumbnail (cursor-zoom-in). ── */}
          <div className="flex items-center gap-3 flex-wrap">
            <GoogleMapsLink name={attraction.name} label="Google Maps" />
          </div>
        </div>
      </div>
    </button>
  );
};

/* ──────────────────────────────────────────────
   Food section with line-art
   ────────────────────────────────────────────── */
const FoodSection = ({ label, labelJa, data, accentColor, bgColor, borderColor, onSelectLocation, onOpenDetail, dayNum, city, cityHe, deepDive }) => {
  if (!data || !data.place || data.place === "—") return null;

  // Click only focuses the map on this food spot. The map's popup
  // surfaces the same info and offers a "View Details" link that
  // opens the full DetailModal — keeps sidebar clicks lightweight.
  const handleCardClick = (e) => {
    e.stopPropagation();
    if (data.coordinates && onSelectLocation) {
      onSelectLocation({
        lng: data.coordinates.lng,
        lat: data.coordinates.lat,
        name: data.place,
      });
    }
  };

  const content = (
    <div className={`rounded-xl overflow-hidden border ${bgColor} ${borderColor}`}>
      {/* Decorative food line-art strip */}
      <div className={`h-8 flex items-center justify-center ${label === "Lunch" ? "bg-gold-50" : "bg-vermillion-50"} border-b ${borderColor}`}>
        <svg width="80" height="24" viewBox="0 0 80 24" fill="none">
          {label === "Lunch" ? (
            <>
              {/* Bento box line art */}
              <rect x="20" y="4" width="40" height="16" rx="2" stroke="#C4A048" strokeWidth="1"/>
              <line x1="40" y1="4" x2="40" y2="20" stroke="#C4A048" strokeWidth="0.6" opacity="0.4"/>
              <line x1="20" y1="12" x2="40" y2="12" stroke="#C4A048" strokeWidth="0.6" opacity="0.4"/>
              <circle cx="50" cy="9" r="2" stroke="#C4A048" strokeWidth="0.5" opacity="0.3"/>
              <circle cx="55" cy="15" r="1.5" stroke="#C4A048" strokeWidth="0.5" opacity="0.3"/>
            </>
          ) : (
            <>
              {/* Bowl + chopsticks line art */}
              <path d="M25 10 Q25 20 40 20 Q55 20 55 10" stroke="#D94025" strokeWidth="1" fill="none"/>
              <line x1="23" y1="10" x2="57" y2="10" stroke="#D94025" strokeWidth="1"/>
              <line x1="45" y1="3" x2="52" y2="14" stroke="#D94025" strokeWidth="0.8"/>
              <line x1="48" y1="2" x2="55" y2="13" stroke="#D94025" strokeWidth="0.8"/>
              <path d="M32 6 Q33 8 32 10" stroke="#D94025" strokeWidth="0.4" opacity="0.3"/>
              <line x1="38" y1="5" x2="38" y2="10" stroke="#D94025" strokeWidth="0.4" opacity="0.25"/>
            </>
          )}
        </svg>
      </div>
      <div className="p-3">
        <div className="flex items-center justify-between mb-1.5">
          <div className="flex items-center gap-2">
            <Icons.utensils size={13} color={accentColor === "text-gold-400" ? "#C4A048" : "#D94025"} />
            <div>
              <span className={`text-[10px] font-display font-bold uppercase tracking-wider ${accentColor}`}>{label}</span>
              {labelJa && <span className={`text-[9px] font-body ml-1.5 ${accentColor} opacity-60`}>{labelJa}</span>}
            </div>
          </div>
          {data.rating && data.rating !== "—" && (
            <div className="flex items-center gap-1 bg-cream-50/80 rounded-full px-2 py-0.5 border border-cream-300">
              <Icons.star size={10} color="#C4A048" fill="#C4A048" />
              <span className="text-[10px] font-display font-bold text-gold-400">{data.rating}</span>
            </div>
          )}
        </div>
        {/* Name renders inline — entire card is the click target (see wrapper button). */}
        <TrilingualName name={data.place} nameJa={data.nameJa} nameHe={data.nameHe} compact />
        {data.desc && <p className="text-[11px] text-sumi-400 mt-1 font-body" dir="rtl">{data.desc}</p>}
        {/* ── Action row: Google Maps only. Detail modal opens via the name above. ── */}
        <div className="flex items-center gap-3 flex-wrap mt-0.5">
          <GoogleMapsLink name={data.place} label="Google Maps" />
        </div>
      </div>
    </div>
  );

  return (
    <button
      type="button"
      onClick={handleCardClick}
      className="block w-full text-left cursor-zoom-in transition-transform duration-200 hover:scale-[1.005] active:scale-[0.99]"
      title={`View details — ${data.place}`}
    >
      {content}
    </button>
  );
};

/* ══════════════════════════════════════════════
   COLLAPSED TIMELINE
   Horizontal narrative of the day's key moments:
   Spent Day → Lunch → [Transport] → Dinner → Slept In
   ══════════════════════════════════════════════ */

const TimelineDot = ({ children, accent = false }) => (
  <div className={`flex-shrink-0 w-5 h-5 rounded-full border flex items-center justify-center ${
    accent
      ? "bg-vermillion-50 border-vermillion-300"
      : "bg-cream-100 border-cream-300"
  }`}>
    {children}
  </div>
);

const TimelineArrow = () => (
  <svg width="12" height="8" viewBox="0 0 12 8" fill="none" className="flex-shrink-0 opacity-30">
    <line x1="0" y1="4" x2="9" y2="4" stroke="#D94025" strokeWidth="1.2" strokeDasharray="2 1.5"/>
    <polyline points="7,1 11,4 7,7" fill="none" stroke="#D94025" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

/* ──────────────────────────────────────────────
   COLLAPSED SUMMARY (Task 4 — Outer View)
   High-level only: City  •  Transit (if moving)  •  Slept In
   Daily activities / lunch / attractions / dinner live in the
   expanded (inner) view — not here.
   ────────────────────────────────────────────── */
const CollapsedTimeline = ({ data, lodgingInfo }) => {
  const activityCity = lodgingInfo ? lodgingInfo.activityCity : data.city.replace(/ \d+$/, "");
  const sleepCity    = lodgingInfo ? lodgingInfo.lodgingCity  : data.city.replace(/ \d+$/, "");
  const cityChanged  = activityCity !== sleepCity;

  const areas = dayAreas[data.day];

  return (
    <div className="px-3 py-2 bg-cream-50 overflow-hidden">
      <div className="flex items-center gap-2 overflow-x-auto scrollbar-none min-w-0 pb-0.5">

        {/* ① City */}
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <TimelineDot accent>
            <Icons.compass size={10} color="#D94025" />
          </TimelineDot>
          <div className="text-left">
            <p className="text-[8px] font-display font-bold text-sumi-400 uppercase tracking-wide leading-none">City</p>
            <p className="text-[11px] font-display font-semibold text-sumi-700 leading-tight truncate max-w-[110px]">{activityCity}</p>
          </div>
        </div>

        {/* ② Transit (only when moving cities that day) */}
        {cityChanged && (
          <>
            <TimelineArrow />
            <div className="flex items-center gap-1.5 flex-shrink-0">
              <div className="w-5 h-5 rounded-full bg-vermillion-50 border border-vermillion-300 flex items-center justify-center">
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#D94025" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="4" y="3" width="16" height="16" rx="2"/>
                  <line x1="4" y1="11" x2="20" y2="11"/>
                  <circle cx="8" cy="15" r="1"/><circle cx="16" cy="15" r="1"/>
                </svg>
              </div>
              <div className="text-left">
                <p className="text-[8px] font-display font-bold text-vermillion-500 uppercase tracking-wide leading-none">Transit</p>
                <p className="text-[11px] font-display font-semibold text-vermillion-600 leading-tight truncate max-w-[110px]">→ {sleepCity}</p>
              </div>
            </div>
          </>
        )}

        {/* ③ Slept In (accommodation) */}
        <TimelineArrow />
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <TimelineDot>
            <Icons.bed size={10} color="#57534E" />
          </TimelineDot>
          <div className="text-left">
            <p className="text-[8px] font-display font-bold text-sumi-400 uppercase tracking-wide leading-none">Slept In</p>
            <p className="text-[11px] font-display font-semibold text-sumi-700 leading-tight truncate max-w-[130px]">
              {data.hotel && data.hotel !== "—" ? data.hotel : sleepCity}
            </p>
          </div>
        </div>

      </div>

      {/* Areas Explored — districts/neighborhoods visited that day.
          Wraps onto multiple lines on narrow screens so the chip set
          stays readable on mobile rather than getting clipped.        */}
      {areas && areas.length > 0 && (
        <div className="mt-1.5 pt-1.5 border-t border-cream-200/70 flex items-start gap-1.5">
          <div className="flex items-center gap-1 flex-shrink-0 pt-0.5">
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#D94025" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
              <circle cx="12" cy="10" r="3"/>
            </svg>
            <p className="text-[8px] font-display font-bold text-sumi-400 uppercase tracking-wide leading-none whitespace-nowrap">Areas</p>
          </div>
          <div className="flex flex-wrap items-center gap-x-1 gap-y-0.5 min-w-0">
            {areas.map((a, i) => (
              <React.Fragment key={a}>
                {i > 0 && <span className="text-[9px] text-sumi-300">·</span>}
                <span className="text-[10px] font-display font-medium text-sumi-700 leading-snug">{a}</span>
              </React.Fragment>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

/* ══════════════════════════════════════════════
   EXPANDED TIMELINE HEADER (Iteration 4 — Task 1)
   Horizontal visual summary shown at the top of the
   expanded Day Card:
     [City Icon] City  →  [Transit Icon] Transit  →  [Bed Icon] Slept in: Hotel
   Larger / more prominent than the collapsed variant.
   ══════════════════════════════════════════════ */
const ExpandedTimelineHeader = ({ data, lodgingInfo }) => {
  const activityCity = lodgingInfo ? lodgingInfo.activityCity : data.city.replace(/ \d+$/, "");
  const activityCityHe = lodgingInfo ? lodgingInfo.activityCityHe : data.cityHe;
  const sleepCity    = lodgingInfo ? lodgingInfo.lodgingCity  : data.city.replace(/ \d+$/, "");
  const sleepCityHe  = lodgingInfo ? lodgingInfo.lodgingCityHe : data.cityHe;
  const cityChanged  = activityCity !== sleepCity;
  const hotelName    = data.hotel && data.hotel !== "—" ? data.hotel : sleepCity;

  const Node = ({ icon, label, labelJa, value, subValue, accent }) => (
    <div className="flex items-center gap-2.5 flex-shrink-0 min-w-0">
      <div className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 ${accent ? "bg-vermillion-100 border border-vermillion-300" : "bg-cream-100 border border-cream-300"}`}>
        {icon}
      </div>
      <div className="text-left min-w-0">
        <div className="flex items-baseline gap-1">
          <span className={`text-[9px] font-display font-bold uppercase tracking-wider leading-none ${accent ? "text-vermillion-600" : "text-sumi-500"}`}>{label}</span>
          {labelJa && <span className="text-[9px] font-body text-sumi-300 leading-none">{labelJa}</span>}
        </div>
        <p className="text-[13px] font-display font-bold text-sumi-800 leading-tight truncate max-w-[150px]" title={value}>
          {value}
        </p>
        {subValue && (
          <p className="text-[10px] font-body text-sumi-400 leading-tight truncate max-w-[150px]" dir="rtl">{subValue}</p>
        )}
      </div>
    </div>
  );

  const Arrow = () => (
    <div className="flex items-center justify-center flex-shrink-0 px-1">
      <svg width="22" height="10" viewBox="0 0 22 10" fill="none" aria-hidden="true">
        <line x1="1" y1="5" x2="17" y2="5" stroke="#D94025" strokeWidth="1.4" strokeDasharray="2.5 2.5" strokeLinecap="round" />
        <polyline points="14,1 20,5 14,9" fill="none" stroke="#D94025" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </div>
  );

  // Main locations bulleted list — attractions + food (max 6 to keep compact)
  const bulletItems = [];
  if (data.attractions) {
    data.attractions.slice(0, 5).forEach((a) => {
      bulletItems.push({ name: a.name, nameHe: a.nameHe, type: "attraction" });
    });
  }
  if (data.lunch && data.lunch.place && data.lunch.place !== "—") {
    bulletItems.push({ name: data.lunch.place, nameHe: data.lunch.nameHe, type: "lunch" });
  }
  if (data.dinner && data.dinner.place && data.dinner.place !== "—") {
    bulletItems.push({ name: data.dinner.place, nameHe: data.dinner.nameHe, type: "dinner" });
  }

  const bulletIcon = (type, name) => {
    if (type === "lunch" || type === "dinner") return <Icons.utensils size={11} color="#C4A048" />;
    const n = (name || "").toLowerCase();
    if (n.includes("shrine") || n.includes("temple") || n.includes("pagoda")) return <Icons.torii size={11} color="#D94025" />;
    if (n.includes("park") || n.includes("garden") || n.includes("bamboo")) return <Icons.compass size={11} color="#5C7A2E" />;
    if (n.includes("onsen")) return <Icons.bed size={11} color="#4A7FB5" />;
    return <Icons.compass size={11} color="#8F2818" />;
  };

  const areas = dayAreas[data.day];

  return (
    <div className="mb-4 rounded-xl p-3 bg-gradient-to-br from-cream-50 to-cream-100 border border-cream-300">
      {/* ── 3-node timeline: City → Transit → Slept In ── */}
      <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none">
        {/* ① City */}
        <Node
          icon={<Icons.compass size={15} color="#D94025" />}
          label="City"
          labelJa="都市"
          value={activityCity}
          subValue={activityCityHe}
          accent
        />

        {/* ② Transit (only when moving cities) */}
        {cityChanged && (
          <>
            <Arrow />
            <Node
              icon={
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#D94025" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="4" y="3" width="16" height="16" rx="2"/>
                  <line x1="4" y1="11" x2="20" y2="11"/>
                  <circle cx="8" cy="15" r="1"/><circle cx="16" cy="15" r="1"/>
                  <line x1="8" y1="19" x2="6" y2="22"/><line x1="16" y1="19" x2="18" y2="22"/>
                </svg>
              }
              label="Transit"
              labelJa="移動"
              value={`→ ${sleepCity}`}
              subValue={sleepCityHe}
              accent
            />
          </>
        )}

        {/* ③ Slept In */}
        <Arrow />
        <Node
          icon={<Icons.bed size={15} color="#57534E" />}
          label="Slept In"
          labelJa="宿泊"
          value={hotelName}
          subValue={sleepCityHe}
        />
      </div>

      {/* ── Areas Explored — districts visited (wraps on mobile) ── */}
      {areas && areas.length > 0 && (
        <div className="mt-2.5 pt-2.5 border-t border-cream-300/80 flex items-start gap-2">
          <div className="flex items-center gap-1 flex-shrink-0 pt-0.5">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#D94025" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
              <circle cx="12" cy="10" r="3"/>
            </svg>
            <span className="text-[9px] font-display font-bold text-sumi-500 uppercase tracking-wider leading-none whitespace-nowrap">Areas Explored</span>
            <span className="text-[9px] font-body text-sumi-300 leading-none">エリア</span>
          </div>
          <div className="flex flex-wrap items-center gap-1 min-w-0">
            {areas.map((a) => (
              <span
                key={a}
                className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-display font-semibold text-vermillion-700 bg-vermillion-50 border border-vermillion-100 leading-none"
              >
                {a}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* ── Bulleted highlights of the day (minimalist line-art) ── */}
      {bulletItems.length > 0 && (
        <div className="mt-3 pt-3 border-t border-cream-300/80">
          <div className="flex items-baseline gap-1.5 mb-1.5">
            <span className="text-[9px] font-display font-bold text-sumi-500 uppercase tracking-wider">Highlights</span>
            <span className="text-[9px] font-body text-sumi-300">今日の見どころ</span>
          </div>
          <ul className="space-y-1">
            {bulletItems.map((it, i) => (
              <li key={i} className="flex items-center gap-2 text-[11px] text-sumi-700 font-body leading-snug">
                <span className="flex items-center justify-center w-4 h-4 rounded-full bg-cream-50 border border-cream-300 flex-shrink-0">
                  {bulletIcon(it.type, it.name)}
                </span>
                <span className="font-display font-semibold truncate">{it.name}</span>
                {it.nameHe && (
                  <span className="text-sumi-400 text-[10px] truncate" dir="rtl">· {it.nameHe}</span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

/* ══════════════════════════════════════════════
   HERO ILLUSTRATION SECTION
   Uses city-specific SVG line art as the card header
   ══════════════════════════════════════════════ */
const HeroIllustration = ({ city, day, title, cityHe, isExpanded, attractionCount, onOpenDetail, deepDive }) => {
  const cityBase = city.replace(/ \d+$/, "");
  const illustrationKey = cityToHeroIllustration[cityBase] || cityToHeroIllustration[city] || "Tokyo";
  const Illustration = CityIllustrations[illustrationKey];
  const heroPhoto = getDayPhoto(day, city);
  const heroHeight = isExpanded ? "130px" : "80px";

  return (
    <div className={`relative overflow-hidden ${isExpanded ? "border-b-2 border-vermillion-200" : ""}`} style={{ height: heroHeight }}>
      {/* Background: Photo if available, line-art fallback otherwise */}
      {heroPhoto ? (
        <TripPhoto
          src={heroPhoto}
          alt={`Day ${day} — ${city}`}
          city={city}
          className="absolute inset-0 w-full h-full"
          objectFit="cover"
        />
      ) : (
        <div className="absolute inset-0 bg-cream-100 flex items-center justify-end pr-4 opacity-40">
          {Illustration && <Illustration w={isExpanded ? 220 : 160} h={isExpanded ? 130 : 80} />}
        </div>
      )}

      {/* Dark gradient overlay for text readability (only when photo present) */}
      {heroPhoto && (
        <div className="absolute inset-0 bg-gradient-to-t from-sumi-900/70 via-sumi-900/20 to-transparent" />
      )}

      {/* Content overlay */}
      <div className="absolute inset-0 flex items-end pb-3 px-4">
        <div className="flex items-end justify-between w-full">
          <div className="flex items-center gap-2.5">
            {/* Day number box */}
            <span className={`inline-flex items-center justify-center rounded border-2 font-display font-black ${
              isExpanded
                ? "w-10 h-10 text-sm bg-vermillion-500 text-white border-vermillion-500 shadow-md"
                : "w-8 h-8 text-xs bg-vermillion-500 text-white border-vermillion-500"
            }`}>
              {day}
            </span>
            <div>
              <h3 className={`font-display font-bold ${heroPhoto ? "text-white drop-shadow-sm" : "text-sumi-800"} ${isExpanded ? "text-base" : "text-sm"}`} dir="rtl">
                {title}
              </h3>
              <span className={`text-[11px] font-body ${heroPhoto ? "text-cream-200" : "text-sumi-400"}`}>{city === cityHe ? city : `${city} | ${cityHe}`}</span>
            </div>
          </div>
          {isExpanded && (
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1.5 bg-cream-50/80 rounded-full px-2.5 py-1 border border-cream-300">
                <Icons.compass size={11} color="#D94025" />
                <span className="text-[9px] font-display font-bold text-vermillion-600">{attractionCount} spots</span>
              </div>
              {onOpenDetail && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onOpenDetail({
                      name: title || `Day ${day}`,
                      nameJa: "",
                      nameHe: "",
                      desc: "",
                      day: day,
                      city: city,
                      cityHe: cityHe,
                      category: "attraction",
                      rating: null,
                      coordinates: null,
                      deepDive: deepDive,
                    });
                  }}
                  className="flex items-center gap-1.5 bg-vermillion-500/90 hover:bg-vermillion-600 text-white rounded-full px-3 py-1.5 border border-vermillion-400 shadow-md transition-all duration-200 min-h-[32px]"
                >
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                    <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>
                  </svg>
                  <span className="text-[10px] font-display font-bold">View Day</span>
                </button>
              )}
            </div>
          )}
          {!isExpanded && (
            <div className="w-7 h-7 rounded-full bg-cream-50/60 flex items-center justify-center text-sumi-400 group-hover:bg-vermillion-50 group-hover:text-vermillion-500 transition-colors">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="9 18 15 12 9 6" />
              </svg>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

/* ══════════════════════════════════════════════
   MAIN DAY CARD COMPONENT
   ══════════════════════════════════════════════ */
/* ──────────────────────────────────────────────
   Deep Dive narrative content per day
   ────────────────────────────────────────────── */
const deepDiveNarratives = {
  1: "נחתנו בטוקיו והגענו למלון בסביבות 10 בבוקר, יצאנו מיד לסיבוב ראשון, קנינו אוכל בפמילי מארט, הקונביני הראשון מתוך מיליון. אחה״צ הלכנו להאראג'וקו (הרחוב הצבעוני) — יוניקלו, רחוב אומוטסנדו האלגנטי, ואז ראמן AFURI שהיה שווה כל דקה מחצי שעה התור (הראמן שלהם מבוסס יוזו ונחשב לאחד הייחודיים בטוקיו). המשכנו לקפה אנאקומה שבו כף דוב מגישה לך את הקפה דרך חור בקיר, אכלנו קרפים ושערות סבתא, טיילנו במיאגי שירין ופארק יויוגי, והגענו עד מוזיאון נזו. בערב אכלנו סושי זאנמאי (סושי זול וטוב ליד המלון), חצינו את שיבויה קרוסינג — הצומת העמוס בעולם עם אלפי אנשים שחוצים בו זמנית — שיחקנו במכונות ארקייד, וסגרנו בדון קיחוטה הענק. יום פתיחה מושלם שנתן טעימה מכל מה שטוקיו יכולה להציע.",
  2: "פתחתנו את הבוקר עם כריכים מפמילי מארט (הכריכים היפניים הם ברמה אחרת — לחם רך כמו ענן - סלט ביצים שהוא חובה), משם לשינג'וקו גויין שהיה פשוט מדהים — ראינו סאקורה בפריחה, בגן שלושה סגנונות גנים שונים (יפני, צרפתי ואנגלי). אחה״צ הגענו לשינג'וקו, רצינו ללכת לשין אודון אבל גילינו שצריך כרטיס ויש המתנה של שעה וחצי, אז הלכנו למקום אחר מהמלצות של פתיתים בלוג, פוּאנג'י — ראמן מבוסס חזיר. קנינו בתחנה כרטיס לשינקנסן וכמובן עוד סיבוב ביוניקלו. בערב הלכנו לגולדן גאי — רובע של סמטאות צרות עם ברים זעירים שכל אחד מכיל 4-6 אנשים, שריד מתקופת שנות ה-50. הגענו מוקדם ב-19:30 אז לא היה צפוף, מצאנו בר קטנטן, אכלנו מרק ונהנינו — חוויה יפנית אינטימית שאי אפשר לשכוח.",
  3: "יום דיסנילנד טוקיו! קמנו ב-06:15, הגענו ב-07:10 לתור — הפארק נפתח רק ב-09:00 אבל התור כבר היה ענק. רצנו ישר למתקן של מפלצות בע״מ (10/10!), קנינו פריוריטי ליופי והחיה, תפסנו פריוריטי חינמי לבאז שנות אור, ומשם למתקן של ספייס מאונטיין 10/10, באז 10/10, עולם קטן 7/10, ספלאש מאונטיין 8/10 (תור של שעה וחצי שמוסתר בתוך ההר אז לא מרגישים). הזמנו אוכל באפליקציה + פריוריטי לבית רדוף הרוחות, היפה והחיה מתקן מדהים 10/10, בית רדוף הרוחות 9/10, פיראטים 8/10, ספייס לייזר 8/10, ומרצ'נדייז. טיפ קריטי: אפליקציית דיסני יפן היא המפתח להצלחה — דרכה מזמינים פריוריטי פאס, אוכל, ורואים זמני המתנה בזמן אמת. בערב אכלנו בפוד קורט ליד הפארק (מה) וקונביני ליד מלון MYSTAYS מאיהמה.",
  4: "דיסני סי! פארק ייחודי של דיסני שקיים רק ביפן, המתקנים יותר מתאימים למבוגרים, פחות אווירה קסומה של דיסני. קמנו 06:46, יצאנו 07:10. תכננו לרוץ ישר ל-Soaring: Fantastic Flight אבל ב-09:03 כבר היו שעתיים תור, אז רצנו ל-Center of Earth — הייתה תקלה במתקן, אז ישר קיבלנו פריוריטי חינמי! אינדיאנה ג'ונס 10/10, קנינו פריוריטי ל-Soaring, יש מתחם שלם של בת הים הקטנה 10/10 (הפתעה מטורפת ביחס לציפיות), Soaring 9.5/10 (חוויה רגועה ומיוחדת שמרחפת מעל העולם), 20000 מיל מתחת למים 8/10, Center of Earth עם הפאס החינמי 10/10, אזור אלאדין ושטיח קסמים 7/10, צב מדבר 0/10 (שואו לתינוקות בסינית), ומגדל האימה 10/10. בערב הלכנו לאיצ'ירן ראמן שינג'וקו — 10/10, כל אחד בתא אישי, אתה אוכל מול וילון, כמובן שחוויה חובה. הסיכום: דיסנילנד לאווירה, דיסני סי למתקנים.",
  5: "היינו גמורים אחריי יומיים של פארקים (ההמלצה שלנו, לתת מרווח ולא לעשות יום אחריי יום) — היינו שבורים לגמרי. התחלנו ב-Little Darling Coffee (בית קפה מדהים, יואב הזמים קפה יוזו בשביל לנסות היה נורא). אחה״צ הלכנו לשיבויה — פסל האצ'יקו (הכלב הנאמן שחיכה 9 שנים לבעליו בתחנת הרכבת, אחד הסמלים של טוקיו), חנות דיסני, פארקו עם פוקימון סנטר ונעלי נייקי שוות במיוחד, סושי עמידה 10/10 (סושי עמידה ביפן הוא חוויה — אתה רואה את השף מכין מולך, כמובן לבקש עם וואסבי, קצת סויה ולקחת את הביס שהדג ישירות על הלשון), כמובן שוב הגעה ליוניקלו (טיפ חשוב! להסתובב עם דרכונים עליכם כי אפשר לעמוד בתור של ה-tax free וזה על המקום). טיפ חשוב נוסף, ביפן יש שירות של שליחת מזוודות, שלחנו מזוודות ישירות למלון באוסקה חוסך את הסחיבה (נגיע למזוודות עוד כמה ימים אחריי שנעלה לאלפים). בערב הלכנו לאומואידה יוקוצ'ו — רחוב מנורות קסום מלא איזאקאיות, ראינו את השלט 3D המפורסם, ישבנו באיזאקאיה (עישון בפנים — זה הקטע), ואז שופינג בשינג'וקו, כמובן כמו בכל ערב מסיימים בגיגו של המכונות בובות (לבקש עזרה מהעובדים, הם ממש מסזדרים לך את הבובה).",
  6: "שינקנסן ב-09:56 לקנזוואה — שעתיים וחצי, 420 ק״מ, הרכבת המהירה הזו מגיעה ל-320 קמ״ש והנוף דרך ההרים מהמם. הגענו למלון קנזוואה זואושי — 4 כוכבים, חדר בול, שמיכת פוטון מפנקת. הלכנו לשוק הדגים ואכלנו בשר A5 על ניגירי (A5 זה הדירוג הגבוה ביותר של בקר וואגיו — שומן שנמס בפה) ומסעדת סושי מצוינת. טיילנו בגן קנרוקואן ובטירה — אחד משלושת הגנים היפים ביפן, עם סאקורה בפריחה, פתאום התחיל לרדת שלג שיצר תמונות מטורפות. אכלנו גלידת זהב (ספיישל של קנזוואה — העיר ידועה בעלי זהב). בערב המלון הגיש ראמן קל, ואז הלכנו למסעדת מאזסובה מול המלון — איטריות ללא מרק עם רוטב שמן זית צ'ילי, 8.5/10.",
  7: "אוטובוס ב-09:10, שעה ורבע לשיראקאווה-גו — כפר מורשת עולמית של אונסקו עם בתי גגות קש בסגנון גאשו-זוקורי, שנבנו כדי לעמוד בשלגים הכבדים של האזור. טיילנו בכפר, אכלנו ראמן מעולה, שיחקנו בשלג, ואכלנו פודינג שוקולד. חזרנו באוטובוס שעה לטקיאמה. בערב נפגשנו עם ג'ובי ויויו במסעדה ואכלנו סובה — צמחוני 9.2/10 ושרימפס 9/10. טקיאמה ידועה כ״אלפים הקטנים של יפן״ ויש בה אווירה הררית שקטה לגמרי שונה מהערים הגדולות. הזמנו אוטובוס למחר כי התחבורה באזור מוגבלת — חובה לתכנן מראש.",
  8: "קנינו אוכל ולקחנו אוטובוס של שעה לאתר הסקי היריו. שכרנו ציוד סקי וסנובורד, מיכלי לקחה שיעור פרטי של שעתיים שהיה מושלם — המורים היפנים סבלניים להפליא ואתרי הסקי באלפים היפניים ידועים באבקת שלג (powder) מהטובות בעולם. התנאים היו מצוינים. סיימנו באונסן הירְיוּ — אין כמו אונסן חם אחרי יום של סקי. בערב אכלנו מקדונלדס (המבורגר שרימפס — ספיישל יפני!), אונסן במלון + מיטת מסאג׳ + כביסה. יום קשה גם רגשית — סבתא של מיכלי נפטרה.",
  9: "קמנו מאוחר במטסומוטו. הלכנו לבית קפה מדהים — פרנץ׳ טוסט שהוא המלצת זהב שלנו, מהמנות הכי טובות שאכלנו בטיול כולו. אחה״צ ביקרנו בטירת מטסומוטו — אחת מ-12 הטירות המקוריות של יפן שנשארו (רובן נהרסו), ידועה כ״טירת העורב״ בגלל צבעה השחור. אחרי זה מוזיאון יאיוי כוסאמה — האמנית היפנית בת ה-90+ הידועה בנקודות הפולקה ודלעות האינסוף שלה, והמוזיאון היה יפהפה. לקחנו JR לנגויה ובערב אכלנו ראמן שישימארו — שהומלץ על ידי Ramen Beast (אפליקציית הראמן המובילה ביפן), המלצת זהב! דילגנו על עמק קיסו בגלל מזג אוויר גרוע.",
  10: "ארוחת בוקר ב-7-Eleven (הקונביני היפני הוא סוג של מסעדה — אוניגירי, סנדוויצ'ים, וקפה ברמה גבוהה), רכבת מוקדמת לאוסקה. אחה״צ הגענו למלון ויצאנו לטירת אוסקה והגנים — טירה מרשימה מאוד עם נוף פנורמי על העיר. הלכנו לראמן הייאטו שהיה מדהים — השף אלרגי לבשמים ויש הנחיות מאוד קשות לכניסה (אם הולכים לדעת שאסור לשים בושם לפני). בערב יצאנו לסיור אוכל עם לירן — ישראלי שגר באוסקה 20 שנה ומכיר כל פינה. נפגשנו עם נופר ודניאל, אכלנו וואגיו, דגים, פירות ים, שתינו סאקה ובירה. אוסקה נחשבת לבירת האוכל של יפן (הרבה פחות מנומסים מהחבר׳ה של טוקיו). סיימנו את הסיור והמשכנו לערב קריוקי, הייתה חוויה מושלמת.",
  11: "קמנו 06:30, עצרנו ב-7/11, נסענו ליוניברסל. הפארק נפתח 07:30! רצנו בין המתקנים — JAWS 6/10, Flying Dinosaur עם פאסט פאס 10/10 (רכבת הרים שאתה תלוי פנים למטה!), XR Dreamor, האזור של הארי פוטר, לחננות שכמונו זה היה מושלם, קנינו שרביט של הרמיוני ואתה יכול להסתובב ברחבי הווגוורסט ולעשות קסמים, היה אדיר. משם ל-Super Nintendo World שהיה 10/10 — עולם מריו בגודל אמיתי עם צמידים אינטראקטיביים שמאפשרים לאסוף מטבעות ולהתחרות. יוניברסל סטודיוס ביפן הוא הפארק היחיד עם Super Nintendo World מלא — שווה להגיע מוקדם כי האזור הזה נסגר כשמתמלא. יש עוד המון מתקנים, הרגשנו ברגע שעשינו את האזורים הגדולים שאפשר לחזור וקרסנו לישון.",
  12: "קמנו מאוחר ויצאנו לסיבוב באוסקה. מקדש נמבה יאסאקה — מקדש עם פנים ענק של אריה שהוא אחד המקומות המצולמים ביפן. המשכנו לשוק קורומון איצ'יבה — שוק הדגים של אוסקה כבר מעל 170 שנה, מרשים מאוד עם פירות ים טריים, אם כי תיירותי. יואב אכל שניצל וואגיו. הלכנו לגיוזה אוושו שהיה מאכזב. הלכנו לארקייד משחקים של Round1 - מלא קומות של משחקים שונים (מבאולינג, סנוקר, חץ וקשת) בגדול אירוע דיי רועש, יואב מאוד נהנה, מיכלי לעיתים. בערב יצאנו לדוטונבורי בלילה — השדרה עם שלטי הניאון הענקיים (כולל האיש הרץ), סגרנו עם איצ'ירן ראמן — כי תמיד אפשר עוד איצ'ירן.",
  13: "קמנו מוקדם ולקחנו רכבת לנארה — עיר עתיקה שהייתה בירת יפן במאה ה-8 לפני קיוטו. טיילנו בנארה כל הבוקר והצהריים, המקום יפהפה עם המון איילים חופשיים שמסתובבים בכל מקום — יש מעל 1,200 איילים - קונים קרקרים ומאכילים את האיילים לאחר שהם קדים קידה. הגענו למקדש טודאי-ג׳י עם פסל הבודהה — הבניין הוא אחד ממבני העץ הגדולים בעולם והבודהה בגובה 15 מטר. אכלנו ראמן בשדרה, צפינו בשואו מוצ'י (דפיקת עוגות אורז — מסורת יפנית עתיקה), וחזרנו למלון למנוחה ולארוז לקראת המעבר לקיוטו.",
  14: "רכבת לקיוטו, הגענו מוקדם והשארנו תיקים. יצאנו לגן מארויאמה — הגן הכי פופולרי בקיוטו לצפייה בסאקורה, עם עץ דובדבן בוכה ענק במרכז. טיילנו בגנים ובמקדשים, גשר קיריו, ובצהריים אכלנו במסעדת תירס ואז GION DUCK — ברווז מטורף שהיה מהמנות הכי טובות של הטיול. קיוטו הייתה בירת יפן למעלה מ-1,000 שנה ויש בה מעל 2,000 מקדשים ומזקקות — כל פינה נושמת היסטוריה. בערב אכלנו ב-Gyoza Motoi (נחמד, קצת יקר — מומלץ מישלן), פמילי מארט ולישון.",
  15: "קמנו 06:15 והגענו לפושימי אינארי ב-07:30 — וזה היה שווה כל דקה! המקדש עם אלפי שערי הטוריי האדומים הוא מהמקומות המצולמים ביותר ביפן, ומוקדם בבוקר כמעט אין אנשים אז אפשר לצלם בשקט. עלינו עד לפסגה — הרבה עוצרים באמצע אבל ההליכה המלאה שווה את זה עם המון ספוטים לתמונות. אחה״צ הלכנו לאוגאווה קפה — מצוין לחובבי קפה, אחת הקלייות הוותיקות בקיוטו. נישיקי מארקט היה מאוד נחמד (שוק של מעל 400 שנה עם מאות דוכנים), אכלנו סושי מסוע (קצת יקר). בערב Burger Revolution Kyoto שהיה מעולה.",
  16: "יום גשום בקיוטו — הלכנו לבית קפה מדהים לעבודה על לפטופ, שתינו קפה ותכננו המשך טיול. חזרנו לנישיקי מארקט ואכלנו ראמן. אחה״צ נמנום מבורך. בערב תכננו ללכת לבר קוקטיילים אבל התברר שצריך הזמנה מראש והוא מאוד יקר, מצאנו במקום את Bar Elcanture — בר קוסמים מטורף! שתינו המון, הכרנו את ג׳וש ואמילי. ערב יקר אבל מוצלח ביותר (14,000 ין, בערך 350 שקל). בקיוטו יש תרבות בארים מוסתרת — הרבה מהמקומות הכי טובים מסתתרים בקומות עליונות בלי שלטים.",
  17: "יצאנו מוקדם ליער הבמבוק בארשיאמה — הגענו בערך 07:15, ולמרות שזה לא היה צפוף מדי, הקטע עצמו קצת overrated כי הוא חלק קצר. נכנסנו למקדש (500 ין כל אחד) והמשכנו ללכת באזור שהוא מקסים. אחה״צ הגענו לקינקאקו-ג׳י (מקדש הזהב) — מאוד יפה, מצופה בעלי זהב אמיתיים ומשתקף באגם. היו המון אנשים. חזרנו למרכז קיוטו, רצינו ראמן טוב אבל היה סגור (יום רביעי — ביפן הרבה מסעדות סגורות באמצע השבוע), אז הלכנו לאיצ'ירן. בערב צילומי פגודת הוקאנג'י, רחוב נינאנזאקה (רחוב מסורתי חמוד), ופיצה MIRITA עם ג׳וש ואמילי. קיוטו בלילה כייפית מאוד.",
  18: "הגענו להוקאנג׳י ב-07:20 לצילומי בוקר — הפגודה בת חמש הקומות היא מהסמלים של קיוטו. ואז הלכנו לסטארבקס נינאנזאקה — סניף מיוחד בתוך בית מסורתי יפני (מאצ׳ייה), חובה להגיע לפני 08:00 כי אחרי זה עמוס משוגע. תפסנו מושב טאטאמי בקומה שנייה. עלינו למקדש הפגודה למעלה (חינם, נוף יפה) והמשכנו לטייל. אחה״צ שעה מנוחה במלון ואז UZU RAMEN — שיתוף פעולה עם teamLab שהופך ארוחת ראמן לחוויה אמנותית. צמחוני מעולה, 10/10 מוחלט (9,200 ין לזוג: 2 מנות עיקריות, 2 מנות ראשונות, קינוח ואלכוהול). עייפים ומרוצים.",
  19: "שינקנסן לטוקיו ב-10:00 — טיפ חשוב: להזמין מוקדם ולבקש מושבים בצד הר פוג׳י (צד ימין בכיוון טוקיו) לנוף מטורף. הגענו בצהריים, הלכנו להאראג׳וקו ואכלנו שוב ב-AFURI. חזרנו למלון ובערב נסענו אל שימוקיטזאווה — אזור וינטג׳ ויד שנייה מגניב שנחשב לשכונת ההיפסטרים של טוקיו, עם חנויות בגדים, תקליטים ובתי קפה קטנים. הגענו בערב עדיף להגיע גם בצהריים. קנינו בסופרמרקט ענק (המלצת פתיתים), דונקי, ואכלנו באיזאקאיה מקומית מעולה.",
  20: "בוקר בפארק אואנו — פיקניק יפה תחת עצי הסאקורה. אואנו הוא אחד הפארקים הוותיקים בטוקיו ובעונת הסאקורה הוא מתמלא ביפנים שעושים חנאמי (פיקניק תחת הפריחה). משם לחנות צעצועים יפנית (אנימה, דיסני, פוקימון ועוד ועוד) בהמלצת פתיתים שהייתה מעולה, ושוק אואנו אמיוקו — שוק רחוב עם קניות ודברים מגניבים. צהריים במקדונלדס (המקדונלדס היפני מפתיע, מאוד זול וסוגר פינה). אחה״צ הלכנו לקפאבאשי — רחוב כלי המטבח של טוקיו, גן עדן לכל מי שאוהב לבשל. צריך 2-3 שעות שם ושווה כל דקה — סכיני שף יפניות, כלי חרסינה, ודגמי אוכל מפלסטיק. בערב היינו עייפים מדי לסיור חינמי בשינג׳וקו, ניסינו להגיע למסעדה שין אודון אבל הם היו סולד-אאוט, הלכנו ברגל בשינג׳וקו ואכלנו בסושי עמידה.",
  21: "התחלנו ב-08:00 בקצובושי בשיבויה — תור של שעה וחצי, חוויה מעניינת (קצובושי הוא שבבי בוניטו, בסיס לדאשי — אחד הטעמים הבסיסיים של המטבח היפני) - יואב אהב, מיכלי חשבה שיש לזה טעם של עפרון. אקיהבארה — גן עדן האנימה והגיימינג של טוקיו. Super Potato — חנות רטרו גיימינג אגדית עם משחקים מהשנות ה-80 ו-90, רדיו קאיקאן — בניין של 10 קומות עם חנויות אנימה ומנגה, קנינו פופס ושטויות. ביום ראשון מ-13:00 סוגרים כבישים להולכי רגל, וזה חוויה מטורפת לראות את הרחובות הראשיים בלי מכוניות. בערב היינו שבורים, ארוחה ב-7-Eleven — ואין בזה שום בושה כי אין על הקונביני היפני עם האוכל הטרי.",
  22: "teamLab Planets ב-09:00 (נכנסנו 09:30) — מושלם! חובה להזמין את השעה הכי מוקדמת, כי אז המוזיאון עוד יחסית ריק. teamLab אחד המוזיאונים הכי מבוקשים ביפן — שילוב של טכנולוגיה ואומנות. UZU ראמן — שוב מושלם. אחה״צ נסענו לאודאייבה — רובוט גאנדם ענק (לא זה שזז — זה במפעל, רחוק), גו-קארט חשמלי (1,500 ין ל-4 דקות, מומלץ 7 סיבובים ב-3,500), וגינזה עם יוניקלו של 12 קומות — חנות הדגל הגדולה בעולם. בערב יאקיטורי ברופונגי (נחמד, לא זול). יאקיטורי — שיפודי עוף על גחלים — הם אחד האוכלים הכי פופולריים ביפן לערבים.",
  23: "נוסעים לפוג׳י! נסענו לתחנת אודאווארה ואספנו רכב מ-Toyota Rent a Car. שעה ורבע נסיעה לקוואגוצ'יקו — אחד מחמשת אגמי הפוג׳י ואחד המקומות הכי טובים לצפייה בהר. הצטלמנו באגם, טיילנו סביב, אכלנו במסעדה חמודה על שפת האגם. בקוואגוצ'יקו מזג האוויר משתנה מהר, ומומלץ להגיע מוקדם בבוקר לסיכוי הכי טוב לראות את פוג׳י. חזרנו למלון למנוחה. בערב מסעדה איטלקית ליד המלון — נחמדה, טעימה, לא זולה. נהיגה ביפן הפוכה אך נוחה — הכבישים מסודרים והשילוט ברור, רק צריך לזכור שנוהגים בצד שמאל.",
  24: "קמנו לזריחה אבל ההר היה מעונן — זה קורה הרבה באזור פוג׳י, צריך מזל עם מזג האוויר (יש ערוץ יוטיוב שמשדר 24/7 מה מצב העננות בפוג׳י). חזרנו לישון ואחרי זה יצאנו לסיבוב. טוֹרי (100 ין, חמוד), פנקייקים ב-The Park ליד האגם (תור ענק, הכרנו את נור ואור), עוד כמה נקודות תצפית מסביב לאגם. מצאנו ראמן מדהים באיזה רחוב נידח. משם נסיעה להאקונה — אזור נופש מפורסם עם מעיינות חמים טבעיים (אונסן) ליד הר געש פעיל. בערב הגענו למלון עם אונסן וארוחת ערב בופה (נחמדה). האקונה נמצאת בפארק הלאומי פוג׳י-האקונה-איזו והיא מהיעדים הפופולריים ביותר ליפנים לסופי שבוע.",
  25: "יואב קם ב-05:30 — פתאום ראה שיש ראות מושלמת לפוג׳י! העיר את מיכלי והחלטנו שחוזרים לאזור של האגם ושלא מפספסים מזג אוויר שכזה. חזרנו לאגם קוואגוצ'י, מספר נקודות תצפית על פוג׳י, פגודת צ׳ורייטו — הספוט האיקוני שמופיע בכל תמונה של יפן עם הפגודה והר פוג׳י ברקע (צריך לעלות כ-400 מדרגות). עצרנו בסטארבקס עם נוף על ההר. בחזרה להאקונה עצרנו בגוטמבה פרימיום אאוטלטס — שווה! מותגים יפניים ובינלאומיים בהנחות משמעותיות, ואפשר לקנות דברים שלא קיימים במקומות אחרים. חזרנו למלון, אונסן בשקיעה משקיפה על הר פוג׳י — אחד הימים הכי יפים בטיול.",
  26: "בוקר במוזיאון הפתוח של האקונה — מוזיאון פיסול בחוץ עם נוף הררי, כולל אוסף של פיקאסו. נסענו לטוקיו, הגענו בצהריים. צהריים ב-HIRUKA רופונגי — אחד הארוחות הכי טובות בטיול! מנוחה, בערב הלכנו למופע אורות בבניין העירייה של טוקיו (Tokyo Metropolitan Government Building) עם תצפית חינמית מהקומה ה-45 — אלטרנטיבה מעולה וחינמית למגדל טוקיו או סקיי טרי. אחרי זה, סושי מסוע בשינג׳וקו ו-GIGO (זכינו במיו!). GIGO זה סיום יום חובה.",
  27: "התחלנו ב-BRICOLAGE רופונגי — מאפייה צרפתית-יפנית מדהימה, מהמקומות הכי טובים לארוחת בוקר בטוקיו. הלכנו לשינג׳וקו ולקחנו כרטיס בשין אודון (המתנה של 4 שעות!), בינתיים שופינג — MUJI, חנות של דיסני, ISTAN, ABC. חזרנו לשין אודון — טעים אבל extremely overrated ביחס להמתנה. האודון עצמו עבודת יד אמיתית וטרי, אבל 4 שעות זה מוגזם. מקדונלדס, ובערב מסיבת V2 ברופונגי — מטורפת! רופונגי בלילה הוא עולם אחר, עם חיי לילה תוססים שנמשכים עד השעות הקטנות.",
  28: "בוקר באיקבוקורו — סאנשיין סיטי, אזור קניות ובידור ענק. אחה״צ אקווריום, צהריים (יואב ראמן, מיכלי הודי — מפתיע אבל יש אוכל הודי מעולה ביפן). הלכנו לקפאבאשי עם נור ואור — רחוב כלי המטבח, כמובן עוד סכינים ליואב (אחלה מתנה). בערב קורה סושי באסאקוסה עם נור ואור — סושי מסוע זול אוטומטי, והסושי היה נורא! קורה סושי הוא רשת זולה ולא מייצגת סושי יפני אמיתי.",
  29: "בוקר בסטארבקס של נאקה-מגורו — סניף מיוחד של סטארבקס עם שיטות הכנה ייחודיות ופולים נדירים, על תעלת מגורו שהיא מהמקומות הכי יפים בטוקיו במיוחד בעונת הסאקורה. אחה״צ ראמן HAYASHI שהיה מעולה — מהראמניות הכי טובות שאכלנו בטיול. קניות ביוניקלו ודונקי (ממתקים ומזכרות — דונקי הוא חנות דיסקאונט יפנית כאוטית ומגניבה שאפשר ללכת לאיבוד בה שעות). בערב ARIA — מסעדה איטלקית ברופונגי.",
  30: "BRICOLAGE שוב — כי מאפייה כזו שווה פעמיים. קניות בסאנשיין סיטי. אחה״צ יאקיניקו ברופונגי (בשר על גריל שאתה צולה בעצמך — אחד הדברים הכי כיפיים לאכול ביפן בחבורה), נאקה-מגורו שוב, וסושי עמידה בשיבויה — חוויה אמיתית, השף מכין מולך ואתה אוכל ישר. בערב גולדן גאי פעם שנייה, כל ביקור מגלים בר אחר. סיימנו ב-GIGO. היום האחרון המלא בטוקיו לפני הסיום — תחושה של בית.",
  31: "היום האחרון! הלכנו לשינג׳וקו גויין — חזרנו לגן שפתח לנו את הטיול, הפעם לסגור מעגל. המשכנו להאראג׳וקו אחרון ואכלנו AFURI אחרון — הראמן שהתחיל את הטיול גם סיים אותו. 31 ימים ביפן, מטוקיו דרך הרי האלפים, קנזוואה, אוסקה, קיוטו, הר פוג׳י וחזרה. נסענו לשדה התעופה עם לב כבד ותיקים מלאים. להתראות יפן — מאתא נה.",
};

/* ──────────────────────────────────────────────
   Areas Explored — districts/neighborhoods visited per day.
   Rendered in both the collapsed and expanded summary bars
   so the user sees at a glance which parts of the city the
   day covered (e.g. "Harajuku · Shibuya" for Day 1).
   ────────────────────────────────────────────── */
const dayAreas = {
  1:  ["Harajuku", "Shibuya", "Roppongi"],
  2:  ["Shinjuku", "Golden Gai"],
  3:  ["Maihama (Disneyland)"],
  4:  ["Maihama (DisneySea)", "Shinjuku"],
  5:  ["Roppongi", "Shibuya", "Shinjuku"],
  6:  ["Kanazawa Center"],
  7:  ["Shirakawa-go", "Takayama"],
  8:  ["Hirayu Onsen", "Matsumoto"],
  9:  ["Matsumoto", "Nagoya"],
  10: ["Osaka Castle", "Namba"],
  11: ["Universal Studios"],
  12: ["Namba", "Dotonbori"],
  13: ["Nara Park"],
  14: ["Gion", "Higashiyama"],
  15: ["Fushimi", "Nishiki"],
  16: ["Central Kyoto"],
  17: ["Arashiyama", "Kinkaku-ji", "Higashiyama"],
  18: ["Higashiyama"],
  19: ["Harajuku", "Shimokitazawa"],
  20: ["Ueno", "Asakusa (Kappabashi)"],
  21: ["Shibuya", "Akihabara", "Shinjuku"],
  22: ["Toyosu", "Odaiba", "Ginza"],
  23: ["Odawara", "Kawaguchiko"],
  24: ["Hakone"],
  25: ["Kawaguchiko", "Gotemba", "Hakone"],
  26: ["Hakone", "Roppongi", "Shinjuku"],
  27: ["Roppongi", "Shinjuku"],
  28: ["Ikebukuro", "Asakusa"],
  29: ["Nakameguro", "Shibuya", "Roppongi"],
  30: ["Roppongi", "Nakameguro", "Shibuya", "Shinjuku"],
  31: ["Shinjuku", "Harajuku"],
};

const DayCard = forwardRef(({ data, isSelected, onClick, onSelectLocation, activeFilter, onOpenDetail }, ref) => {
  const lodgingInfo = lodgingOverrides[data.day];

  return (
    <div
      ref={ref}
      onClick={onClick}
      style={{ scrollMarginTop: "2rem" }}
      className={`
        group relative rounded-xl cursor-pointer overflow-hidden
        transition-all duration-400 ease-out border
        ${isSelected
          ? "bg-cream-50 border-vermillion-300 shadow-xl shadow-vermillion-100/40 ring-2 ring-vermillion-400/20"
          : "bg-cream-50/80 border-cream-300 hover:border-vermillion-200 hover:shadow-lg hover:bg-cream-50"
        }
      `}
    >
      {/* ===== HERO ILLUSTRATION ===== */}
      <HeroIllustration
        city={data.city}
        day={data.day}
        title={data.title}
        cityHe={data.cityHe}
        isExpanded={isSelected}
        attractionCount={data.attractions?.length || 0}
        onOpenDetail={onOpenDetail}
        deepDive={deepDiveNarratives[data.day]}
      />

      {/* ===== COLLAPSED TIMELINE ===== */}
      {!isSelected && (
        <CollapsedTimeline data={data} lodgingInfo={lodgingInfo} />
      )}

      {/* ===== EXPANDED CONTENT ===== */}
      {isSelected && (
        <div className="px-3 sm:px-5 pb-4 sm:pb-5 pt-3 sm:pt-4">
          {/* ── Timeline-style Header Summary (Iteration 4 — Task 1) ── */}
          <ExpandedTimelineHeader data={data} lodgingInfo={lodgingInfo} />

          {/* Decorative divider */}
          <div className="flex items-center gap-2 mb-4">
            <div className="h-px flex-1 bg-vermillion-200" />
            <span className="text-[10px] text-sumi-300 font-body">～ 詳細 ～</span>
            <div className="h-px flex-1 bg-vermillion-200" />
          </div>

          {/* ═══════════════════════════════════════════════════════════
              INNER VIEW (Task 4) — ordered detailed list:
                ① Daily activities
                ② Lunch location
                ③ Attractions
                ④ Dinner location
                ⑤ Accommodation
              ═══════════════════════════════════════════════════════════ */}

          {/* ①  DAILY ACTIVITIES — narrative summary of the day.
                The ENTIRE container is one click target. Clicking anywhere
                inside opens the "Read Full Info" DetailModal. stopPropagation
                prevents the click from bubbling to the parent Day Card and
                collapsing it. */}
          {deepDiveNarratives[data.day] && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                if (onOpenDetail) {
                  onOpenDetail({
                    name: `Day ${data.day} — Daily Activities`,
                    nameJa: "日中の活動",
                    nameHe: data.title,
                    desc: deepDiveNarratives[data.day],
                    day: data.day,
                    city: data.city,
                    cityHe: data.cityHe,
                    category: "attraction",
                    rating: null,
                    coordinates: data.coordinates,
                  });
                }
              }}
              className="block w-full text-left mb-5 bg-gradient-to-br from-vermillion-50 to-cream-100 rounded-xl p-4 border border-vermillion-200 cursor-zoom-in transition-all duration-200 hover:border-vermillion-300 hover:shadow-md active:scale-[0.995] group/daily"
              title="Open full daily activities"
            >
              <div className="flex items-center justify-between gap-2 mb-2">
                <div className="flex items-center gap-2">
                  <Icons.compass size={15} color="#D94025" />
                  <span className="text-[11px] font-display font-bold text-vermillion-600 uppercase tracking-wider">Daily Activities</span>
                  <span className="text-[10px] font-body text-sumi-300">日中の活動</span>
                </div>
                <span className="text-[10px] font-display font-semibold text-vermillion-500 group-hover/daily:text-vermillion-700 transition-colors inline-flex items-center gap-1">
                  Read Full Info
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <line x1="7" y1="17" x2="17" y2="7"/><polyline points="7 7 17 7 17 17"/>
                  </svg>
                </span>
              </div>
              <p className="text-[12px] text-sumi-600 font-body leading-relaxed line-clamp-3" dir="rtl">
                {deepDiveNarratives[data.day]}
              </p>
            </button>
          )}

          {/* ②  LUNCH LOCATION */}
          {data.lunch && data.lunch.place && data.lunch.place !== "—" && (
            <div className={`mb-5 rounded-xl p-2 -mx-2 transition-all duration-300 ${activeFilter === "food" ? "bg-gold-50/50 ring-1 ring-gold-100" : ""}`}>
              <FoodSection label="Lunch" labelJa="昼食" data={data.lunch}
                accentColor="text-gold-400" bgColor="bg-gold-50" borderColor="border-gold-100"
                onSelectLocation={onSelectLocation} onOpenDetail={onOpenDetail} dayNum={data.day} city={data.city} cityHe={data.cityHe} deepDive={deepDiveNarratives[data.day]} />
            </div>
          )}

          {/* ③  ATTRACTIONS */}
          {data.attractions && data.attractions.length > 0 && (
            <div className={`mb-5 rounded-xl p-2 -mx-2 transition-all duration-300 ${activeFilter === "attractions" ? "bg-vermillion-50/50 ring-1 ring-vermillion-200" : ""}`}>
              <div className="flex items-center gap-2 mb-3">
                <Icons.torii size={16} color="#D94025" />
                <span className="text-[11px] font-display font-bold text-vermillion-600 uppercase tracking-wider">Attractions</span>
                <span className="text-[10px] font-body text-sumi-300">観光スポット</span>
              </div>
              <div className="space-y-1">
                {data.attractions.map((a, i) => (
                  <AttractionItem key={i} attraction={a} onSelectLocation={onSelectLocation} onOpenDetail={onOpenDetail} dayNum={data.day} city={data.city} cityHe={data.cityHe} deepDive={deepDiveNarratives[data.day]} />
                ))}
              </div>
            </div>
          )}

          {/* ④  DINNER LOCATION */}
          {data.dinner && data.dinner.place && data.dinner.place !== "—" && (
            <div className={`mb-5 rounded-xl p-2 -mx-2 transition-all duration-300 ${activeFilter === "food" ? "bg-vermillion-50/50 ring-1 ring-vermillion-100" : ""}`}>
              <FoodSection label="Dinner" labelJa="夕食" data={data.dinner}
                accentColor="text-vermillion-500" bgColor="bg-vermillion-50" borderColor="border-vermillion-100"
                onSelectLocation={onSelectLocation} onOpenDetail={onOpenDetail} dayNum={data.day} city={data.city} cityHe={data.cityHe} deepDive={deepDiveNarratives[data.day]} />
            </div>
          )}

          {/* ⑤  ACCOMMODATION (Hotel + Expenses) */}
          <div className="mb-4">
            <div className="flex items-center gap-2 mb-3">
              <Icons.bed size={15} color="#57534E" />
              <span className="text-[11px] font-display font-bold text-sumi-600 uppercase tracking-wider">Accommodation</span>
              <span className="text-[10px] font-body text-sumi-300">宿泊</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {data.hotel && data.hotel !== "—" && (
                <div
                  className="bg-cream-100 rounded-xl p-3 border border-cream-200"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="flex items-center gap-1.5 mb-1">
                    <Icons.bed size={13} color="#57534E" />
                    <span className="text-[10px] font-display font-bold text-sumi-600 uppercase tracking-wider">
                      {lodgingInfo ? "Overnight Stay" : "Hotel"}
                    </span>
                    <span className="text-[9px] font-body text-sumi-300">ホテル</span>
                  </div>
                  <div>
                    {/* Hotel name: FOCUS-ONLY map action.
                        Pans+zooms the map to the hotel coordinates but
                        intentionally does NOT open the sub-location popup
                        and does NOT spawn the detail modal. Navigation is
                        decoupled from popup-trigger for this element.
                        stopPropagation keeps the Day Card expanded. */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        // Prefer the hotel's canonical coordinates when
                        // known; fall back to the day-centre coordinates
                        // so every hotel at least lands the user in the
                        // right neighbourhood.
                        const hotelCoord =
                          HOTEL_COORDINATES[data.hotel] || data.coordinates;
                        if (onSelectLocation && hotelCoord) {
                          onSelectLocation({
                            lng: hotelCoord.lng,
                            lat: hotelCoord.lat,
                            name: data.hotel,
                            focusOnly: true,
                          });
                        }
                      }}
                      className="block text-left w-full text-xs text-sumi-700 font-display font-semibold hover:text-vermillion-600 transition-colors cursor-pointer"
                    >
                      {data.hotel}
                    </button>
                    <GoogleMapsLink name={data.hotel} label="Google Maps" />
                  </div>
                  {lodgingInfo && (
                    <p className="text-[10px] text-sumi-400 mt-1 font-body">
                      📍 {lodgingInfo.lodgingCity} <span dir="rtl">{lodgingInfo.lodgingCityHe}</span>
                    </p>
                  )}
                </div>
              )}
              {data.expenses && (
                <div className="bg-cream-100 rounded-xl p-3 border border-cream-200">
                  <div className="flex items-center gap-1.5 mb-1">
                    <Icons.wallet size={13} color="#5C7A2E" />
                    <span className="text-[10px] font-display font-bold text-matcha-500 uppercase tracking-wider">Expenses</span>
                    <span className="text-[9px] font-body text-sumi-300">費用</span>
                  </div>
                  <p className="text-xs text-sumi-700 font-body"><span className="font-semibold">Accommodation:</span> {data.expenses.accommodation}</p>
                  <p className="text-[11px] text-sumi-400 mt-0.5 font-body">{data.expenses.highlights}</p>
                </div>
              )}
            </div>
          </div>

          {/* ===== TIPS (supplementary, kept at the bottom) ===== */}
          {data.tips && data.tips.length > 0 && (
            <div className="mb-2 bg-cream-100 rounded-xl p-3 border border-cream-300">
              <div className="flex items-center gap-2 mb-2">
                <Icons.lightbulb size={14} color="#78716C" />
                <span className="text-[11px] font-display font-bold text-sumi-600 uppercase tracking-wider">Tips</span>
                <span className="text-[10px] font-body text-sumi-300">ヒント</span>
              </div>
              <ul className="space-y-1.5" dir="rtl">
                {data.tips.map((tip, i) => (
                  <li key={i} className="flex items-start gap-2 text-[11px] text-sumi-600 font-body">
                    <span className="text-vermillion-400 mt-0.5 flex-shrink-0 text-[10px]">▸</span>
                    <span>{tip}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

        </div>
      )}
    </div>
  );
});

DayCard.displayName = "DayCard";
export default DayCard;
