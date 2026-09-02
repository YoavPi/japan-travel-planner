# AI Destination Focus — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** When someone picks a whole country / large region for an AI-generated trip, ask one focused question — a curated **region**, **1–3 cities**, or "תכנן לי" (skip) — and turn that choice into a hard prompt constraint so the itinerary stops scattering days across the country.

**Architecture:** New pure helper `destScope.js` classifies the Places pick's `types`. New data file `focusRegions.js` holds curated regions per country. New presentational `DestinationFocus.jsx` (region chips + city picker + skip), used by the quick AI modal as a new phase. The chosen cities ride the generate request as `focus` and become a `(FOCUS)` rule in the prompt (`api/_lib/prompt.js`). The wizard — which never calls the AI, only builds a skeleton — just gets the same region chips as a prefill shortcut on its existing city-routing step.

**Tech Stack:** React 18 (CRA), `@testing-library/react` + Jest, `node --test` for `api/_lib`, plain inline-style components with `useDarkMode()`.

**Spec:** [docs/superpowers/specs/2026-09-02-ai-focus-region-design.md](../specs/2026-09-02-ai-focus-region-design.md)

## Global Constraints

- **Branch:** `saas-builder-local`. Pre-deploy gate: `npm run critical` must pass.
- **"B" already shipped** (commit `a06f3ad`): `api/_lib/prompt.js` exists with a self-gating `(GEO)` rule ("if the destination is broader than one city…") and passes `maxCities` in the user JSON. This plan **adds** a `(FOCUS)` rule and the `focus` argument — it does **not** re-gate or remove GEO, and does **not** need `destScope` inside the prompt (GEO self-gates on the destination string).
- **Trigger (modal only):** the focus step shows when `classifyDestScope(pick.types)` returns `"country"` or `"region"`. `"city"` picks skip it. The wizard uses its own `destId` (already only set for the 10 curated countries) — no `classifyDestScope` there.
- **`focus` request shape:** `{ cities: string[] /* English */, label: string } | null`. Also send `destScope: "country"|"region"|"city"|null` for analytics only.
- **Curated countries** = the 10 in `DESTINATIONS` (`jp it pt gr th vn ae fr es us`). `FOCUS_REGIONS` covers exactly these; every region carries `cities: [{ he, en }]`.
- **Skip / "תכנן לי"** sends `focus: null`; the already-shipped GEO rule keeps the result coherent. Never block submit.
- **No new DB columns.** Generated `day.city` still drives editor city labels via the existing `deriveCityRanges` — do NOT pre-set `cityRanges` from `focus`.
- **Design:** Hebrew-first RTL; logical CSS props (`insetInlineStart`, `marginInlineEnd`…), never `left`/`right`; ≥ 44×44 px targets; dark mode via `useDarkMode()`; light-ish palette like `NearbySearchSheet.jsx` (the modal is theme-aware — read `dark` from `useDarkMode()`).
- **Places key absent (demo):** `autocomplete` degrades to `simAutocomplete`; `getDetails` to `simDetails`. The focus step must still render from `FOCUS_REGIONS`; the city-picker degrades but must not throw.
- **Analytics:** `track(...)` from `../analytics/posthog` (same import the modal/service already use). Events: `ai_focus_shown {scope,curated}`, `ai_focus_chosen {kind,label,cityCount}`; `ai_generate_started` gains `focus: bool`.

---

### Task 1: Extract `src/data/destinations.js`

**Files:**
- Create: `src/data/destinations.js`
- Modify: `src/views/WizardView.jsx` (remove the three literals, import them instead)
- Test: `src/data/destinations.test.js`

