import React from "react";

/* ══════════════════════════════════════════════════════════════
   BrandMark — the מסלול route mark (icon only).

   A planned route bending from an open start point to a
   destination pin. Inherits `currentColor`, so drop it into any
   coloured container (e.g. the reversed-out ink square used in the
   nav / footer lockups) and it takes that colour.

   Solid pin — no counter — so it stays crisp at the 14–20px sizes
   it's used at in-app. The large standalone asset with the pin
   counter lives at src/brand/logo-mark.svg (+ mono / pdf / jpg)
   and public/logo-mark.svg. favicon.svg is a matching simplified
   cut for 16–32px.

   Props: size (px, default 18), title (sets role=img + <title>;
   otherwise the mark is decorative). Extra props pass through.
   ══════════════════════════════════════════════════════════════ */

const BrandMark = ({ size = 18, title, ...rest }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 96 96"
    fill="none"
    role={title ? "img" : "presentation"}
    aria-label={title || undefined}
    aria-hidden={title ? undefined : true}
    {...rest}
  >
    {title ? <title>{title}</title> : null}
    <path
      d="M65 66 L65 49 Q65 41 57 41 L39 41 Q32 41 32 48 L32 56"
      stroke="currentColor"
      strokeWidth="9"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <circle cx="65" cy="66" r="8.5" stroke="currentColor" strokeWidth="7" />
    <path
      fill="currentColor"
      d="M32 59.2C24.85 45.55 19 36.06 19 28A13 13 0 1 1 45 28C45 36.06 39.15 45.55 32 59.2Z"
    />
  </svg>
);

export default BrandMark;
