# Mobile Editor — UX Critique (2026-09-06)

**Agent:** `ux-critique` · **Scope:** `src/views/EditorView.jsx` (`/map/edit/:tripId`, mobile) — read-only heuristic audit, no redesign, no code changes. Run before any editor redesign work, per this project's process.

**Method:** heuristic evaluation + task-flow walkthrough over the full 5,091-line file, `StopActionsSheet.jsx`, `EditorBottomSheet.jsx`, `EditorSearchBar.jsx`, `Icon.jsx`, `docs/QA-TEST-PLAN.md`'s editor-related sections, and `WORKLOG.md`'s tail. Contrast ratios are computed (WCAG relative luminance), not eyeballed. This pass is additive to a prior `ux-critique` round recorded in `docs/superpowers/plans/2026-09-06-redesign-landing-and-mobile-editor.md` §7 (E1–E13 / N1–N20), re-verified at current line numbers rather than re-run from scratch.

---

## 1. Control inventory — the primary editor surface

Interactive affordances rendered on `/map/edit/:tripId` **before opening any sheet**. Conditions are the actual render guards.

| # | Control | `file:line` | Label | aria-label | Does | Renders when |
|---|---|---|---|---|---|---|
| 1 | Home | `EditorView.jsx:3381` | icon-only `home` | `יציאה` | exit to dashboard **or** clear focus mode | `trip && !summaryOpen` |
| 2 | Search omnibox | `:3392` | placeholder | — | Places autocomplete → preview card | `+ editable && !isPinning` |
| 3 | "צפייה בלבד" banner | `:3408` | text | — | non-interactive | `!editable` |
| 4 | Favorite ⭐ | `:3415` | icon | via child | bookmark public trip | `isPublicView` |
| 5 | Trip files | `:3438` | emoji-only 🗂️ | `קבצי הטיול` | opens TripFilesSheet (z380) | `trip` |
| 6 | Budget | `:3464` | text glyph `₪` | `הוספת הוצאה מהירה` / `תקציב הטיול` | **quick-add expense** if editable, **navigate to budget** if not | `trip` |
| 7 | Stand-down 🛑 | `:3526` | emoji + text | `סגירת מצב שטח` | clears active trip | `isActiveTrip` |
| 8 | Map lock | `:3191` | icon-only `lock`/`unlock` | `נעילת מפה` | freeze pan/zoom | `trip && !isPinning && !inboxMode && !overlayOpen && !mapFabsHidden && !inboxCardMenu && !refMapsOpen` |
| 9 | Saved-points layer | `:3227` | icon-only `eye` | `שכבת נקודות שמורות` | project bank pins | same as 8 |
| 10 | Reference maps | `:3252` | icon-only `layers` | `מפות נוספות` | load another map as overlay | same as 8 `+ editable` |
| 11 | Compass | `:3275` | emoji-only 🧭 | `איפוס כיוון הצפון` | reset bearing | same as 8 `+ Math.abs(mapBearing) > 1` |
| 12 | Bank FAB | `:3552` | icon-only `folder` + count | `בנק הנקודות` | `setMode("inbox")` | `trip && !isPinning && !inboxMode && !focusActive && !overlayOpen && !mapFabsHidden && !refMapsOpen && sheetSnap === "peek"` |
| 13 | Options FAB | `:3623` | icon-only `wrench`→`x` | `תפריט פעולות` | toggle speed dial | same as 12 |
| 14 | Day-reorder FAB | `:3657` | icon-only `arrowUpDown`→`check` | `סידור ימים` | enter day-reorder lock | same as 12 `+ editable && days.length > 1` |
| 15 | Continuous FAB | `:3667` | icon-only `listOrdered`→`calendar` | `מסלול רציף` | flatten to one list | same as 14 |
| 16–20 | Speed-dial items ×5 | `:3607`, `:3610`, `:3611`, `:3612`, `:3613` | icon + text | — | expand sheet / skeleton editor / summary / **continuous route (dup of #15)** / dates | `fabOpen` |
| 21 | Day chips ×N | `:3745` | number + date | — | select day (always collapses sheet) | `days.length > 0 && !continuousMode` |
| 22 | Sheet expand/collapse | `:3821` | text glyph `⌄` | `פתיחה`/`צמצום` | peek ⇄ full | always |
| 23 | Filter trigger | `:130` | 🏷️ emoji + `סינון מפה` | — | expand category chips | `!sheetCollapsed` |
| 24–27 | Category chips ×4 | `:145` | text | — | filter + force sheet to full | `filterOpen` |
| 28 | Day-complete checkbox | `:3966` | icon-only `check` | labeled | mark day done | `tripMode` |
| 29 | AddMenu (header) | `:4004` | icon-only `plus`, **28×28** | `הוספה למסלול` | opens 2-item menu | `editable` |
| 30 | AddMenu (fab) | `:4052` | icon-only `plus`, 52px | `הוספה למסלול` | **same handlers as #29** | `editable` |
| 31–32 | AddMenu items ×2 | `:206–207` | 📍/✈️ + text | — | add location / add transit | menu open |
| 33 | Card body tap | `:907` | — | — | fly map + open detail card | has coords |
| 34 | Stop completion ✓ | `:922` | icon-only, 26×26 | labeled | mark visited | `tripActive \|\| liveOps` |
| 35 | ניווט | `:944` | icon + text | labeled | open Google Maps | `hasNav` |
| 36 | Note | `:954` | icon-only `note`, 30×30 | labeled | NoteSheet | `editable` |
| 37 | ⋯ actions | `:962` | icon-only `more`, 30×30 | `פעולות` | StopActionsSheet | `editable` |
| 38 | Drag handle | `:970` | text glyph `≡`, **24×30** | *(title only)* | reorder | `editable && pos != null` |
| 39 | "העבר ליום הבא" | `:983` | icon + text | — | move forward | `tripActive && !done` |
| 40 | "העבירו ליום המחרת" | `:988` | icon + text | — | rollover | **`liveOps && !tripActive` — never true (see F7)** |
| 41 | Note ticket | `:1000` | text | — | edit note | note or attachment exists |
| 42 | Attachment pill 📎 | `:1016` | emoji-only | file name | open viewer | attachments exist |
| 43 | Insert "+" | `:647` | text `+`, **30×22, transparent** | `הוספה כאן` | **adds a note/transit, not a place** | `editable && onInsertAt` |
| 44 | Transit rail capsule | `:277` | mode + minutes | — | open mode menu | 2+ consecutive stops |
| 45–48 | Transit modes ×4 | `:300` | emoji-only, 34×34 | *(title only)* | set commute mode | rail menu open |
| 49 | Swipe-left zone | `:455` | 🗑️ + `מחיקה` | `מחיקה מהמסלול` | delete + 5s undo | docked left |
| 50 | Swipe-right zone | `:455` | 📥 + `העבר לבנק` | `העברה לבנק הנקודות` | move to bank + 10s undo | docked right |
| 51 | Long-press | `:1067` | *no affordance* | — | opens a **second, different** 7-row menu | 340 ms hold |

**≈51 distinct affordance declarations** on the base surface, ~30+ rendered instances on a 5-stop day, before opening `StopActionsSheet` (15–21 more controls) or any of the 13 child sheets.

**`StopActionsSheet` (⋯) contents** — `StopActionsSheet.jsx:213–267`: 15 rows (16 with an attachment) + 5 colour swatches = **20–21 controls in one bottom sheet**, in 3 sections. The component's own comment at `:97–100` documents that it is "taller than a phone viewport."

**Z-index inventory:** 35 distinct values across 13 files (`0,1,5,10,20,21,29,40,41,50,55,58,60,62,64,70,92,96,97,101,108,110,120,130,150,205,210,240,250,259,260,300,310,320,380,400`) with no named scale. Rationale comments have drifted from reality: `EditorBottomSheet.jsx:129–131` says the map FABs are "z45/46"; they are z260 (`EditorView.jsx:3563,3599,3650`).

---

## 2. Findings, ranked

### P0

#### F1 — Two different contextual menus for the same stop, with four behavioural divergences

`⋯` opens `StopActionsSheet` (`EditorView.jsx:4994`). A 340 ms long-press opens a *different* menu (`:4299–4357`). Seven actions overlap:

| Intent | long-press label | ⋯ label | Same behaviour? |
|---|---|---|---|
| note | `הוספת הערה` `:4342` → `setNoteEditIdx` | `הוספת הערה` `StopActionsSheet:254` → `onSetNote` | **No.** Long-press → `saveNoteAt` `:2035` raises the multi-day cascade prompt. ⋯ → `setStopNote` `:2535` writes silently to this instance only. |
| colour | `שינוי צבע / נושא` `:4347` → 7 swatches, 40px, `THEMES` `:4304` | `צבע הכרטיס` `StopActionsSheet:233` → 4 swatches, 26px, `PASTELS` `:29` | **No.** Zero colours in common — a colour set in one menu shows no selected state in the other. |
| lodging | `הגדרה כעוגן לינה` `:4349` → `toggleLodgingAnchorAt` `:1924` | `הגדר/בטל כנקודת לינה` `StopActionsSheet:250` → `setStopAsLodging` `:2416` | **No.** ⋯ enforces a 2-per-day cap (`:2424`) and **fails silently** — the sheet closes exactly as on success. Long-press has no cap. |
| delete | `מחיקת הנקודה` `:4351` → `deleteStopAt` `:1803` | `מחיקה מהמסלול` `StopActionsSheet:266` → `deleteStop` `:2500` | **No.** Long-press gives a 5-second undo (`:4360`). ⋯ has **no undo at all**. |
| move-to-day | `העברה ליום…` → `moveStopIndexToDay` `:1905` | `העברה ליום אחר` → `moveStopToDay` `:2385` | Same logic, two functions (both separately patched for the same `dedupeDayStops` bug — see WORKLOG 2026-09-06). |
| duplicate / attach | identical labels | identical labels | Same handler. |

**Heuristic:** consistency & standards; error prevention; recognition over recall.
**Consequence:** the more discoverable path (⋯) is the *more dangerous* one — deleting a stop from ⋯ is irreversible while the same delete via long-press gives five seconds to undo, and nothing says so.

#### F2 — The entire secondary action layer is invisible on first load

`EditorBottomSheet` defaults to `defaultSnap="half"`. All three FAB clusters require `sheetSnap === "peek"`. On a freshly-opened trip, **the bank, the options menu, the trip summary, the dates editor, the skeleton editor, day-reorder and continuous route are all unmounted**, with nothing indicating they exist. `EditorBottomSheet.jsx:112–121`: `half` "exists solely as the initial-load orientation default and is never a drag rest-point" — the first screen the user sees is a state they can never return to.

**Consequence:** a first-time user has no path to the trip summary, dates, or the points bank without accidentally collapsing the sheet.

#### F3 — Moving a stop to the bank is only reachable by an untaught gesture

`requestInboxAt` is wired **only** to `SwipeableRow`'s right-swipe. No "העבר לבנק" row exists in `StopActionsSheet`, none in the long-press menu, none on the card. The onboarding dialog explains only Google search.

**Consequence:** the points bank — a headline feature with its own FAB, count badge, two tabs, a map overlay and a Supabase migration behind it — has no discoverable way to *put anything in it* from the itinerary.

#### F4 — No exit from "מסלול רציף" except the Home button

When `continuousMode` is on, all three FAB clusters unmount (require `!focusActive`), the day strip becomes a static label, and the sheet snaps to `full`, covering the map. Remaining exits: the **Home button** (everywhere else means "leave the editor"), tapping empty map (covered by the sheet), or focusing the search bar.

**Consequence:** the only visible way out of a full-screen mode is a button labelled "go home."

#### F5 — Contrast: city colour is the most prominent text in the editor and every value fails

`cityColor()` drives the active-day header at 17px/800 (not WCAG "large," which needs 18.66px bold). Computed against `#FFFFFF`:

| City | Ratio | | City | Ratio |
|---|---|---|---|---|
| Tokyo `#8B7BC7` | 3.65 | | Hiroshima `#D67B7B` | 3.01 |
| Matsumoto `#6E8BC4` | 3.41 | | Takayama `#7FA05A` | 2.97 |
| Hakone `#4E9E94` | 3.16 | | Fukuoka `#C4886E` | 2.96 |
| Kanazawa `#C77BA6` | 3.08 | | Nagoya `#C79A4E` | 2.57 |
| Kyoto `#5FA36A` | 3.03 | | Nikko `#7BAF8A` | 2.52 |
| | | | Osaka `#E0915A` | 2.51 |
| | | | Sapporo `#6FB0C4` | 2.42 |
| | | | Nara `#C7A24E` | 2.41 |

All 13 fail 4.5:1; nine also fail 3:1. The fallback `cityHashColor` = `hsl(hash % 360, 48%, 58%)` ranges **1.78:1 to 5.22:1** — for every non-Japanese destination, legibility of the editor's largest label is decided by a hash of the city name. Same values used as backgrounds under hard-coded white text (`:3322`, `:3462`, `:3926`) and as foreground (`:3876`, `:4485`); only `:3939` correctly derives foreground via `readableInkOn`.

#### F6 — Dark mode does not exist on this surface

Zero `useDarkMode` usages in `EditorView.jsx`. Every colour is hard-coded. Three theme-aware children are explicitly forced light: `ReferenceMapsPanel dark={false}` (`:4814`), `OverlayAddChoice dark={false}` (`:4828`), `TripFilesSheet dark={false}` (`:4882`) — `TripFilesSheet.jsx` reads `useDarkMode()` and would theme correctly if not overridden. `StopActionsSheet.jsx` duplicates a light palette locally and hard-codes `background:"#fff"`.

**Consequence:** a user in dark mode gets a full-brightness flash going Dashboard → Editor, and dark again on Editor → `/trip/budget/:id` (which does use the hook).

---

### P1

#### F7 — Seven dead code paths, one an entire unreachable modal branch

| What | Evidence | Size |
|---|---|---|
| `pendingStop` routing modal unreachable | `addFromPlace`/free-text paths return early when `onPreview` is set | ~31 lines (`:4156–4186`) |
| `assignCard` card unreachable | `setAssignCard` only ever called with `null` | ~41 lines (`:4068–4108`) |
| `liveOps && !tripActive` never true | `liveOps={isActiveTrip}`, `tripActive={tripMode}`, `tripMode = isActiveTrip` | ~25 lines (`:988–993`, `:2336–2348`) |
| `inboxGeoFilter` permanently `null` | only ever set to `null` | ~10 lines |
| Day-chip drag-reorder unreachable | chip handlers only attach in `dayEditMode`, but that state mounts an opaque scrim with no `onClick` over the sheet | ~45 lines (`:2928–2955`, `:3742–3779`) |
| Unreachable ternaries (×3) | all three FAB clusters branch on a condition their render guard already enforces | 3 sites |
| Whole `continuousMode` else-branch of the focus modal | guard requires `dayEditMode`, which this branch can't reach | ~25 lines |

**≈180 lines of unreachable UI in one file** — the clearest structural evidence the screen has drifted past what anyone can hold in their head.

#### F8 — Seven of fifteen ⋯ actions produce no feedback whatsoever

`העברה ליום אחר`, `העתקה ליום אחר`, `העבר ליום הבא`, `פצל יום`, `זה מלון לכמה ימים`, `הגדר/בטל כנקודת לינה` (also silently no-ops at its cap), `העתקה לטיול אחר` (network write wrapped in `catch { /* best-effort */ }`) — none fire a toast. By contrast `שכפל מיקום`, `העתקת שם`, `צרף קובץ`, `הסר קובץ` all do.

#### F9 — Destructive severity: two 🗑 rows, one deletes an unnamed file with no confirm and no undo

`StopActionsSheet.jsx:258` (`🗑 הסר קובץ מצורף`) deletes `attachments[attachments.length - 1]` — the *last* attachment, chosen for the user, no file name shown, no picker, no confirm, no undo. Three different file-removal paths exist with three different behaviours (this one, the in-app viewer's, and `TripFilesSheet`'s Storage-deleting one).

#### F10 — Label ambiguity between action pairs a user cannot distinguish without trying them

`העתקה ליום אחר` (picker) / `שכפל מיקום` (immediate, same day) / `העתקה לטיול אחר` — three copy verbs. `העברה ליום אחר` (picker) / `העבר ליום הבא` (immediate) — nothing in the labels signals the difference. Across menus: `נקודת לינה` vs `עוגן לינה`; `מחיקה מהמסלול` vs `מחיקת הנקודה`; `צבע הכרטיס` vs `שינוי צבע / נושא`.

#### F11 — Grouping incoherence: the top row of "schedule management" adds new places

`StopActionsSheet`'s `ניהול לוח זמנים` section's first row is `🔍 מצא מקומות באזור` — a discovery search that adds new stops, while every other row in the section moves/copies an existing one. `runNearby` also silently unmounts the whole map-control rail (lock, eye, layers, compass) while results are shown, with no explanation.

#### F12 — Duplicate affordance: "מסלול רציף" exists twice with different labels

A speed-dial item and a dedicated FAB both toggle `continuousMode`, both render under the same conditions, ~40px apart. The speed-dial's first item (`תכנון מסלול`) always means "expand" (since the cluster only shows at `peek`), duplicating the `⌄` chevron.

#### F13 — Icon-only FABs with mismatched metaphors, and icons that change identity when active

`folder` = points bank (no map/pin semantics), `wrench` = "trip actions" (reads as settings/repair), `arrowUpDown` = reorder days (vertical arrows for a horizontal strip). Two icons swap glyph on activation — `arrowUpDown → check`, `listOrdered → calendar` (the "continuous route" icon *becomes a calendar* when continuous route is on).

#### F14 — Icon vocabulary: 53 SVGs available, ~40 emoji/text glyphs still in use

`EditorView.jsx` imports `Icon.jsx` (53 icons) and still renders 🗂️, 🧭, ⌄, ≡, 📎×8, 🗑️×6, 📝×4, 🗓️×3, ➕×3, ✕×19, ✓×12, plus `₪` as text. `StopActionsSheet.jsx` imports no icons at all and mixes text glyphs (`↪`, `⧉`) directly above emoji (`📋`, `➡️`) in one list.

#### F15 — RTL: directional glyphs point the wrong way in places

`↪` ("move to another day") and `➡️` ("move to next day") both point right — backwards along RTL reading flow. The identical action on the card correctly uses `chevronEnd` (logical/RTL-aware). Physical-property violations: `AddMenu` uses `left`/`right` deliberately (`:182–183`); several `textAlign:"right"` sites; `EditorBottomSheet.jsx:139`'s inner panel uses `left/right` while its outer wrapper correctly uses logical properties.

**Unverified — needs a real device:** whether swipe direction (delete=left, bank=right) should mirror under RTL, since `SwipeableRow` keys on raw physical `dx` with no `dir` awareness.

#### F16 — Undo toasts ignore the bottom safe area

Both undo pills sit at `bottom: 28` with no `env(safe-area-inset-bottom)`, unlike every other bottom-anchored control in the file. On a notched iPhone, the undo buttons land in the home-indicator gesture zone. `StopActionsSheet.jsx` has the same gap, and its last row is the destructive delete action, 24px from the screen edge.

#### F17 — The delete-undo toast asks a question it already answered

Fallback text: `"הנקודה נמחקה — האם למחוק את הנקודה?"` — *"The stop was deleted — should the stop be deleted?"* — beside a button labelled `בטל`. A user can't tell if the delete happened or is being confirmed.

#### F18 — The day-reorder modal claims nothing is saved while saving on every tap

Header reads "press update to save," but each ▲/▼ click writes to the server immediately via `commitDays` → `saveTrip`. `בטל` does restore the pre-lock snapshot correctly, but the status message is false — a user who backgrounds the app mid-reorder has silently persisted a change the UI said was unsaved.

#### F19 — Per-stop cost is four taps deep behind a scroll, and never appears on the card

Path: locate row → tap ⋯ (30×30) → **scroll** the sheet (cost is row 10 of 15; the component documents it exceeds a phone viewport) → tap `הוסף עלות` → fill → save. After saving, the card renders badge, title, rating, category, ניווט, note, ⋯, ≡ — **and no cost**. The only visible confirmation is the ⋯ row's own label changing. A just-shipped feature with a documented QA backlog (T-BUDGET-27..35, all still open) has zero presence in the timeline.

---

### P2

#### F20 — Three "+" controls in the sheet, one of which does something else entirely

Header `AddMenu` (28×28) and FAB `AddMenu` (52px) share handlers verbatim, ~1 screen apart. A third `+` between stop rows (30×22, transparent, deliberately "camouflaged") adds a **note or transit segment**, not a place — same glyph, three weights, two meanings.

#### F21 — Touch targets below 44×44 — at least 28 declaration sites

Every stop row: note 30×30, ⋯ 30×30, drag handle **24×30**. Also: `AddMenu` header chip 28×28, insert `+` **30×22**, stop-completion checkbox 26×26, transit-row 📎/⋯ 30×32, transit-mode buttons 34×34 ×4, sheet collapse 36×36, map rail 40×40 ×4, reorder ▲▼ 34×34, day-complete 26×26, inbox close 34×34, bank-card close 32×32, ctxMenu close 30×30, undo ✕ 30×30, search clear 24×24, `StopActionsSheet` close 36×36 and its **26×26 colour swatches ×5**.

#### F22 — Contrast: `ink4` (`#A4AAB1`) used as live text and UI-component borders

2.34:1 on white (needs 4.5), 2.06–2.17:1 on tinted backgrounds. Live at: day/category caption (`:3888`), bank-card caption (`:4690`), inline note/transit delete ✕ (`:669`, `:699`), the `≡` drag handle (`:973`, needs 3.0), transit-row icons (`:806`, `:814`), unchecked checkbox borders (`:924`, `:3973`, needs 3.0). `ink3 #6B7178` is fine by comparison (4.93:1 on white).

#### F23 — `CORAL #FF6B6B` used as meaningful text at 2.78:1

High-rating star, lodging subtitle, dead rollover link — 2.78:1 on white. This is the colour that distinguishes a hotel row from a normal row.

#### F24 — `overlayOpen` is missing five overlays

The FAB-suppression boolean omits `filesSheetOpen`, `quickAddOpen`, `costFor`, `attachViewer`, `notePrompt`, `addChoice`. Nothing visibly breaks today only because those sheets sit above z260 or below a `mapFabsHidden` guard — but four of the last six features forgot to update this eleven-term hand-maintained invariant. The next sheet added below z260 will paint FABs over itself.

#### F25 — Selecting a day always destroys your reading position

`selectDay` unconditionally snaps the sheet to `peek` and scrolls to row 0 — deliberate ("selecting a day is a *show me this day on the map* gesture"), but reading day 3 after day 2 costs two taps and a full animation for what reads as a tab switch.

---

## 3. Task walkthroughs

Counted on a fresh, editable, multi-day trip. ⚠ marks hesitation points.

**T1 — Add a stop · 3 taps + typing.** ⚠ Three other "+" controls also claim to add things (F20) — a scanning user may miss the search bar. ⚠ The preview card also offers "save to the general bank," but nothing has explained what the bank is, and its FAB isn't rendered yet at this point (F2). ⚠ The alternate `+` → `הוספת לוקיישן` path opens a second, different search UI for the same job.

**T2 — Set a cost on it · 4 taps + a mandatory scroll.** ⚠ Cost is row 10 of 15, past the fold — a user who doesn't realize the sheet scrolls may conclude the feature doesn't exist. ⚠ Nothing changes on the card after saving (F19). ⚠ The header `₪` chip instead opens an unrelated general expense form.

**T3 — Reorder days · 3 taps minimum.** ⚠ Requires collapsing to peek first, with nothing telling the user this (F2). ⚠ Icon-only FAB with mismatched metaphor (F13). ⚠ Header falsely claims nothing is saved yet (F18). ⚠ The day chips' own drag handlers are unreachable under this exact scrim (F7).

**T4 — Find something nearby · 4 taps, and the map controls vanish.** ⚠ Buried as the first row under "schedule management" (F11). ⚠ Triggers silently unmount the entire map-control rail with no explanation.

**T5 — Move a stop to the bank, then undo · 2 gestures + 1 tap.** ⚠ No visible affordance for the swipe anywhere in the product (F3). ⚠ Undo button sits in the home-indicator gesture zone on notched phones (F16). ⚠ Delete via swipe gets undo; the same delete via ⋯ menu does not (F1).

**T6 — Check the trip budget · 2 taps through the wrong screen.** ⚠ The `₪` chip reads as "the budget" but opens an expense-entry form. ⚠ On a read-only trip the identical control instead navigates straight to the budget — same icon, two destinations.

---

## 4. Unverified — needs a real device or browser

Hypotheses only, not findings:

1. **RTL swipe direction** — does delete-left/bank-right feel inverted to Hebrew users? Needs real-device testing with Hebrew-speaking users.
2. **`StopActionsSheet` scroll reachability** on small viewports (iPhone SE, Pixel with URL bar) — confirm row 10 (cost) and row 16 (delete) are both reachable and the sticky header stays pinned. This is the exact defect area from the 2026-09-05 fix with manual QA still owed.
3. **FAB band fit at 320px** — computed clearance is tight (~20px) between the FAB band and the peek-state sheet.
4. **Speed-dial vertical overflow** on short viewports — computed to reach close to the search bar.
5. **Drag-reorder on touch** — not exercisable from source alone.
6. **T-FILES-21..24, T-BUDGET-27..35, T-BANK-01/02** remain open in `docs/QA-TEST-PLAN.md`. F19 suggests T-BUDGET-27's assertion ("⋯ menu shows the cost") is the *only* observable signal today and may need to be re-scoped once the card itself shows cost.

---

## 5. Handoff

| Findings | Agent | Why |
|---|---|---|
| F1, F2, F3, F4, F10, F11, F12, F19, F20, F25 | `product-designer` | IA and disclosure-tier problems, not styling. Whether there should be two stop menus at all, and what belongs at each sheet snap state, must be answered before any pixel moves — F2 means the disclosure model itself is broken. |
| F5, F6, F13, F14, F16, F21, F22, F23 | `design-systems` | Palette (the city-colour failure is a token fix, not per-file), the dark-mode contract for this surface, the `Icon.jsx` migration, safe-area and touch-target primitives, and a named z-index scale to replace 35 ad-hoc values. |
| F7, F24 | `builder` | Mechanical deletion of ~180 unreachable lines plus the `overlayOpen` invariant — land **before** any redesign so nobody redesigns dead UI. Confirm the surviving save-to-bank path before removing `pendingStop`. |
| F8, F9, F17, F18 | `builder` (behaviour) + `copywriter` (strings) | F17/F18 are pure copy defects; F8/F9 need real handlers (toasts, a file picker, a confirm) with copy from `copywriter`. |
| F15 | `design-systems` then `copywriter` | Glyph substitution is a token/icon decision; the resulting label review is copy. |
| Unverified items 1–6 | `qa` | Add to the existing manual backlog rather than guessing; item 2 re-tests a fix already shipped without device verification. |

**Recommended sequencing:** `builder` on F7 + F24 first (pure deletion, zero behaviour change), then `product-designer` on the IA cluster (F1/F2/F3 decide whether this needs a redesign or targeted fixes — that call belongs to `product-designer` with the owner, not made here).
