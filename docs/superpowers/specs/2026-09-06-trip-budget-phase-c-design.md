# Trip budget — Phase C: visibility, sharing, receipts

**Date:** 2026-09-06
**Status:** Draft — pending review
**Branch:** `saas-builder-local`
**Predecessor:** [2026-09-03-trip-budget-design.md](2026-09-03-trip-budget-design.md) — §10 phase table, row **C**
**Owner agents:** `product-designer` (this doc) · `builder` (screens + sheets) · `budget-domain` (`buildFileGroups` finance group, `useOverBudgetWatch`) · `design-systems` (2 new `Icon.jsx` glyphs) · `copywriter` (Phase D microcopy pass) · `qa` (`T-BUDGET-36..55`)

## Scope

Phase A shipped the engine and `/trip/budget/:tripId`. Phase B shipped per-stop
cost entry, Tier-1 confirms and the ₪ quick-add chip. **Neither phase made the
budget visible anywhere the user wasn't already looking for it.** Today a trip
with a ₪15,000 budget and ₪16,800 of expenses looks identical, on every screen
except one, to a trip with no budget at all.

Phase C is the visibility layer. Six surfaces:

| # | Surface | Job |
|---|---|---|
| 1 | Trip-overview budget card | The at-a-glance answer, one tap from the trip |
| 2 | Dashboard `MapCard` indicator | The at-a-glance answer across all trips |
| 3 | Overrun toast + persistent marking | The moment you cross the line |
| 4 | Share-sheet visibility toggle | Who else sees the money |
| 5 | Wizard budget entry | Set a target while the trip is being born |
| 6 | "קבצים" receipts group | Payment confirmations live with the expense |

Plus one addendum (§9): the editor ₪ chip badge, which `EditorDesktop.jsx:912`
explicitly parks with the comment *"No badge yet (Phase C wires a live
spent/total indicator here)"* but which the §10 phase table omits.

**Not in scope:** no new Supabase table, column, RLS policy or migration
(inherited from §0 of the predecessor). No change to auth, routes, or the money
math. `rollup()` and `summarize()` are consumed exactly as they ship — **every
number below already exists**; nothing new is computed.

---

## 0. What already ships, and what each surface is allowed to read

The single most important constraint on this phase: **no surface may invent a
number.**

`rollup(budget)` (`src/utils/budget.js:129`) returns, and only returns:

```
totalIlsMinor · plannedIlsMinor · actualIlsMinor · effectiveIlsMinor
remainingIlsMinor · pct · overBudget · allocatedIlsMinor · unallocatedIlsMinor
byCategory[] · itemCount
```

`summarize(budget)` (`budget.js:203`) returns the four-field derived object
persisted at `data.budget.summary` and lifted to `trip.budgetSummary` by
`rowToTrip` (`tripService.js:62`) and `toSummary` (`tripService.js:274`):

```
{ totalIlsMinor, effectiveIlsMinor, pct, over }
```

`hasBudget(budget)` (`budget.js:216`) is `true` when there is a positive total
**or** at least one expense.

| Surface | Data source | Never |
|---|---|---|
| Overview card | `useBudget(trip).roll` (read-only use) | — |
| Dashboard indicator | `trip.budgetSummary` **only** | `rollup()` — `data` is stripped before the grid renders |
| Overrun toast/marking | `roll.overBudget` / `summary.over` | a locally recomputed threshold |
| Share toggle | `trip.settings.budgetShared` | `data.budget` |
| Wizard | none (write-only) | — |
| Files group | `trip.data.files[].expenseRef` + `budget.items` for labels | a second file store |

Derived display states, defined once here and used identically on every surface:

| State | Condition | Notes |
|---|---|---|
| `none` | `!hasBudget(budget)` | No target, no expenses |
| `noTarget` | `hasBudget && totalIlsMinor <= 0` | Expenses exist, nothing to be over |
| `onTrack` | `pct < 85` | |
| `nearCap` | `85 <= pct <= 100 && !overBudget` | **New in Phase C** — a pure threshold on `pct`, no new arithmetic |
| `over` | `overBudget === true` | |

**Decision — `nearCap` gets no colour of its own.** It changes the wording of
the state line only; the bar stays `accent`. Introducing a fourth semantic
colour (amber) for a state the engine doesn't model would expand the palette,
add a contrast burden in both themes, and — as the shipped `BudgetView` already
demonstrates — the *words* are what actually carry the state. Decided, not open.

---

## 1. Surface 1 — the trip-overview budget card

### 1.1 Placement

| Layout | File | Insert at | Neighbours |
|---|---|---|---|
| Mobile (<1024px) | `src/views/TripOverviewView.jsx` | **:455** — between `</section>` of "מה קורה בכל יום" (ends :454) and the "קבצים" section (starts :456) | after the day list, before files |
| Desktop (≥1024px) | `src/views/TripOverviewDesktop.jsx` | **:101** — between the closing `</div>` of the "מה תכננו" rail card (:100) and `{/* Actions */}` (:102) | third card in the sticky `<aside>` rail |

Money ranks above files and below the itinerary itself. On desktop the rail is
already the "facts about this trip" column (metrics · narrative · actions), so
the budget belongs there, not in the itinerary column.

The card matches the established overview card vocabulary exactly — mobile uses
the `padding: "32px 24px 0"` section pattern with a `13px/800/uppercase/0.06em
ink3` eyebrow; desktop uses the rail card
(`background: P.panel, border: 1px solid P.line, borderRadius: 20, padding: 22`).
**No new card shape.**

### 1.2 What it shows, per state

All amounts through `<Money>` (`src/components/Money.jsx`) — it already supplies
the bidi isolation and `tabular-nums` this needs.

**`over` / `nearCap` / `onTrack`** (i.e. `hasBudget && totalIlsMinor > 0`):

```
תקציב                                    [ לפירוט ‹ ]
────────────────────────────────────────────────────
₪9,800  מתוך ₪15,000
▓▓▓▓▓▓▓▓▓▓▓░░░░░░░░  65%
נותרו ₪5,200
מתוכנן ₪12,400 · בפועל ₪4,100
```

| Row | Content | Type token | Colour (light / dark) |
|---|---|---|---|
| Eyebrow | `תקציב` | 13/800, `0.06em`, uppercase | `P.ink3` |
| Headline | `<Money>` effective, 26px/800 · `" מתוך "` · `<Money>` total, 14/600 | Display | effective: `P.ink` / `P.danger` when `over`. total: `P.ink3` |
| Bar | `height: 8, borderRadius: 999`, track `P.surface2`, fill width `min(100, pct)%` | — | fill `P.accent` (`#E0533F` both) / `P.danger` (`#C0392B` light, `#E0573F` dark) when `over` |
| State line | see table below | 14/800 | `P.ink2` / `P.danger` when `over` |
| Supporting | `מתוכנן ₪X · בפועל ₪Y` | 12.5/600 | `P.ink3` |

