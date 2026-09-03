/* ══════════════════════════════════════════════════════════════
   budget — pure helpers for trip budgeting.

   The budget lives at trip.data.budget (no schema change, exactly
   like trip.data.files[] for the Files gallery). This module only
   transforms plain data — no React, no Supabase.

   MONEY IS INTEGERS. Every amount is an integer in its currency's
   minor unit (agorot / sen / cents). Floats accumulate rounding
   drift across a sum, and this is money.
   ══════════════════════════════════════════════════════════════ */

/* Minor-unit exponent per currency. JPY and KRW have none — ¥1,200
   is 1200, not 120000. Unknown codes assume 2. */
export const MINOR_DIGITS = {
  ILS: 2, USD: 2, EUR: 2, GBP: 2, AED: 2, THB: 2, CHF: 2, AUD: 2, CAD: 2,
  JPY: 0, KRW: 0, VND: 0,
};

export const minorDigits = (code) => (MINOR_DIGITS[code] ?? 2);
export const minorFactor = (code) => 10 ** minorDigits(code);

export const CURRENCY_SYMBOL = {
  ILS: "₪", USD: "$", EUR: "€", GBP: "£", JPY: "¥", KRW: "₩",
  THB: "฿", VND: "₫", AED: "AED", CHF: "CHF", AUD: "A$", CAD: "C$",
};

/* Offered in the budget-setup currency picker. ILS first — it is the
   home currency and the one every total is denominated in. */
export const CURRENCIES = [
  { code: "ILS", label: "שקל ₪" },
  { code: "JPY", label: "יֵן ¥" },
  { code: "EUR", label: "אירו €" },
  { code: "USD", label: "דולר $" },
  { code: "GBP", label: "לירה שטרלינג £" },
  { code: "THB", label: "באט ฿" },
  { code: "AED", label: "דירהם AED" },
  { code: "KRW", label: "וון ₩" },
  { code: "VND", label: "דונג ₫" },
  { code: "CHF", label: "פרנק שוויצרי CHF" },
];

/* "12.50" → 1250 for ILS; "1200" → 1200 for JPY.
   Returns null for anything that is not a non-negative number. */
export function parseAmount(text, currency) {
  const raw = String(text ?? "").trim();
  if (!raw) return null;
  const cleaned = raw.replace(/[,\s ]/g, "").replace(/[₪$€£¥₩฿₫]/g, "");
  if (!cleaned || !/^\d+(\.\d+)?$/.test(cleaned)) return null;
  const n = Number(cleaned);
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.round(n * minorFactor(currency));
}

/* 123450 ILS-agorot → "1,234.50". Grouping/decimals follow the currency. */
export function formatAmount(minor, currency) {
  if (!Number.isFinite(minor)) return "";
  const d = minorDigits(currency);
  return (minor / minorFactor(currency)).toLocaleString("en-US", {
    minimumFractionDigits: d, maximumFractionDigits: d,
  });
}

export function formatMoney(minor, currency) {
  if (!Number.isFinite(minor)) return "";
  const sym = CURRENCY_SYMBOL[currency] || currency || "";
  return `${sym}${formatAmount(minor, currency)}`;
}

/* An amount expressed in ILS agorot. ILS passes through; anything else
   goes local-minor → local-major → ILS-major → ILS-agorot via the single
   manual config.rate. A missing/invalid rate yields 0, never NaN — a NaN
   would poison every sum downstream. */
export function toIlsMinor(minor, currency, config) {
  if (!Number.isFinite(minor)) return 0;
  if ((currency || "ILS") === "ILS") return Math.round(minor);
  const rate = Number(config?.rate);
  if (!Number.isFinite(rate) || rate <= 0) return 0;
  return Math.round((minor / minorFactor(currency)) * rate * 100);
}

const shortId = () => Math.random().toString(36).slice(2, 8).padEnd(6, "0").slice(0, 6);
export const newExpenseId = () => `e_${shortId()}`;
export const newCategoryKey = () => `c_${shortId()}`;

export const BASE_CATEGORIES = [
  { key: "flights",     label: "טיסות" },
  { key: "lodging",     label: "לינה" },
  { key: "transport",   label: "תחבורה" },
  { key: "food",        label: "אוכל" },
  { key: "attractions", label: "אטרקציות ופעילויות" },
  { key: "shopping",    label: "קניות" },
  { key: "insurance",   label: "ביטוח" },
  { key: "other",       label: "אחר" },
];

/* Stop categories in this app are free-text HEBREW strings written by the
   trip author or returned by Places with language=he ("ראמן", "בית קפה",
   "מקדש"). Order matters: flights is checked before transport so that
   "שדה תעופה" does not fall into ground transit. */
const CATEGORY_HINTS = [
  ["flights",   /טיסה|טיסת|שדה תעופה|נמל תעופה/],
  ["lodging",   /מלון|לינה|אכסני|צימר|הוסטל|ריוקן|אירוח/],
  ["food",      /מסעד|ראמן|סושי|קפה|אוכל|מאפי|קונדיטור|איזקאיה|פיצרי|המבורגר|פאב|ביסטרו|קונביני/],
  ["shopping",  /קניו|קניות|חנות|מרכז מסחרי|אאוטלט|דיוטי פרי/],
  ["transport", /רכבת|תחנת|אוטובוס|מונית|השכרת רכב|מעבורת|כרטיס נסיעה|מטרו/],
];

