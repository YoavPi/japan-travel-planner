# Homepage redesign — "לאן נוסעים?"

**Date:** 2026-09-06
**Status:** Draft — pending owner decisions (§11). No code written.
**Branch:** `saas-builder-local`
**Roadmap:** [docs/ROADMAP.md](../../ROADMAP.md) → 💡 רעיונות **#9** ("עיצוב מחדש של עמוד הבית בסגנון MupDay — hero+חיפוש+דמו חי+phone mockup")
**Surface:** public marketing (`/` only). `/japan`, `/gallery`, `/map` are out of scope.
**Owner agents:** `landing-designer` (this doc) · `builder` (implementation) · `copywriter` (final Hebrew) · `growth` (funnel events, SEO/meta) · `design-systems` (marketing tokens, dark pair) · `qa` (RTL/a11y/contrast/perf)

> **On "MupDay":** I do not have access to MupDay and did not look at it. Everything below
> treats it as a *directional cue only*, exactly as the task framed it: bold hero, an input as
> the primary CTA, a device mockup, a live product moment, honest proof. Nothing in this spec
> claims to reproduce MupDay's actual layout, palette, or copy. Where I say "MupDay-style" I
> mean "the modern travel-app landing convention", and I am inferring, not copying.

---

## Scope

The homepage's job, per [CLAUDE.md](../../../CLAUDE.md) "Core of the product", is to lead a
**logged-out visitor** into `/dashboard` → `/create` → `/map/edit` → `/trip/overview`. It supports
the core; it must not compete with it.

Today it does neither well. It offers a visitor **five** competing calls to action above the
fold, **three of which resolve to the same URL**, shows zero evidence that the product works,
and ships ~90 lines of unreachable dead code. This spec replaces `/` with a six-fold scroll
built around a single primary action: **choosing a destination**.

Constraints that shape every decision below:

| Constraint | Source | Consequence in this spec |
|---|---|---|
| Zero external API keys on the public surface | CLAUDE.md "What must not break" | The hero search matches **bundled local data**, never Google Places. The demo map is MapLibre + CARTO Positron (already keyless). |
| Hebrew-first, RTL-native, logical properties only | DESIGN.md, PRODUCT.md #2 | No `left`/`right` literals. Route artwork mirrors by path data, not `scaleX(-1)`. |
| WCAG 2.2 AA, 44×44 targets | PRODUCT.md | §8 gives measured ratios for every pair. Several current pairs fail; listed in §0. |
| Dark mode via a shared hook | DESIGN.md "Patterns to keep" | §8.4 specifies a **warm** marketing dark palette, not the app's cool one. |
| Photography is the hero | PRODUCT.md Design Principle #1 | The hero is a real owned photograph, not type over a texture. |
| Don't fork `mapsUrl` / `useDarkMode` / the auth-preserving deep-link | DESIGN.md, this doc §4.3 | The hero search reuses `SiteFooter.startTrip`'s exact mechanism, extracted to one module. |

**Not in scope:** auth logic, RLS, DB schema, routes (no new route is added), the wizard's
internal steps, SEO/meta/schema.org (that is `growth`'s item, noted in §12), i18n (ROADMAP
"הבא בתור" explicitly defers he/en switching).

---

## 0. Teardown of what ships today

Two files, `src/views/LandingView.jsx` (mobile, 526 lines) and `src/views/LandingDesktop.jsx`
(desktop, 193 lines), branched at `LandingView.jsx:178` on `useIsDesktop()`.

### 0.1 Fold by fold

| Fold | What's there | Evidence | Problem |
|---|---|---|---|
| Nav | Brand lockup + a greeting + one button | `LandingView.jsx:187-210`, `LandingDesktop.jsx:68-88` | Desktop nav is a **separate implementation** of the same lockup. Mobile hides the wordmark entirely (`isDesktop &&` at :194), so the mobile homepage never shows the brand name. |
| Hero | Uppercase tracked eyebrow, mixed-weight 300/800 headline, subhead, **4 buttons**, atmospheric photo at `opacity: 0.12` behind a scrim | `LandingView.jsx:213-326`, `LandingDesktop.jsx:91-133` | See §0.2. |
| Section A | "מתכננים על מפה חיה" eyebrow + a card wrapping `HeroRouteAnimation` | `LandingView.jsx:329-348` | A stylised fake route captioned **"מסלול חי"** (`HeroRouteAnimation.jsx:203`). The product has a real live map and shows a drawing of one instead. Desktop drops this section entirely, so the two breakpoints tell different stories. |
| Section B | 3 identical cards: emoji + heading + one line | `LandingView.jsx:351-367`; desktop version at `LandingDesktop.jsx:142-150` adds **54×54 rounded icon tiles** above each heading | Identical card grid + rounded icon tiles above every heading. Both are named bans. `PILLARS` is declared twice with **different content** (`LandingView.jsx:76-80` vs `LandingDesktop.jsx:33-37`), so mobile and desktop claim different features. |
| Section C | 6 destination cards, photo under a `mix-blend-multiply` gradient shroud at `opacity:0.72` with a 52px emoji glyph on top | `LandingView.jsx:379-405`, `LandingDesktop.jsx:159-171` | The multiply shroud is deliberately destroying the photography that Design Principle #1 calls the hero. The 52px 🕌/🗼/⛩️ centre glyph is "sticker-emoji as primary art", a PRODUCT.md anti-reference. |
| Closing | An outlined banner button | `LandingView.jsx:409-425`; desktop is a full ink band at `LandingDesktop.jsx:175-184` | Fine in principle. Different on each breakpoint. |
| Footer | `SiteFooter` | `SiteFooter.jsx` | Genuinely good. Keep. See §10. |

### 0.2 The hero has five CTAs and no primary action

Guest, mobile, above the fold:

| # | Label | Handler | Destination for a guest |
|---|---|---|---|
| 1 | התחברות | `LandingView.jsx:205` | `/auth` |
| 2 | התחילו לתכנן בחינם | `LandingView.jsx:283` | **`/auth`** |
| 3 | צפו בטיול לדוגמה (יפן) | `LandingView.jsx:292` | `/japan` |
| 4 | מפות של אחרים | `LandingView.jsx:300` | `/gallery` |
| 5 | בנה לי מסלול אוטומטי (AI) 🪄 | `openAi`, `LandingView.jsx:121-122` | **`/auth`** |

Three of five resolve to `/auth`. That is one action wearing three costumes, and the visual
weight is spread evenly enough (48px pills, `flex: 1 1 200px`) that nothing reads as primary.
Desktop is the same five at `LandingDesktop.jsx:107-131`.

### 0.3 Bans currently tripped

- **Uppercase tracked eyebrow on every section.** `LandingView.jsx:233` (hero, `letterSpacing: 0.14em`), `:330` (Section A), `LandingDesktop.jsx:93` (hero, `0.16em`), `:138` (features). `text-transform: uppercase` on `פלטפורמת תכנון טיולים` is a **visual no-op in Hebrew** — the property does nothing to Hebrew glyphs. Its presence proves the pattern was pasted from a Latin template rather than designed.
- **Identical card grid.** `LandingView.jsx:358-366`, `LandingDesktop.jsx:142-150`.
- **Large rounded icon tiles above every heading.** `LandingDesktop.jsx:145` (54×54, `borderRadius: 15`).
- **Glassmorphism as default nav.** `backdropFilter: blur(20px) saturate(180%)` at `LandingView.jsx:190` and `LandingDesktop.jsx:68`.
- **Emoji as functional iconography.** `PILLARS` 📍📱🤝🗺️, `INSPO` 🕌🗼⛩️🏺🏛️🛕, the 🪄 wand, the ⚡ in the live-trip block, the 🇮🇱 in the footer. DESIGN.md already flags emoji-as-icon as "a **temporary** state" to be migrated to `Icon.jsx`.
- **A decorative infinite animation with no purpose.** `.lv-glow` keyframes are declared at `LandingView.jsx:142-146` and applied to nothing. `.lv-sparkle` (`:162-166`) makes the wand pulse forever.

### 0.4 The marketing palette is ignored

DESIGN.md defines a marketing surface: `--paper #F7F2E6`, `--paper-2 #FDFCF7`, `--ink #1C2333`,
`--vermillion #C0392B`, plus city accents — all live in `src/index.css:20-33`. The landing pages
use **none of them**. Instead each file hard-codes a local copy of the *app* palette:
`LandingView.jsx:26-39`, `LandingDesktop.jsx:17-22`, `SiteFooter.jsx:18-22`. Three copies, three
files, and `T.page` differs between them (`#EDEDEC` vs `#F4F3F1`).

There is also no dark mode at all. Every other product surface themes via `useDarkMode()`
(`src/utils/theme.js:34`). A visitor with dark mode on gets a white flash on the front door and
a dark app one click later.

### 0.5 Contrast failures, measured

Computed against the exact hex values in the files today:

