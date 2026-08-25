import React, { useEffect, useMemo, useState } from "react";
import { RELEASE_NOTES, LATEST_SPRINT } from "../data/releaseNotes";

/* ══════════════════════════════════════════════════════════════
   ProductUpdatesModal — Sprint 44 #1.

   On mount (post-login) it compares LATEST_SPRINT against the locally
   stored `last_viewed_sprint`. If the app is ahead, a clean modal
   showcases the LATEST sprint's highlights. When several updates were
   missed, a "🔗 לצפייה בכל העדכונים שפספסת" toggle reveals sprint tabs
   so the user can browse each unviewed release.

   `last_viewed_sprint` is written ONLY when the user explicitly closes
   the modal (button or X), so an accidental refresh never marks
   updates as seen.
   ══════════════════════════════════════════════════════════════ */

const LS_KEY = "last_viewed_sprint";
const FONT = "'Noto Sans Hebrew','Inter','Noto Sans JP',system-ui,sans-serif";
const ACCENT = "#E0533F";

const readViewed = () => {
  try { return Number(localStorage.getItem(LS_KEY)) || 0; } catch { return 0; }
};

const ProductUpdatesModal = () => {
  const [open, setOpen] = useState(false);
  const [viewed, setViewed] = useState(0);
  const [showAll, setShowAll] = useState(false);
  const [activeSprint, setActiveSprint] = useState(LATEST_SPRINT);

  useEffect(() => {
    const v = readViewed();
    setViewed(v);
    if (LATEST_SPRINT > v) { setActiveSprint(LATEST_SPRINT); setOpen(true); }
  }, []);

  /* Every release newer than what the user last saw (newest first). */
  const missed = useMemo(
    () => RELEASE_NOTES.filter((r) => r.sprint > viewed).sort((a, b) => b.sprint - a.sprint),
    [viewed]
  );
  const note = useMemo(
    () => RELEASE_NOTES.find((r) => r.sprint === activeSprint) || RELEASE_NOTES[0],
    [activeSprint]
  );

  /* Persist the "seen" watermark ONLY on an explicit close. */
  const close = () => {
    try { localStorage.setItem(LS_KEY, String(LATEST_SPRINT)); } catch { /* private mode */ }
    setOpen(false);
  };

  if (!open || !note) return null;
  const multiple = missed.length > 1;

  return (
    <div dir="rtl" style={{ position: "fixed", inset: 0, zIndex: 120, display: "flex", alignItems: "center", justifyContent: "center", padding: 20, fontFamily: FONT }}>
      <div onClick={close} className="tp-fade" style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.55)" }} />
      <div className="tp-pop" style={{ position: "relative", width: "100%", maxWidth: 400, maxHeight: "86vh", overflowY: "auto", background: "#fff", borderRadius: 24, padding: "22px 22px 20px", boxShadow: "0 30px 90px rgba(0,0,0,0.42)" }}>
        {/* Close */}
        <button onClick={close} aria-label="סגירה"
          style={{ position: "absolute", top: 14, insetInlineStart: 14, width: 32, height: 32, borderRadius: "50%", border: "none", background: "#F6F6F4", color: "#6B7178", cursor: "pointer", fontFamily: FONT, fontSize: 15 }}>✕</button>

        {/* Header */}
        <div style={{ textAlign: "center", marginBottom: 16 }}>
          <div style={{ fontSize: 40, marginBottom: 6 }}>{note.emoji}</div>
          <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase", color: ACCENT }}>מה חדש · עדכון {note.sprint}</div>
          <div style={{ fontSize: 19, fontWeight: 800, color: "#0D0F11", marginTop: 4, lineHeight: 1.3 }}>{note.title}</div>
        </div>

        {/* Catch-up sprint tabs (only when >1 missed AND expanded). */}
        {multiple && showAll && (
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", justifyContent: "center", marginBottom: 16 }}>
            {missed.map((r) => {
              const on = r.sprint === activeSprint;
              return (
                <button key={r.sprint} onClick={() => setActiveSprint(r.sprint)} aria-pressed={on}
                  style={{ padding: "7px 13px", borderRadius: 999, cursor: "pointer", fontFamily: FONT, fontSize: 12.5, fontWeight: 800, border: `1.5px solid ${on ? "#0D0F11" : "rgba(20,20,20,0.14)"}`, background: on ? "#0D0F11" : "#fff", color: on ? "#fff" : "#2A3036" }}>
                  {r.emoji} עדכון {r.sprint}
                </button>
              );
            })}
          </div>
        )}

        {/* Feature bullets */}
        <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 18 }}>
          {note.bullets.map((b, i) => (
            <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 10, padding: "11px 13px", borderRadius: 14, background: "#F6F6F4" }}>
              <span style={{ fontSize: 14.5, fontWeight: 700, color: "#1c2333", lineHeight: 1.45 }}>{b}</span>
            </div>
          ))}
        </div>

        {/* Catch-up link (only when more than one update was missed). */}
        {multiple && !showAll && (
          <button onClick={() => setShowAll(true)}
            style={{ width: "100%", marginBottom: 10, padding: "11px 12px", borderRadius: 14, border: `1.5px dashed ${ACCENT}`, background: "rgba(224,83,63,0.06)", color: ACCENT, fontSize: 13.5, fontWeight: 800, cursor: "pointer", fontFamily: FONT }}>
            🔗 לצפייה בכל העדכונים שפספסת ({missed.length})
          </button>
        )}

        {/* Confirm / dismiss */}
        <button onClick={close} className="tp-press"
          style={{ width: "100%", height: 50, borderRadius: 999, border: "none", background: "#0D0F11", color: "#fff", fontSize: 15, fontWeight: 800, cursor: "pointer", fontFamily: FONT }}>
          הבנתי, תודה
        </button>
      </div>
    </div>
  );
};

export default ProductUpdatesModal;
