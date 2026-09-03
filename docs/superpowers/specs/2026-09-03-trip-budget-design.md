# Trip budget — plan a budget, price every item, see if you're within it

**Date:** 2026-09-03
**Status:** Draft — pending review
**Branch:** `saas-builder-local`
**Owner agents:** `budget-domain` (money model / math / rollups — NEW), `builder` (screens + sheets), `copywriter` (Hebrew microcopy, confirm wording), `ui-impeccable` (design-system pass), `qa` (tests + `T-BUDGET` plan)

## Problem

A traveller plans a 10-day trip in Maslul and has no way to answer the only
financial question that matters: **"can I afford this itinerary?"**

Today the trip record carries a single vestigial trace of the idea — a freeform
string field on the Japan sample days:

```js
expenses: { accommodation: "855 ₪", highlights: "סושי זנמאי, ראמן אפורי" }
```

It is display-only text on a read-only example trip. Nothing sums it, nothing
compares it to a target, nothing is editable. Users fall back to the exact tool
Maslul exists to replace: a second spreadsheet next to the map.

## Goals

1. **Set a target budget** for a trip, optionally allocated across categories.
2. **Attach a cost to anything** — a stop on the map, or a standalone line item
   (flight, insurance, rail pass) that has no place on the map.
3. **Answer "am I within budget?"** at a glance, from every surface the user
   already visits — without opening a dedicated screen.
4. **One screen that centralises every expense** for viewing and editing, in the
   spirit of the existing Trip Files gallery.
5. **Track what was actually paid** without doubling data entry.
6. **Attach payment confirmations / receipts** to an expense, surfaced in the
   existing Files gallery.
7. **Never silently lose money data**, and never silently change a number the
   user already committed to.

## Non-goals (v1)

- **Cost splitting between travellers.** Explicitly deferred by the owner.
- **Automatic estimation.** Parked for v2. Direction when it lands: a static
  per-country cost table (`data/travelCosts.js`, deterministic, no API cost)
  for the skeleton (lodging/food/intercity), optionally plus a per-stop price
  estimate from the existing `generate-trip` pipeline. Not designed here.
- **Multiple foreign currencies in one trip** (Japan + Dubai on one trip).
- **Per-item FX-rate snapshots** (see the v1 limitation in §1.4).
- **Real DB-level privacy for the budget.** Sharing is a client-side curtain in
  v1 — with UI wording that does not overclaim (§6).
- **Cross-trip spend analytics.**
- **Refunds / negative amounts.**
- **CSV export.**
- No new Supabase table, column, RLS policy, or migration. See §0.

---

## 0. Persistence decision — stay inside the existing JSONB

DB changes were **not** ruled out by the owner; this is a recommendation made on
the merits.

**The budget lives in the trip record's existing JSONB payload.** No migration.

Why not a dedicated `trip_budgets` / `trip_expenses` table:

1. **Coherence.** The itinerary itself is already persisted as one whole `data`
   blob on every editor mutation (`useEditorState.jsx:55,70` →
   `tripService.saveTrip(id, { data })`). A transactional budget table beside a
   blob-written itinerary creates a split consistency model where there is
   currently one.
2. **It would not fix concurrent editing.** Two collaborators editing the same
   trip already last-write-wins on the itinerary. Moving the budget to a table
   would not change that; it would only make the *budget* safe while the
   itinerary around it stays clobber-prone.
3. **RLS risk is this repo's documented failure mode.** A new SELECT policy that
   subqueries `trips` is precisely the shape that produced
   `"infinite recursion detected in policy for relation trips"` — the incident
   behind the three-level fallback cascade in `tripService.fetchAllTrips` and
   behind `db/migrations/supabase_migration_fix_trips_rls.sql`. That is real risk
   on a live product, bought in exchange for a benefit the owner has classified
   as not required for v1.
4. **Precedent.** The Trip Files gallery shipped the same way (`trip.data.files[]`,
   no schema or RLS change) and is in production.

**Migration path stays clean.** `budget` is one self-contained object with no
foreign references into the itinerary except stable stop ids. Lifting it to a
table in v2 is mechanical.

**The honesty debt is paid in wording, not schema.** See §6.

---

## 1. Data model

### 1.1 Shape

