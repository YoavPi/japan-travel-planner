import { DESTINATIONS, SUGGESTED_CITIES, CITY_POOL, COUNTRY_EN_TO_ID, COUNTRY_HE_TO_ID } from "./destinations";

test("DESTINATIONS: 10 curated entries, each with id/en/center", () => {
  expect(DESTINATIONS).toHaveLength(10);
  for (const d of DESTINATIONS) {
    expect(typeof d.id).toBe("string");
    expect(typeof d.en).toBe("string");
    expect(Number.isFinite(d.center.lng) && Number.isFinite(d.center.lat)).toBe(true);
  }
});

test("SUGGESTED_CITIES / CITY_POOL keyed by DESTINATIONS ids; pool ⊇ suggested", () => {
  const ids = new Set(DESTINATIONS.map((d) => d.id));
  for (const k of Object.keys(SUGGESTED_CITIES)) expect(ids.has(k)).toBe(true);
  for (const k of Object.keys(CITY_POOL)) expect(ids.has(k)).toBe(true);
  for (const id of ids) {
    const sug = SUGGESTED_CITIES[id] || [];
    const pool = new Set(CITY_POOL[id] || []);
    for (const c of sug) expect(pool.has(c)).toBe(true);
  }
});

test("COUNTRY_EN_TO_ID maps each entry's English name to its id", () => {
  for (const d of DESTINATIONS) expect(COUNTRY_EN_TO_ID[d.en]).toBe(d.id);
  expect(COUNTRY_EN_TO_ID.Thailand).toBe("th");
});

test("COUNTRY_HE_TO_ID maps each entry's Hebrew name to its id (all 10)", () => {
  expect(Object.keys(COUNTRY_HE_TO_ID)).toHaveLength(10);
  for (const d of DESTINATIONS) expect(COUNTRY_HE_TO_ID[d.name]).toBe(d.id);
  expect(COUNTRY_HE_TO_ID["תאילנד"]).toBe("th");
});