State line copy:

| State | Copy | Icon |
|---|---|---|
| `onTrack` | `נותרו ₪5,200` | — |
| `nearCap` | `נותרו ₪1,400 — קרובים לתקרה` | — |
| `over` | `חריגה של ₪800` | `<Icon name="alertTriangle" size={14} />` inline, `marginInlineEnd: 6` |

**`noTarget`** (expenses exist, `totalIlsMinor === 0`): no bar, no
remaining/over line — there is nothing to be over. Headline is the effective
figure alone; state line reads `לא הוגדר יעד`, in `P.ink3`. This matches
`BudgetView.jsx:213` verbatim, deliberately.

**`none`** (no target and no expenses): the card collapses to a **single row**,
not a card with a hollow bar:

```
תקציב                       [ הגדרת תקציב ]
עדיין לא הוגדר תקציב לטיול הזה.
```

`minHeight: 44` on the button, `P.ink3` on the body line, no bar, no numbers.
This is entry point #2 from the predecessor's §8.3, so it must render — but it
renders as an invitation, not as an empty dashboard widget.

**Read-only viewer** (`trip.readOnly === true`, e.g. the Japan sample or a
view-role share): identical to the above, minus the `הגדרת תקציב` button in the
`none` state. When there is nothing to show and nothing to do, the entire
section is **omitted** — a read-only viewer being told "no budget was set" learns
nothing and can do nothing.

### 1.3 Disclosure

| Tier | Element |
|---|---|
| **Persistent** | The whole card, whenever the viewer may see the budget and `hasBudget` is true |
| **One tap** | `לפירוט ›` → `/trip/budget/:tripId` (the entire card body is also the tap target) |
| **Contextual** | The `הגדרת תקציב` button — only in state `none`, only when `!readOnly` |
| **Hidden** | Viewer is a collaborator and `settings.budgetShared !== true` (§4) · route is the public gallery |

### 1.4 Interaction

**Entry** → overview loads (existing `fetchTripById`, existing skeleton).
**Action** → tap anywhere on the card, or the `לפירוט ›` affordance.
**Feedback** → immediate route change to `/trip/budget/:tripId`. No optimistic
state, no toast — nothing was mutated.
**Exit** → `BudgetView`'s back button already calls `navigate(-1)`
(`BudgetView.jsx:143`), which returns to the overview. Correct as shipped; do
not hardcode a destination.

The `none`-state button navigates to `/trip/budget/:tripId` **too** — it does not
open a sheet inline. Reason: `BudgetSetupSheet` is already mounted and wired on
that screen with its own validation and Tier-1 rate confirm; mounting a second
copy on the overview is a duplicate component vocabulary for one action a user
performs once per trip.

### 1.5 Accessibility

- Bar: `role="progressbar"` · `aria-label="ניצול התקציב"` · `aria-valuemin={0}` ·
  `aria-valuemax={roll.totalIlsMinor}` · `aria-valuenow={roll.effectiveIlsMinor}`
  — matching `BudgetView.jsx:194-198` exactly.
- The card is one `<button>` (or an `<a>`), `minHeight: 44`, so the whole thing
  is one focus stop, not five.
- **`P.accent` is never used for text on this card.** `#E0533F` on `#FFFFFF` is
  ≈3.8:1 — fine for the bar (a graphic, 3:1 threshold), fails 4.5:1 for a label.
  The on-track state line is `P.ink2`. `P.danger` light `#C0392B` on `panel` is
  ≈5.9:1 ✓; dark `#E0573F` on `#16191D` must be measured during the QA pass —
  it is close to the line.
- Logical properties only. The `›` chevron is `<Icon name="chevronStart" />`,
  which `Icon.jsx:38-44` already draws pointing to the inline-start edge for RTL
  back/drill affordances — do **not** use a raw `›` glyph, which will not mirror.

### 1.6 Dark mode

`TripOverviewView` / `TripOverviewDesktop` are already `P`-driven via
`useDarkMode()`, so the card inherits correctly. But both files hard-code
`const ACCENT = "#E0533F"` (`TripOverviewView.jsx:35`,
`TripOverviewDesktop.jsx:18`). **The new card must use `P.accent` and `P.danger`,
not the module constant** — otherwise the over-budget bar renders `#C0392B` in
dark mode where the palette specifies `#E0573F`. Do not refactor the existing
`ACCENT` uses in this diff; just don't extend them.

---

## 2. Surface 2 — the dashboard `MapCard` indicator

### 2.1 Placement

`src/components/MapCard.jsx` **:260** — a new line between the `trip.meta`
line (ends :259) and the `trip.tripMemo` block (:260).

Reading order becomes: title → meta → **budget** → memo → chip row (role ·
share · memo · avatars). It does **not** go in the chip row at :265-295, which is
already at four elements and is where the 44px-target pressure lives.

### 2.2 What it shows

One line, 20px tall, from `trip.budgetSummary` only:

```
▓▓▓▓▓░░░  65% · בתקציב
```

- Mini track: `width: 46, height: 4, borderRadius: 999`, `background: P.surface2`,
  fill `min(100, pct)%`.
- Fill colour: `ACCENT` (`#E0533F`) / `DANGER` (`#C0392B`) when `over` — both
  constants already exist at `MapCard.jsx:27`.
- Text: `11.5px/700`, `fontVariantNumeric: "tabular-nums"`, `P.ink3` / `DANGER`
  when `over`.
- Over state gets `<Icon name="alertTriangle" size={11} strokeWidth={2.2} />`
  before the word.

| State | Text |
|---|---|
| `onTrack` / `nearCap` | `65% · בתקציב` |
| `over` | `⚠ 112% · חריגה` |

**Decision — the dashboard shows two states, not four.** `nearCap` is not
distinguished here. A dashboard card is a scanning surface at ~44px of vertical
budget; the useful signal is binary ("is anything wrong?"). The nuance lives one
tap away on the overview card. Decided, not open.

### 2.3 Disclosure

The indicator renders **only** when all of these hold:

1. `trip.budgetSummary` is non-null, **and**
2. `trip.budgetSummary.totalIlsMinor > 0` (equivalently `pct != null`), **and**
3. the viewer may see the budget: `trip.role === "owner"` **or**
   `trip.settings?.budgetShared === true`.

Otherwise: **nothing renders at all.** No placeholder, no "אין תקציב" row, no
zero bar. A grid of five trips where two have budgets shows two indicators.

