/* ══════════════════════════════════════════════════════════════════════
   prompt.js — builds the { system, user } pair sent to the LLM by
   /api/generate-trip. Extracted so it can be unit-tested (see
   prompt.test.js) without spinning up the whole serverless handler.
   ══════════════════════════════════════════════════════════════════════ */

const TRANSPORT_LABEL = { walking: "walking", transit: "public transit", car: "car" };

const buildPrompt = ({
  destination, dayCount, spotsPerDay, preferences, transport,
  instructions, party, restrictions, refine, previous, focus,
}) => {
  const prefText = Array.isArray(preferences) ? preferences.join(", ") : String(preferences || "");
  const modes = (Array.isArray(transport) ? transport : [transport]).filter(Boolean).map((m) => TRANSPORT_LABEL[m] || m);
  const transportHint = modes.length
    ? `The traveller moves by: ${modes.join(" + ")}. Cluster each day so travel between spots suits those modes (tighter for walking).`
    : "Keep each day's spots reasonably compact.";
  const restrictText = Array.isArray(restrictions) ? restrictions.filter(Boolean).join(", ") : String(restrictions || "");
  const partyText = party && (party.adults || party.kids)
    ? `${party.adults || 0} adults${party.kids ? ` and ${party.kids} children` : ""}` : null;

  /* Destination focus (Task 6): a chosen region/city subset becomes a HARD
     constraint — the whole trip must stay inside these places. Names can arrive
     localized (the Places SDK runs with language=he) and this string is injected
     straight into the SYSTEM prompt, so sanitize hard: strings only, bounded
     count (≤5) and length (≤60) — admins have no weekly token cap. */
  const focusCities = (Array.isArray(focus && focus.cities) ? focus.cities : [])
    .filter((c) => typeof c === "string" && c.trim())
    .slice(0, 5)
    .map((c) => c.trim().slice(0, 60));

  /* Geographic coherence: a country/region `destination` must not become a
     scatter of single days across far-apart cities. A focus set of N places
     raises the ceiling to N — it overrides the day-count heuristic. */
  const maxCities = Math.max(1, focusCities.length, Math.ceil((Number(dayCount) || 1) / 3));

  const system =
    "You are an expert local travel planner. You output ONLY valid minified JSON — no prose, no markdown, no code fences. " +
    "Schema exactly: {\"description\":\"<a warm 1-2 sentence Hebrew summary of the whole trip>\",\"days\":[{\"dayNumber\":<int>,\"city\":\"<city in English>\",\"title\":\"<a 2-4 word Hebrew theme for the day>\",\"spots\":[{\"name\":\"<the exact, official place name in English>\",\"category\":\"<one Hebrew word: אטרקציה|מסעדה|קפה|קניות|טבע|מוזיאון|מלון>\",\"note\":\"<a SHORT Hebrew tip, max 8 words — hint when it is OPEN or the BEST time to go when relevant>\",\"crowd\":\"<high|medium|none>\"}]}]}. " +
    "Rules: (1) Produce EXACTLY the requested number of days. (2) Each day has EXACTLY the requested spots-per-day — never more than 4 places in a day. " +
    "(3) Every place MUST be a REAL, well-known, currently-operating place in the destination — never invent names. " +
    "(4) Use each place's exact official English name so Google Maps finds it precisely (the day's city is provided separately). " +
    "(5) Cluster each day's spots geographically to minimise travel. (6) Reflect the traveller's interests, party composition, dietary/accessibility restrictions AND any custom instructions. (7) No duplicate places across the whole trip. " +
    "(8) Do NOT place an attraction on a day it is typically CLOSED (use your knowledge of common closing days, e.g. many museums close Mondays). " +
    "(9) Mark crowd-magnet places with crowd:\"high\", and ORDER each day so busy places fall at their least-crowded time (famous sights early morning, dinners in the evening); add a short best-time hint to their note. " +
    "(GEO) `destination` may be a country, region, or single city. If it is broader than one city: use AT MOST `maxCities` different cities, each visited on CONSECUTIVE days (at least 2 days per city unless the whole trip is under 4 days), ordered as an overland-reasonable route — adjacent areas, no daily flights. For trips of 4 days or fewer, use ONE base city and make the rest day-trips from it. Name the chosen cities in `description`. NEVER scatter single days across far-apart cities." +
    (focusCities.length
      ? ` (FOCUS) Plan the ENTIRE trip ONLY within these places (names may be given in Hebrew or another language — resolve each to its real-world city/area): ${focusCities.join(", ")}. Include nothing outside them. Spread the days across them as one consecutive route. This set overrides the (GEO) city-count limit.`
      : "") +
    (refine ? " (10) You are REVISING an existing itinerary: keep it mostly the same and apply ONLY the requested change, returning the FULL updated plan." : "");

  const user = JSON.stringify({
    destination,
    days: dayCount,
    maxCities,
    spotsPerDay,
    interests: prefText || "a well-rounded mix",
    transportNote: transportHint,
    party: partyText,
    restrictions: restrictText || null,
    customInstructions: (instructions || "").trim() || null,
    ...(focusCities.length ? { focusCities } : {}),
    ...(refine ? { revise: { instruction: refine, currentPlan: previous || null } } : {}),
  });

  return { system, user };
};

module.exports = { buildPrompt, TRANSPORT_LABEL };
