# Trip Files Gallery — Design

**Date:** 2026-08-31
**Status:** Approved (brainstorming), pending spec review
**Branch:** `saas-builder-local`

## Problem

A traveller has documents that belong to the whole trip, not to any one stop —
travel insurance, a flight PDF, a packing spreadsheet. Today the app only supports
per-stop attachments (`stop.attachments[]`, Sprint 61/65). There is:

- no way to attach a **trip-level ("general") file**,
- no single place to **see every file in the trip**,
- no way to **name** a file (only the raw filename shows),
- no **organisation** of files by day vs. general.

## Goal

1. Upload a "general file" to a trip, choosing a category on upload: **כללי** (general)
   or a specific **day**.
2. One button — in the editor and on the trip overview — that opens a gallery of
   **every file in the trip**, grouped **כללי first, then יום 1 … יום N**.
3. In that gallery: rename a file (display label), move it between groups, open it,
   delete it.
4. Delete removes the file from Supabase Storage, not just the trip link.

## Non-goals

- No cross-trip file browsing / queryable file index.
- No folders beyond the general/day grouping.
- No new Hebrew microcopy pass in this change (placeholder labels; copywriter later).
- No change to how per-stop attachments are added (the ⋯ → "צירוף קובץ" flow stays).

## Approach (chosen: A — keep it in the trip JSON)

Files live in the existing `trip.data` JSONB blob, next to the itinerary. No new
Postgres table, **no new RLS policy**, no new Storage bucket. This matters on a live
product with a documented auth/RLS incident history — the change adds zero RLS
surface. Reuses `attachmentService`, the `trip-attachments` bucket, and the existing
in-app attachment viewer modal.

Rejected:

- **B — new `trip_files` table.** Cleaner separation and queryable, but a migration,
  a new RLS surface, a new service, and per-stop attachments would still sit in JSON
  → two sources of truth. No requirement needs a queryable table.
- **C — hybrid** (table for general files, JSON for stop attachments). Still a
  migration + RLS, still two sources.

## Data model (no migration)

New array `trip.data.files[]` — general/trip-level files only:

```js
{
  id: "f_ab12cd",          // stable id; rename / move / delete target it
  name: "policy.pdf",       // original filename, used for download
  label: "ביטוח נסיעות",     // user-facing display name; defaults to `name`
  type: "application/pdf",  // MIME
  url:  "https://…",        // public URL (Supabase) or session blob URL (demo)
  path: "trip123/17250-x-policy.pdf", // Storage path; absent for session blobs
  size: 384012,             // bytes
  day:  null,               // null = "כללי"; otherwise 1-based day number
  addedAt: "2026-08-31T09:12:00.000Z",
  persisted: true           // false in demo/local mode
}
```

Per-stop attachments keep their current shape
`{ name, type, url, size, path, persisted }`. The gallery:

- derives a display label as `attachment.label ?? attachment.name`,
- writes `label` back onto the attachment object for rename,
- treats the file's group as **the day its stop is on** (not movable — to move it,
  the user moves the stop, or deletes + re-adds as a general file).

Old trips have no `data.files` → treat as `[]` everywhere. No `settings` change.

### Derived gallery model

A selector builds the grouped view from both sources:

```
buildFileGroups(tripData) -> [
  { key: "general", title: "כללי", items: FileRow[] },
  { key: "day-1",   title: "יום 1", items: FileRow[] },
  ...
]
```

`FileRow` is a discriminated shape so callbacks know what they're acting on:

```js
// general file
{ kind: "general", id, label, name, type, url, path, size, persisted, day }
// stop attachment
{ kind: "stop", dayNum, stopIdx, fi, label, name, type, url, path, size, persisted, stopName }
```

Ordering: `general` section first; then day sections in ascending day order.
Empty day sections are hidden. The `general` section always renders (shows an
upload prompt when empty).

## Components & files

### `src/services/attachmentService.js` (edit)

- `uploadAttachment(tripId, file)` — unchanged logic; already returns `path`.
- **Broaden** the accepted types: PDF, images (`image/*`), and
  `application/vnd.openxmlformats-officedocument.wordprocessingml.document` (.docx),
  `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet` (.xlsx),
  `text/plain` (.txt). Keep `MAX_BYTES = 15 * 1024 * 1024`.
- **Add** `export async function removeStoredFile(path)`:
  - returns early (resolves) when `!path` or `!isSupabaseEnabled()`,
  - calls `supabase.storage.from(BUCKET).remove([path])`,
  - swallows a "not found" style error, throws on anything else.
- Export a `newFileId()` helper (`"f_" + Math.random().toString(36).slice(2, 8)`).

