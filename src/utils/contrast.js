/* ══════════════════════════════════════════════════════════════
   contrast.js — WCAG relative luminance + readable-foreground pick.

   Why this exists: a user-chosen colour can be stamped onto a stop
   (`_theme`), and the two pickers that write it disagree on range —
   `StopActionsSheet`'s PASTELS are very light (`#EBCB93`), while the
   long-press THEMES run mid-tone to near-black (`#0D0F11`). Any
   surface painted with that colour therefore cannot hard-code a white
   foreground: white on `#EBCB93` is 1.55:1.

   Pure functions, no React, no tokens — safe to import anywhere.
   ══════════════════════════════════════════════════════════════ */

/* #RGB / #RRGGBB → [r,g,b] 0-255. Returns null for anything else
   (named colours, rgb(), gradients) so callers can fall back. */
export const hexToRgb = (hex) => {
  if (typeof hex !== "string") return null;
  const h = hex.trim().replace(/^#/, "");
  if (h.length === 3 && /^[0-9a-f]{3}$/i.test(h)) {
    return [h[0], h[1], h[2]].map((c) => parseInt(c + c, 16));
  }
  if (h.length === 6 && /^[0-9a-f]{6}$/i.test(h)) {
    return [h.slice(0, 2), h.slice(2, 4), h.slice(4, 6)].map((c) => parseInt(c, 16));
  }
  return null;
};

/* WCAG 2.x relative luminance. */
export const relativeLuminance = (hex) => {
  const rgb = hexToRgb(hex);
  if (!rgb) return null;
  const [r, g, b] = rgb.map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};

/* WCAG contrast ratio between two hex colours, 1–21. */
export const contrastRatio = (a, b) => {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  if (la == null || lb == null) return null;
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
};

/* Foreground that reads best on `bg`. Picks whichever of `light`/`dark`
   scores higher, so it degrades sensibly instead of guessing. Unparseable
   input falls back to `light` — matching the previous hard-coded "#fff". */
export const readableInkOn = (bg, light = "#FFFFFF", dark = "#14181C") => {
  const cl = contrastRatio(bg, light);
  const cd = contrastRatio(bg, dark);
  if (cl == null || cd == null) return light;
  return cd > cl ? dark : light;
};
