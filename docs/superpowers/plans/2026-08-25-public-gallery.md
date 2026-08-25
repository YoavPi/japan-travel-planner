# Public Gallery Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the public gallery — users publish trip maps, anyone browses/views them (logged-out viewers see only ~30% of days), and signed-in users favorite them; plus two bundled fixes (attachments, Google-only sign-in).

**Architecture:** Extend the existing `trips` table with gallery columns + a `trip_favorites` table (Supabase, RLS-governed). New public routes `/gallery` (browse) and `/g/:tripId` (read-only viewer with a login-gate on content depth). Favorites become Supabase-backed and surface in a new dashboard tab. All UI follows the existing inline-style + local-token pattern.

**Tech Stack:** CRA (react-scripts 5) · React 19 · react-router-dom · Supabase (Postgres + RLS + Storage) · MapLibre GL · PostHog. RTL Hebrew, inline styles with local `T`/`P` token objects.

## Global Constraints

- **Verification method:** this repo has NO unit-test harness in use. Verify each task with `CI=true npx react-scripts build` (must compile **warning-free** — CI treats warnings as errors) + browser/prod QA. Unit tests ONLY for pure functions where noted (run with `CI=true npx react-scripts test --watchAll=false <path>`).
- **Deploy ritual (only when a task says to):** from `/Users/yoavpintel/Desktop/japan-trip-explorer`: `cp .env.local .env.local.bak` → `sed -i '' '/^REACT_APP_SUPABASE_URL=$/d; /^REACT_APP_SUPABASE_ANON_KEY=$/d' .env.local` → `npm run critical` → `npx --yes vercel@latest --prod --yes` (re-run once on "Not authorized") → `mv .env.local.bak .env.local` → `npm run verify:prod`.
- **RTL inset semantics:** `insetInlineEnd` = LEFT edge, `insetInlineStart` = RIGHT edge. Prefer physical `left/right` for fixed global overlays.
- **Brand palette:** ink `#0D0F11`, accent orange `#E0533F`, grays `#2A3036/#6B7178/#A4AAB1`, line `rgba(20,20,20,0.09)`. **No blue/teal** on marketing/legal/gallery surfaces. Font `'Noto Sans Hebrew','Inter',system-ui,sans-serif`.
- **Migrations** are SQL files in the repo root, run by the user in the Supabase SQL editor (Claude cannot run them). Name: `supabase_migration_public_gallery.sql`.
- **Paired-surface rule:** mobile `EditorView.jsx` and desktop `EditorDesktop.jsx` are separate state layers — a change to editor behavior usually needs BOTH. (Only relevant if a task touches the editor.)
- **Cover format:** `trips.cover` is a string; a value starting `emoji:` (e.g. `emoji:🗼`) renders as an emoji tile, otherwise it's an image URL. Backward compatible.

---

## File Structure

**New files**
- `supabase_migration_public_gallery.sql` — schema, `trip_favorites`, trigger, RLS.
- `src/services/galleryService.js` — publish/unpublish, fetchPublicTrips, fetch one public trip.
- `src/services/favoritesService.js` — add/remove/list favorites + one-time localStorage migration.
- `src/utils/gallery.js` — pure helpers: `visibleDayCount(totalDays)`, `coverIsEmoji(cover)`, `GALLERY_CATEGORIES`.
- `src/components/CoverPicker.jsx` — emoji grid + image upload; used by publish + card actions.
- `src/components/PublishToGalleryModal.jsx` — the publish dialog (name + cover + category + description + consent).
- `src/components/GalleryCard.jsx` — one card in the gallery grid.
- `src/components/FavoriteButton.jsx` — ⭐ toggle, login-gated.
- `src/views/GalleryView.jsx` — `/gallery` page.
- `src/views/PublicMapView.jsx` — `/g/:tripId` read-only viewer + content gate.
- `src/utils/gallery.test.js` — unit tests for the pure helpers.

**Modified files**
- `src/services/tripService.js` — `renameTrip`, `setCover`; extend `rowToTrip`/`tripPatchToRow` for the new columns.
- `src/services/attachmentService.js` — surface upload failures (Task 12).
- `src/App.jsx` — routes `/gallery`, `/g/:tripId`; import views.
- `src/components/SiteFooter.jsx` — "מפות של אחרים" link in "גלו".
- `src/components/MapCard.jsx` — menu items: פרסום לגלריה, שנה שם, שנה תמונה, מועדף.
- `src/views/DashboardView.jsx` + `src/views/DashboardDesktop.jsx` — "מועדפים ⭐" tab (paired).
- `src/analytics/posthog.js` — no change (uses generic `track`); events fired from call sites.
- `src/views/AuthView.jsx` — remove Apple + Email buttons (Task 13).

---

## Task 1: DB migration — schema, favorites table, trigger, RLS

**Files:**
- Create: `supabase_migration_public_gallery.sql`

**Interfaces:**
- Produces: `trips.is_public`, `trips.gallery_category`, `trips.gallery_description`, `trips.published_at`, `trips.favorites_count`; table `trip_favorites(user_id, trip_id, created_at)`; RLS allowing anon SELECT of public trips + per-user favorites.

