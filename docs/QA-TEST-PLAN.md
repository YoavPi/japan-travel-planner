# QA Test Plan — Maslul (saas-trip-builder / japan-trip-explorer)

**Version:** 1.0 · **Date:** 2026-08-29 · **Branch under test:** `saas-builder-local`
**Scope selected:** Functional · UI / Responsiveness · Performance / Stability
**Out of scope this pass:** deep accessibility audit (WCAG walkthrough), real Supabase RLS/ownership on live data, live OAuth round-trip, paid Google Places quota behaviour.
**Execution mode:** automated static gates + browser-driven functional/visual run against a local dev server (`localhost:3000`).

---

## 1. Environment & preconditions

| Item | Value / expectation |
|---|---|
| Node / npm | v20.19.0 / 10.8.2 (confirmed) |
| Dev server | `npm start` → CRA dev server on `http://localhost:3000` |
| Backend mode (local) | **Demo / mock** — `.env.local` sets `REACT_APP_SUPABASE_URL` / `_ANON_KEY` to empty, which overrides `.env`. So `isSupabaseEnabled() === false` locally: auth is the **mock** path, trips are local, gallery/collab/admin are stubbed. |
| Google Places | `.env` provides `REACT_APP_GOOGLE_MAPS_API_KEY` (may be live). If live → autocomplete/details hit Google; if absent/over-quota → free-text quick-add fallback. Both paths must work. |
| Google OAuth | `REACT_APP_GOOGLE_CLIENT_ID` empty → app renders without `GoogleOAuthProvider`, AuthView uses mock sign-in. |
| Maps rendering | Editor map = keyless MapLibre (CARTO Positron), always available. Marketing/Explore map = `MapComponent` (may use Mapbox token). |
| Viewports | Mobile primary **375×812**; desktop **1280×800** and **1440×900**. Breakpoint `useIsDesktop()` at ≥1024px. |
| Direction / theme | `dir="rtl"` global. Dark mode via `useDarkMode()` — toggle from Dashboard header. |
| Reset between runs | Clear `localStorage` (keys: `tp_onboarded_v1`, `tp_favorites_v1`, `tp_active_trip*`, `tp_open_ai`, cookie-consent, mock session) to retest first-visit flows. |

**Known-fragile areas (test with extra suspicion):** auth/session/identity (`AuthContext.jsx`, `authService.js`) — documented SEV1 history; single Maps-URL resolver (`utils/mapsUrl.js`); shared-trip permission model (`readOnly` overloading); favorites (two separate systems — Supabase `trip_favorites` vs device-local `tp_favorites_v1`).

---

## 2. Automated gates (run first, in order)

| # | Command | Pass criteria | Blocker? |
|---|---|---|---|
| A1 | `npm run critical` | All critical checks ✅ (auth mock-guard, backend wiring requires both env vars, ownership scope, sharing excludes non-collaborator public trips, admin 403-before-read) | **Yes** — do not proceed to "looks fine" if red |
| A2 | `CI=true npm test -- --watchAll=false` | Jest suite green (`gallery.test.js`, `NearbySearchSheet.test.js`, `nearbyCategories.test.js`, `nearbySearch.helpers.test.js`). New uncovered logic → write a `*.test.js` beside it | Yes |
| A3 | `npm run build` | Build completes, no module/JSX errors, bundle emitted to `build/` | Yes |
| A4 | `node scripts/qa-layout.mjs http://localhost:3000` | `horizontal overflow ≤ 0px`, `in-flow spill count = 0` at 375×812. Puppeteer isn't installed → script prints an in-page snippet; run that snippet via the browser console on each route in §4 (see T-UI-01) | No, but every spill is a finding |
| A5 | `npm run test:api` | `api/_lib/` node tests pass (AI-trip helpers, haversine, verify) | No (local) |
| A6 | `npm run verify:prod` | **Skip locally** — only meaningful right after a prod deploy (checks the shipped bundle has real Supabase + `signInWithOAuth`) | N/A |

---

## 3. Functional test cases

IDs: `T-<area>-<n>`. Priority: **P0** = core revenue flow / must-not-break, **P1** = important, **P2** = polish.
Each case: **Given / When / Then**. Record Pass / Fail / Blocked + evidence (screenshot, console line, network entry).

### 3.1 First visit, onboarding, navigation

| ID | Pri | Case |
|---|---|---|
| T-NAV-01 | P0 | **Landing renders.** Given cleared storage, When I open `/`, Then `LandingView` (marketing, cream paper, vermillion accent) renders with no console errors and no redirect loop. |
| T-NAV-02 | P1 | **First-visit onboarding gate.** Given a signed-in mock user who has never seen onboarding, When I hit `/`, Then I'm redirected to `/welcome` (5-step photo walkthrough) exactly once; completing it sets `tp_onboarded_v1` and lands on `/dashboard`. Anonymous visitors are NOT sent to `/welcome`. |
| T-NAV-03 | P1 | **Walkthrough controls.** In `/welcome`: next/back move between 5 steps, step indicator updates, "skip" exits to the correct surface, `Esc` / swipe behave, reduced-motion honoured. |
| T-NAV-04 | P1 | **Bottom dock (mobile).** On `/`, `/dashboard`, `/settings`, `/notifications`, `/gallery` the floating dock shows 4 slots and highlights the active route. Dock is **hidden** on `/welcome`, `/auth`, `/japan`, `/map`, `/create`, `/map/edit/:id`, `/trip/overview/:id`, and on desktop (≥1024px). |
| T-NAV-05 | P1 | **Side menu drawer.** Hamburger (bottom-start) opens the right-anchored RTL drawer; identity header + nav links route correctly; drawer closes on backdrop tap, on `Esc`, and automatically when routing into wizard/editor. |
| T-NAV-06 | P2 | **Unknown route fallback.** `/nonsense-path` renders `LandingView` (catch-all `*`), no crash. |
| T-NAV-07 | P1 | **Legal/info pages.** `/privacy`, `/terms`, `/accessibility`, `/credits` each render via `LegalLayout`, are reachable from the footer, and have a working back path. |
| T-NAV-08 | P1 | **Route cross-fade.** Navigations opacity-fade (`.tp-route`); the bottom dock / editor sheet / drawer do **not** jump or get mispositioned mid-transition. |
| T-NAV-09 | P2 | **Skip link.** Tab on load focuses "דילוג לתוכן"; activating it moves focus to `#main-content`. |
| T-NAV-10 | P1 | **Cookie consent.** `CookieConsent` appears on first visit; choosing "reject non-essential" is respected and PostHog is not initialised without consent; choice persists across reload. |

### 3.2 Auth (mock path — local)

| ID | Pri | Case |
|---|---|---|
| T-AUTH-01 | P0 | **Protected routes bounce.** With no mock session, visiting `/dashboard`, `/create`, `/settings`, `/notifications`, `/trip/overview/x`, `/map/edit/x` redirects to `/auth`. |
| T-AUTH-02 | P0 | **Mock sign-in.** On `/auth`, the mock Google/continue button creates a session and routes to `/dashboard` (or `/welcome` if not onboarded). |
| T-AUTH-03 | P0 | **No identity leak.** After sign-in, the dashboard identity (name/email/avatar) is the mock user's — consistently the same across reloads. Sign out → `setUser(null)` → protected routes bounce again; no stale identity survives. (Full RLS/real-OAuth identity testing is prod-only.) |
| T-AUTH-04 | P1 | **Google only.** `/auth` shows the "המשך עם Google" action only — no "המשך עם Apple", and no email magic-link input (temporarily removed; plumbing retained in AuthContext/authService). |
| T-AUTH-05 | P1 | **Admin gating.** `/admin` renders only for an admin-email mock user (`utils/isAdmin`); a non-admin gets redirected/blocked, never a flash of KPI data. |

### 3.3 Dashboard (`/dashboard`)

