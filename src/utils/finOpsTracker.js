/* ══════════════════════════════════════════════════════════════
   finOpsTracker — hard client-side budget guard for live Google
   Places spend.

   Every billed live call (an autocomplete *session* closed by a
   *details* fetch) is priced with representative Google Places
   list-price constants and accumulated per calendar month inside
   localStorage. The moment the running month crosses the strict
   MONTHLY_CAP_USD ceiling, isOverBudget() flips true — the live
   layer then stops issuing outbound requests and drops back to the
   free geometric simulation engine, so no real charges can be
   accidentally billed.

   Storage shape (key: tp_finops_usage_v1):
     { "2026-06": { usd, sessions, details, updatedAt }, ... }
   ══════════════════════════════════════════════════════════════ */

const STORE_KEY = "tp_finops_usage_v1";

/* Strict safety ceiling — outbound live spend is hard-disabled at/above this.
   NB: this is a PER-DEVICE soft guard (localStorage), not a global budget — the
   real hard cap must be a Places-API quota in Google Cloud (see roadmap). Kept
   generous enough that ordinary use (and dev testing) never falls to sim. */
export const MONTHLY_CAP_USD = 75;

/* Representative Google Places list prices (USD). */
export const COST = {
  session: 0.017,     // Autocomplete — Per Session
  details: 0.017,     // Place Details (Basic)
  textSearch: 0.032,  // Text Search (Find Place) — ~2× a session
};

const monthKey = (d = new Date()) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;

const read = () => {
  try {
    return JSON.parse(localStorage.getItem(STORE_KEY) || "{}") || {};
  } catch {
    return {};
  }
};

const write = (obj) => {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(obj));
  } catch {
    /* storage unavailable — tracking is best-effort */
  }
};

/* Accumulated USD for the given month (defaults to the current one). */
export const getMonthlyUsd = (month = monthKey()) => {
  const m = read()[month];
  return m ? Number(m.usd) || 0 : 0;
};

const add = (usd, type) => {
  const month = monthKey();
  const store = read();
  const m = store[month] || { usd: 0, sessions: 0, details: 0 };
  m.usd = Math.round((m.usd + usd) * 1e6) / 1e6; // avoid float drift
  if (type === "session") m.sessions = (m.sessions || 0) + 1;
  if (type === "details") m.details = (m.details || 0) + 1;
  m.updatedAt = new Date().toISOString();
  store[month] = m;
  write(store);
  return m.usd;
};

export const recordSession = () => add(COST.session, "session");
export const recordDetails = () => add(COST.details, "details");
export const recordTextSearch = () => add(COST.textSearch, "textSearch");

/* The safety-lock invariant. */
export const isOverBudget = () => getMonthlyUsd() >= MONTHLY_CAP_USD;

/* Budget gate consumed by the live layer before any outbound fetch.
   Returns false once the running month reaches the hard ceiling — the
   caller must then bypass the network and fall back to simulation. */
export const checkBudgetAvailable = () => getMonthlyUsd() < MONTHLY_CAP_USD;

export const remainingUsd = () => Math.max(0, MONTHLY_CAP_USD - getMonthlyUsd());

/* Test/maintenance helper — clears the running tally. */
export const resetUsage = () => write({});

const finOpsTracker = {
  MONTHLY_CAP_USD,
  COST,
  getMonthlyUsd,
  recordSession,
  recordDetails,
  recordTextSearch,
  isOverBudget,
  checkBudgetAvailable,
  remainingUsd,
  resetUsage,
};

export default finOpsTracker;
