/* ══════════════════════════════════════════════════════════════
   tripDates — Sprint 43 localized Hebrew calendar engine.

   A trip may carry an optional `start_date` (stored as an ISO
   "yyyy-mm-dd" string in trip.settings.startDate). When present, each
   day maps to a concrete calendar date:  Day N = start + (N-1) days.
   All math uses LOCAL Date construction (new Date(y, m-1, d)) so month
   and leap-year rollovers are correct and there are no UTC/timezone
   off-by-one shifts.

   Everything degrades gracefully: with no start date the formatters
   return "" (callers simply render nothing extra).
   ══════════════════════════════════════════════════════════════ */

/* Full Hebrew weekday label, e.g. getDay() 4 → "יום חמישי", 6 → "שבת". */
const DOW_FULL = ["יום ראשון", "יום שני", "יום שלישי", "יום רביעי", "יום חמישי", "יום שישי", "שבת"];
/* Short Hebrew weekday, e.g. 4 → "יום ה'", 6 → "שבת". */
const DOW_SHORT = ["יום א'", "יום ב'", "יום ג'", "יום ד'", "יום ה'", "יום ו'", "שבת"];
/* Gregorian month names in Hebrew (full + abbreviated). */
const MONTH_FULL = ["ינואר", "פברואר", "מרץ", "אפריל", "מאי", "יוני", "יולי", "אוגוסט", "ספטמבר", "אוקטובר", "נובמבר", "דצמבר"];
const MONTH_ABBR = ["ינו׳", "פבר׳", "מרץ", "אפר׳", "מאי", "יוני", "יולי", "אוג׳", "ספט׳", "אוק׳", "נוב׳", "דצמ׳"];

/* Parse "yyyy-mm-dd" (or a Date) into a LOCAL midnight Date. Returns
   null for anything unparseable so callers can branch cleanly. */
export const parseStartDate = (start) => {
  if (!start) return null;
  if (start instanceof Date) return Number.isNaN(start.getTime()) ? null : new Date(start.getFullYear(), start.getMonth(), start.getDate());
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(start));
  if (!m) {
    const d = new Date(start);
    return Number.isNaN(d.getTime()) ? null : new Date(d.getFullYear(), d.getMonth(), d.getDate());
  }
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return Number.isNaN(d.getTime()) ? null : d;
};

/* The concrete calendar Date for a 1-based day index (Day 1 = start).
   Adding via setDate handles month/leap-year boundaries automatically. */
export const dateForDay = (start, dayNum) => {
  const base = parseStartDate(start);
  if (!base) return null;
  const d = new Date(base.getFullYear(), base.getMonth(), base.getDate());
  d.setDate(d.getDate() + (Math.max(1, Number(dayNum) || 1) - 1));
  return d;
};

/* "17.9" — compact numeric day.month for the day pills. */
export const shortDate = (start, dayNum) => {
  const d = dateForDay(start, dayNum);
  return d ? `${d.getDate()}.${d.getMonth() + 1}` : "";
};

/* "יום ה'" — short weekday for the day pills. */
export const shortDow = (start, dayNum) => {
  const d = dateForDay(start, dayNum);
  return d ? DOW_SHORT[d.getDay()] : "";
};

/* "17.9 יום ה'" — the full day-pill sub-label. */
export const pillDateLabel = (start, dayNum) => {
  const d = dateForDay(start, dayNum);
  return d ? `${d.getDate()}.${d.getMonth() + 1} ${DOW_SHORT[d.getDay()]}` : "";
};

/* "יום חמישי, 17 בספטמבר" — full localized date for section headers. */
export const fullDateLabel = (start, dayNum) => {
  const d = dateForDay(start, dayNum);
  return d ? `${DOW_FULL[d.getDay()]}, ${d.getDate()} ב${MONTH_FULL[d.getMonth()]}` : "";
};

/* "17 בספט׳" — a single abbreviated date (used inside ranges/exports). */
export const abbrDate = (start, dayNum) => {
  const d = dateForDay(start, dayNum);
  return d ? `${d.getDate()} ב${MONTH_ABBR[d.getMonth()]}` : "";
};

/* "17.9.2025" — numeric date for the CSV export column. */
export const numericDate = (start, dayNum) => {
  const d = dateForDay(start, dayNum);
  return d ? `${d.getDate()}.${d.getMonth() + 1}.${d.getFullYear()}` : "";
};

/* "17 בספט׳ – 27 בספט׳" — the whole-trip range for the header button. */
export const dateRangeLabel = (start, totalDays) => {
  const n = Math.max(1, Number(totalDays) || 1);
  const a = abbrDate(start, 1);
  if (!a) return "";
  const b = abbrDate(start, n);
  return n > 1 ? `${a} – ${b}` : a;
};

const tripDates = { parseStartDate, dateForDay, shortDate, shortDow, pillDateLabel, fullDateLabel, abbrDate, numericDate, dateRangeLabel };
export default tripDates;
