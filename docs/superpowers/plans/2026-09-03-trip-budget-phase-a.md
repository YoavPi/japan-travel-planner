# Trip Budget — Phase A (engine) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A trip owner can set a budget with optional per-category caps, add and edit expenses, mark them paid (recording a different actual amount when it differed), and see planned / actual / effective against the target on a dedicated screen.

**Architecture:** All money logic lives in one pure module (`src/utils/budget.js`) with no React and no Supabase, exactly mirroring the existing `src/utils/tripFiles.js`. `rollup()` is the single selector every surface reads. The budget is stored in the trip's existing JSONB at `trip.data.budget` — no migration. Its `summary` sub-object is **derived, never authored**: `tripService.saveTrip` re-derives it on any patch carrying `data.budget`, and `rowToTrip` / `toSummary` lift it to `trip.budgetSummary` so it survives the `data` strip that the dashboard grid performs.

**Tech Stack:** React 18 + CRA (`react-scripts`), react-router-dom v6, Jest + @testing-library/react, Supabase (existing client, no schema change).

**Spec:** [`docs/superpowers/specs/2026-09-03-trip-budget-design.md`](../specs/2026-09-03-trip-budget-design.md) — read it alongside this plan.

## Global Constraints

- **Money is integers in minor units.** No floats anywhere. Every test asserts exact integer equality (`toBe`), never `toBeCloseTo`.
- **Zero-decimal currencies exist.** `¥1,200` is `amountMinor: 1200`, not `120000`. Always go through `minorDigits()` / `minorFactor()`.
- **`rollup()` is the only source of budget numbers.** Never hand-compute a total at a call site.
- **Hebrew is the runtime input, so Hebrew is the test input.** `guessCategory` receives Hebrew `attraction.category` values. Test with verbatim strings from `src/data/tripData.js`. (A production bug shipped on exactly this in the AI-focus feature — see `WORKLOG.md`, 2026-09-02.)
- **No DB migration.** No new table, column, or RLS policy.
- **RTL / logical properties only.** `marginInlineStart`, `paddingInlineEnd`, `insetInlineStart`. Never `left` / `right` / `marginLeft`.
- **Theme tokens only,** from `src/utils/theme.js` via `useDarkMode()` → `P`. Never a hard-coded hex in a component. Accent `P.accent`, over-budget `P.danger`.
- **Touch targets ≥ 44×44 px** on every interactive control.
- **`font-variant-numeric: tabular-nums`** on every rendered amount.
- **Over-budget is never signalled by colour alone** — always accompanied by text or an icon (WCAG 2.2 AA).
- **Overlays trap focus and close on `Esc`.**
- **Hebrew UI copy**, first-person-plural-free, no translated feel.
- `npm run critical` must stay green (9/9) at every commit.
- Commit message trailer: `Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>`

## File Structure

| File | Responsibility |
|---|---|
| `src/utils/budget.js` (new) | All money logic: units, formatting, conversion, categories, `rollup`, transforms. Pure. |
| `src/utils/budget.test.js` (new) | Its tests. |
| `src/services/tripService.js` (modify) | Re-derive `data.budget.summary` on write; lift it to `trip.budgetSummary` on read. |
| `src/services/tripService.budget.test.js` (new) | Tests for just that behaviour. |
| `src/hooks/useBudget.js` (new) | React state + optimistic persistence for one trip's budget. |
| `src/hooks/useBudget.test.js` (new) | Its tests. |
| `src/components/Money.jsx` (new) | Presentational amount: bidi-isolated, tabular numerals. |
| `src/components/BudgetSetupSheet.jsx` (new) | Set total, currency, rate, category caps. |
| `src/components/ExpenseSheet.jsx` (new) | Add / edit / delete one expense. |
| `src/components/ExpenseRow.jsx` (new) | One expense row + the paid → "was it different?" → actual flow. |
| `src/views/BudgetView.jsx` (new) | The `/trip/budget/:tripId` screen. Responsive, single file. |
| `src/App.jsx` (modify) | The route. |
| `src/hooks/useEditorState.js` (modify) | Wire `remapExpenseDays` beside `remapFileDays`. |

**One responsive `BudgetView.jsx`, not a `BudgetDesktop.jsx`.** The spec mentions following the `TripOverviewView` / `TripOverviewDesktop` split. That split exists because those two layouts genuinely diverge. The budget screen is a summary block above a grouped list — it responds correctly to a `max-width` container and a grid. Splitting it now would duplicate logic for no gain. If it later diverges, split then.

---

### Task 1: `budget.js` — money primitives, categories, `guessCategory`

**Files:**
- Create: `src/utils/budget.js`
- Test: `src/utils/budget.test.js`

**Interfaces:**
- Consumes: nothing.
- Produces: `MINOR_DIGITS`, `minorDigits(code) → number`, `minorFactor(code) → number`, `CURRENCY_SYMBOL`, `CURRENCIES` (array of `{code,label}`), `parseAmount(text, currency) → number|null`, `formatAmount(minor, currency) → string`, `formatMoney(minor, currency) → string`, `toIlsMinor(minor, currency, config) → number`, `newExpenseId() → string`, `newCategoryKey() → string`, `BASE_CATEGORIES` (array of `{key,label}`), `guessCategory(stopCategory) → string`.

- [ ] **Step 1: Write the failing test**

Create `src/utils/budget.test.js`:

```js
import {
  minorDigits, minorFactor, parseAmount, formatAmount, formatMoney,
  toIlsMinor, newExpenseId, newCategoryKey, BASE_CATEGORIES, guessCategory,
} from "./budget";

describe("minor units", () => {
  test("ILS has 2 decimals, JPY has 0", () => {
    expect(minorDigits("ILS")).toBe(2);
    expect(minorDigits("JPY")).toBe(0);
    expect(minorFactor("ILS")).toBe(100);
    expect(minorFactor("JPY")).toBe(1);
  });

  test("an unknown currency falls back to 2 decimals", () => {
    expect(minorDigits("XYZ")).toBe(2);
  });
});

describe("parseAmount", () => {
  test("ILS: '12.50' → 1250 agorot", () => {
    expect(parseAmount("12.50", "ILS")).toBe(1250);
  });

  test("JPY: '1200' → 1200 (no minor unit)", () => {
    expect(parseAmount("1200", "JPY")).toBe(1200);
  });

  test("strips separators and currency symbols", () => {
    expect(parseAmount("1,234.5", "ILS")).toBe(123450);
    expect(parseAmount("₪ 40", "ILS")).toBe(4000);
  });

  test("rejects junk, negatives and empty input", () => {
    expect(parseAmount("abc", "ILS")).toBeNull();
    expect(parseAmount("-5", "ILS")).toBeNull();
    expect(parseAmount("", "ILS")).toBeNull();
    expect(parseAmount(null, "ILS")).toBeNull();
  });

  test("zero is a valid amount", () => {
    expect(parseAmount("0", "ILS")).toBe(0);
  });
});

describe("formatAmount / formatMoney", () => {
  test("ILS renders two decimals, JPY none", () => {
    expect(formatAmount(123450, "ILS")).toBe("1,234.50");
    expect(formatAmount(1200, "JPY")).toBe("1,200");
  });

  test("formatMoney prefixes the symbol", () => {
    expect(formatMoney(400000, "ILS")).toBe("₪4,000.00");
    expect(formatMoney(1200, "JPY")).toBe("¥1,200");
  });
});

describe("toIlsMinor", () => {
  const config = { currency: "JPY", rate: 0.023 };

  test("an ILS amount passes through untouched", () => {
    expect(toIlsMinor(400000, "ILS", config)).toBe(400000);
  });

  test("¥1,200 at 0.023 → 2760 agorot (₪27.60)", () => {
    expect(toIlsMinor(1200, "JPY", config)).toBe(2760);
  });

  test("a missing or non-positive rate converts to 0 rather than NaN", () => {
    expect(toIlsMinor(1200, "JPY", {})).toBe(0);
    expect(toIlsMinor(1200, "JPY", { rate: 0 })).toBe(0);
  });

  test("the result is always an integer", () => {
    const out = toIlsMinor(1237, "JPY", { rate: 0.0231 });
    expect(Number.isInteger(out)).toBe(true);
  });
});

describe("ids", () => {
  test("expense ids are prefixed and 8 chars", () => {
    const id = newExpenseId();
    expect(id).toMatch(/^e_[a-z0-9]{6}$/);
  });

  test("category keys are prefixed and 8 chars", () => {
    expect(newCategoryKey()).toMatch(/^c_[a-z0-9]{6}$/);
  });
});

describe("BASE_CATEGORIES", () => {
  test("eight categories, insurance included, unique keys", () => {
    expect(BASE_CATEGORIES).toHaveLength(8);
    const keys = BASE_CATEGORIES.map((c) => c.key);
    expect(new Set(keys).size).toBe(8);
    expect(keys).toContain("insurance");
    expect(BASE_CATEGORIES.find((c) => c.key === "insurance").label).toBe("ביטוח");
  });
});

/* HEBREW INPUT. These are verbatim `attraction.category` values from
   src/data/tripData.js — the AI-focus feature shipped a production bug because
   its matcher was tested only in English. Do not translate these. */
describe("guessCategory — real Hebrew stop categories", () => {
  test.each([
    ["מסעדה", "food"],
    ["ראמן", "food"],
    ["סושי", "food"],
    ["בית קפה", "food"],
    ["מלון", "lodging"],
    ["קניות", "shopping"],
    ["מקדש", "attractions"],
    ["מוזיאון", "attractions"],
    ["פארק", "attractions"],
    ["רחוב", "attractions"],
    ["מעבר חציה", "attractions"],
    ["ארקיד משחקים", "attractions"],
    ["אטרקציה", "attractions"],
  ])("%s → %s", (input, expected) => {
    expect(guessCategory(input)).toBe(expected);
  });

  test("transit-ish and flight-ish categories split correctly", () => {
    expect(guessCategory("תחנת רכבת")).toBe("transport");
    expect(guessCategory("שדה תעופה")).toBe("flights");
  });

  test("empty or unknown input falls back to attractions", () => {
    expect(guessCategory("")).toBe("attractions");
    expect(guessCategory(undefined)).toBe("attractions");
    expect(guessCategory("משהו אחר לגמרי")).toBe("attractions");
  });

  test("every returned key is a real base category", () => {
    const keys = new Set(BASE_CATEGORIES.map((c) => c.key));
    for (const c of ["מסעדה", "מלון", "קניות", "מקדש", "תחנת רכבת", "שדה תעופה"]) {
      expect(keys.has(guessCategory(c))).toBe(true);
    }
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `CI=true npx react-scripts test src/utils/budget.test.js --watchAll=false`
Expected: FAIL — `Cannot find module './budget'`.

- [ ] **Step 3: Write the implementation**

Create `src/utils/budget.js`:

```js
/* ══════════════════════════════════════════════════════════════
   budget — pure helpers for trip budgeting.

   The budget lives at trip.data.budget (no schema change, exactly
   like trip.data.files[] for the Files gallery). This module only
   transforms plain data — no React, no Supabase.

   MONEY IS INTEGERS. Every amount is an integer in its currency's
   minor unit (agorot / sen / cents). Floats accumulate rounding
   drift across a sum, and this is money.
   ══════════════════════════════════════════════════════════════ */

/* Minor-unit exponent per currency. JPY and KRW have none — ¥1,200
   is 1200, not 120000. Unknown codes assume 2. */
export const MINOR_DIGITS = {
  ILS: 2, USD: 2, EUR: 2, GBP: 2, AED: 2, THB: 2, CHF: 2, AUD: 2, CAD: 2,
  JPY: 0, KRW: 0, VND: 0,
};

export const minorDigits = (code) => (MINOR_DIGITS[code] ?? 2);
export const minorFactor = (code) => 10 ** minorDigits(code);

export const CURRENCY_SYMBOL = {
  ILS: "₪", USD: "$", EUR: "€", GBP: "£", JPY: "¥", KRW: "₩",
  THB: "฿", VND: "₫", AED: "AED", CHF: "CHF", AUD: "A$", CAD: "C$",
};

/* Offered in the budget-setup currency picker. ILS first — it is the
   home currency and the one every total is denominated in. */
export const CURRENCIES = [
  { code: "ILS", label: "שקל ₪" },
  { code: "JPY", label: "יֵן ¥" },
  { code: "EUR", label: "אירו €" },
  { code: "USD", label: "דולר $" },
  { code: "GBP", label: "לירה שטרלינג £" },
  { code: "THB", label: "באט ฿" },
  { code: "AED", label: "דירהם AED" },
  { code: "KRW", label: "וון ₩" },
  { code: "VND", label: "דונג ₫" },
  { code: "CHF", label: "פרנק שוויצרי CHF" },
];

/* "12.50" → 1250 for ILS; "1200" → 1200 for JPY.
   Returns null for anything that is not a non-negative number. */
export function parseAmount(text, currency) {
  const raw = String(text ?? "").trim();
  if (!raw) return null;
  const cleaned = raw.replace(/[,\s ]/g, "").replace(/[₪$€£¥₩฿₫]/g, "");
  if (!cleaned || !/^\d+(\.\d+)?$/.test(cleaned)) return null;
  const n = Number(cleaned);
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.round(n * minorFactor(currency));
}

/* 123450 ILS-agorot → "1,234.50". Grouping/decimals follow the currency. */
export function formatAmount(minor, currency) {
  if (!Number.isFinite(minor)) return "";
  const d = minorDigits(currency);
  return (minor / minorFactor(currency)).toLocaleString("en-US", {
    minimumFractionDigits: d, maximumFractionDigits: d,
  });
}

export function formatMoney(minor, currency) {
  if (!Number.isFinite(minor)) return "";
  const sym = CURRENCY_SYMBOL[currency] || currency || "";
  return `${sym}${formatAmount(minor, currency)}`;
}

/* An amount expressed in ILS agorot. ILS passes through; anything else
   goes local-minor → local-major → ILS-major → ILS-agorot via the single
   manual config.rate. A missing/invalid rate yields 0, never NaN — a NaN
   would poison every sum downstream. */
export function toIlsMinor(minor, currency, config) {
  if (!Number.isFinite(minor)) return 0;
  if ((currency || "ILS") === "ILS") return Math.round(minor);
  const rate = Number(config?.rate);
  if (!Number.isFinite(rate) || rate <= 0) return 0;
  return Math.round((minor / minorFactor(currency)) * rate * 100);
}

const shortId = () => Math.random().toString(36).slice(2, 8).padEnd(6, "0").slice(0, 6);
export const newExpenseId = () => `e_${shortId()}`;
export const newCategoryKey = () => `c_${shortId()}`;

export const BASE_CATEGORIES = [
  { key: "flights",     label: "טיסות" },
  { key: "lodging",     label: "לינה" },
  { key: "transport",   label: "תחבורה" },
  { key: "food",        label: "אוכל" },
  { key: "attractions", label: "אטרקציות ופעילויות" },
  { key: "shopping",    label: "קניות" },
  { key: "insurance",   label: "ביטוח" },
  { key: "other",       label: "אחר" },
];

/* Stop categories in this app are free-text HEBREW strings written by the
   trip author or returned by Places with language=he ("ראמן", "בית קפה",
   "מקדש"). Order matters: flights is checked before transport so that
   "שדה תעופה" does not fall into ground transit. */
const CATEGORY_HINTS = [
  ["flights",   /טיסה|טיסת|שדה תעופה|נמל תעופה/],
  ["lodging",   /מלון|לינה|אכסני|צימר|הוסטל|ריוקן|אירוח/],
  ["food",      /מסעד|ראמן|סושי|קפה|אוכל|מאפי|קונדיטור|איזקאיה|פיצרי|המבורגר|פאב|ביסטרו|קונביני/],
  ["shopping",  /קניו|קניות|חנות|מרכז מסחרי|אאוטלט|דיוטי פרי/],
  ["transport", /רכבת|תחנת|אוטובוס|מונית|השכרת רכב|מעבורת|כרטיס נסיעה|מטרו/],
];

/* A stop's Hebrew category → a budget category key. Always overridable in
   the UI; this only picks the default. */
