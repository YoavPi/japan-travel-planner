# Spec — "מצא לי X באזור" (Find Nearby from a saved point)

**Date:** 2026-08-26
**Roadmap item:** #13
**Status:** Approved design → ready for implementation plan

---

## 1. Overview

From any point on the map (a saved itinerary stop), the user can ask "find me
**X** in this area" — pick a category (or type free text), and the app searches
**around that point** and plots the results as markers on the map, reusing the
exact Text-Search results UI and preview→add flow that already exists. Picking a
result opens the standard preview card and adds it to the point's day.

The feature is a thin, point-centered wrapper over the search pipeline built for
the editor search bar (`searchResults` markers + preview flow). It introduces
**no new results UI** — only a new entry point and a category picker.

## 2. Goals / Non-goals

**Goals**
- One consistent action, reachable from **two entry points** that both resolve
  to the same point card: clicking a marker on the map, and a stop in the list.
- A short category picker: fixed chips (with icons) **+** a free-text field.
- Results identical in look & behavior to the main search (numbered accent pins
  + dropdown list + `★` rating + preview→add), centered on the origin point.
- Fixed, smart radius — no radius UI. Widen automatically when nothing is close.
- Cost-metered like the rest of Places usage (`finOpsTracker`), and respects the
  live/simulation + budget-cap guards.

**Non-goals (YAGNI)**
- No radius picker / slider.
- No "save all results" or bulk-add — one result at a time via the existing card.
- No new results panel — the existing dropdown + map markers are reused verbatim.
- No triggering from bank points / overlay points in v1 (only itinerary stops).
  (The plumbing is generic; extending later is trivial but out of scope now.)

## 3. Entry points

Both paths open the **same point card**, and the card carries the trigger:

1. **Map:** tap a stop's marker → the anchored point card opens (existing
   behavior) → a visible **🔍 "מצא באזור"** action on the card.
2. **List:** tap a stop row → same card → same action.
3. **Overflow:** the same action is ALSO added as a row in the `⋯` menu
   (`StopActionsSheet` on mobile, the desktop `⋯` menu), for discoverability.

The action sits in the card's existing action row (next to "ניווט" / "הערה" /
`⋯`), in the same visual style — no new card layout.

**Precondition:** the origin stop must have finite coordinates (all map-clickable
stops do). If somehow missing, the action is hidden.

## 4. Category picker

Tapping "מצא באזור" opens a **short bottom sheet** (mobile) / **popover**
(desktop), styled like the existing sheets (`AddStopSheet`/`StopActionsSheet`
tokens), titled **"מצא ליד {point name}"**, containing:

- **Fixed category chips (icon + label):**
  | chip | Google `type` |
  |---|---|
  | 🍽️ מסעדות | `restaurant` |
  | ☕ בתי קפה | `cafe` |
  | 🛒 סופרמרקט | `supermarket` |
  | 🏛️ אטרקציות | `tourist_attraction` |
  | 🍺 ברים | `bar` |
  | 💊 בית מרקחת | `pharmacy` |
  | 🏧 כספומט | `atm` |
- **Free-text field** "אחר… (למשל: ראמן, מכבסה)" → runs a keyword search.

Selecting a chip or submitting the free-text field closes the sheet and runs the
search. Only one query at a time (single-select).

## 5. Search behavior (radius + widen)

New service call `nearbySearch(center, opts)` in `src/services/googlePlaces.js`,
mirroring `textSearch`'s shape and returning the SAME result objects
(`{placeId, name, primary, secondary, lat, lng, rating, types}`):

- Uses `PlacesService.nearbySearch({ location, radius, type })` for chips, and
  `{ location, radius, keyword }` for free text.
- **Fixed radius = 1500 m.** If the first pass returns **< 4** results, re-run
  once at **5000 m** (the "start local, then reach farther" pattern already used
  in `textSearch`). Return the wider set.
- Not-live / over-budget / over-quota → returns `[]` (caller shows "אין תוצאות");
  simulation fallback is out of scope (nearby is only meaningful with real data).
