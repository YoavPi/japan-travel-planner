# Mobile Editor — Dead-Code Cleanup Report (2026-09-06)

**Agent:** `builder` (dispatched for F7 + F24 only) · **Scope:** `src/views/EditorView.jsx` exclusively · **Source:** `docs/superpowers/specs/2026-09-06-mobile-editor-ux-critique.md`, findings F7 and F24.

**Nature of change:** pure deletion / invariant fix. Zero behavior change to anything a real user can currently reach — every removed block was re-verified as genuinely unreachable against the live file before deletion (line numbers in the critique had drifted slightly; re-verified against current code, not trusted blindly).

**Result:** 5091 → 4882 lines (**-209 lines**, net diff `+41 / -250`).

---

## F7 — seven dead-code items removed

### 1. `pendingStop` routing modal (~31 lines)
- Re-verified: `EditorSearchBar` is always rendered with `onPreview={handlePreview}` set (`EditorView.jsx`, the one live usage). In `EditorSearchBar.jsx`, both call sites (`:110` place-pick, `:125` free-text) `return` before ever calling `onAddStop` whenever `onPreview` is set. So the `onAddStop={(stop) => setPendingStop(stop)}` wiring could never fire — `pendingStop` could only ever be `null`.
- **Surviving save-to-bank path confirmed before deleting:** `previewPlace` → `<PlaceInfoCard onSaveToInbox={(stop) => saveStopToInbox(stop)} .../>` (the "שמור בבנק" affordance) is the real, live path. `saveStopToInbox` and `placeStopOnDay` are also still used by `addOverlayPoints` (the reference-maps "add to bank / add to day" flow) — those two functions were **kept**, only their now-dead `setPendingStop(null)` calls and the modal JSX/state were removed.
- Removed: the modal JSX block, the `pendingStop` state, the `onAddStop` prop wired to `setPendingStop`.

### 2. `assignCard` card (~41 lines)
- Re-verified: `grep`'d the whole `src/` tree — `setAssignCard` is called exactly twice, both with `null`. No other file references `assignCard`/`setAssignCard`.
- `assignDaysOpen` was scoped entirely inside this dead block too (never referenced elsewhere) — removed alongside it.
- `assignInboxPlace` (the handler the dead "add to day" buttons called) is still used elsewhere (a live call site at the nearby-search flow) and was **not** touched.
- Removed: the floating card JSX, `assignCard`/`setAssignCard` state, `assignDaysOpen`/`setAssignDaysOpen` state.

### 3. `liveOps && !tripActive` branch (~25 lines total across 3 sites)
- Re-verified: `liveOps={isActiveTrip}`, `tripActive={tripMode}`, and `tripMode = isActiveTrip` — so the guard is literally `isActiveTrip && !isActiveTrip`, always `false`.
- Removed: the "העבירו ליום המחרת" (rollover) button JSX in `DayStopList`; the `rolloverStop` callback; the `nextDayNum` memo; the `onRollover`/`nextDayNum` props (both the `DayStopList` prop-destructure defaults and the pass-through at the call site).
- Kept: `liveOps` prop itself (still live — drives `showCompletion = tripActive || liveOps` elsewhere) and the sibling `tripActive && !done` "העבר ליום הבא" (move-forward) button, which is a different, reachable control.

### 4. `inboxGeoFilter` (~10 lines + one dead ternary)
- Re-verified: `setInboxGeoFilter` is called exactly once in the file, with `null` (inside `searchAroundStop`, which the file's own comment described as "clearing the geo-filter" — a call that existed purely to keep the (already-dead) state "used").
- Removed: the `inboxGeoFilter` state; the `if (inboxGeoFilter) {...}` branch in the map's `savedPlaces` projection; the `inBounds` helper + its `.filter(inBounds)` call in the inbox carousel (always a no-op since the filter always returned `true`); simplified the empty-state string ternary to its only-reachable branch ("כל הנקודות כבר שובצו במסלול 🎉").
- Confirmed the *general* geo-filtering mechanism has no other live consumer — nothing else was touched.

### 5. Day-chip drag-reorder handlers (~45 lines) — most complex removal, done conservatively
- Re-verified precisely, since this was flagged as the item to stop-and-report on any doubt:
  - The chip pointer handlers (`onPointerDown/Move/Up/Cancel` → `onDayHandleDown`/`onDayPointerMove`/`endDayDrag`) only attach when `dayEditMode` is `true`.
  - `focusActive = !!trip && !inboxMode && (dayEditMode || continuousMode)`, so whenever `dayEditMode` is `true` and a trip is loaded, `focusActive` is also `true` (the only way `dayEditMode` gets set to `true` is via the day-reorder FAB, which itself requires `!inboxMode`, and no visible control can flip `inboxMode` to `true` while `dayEditMode` is `true`, since the bank FAB that does so requires `!focusActive`).
  - The full-screen focus-lock modal (`focusActive && dayEditMode`) is therefore guaranteed mounted whenever the chip handlers are attached. Its scrim is `position:absolute, inset:0` with an explicit code comment: *"strict input lockout (no onClick → taps do nothing; the opaque layer blocks the map/sheet beneath from receiving events)."* This makes the chips underneath unreachable by pointer/touch — matching the critique's reasoning exactly.
  - The reorder mechanism that actually survives and is used is the modal's own ▲/▼ row buttons, which call `reorderDays` directly — confirmed still live and left untouched.
- Removed: `onDayHandleDown`, `onDayPointerMove`, `endDayDrag` (incl. the `navigator.vibrate` haptic call, which lived only inside the dead `onDayHandleDown`); `dayDrag`/`setDayDrag`, `dayDragRef`, `dayDragActive`, `dayGrabX`, `setDayDragState`; the `beingDragged`/`dropTarget` computed values and every style branch that depended on them (border/background/color/opacity/transform/transition/zIndex on the chip).
- **Kept, deliberately:** `dayChipRefs` (still used by an unrelated `scrollIntoView` effect that scrolls the active-day chip into view) and the separate `onDayStripPointerDown`/`onDayStripPointerMove`/`endDayStripDrag`/`onDayStripClickCapture` mouse-grab-to-pan-the-strip mechanism — a different, live, unrelated feature that was never part of this finding.

### 6. Three unreachable ternaries (FAB `bottom` position)
- Re-verified: the bank FAB, the options speed-dial, and the day-reorder/continuous FABs each render only inside a block already guarded by `sheetSnap === "peek"`. Inside each, `bottom: sheetSnap === "peek" ? A : B` re-tested the same always-true condition — `B` (`"calc(50vh + 16px)"`) was unreachable in all three.
- Simplified each to `bottom: "calc(env(safe-area-inset-bottom, 0px) + 128px)"`.

### 7. `continuousMode` else-branch of the focus modal (~25 lines)
- Re-verified: the modal's outer guard is `focusActive && dayEditMode` — not `focusActive` alone — so every `dayEditMode ? X : Y` ternary *inside* the modal has `dayEditMode` pinned to `true` by the guard; the `Y` branches (header icon/title/subtitle, the continuous-route flattened stop list, the close handler falling back to `clearFocusModes`, the footer's single "סיום" button) could never render.
- Removed the else-branches; the modal is now the day-reorder UI unconditionally. `clearFocusModes` itself was **not** removed — it's still live via the Home button and the search-focus escape gate.
- The separate, still-live "מסלול רציף" (continuous mode) map-first overview UI — explicitly noted in the file's own comment as *not* using this blocking modal since Sprint 61 #5 — was untouched.

