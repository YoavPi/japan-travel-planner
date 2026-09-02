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