### `src/hooks/useEditorState.js` (edit)

New mutators, mirroring the existing `addAttachmentToStop` / `removeAttachmentAt`
style, all operating on `trip.data`:

- `addTripFile(meta)` — append to `data.files` (create the array if missing).
- `updateTripFile(id, patch)` — merge `patch` into the matching file; used for
  rename (`{ label }`) and move (`{ day }`).
- `removeTripFile(id)` — drop the matching file from `data.files`.
- `renameAttachmentAt(dayNum, idx, fi, label)` — set `label` on one stop
  attachment without touching siblings.

Persistence rides the editor's existing autosave → `tripService.saveTrip({ data })`.
No new save path.

### `src/components/TripFilesSheet.jsx` (new)

Modelled on `StopActionsSheet.jsx` — mobile bottom sheet, desktop centred modal.

Props:

| prop | purpose |
|---|---|
| `open`, `onClose` | visibility |
| `groups` | derived `buildFileGroups(...)` output |
| `days` | day list, for the move-to submenu + section titles |
| `editable` | gates upload / rename / move / delete |
| `busy` | upload in flight |
| `onUpload(file, day)` | `day` = `null` or day number chosen in the picker |
| `onOpen(fileRow)` | hands off to the viewer modal |
| `onRename(fileRow, label)` | |
| `onMove(fileRow, day)` | general files only; hidden for `kind:"stop"` |
| `onDelete(fileRow)` | |

UI:

- Header: title "קבצי הטיול" + file count.
- Primary action: **"➕ הוסף קובץ כללי"** → hidden `<input type="file" accept=...>`
  → on pick, a small inline day picker (**כללי** / **יום 1 … N**) → `onUpload`.
- Sections in derived order. Each row:
  - type icon (📄 pdf / 🖼️ image / 📊 xlsx / 📝 docx / 📎 other),
  - label — tap ✏️ to edit inline; commit on Enter or blur, Esc cancels,
  - size (humanised),
  - row tap → `onOpen`,
  - ⋯ → move-to-day submenu (general files only) + "מחק" (danger).
- Demo-mode rows (`persisted === false`) show a muted "לא נשמר — מצב הדגמה" chip.
- Read-only (`editable === false`): no upload button, no ✏️, no ⋯ — tap to open only.

Design rules: RTL, logical CSS properties, ≥44×44 touch targets, dark mode via
`useDarkMode()`, tokens from the existing palette. Per DESIGN.md.

### `src/views/EditorView.jsx` (edit, mobile)

- Header toolbar: a 🗂️ button with a count badge → `setFilesSheetOpen(true)`.
- Header menu (`menuOpen`, ~line 281): a "קבצי הטיול" item → same.
- Render `<TripFilesSheet>`; wire callbacks to the new hook mutators + a
  `handleUpload(file, day)` that calls `uploadAttachment(trip?.id, file)` then
  `addTripFile({ ...meta, id: newFileId(), label: meta.name, day, addedAt })`.
- `onDelete`: call `removeTripFile(id)` / `removeAttachmentAt(...)` **and**
  `removeStoredFile(path)` (fire-and-forget; failure logged, not surfaced).
- Extend the existing `attachViewer` modal (~line 4236) so a non-previewable
  `type` renders an icon + "פתח / הורד" link instead of an empty frame.

### `src/views/EditorDesktop.jsx` (edit, desktop)

Same toolbar button + header-menu item + sheet wiring as mobile. It already imports
`uploadAttachment` and the hook mutators.

### `src/views/TripOverviewView.jsx` + `TripOverviewDesktop.jsx` (edit)

- A "קבצים" section rendering the same `buildFileGroups(...)` output, grouped.
- Open always available. Upload / rename / move / delete available when the
  overview's viewer has edit rights (owner or edit-collaborator) — reuse whatever
  ownership flag the overview already computes.
