# Trip Files Gallery Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a user attach trip-level ("general") files to a trip, name them, and open every file in the trip from one grouped gallery (כללי → יום 1 … יום N).

**Architecture:** General files live in the existing `trip.data` JSONB blob as `trip.data.files[]` — no DB table, no new RLS, no new Storage bucket. Pure helpers in `src/utils/tripFiles.js` transform `trip.data`; `useEditorState` wires them to the existing autosave. A new `TripFilesSheet` component merges general files with the existing per-stop `attachments[]` into one grouped view, reusing the `trip-attachments` Storage bucket and a new (self-contained) `AttachmentViewer` modal.

**Tech Stack:** React 18 (CRA / react-scripts 5), `@testing-library/react` + Jest (via `react-scripts test`), Supabase JS (`supabase.storage`), plain inline-style components with logical CSS + `useDarkMode()`.

**Spec:** [docs/superpowers/specs/2026-08-31-trip-files-gallery-design.md](../specs/2026-08-31-trip-files-gallery-design.md)

## Global Constraints

- **Branch:** `saas-builder-local` (not `main`).
- **Pre-deploy gate:** `npm run critical` must pass before the work is considered done.
- **Storage:** reuse the existing bucket `"trip-attachments"`. Size cap `MAX_BYTES = 15 * 1024 * 1024`.
- **No schema / RLS / route / auth changes.** Files are stored inside `trip.data` only.
- **Accepted file types:** PDF, images (`image/*`), Word `.docx`, Excel `.xlsx`, plain text `.txt`. Nothing else.
- **Demo / local mode** (`isSupabaseEnabled() === false`): uploads return a session object URL with `persisted: false` and no `path`. The public demo must keep working with zero API keys.
- **Design:** Hebrew-first RTL; logical CSS properties (`insetInlineStart`, `marginInlineEnd`, …) never `left`/`right`; every interactive target ≥ 44×44 px; dark mode via `useDarkMode()`; colors from the existing palette/token objects in each file, no new hardcoded hex where a token exists. Per DESIGN.md.
- **Placeholder Hebrew copy is acceptable** this pass: `קבצי הטיול`, `כללי`, `יום N`, `הוסף קובץ כללי`, `שנה שם`, `העבר ליום`, `מחק`, `לא נשמר — מצב הדגמה`. A copywriter pass happens later.
- **Editable flag:** `editable = !!trip && !trip.readOnly` — the exact expression already used in `useEditorState.js:76` and the pattern in the overview views.

---

### Task 1: `tripFiles` pure helpers

**Files:**
- Create: `src/utils/tripFiles.js`
- Test: `src/utils/tripFiles.test.js`

**Interfaces:**
- Consumes: nothing (pure).
- Produces:
  - `newFileId(): string` — `"f_" + 6 lowercase-alnum chars`.
  - `fileKind(mime: string, name?: string): "pdf"|"image"|"doc"|"sheet"|"text"|"other"`.
  - `fileEmoji(kind: string): string` — `pdf→"📄" image→"🖼️" doc→"📝" sheet→"📊" text→"📃" other→"📎"`.
  - `humanSize(bytes: number): string` — `"312 KB"`, `"1.4 MB"`, `""` when not finite.
  - `addGeneralFile(data: object, meta: object): object` — returns a new `data` with `meta` appended to `files[]` (creates `files` if absent).
  - `updateGeneralFile(data: object, id: string, patch: object): object` — new `data`; merges `patch` into the file whose `id === id`; other files untouched; missing id → unchanged `data`.
  - `removeGeneralFile(data: object, id: string): object` — new `data` without that file.
  - `renameStopAttachment(tripData: array, dayNum: number, stopIdx: number, fi: number, label: string): array` — new `tripData`; sets `label` (trimmed; empty → `undefined`) on `tripData[day].attractions[stopIdx].attachments[fi]`; every other stop/day identical by value.
  - `buildFileGroups(tripData: array, files: array): Group[]` where
    `Group = { key: string, title: string, day: number|null, items: FileRow[] }` and
    `FileRow` is one of:
    - `{ kind: "general", id, label, name, type, url, path, size, persisted, day }`
    - `{ kind: "stop", dayNum, stopIdx, fi, label, name, type, url, path, size, persisted, stopName }`
    `label` is always resolved: `entry.label || entry.name`.
    Ordering: exactly one `general` group first (`key："general"`, `title："כללי"`, `day: null`), then one group per day that has ≥ 1 file, ascending by day number (`key："day-3"`, `title："יום 3"`). Days with no files are omitted. A general file with a numeric `day` goes into that day's group, not the general group.

- [ ] **Step 1: Write the failing test**

```jsx
// src/utils/tripFiles.test.js
import {
  newFileId, fileKind, fileEmoji, humanSize,
  addGeneralFile, updateGeneralFile, removeGeneralFile,
  renameStopAttachment, buildFileGroups,
} from "./tripFiles";

test("newFileId: f_ + 6 alnum", () => {
  expect(newFileId()).toMatch(/^f_[a-z0-9]{6}$/);
  expect(newFileId()).not.toBe(newFileId());
});

test("fileKind / fileEmoji", () => {
  expect(fileKind("application/pdf")).toBe("pdf");
  expect(fileKind("image/png")).toBe("image");
  expect(fileKind("application/vnd.openxmlformats-officedocument.wordprocessingml.document")).toBe("doc");
  expect(fileKind("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")).toBe("sheet");
  expect(fileKind("text/plain")).toBe("text");
  expect(fileKind("", "notes.xlsx")).toBe("sheet");
  expect(fileKind("application/zip")).toBe("other");
  expect(fileEmoji("pdf")).toBe("📄");
  expect(fileEmoji("other")).toBe("📎");
});

test("humanSize", () => {
  expect(humanSize(312 * 1024)).toBe("312 KB");
  expect(humanSize(1.4 * 1024 * 1024)).toBe("1.4 MB");
  expect(humanSize(undefined)).toBe("");
});

test("addGeneralFile creates files[] then appends", () => {
  const d0 = { tripData: [] };
  const d1 = addGeneralFile(d0, { id: "f_a", name: "a.pdf" });
  expect(d1.files).toEqual([{ id: "f_a", name: "a.pdf" }]);
  const d2 = addGeneralFile(d1, { id: "f_b", name: "b.pdf" });
  expect(d2.files.map((f) => f.id)).toEqual(["f_a", "f_b"]);
  expect(d1.files).toHaveLength(1); // d1 not mutated
});

test("updateGeneralFile merges only the target", () => {
  const d = { files: [{ id: "f_a", label: "x", day: null }, { id: "f_b", day: null }] };
  const out = updateGeneralFile(d, "f_a", { label: "ביטוח", day: 3 });
  expect(out.files[0]).toEqual({ id: "f_a", label: "ביטוח", day: 3 });
  expect(out.files[1]).toEqual({ id: "f_b", day: null });
  expect(updateGeneralFile(d, "nope", { label: "z" })).toEqual(d);
});

test("removeGeneralFile drops only the target", () => {
  const d = { files: [{ id: "f_a" }, { id: "f_b" }] };
  expect(removeGeneralFile(d, "f_a").files).toEqual([{ id: "f_b" }]);
});

test("renameStopAttachment sets label on one attachment only", () => {
  const td = [
    { day: 1, attractions: [{ name: "s1", attachments: [{ name: "x.pdf" }] }] },
    { day: 2, attractions: [
      { name: "s2", attachments: [{ name: "a.pdf" }, { name: "b.pdf" }] },
    ] },
  ];
  const out = renameStopAttachment(td, 2, 0, 1, "  כרטיס  ");
  expect(out[1].attractions[0].attachments[1].label).toBe("כרטיס");
  expect(out[1].attractions[0].attachments[0].label).toBeUndefined();
  expect(out[0]).toBe(td[0]); // day 1 untouched by reference
  const cleared = renameStopAttachment(out, 2, 0, 1, "   ");
  expect(cleared[1].attractions[0].attachments[1].label).toBeUndefined();
});

test("buildFileGroups: general first, then days with files ascending", () => {
  const td = [
    { day: 1, attractions: [{ name: "Sensoji", attachments: [] }] },
    { day: 2, attractions: [
      { name: "Hotel", attachments: [{ name: "voucher.pdf", type: "application/pdf" }] },
      { name: "TeamLab", attachments: [{ name: "ticket.png", type: "image/png", label: "כרטיס" }] },
    ] },
    { day: 3, attractions: [{ name: "Kyoto", attachments: [] }] },
  ];
  const files = [
    { id: "f_ins", name: "insurance.pdf", type: "application/pdf", day: null },
    { id: "f_map", name: "kyoto.pdf", type: "application/pdf", day: 3 },
  ];
  const groups = buildFileGroups(td, files);
  expect(groups.map((g) => g.key)).toEqual(["general", "day-2", "day-3"]);
  expect(groups[0].items).toHaveLength(1);
  expect(groups[0].items[0]).toMatchObject({ kind: "general", id: "f_ins", label: "insurance.pdf" });
  expect(groups[1].items.map((i) => i.label)).toEqual(["voucher.pdf", "כרטיס"]);
  expect(groups[1].items[0]).toMatchObject({ kind: "stop", dayNum: 2, stopIdx: 0, fi: 0 });
  expect(groups[2].items[0]).toMatchObject({ kind: "general", id: "f_map" });
});

test("buildFileGroups: general group present even when empty", () => {
  const groups = buildFileGroups([{ day: 1, attractions: [] }], []);
  expect(groups).toEqual([{ key: "general", title: "כללי", day: null, items: [] }]);
});
```

