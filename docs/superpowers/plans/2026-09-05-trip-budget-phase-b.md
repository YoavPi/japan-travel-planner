# Trip Budget Phase B (per-stop cost) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** let the user attach a cost to any stop directly from the editor (mobile + desktop), with the money staying correctly linked through delete/move/reorder, and the editor's ₪ chip switching from "navigate to the budget screen" to "quick-add an expense in place."

**Architecture:** The surface that owns `trip.data` is the surface that writes it — budget mutations initiated from the editor go through the editor's own commit function (`persistTripData` on mobile, `commitData` on desktop), never through `useBudget` (which is the sole writer only on `/trip/budget/:tripId`). A stamp-and-link operation (lazy `instanceId` + add expense) is one atomic write, not two. Every non-trivial decision (linkage read, detach, confirm-dialog copy) lives in the already-tested pure functions in `src/utils/budget.js`; the editor files only wire them up.

**Tech Stack:** React 19, Jest + React Testing Library, no new dependencies.

**Spec:** [docs/superpowers/specs/2026-09-03-trip-budget-design.md](../specs/2026-09-03-trip-budget-design.md) — §1.5 (instanceId/stopRef), §5 (two-tier confirmation), §6 (StopActionsSheet), §8.3 (entry points). Architect's Phase B design (WORKLOG.md, 2026-09-05, "Design pass for trip-budget Phases B/C/D") is the direct source for this plan; read it for the three real defects it found in shipped code (all three are already fixed — see "Already done" below).

## Already done (Phase B pre-work, shipped 2026-09-05, commit `280e9fd`)

Do not redo these. They are the foundation this plan builds on:

- `src/utils/classify.js` exports `withFreshInstanceId(stop, genId)` — clones a stop with a fresh `instanceId`. Already wired into all 4 mobile clone paths and the desktop `duplicateStopAt`.
- `src/utils/budget.js` exports three pure functions, fully tested (`src/utils/budget.test.js`):
  - `expensesForStop(items, stopId)` → items where `stopRef === stopId`, order-preserving.
  - `detachStopExpenses(items, stopId)` → new array with matching items' `stopRef` cleared to `null`; non-matching items pass through by identity (cheap no-op diffing, same convention as `remapFileDays`/`remapExpenseDays`). `detachStopExpenses(items, null)` returns `items` unchanged.
  - `budgetImpact(action, ctx)` → `{ tier, title, body, confirmLabel }` or `null`. Three actions implemented:
    - `"deleteStop"` / `"moveStopToInbox"`: `ctx = { items, config, stopId }`. Returns `null` if nothing is linked. Body embeds the real amount, e.g. `"לעצירה זו משויכת הוצאה של ₪800.00. היא תעבור ל'כללי' ולא תימחק."` (or the plural form for >1 linked item).
    - `"changeRate"`: `ctx = { items, config, newRate }`. Returns `null` if no paid non-ILS items exist. Body embeds the before/after "בפועל" totals.
  - Mobile's `applyDateRange`/`reorderDays` already remap `budget.items[]` day tags alongside `files[]` (previously files-only — this was the live prod bug from the pre-work pass).

## Global Constraints

- Money is stored in integer minor units everywhere (agorot/cents) — never floats. Every new test asserts exact integers, never `toBeCloseTo`.
- `rollup()` in `src/utils/budget.js` remains the ONLY place totals are computed. No task in this plan adds a second computation path.
- Hebrew, RTL (`dir="rtl"`), 44×44px minimum touch targets, existing font stack `'Noto Sans Hebrew','Inter','Noto Sans JP',system-ui,sans-serif`.
- `src/views/EditorView.jsx` (mobile) and `src/views/EditorDesktop.jsx` + `src/hooks/useEditorState.js` (desktop) are two SEPARATE, independent implementations — mobile does not use `useEditorState`. Every behavior in this plan is implemented twice, once per surface, mirroring each other's intent but each surface's own existing idiom (styling tokens, confirm-dialog shape, state naming).
- `src/views/EditorView.jsx` and `src/views/EditorDesktop.jsx` have **no Jest test harness** (documented, pre-existing, not something this plan fixes). Their tasks substitute a mandatory manual code-review step for the missing test cycle — this is not optional, it is the test cycle for those files.
- No auth, RLS, schema, or route changes anywhere in this plan.
- Async-safety rule (learned from the 2026-09-05 file-attach bug fix in `EditorView.jsx`): never carry a raw array index across an async gap or a re-render boundary as the sole way to address a stop. Every piece of state this plan adds that must survive from "user opened a sheet" to "user submitted it" addresses the stop by `(day, instanceId)`, resolved fresh against the live `trip.data` at render/submit time — never a cached index.

---

### Task 1: Desktop per-stop cost handlers (`useEditorState.js`)

**Files:**
- Modify: `src/hooks/useEditorState.js`
- Modify: `src/hooks/useEditorState.js` (the `deleteStopAt`, `moveStopToInbox` functions — same file, called out separately below because they change *behavior*, not just gain new siblings)
- Test: `src/hooks/useEditorState.budget.test.js` (new)

**Interfaces:**
- Consumes: `expensesForStop(items, stopId)`, `detachStopExpenses(items, stopId)`, `ensureBudget(data)`, `addExpense(data, expense)`, `updateExpense(data, id, patch)` — all from `../utils/budget` (already imported or importable; `ensureBudget`/`addExpense`/`updateExpense` are not yet imported in this file, add them).
- Produces (new hook exports, added to the existing return object):
  - `saveStopCost(dayNum, idx, payload)` — `payload: { label: string, amountMinor: number, currency: string, category: string, note: string }`. Creates or updates the ONE expense linked to that stop.
  - `removeStopCost(expenseId)` — deletes an expense by its own `id` (used by the "delete this cost" action inside the cost sheet).
  - `costForStop(stopId)` — reads (no write): returns the single linked expense object or `null`. Consumed by `EditorDesktop.jsx` (Task 5) to build the "💰 עריכת עלות · ₪120" row label without duplicating the lookup logic.
- `deleteStopAt(dayNum, idx)` and `moveStopToInbox(dayNum, idx)` keep their existing signatures but change internally: they now detach any linked expense in the SAME atomic write instead of just moving the itinerary.

- [ ] **Step 1: Write the failing tests**