Condition 2 is the deliberate one: `summarize()` returns a non-null object for a
trip that has expenses but no target, with `pct: null`. A percentage widget with
no percentage is noise on a scanning surface; that case is served by the
overview card's `noTarget` state instead.

`trip.settings` survives the `data` strip in both persistence paths
(`fetchAllTrips` destructures only `data` off; `toSummary` likewise), so
condition 3 is answerable in the grid without an extra read.

| Tier | Element |
|---|---|
| **Persistent** | The line, under the three conditions above |
| **Contextual** | The over-budget marking, only when `summary.over` |

### 2.4 Interaction — deliberately none

The indicator is **not** interactive. The card as a whole already navigates to
`/trip/overview/:tripId` (`DashboardView.jsx:152`). Nesting a button inside it
would (a) need its own 44×44 target inside a 20px line, and (b) join the four
existing `e.stopPropagation()` workarounds this component already carries
(`MapCard.jsx:174, 182, 186, 234`). The budget is two taps from here — card →
overview card — and that is the right cost for an "occasionally" action.

This is a conscious departure from the reflex that every visible datum should be
tappable. Reason stated above.

### 2.5 Accessibility, RTL, dark mode

- The track gets `aria-hidden`; the line's meaning is fully carried by the text
  that follows it. No `role="progressbar"` here — a non-interactive 46px
  decoration announcing valuemin/max on every card is screen-reader noise, and
  the percentage is already read as text.
- `insetInlineStart` / `marginInlineEnd` only. The bar fill grows from the
  inline-start edge; under `dir="rtl"` that is the right edge, which is correct
  and needs no mirroring logic — it is a plain flex child.
- `MapCard` takes `dark` as a **prop** and carries its own `LIGHT`/`DARK` tables
  (`:24-25`) rather than calling `useDarkMode()`. That is existing, intentional
  design (`DashboardView` owns the toggle). The indicator uses the local `P`,
  `ACCENT` and `DANGER`. **Do not migrate `MapCard` to `useDarkMode()` in this
  diff** — it would change the component's contract for a cosmetic gain.

---

## 3. Surface 3 — the overrun toast and the persistent marking

The predecessor's §8.4 says *"Crossing 100% fires a one-time toast … and applies
a persistent marking"* and stops there. Two real questions are unanswered.
Both are decided here.

### 3.1 Decision A — where the crossing is detected

**A new hook, `src/hooks/useOverBudgetWatch.js`.** Not inside `useBudget`.

Reason: `useBudget` is not on every write path. `EditorView.jsx:2163-2192`
writes per-stop expenses by calling the pure `addExpense`/`updateExpense`
transforms directly against `data` and persisting through `persistTripData` —
it never touches `useBudget`. A crossing caused by adding a ₪900 cost to a stop
would be silently missed.

`useOverBudgetWatch(budget, tripId)` instead **watches the rendered budget
object**, so it catches every write path regardless of which mutator produced
it, and needs no change to the existing editor code:

```
useOverBudgetWatch(budget, tripId) →
  { justWentOver: boolean, overAmountIlsMinor: number, ack: () => void }
```

Semantics:

- Computes `rollup(budget).overBudget` and compares to a ref.
- **Seeds the ref on first mount from the current value**, so opening a trip
  that is *already* over budget never toasts. Only a `false → true` transition
  inside a live session fires.
- Fires only for the client that made the change. There is no realtime channel
  in this codebase; a collaborator who pushes the trip over budget does not
  notify the owner, and the spec should not pretend otherwise.

### 3.2 Decision B — what "one-time" means

**Per trip, per device, until the trip returns under budget.**
`localStorage` key `tp_budget_over_notified_v1`, a `{ [tripId]: true }` map.
Set when the toast fires; **deleted** when a later render observes
`overBudget === false`, so a user who overspends, trims, and overspends again
gets told again.

Rejected alternatives: `sessionStorage` re-fires in every new tab, which reads
as a bug. A field on `data.budget` costs a write, and would suppress the toast
for the *other* collaborator, who never saw it.

### 3.3 The toast

Rendered by whichever screen mounted the watch. Mounted on: `BudgetView`,
`EditorView`, `EditorDesktop` — the three screens where a budget mutation can
originate.

| Property | Value |
|---|---|
| Copy | `חרגתם מהתקציב ב־₪800` |
| Action | `לתקציב` → `/trip/budget/:tripId` (omitted when already on `BudgetView`) |
| Icon | `<Icon name="alertTriangle" size={17} strokeWidth={2.2} />` |
| Duration | **6s** (vs. 2.8s for the existing success toasts — it carries an action and it is money) |
| Dismiss | Tapping the toast body, tapping the action, or timeout. `ack()` on any of these |
| Shape | Matches the shipped toast: `borderRadius: 999`, `padding: "13px 22px"`, `background: P.ink`, `color: P.panel`, `bottom: 92 + env(safe-area-inset-bottom)`, centred, `className="tp-pop"` |
| ARIA | `role="status"` `aria-live="polite"` — **not** `alert`; nothing is broken, and `assertive` would interrupt whatever the user is mid-way through |
| Motion | `tp-pop` (existing, 0.22s). Reduced-motion guard already in `index.css` |

**The toast is informational and is not undoable.** It reports a state, not an
action; the action that caused it (adding an expense) has its own undo path
where one exists. It must **not** carry a "בטל" affordance — that would falsely
imply the crossing itself can be reversed.

This is deliberately *not* a Tier-1 confirm. Per the predecessor's §5, going
over budget changes only the picture, not the linkage — a blocking dialog here
would be the exact dialog fatigue that rule exists to prevent.

### 3.4 The persistent marking

Colour is never the only carrier. Every one of these already pairs the danger
colour with a word:

| Surface | Marking | Status |
|---|---|---|
| `BudgetView` total bar | `P.danger` fill + `חריגה של ₪X` | **Shipped** (`BudgetView.jsx:204, 216`) |
| `BudgetView` category row | `P.danger` figure + `<strong>חריגה</strong>` | **Shipped** (`BudgetView.jsx:274`) |
| Overview card | `P.danger` fill + `⚠ חריגה של ₪X` | Phase C §1.2 |
| Dashboard `MapCard` | `DANGER` fill + `⚠ 112% · חריגה` | Phase C §2.2 |
| Editor ₪ chip | `danger` ring + `חריגה` label | Phase C §9 |

### 3.5 Tier-2 passive notice — "a day was added"

The predecessor's §5 Tier-2 table lists this as the owner's own example. It is
the only Tier-2 notice that needs new UI.