The split between `settings` and `data` is deliberate. `tripService.toSummary`
(`tripService.js:262`) strips `data` from every row in the dashboard list, so
anything the dashboard grid must render has to live in `settings`.

```js
/* ── settings: light metadata, survives toSummary ── */
trip.settings.budgetShared  = false;          // sharing curtain (§6)
trip.settings.budgetSummary = {               // dashboard mini-indicator ONLY
  totalIlsMinor:     1500000,
  effectiveIlsMinor:  980000,
  pct:                    65,
  over:                false,
};

/* ── data: the heavy payload ── */
trip.data.budget = {
  config: {
    currency:      "JPY",                     // the destination currency
    rate:          0.023,                     // local → ILS, manual
    rateUpdatedAt: "2026-09-03T09:14:00.000Z",
    totalIlsMinor: 1500000,                   // the headline budget, in ILS agorot
    categories: [
      { key: "flights",  label: "טיסות", capIlsMinor: 400000 },
      { key: "lodging",  label: "לינה",  capIlsMinor: 500000 },
      { key: "food",     label: "אוכל",  capIlsMinor: 200000 },
      { key: "c_a1b2c3", label: "מזכרות לילדים", capIlsMinor: null, custom: true },
    ],
  },
  items: [
    { id: "e_7k2m9x", label: "טיסה תל אביב–טוקיו", amountMinor: 400000,
      currency: "ILS", category: "flights", paid: true,
      actualMinor: null, note: "", createdAt: "…" },

    { id: "e_3p8q1z", label: "ראמן אפורי", amountMinor: 120000,
      currency: "JPY", category: "food", stopRef: "s_4f8c2a", paid: true,
      actualMinor: 135000, note: "", createdAt: "…" },

    { id: "e_9w4e2r", label: "ביטוח נסיעות", amountMinor: 32000,
      currency: "ILS", category: "insurance", dayRef: null, paid: false,
      actualMinor: null, note: "", createdAt: "…" },
  ],
};
```

### 1.2 Two allowed currencies per item, one shared rate

This is **not** "a currency per item with its own rate" (rejected as too much
data entry). Each item is denominated in either the trip currency **or** ILS,
and one manual `config.rate` converts between them.

This distinction is load-bearing, not a nicety: **the ₪4,000 flight was bought
in Israel in shekels**, while the ¥1,200 bowl of ramen was not. Without a
per-item currency flag, every domestically-purchased expense would be forced
through a pointless conversion and shown as a wrong local-currency figure.

The **total budget and every category cap are always in ILS**, because that is
the currency the user's budget actually exists in.

### 1.3 Money is integers in minor units

Every amount is an integer in the currency's minor unit (`amountMinor`,
`actualMinor`, `totalIlsMinor`, `capIlsMinor`). **No floats anywhere** — floats
accumulate rounding drift across a sum, and this is money.

Zero-decimal currencies (JPY, KRW) need a per-currency exponent map:
`MINOR_DIGITS = { ILS: 2, JPY: 0, EUR: 2, USD: 2, AED: 2, GBP: 2, THB: 2, KRW: 0 }`.
Formatting and parsing both consult it. `¥1,200` is `amountMinor: 1200`, not
`120000`.

### 1.4 Known v1 limitation — retroactive revaluation

Changing `config.rate` re-values every local-currency item, **including ones
already marked paid**. For forward planning this is correct. For historical
accuracy it is not: money spent last Tuesday was spent at last Tuesday's rate.

The fix (a `rateAtEntry` snapshot stamped on each item at the moment it is
marked paid) is deferred to v2. In v1 this is mitigated, not hidden:
`rateUpdatedAt` is displayed next to the rate, and changing the rate while paid
items exist raises a **blocking confirmation that names the resulting change in
the "actual" total** (§5, Tier 1).

### 1.5 `stopRef` is a stable id, never an index

Stops are currently addressed positionally — `deleteStopAt(dayNum, idx)`
(`useEditorState.jsx:105`), `reorderInDay`, `moveStopToDay`, `duplicateStopAt`.
An index-based reference would break on every one of those operations.

**When a cost is attached to a stop that has no `_id`, stamp one**
(`s_` + 6 chars). Only stops that carry money get an id — no migration, no bulk
rewrite of `tripData`, no change to any stop that never gets priced.

### 1.6 `dayRef` is stored only for unlinked items

