import React, { useState } from "react";
import Icon from "./Icon";

/* ══════════════════════════════════════════════════════════════
   EditorBottomBar — the mobile editor's fixed bottom bar.

   Replaces three separate floating clusters that used to scatter
   the bottom of the map:
     • a folder FAB (bottom-left)  → "בנק הנקודות"
     • a charcoal wrench speed-dial (bottom-right) → 5 unlabelled pills
     • a centred pair of circles   → "סידור ימים" + "מסלול רציף"
   Four look-alike unlabelled circles, "מסלול רציף" present twice, and
   the whole set vanished the moment the sheet left its peek snap —
   so nothing on the first screen led to the bank or the day tools.

   This bar is LABELLED and FIXED. It does not react to the sheet
   snap; the sheet is given a matching bottom inset so its peek
   sliver rests just above the bar. Three slots:

     [ בנק ]        opens the saved-points bank, badge = count
     [ ימים | רציף ] segmented view toggle (only when days > 1)
     [ עוד ]        a small menu: reorder days · summary · dates ·
                    edit the trip skeleton

   Hidden only while pinning a point on the map, while the bank
   panel itself is open, or while another overlay owns the screen.
   ══════════════════════════════════════════════════════════════ */

const T = {
  panel: "#FFFFFF", surface: "#F6F6F4", surface2: "#EFEFEC",
  ink: "#0D0F11", ink2: "#2A3036", ink3: "#6B7178",
  line: "rgba(20,20,20,0.10)", accent: "#E0533F",
  font: "'Noto Sans Hebrew','Inter','Noto Sans JP',system-ui,sans-serif",
};

/* One tap target. Icon over a Hebrew label, >=56x44. */
const Slot = ({ icon, label, badge, active, onClick, ariaLabel }) => (
  <button
    type="button"
    onClick={onClick}
    aria-label={ariaLabel || label}
    aria-pressed={active}
    className="tp-press"
    style={{
      flex: "1 1 0", minWidth: 0, minHeight: 52,
      display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
      gap: 3, padding: "6px 4px", border: "none", borderRadius: 12,
      background: active ? T.surface2 : "transparent",
      color: active ? T.ink : T.ink2, cursor: "pointer",
      fontFamily: T.font, position: "relative",
    }}
  >
    <span style={{ position: "relative", display: "inline-flex" }}>
      <Icon name={icon} size={20} strokeWidth={1.85} color={active ? T.ink : T.ink2} />
      {badge > 0 && (
        <span
          aria-hidden
          style={{
            position: "absolute", top: -6, insetInlineEnd: -7,
            minWidth: 15, height: 15, padding: "0 3px", borderRadius: 999,
            background: T.accent, color: "#fff",
            fontSize: 9.5, fontWeight: 800, lineHeight: "15px", textAlign: "center",
            border: "2px solid #fff", fontVariantNumeric: "tabular-nums",
          }}
        >
          {badge > 99 ? "99+" : badge}
        </span>
      )}
    </span>
    <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: "-0.01em", whiteSpace: "nowrap" }}>
      {label}
    </span>
  </button>
);