- **Trigger:** the trip's day count increases (date-range extension, `applySkeleton`,
  add-day) **and** `hasBudget(trip.data.budget)` is true. Never when there is no
  budget — there is nothing to tell.
- **Treatment:** a dismissible inline notice in the editor, **not a dialog** and
  not a modal. Same toast shape as §3.3 but `background: P.surface`,
  `color: P.ink2`, `border: 1px solid P.line`, no icon, 5s.
- **Copy:** `נוסף יום 8 — התקציב לא עודכן.` · action `לתקציב`.
- **Dismissal:** per trip, `localStorage` key `tp_budget_tier2_v1`. Once
  dismissed for a trip, adding further days does not re-notify. A Tier-2 notice
  the user has already understood is friction.
- Never blocks, never disables the CTA that triggered it.

---

## 4. Surface 4 — the share visibility toggle

### 4.1 The spec's target file is dead code

The predecessor's §6 names `src/components/ShareSheet.jsx`. **That component is
not imported anywhere:**

```
$ grep -rn "ShareSheet" src/ | grep -v SharePermissions
src/components/ShareSheet.jsx:6,38,210   ← its own definition only
```

The live share UI is **`src/components/SharePermissionsModal.jsx`**, used from
`DashboardView.jsx:484` (card ⋯ → שיתוף) and `App.jsx:439` (ActiveTripBar).
Unlike `ShareSheet`, it is already dark-mode-aware via `useDarkMode()` and it
already reads/writes through the Sprint-66 `trip_shares` table.

**The toggle goes in `SharePermissionsModal.jsx`.** `ShareSheet.jsx` should be
deleted (§8). Redirecting the spec here is a correction, not a preference: the
original target would have shipped an invisible control.

### 4.2 Placement

`src/components/SharePermissionsModal.jsx` **:267** — a new section after the
"גישה כללית" link row (which closes at :266) and before the sticky footer (:269),
inside the existing scroll body.

```
תקציב
┌──────────────────────────────────────────────────┐
│ 📊  הצג תקציב לשותפים                    [ ⬤— ] │
│     שותפים במסלול יראו את התקציב וההוצאות.       │
└──────────────────────────────────────────────────┘
```

Reuses the exact `גישה כללית` row vocabulary already at :258-266:
`padding: 12, borderRadius: 14, border: 1px solid P.line, background: P.surface`,
38px circular icon well in `P.surface2`, `13.5/700 P.ink` title +
`11.5 P.ink3` sub. Icon: `<Icon name="barChart" size={16} strokeWidth={2} />`
(exists in `Icon.jsx`).

### 4.3 The control

There is no switch primitive in this codebase — the modal uses `<select>` and
pill buttons. Add one, scoped to this row:

```
<button role="switch" aria-checked={on} aria-label="הצג תקציב לשותפים">
```

| Property | Value |
|---|---|
| Track | `52 × 30`, `borderRadius: 999` |
| Hit area | `minWidth: 52, minHeight: 44` via block padding — the visible track stays 30px, the target is 44 |
| Knob | `24 × 24`, `borderRadius: 999`, `background: P.panel`, `boxShadow: 0 1px 3px rgba(0,0,0,0.25)` |
| Knob position | `insetInlineStart` — **logical**. Off = `3px`, on = `calc(100% - 27px)`. Under `dir="rtl"` the knob travels right→left, which is correct |
| Transition | `160ms cubic-bezier(0.22, 1, 0.36, 1)` on `inset-inline-start` and `background` |

Every state, both themes:

| State | Track bg (light / dark) | Knob | Notes |
|---|---|---|---|
| off, default | `P.surface2` `#EFEFEC` / `#262B31` | `P.panel` | |
| off, hover | `P.line` overlay, +4% | `P.panel` | pointer only |
| off, focus-visible | as default + `outline: 2px solid P.accent; outline-offset: 2px` | | |
| off, active | knob `scale(0.94)` (`tp-press`) | | |
| on, default | `P.accent` `#E0533F` both | `#FFFFFF` | accent-on-white knob ≈3.8:1 — a graphic, 3:1 threshold ✓ |
| on, hover | `#CF4A38` / `#CF4A38` | | |
| on, focus-visible | as on + same outline | | |
| on, active | knob `scale(0.94)` | | |
| disabled | `P.surface`, knob `P.ink4`, `cursor: default`, `opacity: 0.55` | | while `busy` |
| loading | disabled + the row sub-line reads `שומר…` | | optimistic; see §4.6 |
| error | row sub-line becomes `שמירת ההגדרה נכשלה.` in `P.danger`, switch reverts | | matches the modal's existing `err` pattern at :212 |

### 4.4 Disclosure

| Tier | Element |
|---|---|
| **One tap** | The `תקציב` section, whenever the modal is open **and** `trip.role === "owner"` |
| **Hidden** | Non-owner viewers. `DashboardView.jsx:407` already only passes `onShare` for owners, but the ActiveTripBar path (`App.jsx:439`) does not gate — the section must guard on `trip.role === "owner"` itself |
| **Hidden** | Trips with `trip.readOnly` |

The section renders **even when the trip has no budget**. It is a setting about
future state, and hiding it would make it undiscoverable exactly when a user is
about to invite someone.

### 4.5 Semantics — precisely what a collaborator sees

This is the part that becomes a real permissions decision later, so it is
written as a table with no gaps.

`trip.settings.budgetShared`, boolean, **default `false`** (an absent field
reads as `false`).

| Viewer | `budgetShared: false` | `budgetShared: true` |
|---|---|---|
| **Owner** (`role: "owner"`) | Everything, always. The flag never affects the owner | Everything |
| **Collaborator, `role: "edit"`** | Dashboard indicator: **absent**. Overview card: **section omitted entirely**. Editor ₪ chip: **absent**. `/trip/budget/:tripId` by direct URL: renders a **blocked state** (§4.7), no figures | Full budget screen, **writable** — same rights as the itinerary. Indicator, card and chip all render |
| **Collaborator, `role: "view"`** | Same as above — everything absent, route blocked | Full budget screen, **read-only** (`useBudget` already refuses to mutate when `trip.readOnly`, `useBudget.js:56`). No `הוספת הוצאה`, no `עריכת התקציב`, rows not tappable — exactly the shipped `readOnly` behaviour |
| **Public gallery viewer** (`/g/:tripId`) | **Never**, under any value of the flag | **Never** |
| **Anyone with a link, `linkAccess.mode: "anyone"`** | Governed by the role that link grants; the flag applies on top identically | same |

Three things this table asserts on purpose:

1. **The public gallery is not governed by the flag.** It is a hard rule, from
   the predecessor's §6. A published map must never expose its owner's finances,
   and no owner should be able to opt into that by mistake.