For an item with a `stopRef`, the day is **derived at read time** by locating
the stop in `tripData`. It is never stored. This eliminates an entire class of
drift: moving a stop between days requires no budget write at all.

`dayRef` is stored only for standalone items that the user chose to file under a
day. This mirrors the existing signature `buildFileGroups(tripData, files)`,
which likewise resolves grouping from both sources at read time.

### 1.7 Category taxonomy

Eight base categories, plus user-defined ones:

| key | label |
|---|---|
| `flights` | טיסות |
| `lodging` | לינה |
| `transport` | תחבורה |
| `food` | אוכל |
| `attractions` | אטרקציות ופעילויות |
| `shopping` | קניות |
| `insurance` | ביטוח |
| `other` | אחר |

Custom categories get `key: "c_<6 chars>"` and `custom: true`, and live in the
same `config.categories` array that holds the caps. A category with
`capIlsMinor: null` still appears in the breakdown — it simply has no ceiling.

---

## 2. Logic layer — `src/utils/budget.js`

A pure module, in the exact pattern of `src/utils/tripFiles.js`: plain data
transforms, no React, no Supabase.

| Export | Responsibility |
|---|---|
| `newExpenseId()` | id, in the style of `newFileId()` |
| `BASE_CATEGORIES` | the eight above |
| `MINOR_DIGITS` | per-currency exponent map (§1.3) |
| `guessCategory(stopCategory)` | Hebrew stop category → budget category |
| `toIlsMinor(item, config)` | the single conversion point |
| `rollup(budget, tripData)` | **the selector** — every number, every surface |
| `addExpense / updateExpense / removeExpense(data, …)` | signatures mirroring `addGeneralFile`: take `trip.data`, return a new `data` |
| `setPaid(data, id, { actualMinor })` | the paid / actual transition |
| `remapExpenseDays(items, mapping, newDayCount)` | mirror of `remapFileDays` |
| `detachStopExpenses(items, stopId)` | on stop removal (§4) |
| `budgetImpact(action, trip)` | the single source for confirmation tier + copy + numbers (§5) |
| `summarize(budget, tripData)` | produces `settings.budgetSummary` |

### 2.1 Three numbers, not two

This is what makes planned-vs-actual work:

| Number | Definition |
|---|---|
| **מתוכנן** (planned) | Σ `amountMinor` over **all** items |
| **בפועל** (actual) | Σ (`actualMinor ?? amountMinor`) over items where `paid === true` |
| **צפי נוכחי** (effective) | per item: `paid ? (actualMinor ?? amountMinor) : amountMinor`, summed |

**The main budget bar compares *effective* to the total**, because effective is
the honest answer to "where will I land, given what I have already actually
paid." Planned and actual are shown beside it as two supporting figures.

`rollup()` returns:

```js
{
  plannedIlsMinor, actualIlsMinor, effectiveIlsMinor,
  remainingIlsMinor,            // total - effective  (negative ⇒ over)
  pct,                          // effective / total, clamped for display
  overBudget,                   // effective > total
  unallocatedIlsMinor,          // total - Σ capIlsMinor
  byCategory: [ { key, label, capIlsMinor, plannedIlsMinor, actualIlsMinor,
                  effectiveIlsMinor, pct, over, itemCount } ],
}
```

### 2.2 `guessCategory` — the exact repeat-risk from the WORKLOG

The AI-focus feature shipped a bug where **every English-only unit test passed**
while the feature never rendered in production: the Places SDK loads with
`language=he`, predictions came back in Hebrew, and an English-only matcher
returned `null` every time (`WORKLOG.md`, 2026-09-02; fixed in `f2eefeb`).

`guessCategory`'s input is the **Hebrew** `attraction.category` field. Real
values from `src/data/tripData.js` include:
`"רחוב"`, `"ראמן"`, `"בית קפה"`, `"מקדש"`, `"מוזיאון"`, `"סושי"`, `"קניות"`,
`"מעבר חציה"`, `"ארקיד משחקים"`, `"פארק"`, `"מלון"`, `"אטרקציה"`, `"מסעדה"`.

Mapping: food-ish (`מסעדה`, `ראמן`, `סושי`, `בית קפה`, `קפה`, `בר`, `אוכל`) →
`food`; `מלון`/`לינה`/`אכסניה` → `lodging`; `קניות` → `shopping`; everything
else → `attractions`. Always overridable in the UI.

