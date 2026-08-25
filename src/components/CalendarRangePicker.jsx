import React, { useMemo, useState } from "react";

/* ══════════════════════════════════════════════════════════════
   CalendarRangePicker — Sprint 45 #1.

   A visual month-grid date range picker (RTL, Hebrew). The user taps a
   start day then an end day; every intervening day shades reactively.
   A live counter ("בחרת: N ימים | d.m עד d.m") reports the span before
   confirmation. Fully controlled: the parent owns `start`/`end` (ISO
   "yyyy-mm-dd") and receives changes via `onChange(startISO, endISO)`.

   Pure local Date math (new Date(y, m, d)) → correct month/leap
   rollovers, no timezone drift.
   ══════════════════════════════════════════════════════════════ */

const DOW = ["א", "ב", "ג", "ד", "ה", "ו", "ש"];
const MONTHS = ["ינואר", "פברואר", "מרץ", "אפריל", "מאי", "יוני", "יולי", "אוגוסט", "ספטמבר", "אוקטובר", "נובמבר", "דצמבר"];

const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const parse = (s) => {
  if (!s) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(s));
  if (!m) return null;
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
};
const dayMs = 86400000;
const midnight = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());

const T = {
  ink: "#0D0F11", ink3: "#6B7178", ink4: "#A4AAB1",
  line: "rgba(20,20,20,0.10)", surface: "#F6F6F4", accent: "#E0533F",
};

const CalendarRangePicker = ({ start, end, onChange }) => {
  const startD = parse(start);
  const endD = parse(end);
  /* The visible month (anchored to the current start, else today). */
  const [view, setView] = useState(() => {
    const base = startD || new Date();
    return { y: base.getFullYear(), m: base.getMonth() };
  });

  const grid = useMemo(() => {
    const first = new Date(view.y, view.m, 1);
    const startOffset = first.getDay(); // 0=Sun … leading blanks
    const daysInMonth = new Date(view.y, view.m + 1, 0).getDate();
    const cells = [];
    for (let i = 0; i < startOffset; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(view.y, view.m, d));
    return cells;
  }, [view]);

  const move = (delta) => {
    const nm = view.m + delta;
    setView({ y: view.y + Math.floor(nm / 12), m: ((nm % 12) + 12) % 12 });
  };

  const onPick = (d) => {
    const t = midnight(d);
    /* First pick, or restart when both are set or the pick precedes start. */
    if (!startD || (startD && endD) || t < midnight(startD)) {
      onChange(iso(t), "");
    } else {
      onChange(iso(startD), iso(t));
    }
  };

  const inRange = (d) => {
    if (!startD) return false;
    const t = midnight(d).getTime();
    const s = midnight(startD).getTime();
    const e = endD ? midnight(endD).getTime() : s;
    return t >= Math.min(s, e) && t <= Math.max(s, e);
  };
  const isEdge = (d) => {
    const t = midnight(d).getTime();
    return (startD && t === midnight(startD).getTime()) || (endD && t === midnight(endD).getTime());
  };

  const totalDays = startD && endD ? Math.round((midnight(endD) - midnight(startD)) / dayMs) + 1 : (startD ? 1 : 0);

  return (
    <div dir="rtl" style={{ fontFamily: "inherit" }}>
      {/* Month nav */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
        <button type="button" onClick={() => move(-1)} aria-label="חודש קודם"
          style={{ width: 40, height: 40, borderRadius: "50%", border: `1px solid ${T.line}`, background: "#fff", cursor: "pointer", fontFamily: "inherit", fontSize: 18, color: T.ink }}>›</button>
        <div style={{ fontSize: 16, fontWeight: 700, color: T.ink }}>{MONTHS[view.m]} {view.y}</div>
        <button type="button" onClick={() => move(1)} aria-label="חודש הבא"
          style={{ width: 40, height: 40, borderRadius: "50%", border: `1px solid ${T.line}`, background: "#fff", cursor: "pointer", fontFamily: "inherit", fontSize: 18, color: T.ink }}>‹</button>
      </div>

      {/* Weekday header */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 2, marginBottom: 4 }}>
        {DOW.map((d) => <div key={d} style={{ textAlign: "center", fontSize: 12, fontWeight: 700, color: T.ink4 }}>{d}</div>)}
      </div>

      {/* Day grid */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 2 }}>
        {grid.map((d, i) => {
          if (!d) return <div key={`b${i}`} />;
          const range = inRange(d);
          const edge = isEdge(d);
          return (
            <button key={iso(d)} type="button" onClick={() => onPick(d)}
              style={{
                height: 42, border: "none", cursor: "pointer", fontFamily: "inherit",
                fontSize: 15, fontWeight: edge ? 800 : 600,
                color: edge ? "#fff" : (range ? T.accent : T.ink),
                background: edge ? T.accent : (range ? "rgba(224,83,63,0.12)" : "transparent"),
                borderRadius: edge ? 12 : (range ? 6 : 10),
                transition: "background 0.12s, color 0.12s",
              }}>{d.getDate()}</button>
          );
        })}
      </div>

      {/* Live pre-confirmation counter */}
      <div role="status" style={{ marginTop: 14, textAlign: "center", padding: "12px 10px", borderRadius: 14, background: totalDays ? "rgba(224,83,63,0.08)" : T.surface, border: `1px solid ${totalDays ? "rgba(224,83,63,0.25)" : T.line}` }}>
        {totalDays ? (
          <span style={{ fontSize: 15, fontWeight: 800, color: T.ink }}>
            בחרת: {totalDays} ימים
            {startD && endD && <span style={{ color: T.ink3, fontWeight: 700 }}>{" "}| {startD.getDate()}.{startD.getMonth() + 1} עד {endD.getDate()}.{endD.getMonth() + 1}</span>}
            {startD && !endD && <span style={{ color: T.ink3, fontWeight: 700 }}>{" "}· בחרו תאריך חזרה</span>}
          </span>
        ) : (
          <span style={{ fontSize: 14, fontWeight: 700, color: T.ink3 }}>בחרו תאריך יציאה וחזרה מהלוח</span>
        )}
      </div>
    </div>
  );
};

export default CalendarRangePicker;