- [ ] **Step 2: Run the tests, verify they fail**

Run: `CI=true npx react-scripts test src/utils/tripFiles.test.js --watchAll=false`
Expected: FAIL — `Cannot find module './tripFiles'`.

- [ ] **Step 3: Implement `src/utils/tripFiles.js`**

```js
/* ══════════════════════════════════════════════════════════════
   tripFiles — pure helpers for the Trip Files gallery.

   General ("כללי") files live at trip.data.files[]. Per-stop files
   stay at day.attractions[].attachments[] (Sprint 61/65). This module
   only transforms plain data — no React, no Supabase.
   ══════════════════════════════════════════════════════════════ */

export function newFileId() {
  return "f_" + Math.random().toString(36).slice(2, 8).padEnd(6, "0").slice(0, 6);
}

const EXT_KIND = { pdf: "pdf", png: "image", jpg: "image", jpeg: "image", gif: "image", webp: "image", heic: "image", heif: "image", doc: "doc", docx: "doc", xls: "sheet", xlsx: "sheet", csv: "sheet", txt: "text" };

export function fileKind(mime, name) {
  const m = (mime || "").toLowerCase();
  if (m.includes("pdf")) return "pdf";
  if (m.startsWith("image/")) return "image";
  if (m.includes("wordprocessingml") || m === "application/msword") return "doc";
  if (m.includes("spreadsheetml") || m === "application/vnd.ms-excel") return "sheet";
  if (m === "text/plain") return "text";
  const ext = (name || "").split(".").pop().toLowerCase();
  return EXT_KIND[ext] || "other";
}

export function fileEmoji(kind) {
  return { pdf: "📄", image: "🖼️", doc: "📝", sheet: "📊", text: "📃", other: "📎" }[kind] || "📎";
}

export function humanSize(bytes) {
  if (!Number.isFinite(bytes)) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function addGeneralFile(data, meta) {
  const d = data || {};
  return { ...d, files: [...(d.files || []), meta] };
}

export function updateGeneralFile(data, id, patch) {
  const d = data || {};
  if (!(d.files || []).some((f) => f.id === id)) return data;
  return { ...d, files: d.files.map((f) => (f.id === id ? { ...f, ...patch } : f)) };
}

export function removeGeneralFile(data, id) {
  const d = data || {};
  return { ...d, files: (d.files || []).filter((f) => f.id !== id) };
}

export function renameStopAttachment(tripData, dayNum, stopIdx, fi, label) {
  const clean = (label || "").trim();
  return (tripData || []).map((d) => {
    if (d.day !== dayNum) return d;
    return {
      ...d,
      attractions: d.attractions.map((a, i) => {
        if (i !== stopIdx || !Array.isArray(a.attachments)) return a;
        return {
          ...a,
          attachments: a.attachments.map((f, k) =>
            k === fi ? { ...f, label: clean || undefined } : f),
        };
      }),
    };
  });
}

const labelOf = (e) => e.label || e.name || "קובץ";

export function buildFileGroups(tripData, files) {
  const byDay = new Map(); // dayNum -> FileRow[]
  const general = [];

  (files || []).forEach((f) => {
    const row = {
      kind: "general",
      id: f.id, label: labelOf(f), name: f.name, type: f.type,
      url: f.url, path: f.path, size: f.size, persisted: f.persisted, day: f.day ?? null,
    };
    if (row.day == null) general.push(row);
    else { if (!byDay.has(row.day)) byDay.set(row.day, []); byDay.get(row.day).push(row); }
  });

  (tripData || []).forEach((d) => {
    (d.attractions || []).forEach((a, stopIdx) => {
      (a.attachments || []).forEach((f, fi) => {
        if (!byDay.has(d.day)) byDay.set(d.day, []);
        byDay.get(d.day).push({
          kind: "stop",
          dayNum: d.day, stopIdx, fi,
          label: labelOf(f), name: f.name, type: f.type,
          url: f.url, path: f.path, size: f.size, persisted: f.persisted,
          stopName: a.nameHe || a.name || "",
        });
      });
    });
  });

  const groups = [{ key: "general", title: "כללי", day: null, items: general }];
  [...byDay.keys()].sort((a, b) => a - b).forEach((day) => {
    groups.push({ key: `day-${day}`, title: `יום ${day}`, day, items: byDay.get(day) });
  });
  return groups;
}
```

- [ ] **Step 4: Run the tests, verify they pass**

Run: `CI=true npx react-scripts test src/utils/tripFiles.test.js --watchAll=false`
Expected: PASS (8 tests).

- [ ] **Step 5: Commit**

```bash
git add src/utils/tripFiles.js src/utils/tripFiles.test.js
git commit -m "feat(files): pure helpers for trip files gallery (grouping, kinds, data transforms)"
```

---

### Task 2: `attachmentService` — accepted-type guard + `removeStoredFile`

**Files:**
- Modify: `src/services/attachmentService.js`
- Test: `src/services/attachmentService.test.js`

**Interfaces:**
- Consumes: `newFileId` is **not** used here (it lives in `tripFiles`).
- Produces:
  - `isAllowedFile(file: {type?:string, name?:string}): boolean` — true for PDF / `image/*` / `.docx` / `.xlsx` / `.txt` (checks MIME first, then extension fallback), false otherwise.
  - `uploadAttachment(tripId, file)` — unchanged return shape `{ name, type, url, size, path?, persisted }`; now **throws `new Error("file type not allowed")`** before the size check when `!isAllowedFile(file)`.
  - `removeStoredFile(path: string): Promise<void>` — resolves immediately when `!path` or `!isSupabaseEnabled()`; otherwise `supabase.storage.from("trip-attachments").remove([path])`; a "not found" error resolves, any other error rejects.

- [ ] **Step 1: Write the failing test**

```jsx
// src/services/attachmentService.test.js
import { isAllowedFile } from "./attachmentService";

test("isAllowedFile: accepts pdf / image / docx / xlsx / txt", () => {
  expect(isAllowedFile({ type: "application/pdf" })).toBe(true);
  expect(isAllowedFile({ type: "image/jpeg" })).toBe(true);
  expect(isAllowedFile({ type: "", name: "policy.pdf" })).toBe(true);
  expect(isAllowedFile({ type: "", name: "list.xlsx" })).toBe(true);
  expect(isAllowedFile({ type: "", name: "notes.docx" })).toBe(true);
  expect(isAllowedFile({ type: "text/plain" })).toBe(true);
});

test("isAllowedFile: rejects everything else", () => {
  expect(isAllowedFile({ type: "application/zip", name: "a.zip" })).toBe(false);
  expect(isAllowedFile({ type: "", name: "run.exe" })).toBe(false);
  expect(isAllowedFile({})).toBe(false);
});
```

- [ ] **Step 2: Run the test, verify it fails**

Run: `CI=true npx react-scripts test src/services/attachmentService.test.js --watchAll=false`
Expected: FAIL — `isAllowedFile is not a function` (not exported yet).

- [ ] **Step 3: Edit `src/services/attachmentService.js`**

Add after the `MAX_BYTES` line:

```js
const ALLOWED_EXT = ["pdf", "png", "jpg", "jpeg", "gif", "webp", "heic", "heif", "docx", "xlsx", "txt"];

export function isAllowedFile(file) {
  if (!file) return false;
  const t = (file.type || "").toLowerCase();
  if (t === "application/pdf") return true;
  if (t.startsWith("image/")) return true;
  if (t === "application/vnd.openxmlformats-officedocument.wordprocessingml.document") return true;
  if (t === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet") return true;
  if (t === "text/plain") return true;
  const ext = (file.name || "").split(".").pop().toLowerCase();
  return ALLOWED_EXT.includes(ext);
}
```

In `uploadAttachment`, immediately after `if (!file) throw new Error("no file");`:

```js
  if (!isAllowedFile(file)) throw new Error("file type not allowed");
```

Add before the closing `const attachmentService = …` line:

```js
/* Best-effort permanent delete of a stored object. No-op when the file
   was never persisted (session blob → no path) or Supabase is off. A
   "not found" is treated as success; any other failure rejects so the
   caller can log it. */
export async function removeStoredFile(path) {
  if (!path || !isSupabaseEnabled()) return;
  const { error } = await supabase.storage.from(BUCKET).remove([path]);
  if (error && !/not\s*found/i.test(error.message || "")) throw error;
}
```

Add `removeStoredFile` and `isAllowedFile` to the default-export object:

```js
const attachmentService = { uploadAttachment, isAttachmentPersistenceEnabled, isAllowedFile, removeStoredFile };
```

Also broaden the picker hint types in the JSDoc comment at the top of the file (mention docx/xlsx/txt) — comment only, no behavior.

- [ ] **Step 4: Run the test, verify it passes**

Run: `CI=true npx react-scripts test src/services/attachmentService.test.js --watchAll=false`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/services/attachmentService.js src/services/attachmentService.test.js
git commit -m "feat(files): accepted-type guard + removeStoredFile in attachmentService"
```

---

### Task 3: `useEditorState` — general-file mutators

**Files:**
- Modify: `src/hooks/useEditorState.js`
- Test: `src/hooks/useEditorState.files.test.js`

**Interfaces:**
- Consumes: `addGeneralFile`, `updateGeneralFile`, `removeGeneralFile`, `renameStopAttachment` from `../utils/tripFiles`; `tripService.saveTrip` (existing).
- Produces (added to the hook's return object):
  - `tripFiles: array` — `trip?.data?.files ?? []`.
  - `addTripFile(meta): void` — append `meta` to `data.files`, autosave (skipped when `trip.readOnly`).
  - `updateTripFile(id, patch): void` — rename (`{ label }`) / move (`{ day }`).
  - `removeTripFile(id): void`.
  - `renameAttachmentAt(dayNum, stopIdx, fi, label): void` — rename one per-stop attachment.

- [ ] **Step 1: Write the failing test**

```jsx
// src/hooks/useEditorState.files.test.js
import { renderHook, act, waitFor } from "@testing-library/react";

jest.mock("../services/tripService", () => ({
  __esModule: true,
  default: {
    fetchTripById: jest.fn(),
    saveTrip: jest.fn(() => Promise.resolve()),
  },
}));
jest.mock("../services/googleSavedPlaces", () => ({
  listInboxPlaces: () => Promise.resolve([]),
  addInboxPlaces: () => Promise.resolve([]),
  removeInboxPlace: () => Promise.resolve(),
  updateInboxPlace: () => Promise.resolve(),
  fetchMockGoogleSavedPlaces: () => Promise.resolve([]),
}));

import tripService from "../services/tripService";
import useEditorState from "./useEditorState";

const TRIP = {
  id: "t1", readOnly: false,
  data: { tripData: [{ day: 1, attractions: [{ name: "Sensoji", attachments: [{ name: "x.pdf" }] }] }], files: [] },
};

beforeEach(() => {
  tripService.fetchTripById.mockResolvedValue(JSON.parse(JSON.stringify(TRIP)));
  tripService.saveTrip.mockClear();
});

test("addTripFile appends to data.files and autosaves", async () => {
  const { result } = renderHook(() => useEditorState("t1"));
  await waitFor(() => expect(result.current.trip).toBeTruthy());

  act(() => result.current.addTripFile({ id: "f_a", name: "ins.pdf", day: null }));

  expect(result.current.tripFiles).toEqual([{ id: "f_a", name: "ins.pdf", day: null }]);
  await waitFor(() =>
    expect(tripService.saveTrip).toHaveBeenCalledWith("t1", expect.objectContaining({
      data: expect.objectContaining({ files: [{ id: "f_a", name: "ins.pdf", day: null }] }),
    })));
});

test("updateTripFile moves a file to a day; removeTripFile drops it", async () => {
  const { result } = renderHook(() => useEditorState("t1"));
  await waitFor(() => expect(result.current.trip).toBeTruthy());

  act(() => result.current.addTripFile({ id: "f_a", name: "ins.pdf", day: null }));
  act(() => result.current.updateTripFile("f_a", { day: 3 }));
  expect(result.current.tripFiles[0].day).toBe(3);

  act(() => result.current.removeTripFile("f_a"));
  expect(result.current.tripFiles).toEqual([]);
});

test("renameAttachmentAt labels one stop attachment", async () => {
  const { result } = renderHook(() => useEditorState("t1"));
  await waitFor(() => expect(result.current.trip).toBeTruthy());

  act(() => result.current.renameAttachmentAt(1, 0, 0, "ביטוח"));
  expect(result.current.days[0].attractions[0].attachments[0].label).toBe("ביטוח");
});

test("read-only trip does not autosave file changes", async () => {
  tripService.fetchTripById.mockResolvedValue({ ...JSON.parse(JSON.stringify(TRIP)), readOnly: true });
  const { result } = renderHook(() => useEditorState("t1"));
  await waitFor(() => expect(result.current.trip).toBeTruthy());

  act(() => result.current.addTripFile({ id: "f_a", name: "x.pdf", day: null }));
  expect(result.current.tripFiles).toEqual([{ id: "f_a", name: "x.pdf", day: null }]);
  await new Promise((r) => setTimeout(r, 0));
  expect(tripService.saveTrip).not.toHaveBeenCalled();
});
```

- [ ] **Step 2: Run the test, verify it fails**

Run: `CI=true npx react-scripts test src/hooks/useEditorState.files.test.js --watchAll=false`
Expected: FAIL — `result.current.addTripFile is not a function`.

- [ ] **Step 3: Edit `src/hooks/useEditorState.js`**

Add the import at the top, next to the other service imports:

```js
import { addGeneralFile, updateGeneralFile, removeGeneralFile, renameStopAttachment } from "../utils/tripFiles";
```

Add this `commitData` helper immediately after `commitDays` (it mirrors `commitDays` but patches the whole `data` object, so it can touch `data.files` which `commitDays` cannot):

```js
  /* Like commitDays, but for non-tripData slices of trip.data (currently
     data.files[]). Immutable patch + autosave, skipped on read-only trips. */
  const commitData = useCallback((mutate) => {
    setTrip((prev) => {
      if (!prev) return prev;
      const nextData = mutate(prev.data || {});
      const nextTrip = { ...prev, data: nextData };
      if (!prev.readOnly) {
        setSaving(true);
        tripService.saveTrip(prev.id, { data: nextData }).catch(() => {}).finally(() => setSaving(false));
      }
      return nextTrip;
    });
  }, []);
```

Add these mutators after `removeAttachmentAt` (near line 168):

```js
  /* ── Trip-level ("general") files: trip.data.files[] ──────────── */
  const addTripFile = useCallback((meta) => {
    if (!meta) return;
    commitData((data) => addGeneralFile(data, meta));
  }, [commitData]);

  const updateTripFile = useCallback((id, patch) => {
    commitData((data) => updateGeneralFile(data, id, patch));
  }, [commitData]);

  const removeTripFile = useCallback((id) => {
    commitData((data) => removeGeneralFile(data, id));
  }, [commitData]);

  /* Rename one per-stop attachment (writes `label`, leaves siblings intact). */
  const renameAttachmentAt = useCallback((dayNum, stopIdx, fi, label) => {
    commitDays((ds) => renameStopAttachment(ds, dayNum, stopIdx, fi, label));
  }, [commitDays]);
```

Add `const tripFiles = useMemo(() => trip?.data?.files ?? [], [trip]);` next to the `days` memo (line 60).

Extend the return object (line 379-387): add
`tripFiles, addTripFile, updateTripFile, removeTripFile, renameAttachmentAt,`
to the line that currently ends `addAttachmentToStop, removeAttachmentAt, insertAt,`.

- [ ] **Step 4: Run the test, verify it passes**

Run: `CI=true npx react-scripts test src/hooks/useEditorState.files.test.js --watchAll=false`
Expected: PASS (4 tests).

- [ ] **Step 5: Run the wider hook + util suite**

Run: `CI=true npx react-scripts test src/hooks src/utils --watchAll=false`
Expected: PASS, no regressions.

- [ ] **Step 6: Commit**

```bash
git add src/hooks/useEditorState.js src/hooks/useEditorState.files.test.js
git commit -m "feat(files): general-file mutators in useEditorState (add/update/remove/rename)"
```

---

### Task 4: `AttachmentViewer` component

**Files:**
- Create: `src/components/AttachmentViewer.jsx`
- Test: `src/components/AttachmentViewer.test.js`

**Interfaces:**
- Consumes: nothing from earlier tasks (self-contained; markup adapted from the inline modal at `EditorView.jsx:4236`).
- Produces: `export default function AttachmentViewer({ file, onClose, onDelete })`
  - `file: { name?, label?, type?, url }` — renders nothing when `!file || !file.url`.
  - Title = `file.label || file.name || "מסמך מצורף"`.
  - Image types → `<img>`; PDF types → `<iframe>`; anything else → 📄 + a `<a download>` "הורדת הקובץ" link.
  - Always renders a `✕` close button (`aria-label="סגירה"`, ≥ 44×44) calling `onClose`.
  - Renders a `🗑️ מחק` button (`aria-label="מחק קובץ"`) calling `onDelete` **only when `onDelete` is a function**.
  - Root: `dir="rtl"`, `position: fixed`, `inset: 0`, high z-index (`400`), dark scrim background.

- [ ] **Step 1: Write the failing test**

```jsx
// src/components/AttachmentViewer.test.js
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import AttachmentViewer from "./AttachmentViewer";

