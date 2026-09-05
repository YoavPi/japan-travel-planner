import React, { useEffect, useRef, useState } from "react";
import { CURRENCY_SYMBOL, minorDigits, minorFactor, parseAmount, toIlsMinor } from "../utils/budget";
import Money from "./Money";

/* ══════════════════════════════════════════════════════════════
   ExpenseSheet — add, edit or delete one expense.

   The currency is a two-way toggle, not a dropdown: an expense is
   either in the trip currency or in shekels, and nothing else. That
   is the whole point of the two-currency model — the ₪4,000 flight
   was bought in Israel, the ¥1,200 ramen was not.
   ══════════════════════════════════════════════════════════════ */

const FONT = "'Noto Sans Hebrew','Inter','Noto Sans JP',system-ui,sans-serif";

const minorToInput = (minor, currency) => {
  if (!Number.isFinite(minor)) return "";
  const d = minorDigits(currency);
  const v = minor / minorFactor(currency);
  return d === 0 ? String(v) : String(Number(v.toFixed(d)));
};

export default function ExpenseSheet({
  open, onClose, onSubmit, onDelete, expense, config, categories, dayCount, P,
}) {
  const editing = !!expense;
  const tripCurrency = config?.currency || "ILS";
  const hasForeign = tripCurrency !== "ILS";

  const [label, setLabel] = useState("");
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState(tripCurrency);
  const [category, setCategory] = useState("other");
  const [dayRef, setDayRef] = useState("");
  const [note, setNote] = useState("");
  const [err, setErr] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const panelRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    setLabel(expense?.label || "");
    setCurrency(expense?.currency || tripCurrency);
    setAmount(expense ? minorToInput(expense.amountMinor, expense.currency || tripCurrency) : "");
    setCategory(expense?.category || "other");
    setDayRef(expense?.dayRef != null ? String(expense.dayRef) : "");
    setNote(expense?.note || "");
    setErr("");
    setConfirmDelete(false);
  }, [open, expense, tripCurrency]);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => { if (e.key === "Escape") onClose?.(); };
    document.addEventListener("keydown", onKey);
    panelRef.current?.focus();
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const parsed = parseAmount(amount, currency);
  const ilsPreview = parsed != null && currency !== "ILS"
    ? toIlsMinor(parsed, currency, config) : null;

  /* Changing the currency of an existing expense re-denominates its stored
     amount, so any recorded "actual" figure — captured in the OLD currency —
     would silently be read in the new one. Reset the paid state rather than
     carry a number that no longer means what it says. */
  const currencyChanged = editing && currency !== expense.currency;

  const submit = () => {
    if (!label.trim()) { setErr("צריך תיאור להוצאה"); return; }
    if (parsed === null) { setErr("סכום לא תקין — הזינו מספר חיובי"); return; }
    onSubmit({
      label: label.trim(),
      amountMinor: parsed,
      currency,
      category,
      dayRef: dayRef === "" ? null : Number(dayRef),
      note: note.trim(),
      ...(currencyChanged ? { paid: false, actualMinor: null } : {}),
    });
  };

  const field = {
    width: "100%", minHeight: 44, borderRadius: 12, border: `1px solid ${P.line}`,
    background: P.surface, color: P.ink, font: `600 15px ${FONT}`,
    padding: "10px 12px", boxSizing: "border-box",
  };
  const lbl = { display: "block", font: `700 12.5px ${FONT}`, color: P.ink3, marginBlockEnd: 6 };

  const currencyChip = (code) => (
    <button
      key={code}
      type="button"
      role="radio"
      aria-checked={currency === code}
      aria-label={CURRENCY_SYMBOL[code] || code}
      onClick={() => { setCurrency(code); setErr(""); }}
      style={{
        minHeight: 44, minWidth: 52, borderRadius: 999, cursor: "pointer",
        border: `1px solid ${currency === code ? P.accent : P.line}`,
        background: currency === code ? P.accent : "transparent",
        color: currency === code ? "#fff" : P.ink2,
        font: `800 15px ${FONT}`,
      }}
    >
      {CURRENCY_SYMBOL[code] || code}
    </button>
  );

  return (
    <div
      role="presentation"
      onClick={(e) => { if (e.target === e.currentTarget) onClose?.(); }}
      style={{
        position: "fixed", inset: 0, zIndex: 310, background: "rgba(0,0,0,0.42)",
        display: "flex", alignItems: "flex-end", justifyContent: "center",
      }}
    >
      {/* TODO(phase-d): focus trap + focus restore, then restore aria-modal */}
      <div
        ref={panelRef}
        role="dialog"
        aria-label={editing ? "עריכת הוצאה" : "הוספת הוצאה"}
        tabIndex={-1}
        dir="rtl"
        style={{
          width: "min(560px, 100%)", maxHeight: "88vh", overflowY: "auto",
          background: P.panel, color: P.ink, borderStartStartRadius: 22, borderStartEndRadius: 22,
          padding: 20, boxSizing: "border-box", font: `400 14.5px ${FONT}`, outline: "none",
        }}
      >
        <h2 style={{ font: `800 19px ${FONT}`, letterSpacing: "-0.014em", margin: "0 0 16px" }}>
          {editing ? "עריכת הוצאה" : "הוספת הוצאה"}
        </h2>

        <div style={{ marginBlockEnd: 14 }}>
          <label style={lbl} htmlFor="ex-label">תיאור ההוצאה</label>
          <input id="ex-label" style={field} value={label} aria-label="תיאור ההוצאה"
                 onChange={(e) => { setLabel(e.target.value); setErr(""); }} />
        </div>

        <div style={{ marginBlockEnd: 14 }}>
          <label style={lbl} htmlFor="ex-amount">סכום</label>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <input id="ex-amount" style={{ ...field, flex: 1 }} inputMode="decimal" value={amount}
                   aria-label="סכום"
                   onChange={(e) => { setAmount(e.target.value); setErr(""); }} />
            {hasForeign && (
              <div role="radiogroup" aria-label="מטבע" style={{ display: "flex", gap: 6 }}>
                {currencyChip(tripCurrency)}
                {currencyChip("ILS")}
              </div>
            )}
          </div>
          {currencyChanged && expense.paid && (
            <p style={{ font: `600 12.5px ${FONT}`, color: P.ink3, marginBlockStart: 6 }}>
              שינוי מטבע יאפס את סימון &quot;שולם&quot;
            </p>
          )}
          {ilsPreview != null && (
            <p data-testid="ils-preview"
               style={{ font: `600 12.5px ${FONT}`, color: P.ink3, marginBlockStart: 6 }}>
              ≈ <Money minor={ilsPreview} currency="ILS" P={P} tone="ink3" />
            </p>
          )}
        </div>

        <div style={{ display: "flex", gap: 10, marginBlockEnd: 14 }}>
          <div style={{ flex: 1 }}>
            <label style={lbl} htmlFor="ex-cat">קטגוריה</label>
            <select id="ex-cat" style={field} value={category} aria-label="קטגוריה"
                    onChange={(e) => setCategory(e.target.value)}>
              {categories.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
            </select>
          </div>
          <div style={{ flex: 1 }}>
            <label style={lbl} htmlFor="ex-day">שיוך ליום</label>
            <select id="ex-day" style={field} value={dayRef} aria-label="שיוך ליום"
                    onChange={(e) => setDayRef(e.target.value)}>
              <option value="">כללי</option>
              {Array.from({ length: dayCount || 0 }, (_, i) => i + 1).map((d) => (
                <option key={d} value={String(d)}>{`יום ${d}`}</option>
              ))}
            </select>
          </div>
        </div>

        <div style={{ marginBlockEnd: 14 }}>
          <label style={lbl} htmlFor="ex-note">הערה</label>
          <input id="ex-note" style={field} value={note} aria-label="הערה"
                 onChange={(e) => setNote(e.target.value)} />
        </div>

        {err && (
          <p role="alert" style={{ font: `700 13px ${FONT}`, color: P.danger, marginBlockEnd: 10 }}>
            {err}
          </p>
        )}

        <div style={{ display: "flex", gap: 10 }}>
          <button type="button" onClick={submit}
                  style={{ flex: 1, minHeight: 48, borderRadius: 999, border: "none",
                           background: P.accent, color: "#fff", font: `800 15px ${FONT}`, cursor: "pointer" }}>
            {editing ? "שמירה" : "הוספה"}
          </button>
          <button type="button" onClick={onClose}
                  style={{ minHeight: 48, minWidth: 88, borderRadius: 999,
                           border: `1px solid ${P.line}`, background: "transparent", color: P.ink2,
                           font: `700 15px ${FONT}`, cursor: "pointer" }}>
            ביטול
          </button>
        </div>

        {editing && !confirmDelete && (
          <button type="button" onClick={() => setConfirmDelete(true)}
                  style={{ width: "100%", minHeight: 44, marginBlockStart: 12, borderRadius: 999,
                           border: "none", background: "transparent", color: P.danger,
                           font: `700 14px ${FONT}`, cursor: "pointer" }}>
            מחיקת ההוצאה
          </button>
        )}

        {editing && confirmDelete && (
          <div style={{ marginBlockStart: 12, padding: 12, borderRadius: 14,
                        background: P.surface, border: `1px solid ${P.line}` }}>
            <p style={{ font: `700 13.5px ${FONT}`, margin: "0 0 10px" }}>
              למחוק את ההוצאה לצמיתות?
            </p>
            <div style={{ display: "flex", gap: 8 }}>
              <button type="button" onClick={() => onDelete?.(expense.id)}
                      style={{ flex: 1, minHeight: 44, borderRadius: 999, border: "none",
                               background: P.danger, color: "#fff", font: `800 14px ${FONT}`, cursor: "pointer" }}>
                כן, למחוק
              </button>
              <button type="button" onClick={() => setConfirmDelete(false)}
                      style={{ flex: 1, minHeight: 44, borderRadius: 999, border: `1px solid ${P.line}`,
                               background: "transparent", color: P.ink2, font: `700 14px ${FONT}`, cursor: "pointer" }}>
                ביטול
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
