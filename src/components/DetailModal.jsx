import React, { useEffect, useState, useCallback, useMemo } from "react";
import { createPortal } from "react-dom";
import TripPhoto, { LineFallback } from "./TripPhoto";
import { getLocationPhoto, getDayPhoto } from "../data/photoMap";
import { ActivityIcons } from "../data/illustrations";
import { vibeDescriptions } from "../data/landmarkImages";
import { tripData } from "../data/tripData";

/* ══════════════════════════════════════════════════════════════
   DETAIL MODAL — "Nori" Style
   ──────────────────────────────────────────────────────────────
   Portal-based modal with:
   • Semi-transparent overlay with backdrop blur
   • Cream card, thick vermillion border
   • Split layout: image + rich content
   • Lightbox mode for image expansion
   • Close via X, Escape, click-outside
   • Fade-in animation
   • Fully responsive (vertical on mobile)
   ══════════════════════════════════════════════════════════════ */

/* ── Google Maps URL helper ── */
const gmapsUrl = (name) =>
  `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(name + " Japan")}`;

/* ── Activity icon picker ── */
const getActivityIcon = (name) => {
  if (!name) return ActivityIcons.walk;
  const n = name.toLowerCase();
  if (n.includes("shrine") || n.includes("temple") || n.includes("inari") || n.includes("pagoda") || n.includes("todai")) return ActivityIcons.shrine;
  if (n.includes("park") || n.includes("gyoen") || n.includes("garden") || n.includes("bamboo")) return ActivityIcons.park;
  if (n.includes("coffee") || n.includes("café") || n.includes("cafe") || n.includes("starbucks")) return ActivityIcons.coffee;
  if (n.includes("onsen") || n.includes("hot spring")) return ActivityIcons.onsen;
  if (n.includes("market") || n.includes("don quijote") || n.includes("parco") || n.includes("muji") || n.includes("outlet") || n.includes("uniqlo") || n.includes("kappabashi")) return ActivityIcons.shopping;
  if (n.includes("view") || n.includes("tower") || n.includes("crossing") || n.includes("teamlab")) return ActivityIcons.viewpoint;
  if (n.includes("ramen") || n.includes("food") || n.includes("sushi") || n.includes("soba") || n.includes("gyoza") || n.includes("yakitori") || n.includes("katsu")) return ActivityIcons.food;
  return ActivityIcons.walk;
};

/* ── Category label helper ── */
const getCategoryLabel = (category) => {
  switch (category) {
    case "attraction": return { en: "Attraction", ja: "観光", color: "text-vermillion-600", bg: "bg-vermillion-50", border: "border-vermillion-200" };
    case "lunch": return { en: "Lunch", ja: "昼食", color: "text-gold-700", bg: "bg-gold-50", border: "border-gold-200" };
    case "dinner": return { en: "Dinner", ja: "夕食", color: "text-vermillion-600", bg: "bg-vermillion-50", border: "border-vermillion-200" };
    case "hotel": return { en: "Hotel", ja: "ホテル", color: "text-sumi-600", bg: "bg-cream-100", border: "border-cream-300" };
    case "shopping": return { en: "Shopping", ja: "買物", color: "text-sumi-600", bg: "bg-cream-100", border: "border-cream-300" };
    default: return { en: "Location", ja: "場所", color: "text-sumi-600", bg: "bg-cream-100", border: "border-cream-300" };
  }
};

/* ── Close X icon ── */
const CloseX = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#D94025" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
  </svg>
);

/* ── Star icon ── */
const StarIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="#C4A048" stroke="#C4A048" strokeWidth="1.5">
    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
  </svg>
);

/* ── Google Maps pin icon ── */
const GoogleMapsIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="#4285F4">
    <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5a2.5 2.5 0 1 1 0-5 2.5 2.5 0 0 1 0 5z" />
  </svg>
);

/* ══════════════════════════════════════════════════════════════
   LIGHTBOX — Full-screen image viewer
   ══════════════════════════════════════════════════════════════ */
const Lightbox = ({ src, alt, onClose }) => (
  <div
    className="fixed inset-0 z-[110] bg-sumi-900/90 flex items-center justify-center cursor-zoom-out"
    onClick={onClose}
    style={{ animation: "modalFadeIn 0.2s ease-out" }}
  >
    <button
      onClick={onClose}
      className="absolute top-4 right-4 w-11 h-11 rounded-full bg-cream-50/20 hover:bg-cream-50/40 flex items-center justify-center transition-colors z-10"
    >
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#FDFBF5" strokeWidth="2" strokeLinecap="round">
        <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
      </svg>
    </button>
    <img
      src={src}
      alt={alt}
      className="max-w-[92vw] max-h-[90vh] object-contain rounded-lg shadow-2xl"
      onClick={(e) => e.stopPropagation()}
    />
  </div>
);

/* ══════════════════════════════════════════════════════════════
   MAIN DETAIL MODAL
   ══════════════════════════════════════════════════════════════ */
