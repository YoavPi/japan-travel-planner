# AI trip generation — destination focus (region / cities) + geo-coherence

**Date:** 2026-09-02
**Status:** Draft — pending review
**Branch:** `saas-builder-local`
**Owner agents:** `ai-engineer` (prompt / pipeline), `builder` (modal + wizard UI), `growth` (analytics), `copywriter` (region labels/blurbs)

## Problem

A user picked **"Thailand"** in the quick AI modal ("בנה לי מסלול אוטומטי") and got
spots scattered across the whole country — Bangkok, Chiang Mai (700 km north),
Phuket (an island) on consecutive days. Geographically incoherent, not a real trip.

Two AI entry points; the friend hit the thin one:

| | Full wizard (`/create`) | Quick AI modal (`AiTripModal`) |
|---|---|---|
| Geography input | a city-routing step (cities ↔ day ranges), marked "(optional)" | **none** |

The modal's destination is a free Google `geocode` autocomplete pick — a whole
country is a valid pick. It goes to `buildPrompt` as one string with only the rule
*"a real place in the destination"*; `day.city` is chosen freely by the model.

## Goals

- **B (ships alongside, no UI):** even with zero extra input, a broad-destination
  generation produces a realistic short route (one hub + day trips for short
  trips; ≤ ⌈days/3⌉ cities in consecutive multi-day blocks otherwise).
- **A:** when the picked destination is a **country or a large region**, ask one
  focused question — pick a curated **region** (for our ~10 popular countries),
  or **1–3 cities**, or **"תכנן לי"** (skip → B handles it). The choice becomes a
  hard prompt constraint.

## Non-goals

- No change to `nearbySearch` / `getDetails` semantics.
- No new DB columns. `focus` is request-only; the generated `day.city` values still
  drive the editor's city labels (existing `deriveCityRanges` in `aiTrip.js`).
- No map re-centering work (the editor auto-fits to the generated stops).
- Not translating the whole `CITY_POOL`; curated regions carry their own `{he,en}`.
- The localhost `mockItinerary` is not updated (demo already uses one city).

---

## B — geo-coherence prompt hardening (companion, do first)

`api/generate-trip.js` → `buildPrompt`:

1. Add a derived field to the user JSON: `maxCities: Math.max(1, Math.ceil(dayCount / 3))`.
2. Add a system rule (numbered after the existing rules, before the `refine` rule):

   > "(GEO) `destination` may be a country, region, or city. If it is broader than
   > one city: use AT MOST `maxCities` cities, each on CONSECUTIVE days (≥ 2 days
   > per city unless the whole trip is < 4 days), ordered as an overland-reasonable
   > route (adjacent areas, no daily flights). For trips of ≤ 4 days use ONE base
   > city and make the rest day-trips from it. Name the chosen cities in
   > `description`. Never scatter single days across far-apart cities."

3. When `focus` is present (see A.4) it supersedes the city-count freedom:

   > "(FOCUS) Plan the ENTIRE trip ONLY within: `<focus.cities joined>`. Include
   > nothing outside them. Spread the days across them as one consecutive route."

`buildPrompt` gains a `focus` field in its destructured argument and is `export`ed
for a unit test.

Ships as its own commit; it is inert without A and independently valuable.

---

## A — the focus step

### A.1 Detecting a "broad" destination

**`src/services/googlePlaces.js`** — `autocomplete()` currently returns
`{ placeId, primary, secondary }` and **drops `types`**. Add it:

```js
resolve(predictions.map((p) => ({
  placeId: p.place_id,
  primary: p.structured_formatting?.main_text || p.description,
  secondary: p.structured_formatting?.secondary_text || "",
  types: p.types || [],            // ← new
})));
```

Prediction `types` reliably carry `country` / `administrative_area_level_1` /
`archipelago` / `locality`. No extra `getDetails` call needed for detection.

**New `src/utils/destScope.js`** (pure, tested):

```js
/* Google prediction/details `types` → how broad the pick is. */
export function classifyDestScope(types = []) {
  const t = new Set(types);
  if (t.has("country")) return "country";
  if (t.has("locality") || t.has("postal_town") || t.has("sublocality")) return "city";
  if (t.has("administrative_area_level_1") || t.has("archipelago")) return "region";
  if (t.has("natural_feature") && !t.has("locality")) return "region"; // island groups
  return "city"; // default: don't over-trigger
}

/* The picked string + types → a curated DESTINATIONS id, or null.
   Matches on the English country name appearing in `secondary`/`primary`. */
export function matchCuratedCountry(primary, secondary, types) { … }
```

`matchCuratedCountry` uses a `{ "Thailand": "th", "Japan": "jp", … }` map built
from `DESTINATIONS` (`en` → `id`), lifted from `WizardView` into a shared
`src/data/destinations.js` (see A.9).

