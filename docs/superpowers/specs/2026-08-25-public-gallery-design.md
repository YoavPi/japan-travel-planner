# Public Gallery — "מפות של אחרים" · Design Spec

**Date:** 2026-08-25
**Status:** Approved for planning
**App:** maslul-app (japan-trip-explorer) — RTL Hebrew CRA + Supabase + MapLibre

---

## 1. Overview

A public gallery where users publish their trip maps for anyone to discover, browse, and view read-only, and where signed-in users can **favorite** (bookmark) public maps. Favorites are synced to Supabase and surfaced in a new dashboard tab.

### Goals (v1)
- Owners **publish** a map to the gallery with discovery metadata (category, description, cover) after an explicit consent.
- **Anyone** (incl. logged-out) can browse the gallery and open a public map **read-only**.
- Signed-in users can **favorite** public maps; favorites sync across devices and appear in a **"מועדפים ⭐"** dashboard tab.
- Owners can **rename** a map and **set its cover** (image or emoji) — surfaced in the publish flow and on the map card.

### Non-goals (explicitly deferred)
- **"שמור עותק"** (editable duplicate) — later.
- **טעינה כמפה נוספת** (overlay + transfer points from a public map) — later, reuses existing "מפות נוספות".
- Moderation / reporting / abuse flow — later.
- Comments, ratings, follows — later.

---

## 2. Data model (Supabase)

### 2.1 `trips` — new columns
| Column | Type | Notes |
|---|---|---|
| `is_public` | boolean, default `false` | listed in the gallery when true |
| `gallery_category` | text, nullable | one of the fixed category slugs (§4) |
| `gallery_description` | text, nullable | short free text |
| `published_at` | timestamptz, nullable | set when first published; used for "חדשים" sort |
| `favorites_count` | integer, default `0` | denormalized (trigger-maintained) for "פופולריים" sort |

`cover` (existing) gains an **emoji mode**: a value prefixed `emoji:` (e.g. `emoji:🗼`) renders as an emoji tile; otherwise it's an image URL (backward compatible — existing covers unaffected).

### 2.2 `trip_favorites` — new table
```
trip_favorites (
  user_id    uuid    not null,   -- auth.uid()
  trip_id    text    not null,   -- trips.id
  created_at timestamptz default now(),
  primary key (user_id, trip_id)
)
```
Single source of truth for favorites (replaces device-local localStorage).

### 2.3 Trigger — keep `favorites_count` in sync
Postgres trigger on `trip_favorites` INSERT/DELETE → `UPDATE trips SET favorites_count = favorites_count ± 1 WHERE id = NEW/OLD.trip_id`. Avoids an aggregate on every gallery query.

### 2.4 RLS
- **`trips` SELECT:** add a policy — *anyone (including anon) may read a row where `is_public = true`* — in addition to the existing owner/collaborator policies (see `supabase_migration_fix_shared_trip_load.sql`).
- **`trips` UPDATE:** **only the OWNER may publish/unpublish** a map. The existing `trips_collab_edit` policy allows owner *or* edit-collaborator to write trip content — so the migration must ensure an edit-collaborator cannot flip `is_public` (e.g. a policy/trigger that blocks non-owners from changing `is_public`/`published_at`, or by exposing publish only through an owner-scoped path). Rename/cover edits follow the existing write policy.
- **`trip_favorites`:** SELECT/INSERT/DELETE only WHERE `user_id = auth.uid()`. (Favorites are private; the public-facing number is the denormalized `favorites_count` on the trip.)

Migration file: `supabase_migration_public_gallery.sql`.

---

## 3. Publishing flow (owner only)

**Entry:** map "…" menu (dashboard card) and/or editor → **"פרסם לגלריה"**.

**Dialog** (`PublishToGalleryModal`):
- **שם המפה** — editable text (updates `trips.title`).
- **תמונת שער** — cover picker: choose an **emoji** (curated travel set), **upload/replace an image** (must work on **mobile AND desktop** file pickers), or keep current.
- **קטגוריה** — dropdown (§4).
- **תיאור קצר** — optional textarea.
- **☑ אני מאשר/ת שהמפה תוצג לכולם** — required to enable "פרסם".
- Buttons: **פרסם** / **ביטול**.

**On publish:** `is_public=true`, set `gallery_category`, `gallery_description`, `published_at` (if first time), plus any title/cover edits. Fires `map_published`.

**Unpublish:** a toggle (in the same modal / card menu) → `is_public=false`. Fires `map_unpublished`. The row stays intact; only its gallery visibility flips.