const DetailModal = ({ data, onClose, onSelectDay, onSelectLocation }) => {
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [isVisible, setIsVisible] = useState(false);

  // Fade-in on mount
  useEffect(() => {
    requestAnimationFrame(() => setIsVisible(true));
  }, []);

  // Escape key handler
  useEffect(() => {
    const handleKey = (e) => {
      if (e.key === "Escape") {
        if (lightboxOpen) setLightboxOpen(false);
        else onClose();
      }
    };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [onClose, lightboxOpen]);

  // Prevent body scroll
  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, []);

  // Safe destructuring: `data` may be null on first render.
  const {
    name, nameJa, nameHe, desc, day, city, cityHe,
    category, rating
  } = data || {};

  // Curated `desc` from tripData wins; `vibeDescriptions` is fallback only.
  const vibe = desc || (name ? vibeDescriptions[name] : null);

  /* ── Build clickable location index for this day ──
     Pulls every attraction/lunch/dinner with coordinates from tripData,
     excludes the current modal subject (no self-link). */
  const locationLinks = useMemo(() => {
    if (!day) return [];
    const dayData = tripData.find((d) => d.day === day);
    if (!dayData) return [];
    const items = [];
    (dayData.attractions || []).forEach((a) => items.push(a));
    if (dayData.lunch) items.push(dayData.lunch);
    if (dayData.dinner) items.push(dayData.dinner);
    return items.filter(
      (it) => it && it.coordinates && it.name && it.name !== name
    );
  }, [day, name]);

  /* ── Click handler: three-way sync ── */
  const handleLocationClick = useCallback(
    (item, e) => {
      e.stopPropagation();
      if (onSelectDay) onSelectDay(day);
      if (onSelectLocation && item.coordinates) {
        onSelectLocation({
          lng: item.coordinates.lng,
          lat: item.coordinates.lat,
          name: item.name,
        });
      }
      onClose();
    },
    [day, onSelectDay, onSelectLocation, onClose]
  );

  /* ── Tokenize the narrative ── */
  const renderedVibe = useMemo(() => {
    if (!vibe) return null;
    if (!locationLinks.length) return vibe;

    const termMap = new Map();
    locationLinks.forEach((item) => {
      if (item.nameHe && item.nameHe.length >= 2) termMap.set(item.nameHe, item);
      if (item.name && item.name.length >= 3 && !termMap.has(item.name)) {
        termMap.set(item.name, item);
      }
    });

    const terms = Array.from(termMap.keys()).sort((a, b) => b.length - a.length);
    if (!terms.length) return vibe;

    const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const pattern = new RegExp("(" + terms.map(escapeRe).join("|") + ")", "g");
    const parts = vibe.split(pattern);

    return parts.map((part, i) => {
      const item = termMap.get(part);
      if (item) {
        return (
          <button
            key={i}
            onClick={(e) => handleLocationClick(item, e)}
            className="text-vermillion-600 font-semibold underline decoration-vermillion-300 decoration-2 underline-offset-2 hover:text-vermillion-700 hover:decoration-vermillion-500 cursor-pointer transition-colors inline"
            title={`View ${item.name} on map`}
          >
            {part}
          </button>
        );
      }
      return <React.Fragment key={i}>{part}</React.Fragment>;
    });
  }, [vibe, locationLinks, handleLocationClick]);

  if (!data) return null;

  const photoSrc = getLocationPhoto(name) || getDayPhoto(day, city);
  const categoryInfo = getCategoryLabel(category);
  const IconComp = getActivityIcon(name);

  const handleOverlayClick = (e) => {
    if (e.target === e.currentTarget) onClose();
  };

  const modalContent = (
    <>
      {/* ── Overlay ── */}
      <div
        className={`fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-6 transition-all duration-300 ${
          isVisible ? "bg-sumi-900/60 backdrop-blur-sm" : "bg-transparent"
        }`}
        onClick={handleOverlayClick}
        style={{ animation: "modalFadeIn 0.25s ease-out" }}
      >
        {/* ── Modal Card ── */}
        <div
          className={`relative bg-cream-50 rounded-2xl border-2 border-vermillion-400 shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col transition-all duration-300 ${
            isVisible ? "opacity-100 scale-100" : "opacity-0 scale-95"
          }`}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Top accent bar */}
          <div className="h-1.5 bg-gradient-to-r from-vermillion-400 via-vermillion-500 to-vermillion-400 flex-shrink-0" />

          {/* Close button */}
          <button
            onClick={onClose}
            className="absolute top-4 right-4 z-20 w-10 h-10 rounded-full bg-cream-50/90 hover:bg-vermillion-50 border border-cream-300 hover:border-vermillion-300 flex items-center justify-center transition-all duration-200 shadow-sm"
            title="Close"
          >
            <CloseX />
          </button>

          {/* Scrollable content */}
          <div className="flex-1 overflow-y-auto overscroll-contain scrollbar-thin">
            {/* ═══ SPLIT LAYOUT: Image + Content ═══ */}
            <div className="flex flex-col md:flex-row">

              {/* ── Left: Image ── */}
              <div className="md:w-2/5 flex-shrink-0">
                <div
                  className={`relative w-full h-56 md:h-full md:min-h-[400px] ${photoSrc ? "cursor-zoom-in" : ""}`}
                  onClick={() => photoSrc && setLightboxOpen(true)}
                >
                  {photoSrc ? (
                    <TripPhoto
                      src={photoSrc}
                      alt={name}
                      city={city}
                      className="w-full h-full"
                      objectFit="cover"
                    />
                  ) : (
                    <LineFallback city={city} className="w-full h-full" />
                  )}
                  {/* Expand hint */}
                  {photoSrc && (
                    <div className="absolute bottom-3 right-3 bg-sumi-900/50 text-cream-50 rounded-lg px-2.5 py-1 text-[10px] font-display font-semibold flex items-center gap-1.5 opacity-0 hover:opacity-100 transition-opacity">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                        <polyline points="15 3 21 3 21 9" /><polyline points="9 21 3 21 3 15" />
                        <line x1="21" y1="3" x2="14" y2="10" /><line x1="3" y1="21" x2="10" y2="14" />
                      </svg>
                      Expand
                    </div>
                  )}
                </div>
              </div>

              {/* ── Right: Content ── */}
              <div className="md:w-3/5 p-5 md:p-6">
                {/* Category badge + Day badge */}
                <div className="flex items-center gap-2 flex-wrap mb-3">
                  <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-display font-bold ${categoryInfo.bg} ${categoryInfo.color} border ${categoryInfo.border}`}>
                    <IconComp size={13} color="currentColor" />
                    {categoryInfo.en}
                    <span className="opacity-60 font-body">{categoryInfo.ja}</span>
                  </span>
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-display font-semibold bg-vermillion-50 text-vermillion-600 border border-vermillion-200">
                    Day {day}
                  </span>
                  {rating && rating !== "—" && (
                    <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-display font-bold bg-gold-50 text-gold-700 border border-gold-200">
                      <StarIcon />
                      {rating}
                    </span>
                  )}
                </div>

                {/* Trilingual name */}
                <div className="mb-4">
                  {nameJa && (
                    <p className="text-sm font-body text-sumi-400 mb-0.5">{nameJa}</p>
                  )}
                  <h2 className="text-xl md:text-2xl font-display font-black text-sumi-800 leading-tight">
                    {name}
                  </h2>
                  {nameHe && (
                    <p className="text-sm font-body text-sumi-400 mt-1" dir="rtl">{nameHe}</p>
                  )}
                </div>

                {/* City info */}
                <div className="flex items-center gap-2 mb-4 text-xs font-body text-sumi-500">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#D94025" strokeWidth="1.5" strokeLinecap="round">
                    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" /><circle cx="12" cy="10" r="3" />
                  </svg>
                  <span className="font-display font-semibold text-sumi-700">{city}</span>
                  {cityHe && <span dir="rtl">{cityHe}</span>}
                </div>

                {/* Hebrew vibe description (2-3 sentences — single source of truth) */}
                {vibe && (
                  <div className="mb-4 bg-cream-100 rounded-xl p-4 border border-cream-200">
                    <div className="text-[14px] font-body text-sumi-700 leading-relaxed" dir="rtl">
                      {renderedVibe}
                    </div>
                  </div>
                )}

                {/* Short subtitle description (fallback / supplementary) */}
                {desc && desc !== vibe && (
                  <div className={`mb-4 ${vibe ? "" : "bg-cream-100 rounded-xl p-3 border border-cream-200"}`}>
                    <p className={`text-[12px] font-body leading-relaxed ${vibe ? "text-sumi-500 italic" : "text-sumi-700"}`} dir="rtl">
                      {desc}
                    </p>
                  </div>
                )}

                {/* Deep Dive narrative removed — modal now focuses on
                    name, category/city, short summary, and Google Maps. */}

                {/* Google Maps button */}
                <a
                  href={gmapsUrl(name)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2.5 px-5 py-3 rounded-xl bg-white border-2 border-cream-300 hover:border-blue-300 hover:shadow-md text-sm font-display font-bold text-sumi-700 hover:text-blue-600 transition-all duration-200 group min-h-[44px]"
                >
                  <GoogleMapsIcon />
                  <span>View on Google Maps</span>
                  <span className="text-sumi-300 group-hover:text-blue-400 transition-colors">↗</span>
                </a>
              </div>
            </div>
          </div>

          {/* Bottom accent bar */}
          <div className="h-1 bg-gradient-to-r from-vermillion-400 via-vermillion-500 to-vermillion-400 flex-shrink-0" />
        </div>
      </div>

      {/* ── Lightbox overlay ── */}
      {lightboxOpen && photoSrc && (
        <Lightbox
          src={photoSrc}
          alt={name}
          onClose={() => setLightboxOpen(false)}
        />
      )}

      {/* ── Keyframe animation ── */}
      <style>{`
        @keyframes modalFadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
      `}</style>
    </>
  );

  return createPortal(modalContent, document.body);
};

export default DetailModal;
