import React, { useState } from "react";

/* ══════════════════════════════════════════════════════════════
   StopActionsSheet — the 3-dot contextual action drawer (spec §6).

   Actions:
     • העברה ליום אחר      — pick a target day; move the stop there
     • העתקה ליום אחר      — duplicate the stop into a target day
     • העתקה לטיול אחר     — clone the stop's location into a day of
                              another owned trip (Sprint 18.1)
     • זה מלון לכמה ימים   — mark as a multi-night hotel across days
                              (Sprint 18.4)
     • הגדרה כנקודת לינה   — reclassify as hotel (🏨)
     • מחיקה מהמסלול       — remove (destructive, red)

   Props:
     stop        the stop object
     days        [{day, cityHe}] for the move/copy day grid
     otherTrips  [{id, title, days, ...}] owned editable trips
     onMove(day) onCopy(day) onCrossCopy(tripId, day)
     onSetLodging() onSetMultiDayHotel([day,...]) onDelete() onClose()
   ══════════════════════════════════════════════════════════════ */
const T = {
  ink: "#0D0F11", ink2: "#2A3036", ink3: "#6B7178", ink4: "#A4AAB1",
  line: "rgba(20,20,20,0.10)", surface: "#F6F6F4", accent: "#E0533F",
};

const Row = ({ icon, label, danger, onClick, last }) => (
  <button onClick={onClick}
    style={{
      display: "flex", alignItems: "center", gap: 12, width: "100%",
      padding: "13px 16px", border: "none", background: "transparent",
      cursor: "pointer", fontFamily: "inherit", textAlign: "right",
      color: danger ? "#C0392B" : "#0D0F11", fontSize: 15, fontWeight: 600,
      borderBottom: last ? "none" : "1px solid rgba(20,20,20,0.05)",
    }}>
    <span aria-hidden style={{ fontSize: 18, width: 22, textAlign: "center" }}>{icon}</span>
    {label}
  </button>
);

/* Sprint 20 #4 — grouped action menu. A muted subheading introduces
   each section; sections are separated by a thicker divider. */
const SectionHeading = ({ children }) => (
  <div style={{
    padding: "12px 16px 4px", fontSize: 11, fontWeight: 800,
    textTransform: "uppercase", letterSpacing: "0.06em", color: T.ink4,
  }}>{children}</div>
);

const SectionRule = () => (
  <div aria-hidden style={{ height: 1, background: "rgba(20,20,20,0.08)", margin: "6px 0" }} />
);

