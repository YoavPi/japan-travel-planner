# Mobile Stop-Card Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign the mobile itinerary stop card in `/map/edit/:tripId` so it surfaces cost, files, and note state that today are invisible, while closing UX-critique finding F1 (two divergent context menus) — without regressing the untested gesture plumbing (`SwipeableRow` ↔ drag-reorder) that runs the surface today.

**Architecture:** Extract the card (`renderPlaceRow`) and the transit connector (`TransitRail`) out of the 4,785-line, zero-Jest-coverage `EditorView.jsx` into two pure, testable components — first as a byte-for-byte behavioural no-op (Increment A), then redesign inside that tested shell (Increment B). A `P` (palette) prop is threaded everywhere but filled with the `LIGHT` literal from `src/utils/theme.js`; dark mode is wired, not switched on. Increment C (empty/loading states) is cheap and rides with B, with an explicit cut line if B runs long.

**Tech Stack:** React (function components, hooks), Jest + React Testing Library, no new dependencies.

**Spec:** [docs/superpowers/specs/2026-09-07-mobile-stop-card-redesign-design.md](../specs/2026-09-07-mobile-stop-card-redesign-design.md) — status **Decided 2026-09-11**, no open questions. This plan sequences and scopes that spec; it does not restate every token value. Where a task says "per spec §X", the named section is the exhaustive source — read it before implementing that task.

## Global Constraints

- **RTL / logical CSS only.** No `left`/`right`/`marginLeft`/`marginRight`/`paddingLeft`/`paddingRight` in any new or touched style object — use `insetInlineStart/End`, `marginInlineStart/End`, `paddingInlineStart/End`. (`DESIGN.md`, spec §8 T-CARD-12.)
- **44×44 minimum touch target** on every interactive control, even when the visible glyph is smaller — use `padding` + negative `margin` to expand the hit box without growing the visual. (`DESIGN.md`, spec §4 throughout.)
- **WCAG 2.2 AA contrast.** Every text/icon-on-background pairing introduced must hit the ratios the spec states in §4 (e.g. badge fg/bg pairs are pre-computed via `readableInkOn`, already imported in `EditorView.jsx`).
- **Dark mode threaded, not switched on.** Every new component takes a `P` prop of the shape `{ ink, ink2, ink3, ink4, line, page, panel, surface, surface2, danger, accent }` (see `src/utils/theme.js`). `EditorView.jsx` passes `P={LIGHT}` as a literal import — do not call `useDarkMode()` inside the editor in this plan. (Spec §8.6.)
- **Money is integers in minor units.** Never introduce a float amount; always go through `src/utils/budget.js` helpers (`formatMoney`, `toIlsMinor`, the new `stopCostSummary`).
- **`npm run critical` must pass after every task-level commit.** Nothing in this plan touches auth, session, ownership, RLS, routes, or Vercel/env config, so no new critical-suite check is added — this is a deliberate scope boundary, not an oversight (spec §8, architect risk table).
- **`CI=true npm test -- --watchAll=false` and `npm run build` must pass after every task.** Baseline is 331 Jest tests; this plan adds roughly 25–35.
- **Hebrew strings in this plan are placeholders pending `copywriter` review** — implement them as written, but do not treat the exact wording as final.
- **`settings.budgetShared` does not exist in the codebase today** (grepped, confirmed absent from `src/` and `api/`). Read it defensively (`trip?.settings?.budgetShared`); treat missing/falsy as "hide cost on shared trips." Never write to `settings` — `tripService.js:80`'s full-replace bug (`row.settings = patch.settings`) is unrelated, out of scope, and must not be widened.
- **Rating-writer fix applies to exactly one call site.** `EditorView.jsx:1611` (`addNearbyToDay`, raw Google 0–5) needs `ratingToBadge`. `EditorView.jsx:1979` (`addOverlayPoints`) already emits a correct `"X/10"` string — do **not** route it through `ratingToBadge`, which returns `null` for non-numeric input and would silently delete every overlay-imported rating. This is a correction to spec §8.5, not an alternative reading of it.

---

## Increment A — Prerequisites + verbatim extraction

**Ships independently. Zero visual change.** Confirmed: `EditorView.jsx`'s local `T` constant (`:52–56`: `ink #0D0F11, ink2 #2A3036, ink3 #6B7178, ink4 #A4AAB1, line rgba(20,20,20,0.08), surface #F6F6F4, accent #E0533F`) is byte-identical to `LIGHT` in `src/utils/theme.js` for every key the card uses. Swapping `T` for `P={LIGHT}` inside the extracted components changes no pixel.

### Task A1: Three new `Icon.jsx` glyphs + `success` token

**Owner:** `design-systems` (or `builder` if run inline — no design judgement required, values are fixed by spec §8.10 and §7.3)