| Text | On | Ratio | Verdict |
|---|---|---|---|
| `#E0533F` eyebrow, 12.5px (`LandingView.jsx:233`) | `#FFFFFF` | **3.83:1** | **Fails** AA (needs 4.5:1) |
| `#E0533F` eyebrow, 13px (`LandingDesktop.jsx:93,138`) | `#FFFFFF` | **3.83:1** | **Fails** |
| `#FFFFFF` on `#E0533F` button, 14.5px/800 (`LandingView.jsx:273`) | `#E0533F` | **3.83:1** | **Fails** (16px bold is not "large text"; the threshold is 18.66px bold) |
| `#FFFFFF` on `#E0533F` button, 16.5px/800 (`LandingDesktop.jsx:180`) | `#E0533F` | **3.83:1** | **Fails** |
| `#A4AAB1` copyright, 13px (`SiteFooter.jsx:107`) | `#FFFFFF` | **2.34:1** | **Fails badly** |
| `#6B7178` body (`LandingView.jsx:363`) | `#FFFFFF` | 4.93:1 | Passes |
| `rgba(255,255,255,0.7)` (`LandingDesktop.jsx:178`) | `#0D0F11` | 9.56:1 | Passes |

The vermillion problem is systemic, not incidental: **`#E0533F` can never carry normal-size
text or white text.** §8.3 fixes this with a documented two-vermillion rule.

### 0.6 Dead code found

1. **The AI waitlist modal is unreachable.** `aiOpen` is initialised `false` at `LandingView.jsx:107` and the only writer is `closeAi = () => setAiOpen(false)` at `:124`. `setAiOpen(true)` **appears nowhere in the repo.** The gated block at `:435-519` (89 lines: portal, backdrop, email input, regex validation, success state) can never render. `aiEmail`, `aiDone`, `submitAi`, `closeAi` are all dead with it.
2. **`tp_metrics_ai_waitlist` is written and never read.** `LandingView.jsx:129-132` is the only reference in `src/` and `api/`. Same for `tp_metrics_ai_clicks` (`:117-118`) — written on every AI click, read by nothing. These were a fake-door experiment; the code comment at `:111` says the feature shipped in Sprint 67+.
3. **The entire active-trip branch is effectively unreachable on `/`.** `LandingGate` (`App.jsx:44-52`) redirects *every* authenticated user away from `/` (to `/dashboard` or `/welcome`). Only guests render `LandingView`, and a guest never has an active trip. So `useActiveTrip`, the `tripService.fetchTripById` effect (`LandingView.jsx:91-99`), `activeRoute`, and both `activeId ?` branches (`:250-278`, `:411-421`, `LandingDesktop.jsx:108-112`) are dormant on the homepage. They only fire through the `path="*"` catch-all at `App.jsx:170`, i.e. a signed-in user who typed a bad URL. **Do not delete the behaviour** (the catch-all needs it) — but it must stop dictating the design of the primary hero. See §10.
4. **`.lv-glow`** keyframes + class (`LandingView.jsx:142-146`) applied to no element.
5. **Duplicated constants across the two files** with drift: `T` (×2, different `page`), `UNSPLASH` (×2, different `w=`), `INSPO` (×2, identical), `PILLARS` (×2, **different content**), `ArrowL` (×2, different default size). Any spec that keeps two view files deepens this. §2.0 does not.

### 0.7 One thing that is right

All seven Unsplash IDs currently referenced **resolve** (verified `200 OK`, 2026-09-06). The
photography choices are fine; only the treatment is wrong. Keep the IDs.

---

## 1. Strategy

### 1.1 The one-sentence scene

**A cream page with a real photograph of two people who actually took the trip, a single question
in a field wide enough to be the whole point, and a vermillion route line that runs down the
right margin of the entire scroll, stopping at each fold like it stops at each city.**

### 1.2 The inverse test

A competitor would describe theirs as: *"A clean, modern landing page with a bold hero, feature
cards, popular destinations, and a free-trial CTA."* That sentence describes the page shipping
today, almost line for line. It does not describe the page above.

### 1.3 Color strategy: **Committed**, art-directed per fold

Named anchor references, and precisely what each contributes:

| Reference | What I take | What I reject |
|---|---|---|
| **The `#E0533F` maskable app-icon tile in `src/brand/showcase.png`** (internal, real) | A full-viewport vermillion field is *already* part of this brand's asset set. Fold 3 scales that tile to the width of the page. | Nothing. This is the anchor. |
| **Mapbox's marketing site, 2019–2021 era** | Let the real map be a full-bleed canvas with product chrome floating on it, instead of illustrating a map. | Its cool grey/blue tech palette. |
| **Hopper's saturated single-hue folds, 2018–2020 web** | Fold-level color commitment: each fold owns one ground, no neutral hedging at the edges. | Its density and its rounded-everything cheer. |

**Fold rhythm:** photograph → warm black → paper → **vermillion drench** → paper-2 → warm black.
Not alternating white and grey bands (which is what `LandingDesktop.jsx` does today via
`T.bg` / `T.page`).

The drench is Fold 3 (proof) on purpose: the one fold where the page stops selling and shows the
receipts is the one that is unmistakably branded.

### 1.4 The lane I am deliberately NOT taking

**Editorial-typographic.** Display serif + tracked micro-labels + ruled separators + monochrome
restraint. The current page is already drifting there: the file header calls itself "Premium
magazine-style redesign … oversized editorial hero with mixed-weight typography"
(`LandingView.jsx:16-19`), and the 300/800 weight-contrast headline is that lane's signature move.
This is a travel product, not a magazine. Concretely, this spec bans on `/`: italic display type,
drop caps, three-column ruled grids, tracked lowercase metadata, and mixed-weight-in-one-headline.

Also not taken: **generic SaaS template** (no 3-up icon-tile grid — Fold 4 is deliberately
asymmetric), and **plain travel-blog WordPress** (no narrow body column, no generic stock hero;
the hero photo is an owned image of the actual founders).

### 1.5 The structural idea: the route seam

The brand mark (`src/brand/README.md`) is *"a planned route bending from an open start point to a
destination pin."* The product is a route. The name is מסלול.

So the page's spine is one continuous vermillion route running down the **inline-start margin**
(the right edge in RTL), entering at the hero and terminating in a pin at the closing fold. It is
built as five `<RouteSeam />` segments, one in each gap between folds. Each seam is a small SVG
(~72×112) with one bend, one pin, and a `stroke-dashoffset` draw.

Why this and not a decorative divider:
- It is an amplification of an asset the brand already owns, so it cannot read as generic.
- It is RTL-native by construction: the journey starts on the right, matching the deliberate choice already made in `HeroRouteAnimation.jsx:27-29`.
- It is cheap and robust: no document-height measurement, no scroll-linked layout thrash, and it survives folds whose height depends on fetched data (the gallery strip).

### 1.6 Typography

**Display:** `Noto Serif Hebrew` 700/800.
**Everything else:** the existing stack, `'Noto Sans Hebrew','Inter','Noto Sans JP',system-ui`.

Justification, since a display serif is close to a lane I just rejected:

1. DESIGN.md already commits this surface to *"serif-leaning Hebrew display"* for the marketing palette. Identity preservation wins over greenfield reflex.
2. `Noto Serif Hebrew:wght@300..800` is **already in the Google Fonts import** at `src/index.css:14`. Zero added network cost. It is currently downloaded and unused.
3. It creates the marketing-vs-app distinction DESIGN.md asks for and the current landing ignores entirely.
4. It is used for **mass and warmth only**: upright, heavy, tightly stacked. No italic, no drop caps, no small caps. That is what separates it from the editorial lane.

**Hebrew tracking judgment.** The current page sets `-0.035em` at 60px (`LandingView.jsx:238`) and
`-0.04em` at up to 92px (`LandingDesktop.jsx:96`). At those sizes Hebrew counters (ם ס ט ב) start
to collide; Hebrew wants looser tracking than Latin at the same optical size. Spec:

| Role | Size | Family / weight | letter-spacing | line-height |
|---|---|---|---|---|
| Hero H1 | `clamp(38px, 9.5vw, 76px)` | Serif 800 | **`-0.015em`** | 1.06 |
| Fold H2 | `clamp(28px, 5.5vw, 48px)` | Serif 700 | **`-0.01em`** | 1.12 |
| Lede | `clamp(16.5px, 4.2vw, 20px)` | Sans 400 | `0` | 1.62 |
| Body | 15.5–16px | Sans 400 | `0` | 1.65 |
| Card title | 17–19px | Sans 700 | `-0.005em` | 1.3 |
| Meta / caption | 13px | Sans 600 | `0` | 1.45 |
| Numerals in the stat row | 32–52px | Sans 800, `font-variant-numeric: tabular-nums` | `-0.01em` | 1 |

Scale ratio between steps is ≥1.25 at every breakpoint. **No eyebrow role exists.** It is removed
from the type scale for this surface so it cannot come back by habit.

**Overflow test (mandatory, `qa`):** the longest H1 line is `כל הטיול שלכם.` Verify at 320px,
360px, 390px, 414px, 768px, 1024px, 1280px, 1440px, 1920px, and at browser text-zoom 200%. The H1
container must be `max-inline-size` bounded and must not use `white-space: nowrap`. Note that
`LandingView.jsx:266` currently sets `whiteSpace: "nowrap"` + `textOverflow: "ellipsis"` on a
user-supplied trip title — that pattern must not be copied into any headline.

---

## 2. Fold-by-fold spec

### 2.0 Component structure (and the duplication this kills)

**One view file.** `src/views/LandingView.jsx` becomes a thin composition:

```
LandingView
  ├── LandingNav
  ├── HeroFold          (fold 0)
  ├── RouteSeam bend="a"
  ├── DemoFold          (fold 1)
  ├── RouteSeam bend="b"
  ├── FieldFold         (fold 2)
  ├── RouteSeam bend="c"
  ├── ProofFold         (fold 3)
  ├── RouteSeam bend="d"
  ├── ObjectionFold     (fold 4)
  ├── RouteSeam bend="e"
  ├── ClosingFold       (fold 5)
  └── SiteFooter
```

