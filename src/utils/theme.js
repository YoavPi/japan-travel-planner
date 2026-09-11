import { useEffect, useState } from "react";
import { readPrefs, writePrefs } from "../services/prefsService";

/* ══════════════════════════════════════════════════════════════
   theme — shared light/dark palette + useDarkMode hook.

   Every SaaS screen imports PALETTE from here and toggles via
   useDarkMode() so the Settings dark-mode pref is honored
   uniformly. New screens MUST go through this hook (no per-screen
   palette duplication).

   Cross-tab sync: writes to localStorage are picked up by other
   tabs via the 'storage' event listener — toggling on one screen
   updates every mounted screen instantly.
   ══════════════════════════════════════════════════════════════ */

export const LIGHT = {
  page: "#EDEDEC", panel: "#fff", ink: "#0D0F11", ink2: "#2A3036",
  ink3: "#6B7178", ink4: "#A4AAB1",
  line: "rgba(20,20,20,0.08)", surface: "#F6F6F4", surface2: "#EFEFEC",
  danger: "#C0392B", accent: "#E0533F", success: "#1FA67A",
};
export const DARK = {
  page: "#0E1012", panel: "#16191D", ink: "#F5F6F7", ink2: "#C7CCD1",
  ink3: "#8B9198", ink4: "#6B7178",
  line: "rgba(255,255,255,0.09)", surface: "#1F242A", surface2: "#262B31",
  danger: "#E0573F", accent: "#E0533F", success: "#1FA67A",
};

export const paletteFor = (dark) => (dark ? DARK : LIGHT);

const EVT = "tp-dark-changed";

export const useDarkMode = () => {
  const [dark, setDarkState] = useState(() => readPrefs().darkMode);

  useEffect(() => {
    /* Same-tab broadcast + cross-tab via storage event. */
    const onChange = (e) => {
      if (e?.detail != null) setDarkState(!!e.detail);
      else setDarkState(readPrefs().darkMode);
    };
    const onStorage = () => setDarkState(readPrefs().darkMode);
    window.addEventListener(EVT, onChange);
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener(EVT, onChange);
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  const setDark = (next) => {
    writePrefs({ darkMode: next });
    setDarkState(next);
    window.dispatchEvent(new CustomEvent(EVT, { detail: next }));
  };
  const toggle = () => setDark(!dark);

  return { dark, setDark, toggle, P: paletteFor(dark) };
};

export default useDarkMode;
