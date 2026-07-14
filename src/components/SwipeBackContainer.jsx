import React from "react";
import useSwipeToBack from "../hooks/useSwipeToBack";

/* ══════════════════════════════════════════════════════════════
   SwipeBackContainer — drop-in wrapper that gives any SaaS view a
   native-feel edge swipe-to-back gesture with live drag feedback.

   It translates the wrapped layer to follow the finger in real time
   (snapping back smoothly on abort) and floats a minimalist arrow
   puck on the originating edge whose opacity scales with progress.

   Mount it ONLY around document-style views (Landing / Dashboard /
   TripOverview). Never wrap map canvases (Editor / Explore) — the
   hook would steal horizontal pans. Pass `enabled={false}` to make
   it inert without unmounting.
   ══════════════════════════════════════════════════════════════ */

const ARROW_INK = "#0D0F11";

export default function SwipeBackContainer({ children, enabled = true }) {
  const { offset, edge, dragging, threshold } = useSwipeToBack(enabled);
  const progress = Math.min(Math.abs(offset) / threshold, 1);

  return (
    <>
      <div
        style={{
          minHeight: "100vh",
          transform: dragging ? `translateX(${offset}px)` : undefined,
          transition: dragging ? "none" : "transform 0.28s cubic-bezier(0.22, 1, 0.36, 1)",
          willChange: dragging ? "transform" : undefined,
        }}
      >
        {children}
      </div>

      {dragging && edge && (
        <div
          aria-hidden
          style={{
            position: "fixed",
            top: "50%",
            zIndex: 90,
            [edge === "left" ? "left" : "right"]: 0,
            transform: `translateY(-50%) translateX(${
              edge === "left" ? progress * 14 - 6 : 6 - progress * 14
            }px)`,
            width: 44,
            height: 44,
            borderRadius: "50%",
            background: "rgba(255,255,255,0.94)",
            boxShadow: "0 8px 24px rgba(0,0,0,0.20), 0 1px 3px rgba(0,0,0,0.10)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            opacity: 0.35 + progress * 0.65,
            pointerEvents: "none",
            backdropFilter: "blur(4px)",
          }}
        >
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke={ARROW_INK}
            strokeWidth="2.6"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{ transform: edge === "left" ? "none" : "scaleX(-1)" }}
          >
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </div>
      )}
    </>
  );
}