test("renders nothing without a file url", () => {
  const { container } = render(<AttachmentViewer file={null} onClose={() => {}} />);
  expect(container).toBeEmptyDOMElement();
});

test("shows label, close + delete fire their callbacks", () => {
  const onClose = jest.fn();
  const onDelete = jest.fn();
  render(<AttachmentViewer file={{ label: "ביטוח נסיעות", type: "application/pdf", url: "blob:x" }} onClose={onClose} onDelete={onDelete} />);
  expect(screen.getByText("ביטוח נסיעות")).toBeInTheDocument();
  fireEvent.click(screen.getByLabelText("מחק קובץ"));
  fireEvent.click(screen.getByLabelText("סגירה"));
  expect(onDelete).toHaveBeenCalledTimes(1);
  expect(onClose).toHaveBeenCalledTimes(1);
});

test("no delete button when onDelete is omitted", () => {
  render(<AttachmentViewer file={{ name: "a.pdf", type: "application/pdf", url: "blob:x" }} onClose={() => {}} />);
  expect(screen.queryByLabelText("מחק קובץ")).toBeNull();
});

test("non-previewable type offers a download link", () => {
  render(<AttachmentViewer file={{ name: "list.xlsx", type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", url: "blob:x" }} onClose={() => {}} />);
  const link = screen.getByText("הורדת הקובץ").closest("a");
  expect(link).toHaveAttribute("href", "blob:x");
  expect(link).toHaveAttribute("download");
});
```

- [ ] **Step 2: Run the test, verify it fails**

Run: `CI=true npx react-scripts test src/components/AttachmentViewer.test.js --watchAll=false`
Expected: FAIL — `Cannot find module './AttachmentViewer'`.

- [ ] **Step 3: Implement `src/components/AttachmentViewer.jsx`**

```jsx
import React from "react";

/* ══════════════════════════════════════════════════════════════
   AttachmentViewer — full-screen in-app file viewer.

   Blob + public URLs render inline in <img>/<iframe> (window.open is
   unreliable on iOS/Safari). Non-previewable types fall back to a
   download link. Adapted from the Sprint 65 inline editor modal so
   the Trip Files gallery + trip overview can share one viewer.
   ══════════════════════════════════════════════════════════════ */

export default function AttachmentViewer({ file, onClose, onDelete }) {
  if (!file || !file.url) return null;

  const title = file.label || file.name || "מסמך מצורף";
  const isPdf = /pdf/i.test(file.type || "") || /\.pdf($|\?)/i.test(file.url || "");
  const isImg = /^image\//i.test(file.type || "")
    || /\.(png|jpe?g|gif|webp|heic|heif)($|\?)/i.test(file.url || "");

  return (
    <div dir="rtl" style={{
      position: "fixed", inset: 0, zIndex: 400, display: "flex", flexDirection: "column",
      background: "rgba(10,12,15,0.92)",
      paddingTop: "env(safe-area-inset-top, 0px)", paddingBottom: "env(safe-area-inset-bottom, 0px)",
    }}>
      <div style={{ flexShrink: 0, display: "flex", alignItems: "center", gap: 10, padding: "12px 14px" }}>
        <span aria-hidden style={{ fontSize: 18 }}>📎</span>
        <div dir="auto" style={{ flex: 1, minWidth: 0, fontSize: 14, fontWeight: 800, color: "#fff", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{title}</div>
        {typeof onDelete === "function" && (
          <button onClick={onDelete} aria-label="מחק קובץ" title="מחק קובץ" className="tp-press"
            style={{ flexShrink: 0, minHeight: 44, padding: "0 14px", borderRadius: 999, border: "none", background: "rgba(255,255,255,0.14)", color: "#fff", cursor: "pointer", fontFamily: "inherit", fontSize: 12.5, fontWeight: 800, display: "inline-flex", alignItems: "center", gap: 5 }}>
            <span aria-hidden>🗑️</span> מחק
          </button>
        )}
        <button onClick={onClose} aria-label="סגירה" title="סגירה" className="tp-press"
          style={{ flexShrink: 0, width: 44, height: 44, borderRadius: "50%", border: "none", background: "#fff", color: "#1E1E24", cursor: "pointer", fontFamily: "inherit", fontSize: 16, fontWeight: 800, display: "inline-flex", alignItems: "center", justifyContent: "center" }}>✕</button>
      </div>
      <div style={{ flex: 1, minHeight: 0, display: "flex", alignItems: "center", justifyContent: "center", padding: "0 10px 12px" }}>
        {isImg ? (
          <img src={file.url} alt={title} style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain", borderRadius: 10 }} />
        ) : isPdf ? (
          <iframe src={file.url} title={title} style={{ width: "100%", height: "100%", border: "none", borderRadius: 10, background: "#fff" }} />
        ) : (
          <div style={{ textAlign: "center", color: "#fff", padding: 24 }}>
            <div style={{ fontSize: 40, marginBottom: 10 }}>📄</div>
            <div style={{ fontSize: 13.5, opacity: 0.85, lineHeight: 1.6 }}>לא ניתן להציג את סוג הקובץ הזה כאן.</div>
            <a href={file.url} download={file.name || undefined}
              style={{ display: "inline-block", marginTop: 14, minHeight: 44, lineHeight: "44px", padding: "0 18px", borderRadius: 12, background: "#fff", color: "#1E1E24", fontSize: 14, fontWeight: 800, textDecoration: "none" }}>הורדת הקובץ</a>
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run the test, verify it passes**

Run: `CI=true npx react-scripts test src/components/AttachmentViewer.test.js --watchAll=false`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/components/AttachmentViewer.jsx src/components/AttachmentViewer.test.js
git commit -m "feat(files): shared AttachmentViewer modal component"
```

---

### Task 5: `TripFilesSheet` component

**Files:**
- Create: `src/components/TripFilesSheet.jsx`
- Test: `src/components/TripFilesSheet.test.js`

**Interfaces:**
- Consumes: `buildFileGroups`, `fileKind`, `fileEmoji`, `humanSize` from `../utils/tripFiles`; `AttachmentViewer` from `./AttachmentViewer`; `isAllowedFile` from `../services/attachmentService`.
- Produces: `export default function TripFilesSheet({ open, onClose, tripData, files, dayCount, editable, busy, onUpload, onRename, onMove, onDelete })`
  - `tripData: array`, `files: array` → fed straight into `buildFileGroups(tripData, files)`.
  - `dayCount: number` — number of days, for the "העבר ליום" submenu (1..dayCount) and the upload day-picker.
  - `editable: boolean` — false hides the upload button, the rename affordance, and the ⋯ menu (open-only).
  - `busy: boolean` — disables the upload button + shows "מעלה…".
  - `onUpload(file: File, day: number|null)` — `day` chosen in the picker (null = כללי).
  - `onRename(row: FileRow, label: string)`.
  - `onMove(row: FileRow, day: number|null)` — only ever called for `row.kind === "general"`.
  - `onDelete(row: FileRow)`.
  - Renders nothing when `!open`.
  - Opening a row sets local state → renders `<AttachmentViewer file={row} onClose=… onDelete={editable ? () => { onDelete(row); close } : undefined} />`.
  - Rejects a picked file with `!isAllowedFile(file)` or `file.size > 15*1024*1024` by showing an inline error string, without calling `onUpload`.
  - Root sheet: `dir="rtl"`, fixed, bottom-anchored on narrow screens; scrim click → `onClose`. Section headers render in `buildFileGroups` order. Empty non-general groups never appear (guaranteed by the selector). Empty general group shows only the upload prompt.

- [ ] **Step 1: Write the failing test**

```jsx
// src/components/TripFilesSheet.test.js
import React from "react";
import { render, screen, fireEvent, within } from "@testing-library/react";
import TripFilesSheet from "./TripFilesSheet";

const tripData = [
  { day: 1, attractions: [] },
  { day: 2, attractions: [
    { name: "Hotel", attachments: [{ name: "voucher.pdf", type: "application/pdf" }] },
  ] },
  { day: 3, attractions: [] },
];
const files = [{ id: "f_ins", name: "insurance.pdf", type: "application/pdf", day: null }];

const baseProps = {
  open: true, onClose: jest.fn(), tripData, files, dayCount: 3, editable: true, busy: false,
  onUpload: jest.fn(), onRename: jest.fn(), onMove: jest.fn(), onDelete: jest.fn(),
};

test("renders nothing when closed", () => {
  const { container } = render(<TripFilesSheet {...baseProps} open={false} />);
  expect(container).toBeEmptyDOMElement();
});

test("sections: כללי first, then only days with files", () => {
  render(<TripFilesSheet {...baseProps} />);
  const headers = screen.getAllByRole("heading").map((h) => h.textContent);
  expect(headers).toEqual(["כללי", "יום 2"]);
  expect(screen.getByText("insurance.pdf")).toBeInTheDocument();
  expect(screen.getByText("voucher.pdf")).toBeInTheDocument();
});

test("rename a general file commits on Enter", () => {
  render(<TripFilesSheet {...baseProps} />);
  fireEvent.click(screen.getByLabelText("שנה שם ל-insurance.pdf"));
  const input = screen.getByDisplayValue("insurance.pdf");
  fireEvent.change(input, { target: { value: "ביטוח נסיעות" } });
  fireEvent.keyDown(input, { key: "Enter" });
  expect(baseProps.onRename).toHaveBeenCalledWith(
    expect.objectContaining({ kind: "general", id: "f_ins" }), "ביטוח נסיעות");
});

test("move a general file to day 3", () => {
  render(<TripFilesSheet {...baseProps} />);
  fireEvent.click(screen.getByLabelText("פעולות עבור insurance.pdf"));
  fireEvent.click(screen.getByText("יום 3"));
  expect(baseProps.onMove).toHaveBeenCalledWith(
    expect.objectContaining({ id: "f_ins" }), 3);
});

test("delete calls onDelete", () => {
  render(<TripFilesSheet {...baseProps} />);
  fireEvent.click(screen.getByLabelText("פעולות עבור voucher.pdf"));
  fireEvent.click(screen.getByText("מחק"));
  expect(baseProps.onDelete).toHaveBeenCalledWith(
    expect.objectContaining({ kind: "stop", dayNum: 2, stopIdx: 0, fi: 0 }));
});

test("upload rejects a disallowed type without calling onUpload", () => {
  render(<TripFilesSheet {...baseProps} />);
  const input = screen.getByTestId("trip-files-input");
  fireEvent.change(input, { target: { files: [new File(["x"], "a.zip", { type: "application/zip" })] } });
  expect(baseProps.onUpload).not.toHaveBeenCalled();
  expect(screen.getByText(/סוג קובץ/)).toBeInTheDocument();
});

test("read-only: no upload button, no ⋯ menu", () => {
  render(<TripFilesSheet {...baseProps} editable={false} />);
  expect(screen.queryByText("הוסף קובץ כללי")).toBeNull();
  expect(screen.queryByLabelText("פעולות עבור insurance.pdf")).toBeNull();
});
```

- [ ] **Step 2: Run the test, verify it fails**

Run: `CI=true npx react-scripts test src/components/TripFilesSheet.test.js --watchAll=false`
Expected: FAIL — `Cannot find module './TripFilesSheet'`.

- [ ] **Step 3: Implement `src/components/TripFilesSheet.jsx`**

```jsx
import React, { useMemo, useRef, useState } from "react";
import { useDarkMode } from "../utils/theme";   // theme.js exports both `useDarkMode` (named) and default
import { buildFileGroups, fileKind, fileEmoji, humanSize } from "../utils/tripFiles";
import { isAllowedFile } from "../services/attachmentService";
import AttachmentViewer from "./AttachmentViewer";

const MAX_BYTES = 15 * 1024 * 1024;
const ACCEPT = "application/pdf,image/*,.pdf,.png,.jpg,.jpeg,.heic,.docx,.xlsx,.txt";

/* Trip Files gallery — every file in the trip (general + per-stop),
   grouped כללי → יום 1 … יום N. Upload / rename / move / delete when
   `editable`; open-only otherwise. */
export default function TripFilesSheet({
  open, onClose, tripData, files, dayCount, editable, busy,
  onUpload, onRename, onMove, onDelete,
}) {
  const dark = useDarkMode();
  const inputRef = useRef(null);
  const [pendingDay, setPendingDay] = useState(undefined); // undefined = picker not shown
  const [err, setErr] = useState("");
  const [renaming, setRenaming] = useState(null);   // FileRow
  const [menuFor, setMenuFor] = useState(null);     // FileRow
  const [viewing, setViewing] = useState(null);     // FileRow

  const groups = useMemo(() => buildFileGroups(tripData, files), [tripData, files]);

  if (!open) return null;

  const P = dark
    ? { sheet: "#15171C", ink: "#F4F5F7", ink2: "#B9BEC7", line: "#2A2E37", row: "#1C1F26", accent: "#E0533F" }
    : { sheet: "#FFFFFF", ink: "#1E1E24", ink2: "#6B7280", line: "#E7E8EC", row: "#F7F8FA", accent: "#E0533F" };

  const totalCount = groups.reduce((n, g) => n + g.items.length, 0);

  const pickFile = (day) => { setErr(""); setPendingDay(day); inputRef.current && (inputRef.current.value = "", inputRef.current.click()); };

  const onPicked = (e) => {
    const f = e.target.files && e.target.files[0];
    if (!f) return;
    if (!isAllowedFile(f)) { setErr("סוג קובץ לא נתמך. אפשר PDF, תמונה, Word, Excel או טקסט."); return; }
    if (f.size > MAX_BYTES) { setErr("הקובץ גדול מדי (עד 15MB)."); return; }
    onUpload(f, pendingDay === undefined ? null : pendingDay);
    setPendingDay(undefined);
  };

  const commitRename = (row, value) => {
    const v = (value || "").trim();
    if (v && v !== row.label) onRename(row, v);
    setRenaming(null);
  };

  return (
    <div dir="rtl" style={{ position: "fixed", inset: 0, zIndex: 380, display: "flex", flexDirection: "column", justifyContent: "flex-end", fontFamily: "inherit" }}>
      <div onClick={onClose} style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.42)" }} />
      <div role="dialog" aria-label="קבצי הטיול" style={{
        position: "relative", background: P.sheet, color: P.ink,
        borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: "85vh",
        display: "flex", flexDirection: "column", boxShadow: "0 -12px 40px rgba(0,0,0,0.3)",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "16px 18px 10px", borderBottom: `1px solid ${P.line}` }}>
          <strong style={{ flex: 1, fontSize: 16 }}>קבצי הטיול{totalCount ? ` · ${totalCount}` : ""}</strong>
          <button onClick={onClose} aria-label="סגירה" style={{ width: 44, height: 44, borderRadius: "50%", border: "none", background: P.row, color: P.ink, fontSize: 16, fontWeight: 800, cursor: "pointer" }}>✕</button>
        </div>

        <div style={{ overflowY: "auto", padding: "12px 18px 22px" }}>
          {editable && (
            <button onClick={() => pickFile(null)} disabled={busy}
              style={{ width: "100%", minHeight: 48, borderRadius: 12, border: `1.5px dashed ${P.accent}`, background: "transparent", color: P.accent, fontSize: 14, fontWeight: 800, cursor: busy ? "default" : "pointer", marginBottom: 6 }}>
              {busy ? "מעלה…" : "➕ הוסף קובץ כללי"}
            </button>
          )}
          {err && <div role="alert" style={{ color: P.accent, fontSize: 12.5, fontWeight: 700, margin: "4px 2px 8px" }}>{err}</div>}
          <input ref={inputRef} data-testid="trip-files-input" type="file" accept={ACCEPT} style={{ display: "none" }} onChange={onPicked} />

          {groups.map((g) => (
            (g.items.length > 0 || g.key === "general") && (
              <section key={g.key} style={{ marginTop: 16 }}>
                <h3 style={{ fontSize: 12.5, fontWeight: 800, color: P.ink2, margin: "0 0 8px" }}>{g.title}</h3>
                {g.items.length === 0 && (
                  <div style={{ fontSize: 12.5, color: P.ink2, padding: "8px 2px" }}>אין עדיין קבצים כלליים.</div>
                )}
                {g.items.map((row) => {
                  const kind = fileKind(row.type, row.name);
                  const key = row.kind === "general" ? row.id : `${row.dayNum}:${row.stopIdx}:${row.fi}`;
                  return (
                    <div key={key} style={{ display: "flex", alignItems: "center", gap: 10, background: P.row, borderRadius: 12, padding: "10px 12px", marginBottom: 8, minHeight: 56 }}>
                      <span aria-hidden style={{ fontSize: 20 }}>{fileEmoji(kind)}</span>
                      <button onClick={() => setViewing(row)} style={{ flex: 1, minWidth: 0, textAlign: "start", border: "none", background: "transparent", color: P.ink, cursor: "pointer", fontFamily: "inherit", padding: 0 }}>
                        {renaming && renaming._k === key ? (
                          <input autoFocus defaultValue={row.label}
                            onClick={(e) => e.stopPropagation()}
                            onBlur={(e) => commitRename(row, e.target.value)}
                            onKeyDown={(e) => { if (e.key === "Enter") commitRename(row, e.currentTarget.value); if (e.key === "Escape") setRenaming(null); }}
                            style={{ width: "100%", font: "inherit", fontWeight: 700, color: P.ink, background: P.sheet, border: `1px solid ${P.line}`, borderRadius: 8, padding: "6px 8px" }} />
                        ) : (
                          <>
                            <div dir="auto" style={{ fontSize: 13.5, fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{row.label}</div>
                            <div style={{ fontSize: 11.5, color: P.ink2 }}>
                              {humanSize(row.size)}{row.persisted === false ? " · לא נשמר — מצב הדגמה" : ""}
                              {row.kind === "stop" && row.stopName ? ` · ${row.stopName}` : ""}
                            </div>
                          </>
                        )}
                      </button>

                      {editable && (
                        <button aria-label={`שנה שם ל-${row.label}`} title="שנה שם"
                          onClick={() => setRenaming({ ...row, _k: key })}
                          style={{ width: 44, height: 44, border: "none", background: "transparent", color: P.ink2, fontSize: 15, cursor: "pointer" }}>✏️</button>
                      )}
                      {editable && (
                        <button aria-label={`פעולות עבור ${row.label}`} title="פעולות"
                          onClick={() => setMenuFor(menuFor && menuFor._k === key ? null : { ...row, _k: key })}
                          style={{ width: 44, height: 44, border: "none", background: "transparent", color: P.ink2, fontSize: 18, cursor: "pointer" }}>⋯</button>
                      )}

                      {menuFor && menuFor._k === key && (
                        <div role="menu" style={{ position: "absolute", insetInlineEnd: 18, background: P.sheet, border: `1px solid ${P.line}`, borderRadius: 12, boxShadow: "0 10px 30px rgba(0,0,0,0.25)", padding: 6, zIndex: 2 }}>
                          {row.kind === "general" && (
                            <>
                              <div style={{ fontSize: 11, color: P.ink2, padding: "4px 10px" }}>העבר ל…</div>
                              <button onClick={() => { onMove(row, null); setMenuFor(null); }} style={menuItem(P)}>כללי</button>
                              {Array.from({ length: dayCount }, (_, i) => i + 1).map((d) => (
                                <button key={d} onClick={() => { onMove(row, d); setMenuFor(null); }} style={menuItem(P)}>{`יום ${d}`}</button>
                              ))}
                              <div style={{ height: 1, background: P.line, margin: "6px 0" }} />
                            </>
                          )}
                          <button onClick={() => { onDelete(row); setMenuFor(null); }} style={{ ...menuItem(P), color: P.accent }}>מחק</button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </section>
            )
          ))}
        </div>
      </div>

      {viewing && (
        <AttachmentViewer
          file={viewing}
          onClose={() => setViewing(null)}
          onDelete={editable ? () => { onDelete(viewing); setViewing(null); } : undefined}
        />
      )}
    </div>
  );
}

const menuItem = (P) => ({
  display: "block", width: "100%", textAlign: "start", minHeight: 40, padding: "0 12px",
  border: "none", background: "transparent", color: P.ink, fontFamily: "inherit",
  fontSize: 13, fontWeight: 700, cursor: "pointer", borderRadius: 8,
});
```

> **Note on `renaming._k` / `menuFor._k`:** the test triggers rename via the `✏️` button (`שנה שם ל-…`) then types into the `getByDisplayValue` input. Keep the `_k` composite-key approach so a general file and a stop attachment with the same label don't collide.

- [ ] **Step 4: Run the test, verify it passes**

Run: `CI=true npx react-scripts test src/components/TripFilesSheet.test.js --watchAll=false`
Expected: PASS (8 tests). If `getAllByRole("heading")` picks up stray headings, ensure only the `<h3>` section titles use a heading role in this component.

- [ ] **Step 5: Commit**

```bash
git add src/components/TripFilesSheet.jsx src/components/TripFilesSheet.test.js
git commit -m "feat(files): TripFilesSheet grouped gallery component"
```

---

### Task 6: Wire the gallery into the mobile editor (`EditorView.jsx`)

**Files:**
- Modify: `src/views/EditorView.jsx`

**Interfaces:**
- Consumes: `TripFilesSheet` (Task 5); `uploadAttachment`, `removeStoredFile` from `../services/attachmentService`; `newFileId` from `../utils/tripFiles`.
- Produces: no new exports. A 🗂️ header button + the rendered sheet + upload/rename/move/delete handlers operating on `trip.data`.

**Context:** `EditorView` keeps its own inline editor state (it does **not** use `useEditorState`). It already has `trip` in state (a `setTrip` updater is used around line 1876) and persists via `tripService.saveTrip(trip.id, { data })`. Follow the existing `onAttachFilePicked` pattern (search for it in the file) for the upload plumbing — reuse its `setTrip(...)` + save idiom. Do not refactor the existing per-stop attachment flow.

- [ ] **Step 1: Add state + a persist helper**

Near the other `useState` hooks in the `EditorView` component body (around line 1339-1347 where `attachViewer` etc. live), add:

```jsx
  const [filesSheetOpen, setFilesSheetOpen] = useState(false);
  const [filesBusy, setFilesBusy] = useState(false);
```

Add a helper next to the existing save logic (mirror how `onAttachFilePicked` writes back — same `setTrip` + `tripService.saveTrip(next.id, { data: next.data })` shape):

```jsx
  /* Persist a mutated trip.data (general files live at trip.data.files[]). */
  const persistTripData = useCallback((mutateData) => {
    setTrip((prev) => {
      if (!prev) return prev;
      const nextData = mutateData(prev.data || {});
      const next = { ...prev, data: nextData };
      if (!prev.readOnly) tripService.saveTrip(prev.id, { data: nextData }).catch(() => {});
      return next;
    });
  }, []);
```

- [ ] **Step 2: Add the upload / rename / move / delete handlers**

```jsx
  const tripFiles = trip?.data?.files || [];
  const dayCount = (trip?.data?.tripData || []).length;
  const filesEditable = !!trip && !trip.readOnly;

  const handleFileUpload = useCallback(async (file, day) => {
    setFilesBusy(true);
    try {
      const meta = await uploadAttachment(trip?.id, file);
      persistTripData((data) => ({
        ...data,
        files: [...(data.files || []), {
          ...meta, id: newFileId(), label: meta.name, day: day ?? null,
          addedAt: new Date().toISOString(),
        }],
      }));
    } catch {
      setCopyToast && setCopyToast("שגיאה בהעלאת הקובץ");
    } finally {
      setFilesBusy(false);
    }
  }, [trip, persistTripData]);

  const handleFileRename = useCallback((row, label) => {
    if (row.kind === "general") {
      persistTripData((data) => ({
        ...data,
        files: (data.files || []).map((f) => (f.id === row.id ? { ...f, label } : f)),
      }));
    } else {
      persistTripData((data) => ({
        ...data,
        tripData: (data.tripData || []).map((d) => d.day !== row.dayNum ? d : {
          ...d,
          attractions: d.attractions.map((a, i) => i !== row.stopIdx ? a : {
            ...a,
            attachments: (a.attachments || []).map((f, k) => k === row.fi ? { ...f, label } : f),
          }),
        }),
      }));
    }
  }, [persistTripData]);

  const handleFileMove = useCallback((row, day) => {
    if (row.kind !== "general") return;
    persistTripData((data) => ({
      ...data,
      files: (data.files || []).map((f) => (f.id === row.id ? { ...f, day: day ?? null } : f)),
    }));
  }, [persistTripData]);

  const handleFileDelete = useCallback((row) => {
    if (row.path) removeStoredFile(row.path).catch((e) => console.warn("removeStoredFile", e));
    if (row.kind === "general") {
      persistTripData((data) => ({ ...data, files: (data.files || []).filter((f) => f.id !== row.id) }));
    } else {
      persistTripData((data) => ({
        ...data,
        tripData: (data.tripData || []).map((d) => d.day !== row.dayNum ? d : {
          ...d,
          attractions: d.attractions.map((a, i) => i !== row.stopIdx ? a : {
            ...a,
            attachments: (a.attachments || []).filter((_, k) => k !== row.fi),
          }),
        }),
      }));
    }
  }, [persistTripData]);
```

> If `setCopyToast` is not in scope here, use whichever toast setter the surrounding code uses (search `Toast(` near the attachment error handling, ~line 1424 references an attachment-upload failure toast — reuse that exact setter).

- [ ] **Step 3: Add the header button**

In the `<header className="tp-ed-header">` block (starts line 2947), add as the first child after the `{saving && …}` chip:

```jsx
        <button
          onClick={() => setFilesSheetOpen(true)}
          title="קבצי הטיול" aria-label="קבצי הטיול" className="tp-press"
          style={{
            position: "relative", flexShrink: 0,
            width: 40, height: 40, borderRadius: "50%", border: "none",
            background: "#fff", color: "#1E1E24", cursor: "pointer",
            boxShadow: "0 2px 8px rgba(0,0,0,0.08)", fontSize: 17,
            display: "inline-flex", alignItems: "center", justifyContent: "center",
          }}>
          🗂️
          {(tripFiles.length + (trip?.data?.tripData || []).reduce((n, d) => n + (d.attractions || []).reduce((m, a) => m + ((a.attachments || []).length), 0), 0)) > 0 && (
            <span style={{ position: "absolute", top: -3, insetInlineStart: -3, minWidth: 18, height: 18, padding: "0 4px", borderRadius: 999, background: "#D94025", color: "#fff", fontSize: 10.5, fontWeight: 800, display: "inline-flex", alignItems: "center", justifyContent: "center", border: "2px solid #fff" }}>
              {tripFiles.length + (trip?.data?.tripData || []).reduce((n, d) => n + (d.attractions || []).reduce((m, a) => m + ((a.attachments || []).length), 0), 0)}
            </span>
          )}
        </button>
```

- [ ] **Step 4: Render the sheet**

Next to the other portals/modals near the `attachViewer` block (~line 4270), add:

```jsx
      <TripFilesSheet
        open={filesSheetOpen}
        onClose={() => setFilesSheetOpen(false)}
        tripData={trip?.data?.tripData || []}
        files={tripFiles}
        dayCount={dayCount}
        editable={filesEditable}
        busy={filesBusy}
        onUpload={handleFileUpload}
        onRename={handleFileRename}
        onMove={handleFileMove}
        onDelete={handleFileDelete}
      />
```

Add the imports at the top of the file:

```jsx
import TripFilesSheet from "../components/TripFilesSheet";
import { removeStoredFile } from "../services/attachmentService";   // add to the existing attachmentService import if present
import { newFileId } from "../utils/tripFiles";
```

(`uploadAttachment` is already imported at `EditorView.jsx:23` — extend that line to also import `removeStoredFile` rather than adding a second import.)

- [ ] **Step 5: Manual smoke + build**

Run: `CI=true npx react-scripts build`
Expected: build succeeds (no unused-import or syntax errors).

Then `npm start`, open a trip at `/map/edit/<id>`, click 🗂️:
- add a PDF as כללי → appears under כללי, badge increments;
- open it → viewer shows it;
- ⋯ → יום 2 → moves under יום 2;
- ✏️ rename → label updates and survives a reload;
- ⋯ → מחק → row goes, and (Supabase on) the object is gone from the bucket.

- [ ] **Step 6: Commit**

```bash
git add src/views/EditorView.jsx
git commit -m "feat(files): trip files button + gallery in the mobile editor"
```

---

### Task 7: Wire the gallery into the desktop editor (`EditorDesktop.jsx`)

**Files:**
- Modify: `src/views/EditorDesktop.jsx`

**Interfaces:**
- Consumes: `TripFilesSheet`; the `useEditorState` return values `tripFiles, addTripFile, updateTripFile, removeTripFile, renameAttachmentAt, days, editable, trip` (Task 3); `uploadAttachment`, `removeStoredFile`; `newFileId`.
- Produces: no new exports.

**Context:** `EditorDesktop` **does** use `useEditorState` (it already destructures `addAttachmentToStop, removeAttachmentAt` at line 101 and imports `uploadAttachment` at line 17).

- [ ] **Step 1: Pull the new hook values + local state**

Extend the `useEditorState(...)` destructure (line ~101) with:
`tripFiles, addTripFile, updateTripFile, removeTripFile, renameAttachmentAt,`

Add near the other `useState` in the component:

```jsx
  const [filesSheetOpen, setFilesSheetOpen] = useState(false);
  const [filesBusy, setFilesBusy] = useState(false);
```

- [ ] **Step 2: Handlers**

```jsx
  const handleFileUpload = useCallback(async (file, day) => {
    setFilesBusy(true);
    try {
      const meta = await uploadAttachment(trip?.id, file);
      addTripFile({ ...meta, id: newFileId(), label: meta.name, day: day ?? null, addedAt: new Date().toISOString() });
    } catch {
      /* reuse the desktop attachment-error toast if present; otherwise console.warn */
      console.warn("trip file upload failed");
    } finally {
      setFilesBusy(false);
    }
  }, [trip, addTripFile]);

  const handleFileRename = useCallback((row, label) => {
    if (row.kind === "general") updateTripFile(row.id, { label });
    else renameAttachmentAt(row.dayNum, row.stopIdx, row.fi, label);
  }, [updateTripFile, renameAttachmentAt]);

  const handleFileMove = useCallback((row, day) => {
    if (row.kind === "general") updateTripFile(row.id, { day: day ?? null });
  }, [updateTripFile]);

  const handleFileDelete = useCallback((row) => {
    if (row.path) removeStoredFile(row.path).catch((e) => console.warn("removeStoredFile", e));
    if (row.kind === "general") removeTripFile(row.id);
    else removeAttachmentAt(row.dayNum, row.stopIdx, row.fi);
  }, [removeTripFile, removeAttachmentAt]);
```

- [ ] **Step 3: Header button + sheet**

Add a button in the desktop editor header/toolbar (find the header toolbar cluster — near the existing top-bar buttons). Use the same 🗂️ + count-badge markup as Task 6 Step 3, adjusted to the desktop palette/token object in this file (`T`).

Render near the bottom, beside the file input at line 1313:

```jsx
      <TripFilesSheet
        open={filesSheetOpen}
        onClose={() => setFilesSheetOpen(false)}
        tripData={days}
        files={tripFiles}
        dayCount={days.length}
        editable={editable}
        busy={filesBusy}
        onUpload={handleFileUpload}
        onRename={handleFileRename}
        onMove={handleFileMove}
        onDelete={handleFileDelete}
      />
```

Imports:

```jsx
import TripFilesSheet from "../components/TripFilesSheet";
import { newFileId } from "../utils/tripFiles";
// extend the line-17 attachmentService import: { uploadAttachment, removeStoredFile }
```

- [ ] **Step 4: Build**

Run: `CI=true npx react-scripts build`
Expected: succeeds.

Manual: open the desktop editor, repeat the Task 6 Step 5 smoke checks.

- [ ] **Step 5: Commit**

```bash
git add src/views/EditorDesktop.jsx
git commit -m "feat(files): trip files button + gallery in the desktop editor"
```

---

### Task 8: "קבצים" section on the trip overview

**Files:**
- Modify: `src/views/TripOverviewView.jsx`
- Modify: `src/views/TripOverviewDesktop.jsx`

**Interfaces:**
- Consumes: `TripFilesSheet`; `buildFileGroups`, `fileKind`, `fileEmoji` from `../utils/tripFiles`; `uploadAttachment`, `removeStoredFile`; `newFileId`; `tripService.saveTrip`.
- Produces: no new exports.

**Context:** `TripOverviewView` loads `trip` via `tripService.fetchTripById` (line ~95) and has no editor state. `editable = !!trip && !trip.readOnly` — same as everywhere else. The page uses `<section>` blocks (lines 267, 290).

- [ ] **Step 1: Add state + persist helper (mirror Task 6 Step 1-2)**

In `TripOverviewView`:

```jsx
  const [filesSheetOpen, setFilesSheetOpen] = useState(false);
  const [filesBusy, setFilesBusy] = useState(false);

  const persistTripData = useCallback((mutateData) => {
    setTrip((prev) => {
      if (!prev) return prev;
      const nextData = mutateData(prev.data || {});
      if (!prev.readOnly) tripService.saveTrip(prev.id, { data: nextData }).catch(() => {});
      return { ...prev, data: nextData };
    });
  }, []);
```

Reuse the exact `handleFileUpload / handleFileRename / handleFileMove / handleFileDelete` bodies from Task 6 Step 2 (they only depend on `persistTripData`, `trip`, and the service functions — all available here). Copy them verbatim; do not `import` them from the editor.

- [ ] **Step 2: Add a "קבצים" section + trigger**

After the last `<section>` (before its closing tag near line 354), add:

```jsx
        <section style={{ padding: "32px 24px 0" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
            <h2 style={{ fontSize: 15, fontWeight: 800, color: P.ink, margin: 0, flex: 1 }}>קבצים</h2>
            <button onClick={() => setFilesSheetOpen(true)}
              style={{ minHeight: 44, padding: "0 14px", borderRadius: 999, border: `1px solid ${P.line}`, background: P.panel, color: P.ink2, fontSize: 13, fontWeight: 800, cursor: "pointer", fontFamily: "inherit" }}>
              🗂️ כל הקבצים
            </button>
          </div>
          {buildFileGroups(days, trip?.data?.files || []).map((g) => (
            g.items.length > 0 && (
              <div key={g.key} style={{ marginBottom: 14 }}>
                <div style={{ fontSize: 12, fontWeight: 800, color: P.ink3, marginBottom: 6 }}>{g.title}</div>
                {g.items.map((row) => (
                  <button key={row.kind === "general" ? row.id : `${row.dayNum}:${row.stopIdx}:${row.fi}`}
                    onClick={() => setFilesSheetOpen(true)}
                    style={{ display: "flex", alignItems: "center", gap: 10, width: "100%", textAlign: "start", minHeight: 48, padding: "8px 12px", marginBottom: 6, borderRadius: 12, border: `1px solid ${P.line}`, background: P.panel, color: P.ink, fontFamily: "inherit", fontSize: 13.5, fontWeight: 700, cursor: "pointer" }}>
                    <span aria-hidden style={{ fontSize: 18 }}>{fileEmoji(fileKind(row.type, row.name))}</span>
                    <span dir="auto" style={{ flex: 1, minWidth: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{row.label}</span>
                  </button>
                ))}
              </div>
            )
          ))}
          {(days.reduce((n, d) => n + (d.attractions || []).reduce((m, a) => m + (a.attachments || []).length, 0), 0) + (trip?.data?.files || []).length) === 0 && (
            <div style={{ fontSize: 13, color: P.ink3 }}>עדיין אין קבצים במסלול.</div>
          )}
        </section>
```

Render the sheet once near the page's other overlays/toasts:

```jsx
      <TripFilesSheet
        open={filesSheetOpen}
        onClose={() => setFilesSheetOpen(false)}
        tripData={days}
        files={trip?.data?.files || []}
        dayCount={days.length}
        editable={!!trip && !trip.readOnly}
        busy={filesBusy}
        onUpload={handleFileUpload}
        onRename={handleFileRename}
        onMove={handleFileMove}
        onDelete={handleFileDelete}
      />
```

Imports:

```jsx
import TripFilesSheet from "../components/TripFilesSheet";
import { buildFileGroups, fileKind, fileEmoji, newFileId } from "../utils/tripFiles";
import { uploadAttachment, removeStoredFile } from "../services/attachmentService";
```

(`P.ink3` / `P.panel` / `P.line` — use whatever token names this file already defines; check the palette object near the top.)

- [ ] **Step 3: `TripOverviewDesktop.jsx`**

This file is 177 lines. If it renders its own layout, add the same "קבצים" section + `<TripFilesSheet>` with the identical props/handlers. If it delegates to `TripOverviewView`, no change is needed — verify by reading the file and note which in the commit message.

- [ ] **Step 4: Build + manual**

Run: `CI=true npx react-scripts build`
Expected: succeeds.

Manual: open `/trip/overview/<id>` → "קבצים" section lists the same grouping; "כל הקבצים" opens the sheet; upload there works when you own the trip; RTL + dark mode both clean.

- [ ] **Step 5: Commit**

```bash
git add src/views/TripOverviewView.jsx src/views/TripOverviewDesktop.jsx
git commit -m "feat(files): קבצים section + gallery on the trip overview"
```

---

### Task 9: QA plan, full gate, worklog

**Files:**
- Modify: `docs/QA-TEST-PLAN.md`
- Modify: `WORKLOG.md`

- [ ] **Step 1: Append manual cases to `docs/QA-TEST-PLAN.md`**

Add a "Trip Files gallery" section:

```markdown
## Trip Files gallery (2026-08-31)

1. Editor (mobile + desktop) → 🗂️ → add `insurance.pdf` as **כללי** → it lists under כללי; header badge +1; reload → still there.
2. ⋯ → **יום 3** → moves under יום 3; reload → persists.
3. ✏️ → rename to "ביטוח נסיעות" → Enter → label persists across reload.
4. Row tap → in-app viewer shows the PDF; ✕ closes.
5. ⋯ → **מחק** → row gone; in Supabase Storage the object under `trip-attachments/<tripId>/…` is gone too.
6. Attach a file to a day-2 stop via the ⋯ "צירוף קובץ" flow → open the gallery → it appears under **יום 2**; rename it there → persists; delete there → removed from the stop.
7. `/map?demo=1` (no Supabase) → add a file → opens/previews; row shows "לא נשמר — מצב הדגמה"; reload → gone (expected).
8. `.xlsx` file → viewer shows the 📄 fallback + "הורדת הקובץ" link.
9. Shared trip as an **edit** collaborator → can add / rename / move / delete. As a **view-only** collaborator → no upload button, no ✏️/⋯, tap only opens the viewer.
10. Trip overview → "קבצים" section shows the same groups; "כל הקבצים" opens the sheet; RTL correct; toggle dark mode — contrast holds, touch targets ≥ 44px.
11. Oversized file (> 15 MB) and a `.zip` → inline rejection in the sheet, no upload attempted.
```

- [ ] **Step 2: Run the full automated gate**

Run: `npm run critical`
Expected: PASS.

Run: `CI=true npx react-scripts test --watchAll=false`
Expected: all suites PASS (new: `tripFiles`, `attachmentService`, `useEditorState.files`, `AttachmentViewer`, `TripFilesSheet`).

Run: `CI=true npx react-scripts build`
Expected: build succeeds.

If any fail, fix before proceeding — do not commit a red gate.

- [ ] **Step 3: Worklog line**

Append to `WORKLOG.md`:

```
2026-08-31 | (main session) | trip files gallery: general files at trip.data.files[] + grouped TripFilesSheet + editor/overview wiring | src/utils/tripFiles.js, src/services/attachmentService.js, src/hooks/useEditorState.js, src/components/{AttachmentViewer,TripFilesSheet}.jsx, src/views/{EditorView,EditorDesktop,TripOverviewView,TripOverviewDesktop}.jsx | done, npm run critical green
```

- [ ] **Step 4: Commit**

```bash
git add docs/QA-TEST-PLAN.md WORKLOG.md
git commit -m "docs(files): QA cases + worklog for trip files gallery"
```

---

## Self-Review

**1. Spec coverage**

| Spec item | Task |
|---|---|
| `trip.data.files[]` shape (id/name/label/type/url/path/size/day/addedAt/persisted) | 1 (utils), 6/7/8 (`addedAt`, `label`, `day` set on upload) |
| No migration / no RLS / reuse bucket | 1, 2 (bucket const), no schema task exists — correct |
| Broaden accepted types (pdf/image/docx/xlsx/txt), keep 15 MB | 2 (`isAllowedFile`), 5 (`ACCEPT` + guard) |
| `removeStoredFile(path)` permanent delete | 2; called in 6/7/8 delete handlers |
| Hook mutators `addTripFile/updateTripFile/removeTripFile/renameAttachmentAt` | 3 |
| `buildFileGroups` — general first, day order, empty days hidden | 1 |
| `TripFilesSheet` — sections, rename inline, move (general only), delete, demo hint, read-only | 5 |
| Reuse in-app viewer / non-previewable → download | 4 (`AttachmentViewer`), used by 5 |
| Entry points: editor toolbar (mobile + desktop) | 6, 7 |
| Entry point: editor header menu item | **GAP → see note below** |
| Entry point: trip overview "קבצים" section, upload allowed | 8 |
| Demo mode: session blob, marked unsaved, delete drops metadata | 2 (upload path unchanged), 5 (hint), 6/7/8 (delete guards on `row.path`) |
| Error handling: upload toast, oversize/type inline, removeStoredFile failure non-blocking | 5 (inline), 6/7/8 (toast + `.catch` on `removeStoredFile`) |
| Permissions: `editable` gates write; collaborators with edit get full control | 5 (prop), 6/7/8 (`!trip.readOnly`) |
| Tests: attachmentService / hook / buildFileGroups / component / gate | 1, 2, 3, 4, 5, 9 |
| QA plan + WORKLOG | 9 |

**Gap resolved:** the spec lists a "קבצי הטיול" item in the editor's own header menu as a secondary entry point. Tasks 6/7 add the 🗂️ toolbar button but not the menu item. **Decision:** the toolbar button is always visible and covers the need; the menu item is redundant. Drop it from scope (matches the "Toolbar button is enough" option that was offered). If it's still wanted, it's a one-line addition in each editor's existing menu array pointing at `setFilesSheetOpen(true)` — not worth its own task. This is noted here rather than adding a task.

**2. Placeholder scan:** No "TBD"/"handle edge cases"/"similar to Task N". Every code step has real code. Task 7 Step 3 and Task 8 Step 3 say "find the existing header toolbar / read the file" rather than quoting a line — acceptable because those files weren't fully quoted here and the pattern to copy (Task 6 Step 3) is fully spelled out.

**3. Type consistency:**
- `FileRow` shape defined in Task 1 (`kind`, `id`/`dayNum`+`stopIdx`+`fi`, `label`, `name`, `type`, `url`, `path`, `size`, `persisted`, `day`/`stopName`) — consumed unchanged in Tasks 5, 6, 7, 8.
- `buildFileGroups(tripData, files)` argument order — same in Tasks 1, 5, 8.
- `onUpload(file, day)` with `day: number|null` — Task 5 defines, Tasks 6/7/8 implement with `day ?? null`.
- `removeStoredFile(path)` — Task 2 defines, Tasks 6/7/8 call with `row.path`.
- Hook return names `tripFiles`, `addTripFile`, `updateTripFile`, `removeTripFile`, `renameAttachmentAt` — Task 3 defines, Task 7 consumes. (Task 6 does not use the hook — it has its own `persistTripData`, consistent with `EditorView` not using `useEditorState`.)
- `newFileId()` — Task 1 (`tripFiles.js`), imported in Tasks 6/7/8. Not in `attachmentService`.

No inconsistencies found.

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-08-31-trip-files-gallery.md`. Two execution options:

1. **Subagent-Driven (recommended)** — a fresh subagent per task, two-stage review between tasks, fast iteration.
2. **Inline Execution** — tasks run in this session via executing-plans, batched with review checkpoints.

Which approach?