2. **The absent state is silence, not an explanation.** A collaborator on a trip
   with `budgetShared: false` sees no budget section and no "the owner hid the
   budget" message. Rationale: such a message advertises that a budget exists
   and invites exactly the devtools poking §4.8 admits is possible, and — since
   most trips have no budget at all — it would be a false signal on the majority
   of shared trips.
3. **The direct-URL case is the one exception**, because the user explicitly
   asked for that screen and a blank page is a bug report.

### 4.6 Interaction

**Entry** → owner opens the share modal.
**Action** → tap the switch.
**Feedback** → **optimistic**. The knob moves immediately; `saveTrip` fires;
on failure the knob reverts and the row sub-line shows the error. This mirrors
the modal's existing `run()` optimistic-with-revert helper
(`SharePermissionsModal.jsx:83-97`) — reuse it, do not add a parallel one.
**Exit** → `סיום`, backdrop, or `Esc`.

Turning it **off** while at least one collaborator exists produces a **Tier-2
passive notice**, per the predecessor's §5: an inline line that replaces the
row's sub-line for 5s —

> `השותפים לא יראו יותר את התקציב. הנתונים נשמרים.`

— then reverts. Not a dialog. Nothing is destroyed, nothing is unlinked; the
data is untouched and the switch is instantly reversible.

**Write hazard — must not be missed.** `tripPatchToRow` does
`row.settings = patch.settings` (`tripService.js:80`) — a **full replace**, not a
merge. The write must therefore be:

```
tripService.saveTrip(tripId, { settings: { ...trip.settings, budgetShared: next } })
```

`SharePermissionsModal` loads the whole trip via `fetchTripById` at :60, so the
full `settings` object is in hand. A patch of `{ settings: { budgetShared } }`
would silently destroy `destination`, `destinationHe`, `center`, `days`,
`cityRanges` and `startDate`. This is the single highest-risk line in Phase C.

### 4.7 The blocked state on `/trip/budget/:tripId`

`BudgetView` gains a guard before its existing render, evaluated after `trip`
loads:

```
const maySeeBudget = trip.role === "owner" || trip.settings?.budgetShared === true;
```

When false, render, in the existing page/shell containers:

```
תקציב
בעל המסלול לא שיתף את התקציב של המסלול הזה.
[ חזרה למסלול ]
```

`P.ink` title, `P.ink3` body, the same 44px pill back button as
`BudgetView.jsx:144`, navigating to `/trip/overview/:tripId`. No numbers, no bar,
no `data-testid` summary nodes.

The copy states a fact about sharing. It does **not** say "אין לך הרשאה" or
"מוגן" — see §4.8.

### 4.8 Honesty about what this is

**This is a client-side curtain, not protection.** RLS hands a collaborator the
entire trip row including `data.budget`; a determined person with devtools can
read the JSONB. That is a conscious v1 trade (predecessor §0) and it is
discharged in wording:

- The toggle is labelled **`הצג תקציב לשותפים`** — a visibility switch.
- It is **never** labelled `פרטי`, `מוסתר`, `מוגן`, or `לא משותף`.
- No help text promises secrecy, encryption, or that the data is inaccessible.
- The blocked state says the owner *didn't share* it, not that it is *protected*.

When v2 moves the budget to its own table with its own RLS, the promise can be
upgraded along with the mechanism — and only then.

### 4.9 Open decision for the team

**Does `budgetShared: true` grant an `edit`-role collaborator write access to
the budget, or read-only?**

The table above assumes **write** — same rights as the itinerary.

*Recommendation: keep it as write.* A "collaborators may see but not edit the
budget" mode requires a second flag, a second guard in `useBudget` (which today
keys purely off `trip.readOnly`), and a second explanation in the UI — for a
distinction the toggle's own label ("הצג") does not imply. If the team wants
separate money permissions, that is a permissions model, not a visibility
switch, and it belongs in v2 alongside the RLS work.

---

## 5. Surface 5 — the wizard budget entry

### 5.1 Decision — no fourth wizard step

The predecessor's §8.3 entry #1 says *"Wizard `/create` — Optional step,
skippable in one tap."* **This spec recommends against a fourth step**, and says
so out loud because it contradicts the shipped plan.

Reasons:

1. `WizardView.jsx:443` renders exactly three pips (`[0, 1, 2].map(...)`). A
   fourth pip tells every user, before they have chosen a destination, that this
   flow is 33% longer than it is.
2. "Skippable in one tap" is still a tap, on a step whose entire content is
   optional. PRODUCT.md Design Principle #4 is *one job per screen* — a screen
   whose job is "you may skip this" is a screen with no job.
3. It would require touching `step1Ready`, the `Math.min(3, step + 1)` clamp at
   :447, the `step === 2 ? 3 : …` branch, and the edit-mode bypass. Four
   gating expressions changed for an optional field.

**Instead: a fourth `SummaryCard` on the existing summary screen (step 3).**

### 5.2 Placement

`src/views/WizardView.jsx` **:934** — a new `<SummaryCard>` after the city
timeline card (closes :933) and before the closing `</>` of the `step === 3`
block (:937).

It uses the existing `SummaryCard` component (`WizardView.jsx:974`) verbatim —
same 18px radius, same 32px icon well in `T.surface2`, same 11/800/uppercase
label. **No new card.**

This placement gives three properties for free:

- **Zero added steps.** The pip row, the CTA gating and `allocationValid` are
  untouched.
- **Skippable at zero cost.** Empty is the default; the user does nothing.
- **Skeleton-edit mode never sees it.** `editTripId` commits from step 2 and
  never reaches step 3 (`:946`) — which is right: re-cutting a trip's day
  structure should not re-ask about money.

### 5.3 What it shows

`SummaryCard` icon: `<Icon name="barChart" size={18} strokeWidth={1.9} color={T.ink2} />`.
Label: `תקציב · לא חובה`. **No `onEdit` prop** — the card's body is the editor;
there is no earlier step to jump back to. (`SummaryCard` currently always renders
the edit pill; it needs `onEdit` to be optional. One-line change.)

**Collapsed (default, empty):**

```
תקציב · לא חובה
────────────────────────────────
[ + הוספת תקציב לטיול ]
אפשר גם אחר כך, מתוך המסלול.
```

Ghost button: `minHeight: 44`, `border: 1px solid T.line`, `background: T.surface`,
`color: T.ink2`, `13.5/700`. Caption `12/600 T.ink4`.

**Expanded:**

```
תקציב · לא חובה
────────────────────────────────
כמה תכננתם להוציא?
[  ₪ | 15,000               ]
נפרט לפי קטגוריות ומטבע היעד אחר כך, במסך התקציב.
```