New files under `src/components/landing/`. **`src/views/LandingDesktop.jsx` is deleted.**

Every fold is internally responsive via CSS (media queries in one scoped `<style>` per fold, or
`grid-template-columns: repeat(auto-fit, minmax(…, 1fr))` where a grid genuinely fits).
`useIsDesktop()` is **not** used on this route. The single place that needs different *art* per
breakpoint (§6) uses `<picture><source media>`, which is zero JS.

Shared constants (`DESTINATION_CHIPS`, the marketing palette, `ArrowInline`) live in exactly one
module each. This directly retires finding §0.6.5.

> **Duplication guard for `builder`:** if implementation pressure pushes toward a second
> `*Desktop.jsx` file for this route, stop and escalate. The whole point of this structure is
> that mobile and desktop stop telling different stories (today they ship different `PILLARS`,
> and Section A exists only on mobile).

---

### 2.1 Nav

**Mobile.** 56px tall, in flow (not sticky — it must not eat the hero photo). Inline-start: the
brand lockup, `BrandMark size={16}` in the reversed ink square + `מסלול` at 17px/800. Inline-end:
one text button, `התחברות`, 44×44 minimum hit area.

That is a change: **the mobile homepage currently never renders the wordmark** (`LandingView.jsx:194`
gates it behind `isDesktop`). The front door should say its own name.

Over the photo, the lockup is cream on the scrim; contrast verified in §8.5.

**Desktop.** Same lockup at inline-start, 68px tall, in flow. Inline-end: `מפות של אחרים`
(`/gallery`), `טיול לדוגמה` (`/japan`), then `התחברות` (`/auth`). No `backdrop-filter`, no sticky
frosted bar — §0.3 ban. If a persistent CTA on long scroll is wanted, §11 Q4 raises it as a
decision rather than assuming it.

**Single action this fold drives:** none. Nav is orientation, not conversion.

---

### 2.2 Fold 0 — Hook. The question.

**Job:** get a destination out of the visitor before they have decided whether to trust us.

#### Mobile composition (primary)

```
┌─────────────────────────────┐
│ [◧ מסלול]        התחברות    │  nav, 56px
├─────────────────────────────┤
│                             │
│      hero photograph        │  full-bleed, ~46svh
│      (Fuji + the couple)    │  object-position: 70% 40%
│                             │
│   כל הטיול שלכם.            │  H1, cream, on the dense
│   על מפה אחת.               │  part of the scrim
│                             │
│  ┌───────────────────────┐  │  ← the search field straddles
│  │ 🔎  לאן נוסעים?       │  │     the photo's lower edge:
│  └───────────────────────┘  │     ~55% on photo, 45% on paper
│                             │
│  יפן  איטליה  תאילנד  …     │  chips, RTL h-scroll
│                             │
│  בונים מסלול יום אחר יום…   │  lede, on paper
│  בחינם, בלי כרטיס אשראי.    │  micro
└─────────────────────────────┘
```

The **field breaking the photo edge** is the fold's one compositional move. It is what makes the
input read as the subject of the page rather than a widget below a headline. Implementation: the
photo block and the paper block are siblings; the field sits in a `position: relative` wrapper
with a negative `margin-block-start` equal to ~52% of the field height, `z-index: 2`, and a
`0 10px 30px rgba(28,35,51,0.18)` shadow so it lifts off both grounds.

Height is **content-driven, not `100vh`.** A locked full-viewport hero on a 360×640 Android with
Hebrew at 200% zoom clips. The chips row should be partly visible at rest as the scroll affordance.

#### Desktop composition (expansion, ≥1024px)

Two columns, `grid-template-columns: 46fr 54fr`. **Inline-start (right, in RTL) = the photograph**,
full-bleed to the viewport edge, `min-block-size: 78svh`, with a soft fade into the paper at its
inline-end edge. **Inline-end = the type + field**, on paper, `max-inline-size: 620px`.

Putting the photo at the inline-start mirrors `/japan`'s existing hero (`HomePage.jsx:244-266`),
which gives the two public pages a family resemblance for free. Note `/japan` uses
`className="hidden lg:block"` + a fixed `left` gradient; the new fold must use logical properties.

Above 1600px the photo column stops growing at `46vw` and the type column centres in its track,
so the H1 never drifts to the far edge of an ultrawide.

#### Imagery

**`/public/photos/home/hero_couple_fuji.png`** — the founders, in front of Fuji, on the actual
trip the product was built from. Real people, real place, owned outright.

This is a deliberate rejection of stock. The current hero uses Unsplash
`photo-1469854523086-cc02fe5d8800` at `opacity: 0.12` behind a blur and a scrim
(`LandingView.jsx:73, 218-227`) — a generic aerial that is simultaneously the "generic stock travel
photo" anti-reference *and* invisible. Replacing it with an owned photograph of the two people who
wrote the 155 recommendations is the single highest-leverage change on the page.

**Alt text (voice, not description):**
`יואב ומיכלי מול הר פוג'י, במסלול שממנו נולד מסלול.`

**Crop guidance.** The source is 1026×1848 portrait. Mobile uses it near-native. Desktop needs the
couple at the inline-start third with Fuji and the lake filling the rest; `object-position` around
`70% 40%` in RTL terms. If that crop does not hold at 46vw, a re-crop from the original is a
`builder` task, not a reason to substitute stock.

**Performance (blocking).** The file is **2.2 MB PNG**. As the LCP element on a Hebrew
mobile-heavy audience that is unacceptable. Required before ship:

- Derivatives at 640 / 960 / 1440 / 1920 wide, AVIF + WebP + JPEG fallback, via `<picture>` + `srcset`.
- `fetchpriority="high"`, `decoding="async"`, explicit `width`/`height` (CLS).
- Budget: ≤ 120 KB for the 640w AVIF, ≤ 260 KB for the 1440w AVIF.
- Generator: a `scripts/build-landing-assets.mjs` using `sips` + `cwebp`/`avifenc`, following the existing "headless Chrome + `sips`, no extra deps" precedent documented in `src/brand/README.md`.

#### Copy slots

| Slot | Intent | Draft Hebrew (for `copywriter` to refine) |
|---|---|---|
| H1 | The whole promise in two beats. No verb-imperative, no "your next trip". | `כל הטיול שלכם.` / `על מפה אחת.` |
| Field label (`sr-only`) | Programmatic name | `חיפוש יעד` |
| Field placeholder | **The primary CTA, phrased as a question** | `לאן נוסעים?` |
| Submit | Short, warm, plural | `בואו נתחיל` |
| Chips group label (`sr-only`) | | `יעדים פופולריים` |
| Lede | Concrete mechanics + the on-the-ground differentiator | `בונים מסלול יום אחר יום, מוסיפים מקומות אמיתיים מהמפה, ויוצאים לדרך עם משהו שאפשר לפתוח באמצע הרחוב.` |
| Micro | Remove the price objection immediately | `בחינם, בלי כרטיס אשראי.` |

No eyebrow. No secondary button. No AI pill.

**Single action:** pick a destination.

---

### 2.3 Fold 1 — Show the thing working. The live demo.

**Ground:** warm black `#14110E`, full-bleed. A map reads best on dark, and the tonal drop after
the cream hero is the strongest pacing beat on the page.

**Job:** prove, in the first scroll, that this is a working product with real content in it. Not a
feature list about a map — a map.

#### Composition

**Mobile:** stacked.
1. H2 + lede.
2. A horizontal, RTL, snap-scrolling **day rail**: 31 chips reading `יום 1 · טוקיו` … `יום 31 · טוקיו` (`title` and `cityHe` straight out of `src/data/tripData.js`). Default `יום 1`.
3. The **live map**, `aspect-ratio: 4/5`, radius 20, showing that day's stops as numbered vermillion pins with the route drawn between them.
4. Below it, the selected day's stops as 2–3 real cards: the photo from `/photos/source/`, `nameHe`, category, and the `rating` where one exists (`9/10`, `10/10` — these are real, hand-written, and they are the most convincing thing on the entire page).
5. One secondary link out.

**Desktop:** `grid-template-columns: 58fr 42fr`. Map on the inline-start (larger), day rail as a
vertical scroller plus the stop cards on the inline-end. Same components, different track
directions.

#### Mechanism — see §5 for the full detail

Short version: **not an iframe.** A real MapLibre instance rendered inline from the same bundled
`tripData` the demo uses, lazily mounted on intersection, with every stop deep-linking to the
already-supported `/map?demo=1&day=N`.

#### Copy slots

| Slot | Intent | Draft |
|---|---|---|
| H2 | Name the thing the visitor is about to distrust, then defeat it | `זה לא מוקאפ. זה מסלול אמיתי.` |
| Lede | Real numbers, stated plainly, plus an instruction | `31 ימים ביפן, 155 עצירות, כל אחת עם המלצה שנכתבה בשטח. בחרו יום ותראו מה קורה על המפה.` |
| Secondary CTA | | `לפתוח את המסלול המלא` → `/map?demo=1` |

**Single action:** play with the demo (and, for the small fraction who want more, open it fully).
This fold does not ask for signup. Interrupting a working demo with a signup button is the
fastest way to make it feel like bait.

---

### 2.4 Fold 2 — Why it's different. In the field.

**Ground:** paper `#F7F2E6`.

