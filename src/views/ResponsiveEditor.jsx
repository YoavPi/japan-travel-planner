import React, { useEffect } from "react";
import { track } from "@vercel/analytics";
import useIsDesktop from "../hooks/useIsDesktop";
import EditorView from "./EditorView";
import EditorDesktop from "./EditorDesktop";

/* ══════════════════════════════════════════════════════════════
   ResponsiveEditor — the width switch for the trip editor.

   STAGE 0 (this file): a zero-touch safety net.
     • MOBILE (< 1024px): renders the existing <EditorView/> VERBATIM.
       The mobile experience is byte-for-byte unchanged — this wrapper
       is a pure pass-through below the breakpoint.
     • DESKTOP (≥ 1024px): renders the SAME <EditorView/> centered in
       an intentional phone-width frame (a "band-aid"), so a desktop
       visitor sees a deliberate column instead of a shattered stretch,
       until the real desktop cockpit (Stage 2) lands here.

   The frame carries `transform: translateZ(0)`, which makes it the
   containing block for the editor's many `position: fixed` layers
   (top bar, FABs, bottom sheet, modals) — so they stay INSIDE the
   frame instead of escaping to the full viewport width. This only
   affects the desktop branch; mobile never hits it.

   It also fires a lightweight analytics event so we finally learn how
   many people open the editor on desktop vs mobile (turning "no data"
   into data) — no UX impact.
   ══════════════════════════════════════════════════════════════ */

export default function ResponsiveEditor() {
  const isDesktop = useIsDesktop();

  useEffect(() => {
    try {
      track("editor_open", {
        device: isDesktop ? "desktop" : "mobile",
        width: typeof window !== "undefined" ? window.innerWidth : 0,
      });
    } catch { /* analytics is best-effort */ }
  }, [isDesktop]);

  /* MOBILE — untouched pass-through. */
  if (!isDesktop) return <EditorView />;

  /* DESKTOP — the planning cockpit (Stage 2). Shares the same brain + map as
     mobile; only the layout differs. Mobile stays entirely untouched above. */
  return <EditorDesktop />;
}