**Trigger:** the focus step shows when `classifyDestScope(pick.types)` is
`"country"` or `"region"`. `"city"` → no step (Tokyo, London, Bangkok all skip).

### A.2 The focus step — component

**New `src/components/DestinationFocus.jsx`** — presentational, shared by modal +
wizard.

Props: `destName`, `scope` (`"country"|"region"`), `curatedId` (DESTINATIONS id or
null), `countryBias` (`{west,south,east,north}` for the city autocomplete),
`onPick({ kind, cities, label })`, `onSkip()`.

Layout (RTL, logical CSS, ≥ 44 px, light palette like `NearbySearchSheet`):

- **Heading:** `scope === "country"` → `"{destName} גדולה — על איזה אזור לכוון?"`;
  `"region"` → `"{destName} — אילו ערים לכלול?"`.
- **Curated region chips** — only when `scope === "country"` **and** `curatedId`.
  From `FOCUS_REGIONS[curatedId]`: a chip per region — `label` + `blurb`. Tap →
  `onPick({ kind: "region", cities: region.cities.map(c => c.en), label: region.label })`.
- **City picker** — always. "אזור אחר / בחר ערים" → expands the same
  `autocomplete(q, { types: ["(cities)"], bias: countryBias })` field the wizard
  uses. Each pick → `getDetails(placeId)` to capture the **English** city name
  (≤ 3 picks → ≤ 3 billed detail calls). Chips with ✕. "המשך" →
  `onPick({ kind: "cities", cities: [<english names>], label: <he names joined> })`.
- **"תכנן לי — לא משנה לי"** — always, low-emphasis. → `onSkip()`.

The component does not call the generate pipeline; the parent does.

### A.3 Curated focus regions — `src/data/focusRegions.js`

Keyed by DESTINATIONS `id`. Each region: `{ id, label, blurb, cities: [{ he, en }] }`
(2–3 cities, names consistent with `CITY_POOL`). Seed for all 10 curated countries
(`jp it pt gr th vn ae fr es us`); `growth`/`copywriter` refine copy later.

```js
export const FOCUS_REGIONS = {
  th: [
    { id: "central", label: "בנגקוק והמרכז",  blurb: "עיר, מקדשים, שווקים",
      cities: [{ he: "בנגקוק", en: "Bangkok" }, { he: "איוטאיה", en: "Ayutthaya" }] },
    { id: "north",   label: "הצפון",           blurb: "הרים, טבע, תרבות לאנא",
      cities: [{ he: "צ׳אנג מאי", en: "Chiang Mai" }, { he: "פאי", en: "Pai" }] },
    { id: "south",   label: "הדרום והאיים",     blurb: "חופים, שנרקול, איים",
      cities: [{ he: "פוקט", en: "Phuket" }, { he: "קראבי", en: "Krabi" }] },
    { id: "mix",     label: "בנגקוק + איים",    blurb: "קלאסי — עיר ואז חוף",
      cities: [{ he: "בנגקוק", en: "Bangkok" }, { he: "פוקט", en: "Phuket" }] },
  ],
  jp: [ /* המשולש הזהב · טוקיו והסביבה · קנסאי */ ],
  it: [ /* רומא–פירנצה–ונציה · הדרום ואמלפי · הצפון והאגמים */ ],
  /* pt gr vn ae fr es us — 3 regions each */
};
```

### A.4 Request contract

`generateItinerary(payload)` (`src/services/aiTrip.js`) — add to `body`:

```js
focus: payload.focus || null,   // { cities: string[] /* English */, label: string } | null
destScope: payload.destScope || null, // "country" | "region" | "city" | null
```

`track("ai_generate_started", …)` gains `focus: !!body.focus`.

`/api/generate-trip` reads `focus` + `destScope`, passes both into `buildPrompt`
(FOCUS clause when `focus`, GEO clause always for `destScope !== "city"`).

### A.5 Modal wiring — `src/components/AiTripModal.jsx`

- `pickDest(p)` also stores `p.types` and computes
  `destScope = classifyDestScope(p.types)`, `curatedId = matchCuratedCountry(...)`.
- After the form's "בנה מסלול" click: if `destScope` is `country`/`region` **and**
  the user hasn't already chosen a focus this session → set `phase = "focus"`
  (a new phase alongside `"form"` / `"loading"`), render `<DestinationFocus>`.
  - `onPick({ cities, label })` → store `focus = { cities, label }`, go to
    `phase = "loading"`, call `generateItinerary({ …form, focus, destScope })`.
  - `onSkip()` → `focus = null`, generate with just `destScope`.
- City / region picks are remembered so "refine" and a second open don't re-ask.

### A.6 Wizard wiring — `src/views/WizardView.jsx`

**Confirmed:** `WizardView` never calls `generateItinerary` — it only builds an
empty skeleton (`createNewTrip` with `cityRanges`). So the wizard needs **no
`focus`, no prompt involvement** — "A" here is pure UX sugar on the existing
city-routing step:

