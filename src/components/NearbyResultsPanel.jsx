import React, { useEffect, useRef } from "react";
import classifyLocation from "../utils/classify";

/* ══════════════════════════════════════════════════════════════
   NearbyResultsPanel — the list that opens beside the map after
   "מצא נקודות באזור". One row per nearby result: name, category,
   address, ★ rating, a Google editorial one-liner (lazily fetched
   per row via onWantDetails), and a "＋ הוספה" that drops the
   point straight onto the active day.

   Presentational. Two layouts:
     • variant="rail"  — desktop: fills the itinerary rail column.
     • variant="sheet" — mobile: a bottom sheet over the map.
   ══════════════════════════════════════════════════════════════ */

const T = {
  panel: "#fff", ink: "#0D0F11", ink2: "#2A3036", ink3: "#6B7178",
  line: "rgba(20,20,20,0.10)", surface: "#F6F6F4", accent: "#E0533F",
  added: "#2B7B71", addedBg: "#E4EFE5",
  font: "'Noto Sans Hebrew','Inter',system-ui,sans-serif",
};

const keyOf = (r) => r.placeId || `${r.lat},${r.lng}`;

/* One result row. Requests its own details on mount (once). */
function Row({ result, index, details, onWantDetails, onAdd, onOpen, added }) {
  const asked = useRef(false);
  const id = keyOf(result);
  useEffect(() => {
    if (asked.current || details) return;
    asked.current = true;
    onWantDetails(id);
  }, [id, details, onWantDetails]);

  const loading = details === "loading" || details === undefined;
  const d = details && details !== "loading" ? details : null;
  const cat = classifyLocation(result.types || []); // { category, he, emoji }
  const address = (d && d.address) || result.secondary || "";
  const rating = result.rating ?? (d && d.rating) ?? null;
  const meta = [
    `${cat.emoji || "📍"} ${cat.he || "מקום"}`,
    rating ? `★ ${rating}${d && d.ratingCount ? ` (${d.ratingCount})` : ""}` : "",
  ].filter(Boolean).join(" · ");

  return (
    <div style={{ display: "flex", gap: 10, padding: "10px 12px", borderBottom: `1px solid ${T.line}` }}>
      <button
        onClick={() => onOpen(result)}
        style={{ flex: 1, minWidth: 0, textAlign: "start", border: "none", background: "transparent", cursor: "pointer", fontFamily: T.font, padding: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span aria-hidden style={{ flexShrink: 0, width: 20, height: 20, borderRadius: "50%", background: T.accent, color: "#fff", fontSize: 11, fontWeight: 800, display: "inline-flex", alignItems: "center", justifyContent: "center" }}>{index + 1}</span>
          <span dir="auto" style={{ flex: 1, minWidth: 0, fontSize: 14, fontWeight: 800, color: T.ink, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{result.name}</span>
        </div>
        <div dir="auto" style={{ fontSize: 11.5, fontWeight: 700, color: T.ink3, marginTop: 3 }}>{meta}</div>
        {address && (
          <div dir="auto" style={{ fontSize: 11.5, color: T.ink3, marginTop: 2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{address}</div>
        )}
        {loading ? (
          <div className="tp-skel" style={{ height: 11, borderRadius: 5, background: T.surface, marginTop: 6, width: "80%" }} />
        ) : d && d.description ? (
          <div dir="auto" style={{ fontSize: 12, color: T.ink2, marginTop: 5, lineHeight: 1.45, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{d.description}</div>
        ) : null}
      </button>
      <button
        onClick={() => onAdd(result)}
        disabled={added}
        aria-label={added ? "נוסף למסלול" : `הוספת ${result.name} למסלול`}
        style={{
          flexShrink: 0, alignSelf: "flex-start", minWidth: 44, minHeight: 44, padding: "0 12px",
          borderRadius: 12, border: "none", cursor: added ? "default" : "pointer", fontFamily: T.font,
          fontSize: 12.5, fontWeight: 800, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 5,
          background: added ? T.addedBg : T.ink, color: added ? T.added : "#fff",
        }}>
        {added ? "✓ נוסף" : "＋ הוספה"}
      </button>
    </div>
  );
}

export default function NearbyResultsPanel({
  origin, results = [], activeDay, days = [],
  detailsById = {}, onWantDetails, onAdd, onSetDay, onOpen, onClose,
  addedKeys, variant = "rail", style,
  collapsed = false, onToggleCollapse,
}) {
  const isSheet = variant === "sheet";
  const originName = origin?.nameHe || origin?.name || "הנקודה";
  const isAdded = (r) => (addedKeys instanceof Set ? addedKeys.has(keyOf(r)) : false);
  const showDaySwitch = days.length > 1 && !(isSheet && collapsed);

  const header = (
    <div style={{ flexShrink: 0, borderBottom: `1px solid ${T.line}`, padding: "12px 12px 10px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        {isSheet && onToggleCollapse && (
          <button onClick={onToggleCollapse}
            aria-label={collapsed ? "הרחבת הרשימה" : "מזעור הרשימה"} aria-expanded={!collapsed}
            style={{ flexShrink: 0, width: 32, height: 32, borderRadius: "50%", border: "none", background: T.surface, color: T.ink2, cursor: "pointer", fontFamily: T.font, fontSize: 13, fontWeight: 800 }}>
            {collapsed ? "▲" : "▼"}
          </button>
        )}
        <div dir="auto" style={{ flex: 1, minWidth: 0, fontSize: 14.5, fontWeight: 800, color: T.ink, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
          {results.length} נקודות ליד <span style={{ color: T.accent }}>{originName}</span>
        </div>
        <button onClick={onClose} aria-label="סגירת התוצאות"
          style={{ flexShrink: 0, width: 32, height: 32, borderRadius: "50%", border: "none", background: T.surface, color: T.ink2, cursor: "pointer", fontFamily: T.font, fontSize: 14, fontWeight: 800 }}>✕</button>
      </div>
      {showDaySwitch && (
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 8 }}>
          <span style={{ flexShrink: 0, fontSize: 12, fontWeight: 800, color: T.ink3 }}>מוסיף ליום</span>
          <div style={{ display: "flex", gap: 5, overflowX: "auto" }} className="tp-noscrollbar">
            {days.map((d) => {
              const on = d.day === activeDay;
              return (
                <button key={d.day} onClick={() => onSetDay(d.day)}
                  aria-pressed={on} aria-label={`יום ${d.day}`}
                  style={{ flexShrink: 0, minWidth: 30, height: 30, borderRadius: 8, cursor: "pointer", fontFamily: T.font, fontSize: 12.5, fontWeight: 800, border: `1px solid ${on ? T.ink : T.line}`, background: on ? T.ink : "#fff", color: on ? "#fff" : T.ink2 }}>
                  {d.day}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );

  const list = (
    <div style={{ flex: 1, minHeight: 0, overflowY: "auto" }}>
      {results.length === 0 ? (
        <div style={{ padding: 24, textAlign: "center", fontSize: 13, color: T.ink3 }}>לא נמצאו נקודות באזור.</div>
      ) : (
        results.map((r, i) => (
          <Row
            key={keyOf(r)} result={r} index={i}
            details={detailsById[keyOf(r)]}
            onWantDetails={onWantDetails}
            onAdd={onAdd} onOpen={onOpen}
            added={isAdded(r)}
          />
        ))
      )}
    </div>
  );

  if (isSheet) {
    return (
      <div dir="rtl" style={{ position: "fixed", insetInlineStart: 0, insetInlineEnd: 0, bottom: 0, zIndex: 120, fontFamily: T.font }}>
        <div className="tp-sheet-up" style={{ margin: "0 auto", width: "100%", maxWidth: 560, maxHeight: collapsed ? "auto" : "68vh", background: T.panel, borderTopLeftRadius: 20, borderTopRightRadius: 20, boxShadow: "0 -18px 55px rgba(0,0,0,0.3)", display: "flex", flexDirection: "column", overflow: "hidden" }}>
          <div role="presentation" onClick={onToggleCollapse}
            style={{ flexShrink: 0, cursor: onToggleCollapse ? "pointer" : "default", padding: "8px 0 4px" }}>
            <div style={{ width: 40, height: 5, borderRadius: 999, background: T.line, margin: "0 auto" }} />
          </div>
          {header}
          {!collapsed && list}
        </div>
      </div>
    );
  }

  return (
    <div dir="rtl" style={{ height: "100%", minHeight: 0, background: T.panel, borderInlineStart: `1px solid ${T.line}`, display: "flex", flexDirection: "column", overflow: "hidden", fontFamily: T.font, ...style }}>
      {header}
      {list}
    </div>
  );
}