**Rename & cover as standalone actions:** also exposed on the dashboard card "…" menu ("שנה שם", "שנה תמונה") so they're usable without publishing.

---

## 4. Categories (fixed set)
`עירוני` · `טבע` · `משפחות` · `רומנטי` · `אוכל` · `תרבות` · `חופים` · `הרפתקאות`
(Slugs stored in `gallery_category`; labels rendered in Hebrew.)

---

## 5. Gallery page — route `/gallery` (public, no auth)

- **Header:** title ("מפות של אחרים" / "גלריית מסלולים") + short subtitle.
- **Discovery bar:**
  - Free-text **search** — matches `title` + destination.
  - **Destination** filter chips (from published maps' destinations).
  - **Category** filter chips (§4).
  - **Sort** toggle: **פופולריים** (`favorites_count desc`, tiebreak `published_at desc`) / **חדשים** (`published_at desc`). Default: **פופולריים**.
- **Grid** of `GalleryCard`s. Each card:
  - Cover (image or emoji tile), title, destination, `X ימים`, **author name** (`owner_name`), ⭐ `favorites_count`.
  - **Favorite** button (login-gated) + **Open** (whole card is a link).
- **Data fetch:** `tripService.fetchPublicTrips({ q, destination, category, sort })` → reads `trips WHERE is_public=true` with the filters/sort (RLS-open). Paginated (e.g. 24/page, "load more").
- **Empty/loading states.**

Opening a card → the public read-only viewer (§6).

---

## 6. Public map viewer — route `/g/:tripId` (public, no auth)

- Fetches the trip (RLS allows because `is_public=true`), renders it **read-only** — reuses the editor's existing **view-mode** rendering (map + timeline, no edit controls; the "צפייה בלבד" posture already built), but on a **public, non-ProtectedRoute** so guests can view.
- Header shows the map title + author ("מאת {owner_name}") + a **מועדף ⭐** button (login-gated) + a CTA to build your own ("בנה מסלול משלך").
- Guests can pan/zoom/read; favoriting sends them to `/auth` (with return), then back.
- Fires `public_map_opened` (`trip_id`).

### 6.1 Content gate (teaser for logged-out viewers)
The point of the public viewer is **conversion to sign-up**, so the plan's depth is gated:

| Viewer | Sees |
|---|---|
| **Logged-out** | only the first `max(1, ceil(totalDays × 0.3))` **days** — the rest is locked |
| **Logged-in** (any account) | the **full** map, read-only |
| **Owner** | the full map |

- The **timeline** shows the open days, then a lock **overlay**: *"כדי לראות את שאר התכנון — התחברו למערכת"* + a login button. Locked days are blurred/hidden.
- The **map** shows only the open days' point **markers** (locked days' markers hidden — otherwise the full route would be visible), plus a small persistent banner *"צפייה חלקית · התחברו לראות את כל המסלול"*. Map **pan/zoom stays fully free** — only the markers are gated, not map interaction (decision ח).
- The **⭐ favorite** button, when a logged-out user taps it, goes to `/auth` (with return) — same login-gate as the content (decision ט).
- **Login → redirect back:** the login button goes to `/auth` with `state.from = /g/:tripId`; after auth the user lands back on **the same map**, now full. (Reuses AuthView's existing `dest` mechanism — same as footer→login→wizard.)
- Gate applies **only to logged-out** viewers; once authenticated (any account), public maps are fully viewable.
- Analytics: `gate_shown` `{trip_id, total_days}`, `gate_login_clicked`.

*(Note: `/map?tripId=` in ExploreView is the marketing-Japan surface and stays as-is; the gallery viewer is its own clean route.)*

---

## 7. Favorites

- **Storage:** `trip_favorites` (Supabase) is the single source of truth — replaces the device-local localStorage favorites.
- **Migration:** on first authenticated load after this ships, read any existing localStorage favorites and upsert them into `trip_favorites` once, then drop the local list. Existing ⭐ on own/shared maps unifies onto the same table.
- **Surfacing:** new **"מועדפים ⭐"** tab on the dashboard (alongside שלי / שותפו / הכל) → lists favorited maps (`trip_favorites` join `trips`). Works for public maps *and* own/shared maps.
- **Toggle:** favorite/unfavorite from the gallery, the public viewer, and the dashboard. Guests → `/auth` then return with the star applied.
- Fires `map_favorited` / `map_unfavorited` (`trip_id`).

---

## 8. Entry points
- **Footer** "גלו" column → **"מפות של אחרים"** (`/gallery`).
- **Dashboard** → a link/button to the gallery.

---

## 9. Privacy
- A public map exposes the **author's display name** and **all its content**, including **attached files** (which are public Supabase-storage URLs — see the privacy policy warning "אין להעלות תוכן רגיש"). The publish **consent checkbox** makes this explicit, and the owner can **unpublish at any time**.
- Favorites are private (`trip_favorites` RLS is per-user); only the aggregate `favorites_count` is public.

---

## 10. Analytics events (PostHog)
`map_published` `{category, days, destination}` · `map_unpublished` · `gallery_viewed` · `public_map_opened` `{trip_id}` · `gate_shown` `{trip_id, total_days}` · `gate_login_clicked` · `map_favorited` / `map_unfavorited` `{trip_id}`. Enables two funnels: discovery (`gallery_viewed → public_map_opened → map_favorited → signed_in`) and teaser→signup (`public_map_opened → gate_shown → gate_login_clicked → signed_in`).

---

## 11. New/changed surfaces (implementation inventory)
- **DB:** `supabase_migration_public_gallery.sql` (columns, `trip_favorites`, trigger, RLS).
- **Service:** `tripService` — `publishToGallery`, `unpublishFromGallery`, `renameTrip`, `setCover`, `fetchPublicTrips`, `fetchFavorites`, `addFavorite`, `removeFavorite`, `migrateLocalFavorites`. New `favoritesService` or fold into tripService.
- **Components:** `PublishToGalleryModal`, `CoverPicker` (emoji/image), `GalleryCard`, `FavoriteButton`.
- **Views:** `GalleryView` (`/gallery`), `PublicMapView` (`/g/:tripId`), dashboard "מועדפים" tab.
- **Routing:** add public routes `/gallery`, `/g/:tripId` in `App.jsx`.
- **Footer/Dashboard:** entry points.
- **Cover rendering:** `emoji:` support wherever a cover is shown (cards, editor header).

---

## 12. Resolved behaviors (decisions)
- **(א) Public viewer = a lean read-only renderer** (map + timeline), NOT the full editor — safer for guests, faster, and makes the content-gate trivial to implement.
- **(ב) Unpublish / delete a favorited map:** unpublish → drops out of the gallery but stays in the favoriter's "מועדפים" **disabled** ("כבר לא ציבורית"). Delete → **cascade** removes the `trip_favorites` rows.
- **(ג) Published-map edits are LIVE** — the owner's edits are immediately visible to the public; no draft/published snapshot in v1.
- **(ד) Favoriting your own map is allowed** (not blocked).
- **(ה) Author display = full `owner_name`** (from Google); a display-name/alias is future.
- **(ו) Destination filter shows the raw free-text** destination in v1; smart normalization is future.
- **(ז) Empty gallery:** a friendly empty-state ("עדיין אין מפות — היו הראשונים לפרסם!") + **seed** a few quality maps (Japan/Rome) as examples.
- **(ח) Content gate:** only the point **markers** are gated to 30% of days; map pan/zoom stays free (§6.1).
- **(ט) Favorite while logged-out** → login-gate (`/auth` + return), same as the content gate.

## 13. Bundled into this sprint (adjacent work)
Two fixes to do "along the way" in the implementation sprint (Yoav, 2026-08-25):

**13.1 Attachments bug — files must load on mobile AND desktop.**
Symptom: a file uploaded in the past doesn't load. Likely cause: `attachmentService.uploadAttachment` **falls back to `URL.createObjectURL` (a session-only blob URL)** whenever the Supabase Storage upload fails — that blob is dead after reload / on another device, but it still gets saved on the stop as if it were real. Investigate + fix:
- Confirm the **`trip-attachments` bucket exists and is PUBLIC**, and that Storage RLS allows an authenticated user to upload (else every upload silently falls back to a dead blob).
- Make a failed upload **surface an error** instead of silently persisting a dead blob URL.
- Verify end-to-end on **both mobile and desktop** file pickers, and that the file loads back after reload / on another device.
- (This subsumes the roadmap's "attachments bug" item.)

**13.2 Sign-in: Email / Apple → keep only Google (decided).**
Today the **Apple** and **Email** buttons are dead (they show "לא זמינה — התחברו עם Google"). **Decision:** **hide both** — the auth sheet shows only "המשך עם Google". Remove the Apple + Email `AuthBtn`s (and the now-unused `doOtherProvider` path / mock-only branches) so there are no dead buttons. Email magic-link can be added later if more sign-in options are wanted.

## 14. To decide during planning
- **Owner-only `is_public`** enforcement in RLS (§2.4) needs the exact policy/trigger worked out.
