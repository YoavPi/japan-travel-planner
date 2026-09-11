import React from "react";
import Icon from "./Icon";
import { readableInkOn } from "../utils/contrast";
import mapsUrlFor from "../utils/mapsUrl";

/* Extracted verbatim from EditorView.jsx's renderPlaceRow (through Sprint
   65) as a behaviour-preserving no-op — see docs/superpowers/plans/
   2026-09-11-mobile-stop-card-implementation-plan.md Task A6. Redesigned
   per spec §3-§7 in Increment B; until then this still looks exactly like
   the old inline card except T.xxx -> P.xxx and rowRefs -> rowRef prop. */
export default function StopCard({
  stop: a, idx, pos, lodging = false, tripActive = false, liveOps = false,
  editable = true, dragging = false, P,
  onNavigate, onToggleComplete, onEditNote, onOpenActions, onMoveForward,
  onOpenAttachment, onHandleDown, rowRef,
}) {
  const showCompletion = tripActive || liveOps;
  const done = showCompletion && !!a.completed;
  const canNavigate = !!(onNavigate && a.coordinates);
  const note = a.note || a.comment || a.annotation || a.quote;
  const hotelSpan = a._hotelGroup ? a._hotelSpan : null;
  const CHARCOAL = "#1E1E24";
  const CORAL = "#FF6B6B";
  const badgeBg = done ? P.ink4 : (a._theme || (lodging ? CORAL : CHARCOAL));
  const badgeFg = readableInkOn(badgeBg);
  const subtitle = lodging ? `מלון${hotelSpan ? ` · ${hotelSpan.total} לילות` : ""}` : (a.category || "");
  const hasNav = a.coordinates && Number.isFinite(a.coordinates.lat) && Number.isFinite(a.coordinates.lng);
  const rNum = parseFloat(String(a.rating));
  const highRating = Number.isFinite(rNum) && rNum >= 8.5;

  return (
    <div
      ref={rowRef}
      data-stop-idx={idx}
      style={{
        display: "flex", flexDirection: "column", gap: note ? 6 : 0,
        padding: "7px 12px", marginBottom: 6,
        userSelect: "none", WebkitUserSelect: "none", msUserSelect: "none", WebkitTouchCallout: "none",
        background: done ? "#F0F0F3" : P.panel,
        border: `1px solid ${dragging ? "transparent" : "#ECECEF"}`,
        borderRadius: 14,
        boxShadow: dragging ? "0 10px 30px rgba(0,0,0,0.16)" : "none",
        transform: dragging ? "scale(1.02)" : "scale(1)",
        zIndex: dragging ? 2 : "auto", position: "relative",
        transition: dragging ? "none" : "transform 0.2s ease, box-shadow 0.2s ease, background 0.2s ease",
      }}
    >
      <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
        <div aria-hidden style={{
          flexShrink: 0, width: 28, height: 28, borderRadius: 8, marginTop: 1,
          background: badgeBg, color: badgeFg,
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 13, fontWeight: 800, fontVariantNumeric: "tabular-nums",
        }}>{lodging ? <Icon name="bed" size={15} strokeWidth={2} color={badgeFg} /> : (pos != null ? pos + 1 : "•")}</div>

        <div
          onClick={() => canNavigate && onNavigate(a)}
          title={canNavigate ? "מעבר למיקום על המפה" : undefined}
          style={{ flex: 1, minWidth: 0, opacity: done ? 0.55 : 1, cursor: canNavigate ? "pointer" : "default" }}
        >
          <div dir="auto" style={{
            fontSize: 16, fontWeight: 800, color: "#111114", lineHeight: 1.3,
            display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical",
            overflow: "hidden", wordBreak: "break-word",
            textDecoration: done ? "line-through" : "none", textDecorationColor: done ? P.ink4 : "transparent",
          }}>{a.nameHe || a.name}</div>
        </div>

        {showCompletion && (
          <button onClick={(e) => { e.stopPropagation(); onToggleComplete && onToggleComplete(idx); }}
            title={done ? "בטלו סימון ביקור" : "סמנו כבוצע"} aria-label={done ? "בטלו סימון ביקור" : "סמנו כבוצע"} aria-pressed={done}
            style={{ flexShrink: 0, width: 26, height: 26, borderRadius: "50%", border: `1.5px solid ${done ? P.success : P.ink4}`, background: done ? P.success : "transparent", color: "#fff", cursor: "pointer", display: "inline-flex", alignItems: "center", justifyContent: "center", padding: 0 }}>
            {done && <Icon name="check" size={15} strokeWidth={2.6} />}
          </button>
        )}
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 6, opacity: done ? 0.55 : 1 }}>
        <div dir="auto" style={{ flex: 1, minWidth: 0, fontSize: 12.5, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
          {a.rating && <span style={{ color: highRating ? CORAL : P.ink3, fontWeight: highRating ? 800 : 700 }}>★ {a.rating}</span>}
          {a.rating && subtitle && <span style={{ color: P.ink4, fontWeight: 600 }}> · </span>}
          {subtitle && <span style={{ color: lodging ? CORAL : P.ink3, fontWeight: lodging ? 800 : 600 }}>{subtitle}</span>}
        </div>
        {(editable || hasNav) && (
          <div style={{ flexShrink: 0, display: "flex", alignItems: "center", gap: 6 }}>
            {hasNav && (
              <button
                onClick={(e) => { e.stopPropagation(); const u = mapsUrlFor(a); if (u) window.open(u, "_blank", "noopener,noreferrer"); }}
                title="ניווט ב-Google Maps" aria-label="ניווט ב-Google Maps" className="tp-press"
                style={{ height: 30, padding: "0 10px", border: "none", background: CHARCOAL, color: "#fff", cursor: "pointer", fontFamily: "inherit", borderRadius: 8, fontSize: 12.5, fontWeight: 800, display: "inline-flex", alignItems: "center", gap: 5 }}>
                <Icon name="pin" size={13} strokeWidth={2} color="#fff" />ניווט
              </button>
            )}
            {editable && onEditNote && (
              <button
                onClick={(e) => { e.stopPropagation(); onEditNote(idx); }}
                title={a.note ? "עריכת הערה" : "הוספת הערה"} aria-label={a.note ? "עריכת הערה" : "הוספת הערה"}
                style={{ width: 30, height: 30, border: "none", background: a.note ? CHARCOAL : P.surface2, color: a.note ? "#fff" : P.ink2, cursor: "pointer", fontFamily: "inherit", borderRadius: 8, display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
                <Icon name="note" size={15} strokeWidth={1.9} color={a.note ? "#fff" : P.ink2} />
              </button>
            )}
            {editable && (
              <button
                onClick={(e) => { e.stopPropagation(); onOpenActions && onOpenActions(idx); }}
                title="פעולות" aria-label="פעולות"
                style={{ width: 30, height: 30, border: "none", background: P.surface2, color: P.ink2, cursor: "pointer", fontFamily: "inherit", borderRadius: 8, display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
                <Icon name="more" size={16} strokeWidth={1.8} />
              </button>
            )}
            {editable && pos != null && (
              <button
                onPointerDown={onHandleDown(pos)}
                title="גררו לסידור מחדש"
                style={{ width: 24, height: 30, border: "none", background: "transparent", color: P.ink4, cursor: "grab", touchAction: "none", fontSize: 16, fontFamily: "inherit" }}>
                ≡
              </button>
            )}
          </div>
        )}
      </div>

      {tripActive && !done && onMoveForward && (
        <button onClick={(e) => { e.stopPropagation(); onMoveForward(idx); }}
          style={{ marginTop: 6, alignSelf: "flex-start", border: `1px solid ${P.line}`, background: P.panel, padding: "4px 10px", borderRadius: 8, cursor: "pointer", fontFamily: "inherit", fontSize: 12, fontWeight: 700, color: P.ink2, display: "inline-flex", alignItems: "center", gap: 4 }}>
          <Icon name="chevronEnd" size={12} strokeWidth={2.2} /> העבר ליום הבא
        </button>
      )}

      {(note || (a.attachments && a.attachments.length)) && (
        <div style={{ display: "flex", alignItems: "stretch", gap: 6, width: "100%" }}>
          <div
            role={editable && onEditNote ? "button" : undefined}
            onClick={editable && onEditNote ? (e) => { e.stopPropagation(); onEditNote(idx); } : undefined}
            dir="auto" title={editable ? "עריכת ההערה" : undefined}
            style={{
              display: "flex", alignItems: "flex-start", gap: 6,
              flex: 1, minWidth: 0, boxSizing: "border-box", background: P.surface2, borderRadius: 8,
              padding: "8px 10px", fontSize: 12, fontWeight: 500, color: "#4A4A55",
              lineHeight: 1.45, whiteSpace: "pre-wrap", wordBreak: "break-word", overflowWrap: "anywhere",
              opacity: done ? 0.6 : 1, cursor: editable && onEditNote ? "pointer" : "default",
            }}>
            <span style={{ flexShrink: 0, marginTop: 1, color: P.ink3 }}><Icon name="note" size={13} strokeWidth={1.9} /></span>
            <span style={{ flex: 1, minWidth: 0 }}>{note || "הוספת הערה…"}</span>
          </div>
          {a.attachments && a.attachments.map((f, fi) => (
            <button key={fi} onClick={(e) => { e.stopPropagation(); onOpenAttachment && onOpenAttachment(f, idx, fi); }}
              title={f.name || "מסמך מצורף"} aria-label={f.name || "מסמך מצורף"} className="tp-press"
              style={{ flexShrink: 0, alignSelf: "stretch", minWidth: 36, padding: "0 8px", border: "none", background: CHARCOAL, color: "#fff", borderRadius: 8, cursor: "pointer", fontFamily: "inherit", display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 4, fontSize: 11, fontWeight: 800 }}>
              <span aria-hidden style={{ fontSize: 13 }}>📎</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