- Metered: each `nearbySearch` API call records `finOpsTracker.recordTextSearch()`
  (same SKU cost tier as Text Search).

## 6. Results & selection (reused verbatim)

The returned array is pushed into the existing `searchResults` editor state:

- **Map:** numbered accent pins (the `searchResults` layer already in
  `EditorMap`) appear around the origin point.
- **Origin emphasis:** while results are shown, the origin marker is visually
  emphasized (reuse the existing selected/pending marker treatment) so the user
  sees "around what". The map eases to frame the origin + results
  (`flyToCoord` / existing fit).
- **List:** the **map pins are the primary surface on both platforms** (each pin
  carries a name label + number). An accompanying list reuses the exact
  search-result row component (numbered + `★` rating): on desktop it renders in
  the existing floating results list; on mobile it renders in a slim,
  dismissible bottom-anchored list panel (same sheet shell/tokens as the other
  sheets). Tapping a row === tapping its pin.
- **Pick:** tapping a pin or a row runs the existing
  `onSearchResultClick` → `getDetails(placeId)` → `handlePreview`/`openPreview`
  → the standard preview card (fly + pin + `PlaceInfoCard`).
- **Add:** "הוספה למסלול" on the preview card adds to the **origin stop's day**
  (which equals the active day, since selecting the stop set it). Honors the Map
  Discovery Invariant — never commits without the confirm card.
- **Dismiss:** picking, clearing, or tapping the map background clears
  `searchResults` (existing behavior), removing the pins.

## 7. Components (add / modify)

**New**
- `src/components/NearbySearchSheet.jsx` — the category picker (chips + free
  text). Props: `{ point, onPick(query), onClose }` where `query` is
  `{ type }` or `{ keyword }`. Presentational; no data fetching inside.
- `nearbySearch()` in `src/services/googlePlaces.js` (+ exported on the default
  object).

**Modify**
- `src/services/googlePlaces.js` — add `nearbySearch`; reuse `ensureServices`,
  `liveAvailable`, `enforceRateLimit`, `placesSvc`, `finOpsTracker`.
- `src/views/EditorView.jsx` (mobile) — card action + `⋯` row; open
  `NearbySearchSheet`; on pick call `nearbySearch(originCoord, q)` →
  `setSearchResults(...)`; center/emphasize origin.
- `src/views/EditorDesktop.jsx` — same, using its card + `openPreview` +
  `searchResults` (both already wired for search).
- `src/components/StopActionsSheet.jsx` — add the "🔍 מצא באזור" row.
- `src/components/EditorMap.jsx` — **no change** (the `searchResults` +
  `onSearchResultClick` layer already exists); only the origin-emphasis may reuse
  an existing marker style.
- `src/utils/finOpsTracker.js` — reuse `recordTextSearch` (no change).

## 8. Consistency, error handling, analytics

- **Consistency:** reuses existing sheet/popover shells, chip styles, the
  `searchResults` marker layer, the preview card, and the add-to-day flow. No new
  visual language.
- **Errors:** no results → "לא נמצאו {קטגוריה} באזור" in the same empty-state
  style; rate-limit → the existing "⏳" notice; not-live/over-budget → falls back
  to "אין תוצאות" (no crash).
- **Analytics (PostHog):** `nearby_search` (props: `category` or `keyword`,
  `results_count`, `radius`) on run; existing `map_favorited`/add events cover
  the rest. Gated behind consent like all analytics.

## 9. Testing

- **Unit:** category→type mapping; the widen-on-few-results logic (mock
  `nearbySearch` returning <4 then ≥4); `nearbySearch` result mapping/filter to
  finite coords.
- **Manual QA (prod):** from a stop on the map and from the list — each category
  + a free-text query; verify pins center on the point, list matches, pick →
  preview → add lands on the right day; verify the widen when a category has
  nothing within 1.5 km; verify metering increments and the over-budget path
  yields "אין תוצאות".

## 10. Open items (deferred)

- Extend entry to bank/overlay points (plumbing is generic).
- Optional "distance from point" on each result row (nearbySearch returns order,
  not distance; would need a haversine using the origin coord — cheap to add
  later if wanted).
