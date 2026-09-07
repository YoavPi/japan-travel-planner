# Maslul — promo video storyboard (video-shotcraft / Ink Press template)

Status: **2026-09-01 — two cuts built (16:9). Feature-tour is the current direction.**

---

## Cut B — 5-feature tour (`MaslulTour`, current)

Fast feature montage, ~34s, same visual system. Composition `MaslulTour`,
`src/maslul/tour.tsx`. Numbered label card (~1.8s) fades into each demo shot.

| # | Feature | Shot | Source |
|---|---------|------|--------|
| 01 | AI creation | AI brief form → "בונה את המסלול…" shimmer → finished map | `ai.png` (authed `/create` AI modal) + `map.png` |
| 02 | Sharing | share dialog: email invite, roles, shareable link | `share.png` (authed) — collaborator name/email + raw edit-link masked |
| 03 | Others' maps | `/gallery` ("מפות של אחרים") grid of community maps | `gallery.png` (public) — consent popup masked |
| 04 | Google Maps | stop card → highlight "Google Maps" button → pill pops | `map.png` (`/map?demo=1`) |
| 05 | Notes & files | note popover on a stop: typed note + file chip (hand-built UI over the real stop list) | `map.png` + Remotion overlay |
| — | close | `מסלול` slam + tagline | — |

### The `/map/edit` headless-capture gotcha (root cause)