export function guessCategory(stopCategory) {
  const s = String(stopCategory || "").trim();
  if (!s) return "attractions";
  for (const [key, re] of CATEGORY_HINTS) if (re.test(s)) return key;
  return "attractions";
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `CI=true npx react-scripts test src/utils/budget.test.js --watchAll=false`
Expected: PASS — all tests green.

- [ ] **Step 5: Commit**

```bash
git add src/utils/budget.js src/utils/budget.test.js
git commit -m "$(cat <<'EOF'
feat(budget): money primitives, category taxonomy, Hebrew guessCategory

Integers in minor units throughout — no floats. Per-currency exponents so
zero-decimal currencies (JPY, KRW) are handled correctly.

guessCategory is tested against verbatim Hebrew category strings from
src/data/tripData.js. The AI-focus feature shipped a production bug that
every English-only unit test passed straight through; this is the same
class of input.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: `budget.js` — `rollup`, `summarize`, `hasBudget`

**Files:**
- Modify: `src/utils/budget.js` (append)
- Test: `src/utils/budget.test.js` (append)

**Interfaces:**
- Consumes: `toIlsMinor`, `BASE_CATEGORIES` from Task 1.
- Produces:
  - `rollup(budget) → { totalIlsMinor, plannedIlsMinor, actualIlsMinor, effectiveIlsMinor, remainingIlsMinor, pct, overBudget, allocatedIlsMinor, unallocatedIlsMinor, byCategory, itemCount }`
  - `byCategory` entries: `{ key, label, capIlsMinor, plannedIlsMinor, actualIlsMinor, effectiveIlsMinor, itemCount, pct, over }`
  - `summarize(budget) → { totalIlsMinor, effectiveIlsMinor, pct, over } | null`
  - `hasBudget(budget) → boolean`

- [ ] **Step 1: Write the failing test**

Append to `src/utils/budget.test.js`:

```js
import { rollup, summarize, hasBudget } from "./budget";

/* ₪15,000 target. Categories: flights capped ₪4,000, food capped ₪2,000,
   lodging declared with no cap. Trip currency JPY at 0.023. */
const budget = {
  config: {
    currency: "JPY", rate: 0.023, totalIlsMinor: 1500000,
    categories: [
      { key: "flights", label: "טיסות", capIlsMinor: 400000 },
      { key: "food",    label: "אוכל",  capIlsMinor: 200000 },
      { key: "lodging", label: "לינה",  capIlsMinor: null },
    ],
  },
  items: [
    /* planned ₪4,000, paid, no different actual → effective ₪4,000 */
    { id: "e_1", label: "טיסה", amountMinor: 400000, currency: "ILS",
      category: "flights", paid: true, actualMinor: null },
    /* planned ¥1,200 = ₪27.60; paid at ¥1,500 = ₪34.50 → effective ₪34.50 */
    { id: "e_2", label: "ראמן", amountMinor: 1200, currency: "JPY",
      category: "food", paid: true, actualMinor: 1500 },
    /* planned ₪320, unpaid → effective ₪320, actual 0 */
    { id: "e_3", label: "ביטוח", amountMinor: 32000, currency: "ILS",
      category: "insurance", paid: false, actualMinor: null },
  ],
};

describe("rollup — the three numbers", () => {
  const r = rollup(budget);

  test("planned sums every item at its planned amount", () => {
    // 400000 + 2760 + 32000
    expect(r.plannedIlsMinor).toBe(434760);
  });

  test("actual sums only paid items, preferring the actual amount", () => {
    // 400000 + 3450
    expect(r.actualIlsMinor).toBe(403450);
  });

  test("effective uses actual where paid, planned where not", () => {
    // 400000 + 3450 + 32000
    expect(r.effectiveIlsMinor).toBe(435450);
  });

  test("remaining is total minus effective", () => {
    expect(r.remainingIlsMinor).toBe(1500000 - 435450);
  });

  test("pct is derived from effective, not planned", () => {
    expect(r.pct).toBe(Math.round((435450 / 1500000) * 100));
  });

  test("not over budget here", () => {
    expect(r.overBudget).toBe(false);
  });

  test("every number is an integer", () => {
    for (const k of ["plannedIlsMinor", "actualIlsMinor", "effectiveIlsMinor",
                     "remainingIlsMinor", "allocatedIlsMinor", "unallocatedIlsMinor"]) {
      expect(Number.isInteger(r[k])).toBe(true);
    }
  });
});

describe("rollup — allocation", () => {
  test("allocated sums declared caps; unallocated is the remainder", () => {
    const r = rollup(budget);
    expect(r.allocatedIlsMinor).toBe(600000);          // 400000 + 200000, lodging has no cap
    expect(r.unallocatedIlsMinor).toBe(900000);        // 1500000 - 600000
  });
});

describe("rollup — byCategory", () => {
  const r = rollup(budget);
  const byKey = Object.fromEntries(r.byCategory.map((c) => [c.key, c]));

  test("a capped category reports its own over state", () => {
    expect(byKey.flights.capIlsMinor).toBe(400000);
    expect(byKey.flights.effectiveIlsMinor).toBe(400000);
    expect(byKey.flights.over).toBe(false);
  });

  test("an uncapped category has cap null, pct null and never reports over", () => {
    const ins = byKey.insurance;
    expect(ins.capIlsMinor).toBeNull();
    expect(ins.pct).toBeNull();
    expect(ins.over).toBe(false);
  });

  test("a category with a cap but no expenses is still listed", () => {
    expect(byKey.lodging).toBeDefined();
    expect(byKey.lodging.itemCount).toBe(0);
  });

  test("a category with neither cap nor expenses is not listed", () => {
    expect(byKey.shopping).toBeUndefined();
  });

  test("labels resolve from config first, then the base taxonomy", () => {
    expect(byKey.flights.label).toBe("טיסות");
    expect(byKey.insurance.label).toBe("ביטוח");   // not declared in config
  });
});

describe("rollup — over budget", () => {
  test("effective above total flips overBudget and makes remaining negative", () => {
    const over = {
      config: { currency: "ILS", rate: 1, totalIlsMinor: 100000, categories: [] },
      items: [{ id: "e_x", amountMinor: 150000, currency: "ILS", category: "other", paid: false }],
    };
    const r = rollup(over);
    expect(r.overBudget).toBe(true);
    expect(r.remainingIlsMinor).toBe(-50000);
  });

  test("a category over its cap is flagged", () => {
    const over = {
      config: { currency: "ILS", rate: 1, totalIlsMinor: 1000000,
                categories: [{ key: "food", label: "אוכל", capIlsMinor: 10000 }] },
      items: [{ id: "e_x", amountMinor: 25000, currency: "ILS", category: "food", paid: false }],
    };
    expect(rollup(over).byCategory.find((c) => c.key === "food").over).toBe(true);
  });
});

describe("rollup — degenerate input", () => {
  test("no total: pct is null and overBudget is false", () => {
    const r = rollup({ config: { currency: "ILS", rate: 1, totalIlsMinor: 0, categories: [] },
                       items: [{ id: "e", amountMinor: 500, currency: "ILS", category: "other" }] });
    expect(r.pct).toBeNull();
    expect(r.overBudget).toBe(false);
    expect(r.effectiveIlsMinor).toBe(500);
  });

  test("null / empty budget returns zeroes, never throws", () => {
    const r = rollup(null);
    expect(r.effectiveIlsMinor).toBe(0);
    expect(r.byCategory).toEqual([]);
    expect(r.itemCount).toBe(0);
  });

  test("an item with an unknown category is bucketed, not dropped", () => {
    const r = rollup({ config: { currency: "ILS", rate: 1, totalIlsMinor: 0, categories: [] },
                       items: [{ id: "e", amountMinor: 700, currency: "ILS", category: "c_ghost" }] });
    expect(r.effectiveIlsMinor).toBe(700);
    expect(r.byCategory.find((c) => c.key === "c_ghost").effectiveIlsMinor).toBe(700);
  });
});

describe("summarize / hasBudget", () => {
  test("summarize carries exactly the four dashboard fields", () => {
    expect(summarize(budget)).toEqual({
      totalIlsMinor: 1500000, effectiveIlsMinor: 435450,
      pct: rollup(budget).pct, over: false,
    });
  });

  test("summarize returns null when there is no budget to speak of", () => {
    expect(summarize(null)).toBeNull();
    expect(summarize({ config: { totalIlsMinor: 0 }, items: [] })).toBeNull();
  });

  test("hasBudget is true with a total OR with items", () => {
    expect(hasBudget(null)).toBe(false);
    expect(hasBudget({ config: { totalIlsMinor: 0 }, items: [] })).toBe(false);
    expect(hasBudget({ config: { totalIlsMinor: 100 }, items: [] })).toBe(true);
    expect(hasBudget({ config: { totalIlsMinor: 0 }, items: [{ id: "e" }] })).toBe(true);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `CI=true npx react-scripts test src/utils/budget.test.js --watchAll=false`
Expected: FAIL — `rollup is not a function`.

- [ ] **Step 3: Write the implementation**

Append to `src/utils/budget.js`:

```js
/* ── Rollup ────────────────────────────────────────────────────
   THE selector. Every surface reads its numbers from here — the
   dedicated screen, the overview card, the dashboard indicator and
   the editor chip. Nothing recomputes a total at a call site; that
   is how indicator surfaces drift apart. */

/* What an item is really going to cost: the actual amount once it is
   paid and known to have differed, otherwise the planned amount. */
const itemEffectiveMinor = (it) =>
  (it.paid && Number.isFinite(it.actualMinor)) ? it.actualMinor : (Number(it.amountMinor) || 0);

export function rollup(budget) {
  const config = budget?.config || {};
  const items = Array.isArray(budget?.items) ? budget.items : [];
  const totalIlsMinor = Number(config.totalIlsMinor) || 0;

  let plannedIlsMinor = 0;
  let actualIlsMinor = 0;
  let effectiveIlsMinor = 0;
  const acc = new Map(); // categoryKey → running totals

  for (const it of items) {
    const cur = it.currency || "ILS";
    const planned = toIlsMinor(Number(it.amountMinor) || 0, cur, config);
    const effective = toIlsMinor(itemEffectiveMinor(it), cur, config);
    const actual = it.paid ? effective : 0;

    plannedIlsMinor += planned;
    actualIlsMinor += actual;
    effectiveIlsMinor += effective;

    const key = it.category || "other";
    const a = acc.get(key) || { planned: 0, actual: 0, effective: 0, count: 0 };
    a.planned += planned; a.actual += actual; a.effective += effective; a.count += 1;
    acc.set(key, a);
  }

  const declared = Array.isArray(config.categories) ? config.categories : [];
  const declaredByKey = new Map(declared.map((c) => [c.key, c]));
  const labelOf = (key) =>
    declaredByKey.get(key)?.label
    || BASE_CATEGORIES.find((c) => c.key === key)?.label
    || "אחר";

  /* Declared categories first (so a capped-but-empty one still shows a bar),
     then any category that only exists because an expense points at it. */
  const keys = [...new Set([...declared.map((c) => c.key), ...acc.keys()])];
  const byCategory = keys.map((key) => {
    const a = acc.get(key) || { planned: 0, actual: 0, effective: 0, count: 0 };
    const capRaw = declaredByKey.get(key)?.capIlsMinor;
    const cap = Number.isFinite(capRaw) && capRaw > 0 ? capRaw : null;
    return {
      key,
      label: labelOf(key),
      capIlsMinor: cap,
      plannedIlsMinor: a.planned,
      actualIlsMinor: a.actual,
      effectiveIlsMinor: a.effective,
      itemCount: a.count,
      pct: cap ? Math.round((a.effective / cap) * 100) : null,
      over: cap ? a.effective > cap : false,
    };
  });

  const allocatedIlsMinor = declared.reduce(
    (s, c) => s + (Number.isFinite(c.capIlsMinor) ? c.capIlsMinor : 0), 0);

  return {
    totalIlsMinor,
    plannedIlsMinor,
    actualIlsMinor,
    effectiveIlsMinor,
    remainingIlsMinor: totalIlsMinor - effectiveIlsMinor,
    pct: totalIlsMinor > 0 ? Math.round((effectiveIlsMinor / totalIlsMinor) * 100) : null,
    overBudget: totalIlsMinor > 0 && effectiveIlsMinor > totalIlsMinor,
    allocatedIlsMinor,
    unallocatedIlsMinor: totalIlsMinor - allocatedIlsMinor,
    byCategory,
    itemCount: items.length,
  };
}

/* The tiny derived object persisted at data.budget.summary so the dashboard
   grid — which never receives `data` — can render its mini-indicator.
   DERIVED, NEVER AUTHORED: tripService re-derives it on every write. */
export function summarize(budget) {
  if (!hasBudget(budget)) return null;
  const r = rollup(budget);
  return {
    totalIlsMinor: r.totalIlsMinor,
    effectiveIlsMinor: r.effectiveIlsMinor,
    pct: r.pct,
    over: r.overBudget,
  };
}

/* Whether a trip has a budget worth rendering at all. A trip with neither a
   target nor a single expense shows no bars anywhere — only the setup CTA. */
export function hasBudget(budget) {
  if (!budget) return false;
  const total = Number(budget.config?.totalIlsMinor) || 0;
  const count = Array.isArray(budget.items) ? budget.items.length : 0;
  return total > 0 || count > 0;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `CI=true npx react-scripts test src/utils/budget.test.js --watchAll=false`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/utils/budget.js src/utils/budget.test.js
git commit -m "$(cat <<'EOF'
feat(budget): rollup selector — planned / actual / effective

Three numbers, not two. The main bar compares EFFECTIVE to the target:
per item, the actual amount once paid and known to have differed, else
the planned amount. That is the honest answer to "where will I land".

rollup() is the single computation path for every surface. summarize()
produces the derived dashboard object; hasBudget() gates rendering.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: `budget.js` — transforms, `resolveDay`, `remapExpenseDays`

**Files:**
- Modify: `src/utils/budget.js` (append)
- Test: `src/utils/budget.test.js` (append)

**Interfaces:**
- Consumes: `newExpenseId`, `BASE_CATEGORIES` from Task 1.
- Produces (all take `trip.data` and return a new `data`, mirroring `addGeneralFile` in `tripFiles.js`):
  - `EMPTY_BUDGET`, `ensureBudget(data) → data`
  - `setBudgetConfig(data, patch) → data`
  - `upsertCategory(data, { key, label, capIlsMinor }) → data`
  - `removeCategory(data, key) → data` (reassigns its expenses to `other`)
  - `addExpense(data, expense) → data`
  - `updateExpense(data, id, patch) → data`
  - `removeExpense(data, id) → data`
  - `setPaid(data, id, paid, actualMinor) → data`
  - `resolveDay(item, tripData) → number|null`
  - `remapExpenseDays(items, mapping, newDayCount) → items`

- [ ] **Step 1: Write the failing test**

Append to `src/utils/budget.test.js`:

```js
import {
  EMPTY_BUDGET, ensureBudget, setBudgetConfig, upsertCategory, removeCategory,
  addExpense, updateExpense, removeExpense, setPaid, resolveDay, remapExpenseDays,
} from "./budget";

describe("ensureBudget", () => {
  test("creates an empty budget on data that has none", () => {
    const out = ensureBudget({ tripData: [] });
    expect(out.budget.items).toEqual([]);
    expect(out.budget.config.currency).toBe("ILS");
    expect(out.tripData).toEqual([]);
  });

  test("leaves an existing budget untouched and returns the same object", () => {
    const data = { budget: { config: { currency: "JPY" }, items: [] } };
    expect(ensureBudget(data)).toBe(data);
  });

  test("EMPTY_BUDGET is not shared between calls", () => {
    const a = ensureBudget({});
    const b = ensureBudget({});
    a.budget.items.push({ id: "x" });
    expect(b.budget.items).toHaveLength(0);
    expect(EMPTY_BUDGET.items).toHaveLength(0);
  });
});

describe("config and categories", () => {
  test("setBudgetConfig merges rather than replaces", () => {
    const d = setBudgetConfig(ensureBudget({}), { totalIlsMinor: 500000 });
    expect(d.budget.config.totalIlsMinor).toBe(500000);
    expect(d.budget.config.currency).toBe("ILS");
  });

  test("upsertCategory adds then updates by key", () => {
    let d = upsertCategory(ensureBudget({}), { key: "food", label: "אוכל", capIlsMinor: 200000 });
    expect(d.budget.config.categories).toHaveLength(1);
    d = upsertCategory(d, { key: "food", label: "אוכל", capIlsMinor: 300000 });
    expect(d.budget.config.categories).toHaveLength(1);
    expect(d.budget.config.categories[0].capIlsMinor).toBe(300000);
  });

  test("removeCategory drops the declaration AND reassigns its expenses to other", () => {
    let d = upsertCategory(ensureBudget({}), { key: "food", label: "אוכל", capIlsMinor: 200000 });
    d = addExpense(d, { label: "ראמן", amountMinor: 1200, currency: "JPY", category: "food" });
    d = removeCategory(d, "food");
    expect(d.budget.config.categories).toHaveLength(0);
    expect(d.budget.items[0].category).toBe("other");
    expect(d.budget.items[0].amountMinor).toBe(1200);  // money preserved
  });
});

describe("expense CRUD", () => {
  test("addExpense fills defaults and generates an id", () => {
    const d = addExpense(ensureBudget({}), { label: "ביטוח", amountMinor: 32000, currency: "ILS" });
    const it = d.budget.items[0];
    expect(it.id).toMatch(/^e_/);
    expect(it.category).toBe("other");
    expect(it.paid).toBe(false);
    expect(it.actualMinor).toBeNull();
    expect(it.dayRef).toBeNull();
    expect(it.stopRef).toBeNull();
    expect(typeof it.createdAt).toBe("string");
  });

  test("addExpense defaults the currency to the trip currency", () => {
    let d = setBudgetConfig(ensureBudget({}), { currency: "JPY" });
    d = addExpense(d, { label: "ראמן", amountMinor: 1200 });
    expect(d.budget.items[0].currency).toBe("JPY");
  });

  test("updateExpense patches one item and leaves the rest alone", () => {
    let d = addExpense(ensureBudget({}), { id: "e_a", label: "א", amountMinor: 100, currency: "ILS" });
    d = addExpense(d, { id: "e_b", label: "ב", amountMinor: 200, currency: "ILS" });
    d = updateExpense(d, "e_a", { label: "שונה" });
    expect(d.budget.items[0].label).toBe("שונה");
    expect(d.budget.items[1].label).toBe("ב");
  });

  test("updateExpense on a missing id returns the input unchanged", () => {
    const d = addExpense(ensureBudget({}), { id: "e_a", amountMinor: 100, currency: "ILS" });
    expect(updateExpense(d, "e_missing", { label: "x" })).toBe(d);
  });

  test("removeExpense drops only the named item", () => {
    let d = addExpense(ensureBudget({}), { id: "e_a", amountMinor: 100, currency: "ILS" });
    d = addExpense(d, { id: "e_b", amountMinor: 200, currency: "ILS" });
    d = removeExpense(d, "e_a");
    expect(d.budget.items.map((i) => i.id)).toEqual(["e_b"]);
  });
});

describe("setPaid — the planned/actual transition", () => {
  const base = () => addExpense(ensureBudget({}),
    { id: "e_a", label: "ראמן", amountMinor: 1200, currency: "JPY" });

  test("marking paid with no different amount leaves actual null", () => {
    const d = setPaid(base(), "e_a", true);
    expect(d.budget.items[0]).toMatchObject({ paid: true, actualMinor: null });
  });

  test("marking paid with a different amount records it", () => {
    const d = setPaid(base(), "e_a", true, 1500);
    expect(d.budget.items[0]).toMatchObject({ paid: true, actualMinor: 1500 });
  });

  test("un-paying always clears the actual amount", () => {
    let d = setPaid(base(), "e_a", true, 1500);
    d = setPaid(d, "e_a", false);
    expect(d.budget.items[0]).toMatchObject({ paid: false, actualMinor: null });
  });
});

describe("resolveDay", () => {
  const tripData = [
    { day: 1, attractions: [{ instanceId: "inst-aaa", name: "A" }] },
    { day: 2, attractions: [{ instanceId: "inst-bbb", name: "B" }] },
  ];

  test("a linked item takes its day from the stop, ignoring any stored dayRef", () => {
    expect(resolveDay({ stopRef: "inst-bbb", dayRef: 1 }, tripData)).toBe(2);
  });

  test("a linked item whose stop is gone resolves to null", () => {
    expect(resolveDay({ stopRef: "inst-zzz" }, tripData)).toBeNull();
  });

  test("an unlinked item uses its own dayRef", () => {
    expect(resolveDay({ dayRef: 3 }, tripData)).toBe(3);
    expect(resolveDay({ dayRef: null }, tripData)).toBeNull();
    expect(resolveDay({}, tripData)).toBeNull();
  });
});

/* Mirrors remapFileDays in tripFiles.js — same contract, same fallbacks. */
describe("remapExpenseDays", () => {
  const items = [
    { id: "e_general", dayRef: null },
    { id: "e_d1", dayRef: 1 },
    { id: "e_d3", dayRef: 3 },
    { id: "e_linked", dayRef: null, stopRef: "inst-aaa" },
  ];

  test("day null is untouched", () => {
    const out = remapExpenseDays(items, { 1: 1, 3: 3 }, 3);
    expect(out[0]).toBe(items[0]);
  });

  test("a renumbered day follows its mapping", () => {
    const out = remapExpenseDays(items, { 1: 1, 3: 2 }, 2);
    expect(out.find((i) => i.id === "e_d3").dayRef).toBe(2);
  });

  test("a removed day falls back to null (general), money preserved", () => {
    const out = remapExpenseDays(items, { 1: 1, 3: null }, 2);
    const it = out.find((i) => i.id === "e_d3");
    expect(it.dayRef).toBeNull();
    expect(it.id).toBe("e_d3");
  });

  test("a day beyond the new length falls back to null", () => {
    const out = remapExpenseDays(items, { 1: 1, 3: 5 }, 2);
    expect(out.find((i) => i.id === "e_d3").dayRef).toBeNull();
  });

  test("a stop-linked item is never touched — its day is derived", () => {
    const out = remapExpenseDays(items, { 1: null, 3: null }, 1);
    expect(out.find((i) => i.id === "e_linked")).toBe(items[3]);
  });

  test("null input yields an empty array, never a throw", () => {
    expect(remapExpenseDays(null, {}, 0)).toEqual([]);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `CI=true npx react-scripts test src/utils/budget.test.js --watchAll=false`
Expected: FAIL — `ensureBudget is not a function`.

- [ ] **Step 3: Write the implementation**

Append to `src/utils/budget.js`:

```js
/* ── Transforms ────────────────────────────────────────────────
   Every transform takes trip.data and returns a NEW data object —
   the same contract as addGeneralFile/updateGeneralFile in
   tripFiles.js, so callers persist with the identical
   saveTrip(id, { data }) call. */

export const EMPTY_BUDGET = Object.freeze({
  config: Object.freeze({
    currency: "ILS", rate: 1, rateUpdatedAt: null, totalIlsMinor: 0, categories: [],
  }),
  items: Object.freeze([]),
});

/* Return data with a budget guaranteed present. The existing object is
   returned by identity when there is nothing to add, so callers can cheaply
   detect a no-op. Never hands out a reference into EMPTY_BUDGET. */
export function ensureBudget(data) {
  const d = data || {};
  if (d.budget) return data === d ? data : d;
  return {
    ...d,
    budget: {
      config: { ...EMPTY_BUDGET.config, categories: [] },
      items: [],
    },
  };
}

export function setBudgetConfig(data, patch) {
  const d = ensureBudget(data);
  return { ...d, budget: { ...d.budget, config: { ...d.budget.config, ...patch } } };
}

export function upsertCategory(data, { key, label, capIlsMinor = null }) {
  const d = ensureBudget(data);
  const list = d.budget.config.categories || [];
  const exists = list.some((c) => c.key === key);
  const next = exists
    ? list.map((c) => (c.key === key ? { ...c, label, capIlsMinor } : c))
    : [...list, { key, label, capIlsMinor, ...(key.startsWith("c_") ? { custom: true } : {}) }];
  return setBudgetConfig(d, { categories: next });
}

/* Drop a category declaration. Its expenses are REASSIGNED to `other`,
   never orphaned and never deleted — money the user entered is not
   destroyed as a side effect of a settings change. */
export function removeCategory(data, key) {
  const d = ensureBudget(data);
  const categories = (d.budget.config.categories || []).filter((c) => c.key !== key);
  const items = (d.budget.items || []).map((i) =>
    i.category === key ? { ...i, category: "other" } : i);
  return { ...d, budget: { ...d.budget, config: { ...d.budget.config, categories }, items } };
}

export function addExpense(data, expense = {}) {
  const d = ensureBudget(data);
  const item = {
    id: expense.id || newExpenseId(),
    label: String(expense.label || "").trim(),
    amountMinor: Number(expense.amountMinor) || 0,
    currency: expense.currency || d.budget.config.currency || "ILS",
    category: expense.category || "other",
    dayRef: expense.dayRef ?? null,
    stopRef: expense.stopRef ?? null,
    paid: !!expense.paid,
    actualMinor: Number.isFinite(expense.actualMinor) ? expense.actualMinor : null,
    note: expense.note || "",
    createdAt: expense.createdAt || new Date().toISOString(),
  };
  return { ...d, budget: { ...d.budget, items: [...d.budget.items, item] } };
}

export function updateExpense(data, id, patch) {
  const d = data || {};
  if (!d.budget || !(d.budget.items || []).some((i) => i.id === id)) return data;
  return {
    ...d,
    budget: { ...d.budget, items: d.budget.items.map((i) => (i.id === id ? { ...i, ...patch } : i)) },
  };
}

export function removeExpense(data, id) {
  const d = data || {};
  if (!d.budget) return data;
  return { ...d, budget: { ...d.budget, items: (d.budget.items || []).filter((i) => i.id !== id) } };
}

/* Un-paying ALWAYS clears the actual amount: a "what it really cost" figure
   is meaningless on an unpaid item, and leaving it behind would silently
   resurrect on the next tick of the checkbox. */
export function setPaid(data, id, paid, actualMinor = null) {
  return updateExpense(data, id, paid
    ? { paid: true, actualMinor: Number.isFinite(actualMinor) ? actualMinor : null }
    : { paid: false, actualMinor: null });
}

/* An expense's day. A stop-linked expense derives it from the stop, so moving
   that stop between days needs no budget write at all. Only standalone items
   carry a stored dayRef. (Phase A creates no stopRefs; the branch is here so
   Phase B needs no rewrite.) */
export function resolveDay(item, tripData) {
  if (item?.stopRef) {
    const day = (tripData || []).find((d) =>
      (d.attractions || []).some((a) => a.instanceId === item.stopRef));
    return day ? day.day : null;
  }
  return item?.dayRef ?? null;
}

/* Keep standalone expenses' `dayRef` valid after the trip's days are
   renumbered — the exact contract of remapFileDays in tripFiles.js.
   `mapping` maps an OLD day number to its NEW one (or null if removed). An
   expense whose day is gone or now out of range falls back to null (general);
   it is never dropped. Stop-linked items are skipped: their day is derived. */
export function remapExpenseDays(items, mapping, newDayCount) {
  return (items || []).map((it) => {
    if (it.stopRef) return it;
    if (it.dayRef == null) return it;
    const next = mapping[it.dayRef];
    if (next == null || next > newDayCount) return { ...it, dayRef: null };
    return next === it.dayRef ? it : { ...it, dayRef: next };
  });
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `CI=true npx react-scripts test src/utils/budget.test.js --watchAll=false`
Expected: PASS. The whole `budget.test.js` suite (Tasks 1–3) is green.

- [ ] **Step 5: Commit**

```bash
git add src/utils/budget.js src/utils/budget.test.js
git commit -m "$(cat <<'EOF'
feat(budget): data transforms, resolveDay, remapExpenseDays

Same contract as tripFiles.js: take trip.data, return a new trip.data, so
callers persist through the identical saveTrip(id, { data }) call.

Data-safety rules encoded here rather than at call sites:
  - removeCategory reassigns its expenses to `other`, never orphans them
  - setPaid(false) always clears the actual amount
  - remapExpenseDays falls a removed day back to general, never drops
  - stop-linked expenses derive their day and are skipped by the remap

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 4: `tripService` — derive the summary on write, lift it on read

This is the **airtight choke point**. The summary must be re-derived no matter which call site produced the write — including the generic editor save that only knows it is persisting `data`.

**Files:**
- Modify: `src/services/tripService.js` — add the import, add `withBudgetSummary`, apply it at the top of `saveTrip`, lift in `rowToTrip` and `toSummary`
- Test: `src/services/tripService.budget.test.js` (new)

**Interfaces:**
- Consumes: `summarize(budget)` from Task 2.
- Produces: `trip.budgetSummary` present on every record returned by `fetchAllTrips`, `fetchTripById` and `saveTrip`; `data.budget.summary` persisted and always current.

- [ ] **Step 1: Write the failing test**

Create `src/services/tripService.budget.test.js`:

```js
/* Exercises the localStorage engine (no Supabase session in tests), which is
   the same code path the demo/mock sessions use in production. */
import tripService, { rowToTrip } from "./tripService";
import { summarize } from "../utils/budget";

const BUDGET = {
  config: { currency: "JPY", rate: 0.023, totalIlsMinor: 1000000, categories: [] },
  items: [{ id: "e_1", label: "טיסה", amountMinor: 400000, currency: "ILS",
            category: "flights", paid: false, actualMinor: null }],
};

beforeEach(async () => {
  localStorage.clear();
  await tripService.resetStore();
});

test("saveTrip derives data.budget.summary from the budget it is given", async () => {
  const trip = await tripService.createNewTrip({ title: "בדיקה", days: 2 });
  const saved = await tripService.saveTrip(trip.id, {
    data: { ...trip.data, budget: BUDGET },
  });
  expect(saved.data.budget.summary).toEqual(summarize(BUDGET));
  expect(saved.data.budget.summary.effectiveIlsMinor).toBe(400000);
});

test("a summary supplied by the caller is overwritten, never trusted", async () => {
  const trip = await tripService.createNewTrip({ title: "בדיקה", days: 2 });
  const lying = { ...BUDGET, summary: { totalIlsMinor: 1, effectiveIlsMinor: 1, pct: 1, over: true } };
  const saved = await tripService.saveTrip(trip.id, { data: { ...trip.data, budget: lying } });
  expect(saved.data.budget.summary.effectiveIlsMinor).toBe(400000);
  expect(saved.data.budget.summary.over).toBe(false);
});

/* THE REGRESSION THIS TASK EXISTS FOR: a write that arrives through the
   generic editor path — a patch that only carries `data`, produced by a stop
   mutation — must still re-derive the summary. */
test("the generic data-only editor save path still re-derives the summary", async () => {
  const trip = await tripService.createNewTrip({ title: "בדיקה", days: 2 });
  await tripService.saveTrip(trip.id, { data: { ...trip.data, budget: BUDGET } });

  const withMore = {
    ...BUDGET,
    items: [...BUDGET.items,
      { id: "e_2", label: "ביטוח", amountMinor: 32000, currency: "ILS",
        category: "insurance", paid: false, actualMinor: null }],
  };
  const after = await tripService.saveTrip(trip.id, {
    data: { ...trip.data, tripData: [{ day: 1, attractions: [] }], budget: withMore },
  });
  expect(after.data.budget.summary.effectiveIlsMinor).toBe(432000);
});

test("a patch with no budget is passed through untouched", async () => {
  const trip = await tripService.createNewTrip({ title: "בדיקה", days: 2 });
  const saved = await tripService.saveTrip(trip.id, { title: "שם חדש" });
  expect(saved.title).toBe("שם חדש");
  expect(saved.data.budget).toBeUndefined();
});

test("fetchAllTrips lifts budgetSummary even though it strips data", async () => {
  const trip = await tripService.createNewTrip({ title: "בדיקה", days: 2 });
  await tripService.saveTrip(trip.id, { data: { ...trip.data, budget: BUDGET } });

  const list = await tripService.fetchAllTrips();
  const row = list.find((t) => t.id === trip.id);
  expect(row.data).toBeUndefined();
  expect(row.budgetSummary.effectiveIlsMinor).toBe(400000);
});

test("a trip with no budget lists a null budgetSummary", async () => {
  const trip = await tripService.createNewTrip({ title: "בדיקה", days: 2 });
  const list = await tripService.fetchAllTrips();
  expect(list.find((t) => t.id === trip.id).budgetSummary).toBeNull();
});

test("rowToTrip lifts the summary out of the Supabase row shape", () => {
  const trip = rowToTrip({
    id: "t1", title: "t", owner_id: "u1",
    data: { tripData: [], budget: { ...BUDGET, summary: summarize(BUDGET) } },
  });
  expect(trip.budgetSummary.effectiveIlsMinor).toBe(400000);
});

test("rowToTrip yields a null summary for a trip without a budget", () => {
  const trip = rowToTrip({ id: "t1", title: "t", owner_id: "u1", data: { tripData: [] } });
  expect(trip.budgetSummary).toBeNull();
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `CI=true npx react-scripts test src/services/tripService.budget.test.js --watchAll=false`
Expected: FAIL — `saved.data.budget.summary` is `undefined`.

- [ ] **Step 3: Write the implementation**

In `src/services/tripService.js`, add to the imports at the top of the file (after the existing `import { track } from "../analytics/posthog";`):

```js
import { summarize } from "../utils/budget";
```

In `rowToTrip`, add one field. Change:

```js
  data: r.data || { tripData: [], cityTransitions: [], lodgingOverrides: {} },
```

to:

```js
  data: r.data || { tripData: [], cityTransitions: [], lodgingOverrides: {} },
  /* Lifted OUT of `data` so it survives the `data` strip that fetchAllTrips
     performs — the dashboard grid renders its budget mini-indicator from this
     and never loads the full item list. */
  budgetSummary: r.data?.budget?.summary || null,
```

Replace `toSummary` (currently `const toSummary = ({ data, ...rest }) => rest;`) with:

```js
/* Lightweight list projection (omit the heavy `data` payload so
   the dashboard grid stays snappy) — but lift the budget summary out
   first, so the grid can still render its mini-indicator. */
const toSummary = ({ data, ...rest }) => ({
  ...rest,
  budgetSummary: rest.budgetSummary ?? data?.budget?.summary ?? null,
});
```

Immediately above `export const tripService = {`, add:

```js
/* ── Budget summary: DERIVED, NEVER AUTHORED ─────────────────────
   Any patch carrying a budget gets its `summary` re-derived here,
   before the write. This is deliberately in saveTrip rather than in a
   dedicated budget method: budget-bearing writes also arrive through
   the GENERIC editor path (useEditorState persists `{ data }` after a
   stop mutation), and a summary that only refreshed on a budget-
   specific call would leave the dashboard card showing a stale figure.
   No extra read is needed — the whole budget is already in the patch. */
const withBudgetSummary = (patch) => {
  const b = patch?.data?.budget;
  if (!b) return patch;
  return { ...patch, data: { ...patch.data, budget: { ...b, summary: summarize(b) } } };
};
```

In `saveTrip`, make it the first statement of the method. Change:

```js
  async saveTrip(tripId, patch) {
    const sbUser = await getSupabaseUser();
```

to:

```js
  async saveTrip(tripId, rawPatch) {
    const patch = withBudgetSummary(rawPatch);
    const sbUser = await getSupabaseUser();
```

The rest of `saveTrip` already reads from `patch` and needs no further change.

- [ ] **Step 4: Run the test to verify it passes**

Run: `CI=true npx react-scripts test src/services/tripService.budget.test.js --watchAll=false`
Expected: PASS.

- [ ] **Step 5: Verify nothing else regressed**

Run: `CI=true npx react-scripts test --watchAll=false && npm run critical`
Expected: the full Jest suite passes and `critical` reports 9/9.

- [ ] **Step 6: Commit**

```bash
git add src/services/tripService.js src/services/tripService.budget.test.js
git commit -m "$(cat <<'EOF'
feat(budget): derive data.budget.summary in saveTrip; lift it on read

The summary is derived, never authored. The recompute sits in saveTrip
itself, not in a budget-specific method, because budget-bearing writes
also arrive through the generic editor path (useEditorState persists
{ data } after a stop mutation) — a summary that only refreshed on a
budget-specific call would leave the dashboard card stale. A caller-
supplied summary is overwritten, never trusted.

rowToTrip and toSummary lift it to trip.budgetSummary so it survives the
`data` strip that fetchAllTrips performs for the dashboard grid.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 5: `useBudget` hook

**Files:**
- Create: `src/hooks/useBudget.js`
- Test: `src/hooks/useBudget.test.js`

**Interfaces:**
- Consumes: every transform from Task 3, `rollup` from Task 2, `tripService.saveTrip` from Task 4.
- Produces: `useBudget(trip) → { data, budget, roll, hasAny, readOnly, saving, error, setConfig, saveCategory, deleteCategory, createExpense, editExpense, deleteExpense, markPaid }`
  - `roll` is the object returned by `rollup()`.
  - Every mutator is `(…args) => void`; they update optimistically and persist in the background.
  - Mutators are inert when `readOnly`.

- [ ] **Step 1: Write the failing test**

Create `src/hooks/useBudget.test.js`:

```js
import { renderHook, act, waitFor } from "@testing-library/react";
import useBudget from "./useBudget";
import tripService from "../services/tripService";

jest.mock("../services/tripService", () => ({
  __esModule: true,
  default: { saveTrip: jest.fn(() => Promise.resolve({})) },
}));

const makeTrip = (over = {}) => ({
  id: "t1",
  readOnly: false,
  data: { tripData: [{ day: 1, attractions: [] }] },
  ...over,
});

beforeEach(() => {
  tripService.saveTrip.mockClear();
  tripService.saveTrip.mockImplementation(() => Promise.resolve({}));
});

test("starts with no budget and hasAny false", () => {
  const { result } = renderHook(() => useBudget(makeTrip()));
  expect(result.current.hasAny).toBe(false);
  expect(result.current.roll.effectiveIlsMinor).toBe(0);
});

test("setConfig updates optimistically and persists", async () => {
  const { result } = renderHook(() => useBudget(makeTrip()));
  act(() => result.current.setConfig({ totalIlsMinor: 1500000, currency: "JPY", rate: 0.023 }));

  expect(result.current.budget.config.totalIlsMinor).toBe(1500000);
  expect(result.current.hasAny).toBe(true);
  await waitFor(() => expect(tripService.saveTrip).toHaveBeenCalledTimes(1));
  expect(tripService.saveTrip).toHaveBeenCalledWith("t1",
    { data: expect.objectContaining({ budget: expect.any(Object) }) });
});

test("createExpense adds an item and rollup reflects it", async () => {
  const { result } = renderHook(() => useBudget(makeTrip()));
  act(() => result.current.setConfig({ totalIlsMinor: 1000000 }));
  act(() => result.current.createExpense({ label: "טיסה", amountMinor: 400000, currency: "ILS", category: "flights" }));

  expect(result.current.budget.items).toHaveLength(1);
  expect(result.current.roll.effectiveIlsMinor).toBe(400000);
  await waitFor(() => expect(tripService.saveTrip).toHaveBeenCalledTimes(2));
});

test("markPaid with a different amount moves the effective total", async () => {
  const { result } = renderHook(() => useBudget(makeTrip()));
  act(() => result.current.createExpense({ id: "e_a", label: "ראמן", amountMinor: 10000, currency: "ILS" }));
  expect(result.current.roll.effectiveIlsMinor).toBe(10000);

  act(() => result.current.markPaid("e_a", true, 13500));
  expect(result.current.roll.effectiveIlsMinor).toBe(13500);
  expect(result.current.roll.actualIlsMinor).toBe(13500);
  expect(result.current.roll.plannedIlsMinor).toBe(10000);
});

test("deleteExpense removes it", async () => {
  const { result } = renderHook(() => useBudget(makeTrip()));
  act(() => result.current.createExpense({ id: "e_a", amountMinor: 10000, currency: "ILS" }));
  act(() => result.current.deleteExpense("e_a"));
  expect(result.current.budget.items).toHaveLength(0);
});

test("a read-only trip refuses every mutation and never calls saveTrip", () => {
  const { result } = renderHook(() => useBudget(makeTrip({ readOnly: true })));
  expect(result.current.readOnly).toBe(true);

  act(() => result.current.setConfig({ totalIlsMinor: 999 }));
  act(() => result.current.createExpense({ amountMinor: 100, currency: "ILS" }));

  expect(result.current.hasAny).toBe(false);
  expect(tripService.saveTrip).not.toHaveBeenCalled();
});

test("a failed save surfaces an error and rolls the state back", async () => {
  tripService.saveTrip.mockImplementation(() => Promise.reject(new Error("boom")));
  const { result } = renderHook(() => useBudget(makeTrip()));

  act(() => result.current.createExpense({ id: "e_a", amountMinor: 10000, currency: "ILS" }));
  expect(result.current.budget.items).toHaveLength(1);   // optimistic

  await waitFor(() => expect(result.current.error).toBeTruthy());
  expect(result.current.budget?.items ?? []).toHaveLength(0);  // rolled back
});

test("it re-syncs when a different trip is passed in", () => {
  const { result, rerender } = renderHook(({ trip }) => useBudget(trip), {
    initialProps: { trip: makeTrip() },
  });
  act(() => result.current.createExpense({ amountMinor: 100, currency: "ILS" }));
  expect(result.current.budget.items).toHaveLength(1);

  rerender({ trip: makeTrip({ id: "t2" }) });
  expect(result.current.budget).toBeNull();
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `CI=true npx react-scripts test src/hooks/useBudget.test.js --watchAll=false`
Expected: FAIL — `Cannot find module './useBudget'`.

- [ ] **Step 3: Write the implementation**

Create `src/hooks/useBudget.js`:

```js
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import tripService from "../services/tripService";
import {
  rollup, hasBudget, ensureBudget, setBudgetConfig, upsertCategory, removeCategory,
  addExpense, updateExpense, removeExpense, setPaid,
} from "../utils/budget";

/* ══════════════════════════════════════════════════════════════
   useBudget — one trip's budget: state, mutation, persistence.

   Every surface reads its numbers from `roll` (the rollup selector),
   so no two surfaces can disagree. Mutators apply the pure transforms
   from utils/budget.js and persist the whole `data` object through
   tripService.saveTrip — which re-derives data.budget.summary on the
   way through, so the dashboard indicator can never go stale.

   There is deliberately no tripService.saveBudget: the recompute lives
   in saveTrip, so a budget-specific method would add an API without
   adding a guarantee.

   Writes are OPTIMISTIC and roll back on failure. This is money — a
   silently dropped save would be worse than a visible error.
   ══════════════════════════════════════════════════════════════ */

export default function useBudget(trip) {
  const tripId = trip?.id || null;
  const readOnly = !!trip?.readOnly;

  const [data, setData] = useState(trip?.data || null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  /* Re-sync when the caller hands us a different trip (or reloads one). */
  useEffect(() => { setData(trip?.data || null); setError(null); }, [tripId, trip?.data]);

  /* The last state known to be persisted, for rollback. */
  const committed = useRef(trip?.data || null);
  useEffect(() => { committed.current = trip?.data || null; }, [tripId]);

  /* The live value, so two synchronous mutations compose correctly. It is
     updated eagerly rather than via an effect: the save must be kicked off
     OUTSIDE the setState updater — an updater that fires a request is a side
     effect in a reducer, and React would run it twice under StrictMode. */
  const dataRef = useRef(trip?.data || null);
  useEffect(() => { dataRef.current = trip?.data || null; }, [tripId, trip?.data]);

  const mutate = useCallback((fn) => {
    if (readOnly || !tripId) return;
    const prev = dataRef.current || {};
    const next = fn(prev);
    if (next === prev) return;

    const rollbackTo = committed.current;
    dataRef.current = next;
    setData(next);
    setSaving(true);
    setError(null);

    tripService.saveTrip(tripId, { data: next })
      .then(() => { committed.current = next; })
      .catch((e) => {
        setError(e?.message || "השמירה נכשלה");
        dataRef.current = rollbackTo;
        setData(rollbackTo);
      })
      .finally(() => setSaving(false));
  }, [readOnly, tripId]);

  const budget = data?.budget || null;
  const roll = useMemo(() => rollup(budget), [budget]);

  const setConfig = useCallback((patch) => mutate((d) => setBudgetConfig(d, patch)), [mutate]);
  const saveCategory = useCallback((cat) => mutate((d) => upsertCategory(d, cat)), [mutate]);
  const deleteCategory = useCallback((key) => mutate((d) => removeCategory(d, key)), [mutate]);
  const createExpense = useCallback((e) => mutate((d) => addExpense(ensureBudget(d), e)), [mutate]);
  const editExpense = useCallback((id, patch) => mutate((d) => updateExpense(d, id, patch)), [mutate]);
  const deleteExpense = useCallback((id) => mutate((d) => removeExpense(d, id)), [mutate]);
  const markPaid = useCallback(
    (id, paid, actualMinor = null) => mutate((d) => setPaid(d, id, paid, actualMinor)), [mutate]);

  return {
    data, budget, roll,
    hasAny: hasBudget(budget),
    readOnly, saving, error,
    setConfig, saveCategory, deleteCategory,
    createExpense, editExpense, deleteExpense, markPaid,
  };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `CI=true npx react-scripts test src/hooks/useBudget.test.js --watchAll=false`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/hooks/useBudget.js src/hooks/useBudget.test.js
git commit -m "$(cat <<'EOF'
feat(budget): useBudget — optimistic state over the pure transforms

One hook, one selector. Every surface reads its numbers from rollup(),
so no two can disagree. Mutators apply the pure transforms and persist
the whole data object via saveTrip, which re-derives the summary.

Writes are optimistic and roll back on failure with a surfaced error —
this is money, so a silently dropped save is worse than a visible one.
Read-only trips refuse every mutation before it reaches the service.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 6: `Money.jsx` + `BudgetSetupSheet.jsx`

**Files:**
- Create: `src/components/Money.jsx`
- Create: `src/components/BudgetSetupSheet.jsx`
- Test: `src/components/BudgetSetupSheet.test.js`

**Interfaces:**
- Consumes: `formatMoney`, `parseAmount`, `CURRENCIES`, `BASE_CATEGORIES`, `newCategoryKey`, `formatAmount` from Tasks 1–3.
- Produces:
  - `<Money minor={number} currency={string} bold={bool} tone={"ink"|"ink2"|"ink3"|"danger"|"accent"} P={palette} />`
  - `<BudgetSetupSheet open onClose config P onSave />` where `onSave({ totalIlsMinor, currency, rate, rateUpdatedAt, categories })` fires once on submit. It derives its own allocation line from the caps being edited, so it needs no rollup prop.

- [ ] **Step 1: Write the failing test**

Create `src/components/BudgetSetupSheet.test.js`:

```js
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import BudgetSetupSheet from "./BudgetSetupSheet";
import { LIGHT } from "../utils/theme";

const config = {
  currency: "ILS", rate: 1, totalIlsMinor: 0, categories: [],
};
const baseProps = () => ({
  open: true,
  onClose: jest.fn(),
  onSave: jest.fn(),
  config,
  P: LIGHT,
});

test("renders nothing when closed", () => {
  const { container } = render(<BudgetSetupSheet {...baseProps()} open={false} />);
  expect(container).toBeEmptyDOMElement();
});

test("saving a total converts shekels to agorot", () => {
  const props = baseProps();
  render(<BudgetSetupSheet {...props} />);
  fireEvent.change(screen.getByLabelText("תקציב כולל בשקלים"), { target: { value: "15000" } });
  fireEvent.click(screen.getByRole("button", { name: "שמירה" }));
  expect(props.onSave).toHaveBeenCalledWith(expect.objectContaining({ totalIlsMinor: 1500000 }));
});

test("the rate field appears only for a non-shekel currency", () => {
  const props = baseProps();
  render(<BudgetSetupSheet {...props} />);
  expect(screen.queryByLabelText(/שער המרה/)).not.toBeInTheDocument();

  fireEvent.change(screen.getByLabelText("מטבע היעד"), { target: { value: "JPY" } });
  expect(screen.getByLabelText(/שער המרה/)).toBeInTheDocument();
});

test("a category cap is saved in agorot against its key", () => {
  const props = baseProps();
  render(<BudgetSetupSheet {...props} />);
  fireEvent.change(screen.getByLabelText("תקרה עבור לינה"), { target: { value: "5000" } });
  fireEvent.click(screen.getByRole("button", { name: "שמירה" }));

  const saved = props.onSave.mock.calls[0][0];
  expect(saved.categories).toContainEqual(
    expect.objectContaining({ key: "lodging", capIlsMinor: 500000 }));
});

test("a category left blank is saved with a null cap", () => {
  const props = baseProps();
  render(<BudgetSetupSheet {...props} />);
  fireEvent.change(screen.getByLabelText("תקרה עבור אוכל"), { target: { value: "2000" } });
  fireEvent.click(screen.getByRole("button", { name: "שמירה" }));

  const saved = props.onSave.mock.calls[0][0];
  expect(saved.categories.find((c) => c.key === "lodging").capIlsMinor).toBeNull();
});

test("adding a custom category gives it a c_ key and a cap field", () => {
  const props = baseProps();
  render(<BudgetSetupSheet {...props} />);
  fireEvent.change(screen.getByLabelText("שם קטגוריה חדשה"), { target: { value: "מזכרות" } });
  fireEvent.click(screen.getByRole("button", { name: "הוספת קטגוריה" }));

  fireEvent.change(screen.getByLabelText("תקרה עבור מזכרות"), { target: { value: "800" } });
  fireEvent.click(screen.getByRole("button", { name: "שמירה" }));

  const saved = props.onSave.mock.calls[0][0];
  const custom = saved.categories.find((c) => c.label === "מזכרות");
  expect(custom.key).toMatch(/^c_/);
  expect(custom.custom).toBe(true);
  expect(custom.capIlsMinor).toBe(80000);
});

test("the allocation line reports what is still unallocated", () => {
  const props = baseProps();
  render(<BudgetSetupSheet {...props} />);
  fireEvent.change(screen.getByLabelText("תקציב כולל בשקלים"), { target: { value: "15000" } });
  fireEvent.change(screen.getByLabelText("תקרה עבור לינה"), { target: { value: "5000" } });
  expect(screen.getByTestId("allocation-line")).toHaveTextContent("לא מוקצה");
  expect(screen.getByTestId("allocation-line")).toHaveTextContent("₪10,000.00");
});

test("invalid amounts block the save and explain why", () => {
  const props = baseProps();
  render(<BudgetSetupSheet {...props} />);
  fireEvent.change(screen.getByLabelText("תקציב כולל בשקלים"), { target: { value: "-5" } });
  fireEvent.click(screen.getByRole("button", { name: "שמירה" }));
  expect(props.onSave).not.toHaveBeenCalled();
  expect(screen.getByRole("alert")).toHaveTextContent("סכום לא תקין");
});

test("Escape closes the sheet", () => {
  const props = baseProps();
  render(<BudgetSetupSheet {...props} />);
  fireEvent.keyDown(document, { key: "Escape" });
  expect(props.onClose).toHaveBeenCalled();
});

test("the dialog is labelled for screen readers", () => {
  render(<BudgetSetupSheet {...baseProps()} />);
  expect(screen.getByRole("dialog")).toHaveAccessibleName("הגדרת תקציב");
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `CI=true npx react-scripts test src/components/BudgetSetupSheet.test.js --watchAll=false`
Expected: FAIL — `Cannot find module './BudgetSetupSheet'`.

- [ ] **Step 3: Write `Money.jsx`**

Create `src/components/Money.jsx`:

```js
import React from "react";
import { formatMoney } from "../utils/budget";

/* ══════════════════════════════════════════════════════════════
   Money — one rendered amount.

   Two things it exists to guarantee, everywhere, without each caller
   remembering them:

   • BIDI ISOLATION. "₪4,000" inside Hebrew RTL text reorders into
     nonsense without an explicit LTR island. dir="ltr" +
     unicode-bidi:isolate keeps the symbol glued to its digits.
   • TABULAR NUMERALS. Amounts stack in columns; proportional digits
     make those columns ragged. DESIGN.md already mandates this.
   ══════════════════════════════════════════════════════════════ */

export default function Money({ minor, currency = "ILS", bold = false, tone = "ink", P, style }) {
  return (
    <span
      dir="ltr"
      style={{
        unicodeBidi: "isolate",
        fontVariantNumeric: "tabular-nums",
        fontWeight: bold ? 800 : 600,
        color: P?.[tone] || "inherit",
        whiteSpace: "nowrap",
        ...style,
      }}
    >
      {formatMoney(minor, currency)}
    </span>
  );
}
```

- [ ] **Step 4: Write `BudgetSetupSheet.jsx`**

Create `src/components/BudgetSetupSheet.jsx`:

```js
import React, { useEffect, useMemo, useRef, useState } from "react";
import { BASE_CATEGORIES, CURRENCIES, formatMoney, newCategoryKey, parseAmount } from "../utils/budget";

/* ══════════════════════════════════════════════════════════════
   BudgetSetupSheet — set the target, the currency and the caps.

   The total and every cap are in ILS: that is the currency the
   traveller's budget actually exists in. The trip currency is only
   how individual expenses get entered.

   A category left blank keeps capIlsMinor null — it still appears in
   the breakdown, it simply has no ceiling. That is what lets someone
   who only wants a single total ignore this whole section.
   ══════════════════════════════════════════════════════════════ */

const FONT = "'Noto Sans Hebrew','Inter','Noto Sans JP',system-ui,sans-serif";

/* Cap inputs are held as raw strings while editing, so a half-typed
   "15" is never coerced into a committed number. */
const capsFromConfig = (config) => {
  const out = {};
  for (const c of config?.categories || []) {
    out[c.key] = Number.isFinite(c.capIlsMinor) ? String(c.capIlsMinor / 100) : "";
  }
  return out;
};

const customsFromConfig = (config) =>
  (config?.categories || []).filter((c) => c.custom).map((c) => ({ key: c.key, label: c.label }));

export default function BudgetSetupSheet({ open, onClose, onSave, config, P }) {
  const [total, setTotal] = useState("");
  const [currency, setCurrency] = useState("ILS");
  const [rate, setRate] = useState("");
  const [caps, setCaps] = useState({});
  const [customs, setCustoms] = useState([]);
  const [newCat, setNewCat] = useState("");
  const [err, setErr] = useState("");
  const panelRef = useRef(null);

  /* Re-seed from the live config every time the sheet opens. */
  useEffect(() => {
    if (!open) return;
    setTotal(config?.totalIlsMinor ? String(config.totalIlsMinor / 100) : "");
    setCurrency(config?.currency || "ILS");
    setRate(config?.rate && config.currency !== "ILS" ? String(config.rate) : "");
    setCaps(capsFromConfig(config));
    setCustoms(customsFromConfig(config));
    setNewCat("");
    setErr("");
  }, [open, config]);

  /* Esc closes; focus lands inside the panel on open. */
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => { if (e.key === "Escape") onClose?.(); };
    document.addEventListener("keydown", onKey);
    panelRef.current?.focus();
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const allCategories = useMemo(
    () => [...BASE_CATEGORIES, ...customs], [customs]);

  const totalMinor = parseAmount(total, "ILS");
  const allocated = allCategories.reduce(
    (s, c) => s + (parseAmount(caps[c.key], "ILS") || 0), 0);
  const unallocated = (totalMinor || 0) - allocated;

  if (!open) return null;

  const addCustom = () => {
    const label = newCat.trim();
    if (!label) return;
    setCustoms((cs) => [...cs, { key: newCategoryKey(), label }]);
    setNewCat("");
  };

  const submit = () => {
    if (total.trim() && totalMinor === null) { setErr("סכום לא תקין — הזינו מספר חיובי"); return; }
    for (const c of allCategories) {
      const raw = caps[c.key];
      if (raw && raw.trim() && parseAmount(raw, "ILS") === null) {
        setErr(`סכום לא תקין בקטגוריה ${c.label}`); return;
      }
    }
    const rateNum = currency === "ILS" ? 1 : Number(rate);
    if (currency !== "ILS" && (!Number.isFinite(rateNum) || rateNum <= 0)) {
      setErr("שער המרה לא תקין"); return;
    }
    onSave({
      totalIlsMinor: totalMinor || 0,
      currency,
      rate: rateNum,
      rateUpdatedAt: new Date().toISOString(),
      categories: allCategories.map((c) => ({
        key: c.key,
        label: c.label,
        capIlsMinor: parseAmount(caps[c.key], "ILS"),
        ...(c.key.startsWith("c_") ? { custom: true } : {}),
      })),
    });
  };

  const field = {
    width: "100%", minHeight: 44, borderRadius: 12, border: `1px solid ${P.line}`,
    background: P.surface, color: P.ink, font: `600 15px ${FONT}`,
    padding: "10px 12px", boxSizing: "border-box",
  };
  const label = { display: "block", font: `700 12.5px ${FONT}`, color: P.ink3, marginBlockEnd: 6 };

  return (
    <div
      role="presentation"
      onClick={(e) => { if (e.target === e.currentTarget) onClose?.(); }}
      style={{
        position: "fixed", inset: 0, zIndex: 300, background: "rgba(0,0,0,0.42)",
        display: "flex", alignItems: "flex-end", justifyContent: "center",
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label="הגדרת תקציב"
        tabIndex={-1}
        dir="rtl"
        style={{
          width: "min(560px, 100%)", maxHeight: "88vh", overflowY: "auto",
          background: P.panel, color: P.ink, borderStartStartRadius: 22, borderStartEndRadius: 22,
          padding: 20, boxSizing: "border-box", font: `400 14.5px ${FONT}`, outline: "none",
        }}
      >
        <h2 style={{ font: `800 19px ${FONT}`, letterSpacing: "-0.014em", margin: "0 0 16px" }}>
          הגדרת תקציב
        </h2>

        <div style={{ marginBlockEnd: 14 }}>
          <label style={label} htmlFor="bs-total">תקציב כולל בשקלים</label>
          <input id="bs-total" style={field} inputMode="decimal" value={total}
                 aria-label="תקציב כולל בשקלים"
                 onChange={(e) => { setTotal(e.target.value); setErr(""); }} />
        </div>

        <div style={{ display: "flex", gap: 10, marginBlockEnd: 14 }}>
          <div style={{ flex: 1 }}>
            <label style={label} htmlFor="bs-currency">מטבע היעד</label>
            <select id="bs-currency" style={field} value={currency} aria-label="מטבע היעד"
                    onChange={(e) => { setCurrency(e.target.value); setErr(""); }}>
              {CURRENCIES.map((c) => <option key={c.code} value={c.code}>{c.label}</option>)}
            </select>
          </div>
          {currency !== "ILS" && (
            <div style={{ flex: 1 }}>
              <label style={label} htmlFor="bs-rate">{`שער המרה ל־₪ (1 ${currency} =)`}</label>
              <input id="bs-rate" style={field} inputMode="decimal" value={rate}
                     aria-label={`שער המרה ל־₪ (1 ${currency} =)`}
                     onChange={(e) => { setRate(e.target.value); setErr(""); }} />
            </div>
          )}
        </div>

        <h3 style={{ font: `800 14px ${FONT}`, margin: "18px 0 4px" }}>תקרות לקטגוריות</h3>
        <p style={{ font: `400 12.5px ${FONT}`, color: P.ink3, margin: "0 0 12px" }}>
          אופציונלי. קטגוריה בלי תקרה עדיין נספרת בפילוח.
        </p>

        {allCategories.map((c) => (
          <div key={c.key} style={{ display: "flex", alignItems: "center", gap: 10, marginBlockEnd: 8 }}>
            <span style={{ flex: 1, font: `600 14px ${FONT}` }}>{c.label}</span>
            <input
              style={{ ...field, width: 130 }}
              inputMode="decimal"
              aria-label={`תקרה עבור ${c.label}`}
              value={caps[c.key] || ""}
              onChange={(e) => { setCaps((p) => ({ ...p, [c.key]: e.target.value })); setErr(""); }}
            />
          </div>
        ))}

        <div style={{ display: "flex", gap: 10, alignItems: "flex-end", marginBlockStart: 12 }}>
          <div style={{ flex: 1 }}>
            <label style={label} htmlFor="bs-newcat">שם קטגוריה חדשה</label>
            <input id="bs-newcat" style={field} value={newCat} aria-label="שם קטגוריה חדשה"
                   onChange={(e) => setNewCat(e.target.value)}
                   onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addCustom(); } }} />
          </div>
          <button type="button" onClick={addCustom}
                  style={{ minHeight: 44, minWidth: 44, padding: "0 16px", borderRadius: 999,
                           border: `1px solid ${P.line}`, background: P.surface, color: P.ink,
                           font: `700 14px ${FONT}`, cursor: "pointer" }}>
            הוספת קטגוריה
          </button>
        </div>

        <p data-testid="allocation-line"
           style={{ font: `600 12.5px ${FONT}`, color: P.ink3, marginBlockStart: 16 }}>
          {`הוקצה ${formatMoney(allocated, "ILS")} · לא מוקצה ${formatMoney(unallocated, "ILS")}`}
        </p>

        {err && (
          <p role="alert" style={{ font: `700 13px ${FONT}`, color: P.danger, marginBlockStart: 8 }}>
            {err}
          </p>
        )}

        <div style={{ display: "flex", gap: 10, marginBlockStart: 20 }}>
          <button type="button" onClick={submit}
                  style={{ flex: 1, minHeight: 48, borderRadius: 999, border: "none",
                           background: P.accent, color: "#fff", font: `800 15px ${FONT}`, cursor: "pointer" }}>
            שמירה
          </button>
          <button type="button" onClick={onClose}
                  style={{ minHeight: 48, minWidth: 88, borderRadius: 999,
                           border: `1px solid ${P.line}`, background: "transparent", color: P.ink2,
                           font: `700 15px ${FONT}`, cursor: "pointer" }}>
            ביטול
          </button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `CI=true npx react-scripts test src/components/BudgetSetupSheet.test.js --watchAll=false`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/components/Money.jsx src/components/BudgetSetupSheet.jsx src/components/BudgetSetupSheet.test.js
git commit -m "$(cat <<'EOF'
feat(budget): Money display + BudgetSetupSheet

Money centralises the two things every amount needs and no caller should
have to remember: bidi isolation (an LTR island, or "₪4,000" reorders into
nonsense inside Hebrew RTL) and tabular numerals.

BudgetSetupSheet sets the ILS target, the trip currency and its manual
rate, and optional per-category caps. A blank cap stays null — the category
still appears in the breakdown, it just has no ceiling, so anyone who only
wants a single total can ignore the whole section. Custom categories get
c_ keys. Esc closes; the dialog is labelled.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 7: `ExpenseSheet.jsx` — add / edit / delete one expense

**Files:**
- Create: `src/components/ExpenseSheet.jsx`
- Test: `src/components/ExpenseSheet.test.js`

**Interfaces:**
- Consumes: `parseAmount`, `BASE_CATEGORIES`, `CURRENCY_SYMBOL` from Task 1; `Money` from Task 6.
- Produces: `<ExpenseSheet open onClose expense config categories dayCount P onSubmit onDelete />`
  - `expense` is `null` for add mode, an item object for edit mode.
  - `onSubmit({ label, amountMinor, currency, category, dayRef, note })`
  - `onDelete(id)` — only rendered in edit mode.

- [ ] **Step 1: Write the failing test**

Create `src/components/ExpenseSheet.test.js`:

```js
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import ExpenseSheet from "./ExpenseSheet";
import { LIGHT } from "../utils/theme";
import { BASE_CATEGORIES } from "../utils/budget";

const config = { currency: "JPY", rate: 0.023, totalIlsMinor: 1500000, categories: [] };
const baseProps = (over = {}) => ({
  open: true,
  onClose: jest.fn(),
  onSubmit: jest.fn(),
  onDelete: jest.fn(),
  expense: null,
  config,
  categories: BASE_CATEGORIES,
  dayCount: 3,
  P: LIGHT,
  ...over,
});

test("renders nothing when closed", () => {
  const { container } = render(<ExpenseSheet {...baseProps({ open: false })} />);
  expect(container).toBeEmptyDOMElement();
});

test("add mode: submits an amount in the selected currency's minor units", () => {
  const props = baseProps();
  render(<ExpenseSheet {...props} />);
  fireEvent.change(screen.getByLabelText("תיאור ההוצאה"), { target: { value: "ראמן אפורי" } });
  fireEvent.change(screen.getByLabelText("סכום"), { target: { value: "1200" } });
  fireEvent.click(screen.getByRole("button", { name: "הוספה" }));

  expect(props.onSubmit).toHaveBeenCalledWith(expect.objectContaining({
    label: "ראמן אפורי", amountMinor: 1200, currency: "JPY",
  }));
});

test("switching to shekels reinterprets the amount with two decimals", () => {
  const props = baseProps();
  render(<ExpenseSheet {...props} />);
  fireEvent.change(screen.getByLabelText("תיאור ההוצאה"), { target: { value: "טיסה" } });
  fireEvent.change(screen.getByLabelText("סכום"), { target: { value: "4000" } });
  fireEvent.click(screen.getByRole("radio", { name: "₪" }));
  fireEvent.click(screen.getByRole("button", { name: "הוספה" }));

  expect(props.onSubmit).toHaveBeenCalledWith(expect.objectContaining({
    amountMinor: 400000, currency: "ILS",
  }));
});

test("a day can be attached or left general", () => {
  const props = baseProps();
  render(<ExpenseSheet {...props} />);
  fireEvent.change(screen.getByLabelText("תיאור ההוצאה"), { target: { value: "כניסה" } });
  fireEvent.change(screen.getByLabelText("סכום"), { target: { value: "500" } });
  fireEvent.change(screen.getByLabelText("שיוך ליום"), { target: { value: "2" } });
  fireEvent.click(screen.getByRole("button", { name: "הוספה" }));

  expect(props.onSubmit).toHaveBeenCalledWith(expect.objectContaining({ dayRef: 2 }));
});

test("general is the default day", () => {
  const props = baseProps();
  render(<ExpenseSheet {...props} />);
  fireEvent.change(screen.getByLabelText("תיאור ההוצאה"), { target: { value: "ביטוח" } });
  fireEvent.change(screen.getByLabelText("סכום"), { target: { value: "320" } });
  fireEvent.click(screen.getByRole("button", { name: "הוספה" }));
  expect(props.onSubmit).toHaveBeenCalledWith(expect.objectContaining({ dayRef: null }));
});

test("edit mode pre-fills, relabels the button, and offers delete", () => {
  const expense = { id: "e_a", label: "ראמן", amountMinor: 1200, currency: "JPY",
                    category: "food", dayRef: 1, note: "" };
  const props = baseProps({ expense });
  render(<ExpenseSheet {...props} />);

  expect(screen.getByLabelText("תיאור ההוצאה")).toHaveValue("ראמן");
  expect(screen.getByLabelText("סכום")).toHaveValue("1200");
  expect(screen.getByRole("button", { name: "שמירה" })).toBeInTheDocument();

  fireEvent.click(screen.getByRole("button", { name: "מחיקת ההוצאה" }));
  fireEvent.click(screen.getByRole("button", { name: "כן, למחוק" }));
  expect(props.onDelete).toHaveBeenCalledWith("e_a");
});

test("add mode offers no delete", () => {
  render(<ExpenseSheet {...baseProps()} />);
  expect(screen.queryByRole("button", { name: "מחיקת ההוצאה" })).not.toBeInTheDocument();
});

test("an invalid amount blocks submission and explains why", () => {
  const props = baseProps();
  render(<ExpenseSheet {...props} />);
  fireEvent.change(screen.getByLabelText("תיאור ההוצאה"), { target: { value: "x" } });
  fireEvent.change(screen.getByLabelText("סכום"), { target: { value: "abc" } });
  fireEvent.click(screen.getByRole("button", { name: "הוספה" }));
  expect(props.onSubmit).not.toHaveBeenCalled();
  expect(screen.getByRole("alert")).toHaveTextContent("סכום לא תקין");
});

test("an empty description blocks submission", () => {
  const props = baseProps();
  render(<ExpenseSheet {...props} />);
  fireEvent.change(screen.getByLabelText("סכום"), { target: { value: "100" } });
  fireEvent.click(screen.getByRole("button", { name: "הוספה" }));
  expect(props.onSubmit).not.toHaveBeenCalled();
  expect(screen.getByRole("alert")).toHaveTextContent("תיאור");
});

test("a foreign amount previews its shekel equivalent", () => {
  render(<ExpenseSheet {...baseProps()} />);
  fireEvent.change(screen.getByLabelText("סכום"), { target: { value: "1200" } });
  expect(screen.getByTestId("ils-preview")).toHaveTextContent("₪27.60");
});

test("Escape closes the sheet", () => {
  const props = baseProps();
  render(<ExpenseSheet {...props} />);
  fireEvent.keyDown(document, { key: "Escape" });
  expect(props.onClose).toHaveBeenCalled();
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `CI=true npx react-scripts test src/components/ExpenseSheet.test.js --watchAll=false`
Expected: FAIL — `Cannot find module './ExpenseSheet'`.

- [ ] **Step 3: Write the implementation**

Create `src/components/ExpenseSheet.jsx`:

```js
import React, { useEffect, useRef, useState } from "react";
import { CURRENCY_SYMBOL, parseAmount, toIlsMinor } from "../utils/budget";
import Money from "./Money";

/* ══════════════════════════════════════════════════════════════
   ExpenseSheet — add, edit or delete one expense.

   The currency is a two-way toggle, not a dropdown: an expense is
   either in the trip currency or in shekels, and nothing else. That
   is the whole point of the two-currency model — the ₪4,000 flight
   was bought in Israel, the ¥1,200 ramen was not.
   ══════════════════════════════════════════════════════════════ */

const FONT = "'Noto Sans Hebrew','Inter','Noto Sans JP',system-ui,sans-serif";

const minorToInput = (minor, currency) => {
  if (!Number.isFinite(minor)) return "";
  const digits = currency === "ILS" ? 2 : 0;
  const v = minor / (currency === "ILS" ? 100 : 1);
  return digits === 0 ? String(v) : String(Number(v.toFixed(2)));
};

export default function ExpenseSheet({
  open, onClose, onSubmit, onDelete, expense, config, categories, dayCount, P,
}) {
  const editing = !!expense;
  const tripCurrency = config?.currency || "ILS";
  const hasForeign = tripCurrency !== "ILS";

  const [label, setLabel] = useState("");
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState(tripCurrency);
  const [category, setCategory] = useState("other");
  const [dayRef, setDayRef] = useState("");
  const [note, setNote] = useState("");
  const [err, setErr] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const panelRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    setLabel(expense?.label || "");
    setCurrency(expense?.currency || tripCurrency);
    setAmount(expense ? minorToInput(expense.amountMinor, expense.currency || tripCurrency) : "");
    setCategory(expense?.category || "other");
    setDayRef(expense?.dayRef != null ? String(expense.dayRef) : "");
    setNote(expense?.note || "");
    setErr("");
    setConfirmDelete(false);
  }, [open, expense, tripCurrency]);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => { if (e.key === "Escape") onClose?.(); };
    document.addEventListener("keydown", onKey);
    panelRef.current?.focus();
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const parsed = parseAmount(amount, currency);
  const ilsPreview = parsed != null && currency !== "ILS"
    ? toIlsMinor(parsed, currency, config) : null;

  const submit = () => {
    if (!label.trim()) { setErr("צריך תיאור להוצאה"); return; }
    if (parsed === null) { setErr("סכום לא תקין — הזינו מספר חיובי"); return; }
    onSubmit({
      label: label.trim(),
      amountMinor: parsed,
      currency,
      category,
      dayRef: dayRef === "" ? null : Number(dayRef),
      note: note.trim(),
    });
  };

  const field = {
    width: "100%", minHeight: 44, borderRadius: 12, border: `1px solid ${P.line}`,
    background: P.surface, color: P.ink, font: `600 15px ${FONT}`,
    padding: "10px 12px", boxSizing: "border-box",
  };
  const lbl = { display: "block", font: `700 12.5px ${FONT}`, color: P.ink3, marginBlockEnd: 6 };

  const currencyChip = (code) => (
    <button
      key={code}
      type="button"
      role="radio"
      aria-checked={currency === code}
      aria-label={CURRENCY_SYMBOL[code] || code}
      onClick={() => { setCurrency(code); setErr(""); }}
      style={{
        minHeight: 44, minWidth: 52, borderRadius: 999, cursor: "pointer",
        border: `1px solid ${currency === code ? P.accent : P.line}`,
        background: currency === code ? P.accent : "transparent",
        color: currency === code ? "#fff" : P.ink2,
        font: `800 15px ${FONT}`,
      }}
    >
      {CURRENCY_SYMBOL[code] || code}
    </button>
  );

  return (
    <div
      role="presentation"
      onClick={(e) => { if (e.target === e.currentTarget) onClose?.(); }}
      style={{
        position: "fixed", inset: 0, zIndex: 310, background: "rgba(0,0,0,0.42)",
        display: "flex", alignItems: "flex-end", justifyContent: "center",
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={editing ? "עריכת הוצאה" : "הוספת הוצאה"}
        tabIndex={-1}
        dir="rtl"
        style={{
          width: "min(560px, 100%)", maxHeight: "88vh", overflowY: "auto",
          background: P.panel, color: P.ink, borderStartStartRadius: 22, borderStartEndRadius: 22,
          padding: 20, boxSizing: "border-box", font: `400 14.5px ${FONT}`, outline: "none",
        }}
      >
        <h2 style={{ font: `800 19px ${FONT}`, letterSpacing: "-0.014em", margin: "0 0 16px" }}>
          {editing ? "עריכת הוצאה" : "הוספת הוצאה"}
        </h2>

        <div style={{ marginBlockEnd: 14 }}>
          <label style={lbl} htmlFor="ex-label">תיאור ההוצאה</label>
          <input id="ex-label" style={field} value={label} aria-label="תיאור ההוצאה"
                 onChange={(e) => { setLabel(e.target.value); setErr(""); }} />
        </div>

        <div style={{ marginBlockEnd: 14 }}>
          <label style={lbl} htmlFor="ex-amount">סכום</label>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <input id="ex-amount" style={{ ...field, flex: 1 }} inputMode="decimal" value={amount}
                   aria-label="סכום"
                   onChange={(e) => { setAmount(e.target.value); setErr(""); }} />
            {hasForeign && (
              <div role="radiogroup" aria-label="מטבע" style={{ display: "flex", gap: 6 }}>
                {currencyChip(tripCurrency)}
                {currencyChip("ILS")}
              </div>
            )}
          </div>
          {ilsPreview != null && (
            <p data-testid="ils-preview"
               style={{ font: `600 12.5px ${FONT}`, color: P.ink3, marginBlockStart: 6 }}>
              ≈ <Money minor={ilsPreview} currency="ILS" P={P} tone="ink3" />
            </p>
          )}
        </div>

        <div style={{ display: "flex", gap: 10, marginBlockEnd: 14 }}>
          <div style={{ flex: 1 }}>
            <label style={lbl} htmlFor="ex-cat">קטגוריה</label>
            <select id="ex-cat" style={field} value={category} aria-label="קטגוריה"
                    onChange={(e) => setCategory(e.target.value)}>
              {categories.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
            </select>
          </div>
          <div style={{ flex: 1 }}>
            <label style={lbl} htmlFor="ex-day">שיוך ליום</label>
            <select id="ex-day" style={field} value={dayRef} aria-label="שיוך ליום"
                    onChange={(e) => setDayRef(e.target.value)}>
              <option value="">כללי</option>
              {Array.from({ length: dayCount || 0 }, (_, i) => i + 1).map((d) => (
                <option key={d} value={String(d)}>{`יום ${d}`}</option>
              ))}
            </select>
          </div>
        </div>

        <div style={{ marginBlockEnd: 14 }}>
          <label style={lbl} htmlFor="ex-note">הערה</label>
          <input id="ex-note" style={field} value={note} aria-label="הערה"
                 onChange={(e) => setNote(e.target.value)} />
        </div>

        {err && (
          <p role="alert" style={{ font: `700 13px ${FONT}`, color: P.danger, marginBlockEnd: 10 }}>
            {err}
          </p>
        )}

        <div style={{ display: "flex", gap: 10 }}>
          <button type="button" onClick={submit}
                  style={{ flex: 1, minHeight: 48, borderRadius: 999, border: "none",
                           background: P.accent, color: "#fff", font: `800 15px ${FONT}`, cursor: "pointer" }}>
            {editing ? "שמירה" : "הוספה"}
          </button>
          <button type="button" onClick={onClose}
                  style={{ minHeight: 48, minWidth: 88, borderRadius: 999,
                           border: `1px solid ${P.line}`, background: "transparent", color: P.ink2,
                           font: `700 15px ${FONT}`, cursor: "pointer" }}>
            ביטול
          </button>
        </div>

        {editing && !confirmDelete && (
          <button type="button" onClick={() => setConfirmDelete(true)}
                  style={{ width: "100%", minHeight: 44, marginBlockStart: 12, borderRadius: 999,
                           border: "none", background: "transparent", color: P.danger,
                           font: `700 14px ${FONT}`, cursor: "pointer" }}>
            מחיקת ההוצאה
          </button>
        )}

        {editing && confirmDelete && (
          <div style={{ marginBlockStart: 12, padding: 12, borderRadius: 14,
                        background: P.surface, border: `1px solid ${P.line}` }}>
            <p style={{ font: `700 13.5px ${FONT}`, margin: "0 0 10px" }}>
              למחוק את ההוצאה לצמיתות?
            </p>
            <div style={{ display: "flex", gap: 8 }}>
              <button type="button" onClick={() => onDelete?.(expense.id)}
                      style={{ flex: 1, minHeight: 44, borderRadius: 999, border: "none",
                               background: P.danger, color: "#fff", font: `800 14px ${FONT}`, cursor: "pointer" }}>
                כן, למחוק
              </button>
              <button type="button" onClick={() => setConfirmDelete(false)}
                      style={{ flex: 1, minHeight: 44, borderRadius: 999, border: `1px solid ${P.line}`,
                               background: "transparent", color: P.ink2, font: `700 14px ${FONT}`, cursor: "pointer" }}>
                ביטול
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `CI=true npx react-scripts test src/components/ExpenseSheet.test.js --watchAll=false`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/ExpenseSheet.jsx src/components/ExpenseSheet.test.js
git commit -m "$(cat <<'EOF'
feat(budget): ExpenseSheet — add, edit and delete one expense

The currency control is a two-way toggle rather than a dropdown, because
an expense is either in the trip currency or in shekels and nothing else.
A foreign amount previews its shekel equivalent live.

Deleting requires a second, explicit confirmation in place — money the
user typed does not disappear on one tap.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 8: `ExpenseRow.jsx` — the paid → "was it different?" → actual flow

This is the interaction the owner designed: one amount plus a tick, and the second number is asked for only when it exists.

**Files:**
- Create: `src/components/ExpenseRow.jsx`
- Test: `src/components/ExpenseRow.test.js`

**Interfaces:**
- Consumes: `parseAmount`, `toIlsMinor` from Task 1; `Money` from Task 6.
- Produces: `<ExpenseRow item config dayLabel categoryLabel readOnly P onEdit onMarkPaid />`
  - `onMarkPaid(id, paid, actualMinor|null)`
  - `onEdit(item)`

- [ ] **Step 1: Write the failing test**

Create `src/components/ExpenseRow.test.js`:

```js
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import ExpenseRow from "./ExpenseRow";
import { LIGHT } from "../utils/theme";

const config = { currency: "JPY", rate: 0.023 };
const item = {
  id: "e_a", label: "ראמן אפורי", amountMinor: 1200, currency: "JPY",
  category: "food", dayRef: 1, paid: false, actualMinor: null, note: "",
};
const baseProps = (over = {}) => ({
  item, config, dayLabel: "יום 1", categoryLabel: "אוכל",
  readOnly: false, P: LIGHT,
  onEdit: jest.fn(), onMarkPaid: jest.fn(),
  ...over,
});

test("shows the label, the entry-currency amount and the shekel equivalent", () => {
  render(<ExpenseRow {...baseProps()} />);
  expect(screen.getByText("ראמן אפורי")).toBeInTheDocument();
  expect(screen.getByTestId("row-amount")).toHaveTextContent("¥1,200");
  expect(screen.getByTestId("row-ils")).toHaveTextContent("₪27.60");
});

test("an ILS expense shows no redundant second figure", () => {
  const ils = { ...item, amountMinor: 400000, currency: "ILS" };
  render(<ExpenseRow {...baseProps({ item: ils })} />);
  expect(screen.getByTestId("row-amount")).toHaveTextContent("₪4,000.00");
  expect(screen.queryByTestId("row-ils")).not.toBeInTheDocument();
});

/* THE FLOW: tick → "was it different?" → no → paid with no actual amount. */
test("ticking paid then 'same amount' records paid with no actual", () => {
  const props = baseProps();
  render(<ExpenseRow {...props} />);
  fireEvent.click(screen.getByRole("button", { name: "סימון ראמן אפורי כשולם" }));

  expect(screen.getByText("האם העלות הייתה שונה?")).toBeInTheDocument();
  expect(props.onMarkPaid).not.toHaveBeenCalled();

  fireEvent.click(screen.getByRole("button", { name: "לא, אותו סכום" }));
  expect(props.onMarkPaid).toHaveBeenCalledWith("e_a", true, null);
});

/* …→ yes → a single numeric field → paid with the real amount. */
test("ticking paid then 'yes' asks for the real amount", () => {
  const props = baseProps();
  render(<ExpenseRow {...props} />);
  fireEvent.click(screen.getByRole("button", { name: "סימון ראמן אפורי כשולם" }));
  fireEvent.click(screen.getByRole("button", { name: "כן" }));

  fireEvent.change(screen.getByLabelText("הסכום ששולם בפועל"), { target: { value: "1500" } });
  fireEvent.click(screen.getByRole("button", { name: "אישור" }));
  expect(props.onMarkPaid).toHaveBeenCalledWith("e_a", true, 1500);
});

test("an invalid actual amount is rejected without calling back", () => {
  const props = baseProps();
  render(<ExpenseRow {...props} />);
  fireEvent.click(screen.getByRole("button", { name: "סימון ראמן אפורי כשולם" }));
  fireEvent.click(screen.getByRole("button", { name: "כן" }));
  fireEvent.change(screen.getByLabelText("הסכום ששולם בפועל"), { target: { value: "abc" } });
  fireEvent.click(screen.getByRole("button", { name: "אישור" }));
  expect(props.onMarkPaid).not.toHaveBeenCalled();
});

test("un-ticking a paid expense clears the actual amount immediately, with no prompt", () => {
  const paid = { ...item, paid: true, actualMinor: 1500 };
  const props = baseProps({ item: paid });
  render(<ExpenseRow {...props} />);
  fireEvent.click(screen.getByRole("button", { name: "ביטול סימון ראמן אפורי כשולם" }));
  expect(props.onMarkPaid).toHaveBeenCalledWith("e_a", false, null);
  expect(screen.queryByText("האם העלות הייתה שונה?")).not.toBeInTheDocument();
});

test("a paid expense that cost more shows both figures", () => {
  const paid = { ...item, paid: true, actualMinor: 1500 };
  render(<ExpenseRow {...baseProps({ item: paid })} />);
  expect(screen.getByTestId("row-amount")).toHaveTextContent("¥1,500");
  expect(screen.getByTestId("row-planned")).toHaveTextContent("¥1,200");
});

test("the day and category are shown as text, not only as colour", () => {
  render(<ExpenseRow {...baseProps()} />);
  expect(screen.getByText("יום 1")).toBeInTheDocument();
  expect(screen.getByText("אוכל")).toBeInTheDocument();
});

test("clicking the row opens the editor", () => {
  const props = baseProps();
  render(<ExpenseRow {...props} />);
  fireEvent.click(screen.getByRole("button", { name: "עריכת ראמן אפורי" }));
  expect(props.onEdit).toHaveBeenCalledWith(item);
});

test("read-only hides both the tick and the edit affordance", () => {
  render(<ExpenseRow {...baseProps({ readOnly: true })} />);
  expect(screen.queryByRole("button", { name: /כשולם/ })).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: /עריכת/ })).not.toBeInTheDocument();
});

test("the paid control meets the 44px touch target", () => {
  render(<ExpenseRow {...baseProps()} />);
  const btn = screen.getByRole("button", { name: "סימון ראמן אפורי כשולם" });
  expect(btn).toHaveStyle({ minWidth: "44px", minHeight: "44px" });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `CI=true npx react-scripts test src/components/ExpenseRow.test.js --watchAll=false`
Expected: FAIL — `Cannot find module './ExpenseRow'`.

- [ ] **Step 3: Write the implementation**

Create `src/components/ExpenseRow.jsx`:

```js
import React, { useState } from "react";
import { parseAmount, toIlsMinor } from "../utils/budget";
import Money from "./Money";

/* ══════════════════════════════════════════════════════════════
   ExpenseRow — one expense, and the planned→actual transition.

   The flow, in the owner's words: one amount and a tick, and after
   the tick, "was it different?". Only a yes reveals a second field.
   That keeps the default path to a single tap while still capturing
   the real number when it exists.

   Un-ticking never prompts: it just clears both, because a "what it
   really cost" figure is meaningless on an unpaid expense.
   ══════════════════════════════════════════════════════════════ */

const FONT = "'Noto Sans Hebrew','Inter','Noto Sans JP',system-ui,sans-serif";

export default function ExpenseRow({
  item, config, dayLabel, categoryLabel, readOnly, P, onEdit, onMarkPaid,
}) {
  /* null → no prompt; "ask" → was it different?; "amount" → enter it. */
  const [phase, setPhase] = useState(null);
  const [actual, setActual] = useState("");
  const [err, setErr] = useState(false);

  const cur = item.currency || "ILS";
  const shownMinor = (item.paid && Number.isFinite(item.actualMinor))
    ? item.actualMinor : item.amountMinor;
  const differed = item.paid && Number.isFinite(item.actualMinor)
    && item.actualMinor !== item.amountMinor;
  const ils = cur === "ILS" ? null : toIlsMinor(shownMinor, cur, config);

  const startPaid = () => { setPhase("ask"); setActual(""); setErr(false); };
  const sameAmount = () => { setPhase(null); onMarkPaid?.(item.id, true, null); };
  const confirmActual = () => {
    const parsed = parseAmount(actual, cur);
    if (parsed === null) { setErr(true); return; }
    setPhase(null);
    onMarkPaid?.(item.id, true, parsed);
  };

  const chip = {
    font: `700 11.5px ${FONT}`, color: P.ink3, background: P.surface,
    borderRadius: 999, padding: "3px 9px", whiteSpace: "nowrap",
  };
  const tap = {
    minWidth: 44, minHeight: 44, display: "flex", alignItems: "center",
    justifyContent: "center", borderRadius: 999, cursor: "pointer",
    background: "transparent",
  };

  return (
    <div style={{ borderBlockEnd: `1px solid ${P.line}`, paddingBlock: 6 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        {!readOnly && (
          <button
            type="button"
            aria-label={`${item.paid ? "ביטול סימון" : "סימון"} ${item.label} כשולם`}
            aria-pressed={!!item.paid}
            onClick={() => (item.paid ? onMarkPaid?.(item.id, false, null) : startPaid())}
            style={{
              ...tap,
              border: `1px solid ${item.paid ? P.accent : P.line}`,
              color: item.paid ? "#fff" : P.ink3,
              background: item.paid ? P.accent : "transparent",
              font: `800 15px ${FONT}`,
            }}
          >
            ✓
          </button>
        )}

        <button
          type="button"
          aria-label={readOnly ? undefined : `עריכת ${item.label}`}
          onClick={readOnly ? undefined : () => onEdit?.(item)}
          disabled={readOnly}
          style={{
            flex: 1, minHeight: 44, textAlign: "start", border: "none",
            background: "transparent", cursor: readOnly ? "default" : "pointer",
            padding: 0, color: P.ink,
          }}
        >
          <span style={{ display: "block", font: `700 14.5px ${FONT}` }}>{item.label}</span>
          <span style={{ display: "flex", gap: 6, marginBlockStart: 4 }}>
            <span style={chip}>{categoryLabel}</span>
            <span style={chip}>{dayLabel}</span>
            {/* Paid state is carried by text, never by colour alone. */}
            {item.paid && <span style={{ ...chip, color: P.accent }}>שולם</span>}
          </span>
        </button>

        <span style={{ textAlign: "end" }}>
          <span data-testid="row-amount" style={{ display: "block" }}>
            <Money minor={shownMinor} currency={cur} bold P={P} />
          </span>
          {differed && (
            <span data-testid="row-planned"
                  style={{ display: "block", font: `600 11.5px ${FONT}`, color: P.ink3 }}>
              {"תוכנן "}
              <Money minor={item.amountMinor} currency={cur} P={P} tone="ink3" />
            </span>
          )}
          {ils != null && (
            <span data-testid="row-ils"
                  style={{ display: "block", font: `600 11.5px ${FONT}`, color: P.ink3 }}>
              <Money minor={ils} currency="ILS" P={P} tone="ink3" />
            </span>
          )}
        </span>
      </div>

      {phase === "ask" && (
        <div role="group" aria-label="אימות סכום ששולם"
             style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap",
                      background: P.surface, borderRadius: 14, padding: 10, marginBlockStart: 8 }}>
          <span style={{ font: `700 13.5px ${FONT}`, color: P.ink2 }}>האם העלות הייתה שונה?</span>
          <button type="button" onClick={() => setPhase("amount")}
                  style={{ minHeight: 44, minWidth: 64, borderRadius: 999, border: `1px solid ${P.accent}`,
                           background: "transparent", color: P.accent, font: `800 14px ${FONT}`, cursor: "pointer" }}>
            כן
          </button>
          <button type="button" onClick={sameAmount}
                  style={{ minHeight: 44, padding: "0 14px", borderRadius: 999, border: `1px solid ${P.line}`,
                           background: "transparent", color: P.ink2, font: `700 14px ${FONT}`, cursor: "pointer" }}>
            לא, אותו סכום
          </button>
        </div>
      )}

      {phase === "amount" && (
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap",
                      background: P.surface, borderRadius: 14, padding: 10, marginBlockStart: 8 }}>
          <input
            aria-label="הסכום ששולם בפועל"
            inputMode="decimal"
            value={actual}
            onChange={(e) => { setActual(e.target.value); setErr(false); }}
            onKeyDown={(e) => { if (e.key === "Enter") confirmActual(); }}
            style={{ flex: 1, minWidth: 120, minHeight: 44, borderRadius: 12,
                     border: `1px solid ${err ? P.danger : P.line}`, background: P.panel,
                     color: P.ink, font: `700 15px ${FONT}`, padding: "8px 12px" }}
          />
          <button type="button" onClick={confirmActual}
                  style={{ minHeight: 44, padding: "0 18px", borderRadius: 999, border: "none",
                           background: P.accent, color: "#fff", font: `800 14px ${FONT}`, cursor: "pointer" }}>
            אישור
          </button>
          <button type="button" onClick={() => setPhase(null)}
                  style={{ minHeight: 44, minWidth: 44, borderRadius: 999, border: `1px solid ${P.line}`,
                           background: "transparent", color: P.ink2, font: `700 14px ${FONT}`, cursor: "pointer" }}>
            ביטול
          </button>
          {err && (
            <span role="alert" style={{ font: `700 12.5px ${FONT}`, color: P.danger, width: "100%" }}>
              סכום לא תקין
            </span>
          )}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `CI=true npx react-scripts test src/components/ExpenseRow.test.js --watchAll=false`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/ExpenseRow.jsx src/components/ExpenseRow.test.js
git commit -m "$(cat <<'EOF'
feat(budget): ExpenseRow — paid tick, then "was it different?"

The default path stays one tap: tick, "no, same amount", done. Only a
"yes" reveals the second field, so planned-vs-actual precision costs
nothing until it is actually needed.

Un-ticking never prompts — it clears both, because a "what it really
cost" figure is meaningless on an unpaid expense.

Paid state is carried by a text chip, not by colour alone.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 9: `BudgetView.jsx` + the route

**Files:**
- Create: `src/views/BudgetView.jsx`
- Modify: `src/App.jsx` (import + one `<Route>`)
- Test: `src/views/BudgetView.test.js`

**Interfaces:**
- Consumes: `useBudget` (Task 5), `BudgetSetupSheet` (Task 6), `ExpenseSheet` (Task 7), `ExpenseRow` (Task 8), `Money` (Task 6), `resolveDay` / `BASE_CATEGORIES` / `formatMoney` (Tasks 1–3), `tripService.fetchTripById`.
- Produces: the `/trip/budget/:tripId` screen. Nothing consumes it.

Note: `SHOW_CHROME` in `App.jsx:185` does not match `/trip/`, so the new route gets a full viewport with no dock — the same treatment `/trip/overview/:tripId` already receives. No chrome change is needed.

- [ ] **Step 1: Write the failing test**

Create `src/views/BudgetView.test.js`:

```js
import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import BudgetView from "./BudgetView";
import tripService from "../services/tripService";

jest.mock("../services/tripService", () => ({
  __esModule: true,
  default: { fetchTripById: jest.fn(), saveTrip: jest.fn(() => Promise.resolve({})) },
}));

const withBudget = {
  config: {
    currency: "JPY", rate: 0.023, totalIlsMinor: 1500000,
    categories: [
      { key: "flights", label: "טיסות", capIlsMinor: 400000 },
      { key: "food", label: "אוכל", capIlsMinor: 200000 },
    ],
  },
  items: [
    { id: "e_1", label: "טיסה תל אביב–טוקיו", amountMinor: 400000, currency: "ILS",
      category: "flights", dayRef: null, paid: true, actualMinor: null },
    { id: "e_2", label: "ראמן אפורי", amountMinor: 1200, currency: "JPY",
      category: "food", dayRef: 1, paid: false, actualMinor: null },
  ],
};

const makeTrip = (budget) => ({
  id: "t1", title: "ירח דבש ביפן", readOnly: false, days: 3,
  data: { tripData: [{ day: 1, attractions: [] }, { day: 2, attractions: [] }, { day: 3, attractions: [] }],
          ...(budget ? { budget } : {}) },
});

const renderView = () => render(
  <MemoryRouter initialEntries={["/trip/budget/t1"]}>
    <Routes><Route path="/trip/budget/:tripId" element={<BudgetView />} /></Routes>
  </MemoryRouter>
);

beforeEach(() => {
  tripService.fetchTripById.mockReset();
  tripService.saveTrip.mockReset().mockImplementation(() => Promise.resolve({}));
});

test("empty state invites the user to set a budget", async () => {
  tripService.fetchTripById.mockResolvedValue(makeTrip(null));
  renderView();
  expect(await screen.findByText("עוד לא הגדרת תקציב לטיול")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "הגדרת תקציב" })).toBeInTheDocument();
});

test("summary shows effective against the target, plus planned and actual", async () => {
  tripService.fetchTripById.mockResolvedValue(makeTrip(withBudget));
  renderView();
  // effective = 400000 + 2760 = 402760
  expect(await screen.findByTestId("summary-effective")).toHaveTextContent("₪4,027.60");
  expect(screen.getByTestId("summary-total")).toHaveTextContent("₪15,000.00");
  expect(screen.getByTestId("summary-planned")).toHaveTextContent("₪4,027.60");
  expect(screen.getByTestId("summary-actual")).toHaveTextContent("₪4,000.00");
});

test("the progress bar exposes real ARIA values", async () => {
  tripService.fetchTripById.mockResolvedValue(makeTrip(withBudget));
  renderView();
  const bar = await screen.findByRole("progressbar");
  expect(bar).toHaveAttribute("aria-valuemin", "0");
  expect(bar).toHaveAttribute("aria-valuemax", "1500000");
  expect(bar).toHaveAttribute("aria-valuenow", "402760");
});

test("the allocation line reports what is unallocated", async () => {
  tripService.fetchTripById.mockResolvedValue(makeTrip(withBudget));
  renderView();
  // 1500000 - (400000 + 200000) = 900000
  expect(await screen.findByTestId("allocation")).toHaveTextContent("₪9,000.00");
});

test("grouped by category by default, each capped group showing its cap", async () => {
  tripService.fetchTripById.mockResolvedValue(makeTrip(withBudget));
  renderView();
  const heads = (await screen.findAllByRole("heading", { level: 3 })).map((h) => h.textContent);
  expect(heads).toContain("טיסות");
  expect(heads).toContain("אוכל");
  expect(screen.getByText("טיסה תל אביב–טוקיו")).toBeInTheDocument();
});

test("switching to the day view regroups the same expenses", async () => {
  tripService.fetchTripById.mockResolvedValue(makeTrip(withBudget));
  renderView();
  fireEvent.click(await screen.findByRole("button", { name: "לפי יום" }));
  const heads = screen.getAllByRole("heading", { level: 3 }).map((h) => h.textContent);
  expect(heads).toContain("כללי");
  expect(heads).toContain("יום 1");
});

test("going over budget is announced in words, not only in colour", async () => {
  const over = {
    ...withBudget,
    config: { ...withBudget.config, totalIlsMinor: 100000 },
  };
  tripService.fetchTripById.mockResolvedValue(makeTrip(over));
  renderView();
  expect(await screen.findByTestId("summary-state")).toHaveTextContent("חריגה");
});

test("within budget reports what remains", async () => {
  tripService.fetchTripById.mockResolvedValue(makeTrip(withBudget));
  renderView();
  expect(await screen.findByTestId("summary-state")).toHaveTextContent("נותרו");
});

test("adding an expense persists through saveTrip", async () => {
  tripService.fetchTripById.mockResolvedValue(makeTrip(withBudget));
  renderView();
  fireEvent.click(await screen.findByRole("button", { name: "הוספת הוצאה" }));
  fireEvent.change(screen.getByLabelText("תיאור ההוצאה"), { target: { value: "ביטוח" } });
  fireEvent.change(screen.getByLabelText("סכום"), { target: { value: "320" } });
  fireEvent.click(screen.getByRole("button", { name: "הוספה" }));

  await waitFor(() => expect(tripService.saveTrip).toHaveBeenCalled());
  expect(screen.getByText("ביטוח")).toBeInTheDocument();
});

test("a read-only trip shows the numbers but offers no add button", async () => {
  tripService.fetchTripById.mockResolvedValue({ ...makeTrip(withBudget), readOnly: true });
  renderView();
  expect(await screen.findByTestId("summary-effective")).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "הוספת הוצאה" })).not.toBeInTheDocument();
});

test("a load failure is reported rather than left blank", async () => {
  tripService.fetchTripById.mockRejectedValue(new Error("nope"));
  renderView();
  expect(await screen.findByRole("alert")).toHaveTextContent("לא ניתן לטעון");
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `CI=true npx react-scripts test src/views/BudgetView.test.js --watchAll=false`
Expected: FAIL — `Cannot find module './BudgetView'`.

- [ ] **Step 3: Write the implementation**

Create `src/views/BudgetView.jsx`:

```js
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import tripService from "../services/tripService";
import useBudget from "../hooks/useBudget";
import { useDarkMode } from "../utils/theme";
import { BASE_CATEGORIES, formatMoney, resolveDay } from "../utils/budget";
import Money from "../components/Money";
import BudgetSetupSheet from "../components/BudgetSetupSheet";
import ExpenseSheet from "../components/ExpenseSheet";
import ExpenseRow from "../components/ExpenseRow";

/* ══════════════════════════════════════════════════════════════
   BudgetView — /trip/budget/:tripId

   One responsive screen rather than a mobile/desktop pair: this is a
   summary block above a grouped list, which a max-width container
   handles correctly at every width. Split it only if the layouts ever
   genuinely diverge.

   Grouping defaults to CATEGORY because that is where the caps live;
   "by day" is the secondary view.

   Note App.jsx SHOW_CHROME does not match /trip/, so this route owns
   the full viewport — same as /trip/overview/:tripId.
   ══════════════════════════════════════════════════════════════ */

const FONT = "'Noto Sans Hebrew','Inter','Noto Sans JP',system-ui,sans-serif";

export default function BudgetView() {
  const { tripId } = useParams();
  const navigate = useNavigate();
  const { P } = useDarkMode();

  const [trip, setTrip] = useState(null);
  const [loadError, setLoadError] = useState("");
  const [mode, setMode] = useState("category");     // "category" | "day"
  const [setupOpen, setSetupOpen] = useState(false);
  const [editing, setEditing] = useState(undefined); // undefined = closed, null = add, obj = edit

  useEffect(() => {
    let live = true;
    tripService.fetchTripById(tripId)
      .then((t) => { if (live) setTrip(t); })
      .catch(() => { if (live) setLoadError("לא ניתן לטעון את התקציב"); });
    return () => { live = false; };
  }, [tripId]);

  const {
    budget, roll, hasAny, readOnly, error,
    setConfig, createExpense, editExpense, deleteExpense, markPaid,
  } = useBudget(trip);

  const config = budget?.config || { currency: "ILS", rate: 1, categories: [] };
  const items = budget?.items || [];
  const tripData = trip?.data?.tripData || [];
  const dayCount = tripData.length || trip?.days || 0;

  /* Declared categories win their label; base ones fill the rest. */
  const categories = useMemo(() => {
    const declared = config.categories || [];
    const extra = declared.filter((c) => !BASE_CATEGORIES.some((b) => b.key === c.key));
    return [...BASE_CATEGORIES, ...extra];
  }, [config.categories]);

  const labelForCategory = useCallback((key) =>
    categories.find((c) => c.key === key)?.label || "אחר", [categories]);

  const labelForDay = useCallback((item) => {
    const d = resolveDay(item, tripData);
    return d == null ? "כללי" : `יום ${d}`;
  }, [tripData]);

  const groups = useMemo(() => {
    if (mode === "category") {
      return roll.byCategory.map((c) => ({
        key: c.key,
        title: c.label,
        cap: c,
        items: items.filter((i) => (i.category || "other") === c.key),
      }));
    }
    const byDay = new Map();
    const general = [];
    for (const it of items) {
      const d = resolveDay(it, tripData);
      if (d == null) general.push(it);
      else { if (!byDay.has(d)) byDay.set(d, []); byDay.get(d).push(it); }
    }
    return [
      { key: "general", title: "כללי", cap: null, items: general },
      ...[...byDay.keys()].sort((a, b) => a - b)
        .map((d) => ({ key: `day-${d}`, title: `יום ${d}`, cap: null, items: byDay.get(d) })),
    ].filter((g) => g.items.length);
  }, [mode, roll.byCategory, items, tripData]);

  const submitExpense = (payload) => {
    if (editing) editExpense(editing.id, payload);
    else createExpense(payload);
    setEditing(undefined);
  };

  const page = {
    minHeight: "100vh", background: P.page, color: P.ink,
    font: `400 14.5px ${FONT}`, paddingBlockEnd: 96,
  };
  const shell = { width: "min(760px, 100%)", marginInline: "auto", padding: 16, boxSizing: "border-box" };
  const card = { background: P.panel, borderRadius: 20, padding: 18, border: `1px solid ${P.line}` };

  if (loadError) {
    return (
      <div dir="rtl" style={page}>
        <div style={shell}>
          <p role="alert" style={{ font: `700 15px ${FONT}`, color: P.danger }}>{loadError}</p>
        </div>
      </div>
    );
  }

  if (!trip) {
    return (
      <div dir="rtl" style={page}>
        <div style={shell}><p style={{ color: P.ink3 }}>טוען…</p></div>
      </div>
    );
  }

  const over = roll.overBudget;

  return (
    <div dir="rtl" style={page}>
      <div style={shell}>
        <header style={{ display: "flex", alignItems: "center", gap: 10, marginBlockEnd: 16 }}>
          <button
            type="button"
            aria-label="חזרה"
            onClick={() => navigate(`/trip/overview/${tripId}`)}
            style={{ minWidth: 44, minHeight: 44, borderRadius: 999, border: `1px solid ${P.line}`,
                     background: P.panel, color: P.ink, font: `800 17px ${FONT}`, cursor: "pointer" }}
          >
            ›
          </button>
          <h1 style={{ font: `800 20px ${FONT}`, letterSpacing: "-0.014em", margin: 0 }}>
            {`תקציב · ${trip.title}`}
          </h1>
        </header>

        {error && (
          <p role="alert" style={{ font: `700 13px ${FONT}`, color: P.danger, marginBlockEnd: 10 }}>
            {error}
          </p>
        )}

        {!hasAny ? (
          <div style={{ ...card, textAlign: "center" }}>
            <p style={{ font: `800 16px ${FONT}`, margin: "0 0 6px" }}>עוד לא הגדרת תקציב לטיול</p>
            <p style={{ font: `400 13.5px ${FONT}`, color: P.ink3, margin: "0 0 16px" }}>
              קובעים סכום, ומכאן כל הוצאה נספרת מולו.
            </p>
            {!readOnly && (
              <button type="button" onClick={() => setSetupOpen(true)}
                      style={{ minHeight: 48, padding: "0 24px", borderRadius: 999, border: "none",
                               background: P.accent, color: "#fff", font: `800 15px ${FONT}`, cursor: "pointer" }}>
                הגדרת תקציב
              </button>
            )}
          </div>
        ) : (
          <>
            <section style={{ ...card, marginBlockEnd: 14 }}>
              <p style={{ margin: 0, font: `400 13px ${FONT}`, color: P.ink3 }}>
                <span data-testid="summary-effective">
                  <Money minor={roll.effectiveIlsMinor} currency="ILS" bold P={P}
                         tone={over ? "danger" : "ink"} style={{ fontSize: 26 }} />
                </span>
                {" מתוך "}
                <span data-testid="summary-total">
                  <Money minor={roll.totalIlsMinor} currency="ILS" P={P} tone="ink3" />
                </span>
              </p>

              <div
                role="progressbar"
                aria-label="ניצול התקציב"
                aria-valuemin={0}
                aria-valuemax={roll.totalIlsMinor}
                aria-valuenow={roll.effectiveIlsMinor}
                style={{ height: 10, borderRadius: 999, background: P.surface2,
                         overflow: "hidden", marginBlock: 12 }}
              >
                <div style={{
                  height: "100%", width: `${Math.min(100, roll.pct ?? 0)}%`,
                  background: over ? P.danger : P.accent, borderRadius: 999,
                }} />
              </div>

              {/* State in WORDS — never colour alone (WCAG 2.2 AA). */}
              <p data-testid="summary-state"
                 style={{ margin: 0, font: `800 14px ${FONT}`, color: over ? P.danger : P.ink2 }}>
                {over
                  ? `חריגה של ${formatMoney(-roll.remainingIlsMinor, "ILS")}`
                  : `נותרו ${formatMoney(roll.remainingIlsMinor, "ILS")}`}
              </p>

              <p style={{ marginBlock: "10px 0", font: `600 12.5px ${FONT}`, color: P.ink3 }}>
                {"מתוכנן "}
                <span data-testid="summary-planned">
                  <Money minor={roll.plannedIlsMinor} currency="ILS" P={P} tone="ink3" />
                </span>
                {" · בפועל "}
                <span data-testid="summary-actual">
                  <Money minor={roll.actualIlsMinor} currency="ILS" P={P} tone="ink3" />
                </span>
              </p>
              <p data-testid="allocation"
                 style={{ marginBlock: "4px 0", font: `600 12.5px ${FONT}`, color: P.ink3 }}>
                {`הוקצה ${formatMoney(roll.allocatedIlsMinor, "ILS")} · לא מוקצה ${formatMoney(roll.unallocatedIlsMinor, "ILS")}`}
              </p>

              {!readOnly && (
                <button type="button" onClick={() => setSetupOpen(true)}
                        style={{ marginBlockStart: 14, minHeight: 44, padding: "0 18px", borderRadius: 999,
                                 border: `1px solid ${P.line}`, background: "transparent", color: P.ink2,
                                 font: `700 14px ${FONT}`, cursor: "pointer" }}>
                  עריכת התקציב
                </button>
              )}
            </section>

            <div role="group" aria-label="אופן הקיבוץ"
                 style={{ display: "flex", gap: 8, marginBlockEnd: 12 }}>
              {[["category", "לפי קטגוריה"], ["day", "לפי יום"]].map(([m, t]) => (
                <button key={m} type="button" onClick={() => setMode(m)} aria-pressed={mode === m}
                        style={{ minHeight: 44, padding: "0 16px", borderRadius: 999, cursor: "pointer",
                                 border: `1px solid ${mode === m ? P.accent : P.line}`,
                                 background: mode === m ? P.accent : "transparent",
                                 color: mode === m ? "#fff" : P.ink2, font: `700 13.5px ${FONT}` }}>
                  {t}
                </button>
              ))}
            </div>

            {groups.map((g) => (
              <section key={g.key} style={{ ...card, marginBlockEnd: 12 }}>
                <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBlockEnd: 8 }}>
                  <h3 style={{ font: `800 14.5px ${FONT}`, margin: 0, flex: 1 }}>{g.title}</h3>
                  {g.cap && (
                    <span style={{ font: `600 12.5px ${FONT}`, color: g.cap.over ? P.danger : P.ink3 }}>
                      <Money minor={g.cap.effectiveIlsMinor} currency="ILS" P={P}
                             tone={g.cap.over ? "danger" : "ink3"} />
                      {g.cap.capIlsMinor != null && (
                        <>
                          {" / "}
                          <Money minor={g.cap.capIlsMinor} currency="ILS" P={P} tone="ink3" />
                        </>
                      )}
                      {g.cap.over && <strong style={{ marginInlineStart: 6 }}>חריגה</strong>}
                    </span>
                  )}
                </div>
                {g.items.length === 0
                  ? <p style={{ font: `400 13px ${FONT}`, color: P.ink4, margin: 0 }}>אין הוצאות</p>
                  : g.items.map((it) => (
                      <ExpenseRow
                        key={it.id}
                        item={it}
                        config={config}
                        dayLabel={labelForDay(it)}
                        categoryLabel={labelForCategory(it.category)}
                        readOnly={readOnly}
                        P={P}
                        onEdit={setEditing}
                        onMarkPaid={markPaid}
                      />
                    ))}
              </section>
            ))}

            {!readOnly && (
              <button type="button" onClick={() => setEditing(null)}
                      style={{ width: "100%", minHeight: 52, borderRadius: 999, border: "none",
                               background: P.accent, color: "#fff", font: `800 15px ${FONT}`,
                               cursor: "pointer", marginBlockStart: 6 }}>
                הוספת הוצאה
              </button>
            )}
          </>
        )}
      </div>

      <BudgetSetupSheet
        open={setupOpen}
        onClose={() => setSetupOpen(false)}
        config={config}
        P={P}
        onSave={(next) => { setConfig(next); setSetupOpen(false); }}
      />

      <ExpenseSheet
        open={editing !== undefined}
        onClose={() => setEditing(undefined)}
        expense={editing || null}
        config={config}
        categories={categories}
        dayCount={dayCount}
        P={P}
        onSubmit={submitExpense}
        onDelete={(id) => { deleteExpense(id); setEditing(undefined); }}
      />
    </div>
  );
}
```

- [ ] **Step 4: Add the route**

In `src/App.jsx`, add the import beside the other view imports:

```js
import BudgetView from "./views/BudgetView";
```

Then insert this `<Route>` immediately after the `/trip/overview/:tripId` route (which ends at `App.jsx:149`):

```jsx
        <Route
          path="/trip/budget/:tripId"
          element={
            <ProtectedRoute>
              <BudgetView />
            </ProtectedRoute>
          }
        />
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `CI=true npx react-scripts test src/views/BudgetView.test.js --watchAll=false`
Expected: PASS.

- [ ] **Step 6: Verify the whole suite and the build**

Run: `CI=true npx react-scripts test --watchAll=false && npm run critical && CI=true npm run build`
Expected: all suites pass, `critical` 9/9, build compiles with no new warnings.

- [ ] **Step 7: Commit**

```bash
git add src/views/BudgetView.jsx src/views/BudgetView.test.js src/App.jsx
git commit -m "$(cat <<'EOF'
feat(budget): /trip/budget/:tripId — the dedicated screen

One responsive view rather than a mobile/desktop pair: this is a summary
block above a grouped list, which a max-width container handles at every
width. Split it only if the layouts genuinely diverge.

Grouping defaults to category, because that is where the caps live; "by
day" is the secondary view. Over-budget is stated in words ("חריגה של
₪800"), never by colour alone, at both trip and category level. The bar
carries real aria-valuenow/min/max in agorot.

SHOW_CHROME does not match /trip/, so the route owns the full viewport
exactly as /trip/overview/:tripId already does — no chrome change.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 10: Wire `remapExpenseDays`; pin the `instanceId` invariant

Two safety nets for data Phase A itself creates.

**`remapExpenseDays`** belongs here rather than in Phase B: Phase A already lets a user file an expense under a day (the "by day" view), so shortening a trip in Phase A can dangle a `dayRef` today.

**The `instanceId` regression test** pins behaviour that is *already correct*. `duplicateStopAt` regenerates `instanceId` at both call sites (`useEditorState.js:115`, `EditorView.jsx:1941`) and `updateStopAt` preserves it (`useEditorState.js:170`). Once `stopRef` points at `instanceId` in Phase B, a clone that inherited its original's id would make one expense resolve to two stops. Land the test before the thing that depends on it.

**Files:**
- Modify: `src/hooks/useEditorState.js` — import, and two call sites beside `remapFileDays`
- Test: `src/hooks/useEditorState.instanceId.test.js` (new)

**Interfaces:**
- Consumes: `remapExpenseDays` from Task 3.
- Produces: no new exports. `data.budget.items` day references stay valid across a renumber.

- [ ] **Step 1: Write the failing test**

Create `src/hooks/useEditorState.instanceId.test.js`:

```js
/* `instanceId` is the stable per-stop identity that Phase B's `stopRef` will
   point at. Two invariants now carry money and must not regress:
     1. a duplicated stop NEVER inherits its original's instanceId
        (one expense would resolve to two stops), and
     2. an updated stop ALWAYS keeps its own
        (its expense would silently detach).
   Both already hold — these tests pin them. */
import { renderHook, act, waitFor } from "@testing-library/react";
import useEditorState from "./useEditorState";
import tripService from "../services/tripService";

/* useEditorState takes a tripId and loads the trip itself, so the fixture is
   delivered through fetchTripById rather than passed in. */
jest.mock("../services/tripService", () => ({
  __esModule: true,
  default: {
    fetchTripById: jest.fn(),
    saveTrip: jest.fn(() => Promise.resolve({})),
  },
}));

const seed = () => ({
  id: "t1",
  readOnly: false,
  days: 2,
  data: {
    tripData: [
      { day: 1, city: "Tokyo", cityHe: "טוקיו",
        attractions: [{ instanceId: "inst-aaa", name: "Ramen", nameHe: "ראמן",
                        coordinates: { lng: 139.7, lat: 35.6 } }] },
      { day: 2, city: "Tokyo", cityHe: "טוקיו", attractions: [] },
    ],
    budget: {
      config: { currency: "ILS", rate: 1, totalIlsMinor: 100000, categories: [] },
      items: [
        { id: "e_general", label: "ביטוח", amountMinor: 32000, currency: "ILS",
          category: "insurance", dayRef: null, stopRef: null, paid: false, actualMinor: null },
        { id: "e_day2", label: "כניסה", amountMinor: 5000, currency: "ILS",
          category: "attractions", dayRef: 2, stopRef: null, paid: false, actualMinor: null },
      ],
    },
  },
});

const daysOf = (r) => r.current.trip.data.tripData;

/* Mount and wait for the async load to land. */
const mountLoaded = async () => {
  const hook = renderHook(() => useEditorState("t1"));
  await waitFor(() => expect(hook.result.current.trip).toBeTruthy());
  return hook;
};

beforeEach(() => {
  tripService.saveTrip.mockClear().mockImplementation(() => Promise.resolve({}));
  tripService.fetchTripById.mockReset().mockImplementation(() => Promise.resolve(seed()));
});

test("a duplicated stop never inherits the original's instanceId", async () => {
  const { result } = await mountLoaded();
  act(() => result.current.duplicateStopAt(1, 0));

  const stops = daysOf(result)[0].attractions;
  expect(stops).toHaveLength(2);
  expect(stops[1].instanceId).toBeTruthy();
  expect(stops[1].instanceId).not.toBe(stops[0].instanceId);
  expect(stops[1].name).toBe(stops[0].name);   // it is still a copy
});

test("an updated stop keeps its instanceId", async () => {
  const { result } = await mountLoaded();
  act(() => result.current.updateStopAt(1, 0, { name: "Ramen 2", nameHe: "ראמן 2" }));

  const stop = daysOf(result)[0].attractions[0];
  expect(stop.instanceId).toBe("inst-aaa");
  expect(stop.nameHe).toBe("ראמן 2");
});

test("deleting a day remaps expense days: the removed day falls back to general", async () => {
  const { result } = await mountLoaded();
  act(() => result.current.deleteDay(2));

  const items = result.current.trip.data.budget.items;
  expect(items).toHaveLength(2);                                   // nothing dropped
  expect(items.find((i) => i.id === "e_day2").dayRef).toBeNull();  // folded to general
  expect(items.find((i) => i.id === "e_day2").amountMinor).toBe(5000); // money intact
  expect(items.find((i) => i.id === "e_general").dayRef).toBeNull();
});

test("deleting an earlier day renumbers a later expense's day rather than dropping it", async () => {
  const { result } = await mountLoaded();
  act(() => result.current.deleteDay(1));

  const it = result.current.trip.data.budget.items.find((i) => i.id === "e_day2");
  expect(it.dayRef).toBe(1);          // old day 2 became day 1
  expect(it.amountMinor).toBe(5000);
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `CI=true npx react-scripts test src/hooks/useEditorState.instanceId.test.js --watchAll=false`
Expected: the two `instanceId` tests PASS (the behaviour already exists); the two day-remap tests FAIL — `dayRef` is still `2` after the day is removed.

- [ ] **Step 3: Wire the remap**

In `src/hooks/useEditorState.js`, extend the existing import on line 5:

```js
import { addGeneralFile, updateGeneralFile, removeGeneralFile, renameStopAttachment, remapFileDays } from "../utils/tripFiles";
```

to add a second import line beneath it:

```js
import { remapExpenseDays } from "../utils/budget";
```

Then find **both** places that call `remapFileDays` (around `useEditorState.js:378` and `:428`) and remap the expenses in the same object literal. The first reads:

```js
        files: remapFileDays(data.files, mapping, renumbered.length),
```

Change it to:

```js
        files: remapFileDays(data.files, mapping, renumbered.length),
        /* Standalone expenses follow the same rule as general files: a
           removed day folds them back to "general" rather than dropping
           them. Stop-linked expenses are skipped — their day is derived. */
        ...(data.budget ? {
          budget: { ...data.budget, items: remapExpenseDays(data.budget.items, mapping, renumbered.length) },
        } : {}),
```

The second (inside `applyDateRange`) reads:

```js
          return { ...data, tripData: renumbered, files: remapFileDays(data.files, mapping, renumbered.length) };
```

Change it to:

```js
          return {
            ...data,
            tripData: renumbered,
            files: remapFileDays(data.files, mapping, renumbered.length),
            ...(data.budget ? {
              budget: { ...data.budget, items: remapExpenseDays(data.budget.items, mapping, renumbered.length) },
            } : {}),
          };
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `CI=true npx react-scripts test src/hooks/useEditorState.instanceId.test.js --watchAll=false`
Expected: PASS — all four.

- [ ] **Step 5: Full verification**

Run: `CI=true npx react-scripts test --watchAll=false && npm run test:api && npm run critical && CI=true npm run build`
Expected: every Jest suite passes, `test:api` unaffected, `critical` 9/9, build compiles with no new warnings.

- [ ] **Step 6: Commit**

```bash
git add src/hooks/useEditorState.js src/hooks/useEditorState.instanceId.test.js
git commit -m "$(cat <<'EOF'
feat(budget): remap expense days on renumber; pin the instanceId invariant

remapExpenseDays runs beside remapFileDays on both renumber paths. It
belongs in Phase A, not B: Phase A already lets a user file an expense
under a day, so shortening a trip could dangle a dayRef today. A removed
day folds the expense back to general — the money is never dropped.

The instanceId tests pin behaviour that is ALREADY correct: duplicate
regenerates, update preserves. Once Phase B points stopRef at instanceId,
a clone inheriting its original's id would make one expense resolve to two
stops. Landing the guard before the thing that needs it.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Phase A exit criteria

- [ ] `CI=true npx react-scripts test --watchAll=false` — every suite green
- [ ] `npm run test:api` — unaffected
- [ ] `npm run critical` — 9/9
- [ ] `CI=true npm run build` — compiles, no new warnings
- [ ] Manual pass on device: `/trip/budget/:tripId` in **RTL** and in **dark mode**; over-budget colours contrast-checked in both palettes; the paid → "was it different?" flow on a touch screen
- [ ] `T-BUDGET-01..N` appended to `docs/QA-TEST-PLAN.md` (the `qa` agent, following the `T-FILES` / `T-FOCUS` convention)
- [ ] `WORKLOG.md` line appended by the main session

## Explicitly NOT in Phase A

Per-stop costs and `StopActionsSheet` · lazy `instanceId` back-fill for legacy stops · the editor chip and quick-add sheet · expense detach on stop delete / inbox move · the trip-overview card · the dashboard `MapCard` indicator · the overrun toast · `budgetImpact` and the two-tier confirmations · the `ShareSheet` toggle · the wizard step · receipts on expenses and the "קבלות ותשלומים" group · currency-change conversion. These are Phases B–D.
