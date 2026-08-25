import React, { useEffect, useRef, useState } from "react";
import { useDarkMode } from "../utils/theme";

/* ══════════════════════════════════════════════════════════════
   AccessibilityWidget — floating a11y button + settings panel.

   Israeli sites (IS 5568 / WCAG 2.1 AA) are expected to offer these
   adjustments. Settings persist to localStorage and re-apply on the
   next visit (as the accessibility statement promises). The widget
   is a HELPER — real compliance also lives in the markup (focus,
   ARIA, alt text, contrast), which is handled separately.

   Font size uses `zoom` on <html>, not root font-size: the app is
   styled in px inline styles, so a rem-based bump wouldn't scale it.
   Dark mode routes through useDarkMode so it stays in sync with the
   Settings screen. The rest are CSS classes on <html>.
   ══════════════════════════════════════════════════════════════ */

const KEY = "tp_a11y_v1";
const DEFAULTS = { zoom: 100, grayscale: false, contrast: false, links: false, readable: false, noAnim: false, bigCursor: false };
const ACCENT = "#E0533F"; // site accent (orange) — matches CTAs, no blue/teal

const read = () => { try { return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(KEY) || "{}") }; } catch { return { ...DEFAULTS }; } };
const write = (s) => { try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* storage blocked */ } };

/* Big-cursor: a large arrow as a data-URI so no asset request is needed. */
const BIG_CURSOR = "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='48' height='48' viewBox='0 0 48 48'%3E%3Cpath d='M8 4l30 18-13 3 7 14-6 3-7-14-11 8z' fill='black' stroke='white' stroke-width='2'/%3E%3C/svg%3E\") 4 2, auto";

/* One global stylesheet driving the class-based options. Injected once. */
const CSS = `
  html.a11y-grayscale { filter: grayscale(1); }
  html.a11y-contrast { filter: contrast(1.35); }
  html.a11y-grayscale.a11y-contrast { filter: grayscale(1) contrast(1.35); }
  html.a11y-links a { text-decoration: underline !important; }
  html.a11y-readable, html.a11y-readable * { font-family: Arial, "Helvetica Neue", Helvetica, sans-serif !important; }
  html.a11y-noanim *, html.a11y-noanim *::before, html.a11y-noanim *::after { animation: none !important; transition: none !important; scroll-behavior: auto !important; }
  html.a11y-bigcursor, html.a11y-bigcursor * { cursor: ${BIG_CURSOR} !important; }
  .a11y-fab:focus-visible, .a11y-panel button:focus-visible { outline: 3px solid ${ACCENT}; outline-offset: 2px; }
`;

const applyToDom = (s, setDark, dark) => {
  const html = document.documentElement;
  html.style.zoom = s.zoom === 100 ? "" : String(s.zoom / 100);
  html.classList.toggle("a11y-grayscale", s.grayscale);
  html.classList.toggle("a11y-contrast", s.contrast);
  html.classList.toggle("a11y-links", s.links);
  html.classList.toggle("a11y-readable", s.readable);
  html.classList.toggle("a11y-noanim", s.noAnim);
  html.classList.toggle("a11y-bigcursor", s.bigCursor);
  if (typeof s._dark === "boolean" && s._dark !== dark) setDark(s._dark);
};

const Row = ({ emoji, label, active, onClick }) => (
  <button
    onClick={onClick}
    aria-pressed={active}
    style={{
      display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%",
      padding: "11px 14px", borderRadius: 12, cursor: "pointer", fontFamily: "inherit",
      border: `1.5px solid ${active ? ACCENT : "rgba(20,20,20,0.10)"}`,
      background: active ? "#E0533F12" : "#fff", color: "#0D0F11", fontSize: 14.5, fontWeight: 700, marginBottom: 8,
    }}
  >
    <span>{label}</span>
    <span aria-hidden style={{ fontSize: 18 }}>{emoji}</span>
  </button>
);