---

## F24 — `overlayOpen` invariant fix (additive, defensive)

Re-verified each of the six state variable names still exists under the same name in the current file (no renames since the critique): `filesSheetOpen`, `quickAddOpen`, `costFor`, `attachViewer`, `notePrompt`, `addChoice` — all found via their `useState` declarations.

```js
const overlayOpen = actionsIdx >= 0 || summaryOpen || insertAt >= 0 || !!ctxMenu || datesModalOpen || noteEditIdx >= 0 || editTransitIdx >= 0 || onboardOpen || confirmExit || !!nearbyOrigin || !!budgetConfirm
  || filesSheetOpen || quickAddOpen || !!costFor || !!attachViewer || !!notePrompt || !!addChoice;
```

All six added, each as a truthiness check consistent with the existing style. This is additive/defensive per the task — nothing visibly changes today (per the critique, these sheets already sit above the FAB z-index or behind another guard), but the hand-maintained invariant is now complete for any future sheet added at a lower z-index.

---

## What was NOT touched (and why)

- **F1–F6, F8–F23, F25** — explicitly out of scope, reserved for `product-designer` / `design-systems` / `copywriter` per the critique's handoff table.
- Every critique claim in F7 and F24 held up against the current code — **nothing was found to contradict the critique**, so nothing was left un-deleted out of doubt.
- `liveOps` prop, `reorderDays`/`abortReorder`/`commitReorder`, `saveStopToInbox`/`placeStopOnDay`, `assignInboxPlace`, `dayChipRefs`, `clearFocusModes`, and the day-strip mouse-grab-to-pan mechanism were all confirmed live and deliberately preserved.

---

## Verification

- `npm run critical` — **10/10 checks passed** (auth/session/ownership invariants untouched — this change never went near `AuthContext.jsx`/`authService.js`/RLS).
- `CI=true npm test -- --watchAll=false` — **28/28 test suites, 284/284 tests passed.** (Pre-existing `act(...)` console warnings in `useEditorState.js` tests are unrelated noise, not caused by this change.)
- `CI=true npx react-scripts build` and `CI=false npm run build` — both **compiled successfully, zero eslint warnings** (no new unused-variable/unused-import warnings from the deletions), gzip main bundle **-1.67 kB**.
- No test file exists (or was needed) specifically for `EditorView.jsx`'s dead-code paths — this is deletion of unreachable code, not new behavior, so per the project's own "write the test in the same commit" rule there is no new behavior to cover. The full Jest suite (284 tests) and `npm run critical` are the regression net for this change, and both stayed green.

## Manual verification still owed (unchanged from before this change — not introduced by it)

- Real-device check that the day-reorder modal (▲/▼ rows) is the only reorder path a user needs — this was already true before this change; the cleanup just removed the unreachable alternate path, it doesn't change the reachable one.
- Everything else in the critique's own "Unverified — needs a real device" section (§4) is unaffected by this change and remains the `qa` agent's backlog.

## Handoff

- `product-designer`: F1–F4, F10–F12, F19, F20, F25 (IA/disclosure-tier work) — this cleanup was explicitly sequenced to land first so nobody redesigns dead UI.
- `design-systems`: F5, F6, F13–F16, F21–F23 (palette, dark mode, icons, touch targets, z-index scale).
- `builder` (follow-up) + `copywriter`: F8, F9, F17, F18 (missing feedback, destructive-action safety, copy defects).