const StopActionsSheet = ({ stop, days = [], otherTrips = [], onMove, onCopy, onCrossCopy, onSetNote, onSetLodging, onSetMultiDayHotel, onMoveNextDay, onSplitDay, onDelete, onClose }) => {
  const [mode, setMode] = useState(null); // null | 'move' | 'copy' | 'crosscopy' | 'hoteldays' | 'note'
  /* Cross-trip copy selection state. */
  const [targetTripId, setTargetTripId] = useState("");
  const [targetDay, setTargetDay] = useState(1);
  /* Multi-day hotel selection — set of chosen day numbers. */
  const [hotelDays, setHotelDays] = useState([]);
  /* Per-stop memo note draft (Sprint 18.5). */
  const [noteDraft, setNoteDraft] = useState(stop?.note || "");

  const targetTrip = otherTrips.find((t) => t.id === targetTripId) || null;
  const targetDayCount = targetTrip ? (Number(targetTrip.days) || 0) : 0;

  const title =
    mode === "move" ? "העברה ליום" :
    mode === "copy" ? "העתקה ליום" :
    mode === "crosscopy" ? "העתקה לטיול אחר" :
    mode === "hoteldays" ? "מלון לכמה ימים" :
    mode === "note" ? "הערה לתחנה" :
    (stop?.name || "פעולות");

  const selectStyle = {
    width: "100%", boxSizing: "border-box", height: 48, padding: "0 14px",
    borderRadius: 12, border: `1.5px solid ${T.line}`, background: "#fff",
    fontSize: 15, fontFamily: "inherit", color: T.ink, direction: "rtl", textAlign: "right",
  };
  const backBtnStyle = { marginTop: 12, width: "100%", height: 44, borderRadius: 12, border: `1px solid ${T.line}`, background: "#fff", cursor: "pointer", fontFamily: "inherit", fontSize: 14, color: T.ink2 };

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
        <div style={{ padding: "0 16px 12px", fontSize: 15.5, fontWeight: 800, color: T.ink }}>
          {title}
        </div>

        {mode === "move" || mode === "copy" ? (
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
            <button onClick={() => setMode(null)} style={backBtnStyle}>חזרה</button>
          </div>
        ) : mode === "crosscopy" ? (
          <div style={{ padding: "0 16px" }}>
            {otherTrips.length === 0 ? (
              <div style={{ fontSize: 13.5, color: T.ink4, fontStyle: "italic", padding: "8px 2px 4px", lineHeight: 1.6 }}>
                אין טיולים אחרים בבעלותכם להעתיק אליהם. צרו טיול נוסף כדי להעביר תחנות בין מסלולים.
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {/* Dropdown 1 — target trip */}
                <label style={{ display: "block" }}>
                  <span style={{ display: "block", fontSize: 11.5, fontWeight: 800, color: T.ink3, marginBottom: 6 }}>בחרו טיול יעד</span>
                  <select value={targetTripId} onChange={(e) => { setTargetTripId(e.target.value); setTargetDay(1); }} style={selectStyle}>
                    <option value="">— בחירת טיול —</option>
                    {otherTrips.map((t) => (
                      <option key={t.id} value={t.id}>{t.title}{t.days ? ` · ${t.days} ימים` : ""}</option>
                    ))}
                  </select>
                </label>
                {/* Dropdown 2 — day within the chosen trip (dependent) */}
                <label style={{ display: "block", opacity: targetTripId ? 1 : 0.5, pointerEvents: targetTripId ? "auto" : "none" }}>
                  <span style={{ display: "block", fontSize: 11.5, fontWeight: 800, color: T.ink3, marginBottom: 6 }}>בחרו יום בטיול היעד</span>
                  <select value={targetDay} onChange={(e) => setTargetDay(Number(e.target.value))} style={selectStyle}>
                    {Array.from({ length: targetDayCount }, (_, i) => i + 1).map((n) => (
                      <option key={n} value={n}>יום {n}</option>
                    ))}
                  </select>
                </label>
                <button
                  disabled={!targetTripId}
                  onClick={() => targetTripId && onCrossCopy?.(targetTripId, targetDay)}
                  style={{ height: 50, borderRadius: 14, border: "none", background: targetTripId ? T.ink : "#D1CCC5", color: "#fff", fontSize: 15.5, fontWeight: 800, cursor: targetTripId ? "pointer" : "default", fontFamily: "inherit" }}>
                  📋 העתיקו לטיול
                </button>
              </div>
            )}
            <button onClick={() => setMode(null)} style={backBtnStyle}>חזרה</button>
          </div>
        ) : mode === "hoteldays" ? (
          <div style={{ padding: "0 16px" }}>
            <div style={{ fontSize: 13, color: T.ink3, marginBottom: 10, lineHeight: 1.5 }}>
              סמנו את הימים שבהם תלונו ב"{stop?.name || "מלון"}". התחנה תשוכפל לכל יום שנבחר.
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(64px,1fr))", gap: 8, maxHeight: 240, overflowY: "auto" }}>
              {days.map((d) => {
                const on = hotelDays.includes(d.day);
                return (
                  <button key={d.day}
                    onClick={() => setHotelDays((prev) => on ? prev.filter((x) => x !== d.day) : [...prev, d.day])}
                    style={{ height: 56, borderRadius: 12, cursor: "pointer", fontFamily: "inherit", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
                      border: `1.5px solid ${on ? T.accent : T.line}`, background: on ? `${T.accent}12` : "#F6F6F4" }}>
                    <span style={{ fontSize: 16, fontWeight: 800, color: on ? T.accent : T.ink }}>{on ? "🏨" : d.day}</span>
                    <span style={{ fontSize: 9, color: on ? T.accent : T.ink3 }}>{on ? `יום ${d.day}` : (d.cityHe || "")}</span>
                  </button>
                );
              })}
            </div>
            <button
              disabled={hotelDays.length === 0}
              onClick={() => onSetMultiDayHotel?.(hotelDays)}
              style={{ marginTop: 12, width: "100%", height: 50, borderRadius: 14, border: "none", background: hotelDays.length ? T.ink : "#D1CCC5", color: "#fff", fontSize: 15.5, fontWeight: 800, cursor: hotelDays.length ? "pointer" : "default", fontFamily: "inherit" }}>
              🏨 שמירת מלון ל־{hotelDays.length || 0} ימים
            </button>
            <button onClick={() => setMode(null)} style={backBtnStyle}>חזרה</button>
          </div>
        ) : mode === "note" ? (
          <div style={{ padding: "0 16px" }}>
            <div style={{ fontSize: 13, color: T.ink3, marginBottom: 10, lineHeight: 1.5 }}>
              הוסיפו תזכורת אישית לתחנה — שעת פתיחה, טיפ, או כל דבר שתרצו לזכור. ההערה תופיע מתחת לשם התחנה.
            </div>
            <textarea
              value={noteDraft}
              onChange={(e) => setNoteDraft(e.target.value)}
              placeholder="למשל: להזמין מקום מראש · פתוח עד 18:00"
              rows={4}
              style={{ width: "100%", boxSizing: "border-box", padding: "12px 14px", borderRadius: 14, border: `1.5px solid ${T.line}`, background: "#fff", fontSize: 15, fontFamily: "inherit", color: T.ink, direction: "rtl", textAlign: "right", resize: "vertical", lineHeight: 1.5 }}
            />
            <button
              onClick={() => onSetNote?.(noteDraft)}
              style={{ marginTop: 12, width: "100%", height: 50, borderRadius: 14, border: "none", background: T.ink, color: "#fff", fontSize: 15.5, fontWeight: 800, cursor: "pointer", fontFamily: "inherit" }}>
              📝 שמירת הערה
            </button>
            <button onClick={() => setMode(null)} style={backBtnStyle}>חזרה</button>
          </div>
        ) : (
          <div>
            {/* Section 1 — Schedule management */}
            <SectionHeading>ניהול לוח זמנים</SectionHeading>
            <Row icon="↪" label="העברה ליום אחר" onClick={() => setMode("move")} />
            <Row icon="⧉" label="העתקה ליום אחר" onClick={() => setMode("copy")} />
            <Row icon="➡️" label="העבר ליום הבא" onClick={onMoveNextDay} />
            <Row icon="✂️" label="פצל יום החל מנקודה זו" onClick={onSplitDay} last />

            <SectionRule />

            {/* Section 2 — Content & accommodations */}
            <SectionHeading>תוכן ולינה</SectionHeading>
            <Row icon="🏨" label="זה מלון לכמה ימים" onClick={() => setMode("hoteldays")} />
            <Row icon="🛏" label="הגדרה כנקודת לינה / מלון" onClick={onSetLodging} />
            <Row icon="📝" label={stop?.note ? "עריכת הערה" : "הוספת הערה"} onClick={() => { setNoteDraft(stop?.note || ""); setMode("note"); }} />
            <Row icon="📋" label="העתקה לטיול אחר" onClick={() => setMode("crosscopy")} last />

            <SectionRule />

            {/* Section 3 — Destructive */}
            <Row icon="🗑" label="מחיקה מהמסלול" danger onClick={onDelete} last />
          </div>
        )}
      </div>
    </div>
  );
};

export default StopActionsSheet;
