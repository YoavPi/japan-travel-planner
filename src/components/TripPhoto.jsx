import React, { useState } from "react";
import { CityIllustrations } from "../data/illustrations";

/* ══════════════════════════════════════════════════════════════
   TRIP PHOTO COMPONENT
   ──────────────────────────────────────────────────────────────
   Displays a local trip photo with a graceful fallback to
   the minimalist vermillion/cream line-art illustration.
   ══════════════════════════════════════════════════════════════ */

/* ── Fallback line-art placeholder ── */
const LineFallback = ({ city, className = "" }) => {
  const cityBase = city?.replace(/ \d+$/, "").replace(/Tokyo.*/, "Tokyo").replace(/Osaka.*/, "Osaka");
  const CityArt = CityIllustrations[cityBase] || CityIllustrations.Tokyo;

  return (
    <div className={`flex items-center justify-center bg-gradient-to-br from-cream-100 to-cream-200 ${className}`}>
      <div className="opacity-30">
        <CityArt size={80} color="#D94025" />
      </div>
    </div>
  );
};

/* ── Main TripPhoto component ── */
const TripPhoto = ({
  src,
  alt = "Trip photo",
  city = "Tokyo",
  className = "",
  objectFit = "cover",
  fallbackClassName = "",
}) => {
  const [hasError, setHasError] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);

  // No src provided → show fallback
  if (!src) {
    return <LineFallback city={city} className={`${className} ${fallbackClassName}`} />;
  }

  return (
    <div className={`relative overflow-hidden ${className}`}>
      {/* Line-art placeholder while loading or on error */}
      {(!isLoaded || hasError) && (
        <LineFallback
          city={city}
          className={`absolute inset-0 ${fallbackClassName}`}
        />
      )}

      {/* Actual photo */}
      {!hasError && (
        <img
          src={src}
          alt={alt}
          onLoad={() => setIsLoaded(true)}
          onError={() => setHasError(true)}
          className={`w-full h-full transition-opacity duration-500 ${
            isLoaded ? "opacity-100" : "opacity-0"
          }`}
          style={{ objectFit }}
          loading="lazy"
        />
      )}
    </div>
  );
};

export default TripPhoto;
export { LineFallback };
