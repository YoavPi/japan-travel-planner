import {
  minorDigits, minorFactor, parseAmount, formatAmount, formatMoney,
  toIlsMinor, newExpenseId, newCategoryKey, BASE_CATEGORIES, guessCategory,
} from "./budget";
import { rollup, summarize, hasBudget } from "./budget";

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

import { expensesForStop, detachStopExpenses, budgetImpact } from "./budget";

describe("expensesForStop", () => {
  const items = [
    { id: "e_1", stopRef: "inst-aaa", amountMinor: 100, currency: "ILS" },
    { id: "e_2", stopRef: "inst-bbb", amountMinor: 200, currency: "ILS" },
    { id: "e_3", stopRef: null, amountMinor: 300, currency: "ILS" },
    { id: "e_4", stopRef: "inst-aaa", amountMinor: 400, currency: "ILS" },
  ];

  test("returns only the items linked to the given stop, in order", () => {
    expect(expensesForStop(items, "inst-aaa").map((i) => i.id)).toEqual(["e_1", "e_4"]);
  });

  test("a stop with no linked items returns an empty array", () => {
    expect(expensesForStop(items, "inst-zzz")).toEqual([]);
  });

  test("no stopId or no items never throws", () => {
    expect(expensesForStop(items, null)).toEqual([]);
    expect(expensesForStop(null, "inst-aaa")).toEqual([]);
  });
});

describe("detachStopExpenses", () => {
  const linkedA = { id: "e_1", stopRef: "inst-aaa", label: "ראמן", amountMinor: 1200,
    currency: "JPY", category: "food", paid: true, actualMinor: 1500 };
  const linkedB = { id: "e_2", stopRef: "inst-aaa", label: "מונית", amountMinor: 500,
    currency: "ILS", category: "transport", paid: false, actualMinor: null };
  const other = { id: "e_3", stopRef: "inst-bbb", label: "מלון", amountMinor: 30000, currency: "ILS" };
  const unlinked = { id: "e_4", stopRef: null, label: "ביטוח", amountMinor: 32000, currency: "ILS" };
  const items = [linkedA, linkedB, other, unlinked];

  test("clears stopRef on every item linked to the given stop, preserving all other fields", () => {
    const out = detachStopExpenses(items, "inst-aaa");
    expect(out[0]).toEqual({ ...linkedA, stopRef: null });
    expect(out[1]).toEqual({ ...linkedB, stopRef: null });
    // label + amount + paid + actual survive the detach untouched
    expect(out[0].label).toBe("ראמן");
    expect(out[0].amountMinor).toBe(1200);
    expect(out[0].paid).toBe(true);
    expect(out[0].actualMinor).toBe(1500);
  });

  test("items with a different or no stopRef pass through BY IDENTITY (untouched)", () => {
    const out = detachStopExpenses(items, "inst-aaa");
    expect(out[2]).toBe(other);
    expect(out[3]).toBe(unlinked);
  });

  test("no stopId returns the input array back untouched", () => {
    expect(detachStopExpenses(items, null)).toBe(items);
  });

  test("null items yields an empty array, never a throw", () => {
    expect(detachStopExpenses(null, "inst-aaa")).toEqual([]);
  });
});

