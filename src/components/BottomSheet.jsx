/* eslint-disable */
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
   Two snap points only:
     • peek  — shows just the handle + filter strip (~110px)
     • full  — almost full-screen, leaving a thin strip of map

   No mid-drag resting state. A drag either snaps to peek (back to
   bottom) or to full (top). This keeps the interaction binary and
   predictable — just like Google Maps' modern bottom sheet.

   Renders as `position: fixed` above the map on screens < lg.
   On lg+ the sheet is hidden (CSS `lg:hidden`); the desktop layout
   keeps the existing split-pane and embeds the same content
   directly in the right pane.

   Interaction model:
     - Drag anywhere on the handle area (data-sheet-handle)
     - During drag: transform updates immediately (no transition)
     - On release: position past the midpoint OR fling-velocity
       toward a side decides which snap to land on
     - imperative API: ref.current.snapTo('peek'|'full')

   Zero deps — raw pointer events + CSS transform.

   NOTE: 'half' is accepted for backwards compatibility (treated as
   'full') so older call sites don't break, but new code should
   use 'full' / 'peek' only.
   ══════════════════════════════════════════════════════════════ */

const SHEET_HEIGHT_VH = 92; // sheet itself is 92vh tall on screen

const peekPx = 110;          // exposed when in 'peek'
const FLING_THRESHOLD = 0.4; // px / ms — fling triggers snap toward direction

const computeOffset = (snap, vh) => {
  // Returns the top-edge translateY (px from top of viewport).
  // Larger value = sheet pushed down (more hidden).
  if (snap === "full") {
    return vh - vh * (SHEET_HEIGHT_VH / 100);  // sheet top near top
  }
  if (snap === "half") {
    return vh * 0.5;                            // sheet top at 50% — Google-Maps style
  }
  return vh - peekPx;                           // peek: sheet top near bottom
};

const ALL_SNAPS = ["full", "half", "peek"]; // ordered top → bottom

const BottomSheet = forwardRef(({ children, header, defaultSnap = "half", onSnapChange }, ref) => {
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

    /* Three-state snap decision (Google-Maps style):
         peek (110px)  →  half (50%)  →  full (92vh)
       Flings step one stop in the fling direction; gentle releases
       snap to the nearest of the three. */
    const vh = lastVHRef.current;
    const fullY = computeOffset("full", vh);
    const halfY = computeOffset("half", vh);
    const peekY = computeOffset("peek", vh);

    let target;
    if (velocity > FLING_THRESHOLD) {
      /* flung DOWN → step toward peek */
      target = snap === "full" ? "half" : "peek";
    } else if (velocity < -FLING_THRESHOLD) {
      /* flung UP → step toward full */
      target = snap === "peek" ? "half" : "full";
    } else {
      /* nearest of the three */
      const dFull = Math.abs(translateY - fullY);
      const dHalf = Math.abs(translateY - halfY);
      const dPeek = Math.abs(translateY - peekY);
      const min = Math.min(dFull, dHalf, dPeek);
      target = min === dFull ? "full" : min === dHalf ? "half" : "peek";
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