**Job:** state the actual differentiator against a Google Sheet — the plan survives contact with
the street.

#### Composition

**Mobile:** the screenshot **bleeds off the inline-start edge, unframed**, at ~112% of the
container width, so the app's own UI reads at slightly larger than life size. Type sits above it.
Three short claim lines below, as plain type with a vermillion route tick before each — not cards,
not icon tiles.

**Desktop:** `grid-template-columns: 44fr 56fr`. The **phone mockup** (a real device frame) sits
on the inline-start, cropped by the fold's edge so it feels like an object in the room rather than
a floating asset. Type on the inline-end.

The mobile-redundancy question is answered directly in **§6**.

#### Copy slots

| Slot | Intent | Draft |
|---|---|---|
| H2 | | `התכנון נגמר בבית. המסלול ממשיך איתכם.` |
| Body | Three concrete, verifiable mechanics | `לכל עצירה יש כפתור אחד ל־Google Maps, זמן הליכה או נסיעה לעצירה הבאה, והערות שכתבתם לעצמכם לפני שיצאתם.` |
| Claim 1 | | `כפתור אחד פותח את המקום ב־Google Maps.` |
| Claim 2 | | `זמני הליכה ותחבורה בין עצירות, מחושבים אוטומטית.` |
| Claim 3 | | `הערות, תמונות וקבצים יושבים על העצירה עצמה.` |
| Screenshot caption | Honesty label on the asset | `העורך של מסלול. טוקיו, יום 5.` |

**Single action:** none. This fold sells and gets out of the way.

---

### 2.5 Fold 3 — Proof. The vermillion drench.

**Ground:** `#C0392B` full-bleed (`#A8321F` in dark mode). Cream type. This is the fold that
carries the brand.

**Job:** every claim so far, backed by an artifact the visitor can click.

#### Composition

**Mobile:** stacked in three beats.
1. **The origin note**, first person, set in the serif display at H2 size, with the founders' names. It links to `/japan`.
2. **The stat row** — four real numbers in tabular numerals, separated by `·`, wrapping to 2×2 on narrow. `31 ימים · 10 ערים · 155 עצירות · 179 תמונות`. All four are properties of an artifact that is live on this site and countable in the repo (§7). None is a usage claim.
3. **The gallery strip** — real published trips from `fetchPublicTrips({ sort: "popular", limit: 8 })`, as cream cards floating on the vermillion, horizontally scrolled.

**Desktop:** origin note and stat row share one row (`52fr 48fr`); the gallery strip runs full-bleed
beneath, edge to edge, with the last card intentionally clipped by the viewport to signal scroll.

**Type-hierarchy rule for this fold:** hierarchy comes from **weight and size only, never opacity.**
`#F7D9CF` (a tinted cream) on `#C0392B` measures 4.09:1 and fails. One cream, `#FDFCF7` (5.29:1),
for all text on this ground.

#### Copy slots

| Slot | Intent | Draft |
|---|---|---|
| Origin note | The real story. First person. This is the trust element. | `חזרנו מיפן עם 155 עצירות בגיליון אקסל, וכל מי שביקש את המסלול לא הצליח לקרוא אותו. אז בנינו את מסלול.` |
| Signature | | `יואב ומיכלי` |
| Origin link | | `לראות את המסלול המקורי` → `/japan` |
| Stat row | Four countable facts | `31 ימים` · `10 ערים` · `155 עצירות` · `179 תמונות` |
| Strip heading | | `מסלולים שאנשים פרסמו` |
| Strip link | | `לגלריה` → `/gallery` |
| Strip empty state | Honest, and turns the gap into an invitation | `עוד לא פורסמו מסלולים ציבוריים. המסלול שלכם יכול להיות הראשון.` |

The origin note is **verbatim-true** and already told on `/japan` (`HomePage.jsx:293-296`:
*"קיבלנו המון בקשות לשתף את המסלול שלנו, והחלטנו לבנות את המערכת הזאת"*). It is not a testimonial
and does not pretend to be one. See §7 for why there are no testimonials.

**Single action:** open a real trip (gallery card or `/japan`).

---

### 2.6 Fold 4 — Answer the objection.

**Ground:** paper-2 `#FDFCF7`.

**Job:** the real objection is not "is this good", it is *"I already have a Google Sheet and I do
not want another account."* Name it in the heading.

#### Composition — deliberately asymmetric

Not a 3-up or 4-up grid. Four rows on a 12-column track with **varying spans and no card
chrome**, separated by hairlines (`1px solid var(--line)`), which is what DESIGN.md prescribes
instead of nested cards:

```
row 1   ├──────── 8 cols ────────┤ ····· 4 empty
row 2   ····· 3 empty ├──── 9 cols ─────┤
row 3   ├────────── 10 cols ──────────┤ ·· 2
row 4   ····· 2 ├──────── 10 cols ────────┤   ← the "but" row, on paper-tint
```

Each row: a claim in Sans 700 at 19–22px, answer beneath in Sans 400 at 16px. **No icons. No
tiles. No cards.** On mobile all four stack full-width; the asymmetry is a desktop expansion only.

#### Copy slots

| # | Claim | Answer |
|---|---|---|
| H2 | `למה לא פשוט גיליון?` | |
| 1 | `גיליון לא יודע איפה הדברים נמצאים.` | `כל עצירה יושבת על מפה אמיתית, עם הקואורדינטות שלה.` |
| 2 | `גיליון לא יגיד לכם שזה 40 דקות ברכבת.` | `זמני הליכה ותחבורה בין עצירות מחושבים אוטומטית.` |
| 3 | `גיליון לא נפתח יפה כשאתם עומדים בצומת.` | `עצירה, תמונה, הערה, וכפתור אחד ל־Google Maps.` |
| 4 | `אבל אפשר לשתף אותו כמו גיליון.` | `הזמנה במייל, הרשאת צפייה או עריכה, בדיוק כמו Google Docs.` |
| close | `החשבון חינם. אין כרטיס אשראי.` | |

Row 4 is the turn: it concedes the sheet's one real advantage and shows we have it too. That is
where `ShareSheet` / `SharePermissionsModal` (invite by email, view/edit roles) becomes an
argument instead of a feature bullet.

**Single action:** none. This fold clears the road for Fold 5.

---

### 2.7 Fold 5 — Ask.

**Ground:** warm black `#14110E`, full-bleed. Bookends Fold 1.

**Job:** ask the question again, now that it has been earned.

#### Composition

Centred, generous, one element: H2 + the **same search component** as the hero, in its dark
variant, plus the chips. The route seam terminates here as a filled pin, geometrically matching
`BrandMark`'s pin (`BrandMark.jsx:41-44`). That is the page's full stop.

#### Copy slots

| Slot | Draft |
|---|---|
| H2 | `אז לאן נוסעים?` |
| Field | identical to the hero |
| Micro | `שלוש שאלות ויש לכם שלד מסלול.` |

The micro line is **preserved verbatim** from `LandingView.jsx:420` — it is accurate (the wizard
is destination → duration → cities) and it is the best sentence on the current page.

`לאן נוסעים?` opens the page as a placeholder and closes it as a headline. That is a deliberate
device with a single named instance, not repeated section grammar.

**Single action:** pick a destination.

---

### 2.8 Footer

`SiteFooter` unchanged structurally. Palette and one contrast fix in §10.

---

## 3. CTA hierarchy

**One primary. One secondary. Everything else demoted to nav or footer.**

| Rank | Action | Surface | Destination |
|---|---|---|---|
| **Primary** | Choose a destination | Hero field + hero chips (Fold 0); the same field + chips (Fold 5) | `/create?dest=<id>[&city=<name>]`, or `/auth` with `state.from` set to that URL for a guest |
| **Secondary** | Open the full live demo | One link, Fold 1 only | `/map?demo=1` |
| Demoted | התחברות | Nav only | `/auth` |
| Demoted | מפות של אחרים | Desktop nav + Fold 3 strip link + footer | `/gallery` |
| Demoted | טיול לדוגמה (יפן) | Desktop nav + Fold 3 origin link + footer | `/japan` |
| Demoted | Popular destinations | Footer (already there, `SiteFooter.jsx:78-81`) | `/create?dest=&city=` |
| **Removed from the page** | בנה לי מסלול אוטומטי (AI) | — | See below |

### 3.1 Collapsing the costumes

The hero chips and the hero field resolve to the same destination with a different parameter.
That is **one action in two input shapes** (type it, or tap a common one), which is legitimate —
unlike today's three buttons that resolve to a bare `/auth` with no parameter and no memory of
what the visitor wanted. Stating it explicitly, as required.

### 3.2 What happens to the AI CTA

Today the AI pill is a full-width 48px hero button (`LandingView.jsx:311-324`) that navigates a
guest to `/auth`, indistinguishable in destination from the two buttons above it. It is a fifth
competing CTA for a feature the visitor has no context for yet.

**Proposal:** the AI becomes the **fork after the destination is chosen**, not a parallel entry.
Once a destination is picked, the next screen (post-auth, on `/create` or the dashboard AI modal)
offers `בנו לי שלד אוטומטית` vs `אני בונה לבד`. The homepage mentions AI once, as a line in
Fold 4 or Fold 2, never as a button.

Net effect: **5 above-the-fold CTAs → 1.**

**This is an owner decision, not mine.** If the AI feature is a deliberate top-of-funnel hook, it
belongs in the hero and the page needs a different hierarchy. Raised as §11 Q1.

---

