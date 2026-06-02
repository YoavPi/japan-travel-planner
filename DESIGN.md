# Design

## Theme

Two surfaces, both **warm and travel-vibey**:

- **Marketing/landing surface** (`/`, `/welcome`, `/japan`, `/map`) — earthy cream paper (`#FAF6E8 / #FDFCF7`), vermillion accent, serif-leaning Hebrew display. Reads like a printed travel companion.
- **App surface** (SaaS — Auth, Wizard, Dashboard, Profile, Editor, Settings, Notifications) — clean white/dark panels (`#FFFFFF` / `#16191D`), the same vermillion accent (`#E0533F`), single sans-serif stack. Reads like a modern travel-planning tool.

The shared accent (`#E0533F` warm coral-vermillion) is the thread that ties both surfaces.

## Color Palette

### App surface (SaaS — source of truth: `src/utils/theme.js`)

| Token | Light | Dark | Use |
|---|---|---|---|
| `page` | `#EDEDEC` | `#0E1012` | Outer body bg |
| `panel` | `#FFFFFF` | `#16191D` | Card / sheet surface |
| `surface` | `#F6F6F4` | `#1F242A` | Inset (pills, search bars) |
| `surface2` | `#EFEFEC` | `#262B31` | Deeper inset (active filter chips, role tag bg) |
| `ink` | `#0D0F11` | `#F5F6F7` | Primary text |
| `ink2` | `#2A3036` | `#C7CCD1` | Secondary text |
| `ink3` | `#6B7178` | `#8B9198` | Captions, meta |
| `ink4` | `#A4AAB1` | `#6B7178` | Disabled, hairlines |
| `line` | `rgba(20,20,20,0.08)` | `rgba(255,255,255,0.09)` | Borders, dividers |
| `accent` | `#E0533F` | `#E0533F` | Primary action, brand emphasis |
| `danger` | `#C0392B` | `#E0573F` | Destructive |

Supporting accents (city / role / chip):

- Nature green soft `#E4EFE5` · deep `#2B7B71` (the "edit" role tag, transit colors)
- Sky-blue `#4A7FB5 → #345C86` (Portugal/France/USA card thumbs)
- Amber `#C9A03F → #9C7826` (Thailand/Dubai)

> **Anti-pattern check:** no purple-to-blue gradients anywhere. Brand accent is one specific warm coral, not a sweeping spectrum.

### Marketing surface (Japan / Roadmap — source of truth: `src/index.css` `:root`)

`--paper #F7F2E6` · `--paper-2 #FDFCF7` · `--ink #1C2333` · `--vermillion #C0392B` · `--matcha #2E7D52` · `--teal #1F7A8C` · `--indigo #3F4A8C` · `--plum #6B3FA0` · `--slate #1A5276` · `--ochre #C05C1A`. City accents per chapter.

## Typography

**Single unified stack across the whole app** — deliberate choice to avoid the "Inter on everything" SaaS smell while keeping rendering quality:

```
'Noto Sans Hebrew', 'Inter', 'Noto Sans JP', system-ui, sans-serif
```

- **Hebrew** → Noto Sans Hebrew (Google).
- **Latin / numbers** → Inter (used for proper-noun place names, tabular numerals).
- **Japanese** → Noto Sans JP (rendered on the Japan example).
- **System fallback** last.

Type scale (used today, before the polish pass):

| Role | Size | Weight | Letter-spacing |
|---|---|---|---|
| Display H1 | 26–32px | 800 | -0.022em |
| Title (sheet header, card title) | 17–20px | 800 | -0.014em |
| Body | 14–14.5px | 400–600 | 0 |
| Caption / meta | 12–12.5px | 600 | 0 |
| Eyebrow | 11px | 800 uppercase | 0.06–0.08em |
| Tabular numerals | `font-variant-numeric: tabular-nums` on stats |

> **Anti-pattern check:** Inter is in the stack but Noto Sans Hebrew wins for the dominant character set. No second display font — restraint over flair.