```javascript
// src/hooks/useEditorState.budget.test.js
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

const baseTrip = () => ({
  id: "t1", readOnly: false,
  data: {
    tripData: [{ day: 1, attractions: [{ instanceId: "s1", name: "Sensoji", coordinates: { lat: 1, lng: 1 } }] }],
    budget: { config: { currency: "ILS", rate: 1, categories: [] }, items: [] },
  },
});

beforeEach(() => {
  tripService.fetchTripById.mockResolvedValue(JSON.parse(JSON.stringify(baseTrip())));
  tripService.saveTrip.mockClear();
  tripService.saveTrip.mockResolvedValue(undefined);
});

test("saveStopCost on a stop with an instanceId creates one linked expense in a single save", async () => {
  const { result } = renderHook(() => useEditorState("t1"));
  await waitFor(() => expect(result.current.trip).toBeTruthy());

  act(() => result.current.saveStopCost(1, 0, {
    label: "כניסה למקדש", amountMinor: 50000, currency: "ILS", category: "activities", note: "",
  }));

  const items = result.current.trip.data.budget.items;
  expect(items).toHaveLength(1);
  expect(items[0]).toMatchObject({ label: "כניסה למקדש", amountMinor: 50000, currency: "ILS", stopRef: "s1" });
  expect(tripService.saveTrip).toHaveBeenCalledTimes(1);
});

test("saveStopCost on a stop with NO instanceId stamps one and links in the SAME save", async () => {
  const trip = baseTrip();
  trip.data.tripData[0].attractions[0].instanceId = undefined;
  tripService.fetchTripById.mockResolvedValue(JSON.parse(JSON.stringify(trip)));
  const { result } = renderHook(() => useEditorState("t1"));
  await waitFor(() => expect(result.current.trip).toBeTruthy());

  act(() => result.current.saveStopCost(1, 0, {
    label: "טקסי", amountMinor: 3000, currency: "ILS", category: "transport", note: "",
  }));

  const stop = result.current.trip.data.tripData[0].attractions[0];
  expect(stop.instanceId).toBeTruthy();
  const items = result.current.trip.data.budget.items;
  expect(items[0].stopRef).toBe(stop.instanceId);
  expect(tripService.saveTrip).toHaveBeenCalledTimes(1); // one call, not two
});

test("saveStopCost called twice on the same stop UPDATES, never creates a second item", async () => {
  const { result } = renderHook(() => useEditorState("t1"));
  await waitFor(() => expect(result.current.trip).toBeTruthy());

  act(() => result.current.saveStopCost(1, 0, { label: "א", amountMinor: 1000, currency: "ILS", category: "other", note: "" }));
  act(() => result.current.saveStopCost(1, 0, { label: "ב", amountMinor: 2000, currency: "ILS", category: "other", note: "" }));

  const items = result.current.trip.data.budget.items;
  expect(items).toHaveLength(1);
  expect(items[0]).toMatchObject({ label: "ב", amountMinor: 2000 });
});

test("removeStopCost deletes the expense by id", async () => {
  const { result } = renderHook(() => useEditorState("t1"));
  await waitFor(() => expect(result.current.trip).toBeTruthy());
  act(() => result.current.saveStopCost(1, 0, { label: "א", amountMinor: 1000, currency: "ILS", category: "other", note: "" }));
  const id = result.current.trip.data.budget.items[0].id;

  act(() => result.current.removeStopCost(id));

  expect(result.current.trip.data.budget.items).toHaveLength(0);
});

test("deleteStopAt detaches (not deletes) a linked expense, in the same save as the itinerary removal", async () => {
  const { result } = renderHook(() => useEditorState("t1"));
  await waitFor(() => expect(result.current.trip).toBeTruthy());
  act(() => result.current.saveStopCost(1, 0, { label: "א", amountMinor: 1000, currency: "ILS", category: "other", note: "" }));
  tripService.saveTrip.mockClear();

  act(() => result.current.deleteStopAt(1, 0));

  expect(result.current.trip.data.tripData[0].attractions).toHaveLength(0);
  const items = result.current.trip.data.budget.items;
  expect(items).toHaveLength(1); // NOT deleted
  expect(items[0].stopRef).toBeNull();
  expect(tripService.saveTrip).toHaveBeenCalledTimes(1); // one atomic write
});

test("moveStopToInbox detaches a linked expense the same way", async () => {
  const { result } = renderHook(() => useEditorState("t1"));
  await waitFor(() => expect(result.current.trip).toBeTruthy());
  act(() => result.current.saveStopCost(1, 0, { label: "א", amountMinor: 1000, currency: "ILS", category: "other", note: "" }));

  act(() => result.current.moveStopToInbox(1, 0));

  const items = result.current.trip.data.budget.items;
  expect(items[0].stopRef).toBeNull();
});

test("costForStop returns the linked expense or null", async () => {
  const { result } = renderHook(() => useEditorState("t1"));
  await waitFor(() => expect(result.current.trip).toBeTruthy());
  expect(result.current.costForStop("s1")).toBeNull();

  act(() => result.current.saveStopCost(1, 0, { label: "א", amountMinor: 1000, currency: "ILS", category: "other", note: "" }));

  expect(result.current.costForStop("s1")).toMatchObject({ label: "א", amountMinor: 1000 });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `CI=true npx react-scripts test --watchAll=false --testPathPattern="useEditorState.budget"`
Expected: FAIL — `saveStopCost is not a function` (and similarly for the other new exports).

- [ ] **Step 3: Implement**

Add the import (top of `src/hooks/useEditorState.js`, alongside the existing `remapExpenseDays` import):

```javascript
import {
  remapExpenseDays, ensureBudget, addExpense, updateExpense, removeExpense,
  expensesForStop, detachStopExpenses,
} from "../utils/budget";
```

Add `saveStopCost`, `removeStopCost`, `costForStop` (place them near `duplicateStopAt`, after it):

```javascript
  /* Per-stop cost (Phase B). One expense per stop — saveStopCost creates or
     updates it. Stamps a lazy instanceId if the stop doesn't have one yet
     (most stops from the AI pipeline / wizard / seed data don't), and does
     the stamp + the budget write in ONE commitData call: two separate
     commits here would risk the second one saving over a stale snapshot of
     the first, per the itinerary-vs-budget single-writer rule this phase is
     built around. */
  const saveStopCost = useCallback((dayNum, idx, payload) => {
    commitData((data) => {
      const day = (data.tripData || []).find((d) => d.day === dayNum);
      const stop = day?.attractions?.[idx];
      if (!stop) return data;
      let stopId = stop.instanceId;
      let nextTripData = data.tripData;
      if (!stopId) {
        stopId = genId();
        nextTripData = data.tripData.map((d) => d.day !== dayNum ? d : {
          ...d, attractions: d.attractions.map((a, i) => i === idx ? { ...a, instanceId: stopId } : a),
        });
      }
      const withBudget = ensureBudget({ ...data, tripData: nextTripData });
      const existing = expensesForStop(withBudget.budget.items, stopId)[0];
      const next = existing
        ? updateExpense(withBudget, existing.id, payload)
        : addExpense(withBudget, { ...payload, stopRef: stopId });
      return next;
    });
  }, [commitData]);

  const removeStopCost = useCallback((expenseId) => {
    commitData((data) => removeExpense(data, expenseId));
  }, [commitData]);

  const costForStop = useCallback((stopId) => {
    const items = trip?.data?.budget?.items || [];
    return expensesForStop(items, stopId)[0] || null;
  }, [trip]);
```

Change `deleteStopAt` and `moveStopToInbox` to detach in the same write. `deleteStopAt` currently uses `commitDays` (tripData-only); switch it to `commitData` so it can touch `budget.items` too:

```javascript
  const deleteStopAt = useCallback((dayNum, idx) => {
    commitData((data) => {
      const day = (data.tripData || []).find((d) => d.day === dayNum);
      const stop = day?.attractions?.[idx];
      const nextTripData = (data.tripData || []).map((d) => d.day === dayNum
        ? { ...d, attractions: d.attractions.filter((_, i) => i !== idx) } : d);
      if (!data.budget || !stop?.instanceId) return { ...data, tripData: nextTripData };
      return { ...data, tripData: nextTripData,
        budget: { ...data.budget, items: detachStopExpenses(data.budget.items, stop.instanceId) } };
    });
  }, [commitData]);
```

`moveStopToInbox` already calls `deleteStopAt(dayNum, idx)` as its first step (line ~299) — no change needed there, it inherits the detach automatically. Its own `[trip, deleteStopAt]` dependency array is already correct.

Add the three new names to the hook's return statement:

```javascript
  return {
    trip, error, saving,
    days, tripFiles, activeDay, setActiveDay, activeDayData, mapStops,
    editable, commitDays, reload,
    deleteStopAt, duplicateStopAt, moveStopToDay, setStopNote, reorderInDay, setDayOrder, addStopToDay,
    addTransitToDay, updateStopAt, addAttachmentToStop, removeAttachmentAt, insertAt, addTripFile, updateTripFile, removeTripFile, renameAttachmentAt,
    addDay, deleteDay, saveStartDate, applyDateRange, moveStopToInbox, saveCustomPin, addSearchedToInbox,
    inbox, inboxLoading, loadInbox, assignInboxToDay, removeFromInbox, updateInboxNote, connectSavedPlaces,
    saveStopCost, removeStopCost, costForStop,
  };
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `CI=true npx react-scripts test --watchAll=false --testPathPattern="useEditorState"`
Expected: PASS — all `useEditorState.budget.test.js` tests, plus no regression in `useEditorState.files.test.js` / `useEditorState.instanceId.test.js`.

- [ ] **Step 5: Run the full gate and commit**

Run: `npm run critical && CI=true npm test -- --watchAll=false`
Expected: 9/9 critical, all suites pass.

```bash
git add src/hooks/useEditorState.js src/hooks/useEditorState.budget.test.js
git commit -m "feat(budget): desktop per-stop cost handlers + detach-on-delete/inbox"
```

---

### Task 2: Mobile per-stop cost handlers (`EditorView.jsx`)

**Files:**
- Modify: `src/views/EditorView.jsx`

**Interfaces:**
- Consumes: same four `budget.js` functions as Task 1, plus `guessCategory` is NOT needed here (category comes from the sheet's own default). Also consumes `withFreshInstanceId`/`genInstanceId` already imported in this file (used identically to Task 1's `genId`).
- Produces (new local functions, mobile-only, not exported — this file has no module exports beyond the component):
  - `saveStopCost(idx, payload)` — same payload shape as desktop's, but takes only `idx` (day is implicit: `activeDay`, matching this file's existing index-addressed handlers like `deleteStopAt(idx)`).
  - `removeStopCost(expenseId)`.
  - `costForStop(stopId)` — same read-only lookup as desktop's `costForStop`.
- Changes existing behavior: `deleteStopAt(idx)` (swipe-delete, WITH 5-second undo) and `requestInboxAt(idx)` (swipe-to-bank, WITH 10-second undo) both detach a linked expense as part of their atomic write, AND their undo pills gain a money fact + correctly RE-ATTACH the expense if the user hits "בטל". `deleteStop()` (the 3-dot "מחיקה מהמסלול" action, actionsIdx-based, NO undo) is renamed in behavior only — Task 6 adds the confirm gate in front of it; this task just makes sure it also detaches when it does fire.

No test file — this file has no Jest harness. Step 5 below is the substitute test cycle: a mandatory manual read-through.

- [ ] **Step 1: Add the imports**

`src/views/EditorView.jsx` already imports `remapExpenseDays` from `../utils/budget` (line 27) and `withFreshInstanceId` from `../utils/classify` (line 21). Extend the budget import:

```javascript
import { remapExpenseDays, ensureBudget, addExpense, updateExpense, removeExpense, expensesForStop, detachStopExpenses, formatMoney, toIlsMinor } from "../utils/budget";
```