- **One field. Shekels only.** No destination currency, no exchange rate, no
  category caps. Asking a user for a JPY→ILS rate before they have created the
  trip is hostile; those live on `BudgetSetupSheet`, which already handles them
  with a Tier-1 confirm.
- `inputMode="decimal"`, `dir="ltr"`, `textAlign: "right"`, `tabular-nums`,
  `height: 50`, matching the wizard's existing input vocabulary.
- Fixed `₪` prefix in `T.ink3` inside the field's inline-start.
- Clearing the field returns the card to collapsed. There is no "remove budget"
  button — emptying the field *is* the removal.

### 5.4 Validation and states

| State | Behaviour |
|---|---|
| empty | Valid. No budget is seeded. **Never blocks the CTA** |
| valid | `parseAmount(text, "ILS")` returns an integer > 0 |
| invalid | `parseAmount` returns `null` → inline `role="alert"` under the field: `נא להזין סכום במספרים` in the wizard's existing error style (`:860`, `#A03325` on `rgba(192,57,43,0.08)`). **The CTA is not disabled** — an optional field must never be able to trap the user. On submit with an invalid value, the budget is simply not seeded |
| focus | `border-color: T.accent`, `outline: none` — matching the wizard's other fields |
| disabled | while `creating` — the whole card, `opacity: 0.55` |

### 5.5 Persistence

The one service change Phase C needs.

`tripService.createNewTrip` accepts a new optional `budgetIlsMinor`. When it is
a finite integer > 0, the created trip's `data` is seeded through the existing
pure transforms — no new logic:

```
data = setBudgetConfig(ensureBudget(data), { totalIlsMinor: budgetIlsMinor })
```

`saveTrip`'s `withBudgetSummary` (`tripService.js:287`) then derives
`data.budget.summary` on the write, so the new trip's dashboard card shows
`0% · בתקציב` on the very first render. No extra call, no second write.

When `budgetIlsMinor` is absent or 0, **no `budget` key is written at all** —
`ensureBudget` is not called, and `hasBudget()` stays false everywhere.

`WizardView.finish()` (`:363`) passes it in the existing `createNewTrip({...})`
object at `:398`. Skeleton-edit mode (`applySkeleton`) is untouched.

### 5.6 RTL, dark mode, targets

- `WizardView` is light-only today (module-level `T` at the top of the file, no
  `useDarkMode()`). **The budget card follows `T`.** Half-migrating one card to
  the dark palette inside a light-only screen would produce a visibly wrong card
  in dark mode, which is worse than a consistently light screen. Migrating the
  wizard to `useDarkMode()` is real, separate work — log it, don't smuggle it in.
- Field height 50, ghost button `minHeight: 44` ✓.
- The `₪` prefix sits at `insetInlineStart` inside the field; the numeric input
  is `dir="ltr"` inside the RTL card, which is the same pattern the email field
  in `SharePermissionsModal` already uses.

---

## 6. Surface 6 — the "קבצים" receipts group

### 6.1 Data

A general file gains one optional field, exactly as the predecessor's §7
specifies:

```
trip.data.files[] → { …existing meta…, expenseRef: "e_7k2m9x" }
```

No new store, no change to `attachmentService.js`, no new Storage path, no
migration.

### 6.2 `buildFileGroups` — an optional third argument

`src/utils/tripFiles.js:86`. The function has **four call sites**
(`TripOverviewView.jsx:465`, `TripOverviewDesktop.jsx:182`,
`TripFilesSheet.jsx:29`, plus tests). Changing its arity would break all of
them, so:

```
buildFileGroups(tripData, files, budgetItems = [])
```