**Interfaces:**
- Produces:
  - `DESTINATIONS: { id, flag, name, en, sub, center:{lng,lat,zoom}, popular? }[]` — the 10 entries currently in `WizardView.jsx` lines ~35-45, verbatim.
  - `SUGGESTED_CITIES: Record<string, string[]>` — keyed by `DESTINATIONS` id (Hebrew city names), verbatim from `WizardView.jsx` ~50-61.
  - `CITY_POOL: Record<string, string[]>` — verbatim from `WizardView.jsx` ~65-76.
  - `COUNTRY_EN_TO_ID: Record<string,string>` — derived: `{ Japan:"jp", Italy:"it", Portugal:"pt", Greece:"gr", Thailand:"th", Vietnam:"vn", Dubai:"ae", France:"fr", Spain:"es", USA:"us" }` (from each entry's `en`).

- [ ] **Step 1: Write the failing test**

```jsx
// src/data/destinations.test.js
import { DESTINATIONS, SUGGESTED_CITIES, CITY_POOL, COUNTRY_EN_TO_ID } from "./destinations";

test("DESTINATIONS: 10 curated entries, each with id/en/center", () => {
  expect(DESTINATIONS).toHaveLength(10);
  for (const d of DESTINATIONS) {
    expect(typeof d.id).toBe("string");
    expect(typeof d.en).toBe("string");
    expect(Number.isFinite(d.center.lng) && Number.isFinite(d.center.lat)).toBe(true);
  }
});

test("SUGGESTED_CITIES / CITY_POOL keyed by DESTINATIONS ids; pool ⊇ suggested", () => {
  const ids = new Set(DESTINATIONS.map((d) => d.id));
  for (const k of Object.keys(SUGGESTED_CITIES)) expect(ids.has(k)).toBe(true);
  for (const k of Object.keys(CITY_POOL)) expect(ids.has(k)).toBe(true);
  for (const id of ids) {
    const sug = SUGGESTED_CITIES[id] || [];
    const pool = new Set(CITY_POOL[id] || []);
    for (const c of sug) expect(pool.has(c)).toBe(true);
  }
});

test("COUNTRY_EN_TO_ID maps each entry's English name to its id", () => {
  for (const d of DESTINATIONS) expect(COUNTRY_EN_TO_ID[d.en]).toBe(d.id);
  expect(COUNTRY_EN_TO_ID.Thailand).toBe("th");
});
```

- [ ] **Step 2: Run the test, expect FAIL** — `Cannot find module './destinations'`.

Run: `CI=true npx react-scripts test src/data/destinations.test.js --watchAll=false`

- [ ] **Step 3: Create `src/data/destinations.js`**

Move the three objects out of `src/views/WizardView.jsx` **verbatim** (find `const DESTINATIONS = [`, `const SUGGESTED_CITIES = {`, `const CITY_POOL = {`). Append the derived map:

```js
export const COUNTRY_EN_TO_ID = DESTINATIONS.reduce((m, d) => { m[d.en] = d.id; return m; }, {});
```

Export all four (`export const DESTINATIONS = …` etc.).

- [ ] **Step 4: Rewire `WizardView.jsx`**

Delete the three `const` blocks; add near the top imports:

```js
import { DESTINATIONS, SUGGESTED_CITIES, CITY_POOL } from "../data/destinations";
```

Keep every other line of `WizardView.jsx` unchanged. The city-accent palette / any other `const` right after `CITY_POOL` stays in `WizardView.jsx`.

- [ ] **Step 5: Run the tests + wider check**

Run: `CI=true npx react-scripts test src/data --watchAll=false` → PASS (3).
Run: `CI=true npx react-scripts build` → `Compiled successfully`, no warnings.

- [ ] **Step 6: Commit**

```bash
git add src/data/destinations.js src/data/destinations.test.js src/views/WizardView.jsx
git commit -m "refactor(data): lift DESTINATIONS/SUGGESTED_CITIES/CITY_POOL into src/data/destinations.js"
```

---

### Task 2: `src/utils/destScope.js`

**Files:**
- Create: `src/utils/destScope.js`
- Test: `src/utils/destScope.test.js`

**Interfaces:**
- Consumes: `COUNTRY_EN_TO_ID` from `../data/destinations` (Task 1).
- Produces:
  - `classifyDestScope(types?: string[]): "country" | "region" | "city"`.
  - `matchCuratedCountry(primary?: string, secondary?: string, types?: string[]): string | null` — a `DESTINATIONS` id when the pick is (or is inside) one of the 10 curated countries, else `null`. Matches an English country name from `COUNTRY_EN_TO_ID` appearing as a whole word in `secondary` first, then `primary` (e.g. `primary:"Chiang Mai"`, `secondary:"Thailand"` → `"th"`; `primary:"Thailand"` → `"th"`). `"USA"` also matches `"United States"`.

- [ ] **Step 1: Write the failing test**

```jsx
// src/utils/destScope.test.js
import { classifyDestScope, matchCuratedCountry } from "./destScope";

test("classifyDestScope: types → scope", () => {
  expect(classifyDestScope(["country", "political"])).toBe("country");
  expect(classifyDestScope(["administrative_area_level_1", "political"])).toBe("region");
  expect(classifyDestScope(["archipelago"])).toBe("region");
  expect(classifyDestScope(["natural_feature"])).toBe("region");
  expect(classifyDestScope(["locality", "political"])).toBe("city");
  expect(classifyDestScope(["administrative_area_level_2", "locality"])).toBe("city");
  expect(classifyDestScope([])).toBe("city");
  expect(classifyDestScope()).toBe("city");
});

test("classifyDestScope: locality wins over a region type (a city inside a province)", () => {
  expect(classifyDestScope(["locality", "administrative_area_level_1"])).toBe("city");
});

test("matchCuratedCountry", () => {
  expect(matchCuratedCountry("Chiang Mai", "Thailand", ["locality"])).toBe("th");
  expect(matchCuratedCountry("Thailand", "", ["country"])).toBe("th");
  expect(matchCuratedCountry("Lyon", "Auvergne-Rhône-Alpes, France", ["locality"])).toBe("fr");
  expect(matchCuratedCountry("New York", "NY, United States", ["locality"])).toBe("us");
  expect(matchCuratedCountry("Reykjavik", "Iceland", ["locality"])).toBe(null);
  expect(matchCuratedCountry("", "", [])).toBe(null);
});
```

- [ ] **Step 2: Run, expect FAIL** — `Cannot find module './destScope'`.

- [ ] **Step 3: Implement `src/utils/destScope.js`**

```js
import { COUNTRY_EN_TO_ID } from "../data/destinations";

const CITY_TYPES = new Set(["locality", "postal_town", "sublocality", "administrative_area_level_2"]);
const REGION_TYPES = new Set(["administrative_area_level_1", "archipelago", "natural_feature", "colloquial_area"]);

export function classifyDestScope(types = []) {
  const t = new Set(types || []);
  if (t.has("country")) return "country";
  for (const c of CITY_TYPES) if (t.has(c)) return "city";      // a city inside a region is still a city
  for (const r of REGION_TYPES) if (t.has(r)) return "region";
  return "city";
}

/* "United States" is how Google labels USA in `secondary`. */
const ALIASES = { "United States": "us" };

export function matchCuratedCountry(primary = "", secondary = "", types = []) {
  const hay = [secondary, primary].map((s) => ` ${String(s || "")} `);
  const names = { ...COUNTRY_EN_TO_ID, ...ALIASES };
  for (const text of hay) {
    for (const [name, id] of Object.entries(names)) {
      const re = new RegExp(`(^|[\\s,])${name.replace(/[.*+?^${}()|[\\]\\\\]/g, "\\\\$&")}([\\s,]|$)`, "i");
      if (re.test(text)) return id;
    }
  }
  return null;
}
```

- [ ] **Step 4: Run, expect PASS** (3).

Run: `CI=true npx react-scripts test src/utils/destScope.test.js --watchAll=false`

- [ ] **Step 5: Commit**

```bash
git add src/utils/destScope.js src/utils/destScope.test.js
git commit -m "feat(ai): destScope helper — classify a Places pick + match a curated country"
```

---

### Task 3: `src/data/focusRegions.js`

**Files:**
- Create: `src/data/focusRegions.js`
- Test: `src/data/focusRegions.test.js`

**Interfaces:**
- Consumes: `DESTINATIONS` from `./destinations` (Task 1) — for the shape test.
- Produces: `FOCUS_REGIONS: Record<string, { id, label, blurb, cities: {he,en}[] }[]>` keyed by `DESTINATIONS` id; 3–4 regions per country; every country in `DESTINATIONS` covered; 2–3 cities per region.

- [ ] **Step 1: Write the failing test**

```jsx
// src/data/focusRegions.test.js
import { FOCUS_REGIONS } from "./focusRegions";
import { DESTINATIONS } from "./destinations";

test("every curated destination has 3-4 focus regions", () => {
  for (const d of DESTINATIONS) {
    const regions = FOCUS_REGIONS[d.id];
    expect(Array.isArray(regions)).toBe(true);
    expect(regions.length).toBeGreaterThanOrEqual(3);
    expect(regions.length).toBeLessThanOrEqual(4);
  }
});

test("region shape: id/label/blurb + 2-3 {he,en} cities; ids unique per country", () => {
  for (const [country, regions] of Object.entries(FOCUS_REGIONS)) {
    const ids = new Set();
    for (const r of regions) {
      expect(typeof r.id).toBe("string");
      expect(r.label.length).toBeGreaterThan(0);
      expect(r.blurb.length).toBeGreaterThan(0);
      expect(r.cities.length).toBeGreaterThanOrEqual(2);
      expect(r.cities.length).toBeLessThanOrEqual(3);
      for (const c of r.cities) {
        expect(typeof c.he).toBe("string");
        expect(/^[\x00-\x7F ]+$/.test(c.en)).toBe(true); // en is ASCII
      }
      expect(ids.has(r.id)).toBe(false);
      ids.add(r.id);
    }
    expect(Object.keys(FOCUS_REGIONS)).toContain(country);
  }
});

test("no FOCUS_REGIONS key outside DESTINATIONS", () => {
  const ids = new Set(DESTINATIONS.map((d) => d.id));
  for (const k of Object.keys(FOCUS_REGIONS)) expect(ids.has(k)).toBe(true);
});
```

- [ ] **Step 2: Run, expect FAIL.**

- [ ] **Step 3: Implement `src/data/focusRegions.js`**

Full data for all 10. Cities' `he` names must exist in `CITY_POOL[id]` (Task 1); `en` is the official English name.

```js
export const FOCUS_REGIONS = {
  th: [
    { id: "central", label: "בנגקוק והמרכז", blurb: "עיר, מקדשים, שווקים", cities: [{ he: "בנגקוק", en: "Bangkok" }, { he: "איוטאיה", en: "Ayutthaya" }] },
    { id: "north",   label: "הצפון",          blurb: "הרים, טבע, תרבות לאנא", cities: [{ he: "צ׳אנג מאי", en: "Chiang Mai" }, { he: "פאי", en: "Pai" }] },
    { id: "south",   label: "הדרום והאיים",    blurb: "חופים, שנרקול, איים", cities: [{ he: "פוקט", en: "Phuket" }, { he: "קראבי", en: "Krabi" }] },
    { id: "mix",     label: "בנגקוק + איים",   blurb: "קלאסי — עיר ואז חוף", cities: [{ he: "בנגקוק", en: "Bangkok" }, { he: "פוקט", en: "Phuket" }] },
  ],
  jp: [
    { id: "golden", label: "המשולש הזהב",  blurb: "טוקיו, קיוטו, אוסקה", cities: [{ he: "טוקיו", en: "Tokyo" }, { he: "קיוטו", en: "Kyoto" }, { he: "אוסקה", en: "Osaka" }] },
    { id: "tokyo",  label: "טוקיו והסביבה", blurb: "העיר + האקונה/קמאקורה", cities: [{ he: "טוקיו", en: "Tokyo" }, { he: "האקונה", en: "Hakone" }] },
    { id: "kansai", label: "קנסאי",         blurb: "קיוטו, נארה, אוסקה", cities: [{ he: "קיוטו", en: "Kyoto" }, { he: "נארה", en: "Nara" }, { he: "אוסקה", en: "Osaka" }] },
  ],
  it: [
    { id: "classic", label: "רומא–פירנצה–ונציה", blurb: "הקלאסיקה", cities: [{ he: "רומא", en: "Rome" }, { he: "פירנצה", en: "Florence" }, { he: "ונציה", en: "Venice" }] },
    { id: "south",   label: "הדרום ואמלפי",      blurb: "נאפולי, חוף אמלפי", cities: [{ he: "נאפולי", en: "Naples" }, { he: "אמלפי", en: "Amalfi" }] },
    { id: "north",   label: "הצפון והאגמים",     blurb: "מילאנו, אגם קומו", cities: [{ he: "מילאנו", en: "Milan" }, { he: "ונציה", en: "Venice" }] },
  ],
  gr: [
    { id: "cyclades", label: "אתונה והאיים",   blurb: "אתונה, סנטוריני, מיקונוס", cities: [{ he: "אתונה", en: "Athens" }, { he: "סנטוריני", en: "Santorini" }, { he: "מיקונוס", en: "Mykonos" }] },
    { id: "athens",   label: "אתונה והיבשת",   blurb: "אתונה + מטאורה", cities: [{ he: "אתונה", en: "Athens" }, { he: "נאפליו", en: "Nafplio" }] },
    { id: "crete",    label: "כרתים",          blurb: "האי הגדול", cities: [{ he: "כרתים", en: "Crete" }, { he: "אתונה", en: "Athens" }] },
  ],
  vn: [
    { id: "north",  label: "הצפון",        blurb: "האנוי, מפרץ חאלונג", cities: [{ he: "האנוי", en: "Hanoi" }, { he: "חאלונג", en: "Ha Long Bay" }] },
    { id: "center", label: "המרכז",        blurb: "הוי אן, דה נאנג", cities: [{ he: "הוי אן", en: "Hoi An" }, { he: "דה נאנג", en: "Da Nang" }] },
    { id: "south",  label: "הדרום",        blurb: "הו צ׳י מין ודלתת המקונג", cities: [{ he: "הו צ׳י מין", en: "Ho Chi Minh City" }, { he: "ניה טראנג", en: "Nha Trang" }] },
    { id: "full",   label: "צפון לדרום",   blurb: "המסלול הקלאסי", cities: [{ he: "האנוי", en: "Hanoi" }, { he: "הוי אן", en: "Hoi An" }, { he: "הו צ׳י מין", en: "Ho Chi Minh City" }] },
  ],
  ae: [
    { id: "dubai",   label: "דובאי",        blurb: "העיר וכל מה שבה", cities: [{ he: "דובאי", en: "Dubai" }] , },
    { id: "both",    label: "דובאי + אבו דאבי", blurb: "שתי הערים", cities: [{ he: "דובאי", en: "Dubai" }, { he: "אבו דאבי", en: "Abu Dhabi" }] },
    { id: "north",   label: "האמירויות הצפוניות", blurb: "ראס אל ח׳יימה, שארג׳ה", cities: [{ he: "דובאי", en: "Dubai" }, { he: "ראס אל ח׳יימה", en: "Ras Al Khaimah" }] },
  ],
  fr: [
    { id: "paris",    label: "פריז והסביבה", blurb: "העיר + ורסאי", cities: [{ he: "פריז", en: "Paris" }] },
    { id: "provence", label: "פרובנס והריביירה", blurb: "ניס, קאן", cities: [{ he: "ניס", en: "Nice" }, { he: "קאן", en: "Cannes" }] },
    { id: "loire",    label: "מרכז ודרום",  blurb: "ליון, בורדו", cities: [{ he: "ליון", en: "Lyon" }, { he: "בורדו", en: "Bordeaux" }] },
  ],
  es: [
    { id: "classic",  label: "מדריד וברצלונה", blurb: "שתי הערים הגדולות", cities: [{ he: "מדריד", en: "Madrid" }, { he: "ברצלונה", en: "Barcelona" }] },
    { id: "andalusia",label: "אנדלוסיה",       blurb: "סביליה, גרנדה", cities: [{ he: "סביליה", en: "Seville" }, { he: "גרנדה", en: "Granada" }] },
    { id: "north",    label: "הצפון",          blurb: "סן סבסטיאן, בילבאו", cities: [{ he: "סן סבסטיאן", en: "San Sebastian" }, { he: "בילבאו", en: "Bilbao" }] },
  ],
  us: [
    { id: "east",  label: "החוף המזרחי", blurb: "ניו יורק, וושינגטון, בוסטון", cities: [{ he: "ניו יורק", en: "New York" }, { he: "וושינגטון", en: "Washington, D.C." }, { he: "בוסטון", en: "Boston" }] },
    { id: "west",  label: "החוף המערבי", blurb: "לוס אנג׳לס, סן פרנסיסקו", cities: [{ he: "לוס אנג׳לס", en: "Los Angeles" }, { he: "סן פרנסיסקו", en: "San Francisco" }] },
    { id: "swest", label: "דרום-מערב",   blurb: "לאס וגאס והפארקים", cities: [{ he: "לאס וגאס", en: "Las Vegas" }, { he: "לוס אנג׳לס", en: "Los Angeles" }] },
  ],
  pt: [
    { id: "classic", label: "ליסבון ופורטו", blurb: "שתי הערים + סינטרה", cities: [{ he: "ליסבון", en: "Lisbon" }, { he: "פורטו", en: "Porto" }] },
    { id: "lisbon",  label: "ליסבון והסביבה", blurb: "ליסבון, סינטרה, קשקאיש", cities: [{ he: "ליסבון", en: "Lisbon" }, { he: "סינטרה", en: "Sintra" }] },
    { id: "south",   label: "האלגרבה",        blurb: "חופי הדרום", cities: [{ he: "לאגוס", en: "Lagos" }, { he: "פארו", en: "Faro" }] },
  ],
};
```

> If the shape test flags a `he` name that isn't in `CITY_POOL` for that country, add it to `CITY_POOL` in `src/data/destinations.js` (one array entry) rather than renaming — Task 1's `destinations.test.js` "pool ⊇ suggested" test won't mind extra pool entries.

- [ ] **Step 4: Run, expect PASS** (3). If ASCII check fails on `"Washington, D.C."` — it's ASCII (comma + periods are `\x00-\x7F`), fine.

Run: `CI=true npx react-scripts test src/data/focusRegions.test.js --watchAll=false`

- [ ] **Step 5: Commit**

```bash
git add src/data/focusRegions.js src/data/focusRegions.test.js src/data/destinations.js
git commit -m "feat(ai): FOCUS_REGIONS — curated region presets per country"
```

---

### Task 4: `autocomplete()` returns `types`

**Files:**
- Modify: `src/services/googlePlaces.js` (the `autocomplete` export + its `simAutocomplete` fallback)

**Interfaces:**
- Produces: every `autocomplete()` result object gains `types: string[]` (from `p.types` live; `[]` in sim). No signature change.

- [ ] **Step 1: Live path — add `types`**

In `autocomplete`, the `predictions.map((p) => ({ … }))` (search for `structured_formatting?.main_text`) — add one field:

```js
resolve(predictions.map((p) => ({
  placeId: p.place_id,
  primary: p.structured_formatting?.main_text || p.description,
  secondary: p.structured_formatting?.secondary_text || "",
  types: Array.isArray(p.types) ? p.types : [],
})));
```

- [ ] **Step 2: Sim path — add `types: []`**

Find `simAutocomplete` (same file). Wherever it builds its result objects (`{ placeId, primary, secondary }`), add `types: []` so callers can always read `.types`.

- [ ] **Step 3: Verify**

Run: `CI=true npx react-scripts build` → compiles, no warnings.
Run: `CI=true npx react-scripts test src/services --watchAll=false` → existing suites still PASS (`nearbySearch.helpers.test.js` etc.).

- [ ] **Step 4: Commit**

```bash
git add src/services/googlePlaces.js
git commit -m "feat(places): expose prediction `types` from autocomplete()"
```

---

### Task 5: `DestinationFocus.jsx`

**Files:**
- Create: `src/components/DestinationFocus.jsx`
- Test: `src/components/DestinationFocus.test.js`

**Interfaces:**
- Consumes: `FOCUS_REGIONS` (`../data/focusRegions`), `autocomplete` + `getDetails` (`../services/googlePlaces`), `useDarkMode` (`../utils/theme`).
- Produces: `export default function DestinationFocus({ destName, scope, curatedId, countryBias, onPick, onSkip })`
  - `scope: "country" | "region"`.
  - `curatedId: string | null` — when set **and** `scope === "country"`, render `FOCUS_REGIONS[curatedId]` chips.
  - `countryBias: {west,south,east,north} | undefined` — passed to `autocomplete(q, { types: ["(cities)"], bias })`.
  - `onPick({ kind: "region" | "cities", cities: string[] /* English */, label: string })`.
  - `onSkip()`.
  - Renders nothing structural beyond a titled panel; **not** a modal/overlay (the parent places it inside its own modal body).

- [ ] **Step 1: Write the failing test**

```jsx
// src/components/DestinationFocus.test.js
import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import DestinationFocus from "./DestinationFocus";

jest.mock("../services/googlePlaces", () => ({
  autocomplete: jest.fn(async () => [
    { placeId: "c1", primary: "Chiang Mai", secondary: "Thailand", types: ["locality"] },
  ]),
  getDetails: jest.fn(async (id) => ({ name: id === "c1" ? "Chiang Mai" : "X", place_id: id })),
}));

const base = {
  destName: "תאילנד", scope: "country", curatedId: "th",
  onPick: jest.fn(), onSkip: jest.fn(),
};

test("country + curatedId: a chip per FOCUS_REGIONS entry; tap → onPick(region)", () => {
  const onPick = jest.fn();
  render(<DestinationFocus {...base} onPick={onPick} />);
  expect(screen.getByText("בנגקוק והמרכז")).toBeInTheDocument();
  expect(screen.getByText("הצפון")).toBeInTheDocument();
  fireEvent.click(screen.getByText("הצפון"));
  expect(onPick).toHaveBeenCalledWith(expect.objectContaining({
    kind: "region", label: "הצפון", cities: ["Chiang Mai", "Pai"],
  }));
});

test("region scope: no curated chips, city search present", () => {
  render(<DestinationFocus {...base} scope="region" curatedId={null} />);
  expect(screen.queryByText("בנגקוק והמרכז")).toBeNull();
  expect(screen.getByPlaceholderText(/עיר/)).toBeInTheDocument();
});

test("city picker: search → pick → chip → המשך fires onPick(cities, english names)", async () => {
  const onPick = jest.fn();
  render(<DestinationFocus {...base} onPick={onPick} />);
  fireEvent.click(screen.getByText(/בחר ערים/));
  const input = screen.getByPlaceholderText(/עיר/);
  fireEvent.change(input, { target: { value: "chiang" } });
  fireEvent.click(await screen.findByText("Chiang Mai"));
  fireEvent.click(screen.getByText(/המשך/));
  await waitFor(() => expect(onPick).toHaveBeenCalledWith(expect.objectContaining({
    kind: "cities", cities: ["Chiang Mai"],
  })));
});

test("תכנן לי → onSkip", () => {
  const onSkip = jest.fn();
  render(<DestinationFocus {...base} onSkip={onSkip} />);
  fireEvent.click(screen.getByText(/תכנן לי/));
  expect(onSkip).toHaveBeenCalledTimes(1);
});
```

- [ ] **Step 2: Run, expect FAIL** — `Cannot find module './DestinationFocus'`.

- [ ] **Step 3: Implement `src/components/DestinationFocus.jsx`**

```jsx
import React, { useState } from "react";
import { useDarkMode } from "../utils/theme";
import { FOCUS_REGIONS } from "../data/focusRegions";
import { autocomplete, getDetails } from "../services/googlePlaces";

const MAX_CITIES = 3;

export default function DestinationFocus({ destName, scope, curatedId, countryBias, onPick, onSkip }) {
  const { dark } = useDarkMode();
  const P = dark
    ? { ink: "#F4F5F7", ink2: "#B9BEC7", line: "#2A2E37", surface: "#1C1F26", card: "#15171C", accent: "#E0533F" }
    : { ink: "#1E1E24", ink2: "#6B7280", line: "#E7E8EC", surface: "#F6F6F4", card: "#FFFFFF", accent: "#E0533F" };

  const regions = (scope === "country" && curatedId && FOCUS_REGIONS[curatedId]) || null;
  const [mode, setMode] = useState(regions ? "regions" : "cities"); // regions | cities
  const [q, setQ] = useState("");
  const [preds, setPreds] = useState([]);
  const [picked, setPicked] = useState([]); // { name, placeId }
  const [busy, setBusy] = useState(false);

  const search = async (val) => {
    setQ(val);
    if (val.trim().length < 2) { setPreds([]); return; }
    try {
      const r = await autocomplete(val.trim(), { types: ["(cities)"], ...(countryBias ? { bias: countryBias } : {}) });
      setPreds(r.slice(0, 6));
    } catch { setPreds([]); }
  };
  const addCity = async (p) => {
    if (picked.length >= MAX_CITIES || picked.some((x) => x.placeId === p.placeId)) return;
    let name = p.primary;
    try { const d = await getDetails(p.placeId); if (d && d.name) name = d.name; } catch { /* keep p.primary */ }
    setPicked((prev) => [...prev, { name, placeId: p.placeId }]);
    setQ(""); setPreds([]);
  };
  const removeCity = (id) => setPicked((prev) => prev.filter((x) => x.placeId !== id));
  const confirmCities = async () => {
    if (!picked.length) return;
    setBusy(true);
    onPick({ kind: "cities", cities: picked.map((x) => x.name), label: picked.map((x) => x.name).join(" · ") });
  };

  const title = scope === "country"
    ? `${destName} גדולה — על איזה אזור לכוון?`
    : `${destName} — אילו ערים לכלול?`;

  return (
    <div dir="rtl" style={{ fontFamily: "inherit" }}>
      <div style={{ fontSize: 15, fontWeight: 800, color: P.ink, marginBottom: 4 }}>{title}</div>
      <div style={{ fontSize: 12.5, color: P.ink2, marginBottom: 14 }}>
        זה עוזר ל-AI לבנות מסלול הגיוני במקום לפזר את הימים על כל היעד.
      </div>

      {mode === "regions" && regions && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {regions.map((r) => (
            <button key={r.id}
              onClick={() => onPick({ kind: "region", cities: r.cities.map((c) => c.en), label: r.label })}
              style={{ textAlign: "start", minHeight: 56, padding: "10px 14px", borderRadius: 12, border: `1px solid ${P.line}`, background: P.card, color: P.ink, cursor: "pointer", fontFamily: "inherit" }}>
              <div style={{ fontSize: 14, fontWeight: 800 }}>{r.label}</div>
              <div style={{ fontSize: 12, color: P.ink2, marginTop: 2 }}>{r.blurb} · {r.cities.map((c) => c.he).join(", ")}</div>
            </button>
          ))}
          <button onClick={() => setMode("cities")}
            style={{ minHeight: 44, borderRadius: 12, border: `1px dashed ${P.line}`, background: "transparent", color: P.ink2, fontSize: 13, fontWeight: 800, cursor: "pointer", fontFamily: "inherit" }}>
            אזור אחר / בחר ערים
          </button>
        </div>
      )}

      {mode === "cities" && (
        <div>
          {picked.length > 0 && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 8 }}>
              {picked.map((c) => (
                <span key={c.placeId} style={{ display: "inline-flex", alignItems: "center", gap: 6, height: 32, padding: "0 10px", borderRadius: 999, background: P.surface, color: P.ink, fontSize: 12.5, fontWeight: 800 }}>
                  {c.name}
                  <button onClick={() => removeCity(c.placeId)} aria-label={`הסר ${c.name}`}
                    style={{ border: "none", background: "transparent", color: P.ink2, cursor: "pointer", fontSize: 13, lineHeight: 1 }}>✕</button>
                </span>
              ))}
            </div>
          )}
          {picked.length < MAX_CITIES && (
            <>
              <input value={q} onChange={(e) => search(e.target.value)} placeholder="חפשו עיר…"
                style={{ width: "100%", boxSizing: "border-box", height: 44, borderRadius: 12, border: `1px solid ${P.line}`, background: P.surface, color: P.ink, padding: "0 14px", fontSize: 14, fontFamily: "inherit", direction: "rtl", textAlign: "right" }} />
              {preds.length > 0 && (
                <ul style={{ listStyle: "none", margin: "6px 0 0", padding: 0, border: `1px solid ${P.line}`, borderRadius: 12, overflow: "hidden" }}>
                  {preds.map((p) => (
                    <li key={p.placeId} onClick={() => addCity(p)}
                      style={{ padding: "10px 14px", cursor: "pointer", fontSize: 13.5, color: P.ink, borderBottom: `1px solid ${P.line}` }}>
                      {p.primary}{p.secondary ? <span style={{ color: P.ink2 }}> · {p.secondary}</span> : null}
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
          <button onClick={confirmCities} disabled={!picked.length || busy}
            style={{ marginTop: 12, width: "100%", minHeight: 48, borderRadius: 12, border: "none", background: picked.length ? P.accent : P.line, color: "#fff", fontSize: 14, fontWeight: 800, cursor: picked.length ? "pointer" : "default", fontFamily: "inherit" }}>
            המשך{picked.length ? ` (${picked.length})` : ""}
          </button>
        </div>
      )}

      <button onClick={onSkip}
        style={{ marginTop: 10, width: "100%", minHeight: 44, borderRadius: 12, border: "none", background: "transparent", color: P.ink2, fontSize: 13, fontWeight: 800, cursor: "pointer", fontFamily: "inherit" }}>
        תכנן לי — לא משנה לי
      </button>
    </div>
  );
}
```

> The Task-5 test for "region scope" queries `getByPlaceholderText(/עיר/)` — the input placeholder is `"חפשו עיר…"`, matches. The "city picker" test clicks `getByText(/בחר ערים/)` — only present in `mode==="regions"`; for the `scope:"country"` base it starts in `regions` mode, so that button exists. Good. For `scope:"region"` it starts in `cities` mode (no such button) — that test doesn't click it.

- [ ] **Step 4: Run, expect PASS** (4).

Run: `CI=true npx react-scripts test src/components/DestinationFocus.test.js --watchAll=false`

- [ ] **Step 5: Commit**

```bash
git add src/components/DestinationFocus.jsx src/components/DestinationFocus.test.js
git commit -m "feat(ai): DestinationFocus — region chips + city picker + skip"
```

---

### Task 6: Wire `focus` through the generate pipeline

**Files:**
- Modify: `api/_lib/prompt.js` (add `focus` param + FOCUS clause)
- Modify: `api/_lib/prompt.test.js` (2 new cases)
- Modify: `api/generate-trip.js` (pass `focus` from `payload` into `buildPrompt`)
- Modify: `src/services/aiTrip.js` (`focus` + `destScope` in `body`; `focus` bool on the started event)

**Interfaces:**
- Consumes: nothing new from earlier tasks.
- Produces: `buildPrompt({ …, focus })` where `focus = { cities: string[], label?: string } | null`. When `focus?.cities?.length`, `system` contains a `(FOCUS)` clause and `user` JSON contains `focusCities: string[]`.

- [ ] **Step 1: Add the failing prompt tests**

Append to `api/_lib/prompt.test.js`:

```js
test("buildPrompt: focus adds the (FOCUS) clause + focusCities", () => {
  const { system, user } = buildPrompt({ destination: "Thailand", dayCount: 6, focus: { cities: ["Chiang Mai", "Pai"], label: "הצפון" } });
  assert.ok(system.includes("(FOCUS)"));
  assert.ok(system.includes("ONLY within"));
  const parsed = JSON.parse(user);
  assert.deepStrictEqual(parsed.focusCities, ["Chiang Mai", "Pai"]);
});

test("buildPrompt: no focus → no (FOCUS) clause, no focusCities", () => {
  const { system, user } = buildPrompt({ destination: "Thailand", dayCount: 6 });
  assert.ok(!system.includes("(FOCUS)"));
  assert.strictEqual(JSON.parse(user).focusCities, undefined);
});
```

- [ ] **Step 2: Run, expect FAIL.**

Run: `npm run test:api`

- [ ] **Step 3: Implement in `api/_lib/prompt.js`**

Add `focus` to the destructured arg. After the `maxCities` line:

```js
  const focusCities = Array.isArray(focus && focus.cities) ? focus.cities.filter(Boolean) : [];
```

In the `system` string, immediately after the `(GEO)` sentence and before the `refine` ternary, add:

```js
    (focusCities.length
      ? ` (FOCUS) Plan the ENTIRE trip ONLY within these places: ${focusCities.join(", ")}. Include nothing outside them. Spread the days across them as one consecutive route.`
      : "") +
```

In the `user` object, add:

```js
    ...(focusCities.length ? { focusCities } : {}),
```

- [ ] **Step 4: Run, expect PASS** (`npm run test:api` → 14).

- [ ] **Step 5: Handler passes `focus`**

`api/generate-trip.js` — find where `payload` is assembled from the request body (search `dayCount` / `req.body`). Add `focus` (and keep `destScope` out of the prompt — it's client-analytics only). The `buildPrompt(payload)` call then receives `focus` automatically if `payload.focus` is set. If `payload` is built field-by-field, add `focus: body.focus || null`.

- [ ] **Step 6: Client sends `focus` + `destScope`**

`src/services/aiTrip.js` — in `generateItinerary`, the `body` object gains:

```js
    focus: payload.focus || null,
    destScope: payload.destScope || null,
```

And `track("ai_generate_started", { … })` gains `focus: !!body.focus`.

- [ ] **Step 7: Verify**

Run: `npm run test:api` → PASS (14).
Run: `CI=true npx react-scripts test src/services --watchAll=false` → PASS.
Run: `CI=true npx react-scripts build` → compiles clean.
Run: `npm run critical` → 9/9.

- [ ] **Step 8: Commit**

```bash
git add api/_lib/prompt.js api/_lib/prompt.test.js api/generate-trip.js src/services/aiTrip.js
git commit -m "feat(ai): thread `focus` (region/cities) into the generate-trip prompt"
```

---

### Task 7: `AiTripModal` — the focus phase

**Files:**
- Modify: `src/components/AiTripModal.jsx`

**Interfaces:**
- Consumes: `classifyDestScope`, `matchCuratedCountry` (`../utils/destScope`); `DestinationFocus` (`./DestinationFocus`); the existing `runGenerate`.

**Context:** `AiTripModal` has `phase` state (`"form" | "review"`), a `runGenerate({ refine })` that calls `generateItinerary({...})`, and `pickDest(p)` that sets `destChosen`/`destination`. `useDarkMode()` gives `dark`. `ACCENT` is in scope.

- [ ] **Step 1: Capture scope on destination pick**

Add state near the other dest state (search `const [destChosen`):

```jsx
  const [destTypes, setDestTypes] = useState([]);
  const [destScope, setDestScope] = useState("city");   // "country" | "region" | "city"
  const [curatedId, setCuratedId] = useState(null);
  const [focus, setFocus] = useState(null);             // { cities, label } | null
```

In `pickDest(p)` add (after `setDestChosen(true)`):

```jsx
    const types = p.types || [];
    setDestTypes(types);
    setDestScope(classifyDestScope(types));
    setCuratedId(matchCuratedCountry(p.primary, p.secondary, types));
    setFocus(null);
```

Also reset these in `resetAll()` (`setDestScope("city"); setCuratedId(null); setFocus(null); setDestTypes([]);`).

Imports at the top:

```jsx
import { classifyDestScope, matchCuratedCountry } from "../utils/destScope";
import DestinationFocus from "./DestinationFocus";
```

- [ ] **Step 2: Insert the `"focus"` phase**

Change the primary generate button (search `onClick={() => runGenerate()}` inside the `phase === "form"` block, the one gated by `disabled={!canSubmit}`):

```jsx
            <button onClick={() => {
              if ((destScope === "country" || destScope === "region") && !focus) { setPhase("focus"); return; }
              runGenerate();
            }} disabled={!canSubmit}
```

(The Enter-key handler nearby — search `if (destOpen && destPreds.length` … there's an `else if (canSubmit) runGenerate();` — change that `runGenerate()` to the same conditional: `else if (canSubmit) { if ((destScope === "country" || destScope === "region") && !focus) setPhase("focus"); else runGenerate(); }`.)

Render the focus phase — add a block alongside `{phase === "form" && …}` and `{phase === "review" && …}`:

```jsx
        {phase === "focus" && !showLoader && (
          <div style={{ padding: "4px 2px" }}>
            <DestinationFocus
              destName={destination.split(",")[0].trim()}
              scope={destScope}
              curatedId={curatedId}
              onPick={(pick) => { setFocus({ cities: pick.cities, label: pick.label }); setPhase("form"); runGenerate({ focus: { cities: pick.cities, label: pick.label } }); }}
              onSkip={() => { setPhase("form"); runGenerate({ focus: null }); }}
            />
            <button onClick={() => setPhase("form")}
              style={{ marginTop: 6, width: "100%", minHeight: 40, border: "none", background: "transparent", color: dark ? "#B9BEC7" : "#6B7280", fontSize: 12.5, fontWeight: 800, cursor: "pointer", fontFamily: "inherit" }}>
              → חזרה
            </button>
          </div>
        )}
```

- [ ] **Step 3: `runGenerate` sends `focus` + `destScope`**

Change `runGenerate`'s signature and the `generateItinerary(...)` call:

```jsx
  const runGenerate = async ({ refine, focus: focusArg } = {}) => {
    const effectiveFocus = focusArg !== undefined ? focusArg : focus;
    …
      const res = await generateItinerary({
        destination: destination.trim(), dayCount, pace,
        preferences: interests, transport, instructions,
        party: { adults, kids },
        restrictions: [...restrictions, ...(restrictText.trim() ? [restrictText.trim()] : [])],
        focus: effectiveFocus || null,
        destScope,
        refine: refine || undefined,
        previous: refine && result ? summarizeForRefine(result) : undefined,
      });
```

(`focusArg` lets `onPick`/`onSkip` pass the choice synchronously without waiting for `setFocus` to flush.)

- [ ] **Step 4: Header copy for the phase (optional polish)**

Search the header title expression (`phase === "form" ? "יצירת מסלול עם AI" : …`). Add a `phase === "focus"` arm → `"על איזה אזור לכוון?"` for both the title and subtitle. Low priority; skip if it complicates the ternary.

- [ ] **Step 5: Verify**

Run: `CI=true npx react-scripts test --watchAll=false` → all PASS (no AiTripModal unit test exists; don't add one — it's a large modal, covered by the manual plan).
Run: `CI=true npx react-scripts build` → clean.
Manual (dev server): open the AI modal → type "Thailand", pick the country prediction → click "בנה מסלול" → the focus step shows → pick "הצפון" → it generates → every day's city is Chiang Mai or Pai. Then reopen → "Tokyo" → **no** focus step. Then "Thailand" → "תכנן לי" → generates a coherent 1–2 city trip.

- [ ] **Step 6: Commit**

```bash
git add src/components/AiTripModal.jsx
git commit -m "feat(ai): AiTripModal — focus step for country/region destinations"
```

---

### Task 8: `WizardView` — region chips on the city step

**Files:**
- Modify: `src/views/WizardView.jsx`

**Interfaces:**
- Consumes: `FOCUS_REGIONS` (`../data/focusRegions`); the existing `addCity(name)`, `cities` state (`[{ name, days }]`), `destId`.

**Context:** the wizard's city-routing step renders `SUGGESTED_CITIES[destId]` quick-add chips (search `SUGGESTED_CITIES[destId]).map((cityName)` — a `<button onClick={() => addCity(cityName)}>`). `destId` is only set for the 10 curated countries. The wizard never calls the AI, so there is **no** `focus`/`destScope` here — this is pure UX.

- [ ] **Step 1: Import**

```js
import { FOCUS_REGIONS } from "../data/focusRegions";
```

- [ ] **Step 2: Region chips above the suggested-city chips**

Directly before the `{(SUGGESTED_CITIES[destId] || []).length > 0 && (` block that renders the per-city quick-add chips on the routing step, add:

```jsx
              {cities.length === 0 && (FOCUS_REGIONS[destId] || []).length > 0 && (
                <div style={{ marginBottom: 12 }}>
                  <div style={{ fontSize: 12, fontWeight: 800, color: T.ink3, marginBottom: 6 }}>או בחרו אזור מוכן:</div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                    {FOCUS_REGIONS[destId].map((r) => (
                      <button key={r.id}
                        onClick={() => r.cities.forEach((c) => addCity(c.he))}
                        style={{ minHeight: 44, padding: "8px 14px", borderRadius: 999, border: `1px solid ${T.line}`, background: "#fff", color: T.ink2, fontSize: 13, fontWeight: 800, cursor: "pointer", fontFamily: "inherit" }}>
                        {r.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}
```

(Use whatever token names the surrounding wizard JSX uses — check the palette object near the top of `WizardView.jsx`; the routing step already references `T.ink3` / `T.line`.)

- [ ] **Step 3: Verify**

Run: `CI=true npx react-scripts build` → clean.
Manual: `/create` → pick "תאילנד" → next to the day step → the routing step shows "או בחרו אזור מוכן:" with the 4 Thailand region chips; tap "הדרום והאיים" → two city rows (פוקט, קראבי) appear and the allocation UI works. Chips hide once `cities` is non-empty.

- [ ] **Step 4: Commit**

```bash
git add src/views/WizardView.jsx
git commit -m "feat(ai): wizard — curated region chips prefill the city-routing step"
```

---

### Task 9: QA plan + full gate + WORKLOG

**Files:**
- Modify: `docs/QA-TEST-PLAN.md` (untracked — append a section, do NOT `git add`/commit it)
- Modify: `WORKLOG.md` (untracked — controller appends the line at finish, not here)

- [ ] **Step 1: Append the manual QA section to `docs/QA-TEST-PLAN.md`**

Add "## 9. AI destination focus (2026-09-02)" with:
- T-FOCUS-01 P0 — Modal → "Thailand" (pick the *country* prediction) → "בנה מסלול" → focus step appears → pick "הצפון" → every generated `day.city` ∈ {Chiang Mai, Pai}; the description names them.
- T-FOCUS-02 P0 — Modal → "Thailand" → "תכנן לי" → generates ≤ ⌈days/3⌉ cities, consecutive multi-day blocks (or 1 hub + day trips for ≤ 4 days).
- T-FOCUS-03 P1 — Modal → "Tokyo" (a city) → **no** focus step; generates as before.
- T-FOCUS-04 P1 — Modal → "Tuscany, Italy" → focus step, `scope:"region"`, **no** curated chips, city-picker only.
- T-FOCUS-05 P1 — Modal → focus step → "בחר ערים" → add 2 cities → "המשך" → generation stays within those 2.
- T-FOCUS-06 P1 — After a focused generation, "בנה מחדש" / refine keeps the focus (doesn't reopen the step).
- T-FOCUS-07 P1 — Wizard → "תאילנד" → routing step shows "או בחרו אזור מוכן:" + 4 region chips; tap one → city rows prefilled; chips vanish when `cities` non-empty.
- T-FOCUS-08 P2 — Places key absent (`localhost` no key) → focus step still renders region chips; city-picker shows sim results; generation uses the demo generator, no crash.
- T-FOCUS-09 P2 — RTL + dark mode on the focus step (modal theme-aware).

- [ ] **Step 2: Full automated gate**

Run, in order — all must pass:
1. `npm run critical`
2. `npm run test:api`
3. `CI=true npx react-scripts test --watchAll=false`
4. `CI=true npx react-scripts build` (no warnings)

If any fail, STOP and report — do not fix.

- [ ] **Step 3: Report** — write the gate output to the task report file. No commit.

---

## Self-Review

**1. Spec coverage**

| Spec section | Task |
|---|---|
| B already shipped; A adds FOCUS only, GEO self-gates | Global Constraints + Task 6 |
| A.1 detect broad — `autocomplete` returns `types`; `classifyDestScope`; `matchCuratedCountry` | Tasks 4, 2 |
| A.2 `DestinationFocus` — region chips / city picker / skip | Task 5 |
| A.3 `FOCUS_REGIONS` data (10 countries) | Task 3 |
| A.4 request contract — `focus {cities,label}`, `destScope` analytics-only | Task 6 |
| A.5 modal focus phase | Task 7 |
| A.6 wizard region chips (no AI, prefill only) | Task 8 |
| A.7 no `cityRanges` from focus | not implemented = correct (Task 6 note; nothing sets it) |
| A.8 analytics events | Task 6 (`ai_generate_started` bool); `ai_focus_shown`/`ai_focus_chosen` — **see gap 1** |
| A.9 shared `destinations.js` | Task 1 |
| Testing (unit/component/api/manual) | Tasks 1–6 unit/api; Task 5 component; Task 9 manual |

**Gap 1 — `ai_focus_shown` / `ai_focus_chosen` events.** The spec (A.8) wants these fired from `DestinationFocus`. Task 5's component doesn't emit them. **Fix inline:** add to Task 5 Step 3 — `import { track } from "../analytics/posthog";`, a `useEffect(() => track("ai_focus_shown", { scope, curated: !!curatedId }), [])`, and `track("ai_focus_chosen", { kind, label, cityCount })` inside `onPick`/`onSkip` wrappers (skip → `kind:"skip"`). Add one assertion to the Task 5 test that a `track` mock is called on mount (mock `../analytics/posthog`). *[Executor: apply this; it was missed in the first draft.]*

**Gap 2 — Task 6 Step 5 is vague** ("find where `payload` is assembled"). Acceptable: `api/generate-trip.js` is not quoted in this plan and the executor must read it; the instruction (add `focus: body.focus || null` to the payload, leave `destScope` out of the prompt) is concrete enough.

**2. Placeholder scan** — no "TBD"/"handle errors"/"similar to Task N". Every code step has real code. The `FOCUS_REGIONS` data is fully written for all 10 countries. `ae`'s first region has a trailing `,` typo in the object literal (`cities: [...] , ,`) — **executor: write `cities: [{ he: "דובאי", en: "Dubai" }]` with no trailing comma junk.**

**3. Type consistency**
- `focus` shape `{ cities: string[], label: string }` — Task 5 `onPick`, Task 6 `buildPrompt`/`aiTrip.js`, Task 7 `runGenerate` — consistent (English city names throughout; `label` Hebrew, display-only).
- `classifyDestScope` return `"country"|"region"|"city"` — Task 2 defines, Task 7 consumes.
- `matchCuratedCountry(primary, secondary, types) → id|null` — Task 2 defines, Task 7 consumes with `(p.primary, p.secondary, types)`.
- `FOCUS_REGIONS[id] → {id,label,blurb,cities:[{he,en}]}[]` — Task 3 defines, Tasks 5 + 8 consume (`.cities.map(c=>c.en)` in the component, `.cities.forEach(c=>addCity(c.he))` in the wizard) — consistent.
- `autocomplete()` result `+types` — Task 4 defines, Tasks 5 + 7 consume.
- `DESTINATIONS`/`SUGGESTED_CITIES`/`CITY_POOL`/`COUNTRY_EN_TO_ID` — Task 1 exports; Tasks 2, 3, 8 import.

No inconsistencies beyond the two gaps fixed above.

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-09-02-ai-focus-region.md`. Two execution options:

1. **Subagent-Driven (recommended)** — fresh subagent per task, task review + fix loop between each.
2. **Inline Execution** — batched with checkpoints.

Which approach?
