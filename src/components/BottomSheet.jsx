import React, {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";

/* ══════════════════════════════════════════════════════════════
   BOTTOM SHEET — Mobile-only Google-Maps-style draggable panel
   ──────────────────────────────────────────────────────────────
   Three snap points:
     • peek  — shows just the handle + filter strip (~110px)
     • half  — half-viewport (50vh)
     • full  — almost full-screen, leaving a strip of map (~92vh)

   Renders as `position: fixed` above the map on screens < lg.
   On lg+ the sheet is hidden (CSS `lg:hidden`); the desktop layout
   keeps the existing split-pane and embeds the same content
   directly in the right pane.

   Interaction model:
     - Drag anywhere on the handle area (data-sheet-handle)
     - During drag: transform updates immediately (no transition)
     - On release: velocity determines whether to snap to nearest
       point or fling to the next point in the drag direction
     - imperative API: ref.current.snapTo('peek'|'half'|'full')

   Zero deps — raw pointer events + CSS transform.
   ══════════════════════════════════════════════════════════════ */

const SHEET_HEIGHT_VH = 92; // sheet itself is 92vh tall on screen

const peekPx = 110;          // exposed when in 'peek'
const FLING_THRESHOLD = 0.6; // px / ms — fling triggers next snap

const computeOffset = (snap, vh) => {
  // Returns the top-edge translateY (px from top of viewport) for a
  // sheet that is `SHEET_HEIGHT_VH%` tall pinned at top:0 conceptually.
  // Larger value = sheet pushed down (more hidden).
  switch (snap) {
    case "full":
      return vh - vh * (SHEET_HEIGHT_VH / 100);  // sheet top near top
    case "half":
      return vh * 0.5;                            // sheet top at 50vh
    case "peek":
    default:
      return vh - peekPx;                         // sheet top near bottom
  }
};

const ALL_SNAPS = ["full", "half", "peek"]; // ordered top → bottom

const BottomSheet = forwardRef(({ children, header, defaultSnap = "peek", onSnapChange }, ref) => {
  const [snap, setSnapState] = useState(defaultSnap);
  const [translateY, setTranslateY] = useState(null);
  const [dragging, setDragging] = useState(false);
  const dragRef = useRef({ active: false, startY: 0, startTranslate: 0, history: [] });
  const sheetEl = useRef(null);
  const lastVHRef = useRef(typeof window !== "undefined" ? window.innerHeight : 800);

  /* ── Snap-state setter that also notifies parent ── */
  const setSnap = useCallback((next) => {
    setSnapState((prev) => {
      if (prev !== next && onSnapChange) onSnapChange(next);
      return next;
    });
  }, [onSnapChange]);

  /* ── Recompute translateY whenever snap or viewport changes ── */
  useEffect(() => {
    const vh = window.innerHeight;
    lastVHRef.current = vh;
    setTranslateY(computeOffset(snap, vh));
    const onResize = () => {
      const newVH = window.innerHeight;
      lastVHRef.current = newVH;
      setTranslateY(computeOffset(snap, newVH));
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [snap]);

  /* ── Imperative API for parent: snapTo / getSnap ── */
  useImperativeHandle(ref, () => ({
    snapTo: (name) => setSnap(name),
    getSnap: () => snap,
  }), [snap, setSnap]);

  /* ── Pointer events ──────────────────────────────────────────
     Drag only starts on the handle area. Every other tap is left
     alone so buttons inside the sheet keep working. ── */
  const onPointerDown = (e) => {
    const fromHandle = e.target.closest("[data-sheet-handle]");
    if (!fromHandle) return;
    e.preventDefault();
    dragRef.current = {
      active: true,
      startY: e.clientY,
      startTranslate: translateY,
      history: [{ y: e.clientY, t: Date.now() }],
    };
    setDragging(true);
    try { e.target.setPointerCapture && e.target.setPointerCapture(e.pointerId); } catch {}
  };

  const onPointerMove = (e) => {
    if (!dragRef.current.active) return;
    const dy = e.clientY - dragRef.current.startY;
    const proposed = dragRef.current.startTranslate + dy;
    const vh = lastVHRef.current;
    // Clamp between 'full' (top) and 'peek' (bottom) bounds.
    const clamped = Math.max(
      computeOffset("full", vh),
      Math.min(computeOffset("peek", vh), proposed)
    );
    setTranslateY(clamped);
    dragRef.current.history.push({ y: e.clientY, t: Date.now() });
    // Trim to last 100ms for velocity calc
    const cutoff = Date.now() - 100;
    dragRef.current.history = dragRef.current.history.filter((p) => p.t >= cutoff);
  };

  const onPointerUp = () => {
    if (!dragRef.current.active) return;
    dragRef.current.active = false;
    setDragging(false);

    const hist = dragRef.current.history;
    let velocity = 0;
    if (hist.length >= 2) {
      const a = hist[0];
      const b = hist[hist.length - 1];
      const dt = Math.max(1, b.t - a.t);
      velocity = (b.y - a.y) / dt;
    }

    const vh = lastVHRef.current;
    const currentIdx = ALL_SNAPS.indexOf(snap);
    let target = snap;

    if (velocity > FLING_THRESHOLD) {
      // Flinging downward → toward 'peek' (later in array)
      target = ALL_SNAPS[Math.min(ALL_SNAPS.length - 1, currentIdx + 1)] || "peek";
    } else if (velocity < -FLING_THRESHOLD) {
      // Flinging upward → toward 'full' (earlier in array)
      target = ALL_SNAPS[Math.max(0, currentIdx - 1)] || "full";
    } else {
      // Slow / stationary release → snap to nearest by current offset
      let bestIdx = currentIdx;
      let bestDist = Infinity;
      ALL_SNAPS.forEach((s, i) => {
        const d = Math.abs(translateY - computeOffset(s, vh));
        if (d < bestDist) { bestDist = d; bestIdx = i; }
      });
      target = ALL_SNAPS[bestIdx];
    }
    setSnap(target);
  };

  /* ── Render: hidden on lg+ via Tailwind. Pointer events only
        attach to the sheet container itself; map remains
        interactive everywhere outside the sheet. ── */
  return (
    <div
      ref={sheetEl}
      className="lg:hidden fixed inset-x-0 top-0 z-30 bg-cream-50 rounded-t-2xl shadow-2xl border-t border-cream-300 flex flex-col"
      style={{
        height: `${SHEET_HEIGHT_VH}vh`,
        transform: `translateY(${translateY ?? computeOffset("peek", lastVHRef.current)}px)`,
        transition: dragging ? "none" : "transform 320ms cubic-bezier(0.22, 1, 0.36, 1)",
        willChange: "transform",
      }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
    >
      {/* Drag handle area — generous 44px hit zone (thumb-friendly).
          touch-action: none ONLY here so vertical dragging is captured
          but the rest of the sheet (filters, scroll content) keeps
          native pan-y behaviour. */}
      <div
        data-sheet-handle
        className="pt-3 pb-3 flex justify-center cursor-grab active:cursor-grabbing flex-shrink-0"
        style={{ touchAction: "none", minHeight: "32px" }}
      >
        <div className="w-12 h-1.5 rounded-full bg-cream-300" />
      </div>

      {/* Sticky header slot (filters live here so they're always visible) */}
      {header && <div className="flex-shrink-0">{header}</div>}

      {/* Scrollable content — native touch scrolling allowed (pan-y) */}
      <div
        className="flex-1 overflow-y-auto overscroll-contain scrollbar-thin"
        style={{ touchAction: "pan-y" }}
      >
        {children}
      </div>
    </div>
  );
});

BottomSheet.displayName = "BottomSheet";
export default BottomSheet;