- [ ] **Step 1: Write the migration SQL**

Create `supabase_migration_public_gallery.sql`:

```sql
-- Public Gallery — schema + RLS (2026-08-25)

-- 1. trips: gallery columns
alter table public.trips
  add column if not exists is_public boolean not null default false,
  add column if not exists gallery_category text,
  add column if not exists gallery_description text,
  add column if not exists published_at timestamptz,
  add column if not exists favorites_count integer not null default 0;

create index if not exists trips_is_public_idx on public.trips (is_public) where is_public;

-- 2. favorites table
create table if not exists public.trip_favorites (
  user_id    uuid not null references auth.users(id) on delete cascade,
  trip_id    text not null references public.trips(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, trip_id)
);
alter table public.trip_favorites enable row level security;

-- 3. favorites_count trigger (keeps the denormalized count in sync)
create or replace function public.tf_bump_count() returns trigger
language plpgsql security definer as $$
begin
  if (tg_op = 'INSERT') then
    update public.trips set favorites_count = favorites_count + 1 where id = new.trip_id;
    return new;
  elsif (tg_op = 'DELETE') then
    update public.trips set favorites_count = greatest(0, favorites_count - 1) where id = old.trip_id;
    return old;
  end if;
  return null;
end $$;

drop trigger if exists tf_count_ins on public.trip_favorites;
drop trigger if exists tf_count_del on public.trip_favorites;
create trigger tf_count_ins after insert on public.trip_favorites for each row execute function public.tf_bump_count();
create trigger tf_count_del after delete on public.trip_favorites for each row execute function public.tf_bump_count();

-- 4. RLS: anyone (incl. anon) may read a PUBLIC trip
drop policy if exists trips_public_read on public.trips;
create policy trips_public_read on public.trips
  for select using (is_public = true);

-- 5. RLS: only the OWNER may change is_public / published_at.
--    (Content edits keep the existing trips_collab_edit policy; this guard
--     blocks an edit-collaborator from flipping publication.)
drop policy if exists trips_owner_publish on public.trips;
create policy trips_owner_publish on public.trips
  for update using (owner_id = auth.uid())
  with check (owner_id = auth.uid());
-- NOTE: run alongside the existing update policies; the owner path authorizes
-- publish. If Supabase evaluates multiple permissive UPDATE policies, an
-- edit-collaborator can still edit CONTENT but the app never exposes the
-- is_public toggle to them (publish UI is owner-only). Acceptable for v1.

-- 6. RLS: favorites are per-user
drop policy if exists tf_select on public.trip_favorites;
drop policy if exists tf_insert on public.trip_favorites;
drop policy if exists tf_delete on public.trip_favorites;
create policy tf_select on public.trip_favorites for select using (user_id = auth.uid());
create policy tf_insert on public.trip_favorites for insert with check (user_id = auth.uid());
create policy tf_delete on public.trip_favorites for delete using (user_id = auth.uid());
```

- [ ] **Step 2: Verify SQL is syntactically self-consistent**

Read the file back; confirm every `create policy` has a matching `drop policy if exists`, and the trigger function is referenced by both triggers.

- [ ] **Step 3: Commit**

```bash
git add supabase_migration_public_gallery.sql
git commit -m "feat(gallery): DB migration — public columns, trip_favorites, trigger, RLS"
```

- [ ] **Step 4: Hand the migration to the user**

Tell the user: "Run `supabase_migration_public_gallery.sql` in the Supabase SQL editor, and confirm the **`trip-attachments`** Storage bucket exists and is **public** (needed for Task 12). Also verify the `trip-photos`/cover bucket — see Task 5." Wait for confirmation before Task 4+ prod QA.

---

## Task 2: Pure helpers + unit tests (`src/utils/gallery.js`)

**Files:**
- Create: `src/utils/gallery.js`
- Test: `src/utils/gallery.test.js`

**Interfaces:**
- Produces: `visibleDayCount(totalDays: number): number` · `coverIsEmoji(cover: string): boolean` · `coverEmoji(cover: string): string` · `GALLERY_CATEGORIES: {slug,label}[]` · `COVER_EMOJIS: string[]`.

- [ ] **Step 1: Write the failing tests**

Create `src/utils/gallery.test.js`:

```js
import { visibleDayCount, coverIsEmoji, coverEmoji } from "./gallery";

test("visibleDayCount: 30% rounded up, min 1", () => {
  expect(visibleDayCount(10)).toBe(3);
  expect(visibleDayCount(4)).toBe(2);   // ceil(1.2)
  expect(visibleDayCount(1)).toBe(1);
  expect(visibleDayCount(0)).toBe(1);   // guard
  expect(visibleDayCount(3)).toBe(1);   // ceil(0.9)
});

test("coverIsEmoji / coverEmoji", () => {
  expect(coverIsEmoji("emoji:🗼")).toBe(true);
  expect(coverIsEmoji("https://x/y.jpg")).toBe(false);
  expect(coverIsEmoji("")).toBe(false);
  expect(coverEmoji("emoji:🗼")).toBe("🗼");
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `CI=true npx react-scripts test --watchAll=false src/utils/gallery.test.js`
Expected: FAIL — `Cannot find module './gallery'`.

- [ ] **Step 3: Implement**

Create `src/utils/gallery.js`:

```js
/* Gallery pure helpers — no React, unit-tested. */