**Its tests must use these Hebrew strings verbatim, sourced from `tripData.js`.**
Not translations. This is a named regression risk, not a style preference.

---

## 3. Service layer

### 3.1 The recompute belongs in `saveTrip`, not only in `saveBudget`

An earlier draft put the `budgetSummary` recompute inside a new
`tripService.saveBudget()`. **That leaks.** Detaching an expense during a stop
deletion is written through the *generic* path
`saveTrip(prev.id, { data: nextData })` (`useEditorState.jsx:70`) — which would
skip the recompute and leave the dashboard card displaying a stale figure.

**Therefore:** `tripService.saveTrip` recomputes `settings.budgetSummary` from
`rollup()` whenever the incoming patch contains `data.budget`. The choke point
is then airtight regardless of which call site produced the write.

`tripService.saveBudget(tripId, budget)` remains as a thin convenience over it
(in the shape of the existing `saveTripMemo`, `tripService.js:478`), centralising
the Supabase/localStorage branch and the `readOnly` guard.

### 3.2 `useBudget(trip)`

One hook. Calls `rollup()`, exposes mutators that write through `saveBudget`.
All four entry points and all three indicator surfaces consume it, so no surface
can compute a different answer than another.

The dashboard grid is the deliberate exception: it reads
`settings.budgetSummary` only, never `data`, because `toSummary` has already
stripped `data` by the time it renders.

---

## 4. Lifecycle — where this would otherwise break

The governing principle, inherited from the existing data-safety layer
(`rescueOrphansToInbox`, "Sprint 27 #4"): **money the user entered is never
silently destroyed.** Broken links detach; they do not delete.

