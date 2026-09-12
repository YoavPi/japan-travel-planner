import React, { Fragment, useEffect, useRef, useState } from "react";
import Icon from "./Icon";
import Money from "./Money";
import { readableInkOn } from "../utils/contrast";
import mapsUrlFor from "../utils/mapsUrl";
import { normalizeRating } from "../utils/classify";
import { LIGHT } from "../utils/theme";
import { formatMoney } from "../utils/budget";

/* Extracted verbatim from EditorView.jsx's renderPlaceRow (through Sprint
   65) as a behaviour-preserving no-op in Task A6, then redesigned per spec
   §4.1 (card container) and §4.2 (Row A — identity + actions) in Task B1
   (docs/superpowers/specs/2026-09-07-mobile-stop-card-redesign-design.md).

   The badge (§8.1 "the single riskiest decision in the spec") now carries
   THREE meanings: position number, drag handle (planning mode, press +
   move ≥6px — the exact threshold SwipeableRow already uses), and
   completion toggle (trip mode, tap with no movement). `≡` and the
   separate completion checkbox are deleted; the badge absorbs both.

   Row B (metadata line — category/rating/cost/files, spec §4.3/§4.5) is
   redesigned in this task (B2): plain text with `·` separators, no chip
   fills, omitted entirely when sparse. Task B3 finishes the redesign:
   the note-pencil trigger that used to live in Row B's shared row
   container is deleted outright (spec §7.1 #2/§7.2), and Row C (note
   preview, spec §4.4) replaces the old grey "note ticket" + attachment-
   pills block with plain text + a leading icon (no card-inside-a-card,
   spec §2.4/§7.1 #6). Row B's own row now renders only when it has
   content (`hasRowB`) — its sparse-collapse height is reachable again
   now that nothing else keeps that row alive. The files metadata item
   (Row B) routes 1 file to `onOpenAttachment` and >1 to the new
   `onOpenFiles(idx)` prop, per spec §4.6. */
