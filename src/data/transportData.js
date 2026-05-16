/* ══════════════════════════════════════════════════════════════
   CITY TRANSITIONS — when & where each inter-city leg renders.

   Each entry carries an `anchor` describing where the transit
   card should land inside the timeline:

     { kind: "afterHeader", day: 6 }
         → renders directly under day 6's date header (before
           any day-6 stop). Default for most transits.

     { kind: "afterStop", day: 9, stopName: "CAFE SWEET Nawate Street" }
         → renders inside day 9 immediately after the named stop.

     { kind: "afterDayEnd", day: 31 }
         → appended at the very end of day 31 (after the hotel
           anchor, or — for the final day — after the last stop
           when no hotel exists).

   `afterDay` was the legacy positioning; we keep it on disk as a
   hint for migration but storyBuilder reads `anchor` exclusively.
   ══════════════════════════════════════════════════════════════ */

export const cityTransitions = [
  {
    fromCity: "Tokyo", fromCityHe: "טוקיו",
    toCity:   "Kanazawa", toCityHe: "קנזאווה",
    anchor:   { kind: "afterHeader", day: 6 },
    mode: "Shinkansen", modeJa: "北陸新幹線",
    duration: "~2.5 hours", icon: "shinkansen",
  },
  {
    fromCity: "Kanazawa", fromCityHe: "קנזאווה",
    toCity:   "Takayama", toCityHe: "טקיאמה",
    anchor:   { kind: "afterHeader", day: 7 },
    mode: "Bus", modeJa: "高速バス",
    duration: "~2 hours", icon: "bus",
  },
  {
    fromCity: "Takayama", fromCityHe: "טקיאמה",
    toCity:   "Matsumoto", toCityHe: "מטסומוטו",
    anchor:   { kind: "afterHeader", day: 8 },
    mode: "Train", modeJa: "JR特急",
    duration: "~1.5 hours", icon: "train",
  },
  {
    /* Special: this leg lands INSIDE day 9 after the CAFE SWEET
       breakfast. Logically: walk CAFE SWEET → Matsumoto station,
       Shinkansen to Nagoya, walk Nagoya station → Shishimaru. */
    fromCity: "Matsumoto", fromCityHe: "מטסומוטו",
    toCity:   "Nagoya",    toCityHe: "נגויה",
    anchor:   { kind: "afterStop", day: 9, stopName: "CAFE SWEET Nawate Street" },
    mode: "Shinkansen", modeJa: "東海道新幹線",
    duration: "~2 hours", icon: "shinkansen",
    note: "כולל הליכה למתחנה + שינקנסן + הליכה לראמן",
  },
  {
    fromCity: "Nagoya", fromCityHe: "נגויה",
    toCity:   "Osaka",  toCityHe: "אוסקה",
    anchor:   { kind: "afterHeader", day: 10 },
    mode: "Shinkansen", modeJa: "東海道新幹線",
    duration: "~1 hour", icon: "shinkansen",
  },
  {
    /* NEW: explicit Osaka → Nara leg on day 13. The trip's lodging
       stays in Osaka but the day's activities are in Nara, so we
       surface the train hop under the day-13 header. */
    fromCity: "Osaka", fromCityHe: "אוסקה",
    toCity:   "Nara",  toCityHe: "נארה",
    anchor:   { kind: "afterHeader", day: 13 },
    mode: "Train", modeJa: "JR大和路快速",
    duration: "~45 min", icon: "train",
  },
  {
    /* Renamed from "Osaka → Kyoto": day 13's activities were in
       Nara, so the next-day departure is logically Nara → Kyoto. */
    fromCity: "Nara", fromCityHe: "נארה",
    toCity:   "Kyoto", toCityHe: "קיוטו",
    anchor:   { kind: "afterHeader", day: 14 },
    mode: "Train", modeJa: "JR新快速",
    duration: "~45 min", icon: "train",
  },
  {
    fromCity: "Kyoto", fromCityHe: "קיוטו",
    toCity:   "Tokyo", toCityHe: "טוקיו",
    anchor:   { kind: "afterHeader", day: 19 },
    mode: "Shinkansen", modeJa: "東海道新幹線",
    duration: "~2.25 hours", icon: "shinkansen",
  },
  {
    fromCity: "Tokyo",       fromCityHe: "טוקיו",
    toCity:   "Kawaguchiko", toCityHe: "קוואגוצ׳יקו",
    anchor:   { kind: "afterHeader", day: 23 },
    mode: "Car", modeJa: "レンタカー",
    duration: "~2 hours", icon: "car",
  },
  {
    fromCity: "Kawaguchiko", fromCityHe: "קוואגוצ׳יקו",
    toCity:   "Hakone",      toCityHe: "האקונה",
    anchor:   { kind: "afterHeader", day: 24 },
    mode: "Car", modeJa: "レンタカー",
    duration: "~1.5 hours", icon: "car",
  },
  {
    fromCity: "Hakone", fromCityHe: "האקונה",
    toCity:   "Tokyo",  toCityHe: "טוקיו",
    anchor:   { kind: "afterHeader", day: 26 },
    mode: "Car", modeJa: "レンタカー",
    duration: "~1.5 hours", icon: "car",
  },
  {
    /* NEW: final-day departure to Narita. Appended at end of
       day 31 after every other timeline element. */
    fromCity: "Tokyo",  fromCityHe: "טוקיו (רופונגי)",
    toCity:   "Narita", toCityHe: "נמל התעופה נריטה",
    anchor:   { kind: "afterDayEnd", day: 31 },
    mode: "Train", modeJa: "成田エクスプレス (N'EX)",
    duration: "~75 min", icon: "train",
  },
];

export const lodgingOverrides = {
  9: {
    activityCity: "Matsumoto",
    activityCityHe: "מטסומוטו",
    lodgingCity: "Nagoya",
    lodgingCityHe: "נגויה",
  },
  13: {
    activityCity: "Nara",
    activityCityHe: "נארה",
    lodgingCity: "Osaka",
    lodgingCityHe: "אוסקה",
  },
  26: {
    activityCity: "Hakone",
    activityCityHe: "האקונה",
    lodgingCity: "Tokyo",
    lodgingCityHe: "טוקיו",
  },
};