- The third argument is **optional and only supplies row subtitles** (the
  expense's label and amount). Grouping itself is decided purely by
  `file.expenseRef`, so every existing call site keeps working unchanged and
  simply renders no subtitle.
- New group: `{ key: "finance", title: "קבלות ותשלומים", day: null, items: [...] }`.
- **Order: `general` → `finance` → `day-1` … `day-N`.** The two non-day groups
  stay together at the top.
- A file with an `expenseRef` appears in `finance` **only**. The day-bucketing
  branch at `:96` must test `expenseRef` first, so a receipt filed under an
  expense never also shows under a day.
- `remapFileDays` (`:57`) must **skip** files carrying an `expenseRef` — their
  home is the expense, not a day. Without this guard, shortening a trip
  relocates a receipt away from the expense it documents.

### 6.3 What the group shows

Row layout is the shipped file row (`TripFilesSheet.jsx:118-135`), unchanged,
with one addition to the existing secondary line:

```
קבלות ותשלומים
📄  אישור הזמנה — מלון קיוטו
    248 KB · טיסה תל אביב–טוקיו · ₪4,000
```

The expense label and its `<Money>` amount append to the existing
`humanSize · stopName` sub-line, using the same `11.5px P.ink2` style.
Resolved from `budgetItems`; when the caller passes none, the sub-line is
unchanged from today.

Group header on the overview surfaces uses the existing
`12px/800 P.ink3` group title, with `<Icon name="paperclip" size={12} />`
preceding it.

### 6.4 Disclosure and states

| State | Behaviour |
|---|---|
| **No files carry an `expenseRef`** | The `finance` group **does not render at all** — no header, no empty line. This differs deliberately from `general`, which `TripFilesSheet.jsx:106` always renders (`g.items.length > 0 \|\| g.key === "general"`). An always-visible empty "קבלות ותשלומים" header on every trip in the product is precisely the hollow-indicator problem this phase exists to avoid |
| **Group has items** | Renders between `general` and the day groups |
| **Read-only viewer** | Rows open the viewer; no ✏️, no ⋯, no upload — the shipped `editable` gating already covers this |
| **Demo mode** | Session blobs with the `לא נשמר — מצב הדגמה` sub-label, exactly as today |
| **Viewer may not see the budget** (§4.5) | The group renders (a receipt is a file, and the file list is already shared), but **without** the expense label/amount subtitle. A file name is not a budget figure |

| Tier | Element |
|---|---|
| **Persistent** | The group, when non-empty |
| **One tap** | A row → `AttachmentViewer` (existing) |
| **Contextual** | `ניתוק מההוצאה` — only on `finance` rows, only when `editable` |
| **Buried** | `מחק` — bottom of the ⋯ menu, in `P.accent`, as today |

### 6.5 The row ⋯ menu on a finance row

`TripFilesSheet.jsx:149-165` currently offers `העבר ל… / כללי / יום N` for every
`kind: "general"` row, then `מחק`. On a `finance` row the day list is **wrong** —
the file's home is the expense.

Finance-row menu:

```
ניתוק מההוצאה        ← clears expenseRef; the file moves to כללי
─────────────────
מחק
```

`ניתוק מההוצאה` is not destructive and needs no confirm: nothing is deleted, the
file simply becomes general. This is the same "detach, never destroy" rule the
predecessor's §4 applies to expenses themselves.

Deleting an **expense** that has files still detaches them to כללי with a Tier-1
confirm — that behaviour is specified in the predecessor's §4/§5 and its wording
already lives in `budgetImpact`'s contract. Phase C only has to make sure the
`finance` group empties correctly when the last receipt is detached.

### 6.6 How a file gets an `expenseRef` in the first place

**Scope note — the phase table understates this.** §10 row C says
*"`expenseRef` files + the 'קבלות ותשלומים' group"*, and §7 describes only the
group and a 📎 count. But a group that nothing can populate is dead UI, so
Phase C must also ship the entry point:

`ExpenseSheet` (`src/components/ExpenseSheet.jsx`) gains one row above its
footer:

| State | Row content |
|---|---|
| no files | `[ 📎 צירוף קבלה ]` — ghost button, `minHeight: 44`, opens the native picker via the existing `attachmentService` |
| has files | `📎 2 קבצים` + the file labels as tappable rows opening `AttachmentViewer`, each with a `הסרה` affordance |
| uploading | button disabled, label `מעלה…` |
| upload error | inline `role="alert"`: `העלאת הקובץ נכשלה.` in `P.danger` |
| new (unsaved) expense | the row is **disabled** with caption `אפשר לצרף קבלה אחרי שמירת ההוצאה.` — a file cannot reference an id that doesn't exist yet |
| read-only | the row shows existing files, no attach, no remove |

`ExpenseRow` (`src/components/ExpenseRow.jsx:86-92`) gains a fourth chip in its
existing chip row, beside `categoryLabel` / `dayLabel` / `שולם`:

```
<Icon name="paperclip" size={11} /> 2
```

Non-interactive (`aria-label="2 קבצים מצורפים"`), same `chip` style already
defined at `:44`. The row already opens the edit sheet on tap; a second target
inside it would violate the 44px rule in a 20px chip.

---

## 7. New `Icon.jsx` glyphs

`Icon.jsx` ships 52 glyphs; two are missing and **no emoji fallback is
acceptable** (`DESIGN.md` — emoji-as-iconography is explicitly temporary).

| Name | Used by | Shape (Lucide-style, `viewBox="0 0 24 24"`, stroke `currentColor`) |
|---|---|---|
| `alertTriangle` | Over-budget marking on the overview card, the `MapCard` line, and the overrun toast | `<path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />` |
| `paperclip` | Receipt count on `ExpenseRow`, the `finance` group header, the `ExpenseSheet` attach row | `<path d="M21.4 11.05 12.25 20.2a5.5 5.5 0 0 1-7.78-7.78l9.19-9.19a3.67 3.67 0 0 1 5.18 5.18l-9.2 9.19a1.83 1.83 0 0 1-2.59-2.59l8.49-8.48" />` |

Both are direction-neutral under `dir="rtl"` — no mirroring check needed.

**No third glyph.** The budget card header uses the existing `barChart`; the
editor chip keeps its literal `₪`, which is a currency sign rather than emoji
iconography and is the most universally understood affordance available for
that control.

---

## 8. What gets deleted

A redesign that only adds has failed. Phase C removes:

1. **`src/components/ShareSheet.jsx` — the whole file, 210 lines.** Not imported
   anywhere (§4.1). It hard-codes a light-only palette (`T` at `:18-23`), still
   writes the deprecated `collaborators` column via
   `saveTrip(id, { collaborators })` — which `tripPatchToRow:77` explicitly no
   longer maps — and duplicates `SharePermissionsModal`'s entire job with worse
   accessibility. Keeping a dead second share sheet around while adding a
   *third* concept (budget visibility) to the live one is how the two drift.
2. **The `expenseRef` day branch that would otherwise exist.** Receipts are
   never offered a day, in `buildFileGroups`, in `remapFileDays`, or in the row
   ⋯ menu. Three code paths that never have to consider a case.
3. **The proposed fourth wizard step** (§5.1) — deleted from the plan before it
   was built, along with the four gating expressions it would have touched.
4. **`aria-modal` is not added anywhere in this phase.** The predecessor's
   T-BUDGET-22 notes it was deliberately removed rather than left inaccurate.
   Phase C adds no new overlay, so it adds no new focus-trap debt. The switch,
   the card and the group are all in-flow.

Explicitly **not** deleted: the `ACCENT` module constants in
`TripOverviewView` / `TripOverviewDesktop`, and `MapCard`'s local `LIGHT`/`DARK`
tables. Both are pre-existing conventions; new code doesn't extend them (§1.6,
§2.5), but ripping them out is unrelated risk in a money-bearing diff.

---

## 9. Addendum — the editor ₪ chip badge

`EditorDesktop.jsx:912` carries the comment *"No badge yet (Phase C wires a live
spent/total indicator here)"*. The §10 phase table doesn't list it. Including it
here so it isn't orphaned between phases.

| Layout | File | Today | Phase C |
|---|---|---|---|
| Mobile | `EditorView.jsx:3464-3477` | 44px circular `₪` button | Adds a badge, mirroring the files button's count badge at `:3450-3454`: `insetInlineStart: -3, top: -3`, `background: T.accent` / `#C0392B` when over, content `65%` or `!` when over |
| Desktop | `EditorDesktop.jsx:917-928` | Pill `₪ תקציב` | Becomes `₪ ₪9,800 / 15,000`, `tabular-nums`; when over: `border: 1px solid #C0392B`, `color: #C0392B`, and the label becomes `₪ חריגה ₪800` |

Both read `rollup(trip?.data?.budget)`. **Both render nothing extra when
`!hasBudget` or when the viewer may not see the budget (§4.5)** — the chip
itself stays (it is the quick-add entry point) but carries no figure.

Both editors are light-only by design; the badge follows their local `T`
constants, not `useDarkMode()`. Same reasoning as §5.6.

---

## 10. Migration risk