| Event | Behaviour |
|---|---|
| **Stop deleted** | The expense is **detached**, not deleted: clear `stopRef`, keep label + amount, it becomes a general expense. Toast: the expense was kept under "כללי" |
| **Stop moved to another day** | No budget write at all — the day is derived (§1.6) |
| **Stop duplicated** (`duplicateStopAt`) | **The copy must not inherit `_id`.** Two stops sharing an id would make the expense resolve ambiguously to both. Subtle and critical |
| **Stop moved to the Places Inbox** (`moveStopToInbox`) | Detach, as for deletion |
| **Days renumbered / trip shortened** (`applySkeleton`, `applyDateRange`) | `remapExpenseDays` called alongside `remapFileDays` (`useEditorState.jsx:378,428`). Unlinked items only; a removed day falls back to `dayRef: null` (general), exactly as `remapFileDays` does for files |
| **Trip currency changed with items present** | Never silently. Confirm, then **convert amounts so the ILS values stay stable** — the user's budget must not jump because they touched a setting. Explicitly: for each item in the old trip currency, `amountMinor' = round(amountMinor × rateOld ÷ rateNew)`, re-quantised to the new currency's `MINOR_DIGITS`. ILS-denominated items are untouched |
| **Exchange rate changed** | Retroactive revaluation (§1.4). Blocking confirm naming the change to the actual total |
| **Category deleted while holding expenses** | Confirm, then reassign to `other`. Never orphan |
| **Expense deleted while holding files** | Confirm; its files **detach to "כללי"** rather than being destroyed (§7) |
| **`readOnly` trip** (the Japan sample) | Budget is viewable, not editable. The legacy freeform `expenses` field is **not migrated** — it is read-only sample text and stays as-is |
| **Two collaborators editing at once** | Last-write-wins, inherited from existing itinerary behaviour. Documented, not solved in v1 |
| **No budget set** | No surface renders anything. Not a zero bar — only the "set budget" CTA |
| **Input validation** | Positive integers only; parsed against `MINOR_DIGITS`; non-numeric rejected; refunds/negatives are v2 |

---

## 5. Confirmation questions — one rule, two tiers

Requested by the owner ("adding a day should warn that the budget will change,
and the user should acknowledge it"). Implemented as a rule rather than as
dialogs sprinkled per call site, because dialog fatigue makes every confirm
worthless — including the ones that matter.

> **Confirm when the *linkage* changes. Inform when only the *picture* changes.**

Every Tier-1 confirmation **must state concrete numbers**. A generic
"are you sure?" is forbidden — it conveys nothing and trains dismissal.

`budgetImpact(action, trip)` in `budget.js` is the single source of the tier, the
wording, and the numbers, so all six-plus call sites stay consistent and are
testable in one place.

### Tier 1 — blocking confirmation (linkage or committed numbers change)

| Trigger | Example wording |
|---|---|
| Shortening the date range / deleting a day that holds expenses | "ליום 8 משויכות 3 הוצאות בסך ₪1,200. הן יעברו ל'כללי' ולא יימחקו. להמשיך?" |
| Deleting a stop that carries a cost | "לעצירה זו משויכת הוצאה של ₪800. היא תעבור ל'כללי'." |
| Changing the trip currency with items present | "יש 14 הוצאות ב־¥. הסכומים יומרו כך שערכי ה־₪ יישארו זהים." |
| Changing the rate while paid items exist | "עדכון השער יעריך מחדש 12 הוצאות ששולמו. 'בפועל' ישתנה מ־₪4,100 ל־₪4,260." |
| Deleting a category holding expenses | "ל'לינה' משויכות 5 הוצאות. הן יעברו ל'אחר'." |
| Deleting an expense that has files | "להוצאה מצורפים 2 קבצים. הם יעברו ל'כללי'." |

**No "don't show this again" option on Tier 1** — an acknowledgement the user can
switch off is not an acknowledgement.

### Tier 2 — passive notice (only the outlook changes)

| Trigger | Treatment |
|---|---|
| **A day was added** (the owner's example) | Dismissible inline notice / toast: "נוסף יום 8 — התקציב לא עודכן. להוסיף הוצאות?" with a link to the budget screen. **Deliberately not a dialog:** adding a day touches no existing data, so a blocking confirm would be pure friction |
| Total budget lowered below current spend | No dialog. The bar simply flips to the over-budget state — that is the indicator's job |
| A category cap lowered below its spend | Same |
| Budget sharing switched off with an active collaborator | Passive notice only |

Tier 2 notices may be dismissed per trip. Tier 2 must never block a flow.

---

## 6. Sharing — a curtain, described as a curtain

`trip.settings.budgetShared`, default `false`, toggled from
`src/components/ShareSheet.jsx`, changeable at any time.

With the flag off, a collaborator sees no budget card, no editor chip, and no
route. RLS hands collaborators the whole trip row, so **this is presentation, not
protection** — someone determined, with devtools, can read the JSONB.

**Therefore the UI must not overclaim.** The toggle reads
**"הצג תקציב לשותפים"** — a visibility switch. It must not be labelled
"פרטי", "מוסתר", or "לא משותף", and no help text may promise secrecy. When v2
moves the budget to its own table with its own RLS, the promise can be upgraded
along with the mechanism.

**Hard rule, independent of the flag: the public gallery (`/g/:tripId`) never
renders the budget.** `budgetShared` governs person-to-person collaborators
only. A published gallery map must never expose its owner's finances.

---

## 7. Files on an expense

Requested: attach payment confirmations to an expense, grouped under a financial
folder in the Files gallery.

**Reuse the existing gallery rather than building a second store.** A general
file gains an optional link field:

```js
trip.data.files[] → { …existing meta…, expenseRef: "e_7k2m9x" }
```

- `buildFileGroups(tripData, files)` in `src/utils/tripFiles.js` gains a third
  group alongside "כללי" and "יום N": **"קבלות ותשלומים"**, collecting every file
  with an `expenseRef`. Group key `finance`. **Order: `general` → `finance` → the
  day groups**, so the two non-day groups stay together at the top. A file with an
  `expenseRef` appears in `finance` only — never also under a day. (Owner said
  "פיננסי או משהו כזה" — the final label is `copywriter`'s call in Phase D.)
- `src/services/attachmentService.js` is untouched. Same upload, same Storage
  path, same permanent-delete semantics. **Zero new storage work.**
- The expense row on the budget screen shows a 📎 count and opens the existing
  `AttachmentViewer`.
- **`remapFileDays` must skip files carrying an `expenseRef`** — their home is
  the expense, not a day. Without this guard a day renumber would relocate a
  receipt away from the expense it documents.
- Deleting an expense **detaches** its files to "כללי" (§4). Same data-safety
  rule as expenses themselves.
- Demo mode keeps working: session blobs, exactly as the files gallery does today.

---

## 8. UI surfaces

### 8.1 The dedicated screen — `/trip/budget/:tripId`

New route under `ProtectedRoute`, beside `/trip/overview/:tripId`
(`src/App.jsx:142`). Mobile and desktop split follows the existing
`TripOverviewView` / `TripOverviewDesktop` pattern.

```
┌─ תקציב · ירח דבש ביפן ──────────────────┐
│   ₪ 9,800  מתוך  ₪ 15,000               │  ← effective vs total
│   ▓▓▓▓▓▓▓▓▓▓▓░░░░░░  65%                │
│   נותרו ₪ 5,200                          │
│   מתוכנן ₪ 12,400 · בפועל ₪ 4,100        │
│   הוקצה ₪ 12,000 · לא מוקצה ₪ 3,000      │
├──────────────────────────────────────────┤
│  [לפי קטגוריה]   לפי יום                 │
├──────────────────────────────────────────┤
│  ✈️ טיסות            ₪4,000 / ₪4,000  ▓▓ │
│     └ טיסה תל אביב–טוקיו  ₪4,000  ✓  📎2 │
│  🍜 אוכל             ₪2,200 / ₪2,000  ▓▓!│  ← category over
│     └ ראמן אפורי          ¥1,200  ✓      │
├──────────────────────────────────────────┤
│              [ + הוסף הוצאה ]             │
└──────────────────────────────────────────┘
```

Default grouping is **by category** (caps live there); a secondary toggle
switches to **by day**. An expense row shows: label · amount in its entry
currency with the ILS equivalent as secondary · paid ✓ · day badge · linked-stop
link · attachment count. Tapping opens the edit sheet.

Empty state: "עוד לא הגדרת תקציב לטיול" + CTA — this is entry point #3.

### 8.2 The paid → actual flow

Tapping ✓ opens an inline prompt, not a modal:

> **שולם ✓** · האם העלות הייתה שונה?  `[כן]`  `[לא, אותו סכום]`

`לא` closes; `actualMinor` stays `null`. `כן` reveals one numeric field (with the
same currency selector) saved in a tap. Un-checking clears both. **No double
entry in the default path** — this is the owner's synthesis of one-amount
simplicity with planned-vs-actual precision.

### 8.3 The four entry points

| # | Surface | Implementation |
|---|---|---|
| 1 | **Wizard** `/create` | Optional step, skippable in one tap: total + currency + rate. "אפשר גם אחר כך" |
| 2 | **Trip overview** | A "תקציב" card in `TripOverviewView.jsx` + `TripOverviewDesktop.jsx`, beside the files entry (`TripOverviewView.jsx:543`) |
| 3 | **The budget screen itself** | Empty state with "הגדר תקציב" |
| 4 | **Editor** | A ₪ chip beside the 🗂️ files entry (`EditorView.jsx:4504`, `EditorDesktop.jsx:1459`) opening a **quick-add** sheet only — never leaving the map |

**Per-stop quick cost** goes into `src/components/StopActionsSheet.jsx`, the
existing per-stop action menu, as "הוסף עלות". Category is pre-filled by
`guessCategory()` and always editable.

### 8.4 The three indicator surfaces + the alert

| Surface | Display | Source |
|---|---|---|
| Trip overview card | Full bar + "נותרו ₪5,200" / "חריגה של ₪800" | `rollup()` |
| Dashboard card (`MapCard.jsx`) | One thin line: "₪ 65% · בתקציב" | **`settings.budgetSummary` only** |
| Editor chip | "₪ 9,800 / 15,000" | `rollup()` |

Crossing 100% fires a one-time toast ("חרגת מהתקציב ב־₪800") **and** applies a
persistent marking: the bar in `danger` (`#C0392B`) plus a "חריגה" tag on all
three surfaces. Same treatment for a per-category overrun on its own row.

