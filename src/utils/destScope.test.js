import { classifyDestScope, matchCuratedCountry } from "./destScope";

test("classifyDestScope: types → scope", () => {
  expect(classifyDestScope(["country", "political"])).toBe("country");
  expect(classifyDestScope(["administrative_area_level_1", "political"])).toBe("region");
  expect(classifyDestScope(["archipelago"])).toBe("region");
  expect(classifyDestScope(["natural_feature"])).toBe("region");
  expect(classifyDestScope(["locality", "political"])).toBe("city");
  expect(classifyDestScope(["administrative_area_level_2", "locality"])).toBe("city");
  expect(classifyDestScope([])).toBe("city");
  expect(classifyDestScope()).toBe("city");
});

test("classifyDestScope: locality wins over a region type (a city inside a province)", () => {
  expect(classifyDestScope(["locality", "administrative_area_level_1"])).toBe("city");
});

test("matchCuratedCountry", () => {
  expect(matchCuratedCountry("Chiang Mai", "Thailand", ["locality"])).toBe("th");
  expect(matchCuratedCountry("Thailand", "", ["country"])).toBe("th");
  expect(matchCuratedCountry("Lyon", "Auvergne-Rhône-Alpes, France", ["locality"])).toBe("fr");
  expect(matchCuratedCountry("New York", "NY, United States", ["locality"])).toBe("us");
  expect(matchCuratedCountry("Reykjavik", "Iceland", ["locality"])).toBe(null);
  expect(matchCuratedCountry("", "", [])).toBe(null);
});