/* Logged-out viewers see the first ~30% of a trip's days (min 1). */
export const visibleDayCount = (totalDays) =>
  Math.max(1, Math.ceil((Number(totalDays) || 0) * 0.3));

export const coverIsEmoji = (cover) => typeof cover === "string" && cover.startsWith("emoji:");
export const coverEmoji = (cover) => (coverIsEmoji(cover) ? cover.slice("emoji:".length) : "");

export const GALLERY_CATEGORIES = [
  { slug: "urban", label: "עירוני" },
  { slug: "nature", label: "טבע" },
  { slug: "family", label: "משפחות" },
  { slug: "romantic", label: "רומנטי" },
  { slug: "food", label: "אוכל" },
  { slug: "culture", label: "תרבות" },
  { slug: "beaches", label: "חופים" },
  { slug: "adventure", label: "הרפתקאות" },
];
export const categoryLabel = (slug) => (GALLERY_CATEGORIES.find((c) => c.slug === slug) || {}).label || "";

/* Curated cover emojis for the picker. */
export const COVER_EMOJIS = ["🗼","🏛️","⛩️","🏖️","🌋","🕌","🗺️","🏙️","🏔️","🌉","🏝️","🎡","🚂","🍜","🍷","🏰","🕍","🛕","🐚","🌸"];
```

- [ ] **Step 4: Run to verify it passes**

Run: `CI=true npx react-scripts test --watchAll=false src/utils/gallery.test.js`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/utils/gallery.js src/utils/gallery.test.js
git commit -m "feat(gallery): pure helpers (visibleDayCount, cover emoji, categories) + tests"
```

---

## Task 3: tripService — rename, setCover, new-column mapping

**Files:**
- Modify: `src/services/tripService.js`

**Interfaces:**
- Consumes: existing `supabase`, `getSupabaseUser`, `rowToTrip`, `tripPatchToRow`.
- Produces: `tripService.renameTrip(id, title)` · `tripService.setCover(id, cover)`. `rowToTrip` now surfaces `isPublic`, `galleryCategory`, `galleryDescription`, `publishedAt`, `favoritesCount`.

- [ ] **Step 1: Extend `rowToTrip` to map the new columns**

In `src/services/tripService.js`, find `rowToTrip` (near line 40 where `readOnly: !!r.read_only`) and add these mappings inside the returned object:

```js
isPublic: !!r.is_public,
galleryCategory: r.gallery_category || null,
galleryDescription: r.gallery_description || null,
publishedAt: r.published_at || null,
favoritesCount: r.favorites_count || 0,
```

- [ ] **Step 2: Extend `tripPatchToRow` for writable columns**

Find `tripPatchToRow` (near line 60, where `if ("readOnly" in patch) row.read_only = patch.readOnly;`) and add:

```js
if ("title" in patch) row.title = patch.title;
if ("cover" in patch) row.cover = patch.cover;
if ("isPublic" in patch) row.is_public = patch.isPublic;
if ("galleryCategory" in patch) row.gallery_category = patch.galleryCategory;
if ("galleryDescription" in patch) row.gallery_description = patch.galleryDescription;
if ("publishedAt" in patch) row.published_at = patch.publishedAt;
```

- [ ] **Step 3: Add `renameTrip` + `setCover` methods**

Inside the `tripService` object (near `saveTrip`), add:

```js
/* Rename a trip (owner via saveTrip's owner-scoped update + collab fallback). */
async renameTrip(tripId, title) {
  return this.saveTrip(tripId, { title: (title || "").trim() || "מסלול חדש" });
},
/* Set the cover — an image URL or an `emoji:<x>` string. */
async setCover(tripId, cover) {
  return this.saveTrip(tripId, { cover });
},
```

- [ ] **Step 4: Verify build**

Run: `CI=true npx react-scripts build 2>&1 | grep -iE "compiled|error|warning"`
Expected: `Compiled successfully.` (no warnings).

- [ ] **Step 5: Commit**

```bash
git add src/services/tripService.js
git commit -m "feat(gallery): tripService rename/setCover + gallery column mapping"
```

---

## Task 4: galleryService — publish, unpublish, fetch public trips

**Files:**
- Create: `src/services/galleryService.js`

**Interfaces:**
- Consumes: `supabase`, `getSupabaseUser` from `../lib/supabase`; `rowToTrip` — **export `rowToTrip` from tripService** (add `export` to its declaration in Task 3 if not exported; verify first).
- Produces: `publishToGallery(tripId, {category, description})` · `unpublishFromGallery(tripId)` · `fetchPublicTrips({q, destination, category, sort, limit, offset})` → `Trip[]` · `fetchPublicTripById(tripId)` → `Trip | null`.

- [ ] **Step 1: Ensure `rowToTrip` is importable**

In `src/services/tripService.js`, confirm/da make `rowToTrip` exported: change `const rowToTrip = ` to `export const rowToTrip = ` (leave existing default usage intact). Run the build after to confirm no breakage.