| Risk | Why it could break | Guard |
|---|---|---|
| **`settings` full-replace on the toggle write** | `tripPatchToRow:80` assigns `row.settings = patch.settings`. A patch of `{ settings: { budgetShared } }` destroys `destination`, `center`, `days`, `cityRanges`, `startDate` — silently, on a live trip | T-BUDGET-42. Must spread the loaded `trip.settings` |
| **`buildFileGroups` arity** | Four call sites + tests | Third arg optional, defaulted `[]`. T-BUDGET-51 asserts the two-arg form is byte-identical to today |
| **A receipt relocated by a day renumber** | `remapFileDays` currently moves any file with a `day` | `expenseRef` files skip the remap. T-BUDGET-52 |
| **The dashboard indicator reading `data`** | `data` is stripped in both persistence paths before the grid renders; a `rollup()` call there returns zeros, not an error — a **silent wrong number** | T-BUDGET-38 asserts against `budgetSummary` only, with `data` absent |
| **Toast storms** | A watcher on `rollup()` output re-firing on every render, or on mount for an already-over trip | The ref seeds from the first observed value; localStorage suppresses repeats. T-BUDGET-40, T-BUDGET-41 |
| **A collaborator seeing figures via the direct URL** | `/trip/budget/:tripId` resolves for anyone RLS lets read the trip | §4.7 guard. T-BUDGET-45. Note this is a curtain, not protection (§4.8) |
| **The public gallery leaking a budget** | `/g/:tripId` renders trip content | No budget component is imported on that route, under any flag value. T-BUDGET-46 |
| **`createNewTrip` regression** | The wizard's most load-bearing call | `budgetIlsMinor` optional; absent → **no `budget` key written at all**. T-BUDGET-49 asserts a wizard trip with no budget has `data.budget === undefined` |
| **`SummaryCard` without `onEdit`** | It currently always renders the edit pill | Make `onEdit` optional. T-BUDGET-48 |

Regression tests to add (`qa`, following the `T-FILES` / `T-BUDGET` convention;
Phase B ended at **T-BUDGET-35**, so Phase C is **T-BUDGET-36..55**):

| ID | Pri | Case |
|---|---|---|
| T-BUDGET-36 | P0 | Overview card, all five states (`none` / `noTarget` / `onTrack` / `nearCap` / `over`), mobile + desktop |
| T-BUDGET-37 | P0 | Overview card tap → `/trip/budget/:id`; back returns to the overview, not the dashboard |
| T-BUDGET-38 | P0 | Dashboard indicator renders from `budgetSummary` with `data` absent; hidden when `budgetSummary` is null or `pct` is null |
| T-BUDGET-39 | P1 | Dashboard indicator over-budget state reads as **text** (`חריגה`), asserted without colour |
| T-BUDGET-40 | P0 | Crossing 100% in-session fires the toast exactly once; opening an already-over trip fires nothing |
| T-BUDGET-41 | P1 | Going back under budget re-arms the toast; a second crossing fires again |
| T-BUDGET-42 | **P0** | Toggling `budgetShared` preserves every other `settings` key (assert `destination`, `days`, `cityRanges`, `startDate` after the write) |
| T-BUDGET-43 | P0 | Collaborator, flag off: no dashboard indicator, no overview section, no editor chip figure |
| T-BUDGET-44 | P0 | Collaborator `edit`, flag on: full budget screen, writable |
| T-BUDGET-45 | P0 | Collaborator, flag off, direct `/trip/budget/:id`: blocked state renders, **no figures in the DOM** |
| T-BUDGET-46 | **P0** | `/g/:tripId` renders no budget with the flag both off and on |
| T-BUDGET-47 | P1 | Turning the flag off with collaborators present shows the Tier-2 line, no dialog, no data change |
| T-BUDGET-48 | P1 | Wizard budget card: empty is valid and never blocks the CTA; invalid input shows the error and still doesn't block |
| T-BUDGET-49 | **P0** | Wizard with no budget entered → created trip has no `data.budget` key at all |
| T-BUDGET-50 | P0 | Wizard with `15000` → created trip's `data.budget.summary` is present on first dashboard render |
| T-BUDGET-51 | P0 | `buildFileGroups(tripData, files)` (two args) output identical to pre-change |
| T-BUDGET-52 | P0 | A file with `expenseRef` survives a day renumber unmoved, and never appears under a day group |
| T-BUDGET-53 | P1 | `finance` group absent when no file carries an `expenseRef`; present and correctly ordered (`general → finance → days`) when one does |
| T-BUDGET-54 | P1 | Detaching a receipt (`ניתוק מההוצאה`) moves it to כללי, deletes nothing |
| T-BUDGET-55 | P1 | RTL + dark mode + 44px pass on: overview card, dashboard line, the switch, the wizard card, the finance group. Contrast check on `P.danger` `#E0573F` on dark `panel` |

Gates unchanged: `npm run critical` stays 9/9 · `CI=true npm test -- --watchAll=false`
· `npm run test:api` unaffected · CI build with no new warnings.

---

## 11. Open decisions for the team

Only genuinely unresolved items. Everything else in this document is decided.

1. **Does `budgetShared: true` grant an `edit`-role collaborator *write* access
   to the budget, or read-only?** (§4.9) — *Recommendation: write, same rights as
   the itinerary.* Separate money permissions are a permissions model, not a
   visibility switch, and belong with the v2 RLS work.
2. **Should `settings.budgetShared` default to `true` for trips that already
   have collaborators?** Nothing is shared today, so `false` is not a
   regression for anyone. But an owner who has already invited three people and
   then sets a budget will not understand why they can't see it.
   *Recommendation: keep the default `false` universally, and show a one-time
   Tier-2 line inside `BudgetSetupSheet` on the first save when the trip has
   collaborators: `השותפים לא רואים את התקציב. אפשר לשתף מתפריט השיתוף.`* The
   alternative — defaulting to shared — makes finances visible to third parties
   as a side effect of a setting the owner never touched, which is the wrong
   direction to be wrong in.
3. **Is `85%` the right `nearCap` threshold?** It is a guess, not a measured
   number. It is a single constant in `budget.js` and costs nothing to change
   once real budgets exist. Flagged so it doesn't calcify by accident.

### Decided here, contradicting the predecessor — stated out loud

| Predecessor | This spec | Reason |
|---|---|---|
| §6: toggle lives in `ShareSheet.jsx` | `SharePermissionsModal.jsx`; `ShareSheet.jsx` is deleted | `ShareSheet` is dead code — the toggle would have been invisible (§4.1) |
| §8.3 #1: wizard gets an optional **step** | A fourth `SummaryCard` on the existing summary screen | Zero added steps, zero added pips, genuinely free to skip (§5.1) |
| §8.4: "the three indicator surfaces" implies all are tappable | The dashboard indicator is **not** interactive | 20px line inside an already-clickable card; 44px target integrity (§2.4) |
| §7: Phase C ships the group and a 📎 count | Phase C also ships the `ExpenseSheet` attach entry point | A group nothing can populate is dead UI (§6.6) |
| §8.4: over-budget "fires a toast" | The toast carries an action but **no undo** | It reports a state, not a reversible action (§3.3) |