## Radii & Shape

- `8px` micro (status pills inside cards)
- `12–14px` chip / small input
- `16–18px` row / card body
- `20–22px` large card / sheet top
- `999px` (pill) for buttons, role tags, filter chips, the floating dock

## Spacing System

8-point grid, with 4-point half-steps allowed inside chips/icons.

| Token | px |
|---|---|
| xs | 4 |
| sm | 8 |
| md | 12 |
| base | 14–16 |
| lg | 18–22 |
| xl | 28 |
| 2xl | 40 |

Section gutters: 22px page-side padding (max-width 560 / 720 panels), 14–16px row padding.

## Motion (source of truth: `src/index.css` `.tp-*`)

| Keyframe | Use |
|---|---|
| `tpFadeUp` (0.45s `cubic-bezier(.22,1,.36,1)`) | Cards, stats, summary rows |
| `tpFade` (0.4s ease) | Backdrops, screen enter |
| `tpScaleIn` (0.22s) | Popovers, menus, confirm modal |
| `tpSlideUp` (0.34s) | Bottom sheets (Add stop, Share, Stop actions) |
| `tp-card:hover` | translateY(-2px) + bigger shadow |
| `tp-press:active` | scale(0.94) |

Reduced-motion media query disables all of the above ✓.

## Components — source of truth

- `BottomDock.jsx` — floating dock (4 slots: ⚙ Settings · 🔔 Notifications · 🗺 Profile/Maps · 🏠 Home). Auto-detects active route. White / panel coloured.
- `MapCard.jsx` — illustrated thumb (gradient + landmark glyph by country), days badge, overlay share (immediate clipboard copy with ✓ feedback), role tag, collaborator avatar stack, ⋯ menu (open / share / delete). Dark-aware.
- `SideMenu.jsx` — right-anchored drawer (RTL), identity header + nav.
- `ShareSheet.jsx` — Google-Sheets-style invite-by-email + link access.
- `EditorBottomSheet.jsx` — 3-snap sheet (peek/half/full) with pointer-driven drag.
- `EditorMap.jsx` — keyless MapLibre (CARTO Positron). Hover-ghost + placed pin in pin mode.
- `EditorSearchBar.jsx` — top-of-map persistent search bar (Google Places when API key present, free-text quick-add otherwise).
- `OnboardingView.jsx` — 5-step full-screen photo walkthrough, first-visit gated by `tp_onboarded_v1` localStorage flag.

## Layout

- **Outer canvas:** `min-h-100vh` `dir="rtl"` body. SaaS screens center a max-width `560px` (mobile-first; flows fine wider).
- **Top bar:** ~56px tall, sticky on Settings/Profile, in-flow on Dashboard.
- **Floating dock:** 16–18px from bottom edge. Screens reserve `padding-bottom: 96px` to avoid overlap.
- **Editor:** map fills the viewport, bottom sheet sits over it; the top of the map has a 48px search bar at `top: 64px`.

## Patterns to keep

- **Logical inline properties** (`insetInlineStart`, `marginInlineEnd`) throughout — no `left/right` literals.
- **Single Maps-URL resolver** (`utils/mapsUrl.js`) — every Google Maps link goes through it. This was a hard-won lesson; don't fork it.
- **Single dark-mode hook** (`utils/theme.js useDarkMode`) — broadcasts across screens. No per-screen palette duplication.

## Patterns to avoid

- Stop building bespoke palettes per view. Always import from `utils/theme.js`.
- No bouncy / spring easings. We're not iOS-app-y. Pick `cubic-bezier(0.22, 1, 0.36, 1)` for arrival, `ease` for fade.
- No purple, no blue gradients. Brand accent is `#E0533F`, full stop.
- Emoji as functional iconography is a **temporary** state. Migrate to consistent SVG icons (next pass).
- Cards inside cards inside sheets. If a card needs internal grouping, use a hairline (`border-top: 1px solid var(--line)`), not a nested card.