**Files:**
- Modify: `src/components/Icon.jsx:19–81` (the `PATHS` map)
- Modify: `src/utils/theme.js:17–28` (`LIGHT`, `DARK`)
- Test: `src/components/Icon.test.js` (create if it doesn't exist)

**Interfaces:**
- Produces: `<Icon name="paperclip" />`, `<Icon name="navigation" />`, `<Icon name="walk" />` — usable by every later task.
- Produces: `LIGHT.success === "#1FA67A"`, `DARK.success === "#1FA67A"`.

- [ ] **Step 1: Write the failing test**

```js
// src/components/Icon.test.js
import { render } from "@testing-library/react";
import Icon from "./Icon";

describe("Icon — new glyphs for the stop-card redesign", () => {
  it.each(["paperclip", "navigation", "walk"])("renders %s without a console warning", (name) => {
    const warn = jest.spyOn(console, "warn").mockImplementation(() => {});
    const { container } = render(<Icon name={name} />);
    expect(container.querySelector("svg")).toBeTruthy();
    expect(warn).not.toHaveBeenCalled();
    warn.mockRestore();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `CI=true npx react-scripts test src/components/Icon.test.js --watchAll=false`
Expected: FAIL — `<Icon name="paperclip" />` warns "not found" and renders no `<svg>`.

- [ ] **Step 3: Add the three glyphs**

Add to `PATHS` in `src/components/Icon.jsx` (any position — alphabetical is not enforced elsewhere in the file, so append near the other Sprint-56 additions at `:70–80`):

```jsx
  paperclip: <><path d="M21.44 11.05l-9.19 9.19a5.5 5.5 0 0 1-7.78-7.78l9.19-9.19a3.5 3.5 0 0 1 4.95 4.95l-9.19 9.19a1.5 1.5 0 0 1-2.12-2.12l8.49-8.49" /></>,
  navigation: <><polygon points="3 11 22 2 13 21 11 13 3 11" /></>,
  walk: <><circle cx="13" cy="4" r="2" /><path d="M13 7l-3 4 1 5-3 5" /><path d="M10 11l4 2 3-2" /><path d="M8 22l3-6" /></>,
```

- [ ] **Step 4: Add the `success` token**

```js
// src/utils/theme.js
export const LIGHT = {
  page: "#EDEDEC", panel: "#fff", ink: "#0D0F11", ink2: "#2A3036",
  ink3: "#6B7178", ink4: "#A4AAB1",
  line: "rgba(20,20,20,0.08)", surface: "#F6F6F4", surface2: "#EFEFEC",
  danger: "#C0392B", accent: "#E0533F", success: "#1FA67A",
};
export const DARK = {
  page: "#0E1012", panel: "#16191D", ink: "#F5F6F7", ink2: "#C7CCD1",
  ink3: "#8B9198", ink4: "#6B7178",
  line: "rgba(255,255,255,0.09)", surface: "#1F242A", surface2: "#262B31",
  danger: "#E0573F", accent: "#E0533F", success: "#1FA67A",
};
```

- [ ] **Step 5: Run test to verify it passes**

Run: `CI=true npx react-scripts test src/components/Icon.test.js --watchAll=false`
Expected: PASS

- [ ] **Step 6: Run the full suite + build**

Run: `npm run critical && CI=true npm test -- --watchAll=false && npm run build`
Expected: all green — this is a pure addition, nothing existing references `success` or the three new names yet.

- [ ] **Step 7: Commit**

```bash
git add src/components/Icon.jsx src/utils/theme.js src/components/Icon.test.js
git commit -m "feat(icons): add paperclip/navigation/walk glyphs + success token

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task A2: `stopCostSummary` helper in `budget.js`

**Owner:** `budget-domain`

**Files:**
- Modify: `src/utils/budget.js` (export `itemEffectiveMinor`, currently module-private at `:126`; add `stopCostSummary`)
- Test: `src/utils/budget.test.js` (existing file — add cases)

**Interfaces:**
- Consumes: `expensesForStop(items, stopId)` (existing, `:354–357`), `toIlsMinor(minor, currency, config)` (existing, `:74–80`).
- Produces: `stopCostSummary(items, stopId, config) → { count, primary, effectiveMinor, plannedMinor, currency, paid, over } | null`. `null` when `stopId` is falsy or no items match. `primary` is the first linked expense object (unchanged shape from `expensesForStop(...)[0]`) — **load-bearing**: `EditorView.jsx:3935` and `EditorDesktop.jsx:1691` pass it straight into `ExpenseSheet` as the editable record, so later tasks must keep using `.primary`, never invent a second lookup.
- Multi-currency rule: when every linked item shares one `currency`, `effectiveMinor`/`plannedMinor` are in that currency and `currency` names it. When items mix currencies, `effectiveMinor`/`plannedMinor` are the ILS-converted totals via `toIlsMinor(...)` and `currency` is `"ILS"`. This must match what `/trip/budget/:tripId` (`rollup()`) would show for the same items — `rollup()` always converts to ILS, so on the mixed path this function is doing the same conversion at stop scope.

- [ ] **Step 1: Write the failing tests**

```js
// src/utils/budget.test.js — append
import { stopCostSummary } from "./budget";

describe("stopCostSummary", () => {
  const config = { rate: 4, currency: "ILS" };

  it("returns null when there is no stopId", () => {
    expect(stopCostSummary([{ stopRef: "s1", amountMinor: 1000, currency: "ILS" }], null, config)).toBeNull();
  });

  it("returns null when nothing links to the stop", () => {
    expect(stopCostSummary([{ stopRef: "s1", amountMinor: 1000, currency: "ILS" }], "s2", config)).toBeNull();
  });

  it("summarises a single unpaid item", () => {
    const items = [{ id: "e1", stopRef: "s1", amountMinor: 12000, currency: "ILS", paid: false }];
    const r = stopCostSummary(items, "s1", config);
    expect(r).toEqual(expect.objectContaining({
      count: 1, currency: "ILS", plannedMinor: 12000, effectiveMinor: 12000, paid: false, over: false,
    }));
    expect(r.primary.id).toBe("e1");
  });

  it("sums two same-currency items and flags over when actual exceeds planned", () => {
    const items = [
      { id: "e1", stopRef: "s1", amountMinor: 5000, currency: "ILS", paid: true, actualMinor: 6000 },
      { id: "e2", stopRef: "s1", amountMinor: 3000, currency: "ILS", paid: false },
    ];
    const r = stopCostSummary(items, "s1", config);
    expect(r.count).toBe(2);
    expect(r.currency).toBe("ILS");
    expect(r.plannedMinor).toBe(8000);
    expect(r.effectiveMinor).toBe(9000); // 6000 effective + 3000 planned
    expect(r.over).toBe(true);
    expect(r.primary.id).toBe("e1");
  });

  it("converts to ILS when currencies are mixed", () => {
    const items = [
      { id: "e1", stopRef: "s1", amountMinor: 1000, currency: "USD", paid: false }, // 1000 * rate4 /100... see toIlsMinor
      { id: "e2", stopRef: "s1", amountMinor: 2000, currency: "ILS", paid: false },
    ];
    const r = stopCostSummary(items, "s1", config);
    expect(r.currency).toBe("ILS");
    // toIlsMinor(1000, "USD", {rate:4}) = round((1000/100)*4*100) = 4000
    expect(r.plannedMinor).toBe(4000 + 2000);
  });

  it("a stop with no instanceId (falsy stopId) never crashes and returns null", () => {
    expect(stopCostSummary([{ stopRef: "s1", amountMinor: 1000, currency: "ILS" }], undefined, config)).toBeNull();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `CI=true npx react-scripts test src/utils/budget.test.js --watchAll=false`
Expected: FAIL — `stopCostSummary is not a function`.

- [ ] **Step 3: Export `itemEffectiveMinor` and add `stopCostSummary`**

In `src/utils/budget.js`, change the existing private helper at `:126` from `const itemEffectiveMinor = ...` to `export const itemEffectiveMinor = ...` (no other change — it is already used internally by `rollup` and `budgetImpact`, exporting it is additive). Then add, directly below `expensesForStop` (after `:357`):

```js
/* The stop-card's single read of a stop's money (spec §4.5, §8.3).
   `primary` is the first linked expense, unchanged shape — StopCard uses it
   only to decide whether to show a cost item; EditorView/EditorDesktop pass
   it straight into ExpenseSheet as the editable record, exactly like the
   `costForStop(...)` it replaces. Everything else here is a SUM of
   effectives, which `costForStop` never computed — this is the fix for the
   "card total disagrees with the ⋯ sheet" drift budget.js:120-122 warns
   about. */
export function stopCostSummary(items, stopId, config) {
  const linked = expensesForStop(items, stopId);
  if (linked.length === 0) return null;

  const currencies = new Set(linked.map((it) => it.currency || "ILS"));
  const mixed = currencies.size > 1;
  const nativeCurrency = mixed ? "ILS" : (linked[0].currency || "ILS");

  let plannedMinor = 0;
  let effectiveMinor = 0;
  let anyPaid = false;
  let anyOver = false;

  for (const it of linked) {
    const cur = it.currency || "ILS";
    const planned = mixed ? toIlsMinor(Number(it.amountMinor) || 0, cur, config) : (Number(it.amountMinor) || 0);
    const effective = mixed ? toIlsMinor(itemEffectiveMinor(it), cur, config) : itemEffectiveMinor(it);
    plannedMinor += planned;
    effectiveMinor += effective;
    if (it.paid) anyPaid = true;
    if (effective > planned) anyOver = true;
  }

  return {
    count: linked.length,
    primary: linked[0],
    currency: nativeCurrency,
    plannedMinor,
    effectiveMinor,
    paid: anyPaid,
    over: anyOver,
  };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `CI=true npx react-scripts test src/utils/budget.test.js --watchAll=false`
Expected: PASS (all 6 new cases + all pre-existing `budget.test.js` cases).

- [ ] **Step 5: Run the full suite + build**

Run: `npm run critical && CI=true npm test -- --watchAll=false && npm run build`
Expected: all green — `stopCostSummary` is not called from anywhere yet, so no behavioural change elsewhere.

- [ ] **Step 6: Commit**

```bash
git add src/utils/budget.js src/utils/budget.test.js
git commit -m "feat(budget): add stopCostSummary helper for per-stop cost totals

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task A3: Wire `stopCostSummary` into `useEditorState.js` and `EditorDesktop.jsx`

**Owner:** `budget-domain`

**Files:**
- Modify: `src/hooks/useEditorState.js:178–180` (`costForStop`)
- Modify: `src/views/EditorDesktop.jsx:1457–1458` (label computation), `:1691` (keeps `.primary`)
- Test: extend whatever test file already covers `useEditorState.js`'s `costForStop` (check for `src/hooks/useEditorState.test.js`; if none exists, this task does not need to create one — `EditorDesktop.jsx`'s own tests, if any, cover the call site behaviourally, and Task B2's `StopCard.test.js` covers the summary contract itself via Task A2's tests)

**Interfaces:**
- Consumes: `stopCostSummary` from Task A2.
- Produces: `costForStop(stopId)` now returns the **summary object** `{ count, primary, effectiveMinor, plannedMinor, currency, paid, over } | null` instead of the old bare expense-or-null. **This is a breaking return-shape change for every existing caller** — the two call sites below are the only ones (confirmed by grep: `costForStop|stopCostLabel` across `src/` returns exactly `EditorView.jsx:3935,4725`, `EditorDesktop.jsx:1457-1458,1691`, and the hook itself).

- [ ] **Step 1: Update `useEditorState.js`**

Current (`:178–180`):

```js
  const costForStop = useCallback((stopId) => {
    const items = trip?.data?.budget?.items || [];
    return expensesForStop(items, stopId)[0] || null;
  }, [trip]);
```

Replace with:

```js
  const costForStop = useCallback((stopId) => {
    const items = trip?.data?.budget?.items || [];
    const config = trip?.data?.budget?.config || {};
    return stopCostSummary(items, stopId, config);
  }, [trip]);
```

Add `stopCostSummary` to the existing `import { ... } from "../utils/budget"` at the top of the file (alongside `expensesForStop, detachStopExpenses` — keep `expensesForStop` imported too, it is still used elsewhere in the file per the grep).

- [ ] **Step 2: Update `EditorDesktop.jsx:1457–1458`**

Current:

```js
                <CtxItem emoji="💰" label={costForStop(ctxMenu.a.instanceId)
                    ? `עריכת עלות · ${formatMoney(costForStop(ctxMenu.a.instanceId).amountMinor, costForStop(ctxMenu.a.instanceId).currency || "ILS")}`
```

Replace with (the summary's `effectiveMinor`/`currency` replace the old single-item `amountMinor`/`currency`):

```js
                <CtxItem emoji="💰" label={costForStop(ctxMenu.a.instanceId)
                    ? `עריכת עלות · ${formatMoney(costForStop(ctxMenu.a.instanceId).effectiveMinor, costForStop(ctxMenu.a.instanceId).currency || "ILS")}`
```

- [ ] **Step 3: Update `EditorDesktop.jsx:1691`**

Current: `const existing = stop.instanceId ? costForStop(stop.instanceId) : null;` — read the ~10 lines after this to find how `existing` is used. If it is passed into `ExpenseSheet` as the editable record (matching the pattern at `EditorView.jsx:3935`), change the line to:

```js
        const existing = stop.instanceId ? costForStop(stop.instanceId)?.primary ?? null : null;
```

If it is used for anything else (e.g. a boolean "has cost" check), keep that usage working against the summary object directly (`existing` truthy still means "has a cost") and only insert `.primary` at the specific point that feeds `ExpenseSheet`. Read the surrounding code before editing — do not guess.

- [ ] **Step 4: Update `EditorView.jsx:3935`**

Current: `const existing = stop.instanceId ? costForStop(stop.instanceId) : null;` (same pattern). Same fix:

```js
        const existing = stop.instanceId ? costForStop(stop.instanceId)?.primary ?? null : null;
```

- [ ] **Step 5: Update `EditorView.jsx:4723–4727` (`stopCostLabel` for `StopActionsSheet`)**

Current:

```js
          stopCostLabel={(() => {
            const stop = activeDayData?.attractions?.[actionsIdx];
            const c = stop?.instanceId ? costForStop(stop.instanceId) : null;
            return c ? formatMoney(c.amountMinor, c.currency || "ILS") : null;
          })()}
```

Replace with:

```js
          stopCostLabel={(() => {
            const stop = activeDayData?.attractions?.[actionsIdx];
            const c = stop?.instanceId ? costForStop(stop.instanceId) : null;
            return c ? formatMoney(c.effectiveMinor, c.currency || "ILS") : null;
          })()}
```

This is the exact fix for T-CARD-06 (§8.3): the `⋯` sheet and the future card both call `costForStop`, which both now resolve through the same `stopCostSummary`.

- [ ] **Step 6: Run the full suite + build**

Run: `npm run critical && CI=true npm test -- --watchAll=false && npm run build`
Expected: all green. If any existing test asserted the old bare-expense shape from `costForStop`, it will now fail — fix that test to read `.primary`/`.effectiveMinor` per the new contract rather than reverting the helper.

- [ ] **Step 7: Manual smoke check (not yet on-device — this is a logic change, verify via existing dev tooling)**

Run: `npm start`, open a trip with at least one stop-linked expense in `⋯ → עריכת עלות`, confirm the label still reads the correct amount. This does not require the phone — it is desktop-reachable via `EditorDesktop.jsx`.

- [ ] **Step 8: Commit**

```bash
git add src/hooks/useEditorState.js src/views/EditorDesktop.jsx src/views/EditorView.jsx
git commit -m "refactor(budget): costForStop returns a cost summary, not a bare item

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task A4: `normalizeRating` in `classify.js`

**Owner:** `builder`

**Files:**
- Modify: `src/utils/classify.js` (add next to `ratingToBadge`, `:75–79`)
- Test: `src/utils/classify.test.js` (existing file — add cases)

**Interfaces:**
- Produces: `normalizeRating(raw) → string | null`. Handles the three shapes documented in spec §8.5: a string ending `"/10"` (parse and pass through), a bare number `≤ 5` (Google 0–5 scale, multiply by 2), a bare number `> 5` (already a /10 number, format directly). Returns `null` for anything unparseable — the caller (`StopCard`) renders nothing when this is `null`.

- [ ] **Step 1: Write the failing tests**

```js
// src/utils/classify.test.js — append
import { normalizeRating } from "./classify";

describe("normalizeRating", () => {
  it("passes through an already-scaled string", () => {
    expect(normalizeRating("9/10")).toBe("9/10");
    expect(normalizeRating("9.2/10")).toBe("9.2/10");
  });
  it("scales a raw Google 0-5 number", () => {
    expect(normalizeRating(4.6)).toBe("9.2/10");
    expect(normalizeRating(4.7)).toBe("9.4/10");
  });
  it("treats a bare number above 5 as already /10", () => {
    expect(normalizeRating(9.4)).toBe("9.4/10");
  });
  it("returns null for unparseable input", () => {
    expect(normalizeRating(undefined)).toBeNull();
    expect(normalizeRating(null)).toBeNull();
    expect(normalizeRating("")).toBeNull();
    expect(normalizeRating("garbage")).toBeNull();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `CI=true npx react-scripts test src/utils/classify.test.js --watchAll=false`
Expected: FAIL — `normalizeRating is not a function`.

- [ ] **Step 3: Implement**

Add directly after `ratingToBadge` (`:75–79`) in `src/utils/classify.js`:

```js
/* Render-time rating normalisation for the stop card (spec §2.5, §8.5).
   Three writers disagree on scale/type — this makes the CARD consistent
   without rewriting stored data:
     • a string already ending "/10"  → pass through as-is
     • a bare number ≤ 5              → Google 0-5 scale, reuse ratingToBadge
     • a bare number > 5              → already /10, format directly
   Returns null for anything unparseable; StopCard renders nothing then. */
export const normalizeRating = (raw) => {
  if (raw == null) return null;
  if (typeof raw === "string") {
    const s = raw.trim();
    if (/\/10$/.test(s)) return s;
    const n = parseFloat(s);
    if (!Number.isFinite(n)) return null;
    return n <= 5 ? ratingToBadge(n) : `${Math.round(n * 10) / 10}/10`;
  }
  const n = Number(raw);
  if (!Number.isFinite(n)) return null;
  return n <= 5 ? ratingToBadge(n) : `${Math.round(n * 10) / 10}/10`;
};
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `CI=true npx react-scripts test src/utils/classify.test.js --watchAll=false`
Expected: PASS

- [ ] **Step 5: Run the full suite + build**

Run: `npm run critical && CI=true npm test -- --watchAll=false && npm run build`
Expected: all green — not called from anywhere yet.

- [ ] **Step 6: Commit**

```bash
git add src/utils/classify.js src/utils/classify.test.js
git commit -m "feat(classify): add normalizeRating for consistent stop-card display

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task A5: Extract `TransitConnector.jsx` (verbatim behaviour)

**Owner:** `builder`

**Files:**
- Create: `src/components/TransitConnector.jsx`
- Create: `src/components/TransitConnector.test.js`
- Modify: `src/views/EditorView.jsx` (delete `TransitRail` `:246–323` and `RAIL_MENU` `:240–245`; import and use the new component)

**Interfaces:**
- Produces: `<TransitConnector a={stop} b={stop} override={string|null} onSetMode={(mode)=>void} units={"km"|"mi"} editable={bool} P={paletteObject} />` — identical props to the old `TransitRail`, plus `P`.
- Consumes: `computeTransit` from `src/utils/transit.js` (unchanged import).

This task is **verbatim** — copy `TransitRail`'s JSX and logic exactly, replacing every hard-coded `T.xxx` reference with `P.xxx` (they are value-identical per the Global Constraints note, so this changes zero rendered pixels), and replacing the inline `#fff` background with `P.panel`. Do not touch layout, sizing, hover behaviour, or emoji in this task — Task B4 redesigns all of that. The tests here assert only that nothing changed.

- [ ] **Step 1: Write the failing tests (extraction invariants)**

```js
// src/components/TransitConnector.test.js
import { render, screen, fireEvent } from "@testing-library/react";
import TransitConnector from "./TransitConnector";
import { LIGHT } from "../utils/theme";

const a = { coordinates: { lat: 35.0, lng: 135.0 } };
const b = { coordinates: { lat: 35.01, lng: 135.01 } };

describe("TransitConnector — extraction invariants", () => {
  it("renders nothing when computeTransit returns null (no coordinates)", () => {
    const { container } = render(<TransitConnector a={{}} b={{}} units="km" P={LIGHT} />);
    expect(container.firstChild).toBeNull();
  });

  it("renders a segment for two stops with coordinates", () => {
    render(<TransitConnector a={a} b={b} units="km" editable P={LIGHT} />);
    expect(screen.getByRole("button", { name: /שינוי אופן המעבר/ })).toBeInTheDocument();
  });

  it("opens the mode menu on click and calls onSetMode on a pick", () => {
    const onSetMode = jest.fn();
    render(<TransitConnector a={a} b={b} units="km" editable onSetMode={onSetMode} P={LIGHT} />);
    fireEvent.click(screen.getByRole("button", { name: /שינוי אופן המעבר/ }));
    const menu = screen.getByRole("menu");
    fireEvent.click(menu.querySelectorAll("button")[1]); // "car"
    expect(onSetMode).toHaveBeenCalledWith("car");
  });

  it("renders a read-only span, no button, when editable is false", () => {
    render(<TransitConnector a={a} b={b} units="km" editable={false} P={LIGHT} />);
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `CI=true npx react-scripts test src/components/TransitConnector.test.js --watchAll=false`
Expected: FAIL — module not found.

- [ ] **Step 3: Create `TransitConnector.jsx`**

```jsx
import React, { useState } from "react";
import { computeTransit } from "../utils/transit";

/* Extracted verbatim from EditorView.jsx's TransitRail (Sprint 30) as a
   behaviour-preserving no-op — see docs/superpowers/plans/2026-09-11-
   mobile-stop-card-implementation-plan.md Task A5. Redesigned per spec
   §4.7-§4.8 in Task B4; this file intentionally still looks like the old
   inline version except every T.xxx became P.xxx. */
const RAIL_MENU = [
  { mode: "walk", emoji: "🚶", label: "הליכה" },
  { mode: "car", emoji: "🚗", label: "רכב / מונית" },
  { mode: "transit", emoji: "🚆", label: "רכבת" },
  { mode: "bus", emoji: "🚌", label: "אוטובוס" },
];

export default function TransitConnector({ a, b, override = null, onSetMode, units, editable = true, P }) {
  const [hover, setHover] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const seg = computeTransit(a?.coordinates, b?.coordinates, override, units);
  if (!seg) return null;
  const active = hover && editable && !menuOpen;
  const inner = (
    <>
      <span aria-hidden>{seg.emoji}</span>
      <b style={{ color: active ? "#fff" : P.ink2, fontWeight: 700 }}>{seg.minutesLabel}</b>
      <span style={{ color: active ? "rgba(255,255,255,0.7)" : P.ink4 }}>·</span>
      <span>{seg.he}</span>
      <span style={{ color: active ? "rgba(255,255,255,0.7)" : P.ink4 }}>·</span>
      <span>{seg.distLabel}</span>
      {editable && (
        <span aria-hidden style={{ display: "inline-flex", marginInlineStart: 2, fontSize: 9, opacity: hover ? 1 : 0.55 }}>▾</span>
      )}
    </>
  );
  const baseStyle = {
    display: "inline-flex", alignItems: "center", gap: 6,
    padding: "4px 10px", borderRadius: 999,
    border: `1px solid ${active ? P.ink : (override ? P.accent : P.line)}`,
    background: active ? P.ink : P.panel,
    color: active ? "#fff" : P.ink3,
    fontSize: 11, fontFamily: "inherit",
    transition: "background 0.18s ease, color 0.18s ease, border-color 0.18s ease",
  };
  return (
    <div style={{ display: "flex", justifyContent: "center", padding: "2px 0", position: "relative" }}>
      {editable ? (
        <>
          <button
            onClick={() => setMenuOpen((v) => !v)}
            onMouseEnter={() => setHover(true)}
            onMouseLeave={() => setHover(false)}
            aria-haspopup="menu" aria-expanded={menuOpen}
            title="שינוי אופן המעבר"
            style={{ ...baseStyle, cursor: "pointer" }}
          >
            {inner}
          </button>
          {menuOpen && (
            <>
              <div onClick={() => setMenuOpen(false)} style={{ position: "fixed", inset: 0, zIndex: 20 }} />
              <div role="menu" className="tp-pop" dir="rtl" style={{
                position: "absolute", top: "100%", marginTop: 4, zIndex: 21,
                display: "flex", gap: 4, padding: 4, background: P.panel,
                borderRadius: 999, border: `1px solid ${P.line}`,
                boxShadow: "0 10px 30px rgba(0,0,0,0.16)",
              }}>
                {RAIL_MENU.map((m) => {
                  const on = seg.mode === m.mode;
                  return (
                    <button key={m.mode} role="menuitemradio" aria-checked={on}
                      title={m.label}
                      onClick={() => { onSetMode && onSetMode(m.mode); setMenuOpen(false); }}
                      style={{
                        width: 34, height: 34, borderRadius: "50%", cursor: "pointer",
                        border: `1px solid ${on ? P.ink : P.line}`, background: on ? P.ink : P.panel,
                        fontSize: 16, lineHeight: 1, display: "inline-flex", alignItems: "center", justifyContent: "center",
                        fontFamily: "inherit", transition: "background 0.15s, border-color 0.15s",
                      }}>
                      <span aria-hidden style={{ filter: on ? "none" : "grayscale(0.15)" }}>{m.emoji}</span>
                    </button>
                  );
                })}
              </div>
            </>
          )}
        </>
      ) : (
        <span style={baseStyle}>{inner}</span>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `CI=true npx react-scripts test src/components/TransitConnector.test.js --watchAll=false`
Expected: PASS

- [ ] **Step 5: Wire into `EditorView.jsx` — do NOT delete the old code yet**

Add the import near the top of `EditorView.jsx` (alongside the other component imports, `:1–38`): `import TransitConnector from "../components/TransitConnector";` and `import { LIGHT } from "../utils/theme";`. Leave `TransitRail`/`RAIL_MENU` in place for this step — Task A7 does the swap-and-delete once `StopCard` is also ready, so the two extractions land as one visual-diff-free commit rather than two half-migrated ones.

- [ ] **Step 6: Run the full suite + build**

Run: `npm run critical && CI=true npm test -- --watchAll=false && npm run build`
Expected: all green — `TransitConnector` exists and is imported but not yet rendered anywhere in `EditorView.jsx`.

- [ ] **Step 7: Commit**

```bash
git add src/components/TransitConnector.jsx src/components/TransitConnector.test.js src/views/EditorView.jsx
git commit -m "feat(editor): extract TransitConnector from EditorView (behaviour-preserving)

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task A6: Extract `StopCard.jsx` (verbatim behaviour)

**Owner:** `builder`

**Files:**
- Create: `src/components/StopCard.jsx`
- Create: `src/components/StopCard.test.js`
- Modify: `src/views/EditorView.jsx` (import only — no deletion yet, same reasoning as Task A5 Step 5)

**Interfaces:**
- Produces: `<StopCard stop={a} idx={number} pos={number|null} lodging={bool} tripActive={bool} liveOps={bool} editable={bool} dragging={bool} P={paletteObject}
  onNavigate={(stop)=>void} onToggleComplete={(idx)=>void} onEditNote={(idx)=>void} onOpenActions={(idx)=>void}
  onMoveForward={(idx)=>void} onOpenAttachment={(file, idx, fi)=>void} onHandleDown={(pos)=>(e)=>void} rowRef={(el)=>void} />`
  — this is `renderPlaceRow`'s exact parameter set turned into props, preserving every callback's existing signature (do not rename `idx`, `onNavigate`, etc. — `DayStopList`'s call site depends on these exact names when Task A7 wires it up).
- This task's JSX is a **byte-for-byte port** of `renderPlaceRow` (`EditorView.jsx:841–1021`) with `T.xxx` → `P.xxx`, `"#fff"` → `P.panel` where it was the card background, and the function signature turned into a props object. Do not change layout, copy, colours, or sizes — Task B1–B3 redesign this. The one structural change: `rowRefs.current[pos] = el` becomes a `rowRef` callback prop, since the extracted component cannot reach into `DayStopList`'s `useRef` array directly.

- [ ] **Step 1: Write the failing tests (extraction invariants — these survive Increment B as the regression net per the plan's Architecture)**

```js
// src/components/StopCard.test.js
import { render, screen, fireEvent } from "@testing-library/react";
import StopCard from "./StopCard";
import { LIGHT } from "../utils/theme";

const baseStop = {
  instanceId: "i1", nameHe: "בורג' ח'ליפה", category: "אטרקציה",
  coordinates: { lat: 25.19, lng: 55.27 },
};

const baseProps = {
  stop: baseStop, idx: 0, pos: 0, editable: true, P: LIGHT,
  onNavigate: jest.fn(), onToggleComplete: jest.fn(), onEditNote: jest.fn(),
  onOpenActions: jest.fn(), onHandleDown: () => () => {},
};

describe("StopCard — extraction invariants", () => {
  it("renders the stop name", () => {
    render(<StopCard {...baseProps} />);
    expect(screen.getByText("בורג' ח'ליפה")).toBeInTheDocument();
  });

  it("tapping the name calls onNavigate with the stop", () => {
    const onNavigate = jest.fn();
    render(<StopCard {...baseProps} onNavigate={onNavigate} />);
    fireEvent.click(screen.getByText("בורג' ח'ליפה"));
    expect(onNavigate).toHaveBeenCalledWith(baseStop);
  });

  it("calls onOpenActions(idx) when the more button is tapped", () => {
    const onOpenActions = jest.fn();
    render(<StopCard {...baseProps} idx={3} onOpenActions={onOpenActions} />);
    fireEvent.click(screen.getByRole("button", { name: "פעולות" }));
    expect(onOpenActions).toHaveBeenCalledWith(3);
  });

  it("calls onEditNote(idx) when the note trigger is tapped", () => {
    const onEditNote = jest.fn();
    render(<StopCard {...baseProps} idx={2} onEditNote={onEditNote} />);
    fireEvent.click(screen.getByRole("button", { name: /הוספת הערה|עריכת הערה/ }));
    expect(onEditNote).toHaveBeenCalledWith(2);
  });

  it("hides ⋯ and drag handle when editable is false, keeps navigation", () => {
    render(<StopCard {...baseProps} editable={false} />);
    expect(screen.queryByRole("button", { name: "פעולות" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "ניווט ב-Google Maps" })).toBeInTheDocument();
  });

  it("every interactive child stops propagation so the card body click doesn't also fire", () => {
    const onNavigate = jest.fn();
    render(<StopCard {...baseProps} onNavigate={onNavigate} />);
    fireEvent.click(screen.getByRole("button", { name: "פעולות" }));
    expect(onNavigate).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `CI=true npx react-scripts test src/components/StopCard.test.js --watchAll=false`
Expected: FAIL — module not found.

- [ ] **Step 3: Create `StopCard.jsx`**

Port `renderPlaceRow` (`EditorView.jsx:841–1021`, already read in full during planning) into a standalone component. Structure:

```jsx
import React from "react";
import Icon from "./Icon";
import { readableInkOn } from "../utils/contrast";
import mapsUrlFor from "../utils/mapsUrl";

/* Extracted verbatim from EditorView.jsx's renderPlaceRow (through Sprint
   65) as a behaviour-preserving no-op — see docs/superpowers/plans/
   2026-09-11-mobile-stop-card-implementation-plan.md Task A6. Redesigned
   per spec §3-§7 in Increment B; until then this still looks exactly like
   the old inline card except T.xxx -> P.xxx and rowRefs -> rowRef prop. */
export default function StopCard({
  stop: a, idx, pos, lodging = false, tripActive = false, liveOps = false,
  editable = true, dragging = false, P,
  onNavigate, onToggleComplete, onEditNote, onOpenActions, onMoveForward,
  onOpenAttachment, onHandleDown, rowRef,
}) {
  const showCompletion = tripActive || liveOps;
  const done = showCompletion && !!a.completed;
  const canNavigate = !!(onNavigate && a.coordinates);
  const note = a.note || a.comment || a.annotation || a.quote;
  const hotelSpan = a._hotelGroup ? a._hotelSpan : null;
  const CHARCOAL = "#1E1E24";
  const CORAL = "#FF6B6B";
  const badgeBg = done ? P.ink4 : (a._theme || (lodging ? CORAL : CHARCOAL));
  const badgeFg = readableInkOn(badgeBg);
  const subtitle = lodging ? `מלון${hotelSpan ? ` · ${hotelSpan.total} לילות` : ""}` : (a.category || "");
  const hasNav = a.coordinates && Number.isFinite(a.coordinates.lat) && Number.isFinite(a.coordinates.lng);
  const rNum = parseFloat(String(a.rating));
  const highRating = Number.isFinite(rNum) && rNum >= 8.5;

  return (
    <div
      ref={rowRef}
      data-stop-idx={idx}
      style={{
        display: "flex", flexDirection: "column", gap: note ? 6 : 0,
        padding: "7px 12px", marginBottom: 6,
        userSelect: "none", WebkitUserSelect: "none", msUserSelect: "none", WebkitTouchCallout: "none",
        background: done ? P.surface2 : P.panel,
        border: `1px solid ${dragging ? "transparent" : P.line}`,
        borderRadius: 14,
        boxShadow: dragging ? "0 10px 30px rgba(0,0,0,0.16)" : "none",
        transform: dragging ? "scale(1.02)" : "scale(1)",
        zIndex: dragging ? 2 : "auto", position: "relative",
        transition: dragging ? "none" : "transform 0.2s ease, box-shadow 0.2s ease, background 0.2s ease",
      }}
    >
      <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
        <div aria-hidden style={{
          flexShrink: 0, width: 28, height: 28, borderRadius: 8, marginTop: 1,
          background: badgeBg, color: badgeFg,
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 13, fontWeight: 800, fontVariantNumeric: "tabular-nums",
        }}>{lodging ? <Icon name="bed" size={15} strokeWidth={2} color={badgeFg} /> : (pos != null ? pos + 1 : "•")}</div>

        <div
          onClick={() => canNavigate && onNavigate(a)}
          title={canNavigate ? "מעבר למיקום על המפה" : undefined}
          style={{ flex: 1, minWidth: 0, opacity: done ? 0.55 : 1, cursor: canNavigate ? "pointer" : "default" }}
        >
          <div dir="auto" style={{
            fontSize: 16, fontWeight: 800, color: P.ink, lineHeight: 1.3,
            display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical",
            overflow: "hidden", wordBreak: "break-word",
            textDecoration: done ? "line-through" : "none", textDecorationColor: done ? P.ink4 : "transparent",
          }}>{a.nameHe || a.name}</div>
        </div>

        {showCompletion && (
          <button onClick={(e) => { e.stopPropagation(); onToggleComplete && onToggleComplete(idx); }}
            title={done ? "בטלו סימון ביקור" : "סמנו כבוצע"} aria-label={done ? "בטלו סימון ביקור" : "סמנו כבוצע"} aria-pressed={done}
            style={{ flexShrink: 0, width: 26, height: 26, borderRadius: "50%", border: `1.5px solid ${done ? P.success : P.ink4}`, background: done ? P.success : "transparent", color: "#fff", cursor: "pointer", display: "inline-flex", alignItems: "center", justifyContent: "center", padding: 0 }}>
            {done && <Icon name="check" size={15} strokeWidth={2.6} />}
          </button>
        )}
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 6, opacity: done ? 0.55 : 1 }}>
        <div dir="auto" style={{ flex: 1, minWidth: 0, fontSize: 12.5, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
          {a.rating && <span style={{ color: highRating ? CORAL : P.ink3, fontWeight: highRating ? 800 : 700 }}>★ {a.rating}</span>}
          {a.rating && subtitle && <span style={{ color: P.ink4, fontWeight: 600 }}> · </span>}
          {subtitle && <span style={{ color: lodging ? CORAL : P.ink3, fontWeight: lodging ? 800 : 600 }}>{subtitle}</span>}
        </div>
        {(editable || hasNav) && (
          <div style={{ flexShrink: 0, display: "flex", alignItems: "center", gap: 6 }}>
            {hasNav && (
              <button
                onClick={(e) => { e.stopPropagation(); const u = mapsUrlFor(a); if (u) window.open(u, "_blank", "noopener,noreferrer"); }}
                title="ניווט ב-Google Maps" aria-label="ניווט ב-Google Maps" className="tp-press"
                style={{ height: 30, padding: "0 10px", border: "none", background: CHARCOAL, color: "#fff", cursor: "pointer", fontFamily: "inherit", borderRadius: 8, fontSize: 12.5, fontWeight: 800, display: "inline-flex", alignItems: "center", gap: 5 }}>
                <Icon name="pin" size={13} strokeWidth={2} color="#fff" />ניווט
              </button>
            )}
            {editable && onEditNote && (
              <button
                onClick={(e) => { e.stopPropagation(); onEditNote(idx); }}
                title={a.note ? "עריכת הערה" : "הוספת הערה"} aria-label={a.note ? "עריכת הערה" : "הוספת הערה"}
                style={{ width: 30, height: 30, border: "none", background: a.note ? CHARCOAL : P.surface2, color: a.note ? "#fff" : P.ink2, cursor: "pointer", fontFamily: "inherit", borderRadius: 8, display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
                <Icon name="note" size={15} strokeWidth={1.9} color={a.note ? "#fff" : P.ink2} />
              </button>
            )}
            {editable && (
              <button
                onClick={(e) => { e.stopPropagation(); onOpenActions && onOpenActions(idx); }}
                title="פעולות" aria-label="פעולות"
                style={{ width: 30, height: 30, border: "none", background: P.surface2, color: P.ink2, cursor: "pointer", fontFamily: "inherit", borderRadius: 8, display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
                <Icon name="more" size={16} strokeWidth={1.8} />
              </button>
            )}
            {editable && pos != null && (
              <button
                onPointerDown={onHandleDown(pos)}
                title="גררו לסידור מחדש"
                style={{ width: 24, height: 30, border: "none", background: "transparent", color: P.ink4, cursor: "grab", touchAction: "none", fontSize: 16, fontFamily: "inherit" }}>
                ≡
              </button>
            )}
          </div>
        )}
      </div>

      {tripActive && !done && onMoveForward && (
        <button onClick={(e) => { e.stopPropagation(); onMoveForward(idx); }}
          style={{ marginTop: 6, alignSelf: "flex-start", border: `1px solid ${P.line}`, background: P.panel, padding: "4px 10px", borderRadius: 8, cursor: "pointer", fontFamily: "inherit", fontSize: 12, fontWeight: 700, color: P.ink2, display: "inline-flex", alignItems: "center", gap: 4 }}>
          <Icon name="chevronEnd" size={12} strokeWidth={2.2} /> העבר ליום הבא
        </button>
      )}

      {(note || (a.attachments && a.attachments.length)) && (
        <div style={{ display: "flex", alignItems: "stretch", gap: 6, width: "100%" }}>
          <div
            role={editable && onEditNote ? "button" : undefined}
            onClick={editable && onEditNote ? (e) => { e.stopPropagation(); onEditNote(idx); } : undefined}
            dir="auto" title={editable ? "עריכת ההערה" : undefined}
            style={{
              display: "flex", alignItems: "flex-start", gap: 6,
              flex: 1, minWidth: 0, boxSizing: "border-box", background: P.surface2, borderRadius: 8,
              padding: "8px 10px", fontSize: 12, fontWeight: 500, color: P.ink2,
              lineHeight: 1.45, whiteSpace: "pre-wrap", wordBreak: "break-word", overflowWrap: "anywhere",
              opacity: done ? 0.6 : 1, cursor: editable && onEditNote ? "pointer" : "default",
            }}>
            <span style={{ flexShrink: 0, marginTop: 1, color: P.ink3 }}><Icon name="note" size={13} strokeWidth={1.9} /></span>
            <span style={{ flex: 1, minWidth: 0 }}>{note || "הוספת הערה…"}</span>
          </div>
          {a.attachments && a.attachments.map((f, fi) => (
            <button key={fi} onClick={(e) => { e.stopPropagation(); onOpenAttachment && onOpenAttachment(f, idx, fi); }}
              title={f.name || "מסמך מצורף"} aria-label={f.name || "מסמך מצורף"} className="tp-press"
              style={{ flexShrink: 0, alignSelf: "stretch", minWidth: 36, padding: "0 8px", border: "none", background: CHARCOAL, color: "#fff", borderRadius: 8, cursor: "pointer", fontFamily: "inherit", display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 4, fontSize: 11, fontWeight: 800 }}>
              <span aria-hidden style={{ fontSize: 13 }}>📎</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `CI=true npx react-scripts test src/components/StopCard.test.js --watchAll=false`
Expected: PASS

- [ ] **Step 5: Add the import to `EditorView.jsx`, no deletion yet**

`import StopCard from "../components/StopCard";` — same "wire the import, defer the swap to Task A7" reasoning as Task A5 Step 5.

- [ ] **Step 6: Run the full suite + build**

Run: `npm run critical && CI=true npm test -- --watchAll=false && npm run build`
Expected: all green.

- [ ] **Step 7: Commit**

```bash
git add src/components/StopCard.jsx src/components/StopCard.test.js src/views/EditorView.jsx
git commit -m "feat(editor): extract StopCard from EditorView (behaviour-preserving)

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task A7: Swap `EditorView.jsx` to render the extracted components, delete the old inline code

**Owner:** `builder`

**Files:**
- Modify: `src/views/EditorView.jsx`

**Interfaces:**
- Consumes: `StopCard` (Task A6), `TransitConnector` (Task A5), `LIGHT` (from `src/utils/theme.js`).

- [ ] **Step 1: Replace the `renderPlaceRow` call site**

At `:1047`, `const row = renderPlaceRow(a, idx, pos, lodging);` — read the ~20 lines around this call to see how `row` is subsequently wrapped (it is passed into `SwipeableRow` and keyed). Replace the call with a direct `<StopCard>` render carrying every prop `renderPlaceRow` used to close over from the outer `DayStopList` scope: `stop={a} idx={idx} pos={pos} lodging={lodging} tripActive={tripActive} liveOps={liveOps} editable={editable} dragging={pos != null && dragIdx === pos} P={LIGHT} onNavigate={onNavigate} onToggleComplete={onToggleComplete} onEditNote={onEditNote} onOpenActions={onOpenActions} onMoveForward={onMoveForward} onOpenAttachment={onOpenAttachment} onHandleDown={onHandleDown} rowRef={(el) => { if (pos != null) rowRefs.current[pos] = el; }}`. Keep it wrapped in the same `SwipeableRow` with the same `onSwipeLeft`/`onSwipeRight`/`onLongPress`/`onDragStart` props it had before — this task does not touch gesture wiring, only which component renders inside it.

- [ ] **Step 2: Delete `renderPlaceRow`**

Delete the entire function body, `EditorView.jsx:841–1021` (confirmed range from the file read during planning — re-verify the exact end line before deleting, since Task A1–A6 commits may have shifted line numbers slightly).

- [ ] **Step 3: Replace the `TransitRail` render sites**

Find every JSX usage of `<TransitRail ...>` (there is at least one, inside the day-stop-list render between consecutive place rows). Replace with `<TransitConnector ... P={LIGHT} />`, keeping every other prop identical.

- [ ] **Step 4: Delete `TransitRail` and `RAIL_MENU`**

Delete `EditorView.jsx:246–323` (`TransitRail`) and `:240–245` (`RAIL_MENU`).

- [ ] **Step 5: Run the full suite + build**

Run: `npm run critical && CI=true npm test -- --watchAll=false && npm run build`
Expected: all green. If any existing `EditorView`-adjacent test (e.g. a snapshot or an integration test touching the day list) breaks, inspect the diff — it should be **zero** visual/behavioural change; a break here means a prop was dropped during the swap, not that a test needs updating.

- [ ] **Step 6: Manual verification (desktop dev server — this increment does not require the phone)**

Run: `npm start`, open any trip's editor, confirm: cards render identically to before (same layout, same colours, same ✓/⋯/≡/ניווט controls), tapping a card still flies the map, drag-reorder still works, the transit chip between two stops still opens its mode menu.

- [ ] **Step 7: Commit**

```bash
git add src/views/EditorView.jsx
git commit -m "refactor(editor): render extracted StopCard/TransitConnector, delete inline versions

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

**Increment A gate:** all of Task A1–A7 committed, `npm run critical && CI=true npm test -- --watchAll=false && npm run build` green, manual desktop smoke pass confirms zero visual change. This can ship to production independently before Increment B starts, per the plan's Alternative B rejection (don't bundle extraction risk with redesign risk).

---

## Increment B — The redesign

Everything visible changes here. One deploy, one on-device QA round (per the plan's Alternative D rejection — the surface already has seven unverified deploys; splitting this further makes triage harder, not easier). Work in a separate git worktree per the Budget Phase B pattern this repo already uses (`superpowers:using-git-worktrees`), merge clean, deploy once.

### Task B1: `StopCard` — Row A (identity + actions) and the badge's three states

**Owner:** `builder`

**Files:**
- Modify: `src/components/StopCard.jsx`
- Modify: `src/components/StopCard.test.js`
- Modify: `src/views/EditorView.jsx` (rewire the `<StopCard>` call site's drag prop; delete the now-dead `onHandleDown` function)

**Interfaces:**
- Consumes: `DayStopList`'s existing `beginDrag(pos)` function (`EditorView.jsx:590–595`, confirmed present) — a **zero-argument-at-the-engine-level** entry point already used by `SwipeableRow`'s own long-press-then-move handoff (`EditorView.jsx:1063`: `<SwipeableRow onDragStart={() => beginDrag(pos)} ...>`). `beginDrag` sets `dragRef.current.active = true` and `setDragIdx(pos)`; the list container's existing `onPointerMove={onMove} onPointerUp={onUp}` (`EditorView.jsx:1034`) then drives the reorder purely from bubbled pointer events — no pointer capture or event object required at the trigger site. **This is the exact mechanism `StopCard`'s badge must hook into.**
- Produces: the card container and Row A per spec §4.1–§4.2. The badge becomes the drag handle (planning mode) and the completion toggle (trip mode); `≡` and the separate completion checkbox are deleted (spec §7.1 #1, #3).
- New prop: `onDragStart={()=>void}` (no `pos` argument needed *inside* `StopCard` — the caller closes over `pos`, mirroring the `SwipeableRow` line above exactly) replaces `onHandleDown` on `StopCard`. The badge initiates a drag via `pointerDown` + a 6px movement threshold matching `SwipeableRow`'s existing threshold (`EditorView.jsx:405`), then calls `onDragStart()` — it does **not** call `onHandleDown` or forward the pointer event; the underlying engine (`beginDrag`/`onMove`/`onUp`/`dragRef`) needs neither. `onToggleComplete` keeps its existing signature.
- **`EditorView.jsx` wiring change required by this task** (not deferred to a later task): at the `<StopCard>` render call site established by Task A7, replace `onHandleDown={onHandleDown}` with `onDragStart={() => beginDrag(pos)}`. Then delete the now-unreachable `onHandleDown` function definition (`EditorView.jsx:587–593` in the pre-B1 file — re-locate by content, `const onHandleDown = (pos) => (e) => {`) since its only call site (the `≡` handle, deleted in this task per spec §7.1 #1) is gone. **Do not modify `beginDrag`, `onMove`, `onUp`, `dragRef`, `setDragIdx`, or the container's `onPointerMove`/`onPointerUp` wiring** — this task changes what *triggers* the existing engine, not the engine itself.

Implement per spec §4.1 (container: `P.panel` bg, `1px solid P.line`, radius 14, padding `10px 12px`, min-height 76px) and §4.2 (Row A: badge 32×32 radius 8, name 16px/700 2-line clamp, `ניווט` button un-filled at `P.surface`/`P.ink2` height 44, `⋯` 44×44 transparent). The badge state table (§4.2, five rows: Default / User colour / Lodging / Done / Not-done) and the gesture-split rule (tap toggles complete in trip mode; press+move≥6px starts drag) are both load-bearing — implement every row, not just the default.

- [ ] **Step 1: Write the failing tests** (spec's T-CARD-01, T-CARD-02, T-CARD-03-partial, T-CARD-09 first half)

```js
// src/components/StopCard.test.js — replace the extraction-invariant badge/action assertions with:
import { fireEvent } from "@testing-library/react";
// ...existing imports and baseProps stay; add:

describe("StopCard — Row A redesign", () => {
  it("T-CARD-01: tapping the badge in trip mode toggles complete", () => {
    const onToggleComplete = jest.fn();
    render(<StopCard {...baseProps} tripActive onToggleComplete={onToggleComplete} idx={1} />);
    fireEvent.pointerDown(screen.getByRole("button", { name: /סמנו כבוצע|בטלו סימון ביקור/ }));
    fireEvent.pointerUp(screen.getByRole("button", { name: /סמנו כבוצע|בטלו סימון ביקור/ }));
    expect(onToggleComplete).toHaveBeenCalledWith(1);
  });

  it("T-CARD-02: tapping the badge in planning mode does nothing and does not navigate", () => {
    const onNavigate = jest.fn();
    render(<StopCard {...baseProps} tripActive={false} onNavigate={onNavigate} />);
    const badge = screen.getByRole("button", { name: /תחנה/ });
    fireEvent.pointerDown(badge);
    fireEvent.pointerUp(badge);
    expect(onNavigate).not.toHaveBeenCalled();
  });

  it("T-CARD-03 (partial): press-and-move beyond 6px on the badge fires onDragStart", () => {
    const onDragStart = jest.fn();
    render(<StopCard {...baseProps} onDragStart={onDragStart} />);
    const badge = screen.getByRole("button", { name: /תחנה/ });
    fireEvent.pointerDown(badge, { clientX: 0, clientY: 0 });
    fireEvent.pointerMove(badge, { clientX: 0, clientY: 10 });
    expect(onDragStart).toHaveBeenCalled();
  });

  it("a move under 6px does not start a drag", () => {
    const onDragStart = jest.fn();
    render(<StopCard {...baseProps} onDragStart={onDragStart} />);
    const badge = screen.getByRole("button", { name: /תחנה/ });
    fireEvent.pointerDown(badge, { clientX: 0, clientY: 0 });
    fireEvent.pointerMove(badge, { clientX: 0, clientY: 3 });
    expect(onDragStart).not.toHaveBeenCalled();
  });

  it("T-CARD-09 (first half): read-only hides drag/actions, keeps ניווט", () => {
    render(<StopCard {...baseProps} editable={false} />);
    expect(screen.queryByRole("button", { name: "פעולות" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "ניווט ב-Google Maps" })).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `CI=true npx react-scripts test src/components/StopCard.test.js --watchAll=false`
Expected: FAIL — the current (Task A6) badge is a plain non-interactive `<div>`, not a button with drag/toggle behaviour.

- [ ] **Step 3: Implement Row A per spec §4.1–§4.2**

Read spec §4.1 and §4.2 in full before writing this step — every pixel value, colour token, and the five-row badge state table are specified there and must be implemented exactly, including the `aria-label`/`aria-roledescription` pattern in the "Semantics" table row (`"תחנה 3, בורג' ח'ליפה — גררו לשינוי סדר"` in planning mode, `aria-pressed`-based in trip mode) and the pointer-capture guard (`try { e.target.setPointerCapture?.(e.pointerId); } catch {}`, matching `EditorView.jsx:593`'s existing pattern, needed because jsdom has no `setPointerCapture` and T-CARD-03 must still run in Jest).

Add `import { LIGHT } from "../utils/theme";` to `StopCard.jsx`'s existing import list (it currently has `React`, `Icon`, `readableInkOn`, `mapsUrlFor` from Task A6) — needed for the `P === LIGHT` dark-shadow branch below.

Container becomes:

```jsx
<div style={{
  background: P.panel, border: `1px solid ${dragging ? "transparent" : P.line}`, borderRadius: 14,
  padding: "10px 12px", marginBlockEnd: 8, minHeight: 76,
  boxShadow: dragging
    ? (P === LIGHT ? "0 10px 30px rgba(0,0,0,0.16)" : "0 10px 30px rgba(0,0,0,0.55)")
    : "none",
  borderColor: dragging && P !== LIGHT ? P.accent : undefined,
  transform: dragging ? "scale(1.02)" : "scale(1)",
  transition: dragging ? "none" : "transform 200ms, box-shadow 200ms, background 200ms",
}}>
```

This implements spec §5.8 (dragging state) directly in this task, since Row A is where the drag gesture now originates (the badge) — do not defer it to Task B4, which only touches `TransitConnector`. `dragging` is the existing prop threaded since Task A6 (`pos != null && dragIdx === pos`, computed by the `EditorView.jsx` caller). Non-dragged siblings get no motion, matching the existing reorder model — this is a read of the same `dragging` prop, not new state.

Badge becomes a `<button>` with the pointer handlers described above; on `pointerUp` with no movement beyond threshold, call `onToggleComplete(idx)` only when `tripActive` (or `liveOps`) is true — otherwise it is a no-op (still absorbs the tap so it never falls through to `onNavigate`). Give the badge, `ניווט`, and `⋯` explicit `outline: 2px solid P.accent; outline-offset: 2px` on `:focus-visible` (spec §5.10) — this is the one styling detail from §5.10 that belongs in this task; the rest of §5.10's tab-order table (badge → card body → ניווט → ⋯ → cost → files → note) falls out naturally from DOM order across Tasks B1–B3 and needs no special wiring, since none of these controls set an explicit `tabIndex`.

**§4.9 breakpoint — `ניווט` icon-only at ≤359px.** Implement via a `ResizeObserver`-free CSS approach: give the card's root a `container-type: inline-size` is unavailable in this codebase's target browsers today (no other component uses CSS container queries — check `DESIGN.md` before introducing the first one), so instead read `window.innerWidth <= 359` with the existing `useState`/`resize`-listener pattern already used elsewhere in the editor (grep `window.innerWidth` in `EditorView.jsx`/`EditorBottomBar.jsx` for the established pattern before writing a new one), and pass the result down as a `compact` prop from `EditorView.jsx` to `StopCard`. When `compact`, render the `ניווט` button with no text label, `width: 44` fixed, icon-only — `aria-label`/`title` stay `"ניווט ב-Google Maps"` unchanged. Add one test: `it("renders ניווט icon-only when compact", () => { render(<StopCard {...baseProps} compact />); expect(screen.getByRole("button", { name: "ניווט ב-Google Maps" }).textContent).not.toMatch(/ניווט/); });`

- [ ] **Step 4: Run `StopCard` tests to verify they pass**

Run: `CI=true npx react-scripts test src/components/StopCard.test.js --watchAll=false`
Expected: PASS

- [ ] **Step 5: Rewire `EditorView.jsx` to the new drag trigger, delete dead code**

At the `<StopCard>` render call site (established in Task A7, inside `DayStopList`), replace `onHandleDown={onHandleDown}` with `onDragStart={() => beginDrag(pos)}` — same `pos` variable already in scope there. Delete the `onHandleDown` function (search for `const onHandleDown = (pos) => (e) => {`, was `:587–593` pre-extraction) — confirm via search that it has no other call sites before deleting (Task A7's removal of the `≡` handle already eliminated its only usage inside `renderPlaceRow`/`StopCard`).

- [ ] **Step 6: Run the full suite + build**

Run: `npm run critical && CI=true npm test -- --watchAll=false && npm run build`
Expected: all green. `beginDrag`, `onMove`, `onUp` are unchanged, so any pre-existing drag-related test (if one exists for `DayStopList`) must still pass unmodified — a failure here means Step 5 touched more than the two intended edits.

- [ ] **Step 7: Manual smoke on desktop dev server**

Run: `npm start`, open a day with 3+ stops, press-and-drag the badge on a card, confirm it reorders exactly as the old `≡` handle did (same visual lift/shadow, same drop behavior). Tap the badge (no movement) in trip mode, confirm it toggles completion and does not start a drag.

- [ ] **Step 8: Commit**

```bash
git add src/components/StopCard.jsx src/components/StopCard.test.js src/views/EditorView.jsx
git commit -m "feat(stop-card): redesign Row A — badge absorbs drag+completion, slimmer actions

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task B2: `StopCard` — Row B metadata line, including cost (T-CARD-04, T-CARD-06, T-CARD-07)

**Owner:** `builder`

**Files:**
- Modify: `src/components/StopCard.jsx`
- Modify: `src/components/StopCard.test.js`

**Interfaces:**
- Consumes: `stopCostSummary` output shape from Task A2/A3 (passed in as a new prop `costSummary={{count, primary, effectiveMinor, plannedMinor, currency, paid, over} | null}` — **`StopCard` does not call `costForStop` itself**; the caller in `EditorView.jsx` computes it once per render and passes it down, so the card stays a pure presentational component per spec §8.7).
- New prop: `showCost={bool}` — when `false` (read-only + `!settings.budgetShared`), the cost item never renders regardless of `costSummary`.
- New prop: `onOpenCost={(idx)=>void}`.
- Produces: Row B per spec §4.3 — category, normalised rating (via `normalizeRating`, Task A4), cost (via `<Money>`), file count, reserved-but-dark open-hours slot. **No chip fills** — plain text line with `·` separators. Row B is omitted entirely when nothing would render (spec §4.3 "Sparse rule" / §5.1).

- [ ] **Step 1: Write the failing tests**

```js
// src/components/StopCard.test.js — add
import Money from "./Money"; // not used directly, but confirms the dependency exists

describe("StopCard — Row B metadata", () => {
  it("T-CARD-04: tapping the cost item calls onOpenCost, not onNavigate", () => {
    const onOpenCost = jest.fn();
    const onNavigate = jest.fn();
    const costSummary = { count: 1, primary: { id: "e1" }, effectiveMinor: 12000, plannedMinor: 12000, currency: "ILS", paid: false, over: false };
    render(<StopCard {...baseProps} idx={4} costSummary={costSummary} showCost onOpenCost={onOpenCost} onNavigate={onNavigate} />);
    fireEvent.click(screen.getByRole("button", { name: /עלות/ }));
    expect(onOpenCost).toHaveBeenCalledWith(4);
    expect(onNavigate).not.toHaveBeenCalled();
  });

  it("T-CARD-06: renders the summary's effectiveMinor, not a per-item recompute", () => {
    const costSummary = { count: 2, primary: { id: "e1" }, effectiveMinor: 9000, plannedMinor: 8000, currency: "ILS", paid: true, over: true };
    render(<StopCard {...baseProps} costSummary={costSummary} showCost />);
    expect(screen.getByText("×2", { exact: false })).toBeInTheDocument();
  });

  it("T-CARD-07: a stop with no cost renders no cost item and does not throw", () => {
    const spy = jest.spyOn(console, "error").mockImplementation(() => {});
    render(<StopCard {...baseProps} costSummary={null} showCost />);
    expect(screen.queryByRole("button", { name: /עלות/ })).not.toBeInTheDocument();
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });

  it("does not render a cost item when showCost is false, even with a costSummary", () => {
    const costSummary = { count: 1, primary: { id: "e1" }, effectiveMinor: 12000, plannedMinor: 12000, currency: "ILS", paid: false, over: false };
    render(<StopCard {...baseProps} costSummary={costSummary} showCost={false} />);
    expect(screen.queryByRole("button", { name: /עלות/ })).not.toBeInTheDocument();
  });

  it("T-CARD-08: a bare Google 0-5 rating normalises for display", () => {
    render(<StopCard {...baseProps} stop={{ ...baseStop, rating: 4.6 }} />);
    expect(screen.getByText(/9\.2/)).toBeInTheDocument();
  });

  it("sparse: no rating/cost/files/note/category renders Row B as absent", () => {
    render(<StopCard {...baseProps} stop={{ instanceId: "i1", nameHe: "שוק" }} costSummary={null} showCost />);
    expect(screen.queryByText("·")).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `CI=true npx react-scripts test src/components/StopCard.test.js --watchAll=false`
Expected: FAIL — `costSummary`/`onOpenCost`/`showCost` props do not exist yet, no Row B.

- [ ] **Step 3: Implement Row B per spec §4.3, §4.5**

Read spec §4.3 (the five-item metadata table: category / rating / cost / files / hours) and §4.5 (the six-row cost-state table: no-cost / planned / paid / paid-under / over / multiple) in full — they are the exhaustive source for every colour and copy decision in this step. Key structural points not to improvise:

- Rating uses `normalizeRating(a.rating)` (Task A4), not the raw `a.rating` string the old card printed.
- The `CORAL` accent is deleted from this row entirely (spec §2.3/§4.3 "Emphasis rule") — high ratings are marked by weight/tone only (`P.ink2` 700 vs `P.ink3` 600), never by colour.
- Cost item renders `<Money minor={costSummary.effectiveMinor} currency={costSummary.currency} P={P} style={{ fontWeight: 700 }} />` (note: `style` override for 700, since `Money`'s `bold` prop only offers 600/800 — do not add a `weight` prop to `Money.jsx`, this is a `StopCard`-local override per the plan's architect notes) wrapped in a `<button onClick={() => onOpenCost?.(idx)}>`, colour `P.ink2` normally, `P.danger` when `costSummary.over`. When `costSummary.count > 1`, append ` ×${costSummary.count}` in `P.ink3` 11px.
- Files item: `<Icon name="paperclip" size={12} />` + count, only when `(a.attachments?.length ?? 0) > 0`.
- Open-hours item: nothing renders (no data source exists — spec §9 Q1, decided "wait"). Do not add a placeholder dash or "—".

- [ ] **Step 4: Run tests to verify they pass**

Run: `CI=true npx react-scripts test src/components/StopCard.test.js --watchAll=false`
Expected: PASS

- [ ] **Step 5: Run the full suite + build**

Run: `npm run critical && CI=true npm test -- --watchAll=false && npm run build`

- [ ] **Step 6: Commit**

```bash
git add src/components/StopCard.jsx src/components/StopCard.test.js
git commit -m "feat(stop-card): add Row B metadata line — category/rating/cost/files

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task B3: `StopCard` — Row C note preview, files sheet `focusStop`

**Owner:** `builder`

**Files:**
- Modify: `src/components/StopCard.jsx`
- Modify: `src/components/StopCard.test.js`
- Modify: `src/components/TripFilesSheet.jsx` (new optional `focusStop` prop)
- Modify: `src/components/TripFilesSheet.test.js` (create the file if none exists — check first)

**Interfaces:**
- `StopCard` produces Row C per spec §4.4: renders only when a note exists (checking the four legacy field names, matching the old card's `a.note || a.comment || a.annotation || a.quote`), plain text with a leading `Icon name="note"`, **no background fill** (the grey ticket is deleted — spec §2.4, §7.1 #6). The note button that used to sit in the action row is deleted (spec §3.3, §7.2 — owner-confirmed 2026-09-11).
- Files tap routing: 1 attached file → `onOpenAttachment(file, idx, 0)` (existing signature, unchanged). >1 file → a new `onOpenFiles={(idx)=>void}` prop that the `EditorView.jsx` wiring (Task B5) turns into opening `TripFilesSheet` with `focusStop={{ day: activeDay, stopIdx: idx }}`.
- `TripFilesSheet` produces: on mount/open with a `focusStop` prop set, scroll the matching row into view and apply a highlight class for ~1.5s. Match by the row's existing key shape `${dayNum}:${stopIdx}:${fi}` (confirmed present at `TripFilesSheet.jsx:116`) — filter on `dayNum === focusStop.day && stopIdx === focusStop.stopIdx` (any `fi`), scroll the first match.

- [ ] **Step 1: Write the failing tests**

```js
// src/components/StopCard.test.js — add
describe("StopCard — Row C note preview", () => {
  it("renders the note preview when a note exists, no separate note button", () => {
    render(<StopCard {...baseProps} stop={{ ...baseStop, note: "ביקשתי חדר גבוה" }} />);
    expect(screen.getByText("ביקשתי חדר גבוה")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^הוספת הערה$/ })).not.toBeInTheDocument();
  });

  it("renders nothing for Row C when there is no note", () => {
    render(<StopCard {...baseProps} stop={{ ...baseStop, note: undefined }} />);
    expect(screen.queryByText(/הוספת הערה/)).not.toBeInTheDocument();
  });

  it("tapping the note preview calls onEditNote(idx)", () => {
    const onEditNote = jest.fn();
    render(<StopCard {...baseProps} idx={5} onEditNote={onEditNote} stop={{ ...baseStop, note: "צ'ק-אין מ-15:00" }} />);
    fireEvent.click(screen.getByText("צ'ק-אין מ-15:00"));
    expect(onEditNote).toHaveBeenCalledWith(5);
  });

  it("one attachment opens AttachmentViewer via onOpenAttachment", () => {
    const onOpenAttachment = jest.fn();
    const stop = { ...baseStop, attachments: [{ name: "receipt.pdf" }] };
    render(<StopCard {...baseProps} idx={1} stop={stop} onOpenAttachment={onOpenAttachment} />);
    fireEvent.click(screen.getByRole("button", { name: /1/ }));
    expect(onOpenAttachment).toHaveBeenCalledWith(stop.attachments[0], 1, 0);
  });

  it("multiple attachments call onOpenFiles(idx) instead", () => {
    const onOpenFiles = jest.fn();
    const stop = { ...baseStop, attachments: [{ name: "a.pdf" }, { name: "b.pdf" }] };
    render(<StopCard {...baseProps} idx={1} stop={stop} onOpenFiles={onOpenFiles} />);
    fireEvent.click(screen.getByRole("button", { name: /2/ }));
    expect(onOpenFiles).toHaveBeenCalledWith(1);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `CI=true npx react-scripts test src/components/StopCard.test.js --watchAll=false`
Expected: FAIL.

- [ ] **Step 3: Implement Row C, delete the old note button**

Remove the note-button `<button>` from Row A entirely (it was added in Task A6's port, in the action-row block — delete it now). Add Row C below Row B per spec §4.4: plain-text block, `Icon name="note"` leading, 1-line clamp (2 at ≥480px — implement via a CSS class rather than inline `WebkitLineClamp` with a media query, matching how `StopCard.jsx` already handles the 2-line name clamp with inline styles for the base case, and accept the 2-line variant as a follow-up CSS concern for `ui-impeccable` rather than blocking this task on a media-query-in-JS solution). The files metadata item (Row B, Task B2) already dispatches to `onOpenAttachment`/`onOpenFiles` based on count — this task adds the `onOpenFiles` branch there if Task B2 only wired `onOpenAttachment`.

- [ ] **Step 4: Run `StopCard` tests to verify they pass**

Run: `CI=true npx react-scripts test src/components/StopCard.test.js --watchAll=false`

- [ ] **Step 5: Write the failing `TripFilesSheet` test**

```js
// src/components/TripFilesSheet.test.js — add (create file with existing imports if new)
it("scrolls to and highlights the row matching focusStop", () => {
  const scrollIntoView = jest.fn();
  window.HTMLElement.prototype.scrollIntoView = scrollIntoView;
  const files = []; // shape per buildFileGroups — use whatever fixture the existing suite already has, or a minimal one row of kind:"stop", dayNum:2, stopIdx:1
  render(<TripFilesSheet /* ...required props with a stop-kind row at dayNum:2, stopIdx:1... */ focusStop={{ day: 2, stopIdx: 1 }} />);
  expect(scrollIntoView).toHaveBeenCalled();
});
```

Adapt this to whatever fixture pattern `TripFilesSheet`'s existing tests (if any) already use for `files`/`dayCount` props — read the component's full prop list (`:13` onward) before writing the fixture, since this plan has not read the whole file.

- [ ] **Step 6: Implement `focusStop` in `TripFilesSheet.jsx`**

Add a `useEffect` keyed on the `focusStop` prop: find the row whose `dayNum === focusStop.day && stopIdx === focusStop.stopIdx`, call `.scrollIntoView({ behavior: "smooth", block: "center" })` on its ref, and toggle a `highlighted` boolean in local state for ~1500ms that adds a background-flash class/style. No new grouping — this is scroll-and-highlight only, per spec §4.6.

- [ ] **Step 7: Run the full suite + build**

Run: `npm run critical && CI=true npm test -- --watchAll=false && npm run build`

- [ ] **Step 8: Commit**

```bash
git add src/components/StopCard.jsx src/components/StopCard.test.js src/components/TripFilesSheet.jsx src/components/TripFilesSheet.test.js
git commit -m "feat(stop-card): Row C note preview, delete note button, files sheet focusStop

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task B4: `TransitConnector` redesign + insert-track tokenisation

**Owner:** `builder`

**Files:**
- Modify: `src/components/TransitConnector.jsx`
- Modify: `src/components/TransitConnector.test.js`
- Modify: `src/views/EditorView.jsx` (`renderInsertBtn`, `:645–654` in the pre-extraction file — re-locate by content since line numbers have shifted)

**Interfaces:**
- No prop-shape change to `TransitConnector` (still `a, b, override, onSetMode, units, editable, P`) — this task is pure visual redesign inside the existing contract.
- Produces: axis-centred 44px-hit/28px-visible pill (spec §4.7), visible Hebrew mode labels in the popover instead of `title`-only (spec §4.7 "Mode menu"), `Icon` glyphs (`walk`/`car`/`train`/`bus`) replacing the four emoji, hover-inversion deleted (unreachable on touch), overridden-mode marked by icon colour not a border.

- [ ] **Step 1: Write the failing tests**

```js
// src/components/TransitConnector.test.js — add
describe("TransitConnector — redesign", () => {
  it("mode menu shows visible Hebrew labels, not only title attributes", () => {
    render(<TransitConnector a={a} b={b} units="km" editable onSetMode={jest.fn()} P={LIGHT} />);
    fireEvent.click(screen.getByRole("button", { name: /שינוי אופן המעבר/ }));
    expect(screen.getByText("הליכה")).toBeVisible();
    expect(screen.getByText("רכב / מונית")).toBeVisible();
  });

  it("read-only renders a span with no chevron and no button role", () => {
    render(<TransitConnector a={a} b={b} units="km" editable={false} P={LIGHT} />);
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    expect(screen.queryByText("▾")).not.toBeInTheDocument();
  });

  it("an overridden mode does not render an accent border container (icon-only marker)", () => {
    const { container } = render(<TransitConnector a={a} b={b} override="car" units="km" editable P={LIGHT} />);
    const pill = container.querySelector('[aria-haspopup="menu"]');
    expect(pill.style.border).not.toMatch(/E0533F/); // P.accent — border must not carry it anymore
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `CI=true npx react-scripts test src/components/TransitConnector.test.js --watchAll=false`
Expected: FAIL.

- [ ] **Step 3: Implement per spec §4.7**

Read spec §4.7 in full (the connector property table + "Mode menu" subsection). Key changes from the Task A5 verbatim version: delete the `hover`/`setHover` state and the emoji `seg.emoji`/`m.emoji` renders, replace with `<Icon name={modeIconFor(seg.mode)} size={13} />` (add a small local `modeIconFor(mode)` map: `walk→"walk", car→"car", transit→"train", bus→"bus"`); the popover's 4 items become `48×56` with the icon above a visible `10px/700` Hebrew label (no more `title`-only); the override marker moves from the pill's `border` to the icon's `color` (`P.accent` when `override` is set, `P.ink3` otherwise); delete the `active`/hover-inversion branch entirely — the pill has exactly two visual states now (default, `menuOpen`), no third hover state.

- [ ] **Step 4: Run tests to verify they pass**

Run: `CI=true npx react-scripts test src/components/TransitConnector.test.js --watchAll=false`

- [ ] **Step 5: Tokenise the insert-track `+` button**

In `EditorView.jsx`, find `renderInsertBtn` (search for `הוספה כאן` — the content moved during Task A7's edits, do not rely on the old `:645–654` line numbers). Replace the hard-coded `background: "#E4E4E8"` axis-line colour with `P.line`, and give the `<button>` a real 44×44 box: wrap the existing 18px `+` glyph in `padding: 11px; margin: -11px` (or equivalent) so the touch target grows without the visual glyph changing size. Keep the camouflaged/transparent treatment — this is a target-size fix, not a redesign (spec §4.8, explicitly "keep the camouflaged treatment").

- [ ] **Step 6: Run the full suite + build**

Run: `npm run critical && CI=true npm test -- --watchAll=false && npm run build`

- [ ] **Step 7: Commit**

```bash
git add src/components/TransitConnector.jsx src/components/TransitConnector.test.js src/views/EditorView.jsx
git commit -m "feat(transit-connector): redesign as axis connector, visible mode labels, 44px insert target

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task B5: F1 — merge long-press into `StopActionsSheet`, delete the bespoke context menu

**Owner:** `builder`

**Files:**
- Modify: `src/views/EditorView.jsx` (delete `ctxMenu` block `:4000–4058`-region, `THEMES` const, `ctxSub` state; repoint `onOpenContextMenu`; fix the `overlayOpen` invariant; change `onSetNote` wiring)
- Modify: `src/components/StopActionsSheet.jsx` (new `tripActive` prop, add the "העבר ליום הבא" row)
- Modify: `src/components/StopActionsSheet.test.js` (existing file — add cases)

**Interfaces:**
- Consumes: `saveNoteAt(index, text)` (existing, `EditorView.jsx:2011`) replaces `setStopNote` (existing, `:2494`) as the function passed to `StopActionsSheet`'s `onSetNote` — per spec §3.3, this restores the multi-day-hotel cascade prompt on the note-edit path, which the deleted long-press menu used to preserve and the `⋯` path previously did not.
- Produces: `StopActionsSheet` gains `tripActive={bool}` and `onMoveNextDay` (already exists as a prop, confirmed at `EditorView.jsx:4700` — check whether it's already rendered as a row in the sheet or only passed and unused; if unused, this task adds the row, gated on `tripActive`).

- [ ] **Step 1: Write the failing tests**

```js
// src/components/StopActionsSheet.test.js — add
describe("StopActionsSheet — trip-mode move-to-next-day row (F1 merge)", () => {
  it("shows the move-to-next-day row when tripActive is true", () => {
    render(<StopActionsSheet stop={{}} onMoveNextDay={jest.fn()} tripActive onClose={jest.fn()} />);
    expect(screen.getByText("העבר ליום הבא")).toBeInTheDocument();
  });
  it("hides the move-to-next-day row when tripActive is false", () => {
    render(<StopActionsSheet stop={{}} onMoveNextDay={jest.fn()} tripActive={false} onClose={jest.fn()} />);
    expect(screen.queryByText("העבר ליום הבא")).not.toBeInTheDocument();
  });
  it("T-CARD-11 (sheet half): the note row still reaches onSetNote with the draft", () => {
    const onSetNote = jest.fn();
    render(<StopActionsSheet stop={{ note: "ישן" }} onSetNote={onSetNote} onClose={jest.fn()} />);
    const input = screen.getByDisplayValue("ישן");
    fireEvent.change(input, { target: { value: "חדש" } });
    fireEvent.click(screen.getByText(/שמור|עדכון/));
    expect(onSetNote).toHaveBeenCalledWith("חדש");
  });
});
```

(The exact save-button label in the last test depends on `StopActionsSheet.jsx`'s current note-editing markup — read `:225–240` before finalizing the query; the plan's architect notes cite `:225` as the placeholder text location, use that as the anchor.)

- [ ] **Step 2: Run tests to verify they fail**

Run: `CI=true npx react-scripts test src/components/StopActionsSheet.test.js --watchAll=false`
Expected: FAIL — no `tripActive` prop handling yet.

- [ ] **Step 3: Add `tripActive` + the move-to-next-day row to `StopActionsSheet.jsx`**

Add `tripActive = false` to the destructured props (`:59`). Add a new row as the first item of the "מיקום בלוח הזמנים" section (spec §3.2, §7.1 #4):

```jsx
{tripActive && onMoveNextDay && (
  <Row icon="➡️" label="העבר ליום הבא" onClick={onMoveNextDay} />
)}
```

(Adapt to whatever the file's existing `Row`/section-item component signature is — read the surrounding rows, e.g. the `onSetCost` row at `:280–282`, for the exact pattern before writing this.)

- [ ] **Step 4: Run `StopActionsSheet` tests to verify they pass**

Run: `CI=true npx react-scripts test src/components/StopActionsSheet.test.js --watchAll=false`

- [ ] **Step 5: In `EditorView.jsx`, repoint long-press to `StopActionsSheet`**

Find `onOpenContextMenu={(idx, x, y) => { setCtxSub(null); setCtxMenu({ idx, x, y }); }}` (was `:3812` pre-extraction, re-locate by content). Replace with `onOpenContextMenu={(idx) => setActionsIdx(idx)}` (drop the unused `x, y` params — the sheet is bottom-anchored, not positioned at the long-press coordinates, per spec §3.3).

- [ ] **Step 6: Delete the `ctxMenu` block and `THEMES`/`ctxSub` state**

Delete the entire block starting `{ctxMenu && activeDayData?.attractions?.[ctxMenu.idx] && (() => { ... })()}` (was `:4000–4058`) including the `THEMES` const inside it. Delete `const [ctxMenu, setCtxMenu] = useState(null);` and `const [ctxSub, setCtxSub] = useState(null);` (was `:1190–1191`).

- [ ] **Step 7: Fix the `overlayOpen` invariant (F24)**

Find the `overlayOpen` computation (was `:1417`): `const overlayOpen = actionsIdx >= 0 || summaryOpen || insertAt >= 0 || !!ctxMenu || datesModalOpen || ...`. Remove the `|| !!ctxMenu` term — `actionsIdx >= 0` now covers the route long-press takes too, since Step 5 makes long-press set `actionsIdx` directly. **Verify this by reading the full invariant line and every consumer of `overlayOpen`** (the grep during planning found six consumers at `:3105, 3141, 3166, 3189, 3442, 3480`) before committing to the removal — do not assume, confirm each still behaves correctly with `ctxMenu` gone.

- [ ] **Step 8: Change the note-edit wiring**

Find `onSetNote={setStopNote}` (was `:4696`, in the `StopActionsSheet` render block). Replace with:

```jsx
onSetNote={(text) => { saveNoteAt(actionsIdx, text); setActionsIdx(-1); }}
```

This is the spec §3.3 decision: the sheet's note row adopts `saveNoteAt` (which raises the multi-day cascade prompt), and `setStopNote` (silent single-instance write) is no longer reachable from this path. Also pass `tripActive={tripActive}` to the `<StopActionsSheet>` render block (Step 5's context — locate the render block, was `:4688–4730`).

- [ ] **Step 9: Static test — T-CARD-10**

```js
// somewhere appropriate — e.g. a small new test file or appended to an existing EditorView-adjacent test
it("T-CARD-10: EditorView no longer contains the deleted context-menu state", () => {
  const fs = require("fs");
  const src = fs.readFileSync(require.resolve("../views/EditorView.jsx"), "utf8");
  expect(src).not.toMatch(/ctxSub/);
  expect(src).not.toMatch(/const THEMES = /);
});
```

Place this in whatever test file the repo's existing convention favours for source-scan assertions (spec §8's T-CARD-12 RTL scan is the closest precedent — mirror its file location once you find it, likely alongside `StopCard.test.js` or a dedicated `EditorView.sourceScan.test.js`).

- [ ] **Step 10: Run the full suite + build**

Run: `npm run critical && CI=true npm test -- --watchAll=false && npm run build`

- [ ] **Step 11: Manual smoke on desktop dev server**

Run: `npm start`. Long-press (or right-click-and-hold, whatever the desktop equivalent trigger is in `EditorDesktop.jsx` — note this task only touches `EditorView.jsx`/mobile; confirm `EditorDesktop.jsx`'s own separate context menu at `:1457` is untouched and still works, since it is a different code path per the plan's file list) a stop on mobile view, confirm it opens the same `StopActionsSheet` the `⋯` button opens, confirm colour-picker (still in the sheet, unchanged) and note-edit (now via `saveNoteAt`) both work.

- [ ] **Step 12: Commit**

```bash
git add src/views/EditorView.jsx src/components/StopActionsSheet.jsx src/components/StopActionsSheet.test.js
git commit -m "fix(editor): F1 — merge long-press into StopActionsSheet, delete bespoke context menu

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task B6: Wire cost/read-only gating and the rating-writer fix into `EditorView.jsx`

**Owner:** `builder`

**Files:**
- Modify: `src/views/EditorView.jsx`

**Interfaces:**
- Consumes: `stopCostSummary`/`costForStop` (Task A2/A3), `normalizeRating` (Task A4), `StopCard`'s `costSummary`/`showCost`/`onOpenCost`/`onOpenFiles` props (Task B2/B3).

- [ ] **Step 1: Compute and pass `costSummary`/`showCost` at the `StopCard` call site**

At the `<StopCard ...>` render (Task A7's location), add:

```jsx
costSummary={a.instanceId ? costForStop(a.instanceId) : null}
showCost={editable || !!trip?.settings?.budgetShared}
onOpenCost={(idx) => { setCostFor({ day: activeDay, idx }); }}
onOpenFiles={(idx) => { setFilesFocusStop({ day: activeDay, stopIdx: idx }); setFilesSheetOpen(true); }}
```

`setCostFor` already exists (used at the `StopActionsSheet`'s `onSetCost`, was `:4722`) — reuse it, do not add a second cost-editing entry point. `setFilesFocusStop`/`filesSheetOpen` are new state this task introduces: `const [filesFocusStop, setFilesFocusStop] = useState(null);` near the other Sprint-65 files state (was around `:2172–2184`). Wire `focusStop={filesFocusStop}` into the existing `<TripFilesSheet>` render call.

- [ ] **Step 2: Fix the rating writer at `addNearbyToDay`**

Find the function (was `EditorView.jsx:1611`, confirmed by grep during planning to emit a raw Google `4.6`-style number). Wrap the rating assignment: change whatever currently sets the new stop's `rating` field to `rating: ratingToBadge(r.rating)` (import `ratingToBadge` from `../utils/classify` if not already imported — check the existing import list first, `dedupeDayStops, categoryEmoji, classifyLocation, withFreshInstanceId` are already imported from that module at `:23`, add `ratingToBadge` to that list).

**Do not touch `addOverlayPoints` (was `:1979`)** — it already emits a correct `"X/10"` string; running it through `ratingToBadge` would return `null` (the function's `isNaN` guard rejects non-numeric strings) and silently delete every overlay-imported rating. This is the plan's explicit correction to spec §8.5.

- [ ] **Step 3: Write the regression test**

```js
// src/utils/classify.test.js — this is really testing the writer's behaviour end to end,
// but classify.test.js already covers ratingToBadge/normalizeRating individually (Task A4).
// The end-to-end assertion (T-CARD-08's second half) belongs in whatever test exercises
// addNearbyToDay's output shape — if none exists, add a minimal one:
it("T-CARD-08 (writer half): a raw Google rating passed through ratingToBadge becomes a /10 string", () => {
  const { ratingToBadge } = require("./classify");
  expect(ratingToBadge(4.6)).toBe("9.2/10");
});
```

(This duplicates coverage already in Task A4's `ratingToBadge` tests deliberately, as a named marker that Task B6 Step 2's specific call site is covered — if `addNearbyToDay` has no existing dedicated test file, do not create a large new integration-test harness for it in this task; the unit-level guarantee plus the manual on-device T-CARD-08 check is sufficient, per the plan's existing test-plan split between automated and manual.)

- [ ] **Step 4: Run the full suite + build**

Run: `npm run critical && CI=true npm test -- --watchAll=false && npm run build`

- [ ] **Step 5: Manual smoke on desktop dev server**

Run: `npm start`. Use the nearby-search flow to add a stop, confirm its card shows a `"X.X/10"` rating, not a bare `"4.6"`.

- [ ] **Step 6: Commit**

```bash
git add src/views/EditorView.jsx
git commit -m "feat(editor): wire cost/files/read-only gating into StopCard, fix rating writer at addNearbyToDay

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

**Increment B gate:** Tasks B1–B6 committed, full suite + build green, manual desktop smoke pass on every flow touched (cost tap, files tap, note edit, long-press, nearby-add rating). **Do not deploy yet** — Increment C (§5.4/§5.6) rides with this deploy by default; only skip it under the explicit cut-line condition below.

---

## Increment C — Empty state + loading skeleton

Cheap, cosmetic, zero coupling to B. **Cut line:** if Increment B's tasks ran long, ship B alone and defer C to a follow-up — do not let C delay the B deploy, since B already carries the owner's actual priority (richer stop cards) and B's on-device QA round is the expensive resource to protect.

### Task C1: Empty-day state (spec §5.4)

**Owner:** `builder`

**Files:**
- Modify: `src/views/EditorView.jsx` (was `:3821–3823`, the `"אין תחנות ביום זה עדיין"` string — re-locate by content)
- Create or modify: a small test asserting the new copy/structure renders for an empty day (add to whatever existing `EditorView`-adjacent test covers empty states, or skip a dedicated test if none exists and this is purely presentational — verify manually instead per Step 3).

- [ ] **Step 1: Implement per spec §5.4**

Replace the existing empty-day string with the structure spec §5.4 describes: `Icon name="pin" size={28}` in `P.ink4`, title `"היום הזה עוד ריק"` (15px/800/`P.ink2`), body `"חפשו מקום בשורת החיפוש למעלה, או הוסיפו מהבנק"` (13px/500/`P.ink3`, max ~40ch), and a primary 44px button `"הוספת תחנה"` wired to the existing `openAddStop` handler (confirm this handler's exact name by grep — the spec assumes it exists under this name, verify before wiring). Leave the "trip has zero stops at all" variant's string (`"התחילו להוסיף תחנות למסלול"`) untouched per spec §5.4's explicit carve-out.

- [ ] **Step 2: Run the full suite + build**

Run: `npm run critical && CI=true npm test -- --watchAll=false && npm run build`

- [ ] **Step 3: Manual verification**

Run: `npm start`, navigate to a day with zero stops, confirm the new empty state renders and the "הוספת תחנה" button opens the add-stop flow.

- [ ] **Step 4: Commit**

```bash
git add src/views/EditorView.jsx
git commit -m "feat(editor): redesigned empty-day state per stop-card spec §5.4

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task C2: Loading skeleton (spec §5.6)

**Owner:** `builder`

**Files:**
- Modify: `src/views/EditorView.jsx` (the existing loading-skeleton block, was `:4732–4736` pre-extraction — a single generic bar; re-locate by content, look for `tpSkeleton` keyframe usage)

- [ ] **Step 1: Implement per spec §5.6**

Replace the single generic loading bar with three skeleton card shells matching `StopCard`'s real geometry: `P.surface` fill, `1px solid P.line`, radius 14, height 76, containing a `32×32` radius-8 block (badge), a `60%×14` block (name), a `40%×10` block (metadata), all in `P.surface2` radius 6. Entry animation `tpFade 0.4s` (the existing `tpSkeleton` keyframe/shimmer approach is explicitly rejected by spec §5.6 — "no shimmer, there is no shimmer keyframe in index.css and adding decorative motion to a loading state violates the register" — use a plain fade, not the existing `tpSkeleton` background-position animation). Add `aria-busy="true"` to the list container and `aria-live="polite"` text `"טוען מסלול…"`. Respect `prefers-reduced-motion` by rendering the static blocks with no fade when that media query is active (check how `EditorView.jsx` or its siblings already detect reduced-motion — the project memory notes a `prefers-reduced-motion` gotcha in the editor loader specifically, so confirm the existing detection mechanism rather than adding a second one).

- [ ] **Step 2: Run the full suite + build**

Run: `npm run critical && CI=true npm test -- --watchAll=false && npm run build`

- [ ] **Step 3: Manual verification**

Run: `npm start`, throttle network (devtools) or add a temporary artificial delay, confirm the three-card skeleton renders during the loading window and fades in cleanly, no shimmer.

- [ ] **Step 4: Commit**

```bash
git add src/views/EditorView.jsx
git commit -m "feat(editor): three-card loading skeleton per stop-card spec §5.6

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## After Increment B (+ C if included) ships

These are not implementation tasks — list them so nothing falls through:

1. **`qa`**: register T-CARD-01..14 in `docs/QA-TEST-PLAN.md` (they are already enumerated in spec §8 and this plan's task tests cover the automatable half; the manual half — T-CARD-03 full, T-CARD-05, T-CARD-11 full, T-CARD-13, T-CARD-14, §5.8 drag visuals, §4.7 popover edge placement — needs the owner's on-device round, piggybacking the outstanding T-BUDGET-27..35 / T-FILES-21..24 / T-BANK-01/02 debt while the phone is in hand).
2. **`ui-impeccable`**: a pass on the full Increment B diff before deploy — RTL/logical CSS spot-check (T-CARD-12 is automated, but a human pass catches what the source-scan can't), dark-mode token completeness (even though it ships off, the `P` values must be correct for when `design-systems` flips it later), contrast spot-checks beyond the ones already computed in the spec.
3. **`copywriter`**: review every Hebrew string this plan introduces or changes — the empty-state pair (Task C1), the cost `aria-label`s (Task B2), the F17 fallback string at (was `EditorView.jsx:4069`, a pre-existing bug noted in spec §6 T9 as "belongs to copywriter, not here").
4. **`deploy-sentinel`**: ship once qa + ui-impeccable + copywriter passes land, or ship now and treat their findings as fast-follow commits — owner's call at that point, not this plan's.
5. **`product-manager`**: reconcile `docs/ROADMAP.md` — move the stop-card sub-bullet (item #1) to בוצע once Increment B is live and on-device QA is scheduled/complete; log any new tech debt this implementation surfaced beyond what the spec/architect already flagged (e.g. if the `DESIGN.md:72` 16–18px vs 14px row-height discrepancy noted in the architect's risk table turns out to matter, or if the badge's three-meaning gesture model needed the §8.1 fallback).