const AccessibilityWidget = () => {
  const { dark, setDark } = useDarkMode();
  const [open, setOpen] = useState(false);
  const [s, setS] = useState(read);
  const panelRef = useRef(null);

  // Inject the stylesheet once.
  useEffect(() => {
    if (document.getElementById("a11y-widget-css")) return;
    const el = document.createElement("style");
    el.id = "a11y-widget-css";
    el.textContent = CSS;
    document.head.appendChild(el);
  }, []);

  // Apply on mount + whenever settings change; persist.
  useEffect(() => { applyToDom(s, setDark, dark); write(s); }, [s]); // eslint-disable-line react-hooks/exhaustive-deps

  // Close on Escape.
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => { if (e.key === "Escape") setOpen(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const set = (patch) => setS((prev) => ({ ...prev, ...patch }));
  const bumpZoom = (dir) => set({ zoom: Math.min(150, Math.max(90, s.zoom + dir * 10)) });
  const reset = () => { setS({ ...DEFAULTS }); if (dark) setDark(false); };

  return (
    <>
      {/* Floating trigger — teal circle, bottom-right (physical, so it's stable in RTL). */}
      <button
        className="a11y-fab"
        onClick={() => setOpen((o) => !o)}
        aria-label="אפשרויות נגישות"
        aria-expanded={open}
        title="נגישות"
        style={{
          position: "fixed", right: 18, bottom: 18, zIndex: 2147483001,
          width: 52, height: 52, borderRadius: "50%", border: "none", cursor: "pointer",
          background: ACCENT, color: "#fff", boxShadow: "0 6px 20px rgba(0,0,0,0.22)",
          display: "inline-flex", alignItems: "center", justifyContent: "center",
        }}
      >
        <svg width="26" height="26" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
          <circle cx="12" cy="4" r="2" />
          <path d="M12 7c-2.5 0-5 .6-5 .6M12 7c2.5 0 5 .6 5 .6M12 7v6m0 0l-2.5 6M12 13l2.5 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" fill="none" />
        </svg>
      </button>

      {open && (
        <>
          <div onClick={() => setOpen(false)} style={{ position: "fixed", inset: 0, zIndex: 2147483001, background: "transparent" }} />
          <div
            ref={panelRef}
            dir="rtl"
            role="dialog"
            aria-label="הגדרות נגישות"
            className="a11y-panel"
            style={{
              position: "fixed", right: 18, bottom: 80, zIndex: 2147483002,
              width: 300, maxWidth: "calc(100vw - 36px)", maxHeight: "min(78vh, 620px)", overflowY: "auto",
              background: "#fff", borderRadius: 18, border: "1px solid rgba(20,20,20,0.10)",
              boxShadow: "0 16px 48px rgba(0,0,0,0.22)", padding: 16,
              fontFamily: "'Noto Sans Hebrew','Inter',system-ui,sans-serif",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
              <span style={{ fontSize: 17, fontWeight: 800, color: "#0D0F11" }}>נגישות</span>
              <button onClick={() => setOpen(false)} aria-label="סגירה" style={{ border: "none", background: "transparent", fontSize: 18, cursor: "pointer", color: "#6B7178" }}>✕</button>
            </div>

            {/* Text size */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
              <span style={{ fontSize: 14.5, fontWeight: 800, color: "#0D0F11" }}>גודל תצוגה</span>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                <button onClick={() => bumpZoom(-1)} aria-label="הקטנה" style={{ width: 38, height: 34, borderRadius: 9, border: "1.5px solid rgba(20,20,20,0.12)", background: "#fff", cursor: "pointer", fontSize: 15, fontWeight: 800, fontFamily: "inherit" }}>‑א</button>
                <span style={{ minWidth: 44, textAlign: "center", fontSize: 13, fontWeight: 800, color: "#2A3036" }}>{s.zoom}%</span>
                <button onClick={() => bumpZoom(1)} aria-label="הגדלה" style={{ width: 38, height: 34, borderRadius: 9, border: "1.5px solid rgba(20,20,20,0.12)", background: "#fff", cursor: "pointer", fontSize: 15, fontWeight: 800, fontFamily: "inherit" }}>א+</button>
              </span>
            </div>

            <Row emoji="🌙" label="ניגודיות כהה" active={dark} onClick={() => setDark(!dark)} />
            <Row emoji="◐" label="ניגודיות גבוהה" active={s.contrast} onClick={() => set({ contrast: !s.contrast })} />
            <Row emoji="🌑" label="גווני אפור" active={s.grayscale} onClick={() => set({ grayscale: !s.grayscale })} />
            <Row emoji="🔗" label="הדגשת קישורים" active={s.links} onClick={() => set({ links: !s.links })} />
            <Row emoji="Aa" label="פונט קריא" active={s.readable} onClick={() => set({ readable: !s.readable })} />
            <Row emoji="⏸" label="עצירת אנימציות" active={s.noAnim} onClick={() => set({ noAnim: !s.noAnim })} />
            <Row emoji="➤" label="סמן גדול" active={s.bigCursor} onClick={() => set({ bigCursor: !s.bigCursor })} />

            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 6, paddingTop: 12, borderTop: "1px solid rgba(20,20,20,0.08)" }}>
              <button onClick={() => window.open("/accessibility", "_self")} style={{ border: "none", background: "transparent", color: ACCENT, fontSize: 13, fontWeight: 800, cursor: "pointer", fontFamily: "inherit", textDecoration: "underline" }}>הצהרת נגישות</button>
              <button onClick={reset} style={{ border: "1.5px solid rgba(20,20,20,0.12)", background: "#fff", color: "#2A3036", borderRadius: 10, padding: "8px 14px", fontSize: 13, fontWeight: 800, cursor: "pointer", fontFamily: "inherit" }}>איפוס הגדרות</button>
            </div>
          </div>
        </>
      )}
    </>
  );
};

export default AccessibilityWidget;
