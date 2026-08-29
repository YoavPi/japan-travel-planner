import React, { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from "react";

/* ══════════════════════════════════════════════════════════════
   EditorBottomSheet — mobile-first 3-snap information panel.

   Snap hierarchy (spec §3):
     • peek  (≈12% height) — day summary bar only
     • half  (50%)         — DEFAULT when navigating to a day
     • full  (100%)        — manual drag-to-top, or filters active

   Gesture: custom pointer events with transform: translateY().
   The whole HEADER (not just the small handle) is a drag target,
   so a drag started anywhere on the header bar moves the sheet.
   Flings step one snap in the fling direction; gentle releases
   snap to the nearest of the three.

   Imperative API (via ref): snapTo(name), getSnap().
   ══════════════════════════════════════════════════════════════ */

const SNAP_FRACTION = { peek: 0.12, half: 0.5, full: 1.0 };
const FLING = 0.45; // px/ms

/* Sprint 38 #5 — the collapsed ("peek") state is now a fixed ~80px sliver
   showing only the active-day header, not a percentage. */
const COLLAPSED_PX = 108;

/* "full" stops right below the floating search omnibox (top:64, 48px tall
   → bottom ≈ 112) so an expanded sheet covers the ENTIRE map while leaving
   the search bar + header pill reachable. Sprint 21 #1 — maximize. */
const FULL_TOP_INSET = 112;

const offsetFor = (snap, vh) =>
  snap === "full" ? FULL_TOP_INSET
    : snap === "peek" ? vh - COLLAPSED_PX
      : vh - vh * SNAP_FRACTION[snap]; // half (initial orientation only)

const EditorBottomSheet = forwardRef(({ header, children, defaultSnap = "half", onSnapChange, onDraggingChange }, ref) => {
  const [snap, setSnapState] = useState(defaultSnap);
  const [translateY, setTranslateY] = useState(null);
  const [dragging, setDragging] = useState(false);
  const drag = useRef({ active: false, startY: 0, startT: 0, hist: [] });
  const vhRef = useRef(typeof window !== "undefined" ? window.innerHeight : 800);

  /* NB: notify the parent of snap changes from an EFFECT (below), never
     from inside the setState updater — calling a parent setter while
     React is computing this component's next state is a "setState during
     render" violation and logs a console error. */
  const setSnap = useCallback((next) => {
    if (SNAP_FRACTION[next]) setSnapState(next);
  }, []);

  /* Report the active snap to the parent after each committed change so
     the editor can collapse/expand the omnibox + schedule in lock-step. */
  useEffect(() => {
    if (onSnapChange) onSnapChange(snap);
  }, [snap, onSnapChange]);

  /* Report drag start/end so the editor can hide the floating map FABs WHILE the
     sheet is moving — otherwise the peek-anchored FABs overlap the sheet
     mid-drag and look broken. */
  useEffect(() => {
    if (onDraggingChange) onDraggingChange(dragging);
  }, [dragging, onDraggingChange]);

  useEffect(() => {
    const apply = () => {
      vhRef.current = window.innerHeight;
      setTranslateY(offsetFor(snap, vhRef.current));
    };
    apply();
    window.addEventListener("resize", apply);
    return () => window.removeEventListener("resize", apply);
  }, [snap]);

  useImperativeHandle(ref, () => ({
    snapTo: (name) => SNAP_FRACTION[name] && setSnap(name),
    getSnap: () => snap,
  }), [snap, setSnap]);

  const onPointerDown = (e) => {
    /* A pointer starting on an opted-out element (e.g. the horizontally
       scrollable day strip) must NOT hijack into a sheet drag — otherwise the
       strip can't be swiped sideways. Its own touch-action handles scrolling. */
    if (e.target.closest("[data-no-sheet-drag]")) return;
    if (!e.target.closest("[data-editor-sheet-drag]")) return;
    e.preventDefault();
    drag.current = { active: true, startY: e.clientY, startT: translateY, hist: [{ y: e.clientY, t: Date.now() }] };
    setDragging(true);
    try { e.target.setPointerCapture?.(e.pointerId); } catch { /* noop */ }
  };
  const onPointerMove = (e) => {
    if (!drag.current.active) return;
    const dy = e.clientY - drag.current.startY;
    const vh = vhRef.current;
    const clamped = Math.max(offsetFor("full", vh), Math.min(offsetFor("peek", vh), drag.current.startT + dy));
    setTranslateY(clamped);
    drag.current.hist.push({ y: e.clientY, t: Date.now() });
    const cutoff = Date.now() - 100;
    drag.current.hist = drag.current.hist.filter((p) => p.t >= cutoff);
  };
  const onPointerUp = () => {
    if (!drag.current.active) return;
    drag.current.active = false;
    setDragging(false);
    const h = drag.current.hist;
    let v = 0;
    if (h.length >= 2) {
      const a = h[0], b = h[h.length - 1];
      v = (b.y - a.y) / Math.max(1, b.t - a.t);
    }
    const vh = vhRef.current;
    /* Sprint 38 #5 — STRICT two-state snapping while dragging: the sheet
       only ever rests fully Collapsed ("peek", ~80px) or fully Expanded
       ("full"). The half state exists solely as the initial-load orientation
       default and is never a drag rest-point. */
    let target;
    if (v > FLING) target = "peek";       // fling down → collapse
    else if (v < -FLING) target = "full"; // fling up → expand
    else {
      target = Math.abs(translateY - offsetFor("peek", vh)) < Math.abs(translateY - offsetFor("full", vh)) ? "peek" : "full";
    }
    setSnap(target);
  };

  return (
    <div
      style={{
        /* Sprint 49 #3 — the sheet layer sits ABOVE the map canvas and every
           map-anchored control (map-lock z29, the map FABs z45/46) so an upward
           pull cleanly slides a solid panel over them. It stays BELOW the top
           Home/Search row, the inbox drawer, toasts and modals. */
        position: "fixed", insetInlineStart: 0, insetInlineEnd: 0, top: 0,
        height: "100vh", zIndex: 50, pointerEvents: "none",
      }}
      aria-hidden={false}
    >
      <div
        style={{
          position: "absolute", left: 0, right: 0, top: 0, height: "100vh",
          /* Clean, fully-opaque surface — the map must never show through. */
          background: "#fff",
          borderTopLeftRadius: 22, borderTopRightRadius: 22,
          boxShadow: "0 -8px 40px rgba(0,0,0,0.16)",
          transform: `translateY(${translateY ?? offsetFor("half", vhRef.current)}px)`,
          transition: dragging ? "none" : "transform 320ms cubic-bezier(0.22,1,0.36,1)",
          display: "flex", flexDirection: "column",
          pointerEvents: "auto",
          direction: "rtl",
        }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        {/* Drag region — handle + whole header. touch-action:pan-x (not none) so
            a horizontal swipe on the day strip inside `header` can still scroll
            it; vertical sheet dragging is driven by the JS pointer handlers,
            which pan-x does not interfere with. */}
        <div data-editor-sheet-drag style={{ flexShrink: 0, cursor: "grab", touchAction: "pan-x" }}>
          <div style={{ display: "flex", justifyContent: "center", paddingTop: 10, paddingBottom: 6 }}>
            <div style={{ width: 44, height: 5, borderRadius: 999, background: "rgba(20,20,20,0.18)" }} />
          </div>
          {header}
        </div>
        {/* Scroll content */}
        <div style={{ flex: 1, overflowY: "auto", overscrollBehavior: "contain", WebkitOverflowScrolling: "touch", paddingBottom: FULL_TOP_INSET + 24 }}>
          {children}
        </div>
      </div>
    </div>
  );
});

EditorBottomSheet.displayName = "EditorBottomSheet";
export default EditorBottomSheet;
