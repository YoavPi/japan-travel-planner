const test = require("node:test");
const assert = require("node:assert");
const { unwrapDays } = require("./tripShape");

test("unwrapDays leaves an already-correct shape untouched", () => {
  const parsed = { description: "d", days: [{ dayNumber: 1, spots: [] }] };
  assert.strictEqual(unwrapDays(parsed), parsed);
});

test("unwrapDays unwraps { itinerary: [...] } into { days: [...] }", () => {
  const parsed = { description: "d", itinerary: [{ dayNumber: 1, spots: [] }] };
  const out = unwrapDays(parsed);
  assert.deepStrictEqual(out.days, [{ dayNumber: 1, spots: [] }]);
  assert.strictEqual(out.itinerary, undefined);
  assert.strictEqual(out.description, "d");
});

test("unwrapDays unwraps { trip: { days: [...] } } and keeps top-level description", () => {
  const parsed = { description: "top", trip: { days: [{ dayNumber: 1, spots: [] }], description: "nested" } };
  const out = unwrapDays(parsed);
  assert.deepStrictEqual(out.days, [{ dayNumber: 1, spots: [] }]);
  assert.strictEqual(out.description, "top");
});

test("unwrapDays falls back to the nested description when there is no top-level one", () => {
  const parsed = { trip: { days: [{ dayNumber: 1, spots: [] }], description: "nested" } };
  const out = unwrapDays(parsed);
  assert.strictEqual(out.description, "nested");
});

test("unwrapDays returns unrecognized shapes untouched (no days, no itinerary, no trip.days)", () => {
  const parsed = { foo: "bar" };
  assert.strictEqual(unwrapDays(parsed), parsed);
});

test("unwrapDays handles null/non-object input without throwing", () => {
  assert.strictEqual(unwrapDays(null), null);
  assert.strictEqual(unwrapDays(undefined), undefined);
  assert.strictEqual(unwrapDays("x"), "x");
});

test("unwrapDays ignores an empty itinerary array (still no usable days)", () => {
  const parsed = { itinerary: [] };
  const out = unwrapDays(parsed);
  assert.strictEqual(out, parsed);
});
