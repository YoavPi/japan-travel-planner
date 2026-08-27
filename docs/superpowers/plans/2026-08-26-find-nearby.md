# Find Nearby ("מצא לי X באזור") Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** From a saved point's card (reached by clicking its map marker or its list row), let the user pick a category or type free text and see nearby places plotted on the map, reusing the existing search-results markers + preview→add flow.

**Architecture:** A thin, point-centered wrapper over the search pipeline already built for the editor search bar. New: a pure category catalog, a `nearbySearch()` Places call (point + radius, widen when sparse), and a `NearbySearchSheet` picker. Everything downstream (`searchResults` map markers, preview card, add-to-day, finOps metering) is reused unchanged.

**Tech Stack:** React 19 (CRA / react-scripts 5), inline styles, Google Maps JS Places (legacy `PlacesService`), Jest + React Testing Library (via react-scripts), MapLibre map.

## Global Constraints

- RTL Hebrew UI; inline styles using each file's local `T`/token object. No new visual language — reuse existing sheet/card/marker styles.
- Brand tokens: ink `#0D0F11`, accent `#E0533F`, charcoal `#1E1E24`, line `rgba(20,20,20,0.09)`, font `'Noto Sans Hebrew','Inter',system-ui,sans-serif`. No blue/teal.
- Fixed radius: `NEARBY_RADIUS = 1500` (m); widen to `NEARBY_WIDE_RADIUS = 5000` when the first pass returns fewer than `NEARBY_MIN_RESULTS = 4`.
- Every live Places call is metered: `finOpsTracker.recordTextSearch()` per `nearbySearch` API request, and respects `liveAvailable()` / `enforceRateLimit()` exactly like `textSearch`.
- Map Discovery Invariant: a picked result NEVER commits a stop directly — it opens the preview card; the user confirms "הוספה למסלול".
- Build must be warning-free: `CI=true npx react-scripts build` (CI treats warnings as errors). No unused imports/vars.
- Paired surfaces: mobile `EditorView.jsx` and desktop `EditorDesktop.jsx` are separate; wire both.

---

### Task 1: Category catalog util

**Files:**
- Create: `src/utils/nearbyCategories.js`
- Test: `src/utils/nearbyCategories.test.js`

**Interfaces:**
- Produces: `NEARBY_CATEGORIES: Array<{ id: string, label: string, emoji: string, type: string }>` — the fixed chips for the picker (`type` is a Google Places `nearbySearch` type).

- [ ] **Step 1: Write the failing test**

```js
// src/utils/nearbyCategories.test.js
import { NEARBY_CATEGORIES } from "./nearbyCategories";

test("has the 7 expected categories with a Google type each", () => {
  const ids = NEARBY_CATEGORIES.map((c) => c.id);
  expect(ids).toEqual([
    "restaurant", "cafe", "supermarket", "tourist_attraction", "bar", "pharmacy", "atm",
  ]);
  for (const c of NEARBY_CATEGORIES) {
    expect(typeof c.label).toBe("string");
    expect(c.label.length).toBeGreaterThan(0);
    expect(typeof c.emoji).toBe("string");
    expect(typeof c.type).toBe("string");
    expect(c.type.length).toBeGreaterThan(0);
  }
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `CI=true npx react-scripts test src/utils/nearbyCategories.test.js --watchAll=false`
Expected: FAIL — cannot find module `./nearbyCategories`.

- [ ] **Step 3: Write minimal implementation**

```js
// src/utils/nearbyCategories.js
/* Fixed category chips for "מצא לי X באזור". `type` is a Google Places
   nearbySearch place type; `id === type` for the fixed set. */
export const NEARBY_CATEGORIES = [
  { id: "restaurant",        label: "מסעדות",     emoji: "🍽️", type: "restaurant" },
  { id: "cafe",              label: "בתי קפה",    emoji: "☕",  type: "cafe" },
  { id: "supermarket",       label: "סופרמרקט",   emoji: "🛒", type: "supermarket" },
  { id: "tourist_attraction",label: "אטרקציות",   emoji: "🏛️", type: "tourist_attraction" },
  { id: "bar",               label: "ברים",       emoji: "🍺", type: "bar" },
  { id: "pharmacy",          label: "בית מרקחת",  emoji: "💊", type: "pharmacy" },
  { id: "atm",               label: "כספומט",     emoji: "🏧", type: "atm" },
];

