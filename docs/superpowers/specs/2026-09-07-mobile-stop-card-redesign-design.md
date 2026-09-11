# Mobile stop card — redesign

**Date:** 2026-09-07
**Status:** **Decided 2026-09-11** — owner accepted `product-designer`'s recommendation on both open points (§7.2, §9 Q1). Ready for planning (`architect` + `superpowers:writing-plans`).
**Agent:** `product-designer` (this doc — spec, not code)
**Surface:** `/map/edit/:tripId`, mobile — the itinerary bottom sheet, day view
**Register:** product (`.claude/skills/impeccable/reference/product.md`)

**Owner's brief:** the stop card is *"מאוד אנמי, חסר במידע"*.

**Predecessors:**
- [2026-09-06-mobile-editor-ux-critique.md](2026-09-06-mobile-editor-ux-critique.md) — F1, F19, F21, F22, F23 are closed or partly closed by this spec
- [2026-09-06-redesign-landing-and-mobile-editor.md](../plans/2026-09-06-redesign-landing-and-mobile-editor.md) — D2 חלק 2 (`עלות → כרטיס התחנה`) is literally a line item here
- [2026-09-06-trip-budget-phase-c-design.md](2026-09-06-trip-budget-phase-c-design.md) — the trip-level budget vocabulary this card must *not* collide with

**Downstream agents:** `builder` (implementation) · `design-systems` (3 new `Icon.jsx` glyphs, the dark-mode flip) · `budget-domain` (the money semantics referred in §9) · `copywriter` (Hebrew strings) · `qa` (`T-CARD-01..14`)

---

## 0. Scope line

**In:** the place card rendered by `renderPlaceRow` (`EditorView.jsx:841–1021`), the transit chip between two cards (`TransitRail`, `:246–323`), the insert `+` track (`:645–654`), and the F1 IA decision (two menus for one stop).

**Out:** the transit/flight row (`renderTransitRow`, `:713–835`), the inline note/transit nodes (`:658–707`), the day header, the bottom bar, the map chrome, `EditorDesktop.jsx`. No auth, DB, API, route or business-logic change.

---

## 1. Current inventory

### 1.1 What one place card renders today

Counted from `renderPlaceRow`. "Freq" is my judgement of how often the real user (Hebrew-speaking traveller, planning at a desk / executing on a phone) performs the action.

| # | Element | `file:line` | Entry point | Interactive | Size | Freq |
|---|---|---|---|---|---|---|
| 1 | Index badge (number / `bed` icon) | `:901–906` | — | No (`aria-hidden`) | 28×28 | — |
| 2 | Stop name, 2-line clamp | `:913–918` | tap → fly map + detail card | Yes (via parent div `:908`) | flex | every session |
| 3 | Completion checkbox | `:922–928` | tap | Yes | **26×26** | every session *(trip mode only)* |
| 4 | Rating `★ 9.4/10` | `:936` | — | No | 12.5px | — |
| 5 | Category / lodging subtitle | `:938` | — | No | 12.5px | — |
| 6 | `ניווט` button | `:944–951` | tap → Google Maps | Yes | 30h × ~78w | every session *(field)* |
| 7 | Note button | `:954–961` | tap → `NoteSheet` | Yes | **30×30** | occasionally |
| 8 | `⋯` actions | `:962–969` | tap → `StopActionsSheet` | Yes | **30×30** | occasionally |
| 9 | Drag handle `≡` | `:970–977` | pointer-down → reorder | Yes | **24×30** | occasionally |
| 10 | `העבר ליום הבא` | `:983–988` | tap | Yes | ~28h | occasionally *(trip mode only)* |
| 11 | Note ticket (grey block) | `:995–1008` | tap → `NoteSheet` | Yes | full-width | occasionally |
| 12 | Attachment pills `📎` ×N | `:1010–1016` | tap → `AttachmentViewer` | Yes | 36×stretch | rarely |
| 13 | Swipe-left → delete | `:1060` | gesture (docked, 2-step) | Yes | full row | occasionally |
| 14 | Swipe-right → bank | `:1061` | gesture (docked, 2-step) | Yes | full row | rarely |
| 15 | Long-press → **second menu** | `:1062` → `:4000–4058` | 340 ms hold | Yes | — | occasionally |
| 16 | Long-press + move → drag | `:1063` | gesture | Yes | — | occasionally |

**16 affordances per card; 4 persistent buttons in the action row; 3 of them below 44×44.**

### 1.2 What sits between two cards

| # | Element | `file:line` | Interactive | Size |
|---|---|---|---|---|
| 17 | Insert `+` on the axis line | `:645–654` | tap → insert note/transit | **30×22**, transparent |
| 18 | Transit chip `🚶 7 דק׳ · הליכה · 543 מ׳ ▾` | `:246–323` | tap → mode menu | ~24h, **11px text** |
| 19 | Mode menu ×4 (`🚶🚗🚆🚌`) | `:298–313` | tap → set override | **34×34**, emoji, no visible label |

### 1.3 Data available to the card, and where it lives

| Signal | Field | Written by | On the card today |
|---|---|---|---|
| Name | `nameHe` / `name` | all paths | ✅ |
| Category | `category` | all paths (defaults `"אטרקציה"`) | ✅ |
| Rating | `rating` | **3 writers, 2 scales** — see §2.5 | ✅ (raw, unnormalised) |
| Personal note | `note` (also legacy `comment`/`annotation`/`quote`, `:847`) | `NoteSheet`, `StopActionsSheet` | preview only when set |
| Attachments | `attachments[]` | `onAttachFilePicked`, `TripFilesSheet` | one pill per file |
| **Cost** | `trip.data.budget.items[]` where `stopRef === instanceId` (`useEditorState.js:178–181`) | `ExpenseSheet` (stop-bound) | ❌ **nowhere** |
| Lodging | `_hotelGroup` / `/מלון\|לינה/` on `category` | `⋯`, long-press | badge + subtitle |
| Card colour | `_theme` | `⋯` (4 pastels) and long-press (7 themes) — **disjoint sets** | badge background only |
| Completion | `completed` | checkbox | ✅ (trip mode) |
| Open hours | — | — | ❌ **no data source exists** |

---

## 2. What's wrong

### 2.1 The card shows none of the money the product just shipped

