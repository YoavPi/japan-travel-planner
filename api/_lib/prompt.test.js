const test = require("node:test");
const assert = require("node:assert");
const { buildPrompt } = require("./prompt");

test("buildPrompt: valid { system, user } with the core schema + rules", () => {
  const { system, user } = buildPrompt({ destination: "Kyoto", dayCount: 3, spotsPerDay: 3, transport: ["walking"] });
  assert.ok(system.includes("ONLY valid minified JSON"));
  assert.ok(system.includes('"dayNumber"'));
  const parsed = JSON.parse(user);
  assert.strictEqual(parsed.destination, "Kyoto");
  assert.strictEqual(parsed.days, 3);
});

test("buildPrompt: GEO rule + maxCities = ceil(days/3), min 1", () => {
  const three = JSON.parse(buildPrompt({ destination: "Thailand", dayCount: 3 }).user);
  assert.strictEqual(three.maxCities, 1);
  const ten = JSON.parse(buildPrompt({ destination: "Thailand", dayCount: 10 }).user);
  assert.strictEqual(ten.maxCities, 4);
  const one = JSON.parse(buildPrompt({ destination: "Thailand", dayCount: 1 }).user);
  assert.strictEqual(one.maxCities, 1);

  const { system } = buildPrompt({ destination: "Thailand", dayCount: 7 });
  assert.ok(system.includes("(GEO)"));
  assert.ok(system.includes("AT MOST `maxCities`"));
  assert.ok(system.includes("NEVER scatter single days"));
});

test("buildPrompt: refine adds rule (10) and a revise block", () => {
  const { system, user } = buildPrompt({ destination: "Rome", dayCount: 4, refine: "more food", previous: "…" });
  assert.ok(system.includes("(10) You are REVISING"));
  const parsed = JSON.parse(user);
  assert.strictEqual(parsed.revise.instruction, "more food");
});

test("buildPrompt: transport modes shape the clustering hint", () => {
  const walk = JSON.parse(buildPrompt({ destination: "Paris", dayCount: 2, transport: ["walking"] }).user);
  assert.match(walk.transportNote, /walking/);
  const none = JSON.parse(buildPrompt({ destination: "Paris", dayCount: 2, transport: [] }).user);
  assert.match(none.transportNote, /reasonably compact/);
});

test("buildPrompt: focus adds the (FOCUS) clause + focusCities", () => {
  const { system, user } = buildPrompt({ destination: "Thailand", dayCount: 6, focus: { cities: ["Chiang Mai", "Pai"], label: "הצפון" } });
  assert.ok(system.includes("(FOCUS)"));
  assert.ok(system.includes("ONLY within"));
  const parsed = JSON.parse(user);
  assert.deepStrictEqual(parsed.focusCities, ["Chiang Mai", "Pai"]);
});

test("buildPrompt: no focus → no (FOCUS) clause, no 'resolve each', no focusCities", () => {
  const { system, user } = buildPrompt({ destination: "Thailand", dayCount: 6 });
  assert.ok(!system.includes("(FOCUS)"));
  assert.ok(!system.includes("resolve each"));
  assert.strictEqual(JSON.parse(user).focusCities, undefined);
});

test("buildPrompt: Hebrew focus city names pass through verbatim + 'resolve each' hint", () => {
  const { system, user } = buildPrompt({
    destination: "תאילנד", dayCount: 6,
    focus: { cities: ["צ׳אנג מאי", "פאי"], label: "הצפון" },
  });
  assert.ok(system.includes("(FOCUS)"));
  assert.ok(system.includes("resolve each"));
  assert.deepStrictEqual(JSON.parse(user).focusCities, ["צ׳אנג מאי", "פאי"]);
});

test("buildPrompt: focus set overrides the GEO city-count limit (maxCities ≥ focus size)", () => {
  const parsed = JSON.parse(buildPrompt({
    destination: "Thailand", dayCount: 3,
    focus: { cities: ["Bangkok", "Ayutthaya", "Kanchanaburi"] },
  }).user);
  assert.ok(parsed.maxCities >= 3);
});

test("buildPrompt: focus.cities is sanitized (strings only, ≤5, ≤60 chars, trimmed)", () => {
  let out;
  assert.doesNotThrow(() => {
    out = buildPrompt({
      destination: "X", dayCount: 3,
      focus: { cities: [42, "", "  A  ", "B".repeat(200), ...Array(20).fill("C")] },
    });
  });
  const focusCities = JSON.parse(out.user).focusCities;
  assert.ok(focusCities.length <= 5);
  for (const c of focusCities) assert.ok(c.length <= 60);
  assert.ok(focusCities.includes("A"));
});