## 4. The search element

### 4.1 Why it is the hero and not a button

`/create` step 1 is "choose a destination". Putting that step *on the homepage* means the visitor
has already made a choice before they meet the auth wall, and the wall becomes "sign in to
continue planning יפן" instead of "sign in". It also converts the hero from an assertion into a
transaction, which is the whole point of the MupDay-style cue in ROADMAP #9.

### 4.2 Mechanism — keyless, bundled, zero network

**The hero search must never call Google Places.** Two independent reasons:

1. CLAUDE.md: the public surface must work with zero external API keys.
2. This repo already shipped a **Google Places cost-protection incident response** (ROADMAP בוצע: *"הגנת עלות Google Places (2026-08-26) — quota + budget alert + finOps guard"*). Per-keystroke autocomplete on the highest-traffic public page is exactly the cost surface that incident was about. Even *with* a key present, this field does not use it.

Data source, entirely bundled in `src/data/destinations.js`:

- `DESTINATIONS` — 10 countries, each with `id`, Hebrew `name`, English `en`, `flag`, `sub`.
- `CITY_POOL` — ~120 Hebrew city names keyed by country id.

Matching:

1. Normalise both sides: strip geresh variants (`׳ ' ’`), collapse whitespace, casefold Latin.
2. Prefix match first, then substring, over `DESTINATIONS[].name`, `DESTINATIONS[].en`, and the flattened `CITY_POOL` (each city carries its country id back).
3. Cap the list at 6. Countries sort above cities.
4. Debounce 120ms on render only; there is no request to debounce.

**Known limitation to state, not hide:** `CITY_POOL` is Hebrew-only, so Latin input (`tokyo`)
matches countries but not cities. `japan` works, `tokyo` does not. Acceptable for a Hebrew-first
audience; a `builder` follow-up could add a Latin alias map. Not `copywriter`'s problem.

**Empty state, never a dead end:** if nothing matches, show the 10 countries as a fallback grid
plus `עוד לא בנינו את היעד הזה. אפשר להתחיל ממדינה קרובה ולהוסיף עצירות ידנית.`

### 4.3 Destination handling — reuse, do not fork

`SiteFooter.jsx:44-48` already implements the exact auth-preserving deep-link:

```js
const target = `/create?dest=${d.dest}&city=${encodeURIComponent(d.city)}`;
if (isAuthenticated) navigate(target);
else navigate("/auth", { state: { from: target } });
```

`WizardView.jsx:190-199` reads `?dest` and `?city` and pre-fills. `AuthView` honours
`state.from`, which is what preserves the query string that `ProtectedRoute` would otherwise drop
(the comment at `SiteFooter.jsx:41-43` documents exactly this).

**Requirement:** extract this into a single `src/utils/startTripLink.js` and have `SiteFooter`,
the hero field, the hero chips, and the closing field all call it. There must be one
implementation, in the spirit of the `mapsUrl.js` single-resolver rule in DESIGN.md. Building a
second copy inside the landing components is a review-blocking defect.

Country pick → `?dest=<id>` only. City pick → `?dest=<countryId>&city=<encodedCityName>`.

### 4.4 Form semantics and a11y

- Real `<form>` with `onSubmit`; Enter submits to the top match.
- `<label class="sr-only" for>` — `חיפוש יעד`. A placeholder is not a label.
- Combobox pattern: `role="combobox"`, `aria-expanded`, `aria-controls`, `aria-activedescendant`; the list is `role="listbox"`, options `role="option"`. ↑/↓ move, Enter selects, Esc closes and returns focus to the input.
- `inputMode="search"`, `autoComplete="off"`, `dir="rtl"`, `enterKeyHint="go"`.
- Field height **56px** mobile / 60px desktop. Submit button ≥44×44. Chips ≥44px tall with ≥8px gaps.
- Focus ring: 2px `#C0392B` + 2px offset, visible on paper, on the photo scrim, and on warm black. `:focus-visible` only.
- The dropdown must render **above** the fold boundary and below the global `BottomDock` (z-index 40) / FAB (z-index 80). Use a local `z-index: 60` within the hero's stacking context; do not portal to `<body>` — the portal pattern at `LandingView.jsx:435` exists only because of the modal, which is being deleted.

### 4.5 The auth wall

A guest who picks יפן lands on `/auth`. Today that screen gives no sign it remembers the choice.

**Minimum change (display only, no auth logic):** `AuthView` reads the pending destination out of
`location.state.from`'s query string and shows one line above the SSO button, e.g.
`ממשיכים לתכנן: יפן`. This does not touch session, token, or ownership code. It is a
`builder` + `copywriter` task with a hard "do not touch `AuthContext` / `authService`" boundary,
given the documented SEV1 auth-identity history.

**Bigger question — whether a guest should be able to complete wizard steps 1–2 before
authenticating — is §11 Q2.** It materially changes conversion and it is not mine to decide.

---

## 5. The live demo — mechanism

### 5.1 Rejected: iframe `/map?demo=1`

Concretely why:

- It ships a second router, a second `AuthContext`, the cookie-consent banner, and the global `BottomDock` inside a box on the landing page.
- `ExploreView` is a full-viewport map + `BottomSheet` + `StoryFlow`; it has no compact mode and would need one built.
- Iframe focus order and screen-reader traversal are a genuine a11y problem on a marketing page.
- Weight: MapLibre + the 939-line `tripData` + Positron tiles, inside a frame that also boots React again.

### 5.2 Specified: `<DemoFold>` — a real, cut-down instance of the same data

| Piece | Source | Notes |
|---|---|---|
| Map | `maplibre-gl` via `react-map-gl/maplibre`, CARTO Positron `https://basemaps.cartocdn.com/gl/positron-gl-style/style.json` | Exactly what `MapComponent.jsx:9,25` already uses. **Keyless.** |
| Route + stops | `tripData`, `routePath` from `src/data/tripData.js` | The same bundled export `ExploreView` falls back to (`ExploreView.jsx:19`). Never a Supabase read. |
| Day rail | `tripData[].day`, `.title`, `.cityHe` | 31 real days |
| Stop cards | `attractions[].nameHe`, `.category`, `.rating`, `.desc` + `STOP_PHOTO` → `/photos/source/*.jpg` | Real photos, real ratings |
| Stop tap | `navigate('/map?demo=1&day=' + day)` | **`?day=` is already supported** (`ExploreView.jsx:101`). No new route, no new param. |

### 5.3 Performance guards (blocking)

1. **Lazy mount.** The map component is `React.lazy` + mounted only when an `IntersectionObserver` fires with `rootMargin: "300px 0px"`. Before that, the slot renders a static poster image of the same map at the same aspect ratio, so there is no layout shift and no MapLibre on the critical path. **The hero photo must remain the LCP element.**
2. **One MapLibre instance per page.** This is why the hero is a photograph and not a live map — two GL canvases on a mid-range Android is a real jank source. If a future revision wants a live map in the hero, the demo fold's map has to become a poster.
3. **Stop photos.** `/public/photos/source/` is **249 MB across 179 files, 700 KB–1.1 MB each.** Serving them raw into a landing-page card is disqualifying. Required: a derivative set at 320w/640w AVIF+WebP under `/public/photos/landing/`, generated by the same `scripts/build-landing-assets.mjs`. Budget ≤ 45 KB per card at 640w.
4. `prefers-reduced-data` (where supported) and Save-Data → skip the GL mount entirely, keep the poster.

### 5.4 Interaction rules

- Day change flies the camera using MapLibre's default easing. **Do not pass `essential: true`** — the default already means the animation is skipped under `prefers-reduced-motion`, which is the behaviour we want for free.
- The map does **not** autopan, autoplay, or animate on scroll. A map that moves by itself behind a scrolling page is a motion-sickness trigger and cannot be reduced-motion-guarded away, because the movement *is* the content.
- Map has `role="application"` + `aria-label="מפת המסלול לדוגמה ביפן"`. Every stop is also reachable as a real focusable card in the list below, so the map is never the only path to the content.
- Scroll-jacking on the map container: `touch-action` and `dragPan` must not trap a mobile scroll. Standard fix: `cooperativeGestures`-style guard, or disable `dragPan` on touch and let taps on the pins do the work.

---

## 6. The phone mockup

### 6.1 What it shows

A real capture of **`/map/edit/:tripId`** — the authenticated editor, on the founders' real Japan
trip: Tokyo tiles, the coral route, numbered pins, the day rail with photo cards and walk/transit
chips. Not an illustration, not a redrawn UI.

`promo/STORYBOARD.md` already documents the capture recipe and the trap:

> Puppeteer emulates `prefers-reduced-motion: reduce` by default, and the editor hides its loading
> overlay on `animationend`. Under reduced motion the animation is skipped, `animationend` never
> fires, and the overlay never unmounts. Fix:
> `page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'no-preference' }])`.

**No such asset is committed today.** Producing it is a prerequisite, not a detail — §7 lists it
as the one genuinely missing artifact.

**Privacy:** frame out the email, per the locked decision in `promo/STORYBOARD.md`
("Identity: show the real founder profile … Email always framed out").

**Alt text:** `העורך של מסלול: יום 5 בטוקיו, חמש עצירות על המפה עם זמני הליכה ביניהן.`

### 6.2 Desktop: yes, a frame

A neutral dark device frame, ~300px wide, cropped by the fold's inline-start edge so it reads as
an object in the composition rather than a floating PNG. Content is the 9:19.5 capture at 3×.
Body radius 44px, screen radius 36px, one soft shadow. No gloss, no hand holding it, no perspective
tilt, no floating reflection.

