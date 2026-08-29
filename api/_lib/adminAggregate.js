/* Pure aggregation of admin-overview data. No I/O — unit-tested. */

const blankUser = (id) => ({
  id, email: "", joinedAt: null, lastActiveAt: null,
  trips: { total: 0, ai: 0, manual: 0, unknown: 0 },
  aiUses: 0, tokens: { total: 0, thisWeek: 0 }, maps: [],
});

const ts = (v) => Date.parse(v || "") || 0;

function aggregateOverview({ users = [], trips = [], generations = [], weekStartMs = 0 } = {}) {
  const byId = new Map();
  const ensure = (id) => { if (!byId.has(id)) byId.set(id, blankUser(id)); return byId.get(id); };

  for (const u of users) {
    const r = ensure(u.id);
    r.email = (u.email || "").toLowerCase();
    r.joinedAt = u.created_at || null;
    r.lastActiveAt = u.last_sign_in_at || null;
  }

  for (const t of trips) {
    const r = ensure(t.owner_id);
    r.trips.total++;
    const bucket = t.source === "ai" ? "ai" : t.source === "wizard" ? "manual" : "unknown";
    r.trips[bucket]++;
    r.maps.push({
      id: t.id, title: t.title || "(ללא שם)",
      source: t.source || null, public: !!t.is_public, lastEdited: t.last_edited || null,
    });
    if (ts(t.last_edited) > ts(r.lastActiveAt)) r.lastActiveAt = t.last_edited;
  }

  for (const g of generations) {
    const r = ensure(g.user_id);
    r.aiUses++;
    const tok = Number.isFinite(g.total_tokens) ? g.total_tokens : 0;
    r.tokens.total += tok;
    if (weekStartMs && ts(g.created_at) >= weekStartMs) r.tokens.thisWeek += tok;
  }

  const list = [...byId.values()].sort((a, b) => ts(b.lastActiveAt) - ts(a.lastActiveAt));

  const kpis = {
    users: list.length,
    activeThisWeek: list.filter((u) => ts(u.lastActiveAt) >= weekStartMs).length,
    trips: trips.length,
    aiUses: generations.length,
    tokensTotal: list.reduce((n, u) => n + u.tokens.total, 0),
    tokensThisWeek: list.reduce((n, u) => n + u.tokens.thisWeek, 0),
  };

  return { kpis, users: list };
}

module.exports = { aggregateOverview };