describe("budgetImpact — deleteStop / moveStopToInbox", () => {
  const config = { currency: "ILS", rate: 1 };

  test("no linked expense: no confirmation needed", () => {
    expect(budgetImpact("deleteStop", { items: [], config, stopId: "inst-aaa" })).toBeNull();
  });

  test("one linked expense: tier 1, body names the exact ILS amount", () => {
    const items = [{ id: "e_1", stopRef: "inst-aaa", amountMinor: 80000, currency: "ILS" }];
    const impact = budgetImpact("deleteStop", { items, config, stopId: "inst-aaa" });
    expect(impact.tier).toBe(1);
    expect(impact.body).toContain("₪800.00");
    expect(impact.body).toContain("כללי");
  });

  test("a JPY-denominated linked expense is converted to ILS via config.rate", () => {
    const items = [{ id: "e_1", stopRef: "inst-aaa", amountMinor: 1200, currency: "JPY" }];
    const jpyConfig = { currency: "JPY", rate: 0.023 };
    const impact = budgetImpact("deleteStop", { items, config: jpyConfig, stopId: "inst-aaa" });
    // 1200 JPY * 0.023 = ₪27.60 = 2760 agorot
    expect(impact.body).toContain("₪27.60");
  });

  test("multiple linked expenses: body states the count and the summed amount", () => {
    const items = [
      { id: "e_1", stopRef: "inst-aaa", amountMinor: 50000, currency: "ILS" },
      { id: "e_2", stopRef: "inst-aaa", amountMinor: 30000, currency: "ILS" },
    ];
    const impact = budgetImpact("deleteStop", { items, config, stopId: "inst-aaa" });
    expect(impact.body).toContain("2");
    expect(impact.body).toContain("₪800.00"); // 500 + 300
  });

  test("moveStopToInbox uses the same detach numbers with its own wording", () => {
    const items = [{ id: "e_1", stopRef: "inst-aaa", amountMinor: 80000, currency: "ILS" }];
    const impact = budgetImpact("moveStopToInbox", { items, config, stopId: "inst-aaa" });
    expect(impact.tier).toBe(1);
    expect(impact.body).toContain("₪800.00");
    expect(impact.confirmLabel).not.toBe(
      budgetImpact("deleteStop", { items, config, stopId: "inst-aaa" }).confirmLabel
    );
  });

  test("an unrelated stop's expenses do not trigger a confirmation", () => {
    const items = [{ id: "e_1", stopRef: "inst-bbb", amountMinor: 80000, currency: "ILS" }];
    expect(budgetImpact("deleteStop", { items, config, stopId: "inst-aaa" })).toBeNull();
  });
});

describe("budgetImpact — changeRate", () => {
  test("no paid non-ILS items: no confirmation needed", () => {
    const items = [{ id: "e_1", stopRef: null, amountMinor: 1000, currency: "ILS", paid: true }];
    const config = { currency: "JPY", rate: 0.023 };
    expect(budgetImpact("changeRate", { items, config, newRate: 0.025 })).toBeNull();
  });

  test("an unpaid JPY item is unaffected by a rate change", () => {
    const items = [{ id: "e_1", amountMinor: 1200, currency: "JPY", paid: false }];
    const config = { currency: "JPY", rate: 0.023 };
    expect(budgetImpact("changeRate", { items, config, newRate: 0.03 })).toBeNull();
  });

  test("paid JPY items: tier 1, body names old and new actual totals exactly", () => {
    const items = [
      { id: "e_1", amountMinor: 1200, currency: "JPY", paid: true, actualMinor: null },
      { id: "e_2", amountMinor: 1000, currency: "ILS", paid: true, actualMinor: null }, // untouched (ILS)
    ];
    const oldConfig = { currency: "JPY", rate: 0.023 };
    const impact = budgetImpact("changeRate", { items, config: oldConfig, newRate: 0.03 });
    expect(impact.tier).toBe(1);
    // old: 1200 * 0.023 = ₪27.60 → 2760 agorot; new: 1200 * 0.03 = ₪36.00 → 3600 agorot
    expect(impact.body).toContain("₪27.60");
    expect(impact.body).toContain("₪36.00");
    expect(impact.body).toContain("1"); // 1 paid non-ILS item affected
  });

  test("a paid item's actualMinor, when set, is what gets re-valued, not amountMinor", () => {
    const items = [{ id: "e_1", amountMinor: 1200, currency: "JPY", paid: true, actualMinor: 1500 }];
    const oldConfig = { currency: "JPY", rate: 0.023 };
    const impact = budgetImpact("changeRate", { items, config: oldConfig, newRate: 0.023 });
    // same rate ⇒ totals identical ⇒ no confirmation needed
    expect(impact).toBeNull();
  });
});

describe("budgetImpact — unknown action", () => {
  test("returns null for an action it does not know about", () => {
    expect(budgetImpact("somethingElse", {})).toBeNull();
  });
});

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