Why the frame belongs here and not in the hero: in the hero it would be a third element competing
with the photograph and the field. In this fold the *claim* is "it is in your pocket while you are
standing in the street" — a phone is the argument, not decoration.

### 6.3 Mobile: no, and here is why

**A phone frame inside a phone is a tautology.** It spends 30–40% of a 360px viewport on a bezel
that renders the actual UI at ~220px, which is *smaller* than the real thing the visitor is
holding. It is the single most common failure of ported desktop landing pages.

**Mobile treatment:** the same capture, **unframed and bleeding off the inline-start edge**, at
~112% of the container width and 0° rotation, with the inline-start portion clipped by the
viewport. Effect: "this is your screen, slightly larger than life, continuing past the edge."

**Implementation, zero JS:**

```html
<picture>
  <source media="(min-width: 1024px)" srcset="…/editor-framed-{1x,2x}.avif" type="image/avif">
  <source srcset="…/editor-bare-{1x,2x}.avif" type="image/avif">
  <img src="…/editor-bare.jpg" alt="…" width height decoding="async" loading="lazy">
</picture>
```

Two derivatives from one capture. No `useIsDesktop()`, no duplicated component, no second view file.

### 6.4 Freshness risk

A screenshot is a design decision that expires. The editor UI will change and the landing page
will quietly start lying. Mitigation: the generator script and the capture recipe live in the repo
(`scripts/`), and a line goes into `docs/ROADMAP.md` "חוב טכני פתוח" noting the asset needs a
refresh whenever the editor's visual layout changes.

---

## 7. Evidence plan

The rule: **specify real artifacts or declare the slot empty.** No fabricated testimonials, no
invented user counts, no fake logos, no made-up ratings.

| # | Slot | Real artifact | Status |
|---|---|---|---|
| 1 | Hero credibility | `/public/photos/home/hero_couple_fuji.png` — the founders on the actual trip | **EXISTS.** Owned. Needs derivatives (§2.2). |
| 2 | "the product works" | Live MapLibre + bundled `tripData` (31 days, 155 stops) + 179 owned photos | **EXISTS.** Needs image derivatives (§5.3). |
| 3 | "the product is real software" | `/map/edit/:tripId` capture | **MISSING.** Must be produced via `promo/STORYBOARD.md`. Blocking for Fold 2. |
| 4 | Countable facts | `31 ימים · 10 ערים · 155 עצירות · 179 תמונות` | **EXISTS and verified** (§7.1). |
| 5 | Other people use it | `fetchPublicTrips({sort:"popular", limit:8})` from `src/services/galleryService.js:25` | **EXISTS as a mechanism. Volume UNVERIFIED** — see §7.2. |
| 6 | Origin / founder trust | The first-person note, already told on `/japan` (`HomePage.jsx:293-296`) | **EXISTS.** True as written. |
| 7 | Testimonials | — | **EMPTY. Leave empty.** See §7.3. |
| 8 | Usage numbers ("N travellers") | — | **EMPTY. Leave empty.** See §7.3. |
| 9 | Logos / press | — | **EMPTY. Leave empty.** |

### 7.1 The four numbers, verified in-repo (2026-09-06)

| Claim | Verification |
|---|---|
| 31 ימים | 31 `day:` entries in `src/data/tripData.js` |
| 155 עצירות | 155 `attractions[]` objects |
| 10 ערים | 16 distinct `cityHe` values, which dedupe to 10 real cities (Disney/Universal/`טוקיו 2`/`טוקיו 3` are the same cities). **Say 10, not 16.** |
| 179 תמונות | 179 files in `/public/photos/source/` |

These describe an artifact that is live on this site and one click away. They are not usage
statistics and must never be phrased to imply they are. `CONTENT_AUDIT.md` states 187 total
entries including hotels and meals; **do not mix the two counts** — 155 is stops, 187 is entries.
Pick one number and one definition, and `copywriter` owns which.

### 7.2 The gallery strip — the honest conditional

`fetchPublicTrips` returns `[]` when Supabase is unconfigured *or* when nobody has published
(`galleryService.js:26,35`). I cannot query production from here.

**Design rule:** the strip must be robust at n=0, n=1, n=3 and n=8+.

- **n ≥ 4:** the strip renders as specified.
- **1 ≤ n ≤ 3:** the strip renders, but the heading loses any plural implication and the row does not stretch to fill (no ghost placeholders).
- **n = 0:** the strip is **removed entirely** and Fold 3 keeps the origin note and the stat row, which stand on their own. It must never render an empty rail or a skeleton that never resolves.

**Owner input needed on the live count — §11 Q3.**

### 7.3 Why there are no testimonials

There is no review-collection mechanism in this product, no ratings table, and no consented
quotes. Any testimonial on this page would have to be written by us. That is the exact "AI made
that" tell, and it is worse than an empty slot.

**What would fill it later:** a lightweight "מה שאנשים אמרו" capture in the share flow (after a
trip is shared and opened by a collaborator), storing a consented quote + first name + trip
destination. That is a `growth` + `db-architect` item and a real ROADMAP candidate, not something
this redesign should block on.

Similarly for usage counts: the `admin` KPI surface exists (`/admin`) but a public "N travellers"
claim needs a number the owner is willing to stand behind publicly. Not mine to invent.

---

## 8. Color, type, dark mode, contrast

### 8.1 Tokens

Base from `src/index.css:20-33`, plus what this surface needs and does not have:

| Token | Light | Dark | Use |
|---|---|---|---|
| `--m-paper` | `#F7F2E6` | `#1D1A16` | Fold ground (2) |
| `--m-paper-2` | `#FDFCF7` | `#221E1A` | Fold ground (0 lower, 4), cards |
| `--m-ink` | `#1C2333` | `#F5F1E8` | Headlines, primary text |
| `--m-ink-2` | `#3D4A5C` | `#C7BFB0` | Body |
| `--m-ink-3` | **`#5E5850`** | `#A79E8C` | Meta, captions |
| `--m-black` | `#14110E` | `#0C0A08` | Fold ground (1, 5) |
| `--m-vermillion` | `#C0392B` | `#E86B54` | **Accent text, small type, links** |
| `--m-vermillion-field` | `#C0392B` | `#A8321F` | The Fold 3 drench |
| `--m-vermillion-fill` | `#B83A2B` | `#B83A2B` | Filled buttons carrying white text |
| `--m-accent` | `#E0533F` | `#E0533F` | **Non-text only:** route strokes, pins, map lines, ≥24px display accents |
| `--m-line` | `rgba(28,35,51,0.10)` | `rgba(245,241,232,0.12)` | Hairlines |

`--m-ink-3` is **new**: DESIGN.md's existing `--muted #8A8472` measures **3.64:1** on paper-2 and
cannot carry text. `#5E5850` measures 6.29:1 on `--paper` and 5.45:1 on `--paper-2`. This is a
`design-systems` handoff (§12).

### 8.2 Measured contrast (all computed 2026-09-06)

| Pair | Ratio | Use | Verdict |
|---|---|---|---|
| `#1C2333` on `#FDFCF7` | 15.28:1 | Headlines, light | ✓ |
| `#1C2333` on `#F7F2E6` | 14.05:1 | Headlines on paper | ✓ |
| `#3D4A5C` on `#FDFCF7` | 8.76:1 | Body, light | ✓ |
| `#5E5850` on `#F7F2E6` | 6.29:1 | Meta, light | ✓ |
| `#C0392B` on `#FDFCF7` | 5.29:1 | Accent text, links | ✓ |
| `#C0392B` on `#F7F2E6` | 4.87:1 | Accent text on paper | ✓ |
| `#FFFFFF` on `#B83A2B` | 5.71:1 | Filled button | ✓ |
| `#FDFCF7` on `#C0392B` | 5.29:1 | Fold 3 drench text | ✓ |
| `#FDFCF7` on `#14110E` | 18.31:1 | Folds 1, 5 | ✓ |
| `#A79E8C` on `#14110E` | 7.09:1 | Meta on black | ✓ |
| `#E86B54` on `#1D1A16` | 5.50:1 | Accent text, dark | ✓ |
| `#F5F1E8` on `#A8321F` | 5.93:1 | Fold 3 drench, dark | ✓ |
| **`#E0533F` on `#FDFCF7`** | **3.73:1** | — | ✗ **never text** |
| **`#FFFFFF` on `#E0533F`** | **3.83:1** | — | ✗ **never a filled button with white text** |
| **`#F7D9CF` on `#C0392B`** | **4.09:1** | — | ✗ no tinted secondary on the drench |
| **`#8A8472` on `#FDFCF7`** | **3.64:1** | — | ✗ existing `--muted`, unusable for text |
| **`#A4AAB1` on `#FFFFFF`** | **2.34:1** | — | ✗ current footer copyright, must change |

### 8.3 The two-vermillion rule

`#E0533F` is the brand accent and stays the brand accent — as a **fill and a stroke**. It is
never the color of text under 24px, and never the ground under white text. `#C0392B` (the
marketing vermillion that already exists in `index.css`) carries accent text; `#B83A2B` carries
white text.

This single rule retires four of the five failures in §0.5.

### 8.4 Dark mode — the decision, stated

The landing themes. It does **not** reuse `theme.js`'s app palette.

