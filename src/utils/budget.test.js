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