- A minimal shared copy of the viewer modal (or lift the existing one into a small
  `AttachmentViewer.jsx` used by both editor and overview — decide during
  implementation; lifting is preferred if it's a clean extract).

## Data flow

**Upload:** picker → `handleUpload(file, day)` → `uploadAttachment` →
(Supabase) Storage PUT + public URL, or (demo) session blob →
`addTripFile(meta)` → `trip.data.files` grows → autosave → `saveTrip({ data })`.

**Open:** row tap → `onOpen(fileRow)` → `setAttachViewer({ file: fileRow })` →
existing modal; previewable types inline, others as a link.

**Rename:** inline edit commit → `onRename` → `updateTripFile(id, { label })` or
`renameAttachmentAt(...)` → autosave.

**Move (general only):** ⋯ → day → `onMove` → `updateTripFile(id, { day })` →
re-group on next render → autosave.

**Delete:** ⋯ → מחק → `onDelete` → remove from `data` (`removeTripFile` /
`removeAttachmentAt`) → autosave; in parallel `removeStoredFile(path)`.

## Error handling

| Case | Behaviour |
|---|---|
| Upload fails (Supabase on) | `uploadAttachment` throws → existing micro-toast "שגיאה בהעלאת הקובץ"; file not added |
| File > 15 MB or disallowed type | Rejected before upload with an inline message in the sheet |
| `removeStoredFile` fails | File still unlinked from `trip.data` (don't block the user); error logged; orphaned Storage object is harmless |
| Autosave fails | Covered by the editor's existing autosave error handling |
| Demo mode (no Supabase) | Session blob, `persisted:false`, no `path`; row marked unsaved; delete drops metadata only |

## Permissions

Gated by the editor's existing `editable` flag (owner or edit-collaborator).
Edit-access collaborators get full add / rename / move / delete. Read-only viewers
can open files only. No RLS change — Storage writes already go through the
authenticated Supabase client and the `trip-attachments` bucket's existing policy.

## Testing

### Automated

- **`attachmentService`** — type guard accepts pdf/image/docx/xlsx/txt, rejects
  others and > 15 MB; `removeStoredFile` resolves without calling Storage when
  `path` missing or Supabase disabled; throws on a non-"not found" Storage error.
- **`useEditorState`** — `addTripFile` creates `data.files` when absent and appends;
  `updateTripFile` rename + move touch only the target; `removeTripFile` removes
  only the target; `renameAttachmentAt` sets `label` on one attachment and leaves
  sibling stops/attachments untouched.
- **`buildFileGroups`** — trip with 2 attachments on day 2 + 1 general file →
  `[{general:[1]}, {day-2:[2]}]`; empty day sections omitted; general section
  always present; day sections ascending.
- **`TripFilesSheet`** — renders general-first then ascending days; empty days
  hidden; rename input commits on Enter/blur and cancels on Esc; move calls
  `onMove` with the chosen day; delete calls `onDelete`; read-only hides
  upload/✏️/⋯.
- **Gate** — `npm run critical` and `CI=true npm test -- --watchAll=false` green.

### Manual (append to `docs/QA-TEST-PLAN.md`)

1. Editor → 🗂️ → add `insurance.pdf` as **כללי** → reload → still listed under כללי.
2. Move it to **יום 3** → reload → under יום 3.
3. Rename to "ביטוח נסיעות" → reload → label persists.
4. Delete → gone from the sheet; confirm the object is gone from the
   `trip-attachments` bucket.
5. Attach a file to a stop on day 2 via ⋯ → open the sheet → it appears under
   **יום 2**; rename it there → persists.
6. Demo mode (`/map?demo=1`) → add a file → opens and previews; row shows
   "לא נשמר"; reload → gone (expected).
7. Shared trip as an edit-collaborator → can add and delete; as a read-only
   viewer → can only open.
8. Trip overview → "קבצים" section shows the same grouping; upload there works
   with edit rights; RTL + dark mode both clean.
9. Non-previewable type (.xlsx) → viewer shows icon + "פתח / הורד" link.

## Files touched

- `src/services/attachmentService.js` — broaden types, add `removeStoredFile`,
  `newFileId`.
- `src/hooks/useEditorState.js` — `addTripFile`, `updateTripFile`, `removeTripFile`,
  `renameAttachmentAt`.
- `src/components/TripFilesSheet.jsx` — **new**.
- `src/components/AttachmentViewer.jsx` — **new** if the existing modal extracts
  cleanly; otherwise extend in place + minimal copy on overview.
- `src/views/EditorView.jsx` — toolbar button, menu item, sheet wiring, viewer
  handles non-previewable types.
- `src/views/EditorDesktop.jsx` — toolbar button, menu item, sheet wiring.
- `src/views/TripOverviewView.jsx`, `src/views/TripOverviewDesktop.jsx` — "קבצים"
  section.
- Tests alongside the above.
- `docs/QA-TEST-PLAN.md` — manual cases.
- `WORKLOG.md` — one line after implementation.

## Rollout

Single branch off `saas-builder-local`. Small verifiable steps: (1) service +
hook + tests, (2) `TripFilesSheet` + selector + tests, (3) editor wiring,
(4) overview wiring, (5) QA plan + `npm run critical`. No feature flag — the
feature is additive and inert until a file is added.