export default NEARBY_CATEGORIES;
```

- [ ] **Step 4: Run test to verify it passes**

Run: `CI=true npx react-scripts test src/utils/nearbyCategories.test.js --watchAll=false`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/utils/nearbyCategories.js src/utils/nearbyCategories.test.js
git commit -m "feat(nearby): category catalog for find-nearby"
```

---

### Task 2: `nearbySearch` Places call + pure helpers

**Files:**
- Modify: `src/services/googlePlaces.js` (add near `textSearch`, before the `googlePlaces` default object)
- Test: `src/services/nearbySearch.helpers.test.js`

**Interfaces:**
- Consumes: existing module internals `ensureServices`, `liveAvailable`, `enforceRateLimit`, `placesSvc`, `finOpsTracker` (already in the file).
- Produces:
  - `mapNearbyResult(r) => { placeId, name, primary, secondary, lat, lng, rating, types } | null` — pure mapper for one raw Google result (exported for tests).
  - `shouldWidenNearby(results) => boolean` — pure: `results.length < 4` (exported for tests).
  - `nearbySearch(center, opts) => Promise<Array<result>>` where `center = { lat, lng }` and `opts = { type?: string, keyword?: string }`. Returns the same result shape as `textSearch` (so it feeds `searchResults` directly). Radius fixed at 1500 m, widened to 5000 m when the first pass has < 4 results.

- [ ] **Step 1: Write the failing test (pure helpers only)**