const EditorBottomBar = ({
  bankCount = 0,
  onBank,
  showViewToggle = false,
  continuousMode = false,
  onSetContinuous,
  editable = false,
  daysCount = 0,
  dayEditMode = false,
  onReorderDays,
  onSummary,
  onDates,
  onEditSkeleton,
  hasDates = false,
}) => {
  const [moreOpen, setMoreOpen] = useState(false);

  const moreItems = [
    editable && daysCount > 1 && {
      icon: dayEditMode ? "check" : "arrowUpDown",
      label: dayEditMode ? "סיום סידור הימים" : "סידור מחדש של הימים",
      onClick: onReorderDays,
    },
    daysCount > 0 && { icon: "barChart", label: "סיכום הטיול", onClick: onSummary },
    { icon: "calendar", label: hasDates ? "שינוי תאריכי הטיול" : "הגדרת תאריכי הטיול", onClick: onDates },
    editable && { icon: "wrench", label: "עריכת שלד הטיול", onClick: onEditSkeleton },
  ].filter(Boolean);

  return (
    <>
      {moreOpen && (
        <div
          onClick={() => setMoreOpen(false)}
          className="tp-fade"
          style={{ position: "fixed", inset: 0, zIndex: 58, background: "rgba(0,0,0,0.28)" }}
        />
      )}

      <nav
        dir="rtl"
        aria-label="פעולות מסלול"
        style={{
          position: "fixed", insetInlineStart: 0, insetInlineEnd: 0, bottom: 0, zIndex: 59,
          background: T.panel, borderTop: `1px solid ${T.line}`,
          boxShadow: "0 -3px 16px rgba(0,0,0,0.07)",
          paddingBottom: "env(safe-area-inset-bottom, 0px)",
          fontFamily: T.font,
        }}
      >
        {/* the "עוד" menu, opening upward from the bar */}
        {moreOpen && (
          <div
            className="tp-sheet-up"
            style={{
              position: "absolute", insetInlineStart: 8, insetInlineEnd: 8, bottom: "calc(100% + 8px)",
              zIndex: 60, background: T.panel, borderRadius: 16, border: `1px solid ${T.line}`,
              boxShadow: "0 12px 40px rgba(0,0,0,0.18)", overflow: "hidden",
            }}
          >
            {moreItems.map((it, i) => (
              <button
                key={it.label}
                type="button"
                onClick={() => { setMoreOpen(false); it.onClick?.(); }}
                className="tp-press"
                style={{
                  display: "flex", alignItems: "center", gap: 12, width: "100%",
                  padding: "13px 16px", border: "none",
                  borderTop: i === 0 ? "none" : `1px solid ${T.line}`,
                  background: "transparent", cursor: "pointer", fontFamily: T.font,
                  textAlign: "start", fontSize: 15, fontWeight: 600, color: T.ink,
                }}
              >
                <Icon name={it.icon} size={19} strokeWidth={1.8} color={T.ink2} />
                {it.label}
              </button>
            ))}
          </div>
        )}

        <div style={{ display: "flex", alignItems: "stretch", gap: 4, padding: "6px 8px" }}>
          <Slot
            icon="folder"
            label="בנק הנקודות"
            badge={bankCount}
            onClick={onBank}
            ariaLabel={bankCount > 0 ? `בנק הנקודות, ${bankCount} שמורות` : "בנק הנקודות"}
          />

          {showViewToggle && (
            <div
              role="group"
              aria-label="תצוגת המסלול"
              style={{
                flex: "1.3 1 0", display: "flex", alignItems: "center",
                background: T.surface, border: `1px solid ${T.line}`,
                borderRadius: 12, padding: 3, gap: 3, minHeight: 52,
              }}
            >
              <button
                type="button"
                onClick={() => onSetContinuous?.(false)}
                aria-pressed={!continuousMode}
                className="tp-press"
                style={{
                  flex: 1, minHeight: 44, border: "none", borderRadius: 9, cursor: "pointer",
                  fontFamily: T.font, fontSize: 13, fontWeight: 800,
                  background: continuousMode ? "transparent" : T.ink,
                  color: continuousMode ? T.ink3 : "#fff",
                  boxShadow: continuousMode ? "none" : "0 1px 3px rgba(0,0,0,0.18)",
                }}
              >
                ימים
              </button>
              <button
                type="button"
                onClick={() => onSetContinuous?.(true)}
                aria-pressed={continuousMode}
                className="tp-press"
                style={{
                  flex: 1, minHeight: 44, border: "none", borderRadius: 9, cursor: "pointer",
                  fontFamily: T.font, fontSize: 13, fontWeight: 800,
                  background: continuousMode ? T.ink : "transparent",
                  color: continuousMode ? "#fff" : T.ink3,
                  boxShadow: continuousMode ? "0 1px 3px rgba(0,0,0,0.18)" : "none",
                }}
              >
                רציף
              </button>
            </div>
          )}

          <Slot
            icon="more"
            label="עוד"
            active={moreOpen}
            onClick={() => setMoreOpen((v) => !v)}
            ariaLabel={moreOpen ? "סגירת התפריט" : "עוד פעולות"}
          />
        </div>
      </nav>
    </>
  );
};

export default EditorBottomBar;