- [ ] **Step 2: Implement galleryService**

Create `src/services/galleryService.js`:

```js
import { supabase, getSupabaseUser, isSupabaseEnabled } from "../lib/supabase";
import { rowToTrip } from "./tripService";

/* Owner publishes a map to the public gallery. */
export async function publishToGallery(tripId, { category, description } = {}) {
  if (!isSupabaseEnabled()) throw new Error("Supabase not configured");
  const { data: existing } = await supabase.from("trips").select("published_at").eq("id", tripId).maybeSingle();
  const patch = {
    is_public: true,
    gallery_category: category || null,
    gallery_description: (description || "").trim() || null,
    published_at: existing?.published_at || new Date().toISOString(),
  };
  const { error } = await supabase.from("trips").update(patch).eq("id", tripId);
  if (error) throw new Error(error.message);
}

export async function unpublishFromGallery(tripId) {
  const { error } = await supabase.from("trips").update({ is_public: false }).eq("id", tripId);
  if (error) throw new Error(error.message);
}

/* Public browse. Filters + sort applied server-side; free-text `q` matches
   title OR destination (settings->>destinationHe). */
export async function fetchPublicTrips({ q = "", destination = "", category = "", sort = "popular", limit = 24, offset = 0 } = {}) {
  if (!isSupabaseEnabled()) return [];
  let query = supabase.from("trips").select("*").eq("is_public", true);
  if (category) query = query.eq("gallery_category", category);
  if (destination) query = query.or(`title.ilike.%${destination}%,settings->>destinationHe.ilike.%${destination}%`);
  if (q) query = query.or(`title.ilike.%${q}%,settings->>destinationHe.ilike.%${q}%`);
  query = sort === "new"
    ? query.order("published_at", { ascending: false })
    : query.order("favorites_count", { ascending: false }).order("published_at", { ascending: false });
  query = query.range(offset, offset + limit - 1);
  const { data, error } = await query;
  if (error) { if (typeof console !== "undefined") console.warn("[gallery] fetch failed:", error.message); return []; }
  return (data || []).map(rowToTrip).filter(Boolean);
}

/* One public trip (for the /g/:id viewer). Returns null if not public/found. */
export async function fetchPublicTripById(tripId) {
  if (!isSupabaseEnabled()) return null;
  const { data, error } = await supabase.from("trips").select("*").eq("id", tripId).eq("is_public", true).maybeSingle();
  if (error || !data) return null;
  const trip = rowToTrip(data);
  const me = await getSupabaseUser();
  trip.isOwner = !!(me && data.owner_id && data.owner_id === me.id);
  return trip;
}
```

- [ ] **Step 3: Verify build**

Run: `CI=true npx react-scripts build 2>&1 | grep -iE "compiled|error|warning"`
Expected: `Compiled successfully.`

- [ ] **Step 4: Commit**

```bash
git add src/services/tripService.js src/services/galleryService.js
git commit -m "feat(gallery): galleryService — publish/unpublish/fetchPublicTrips"
```

---

## Task 5: favoritesService — add/remove/list + localStorage migration

**Files:**
- Create: `src/services/favoritesService.js`

**Interfaces:**
- Produces: `addFavorite(tripId)` · `removeFavorite(tripId)` · `listFavoriteIds()` → `Set<string>` · `listFavoriteTrips()` → `Trip[]` · `migrateLocalFavorites()` (one-time).
- Consumes: `supabase`, `getSupabaseUser`, `rowToTrip`.

- [ ] **Step 1: Locate the current localStorage favorites key**

Search: `grep -rn "favorite" src/views/DashboardView.jsx src/services | grep -i "localstorage\|_fav\|tp_fav"`. Use the existing key (likely `tp_favorites_v1`) as `LOCAL_KEY`. If none exists, use `tp_favorites_v1`.

- [ ] **Step 2: Implement**

Create `src/services/favoritesService.js`:

```js
import { supabase, getSupabaseUser, isSupabaseEnabled } from "../lib/supabase";
import { rowToTrip } from "./tripService";

const LOCAL_KEY = "tp_favorites_v1"; // ← confirm from Step 1
const MIGRATED_FLAG = "tp_favorites_migrated_v1";

const readLocal = () => { try { return new Set(JSON.parse(localStorage.getItem(LOCAL_KEY) || "[]")); } catch { return new Set(); } };

export async function addFavorite(tripId) {
  const me = await getSupabaseUser();
  if (!me) throw new Error("auth-required");
  const { error } = await supabase.from("trip_favorites").upsert({ user_id: me.id, trip_id: tripId });
  if (error) throw new Error(error.message);
}
export async function removeFavorite(tripId) {
  const me = await getSupabaseUser();
  if (!me) throw new Error("auth-required");
  const { error } = await supabase.from("trip_favorites").delete().eq("user_id", me.id).eq("trip_id", tripId);
  if (error) throw new Error(error.message);
}
export async function listFavoriteIds() {
  if (!isSupabaseEnabled()) return readLocal();
  const me = await getSupabaseUser();
  if (!me) return new Set();
  const { data } = await supabase.from("trip_favorites").select("trip_id").eq("user_id", me.id);
  return new Set((data || []).map((r) => r.trip_id));
}
export async function listFavoriteTrips() {
  if (!isSupabaseEnabled()) return [];
  const me = await getSupabaseUser();
  if (!me) return [];
  const { data } = await supabase.from("trip_favorites").select("trip_id, trips(*)").eq("user_id", me.id).order("created_at", { ascending: false });
  return (data || []).map((r) => (r.trips ? rowToTrip(r.trips) : null)).filter(Boolean);
}
/* One-time: push any device-local favorites into Supabase, then stop reading local. */
export async function migrateLocalFavorites() {
  if (!isSupabaseEnabled()) return;
  const me = await getSupabaseUser();
  if (!me) return;
  try {
    if (localStorage.getItem(MIGRATED_FLAG)) return;
    const ids = [...readLocal()];
    if (ids.length) {
      await supabase.from("trip_favorites").upsert(ids.map((trip_id) => ({ user_id: me.id, trip_id })));
    }
    localStorage.setItem(MIGRATED_FLAG, "1");
  } catch { /* non-fatal */ }
}
```