`useDarkMode()` (`src/utils/theme.js:34`) is consumed for the **boolean only**; the landing maps
that boolean onto the marketing pair in §8.1. Rationale:

- The app dark (`#0E1012` / `#16191D`) is a cool neutral grey. The marketing surface's identity is *"reads like a printed travel companion"*. The dark counterpart of warm paper is warm ink-black, not neutral grey.
- DESIGN.md explicitly wants the two surfaces to be legibly different; matching them in dark would erase the only difference the current landing does not already have.
- `useDarkMode()` remains the **single** source of the boolean, honouring DESIGN.md's "no per-screen palette duplication".

Implementation: `data-theme="light|dark"` on the landing root; all colors are CSS custom
properties defined once. No inline hex in components. (This is the opposite of the current three
hard-coded `T` objects.)

The nav gets a small theme toggle only if §11 Q5 is answered yes; the default is to follow the
stored pref silently, as every other surface does.

### 8.5 Text on the photograph

Scrim over the hero image, from the block-end:

```
linear-gradient(to top,
  rgba(20,17,14,0.86)  0%,
  rgba(20,17,14,0.62) 38%,
  rgba(20,17,14,0.10) 78%,
  transparent        100%)
```

Worst case check: the brightest region under the H1 box is the sky, ~`#8FC4EE`. Blended at
`0.62` with `#14110E` → `#425563`. `#FDFCF7` on `#425563` = **7.5:1** ✓. In the lower band where
the H1 actually sits, the scrim is 0.86 and the ratio is higher.

Dark mode raises the floor to `0.90`.

**`qa` verification method (not a guess):** screenshot the rendered hero at 360, 768 and 1440,
sample the five brightest pixels inside the H1 and nav-lockup bounding boxes, and compute the
ratio against `#FDFCF7`. Repeat after any crop or `object-position` change. This is where
text-over-photo fails, and it fails silently.

---

## 9. Motion plan

`motion@13.1.0` is already a dependency. Brand register permits ambitious first-load motion. The
restraint here is that **only two things move**, and neither gates content.

| # | What | When | How | Reduced-motion |
|---|---|---|---|---|
| 1 | Hero photo settle | First load, once | `scale(1.06) → 1.00`, 1800ms `cubic-bezier(0.22,1,0.36,1)` | Static at `1.00`. No loop, ever. |
| 2 | Hero type + field entrance | First load, once | `translateY(14px) → 0`, opacity `0 → 1`; stagger 0 / 90 / 180ms | Instantly visible |
| 3 | Route seam draw | On intersection, once per seam | `stroke-dashoffset` → 0, 700ms `cubic-bezier(0.22,1,0.36,1)`; pin `scale(0.6) → 1` at +500ms | Rendered fully drawn, observer never attached |
| 4 | Demo map camera | On day change | MapLibre default `easeTo` | Default (no `essential`) → MapLibre jumps. Free. |
| 5 | Phone mockup drift (desktop only) | Over the fold's scroll range | `motion` `useScroll` + `useTransform`, `translateY` 24px total | Static |
| 6 | Gallery strip cards | — | **nothing** | — |
| 7 | Fold 4 rows | — | **nothing** | — |

### 9.1 Hard rules

- **Reveals enhance an already-visible default.** Every entrance uses a CSS `@keyframes` animation with `animation-fill-mode: backwards` on an element whose *base* style is `opacity: 1`. If the animation never runs — reduced motion, a CSS failure, a crawler, an old browser — the content is visible. Content visibility is never gated on a class-triggered transition. (`.tp-fade-up` must be audited against this before reuse; if it sets `opacity: 0` in the base rule, fix it or do not use it here.)
- **Nothing loops.** `.lv-glow`, `.lv-sparkle` and the `HeroRouteAnimation` plane loop are all deleted. Infinite decorative motion is the "hover micro-interactions that wave at you" anti-reference in PRODUCT.md.
- **No fade-on-scroll for every section.** Only the seams observe scroll. Six folds fading in one after another is AI grammar.
- Easing is `cubic-bezier(0.22, 1, 0.36, 1)` for arrival, `ease` for opacity. No spring, no bounce (DESIGN.md "Patterns to avoid"). Note that `HeroRouteAnimation.jsx:145` currently uses a `1.56` overshoot bezier, which violates that rule; do not carry it into the seams.
- The full `@media (prefers-reduced-motion: reduce)` block must set every one of the above to its finished state, not merely `animation: none` on an element whose base is `opacity: 0`.

---

## 10. Preserved · replaced · deleted

### 10.1 Preserved (working; do not throw out)

| Thing | Where | Why |
|---|---|---|
| `SiteFooter.jsx` structure | whole file | Real links, real destinations, and it is what keeps the accessibility statement one click away — a stated compliance requirement (`SiteFooter.jsx:11-13`). |
| `SiteFooter.startTrip` mechanism | `SiteFooter.jsx:44-48` | Promoted from a footer detail to **the page's primary action** (§4.3). Extracted, not duplicated. |
| `BrandMark.jsx` + the ink-square lockup | whole file | Correct, `currentColor`-driven, works at 14–20px. The seam's terminal pin reuses its path geometry (`BrandMark.jsx:41-44`). |
| The 7 Unsplash destination photos | `LandingView.jsx:61-68` | All verified `200 OK`. Kept as chip/card imagery if §11 Q6 keeps a destination fold; the *treatment* changes (§10.2). |
| `/create?dest=&city=` deep-link | `WizardView.jsx:190-199` | The whole hero rides on it. Unchanged. |
| `?demo=1&day=&city=` deep-links | `ExploreView.jsx:100-101` | Fold 1 links into them. Unchanged. |
| Bundled Japan data + 179 photos | `src/data/tripData.js`, `/public/photos/source/` | The entire evidence layer. |
| Keyless MapLibre + CARTO Positron | `MapComponent.jsx:9,25` | The reason a live demo is possible with zero keys. |
| `useActiveTrip` / active-trip branch | `LandingView.jsx:84-101,250-278` | **Behaviour preserved, position changed.** It is dormant on `/` (§0.6.3) but live on the `path="*"` catch-all. Move it out of the hero into a slim banner that renders **above the nav** only when `activeId` is truthy. It must not shape the hero. |
| `שלוש שאלות ויש לכם שלד מסלול` | `LandingView.jsx:420` | Best line on the page. Moves to Fold 5 verbatim. |
| `HeroRouteAnimation.jsx` the file | whole file | Retired from `/` (§10.2) but kept in the repo: its `getTotalLength()` + `--routeLen` dash technique (`:65-74`) is exactly what `RouteSeam` needs. Harvest it. |

### 10.2 Replaced

| Now | Becomes |
|---|---|
| 5 hero CTAs | 1 search field + chips (§3) |
| Uppercase tracked eyebrows ×4 | Nothing. The role is deleted from the type scale. |
| 3 identical pillar cards + icon tiles | Fold 4's asymmetric hairline-separated rows (§2.6) |
| `HeroRouteAnimation` in a card labelled "מסלול חי" | A genuinely live map with the real itinerary on it (§2.3) |
| Destination cards under a `multiply` gradient shroud + 52px emoji | If a destination fold survives §11 Q6: photo at full fidelity, one hairline, Hebrew name in the block-end corner, no shroud, no emoji glyph |
| Hard-coded `T` palettes ×3 | CSS custom properties, one definition, light + dark (§8) |
| Frosted sticky nav | In-flow nav, no `backdrop-filter` |
| Two view files with drifting duplicate constants | One composition + fold components (§2.0) |

### 10.3 Deleted

| # | What | Lines | Reason |
|---|---|---|---|
| 1 | `src/views/LandingDesktop.jsx` | whole file, 193 | Duplicated constants, icon-tile grid, uppercase eyebrows, and it is why mobile and desktop tell different stories. |
| 2 | AI waitlist modal + `aiOpen`/`aiEmail`/`aiDone`/`submitAi`/`closeAi` | `LandingView.jsx:107-109,124-135,431-519` | **Unreachable.** `setAiOpen(true)` exists nowhere in the repo (§0.6.1). ~89 lines of ships-but-never-renders. |
| 3 | `tp_metrics_ai_waitlist` + `tp_metrics_ai_clicks` writes | `LandingView.jsx:117-118,129-132` | Written, never read, anywhere. Replaced by real PostHog events (§12). |
| 4 | `.lv-glow` keyframes + class | `LandingView.jsx:142-146` | Applied to no element. |
| 5 | `.lv-sparkle` + the 🪄 wand | `LandingView.jsx:162-166,322`; `LandingDesktop.jsx:59-60,130` | Infinite decorative loop; emoji as primary art. |
| 6 | `PILLARS` (both copies) | `LandingView.jsx:76-80`; `LandingDesktop.jsx:33-37` | The banned card grid, and the two copies claim different features. |
| 7 | Hero backdrop Unsplash at `opacity: 0.12` + blur | `LandingView.jsx:73,218-227` | Generic stock, rendered invisible. Replaced by an owned photograph at full strength. |
| 8 | `mix-blend-multiply` gradient shroud + 52px emoji glyph on destination cards | `LandingView.jsx:396-397`; `LandingDesktop.jsx:164,167` | Destroys the photography Design Principle #1 calls the hero; sticker-emoji as primary art. |
| 9 | `useIsDesktop()` on this route | `LandingView.jsx:9,85,178` | Replaced by CSS + `<picture>`. |
| 10 | `createPortal` import | `LandingView.jsx:2` | Only used by the deleted modal. |

