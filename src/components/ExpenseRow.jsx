import React, { useState } from "react";
import { parseAmount, toIlsMinor } from "../utils/budget";
import Money from "./Money";

/* ══════════════════════════════════════════════════════════════
   ExpenseRow — one expense, and the planned→actual transition.

   The flow, in the owner's words: one amount and a tick, and after
   the tick, "was it different?". Only a yes reveals a second field.
   That keeps the default path to a single tap while still capturing
   the real number when it exists.

   Un-ticking never prompts: it just clears both, because a "what it
   really cost" figure is meaningless on an unpaid expense.
   ══════════════════════════════════════════════════════════════ */

const FONT = "'Noto Sans Hebrew','Inter','Noto Sans JP',system-ui,sans-serif";

export default function ExpenseRow({
  item, config, dayLabel, categoryLabel, readOnly, P, onEdit, onMarkPaid,
}) {
  /* null → no prompt; "ask" → was it different?; "amount" → enter it. */
  const [phase, setPhase] = useState(null);
  const [actual, setActual] = useState("");
  const [err, setErr] = useState(false);

  const cur = item.currency || "ILS";
  const shownMinor = (item.paid && Number.isFinite(item.actualMinor))
    ? item.actualMinor : item.amountMinor;
  const differed = item.paid && Number.isFinite(item.actualMinor)
    && item.actualMinor !== item.amountMinor;
  const ils = cur === "ILS" ? null : toIlsMinor(shownMinor, cur, config);

  const startPaid = () => { setPhase("ask"); setActual(""); setErr(false); };
  const sameAmount = () => { setPhase(null); onMarkPaid?.(item.id, true, null); };
  const confirmActual = () => {
    const parsed = parseAmount(actual, cur);
    if (parsed === null) { setErr(true); return; }
    setPhase(null);
    onMarkPaid?.(item.id, true, parsed);
  };

  const chip = {
    font: `700 11.5px ${FONT}`, color: P.ink3, background: P.surface,
    borderRadius: 999, padding: "3px 9px", whiteSpace: "nowrap",
  };
  const tap = {
    minWidth: 44, minHeight: 44, display: "flex", alignItems: "center",
    justifyContent: "center", borderRadius: 999, cursor: "pointer",
    background: "transparent",
  };

  return (
    <div style={{ borderBlockEnd: `1px solid ${P.line}`, paddingBlock: 6 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        {!readOnly && (
          <button
            type="button"
            aria-label={`${item.paid ? "ביטול סימון" : "סימון"} ${item.label} כשולם`}
            aria-pressed={!!item.paid}
            onClick={() => (item.paid ? onMarkPaid?.(item.id, false, null) : startPaid())}
            style={{
              ...tap,
              border: `1px solid ${item.paid ? P.accent : P.line}`,
              color: item.paid ? "#fff" : P.ink3,
              background: item.paid ? P.accent : "transparent",
              font: `800 15px ${FONT}`,
            }}
          >
            ✓
          </button>
        )}

        <button
          type="button"
          aria-label={readOnly ? undefined : `עריכת ${item.label}`}
          onClick={readOnly ? undefined : () => onEdit?.(item)}
          disabled={readOnly}
          style={{
            flex: 1, minHeight: 44, textAlign: "start", border: "none",
            background: "transparent", cursor: readOnly ? "default" : "pointer",
            padding: 0, color: P.ink,
          }}
        >
          <span style={{ display: "block", font: `700 14.5px ${FONT}` }}>{item.label}</span>
          <span style={{ display: "flex", gap: 6, marginBlockStart: 4 }}>
            <span style={chip}>{categoryLabel}</span>
            <span style={chip}>{dayLabel}</span>
            {/* Paid state is carried by text, never by colour alone. */}
            {item.paid && <span style={{ ...chip, color: P.accent }}>שולם</span>}
          </span>
        </button>

        <span style={{ textAlign: "end" }}>
          <span data-testid="row-amount" style={{ display: "block" }}>
            <Money minor={shownMinor} currency={cur} bold P={P} />
          </span>
          {differed && (
            <span data-testid="row-planned"
                  style={{ display: "block", font: `600 11.5px ${FONT}`, color: P.ink3 }}>
              {"תוכנן "}
              <Money minor={item.amountMinor} currency={cur} P={P} tone="ink3" />
            </span>
          )}
          {ils != null && (
            <span data-testid="row-ils"
                  style={{ display: "block", font: `600 11.5px ${FONT}`, color: P.ink3 }}>
              <Money minor={ils} currency="ILS" P={P} tone="ink3" />
            </span>
          )}
        </span>
      </div>

      {phase === "ask" && (
        <div role="group" aria-label="אימות סכום ששולם"
             style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap",
                      background: P.surface, borderRadius: 14, padding: 10, marginBlockStart: 8 }}>
          <span style={{ font: `700 13.5px ${FONT}`, color: P.ink2 }}>האם העלות הייתה שונה?</span>
          <button type="button" onClick={() => setPhase("amount")}
                  style={{ minHeight: 44, minWidth: 64, borderRadius: 999, border: `1px solid ${P.accent}`,
                           background: "transparent", color: P.accent, font: `800 14px ${FONT}`, cursor: "pointer" }}>
            כן
          </button>
          <button type="button" onClick={sameAmount}
                  style={{ minHeight: 44, padding: "0 14px", borderRadius: 999, border: `1px solid ${P.line}`,
                           background: "transparent", color: P.ink2, font: `700 14px ${FONT}`, cursor: "pointer" }}>
            לא, אותו סכום
          </button>
        </div>
      )}

      {phase === "amount" && (
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap",
                      background: P.surface, borderRadius: 14, padding: 10, marginBlockStart: 8 }}>
          <input
            aria-label="הסכום ששולם בפועל"
            inputMode="decimal"
            value={actual}
            onChange={(e) => { setActual(e.target.value); setErr(false); }}
            onKeyDown={(e) => { if (e.key === "Enter") confirmActual(); }}
            style={{ flex: 1, minWidth: 120, minHeight: 44, borderRadius: 12,
                     border: `1px solid ${err ? P.danger : P.line}`, background: P.panel,
                     color: P.ink, font: `700 15px ${FONT}`, padding: "8px 12px" }}
          />
          <button type="button" onClick={confirmActual}
                  style={{ minHeight: 44, padding: "0 18px", borderRadius: 999, border: "none",
                           background: P.accent, color: "#fff", font: `800 14px ${FONT}`, cursor: "pointer" }}>
            אישור
          </button>
          <button type="button" onClick={() => setPhase(null)}
                  style={{ minHeight: 44, minWidth: 44, borderRadius: 999, border: `1px solid ${P.line}`,
                           background: "transparent", color: P.ink2, font: `700 14px ${FONT}`, cursor: "pointer" }}>
            ביטול
          </button>
          {err && (
            <span role="alert" style={{ font: `700 12.5px ${FONT}`, color: P.danger, width: "100%" }}>
              סכום לא תקין
            </span>
          )}
        </div>
      )}
    </div>
  );
}
