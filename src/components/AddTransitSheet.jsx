import React, { useState } from "react";
import Icon from "./Icon";

/* ══════════════════════════════════════════════════════════════
   AddTransitSheet — add a transit / movement segment to a day.

   A sibling to AddStopSheet: instead of a place node, this records
   a MOVEMENT between places — a flight, train, drive, or ferry —
   with departure / arrival times and a reference id (flight / seat
   number). The committed object is flagged `_transit: true` so the
   editor timeline renders it with the editorial transit aesthetic
   (dashed track + transport glyph) rather than a place card, and so
   it is skipped by the map-marker projection (no coordinates).

   Props:
     onAdd   (transit) — commit the new transit segment
     onClose ()
   ══════════════════════════════════════════════════════════════ */

const T = {
  ink: "#0D0F11", ink2: "#2A3036", ink3: "#6B7178", ink4: "#A4AAB1",
  line: "rgba(20,20,20,0.12)", surface: "#F6F6F4", accent: "#E0533F",
};

/* Movement types — glyph icon + Hebrew label. Each declares which
   detail fields it surfaces (Sprint 20 #3b): only flights carry a
   flight-number/airline reference, so Car/Bus/Train hide it (trains &
   ferries keep a seat/booking reference; cars & buses have none). */
const MODES = [
  { key: "flight", icon: "plane", he: "טיסה",     hasRef: true,  refLabel: "מספר טיסה / חברת תעופה", refPlaceholder: "למשל LY802 · 14C" },
  { key: "train",  icon: "train", he: "רכבת",     hasRef: true,  refLabel: "מספר רכבת / מושב",       refPlaceholder: "למשל Nozomi 21 · 8A" },
  { key: "drive",  icon: "car",   he: "רכב / מונית", hasRef: false },
  { key: "bus",    icon: "bus",   he: "אוטובוס",  hasRef: false },
  { key: "ferry",  icon: "ferry", he: "מעבורת",   hasRef: true,  refLabel: "מספר הפלגה / מושב",      refPlaceholder: "למשל F12 · 3C" },
];