**After deletion, `builder` must re-check:** `SwipeBackContainer` (`LandingView.jsx:8,138`) — is a
swipe-back gesture meaningful on the site root, which has nothing to go back to? Likely also
removable; verify before cutting.

---

## 11. Open decisions for the product owner

Q1, Q2, Q6, Q7 decided by the owner (2026-09-06). Q3, Q4, Q5 still open.

**Q1 — Does the AI planner keep a top-of-funnel position? DECIDED: no.**
Moves to the post-destination fork, per this spec's §3.2 recommendation. Five CTAs is no CTA;
a guest cannot evaluate "AI itinerary" before seeing anything.

**Q2 — Can a guest complete wizard steps 1–2 before authenticating? DECIDED: not now.**
Keep the existing `ProtectedRoute` gate as-is. This was flagged as the single largest conversion
lever on the page, but also the highest-risk item (touches `ProtectedRoute` and the guest→user data
handoff, adjacent to the documented SEV1 auth-identity incident) — owner chose to not take that risk
on for this pass. Revisit separately, with `architect` + `db-architect`, if conversion data later
justifies it.

**Q3 — How many trips are actually published to the public gallery right now?**
Still open — I cannot query production. Fold 3's strip degrades honestly at n=0/1–3/4+ (§7.2), but
its *composition* differs meaningfully between "we have 12" and "we have 2". **Owner: give the
number, or approve building all three states and letting the real count decide at ship time.**

**Q4 — Persistent CTA on scroll?**
Still open. Options: (a) nothing, trust Fold 5; (b) a slim bottom bar after Fold 2 — collides with
the global `BottomDock`; (c) a compact search that docks into the nav after the hero scrolls out.
**My lean: (c), but it is real work — worth a separate decision once the base six folds are built,
not a blocker for starting.**

**Q5 — A theme toggle on the marketing surface?**
Still open. **My lean: follow the OS/browser preference silently, no toggle** — one more control on
a page whose whole point is having one control. Treat as decided-by-default unless the owner
objects before implementation.

**Q6 — Does a destination-inspiration fold survive at all? DECIDED: no separate fold.**
Its job is absorbed into the hero chips and the footer's `מקומות פופולריים` column, per this spec's
lean — it would otherwise compete with Fold 3's gallery strip for the same "look at trips" attention.

**Q7 — Is `hero_couple_fuji.png` acceptable as the public front-door image? DECIDED: yes.**
Ships as the permanent hero photo. Already public on `/japan` and `/welcome`, so this is not a new
exposure — the owner confirmed the "first thing every visitor sees, forever" bar is acceptable for
this specific image.

---

## 12. Handoffs

### → `copywriter`
Every Hebrew string in §2 is a **draft to be refined, not final**. Slots, in fold order: nav,
H1 + lede + micro (Fold 0), field placeholder + submit + `sr-only` label + empty state (§4),
H2 + lede + secondary CTA (Fold 1), H2 + body + 3 claims + screenshot caption (Fold 2), origin note
+ signature + link + stat-row labels + strip heading + strip empty state (Fold 3), H2 + 4 claim/answer
pairs + close line (Fold 4), H2 + micro (Fold 5), plus alt text for the hero photo and the editor
screenshot.

Voice constraints: Hebrew-first, plural address, no em dashes, no `streamline`/`empower`/
`seamless`/`next-generation`/`game-changer` or their Hebrew equivalents, no eyebrow labels
anywhere. `לאן נוסעים?` is a **named recurring device** (placeholder in Fold 0, headline in Fold 5)
and should be preserved as a pair. Also owns: which stop-count definition ships (155 stops vs
`CONTENT_AUDIT.md`'s 187 entries) — pick one and use it everywhere. Also owns the one-line
`AuthView` continuation string (§4.5).

### → `growth`
1. **The homepage currently emits zero analytics events.** `grep track( src/views/Landing*.jsx` returns nothing. The funnel does not have a first step.
2. New events to define: `home_viewed`, `home_search_focused`, `home_search_typed` (send `{ len, hasMatch }`, **not** the query string), `home_destination_selected` `{ dest, city, source: "hero_search"|"hero_chip"|"closing_search" }`, `home_demo_day_changed` `{ day }`, `home_demo_opened_full`, `home_gallery_card_opened` `{ tripId }`, `home_cta_signin`.
3. Funnel closes with events that already exist: `home_viewed` → `home_destination_selected` → `gate_shown` / `signed_in` → `map_created`. Only the `home_*` ones are new.
4. Consent: all of it stays behind `analyticsAllowed()` (`src/analytics/posthog.js:24`).
5. **Out of scope for me, yours:** SEO/meta/OG/schema.org for `/`, and the `he/en` marketing-page question parked in ROADMAP "הבא בתור".
6. Performance is a growth metric here: the hero photo must remain LCP, and the §5.3 lazy-mount is what protects it. Worth a Web Vitals check post-ship.

### → `design-systems`
1. **New marketing tokens** (§8.1) as CSS custom properties with a light/dark pair, defined once. Today three files hard-code three near-identical copies of the app palette.
2. **`--muted #8A8472` is unusable for text** (3.64:1 on paper-2). Add `--m-ink-3 #5E5850` and mark `--muted` as decorative-only, or retire it.
3. **Document the two-vermillion rule** (§8.3) in DESIGN.md: `#E0533F` = fills and strokes only; `#C0392B` = accent text; `#B83A2B` = ground under white text. This is a product-wide correctness issue, not a landing-page one.
4. `Noto Serif Hebrew` is imported at `src/index.css:14` and used by nothing. Either give it a documented role (this spec's display face) or drop it from the import to save the request.
5. The landing's remaining emoji (`🇮🇱` in `SiteFooter.jsx:107`, the destination glyphs) belong in the `Icon.jsx` migration DESIGN.md already schedules.
6. Fix `SiteFooter.jsx:107`: `#A4AAB1` at 13px is **2.34:1**.

### → `builder` (implementation notes that are design decisions, not preferences)
- One view file. No `*Desktop.jsx`. No `useIsDesktop()` on this route (§2.0).
- One `startTripLink` module. Do not fork `SiteFooter.startTrip` (§4.3).
- The search never calls Google Places, even when a key is present (§4.2).
- One MapLibre instance, lazily mounted, poster before intersection (§5.3).
- `scripts/build-landing-assets.mjs` for hero + stop-photo + screenshot derivatives. No new npm deps; follow the `sips` precedent in `src/brand/README.md`.
- Do not touch `AuthContext` / `authService` / `ProtectedRoute`. The `AuthView` change in §4.5 is display-only.

### → `qa`
- Hebrew headline overflow at 320 / 360 / 390 / 414 / 768 / 1024 / 1280 / 1440 / 1920 and at 200% text zoom. No `nowrap` on any headline.
- Contrast over the photograph by pixel sampling, per §8.5. Both themes.
- RTL: no `left`/`right` literals in any new file; the route seam mirrors by path data, not `scaleX(-1)` (which would flip the pin glyph).
- Keyboard: full combobox traversal (§4.4), Esc, focus return, `:focus-visible` rings on all three grounds (paper, photo scrim, warm black).
- `prefers-reduced-motion: reduce` — every animated element must land in its **finished** state, and all content must be visible with animations disabled entirely (§9.1).
- Gallery strip at n=0, 1, 3, 8+ (§7.2).
- Demo map: no scroll trapping on touch; day change under reduced motion jumps rather than eases.
- `npm run critical` before any deploy-relevant change, per CLAUDE.md.
- Perf: LCP is the hero `<img>`, not the map. Verify on a throttled mobile profile.

### → `product-manager`
On ship: move ROADMAP idea **#9** into בוצע; open חוב טכני entries for (a) the editor screenshot's
staleness risk (§6.4), (b) the Latin-input city-search limitation (§4.2), (c) whichever of §11 Q2 /
Q4 are deferred rather than answered.

---

## 13. Build order

| # | Step | Blocks | Owner |
|---|---|---|---|
| 0 | Answer §11 Q1, Q3, Q7 | Folds 0 and 3 | owner |
| 1 | Marketing tokens + light/dark pair + `--m-ink-3` | everything | `design-systems` |
| 2 | `scripts/build-landing-assets.mjs`; hero derivatives | Fold 0 | `builder` |
| 3 | `startTripLink` extraction; `SiteFooter` refactored onto it | §4 | `builder` |
| 4 | Nav + Fold 0 + the search component + `RouteSeam` | the primary action | `builder` |
| 5 | Delete `LandingDesktop.jsx` and everything in §10.3 | — | `builder` |
| 6 | Fold 5 (reuses the Fold 0 search component) | — | `builder` |
| 7 | Fold 4 (pure type, no assets) | — | `builder` |
| 8 | Fold 1 demo + lazy map + stop-photo derivatives | §5.3 | `builder` |
| 9 | Editor capture per `promo/STORYBOARD.md`; Fold 2 | §7 row 3 | `builder` |
| 10 | Fold 3 (needs the §11 Q3 answer) | §7.2 | `builder` |
| 11 | Hebrew pass | — | `copywriter` |
| 12 | Events | — | `growth` |
| 13 | Full pass: RTL, a11y, contrast, reduced-motion, perf, `npm run critical` | ship | `qa` |

Steps 4–7 are a shippable page on their own: nav, hero, objection, ask, footer, with real
photography and a real primary action. Folds 1, 2 and 3 are the evidence layer and can land after,
in that order of value.
