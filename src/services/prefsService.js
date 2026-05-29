/* ══════════════════════════════════════════════════════════════
   prefsService — user preferences persisted to localStorage.

   Mirrors the tripService pattern (JSON in localStorage) so it can
   later move to a real backend. Synchronous read (prefs are tiny
   and needed on first paint); writes are fire-and-forget.
   ══════════════════════════════════════════════════════════════ */

const KEY = "tp_prefs_v1";

const DEFAULTS = {
  units: "km",          // 'km' | 'mi'
  darkMode: false,
  notifications: true,
  shareUpdates: true,
  language: "he",
};

export const readPrefs = () => {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? { ...DEFAULTS, ...JSON.parse(raw) } : { ...DEFAULTS };
  } catch {
    return { ...DEFAULTS };
  }
};

export const writePrefs = (patch) => {
  const next = { ...readPrefs(), ...patch };
  try { localStorage.setItem(KEY, JSON.stringify(next)); } catch { /* noop */ }
  return next;
};

const prefsService = { readPrefs, writePrefs, DEFAULTS };
export default prefsService;