- When `destScope` is `country`/`region`, `cities` is empty, and `curatedId` is
  set, render the `FOCUS_REGIONS[curatedId]` region chips above the existing
  per-city `SUGGESTED_CITIES` chips ("או בחר אזור מוכן:").
- Tapping a region chip **prefills `cities`** with that region's cities as the
  existing `{ name, days }` rows (Hebrew `he` names); the day-range allocation UI
  and `cityRanges` build are unchanged.
- Non-curated broad picks and city picks: no change — the existing search field
  and chips already cover them.

The wizard reads `destScope` from the destination pick (it too calls
`autocomplete`); nothing else about its flow changes.

### A.7 Downstream

- **No `cityRanges` pre-set from `focus`.** The generated `day.city` values feed
  the editor via the existing `deriveCityRanges`. One source of truth.
- Skip (`focus: null`, `destScope: "country"`) still gets B's GEO tightening.

### A.8 Analytics (`growth`)

- `ai_focus_shown` `{ scope, curated }` — when `<DestinationFocus>` mounts.
- `ai_focus_chosen` `{ kind: "region"|"cities"|"skip", label, cityCount }`.
- Existing `ai_generate_*` events gain `focus: bool`.

Tells us whether to expand curation beyond 10 countries.

### A.9 Shared destinations data

Lift `DESTINATIONS` + `SUGGESTED_CITIES` + `CITY_POOL` out of `WizardView.jsx`
into `src/data/destinations.js` (re-exported so `WizardView` keeps working).
`destScope.js`, `focusRegions.js`, `DestinationFocus.jsx`, `AiTripModal.jsx` all
consume it. Pure move, no behavior change.

---

## Testing

**Unit**
- `destScope.classifyDestScope` — `["country"] → "country"`, `["administrative_area_level_1","political"] → "region"`, `["locality","political"] → "city"`, `["archipelago"] → "region"`, `[] → "city"`.
- `destScope.matchCuratedCountry` — `("Chiang Mai","Thailand",[...]) → "th"`, `("Lyon","France",[...]) → "fr"`, `("Reykjavik","Iceland",[...]) → null`.
- `buildPrompt` (newly exported) — `focus` present → system text contains "ONLY within" and the joined cities; absent + `destScope:"country"` → contains "(GEO)" and `maxCities`; `destScope:"city"` → neither clause.
- `focusRegions` shape — every entry has `id/label/blurb` and `cities:[{he,en}]`, every `id` also in `DESTINATIONS`.

**Component** — `DestinationFocus.test.js`
- curated country → renders a chip per `FOCUS_REGIONS[id]`; tap → `onPick({ kind:"region", cities:[...en], label })`.
- region scope → no curated chips, city field present.
- city-picker: type → pick → chip shows; "המשך" with 2 cities → `onPick({ kind:"cities", cities:[2] })`.
- "תכנן לי" → `onSkip()`.

**Gate** — `npm run critical`, `CI=true` jest, `CI=true` build.

**Manual**
1. Modal → "Thailand" → focus step appears → "הצפון" → generate → every spot in Chiang Mai / Pai.
2. Modal → "Thailand" → "תכנן לי" → coherent hub trip (Bangkok + day trips for ≤ 4 days; ≤ ⌈days/3⌉ cities otherwise), cities named in the description.
3. Modal → "Tokyo" → **no** focus step.
4. Modal → "Tuscany, Italy" → focus step, city-picker only (region scope), biased to Tuscany.
5. Wizard → "Thailand" → city step shows the region chips; tap "הדרום והאיים" → Phuket + Krabi rows prefilled → allocation works.
6. Refine after a focused generation keeps the focus (doesn't re-ask).
7. Places key absent (demo) → focus step still renders from `FOCUS_REGIONS`; city-picker degrades to the sim list; generation uses the mock.

## Files

- Create: `src/utils/destScope.js` (+ test), `src/data/focusRegions.js` (+ shape test), `src/data/destinations.js`, `src/components/DestinationFocus.jsx` (+ test).
- Modify: `src/services/googlePlaces.js` (autocomplete `types`), `src/services/aiTrip.js` (`focus`/`destScope` in body + event), `api/generate-trip.js` (`buildPrompt` GEO + FOCUS rules, export it) + a `buildPrompt` unit test, `src/components/AiTripModal.jsx` (focus phase), `src/views/WizardView.jsx` (region chips on the city step; import from `data/destinations`).
- Docs: `docs/QA-TEST-PLAN.md` (manual cases), `WORKLOG.md` line after.

## Rollout

Two commits minimum: **(1) B** — `buildPrompt` GEO hardening + export + test, ship
and observe. **(2) A** — the rest, behind no flag (additive; the step only appears
for country/region picks). `destinations.js` extraction is its own prep commit.