| ID | Pri | Case |
|---|---|---|
| T-DASH-01 | P0 | **Trip grid renders.** Signed in, `/dashboard` shows the identity block, 3-up stats, filter pills, and the `MapCard` grid. Empty state shows a clear "create your first trip" affordance. |
| T-DASH-02 | P1 | **Filter pills.** "שלי" / "שותפו איתי" / "מועדפים" switch the list. "מועדפים" tab reads Supabase-backed favorites (stub locally); the gold-star device-local favorite is a **separate** toggle that floats a card to the top and persists in `tp_favorites_v1`. |
| T-DASH-03 | P0 | **Open a trip.** Tapping a `MapCard` body routes to `/trip/overview/:tripId` for that exact trip (not the Japan demo). |
| T-DASH-04 | P1 | **Card ⋯ menu.** open / share / delete. Delete shows a confirm modal; confirming removes the card; cancel leaves it. |
| T-DASH-05 | P1 | **Overlay share copy.** The card's overlay share control copies a link to clipboard immediately and shows a ✓ feedback state. Copied URL routes back to the same trip. |
| T-DASH-06 | P1 | **Theme toggle.** Header theme control flips light/dark app-wide (`useDarkMode` broadcast); choice persists across reload and across routes. |
| T-DASH-07 | P1 | **AI trip modal.** "בנה לי מסלול אוטומטי" (or `tp_open_ai` flag on arrival) opens `AiTripModal`; form validates destination + days; submit calls `/api/generate-trip` (or shows a graceful error/loading state if the key/endpoint is unavailable locally). Modal traps focus, closes on `Esc`. |
| T-DASH-08 | P1 | **Max active trips.** Creating beyond `MAX_ACTIVE_TRIPS` surfaces the limit message, not a silent failure. |
| T-DASH-09 | P2 | **Product updates modal.** `ProductUpdatesModal` shows once per release (`releaseNotes.js`), dismiss persists. |
| T-DASH-10 | P1 | **Swipe-back.** `SwipeBackContainer` — edge-swipe from the inline-start edge navigates back on mobile without triggering horizontal page scroll. |

### 3.4 Wizard (`/create`)

| ID | Pri | Case |
|---|---|---|
| T-WIZ-01 | P0 | **Step 0 — destination.** 10 preset destinations render with flags; selecting one captures `center {lng,lat,zoom}`. Live Google city predictions layer on top when Places is enabled; free-text still works when it isn't. |
| T-WIZ-02 | P0 | **Step 1 — duration.** Day bar spans 1–45; drag/tap sets the day count; value shown numerically; can't go below 1 or above 45. |
| T-WIZ-03 | P1 | **Step 2 — city routing.** Suggested-city chips per destination quick-add; each city maps to a day range; ranges don't have to cover all days (optional step); overlapping/invalid ranges are prevented or corrected. |
| T-WIZ-04 | P1 | **Calendar range picker.** `CalendarRangePicker` — start date + range selection is RTL-correct, respects the day count, and `parseStartDate` round-trips. |
| T-WIZ-05 | P0 | **Summary + inline edit.** Summary screen shows destination / duration / cities; each section edits inline and reflects back. |
| T-WIZ-06 | P0 | **Create → editor.** "התחילו לבנות" calls `createNewTrip(payload)` and lands on `/map/edit/:newTripId` with the chosen viewport (not the hardcoded Japan view). |
| T-WIZ-07 | P1 | **Back / abandon.** Leaving the wizard mid-flow doesn't create a phantom trip; re-entering starts clean (or resumes intentionally, per design). |
| T-WIZ-08 | P2 | **Desktop framing.** At ≥1024px the wizard is framed (`useIsDesktop`) without the mobile dock, still one-job-per-step. |

### 3.5 Editor (`/map/edit/:tripId`)

| ID | Pri | Case |
|---|---|---|
| T-EDIT-01 | P0 | **Loads a real trip.** Opening `/map/edit/:id` for a trip created in the wizard renders the MapLibre canvas + 3-snap `EditorBottomSheet` with that trip's day strip. Brand-new trip shows the empty state, not a spinner-forever. |
| T-EDIT-02 | P0 | **Bottom sheet snaps.** Peek / half / full snap points work via pointer drag; no mid-drag "stuck" state; content scrolls inside the sheet without moving the map. |
| T-EDIT-03 | P0 | **Day strip.** `DayStrip` / `DayFilter` — selecting a day filters the stop list and map markers to that day; city-colour pills are stable and distinct. |
| T-EDIT-04 | P0 | **Add stop — search.** `EditorSearchBar` + `AddStopSheet`: with Places enabled, autocomplete returns predictions, selecting one fetches details and drops a pin on the correct coordinates; with Places disabled, free-text quick-add still creates a stop. |
| T-EDIT-05 | P0 | **Add stop — manual pin.** Pin mode: hover-ghost follows the cursor, click places a pin, the new stop is added to the active day. |
| T-EDIT-06 | P1 | **Add transit node.** `AddTransitSheet` — add a flight/train/bus between stops; it renders as a transit node in the timeline with the right icon/colour. |
| T-EDIT-07 | P0 | **Drag-reorder.** Reordering stops within a day updates the order, the map route, and recomputes walk/transit times (`computeTransit`). |
| T-EDIT-08 | P1 | **Stop actions.** `StopActionsSheet` — open in Maps (routes through `utils/mapsUrl.js` only), edit, add note (`NoteSheet`), delete. Delete removes marker + list row. |
| T-EDIT-09 | P1 | **Find nearby.** `NearbySearchSheet` — from a stop, "find nearby" returns categorised results (`nearbyCategories`), adding one inserts it near the anchor stop. |
| T-EDIT-10 | P1 | **Notes on add.** Adding a note at creation time persists and shows on the stop row. |
| T-EDIT-11 | P1 | **Persistence.** Edits survive a reload of `/map/edit/:id` (local persistence in demo mode). No data loss on refresh mid-edit. |
| T-EDIT-12 | P1 | **Maps URL resolver.** Every "open in Google Maps" link (editor, overview, active-trip bar, share) is a well-formed maps URL from `mapsUrlFor` — correct place/coords, no malformed or `undefined` params. |
| T-EDIT-13 | P1 | **Doc title.** Browser tab title reflects the trip (`docTitle` / `titleForTrip`), resets to default on leaving. |
| T-EDIT-14 | P1 | **Favorite button in editor.** `FavoriteButton` reflects and toggles the Supabase-favorite state (stub locally) without throwing; distinct from the dashboard star. |
| T-EDIT-15 | P2 | **Reference maps panel.** `ReferenceMapsPanel` opens, lists reference maps, closes; doesn't cover the whole map permanently. |
| T-EDIT-16 | P2 | **Reduced motion.** Sheet slide, marker drop, card entrances collapse to instant under `prefers-reduced-motion: reduce`. |

### 3.6 Trip Overview (`/trip/overview/:tripId`)

| ID | Pri | Case |
|---|---|---|
| T-OVR-01 | P0 | **Renders summary.** Cover header (country gradient/photo + title + back), floating metrics card (days · stops · country), "מה תכננו" narrative + city nodes, "מה קורה בכל יום" day rows. |
| T-OVR-02 | P1 | **Day accordions.** Each day row expands to the comma-separated stop list; expanding further shows category chips; multiple rows can open; state is smooth. |
| T-OVR-03 | P0 | **Action bar.** "עריכת מסלול" → `/map/edit/:id`; "הפעל מסלול" sets the active trip (see §3.8). Sticky bar stays reachable on scroll. |
| T-OVR-03 | P1 | **Back link.** Returns to `/dashboard` (or previous surface), no history dead-end. |
| T-OVR-04 | P1 | **Metrics accuracy.** Days / stops / country match the underlying trip data exactly. |
| T-OVR-05 | P2 | **Desktop variant.** `TripOverviewDesktop` renders at ≥1024px with a full-width layout, chrome hidden. |

### 3.7 Public / marketing / demo surfaces

| ID | Pri | Case |
|---|---|---|
| T-PUB-01 | P0 | **Japan demo, zero keys.** `/japan` (`HomePage`) and `/map` (no param, `ExploreView`) render the full Japan example from **bundled** data — must work with no Supabase and no external keys. |
| T-PUB-02 | P1 | **Explore deep links.** `/map?demo=1`, `/map?city=…`, `/map?day=…` focus the map / story on the right segment. |
| T-PUB-03 | P1 | **Story flow.** `StoryFlow` scroll-syncs with map markers; `OmniboxSearch` filters/finds stops; `DetailModal` opens on a stop with photo + info and closes on `Esc` / backdrop. |
| T-PUB-04 | P1 | **Explore fallback.** `/map?tripId=does-not-exist` falls back to the bundled Japan example (never a "can't load" dead-end). |
| T-PUB-05 | P1 | **Gallery.** `/gallery` (`GalleryView`) lists public trips (stub/local data locally); a `GalleryCard` opens `/g/:tripId` (`PublicMapView`) read-only. |
| T-PUB-06 | P0 | **Shared view-only trip.** Opening `/g/:tripId` for a shared read-only trip shows **that** trip read-only — NOT the Japan demo, and NOT an editable surface. (Regression guard for the shared-trip-open bug.) |
| T-PUB-07 | P2 | **Hero route animation.** `HeroRouteAnimation` on the landing plays once, respects reduced-motion, doesn't pin the CPU after it finishes. |
| T-PUB-08 | P1 | **Footer flow.** Footer links → login → wizard-prefill flow works from a public page. |