```js
// src/services/nearbySearch.helpers.test.js
import { mapNearbyResult, shouldWidenNearby } from "./googlePlaces";

const fakeRaw = (over = {}) => ({
  place_id: "p1", name: "Trattoria", vicinity: "Via Roma 1",
  geometry: { location: { lat: () => 41.9, lng: () => 12.5 } },
  rating: 4.4, types: ["restaurant"], ...over,
});

test("mapNearbyResult maps a raw Google result to the search result shape", () => {
  expect(mapNearbyResult(fakeRaw())).toEqual({
    placeId: "p1", name: "Trattoria", primary: "Trattoria",
    secondary: "Via Roma 1", lat: 41.9, lng: 12.5, rating: 4.4, types: ["restaurant"],
  });
});

test("mapNearbyResult returns null when coordinates are missing", () => {
  expect(mapNearbyResult(fakeRaw({ geometry: undefined }))).toBeNull();
});

test("shouldWidenNearby is true only when fewer than 4 results", () => {
  expect(shouldWidenNearby([1, 2, 3])).toBe(true);
  expect(shouldWidenNearby([1, 2, 3, 4])).toBe(false);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `CI=true npx react-scripts test src/services/nearbySearch.helpers.test.js --watchAll=false`
Expected: FAIL — `mapNearbyResult`/`shouldWidenNearby` not exported.

- [ ] **Step 3: Write the implementation**

Add to `src/services/googlePlaces.js`, immediately AFTER the `textSearch` export and BEFORE `const googlePlaces = {`:

```js
/* ── Nearby Search (point + radius) — powers "מצא לי X באזור" ─────── */
export const NEARBY_RADIUS = 1500;      // metres — smart default
export const NEARBY_WIDE_RADIUS = 5000; // metres — widen when sparse
export const NEARBY_MIN_RESULTS = 4;

/* Pure: map ONE raw google.maps result to our search-result shape (or null
   when it has no usable coordinates). Exported for unit testing. */
export const mapNearbyResult = (r) => {
  const lat = r?.geometry?.location?.lat?.();
  const lng = r?.geometry?.location?.lng?.();
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return {
    placeId: r.place_id,
    name: r.name,
    primary: r.name,
    secondary: r.formatted_address || r.vicinity || "",
    lat, lng,
    rating: r.rating ?? null,
    types: r.types || [],
  };
};

/* Pure: widen the radius only when the first pass found too few. */
export const shouldWidenNearby = (results) => (results || []).length < NEARBY_MIN_RESULTS;

/* Search places of `type` (chip) or matching `keyword` (free text) around a
   center point. Same result shape as textSearch, so it feeds `searchResults`
   directly. Widens once when the first pass is sparse. */
export const nearbySearch = async (center, opts = {}) => {
  if (!center || !Number.isFinite(center.lat) || !Number.isFinite(center.lng)) return [];
  const type = opts.type || null;
  const keyword = opts.keyword ? String(opts.keyword).trim() : null;
  if (!type && !keyword) return [];
  enforceRateLimit(); // throws RateLimitError on flood
  if (!liveAvailable()) return [];
  try {
    const google = await ensureServices();
    const location = new google.maps.LatLng(center.lat, center.lng);
    const runOnce = (radius) => new Promise((resolve) => {
      placesSvc.nearbySearch(
        { location, radius, ...(type ? { type } : {}), ...(keyword ? { keyword } : {}) },
        (results, status) => {
          try { finOpsTracker.recordTextSearch(); } catch { /* metering is best-effort */ }
          resolve(status === "OK" && results
            ? results.slice(0, 12).map(mapNearbyResult).filter(Boolean)
            : []);
        }
      );
    });
    let out = await runOnce(NEARBY_RADIUS);
    if (shouldWidenNearby(out)) out = await runOnce(NEARBY_WIDE_RADIUS);
    return out;
  } catch {
    return [];
  }
};
```

Then add `nearbySearch` to the `googlePlaces` default export object (next to `textSearch`):

```js
const googlePlaces = {
  isPlacesEnabled,
  isSearchEnabled,
  loadPlaces,
  autocomplete,
  textSearch,
  nearbySearch,
  getDetails,
  RateLimitError,
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `CI=true npx react-scripts test src/services/nearbySearch.helpers.test.js --watchAll=false`
Expected: PASS (3 tests).

- [ ] **Step 5: Verify the build compiles**

Run: `CI=true npx react-scripts build`
Expected: "Compiled successfully" / no warnings.

- [ ] **Step 6: Commit**

```bash
git add src/services/googlePlaces.js src/services/nearbySearch.helpers.test.js
git commit -m "feat(nearby): point-centered nearbySearch with widen + metering"
```

---

### Task 3: `NearbySearchSheet` picker component

**Files:**
- Create: `src/components/NearbySearchSheet.jsx`
- Test: `src/components/NearbySearchSheet.test.js`

**Interfaces:**
- Consumes: `NEARBY_CATEGORIES` (Task 1).
- Produces: default export `NearbySearchSheet`. Props:
  - `point: { nameHe?, name?, ... }` — origin point (for the title).
  - `onPick(query)` — `query` is `{ type: string }` (chip) or `{ keyword: string }` (free text).
  - `onClose()`.
  Presentational only — no data fetching inside.

- [ ] **Step 1: Write the failing test**

```js
// src/components/NearbySearchSheet.test.js
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import NearbySearchSheet from "./NearbySearchSheet";

test("picking a chip calls onPick with its type", () => {
  const onPick = jest.fn();
  render(<NearbySearchSheet point={{ nameHe: "המלון" }} onPick={onPick} onClose={() => {}} />);
  fireEvent.click(screen.getByText("מסעדות"));
  expect(onPick).toHaveBeenCalledWith({ type: "restaurant" });
});

test("submitting free text calls onPick with the keyword", () => {
  const onPick = jest.fn();
  render(<NearbySearchSheet point={{ nameHe: "המלון" }} onPick={onPick} onClose={() => {}} />);
  const input = screen.getByPlaceholderText(/אחר/);
  fireEvent.change(input, { target: { value: "ראמן" } });
  fireEvent.keyDown(input, { key: "Enter" });
  expect(onPick).toHaveBeenCalledWith({ keyword: "ראמן" });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `CI=true npx react-scripts test src/components/NearbySearchSheet.test.js --watchAll=false`
Expected: FAIL — cannot find module `./NearbySearchSheet`.

- [ ] **Step 3: Write the component**

```jsx
// src/components/NearbySearchSheet.jsx
import React, { useEffect, useState } from "react";
import { NEARBY_CATEGORIES } from "../utils/nearbyCategories";

/* ══════════════════════════════════════════════════════════════
   NearbySearchSheet — "מצא לי X באזור" picker. Fixed category chips
   + a free-text field. Presentational: hands the chosen query up via
   onPick({ type }) or onPick({ keyword }); the parent runs the search.
   ══════════════════════════════════════════════════════════════ */

const T = {
  panel: "#fff", ink: "#0D0F11", ink2: "#2A3036", ink3: "#6B7178",
  line: "rgba(20,20,20,0.10)", surface: "#F6F6F4", accent: "#E0533F",
  font: "'Noto Sans Hebrew','Inter',system-ui,sans-serif",
};

const NearbySearchSheet = ({ point, onPick, onClose }) => {
  const [kw, setKw] = useState("");
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, []);
  const name = point?.nameHe || point?.name || "הנקודה";
  const submitKw = () => { const v = kw.trim(); if (v) onPick({ keyword: v }); };

  return (
    <div dir="rtl" onClick={onClose}
      style={{ position: "fixed", inset: 0, zIndex: 120, display: "flex", alignItems: "flex-end", justifyContent: "center", background: "rgba(0,0,0,0.5)", fontFamily: T.font }}>
      <div className="tp-sheet-up" onClick={(e) => e.stopPropagation()}
        style={{ width: "100%", maxWidth: 520, background: T.panel, borderTopLeftRadius: 22, borderTopRightRadius: 22, boxShadow: "0 -18px 55px rgba(0,0,0,0.3)", padding: "16px 18px 22px" }}>
        <div style={{ display: "flex", justifyContent: "center", marginBottom: 10 }}>
          <div style={{ width: 44, height: 5, borderRadius: 999, background: T.line }} />
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
          <div style={{ flex: 1, fontSize: 16, fontWeight: 800, color: T.ink, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            מצא ליד <span style={{ color: T.accent }}>{name}</span>
          </div>
          <button onClick={onClose} aria-label="סגירה"
            style={{ width: 32, height: 32, borderRadius: "50%", border: "none", background: T.surface, color: T.ink2, cursor: "pointer", fontFamily: T.font, fontSize: 14 }}>✕</button>
        </div>

        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {NEARBY_CATEGORIES.map((c) => (
            <button key={c.id} onClick={() => onPick({ type: c.type })}
              style={{ display: "inline-flex", alignItems: "center", gap: 7, padding: "10px 14px", borderRadius: 999, border: `1.5px solid ${T.line}`, background: "#fff", color: T.ink2, fontSize: 14, fontWeight: 800, cursor: "pointer", fontFamily: T.font }}>
              <span aria-hidden>{c.emoji}</span> {c.label}
            </button>
          ))}
        </div>

        <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
          <input
            value={kw} onChange={(e) => setKw(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") submitKw(); }}
            placeholder="אחר… (למשל: ראמן, מכבסה)"
            style={{ flex: 1, height: 46, boxSizing: "border-box", borderRadius: 12, border: `1px solid ${T.line}`, background: T.surface, padding: "0 14px", fontSize: 14.5, fontFamily: T.font, color: T.ink, direction: "rtl", textAlign: "right" }}
          />
          <button onClick={submitKw} disabled={!kw.trim()}
            style={{ height: 46, padding: "0 18px", borderRadius: 12, border: "none", background: T.ink, color: "#fff", fontSize: 14.5, fontWeight: 800, cursor: kw.trim() ? "pointer" : "default", opacity: kw.trim() ? 1 : 0.5, fontFamily: T.font }}>
            חיפוש
          </button>
        </div>
      </div>
    </div>
  );
};

export default NearbySearchSheet;
```

- [ ] **Step 4: Run test to verify it passes**

Run: `CI=true npx react-scripts test src/components/NearbySearchSheet.test.js --watchAll=false`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/components/NearbySearchSheet.jsx src/components/NearbySearchSheet.test.js
git commit -m "feat(nearby): NearbySearchSheet category picker"
```

---

### Task 4: Wire mobile (EditorView) — card action, ⋯ row, run search

**Files:**
- Modify: `src/views/EditorView.jsx`
- Modify: `src/components/StopActionsSheet.jsx`

**Interfaces:**
- Consumes: `nearbySearch` (Task 2), `NearbySearchSheet` (Task 3). Existing in EditorView: `searchResults`/`setSearchResults` state, `handlePreview`, `getDetails`, `setFlyToCoord`, `track` (analytics), the stop card + `inboxCardMenu` card, and `StopActionsSheet`.
- Produces: a working mobile flow — action on the point card + `⋯` row → `NearbySearchSheet` → `nearbySearch` → `setSearchResults` + recenter on the origin.

- [ ] **Step 1: Add imports**

At the top of `src/views/EditorView.jsx`, with the other imports:

```jsx
import NearbySearchSheet from "../components/NearbySearchSheet";
import { nearbySearch } from "../services/googlePlaces";
```

(Note: `track` from `../analytics/posthog` — confirm it's already imported; if not, add `import { track } from "../analytics/posthog";`.)

- [ ] **Step 2: Add state + the run handler**

Near the other editor state (e.g. just after `const [searchResults, setSearchResults] = useState([]);`):

```jsx
/* "מצא לי X באזור" — the origin point whose picker sheet is open (null = closed). */
const [nearbyOrigin, setNearbyOrigin] = useState(null);
const runNearby = useCallback(async (origin, query) => {
  const c = origin?.coordinates || (Number.isFinite(origin?.lat) ? { lat: origin.lat, lng: origin.lng } : null);
  setNearbyOrigin(null);
  if (!c) return;
  setFlyToCoord({ lat: c.lat, lng: c.lng }); // recenter on the origin
  const res = await nearbySearch(c, query);
  setSearchResults(res);
  track("nearby_search", { ...query, results: res.length });
}, [setFlyToCoord]);
```

- [ ] **Step 3: Add the "מצא באזור" action on the point cards**

In the itinerary stop card action row (the row containing `ניווט` / note / `⋯`, around line 920-945), add a button IN THE SAME STYLE as its siblings:

```jsx
<button onClick={() => setNearbyOrigin(a)}
  aria-label="מצא באזור" title="מצא מקומות באזור"
  style={{ /* copy the exact style object of the adjacent 'ניווט' action button */ }}>
  <Icon name="search" size={13} strokeWidth={2} color={T.ink2} /> מצא באזור
</button>
```

And in the bank-point card (`inboxCardMenu`, around line 4102-4113, the row with "מרכז במפה" / "מחיקה מהבנק"), add the same action button (style copied from the sibling `מרכז במפה` button, `onClick={() => setNearbyOrigin(inboxCardMenu)}`).

- [ ] **Step 4: Add the `⋯`-menu row (StopActionsSheet)**

In `src/components/StopActionsSheet.jsx`: add `onFindNearby` to the props destructure, and add a row near the top action list (next to "העברה ליום אחר"):

```jsx
{onFindNearby && <Row icon="🔍" label="מצא מקומות באזור" onClick={() => { onFindNearby(); onClose?.(); }} />}
```

Then in `EditorView.jsx` where `<StopActionsSheet ... />` is rendered, pass:

```jsx
onFindNearby={() => setNearbyOrigin(actionSheetStop)}
```

(Use whatever variable holds the stop the action sheet is open for — match the existing `stop={...}` prop's source.)

- [ ] **Step 5: Mount the sheet**

Near the other mobile sheets/modals (e.g. alongside `NoteSheet`):

```jsx
{nearbyOrigin && (
  <NearbySearchSheet
    point={nearbyOrigin}
    onPick={(q) => runNearby(nearbyOrigin, q)}
    onClose={() => setNearbyOrigin(null)}
  />
)}
```

- [ ] **Step 6: Verify the build compiles**

Run: `CI=true npx react-scripts build`
Expected: "Compiled successfully" / no warnings (remove any unused var).

- [ ] **Step 7: Commit**

```bash
git add src/views/EditorView.jsx src/components/StopActionsSheet.jsx
git commit -m "feat(nearby): wire find-nearby into the mobile editor"
```

- [ ] **Step 8: Manual QA (prod after deploy, or local dev)**

From a stop's card AND from its `⋯` menu: pick each category + a free-text query. Verify accent pins appear around the point, the results list matches, tapping a pin/row opens the preview card, and "הוספה למסלול" lands on the active (origin) day. Verify a category with nothing within 1.5 km still returns results (widen).

---

### Task 5: Wire desktop (EditorDesktop)

**Files:**
- Modify: `src/views/EditorDesktop.jsx`

**Interfaces:**
- Consumes: `nearbySearch` (Task 2), `NearbySearchSheet` (Task 3). Existing: `searchResults`/`setSearchResults`, `openPreview`, `getDetails`, `setFlyToCoord`, `track`, the anchored `preview`/`focusStop` cards.
- Produces: the same flow on desktop.

- [ ] **Step 1: Add imports**

```jsx
import NearbySearchSheet from "../components/NearbySearchSheet";
import { nearbySearch } from "../services/googlePlaces";
```

(Confirm `track` is imported; add `import { track } from "../analytics/posthog";` if missing.)

- [ ] **Step 2: Add state + run handler**

Near `const [searchResults, setSearchResults] = useState([]);`:

```jsx
const [nearbyOrigin, setNearbyOrigin] = useState(null);
const runNearby = async (origin, query) => {
  const c = origin?.coordinates || (Number.isFinite(origin?.lat) ? { lat: origin.lat, lng: origin.lng } : null);
  setNearbyOrigin(null);
  if (!c) return;
  setFlyToCoord({ lat: c.lat, lng: c.lng });
  const res = await nearbySearch(c, query);
  setSearchResults(res);
  track("nearby_search", { ...query, results: res.length });
};
```

- [ ] **Step 3: Add the "מצא באזור" action to the anchored cards**

In `renderAnchoredCard`, in BOTH the `preview` card (after "הוספה ליום"/"פתח ב-Google Maps") and the `focusStop` card action area, add a button styled like the existing secondary buttons there:

```jsx
<button onClick={() => setNearbyOrigin(preview /* or focusStop */)}
  style={{ /* copy an adjacent secondary button's style (e.g. 'פתח ב-Google Maps') */ }}>
  <Icon name="search" size={15} strokeWidth={2} color={T.ink2} /> מצא מקומות באזור
</button>
```

For the `focusStop` card, use `focusStop` as the origin (it carries `coordinates`).

- [ ] **Step 4: Mount the sheet**

Near the other desktop modals (e.g. alongside the dates/delete-day modals):

```jsx
{nearbyOrigin && (
  <NearbySearchSheet
    point={nearbyOrigin}
    onPick={(q) => runNearby(nearbyOrigin, q)}
    onClose={() => setNearbyOrigin(null)}
  />
)}
```

- [ ] **Step 5: Verify the build compiles**

Run: `CI=true npx react-scripts build`
Expected: "Compiled successfully" / no warnings.

- [ ] **Step 6: Commit**

```bash
git add src/views/EditorDesktop.jsx
git commit -m "feat(nearby): wire find-nearby into the desktop editor"
```

- [ ] **Step 7: Manual QA (desktop)**

From a stop's anchored card (via map click) and from a bank-point card: each category + free text. Verify pins center on the point, list matches, pick → preview → add to the right day, widen works.

---

## Deploy (after all tasks)

From `/Users/yoavpintel/Desktop/japan-trip-explorer`, run the standard deploy ritual (mock-env dance): `cp .env.local .env.local.bak` → strip the two empty mock lines → `npm run critical` → `npx --yes vercel@latest --prod --yes` → `mv .env.local.bak .env.local` → `npm run verify:prod`.

## Notes / deferred (from spec §10)

- Entry from bank/overlay points beyond the bank card: plumbing is generic; add later if wanted.
- Optional per-result distance label (haversine from the origin): cheap to add later.
