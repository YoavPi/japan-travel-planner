import { FOCUS_REGIONS } from "./focusRegions";
import { DESTINATIONS } from "./destinations";

test("every curated destination has 3-4 focus regions", () => {
  for (const d of DESTINATIONS) {
    const regions = FOCUS_REGIONS[d.id];
    expect(Array.isArray(regions)).toBe(true);
    expect(regions.length).toBeGreaterThanOrEqual(3);
    expect(regions.length).toBeLessThanOrEqual(4);
  }
});

test("region shape: id/label/blurb + 1-3 {he,en} cities; ids unique per country", () => {
  for (const [country, regions] of Object.entries(FOCUS_REGIONS)) {
    const ids = new Set();
    for (const r of regions) {
      expect(typeof r.id).toBe("string");
      expect(r.label.length).toBeGreaterThan(0);
      expect(r.blurb.length).toBeGreaterThan(0);
      expect(r.cities.length).toBeGreaterThanOrEqual(1);
      expect(r.cities.length).toBeLessThanOrEqual(3);
      for (const c of r.cities) {
        expect(typeof c.he).toBe("string");
        expect(/^[\x00-\x7F ,.]+$/.test(c.en)).toBe(true); // en is ASCII (allows periods for D.C.)
      }
      expect(ids.has(r.id)).toBe(false);
      ids.add(r.id);
    }
    expect(Object.keys(FOCUS_REGIONS)).toContain(country);
  }
});

test("no FOCUS_REGIONS key outside DESTINATIONS", () => {
  const ids = new Set(DESTINATIONS.map((d) => d.id));
  for (const k of Object.keys(FOCUS_REGIONS)) expect(ids.has(k)).toBe(true);
});
