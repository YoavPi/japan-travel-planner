/* Pure helpers for normalizing an LLM-returned trip draft into the shape
   generate-trip.js expects ({ days: [...] }). No I/O — unit-tested. */

const isDayArray = (v) => Array.isArray(v) && v.length > 0;

/* Some models occasionally wrap the day list under a different key
   (`itinerary`) or nest the whole plan under a `trip` object instead of
   returning `days` at the top level. Unwrap those two known shapes rather
   than treating the response as unparseable — kept small and defensive
   (a couple of known key names, no clever recursion). Anything else is
   returned untouched so the caller's existing "no days array" failure
   path still applies. */
const unwrapDays = (parsed) => {
  if (!parsed || typeof parsed !== "object") return parsed;
  if (isDayArray(parsed.days)) return parsed;
  if (isDayArray(parsed.itinerary)) {
    const { itinerary, ...rest } = parsed;
    return { ...rest, days: itinerary };
  }
  if (parsed.trip && typeof parsed.trip === "object" && isDayArray(parsed.trip.days)) {
    return { ...parsed.trip, description: parsed.description ?? parsed.trip.description };
  }
  return parsed;
};

module.exports = { unwrapDays };
