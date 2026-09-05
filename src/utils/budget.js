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
  const cleaned = raw.replace(/[,\s]/g, "").replace(/[₪$€£¥₩฿₫]/g, "");
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
    (s, c) => s + (Number.isFinite(c.capIlsMinor) && c.capIlsMinor > 0 ? c.capIlsMinor : 0), 0);

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

/* ── Transforms ────────────────────────────────────────────────
   Every transform takes trip.data and returns a NEW data object —
   the same contract as addGeneralFile/updateGeneralFile in
   tripFiles.js, so callers persist with the identical
   saveTrip(id, { data }) call. */

export const EMPTY_BUDGET = Object.freeze({
  config: Object.freeze({
    currency: "ILS", rate: 1, rateUpdatedAt: null, totalIlsMinor: 0, categories: [],
  }),
  items: Object.freeze([]),
});

/* Return data with a budget guaranteed present. The existing object is
   returned by identity when there is nothing to add, so callers can cheaply
   detect a no-op. Never hands out a reference into EMPTY_BUDGET. */
export function ensureBudget(data) {
  const d = data || {};
  if (d.budget) return data;
  return {
    ...d,
    budget: {
      config: { ...EMPTY_BUDGET.config, categories: [] },
      items: [],
    },
  };
}

export function setBudgetConfig(data, patch) {
  const d = ensureBudget(data);
  return { ...d, budget: { ...d.budget, config: { ...d.budget.config, ...patch } } };
}

export function upsertCategory(data, { key, label, capIlsMinor = null }) {
  const d = ensureBudget(data);
  const list = d.budget.config.categories || [];
  const exists = list.some((c) => c.key === key);
  const next = exists
    ? list.map((c) => (c.key === key ? { ...c, label, capIlsMinor } : c))
    : [...list, { key, label, capIlsMinor, ...(key.startsWith("c_") ? { custom: true } : {}) }];
  return setBudgetConfig(d, { categories: next });
}

/* Drop a category declaration. Its expenses are REASSIGNED to `other`,
   never orphaned and never deleted — money the user entered is not
   destroyed as a side effect of a settings change. */
export function removeCategory(data, key) {
  const d = ensureBudget(data);
  const categories = (d.budget.config.categories || []).filter((c) => c.key !== key);
  const items = (d.budget.items || []).map((i) =>
    i.category === key ? { ...i, category: "other" } : i);
  return { ...d, budget: { ...d.budget, config: { ...d.budget.config, categories }, items } };
}

export function addExpense(data, expense = {}) {
  const d = ensureBudget(data);
  const item = {
    id: expense.id || newExpenseId(),
    label: String(expense.label || "").trim(),
    amountMinor: Number(expense.amountMinor) || 0,
    currency: expense.currency || d.budget.config.currency || "ILS",
    category: expense.category || "other",
    dayRef: expense.dayRef ?? null,
    stopRef: expense.stopRef ?? null,
    paid: !!expense.paid,
    actualMinor: Number.isFinite(expense.actualMinor) ? expense.actualMinor : null,
    note: expense.note || "",
    createdAt: expense.createdAt || new Date().toISOString(),
  };
  return { ...d, budget: { ...d.budget, items: [...d.budget.items, item] } };
}

export function updateExpense(data, id, patch) {
  const d = data || {};
  if (!d.budget || !(d.budget.items || []).some((i) => i.id === id)) return data;
  return {
    ...d,
    budget: { ...d.budget, items: d.budget.items.map((i) => (i.id === id ? { ...i, ...patch } : i)) },
  };
}

export function removeExpense(data, id) {
  const d = data || {};
  if (!d.budget) return data;
  return { ...d, budget: { ...d.budget, items: (d.budget.items || []).filter((i) => i.id !== id) } };
}

/* Un-paying ALWAYS clears the actual amount: a "what it really cost" figure
   is meaningless on an unpaid item, and leaving it behind would silently
   resurrect on the next tick of the checkbox. */
export function setPaid(data, id, paid, actualMinor = null) {
  return updateExpense(data, id, paid
    ? { paid: true, actualMinor: Number.isFinite(actualMinor) ? actualMinor : null }
    : { paid: false, actualMinor: null });
}

/* An expense's day. A stop-linked expense derives it from the stop, so moving
   that stop between days needs no budget write at all. Only standalone items
   carry a stored dayRef. (Phase A creates no stopRefs; the branch is here so
   Phase B needs no rewrite.) */
export function resolveDay(item, tripData) {
  if (item?.stopRef) {
    const day = (tripData || []).find((d) =>
      (d.attractions || []).some((a) => a.instanceId === item.stopRef));
    return day ? day.day : null;
  }
  return item?.dayRef ?? null;
}

/* Keep standalone expenses' `dayRef` valid after the trip's days are
   renumbered — the exact contract of remapFileDays in tripFiles.js.
   `mapping` maps an OLD day number to its NEW one (or null if removed). An
   expense whose day is gone or now out of range falls back to null (general);
   it is never dropped. Stop-linked items are skipped: their day is derived. */
export function remapExpenseDays(items, mapping, newDayCount) {
  return (items || []).map((it) => {
    if (it.stopRef) return it;
    if (it.dayRef == null) return it;
    const next = mapping[it.dayRef];
    if (next == null || next > newDayCount) return { ...it, dayRef: null };
    return next === it.dayRef ? it : { ...it, dayRef: next };
  });
}
