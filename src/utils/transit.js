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
const BUS_SPEED_KMH = 22;

/* Sprint 30 — the four inline commute modes offered by the auto rail
   cycle: walking, driving/taxi, train, bus. `order` drives the compact
   mode menu; each carries an estimated speed for the duration metadata. */
export const TRANSIT_MODES = {
  walk:    { he: "הליכה",       emoji: "🚶", speed: WALK_SPEED_KMH },
  car:     { he: "רכב / מונית", emoji: "🚗", speed: CAR_SPEED_KMH },
  transit: { he: "רכבת",        emoji: "🚆", speed: TRANSIT_SPEED_KMH },
  bus:     { he: "אוטובוס",     emoji: "🚌", speed: BUS_SPEED_KMH },
};

/* Cycle order for the compact inline menu. */
export const TRANSIT_MODE_ORDER = ["walk", "car", "transit", "bus"];

const KM_PER_MILE = 1.60934;

const fmtDist = (km, units = "km") => {
  if (units === "mi") {
    const mi = km / KM_PER_MILE;
    return mi < 1 ? `${Math.round(mi * 5280)} ft` : `${mi.toFixed(1)} mi`;
  }
  return km < 1 ? `${Math.round(km * 1000)} מ׳` : `${km.toFixed(1)} ק״מ`;
};

const minutesFor = (km, speedKmh) => Math.max(1, Math.round((km / speedKmh) * 60));

/* override: optional mode key ('walk' | 'transit' | 'car') to force.
   units: 'km' (default) | 'mi' — controls the distance label only. */
export const computeTransit = (a, b, override = null, units = "km") => {
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
    distLabel: fmtDist(km, units),
    minutes,
    minutesLabel: `${minutes} דק׳`,
    overridden: !!override,
  };
};

export default computeTransit;