**Never colour alone.** Over-budget is always carried by text or an icon as well,
per WCAG 2.2 AA — a red bar is invisible to a colour-blind user and to a screen
reader.

### 8.5 Design-system compliance

- Tokens only, from `src/utils/theme.js` (`panel`, `surface`, `ink`–`ink4`,
  `line`, `accent` `#E0533F`, `danger` `#C0392B`). No hard-coded colours; dark
  mode via `useDarkMode()`.
- **Logical properties only** (`marginInlineEnd`, `insetInlineStart`). No
  `left`/`right` literals. Hebrew-first, RTL-native.
- Touch targets ≥ 44×44 px on the ✓ and every row action.
- `font-variant-numeric: tabular-nums` on **every** amount — DESIGN.md already
  mandates this for stats, and money in a right-aligned column needs it to stay
  readable.
- The bar is `role="progressbar"` with `aria-valuenow` / `aria-valuemin` /
  `aria-valuemax` and an `aria-label`.
- **The quick-add sheet must trap focus and close on `Esc`.** PRODUCT.md flags
  that several existing overlays do not; new ones will.
- Motion respects `prefers-reduced-motion`, per the existing guard in `index.css`.

---

## 9. Test plan

### Unit — `src/utils/budget.test.js`

The three numbers · two-currency conversion · **minor-unit integrity (assert
exact integers, never approximate equality)** · zero-decimal currency handling
(JPY) · category caps and overrun detection · unallocated remainder ·
`remapExpenseDays` · `detachStopExpenses` · `summarize` · `budgetImpact` tier
selection and numbers.

