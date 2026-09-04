import React, { useEffect, useMemo, useRef, useState } from "react";
import { BASE_CATEGORIES, CURRENCIES, formatMoney, newCategoryKey, parseAmount } from "../utils/budget";

/* ══════════════════════════════════════════════════════════════
   BudgetSetupSheet — set the target, the currency and the caps.

   The total and every cap are in ILS: that is the currency the
   traveller's budget actually exists in. The trip currency is only
   how individual expenses get entered.

   A category left blank keeps capIlsMinor null — it still appears in
   the breakdown, it simply has no ceiling. That is what lets someone
   who only wants a single total ignore this whole section.
   ══════════════════════════════════════════════════════════════ */

const FONT = "'Noto Sans Hebrew','Inter','Noto Sans JP',system-ui,sans-serif";

/* Cap inputs are held as raw strings while editing, so a half-typed
   "15" is never coerced into a committed number. */
const capsFromConfig = (config) => {
  const out = {};
  for (const c of config?.categories || []) {
    out[c.key] = Number.isFinite(c.capIlsMinor) ? String(c.capIlsMinor / 100) : "";
  }
  return out;
};

const customsFromConfig = (config) =>
  (config?.categories || []).filter((c) => c.custom).map((c) => ({ key: c.key, label: c.label }));

