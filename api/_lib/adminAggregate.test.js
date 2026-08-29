const test = require("node:test");
const assert = require("node:assert");
const { aggregateOverview } = require("./adminAggregate");

const WEEK = Date.parse("2026-08-23T00:00:00Z"); // Sunday
const inWeek = "2026-08-25T10:00:00Z";
const before = "2026-08-01T10:00:00Z";

test("aggregates trips, ai usage and tokens per user", () => {
  const out = aggregateOverview({
    users: [
      { id: "a", email: "A@x.com", created_at: before, last_sign_in_at: inWeek },
      { id: "b", email: "b@x.com", created_at: before, last_sign_in_at: before },
    ],
    trips: [
      { id: "t1", title: "Rome", owner_id: "a", source: "ai", is_public: true, last_edited: inWeek },
      { id: "t2", title: "Paris", owner_id: "a", source: "wizard", is_public: false, last_edited: before },
      { id: "t3", title: "Old", owner_id: "b", source: null, is_public: false, last_edited: before },
    ],
    generations: [
      { user_id: "a", total_tokens: 900, created_at: inWeek },
      { user_id: "a", total_tokens: 100, created_at: before },
    ],
    weekStartMs: WEEK,
  });

  assert.strictEqual(out.kpis.users, 2);
  assert.strictEqual(out.kpis.trips, 3);
  assert.strictEqual(out.kpis.aiUses, 2);
  assert.strictEqual(out.kpis.tokensTotal, 1000);
  assert.strictEqual(out.kpis.tokensThisWeek, 900);
  assert.strictEqual(out.kpis.activeThisWeek, 1);

  const a = out.users.find((u) => u.id === "a");
  assert.strictEqual(a.email, "a@x.com"); // lower-cased
  assert.deepStrictEqual(a.trips, { total: 2, ai: 1, manual: 1, unknown: 0 });
  assert.strictEqual(a.aiUses, 2);
  assert.deepStrictEqual(a.tokens, { total: 1000, thisWeek: 900 });
  assert.strictEqual(a.maps.length, 2);

  const b = out.users.find((u) => u.id === "b");
  assert.deepStrictEqual(b.trips, { total: 1, ai: 0, manual: 0, unknown: 1 });
});

test("orders users by last activity desc and tolerates orphan owner ids", () => {
  const out = aggregateOverview({
    users: [{ id: "a", email: "a@x.com", created_at: before, last_sign_in_at: before }],
    trips: [{ id: "t9", title: "Ghost", owner_id: "zzz", source: "ai", is_public: false, last_edited: inWeek }],
    generations: [],
    weekStartMs: WEEK,
  });
  assert.strictEqual(out.kpis.users, 2); // orphan owner materialized
  assert.strictEqual(out.users[0].id, "zzz"); // most recent activity first
});

test("a generation updates lastActiveAt and active-this-week", () => {
  const out = aggregateOverview({
    users: [{ id: "a", email: "a@x.com", created_at: before, last_sign_in_at: before }],
    trips: [],
    generations: [{ user_id: "a", total_tokens: 50, created_at: inWeek }],
    weekStartMs: WEEK,
  });
  const a = out.users.find((u) => u.id === "a");
  assert.strictEqual(a.lastActiveAt, inWeek);
  assert.strictEqual(out.kpis.activeThisWeek, 1);
});