**`guessCategory` tests use the verbatim Hebrew category strings from
`src/data/tripData.js`.** See §2.2 — this is the exact class of bug that shipped
in the AI-focus feature.

### Component

The ✓ → "האם העלות הייתה שונה?" flow · empty state · category/day grouping
toggle · **over-budget state asserted as text, not only as colour** ·
`role="progressbar"` ARIA values · 44 px targets · focus trap + `Esc` on the
quick-add sheet · Tier-1 confirm renders concrete numbers.

### Service

`saveTrip` recomputes `budgetSummary` on **every** write path containing
`data.budget` (§3.1) · `saveBudget` convenience path · `readOnly` rejection ·
localStorage fallback with no Supabase session.

### Regression

Delete a stop → the expense is detached, not lost · duplicate a stop → no shared
`_id` · renumber days → unlinked expenses remap, linked ones are untouched ·
move a stop to the inbox → detach · a file with `expenseRef` survives a day
renumber unmoved.

### Gates

`npm run critical` stays 9/9 (the SEV1 gate) · `CI=true npm test -- --watchAll=false`
· `npm run test:api` unaffected · CI build with no new warnings ·
`T-BUDGET-01..N` appended to `docs/QA-TEST-PLAN.md` following the existing
`T-FILES` / `T-FOCUS` convention · manual on-device pass for RTL and dark mode,
including a contrast check on the over-budget colours in **both** palettes.

---

## 10. Phasing

| Phase | Contents | Value delivered |
|---|---|---|
| **A — engine** | `budget.js` · `saveTrip` recompute + `saveBudget` · `useBudget` · route + dedicated screen · budget & category setup · expense CRUD · paid/actual flow | A budget can be planned and expenses managed end to end |
| **B — itinerary binding** | Per-stop cost in `StopActionsSheet` · stable `_id` stamping · editor chip + quick-add sheet · **the full lifecycle safety net** (detach / remap / duplicate / inbox) · Tier-1 confirmations | Money is bound to the itinerary without data loss |
| **C — visibility, sharing, files** | Overview card · dashboard indicator · overrun toast + marking · `ShareSheet` toggle · wizard step · `expenseRef` files + the "קבלות ותשלומים" group · Tier-2 notices | The feature is present across the product |
| **D — hardening** | `ui-impeccable` pass · `copywriter` over all microcopy and confirm wording · full `qa` + `T-BUDGET` · critical/build | Deploy-ready |

---

## 11. New team agent — `budget-domain`

Added to `.claude/agents/budget-domain.md` and to the CLAUDE.md agent table.

**Owns:** the `trip.data.budget` model · `src/utils/budget.js` and all money
arithmetic · currency conversion and rate handling · planned/actual
reconciliation · the category taxonomy · the airtightness of `budgetSummary` ·
consistency across the three indicator surfaces · the `budgetImpact` tier rules.

**Does not own:** general React components (`builder`) · microcopy
(`copywriter`) · design-system compliance (`ui-impeccable`) · tests (`qa`).

Modelled on `ai-engineer`, which owns one bounded subsystem with its own
invariants. Tools: Read, Grep, Glob, Bash, Write, Edit.