export default function BudgetSetupSheet({
  open, onClose, onSave, config, P, foreignItemsPresent = false,
}) {
  const [total, setTotal] = useState("");
  const [currency, setCurrency] = useState("ILS");
  const [rate, setRate] = useState("");
  const [caps, setCaps] = useState({});
  const [customs, setCustoms] = useState([]);
  const [newCat, setNewCat] = useState("");
  const [err, setErr] = useState("");
  const panelRef = useRef(null);

  /* Re-seed from the live config every time the sheet opens. */
  useEffect(() => {
    if (!open) return;
    setTotal(config?.totalIlsMinor ? String(config.totalIlsMinor / 100) : "");
    setCurrency(config?.currency || "ILS");
    setRate(config?.rate && config.currency !== "ILS" ? String(config.rate) : "");
    setCaps(capsFromConfig(config));
    setCustoms(customsFromConfig(config));
    setNewCat("");
    setErr("");
  }, [open, config]);

  /* Esc closes; focus lands inside the panel on open. */
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => { if (e.key === "Escape") onClose?.(); };
    document.addEventListener("keydown", onKey);
    panelRef.current?.focus();
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const allCategories = useMemo(
    () => [...BASE_CATEGORIES, ...customs], [customs]);

  const totalMinor = parseAmount(total, "ILS");
  const allocated = allCategories.reduce(
    (s, c) => s + (parseAmount(caps[c.key], "ILS") || 0), 0);
  const unallocated = (totalMinor || 0) - allocated;

  if (!open) return null;

  const addCustom = () => {
    const label = newCat.trim();
    if (!label) return;
    setCustoms((cs) => [...cs, { key: newCategoryKey(), label }]);
    setNewCat("");
  };

  const submit = () => {
    if (total.trim() && totalMinor === null) { setErr("סכום לא תקין — הזינו מספר חיובי"); return; }
    for (const c of allCategories) {
      const raw = caps[c.key];
      if (raw && raw.trim() && parseAmount(raw, "ILS") === null) {
        setErr(`סכום לא תקין בקטגוריה ${c.label}`); return;
      }
    }
    const rateNum = currency === "ILS" ? 1 : Number(rate);
    if (currency !== "ILS" && (!Number.isFinite(rateNum) || rateNum <= 0)) {
      setErr("שער המרה לא תקין"); return;
    }
    /* Emit only categories the user actually cares about: one with a real cap,
       or one already declared in the saved config. Otherwise every blank base
       category would persist and the budget screen would open onto eight empty
       cards. */
    const priorKeys = new Set((config?.categories || []).map((c) => c.key));
    onSave({
      totalIlsMinor: totalMinor || 0,
      currency,
      rate: rateNum,
      rateUpdatedAt: new Date().toISOString(),
      categories: allCategories
        .map((c) => ({
          key: c.key,
          label: c.label,
          capIlsMinor: parseAmount(caps[c.key], "ILS"),
          ...(c.key.startsWith("c_") ? { custom: true } : {}),
        }))
        .filter((c) => c.capIlsMinor != null || priorKeys.has(c.key)),
    });
  };

  const field = {
    width: "100%", minHeight: 44, borderRadius: 12, border: `1px solid ${P.line}`,
    background: P.surface, color: P.ink, font: `600 15px ${FONT}`,
    padding: "10px 12px", boxSizing: "border-box",
  };
  const label = { display: "block", font: `700 12.5px ${FONT}`, color: P.ink3, marginBlockEnd: 6 };

  return (
    <div
      role="presentation"
      onClick={(e) => { if (e.target === e.currentTarget) onClose?.(); }}
      style={{
        position: "fixed", inset: 0, zIndex: 300, background: "rgba(0,0,0,0.42)",
        display: "flex", alignItems: "flex-end", justifyContent: "center",
      }}
    >
      {/* TODO(phase-d): focus trap + focus restore, then restore aria-modal */}
      <div
        ref={panelRef}
        role="dialog"
        aria-label="הגדרת תקציב"
        tabIndex={-1}
        dir="rtl"
        style={{
          width: "min(560px, 100%)", maxHeight: "88vh", overflowY: "auto",
          background: P.panel, color: P.ink, borderStartStartRadius: 22, borderStartEndRadius: 22,
          padding: 20, boxSizing: "border-box", font: `400 14.5px ${FONT}`, outline: "none",
        }}
      >
        <h2 style={{ font: `800 19px ${FONT}`, letterSpacing: "-0.014em", margin: "0 0 16px" }}>
          הגדרת תקציב
        </h2>

        <div style={{ marginBlockEnd: 14 }}>
          <label style={label} htmlFor="bs-total">תקציב כולל בשקלים</label>
          <input id="bs-total" style={field} inputMode="decimal" value={total}
                 aria-label="תקציב כולל בשקלים"
                 onChange={(e) => { setTotal(e.target.value); setErr(""); }} />
        </div>

        <div style={{ display: "flex", gap: 10, marginBlockEnd: 14 }}>
          <div style={{ flex: 1 }}>
            <label style={label} htmlFor="bs-currency">מטבע היעד</label>
            <select id="bs-currency" style={field} value={currency} aria-label="מטבע היעד"
                    disabled={foreignItemsPresent}
                    onChange={(e) => { setCurrency(e.target.value); setErr(""); }}>
              {CURRENCIES.map((c) => <option key={c.code} value={c.code}>{c.label}</option>)}
            </select>
            {foreignItemsPresent && (
              <p style={{ font: `400 12px ${FONT}`, color: P.ink3, marginBlockStart: 6 }}>
                יש הוצאות במטבע זר — שינוי המטבע ייפתח בהמשך
              </p>
            )}
          </div>
          {currency !== "ILS" && (
            <div style={{ flex: 1 }}>
              <label style={label} htmlFor="bs-rate">{`שער המרה ל־₪ (1 ${currency} =)`}</label>
              <input id="bs-rate" style={field} inputMode="decimal" value={rate}
                     aria-label={`שער המרה ל־₪ (1 ${currency} =)`}
                     onChange={(e) => { setRate(e.target.value); setErr(""); }} />
            </div>
          )}
        </div>

        <h3 style={{ font: `800 14px ${FONT}`, margin: "18px 0 4px" }}>תקרות לקטגוריות</h3>
        <p style={{ font: `400 12.5px ${FONT}`, color: P.ink3, margin: "0 0 12px" }}>
          אופציונלי. קטגוריה בלי תקרה עדיין נספרת בפילוח.
        </p>

        {allCategories.map((c) => (
          <div key={c.key} style={{ display: "flex", alignItems: "center", gap: 10, marginBlockEnd: 8 }}>
            <span style={{ flex: 1, font: `600 14px ${FONT}` }}>{c.label}</span>
            <input
              style={{ ...field, width: 130 }}
              inputMode="decimal"
              aria-label={`תקרה עבור ${c.label}`}
              value={caps[c.key] || ""}
              onChange={(e) => { setCaps((p) => ({ ...p, [c.key]: e.target.value })); setErr(""); }}
            />
          </div>
        ))}

        <div style={{ display: "flex", gap: 10, alignItems: "flex-end", marginBlockStart: 12 }}>
          <div style={{ flex: 1 }}>
            <label style={label} htmlFor="bs-newcat">שם קטגוריה חדשה</label>
            <input id="bs-newcat" style={field} value={newCat} aria-label="שם קטגוריה חדשה"
                   onChange={(e) => setNewCat(e.target.value)}
                   onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addCustom(); } }} />
          </div>
          <button type="button" onClick={addCustom}
                  style={{ minHeight: 44, minWidth: 44, padding: "0 16px", borderRadius: 999,
                           border: `1px solid ${P.line}`, background: P.surface, color: P.ink,
                           font: `700 14px ${FONT}`, cursor: "pointer" }}>
            הוספת קטגוריה
          </button>
        </div>

        <p data-testid="allocation-line"
           style={{ font: `600 12.5px ${FONT}`, color: P.ink3, marginBlockStart: 16 }}>
          {`הוקצה ${formatMoney(allocated, "ILS")} · לא מוקצה ${formatMoney(unallocated, "ILS")}`}
        </p>

        {err && (
          <p role="alert" style={{ font: `700 13px ${FONT}`, color: P.danger, marginBlockStart: 8 }}>
            {err}
          </p>
        )}

        <div style={{ display: "flex", gap: 10, marginBlockStart: 20 }}>
          <button type="button" onClick={submit}
                  style={{ flex: 1, minHeight: 48, borderRadius: 999, border: "none",
                           background: P.accent, color: "#fff", font: `800 15px ${FONT}`, cursor: "pointer" }}>
            שמירה
          </button>
          <button type="button" onClick={onClose}
                  style={{ minHeight: 48, minWidth: 88, borderRadius: 999,
                           border: `1px solid ${P.line}`, background: "transparent", color: P.ink2,
                           font: `700 15px ${FONT}`, cursor: "pointer" }}>
            ביטול
          </button>
        </div>
      </div>
    </div>
  );
}