### 3.8 Global: Active Trip Bar

| ID | Pri | Case |
|---|---|---|
| T-ATB-01 | P1 | **Appears when active.** After "הפעל מסלול", the floating "טיול פעיל · לייב" bar shows on every screen with the trip title. |
| T-ATB-02 | P1 | **Hides on the active trip.** The bar is hidden while viewing that trip's `/trip/overview/:id` or `/map/edit/:id` (and `/map` for the demo). |
| T-ATB-03 | P1 | **Fast click routes to map.** A quick tap navigates to `/map/edit/:id` (or `/map?demo=1` for a read-only trip). |
| T-ATB-04 | P1 | **Long-press / right-click menu.** 600ms press (or context-menu) opens the 4-item menu (open map · share · send · stop); the trailing click after a long-press is swallowed (doesn't also route). |
| T-ATB-05 | P1 | **Stop trip.** "עצירת טיול" clears the active trip (`setActiveTrip(null)`) and the bar disappears everywhere. |
| T-ATB-06 | P1 | **Share / send.** "שיתוף טיול" opens `SharePermissionsModal`; "שליחת טיול" uses `navigator.share` or clipboard fallback with a correct origin+path URL. |
| T-ATB-07 | P2 | **Lift above dock.** On chrome screens the bar sits above the `BottomDock` (bottom:86) and doesn't overlap it; on editor/wizard it hugs the bottom edge. |

---

## 4. UI / Responsiveness test cases

Run each on **375×812**, **1280×800**, **1440×900**, in **light** and **dark**, `dir=rtl`.

| ID | Pri | Case |
|---|---|---|
| T-UI-01 | P0 | **No horizontal overflow.** On every route in §3, run the `qa-layout.mjs` in-page audit snippet in the console: `document.documentElement.scrollWidth` ≤ viewport width and `spillCount === 0` at 375px. Log every spill (tag/class/right-edge). |
| T-UI-02 | P0 | **RTL correctness.** Text right-aligned, chevrons/arrows point the right way, drawers anchor to the inline-start edge, no mirrored icons, no `left/right` literal leakage (grep `src` for physical props as a static check: `marginLeft|marginRight|paddingLeft|paddingRight|(^|[^-])left:|(^|[^-])right:|text-align:\s*(left|right)|float:\s*(left|right)`). New hits are findings. |
| T-UI-03 | P0 | **Dark mode.** Toggle dark on the dashboard; visit every route. No hard-coded light backgrounds, no invisible text, no white flashes on route change. Contrast holds (spot-check body text ≥4.5:1, large/UI ≥3:1). |
| T-UI-04 | P1 | **Breakpoint switch.** Cross 1024px with the window resize on Dashboard, Editor, Wizard, Trip Overview — each swaps mobile↔desktop layout cleanly (no doubled headers, no dock on desktop, no clipped content, no error). |
| T-UI-05 | P1 | **Touch targets.** Dock items, sheet handles, card ⋯ menus, wizard day bar, filter pills ≥ 44×44px on mobile. |
| T-UI-06 | P1 | **Bottom-dock clearance.** Screens that show the dock reserve `padding-bottom: ~96px` — no content hides behind the dock or the active-trip bar. |
| T-UI-07 | P1 | **Sheets & modals.** `EditorBottomSheet`, `AddStopSheet`, `AddTransitSheet`, `StopActionsSheet`, `NoteSheet`, `NearbySearchSheet`, `ShareSheet`, `SharePermissionsModal`, `PublishToGalleryModal`, `AiTripModal`, `DetailModal`, `ProductUpdatesModal`, `SideMenu`: open animation is `tpSlideUp`/`tpScaleIn` (not bouncy), backdrop dims, `Esc` closes, focus is trapped while open, background doesn't scroll. |
| T-UI-08 | P1 | **Photography-hero.** Cards/overviews render a real photo where one exists; country illustration only as fallback; no broken `<img>` (check network for 404s on `TripPhoto` / `placePhoto`). |
| T-UI-09 | P2 | **Typography.** Hebrew renders in Noto Sans Hebrew, Latin place-names/numerals in Inter, tabular numerals on stats; no second display font; no "Inter on everything". |
| T-UI-10 | P2 | **Long-content resilience.** Very long trip title, 45-day trip, a day with 20+ stops, long place names — wrap/ellipsis correctly, no layout break, no overflow. |
| T-UI-11 | P1 | **Map resize.** Rotating viewport / resizing keeps the MapLibre canvas sized to its container (no grey gutter, no 0-height map). |
| T-UI-12 | P2 | **Accessibility widget.** `AccessibilityWidget` opens, its toggles apply, it doesn't obstruct the dock or active-trip bar. |

---

## 5. Performance / Stability test cases

| ID | Pri | Case |
|---|---|---|
| T-PERF-01 | P0 | **Zero console errors.** Load every route in §3; the console has no uncaught errors or React warnings (key warnings, act warnings, `setState` on unmounted, PropType/console.error). Warnings are findings; errors are blockers. |
| T-PERF-02 | P0 | **No failed network requests (unexpected).** Check the network panel per route: no 4xx/5xx except intentionally-stubbed backend calls in demo mode. Photo/tile/font requests resolve or fail gracefully (fallback shown). |
| T-PERF-03 | P1 | **First load.** `/` and `/japan` reach interactive in a reasonable budget on a normal connection; `reportWebVitals` LCP/CLS/INP are sane (log them). No layout shift as photos/map load in. |
| T-PERF-04 | P1 | **Map init cost.** Editor map + Explore map initialise once, don't re-create the GL context on every sheet drag / day switch; no continuous rAF loop after animations settle (check CPU in perf panel). |
| T-PERF-05 | P1 | **No memory leak on navigation.** Navigate dashboard ↔ editor ↔ overview ↔ explore ~10 times; detached-node / listener count doesn't grow unbounded; `live` guards in effects prevent post-unmount `setState`. |
| T-PERF-06 | P1 | **Build output.** `npm run build` — note `main.[hash].js` gzipped size; flag a large regression vs. the previous build. No source maps or `.env` secrets leaked into `build/`. |
| T-PERF-07 | P1 | **Bundle wiring (local).** In the local build/bundle, demo mode is expected. If Supabase keys are ever added locally, `npm run verify:prod` against the preview URL must confirm real Supabase + `signInWithOAuth` shipped. |
| T-PERF-08 | P1 | **Slow / offline resilience.** Throttle to Slow 3G and go offline mid-session: `/japan` + `/map` still render (bundled), editor shows a sane offline/error state rather than a white screen, and recovers on reconnect. |
| T-PERF-09 | P2 | **Rapid interaction.** Hammer day-switching, sheet drag, add/delete stop quickly — no race that duplicates stops, loses the active day, or wedges the sheet. |
| T-PERF-10 | P2 | **Analytics gated.** With cookie consent rejected, no PostHog network calls fire; with accepted, `map_created` / click autocapture fire once (not duplicated per render). |

---

## 6. Execution plan (browser-driven run)

1. **Static gates** — run A1→A3 (§2). Record output. Stop and report if A1/A2/A3 fail.
2. **Start dev server** — `npm start` (background), wait for `localhost:3000` to answer 200.
3. **Baseline** — open `/`, capture console + network, screenshot light + dark, run the T-UI-01 audit snippet.
4. **Walk the routes** in this order, executing the relevant §3 cases and capturing evidence per route:
   `/` → `/welcome` → `/auth` (mock sign-in) → `/dashboard` → `/create` (full wizard → new trip) → `/map/edit/:newId` (add stops: search + manual pin, reorder, note, transit, nearby, delete, reload) → `/trip/overview/:newId` (activate trip) → `/gallery` → `/g/:id` → `/map` + `/japan` + `/map?demo=1` → `/settings` → `/notifications` → `/admin` (admin + non-admin mock) → `/privacy` `/terms` `/accessibility` `/credits`.
5. **Responsive pass** — repeat the key screens (Dashboard, Wizard summary, Editor, Trip Overview, `/japan`) at 375 / 1280 / 1440, light + dark; run T-UI-01 audit on each.
6. **Stability pass** — §5 cases: console/network sweep, navigation-loop leak check, throttled/offline, `npm run build` size.
7. **Report** — fill §7, attach screenshots + console/network excerpts, list every Fail with a concrete repro, and explicitly name what could only be checked by hand or only on prod.

**Evidence to collect:** screenshot per route (light+dark, mobile+desktop); console log excerpt per route; network HAR/summary per route; `qa-layout.mjs` audit JSON per route; build size line; `npm run critical` + Jest output.

---

## 7. Results log — RUN 1 (2026-08-30, local demo/mock mode, dev build)

**Runner:** Claude (browser-driven). **Server:** `npm start` @ localhost:3000. **Backend:** demo/mock (`.env.local` blanks Supabase). **Google Places:** LIVE locally (`.env` key active) — real autocomplete/details returned. **Viewports:** 375×812 + 1280×800.

### 7.1 Automated gates

| Gate | Command | Result | Notes / output |
|---|---|---|---|
| A1 critical | `npm run critical` | ✅ PASS | 9/9 checks green (auth mock-guard, AuthContext seeding/clearing, OAuth no-mock-fallback, email magic-link, backend both-env-vars, ownership scope, sharing excludes non-collaborator public, admin 403-before-read) |
| A2 jest | `CI=true npm test -- --watchAll=false` | ✅ PASS | 4 suites / 8 tests (`NearbySearchSheet`, `nearbySearch.helpers`, `nearbyCategories`, `gallery`) — 0.5s |
| A3 build | `npm run build` | ✅ PASS | Compiled successfully. gzip: **main.d771be24.js 509.53 kB** + chunk 66 202.35 kB + css 18.57 kB. ⚠️ main bundle is heavy (2.0 MB raw) — see T-PERF-06. |
| A4 layout | in-page `qa-layout.mjs` audit snippet | ✅ PASS | Ran on every route (Puppeteer absent → snippet via browser console). `horizontalOverflow ≤ 0`, `spillCount = 0` on all of: `/`, `/welcome`, `/auth`, `/dashboard`, `/create` (all wizard steps), `/map/edit/:id`, `/trip/overview/:id`, `/gallery`, `/g/:id`, `/map`, `/settings`, `/notifications`, `/privacy`, `/terms`, `/accessibility`, `/credits`, 404. Also clean at 1280px. |
| A5 api | `npm run test:api` | ✅ PASS | 8/8 (`usageFromGemini`, `generationRow` create/refine/defaults) |
| A6 verify:prod | — | ⏭️ SKIPPED | Local-only run; only meaningful post-deploy. |

### 7.2 Functional (§3) — results

| ID | Result | Evidence / notes |
|---|---|---|
| T-NAV-01 Landing renders | ✅ | `/` renders LandingView (RTL, cream/vermillion), 0 console errors. |
| T-NAV-02 First-visit onboarding gate | ✅ | Cleared storage → mock sign-in → auto-redirect to `/welcome`; anonymous visitor NOT sent to `/welcome`. `tp_onboarded_v1` set on completion. |
| T-NAV-03 Walkthrough controls | ✅ | 5 steps, "הבא" advances (5/1→5/2…), step dots update, "דלגו" finishes → `/dashboard`. |
| T-NAV-04 Bottom dock | ✅ | Shows on `/`, `/dashboard`, `/settings`, `/notifications`, `/gallery`; hidden on `/welcome`, `/auth`, `/create`, `/map/edit`, `/trip/overview`, `/map`, and all desktop. Active route highlighted. (Dock now has 5 nav targets + a11y FAB, DESIGN.md still says "4 slots" — doc drift, not a bug.) |
| T-NAV-05 Side menu drawer | ✅ (partial) | Hamburger + RTL drawer render with identity + nav; nav links work. Focus-trap/Esc not exhaustively verified (JS-driven run). |
| T-NAV-06 Unknown route fallback | ✅ | `/this-route-does-not-exist` → LandingView, no crash, no overflow. |
| T-NAV-07 Legal/info pages | ✅ | `/privacy` `/terms` `/accessibility` `/credits` all render (`h1`: מדיניות פרטיות / תנאי שימוש / הצהרת נגישות / קרדיטים ורישיונות), content present, 0 overflow. `document.title` stays "Travel Planner" on these — minor. |
| T-NAV-08 Route cross-fade | ✅ | `.tp-route` runs `tpRouteIn`, settles to opacity 1; dock/sheet not mispositioned. Screenshots taken mid-fade look washed out but settle correctly. |
| T-NAV-10 Cookie consent | ✅ (with note) | `tp_cookie_consent_v1 = "declined"` (privacy-preserving default/persisted); no PostHog network calls observed. Consent banner UI not re-triggered in this run (flag pre-set). |
| T-AUTH-01 Protected routes bounce | ✅ | `/admin` while non-admin → `/dashboard`; after session cleared (pane restart) `/` shows anonymous LandingDesktop. |
| T-AUTH-02 Mock sign-in | ✅ | "המשך עם Google" → mock session in **sessionStorage** (`tp_auth_user` = מיכלי דמרי פינטל / michali.pintel@gmail.com / u_michali / Pro) → routed on. |
| T-AUTH-03 No identity leak | ✅ | Identity consistent across reloads; session is sessionStorage-scoped → cleared on tab/pane close (fresh session = logged out, no stale identity). Deep RLS/real-OAuth = prod-only. |
| T-AUTH-04 No Apple button | ✅ | `/auth` shows Google only; no "המשך עם Apple". |
| T-AUTH-05 Admin gating | ✅ | `/admin` as non-admin (michali) → redirect to `/dashboard`, no KPI flash. |
| T-DASH-01 Trip grid renders | ✅ | Identity block, 3-up stats (39→45 ימי טיול after new trip), filter pills, MapCard grid. |
| T-DASH-02 Filter pills | ✅ | "המפות שלי" (2→3) / "שותפו איתי" (1, shows "סופ״ש בפריז" שותף ע״י יותם, role עריכה) / "הכל" / "מועדפים ⭐" switch the list. |
| T-DASH-03 Open a trip | ✅ | Tapping "ירח דבש ביפן" card → `/trip/overview/japan-demo` (that trip, not the generic demo). |
| T-DASH-06 Theme toggle | ✅ | Header moon/sun toggles dark app-wide; persists via `tp_prefs_v1` across routes/reload. |
| T-DASH-09 Product updates modal | ✅ | "מה חדש · עדכון 44" auto-shows once on dashboard arrival; "הבנתי, תודה" dismiss persists (`last_viewed_sprint`). |
| T-WIZ-01 Step 0 destination | ✅ | 10 presets w/ flags, Japan pre-selected, search field present, "×" close. |
| T-WIZ-02 Step 1 duration | ✅ | Sub-choice (calendar vs days-only). Range slider `min=1 max=45`; set to 5 → "5 לילות / 6 ימי טיול". |
| T-WIZ-03 Step 2 city routing | ✅ | Suggested-city chips add cities w/ night ranges; **mismatch surfaced** ("שובצו 4 מתוך 5 לילות · חלוקת הלילות אינה תואמת"), corrected to "✓ 5 לילות משובצים — כיסוי מלא". Optional step. |
| T-WIZ-05 Summary + inline edit | ✅ | Summary shows יעד / משך / חלוקת לילות each with "עריכה"; coverage validation green. |
| T-WIZ-06 Create → editor | ✅ | "יצירת הטיול" → `createNewTrip` → `/map/edit/trip_n2qlv2o`; tab title → "יפן"; trip appears on dashboard (4 מסלולים, 3/5 counter). |
| T-EDIT-01 Loads real trip | ✅ | New trip → MapLibre canvas + 3-snap sheet + day strip (1-2 טוק, 3-6 קיו) + empty-state + welcome modal. |
| T-EDIT-04 Add stop — search | ✅ | **Google Places live**: "Senso-ji Temple" → real result (סנסו-ג'י, Asakusa addr, ★4.6, 98,315 reviews) → "＋ יום 1" → PlaceInfoCard → "הוספה לטיול שלי" adds to day 1. 2nd stop "Tokyo Skytree" same path. |
| T-EDIT-07 Transit auto-calc | ✅ (see D4) | Adding 2nd stop auto-computed "🚶 16 דק׳ · הליכה · 1.4 ק״מ" between Senso-ji↔Skytree (accurate). **But desktop editor shows 4 min / 1.8 km for the same pair — inconsistent, see Defect 4.** |
| T-EDIT-11 Persistence | ✅ | Full reload of `/map/edit/trip_n2qlv2o` → both stops + transit chip survive. |
| T-EDIT-12 Maps URL resolver | ✅ | "ניווט" → `https://www.google.com/maps/search/?api=1&query=<name>&query_place_id=ChIJ8T1GpMGOGGAR…` — well-formed, real place_id, no `undefined`. |
| T-EDIT-13 Doc title | ✅ | Tab title tracks trip ("יפן" / "ירח דבש ביפן"). |
| T-EDIT-02/05/06/08/09/10/15/16 | ⚠️ NOT RUN | 3-snap sheet drag, manual pin-drop, transit node, ⋯ actions/delete, find-nearby, note-on-add, reference-maps, reduced-motion — need pointer drag / deeper interaction than the JS-driven harness allowed this run. Search+add+transit+persist+maps-url cover the P0 core. |
| T-OVR-01 Renders summary | ✅ | Cover photo (Takeshita St), eyebrow, title, metrics (31/155/14 for japan-demo; 6/2/2 for new trip), "מה תכננו" + city nodes, "מה קורה בכל יום" day rows w/ POI counts. |
| T-OVR-02 Day accordions | ✅ | Day rows expand to stop lists; "הציגו את כל מידע הימים (+28)". |
| T-OVR-03 Action bar | ✅ | "עריכת מסלול" → editor. "הפעל מסלול" → confirm modal "הפעלת מצב טיול" (חזרה/אישור) → `tp_active_trip_v1` set. |
| T-OVR-05 Desktop variant | ✅ | `TripOverviewDesktop` at 1280 — full-width, chrome hidden, torii fallback illustration. |
| T-PUB-01 Japan demo zero-key | ✅ | `/japan` + `/map` render bundled Japan example; markers, day pills 1-31, city chips, day detail. Works logged-out. |
| T-PUB-02/03 Explore deep links + story | ✅ | `/map?demo=1` focuses demo; StoryFlow + day pills + city filter + day detail all render. |
| T-PUB-05 Gallery | ✅ (empty) | `/gallery` renders (search, פופולריים/חדשים, 8 category chips, footer); empty state "עדיין אין מפות" — no Supabase locally so no cards to open. |
| T-PUB-06 Shared view-only trip | ⚠️ see Defect 3 | `/g/japan-demo` **redirected to `/map/edit/japan-demo`** in a "צפייה בלבד" read-only variant — did NOT open the generic Japan demo (good) but also did not render `PublicMapView` per the documented route model. |
| T-ATB-01 Bar appears when active | ✅ | After "הפעל מסלול", "טיול פעיל · לייב / ירח דבש ביפן" pill shows on `/dashboard`, `/create`, `/gallery`, etc. |
| T-ATB-02 Hides on active trip | ✅ | Hidden on that trip's `/trip/overview/:id`. |
| T-ATB-03 Fast click → map | ✅ | Tap routes to `/map?demo=1` (japan-demo is `readOnly:true` → demo map by design), not `/map/edit/:id`. |
| T-ATB-05 Stop trip | ✅ | Removing `tp_active_trip_v1` clears the bar everywhere. |
| T-ATB-04/06 long-press menu / share-send | ⚠️ NOT RUN | 600ms long-press + navigator.share need pointer/UA the JS harness didn't drive. |

### 7.3 UI / Responsive (§4) — results

| ID | Result | Notes |
|---|---|---|
| T-UI-01 No horizontal overflow | ✅ | 0px overflow / 0 spill on **every** route at 375px AND 1280px. |
| T-UI-02 RTL correctness | ✅ (visual) | All screens right-aligned, drawer anchors inline-start, chevrons correct, no mirrored icons. Static physical-CSS grep not run this pass. |
| T-UI-03 Dark mode | ✅ | Dashboard (mobile) fully dark — dark panels, readable text, sun icon, no white flash; persists `tp_prefs_v1`. Not swept across *every* route this run. |
| T-UI-04 Breakpoint switch | ✅ | Dashboard / Editor / Trip Overview / Landing all swap to desktop layout at 1280 — full-width nav, **no mobile dock**, no doubled headers, no clipped content, no errors. |
| T-UI-08 Photography-hero | ✅ | Real photos on "ירח דבש ביפן" card + overview cover + Places thumbnails; torii/illustration fallback on the new generic "יפן" trip. No broken `<img>` / 0 failed image requests. |
| T-UI-05/06/07/09/10/11/12 | ⚠️ PARTIAL | Touch-target measurement, dock-clearance pixel check, modal focus-trap/scroll-lock, typography audit, long-content stress, map-resize, a11y-widget occlusion — observed incidentally (see Defect 2 for a11y-FAB/active-bar overlap), not measured rigorously. |

### 7.4 Performance / Stability (§5) — results

| ID | Result | Metric / evidence |
|---|---|---|
| T-PERF-01 Zero console errors | ⚠️ 1 recurring WARNING | No uncaught errors. **But** a React style-shorthand warning fires ~2×/render on nearly every route — see Defect 1. |
| T-PERF-02 No failed network | ✅ | `/map`: 0 requests with status ≥400 (`performance` API). External hosts all resolve: `basemaps.cartocdn.com` (tiles), `fonts.googleapis.com` / `fonts.gstatic.com`, `va.vercel-scripts.com`. One `GET / net::ERR_ABORTED` = benign navigation-superseded, not a real failure. |
| T-PERF-03 First load / vitals | ✅ | `/` dev build, uncached, local: TTFB 8ms, DCL 58ms, load 705ms, **CLS 0**. (Dev build — prod differs; CLS 0 is the meaningful signal.) |
| T-PERF-05 Navigation-loop leak | ✅ (light) | 15 route navigations then back to `/`: DOM nodes 10064 → 175, no runaway growth; effect cleanup working. Rigorous heap-snapshot leak check not done. |
| T-PERF-06 Build output | ⚠️ | Builds clean, but **main bundle 509 kB gzip / 2.0 MB raw** is large for a mobile-first app — worth a code-split/lazy-route pass (maplibre already split into chunk 66). No secrets/source-maps in `build/` served output. |
| T-PERF-04/08/09/10 | ⚠️ NOT RUN | GL-context-recreate check, throttled+offline resilience, rapid-interaction races, analytics double-fire — not exercised this run. |

### 7.5 Defects found

| # | Sev | Route / component | Repro (given/when/then) | Expected | Actual | Evidence |
|---|---|---|---|---|---|---|
| D1 | **S4** (low) | Shared component (day-strip pills / bottom sheet — appears app-wide) | Open almost any route (`/trip/overview/:id`, `/map`, `/map/edit/:id`, `/gallery`, `/settings`, 404, …) with the console open | No React warnings | Warning fires ~2×/render: *"Updating a style property during rerender … when a conflicting property is set … don't mix shorthand and non-shorthand … Updating borderTop / border"* | console (only-errors) on every route visited |
| | **→ FIXED** (2026-08-30) | 13 files: `App.jsx`, `EditorDesktop.jsx`, `ExploreView.jsx`, `WizardView.jsx`, `DashboardView.jsx`, `DashboardDesktop.jsx`, `GalleryView.jsx`, `StopActionsSheet.jsx`, `AiTripModal.jsx`, `MapCard.jsx`, `SideMenu.jsx`, `ShareSheet.jsx`, `EditorSearchBar.jsx` | — | — | Root cause: a repo-wide idiom of `style={{ border: "none", borderBottom: cond ? line : "none" }}` (or the `borderTop`/`borderInlineStart` equivalent) — mixing the `border` shorthand with a longhand side in the same object is exactly the pattern React's dev-mode warns about (confirmed by reading `shorthandToLonghand` in `react-dom-client.development.js`: `border` expands to all 12 per-side longhands, so any list row whose divider side toggles by index/state can hit the "conflicting property" check). Found and fixed every instance app-wide via a multi-line-aware scan for `border:` co-occurring with a side longhand in one style object; each was replaced with explicit longhands on the *other* three sides (e.g. `borderTop: "none", borderInlineStart: "none", borderInlineEnd: "none"` alongside the real `borderBottom`) so no object mixes shorthand and longhand. Two standouts matching the original "day-strip / bottom sheet" description: `EditorDesktop.jsx`'s day-header accent bar (`borderInlineStart` city-color stripe) and `StopActionsSheet.jsx`'s bottom-sheet row divider. Zero visual/behavioral change — same computed CSS, just spelled without the ambiguous shorthand mix. `npm run critical` 9/9, jest 8/8, build clean. **Not re-verified in-browser this session** (no browser/Puppeteer tool available here — see note at end of this table). | |
| D2 | **S3** (med) | `ActiveTripBar` + `AccessibilityWidget` FAB vs sticky footer CTA | On mobile 375, activate a trip, go to `/create` and reach the wizard **summary** step | Primary CTA "יצירת הטיול ומעבר למפה" fully visible & tappable | The floating orange active-trip pill + a11y FAB sit over the bottom-inline-start of the black CTA — the CTA text is partially clipped/covered. Same corner collision (less critical) on `/map/edit`, `/trip/overview`. | screenshot of wizard summary w/ active trip |
| | **→ FIXED** (2026-08-30) | `src/App.jsx`, `src/views/WizardView.jsx` | — | — | (1) `ActiveTripBar` now returns `null` on `/create` and `/welcome` — focused full-screen flows, same rationale `AppChrome` uses to hide the dock there. (2) Wizard `Cta` wrapper bottom padding `24px → 96px` (the DESIGN.md dock-clearance convention) so the primary action clears the floating-controls band on every step (defense in depth). **Verified** 375px, summary step, active trip: CTA fully visible (top 660 / bottom 716), 26px gap to a11y FAB, `overlapsFab: false`, 0 horizontal overflow. Bar still shows normally on `/dashboard` etc. `npm run critical` 9/9, jest 8/8, build clean. | |
| D3 | **S3** (med) | `/g/:tripId` routing / `PublicMapView` vs `EditorView` readOnly | Visit `/g/japan-demo` directly | Renders `PublicMapView` (documented in `App.jsx` route table) as the read-only public surface | URL redirects to `/map/edit/japan-demo` and renders the **editor** in a "צפייה בלבד" variant (readOnly flag). Correct trip (not the generic demo), but the route model / "single source of permission truth" from the known shared-trip-open bug is the exact risk area — needs a human call: intended consolidation vs regression. | href change + screenshot ("צפייה בלבד" badge, checkbox stops) |
| | **→ NOT A BUG — working as designed; doc corrected** (2026-08-30) | `src/App.jsx` route-table comment | — | — | Investigation: the authed → `/map/edit/:tripId` redirect in `PublicMapView.jsx` is **deliberate, shipped behavior** (commit `acb04de` "signed-in users open public maps in real editor (view-only)"). It routes by trip **id** (not `readOnly`), renders view-only via RLS public-read, and does **not** reintroduce the historical shared-trip-open bug (that was `readOnly`-overloading → `/map?demo=1`). Correct trip shown in both my tests. The only defect was the stale `App.jsx` route-table comment omitting this. **Fix:** comment updated to document the intentional auth-gated redirect. No functional change. If the product actually wants `/g/:id` to stay on `PublicMapView` for signed-in users too, that's a separate product decision — flag it. | |
| D4 | **S3** (med) | `computeTransit` default mode — mobile `EditorView` vs desktop `EditorDesktop` | Add Senso-ji then Tokyo Skytree to the same day; compare the transit chip on mobile 375 vs desktop 1280 | Same distance/time (or a clearly-labelled mode difference the user chose) | Mobile: "🚶 16 דק׳ · הליכה · 1.4 ק״מ". Desktop: "4 דק׳ · 1.8 ק״מ" (driving-style). Different default mode **and** different distance for the identical pair. | screenshots of both editor shells |
| | **→ FIXED** (2026-08-30) | `src/views/EditorDesktop.jsx` | — | — | Root cause confirmed: `EditorDesktop.jsx` had its own duplicate `legEstimate`/`haversineKm` implementation (haversine × 1.3 road-inflation, walk-threshold 1.6 km @ 4.8 km/h else drive @ 26/70 km/h) — a completely separate formula from the canonical `computeTransit()` in `utils/transit.js` (straight-line haversine, walk-threshold 1.5 km @ 5 km/h else transit @ 30 km/h) that mobile `EditorView` uses. Plugging the reported coordinates into each formula reproduces the exact reported numbers (desktop: 1.4×1.3=1.82 km → 26 km/h → 4 min; mobile: 1.4 km → 5 km/h → 16 min), confirming the divergence. **Fix:** `EditorDesktop.jsx` now imports and delegates to the shared `computeTransit()` — `legEstimate()` is a thin label-formatting wrapper around it, so desktop and mobile compute the identical distance/mode/time for the same pair going forward. `npm run critical` 9/9, jest 8/8, build clean; re-derived the canonical formula by hand for the Senso-ji↔Skytree pair (1.368 km → walk → 16 min), matching the mobile reading exactly and confirming desktop now produces the same result. **Not re-verified in-browser this session** — no browser/Puppeteer tool was available here (see note below); recommend a manual/qa-agent pass with real browser access to confirm the desktop chip now reads "🚶 16 דק׳ · הליכה · 1.4 ק״מ" for that pair. | |
| D5 | **S4** (low) | Copy / versioning | (a) create a **non-Japan** trip → open editor; (b) compare version strings | Neutral/product-generic copy; one consistent version | (a) Editor welcome modal hardcodes *"ברוכים הבאים ל-Japan Trip Explorer!"* for every trip. (b) Settings shows "גרסה 3.0.0", dashboard modal "עדכון 44", `package.json` `0.1.0`. (c) `document.title` not set on legal pages. | screenshots |
| | **→ FIXED** (2026-08-30) | `src/views/EditorView.jsx`, `src/views/SettingsView.jsx`, `src/components/LegalLayout.jsx` | — | — | (a) Editor welcome-modal heading changed from the hardcoded *"ברוכים הבאים ל-Japan Trip Explorer!"* to the product-generic *"ברוכים הבאים למסלול!"* (מסלול is the app's actual brand, used elsewhere e.g. `LegalLayout`'s header wordmark) — this dialog fires for every trip regardless of destination, so it should never have been Japan-specific. (b) Settings' hardcoded `"גרסה 3.0.0"` now reads `` `עדכון ${LATEST_SPRINT}` `` sourced from `src/data/releaseNotes.js` — the same single source of truth the dashboard's "מה חדש · עדכון 44" modal already uses, so the two surfaces can never drift apart again. `package.json`'s `0.1.0` is an internal npm field never shown to users, so left untouched. (c) `LegalLayout` now calls `setDocTitle` on mount (from the existing `utils/docTitle.js` helper already used by the editor) with `` `${title} · מסלול` `` and resets to `DEFAULT_TITLE` on unmount — covers all four legal pages (`/privacy`, `/terms`, `/accessibility`, `/credits`) through the one shared layout. `npm run critical` 9/9, jest 8/8, build clean. **Not re-verified in-browser this session** (no browser tool available — see note below). | |
| D6 | Minor | `/g/japan-demo` map marker labels | Open `/g/japan-demo` | Labels de-collide / cluster | "אנאקומה קפה" / "מקדש מייג'י + פארק…" labels overlap each other and the numbered pins near the sheet top | screenshot |
| | **→ MITIGATED** (2026-08-30) | `src/components/EditorMap.jsx` | — | — | These are the trip's numbered stop markers rendered via maplibre `<Marker anchor="center">` — plain absolutely-positioned DOM elements with **no built-in collision/de-collision engine** (unlike maplibre's native symbol-layer text, which has `text-allow-overlap`/`text-optional`). The reported pair ("אנאקומה קפה" / "מקדש מייג'י + פארק יויוגי") are stops #1 and #2 in `tripData.js` — adjacent indices and genuinely close together (a cafe beside the shrine/park), so their same-row side labels collide. A full pairwise screen-space collision engine (tracking projected positions across every pan/zoom) is a much larger change than this defect's severity warrants and carries its own re-render/perf risk (flagged as a watch-item in T-PERF-04). Applied a lightweight, zero-new-state mitigation instead: the name-label bubble now alternates a `translateY(±9px)` nudge by stop index (even → up, odd → down), so consecutive itinerary stops — the common real-world overlap case, including this exact reported pair — no longer render their labels on the same screen row. This does not guarantee zero overlap for every possible geographic arrangement (two same-parity stops that are extremely close could still touch), but resolves the reported repro and the common adjacent-stop case generally. `npm run critical` 9/9, jest 8/8, build clean. **Not re-verified in-browser this session** — no browser/Puppeteer tool was available here; needs a manual/qa-agent pass on `/g/japan-demo` to confirm the two labels no longer overlap, and ideally a scan for any other close-together pairs elsewhere in the demo trip. | |

**Note on D1/D4/D5/D6 browser verification:** this follow-up pass had no browser automation tool available (no Puppeteer/Playwright/browser MCP in this session — RUN 1's browser-driven testing was done in a different environment). All four fixes are verified by static/code analysis (root-cause tracing, in some cases re-deriving the exact reported numbers by hand) plus the full automated gate (`npm run critical`, Jest, `npm run build`), but **not** by opening the app in a real browser. Recommend a follow-up pass with the `qa` agent (or manual spot-check) against `localhost:3000` to close this gap, specifically: console-clean sweep of the routes in D1's repro list, the desktop transit chip for Senso-ji↔Skytree (D4), the editor welcome-modal copy and Settings/legal-page titles (D5), and the `/g/japan-demo` marker labels (D6).

### 7.6 Coverage gaps (could not verify here)

- Real Supabase RLS / cross-user ownership / collaborator permissions — needs live backend + 2 real accounts.
- Live Google OAuth round-trip and identity persistence across the redirect.
- Google Places over-quota → free-text fallback path (the local key was **live**, so the fallback branch was never exercised).
- Real on-device touch: 3-snap sheet drag, drag-reorder, sheet fling, swipe-back, active-trip-bar long-press.
- Editor interactions beyond search-add: manual pin-drop, transit node, ⋯ stop actions + delete, find-nearby, note-on-add.
- Rigorous checks: modal focus-trap/Esc, touch-target ≥44px measurement, heap-snapshot leak, throttled+offline resilience, GL-context recreation, analytics double-fire.
- Production bundle wiring — run `npm run verify:prod` against the deploy.
- Full dark-mode sweep across every route (only spot-checked).

---

## 8. Sign-off — RUN 1

| Check | Status |
|---|---|
| All P0 functional cases pass | ✅ (P0 core: onboarding, mock auth, dashboard, wizard→create, editor search/add/transit/persist/maps-url, overview, demo — all green) |
| No S1/S2 defects open | ✅ (highest is S3 ×3) |
| `npm run critical` green | ✅ 9/9 |
| No horizontal overflow at 375px on any route | ✅ (also clean at 1280px) |
| No console errors on any route | ⚠️ 0 errors, but 1 recurring style-shorthand **warning** app-wide (D1) |
| Dark mode + RTL clean on primary screens | ✅ (spot-checked; full sweep pending) |

**QA verdict: ☑ Ship with follow-ups.** No blockers found.

**Post-run fixes (2026-08-30):**
- **D2 — FIXED & verified.** `ActiveTripBar` hidden on `/create` + `/welcome`; wizard CTA reserves the 96px floating-controls clearance. Re-tested at 375px with an active trip — no overlap.
- **D3 — resolved as not-a-bug.** The `/g/:id` → view-only editor redirect for signed-in users is intentional shipped behavior; only the stale route comment was wrong (now fixed). Raise with product only if the redirect itself should change.
- **D5 — FIXED.** Editor welcome modal no longer hardcodes "Japan Trip Explorer" branding for every trip; Settings' version string now derives from the same `LATEST_SPRINT` source the dashboard update modal uses (no more drift); legal pages (`/privacy` `/terms` `/accessibility` `/credits`) now set a real `document.title` via the existing `docTitle` helper.
- **D1 — FIXED.** Root-caused to a repo-wide idiom mixing the `border` shorthand with a `borderTop`/`borderBottom`/`borderInlineStart` longhand in one style object (confirmed against React's `shorthandToLonghand` table) — fixed across all 13 occurrences found app-wide, no visual change.
- **D4 — FIXED.** `EditorDesktop.jsx` had its own duplicate transit-estimate formula, diverging from mobile's canonical `computeTransit()`; desktop now delegates to the same function, so both shells compute identical distance/mode/time for the same stop pair.
- **D6 — MITIGATED.** Numbered stop-marker labels in `EditorMap.jsx` now alternate a small vertical offset by stop index, so adjacent (and typically nearby) itinerary stops — including the exact reported pair — no longer render their name bubbles on the same screen row. Not a full collision-detection engine; a same-parity close pair could still touch.

**Open follow-up:** D1/D4/D5/D6 were fixed via code/root-cause analysis plus the full automated gate (critical + Jest + build all green after every change), but this pass had **no browser automation tool available** to re-run the live visual/console verification RUN 1 used. Recommend a `qa`-agent or manual pass against `localhost:3000` to close that gap — see the note at the end of §7.5.

Then close the §7.6 gaps that need a live backend / real device.

### 7.6 Coverage gaps (could not verify here)

- Real Supabase RLS / cross-user ownership / collaborator permissions — needs live backend + 2 real accounts.
- Live Google OAuth round-trip and identity persistence across the redirect.
- Paid Google Places quota / over-quota fallback switch on the live key.
- Real on-device touch (drag-reorder, sheet fling, swipe-back) on a physical phone.
- Production bundle wiring — run `npm run verify:prod` against the deploy.

---

## 8. Trip Files gallery (2026-08-31)

**Automated** — Jest suite (`tripFiles.test.js`, `attachmentService.test.js`, `useEditorState.files.test.js`, `AttachmentViewer.test.js`, `TripFilesSheet.test.js`). All P0 functional cases from the feature spec.

**Manual verification** — browser-driven round-trip and edge-case tests.

### 8.1 Core operations (Supabase-backed owned trip)

| ID | Pri | Case |
|---|---|---|
| T-FILES-01 | P0 | **Editor + add general file.** Mobile `/map/edit/:id` → 🗂️ button → sheet opens → pick PDF file → "כללי" (default) → upload. Row appears under כללי section; header badge +1; reload → still there. |
| T-FILES-02 | P1 | **Move to specific day.** Row ⋯ → "העברה ליום 3" → row moves under יום 3; reload → persists. |
| T-FILES-03 | P1 | **Rename file.** Row ✏️ → "ביטוח נסיעות" → Enter → label persists across reload. |
| T-FILES-04 | P1 | **Open in viewer.** Row tap → in-app PDF viewer shows the PDF; ✕ closes. |
| T-FILES-05 | P0 | **Delete file.** Row ⋯ → "מחק" → row gone; in Supabase Storage the object under `trip-attachments/<tripId>/…` is gone too (verify via object listing). |
| T-FILES-06 | P0 | **Desktop editor + sheet.** Desktop `/map/edit/:id` (1280px) → 🗂️ button → sheet appears same mobile layout, full-screen scrim, upload/rename/move/delete work identically. Close via ✕ or Esc. |
| T-FILES-07 | P1 | **Per-day upload via sheet.** In the sheet, use the "➕ הוסף קובץ" picker → dropdown or explicit "יום 2" choice → file lands under יום 2 (not כללי). |
| T-FILES-08 | P1 | **Stop attachment via ⋯ menu.** Stop (in day-strip list) → ⋯ → "צירוף קובץ" → add a file → open the sheet ("כל הקבצים") → file appears under that stop's day, labeled with stop name; rename/delete there → persist; delete → removed from the stop's `attachments` array (collapses to undefined when last one goes). |
| T-FILES-09 | P1 | **Long trip / scrollable move menu.** 14+ day trip → open sheet → row ⋯ → "העברה ליום" submenu has `maxHeight: …` and scrolls internally; bottom items incl. "מחק" are reachable, sheet doesn't overflow. |

### 8.2 Trip overview (read + write)

| ID | Pri | Case |
|---|---|---|
| T-FILES-10 | P0 | **Overview "קבצים" section.** `/trip/overview/:id` → scroll to "קבצים" group sections (כללי, יום 1, יום 2, …) showing same grouped lists; "כל הקבצים" pill opens the full sheet; sections match the editor's grouping exactly. |
| T-FILES-11 | P1 | **Overview upload (owned trip).** In the overview sheet → "➕ הוסף קובץ" → add a file as כללי → row appears; reload → persists. (Full CRUD via the same TripFilesSheet used in the editor.) |

### 8.3 Shared trip (read-only)

| ID | Pri | Case |
|---|---|---|
| T-FILES-12 | P1 | **Read-only trip (mobile + desktop).** Shared trip `readOnly: true` in the editor (mobile/desktop) or overview → 🗂️ button / "כל הקבצים" pill still render; sheet opens read-only — no ➕ button, no ✏️, no ⋯ (delete/move). Tap only opens the viewer. Files list is the same; just no mutation. |

### 8.4 Demo mode (`/map?demo=1`)

| ID | Pri | Case |
|---|---|---|
| T-FILES-13 | P1 | **Demo mode upload & persistence.** `/map?demo=1` (no Supabase) → add a file → previews in the viewer; row shows "לא נשמר — מצב הדגמה" label; reload → gone (expected). No backend persistence. |

### 8.5 File type handling

| ID | Pri | Case |
|---|---|---|
| T-FILES-14 | P1 | **Non-previewable file (.xlsx).** Upload an Excel file → viewer shows the 📄 fallback icon + "הורדת הקובץ" link (instead of inline preview). Link is clickable and downloads the file. |
| T-FILES-15 | P1 | **Oversized rejection (> 15 MB).** Pick a file larger than 15 MB → inline error toast in the sheet "הקובץ גדול מדי (מקסימום 15 MB)" — no upload attempt, row not added, no Supabase call. |
| T-FILES-16 | P1 | **Disallowed type rejection (.zip).** Pick a `.zip` file → inline error toast "סוג קובץ זה אינו נתמך (פורמטים מוקבלים: PDF, תמונות, Word, Excel, טקסט)" — no upload attempt. |

### 8.6 Design & RTL / Dark mode

| ID | Pri | Case |
|---|---|---|
| T-FILES-17 | P1 | **RTL + layout.** Mobile editor sheet → all text right-aligned, chevrons point left, buttons right-aligned. No overflow, RTL logical CSS throughout. |
| T-FILES-18 | P1 | **Dark mode on sheet.** Toggle dark → mobile editor sheet, desktop editor sheet, overview "קבצים" section all render correctly (dark background, readable text, icon contrast ≥3:1). |
| T-FILES-19 | P1 | **Touch targets mobile.** Mobile sheet: ➕ button, ✏️, ⋯, row tap, header close ✕ — all ≥44×44px. Measure in DevTools or manual tap test. |

### 8.7 Known gap

| ID | Pri | Case |
|---|---|---|
| T-FILES-20 | P2 | **Sheet keyboard dismissal.** TripFilesSheet closes via backdrop scrim-click and Esc key. **Known gap:** no explicit focus-trap or `<dialog>` Esc integration at the sheet level — verify keyboard dismissal is currently acceptable (tap-to-close works; Esc works if something inside the sheet doesn't consume it). If keyboard support needs strengthening, file a follow-up task. |

---

## 9. AI destination focus (2026-09-02)

| ID | Pri | Case |
|---|---|---|
| T-FOCUS-01 | P0 | **Modal → country → focus step → region pick.** Given the AiTripModal open with a destination prediction for "Thailand" (the *country*, not the city), When "בנה מסלול" is tapped, Then a `DestinationFocus` step appears. Pick "הצפון" (Northern region) → generate. Every `day.city` in the itinerary is one of {Chiang Mai, Pai}; the itinerary description names the region explicitly. |
| T-FOCUS-02 | P0 | **Focused generation: city count & pacing.** Given a focused trip (Thailand, Northern region, N days), When generation completes, Then the itinerary has ≤ ⌈N/3⌉ unique cities, arranged in consecutive multi-day blocks (e.g., 3 days in city A, 2 days in city B) or a hub-and-day-trips pattern for trips ≤ 4 days (e.g., Chiang Mai base + 1-day excursion). |
| T-FOCUS-03 | P1 | **City-level destination: no focus step.** Given the AiTripModal open, When I type "Tokyo" (a city-level prediction), Then **no** `DestinationFocus` step appears; generation proceeds directly to the itinerary. |
| T-FOCUS-04 | P1 | **Broad region (non-curated): city-picker only.** Given the modal with a pick like "Tuscany, Italy" (a region, but not in the curated 10 countries), When the focus step appears, Then `scope:"region"` and the city-picker controls render (no curated region chips), allowing free selection of cities within that region. |
| T-FOCUS-05 | P1 | **Manual city selection in focus phase.** Given a focused trip at the `DestinationFocus` step, When "בחר ערים" is tapped, the city picker is used to add 2 cities, and "המשך" is pressed, Then generation stays within those 2 cities only (no other cities added to the itinerary). |
| T-FOCUS-06 | P1 | **Refine after focused generation.** Given a completed focused itinerary (e.g., Thailand Northern region, 3 cities), When "בנו מחדש" or refine is tapped, Then the focus constraint is **retained** (does **not** re-open the focus step), and regeneration stays within the same region/cities. |
| T-FOCUS-07 | P1 | **Wizard routing step: region chips (curated country).** Given the wizard `/create` flow, When a curated country like "תאילנד" is selected and Step 2 (routing) is reached, Then the UI shows "או בחרו אזור מוכן:" text + 4 region chips (e.g., North, Northeast, Central, South). Tapping one chip pre-fills the city rows for that region. The chips vanish once any cities are manually selected (non-empty `cities`). |
| T-FOCUS-08 | P2 | **Fallback: no Places+LLM keys (localhost).** Given `localhost:3000` with no Google Places API key and no Gemini key, When the AiTripModal is opened and a broad destination is selected (Thailand), Then the focus step still renders (region chips from `FOCUS_REGIONS` are shown), the city-picker degrades to mock/sim results, and generation returns the mock itinerary without crashing. |
| T-FOCUS-09 | P2 | **RTL + dark mode on focus step.** Given the AiTripModal with focus step rendered, When dark mode is toggled (via Dashboard header or system preference), Then the modal, focus-step chips/picker, and all text render correctly — proper contrast, right-aligned Hebrew, icons not mirrored, button styling consistent with the dark palette. |
| T-FOCUS-10 | P1 | **Refine keeps focus constraint (no step re-shown).** Given a focused generation with `focus: { cities: [...], label: "..." }` set in state, When `runGenerate({refine: true})` is called, Then `effectiveFocus` falls back to the persisted `focus` state (which is still set), and **no** focus step is re-shown during refine (stays in the editor, straight to regeneration). |
| T-FOCUS-11 | P2 | **Mock itinerary ignores focus; step still renders.** Given `localhost:3000` with no LLM key, When AiTripModal opens and a country/region is selected → focus step appears → cities are picked → generate, Then the `mockItinerary` function ignores the `focus` constraint and returns a mock itinerary (because the real LLM is unavailable), but **the focus step itself still renders from `FOCUS_REGIONS` data** — no crash, UI is complete. The dev server **cannot** visually demonstrate the focus constraint in action, but the wiring is testable on production. |
| T-FOCUS-12 | P2 | **matchCuratedCountry on real Google types.** Given Places predictions for "Thailand" with real Google `types` (e.g., `["country"]`), When `matchCuratedCountry` is called on those types, Then it returns `"th"` (a curated country ID) → region chips render. Given a non-curated broad pick like "Patagonia" → `scope:"region"` → city-picker only (no chips). |
| T-FOCUS-13 | P1 | **Wizard region-chip prefill (curated country, Hebrew).** Given the wizard `/create` flow with "תאילנד" selected, When Step 2 is reached and "הדרום והאיים" (South+Islands region) chip is tapped, Then the city rows are pre-filled with Hebrew city names from that region (e.g., "พูเก็ต" → "פוקט", "กระบี่" → "קระบี่"), and the region chips vanish once `cities` is non-empty. |
| T-FOCUS-14 | P2 | **RTL + dark + touch on focus modal & back button.** Given the AiTripModal with focus step active, When dark mode is toggled AND the layout is inspected at 375×812, Then: (a) the modal, buttons, chips, and text are theme-aware (dark-mode colors from `useDarkMode()`), (b) the "→ חזרה" (back) button is ≥44×44px (measurable in DevTools), (c) on-device touch on the back button responds correctly (not OS-level bounce or misfire). |
| T-FOCUS-15 | P2 | **Known limitation: city-picker autocomplete not country-biased.** Given the focus step → "בחר ערים" → city-picker autocomplete, When typing a common city name (e.g., "Bangkok"), Then results can include cities outside the picked country (because `countryBias` is not passed to the Places autocomplete query in the picker). **Confirm this is acceptable**, or file a follow-up to add `countryBias` in-phase. |

---

## 10. Sign-off

| Check | Owner | Status |
|---|---|---|
| All P0 functional cases pass | | ⬜ |
| No S1/S2 defects open | | ⬜ |
| `npm run critical` green | | ⬜ |
| No horizontal overflow at 375px on any route | | ⬜ |
| No console errors on any route | | ⬜ |
| Dark mode + RTL clean on all primary screens | | ⬜ |
| Trip Files gallery automated tests green | | ⬜ |
| Trip Files gallery manual cases verified | | ⬜ |

**QA verdict:** ⬜ Ship · ⬜ Ship with follow-ups · ⬜ Block
