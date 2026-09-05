# מסלול — brand mark

Icon-only mark. A planned route bending from an open start point (hollow
ring) to a destination pin. One colour, no gradient. Route reads
low-right → high-left.

Colour: `#E0533F` (app + marketing accent — `src/utils/theme.js`).

## Files

| File | Use |
|---|---|
| `logo-mark.svg` | Primary, full colour, with the pin counter. Large / standalone. Also copied to `public/logo-mark.svg`. |
| `logo-mark-mono.svg` | Same geometry, `currentColor`. Print, laser, single-ink, masks. |
| `logo-mark.pdf` | Vector, white page, ~165pt. Print / handoff. |
| `logo-mark.jpg` · `logo-mark-cream.jpg` | 1200px raster on white / brand cream, for slides & docs that reject SVG. |

In the React app the mark is `src/components/BrandMark.jsx` — inline SVG,
`currentColor`, solid pin (no counter) so it stays crisp at 14–20px. It
sits in the reversed-out ink square beside the “מסלול” wordmark in the
nav / footer / dashboard / gallery / legal lockups.

Favicons & app icons live in `public/`: `favicon.svg` (simplified 16–32px
cut), `favicon.ico` (16/32/48), `logo192.png`, `logo512.png`,
`apple-touch-icon.png` (on white), `icon-maskable-512.png` (white on
accent, safe area).

## Regenerating rasters

Source of truth is `logo-mark.svg` / `favicon.svg`. The PNG/ICO/PDF/JPG
exports were rendered from those with headless Chrome + `sips` (no extra
deps). Re-run the generator in the scratchpad if the geometry changes.