(`formatMoney`/`toIlsMinor` are needed for the undo-toast money fact in Step 3.)

- [ ] **Step 2: Implement `saveStopCost` / `removeStopCost` / `costForStop`**

Place these near `requestAttach`/`onAttachFilePicked` (same file region, same "acts on the active day's stop" family). Use `persistTripData` (already defined in this file, mutates the whole `data` blob — the mobile equivalent of desktop's `commitData`):

```javascript
  /* Per-stop cost (Phase B) — mobile mirror of useEditorState's saveStopCost.
     Stamps a lazy instanceId if missing and writes the budget in the SAME
     persistTripData call, for the same single-writer reason documented
     there. */
  const saveStopCost = useCallback((idx, payload) => {
    persistTripData((data) => {
      const day = (data.tripData || []).find((d) => d.day === activeDay);
      const stop = day?.attractions?.[idx];
      if (!stop) return data;
      let stopId = stop.instanceId;
      let nextTripData = data.tripData;
      if (!stopId) {
        stopId = genInstanceId();
        nextTripData = data.tripData.map((d) => d.day !== activeDay ? d : {
          ...d, attractions: d.attractions.map((a, i) => i === idx ? { ...a, instanceId: stopId } : a),
        });
      }
      const withBudget = ensureBudget({ ...data, tripData: nextTripData });
      const existing = expensesForStop(withBudget.budget.items, stopId)[0];
      return existing
        ? updateExpense(withBudget, existing.id, payload)
        : addExpense(withBudget, { ...payload, stopRef: stopId });
    });
  }, [activeDay, persistTripData]);

  const removeStopCost = useCallback((expenseId) => {
    persistTripData((data) => removeExpense(data, expenseId));
  }, [persistTripData]);

  const costForStop = useCallback((stopId) => {
    const items = trip?.data?.budget?.items || [];
    return expensesForStop(items, stopId)[0] || null;
  }, [trip]);
```

- [ ] **Step 3: Wire detach + money-aware undo into `deleteStopAt` / `undoDelete`**

Replace the existing `deleteStopAt`/`undoDelete` pair (currently using `commitDays`) with a `persistTripData`-based version that also detaches and remembers what it detached:

```javascript
  const deleteStopAt = useCallback((idx) => {
    const day = (trip?.data?.tripData || []).find((d) => d.day === activeDay);
    const stop = day?.attractions?.[idx];
    if (!stop) return;
    const items = trip?.data?.budget?.items || [];
    const linked = stop.instanceId ? expensesForStop(items, stop.instanceId) : [];
    const linkedIds = linked.map((it) => it.id);
    persistTripData((data) => {
      const nextTripData = (data.tripData || []).map((d) =>
        d.day === activeDay ? { ...d, attractions: d.attractions.filter((_, i) => i !== idx) } : d);
      if (!data.budget || linkedIds.length === 0) return { ...data, tripData: nextTripData };
      return { ...data, tripData: nextTripData,
        budget: { ...data.budget, items: detachStopExpenses(data.budget.items, stop.instanceId) } };
    });
    const moneyNote = linkedIds.length
      ? formatMoney(linked.reduce((s, it) =>
          s + toIlsMinor(Number(it.amountMinor) || 0, it.currency || "ILS", trip.data.budget.config), 0), "ILS")
      : null;
    setDeleteUndo({ stop, day: activeDay, idx, detachedIds: linkedIds, moneyNote });
  }, [trip, activeDay, persistTripData]);

  const undoDelete = useCallback(() => {
    setDeleteUndo((u) => {
      if (!u) return null;
      persistTripData((data) => {
        const nextTripData = (data.tripData || []).map((d) => {
          if (d.day !== u.day) return d;
          const list = [...d.attractions];
          list.splice(Math.min(u.idx, list.length), 0, u.stop);
          return { ...d, attractions: list };
        });
        if (!data.budget || !u.detachedIds?.length) return { ...data, tripData: nextTripData };
        return { ...data, tripData: nextTripData,
          budget: { ...data.budget, items: data.budget.items.map((it) =>
            u.detachedIds.includes(it.id) ? { ...it, stopRef: u.stop.instanceId } : it) } };
      });
      return null;
    });
  }, [persistTripData]);
```

Update the undo toast's text (around line 4094) to include the money fact:

```javascript
          <span style={{ fontSize: 13.5, fontWeight: 700, flex: 1 }}>
            {deleteUndo.moneyNote ? `הנקודה נמחקה · ההוצאה ${deleteUndo.moneyNote} עברה ל'כללי'` : "הנקודה נמחקה"}
          </span>
```

(The `deleteUndo &&` guard already wraps this block — just swap the static string for the computed one, reading `deleteUndo.moneyNote` since `deleteUndo` is in scope there.)

- [ ] **Step 4: Apply the identical detach + money-aware undo pattern to `requestInboxAt` / `restoreFromInbox`**

Same shape as Step 3, applied to the swipe-to-bank pair:

```javascript
  const requestInboxAt = useCallback((idx) => {
    const day = (trip?.data?.tripData || []).find((d) => d.day === activeDay);
    const moved = day?.attractions?.[idx];
    if (!moved) return;
    const items = trip?.data?.budget?.items || [];
    const linked = moved.instanceId ? expensesForStop(items, moved.instanceId) : [];
    const linkedIds = linked.map((it) => it.id);
    persistTripData((data) => {
      const nextTripData = (data.tripData || []).map((d) =>
        d.day === activeDay ? { ...d, attractions: d.attractions.filter((_, i) => i !== idx) } : d);
      if (!data.budget || linkedIds.length === 0) return { ...data, tripData: nextTripData };
      return { ...data, tripData: nextTripData,
        budget: { ...data.budget, items: detachStopExpenses(data.budget.items, moved.instanceId) } };
    });
    const moneyNote = linkedIds.length
      ? formatMoney(linked.reduce((s, it) =>
          s + toIlsMinor(Number(it.amountMinor) || 0, it.currency || "ILS", trip.data.budget.config), 0), "ILS")
      : null;
    setInboxUndo({ stop: moved, day: activeDay, idx, inboxId: null, detachedIds: linkedIds, moneyNote });
    if (moved.coordinates && Number.isFinite(moved.coordinates.lat)) {
      addInboxPlaces([{
        name: moved.name, nameHe: moved.nameHe || moved.name,
        category: moved.category || "אטרקציה", rating: moved.rating || "",
        note: moved.note, lat: moved.coordinates.lat, lng: moved.coordinates.lng,
        source: "unassigned",
      }], tripId).then((saved) => {
        mergeIntoInbox(saved);
        if (saved && saved[0]) setInboxUndo((u) => (u && u.stop === moved ? { ...u, inboxId: saved[0].id } : u));
      }).catch(() => {});
    }
  }, [trip, activeDay, persistTripData, mergeIntoInbox, tripId]);

  const restoreFromInbox = useCallback(() => {
    setInboxUndo((u) => {
      if (!u) return null;
      persistTripData((data) => {
        const nextTripData = (data.tripData || []).map((d) => {
          if (d.day !== u.day) return d;
          const list = [...d.attractions];
          list.splice(Math.min(u.idx, list.length), 0, u.stop);
          return { ...d, attractions: list };
        });
        if (!data.budget || !u.detachedIds?.length) return { ...data, tripData: nextTripData };
        return { ...data, tripData: nextTripData,
          budget: { ...data.budget, items: data.budget.items.map((it) =>
            u.detachedIds.includes(it.id) ? { ...it, stopRef: u.stop.instanceId } : it) } };
      });
      if (u.inboxId) { setInboxPlaces((prev) => (prev || []).filter((x) => x.id !== u.inboxId)); removeInboxPlace(u.inboxId); }
      return null;
    });
  }, [persistTripData]);
```

Note: `requestInboxAt` already had `tripId` available in this file (it's the `useParams()` value used throughout, per the places_inbox trip-scoping fix shipped earlier tonight) — the `addInboxPlaces([...], tripId)` call above just keeps that existing trip-tagging behavior; don't drop it while rewriting this function.

Update the inbox-undo toast's text (around line 4104, the sibling of the delete-undo toast) the same way, using `inboxUndo.moneyNote`.

- [ ] **Step 5: Wire detach into the 3-dot `deleteStop` — and take `idx` as a PARAMETER, not from `actionsIdx` closure**

The existing `deleteStop` reads `actionsIdx` from closure because today it's only ever called synchronously, in the same tick `actionsIdx` is still valid. Task 6 puts a confirm dialog in front of the destructive path, which means the actual deletion can now happen on a LATER tick (whenever the user taps "confirm" in the dialog) — by then, the sheet that opened the dialog has already closed and reset `actionsIdx` to `-1`. So `deleteStop` must take the target index as an explicit argument, captured into the dialog's `onConfirm` closure at the moment the user chose to delete, not re-read from state at confirm-time:

```javascript
  const deleteStop = useCallback((idx) => {
    const stop = (trip?.data?.tripData || []).find((d) => d.day === activeDay)?.attractions?.[idx];
    persistTripData((data) => {
      const nextTripData = (data.tripData || []).map((d) =>
        d.day === activeDay ? { ...d, attractions: d.attractions.filter((_, i) => i !== idx) } : d);
      if (!data.budget || !stop?.instanceId) return { ...data, tripData: nextTripData };
      return { ...data, tripData: nextTripData,
        budget: { ...data.budget, items: detachStopExpenses(data.budget.items, stop.instanceId) } };
    });
    setActionsIdx(-1);
  }, [trip, activeDay, persistTripData]);
```

(Task 6 adds the confirm dialog IN FRONT of the call site that invokes this, passing the captured `idx` into `deleteStop(idx)` — this step only makes the function itself correct and confirm-safe once that call site exists.)

- [ ] **Step 6: Mandatory manual review (the test-cycle substitute for this file)**

Re-read every function touched in Steps 2–5 and confirm, for each:
1. The `data.budget` existence check (`!data.budget || ...`) is present before touching `data.budget.items` — a trip with no budget set up yet must not crash on delete.
2. Every `persistTripData` call in this task returns a full `{ ...data, tripData: ..., budget: ... }` shape (not just `tripData`) — a partial return would silently drop the other half.
3. `activeDay` used inside each function is the closure value at CALL time (these are `useCallback`s depending on `[activeDay, ...]`, so React gives a fresh function per `activeDay` — confirm the dependency array is complete, matching the pattern already used by the neighboring `deleteStopAt`/`copyStopToDay` etc. in this file).

- [ ] **Step 7: Run the gate and commit**

Run: `npm run critical && CI=true npm test -- --watchAll=false && npm run build`
Expected: 9/9 critical, all suites pass (unchanged count — no new tests possible for this file), clean build.

```bash
git add src/views/EditorView.jsx
git commit -m "feat(budget): mobile per-stop cost handlers + money-aware undo"
```

---

### Task 3: `ExpenseSheet.jsx` stop-bound mode

**Files:**
- Modify: `src/components/ExpenseSheet.jsx`
- Modify: `src/components/ExpenseSheet.test.js`

**Interfaces:**
- Consumes: nothing new from `budget.js` (already imports what it needs).
- Produces: two new optional props on `ExpenseSheet`:
  - `stop` — when present, the sheet is in stop-bound mode: no day picker (day is derived from the stop), label/category pre-seed from the stop, and `onSubmit`'s payload has no `dayRef` field at all (the caller ignores it in stop-bound mode — Tasks 1/2's `saveStopCost` payload shape already has no `dayRef`).
  - `onOpenBudget` — when present, renders a text link to the full budget screen at the sheet's foot.

- [ ] **Step 1: Write the failing tests**

Add to `src/components/ExpenseSheet.test.js` (find its existing `render`/setup helper and reuse it — the file already tests the base add/edit flow):

```javascript
test("stop-bound mode: no day picker, label/category seed from the stop, no dayRef in payload", () => {
  const onSubmit = jest.fn();
  const stop = { name: "Sensoji Temple", nameHe: "מקדש סנסוג'י", category: "מקדש" };
  render(<ExpenseSheet open onClose={() => {}} onSubmit={onSubmit} expense={null}
    stop={stop} config={{ currency: "ILS" }} categories={[{ key: "sightseeing", label: "אטרקציות" }, { key: "other", label: "אחר" }]}
    dayCount={5} P={P} />);

  expect(screen.queryByLabelText("שיוך ליום")).not.toBeInTheDocument();
  expect(screen.getByLabelText("תיאור ההוצאה")).toHaveValue("מקדש סנסוג'י");

  fireEvent.change(screen.getByLabelText("סכום"), { target: { value: "80" } });
  fireEvent.click(screen.getByText("הוספה"));

  expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ label: "מקדש סנסוג'י", amountMinor: 8000 }));
  expect(onSubmit.mock.calls[0][0]).not.toHaveProperty("dayRef");
});

test("stop-bound mode: onOpenBudget renders a link to the full screen", () => {
  const onOpenBudget = jest.fn();
  render(<ExpenseSheet open onClose={() => {}} onSubmit={() => {}} expense={null}
    stop={{ name: "X" }} onOpenBudget={onOpenBudget}
    config={{ currency: "ILS" }} categories={[{ key: "other", label: "אחר" }]} dayCount={1} P={P} />);

  fireEvent.click(screen.getByText("למסך התקציב המלא"));
  expect(onOpenBudget).toHaveBeenCalled();
});

test("2-decimal foreign currency stop-bound round-trip is not inflated (regression for T-BUDGET Critical)", () => {
  const onSubmit = jest.fn();
  const expense = { id: "e1", label: "Dinner", amountMinor: 4500, currency: "EUR", category: "food", stopRef: "s1" };
  render(<ExpenseSheet open onClose={() => {}} onSubmit={onSubmit} onDelete={() => {}} expense={expense}
    stop={{ name: "Restaurant", instanceId: "s1" }}
    config={{ currency: "EUR", rate: 4 }} categories={[{ key: "food", label: "אוכל" }]} dayCount={1} P={P} />);

  fireEvent.click(screen.getByText("שמירה"));

  expect(onSubmit.mock.calls[0][0].amountMinor).toBe(4500);
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `CI=true npx react-scripts test --watchAll=false --testPathPattern="ExpenseSheet"`
Expected: FAIL — "שיוך ליום" is found (day picker still renders), no "למסך התקציב המלא" text.

- [ ] **Step 3: Implement**

In `src/components/ExpenseSheet.jsx`, add the two new props and seed logic:

```javascript
export default function ExpenseSheet({
  open, onClose, onSubmit, onDelete, expense, config, categories, dayCount, P, stop, onOpenBudget,
}) {
```

In the seeding effect, when `stop` is present and this is a NEW expense (not editing), seed the label from the stop:

```javascript
  useEffect(() => {
    if (!open) return;
    setLabel(expense?.label || (stop && !expense ? (stop.nameHe || stop.name || "") : ""));
    setCurrency(expense?.currency || tripCurrency);
    setAmount(expense ? minorToInput(expense.amountMinor, expense.currency || tripCurrency) : "");
    setCategory(expense?.category || (stop ? guessCategory(stop.category) : "other"));
    setDayRef(expense?.dayRef != null ? String(expense.dayRef) : "");
    setNote(expense?.note || "");
    setErr("");
    setConfirmDelete(false);
  }, [open, expense, tripCurrency, stop]);
```

Add the `guessCategory` import at the top:

```javascript
import { CURRENCY_SYMBOL, minorDigits, minorFactor, parseAmount, toIlsMinor, guessCategory } from "../utils/budget";
```

Change `submit` so a `dayRef` is only ever included when NOT stop-bound:

```javascript
  const submit = () => {
    if (!label.trim()) { setErr("צריך תיאור להוצאה"); return; }
    if (parsed === null) { setErr("סכום לא תקין — הזינו מספר חיובי"); return; }
    onSubmit({
      label: label.trim(),
      amountMinor: parsed,
      currency,
      category,
      ...(stop ? {} : { dayRef: dayRef === "" ? null : Number(dayRef) }),
      note: note.trim(),
      ...(currencyChanged ? { paid: false, actualMinor: null } : {}),
    });
  };
```

Replace the day-picker block (the `<div style={{ flex: 1 }}>` containing `ex-day`) so it renders only when `!stop`, and when `stop` IS present, render a read-only line instead:

```javascript
        <div style={{ display: "flex", gap: 10, marginBlockEnd: 14 }}>
          <div style={{ flex: 1 }}>
            <label style={lbl} htmlFor="ex-cat">קטגוריה</label>
            <select id="ex-cat" style={field} value={category} aria-label="קטגוריה"
                    onChange={(e) => setCategory(e.target.value)}>
              {categories.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
            </select>
          </div>
          {stop ? (
            <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "flex-end" }}>
              <span style={lbl}>משויך לתחנה</span>
              <span style={{ font: `700 14px ${FONT}`, color: P.ink2, padding: "10px 0" }}>
                {stop.nameHe || stop.name}
              </span>
            </div>
          ) : (
            <div style={{ flex: 1 }}>
              <label style={lbl} htmlFor="ex-day">שיוך ליום</label>
              <select id="ex-day" style={field} value={dayRef} aria-label="שיוך ליום"
                      onChange={(e) => setDayRef(e.target.value)}>
                <option value="">כללי</option>
                {Array.from({ length: dayCount || 0 }, (_, i) => i + 1).map((d) => (
                  <option key={d} value={String(d)}>{`יום ${d}`}</option>
                ))}
              </select>
            </div>
          )}
        </div>
```

Add the `onOpenBudget` link at the foot, just before the closing `</div>` of the panel (after the delete-confirm block):

```javascript
        {onOpenBudget && (
          <button type="button" onClick={onOpenBudget}
                  style={{ width: "100%", minHeight: 40, marginBlockStart: 10, borderRadius: 999,
                           border: "none", background: "transparent", color: P.ink3,
                           font: `700 13px ${FONT}`, cursor: "pointer", textDecoration: "underline" }}>
            למסך התקציב המלא
          </button>
        )}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `CI=true npx react-scripts test --watchAll=false --testPathPattern="ExpenseSheet"`
Expected: PASS — new tests green, existing `BudgetView`-flow tests in the same file still green (they never pass `stop`, so they exercise the untouched branch).

- [ ] **Step 5: Run the gate and commit**

Run: `npm run critical && CI=true npm test -- --watchAll=false`
Expected: 9/9 critical, all suites pass.

```bash
git add src/components/ExpenseSheet.jsx src/components/ExpenseSheet.test.js
git commit -m "feat(budget): ExpenseSheet stop-bound mode"
```

---

### Task 4: `StopActionsSheet.jsx` cost row

**Files:**
- Modify: `src/components/StopActionsSheet.jsx`
- Test: `src/components/StopActionsSheet.test.js` (new)

**Interfaces:**
- Consumes: nothing external — pure presentational addition.
- Produces: two new optional props: `onSetCost` (callback, no args) and `stopCostLabel` (string or `null`). When `onSetCost` is provided, a new row renders in the "תוכן ולינה" section; its label is `stopCostLabel || "הוסף עלות"` with a `💰` icon, prefixed `"עריכת "` when `stopCostLabel` is present (i.e. a cost already exists).

- [ ] **Step 1: Write the failing test**

```javascript
// src/components/StopActionsSheet.test.js
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import StopActionsSheet from "./StopActionsSheet";

const baseProps = { stop: { name: "Sensoji" }, days: [{ day: 1 }], onClose: () => {}, onDelete: () => {} };

test("no cost yet: shows 'הוסף עלות' and calls onSetCost on click", () => {
  const onSetCost = jest.fn();
  render(<StopActionsSheet {...baseProps} onSetCost={onSetCost} stopCostLabel={null} />);

  const row = screen.getByText("הוסף עלות");
  fireEvent.click(row);
  expect(onSetCost).toHaveBeenCalled();
});

test("existing cost: shows the amount in the row label", () => {
  render(<StopActionsSheet {...baseProps} onSetCost={() => {}} stopCostLabel="₪120.00" />);
  expect(screen.getByText("עריכת עלות · ₪120.00")).toBeInTheDocument();
});

test("onSetCost omitted: no cost row rendered at all", () => {
  render(<StopActionsSheet {...baseProps} />);
  expect(screen.queryByText("הוסף עלות")).not.toBeInTheDocument();
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `CI=true npx react-scripts test --watchAll=false --testPathPattern="StopActionsSheet"`
Expected: FAIL — no matching text found.

- [ ] **Step 3: Implement**

In `src/components/StopActionsSheet.jsx`, add the two props to the component signature and one new `Row` in the "תוכן ולינה" section, right after the lodging toggle row (`הגדר/בטל כנקודת לינה`):

```javascript
const StopActionsSheet = ({ stop, days = [], otherTrips = [], onMove, onCopy, onCrossCopy, onSetNote, onSetLodging, onSetColor, onSetMultiDayHotel, onMoveNextDay, onSplitDay, onCopyName, onDuplicate, onAttach, attachBusy, attachmentCount = 0, onRemoveAttachment, onFindNearby, onSetCost, stopCostLabel, onDelete, onClose }) => {
```

```javascript
            <Row icon={isLodging ? "🏨" : "🛏"} label="הגדר/בטל כנקודת לינה" onClick={onSetLodging} />
            {onSetCost && (
              <Row icon="💰" label={stopCostLabel ? `עריכת עלות · ${stopCostLabel}` : "הוסף עלות"} onClick={onSetCost} />
            )}
            <Row icon="📝" label={stop?.note ? "עריכת הערה" : "הוספת הערה"} onClick={() => { setNoteDraft(stop?.note || ""); setMode("note"); }} />
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `CI=true npx react-scripts test --watchAll=false --testPathPattern="StopActionsSheet"`
Expected: PASS.

- [ ] **Step 5: Run the gate and commit**

Run: `npm run critical && CI=true npm test -- --watchAll=false`
Expected: 9/9 critical, all suites pass.

```bash
git add src/components/StopActionsSheet.jsx src/components/StopActionsSheet.test.js
git commit -m "feat(budget): StopActionsSheet cost row"
```

---

### Task 5: Desktop wiring (`EditorDesktop.jsx`)

**Files:**
- Modify: `src/views/EditorDesktop.jsx`

**Interfaces:**
- Consumes: `saveStopCost`, `removeStopCost`, `costForStop`, `deleteStopAt`, `moveStopToInbox` from `useEditorState` (Task 1); `budgetImpact`, `formatMoney` from `../utils/budget`; `ExpenseSheet` (new import, Task 3's stop-bound mode).
- No new exports — this is a leaf consumer.

No test file — this file has no Jest harness (confirmed: no `EditorDesktop.test.js` exists in the repo today). Step 8 is the mandatory manual-review substitute.

- [ ] **Step 1: Add imports and state**

At the top of `src/views/EditorDesktop.jsx`, add:

```javascript
import ExpenseSheet from "../components/ExpenseSheet";
import { budgetImpact, formatMoney } from "../utils/budget";
```

Destructure the new hook exports where `useEditorState`'s other values are already destructured (near line 103-106):

```javascript
    deleteStopAt, duplicateStopAt, moveStopToDay, setStopNote, addStopToDay, setDayOrder,
    saveStopCost, removeStopCost, costForStop,
```

Add new local state near `confirmDelDay` (line 185):

```javascript
  const [costFor, setCostFor] = useState(null);     // { dayNum, idx } | null — ExpenseSheet in stop-bound mode
  const [budgetConfirm, setBudgetConfirm] = useState(null); // { impact, onConfirm } | null
```

- [ ] **Step 2: A helper to gate a budget-affecting action behind a confirm**

Add this near the other action helpers (e.g. right before the `ctxMenu` JSX block, or alongside `deleteStopAt`'s usage):

```javascript
  const withBudgetGate = (action, stopId, run) => {
    const items = trip?.data?.budget?.items || [];
    const config = trip?.data?.budget?.config || {};
    const impact = stopId ? budgetImpact(action, { items, config, stopId }) : null;
    if (impact) setBudgetConfirm({ impact, onConfirm: run });
    else run();
  };
```

- [ ] **Step 3: Gate the two context-menu actions**

Replace the two direct calls in the `ctxMenu` block (lines ~1432, 1435):

```javascript
                {ctxMenu.a.coordinates && <CtxItem emoji="📥" label="העבר לבנק הנקודות" onClick={() => { const idx = ctxMenu.idx; const stopId = ctxMenu.a.instanceId; setCtxMenu(null); withBudgetGate("moveStopToInbox", stopId, () => moveStopToInbox(activeDay, idx)); }} />}
```

```javascript
                <CtxItem emoji="🗑️" label="מחיקה" danger onClick={() => { const idx = ctxMenu.idx; const stopId = ctxMenu.a.instanceId; setCtxMenu(null); withBudgetGate("deleteStop", stopId, () => deleteStopAt(activeDay, idx)); }} />
```

Also add the cost row to the context menu, right before the "מחיקה" item:

```javascript
                <CtxItem emoji="💰" label={costForStop(ctxMenu.a.instanceId)
                    ? `עריכת עלות · ${formatMoney(costForStop(ctxMenu.a.instanceId).amountMinor, costForStop(ctxMenu.a.instanceId).currency || "ILS")}`
                    : "הוסף עלות"}
                  onClick={() => { setCostFor({ dayNum: activeDay, idx: ctxMenu.idx }); setCtxMenu(null); }} />
```

Also gate the two `deleteStopAt` calls used by the row's own inline "more" buttons (lines ~1069, ~1086 — the `tp-row-more` delete buttons). Each currently reads `onClick={(e) => { e.stopPropagation(); deleteStopAt(activeDay, item.idx); }}`; wrap each the same way:

```javascript
                      <button className="tp-row-more" onClick={(e) => { e.stopPropagation(); const idx = item.idx; const stopId = item.a?.instanceId; withBudgetGate("deleteStop", stopId, () => deleteStopAt(activeDay, idx)); }}
```

(Apply this to BOTH occurrences at lines ~1069 and ~1086 — they are the same action rendered in two different row-layout branches.)

- [ ] **Step 4: Render the `budgetConfirm` dialog**

Add this block right after the existing `confirmDelDay` dialog (after its closing `)}` around line 1611), reusing the exact same visual idiom:

```javascript
      {/* ── Budget-impact confirmation (Phase B, §5 Tier 1) ─── */}
      {budgetConfirm && (
        <div dir="rtl" onClick={() => setBudgetConfirm(null)} style={{ position: "fixed", inset: 0, zIndex: 300, display: "flex", alignItems: "center", justifyContent: "center", padding: 20, background: "rgba(8,10,14,0.5)", fontFamily: T.font }}>
          <div onClick={(e) => e.stopPropagation()} className="tp-pop" style={{ width: "100%", maxWidth: 360, background: "#fff", borderRadius: 20, border: `1px solid ${T.line}`, boxShadow: "0 30px 80px rgba(0,0,0,0.4)", padding: 22, textAlign: "center" }}>
            <div style={{ fontSize: 17, fontWeight: 800, color: T.ink, marginBottom: 8 }}>{budgetConfirm.impact.title}</div>
            <div style={{ fontSize: 13.5, color: T.ink3, lineHeight: 1.6, marginBottom: 18 }}>
              {budgetConfirm.impact.body}
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => setBudgetConfirm(null)}
                style={{ flex: 1, height: 46, borderRadius: 999, border: `1px solid ${T.line}`, background: "#fff", color: T.ink2, fontSize: 14.5, fontWeight: 800, cursor: "pointer", fontFamily: "inherit" }}>
                ביטול
              </button>
              <button onClick={() => { budgetConfirm.onConfirm(); setBudgetConfirm(null); }} className="tp-press"
                style={{ flex: 1, height: 46, borderRadius: 999, border: "none", background: "#C0392B", color: "#fff", fontSize: 14.5, fontWeight: 800, cursor: "pointer", fontFamily: "inherit" }}>
                {budgetConfirm.impact.confirmLabel}
              </button>
            </div>
          </div>
        </div>
      )}
```

- [ ] **Step 5: Render the stop-bound `ExpenseSheet`**

Add near the other sheet renders (e.g. alongside where `TripFilesSheet` or similar is rendered at the bottom of the component's JSX):

```javascript
      {costFor && (() => {
        const day = days.find((d) => d.day === costFor.dayNum);
        const stop = day?.attractions?.[costFor.idx];
        if (!stop) { setCostFor(null); return null; }
        const existing = stop.instanceId ? costForStop(stop.instanceId) : null;
        return (
          <ExpenseSheet
            open
            onClose={() => setCostFor(null)}
            stop={stop}
            expense={existing}
            config={trip?.data?.budget?.config || { currency: "ILS" }}
            categories={BASE_CATEGORIES}
            dayCount={days.length}
            P={{ ...T, panel: "#fff", danger: "#C0392B", page: "#fff" }}
            onSubmit={(payload) => { saveStopCost(costFor.dayNum, costFor.idx, payload); setCostFor(null); }}
            onDelete={(id) => { removeStopCost(id); setCostFor(null); }}
            onOpenBudget={() => { setCostFor(null); navigate(`/trip/budget/${tripId}`); }}
          />
        );
      })()}
```

Add the `BASE_CATEGORIES` import (from `../utils/budget`, alongside `budgetImpact`/`formatMoney` from Step 1).

- [ ] **Step 6: Wire the ₪ chip to quick-add**

The ₪ button (lines ~893-905) currently does `onClick={() => navigate(\`/trip/budget/${tripId}\`)}`. Change it to open a NON-stop-bound `ExpenseSheet` (a general trip expense) instead, with the same link back to the full screen. Add one more piece of state near `costFor`:

```javascript
  const [quickAddOpen, setQuickAddOpen] = useState(false);
```

Change the button:

```javascript
        <button onClick={() => setQuickAddOpen(true)}
          title="הוספת הוצאה מהירה"
```

(keep the rest of that button's JSX — icon, label, styling — unchanged, only the `onClick` changes).

Add its own `ExpenseSheet` render (non-stop-bound — no `stop` prop) near the `costFor` block from Step 5:

```javascript
      {quickAddOpen && (
        <ExpenseSheet
          open
          onClose={() => setQuickAddOpen(false)}
          expense={null}
          config={trip?.data?.budget?.config || { currency: "ILS" }}
          categories={BASE_CATEGORIES}
          dayCount={days.length}
          P={{ ...T, panel: "#fff", danger: "#C0392B", page: "#fff" }}
          onSubmit={(payload) => {
            commitData((data) => addExpense(ensureBudget(data), payload));
            setQuickAddOpen(false);
          }}
          onOpenBudget={() => { setQuickAddOpen(false); navigate(`/trip/budget/${tripId}`); }}
        />
      )}
```

Add `commitData` to the destructured `useEditorState` values (it's already returned by the hook, likely just not currently pulled into this file — check the existing destructuring block from Step 1 and add it there), and add `addExpense`, `ensureBudget` to the `budget.js` import from Step 1.

- [ ] **Step 7: Confirm `deleteDay` doesn't need the same gate**

Read `deleteDay`'s implementation in `useEditorState.js`. Per spec, day deletion already goes through its own distinct confirm (`confirmDelDay`) and the existing `applyDateRange`/day-remap machinery already folds any day-tagged (not stop-tagged) expenses to "כללי" via `remapExpenseDays` — this is a DIFFERENT code path from per-stop `stopRef` detachment and was already correct before this phase. Do not add a `budgetImpact` gate to day deletion in this task; note in the commit message that this was checked and intentionally left alone.

- [ ] **Step 8: Mandatory manual review (the test-cycle substitute for this file)**

Re-read every edit from Steps 1–7 and confirm:
1. Every `budgetImpact` call site passes `ctx.stopId` as the stop's `instanceId`, not some other field — a wrong field silently makes `budgetImpact` always return `null` (no confirm ever shown), which is a dangerous silent failure mode, not a crash, so it needs an actual read, not just "it compiles."
2. `costFor`'s stop lookup re-derives `day`/`stop` fresh from `days` on every render (Step 5's IIFE does `days.find(...)` inside the render, not from stale captured state) — confirms this follows the plan's async-safety rule even though desktop's action is fully synchronous (no native file-picker gap like the mobile attach bug), because the ExpenseSheet stays open across renders while the user types, and `days` can change under it (e.g. a collaborator's edit arriving via realtime, if that exists — check whether it does; if not, still keep the fresh lookup, it's free and matches Task 2's mobile pattern for consistency).
3. `quickAddOpen`'s `ExpenseSheet` truly has no `stop` prop passed (must go through the plain `addExpense` path, not `saveStopCost`).

- [ ] **Step 9: Run the gate and commit**

Run: `npm run critical && CI=true npm test -- --watchAll=false && npm run build`
Expected: 9/9 critical, all suites pass, clean build.

```bash
git add src/views/EditorDesktop.jsx
git commit -m "feat(budget): desktop wiring — per-stop cost, budget-impact confirms, ₪ quick-add"
```

---

### Task 6: Mobile wiring (`EditorView.jsx`)

**Files:**
- Modify: `src/views/EditorView.jsx`

**Interfaces:**
- Consumes: `saveStopCost`, `removeStopCost`, `costForStop` (Task 2, already in this same file as local functions — no import needed), `deleteStop` (Task 2, Step 5), `budgetImpact`, `formatMoney`, `BASE_CATEGORIES`, `addExpense`, `ensureBudget` from `../utils/budget`; `ExpenseSheet` (new import); `StopActionsSheet`'s new `onSetCost`/`stopCostLabel` props (Task 4).

No test file for this task either — same documented gap.

- [ ] **Step 1: Add the `ExpenseSheet` import and `BASE_CATEGORIES`/`addExpense`/`ensureBudget`/`budgetImpact`**

Extend the existing budget import from Task 2, Step 1, adding `BASE_CATEGORIES`, `budgetImpact`:

```javascript
import { remapExpenseDays, ensureBudget, addExpense, updateExpense, removeExpense, expensesForStop, detachStopExpenses, formatMoney, toIlsMinor, BASE_CATEGORIES, budgetImpact } from "../utils/budget";
import ExpenseSheet from "../components/ExpenseSheet";
```

- [ ] **Step 2: Add state**

Near `attachTargetDay`/`attachTargetId` (Task 2's neighbors from the earlier file-attach fix), add:

```javascript
  const [costFor, setCostFor] = useState(null);         // { day, idx } | null — see Step 5 for why day is captured too
  const [quickAddOpen, setQuickAddOpen] = useState(false);
  const [budgetConfirm, setBudgetConfirm] = useState(null); // { impact, onConfirm } | null
```

(`costFor` captures `{ day, idx }` rather than a bare index: the sheet it opens can stay on screen across renders while the user types, and if the user switched `activeDay` in the meantime, a bare index would resolve against the WRONG day's array at that same position. This is the same async/stale-reference class of bug fixed in the file-attach picker earlier tonight — captured once, up front, rather than patched in later.)

- [ ] **Step 3: Gate the 3-dot delete with a confirm**

Find the render of `StopActionsSheet` (around line 4718) and its `onDelete` prop (Section 3's "מחיקה מהמסלול", currently wired straight to `deleteStop`). Change it to gate through `budgetImpact`, capturing `idx` into a plain local before `setActionsIdx(-1)` runs — `deleteStop` takes `idx` as a parameter (per Task 2, Step 5, which already defines it that way specifically so this confirm flow is safe: the actual delete can now fire on a LATER tick, after the sheet that opened the dialog — and its `actionsIdx` — has already closed/reset):

```javascript
          onDelete={() => {
            const idx = actionsIdx;
            const stop = activeDayData.attractions[idx];
            const items = trip?.data?.budget?.items || [];
            const config = trip?.data?.budget?.config || {};
            const impact = stop?.instanceId ? budgetImpact("deleteStop", { items, config, stopId: stop.instanceId }) : null;
            if (impact) { setActionsIdx(-1); setBudgetConfirm({ impact, onConfirm: () => deleteStop(idx) }); }
            else deleteStop(idx);
          }}
```

`onConfirm: () => deleteStop(idx)` closes over the captured `idx` value (a plain number, immune to `actionsIdx` changing later) rather than re-reading `actionsIdx` at confirm-time — this is the reason Task 2 gave `deleteStop` an explicit parameter instead of reading `actionsIdx` from closure.

- [ ] **Step 4: Wire the cost row into `StopActionsSheet`**

In the same `StopActionsSheet` render block, add:

```javascript
          onSetCost={() => { setCostFor({ day: activeDay, idx: actionsIdx }); setActionsIdx(-1); }}
          stopCostLabel={(() => {
            const stop = activeDayData?.attractions?.[actionsIdx];
            const c = stop?.instanceId ? costForStop(stop.instanceId) : null;
            return c ? formatMoney(c.amountMinor, c.currency || "ILS") : null;
          })()}
```

- [ ] **Step 5: Render the stop-bound `ExpenseSheet`**

Add near the other sheet renders in this file (e.g. alongside where `attachViewer`/`nearbyOrigin` are rendered). The `costFor.day === activeDay` guard is why `costFor` captures the day, not just an index (see Step 2): without it, switching the active day while this sheet is open would resolve `costFor.idx` against the NEW day's attractions array instead of closing or staying put on the original stop.

```javascript
      {costFor && costFor.day === activeDay && activeDayData?.attractions?.[costFor.idx] && (() => {
        const stop = activeDayData.attractions[costFor.idx];
        const existing = stop.instanceId ? costForStop(stop.instanceId) : null;
        return (
          <ExpenseSheet
            open
            onClose={() => setCostFor(null)}
            stop={stop}
            expense={existing}
            config={trip?.data?.budget?.config || { currency: "ILS" }}
            categories={BASE_CATEGORIES}
            dayCount={days.length}
            P={{ ...T, panel: "#fff", danger: "#C0392B", page: "#fff" }}
            onSubmit={(payload) => { saveStopCost(costFor.idx, payload); setCostFor(null); }}
            onDelete={(id) => { removeStopCost(id); setCostFor(null); }}
            onOpenBudget={() => { setCostFor(null); navigate(`/trip/budget/${trip.id}`); }}
          />
        );
      })()}
```

- [ ] **Step 6: Render the `budgetConfirm` dialog**

Add near the existing `confirmExit` dialog (same file, reuse its exact visual idiom):

```javascript
      {budgetConfirm && (
        <div style={{ position: "fixed", inset: 0, zIndex: 320, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
          <div onClick={() => setBudgetConfirm(null)} className="tp-fade" style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.45)" }} />
          <div className="tp-pop" dir="rtl" style={{ position: "relative", width: "100%", maxWidth: 340, background: "#fff", borderRadius: 22, padding: "24px 22px", boxShadow: "0 30px 80px rgba(0,0,0,0.4)", textAlign: "center", fontFamily: T.font }}>
            <div style={{ fontSize: 18, fontWeight: 800, color: T.ink, marginBottom: 6 }}>{budgetConfirm.impact.title}</div>
            <div style={{ fontSize: 13.5, color: T.ink3, lineHeight: 1.5, marginBottom: 20 }}>
              {budgetConfirm.impact.body}
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => setBudgetConfirm(null)}
                style={{ flex: 1, height: 48, borderRadius: 999, border: `1px solid ${T.line}`, background: T.surface, color: T.ink, fontSize: 14.5, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
                ביטול
              </button>
              <button onClick={() => { budgetConfirm.onConfirm(); setBudgetConfirm(null); }}
                style={{ flex: 1, height: 48, borderRadius: 999, border: "none", background: "#C0392B", color: "#fff", fontSize: 14.5, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
                {budgetConfirm.impact.confirmLabel}
              </button>
            </div>
          </div>
        </div>
      )}
```

Use `zIndex: 320` (above `StopActionsSheet`'s `zIndex: 300` and `ExpenseSheet`'s `zIndex: 310`, so a confirm always renders on top of whatever triggered it) and add `!!budgetConfirm` to the `overlayOpen` boolean (line ~1408) so map FABs stay suppressed while it's showing.

- [ ] **Step 7: Wire the ₪ chip to quick-add**

Find this file's ₪ / "תקציב" entry-point button (mirrors the desktop one described in the architect design; grep this file for `trip/budget/` if the exact line has shifted). Change its `onClick` from `navigate(...)` to `setQuickAddOpen(true)`, and add the corresponding sheet render near `costFor`'s (Step 5):

```javascript
      {quickAddOpen && (
        <ExpenseSheet
          open
          onClose={() => setQuickAddOpen(false)}
          expense={null}
          config={trip?.data?.budget?.config || { currency: "ILS" }}
          categories={BASE_CATEGORIES}
          dayCount={days.length}
          P={{ ...T, panel: "#fff", danger: "#C0392B", page: "#fff" }}
          onSubmit={(payload) => {
            persistTripData((data) => addExpense(ensureBudget(data), payload));
            setQuickAddOpen(false);
          }}
          onOpenBudget={() => { setQuickAddOpen(false); navigate(`/trip/budget/${trip.id}`); }}
        />
      )}
```

- [ ] **Step 8: Mandatory manual review**

Same three checks as Task 5 Step 8, applied to this file's equivalents. Additionally: confirm `costFor` is reset to `null` (not left dangling) in every path that closes the sheet — `onClose`, `onSubmit`, `onDelete` all already do this per Step 5's code. Confirm the `costFor.day === activeDay` guard from Step 5 is genuinely doing work: trace what happens if the user switches `activeDay` (via the day rail) while this sheet is open — the guard should make the sheet disappear rather than resolve `costFor.idx` against the wrong day's attractions array. If that's not what you observe reading the code, the guard is wrong, not optional to skip.

- [ ] **Step 9: Run the gate and commit**

Run: `npm run critical && CI=true npm test -- --watchAll=false && npm run build`
Expected: 9/9 critical, all suites pass, clean build.

```bash
git add src/views/EditorView.jsx
git commit -m "feat(budget): mobile wiring — per-stop cost, budget-impact confirms, ₪ quick-add"
```

---

### Task 7: Rate-change confirm (`BudgetSetupSheet.jsx` + `BudgetView.jsx`)

**Files:**
- Modify: `src/components/BudgetSetupSheet.jsx`
- Modify: `src/components/BudgetSetupSheet.test.js`
- Modify: `src/views/BudgetView.jsx`

**Interfaces:**
- Consumes: `budgetImpact` from `../utils/budget`.
- Produces: `BudgetSetupSheet` gains one new optional prop, `items` (the full budget items array — needed to compute `budgetImpact("changeRate", ...)` at submit time). `onSave` is unchanged; the confirm happens BEFORE `onSave` is called, inside this component.

- [ ] **Step 1: Write the failing test**

Add to `src/components/BudgetSetupSheet.test.js`:

```javascript
test("changing the rate with paid non-ILS items shows a confirm before saving", () => {
  const onSave = jest.fn();
  const config = { currency: "THB", rate: 10, categories: [] };
  const items = [{ id: "e1", amountMinor: 10000, currency: "THB", paid: true }];
  render(<BudgetSetupSheet open onClose={() => {}} onSave={onSave} config={config} items={items} P={P} />);

  fireEvent.change(screen.getByLabelText(/שער המרה/), { target: { value: "12" } });
  fireEvent.click(screen.getByText("שמירה"));

  expect(onSave).not.toHaveBeenCalled();
  expect(screen.getByText(/יעריך מחדש/)).toBeInTheDocument();

  fireEvent.click(screen.getByText("שנה בכל זאת"));
  expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ rate: 12 }));
});

test("changing the rate with no paid non-ILS items saves immediately, no confirm", () => {
  const onSave = jest.fn();
  const config = { currency: "THB", rate: 10, categories: [] };
  render(<BudgetSetupSheet open onClose={() => {}} onSave={onSave} config={config} items={[]} P={P} />);

  fireEvent.change(screen.getByLabelText(/שער המרה/), { target: { value: "12" } });
  fireEvent.click(screen.getByText("שמירה"));

  expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ rate: 12 }));
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `CI=true npx react-scripts test --watchAll=false --testPathPattern="BudgetSetupSheet"`
Expected: FAIL — `onSave` is called immediately in both cases today (no gate exists yet).

- [ ] **Step 3: Implement**

Add the prop and confirm state:

```javascript
export default function BudgetSetupSheet({
  open, onClose, onSave, config, P, foreignItemsPresent = false, items = [],
}) {
  ...
  const [rateConfirm, setRateConfirm] = useState(null); // { impact, payload } | null
```

Add the import:

```javascript
import { BASE_CATEGORIES, CURRENCIES, formatMoney, newCategoryKey, parseAmount, budgetImpact } from "../utils/budget";
```

Change `submit` to gate on a rate change before calling `onSave`:

```javascript
  const submit = () => {
    if (total.trim() && totalMinor === null) { setErr("סכום לא תקין — הזינו מספר חיובי"); return; }
    for (const c of allCategories) {
      const raw = caps[c.key];
      if (raw && raw.trim() && parseAmount(raw, "ILS") === null) {
        setErr(`סכום לא תקין בקטגוריה ${c.label}`); return;
      }
    }
    const rateNum = currency === "ILS" ? 1 : Number(rate);
    if (currency !== "ILS" && (!Number.isFinite(rateNum) || rateNum <= 0)) {
      setErr("שער המרה לא תקין"); return;
    }
    const priorKeys = new Set((config?.categories || []).map((c) => c.key));
    const payload = {
      totalIlsMinor: totalMinor || 0,
      currency,
      rate: rateNum,
      rateUpdatedAt: new Date().toISOString(),
      categories: allCategories
        .map((c) => ({
          key: c.key,
          label: c.label,
          capIlsMinor: parseAmount(caps[c.key], "ILS"),
          ...(c.key.startsWith("c_") ? { custom: true } : {}),
        }))
        .filter((c) => c.capIlsMinor != null || priorKeys.has(c.key)),
    };
    const rateChanged = config?.rate != null && rateNum !== config.rate;
    const impact = rateChanged ? budgetImpact("changeRate", { items, config, newRate: rateNum }) : null;
    if (impact) setRateConfirm({ impact, payload });
    else onSave(payload);
  };
```

Add the confirm block, right before the closing `</div>` of the outer scrim `<div>` (as a sibling of the main panel, so it overlays on top of it):

```javascript
        {rateConfirm && (
          <div dir="rtl" onClick={() => setRateConfirm(null)} style={{ position: "fixed", inset: 0, zIndex: 340, display: "flex", alignItems: "center", justifyContent: "center", padding: 20, background: "rgba(0,0,0,0.5)" }}>
            <div onClick={(e) => e.stopPropagation()} style={{ width: "100%", maxWidth: 360, background: P.panel, borderRadius: 20, padding: 22, textAlign: "center" }}>
              <div style={{ font: `800 17px ${FONT}`, color: P.ink, marginBottom: 8 }}>{rateConfirm.impact.title}</div>
              <div style={{ font: `400 13.5px ${FONT}`, color: P.ink3, lineHeight: 1.6, marginBottom: 18 }}>{rateConfirm.impact.body}</div>
              <div style={{ display: "flex", gap: 10 }}>
                <button type="button" onClick={() => setRateConfirm(null)}
                  style={{ flex: 1, minHeight: 46, borderRadius: 999, border: `1px solid ${P.line}`, background: "transparent", color: P.ink2, font: `700 14.5px ${FONT}`, cursor: "pointer" }}>
                  ביטול
                </button>
                <button type="button" onClick={() => { onSave(rateConfirm.payload); setRateConfirm(null); }}
                  style={{ flex: 1, minHeight: 46, borderRadius: 999, border: "none", background: P.danger, color: "#fff", font: `800 14.5px ${FONT}`, cursor: "pointer" }}>
                  {rateConfirm.impact.confirmLabel}
                </button>
              </div>
            </div>
          </div>
        )}
```

`budgetImpact`'s `"changeRate"` case (already implemented) uses `confirmLabel` — check its exact current string in `src/utils/budget.js` and use it verbatim in the test assertion from Step 1 rather than guessing; if it differs from `"שנה בכל זאת"`, adjust the test to match the real string instead of changing the pure function (the pure function's copy is already reviewed/shipped, treat it as the source of truth).

- [ ] **Step 4: Pass `items` from `BudgetView.jsx`**

In `src/views/BudgetView.jsx`, add `items` to the existing `<BudgetSetupSheet>` render:

```javascript
      <BudgetSetupSheet
        open={setupOpen}
        onClose={() => setSetupOpen(false)}
        config={config}
        items={items}
        P={P}
        foreignItemsPresent={foreignItemsPresent}
        onSave={(next) => { setConfig(next); setSetupOpen(false); }}
      />
```

(`items` is already computed in this file via `useMemo(() => budget?.items || [], [budget])` — just pass the existing variable, don't recompute.)

- [ ] **Step 5: Run the tests to verify they pass**

Run: `CI=true npx react-scripts test --watchAll=false --testPathPattern="BudgetSetupSheet|BudgetView"`
Expected: PASS.

- [ ] **Step 6: Run the gate and commit**

Run: `npm run critical && CI=true npm test -- --watchAll=false`
Expected: 9/9 critical, all suites pass.

```bash
git add src/components/BudgetSetupSheet.jsx src/components/BudgetSetupSheet.test.js src/views/BudgetView.jsx
git commit -m "feat(budget): rate-change Tier-1 confirm when paid non-ILS items exist"
```

---

### Task 8: QA test plan + full regression pass

**Files:**
- Modify: `docs/QA-TEST-PLAN.md`

**Interfaces:** none — documentation only.

- [ ] **Step 1: Append new test cases**

Add a new subsection under the existing "## 10. Trip budget — Phase A" heading (or a new "## 10.6 Phase B — per-stop cost" if that reads cleaner given section 10.5 already exists for the pre-work bugfix), continuing the `T-BUDGET-` numbering from wherever it currently ends (check the file — it was last extended to `T-BUDGET-26` by the Phase B pre-work pass):

```markdown
### 10.6 Phase B — per-stop cost (2026-09-05)

| ID | Pri | Case |
|---|---|---|
| T-BUDGET-27 | P0 | **Add a cost from a stop (mobile).** Open a stop's ⋯ menu → "הוסף עלות" → fill label/amount → save. The editor's ₪ chip figure updates; the stop's ⋯ menu now shows "עריכת עלות · ₪X". Reload → persists. |
| T-BUDGET-28 | P0 | **Add a cost from a stop (desktop).** Same as above via the right-click context menu. |
| T-BUDGET-29 | P0 | **Delete a priced stop via 3-dot / context menu (no undo path) — Tier-1 confirm.** Confirm dialog names the exact amount. Cancel → stop and cost both survive untouched. Confirm → stop removed, expense survives under "כללי" in the budget screen. |
| T-BUDGET-30 | P0 | **Swipe-delete a priced stop (mobile, has undo).** No blocking dialog — a toast reads the amount and "עברה ל'כללי'". Tap "בטל" within 5s → stop AND its cost link are both restored (verify in the budget screen — the expense is back under the stop, not "כללי"). |
| T-BUDGET-31 | P1 | **Move a priced stop to the bank (mobile swipe-to-bank + desktop context-menu).** Mobile: informative undo toast, undo restores the link. Desktop: no undo — Tier-1 confirm first. |
| T-BUDGET-32 | P1 | **Copy/duplicate a priced stop never duplicates the cost.** Use "העתקה ליום אחר" / "שכפל מיקום" on a stop with a cost — the new copy shows "הוסף עלות" (no existing cost), the original keeps its own. |
| T-BUDGET-33 | P1 | **₪ chip quick-add (mobile + desktop).** Tap the ₪ chip → a general (non-stop) expense sheet opens in place, no navigation away from the map. "למסך התקציב המלא" link inside it navigates correctly. Submitting adds a "כללי" (no day) expense, visible on the budget screen. |
| T-BUDGET-34 | P1 | **Rate-change confirm.** With at least one paid non-ILS expense, change the exchange rate in "הגדרת תקציב" → confirm dialog names the before/after "בפועל" totals. Cancel → rate unchanged. Confirm → rate updates, paid totals re-value. Changing the rate with NO paid non-ILS items saves with no dialog. |
| T-BUDGET-35 | P2 | **Legacy stop with no instanceId (AI/wizard/seed trip).** Add a cost to such a stop — works identically, the instanceId is stamped invisibly on first cost-save. |
```

- [ ] **Step 2: Update the sign-off checklist**

Find the "## 12. Sign-off" (or current final section number after Task 8's insertion doesn't renumber it — Task 8 only ADDS a subsection under an existing numbered section, so no renumbering is needed here, unlike the Phase B pre-work pass which added a whole new top-level section) and add one line for this phase's manual pass, matching the existing row format.

- [ ] **Step 3: Commit**

```bash
git add docs/QA-TEST-PLAN.md
git commit -m "docs: QA test plan for trip-budget Phase B (per-stop cost)"
```

---

## Final full-branch verification (after all 8 tasks)

- [ ] Run `npm run preflight` (chains `npm run critical` + a CI build) — must be green.
- [ ] Run `CI=true npm test -- --watchAll=false` — must show the cumulative new-suite count (Tasks 1, 3, 4, 7 each add coverage; Tasks 2, 5, 6 add none, by design).
- [ ] A `qa`-agent or manual pass through every `T-BUDGET-27..35` case in `docs/QA-TEST-PLAN.md`, since three of the eight tasks touch files with zero automated coverage (`EditorView.jsx`, `EditorDesktop.jsx`).
- [ ] Confirm no auth/session/ownership/RLS file was touched anywhere in this plan (`git diff --name-only` against the branch point, cross-checked against `src/services/authService.js`, `src/context/AuthContext.jsx`, any `.sql` file — none should appear).
