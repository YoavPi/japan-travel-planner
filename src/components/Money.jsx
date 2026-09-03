import React from "react";
import { formatMoney } from "../utils/budget";

/* ══════════════════════════════════════════════════════════════
   Money — one rendered amount.

   Two things it exists to guarantee, everywhere, without each caller
   remembering them:

   • BIDI ISOLATION. "₪4,000" inside Hebrew RTL text reorders into
     nonsense without an explicit LTR island. dir="ltr" +
     unicode-bidi:isolate keeps the symbol glued to its digits.
   • TABULAR NUMERALS. Amounts stack in columns; proportional digits
     make those columns ragged. DESIGN.md already mandates this.
   ══════════════════════════════════════════════════════════════ */

export default function Money({ minor, currency = "ILS", bold = false, tone = "ink", P, style }) {
  return (
    <span
      dir="ltr"
      style={{
        unicodeBidi: "isolate",
        fontVariantNumeric: "tabular-nums",
        fontWeight: bold ? 800 : 600,
        color: P?.[tone] || "inherit",
        whiteSpace: "nowrap",
        ...style,
      }}
    >
      {formatMoney(minor, currency)}
    </span>
  );
}
