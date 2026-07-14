import React, { useState } from "react";
import Icon from "./Icon";

/* ══════════════════════════════════════════════════════════════
   NoteSheet — a fast, premium note editor (Sprint 21 #3).

   A minimalist bottom sheet for adding/editing a free-text note on
   a stop. Opened directly from the pencil trigger on a location card
   (no longer buried in the 3-dots menu). Sleek neutral surface in the
   modern sans-serif aesthetic — no post-it yellow, no pin glyph.

   Props:
     title        — heading text
     initialValue — current note text
     placeholder  — input hint
     onSave(text) — commit the note (trimmed by the caller)
     onClose()    — dismiss without saving
   ══════════════════════════════════════════════════════════════ */

const T = {
  ink: "#0D0F11", ink2: "#2A3036", ink3: "#6B7178", ink4: "#A4AAB1",
  line: "rgba(20,20,20,0.12)", surface: "#F6F6F4",
  font: "'Noto Sans Hebrew','Inter','Noto Sans JP',system-ui,sans-serif",
};

const NoteSheet = ({ title = "הערה", initialValue = "", placeholder = "הוסיפו הערה…", onSave, onClose }) => {
  const [text, setText] = useState(initialValue || "");

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 62, display: "flex", alignItems: "flex-end" }}>
      <div onClick={onClose} className="tp-fade" style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.32)" }} />
      <div dir="rtl" className="tp-sheet-up" style={{
        position: "relative", width: "100%", background: "#fff",
        borderTopLeftRadius: 22, borderTopRightRadius: 22, padding: "16px 18px 28px",
        boxShadow: "0 -24px 60px rgba(0,0,0,0.18)", maxWidth: 720, margin: "0 auto",
        fontFamily: T.font,
      }}>
        <div style={{ display: "flex", justifyContent: "center", marginBottom: 12 }}>
          <div style={{ width: 44, height: 5, borderRadius: 999, background: "rgba(20,20,20,0.18)" }} />
        </div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 8, fontSize: 17, fontWeight: 800, color: T.ink }}>
            <Icon name="edit" size={16} strokeWidth={1.9} color={T.ink3} />{title}
          </div>
          <button onClick={onClose} aria-label="סגירה" style={{ width: 32, height: 32, borderRadius: "50%", border: "none", background: T.surface, cursor: "pointer", fontFamily: "inherit", color: T.ink2, display: "inline-flex", alignItems: "center", justifyContent: "center" }}><Icon name="x" size={14} strokeWidth={2.2} /></button>
        </div>

        <textarea
          autoFocus
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={placeholder}
          rows={4}
          style={{
            width: "100%", boxSizing: "border-box", padding: "12px 14px",
            borderRadius: 14, border: `1px solid ${text ? T.ink : T.line}`,
            background: T.surface, fontSize: 15, fontFamily: T.font, color: T.ink,
            direction: "rtl", textAlign: "right", resize: "vertical", lineHeight: 1.5,
            transition: "border-color 0.15s",
          }}
        />

        <button onClick={() => onSave && onSave(text.trim())}
          style={{ marginTop: 16, width: "100%", height: 52, borderRadius: 999, border: "none", background: T.ink, color: "#fff", fontSize: 15.5, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
          שמירת הערה
        </button>
      </div>
    </div>
  );
};

export default NoteSheet;
