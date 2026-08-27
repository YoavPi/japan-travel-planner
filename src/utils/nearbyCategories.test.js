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