The editor route sat forever on **"טוען את הטיול…"** in every headless capture.
Cause: **Puppeteer emulates `prefers-reduced-motion: reduce` by default**, and
the editor hides its loading overlay on an `animationend` event. Under
reduced-motion that animation is skipped → `animationend` never fires → the
overlay never unmounts (React renders the real editor *behind* it — the DOM is
there, the pixels aren't). Injecting `animation-duration: 0s` for clean stills
is the same bug from the other side (zero-duration → no `animationend`).

**Fix:** `page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value:
'no-preference' }])` and don't touch animation timing. Then the overlay clears
and the live Mapbox editor renders. See `capture/capture-editor.mjs`.

With that fix, features **01 / 04 / 05** now use the **real `/map/edit`**
capture (`editor-*.png` — Tokyo tiles, coral route, numbered pins, right-rail
day cards with photos + walk/transit chips, the real "מה להוסיף כאן? → 📝 הערה
חופשית" menu, the "קבצי הטיול" panel), not `/map?demo=1`. The note-typing and
file-chip are still small overlays, but anchored to the real editor menu.

---

## Cut A — brand film (`MaslulPromo`)

## Build notes (as built)

- Remotion project: session scratchpad `maslul-promo/` (Ink Press template,
  reskinned). Composition `MaslulPromo` (1920×1080), `src/maslul/*`.
- Fonts: Frank Ruhl Libre (serif title cards), Heebo (captions), Suez One
  (מסלול wordmark) via `@remotion/google-fonts`.
- Captured from live prod via a one-shot headless pass over a throwaway copy
  of the logged-in Chrome profile (Supabase refresh-token request blocked so
  the real session survived). Editor route only ever showed a loading spinner
  for the 31-day trip → the **map beat uses `/map?demo=1`** (same map
  experience, public, re-captured with the cookie-consent popup suppressed).
- Email on the dashboard profile card is covered with a mask rect in shot 1.
- Audio: the template's 11 Mixkit SFX, retimed. No BGM.

Route: template mode (Ink Press), reskinned to Maslul's design system
Spec: 1920×1080 @ 30fps, 1085 frames (36.2s) master → 9:16 vertical adaptation
Audio: SFX-only (template default). BGM: not now.
Language: Hebrew, RTL

## Locked decisions (2026-09-01)

- **Identity:** show the real founder profile (name + avatar) and the real trip.
  Email always framed out.
- **Featured trip:** the account's real **"יפן - ירח דבש"** (Japan – honeymoon)
  itinerary drives shots 1, 4, 6, 8. Wizard destination in shot 3 = "יפן".
- **Music:** SFX-only, ship the template's sound design as-is.
- **Aspect:** 16:9 master first, then 9:16 adaptation.

## Why Ink Press fits

Ink Press is "paper-and-ink morning reading room" — warm cream paper (`#f2eee6`),
ink text, serif letterpress headlines, single amber accent, 2.5D page camera, no
flashy animation. Maslul's marketing surface (DESIGN.md) is already *"earthy cream
paper, vermillion accent, serif-leaning Hebrew display — reads like a printed
travel companion."* Same aesthetic. Reskin = swap amber → Maslul vermillion
(`#E0533F` / `#C0392B`), serif → a Hebrew serif display face (Frank Ruhl Libre),
English demo screens → real Maslul core-flow captures.

## Design tokens (from DESIGN.md)

| Role | Value |
|---|---|
| Paper bg | `#FAF6E8` / `#FDFCF7` (marketing surface) |
| Ink | `#1C2333` |
| Accent | `#E0533F` (app) / `#C0392B` (marketing vermillion) |
| App panel | `#FFFFFF` / `#16191D` |
| Serif display (Hebrew) | Frank Ruhl Libre (Google) |
| Sans (Hebrew) | Noto Sans Hebrew |

## Shot list — Maslul mapping

Frame ranges inherited from the template (`AIFL_SHOTS`) — do not retime unless the
storyboard changes.

| # | Frames | Dur | Template scene | Maslul content | Capture source |
|---|--------|-----|----------------|----------------|----------------|
| 1 | 0–220 | 7.3s | SceneOpen | Ink-drawn **מסלול** wordmark stamps in → pull back to `/dashboard` panorama ("המסלולים שלי" + trip-card grid, 2.5D tilt) → spotlight one trip card: hovers up, light-beam sweep, reseats | `DashboardDesktop` |
| 2 | 220–275 | 1.8s | PaperTitleCard #1 | **"כל הטיול שלכם. במקום אחד."** — accent word: *אחד* | — |
| 3 | 275–465 | 6.3s | SceneFlyIn | `/create` wizard, destination step: country cards deal into the grid → scroll → type **"יפן"** in "חיפוש יעד" → grid filters to the match → click → push-in | `WizardView` step 0 |
| 4 | 465–565 | 3.3s | SceneDetail | `/map/edit` editor: macro push-in on one day's stop list; stops embed row-by-row, auto walk/transit-time chips slot in between them | `EditorDesktop` |
| 5 | 565–620 | 1.8s | PaperTitleCard #2 + DigitRoll | **"12 ימים · 4 ערים · 37 עצירות"** — DigitRoll on "37"; sub: *הכול מחושב אוטומטית* | — |
| 6 | 620–725 | 3.5s | ScenePapers | Day-by-day itinerary: day cards stack and press down, day counter rolls to rest | `EditorDesktop` day rail / `TripOverviewDesktop` |
| 7 | 725–775 | 1.7s | PaperTitleCard #3 | **"משתפים כמו מסמך. עורכים ביחד."** — accent: *ביחד* | — |
| 8 | 775–885 | 3.7s | SceneWbr | `/trip/overview`: the itinerary page "writes itself" (title + day sections typewriter-reveal) → collaborator avatars pop into the share rail one by one | `TripOverviewDesktop` |
| 9 | 885–940 | 1.8s | PaperTitleCard #4 | **"כל החבורה. על אותו מסלול."** — accent: *מסלול* (pun on the product name) | — |
| 10 | 940–1085 | 4.8s | SceneOutroLive | Defocus → captured elements assemble into a group "photo" → **מסלול** letterpress wordmark slams down (riser → impact → sparkle) → 1s hold + tagline | — |

Outro tagline (draft): **"תכננו · שתפו · סעו"** ("Plan · Share · Go")

## Captions (bottom strip, Hebrew, draft)

Template has 6 mono uppercase captions over the live shots. Hebrew has no case;
switch to Noto Sans Hebrew, tighter tracking. Draft:

- f90: "כל הטיולים שלכם, במקום אחד"
- f318: "יעדים נבחרים, ערים מסודרות"
- f395: "חיפוש · סינון · פתיחה"
- f477: "כל עצירה, עם זמני הליכה ותחבורה"
- f633: "מסלול יום-אחר-יום"
- f789: "כמה מתכננים, מסלול אחד"

## Capture mechanism (path A — live prod via your Chrome session)

Chrome 152 refuses `--remote-debugging-port` on the default profile, so instead:

1. You fully quit Chrome.
2. A **trimmed copy** of your Chrome profile is made at `~/.chrome-maslul-capture/`
   (rsync, excluding Extensions / caches / Service Worker — ~50–120 MB). This
   carries the logged-in `maslul-app.vercel.app` session (Supabase token lives in
   Local Storage). No token or password is shown to or handled by the assistant.
3. `capture-template.mjs` runs `puppeteer.launch()` with
   `userDataDir: ~/.chrome-maslul-capture`, `executablePath` = system Chrome,
   headless, viewport 1920×1080 @2x — authenticated, fully automated.
4. Captures full-page 2x textures + element cutouts + `live-layout.json` for
   `/dashboard`, `/create`, `/map/edit/:id`, `/trip/overview/:id`.
5. The profile copy is deleted immediately after capture.

## Data / privacy decisions (need sign-off)

- Dashboard + overview show a profile (name/avatar) and real trip titles/photos.
- Options: (a) show your real name + a real trip as-is; (b) mask the profile
  name, feature one chosen "hero" trip. Screens are framed to avoid email.

## Deliverables

- `promo/maslul-promo-16x9.mp4`
- `promo/maslul-promo-9x16.mp4`
- (if BGM added) `*-nobgm.mp4` variants
- Working Remotion project stays in the session scratchpad, not committed.