export default function StopCard({
  stop: a, idx, pos, lodging = false, tripActive = false, liveOps = false,
  editable = true, dragging = false, P, compact,
  costSummary = null, showCost = false, onOpenCost, onOpenFiles,
  onNavigate, onToggleComplete, onEditNote, onOpenActions,
  onOpenAttachment, onDragStart, rowRef,
}) {
  const showCompletion = tripActive || liveOps;
  const done = showCompletion && !!a.completed;
  const canNavigate = !!(onNavigate && a.coordinates);
  const canDrag = editable && pos != null;
  const note = a.note || a.comment || a.annotation || a.quote;
  const hotelSpan = a._hotelGroup ? a._hotelSpan : null;
  const stopName = a.nameHe || a.name;
  const subtitle = lodging ? `מלון${hotelSpan ? ` · ${hotelSpan.total} לילות` : ""}` : (a.category || "");
  const hasNav = a.coordinates && Number.isFinite(a.coordinates.lat) && Number.isFinite(a.coordinates.lng);

  /* ── Row B — metadata line (spec §4.3/§4.5) ──
     Plain text, `·` separators, no chip fills. `normalizeRating` (Task
     A4) makes the three writer scales agree on a single "/10" display
     string; the emphasis rule (§4.3 "the rating never takes an accent
     colour") is weight/tone only — CORAL is deleted from this surface
     entirely (F23), never re-introduced here. */
  const normRating = normalizeRating(a.rating);
  const normRatingNum = normRating != null ? parseFloat(normRating) : null;
  const highRating = Number.isFinite(normRatingNum) && normRatingNum >= 8.5;
  const fileCount = a.attachments?.length ?? 0;
  const showCostItem = !!(showCost && costSummary);
  const costAriaLabel = showCostItem
    ? (costSummary.over
      ? `עלות: ${formatMoney(costSummary.effectiveMinor, costSummary.currency)}, מעל המתוכנן ${formatMoney(costSummary.plannedMinor, costSummary.currency)}`
      : `עלות: ${formatMoney(costSummary.effectiveMinor, costSummary.currency)}${costSummary.paid ? ", שולם" : ""}`)
    : undefined;

  const rowBItems = [];
  if (subtitle) rowBItems.push(<span key="cat">{subtitle}</span>);
  if (normRating) {
    rowBItems.push(
      <span key="rating" style={{ display: "inline-flex", alignItems: "center", gap: 3 }}>
        <Icon name="star" size={11} strokeWidth={0} color={highRating ? P.ink2 : P.ink3} style={{ fill: highRating ? P.ink2 : P.ink3 }} />
        <span style={{ color: highRating ? P.ink2 : P.ink3, fontWeight: highRating ? 700 : 600 }}>{normRating.split("/")[0]}</span>
        <span style={{ color: P.ink4, fontWeight: 600, fontSize: 11 }}>/10</span>
      </span>
    );
  }
  if (showCostItem) {
    rowBItems.push(
      <button
        key="cost" type="button"
        onClick={(e) => { e.stopPropagation(); onOpenCost && onOpenCost(idx); }}
        aria-label={costAriaLabel}
        style={{
          display: "inline-flex", alignItems: "center", gap: 3,
          background: "none", border: "none", padding: "12px 6px", margin: "-12px -6px",
          cursor: "pointer", fontFamily: "inherit", fontSize: 12.5,
        }}
      >
        {costSummary.paid && <Icon name="check" size={11} strokeWidth={2.4} color={costSummary.over ? P.danger : P.ink2} />}
        <Money minor={costSummary.effectiveMinor} currency={costSummary.currency} P={P} tone={costSummary.over ? "danger" : "ink2"} style={{ fontWeight: 700 }} />
        {costSummary.count > 1 && <span style={{ color: P.ink3, fontWeight: 600, fontSize: 11 }}>×{costSummary.count}</span>}
      </button>
    );
  }
  if (fileCount > 0) {
    /* §4.6 — 1 file opens AttachmentViewer directly (existing
       onOpenAttachment(f, idx, 0) path, zero new plumbing); >1 opens
       TripFilesSheet via the new onOpenFiles(idx) path (Task B6 wires
       that to focusStop={{ day, stopIdx: idx }}). */
    const onFilesClick = (e) => {
      e.stopPropagation();
      if (fileCount === 1) { onOpenAttachment && onOpenAttachment(a.attachments[0], idx, 0); }
      else { onOpenFiles && onOpenFiles(idx); }
    };
    rowBItems.push(
      <button
        key="files" type="button"
        onClick={onFilesClick}
        aria-label={`${fileCount} קבצים מצורפים`}
        style={{
          display: "inline-flex", alignItems: "center", gap: 3,
          background: "none", border: "none", padding: "12px 6px", margin: "-12px -6px",
          color: P.ink3, cursor: "pointer", fontFamily: "inherit", fontWeight: 600, fontSize: 12.5,
        }}
      >
        <Icon name="paperclip" size={12} strokeWidth={2} color={P.ink3} />
        {fileCount}
      </button>
    );
  }
  /* Item ⑤ (open hours): never renders — no data source exists yet
     (spec §9 Q1, owner-confirmed "wait", 2026-09-11). No placeholder
     dash, no reserved slot. */
  const hasRowB = rowBItems.length > 0;

  /* §4.9 breakpoint — ≤359px drops the ניווט label. `compact` is an
     externally-controlled override (used by tests and by any future
     caller that already knows the width); when the caller doesn't pass
     it, the card falls back to its own resize-aware detection so this
     works standalone without EditorView.jsx having to thread a prop
     through a resize listener of its own. */
  const [autoCompact, setAutoCompact] = useState(
    () => typeof window !== "undefined" && window.innerWidth <= 359
  );
  useEffect(() => {
    if (typeof window === "undefined") return undefined;
    const onResize = () => setAutoCompact(window.innerWidth <= 359);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);
  const isCompact = compact != null ? compact : autoCompact;

  /* ── Badge state (spec §4.2 five-row table) ──
     Trip mode (showCompletion) overrides the theme/lodging visuals
     entirely — the badge becomes a single-purpose completion control.
     Planning mode keeps the original precedence: a user colour (_theme)
     wins over lodging, which wins over the plain position number. */
  const badgeBg = showCompletion
    ? (done ? P.success : "transparent")
    : (a._theme || (lodging ? P.accent : P.ink));
  const badgeBorder = showCompletion && !done ? `1.5px solid ${P.ink3}` : "none";
  const badgeFg = showCompletion
    ? (done ? "#fff" : P.ink2)
    : readableInkOn(badgeBg);
  const badgeContent = showCompletion
    ? (done ? <Icon name="check" size={16} strokeWidth={2.6} color="#fff" /> : (pos != null ? pos + 1 : "•"))
    : (lodging ? <Icon name="bed" size={15} strokeWidth={2} color={badgeFg} /> : (pos != null ? pos + 1 : "•"));

  const posLabel = pos != null ? pos + 1 : "";
  const badgeAriaLabel = showCompletion
    ? (done ? "בטלו סימון ביקור" : "סמנו כבוצע")
    : (canDrag ? `תחנה ${posLabel}, ${stopName} — גררו לשינוי סדר` : `תחנה ${posLabel}, ${stopName}`);
  const badgeRoleDescription = (!showCompletion && canDrag) ? "ניתן לגרירה" : undefined;
  const badgeTitle = showCompletion ? badgeAriaLabel : (canDrag ? "גררו לסידור מחדש" : undefined);

  /* ── Tap-vs-drag disambiguation (spec §4.2 "Gesture split", §8.1) ──
     Identical 6px movement threshold to SwipeableRow's own long-press-
     then-move handoff (EditorView.jsx:405 — `Math.abs(dx) > 6 || Math.abs(dy) > 6`),
     so the two gesture engines never disagree. A press that moves past
     the threshold calls onDragStart() (no args — the caller closes over
     `pos`, mirroring SwipeableRow's own onDragStart call exactly). A
     press that stays under threshold toggles completion, trip mode only. */
  const badgeGesture = useRef({ x0: 0, y0: 0, dragging: false });
  const onBadgePointerDown = (e) => {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    e.stopPropagation();
    badgeGesture.current = { x0: e.clientX, y0: e.clientY, dragging: false };
    try { e.target.setPointerCapture?.(e.pointerId); } catch { /* noop — jsdom has no setPointerCapture */ }
  };
  const onBadgePointerMove = (e) => {
    e.stopPropagation();
    const g = badgeGesture.current;
    if (g.dragging) return;
    const dx = e.clientX - g.x0;
    const dy = e.clientY - g.y0;
    if (Math.abs(dx) > 6 || Math.abs(dy) > 6) {
      g.dragging = true;
      if (canDrag && onDragStart) onDragStart();
    }
  };
  const onBadgePointerUp = (e) => {
    e.stopPropagation();
    const wasDragging = badgeGesture.current.dragging;
    badgeGesture.current = { x0: 0, y0: 0, dragging: false };
    if (!wasDragging && showCompletion) {
      onToggleComplete && onToggleComplete(idx);
    }
  };
  const onBadgePointerCancel = (e) => { e.stopPropagation(); badgeGesture.current = { x0: 0, y0: 0, dragging: false }; };

  return (
    <div
      ref={rowRef}
      data-stop-idx={idx}
      style={{
        display: "flex", flexDirection: "column",
        userSelect: "none", WebkitUserSelect: "none", msUserSelect: "none", WebkitTouchCallout: "none",
        position: "relative", zIndex: dragging ? 2 : "auto",
        background: P.panel,
        border: `1px solid ${dragging ? "transparent" : P.line}`,
        borderColor: dragging && P !== LIGHT ? P.accent : undefined,
        borderRadius: 14,
        padding: "10px 12px",
        marginBlockEnd: 8,
        minHeight: 76,
        boxShadow: dragging
          ? (P === LIGHT ? "0 10px 30px rgba(0,0,0,0.16)" : "0 10px 30px rgba(0,0,0,0.55)")
          : "none",
        transform: dragging ? "scale(1.02)" : "scale(1)",
        transition: dragging ? "none" : "transform 200ms, box-shadow 200ms, background 200ms",
      }}
    >
      {/* Row A — identity + actions (spec §4.2) */}
      <div style={{ display: "flex", alignItems: "flex-start", gap: 8, minHeight: 44 }}>
        <button
          type="button"
          className="tp-press"
          onPointerDown={onBadgePointerDown}
          onPointerMove={onBadgePointerMove}
          onPointerUp={onBadgePointerUp}
          onPointerCancel={onBadgePointerCancel}
          aria-pressed={showCompletion ? done : undefined}
          aria-label={badgeAriaLabel}
          aria-roledescription={badgeRoleDescription}
          title={badgeTitle}
          style={{
            flexShrink: 0, width: 44, height: 44, margin: -6, padding: 0,
            border: "none", background: "transparent",
            display: "flex", alignItems: "center", justifyContent: "center",
            cursor: dragging ? "grabbing" : (canDrag ? "grab" : (showCompletion ? "pointer" : "default")),
            touchAction: canDrag ? "none" : undefined,
            fontFamily: "inherit",
          }}
        >
          <span aria-hidden style={{
            width: 32, height: 32, borderRadius: 8,
            display: "flex", alignItems: "center", justifyContent: "center",
            background: badgeBg, border: badgeBorder, color: badgeFg,
            fontSize: 13, fontWeight: 800, fontVariantNumeric: "tabular-nums",
            boxShadow: dragging ? `0 0 0 3px ${P.accent}33` : "none",
          }}>
            {badgeContent}
          </span>
        </button>

        <div
          onClick={() => canNavigate && onNavigate(a)}
          title={canNavigate ? "מעבר למיקום על המפה" : undefined}
          style={{ flex: 1, minWidth: 0, opacity: done ? 0.55 : 1, cursor: canNavigate ? "pointer" : "default" }}
        >
          <div dir="auto" style={{
            fontSize: 16, fontWeight: 700, color: P.ink, lineHeight: 1.3,
            display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical",
            overflow: "hidden", wordBreak: "break-word",
            textDecoration: done ? "line-through" : "none", textDecorationColor: done ? P.ink4 : "transparent",
          }}>{stopName}</div>
        </div>

        {(hasNav || editable) && (
          <div style={{ flexShrink: 0, alignSelf: "center", display: "flex", alignItems: "center", gap: 6 }}>
            {hasNav && (
              <button
                onClick={(e) => { e.stopPropagation(); const u = mapsUrlFor(a); if (u) window.open(u, "_blank", "noopener,noreferrer"); }}
                title="ניווט ב-Google Maps" aria-label="ניווט ב-Google Maps" className="tp-press"
                style={{
                  height: 44, width: isCompact ? 44 : undefined, padding: isCompact ? 0 : "0 12px",
                  border: "none", borderRadius: 10, background: P.surface, color: P.ink2,
                  cursor: "pointer", fontFamily: "inherit", fontSize: 13, fontWeight: 700,
                  display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 5,
                }}>
                <Icon name="navigation" size={14} strokeWidth={2} color={P.ink2} />
                {!isCompact && "ניווט"}
              </button>
            )}
            {editable && (
              <button
                onClick={(e) => { e.stopPropagation(); onOpenActions && onOpenActions(idx); }}
                title="פעולות" aria-label="פעולות" aria-haspopup="dialog"
                style={{ width: 44, height: 44, border: "none", borderRadius: 10, background: "transparent", color: P.ink3, cursor: "pointer", fontFamily: "inherit", display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
                <Icon name="more" size={18} strokeWidth={1.8} color={P.ink3} />
              </button>
            )}
          </div>
        )}
      </div>

      {/* Row B — metadata line (spec §4.3): category · rating · cost ·
          files, plain text with `·` separators, no chip fills. Omitted
          entirely when nothing would render, per the sparse rule — the
          note-pencil that used to keep this row alive when Row B itself
          was empty is deleted (spec §7.1 #2 / §7.2), so the row's own
          sparse-collapse height is now reachable. */}
      {hasRowB && (
        <div dir="auto" style={{
          display: "flex", flexWrap: "wrap", alignItems: "center",
          gap: 8, rowGap: 4, marginTop: 8,
          fontSize: 12.5, fontWeight: 600, color: P.ink3,
          opacity: done ? 0.55 : 1,
        }}>
          {rowBItems.map((item, i) => (
            <Fragment key={item.key}>
              {i > 0 && <span aria-hidden="true" style={{ color: P.ink4 }}>·</span>}
              {item}
            </Fragment>
          ))}
        </div>
      )}

      {/* Row C — note preview (spec §4.4). Plain text with a leading
          icon, no background fill, no card-inside-a-card (the old grey
          ticket is deleted per §2.4/§7.1 #6). Renders only when a note
          exists under any of the four legacy field names. */}
      {note && (
        editable && onEditNote ? (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onEditNote(idx); }}
            aria-label="עריכת ההערה"
            dir="auto"
            style={{
              display: "flex", alignItems: "flex-start", gap: 6,
              marginTop: 8, width: "100%", textAlign: "start",
              border: "none", background: "transparent",
              padding: 0, paddingBlock: 12, marginBlock: -12,
              cursor: "pointer", fontFamily: "inherit",
              opacity: done ? 0.6 : 1,
            }}
          >
            <Icon name="note" size={12} strokeWidth={1.9} color={P.ink3} style={{ flexShrink: 0, marginTop: 2 }} />
            <span className="tp-note-clamp" style={{ fontSize: 12.5, fontWeight: 500, color: P.ink2, lineHeight: 1.45, wordBreak: "break-word", flex: 1, minWidth: 0 }}>{note}</span>
          </button>
        ) : (
          <div dir="auto" style={{ display: "flex", alignItems: "flex-start", gap: 6, marginTop: 8, opacity: done ? 0.6 : 1 }}>
            <Icon name="note" size={12} strokeWidth={1.9} color={P.ink3} style={{ flexShrink: 0, marginTop: 2 }} />
            <span className="tp-note-clamp" style={{ fontSize: 12.5, fontWeight: 500, color: P.ink2, lineHeight: 1.45, wordBreak: "break-word", flex: 1, minWidth: 0 }}>{note}</span>
          </div>
        )
      )}

    </div>
  );
}
