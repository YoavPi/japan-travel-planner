/* ══════════════════════════════════════════════════════════════
   destinationSearch.js — matching for the landing hero's
   destination field.

   HARD CONSTRAINT: this never calls Google Places. Two reasons,
   both documented in the repo:
     1. CLAUDE.md — the public surface must work with zero
        external API keys.
     2. This project already ran a Google Places cost-protection
        incident response. Per-keystroke autocomplete on the
        highest-traffic public page is precisely that cost surface.
   Even when a Places key is present, this module does not use it.
   Everything below reads bundled data from `src/data/destinations.js`.

   Known limitation, stated rather than hidden: CITY_POOL is
   Hebrew-only, so Latin input matches COUNTRIES but not cities.
   "japan" finds יפן; "tokyo" finds nothing. Acceptable for a
   Hebrew-first audience; a Latin alias map is a follow-up.
   ══════════════════════════════════════════════════════════════ */
import { DESTINATIONS, CITY_POOL } from "../data/destinations";

/* Fold geresh/apostrophe variants together, collapse whitespace,
   casefold Latin. "צ'אנג" and "צ׳אנג" must match each other. */
export const normalize = (s) =>
  String(s == null ? "" : s)
    .replace(/[׳’'`´]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();

/* Flattened city list, each carrying its country back. Built once. */
const CITIES = Object.entries(CITY_POOL).flatMap(([countryId, names]) =>
  (names || []).map((name) => ({ countryId, name }))
);

const countryById = DESTINATIONS.reduce((m, d) => { m[d.id] = d; return m; }, {});

/* Countries above cities; prefix matches above substring matches. */
export const searchDestinations = (query, limit = 6) => {
  const q = normalize(query);
  if (!q) return [];

  const countries = [];
  for (const d of DESTINATIONS) {
    const he = normalize(d.name), en = normalize(d.en);
    const rank = he.startsWith(q) || en.startsWith(q) ? 0
      : he.includes(q) || en.includes(q) ? 1 : -1;
    if (rank < 0) continue;
    countries.push({ rank, item: { type: "country", id: d.id, label: d.name, sub: d.sub, flag: d.flag, dest: d.id } });
  }

  const cities = [];
  for (const c of CITIES) {
    const n = normalize(c.name);
    const rank = n.startsWith(q) ? 0 : n.includes(q) ? 1 : -1;
    if (rank < 0) continue;
    const parent = countryById[c.countryId];
    cities.push({ rank, item: {
      type: "city", id: `${c.countryId}:${c.name}`, label: c.name,
      sub: parent ? parent.name : "", flag: parent ? parent.flag : "",
      dest: c.countryId, city: c.name,
    } });
  }

  const byRank = (a, b) => a.rank - b.rank;
  return [...countries.sort(byRank), ...cities.sort(byRank)]
    .slice(0, limit)
    .map((e) => e.item);
};

/* Never a dead end: the fallback grid when nothing matches. */
export const allCountries = () =>
  DESTINATIONS.map((d) => ({
    type: "country", id: d.id, label: d.name, sub: d.sub, flag: d.flag, dest: d.id,
  }));
