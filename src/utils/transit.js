/* ══════════════════════════════════════════════════════════════
   transit.js — automated proximity transit (spec §7).

   computeTransit(a, b) returns the segment between two coordinate
   nodes:
     • distance < 1.5 km → Walking (הליכה), 🚶, ~5 km/h
     • distance ≥ 1.5 km → Public transit / train (תחבורה ציבורית),
                           🚆, ~30 km/h estimate
   Returns null when a coordinate is missing.

   The user can later override the mode via the timeline badge; an
   explicit `override` mode short-circuits the auto-classification
   while keeping the computed distance.
   ══════════════════════════════════════════════════════════════ */

import { haversineKm } from "../data/tripHelpers";

const WALK_THRESHOLD_KM = 1.5;
const WALK_SPEED_KMH = 5;
const TRANSIT_SPEED_KMH = 30;
const CAR_SPEED_KMH = 40;

export const TRANSIT_MODES = {
  walk:    { he: "הליכה",            emoji: "🚶", speed: WALK_SPEED_KMH },
  transit: { he: "תחבורה ציבורית",  emoji: "🚆", speed: TRANSIT_SPEED_KMH },
  car:     { he: "מונית / רכב",      emoji: "🚕", speed: CAR_SPEED_KMH },
};

const fmtDist = (km) =>
  km < 1 ? `${Math.round(km * 1000)} מ׳` : `${km.toFixed(1)} ק״מ`;

const minutesFor = (km, speedKmh) => Math.max(1, Math.round((km / speedKmh) * 60));

/* override: optional mode key ('walk' | 'transit' | 'car') to force. */
export const computeTransit = (a, b, override = null) => {
  const km = haversineKm(a, b);
  if (km == null) return null;

  let mode = override;
  if (!mode) mode = km < WALK_THRESHOLD_KM ? "walk" : "transit";

  const meta = TRANSIT_MODES[mode] || TRANSIT_MODES.transit;
  const minutes = minutesFor(km, meta.speed);

  return {
    mode,
    he: meta.he,
    emoji: meta.emoji,
    km,
    distLabel: fmtDist(km),
    minutes,
    minutesLabel: `${minutes} דק׳`,
    overridden: !!override,
  };
};

export default computeTransit;
