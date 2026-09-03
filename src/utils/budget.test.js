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