/* A stop's Hebrew category → a budget category key. Always overridable in
   the UI; this only picks the default. */
export function guessCategory(stopCategory) {
  const s = String(stopCategory || "").trim();
  if (!s) return "attractions";
  for (const [key, re] of CATEGORY_HINTS) if (re.test(s)) return key;
  return "attractions";
}

/* ── Rollup ────────────────────────────────────────────────────
   THE selector. Every surface reads its numbers from here — the
   dedicated screen, the overview card, the dashboard indicator and
   the editor chip. Nothing recomputes a total at a call site; that
   is how indicator surfaces drift apart. */

/* What an item is really going to cost: the actual amount once it is
   paid and known to have differed, otherwise the planned amount. */
const itemEffectiveMinor = (it) =>
  (it.paid && Number.isFinite(it.actualMinor)) ? it.actualMinor : (Number(it.amountMinor) || 0);

export function rollup(budget) {
  const config = budget?.config || {};
  const items = Array.isArray(budget?.items) ? budget.items : [];
  const totalIlsMinor = Number(config.totalIlsMinor) || 0;

  let plannedIlsMinor = 0;
  let actualIlsMinor = 0;
  let effectiveIlsMinor = 0;
  const acc = new Map(); // categoryKey → running totals

  for (const it of items) {
    const cur = it.currency || "ILS";
    const planned = toIlsMinor(Number(it.amountMinor) || 0, cur, config);
    const effective = toIlsMinor(itemEffectiveMinor(it), cur, config);
    const actual = it.paid ? effective : 0;

    plannedIlsMinor += planned;
    actualIlsMinor += actual;
    effectiveIlsMinor += effective;

    const key = it.category || "other";
    const a = acc.get(key) || { planned: 0, actual: 0, effective: 0, count: 0 };
    a.planned += planned; a.actual += actual; a.effective += effective; a.count += 1;
    acc.set(key, a);
  }

  const declared = Array.isArray(config.categories) ? config.categories : [];
  const declaredByKey = new Map(declared.map((c) => [c.key, c]));
  const labelOf = (key) =>
    declaredByKey.get(key)?.label
    || BASE_CATEGORIES.find((c) => c.key === key)?.label
    || "אחר";

  /* Declared categories first (so a capped-but-empty one still shows a bar),
     then any category that only exists because an expense points at it. */
  const keys = [...new Set([...declared.map((c) => c.key), ...acc.keys()])];
  const byCategory = keys.map((key) => {
    const a = acc.get(key) || { planned: 0, actual: 0, effective: 0, count: 0 };
    const capRaw = declaredByKey.get(key)?.capIlsMinor;
    const cap = Number.isFinite(capRaw) && capRaw > 0 ? capRaw : null;
    return {
      key,
      label: labelOf(key),
      capIlsMinor: cap,
      plannedIlsMinor: a.planned,
      actualIlsMinor: a.actual,
      effectiveIlsMinor: a.effective,
      itemCount: a.count,
      pct: cap ? Math.round((a.effective / cap) * 100) : null,
      over: cap ? a.effective > cap : false,
    };
  });

  const allocatedIlsMinor = declared.reduce(
    (s, c) => s + (Number.isFinite(c.capIlsMinor) ? c.capIlsMinor : 0), 0);

  return {
    totalIlsMinor,
    plannedIlsMinor,
    actualIlsMinor,
    effectiveIlsMinor,
    remainingIlsMinor: totalIlsMinor - effectiveIlsMinor,
    pct: totalIlsMinor > 0 ? Math.round((effectiveIlsMinor / totalIlsMinor) * 100) : null,
    overBudget: totalIlsMinor > 0 && effectiveIlsMinor > totalIlsMinor,
    allocatedIlsMinor,
    unallocatedIlsMinor: totalIlsMinor - allocatedIlsMinor,
    byCategory,
    itemCount: items.length,
  };
}

/* The tiny derived object persisted at data.budget.summary so the dashboard
   grid — which never receives `data` — can render its mini-indicator.
   DERIVED, NEVER AUTHORED: tripService re-derives it on every write. */
export function summarize(budget) {
  if (!hasBudget(budget)) return null;
  const r = rollup(budget);
  return {
    totalIlsMinor: r.totalIlsMinor,
    effectiveIlsMinor: r.effectiveIlsMinor,
    pct: r.pct,
    over: r.overBudget,
  };
}

/* Whether a trip has a budget worth rendering at all. A trip with neither a
   target nor a single expense shows no bars anywhere — only the setup CTA. */
export function hasBudget(budget) {
  if (!budget) return false;
  const total = Number(budget.config?.totalIlsMinor) || 0;
  const count = Array.isArray(budget.items) ? budget.items.length : 0;
  return total > 0 || count > 0;
}
