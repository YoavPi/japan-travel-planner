import React, { useState } from "react";

/* ══════════════════════════════════════════════════════════════
   StopActionsSheet — the 3-dot contextual action drawer (spec §6).

   Actions:
     • העברה ליום אחר   — pick a target day; move the stop there
     • העתקה ליום אחר   — duplicate the stop into a target day
     • הגדרה כנקודת לינה — reclassify as hotel (🏨)
     • מחיקה מהמסלול     — remove (destructive, red)

   Props:
     stop        the stop object
     days        [{day, cityHe}] for the move/copy day grid
     onMove(day) onCopy(day) onSetLodging() onDelete() onClose()
   ══════════════════════════════════════════════════════════════ */
const Row = ({ icon, label, danger, onClick }) => (
  <button onClick={onClick}
    style={{
      display: "flex", alignItems: "center", gap: 12, width: "100%",
      padding: "14px 16px", border: "none", background: "transparent",
      cursor: "pointer", fontFamily: "inherit", textAlign: "right",
      color: danger ? "#C0392B" : "#0D0F11", fontSize: 15, fontWeight: 600,
      borderBottom: "1px solid rgba(20,20,20,0.05)",
    }}>
    <span aria-hidden style={{ fontSize: 18, width: 22, textAlign: "center" }}>{icon}</span>
    {label}
  </button>
);

const StopActionsSheet = ({ stop, days = [], onMove, onCopy, onSetLodging, onDelete, onClose }) => {
  const [mode, setMode] = useState(null); // null | 'move' | 'copy'

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 60, display: "flex", alignItems: "flex-end" }}>
      <div onClick={onClose} className="tp-fade" style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.32)" }} />
      <div dir="rtl" className="tp-sheet-up" style={{
        position: "relative", width: "100%", maxWidth: 720, margin: "0 auto",
        background: "#fff", borderTopLeftRadius: 22, borderTopRightRadius: 22,
        padding: "16px 0 24px", boxShadow: "0 -24px 60px rgba(0,0,0,0.18)",
        fontFamily: "'Noto Sans Hebrew','Inter',sans-serif",
      }}>
        <div style={{ display: "flex", justifyContent: "center", marginBottom: 10 }}>
          <div style={{ width: 44, height: 5, borderRadius: 999, background: "rgba(20,20,20,0.18)" }} />
        </div>
        <div style={{ padding: "0 16px 12px", fontSize: 15.5, fontWeight: 800, color: "#0D0F11" }}>
          {mode === "move" ? "העברה ליום" : mode === "copy" ? "העתקה ליום" : (stop?.name || "פעולות")}
        </div>

        {mode ? (
          <div style={{ padding: "0 16px" }}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(52px,1fr))", gap: 8, maxHeight: 240, overflowY: "auto" }}>
              {days.map((d) => (
                <button key={d.day}
                  onClick={() => { (mode === "move" ? onMove : onCopy)(d.day); }}
                  style={{ height: 52, borderRadius: 12, border: "1px solid rgba(20,20,20,0.12)", background: "#F6F6F4", cursor: "pointer", fontFamily: "inherit", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
                  <span style={{ fontSize: 16, fontWeight: 800, color: "#0D0F11" }}>{d.day}</span>
                  <span style={{ fontSize: 9, color: "#6B7178" }}>{d.cityHe || ""}</span>
                </button>
              ))}
            </div>
            <button onClick={() => setMode(null)} style={{ marginTop: 12, width: "100%", height: 44, borderRadius: 12, border: "1px solid rgba(20,20,20,0.12)", background: "#fff", cursor: "pointer", fontFamily: "inherit", fontSize: 14, color: "#2A3036" }}>חזרה</button>
          </div>
        ) : (
          <div>
            <Row icon="↪" label="העברה ליום אחר" onClick={() => setMode("move")} />
            <Row icon="⧉" label="העתקה ליום אחר" onClick={() => setMode("copy")} />
            <Row icon="🏨" label="הגדרה כנקודת לינה / מלון" onClick={onSetLodging} />
            <Row icon="🗑" label="מחיקה מהמסלול" danger onClick={onDelete} />
          </div>
        )}
      </div>
    </div>
  );
};

export default StopActionsSheet;