Per-stop expense went to production 2026-09-06 (Phase B, `9dab302`). `costForStop` exists (`EditorView.jsx:2167–2170`), is wired into `StopActionsSheet` as `stopCostLabel` (`StopActionsSheet.jsx:280–282`) — and the card renders badge, name, rating, category, ניווט, note, ⋯, ≡ and **no amount**. F19 measured the path at four taps plus a mandatory scroll to *set* a cost, and zero pixels of confirmation afterwards. D2 חלק 2 already decided the fix ("עלות → כרטיס התחנה"); this spec is where it gets a layout.

### 2.2 The action row is four controls of chrome under every single stop

`:942–979` renders `ניווט` (filled charcoal), note (30×30), `⋯` (30×30), `≡` (24×30). Three fail the 44×44 minimum (F21). The filled-charcoal `ניווט` is the highest-contrast object on the card — heavier than the stop's own name — repeated on every row, so a 6-stop day paints six black blocks down the sheet. The drag handle is `T.ink4 #A4AAB1` at **2.34:1** (F22), below the 3:1 floor for a UI component.

### 2.3 Three text elements compete for the same rank

Name is 16px/800 `#111114` (`:914`). Rating is 12.5px/**800** in `CORAL #FF6B6B` when `rating ≥ 8.5` (`:863`, `:870`, `:936`) — **2.78:1 on white, fails AA** (F23). The lodging subtitle is the same coral at 800 (`:938`). So on a hotel row with a good rating, three things shout and the name loses. The register's rule — accent for primary action, current selection and state only — is broken by using the brand-adjacent coral as decoration on a passive metric.

### 2.4 Attachments and notes are shaped wrong

Each attachment renders its own 36px-wide black pill stretched to the note ticket's height (`:1010–1016`); three files produce three black blocks. The note ticket is a filled grey card *inside* the white card — the exact "cards inside cards inside sheets" pattern `DESIGN.md` bans (it prescribes a hairline). And the ticket only appears at all when a note **or** an attachment exists, so the "הוספת הערה…" ghost label (`:1007`) shows up on cards that have a file and no note — an add-affordance that appears for an unrelated reason.

### 2.5 `rating` is one field with two scales and no unit discipline

| Writer | `file:line` | Emits |
|---|---|---|
| Curated Japan data | `data/tripData.js:22` | `"9/10"` (string) |
| AI pipeline | `services/aiTrip.js:31–32` | `"9.2/10"` (string) |
| Search → preview → add | `utils/classify.js:75–79` via `PlaceInfoCard` | `"9.2/10"` (string) |
| **Nearby → add** | `EditorView.jsx:1611` | **`4.6`** (raw Google 0–5) |
| **Overlay map import** | `EditorView.jsx:1979` | **passthrough, unnormalised** |

The card prints `★ {a.rating}` verbatim (`:936`), so two cards in the same day can read `★ 9.2/10` and `★ 4.6`. Worse, `highRating = parseFloat(...) >= 8.5` (`:869–870`) means a genuinely excellent 4.8/5 place *never* gets the emphasis while an average 9/10 always does.

### 2.6 The transit chip is a desktop component on a touch surface

`TransitRail:246–323`: 11px text (below the 12px caption floor in `DESIGN.md`), ~24px tall (fails 44), an inversion-on-**hover** treatment (`:251`, `:269–270`) that no phone can trigger, a `▾` text glyph (`:261`), emoji mode icons (`:254`, `:310`), and a mode menu of 34×34 emoji circles whose Hebrew labels exist only in `title` (`:302`) — invisible to touch and to screen readers that don't announce `title`. Visually it is a bordered white island floating in the gap: it separates the two cards it exists to connect.

### 2.7 Two menus, one stop (F1) — still open

`⋯` opens `StopActionsSheet`; a 340 ms long-press opens a *different* 7-row menu (`:4000–4058`) with four behavioural divergences documented in the critique. D2 חלק 1 merged the `⋯` menu's internals (`7cabbfd`) but left the long-press menu standing. The card is where both are triggered from, so the decision belongs here.

### 2.8 Every colour on the card is hard-coded

`EditorView.jsx` has **zero** `useDarkMode` usages; `T` is a local literal at `:52–56` with no dark half. On the card alone: `#fff` and `#F0F0F3` and `#ECECEF` (`:886–887`), `#111114` (`:914`), `CHARCOAL #1E1E24` (`:862`, `:948`, `:1013`), `CORAL #FF6B6B` (`:863`), `#F0F0F3` again (`:958`, `:966`, `:1001`), `#E4E4E8` on the insert track (`:647`), `#1FA67A` on the checkbox (`:925`). `StopActionsSheet.jsx` duplicates a light palette at `:23–26` and hard-codes `background:"#fff"` at `:98`.

---

## 3. Proposed IA

### 3.1 The card answers four questions, in this order

1. **What is it, and where does it sit in my day?** → badge + name
2. **What do I already know about it?** → the metadata line (category · rating · **cost** · **files** · *hours slot*)
3. **What did I write about it?** → the note preview
4. **What can I do with it right now?** → two trailing controls

Nothing else earns permanent space.

### 3.2 Disclosure tiers — every action assigned

| Action | Tier | Affordance | Why this tier |
|---|---|---|---|
| Open on map / detail card | **Persistent** | whole card body tap | every session, the card's reason to exist |
| Navigate (Google Maps) | **Persistent** | labelled button, Row A trailing | *the* on-the-ground action; the product's mobile promise |
| More actions | **Persistent** | `⋯`, Row A trailing | the single door to everything else |
| Reorder | **Persistent** | **the index badge** is the drag handle | direct manipulation of the thing that *is* the position |
| Mark visited | **Persistent, trip mode only** | the badge becomes a checkbox | same object: "stop N" and "did I do N" |
| Read/edit note | **Contextual** | the note preview line, when a note exists | the object is on the card; no ghost when absent |
| Open cost | **Contextual** | the amount in the metadata line, when a cost exists | ditto |
| Open files | **Contextual** | the `paperclip N` in the metadata line, when files exist | ditto |
| Change transit mode | **Contextual** | the connector chip between two cards | belongs to the segment, not to either stop |
| Insert note / transit between stops | **Contextual** | the `+` on the axis | already correct |
| Delete · move to bank | **One tap** (gesture, 2-step docked) | swipe + tap the revealed zone | destructive, already gated, already undoable |
| Add a first note · add a first cost · attach a file · move/copy day · split day · lodging · nearby · copy name · colour | **One tap** | `⋯` → `StopActionsSheet` | occasional-to-rare; the sheet is the correct home |
| Everything in the long-press menu | **deleted** | long-press now opens `StopActionsSheet` | see §3.3 |
| `העבר ליום הבא` inline button | **One tap**, moved | new first row in the `⋯` schedule section, **trip mode only** | frees a whole row of card chrome for an occasional action |
| Card colour (`_theme`) | **Buried** | stays in `StopActionsSheet` only | rare, cosmetic, and currently write-only-ish (N1) |

### 3.3 F1 decision — one menu, reached two ways

**Long-press opens `StopActionsSheet` — the identical sheet `⋯` opens.** The bespoke long-press menu (`EditorView.jsx:4000–4058`, ~58 lines, plus the `THEMES` const and the `ctxSub` state) is deleted.

Rationale:
- It closes all four divergences in one edit instead of four: the delete-without-undo trap, the two disjoint colour palettes, the uncapped lodging toggle, and the duplicated move-to-day function.
- It costs one prop change — `onLongPress={(x,y) => onOpenActions(idx)}` at `:1062` — and deletes a component.
- The gesture stays taught. Users who found long-press keep it; it just stops being a *different* menu.
- `ctxMenu`'s tap coordinates (`x, y`) become unused: the sheet is bottom-anchored, which is the better placement on a phone anyway.

**Behaviour change to accept and test:** the long-press note path called `saveNoteAt` (which raises the multi-day cascade prompt) while the `⋯` path calls `setStopNote` (silent, this instance only). After the merge only `setStopNote` survives on that route. That is a real semantic loss for multi-day hotels. **Decision: `StopActionsSheet`'s note row adopts `saveNoteAt`**, so the cascade prompt survives and the silent path is the one that disappears. Regression test required (`T-CARD-11`).

### 3.4 The open-hours slot

A reserved, **unbuilt** position at the inline-end of the metadata line: `Icon clock 12px` + a short string. It renders only when `a.openHours` exists, which nothing writes today. The layout, tokens and overflow behaviour are specified in §4.4 so that landing the data later is a render-guard change, not a re-layout. See §9 Q1.

---

## 4. Screen spec

Tokens are named from `src/utils/theme.js` (`P.*`). Every value below is given light / dark. **Threading:** the card receives a `P` prop. Until the `design-systems` dark pass lands for the editor chrome, `EditorView` passes `P = LIGHT` as a literal — zero visual change in this release, one-line flip later. See §8.6.

### 4.1 Card container

| Property | Value |
|---|---|
| Element | `<li>` inside an `<ol>` (see §5.8) |
| Background | `P.panel` — `#FFFFFF` / `#16191D` |
| Border | `1px solid P.line` — `rgba(20,20,20,0.08)` / `rgba(255,255,255,0.09)` |
| Radius | `14px` (`DESIGN.md` row/card band) |
| Padding | `10px 12px` |
| Margin-block-end | `8px` (was 6 — on the 8-pt grid now) |
| Min-height | `76px` |
| Tap | whole container → fly map + open detail card; every interactive child calls `stopPropagation` |
| Transition | `transform 200ms, box-shadow 200ms, background 200ms` — inside the 150–250 ms band; disabled under `prefers-reduced-motion` |

### 4.2 Row A — identity + actions

```
RTL, reading edge = inline-start (right)

┌──────────────────────────────────────────────────────────┐
│ ▣3   בורג' ח'ליפה                    [◈ ניווט]   [ ⋯ ]  │
└──────────────────────────────────────────────────────────┘
  ↑badge  ↑name, 2-line clamp, flex:1   ↑trailing, max 2
```

- `display:flex; align-items:flex-start; gap:8px; min-height:44px`
- Trailing controls `align-self:center`.
- **Row A never holds more than two trailing controls.** Planning mode: `[ניווט] [⋯]`. Trip mode: `[ניווט] [⋯]` — completion moved onto the badge.

**Badge** (`:901–906` today) becomes the reorder handle and, in trip mode, the completion control.

| State | Visual |
|---|---|
| Default | `32×32`, radius `8`, bg `P.ink` / `P.ink` (`#0D0F11` / `#F5F6F7`), fg `readableInkOn(bg)` → `#FFFFFF` / `#16191D`. **20.5:1 light, 16.4:1 dark.** Content: the position number, 13px/800, `tabular-nums` |
| User colour (`_theme`) | bg `a._theme`, fg `readableInkOn(a._theme)` — the derivation at `:866` is correct, keep it verbatim |
| Lodging | bg `P.accent` `#E0533F` both modes, content `Icon bed 15px` in `readableInkOn(accent)`. 3.83:1 as a graphic — passes the 3:1 UI/graphics floor |
| Done (trip mode) | bg `#1FA67A` both modes, content `Icon check 16px` white. 3.36:1 as a graphic ✓ |
| Not-done (trip mode) | bg `transparent`, `1.5px solid P.ink3` (4.93:1 / 5.55:1 — passes the 3:1 component floor, unlike today's `ink4` at 2.34:1), number in `P.ink2` |
| Hit area | visible 32×32, hit **44×44** via `padding:6px; margin:-6px` |
| Pressed | `transform: scale(0.94)` via the existing `.tp-press` class |
| Focus-visible | `outline: 2px solid P.accent; outline-offset: 2px` |
| Dragging | `cursor:grabbing`, `box-shadow: 0 0 0 3px ${P.accent}33` |
| Semantics | `<button>`; planning mode `aria-label="תחנה 3, בורג' ח'ליפה — גררו לשינוי סדר"`, `aria-roledescription="ניתן לגרירה"`; trip mode `role` stays button with `aria-pressed={done}` and `aria-label="סמנו כבוצע"` / `"בטלו סימון ביקור"` |
| Gesture split | tap (no movement) → toggle complete, **trip mode only**; press + move ≥6px → drag. Identical to the threshold `SwipeableRow` already uses at `:405`, so the two engines agree |

**Name**: `16px / 700 / P.ink`, `line-height:1.3`, 2-line clamp, `wordBreak:break-word`. Weight drops 800 → 700: with the coral removed from the metadata line (§4.4) the name no longer needs to shout to win, and 700 at 16px against 600 at 12.5px is a clean two-step. Done state: `opacity .55` + `line-through` in `P.ink4`.

**`ניווט`**: `height:44`, `padding-inline:12`, radius `10`, bg `P.surface` (`#F6F6F4` / `#1F242A`), fg `P.ink2` (13.4:1 / 9.4:1), `Icon navigation 14px` + label `13px/700`. **The filled charcoal is dropped** — it made a passive list look like six primary buttons. Hover `P.surface2`; active `scale(0.94)`; focus-visible accent ring; disabled n/a (the control is simply absent when `!hasNav`).

**`⋯`**: `44×44`, radius `10`, bg `transparent`, fg `P.ink3`, `Icon more 18px`. Hover/active `P.surface`. `aria-label="פעולות"`, `aria-haspopup="dialog"`.

### 4.3 Row B — the metadata line

**Text and icons on the card surface. No chip fills.** `DESIGN.md` bans cards-inside-cards and prescribes hairlines for internal grouping; a row of filled pills is the same mistake at smaller scale. The line is `12.5px / 600 / P.ink3` with `·` separators in `P.ink4`, `display:flex; flex-wrap:wrap; align-items:center; gap:8px; row-gap:4px; margin-top:8px`.

Reading order (RTL: right → left):

```
אטרקציה · ★ 9.4/10 · ₪120 · ◫2 · ◷ פתוח עד 18:00
   ①          ②         ③     ④          ⑤ (future)
```

| # | Item | Renders when | Type | Colour |
|---|---|---|---|---|
| ① | Category (or `מלון · 3 לילות`) | `a.category` truthy | text | `P.ink3` — 4.93:1 / 5.55:1 |
| ② | `★ 9.4` + `/10` | normalised rating exists | text, `Icon star 11px` filled | number `P.ink2` **700** when ≥8.5, else `P.ink3` 600; the `/10` always `P.ink4` 11px |
| ③ | Cost | a linked expense exists | **button**, `<Money>` | see §4.5 |
| ④ | `Icon paperclip 12px` + count | `attachments.length > 0` | **button** | `P.ink3` |
| ⑤ | `Icon clock 12px` + hours | `a.openHours` — **never today** | text | `P.ink3`; "סגור" variant `P.danger` |

**Emphasis rule: the rating never takes an accent colour.** `CORAL #FF6B6B` is deleted from this surface (F23). High ratings are marked by weight (700 vs 600) and by `P.ink2` vs `P.ink3` — a legible, AA-passing distinction. `P.accent #E0533F` is 3.83:1 on white and must never carry 12.5px text in light mode.

**Interactive items inside a text line:** ③ and ④ are `<button>`s with `background:none; border:none; padding:12px 6px; margin:-12px -6px` — visible height stays 18px, hit box is ~44px tall. Neighbours expand vertically, not horizontally, so hit boxes never overlap.

**Overflow:** `flex-wrap` to a second line. No ellipsis, no horizontal scroll, no measurement-driven priority dropping. Money is never allowed to be the thing that gets truncated, and a second 18px line on a dense card is a smaller cost than a hidden number.

**Sparse rule:** if not a single item would render, **Row B is omitted entirely** and the card collapses to ~68px. It never renders as an empty reserved strip. See §5.7.

### 4.4 Row C — note preview

Renders only when `note` (`:847`, including the four legacy field names) is non-empty.

- `display:flex; gap:6px; align-items:flex-start; margin-top:8px`
- `Icon note 12px` in `P.ink3`, `flex-shrink:0`, `margin-top:2px`
- Text `12.5px / 500 / P.ink2`, `line-height:1.45`, **1-line clamp** (2 lines at ≥480px), `wordBreak:break-word`
- **No background fill, no radius, no padding block** — the grey ticket at `:1001` is deleted. Plain text with a leading icon, per the hairline rule.
- Whole run is a `<button>` when `editable && onEditNote`; `aria-label="עריכת ההערה"`; hit box expanded to 44px via `padding-block:12px; margin-block:-12px`
- Done state: `opacity .6`

### 4.5 Cost — the D2 חלק 2 payload

Rendered with the existing `<Money>` component (`components/Money.jsx`) — it already guarantees the two things that break here otherwise: LTR bidi isolation for `₪120` inside RTL Hebrew, and `tabular-nums`.

| State | Condition | Renders | Colour |
|---|---|---|---|
| **no cost** | no item with `stopRef === instanceId` | *nothing* — no ghost, no "הוסף עלות" | — |
| **planned** | `paid === false` | `₪120` 700 | `P.ink2` — 13.4:1 / 9.4:1 |
| **paid** | `paid === true`, `actualMinor == null` | `Icon check 11px` + `₪120` 700 | `P.ink2` |
| **paid, actual ≤ planned** | `actualMinor <= amountMinor` | `Icon check 11px` + `₪95` (the **effective** amount) 700 | `P.ink2` — under is not a warning |
| **over the plan** | `actualMinor > amountMinor` | `Icon check 11px` + `₪150` 700 | `P.danger` — `#C0392B` 5.48:1 light / `#E0573F` 4.71:1 dark |
| **multiple linked** | `expensesForStop(...).length > 1` | sum of effectives + `×2` in `P.ink3` 11px | as above, over if any is over |

Amount shown = `itemEffectiveMinor` semantics (`utils/budget.js:126–127`), which is the same rule `rollup()` uses — so the card can never disagree with `/trip/budget/:tripId`.

**Vocabulary boundary with Phase C.** `P.danger` here means *this stop cost more than I planned for it*. Phase C's `over` means *the trip exceeded its total* and is expressed with `alertTriangle` + a progress bar on the overview and dashboard cards. There is no trip-level signal on a stop card at all, so the token is reused without ambiguity within this surface. The `alertTriangle` glyph is deliberately **not** used at 12.5px.

**Tap → the stop-bound `ExpenseSheet`** — the same one `⋯ → עריכת עלות` opens (`EditorView.jsx:3931–3950`). `aria-label="עלות: 120 שקלים, שולם"` / `"עלות: 150 שקלים, מעל המתוכנן 120"`.

**Adding a first cost stays in `⋯`.** An "+ הוסף עלות" ghost on every card in the itinerary is precisely the clutter the register bans, for an action performed once per stop at most.

### 4.6 Files

`Icon paperclip 12px` + count, always numeric (`◫1`, not a bare clip). Replaces the N black pills at `:1010–1016`.

| Count | Tap |
|---|---|
| 1 | `AttachmentViewer` on that file — the existing `onOpenAttachment(f, idx, 0)` path, zero new plumbing |
| >1 | `TripFilesSheet` with a new `focusStop={{ day, stopIdx }}` prop that scrolls to and highlights that stop's rows. The sheet's rows already carry `row.stopName` and `row.stopIdx` (`TripFilesSheet.jsx:116,132`), so this is a scroll-and-highlight, not a new grouping |

This is the third D2 חלק 2 line item ("צירוף → גיליון הקבצים") landing in the right place: the card *reports* files, the files sheet *manages* them.

### 4.7 The connector — transit chip redesign

The chip stops being an island and becomes a **connector on the axis**.

```
        │
     ◔ 7 דק׳ · 543 מ׳  ⌄        ← 28px tall pill, centred on the axis
        │
```

| Property | Value |
|---|---|
| Axis line | `2px` wide, `P.line`, runs the full gap height, centred — the same track the insert `+` uses at `:647`, with `#E4E4E8` replaced by the token |
| Chip bg | `P.surface` (`#F6F6F4` / `#1F242A`), **no border** |
| Radius | `999` |
| Visible height | `28px`; **hit box 44px** via `padding-block:8px` on the button, visible pill drawn on an inner span |
| Content | `Icon` for the mode (13px) + `7 דק׳` `12px/700 P.ink2` + `·` `P.ink4` + `543 מ׳` `12px/600 P.ink3` + `Icon chevronDown 11px P.ink3` when editable |
| Mode icons | `walk` *(new glyph)* · `car` · `train` · `bus` — all from `Icon.jsx`; the emoji at `:254` and `:310` are deleted |
| Overridden mode | `seg.overridden === true` → the **icon** takes `P.accent` (3.54:1 on `surface` — passes the 3:1 graphics floor). The full accent **border** at `:268` is deleted: heavy accent on a passive indicator |
| Hover inversion | **deleted** (`:251`, `:255–258`, `:269–270`). It is unreachable on the target device and creates a second visual vocabulary |
| Active | bg `P.surface2` |
| Focus-visible | `outline: 2px solid P.accent; outline-offset: 2px` |
| Read-only | renders as a `<span>`, no chevron — as today (`:319`) |
| Semantics | `aria-haspopup="menu"`, `aria-expanded`, `aria-label="7 דקות הליכה, 543 מטר — שינוי אופן המעבר"` |

**Mode menu** (`:288–316`): 4 items, each **48×56** — `Icon 20px` above a **visible** Hebrew label `10px/700`. Selected: bg `P.ink`, fg `readableInkOn` , `aria-checked`. Unselected: bg `P.surface`, fg `P.ink2`. Popover bg `P.panel`, `1px solid P.line`, radius `16`, `tpScaleIn` 0.22s. Today's labels live only in `title` (`:302`) — they become visible text.

**First / last stop:** no connector above the first card, none below the last. After the last card the axis terminates with a `4px` `P.line` dot, `margin-block-start: 6px` — a quiet full stop that makes the day feel bounded without inventing a "end of day" component.

### 4.8 Insert `+` on the axis

Keep the camouflaged treatment (it is deliberate and correct) but fix the target: visible glyph stays ~18px, the `<button>` becomes `44×44` with `background:transparent`, colour `P.ink3` (was `T.ink3` — already fine), track colour tokenised. Label unchanged (`aria-label="הוספה כאן"`, `title="הוספת הערת ביניים או מעבר"`).

### 4.9 Breakpoints

| Width | Behaviour |
|---|---|
| **≤ 359px** (SE, small Android) | `ניווט` drops its label → icon-only `44×44` with `Icon navigation`. This is the one place the icon stands alone, and the navigation arrow is the category-universal glyph. `aria-label` and `title` unchanged. Metadata wraps to 2 lines freely |
| **360–479px** (the common case) | Exactly as specified above |
| **≥ 480px** (large phones; sheet `max-width: 720`) | Metadata stays one line in practice; note preview clamps to **2** lines |
| Desktop | Out of scope. But see §8.7 — the extracted component is built so `EditorDesktop.jsx` can adopt it later |

### 4.10 Spacing summary (8-pt grid, 4-pt half-steps)

`card padding 10/12` · `badge→name gap 8` · `RowA→RowB 8` · `RowB→RowC 8` · `metadata item gap 8, row-gap 4` · `card→card 8` · `connector block 6/0`.

---

## 5. States

### 5.1 Sparse — the case that must still look intentional

A stop with a name, no rating, no cost, no files, no note, no category (rare — most write paths default to `"אטרקציה"`).

```
┌──────────────────────────────────────────────────┐
│ ▣2   שוק התבלינים            [◈ ניווט]   [ ⋯ ]  │
└──────────────────────────────────────────────────┘
```

Two rows, ~68px, perfectly balanced: badge left-aligned to the reading edge, name filling the line, two controls trailing. **No empty metadata strip, no placeholder dashes, no "אין מידע".** It reads as a short card, not a broken one. This is also the first-run state (§5.5).

### 5.2 Dense — the power case

Rating + cost over plan + 3 files + a 2-line note, in trip mode, on a hotel.

```
┌──────────────────────────────────────────────────┐
│ 🛏   מלון בורג' אל ערב         [◈ ניווט]  [ ⋯ ]  │
│ מלון · 3 לילות · ★ 9.6/10 · ✓₪2,400 · ◫3        │
│ 📄 צ'ק-אין מ-15:00, ביקשתי חדר גבוה             │
└──────────────────────────────────────────────────┘
```

~132px. The only non-neutral colours: the accent bed badge and the `P.danger` amount if it went over. Everything else is the three-step ink ramp.

### 5.3 Cost states

Enumerated in §4.5. The teaching content of each: *planned* says "I budgeted for this"; the `check` says "I actually paid"; `P.danger` says "it cost more than I said" — never "the trip is over budget", which is a different screen's job.

### 5.4 Empty day

Replaces `"אין תחנות ביום זה עדיין"` (`EditorView.jsx:3820`), which states a fact and teaches nothing.

- `Icon pin 28px` in `P.ink4`
- Title `15px/800 P.ink2` — `היום הזה עוד ריק`
- Body `13px/500 P.ink3`, max ~40ch — `חפשו מקום בשורת החיפוש למעלה, או הוסיפו מהבנק`
- Primary `הוספת תחנה` (44px, `P.ink` fill) — the existing `openAddStop`
- No trip at all → unchanged (`"התחילו להוסיף תחנות למסלול"`), same treatment

### 5.5 First run

A trip with one stop from the wizard: one sparse card (§5.1) plus the empty-state's primary button below it, no connector, no metadata line. Deliberately identical to the sparse state — no onboarding overlay, no coach marks. `DESIGN.md` motion and the register both argue against an orchestrated first-load.

### 5.6 Loading

Three skeleton cards, not a spinner:

- Card shell at the real geometry: `P.surface` fill, `1px solid P.line`, radius 14, height 76
- Inside: a `32×32` radius-8 block (badge), a `60%×14` block (name), a `40%×10` block (metadata) — all `P.surface2`, radius 6
- Enter with `tpFade` 0.4s, **no shimmer** — there is no shimmer keyframe in `index.css` and adding decorative motion to a loading state violates the register
- `aria-busy="true"` on the list, `aria-live="polite"` announcing `טוען מסלול…`
- Reduced motion: static blocks

### 5.7 Read-only / shared trip (`editable === false`)

| Element | Behaviour |
|---|---|
| Card tap → map | ✅ kept |
| `ניווט` | ✅ kept — a view action, correctly ungated today at `:942` |
| `⋯`, drag, swipe, long-press | absent |
| Note preview | renders, **not** interactive (no button role, no expanded hit box) |
| Files chip | renders, opens the viewer read-only |
| **Cost** | renders **only if the trip's budget is shared**. Gate on the `budgetShared` setting Phase C owns; if it is falsy or absent, the cost item is omitted entirely. Referred to `budget-domain` (§9) |
| Connector chip | `<span>`, no chevron |

### 5.8 Dragging

- Dragged card: `transform: scale(1.02)`, `box-shadow: 0 10px 30px rgba(0,0,0,0.16)` light / `0 10px 30px rgba(0,0,0,0.55)` **plus** `border-color: P.accent` dark — the shadow alone is invisible on `#0E1012`
- Background stays `P.panel` (today the border goes `transparent` at `:887`, which makes the card bleed into the sheet)
- `transition: none` while dragging (already correct at `:892`)
- Non-dragged siblings: no motion — the current implementation reorders the array, which is the right model
- Reduced motion: drop the scale, keep the shadow/border

### 5.9 Error

The card itself has no fetch. Two real failure modes:

- **Attachment fails to open** → the existing toast pattern, `לא הצלחנו לפתוח את הקובץ`, chip stays
- **Cost write fails** → `ExpenseSheet` owns it; the card re-renders from `trip.data` so it simply shows the old amount. No optimistic-then-revert flicker on the card

### 5.10 Focus / keyboard

Tab order per card: badge → name/card body → `ניווט` → `⋯` → cost → files → note. All get `outline: 2px solid P.accent; outline-offset: 2px`. **Reorder by keyboard remains unsupported** — that is the status quo (`onPointerDown` only, `:972`), not a regression introduced here; the accessible equivalent is `⋯ → העברה ליום…`, which exists.

---

## 6. Interaction model

### T1 — See what a stop costs *(new; the owner's #1 gap)*

**Entry** open the day → **Action** none → **Feedback** the amount is on the card, in `<Money>`, tabular, bidi-isolated → **Exit** none.
Reading a number requires zero taps. That is the whole point.

### T2 — Edit an existing cost

**Entry** tap the amount in the metadata line → **Action** the stop-bound `ExpenseSheet` opens (`tpSlideUp` 0.34s) prefilled → **Feedback** save → sheet closes → the card's amount updates in place; if the edit crosses a Tier-1 boundary the existing `budgetConfirm` dialog (`EditorView.jsx:3971+`, z320) fires first, unchanged → **Exit** ✕ or backdrop.
**Undo:** none needed — the sheet is a form with an explicit save, and the Tier-1 confirm already guards the irreversible cases. This matches the shipped pattern; no parallel mechanism is introduced.

### T3 — Add a first cost

**Entry** `⋯` (or long-press) → `הוסף עלות` → **Action** `ExpenseSheet` → **Feedback** on save the card grows a metadata item, which *is* the confirmation F19 said was missing → **Exit** as T2.

### T4 — Read / edit a note

**Entry** the preview line is visible on the card; tap it → **Action** `NoteSheet` → **Feedback** save → the preview text updates; if the stop is a multi-day hotel the existing `saveNoteAt` cascade prompt appears (see §3.3) → **Exit** ✕.
First note: `⋯` → `הערה`. One tap deeper than today — see §7.2.

### T5 — Open a file

**Entry** tap `◫N` → **Action** N=1 → `AttachmentViewer`; N>1 → `TripFilesSheet` focused on this stop → **Feedback** immediate → **Exit** ✕ returns to the same scroll position.

### T6 — Reorder

**Entry** press the badge (or long-press the card body, unchanged) → **Action** move; the badge shows a 3px accent ring, the card lifts → **Feedback** live reorder, numbers renumber as you pass → **Exit** release → `onReorder` → persist.
**Undo:** none today; not introduced here. Reorder is trivially reversible by dragging back, and this repo's undo pattern is reserved for destructive/money actions.

### T7 — Navigate

**Entry** tap `ניווט` → **Action** `mapsUrlFor(a)` via the single resolver (`utils/mapsUrl.js`) → new tab → **Feedback** OS handoff → **Exit** back gesture.

### T8 — Change how you get to the next stop

**Entry** tap the connector chip → **Action** popover, 4 labelled 48×56 targets → **Feedback** pick → popover closes, chip's icon and minutes recompute inline, icon takes `P.accent` to mark the override → **Exit** tap-away.

### T9 — Delete / move to bank

**Unchanged.** Swipe docks the coloured zone; tapping the zone commits; the existing money-aware undo toast fires (`הנקודה נמחקה · ההוצאה ₪120 עברה ל'כללי'`, 5s / 10s). One string fix belongs to `copywriter`, not here: the non-money fallback at `:4069` reads `"הנקודה נמחקה — האם למחוק את הנקודה?"` (F17).

### T10 — Everything else

**Entry** `⋯` **or** long-press → the *same* `StopActionsSheet` → per D2 חלק 1's sections.

---

## 7. What gets deleted

### 7.1 Controls

| # | What | `file:line` | Why |
|---|---|---|---|
| 1 | Drag handle `≡` | `:970–977` | 24×30, `ink4` at 2.34:1, and a second representation of position. The badge does it |
| 2 | Note button | `:954–961` | 30×30. The card now shows note *state*; creation moves to `⋯` |
| 3 | Separate completion checkbox | `:922–928` | 26×26. Merged into the badge in trip mode |
| 4 | `העבר ליום הבא` inline button | `:983–988` | A whole extra row of chrome for an occasional trip-mode action. Becomes the first row of the `⋯` schedule section in trip mode |
| 5 | Per-attachment pills ×N | `:1010–1016` | N black blocks → one counted item |
| 6 | The note ticket's grey block + `"הוספת הערה…"` ghost | `:995–1008` | Card-inside-card; the ghost appeared for the wrong reason (an attachment) |
| 7 | The entire long-press context menu | `:4000–4058` (~58 lines) + `THEMES` (`:4005`) + `ctxSub` state | F1. Long-press routes to `StopActionsSheet` |
| 8 | `TransitRail` hover-inversion + `hover` state | `:247`, `:251`, `:255–258`, `:269–270` | Unreachable on touch |
| 9 | `▾` text glyph | `:261` | → `Icon chevronDown` |
| 10 | Emoji mode glyphs | `:254`, `:310`, `RAIL_MENU:240–245` | → `Icon` names |
| 11 | Accent border on an overridden segment | `:268` | Heavy accent on a passive indicator |

**Persistent controls per card: 4 → 2** (plus the badge, which absorbed two more). **One whole menu component gone.**

### 7.2 The contradiction I am proposing, stated out loud

Deleting the note button contradicts a shipped decision. `EditorView.jsx:952–953` documents it: *"Sprint 62 #3 — direct quick-note trigger: opens the NoteSheet for THIS stop without the 3-dots detour."* Adding a **first** note goes from 1 tap to 2.

Reasons I am doing it anyway:
1. The problem Sprint 62 #3 solved was *"I can't tell if this stop has a note and I can't get to it"*. The note preview line solves that better, permanently, and for reading as well as writing.
2. The button was 30×30 and could not survive the 44×44 requirement in a row that must also gain a metadata line. Something has to leave.
3. Every other content action for a stop (cost, colour, attach, lodging) already lives in `⋯`. Keeping exactly one of them promoted is the inconsistency the register calls out.
4. Long-press — now unified — gives a second one-gesture route to the same sheet.

**If the owner disagrees**, the cheapest reversal is to keep the note button *only* when `!note && editable`, i.e. a genuinely contextual add-affordance. I do not recommend it (a control that appears when something is *absent* is the harder mental model), but it is a two-line change.

**Owner decision (2026-09-11): confirmed — proceed with deletion as specified.** First-note-add goes through `⋯` (or the unified long-press). The contextual-affordance fallback above is not being implemented; keep it documented only as the known reversal path if this tests badly.

### 7.3 Hard-coded colours retired

`#ECECEF` `#F0F0F3` `#fff` (`:886–887`, `:958`, `:966`, `:1001`) · `#111114` (`:914`) · `CHARCOAL #1E1E24` (`:862`, `:948`, `:1013`) · `CORAL #FF6B6B` (`:863`, `:936`, `:938`) · `#E4E4E8` (`:647`) — all → `P.*`. `#1FA67A` (`:925`) survives as a named semantic success token; `design-systems` should adopt it into `theme.js` rather than leave it inline.

---

## 8. Migration risk

### 8.1 The badge now carries three meanings

Position indicator + drag handle + (trip mode) completion toggle. This is the single riskiest decision in the spec.

- **Why it is defensible:** a checkbox showing a number and then a check *is* the state changing — that is what checkboxes do, and it is not the F13 anti-pattern (an icon changing identity to mean a different action).
- **What could break:** tap-vs-drag disambiguation. Mitigated by using the exact 6px threshold `SwipeableRow` already uses (`:405`), so the two gesture engines cannot disagree.
- **Fallback if it tests badly:** keep a separate completion control in Row A trailing and accept three trailing controls in trip mode only. Documented so `builder` doesn't have to re-decide under pressure.
- **Test:** `T-CARD-01` tap badge in trip mode toggles complete; `T-CARD-02` tap badge in planning mode does nothing and does not fly the map; `T-CARD-03` press-and-move from the badge starts a drag.

### 8.2 Whole-card tap zone

Today only the name div is tappable (`:908–919`); the spec makes the container tappable. Every interactive child already calls `stopPropagation` (`:923`, `:946`, `:956`, `:964`, `:997`, `:1011`) — the new cost and files buttons must too. `SwipeableRow`'s `onClickCapture` swallow (`:449–454`) interacts with this: verify a docked swipe zone still wins.
**Test:** `T-CARD-04` tapping the cost item opens `ExpenseSheet` and does **not** fly the map. `T-CARD-05` a trailing click after a swipe/drag is still swallowed.

### 8.3 `costForStop` returns only the first expense

`useEditorState.js:178–181` and `EditorView.jsx:2167–2170` both do `expensesForStop(items, stopId)[0]`. The card spec asks for a **sum**. If `builder` implements the sum on the card while `StopActionsSheet`'s `stopCostLabel` keeps showing `[0]`, the two disagree in the same session — exactly the "indicator surfaces drift apart" failure `budget.js:120–122` warns about.
**Required:** one derived helper used by both. Referred to `budget-domain` (§9).
**Test:** `T-CARD-06` two expenses on one stop → card total equals the sum of effectives and equals what the `⋯` row says.

### 8.4 Legacy stops have no `instanceId`

`costForStop(stop.instanceId)` with `undefined` returns `[]` via the guard at `budget.js:355`, so no crash — but a legacy stop can never show a cost. Acceptable; the same limitation already applies to setting one.
**Test:** `T-CARD-07` a stop with no `instanceId` renders without a cost item and without a console error.

### 8.5 Rating normalisation is a display-time change with a real edge case

Normalise at render, not by rewriting stored data:
- string ending `"/10"` → parse the leading number, scale = 10
- bare number `≤ 5` → Google 0–5, multiply by 2
- bare number `> 5` → already /10
The edge case: a genuine `"5/10"` stored as the bare number `5` renders as `10/10`. Only the two unnormalised writers (`EditorView.jsx:1611`, `:1979`) can produce bare numbers, and both take Google's 0–5, so in practice the case does not arise — but **fix the writers too**, via `ratingToBadge` (`utils/classify.js:75`), so the ambiguity stops being created.
**Test:** `T-CARD-08` nearby-add produces `"9.2/10"` on the card, not `"4.6"`.

### 8.6 Dark mode — deliberately staged

`EditorView.jsx` has no `useDarkMode`. If the card alone goes dark while the sheet, day header, section labels and map chrome stay light, the result is worse than all-light.

**Decision:** thread `P` through the card, connector and empty state now; `EditorView` passes the `LIGHT` literal. **Zero visual change in this release.** When `design-systems` lands the editor dark pass, the flip is `const { P } = useDarkMode()` in one place. The dark values in this spec are normative and must be implemented, just not switched on.
**Also in that later pass, not this one:** `StopActionsSheet.jsx:23–26` local palette and `:98` `background:"#fff"`; `TripFilesSheet dark={false}` override (`:4882`); `ReferenceMapsPanel`/`OverlayAddChoice` `dark={false}`.

### 8.7 `EditorView.jsx` has no Jest harness

The file is 4,785 lines with no test coverage of `renderPlaceRow`. **Extract the card to `src/components/StopCard.jsx`** — a pure presentational component taking `{ stop, pos, P, editable, tripActive, cost, onNavigate, onOpenActions, onEditNote, onOpenFiles, onToggleComplete, onDragStart }`. Three wins: it becomes testable like `StopActionsSheet.test.js` and `EditorBottomBar.test.js` already are; it removes ~180 lines from `EditorView`; and `EditorDesktop.jsx` can adopt it later instead of forking a third card.
Same for the connector → `src/components/TransitConnector.jsx`.

### 8.8 Merged note path changes hotel behaviour

Per §3.3, `StopActionsSheet`'s note row moves from `setStopNote` to `saveNoteAt`, which adds the multi-day cascade prompt to a path that previously wrote silently.
**Test:** `T-CARD-11` editing a note on a multi-day hotel via `⋯` raises the cascade prompt; via long-press it behaves identically.

### 8.9 Other regression tests

- `T-CARD-09` read-only trip: no `⋯`, no drag, no swipe; `ניווט` present; cost hidden unless the budget is shared
- `T-CARD-10` long-press opens `StopActionsSheet` and the old `ctxMenu` is unreachable from anywhere
- `T-CARD-12` RTL: no `left`/`right` literal anywhere in the new components; `navigation` and `chevronDown` sanity-checked under `dir="rtl"`
- `T-CARD-13` 320px viewport: metadata wraps, `ניווט` is icon-only, nothing clips
- `T-CARD-14` the last card clears the `EditorBottomBar` — sheet scroll container keeps `padding-bottom: calc(barHeight + max(16px, env(safe-area-inset-bottom)))`

### 8.10 New `Icon.jsx` glyphs — `design-systems`

`Icon.jsx` ships 51 icons; three are missing:

| Name | Shape | Used by |
|---|---|---|
| `paperclip` | Lucide paperclip | files item (replaces `📎` ×8 across the file) |
| `navigation` | Lucide navigation arrow (filled triangle) | `ניווט` button, icon-only at ≤359px |
| `walk` | person walking | connector chip + mode menu (replaces `🚶`) |

`car`, `train`, `bus`, `star`, `clock`, `note`, `check`, `bed`, `more`, `chevronDown`, `pin` all exist. Phase C separately requests `alertTriangle`; not needed here.

---

## 9. Open questions

### Q1 — Open hours: interim manual field, or wait for the data? **Decided 2026-09-11 — (a) Wait, per `product-designer`'s recommendation.**

The layout reserves the slot (§4.3 ⑤) and nothing renders today. Two paths:

- **(a) Wait.** Slot stays dark until a Places-backed `openHours` lands. That work is `docs/ROADMAP.md` → רעיונות #1 and is **unscheduled**. Cost now: zero.
- **(b) Interim manual field.** A `שעות פתיחה` text row in `StopActionsSheet` next to `עלות`, free text (`"09:00–18:00"`, `"סגור בשבת"`), rendered verbatim in the slot with no parsing, no "open now" logic, no timezone. Cost: ~1 row in the sheet, ~1 line on the card. Risk: users will expect it to *know* whether the place is open now, and it won't.

I lean **(a)** — a manual hours field that can't say "open now" is the kind of half-feature that generates support questions, and the note field already absorbs this use case today (`StopActionsSheet.jsx:225` literally suggests `"פתוח עד 18:00"` as its placeholder). But (b) is cheap and the owner named open-hours as a gap, so this is the owner's call, not mine.

**Owner decision (2026-09-11): confirmed (a).** No interim manual field. §4.3 item ⑤ ships as a reserved-but-dark layout slot; it renders only once a Places-backed `openHours` source exists, tracked as the unscheduled ROADMAP רעיונות #1 dependency — not part of this implementation.

### Referred, not open

| To | Question |
|---|---|
| `budget-domain` | (1) Sum-of-effectives vs `[0]` on the card, and the one shared helper both the card and `stopCostLabel` must use (§8.3). (2) Confirm `itemEffectiveMinor` is the right number to show. (3) The read-only gate — is `settings.budgetShared` the correct flag for §5.7? |
| `design-systems` | The 3 glyphs (§8.10); adopting `#1FA67A` as a `success` token; the editor dark-mode flip (§8.6) |
| `copywriter` | All Hebrew strings here are placeholders pending review — especially the empty-state pair (§5.4) and the `aria-label`s in §4.5 |
| `qa` | `T-CARD-01..14`; these ride with the on-device round already queued in `docs/ROADMAP.md` |
