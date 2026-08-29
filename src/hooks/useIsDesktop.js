import { useEffect, useState } from "react";

/* ══════════════════════════════════════════════════════════════
   useIsDesktop — the single responsive switch.

   Responsive layout is a question of SPACE, so we key off viewport
   WIDTH via matchMedia (NOT user-agent sniffing, which is brittle
   for tablets / "request desktop site" / small windows). Live-
   updates on resize + rotate. Read synchronously on first render
   (CRA is client-side, so `window` exists — no SSR flash).

     < 1024px  → the existing, polished MOBILE experience (unchanged)
     ≥ 1024px  → the desktop layout

   Deliberately width-only: the desktop layout is built "mouse-
   enhanced, not mouse-required", so a wide touch device (iPad
   landscape) still works if it lands here.
   ══════════════════════════════════════════════════════════════ */

export const DESKTOP_QUERY = "(min-width: 1024px)";

export default function useIsDesktop() {
  const [isDesktop, setIsDesktop] = useState(
    () => (typeof window !== "undefined" && window.matchMedia
      ? window.matchMedia(DESKTOP_QUERY).matches
      : false)
  );

  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mql = window.matchMedia(DESKTOP_QUERY);
    const onChange = (e) => setIsDesktop(e.matches);
    /* addEventListener is the modern API; addListener is the Safari<14 fallback. */
    if (mql.addEventListener) mql.addEventListener("change", onChange);
    else mql.addListener(onChange);
    /* Re-sync once in case the width changed between first render and effect. */
    setIsDesktop(mql.matches);
    return () => {
      if (mql.removeEventListener) mql.removeEventListener("change", onChange);
      else mql.removeListener(onChange);
    };
  }, []);

  return isDesktop;
}