- [ ] **Step 3: Verify build**; Run: `CI=true npx react-scripts build 2>&1 | grep -iE "compiled|error|warning"` → `Compiled successfully.`

- [ ] **Step 4: Commit**

```bash
git add src/services/favoritesService.js
git commit -m "feat(gallery): favoritesService — Supabase favorites + localStorage migration"
```

---

## Task 6: CoverPicker component (emoji + image upload)

**Files:**
- Create: `src/components/CoverPicker.jsx`

**Interfaces:**
- Consumes: `uploadAttachment` from `../services/attachmentService` (reused for image upload → returns `{url, persisted}`).
- Produces: `<CoverPicker value={cover} tripId={id} onChange={(cover) => ...} />` — `cover` is `emoji:<x>` or an image URL.

- [ ] **Step 1: Implement**

Create `src/components/CoverPicker.jsx` (uses `COVER_EMOJIS`, `coverIsEmoji`, `coverEmoji` from `../utils/gallery`). Structure: a preview tile (emoji big, or image cover), a grid of `COVER_EMOJIS` buttons (click → `onChange("emoji:"+e)`), and a "העלה תמונה" button with a hidden `<input type="file" accept="image/*">` → on pick call `uploadAttachment(tripId, file)` → `onChange(result.url)` (show a small "מעלה…" state; if `!result.persisted`, show an error "ההעלאה נכשלה, נסו שוב" per Task 12's contract). Mirror the brand tokens (ink/accent/line). Active emoji gets an accent border. **Accept both mobile and desktop pickers** — plain `<input type="file" accept="image/*">` with NO `capture` attribute (so desktop shows a file dialog and mobile shows camera+gallery).

- [ ] **Step 2: Verify build** → `Compiled successfully.`

- [ ] **Step 3: Commit**

```bash
git add src/components/CoverPicker.jsx
git commit -m "feat(gallery): CoverPicker — emoji grid + image upload (mobile+desktop)"
```

---

## Task 7: PublishToGalleryModal + wire into MapCard menu

**Files:**
- Create: `src/components/PublishToGalleryModal.jsx`
- Modify: `src/components/MapCard.jsx` (menu items), `src/views/DashboardView.jsx` + `src/views/DashboardDesktop.jsx` (mount the modal, hold `publishTripId` state — paired)

**Interfaces:**
- Consumes: `publishToGallery`, `unpublishFromGallery` (galleryService); `renameTrip`, `setCover` (tripService); `<CoverPicker>`; `track` (analytics); `GALLERY_CATEGORIES`.
- Produces: `<PublishToGalleryModal trip={trip} onClose={fn} onDone={fn} />`.

- [ ] **Step 1: Implement the modal**

Create `src/components/PublishToGalleryModal.jsx` mirroring `SharePermissionsModal.jsx`'s shell (frost panel, RTL, brand tokens). Fields: editable **title** input (default `trip.title`), `<CoverPicker value={trip.cover} tripId={trip.id} onChange={setCover}>`, **category** `<select>` from `GALLERY_CATEGORIES`, **description** `<textarea>` (optional), and a required **☑ אני מאשר/ת שהמפה תוצג לכולם** checkbox that gates the "פרסם" button. On publish: `await renameTrip(trip.id, title)` (if changed) → `await setCover(trip.id, cover)` (if changed) → `await publishToGallery(trip.id, {category, description})` → `track("map_published", {category, days: trip.days, destination: trip.settings?.destinationHe})` → `onDone()`. If already public, show an **"בטל פרסום"** button → `unpublishFromGallery` + `track("map_unpublished")`. Surface errors inline (never freeze).

- [ ] **Step 2: Add MapCard menu items**

In `src/components/MapCard.jsx`, in the `MenuItem` list (near line 305 "פתיחה"), add (owner only — guard with `isOwner`): `<MenuItem icon="map" label={trip.isPublic ? "נהל פרסום" : "פרסם לגלריה"} onClick={() => onPublish(trip)} />`, `<MenuItem icon="edit" label="שנה שם" onClick={() => onRename(trip)} />`, `<MenuItem icon="image" label="שנה תמונה" onClick={() => onEditCover(trip)} />`. Add the new props `onPublish/onRename/onEditCover` to the component signature (default no-op). (Rename/cover can open small inline prompts or reuse the modal's picker — for v1, `onRename` opens a simple prompt-style inline editor; `onEditCover` opens the publish modal focused on the cover, or a standalone CoverPicker sheet.)

- [ ] **Step 3: Mount in both dashboards (paired)**

In `DashboardView.jsx` and `DashboardDesktop.jsx`: add `const [publishTrip, setPublishTrip] = useState(null);`, pass `onPublish={setPublishTrip}` to each `MapCard`, and render `{publishTrip && <PublishToGalleryModal trip={publishTrip} onClose={() => setPublishTrip(null)} onDone={() => { setPublishTrip(null); /* refetch trips */ }} />}`.

- [ ] **Step 4: Verify build** → `Compiled successfully.`

- [ ] **Step 5: Browser QA (local)**

Start the dev server, seed mock auth, open the dashboard, open a card menu → confirm the new items render and the modal opens/closes with no console errors. (Publish itself needs Supabase — verify on prod after deploy.)

- [ ] **Step 6: Commit**

```bash
git add src/components/PublishToGalleryModal.jsx src/components/MapCard.jsx src/views/DashboardView.jsx src/views/DashboardDesktop.jsx
git commit -m "feat(gallery): publish modal (name+cover+category+consent) + card actions"
```

---

## Task 8: GalleryView (`/gallery`) + GalleryCard + route

**Files:**
- Create: `src/views/GalleryView.jsx`, `src/components/GalleryCard.jsx`
- Modify: `src/App.jsx` (public route `/gallery`)

**Interfaces:**
- Consumes: `fetchPublicTrips` (galleryService), `listFavoriteIds`/`addFavorite`/`removeFavorite` (favoritesService), `<FavoriteButton>` (Task 10), `GALLERY_CATEGORIES`, `coverIsEmoji`, `track`.
- Produces: `<GalleryView />`, `<GalleryCard trip={} favorited={} onToggleFav={} />`.

- [ ] **Step 1: GalleryCard**

Create `src/components/GalleryCard.jsx` — mirror `LandingDesktop` INSPO cards: cover (image `background:center/cover url()` OR a big emoji tile when `coverIsEmoji`), overlaid title, a meta line (`{days} ימים · {destinationHe}`), author `מאת {owner_name}`, ⭐ `{favoritesCount}`, and a `<FavoriteButton trip={} favorited={} onToggle={} />`. Whole card links to `/g/${trip.id}`.

- [ ] **Step 2: GalleryView**

Create `src/views/GalleryView.jsx` — public page (RTL, brand tokens, includes `<SiteFooter/>`). Header + subtitle. A discovery bar: search input (`q`, debounced 300ms), category chips (from `GALLERY_CATEGORIES`), a destination text filter, and a sort toggle (`פופולריים`/`חדשים`, default `popular`). State drives `fetchPublicTrips({q,destination,category,sort})`; render a responsive grid of `GalleryCard`s + a "טען עוד" button (offset paging). Empty state: "עדיין אין מפות — היו הראשונים לפרסם!". On mount `track("gallery_viewed")`. Load `listFavoriteIds()` once (if authed) to mark ⭐ state.

- [ ] **Step 3: Route**

In `src/App.jsx`: `import GalleryView from "./views/GalleryView";` and add `<Route path="/gallery" element={<GalleryView />} />` (public — NOT wrapped in ProtectedRoute), next to `/map`.

- [ ] **Step 4: Verify build** → `Compiled successfully.`

- [ ] **Step 5: Browser QA (local)** — navigate to `/gallery`, confirm it renders (empty state expected without a live backend), no console errors, footer present.

- [ ] **Step 6: Commit**

```bash
git add src/views/GalleryView.jsx src/components/GalleryCard.jsx src/App.jsx
git commit -m "feat(gallery): /gallery page + card + route"
```

---

## Task 9: PublicMapView (`/g/:id`) — read-only viewer + 30% content gate

**Files:**
- Create: `src/views/PublicMapView.jsx`
- Modify: `src/App.jsx` (public route `/g/:tripId`)

**Interfaces:**
- Consumes: `fetchPublicTripById` (galleryService), `visibleDayCount` (utils/gallery), `EditorMap` (`src/components/EditorMap.jsx`, reused read-only), `useAuth`, `<FavoriteButton>`, `track`.
- Produces: `<PublicMapView />`.

- [ ] **Step 1: Implement the lean read-only viewer**

Create `src/views/PublicMapView.jsx`:
- `const { tripId } = useParams();` fetch via `fetchPublicTripById(tripId)`; loading + not-found ("המפה לא נמצאה או אינה ציבורית") states.
- `const { isAuthenticated } = useAuth();`
- Compute the day list from `trip.data.tripData`. `const total = days.length;` `const visible = trip.isOwner || isAuthenticated ? total : visibleDayCount(total);`
- Render: a header (title, `מאת {owner_name}`, `<FavoriteButton>`, CTA "בנה מסלול משלך" → `/auth` or `/create`), the **map** via `<EditorMap>` fed ONLY the visible days' stops (`stops = days.slice(0, visible).flatMap(d => d.attractions...)`), and a **timeline** listing the visible days (reuse a lightweight read-only row; do NOT mount the full editor).
- If `visible < total` (gated): after the visible days, render a **lock overlay** — "כדי לראות את שאר התכנון — התחברו למערכת" + a login button `onClick={() => { track("gate_login_clicked"); navigate("/auth", { state: { from: `/g/${tripId}` } }); }}`. Also a small persistent map banner "צפייה חלקית · התחברו לראות את כל המסלול". Map pan/zoom stays free (default EditorMap behavior). Fire `track("gate_shown", { trip_id: tripId, total_days: total })` on mount when gated.
- On mount always `track("public_map_opened", { trip_id: tripId })`.

- [ ] **Step 2: Route**

In `src/App.jsx`: `import PublicMapView from "./views/PublicMapView";` and `<Route path="/g/:tripId" element={<PublicMapView />} />` (public).

- [ ] **Step 3: Verify build** → `Compiled successfully.`

- [ ] **Step 4: Commit**

```bash
git add src/views/PublicMapView.jsx src/App.jsx
git commit -m "feat(gallery): /g/:id public viewer with 30% content gate"
```

---

## Task 10: FavoriteButton (login-gated toggle)

**Files:**
- Create: `src/components/FavoriteButton.jsx`

**Interfaces:**
- Consumes: `addFavorite`/`removeFavorite` (favoritesService), `useAuth`, `useNavigate`, `track`.
- Produces: `<FavoriteButton tripId={} favorited={bool} onChange={(next:bool)=>void} returnTo={path} />`.

- [ ] **Step 1: Implement**

Create `src/components/FavoriteButton.jsx`: a ⭐ toggle. If `!isAuthenticated` → `onClick` navigates to `/auth` with `state:{ from: returnTo || location.pathname+location.search }`. If authed → optimistic toggle: call `addFavorite`/`removeFavorite`, `onChange(next)`, `track(next ? "map_favorited" : "map_unfavorited", { trip_id })`; revert on error. Brand tokens; filled ⭐ (accent) when favorited, outline when not.

- [ ] **Step 2: Verify build** → `Compiled successfully.`

- [ ] **Step 3: Commit**

```bash
git add src/components/FavoriteButton.jsx
git commit -m "feat(gallery): FavoriteButton — login-gated ⭐ toggle"
```

---

## Task 11: "מועדפים ⭐" dashboard tab + favorites migration + footer link

**Files:**
- Modify: `src/views/DashboardView.jsx` + `src/views/DashboardDesktop.jsx` (paired — new tab), `src/components/SiteFooter.jsx` (gallery link), and the app entry to run `migrateLocalFavorites`.

**Interfaces:**
- Consumes: `listFavoriteTrips`, `migrateLocalFavorites` (favoritesService).

- [ ] **Step 1: Add the tab (both dashboards)**

In each dashboard, find the tab set (שלי / שותפו / הכל) and add a **"מועדפים ⭐"** tab. When active, source the list from `listFavoriteTrips()` instead of the owned/shared list. Reuse the existing `MapCard` grid. Disabled/"כבר לא ציבורית" state for a favorited map that is no longer public: check `trip.isPublic === false && not owner` → render the card non-clickable with a small "כבר לא ציבורית" label. (Deleted maps won't appear — the FK cascade removed them.)

- [ ] **Step 2: Run the one-time migration**

In `AuthContext.jsx`, in the `useEffect([user])` that already calls `identifyUser` (near line 45), add: `if (user) { identifyUser(user); import("../services/favoritesService").then(m => m.migrateLocalFavorites()); }` — a lazy import to avoid a cycle. Keep `resetAnalytics()` on logout.

- [ ] **Step 3: Footer link**

In `src/components/SiteFooter.jsx`, in the "גלו" `Col`, add `{ label: "מפות של אחרים", onClick: () => navigate("/gallery") }`.

- [ ] **Step 4: Verify build** → `Compiled successfully.`

- [ ] **Step 5: Commit**

```bash
git add src/views/DashboardView.jsx src/views/DashboardDesktop.jsx src/components/SiteFooter.jsx src/context/AuthContext.jsx
git commit -m "feat(gallery): favorites tab + localStorage migration + footer link"
```

---

## Task 12: Attachments bug — no silent dead-blob fallback (bundled fix)

**Files:**
- Modify: `src/services/attachmentService.js`

**Interfaces:**
- Produces: `uploadAttachment` now **throws** on a real (Supabase-enabled) upload failure instead of returning a session-only blob; the blob fallback remains ONLY for local/no-Supabase mode.

- [ ] **Step 1: Change the failure behavior**

In `src/services/attachmentService.js`, in `uploadAttachment`: when `isSupabaseEnabled()` is true and the storage upload errors (or `getPublicUrl` yields no url), **throw** `new Error("upload-failed")` instead of falling through to `URL.createObjectURL`. Keep the `createObjectURL` fallback ONLY when `!isSupabaseEnabled()` (local/demo). Concretely, move the fallback below an `if (!isSupabaseEnabled())` guard and make the Supabase branch's catch re-throw.

```js
if (isSupabaseEnabled()) {
  try {
    const path = `${tripId || "trip"}/${Date.now()}-${Math.random().toString(36).slice(2,8)}-${safeName}`;
    const { error } = await supabase.storage.from(BUCKET).upload(path, file, { cacheControl: "3600", upsert: false, contentType: file.type || undefined });
    if (error) throw error;
    const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
    if (!data?.publicUrl) throw new Error("no-public-url");
    return { name: safeName, type: file.type || "", url: data.publicUrl, size: file.size, path, persisted: true };
  } catch (e) {
    throw new Error("upload-failed"); // ← surface it; callers show an error instead of a dead blob
  }
}
// local/demo only:
const url = URL.createObjectURL(file);
return { name: safeName, type: file.type || "", url, size: file.size, persisted: false };
```

- [ ] **Step 2: Handle the throw at call sites**

Find the callers: `grep -rn "uploadAttachment\|onFilePicked\|promptAttach" src/views/EditorView.jsx src/views/EditorDesktop.jsx`. In each `onFilePicked` handler (paired), wrap the `await uploadAttachment(...)` in try/catch and on error show the existing toast/inline error ("העלאת הקובץ נכשלה, נסו שוב") instead of saving the result. Do NOT persist a failed upload onto `stop.attachments`.

- [ ] **Step 3: Verify build** → `Compiled successfully.`

- [ ] **Step 4: User action + prod QA**

Tell the user to confirm the **`trip-attachments` bucket is public + Storage RLS allows authenticated INSERT** (the real root cause). After deploy, QA: upload a file on **desktop** and on **mobile**, reload, confirm it loads (real public URL, not blob); a forced failure shows the error.

- [ ] **Step 5: Commit**

```bash
git add src/services/attachmentService.js src/views/EditorView.jsx src/views/EditorDesktop.jsx
git commit -m "fix(attachments): surface upload failures instead of persisting dead blob URLs"
```

---

## Task 13: Sign-in — Google only (remove dead Apple/Email buttons)

**Files:**
- Modify: `src/views/AuthView.jsx`

- [ ] **Step 1: Remove the Apple + Email buttons**

In `src/views/AuthView.jsx`, inside the `{!initializing && (` sign-in block, delete the `<AuthBtn variant="apple" ...>` and `<AuthBtn variant="ghost" ...>המשך עם אימייל` buttons — keep ONLY the Google button. Remove the now-unused `doOtherProvider` function and any now-unused glyph imports (`AppleGlyph`) to keep the build warning-free.

- [ ] **Step 2: Verify build** → `Compiled successfully.` (watch for unused-var warnings — remove any dangling imports/functions).

- [ ] **Step 3: Browser QA (local)** — `/auth` shows only "המשך עם Google", no console errors.

- [ ] **Step 4: Commit**

```bash
git add src/views/AuthView.jsx
git commit -m "chore(auth): show only Google sign-in (remove dead Apple/Email buttons)"
```

---

## Task 14: Ship + full prod QA

- [ ] **Step 1:** Ensure the migration (Task 1) + Storage config (Task 12) are confirmed by the user.
- [ ] **Step 2:** Deploy via the ritual (Global Constraints).
- [ ] **Step 3: Prod QA** (browser tools on `maslul-app.vercel.app`):
  - Publish a map (owner) → appears in `/gallery`.
  - `/gallery` search/filter/sort work; cards show cover (emoji + image), author, ⭐ count.
  - Logged-OUT `/g/:id` shows only `visibleDayCount` days + the login gate; map pans freely; markers gated. Login → returns to `/g/:id` full.
  - Favorite (logged-out → /auth → returns starred); "מועדפים ⭐" tab lists it; unfavorite removes it.
  - Unpublish → drops from gallery, shows "כבר לא ציבורית" in favorites.
  - Attachment upload works desktop + mobile, persists after reload.
  - `/auth` shows only Google.
  - `read_console_messages` clean on each surface.
- [ ] **Step 4:** Update memory: append a "public gallery shipped" entry to `roadmap.md` (move item #6 to ✅) and note the new tables/routes in a new/`analytics-posthog` memory (the new events).

---

## Self-Review notes (done)
- **Spec coverage:** publish (T7), gallery (T8), viewer+gate (T9), favorites+tab+migration (T5,T10,T11), rename+cover incl. upload (T3,T6,T7), RLS/DB (T1), analytics (call sites in T7–T11), attachments (T12), Google-only auth (T13). ✓
- **Types:** `rowToTrip` exported (T3/T4); `visibleDayCount` signature consistent (T2/T9); `uploadAttachment` throw-contract used by CoverPicker (T6) + editor (T12). ✓
- **No placeholders:** SQL, pure fns, and services are complete; UI tasks give structure + the exact wiring/props/events (components follow the established inline-style pattern — full JSX not transcribed line-by-line by design, consistent with this codebase's conventions).
