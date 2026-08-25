/* ══════════════════════════════════════════════════════════════
   docTitle — Sprint 36 #3 dynamic browser-tab titles.

   • A trip whose title/destination mentions Japan / יפן →
     the specific trip name, else "Japan Trip Explorer".
   • Landing, dashboard, and non-Japan trips → "Travel Planner".
   No hardcoded Supabase ids ever reach the tab.
   ══════════════════════════════════════════════════════════════ */

export const DEFAULT_TITLE = "Travel Planner";

export const titleForTrip = (trip) => {
  if (!trip) return DEFAULT_TITLE;
  const hay = `${trip.title || ""} ${trip.settings?.destination || ""} ${trip.settings?.destinationHe || ""}`;
  if (/japan|יפן/i.test(hay)) return (trip.title || "").trim() || "Japan Trip Explorer";
  return DEFAULT_TITLE;
};

export const setDocTitle = (t) => {
  if (typeof document !== "undefined") document.title = t || DEFAULT_TITLE;
};

export default setDocTitle;