const Field = ({ label, value, onChange, placeholder, type = "text" }) => (
  <label style={{ display: "block", flex: 1, minWidth: 0 }}>
    <span style={{ display: "block", fontSize: 11, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.05em", color: T.ink3, marginBottom: 6 }}>{label}</span>
    <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} type={type}
      style={{ width: "100%", boxSizing: "border-box", height: 46, borderRadius: 14, border: `1px solid ${value ? T.ink : T.line}`, padding: "0 12px", fontSize: 15, fontFamily: "inherit", direction: "rtl", textAlign: "right", color: T.ink, transition: "border-color 0.15s" }} />
  </label>
);

/* Stylized scrollable time picker (Sprint 20 #3c) — two native <select>
   wheels (hours 00-23, minutes in 5-min steps) instead of a free-text
   field. Native selects scroll like a wheel on mobile and dropdown on
   desktop. The combined "HH:MM" string is reported via onChange. */
const HOURS = Array.from({ length: 24 }, (_, h) => String(h).padStart(2, "0"));
const MINUTES = Array.from({ length: 12 }, (_, m) => String(m * 5).padStart(2, "0"));

const selStyle = {
  height: 46, borderRadius: 12, border: `1px solid ${T.line}`,
  padding: "0 8px", fontSize: 16, fontWeight: 700, fontFamily: "inherit",
  color: T.ink, background: "#fff", cursor: "pointer",
  fontVariantNumeric: "tabular-nums", textAlign: "center", appearance: "none",
  WebkitAppearance: "none", MozAppearance: "none",
};

const TimePicker = ({ label, value, onChange }) => {
  const [hh, mm] = (value || "").split(":");
  const setPart = (h, m) => {
    if (!h && !m) { onChange(""); return; }
    onChange(`${(h || "00")}:${(m || "00")}`);
  };
  return (
    <label style={{ display: "block", flex: 1, minWidth: 0 }}>
      <span style={{ display: "block", fontSize: 11, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.05em", color: T.ink3, marginBottom: 6 }}>{label}</span>
      <div style={{ display: "flex", alignItems: "center", gap: 6, direction: "ltr" }}>
        <select value={hh || ""} onChange={(e) => setPart(e.target.value, mm)} aria-label={`${label} שעה`}
          style={{ ...selStyle, flex: 1, borderColor: value ? T.ink : T.line }}>
          <option value="">––</option>
          {HOURS.map((h) => <option key={h} value={h}>{h}</option>)}
        </select>
        <span style={{ fontSize: 18, fontWeight: 800, color: T.ink3 }}>:</span>
        <select value={mm || ""} onChange={(e) => setPart(hh, e.target.value)} aria-label={`${label} דקות`}
          style={{ ...selStyle, flex: 1, borderColor: value ? T.ink : T.line }}>
          <option value="">––</option>
          {MINUTES.map((m) => <option key={m} value={m}>{m}</option>)}
        </select>
      </div>
    </label>
  );
};

const AddTransitSheet = ({ onAdd, onClose, initial = null }) => {
  /* Sprint 27 #3 — edit mode: when `initial` carries an EXISTING transit
     segment (_transit), the sheet opens prefilled and commits an UPDATE.
     A plain prefill object (Sprint 28 rail materialization) keeps the
     add-mode CTA. Same onAdd contract — the caller decides
     replace-vs-append. */
  const editing = !!(initial && initial._transit);
  const [mode, setMode] = useState(initial?.transitType || "flight");
  const [from, setFrom] = useState(initial?.from || "");
  const [to, setTo] = useState(initial?.to || "");
  const [departTime, setDepartTime] = useState(initial?.departTime || "");
  const [arriveTime, setArriveTime] = useState(initial?.arriveTime || "");
  const [refId, setRefId] = useState(initial?.refId || "");
  /* A transit is defined by its TYPE alone — route, times and reference are
     optional refinements. So the details section starts COLLAPSED (open only
     when editing or already prefilled), keeping the common case to ~2 taps:
     pick a type → הוספה. The user can add details now or later via edit. */
  const [showDetails, setShowDetails] = useState(
    editing || !!(initial?.from || initial?.to || initial?.departTime || initial?.arriveTime || initial?.refId)
  );

  const meta = MODES.find((m) => m.key === mode) || MODES[0];
  const canAdd = true;

  const commit = () => {
    if (!canAdd) return;
    const route = [from.trim(), to.trim()].filter(Boolean).join(" → ");
    const label = route ? `${meta.he} · ${route}` : meta.he;
    onAdd({
      _transit: true,
      transitType: mode,
      name: label,
      nameHe: label,
      from: from.trim(),
      to: to.trim(),
      departTime: departTime.trim(),
      arriveTime: arriveTime.trim(),
      refId: meta.hasRef ? refId.trim() : "",
    });
  };

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 60, display: "flex", alignItems: "flex-end" }}>
      <div onClick={onClose} className="tp-fade" style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.32)" }} />
      <div dir="rtl" className="tp-sheet-up" style={{
        position: "relative", width: "100%", background: "#fff",
        borderTopLeftRadius: 22, borderTopRightRadius: 22, padding: "16px 18px 28px",
        boxShadow: "0 -24px 60px rgba(0,0,0,0.18)", maxWidth: 720, margin: "0 auto",
        fontFamily: "'Noto Sans Hebrew','Inter',sans-serif",
      }}>
        <div style={{ display: "flex", justifyContent: "center", marginBottom: 12 }}>
          <div style={{ width: 44, height: 5, borderRadius: 999, background: "rgba(20,20,20,0.18)" }} />
        </div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
          <div style={{ fontSize: 17, fontWeight: 800, color: T.ink }}>{editing ? "עריכת מעבר" : "הוספת מעבר / טיסה"}</div>
          <button onClick={onClose} aria-label="סגירה" style={{ width: 32, height: 32, borderRadius: "50%", border: "none", background: T.surface, cursor: "pointer", fontFamily: "inherit", color: T.ink2, display: "inline-flex", alignItems: "center", justifyContent: "center" }}><Icon name="x" size={14} strokeWidth={2.2} /></button>
        </div>

        {/* Movement type selector */}
        <div style={{ fontSize: 11, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.05em", color: T.ink3, marginBottom: 8 }}>סוג מעבר</div>
        <div style={{ display: "flex", gap: 8, marginBottom: 18, flexWrap: "wrap" }}>
          {MODES.map((m) => {
            const on = mode === m.key;
            return (
              <button key={m.key} onClick={() => setMode(m.key)}
                style={{
                  display: "inline-flex", alignItems: "center", gap: 6,
                  padding: "9px 14px", borderRadius: 999, cursor: "pointer", fontFamily: "inherit",
                  border: `1px solid ${on ? T.ink : T.line}`,
                  background: on ? T.ink : "#fff", color: on ? "#fff" : T.ink2,
                  fontSize: 13, fontWeight: 700,
                }}>
                <Icon name={m.icon} size={15} strokeWidth={1.9} color={on ? "#fff" : T.accent} />{m.he}
              </button>
            );
          })}
        </div>

        {showDetails ? (
        <>
        {/* Route — from / to. Flights speak aviation language; ground transit
            keeps generic origin/destination labels. All optional. */}
        <div style={{ display: "flex", gap: 10, marginBottom: 14 }}>
          <Field
            label={mode === "flight" ? "מאיפה ממריאים" : "מוצא"}
            value={from} onChange={setFrom}
            placeholder={mode === "flight" ? "למשל תל אביב (TLV)" : "למשל טוקיו"}
          />
          <Field
            label={mode === "flight" ? "שדה נחיתה ביעד הראשון" : "יעד"}
            value={to} onChange={setTo}
            placeholder={mode === "flight" ? "למשל טוקיו (NRT)" : "למשל קיוטו"}
          />
        </div>

        {/* Times — stylized scrollable wheel pickers */}
        <div style={{ display: "flex", gap: 10, marginBottom: 14 }}>
          <TimePicker label="שעת יציאה" value={departTime} onChange={setDepartTime} />
          <TimePicker label="שעת הגעה" value={arriveTime} onChange={setArriveTime} />
        </div>

        {/* Reference id — only for transit types that carry one
            (flight number / train seat / ferry booking). Hidden for
            car & bus, which have no such reference. */}
        {meta.hasRef && (
          <div style={{ marginBottom: 18 }}>
            <Field label={meta.refLabel} value={refId} onChange={setRefId} placeholder={meta.refPlaceholder} />
          </div>
        )}
        </>
        ) : (
          <button onClick={() => setShowDetails(true)}
            style={{ width: "100%", height: 46, marginBottom: 18, borderRadius: 14, border: `1.5px dashed ${T.line}`, background: T.surface, color: T.ink2, cursor: "pointer", fontFamily: "inherit", fontSize: 13.5, fontWeight: 700, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
            ＋ פרטים · מסלול, זמנים{meta.hasRef ? ", מספר" : ""} <span style={{ color: T.ink4, fontWeight: 600 }}>(אופציונלי)</span>
          </button>
        )}

        {/* Commit */}
        <button onClick={commit} disabled={!canAdd}
          style={{ width: "100%", height: 52, borderRadius: 999, border: "none", background: canAdd ? T.ink : "#D1CCC5", color: "#fff", fontSize: 15.5, fontWeight: 700, cursor: canAdd ? "pointer" : "default", fontFamily: "inherit" }}>
          {editing ? "שמירת שינויים" : "הוספה למסלול"}
        </button>
      </div>
    </div>
  );
};

export default AddTransitSheet;
