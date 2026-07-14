import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";

/* ══════════════════════════════════════════════════════════════
   useSwipeToBack — native-feel edge swipe-to-back gesture engine.

   Tracks a single-finger touch that ORIGINATES within the outer
   `EDGE_ZONE` px of either screen edge and travels horizontally.
   Returns a live, signed `offset` (px the page should translate to
   follow the finger) plus the originating `edge`, so a thin wrapper
   can render real-time drag feedback. Fires `navigate(-1)` once the
   horizontal pull crosses `THRESHOLD` on release.

   Anti-accidental guards:
   • Edge gating   — must start within EDGE_ZONE of left/right edge.
   • Direction iso — if |dy| > |dx| at intent time, the gesture is
                     abandoned so vertical scroll never navigates.
   • Native clash  — once we own the drag we preventDefault() on the
                     (non-passive) touchmove, suppressing the browser's
                     own edge swipe-back so back never double-fires.
   ══════════════════════════════════════════════════════════════ */

const EDGE_ZONE = 28;   // outer band (px) a gesture must start within
const THRESHOLD = 75;   // horizontal travel (px) that commits to back
const MAX_PULL = 130;   // visual rubber-band cap (px)
const INTENT = 6;       // px of movement before we lock direction

export default function useSwipeToBack(enabled = true) {
  const navigate = useNavigate();
  const [offset, setOffset] = useState(0); // signed visual offset
  const [edge, setEdge] = useState(null);  // "left" | "right" | null
  const g = useRef({ tracking: false, valid: false, startX: 0, startY: 0, edge: null, pull: 0 });

  useEffect(() => {
    if (!enabled) return;
    if (typeof window === "undefined" || !("ontouchstart" in window)) return;

    const reset = () => {
      g.current.tracking = false;
      g.current.valid = false;
      g.current.pull = 0;
      setOffset(0);
      setEdge(null);
    };

    const onStart = (e) => {
      if (e.touches.length !== 1) return;
      const t = e.touches[0];
      const w = window.innerWidth;
      const nearLeft = t.clientX <= EDGE_ZONE;
      const nearRight = t.clientX >= w - EDGE_ZONE;
      if (!nearLeft && !nearRight) return; // edge gating
      g.current = {
        tracking: true, valid: false,
        startX: t.clientX, startY: t.clientY,
        edge: nearLeft ? "left" : "right", pull: 0,
      };
    };

    const onMove = (e) => {
      const s = g.current;
      if (!s.tracking) return;
      const t = e.touches[0];
      const dx = t.clientX - s.startX;
      const dy = t.clientY - s.startY;

      // Lock intent once the finger has moved meaningfully.
      if (!s.valid) {
        if (Math.abs(dx) < INTENT && Math.abs(dy) < INTENT) return;
        if (Math.abs(dy) > Math.abs(dx)) { s.tracking = false; return; } // vertical → abandon
        s.valid = true;
        setEdge(s.edge);
      }

      // Back pull is positive only in the edge's inward direction.
      const pull = s.edge === "left" ? dx : -dx;
      if (pull <= 0) { s.pull = 0; setOffset(0); return; }

      // We own this gesture — block native scroll + native edge-back.
      if (e.cancelable) e.preventDefault();

      const clamped = Math.min(pull, MAX_PULL);
      s.pull = clamped;
      setOffset(s.edge === "left" ? clamped : -clamped);
    };

    const onEnd = () => {
      const s = g.current;
      const commit = s.tracking && s.valid && s.pull >= THRESHOLD;
      reset();
      if (commit) navigate(-1);
    };

    window.addEventListener("touchstart", onStart, { passive: true });
    window.addEventListener("touchmove", onMove, { passive: false });
    window.addEventListener("touchend", onEnd, { passive: true });
    window.addEventListener("touchcancel", reset, { passive: true });
    return () => {
      window.removeEventListener("touchstart", onStart);
      window.removeEventListener("touchmove", onMove);
      window.removeEventListener("touchend", onEnd);
      window.removeEventListener("touchcancel", reset);
    };
  }, [enabled, navigate]);

  return { offset, edge, dragging: offset !== 0, threshold: THRESHOLD };
}
