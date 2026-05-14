import React, { forwardRef, useEffect, useImperativeHandle, useMemo, useRef } from "react";
import { buildStory, STORY_CITIES, getChronologicalCityPath } from "../data/storyBuilder";
import { Glyph, MetaIcon, TRANSIT_LABEL_HE } from "./StoryFlowGlyph";

/* NOTE: atmospherePhotoFor is intentionally NOT imported here.
   Atmosphere photos are reserved for the Home Page "תמונות מהדרך"
   gallery only. The Trip Roadmap / map components stay text-only. */

/* ─── Categories (Phase B sub-filters) ─── */
const CATEGORIES = [
  { key: "attractions", labelHe: "אטרקציות",   labelEn: "Attractions" },
  { key: "food",        labelHe: "אוכל",        labelEn: "Food" },
  { key: "shopping",    labelHe: "קניות",       labelEn: "Shopping" },
  { key: "hotels",      labelHe: "מלונות",      labelEn: "Hotels" },
];

/* ══════════════════════════════════════════════════════════════
   STORY FLOW v3 — Right-panel travel-story timeline
   ──────────────────────────────────────────────────────────────
   A single scrollable column built around a dashed centre spine.
   Stops zigzag left/right of the spine on desktop and stack to
   the right of an edge spine on mobile (compact mode).

   Props:
     activeStopId      string|null   — currently highlighted stop
     onSelectStop      (stopId) => void
     onClose           () => void    — collapses the panel (optional)
     activeDay         number|null
     onSelectDay       (day) => void
     compact           boolean       — true on mobile (no zigzag)
   ══════════════════════════════════════════════════════════════ */

/* ───────── Day pill row (top of panel) ───────── */
const DayPillRow = ({ activeDay, onSelectDay }) => {
  /* Build the day list from STORY (one entry per day-header) */
  const days = useMemo(() => {
    const story = buildStory();
    const seen = new Set();
    const list = [];
    story.forEach((it) => {
      if (it.type === "day-header" && !seen.has(it.day)) {
        seen.add(it.day);
        const cityRec = STORY_CITIES[it.city - 1];
        list.push({
          day: it.day,
          code: cityRec ? cityRec.code : "",
          color: cityRec ? cityRec.color : "#C0392B",
        });
      }
    });
    return list;
  }, []);

  return (
    <div
      className="pill-row"
      style={{
        display: "flex",
        gap: 6,
        padding: "12px 18px",
        overflowX: "auto",
        overflowY: "hidden",
        /* `min-width: 0` and `width: 100%` are CRITICAL here. A flex
           item's default `min-width: auto` lets it expand to its
           min-content size — for this row that's 31 × 46px circles
           + gaps ≈ 1600px, far wider than the 560px panel. Without
           these two rules the container refuses to shrink, the
           viewport overflow-hidden at the outer ExploreView clips
           the visual, and the user can't actually scroll because
           the SCROLL container itself never has a constrained
           width. Setting min-width:0 + width:100% pins the row to
           the panel width and lets overflow-x:auto take over. */
        minWidth: 0,
        width: "100%",
        boxSizing: "border-box",
        borderBottom: "1px solid var(--line)",
        direction: "ltr",
        background: "var(--paper)",
      }}
    >
      {days.slice().reverse().map((d) => {
        const isActive = d.day === activeDay;
        return (
          <button
            key={d.day}
            onClick={() => onSelectDay && onSelectDay(d.day)}
            style={{
              flexShrink: 0,
              width: 46,
              height: 46,
              borderRadius: "50%",
              border: `1px solid ${isActive ? "transparent" : d.color + "55"}`,
              background: isActive ? "rgba(28,35,51,0.06)" : "transparent",
              color: isActive ? "var(--ink)" : d.color,
              cursor: "pointer",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              fontFamily: "inherit",
              lineHeight: 1.05,
            }}
          >
            <span className="he-display" style={{ fontSize: 15, fontWeight: 700 }}>{d.day}</span>
            <span style={{ fontSize: 8, fontWeight: 500, letterSpacing: "0.06em", opacity: 0.8 }}>
              {d.code}
            </span>
          </button>
        );
      })}
    </div>
  );
};

/* ───────── Day header block (text-only) ─────────
   Stack:
     date label · DAY N pill
     יום N · עיר            (big serif, city-accent on the number)
     שכונה · שכונה · שכונה   (sub-line)
     city-abbr · יום-N      (mono caption)

   Atmosphere photos are intentionally NOT rendered here — they
   live exclusively in the Home-Page "תמונות מהדרך" gallery so
   the Trip Roadmap stays a clean, text-first reading surface.
*/
const DayHeader = ({ item }) => {
  const c = STORY_CITIES[item.city - 1];

  return (
    <div style={{ position: "relative", padding: "28px 24px 16px", textAlign: "right" }}>
      <div style={{ display: "inline-flex", alignItems: "baseline", gap: 8, marginTop: 8, marginBottom: 6 }}>
        <span className="mono" style={{ fontSize: 10, color: "var(--muted)", letterSpacing: "0.16em" }}>
          {item.date}
        </span>
      </div>
      <div
        className="he-display"
        style={{ fontSize: 24, fontWeight: 700, color: c.color, lineHeight: 1.15 }}
      >
        {item.cityHe}
      </div>
      {item.subtitleHe && (
        <div className="he-sans" style={{ fontSize: 13, color: "var(--ink-2)", marginTop: 4 }}>
          {item.subtitleHe}
        </div>
      )}
      <div style={{ fontSize: 10.5, color: "var(--muted)", letterSpacing: "0.04em", marginTop: 4 }}>
        {item.meta}
      </div>
    </div>
  );
};

/* ───────── Transit segment (sits ON the spine) ───────── */
const TransitSegment = ({ item, compact }) => {
  const lineLeft = compact ? "calc(100% - 28px)" : "50%";
  return (
    <div
      style={{
        position: "relative",
        display: "flex",
        alignItems: "center",
        justifyContent: compact ? "flex-end" : "center",
        padding: compact ? "4px 56px 4px 24px" : "4px 24px",
        height: 56,
      }}
    >
      <div
        aria-hidden
        style={{
          position: "absolute",
          top: 0,
          bottom: 0,
          left: lineLeft,
          width: 1,
          background: "repeating-linear-gradient(to bottom, rgba(28,35,51,0.18) 0 4px, transparent 4px 8px)",
          transform: "translateX(-0.5px)",
        }}
      />
      <div
        style={{
          position: "relative",
          display: "inline-flex",
          alignItems: "center",
          gap: 8,
          padding: "6px 12px",
          background: "var(--paper)",
          border: "1px solid var(--line)",
          borderRadius: 18,
          fontSize: 11,
          color: "var(--ink-2)",
          fontFamily: "inherit",
          boxShadow: "0 1px 0 rgba(255,255,255,0.6)",
        }}
      >
        <span
          style={{
            width: 22,
            height: 22,
            borderRadius: "50%",
            background: "var(--ink)",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            color: "#FDFCF7",
          }}
        >
          <Glyph name={item.mode} color="#FDFCF7" size={13} />
        </span>
        <span style={{ fontWeight: 600, color: "var(--ink)" }}>{item.min} דק׳</span>
        <span style={{ color: "var(--muted)" }}>·</span>
        <span style={{ color: "var(--muted)" }}>{TRANSIT_LABEL_HE[item.mode]}</span>
        <span style={{ color: "var(--muted)" }}>·</span>
        <span style={{ color: "var(--muted)" }}>{item.dist}</span>
      </div>
    </div>
  );
};

/* ───────── Personal note — paper marginalia ───────── */
const PersonalNote = ({ note }) => {
  const LATIN_LABEL = {
    "מאיתנו": "from us",
    "אמאלה":  "from mom",
    "תזמון":  "on timing",
    "אזהרה":  "heads up",
    "גילוי":  "a find",
    "טיפ":    "a tip",
  };
  const label = LATIN_LABEL[note.author] || note.author;
  return (
    <div
      style={{
        position: "relative",
        marginTop: 12,
        padding: "2px 14px 2px 0",
        borderRight: "1.5px solid rgba(28,35,51,0.18)",
        background: "linear-gradient(to left, rgba(28,35,51,0.025), transparent 70%)",
      }}
    >
      <div
        className="handy"
        style={{
          fontSize: 14,
          color: "var(--muted)",
          fontWeight: 500,
          letterSpacing: "0.02em",
          marginBottom: 2,
          lineHeight: 1.1,
        }}
      >
        — {label}
      </div>
      <div
        className="he-handy"
        style={{
          fontSize: 15,
          color: "var(--ink-2)",
          fontWeight: 400,
          lineHeight: 1.55,
        }}
      >
        {note.textHe}
      </div>
    </div>
  );
};

/* ───────── Stop row — zigzag layout w/ centre medallion ───────── */
const StopRow = ({ item, isActive, onClick, side, compact }) => {
  const c = STORY_CITIES[item.city - 1];
  const accent = c ? c.color : "#C0392B";
  const sideRight = side === "right";

  /* Compact (mobile) mode: edge spine, no zigzag */
  if (compact) {
    return (
      <div
        onClick={onClick}
        style={{
          position: "relative",
          padding: "14px 56px 14px 16px",
          cursor: item.coordinates ? "pointer" : "default",
          minHeight: 110,
        }}
      >
        {/* edge spine */}
        <div
          aria-hidden
          style={{
            position: "absolute",
            top: 0, bottom: 0,
            left: "calc(100% - 28px)", width: 1,
            background: `repeating-linear-gradient(to bottom, ${accent}55 0 4px, transparent 4px 8px)`,
            transform: "translateX(-0.5px)",
          }}
        />
        {/* medallion on the spine */}
        <div
          className={isActive ? "story-medallion-active" : ""}
          style={{
            position: "absolute",
            top: 16,
            left: "calc(100% - 28px)",
            transform: "translateX(-50%)",
            width: isActive ? 44 : 38,
            height: isActive ? 44 : 38,
            borderRadius: "50%",
            background: accent,
            color: accent,
            display: "flex", alignItems: "center", justifyContent: "center",
            boxShadow: isActive ? `0 0 0 4px var(--paper), 0 4px 14px ${accent}55` : `0 0 0 3px var(--paper)`,
            transition: "all 0.25s ease",
            zIndex: 2,
          }}
        >
          <Glyph name={item.icon} color="#FDFCF7" size={isActive ? 20 : 17} />
        </div>
        <div style={{ textAlign: "right", direction: "rtl", opacity: isActive ? 1 : 0.92 }}>
          {/* Primary title: English (LTR). Hebrew below as RTL subtitle. */}
          <div
            className="he-display"
            style={{
              fontSize: isActive ? 18 : 16, fontWeight: 700,
              lineHeight: 1.2, color: "var(--ink)", marginBottom: 2,
              textAlign: "right", direction: "ltr", unicodeBidi: "plaintext",
            }}
          >
            {item.titleEn || item.titleHe}
          </div>
          {item.titleHe && item.titleHe !== item.titleEn && (
            <div
              style={{
                fontSize: 11, fontWeight: 500, color: "var(--ink-2)",
                marginBottom: 8, textAlign: "right",
              }}
            >
              {item.titleHe}
            </div>
          )}
          {item.tagHe && (
            <div
              style={{
                display: "inline-block", padding: "3px 10px", borderRadius: 14,
                background: `${accent}12`, border: `1px solid ${accent}30`,
                fontSize: 10, fontWeight: 600, color: accent, marginBottom: 8,
              }}
            >
              {item.tagHe}
            </div>
          )}
          {item.descHe && (
            <div
              className="he-sans"
              style={{ fontSize: 12.5, color: "var(--ink-2)", lineHeight: 1.55, textAlign: "right" }}
            >
              {item.descHe}
            </div>
          )}
        </div>
        {/* Subtle "clickable card" affordance — icon only, no text.
            Sits in the trailing (left) corner so it does not compete
            with the title on the right. The card itself remains the
            click target; this is just a visual hint. */}
        {item.coordinates && (
          <span
            aria-hidden
            style={{
              position: "absolute",
              left: 12,
              bottom: 10,
              width: 22,
              height: 22,
              borderRadius: "50%",
              background: `${accent}10`,
              border: `1px solid ${accent}33`,
              color: accent,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 12,
              fontWeight: 700,
              fontStyle: "italic",
              opacity: 0.7,
              pointerEvents: "none",
            }}
          >
            i
          </span>
        )}
      </div>
    );
  }

  /* Desktop zigzag layout */
  return (
    <div
      onClick={onClick}
      style={{
        position: "relative",
        display: "grid",
        gridTemplateColumns: "1fr 1fr",
        gap: 0,
        alignItems: "center",
        padding: "14px 24px",
        cursor: item.coordinates ? "pointer" : "default",
        minHeight: 140,
      }}
    >
      {/* centre spine */}
      <div
        aria-hidden
        style={{
          position: "absolute",
          top: 0, bottom: 0,
          left: "50%", width: 1,
          background: `repeating-linear-gradient(to bottom, ${accent}55 0 4px, transparent 4px 8px)`,
          transform: "translateX(-0.5px)",
        }}
      />

      {/* medallion */}
      <div
        className={isActive ? "story-medallion-active" : ""}
        style={{
          position: "absolute",
          top: "50%", left: "50%",
          transform: "translate(-50%, -50%)",
          width: isActive ? 48 : 40,
          height: isActive ? 48 : 40,
          borderRadius: "50%",
          background: accent,
          color: accent,
          display: "flex", alignItems: "center", justifyContent: "center",
          boxShadow: isActive ? `0 0 0 4px var(--paper), 0 4px 14px ${accent}55` : `0 0 0 3px var(--paper)`,
          transition: "all 0.25s ease",
          zIndex: 2,
        }}
      >
        <Glyph name={item.icon} color="#FDFCF7" size={isActive ? 22 : 18} />
      </div>

      {/* dashed connector from spine toward the active side */}
      <div
        aria-hidden
        style={{
          position: "absolute",
          top: "50%",
          ...(sideRight ? { right: "50%", width: "18%" } : { left: "50%", width: "18%" }),
          borderTop: `1px dashed ${accent}80`,
          transform: "translateY(-0.5px)",
        }}
      />

      {/* content (zigzag) */}
      <div
        style={{
          gridColumn: "1",
          padding: "0 26% 0 0",
          textAlign: "right",
          direction: "rtl",
          opacity: isActive ? 1 : 0.92,
        }}
      >
        {/* Primary title: English (LTR). Hebrew below as RTL subtitle. */}
        <div
          className="he-display"
          style={{
            fontSize: isActive ? 19 : 17, fontWeight: 700,
            lineHeight: 1.2, color: "var(--ink)", marginBottom: 2,
            direction: "ltr", textAlign: "right", unicodeBidi: "plaintext",
          }}
        >
          {item.titleEn || item.titleHe}
        </div>
        {item.titleHe && item.titleHe !== item.titleEn && (
          <div
            style={{
              fontSize: 11.5, fontWeight: 500, color: "var(--ink-2)",
              marginBottom: 8, textAlign: "right",
            }}
          >
            {item.titleHe}
          </div>
        )}
        {item.tagHe && (
          <div
            style={{
              display: "inline-block", padding: "3px 10px", borderRadius: 14,
              background: `${accent}12`, border: `1px solid ${accent}30`,
              fontSize: 10, fontWeight: 600, color: accent, marginBottom: 8,
            }}
          >
            {item.tagHe}
          </div>
        )}
        {item.descHe && (
          <div
            className="he-sans"
            style={{ fontSize: 12.5, color: "var(--ink-2)", lineHeight: 1.55, textAlign: "right" }}
          >
            {item.descHe}
          </div>
        )}
      </div>
      {/* Clickable affordance — icon only */}
      {item.coordinates && (
        <span
          aria-hidden
          style={{
            position: "absolute",
            left: 16,
            bottom: 12,
            width: 22,
            height: 22,
            borderRadius: "50%",
            background: `${accent}10`,
            border: `1px solid ${accent}33`,
            color: accent,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 12,
            fontWeight: 700,
            fontStyle: "italic",
            opacity: 0.7,
            pointerEvents: "none",
          }}
        >
          i
        </span>
      )}
    </div>
  );
};

/* ───────── Hotel anchor (end-of-day card) ───────── */
const HotelAnchor = ({ item, onClick }) => {
  const c = STORY_CITIES[item.city - 1];
  const accent = c ? c.color : "#C0392B";
  const interactive = !!item.coordinates;
  return (
    <div style={{ position: "relative", padding: "10px 24px 24px" }}>
      <div
        aria-hidden
        style={{
          position: "absolute",
          top: -2, height: 18,
          left: "50%", width: 1,
          background: `repeating-linear-gradient(to bottom, ${accent}55 0 4px, transparent 4px 8px)`,
        }}
      />
      <div
        onClick={interactive ? onClick : undefined}
        style={{
          position: "relative",
          background: "var(--paper-2)",
          border: `1px solid ${accent}33`,
          borderRadius: 14,
          padding: "14px 16px",
          display: "flex",
          alignItems: "center",
          gap: 14,
          boxShadow: "0 4px 14px rgba(28,35,51,0.05)",
          cursor: interactive ? "pointer" : "default",
        }}
      >
        <div
          style={{
            width: 48, height: 48, borderRadius: 10,
            background: `${accent}15`,
            border: `1px dashed ${accent}55`,
            color: accent,
            display: "flex", alignItems: "center", justifyContent: "center",
            flexShrink: 0,
          }}
        >
          <Glyph name="hotel" color={accent} size={22} />
        </div>
        <div style={{ flex: 1, textAlign: "right" }}>
          <div
            style={{
              fontSize: 9.5, fontWeight: 700, color: accent,
              letterSpacing: "0.22em", marginBottom: 3,
            }}
          >
            לינה · END OF DAY
          </div>
          <div className="he-display" style={{ fontSize: 15, fontWeight: 700, color: "var(--ink)", direction: "ltr", textAlign: "right", unicodeBidi: "plaintext" }}>
            {item.nameEn || item.nameHe}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 4, flexWrap: "wrap" }}>
            <span style={{ fontSize: 10, color: "var(--muted)", letterSpacing: "0.12em" }}>
              {item.nightsLabel}
            </span>
            {item.rating && (
              <span
                style={{
                  fontSize: 11, fontWeight: 700, color: accent,
                  padding: "1px 7px",
                  border: `1px solid ${accent}55`,
                  borderRadius: 10,
                  background: `${accent}10`,
                }}
              >
                {item.rating}
              </span>
            )}
          </div>
          {item.descHe && (
            <div
              className="he-sans"
              style={{ fontSize: 12, color: "var(--ink-2)", lineHeight: 1.5, marginTop: 6, textAlign: "right" }}
            >
              {item.descHe}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

/* ───────── City transit (inter-city milestone) ─────────
   RTL geographical flow: ORIGIN sits on the RIGHT, DESTINATION on
   the LEFT, with an arrow ← between them. For Hebrew readers the
   progression matches reading direction (right → left = forward).
*/
const CityTransit = ({ item }) => {
  const from = STORY_CITIES[item.fromCity - 1];
  const to   = STORY_CITIES[item.toCity - 1];
  return (
    <div style={{ position: "relative", padding: "20px 24px", direction: "rtl" }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          background: "var(--paper-2)",
          border: "1px solid var(--line)",
          borderRadius: 14,
          padding: "12px 14px",
          boxShadow: "0 2px 8px rgba(28,35,51,0.04)",
        }}
      >
        {/* FROM — right side in RTL */}
        <div style={{ display: "flex", flexDirection: "column", textAlign: "right", minWidth: 0, flex: 1 }}>
          <span
            style={{
              fontSize: 9, color: "var(--muted)",
              letterSpacing: "0.2em", textTransform: "uppercase",
              marginBottom: 2,
            }}
          >
            מאיפה · from
          </span>
          <span
            className="he-display"
            style={{ fontSize: 14, fontWeight: 700, color: from.color, lineHeight: 1.2 }}
          >
            {item.fromHe || from.nameHe}
          </span>
          <span className="mono" style={{ fontSize: 10, color: "var(--muted)", letterSpacing: "0.12em", marginTop: 2 }}>
            {item.depart}
          </span>
        </div>

        {/* Centre: transit-mode glyph + arrow pointing LEFT (the forward direction in RTL) */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4, flexShrink: 0 }}>
          <div
            style={{
              width: 36, height: 36, borderRadius: "50%",
              background: "var(--paper)",
              border: "1px solid rgba(28,35,51,0.22)",
              display: "flex", alignItems: "center", justifyContent: "center",
              color: "var(--ink-2)",
              boxShadow: "0 0 0 3px var(--paper-2)",
            }}
          >
            <Glyph name={item.mode} color="var(--ink-2)" size={18} />
          </div>
          {/* arrow LEFT (←) — RTL forward */}
          <span style={{ fontSize: 14, color: "var(--muted)", lineHeight: 1 }}>←</span>
        </div>

        {/* TO — left side in RTL */}
        <div style={{ display: "flex", flexDirection: "column", textAlign: "left", minWidth: 0, flex: 1 }}>
          <span
            style={{
              fontSize: 9, color: "var(--muted)",
              letterSpacing: "0.2em", textTransform: "uppercase",
              marginBottom: 2,
            }}
          >
            לאן · to
          </span>
          <span
            className="he-display"
            style={{ fontSize: 14, fontWeight: 700, color: to.color, lineHeight: 1.2 }}
          >
            {item.toHe || to.nameHe}
          </span>
          <span className="mono" style={{ fontSize: 10, color: "var(--muted)", letterSpacing: "0.12em", marginTop: 2 }}>
            {item.arrive}
          </span>
        </div>
      </div>

      {/* caption (line name + duration) */}
      <div style={{ textAlign: "center", marginTop: 8 }}>
        <span
          className="he-sans"
          style={{ fontSize: 10.5, color: "var(--muted)", letterSpacing: "0.04em" }}
        >
          {item.lineHe} · {item.duration}
        </span>
      </div>
    </div>
  );
};

/* ══════════════════════════════════════════════════════════════
   INFO BAR — hierarchical city → category filter
   ──────────────────────────────────────────────────────────────
   Phase A: city pills only (no city selected). Tapping a city
            sets activeCityKey and reveals Phase B.
   Phase B: a "← Back" chip + the active city's name + a row of
            sub-category pills (Attractions / Food / Shopping /
            Hotels). Tapping one toggles activeCategory.
   ══════════════════════════════════════════════════════════════ */
const InfoBar = ({ activeCityKey, activeCategory, onCityChange, onCategoryChange, onClearAll }) => {
  const path = useMemo(() => getChronologicalCityPath(), []);
  const activeCity = path.find((p) => p.key === activeCityKey);
  const phase = activeCityKey ? "B" : "A";

  /* Phase A — pick a city */
  if (phase === "A") {
    return (
      <div
        style={{
          background: "var(--paper)",
          borderBottom: "1px solid var(--line)",
          padding: "10px 18px",
          direction: "rtl",
        }}
      >
        <div
          className="pill-row"
          style={{
            display: "flex",
            gap: 6,
            overflowX: "auto",
            scrollbarWidth: "none",
          }}
        >
          <button
            onClick={onClearAll}
            style={{
              flexShrink: 0,
              padding: "6px 12px",
              borderRadius: 16,
              border: "1px solid var(--line-2)",
              background: "var(--paper-2)",
              fontFamily: "inherit",
              fontSize: 11,
              fontWeight: 600,
              color: "var(--ink-2)",
              cursor: "pointer",
              whiteSpace: "nowrap",
            }}
          >
            כל הטיול
          </button>
          {path.map((cp) => {
            const c = STORY_CITIES[cp.cityIdx - 1] || STORY_CITIES[0];
            return (
              <button
                key={cp.key}
                onClick={() => onCityChange && onCityChange(cp.key)}
                style={{
                  flexShrink: 0,
                  padding: "6px 12px",
                  borderRadius: 16,
                  border: `1px solid ${c.color}55`,
                  background: "var(--paper-2)",
                  color: c.color,
                  fontFamily: "inherit",
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: "pointer",
                  whiteSpace: "nowrap",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                }}
                title={cp.label}
              >
                <span>{cp.labelHe}</span>
                <span
                  style={{
                    fontFamily: "inherit",
                    fontSize: 9,
                    color: "var(--muted)",
                    letterSpacing: "0.08em",
                  }}
                >
                  · {cp.label}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  /* Phase B — picked a city, show context + category sub-pills */
  const accent = activeCity ? activeCity.color : "#C0392B";
  return (
    <div
      style={{
        background: "var(--paper)",
        borderBottom: "1px solid var(--line)",
        direction: "rtl",
      }}
    >
      {/* Context strip: back + city + clear-category */}
      <div
        style={{
          padding: "8px 18px 6px",
          display: "flex",
          alignItems: "center",
          gap: 8,
          borderBottom: "1px solid var(--line)",
        }}
      >
        <button
          onClick={() => onCityChange && onCityChange(activeCityKey)} /* toggle off */
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            padding: "4px 10px",
            borderRadius: 8,
            border: "1px solid var(--line-2)",
            background: "transparent",
            color: "var(--ink-2)",
            cursor: "pointer",
            fontFamily: "inherit",
            fontSize: 11,
            fontWeight: 600,
          }}
          title="חזרה לכל הערים"
        >
          <span style={{ transform: "rotate(180deg)", display: "inline-flex" }}>
            <MetaIcon name="back" size={12} />
          </span>
          חזור
        </button>
        <span style={{ height: 14, width: 1, background: "var(--line-2)" }} />
        <span
          className="he-display"
          style={{ fontSize: 14, fontWeight: 700, color: accent }}
        >
          {activeCity ? activeCity.labelHe : ""}
        </span>
        {activeCategory && (
          <button
            onClick={() => onCategoryChange && onCategoryChange(activeCategory)}
            style={{
              marginInlineStart: "auto",
              display: "inline-flex",
              alignItems: "center",
              gap: 4,
              padding: "3px 8px",
              borderRadius: 8,
              border: "none",
              background: "transparent",
              color: "var(--muted)",
              cursor: "pointer",
              fontFamily: "inherit",
              fontSize: 10,
              fontWeight: 600,
            }}
            title="נקה סינון"
          >
            נקה סינון
            <MetaIcon name="close" size={10} color="currentColor" />
          </button>
        )}
      </div>

      {/* Category pills */}
      <div
        className="pill-row"
        style={{
          display: "flex",
          gap: 6,
          padding: "8px 18px",
          overflowX: "auto",
        }}
      >
        <button
          onClick={() => onCategoryChange && onCategoryChange(null)}
          style={{
            flexShrink: 0,
            padding: "5px 12px",
            borderRadius: 14,
            border: `1px solid ${!activeCategory ? "var(--ink)" : "var(--line-2)"}`,
            background: !activeCategory ? "var(--ink)" : "var(--paper-2)",
            color: !activeCategory ? "var(--paper)" : "var(--ink-2)",
            fontFamily: "inherit",
            fontSize: 11,
            fontWeight: 600,
            cursor: "pointer",
            whiteSpace: "nowrap",
          }}
        >
          הכל
        </button>
        {CATEGORIES.map((cat) => {
          const isActive = activeCategory === cat.key;
          return (
            <button
              key={cat.key}
              onClick={() => onCategoryChange && onCategoryChange(cat.key)}
              style={{
                flexShrink: 0,
                padding: "5px 12px",
                borderRadius: 14,
                border: `1px solid ${isActive ? accent : "var(--line-2)"}`,
                background: isActive ? accent : "var(--paper-2)",
                color: isActive ? "#FDFCF7" : "var(--ink-2)",
                fontFamily: "inherit",
                fontSize: 11,
                fontWeight: 600,
                cursor: "pointer",
                whiteSpace: "nowrap",
              }}
            >
              {cat.labelHe}
            </button>
          );
        })}
      </div>
    </div>
  );
};

/* ══════════════════════════════════════════════════════════════
   MAIN COMPONENT
   ══════════════════════════════════════════════════════════════ */
const StoryFlow = forwardRef(({ activeStopId, onSelectStop, onOpenDetail, onClose, activeDay, onSelectDay, activeCityKey = null, activeCategory = null, onCityChange, onCategoryChange, onClearFilters, compact = false }, ref) => {
  const scrollerRef = useRef(null);
  const stopRefs = useRef({});
  const dayRefs = useRef({});

  const story = useMemo(
    () => buildStory({ cityKey: activeCityKey, category: activeCategory }),
    [activeCityKey, activeCategory]
  );

  /* Auto-scroll to the active stop / day.
     ──────────────────────────────────────────────────────────────
     Why this is non-trivial under filtering:
       1. activeFilter / activeCity changes trigger a full
          buildStory rebuild → React re-renders the scroller.
       2. dayRefs.current[dayNum] briefly returns null/undefined
          for days that are about to mount (or unmount).
       3. A naive scrollTo fires BEFORE the new DOM commits and
          either targets a stale element or no-ops silently.

     Fix: depend on `story` itself (a different array reference on
     every rebuild) and defer the scroll inside a double rAF so
     the new layout has finished committing. */
  useEffect(() => {
    if (!scrollerRef.current) return;
    let cancelled = false;
    let raf1 = 0;
    let raf2 = 0;

    const attempt = () => {
      if (cancelled) return;
      const scroller = scrollerRef.current;
      if (!scroller) return;
      const targetEl = (activeStopId && stopRefs.current[activeStopId])
        || (activeDay != null && dayRefs.current[activeDay]);
      if (!targetEl) return;
      const top = targetEl.offsetTop - scroller.offsetTop - 100;
      scroller.scrollTo({ top, behavior: "smooth" });
    };

    /* Double rAF defers past the React commit + layout pass so
       freshly-mounted day sections have valid offsetTop. */
    raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(attempt);
    });

    return () => {
      cancelled = true;
      cancelAnimationFrame(raf1);
      cancelAnimationFrame(raf2);
    };
  }, [activeStopId, activeDay, story]);

  /* Imperative API — same robust deferral so external callers
     (the map's pin click in ExploreView) hit the post-commit DOM. */
  useImperativeHandle(ref, () => {
    const deferredScroll = (el, offsetTop = 100) => {
      if (!el || !scrollerRef.current) return;
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          const scroller = scrollerRef.current;
          if (!scroller || !el) return;
          scroller.scrollTo({
            top: el.offsetTop - scroller.offsetTop - offsetTop,
            behavior: "smooth",
          });
        });
      });
    };
    return {
      scrollToDay: (dayNum) => deferredScroll(dayRefs.current[dayNum], 12),
      scrollToStop: (stopId) => deferredScroll(stopRefs.current[stopId], 100),
    };
  }, []);

  /* zig-zag side toggle per day */
  let stopSideToggle = 0;
  let lastDayHeaderSeen = null;

  return (
    <div
      className="panel"
      style={{
        /* Width inherits from the flex parent in ExploreView
           (`width: 560` on the desktop wrapper, `100vw` inside
           the BottomSheet on mobile). min-width: 0 + width: 100%
           lets the inner pill-row scroller honour the parent
           width instead of expanding to its intrinsic content
           width. Without it the day pills couldn't scroll
           horizontally on desktop. */
        height: "100%",
        width: "100%",
        minWidth: 0,
        display: "flex",
        flexDirection: "column",
        background: "var(--paper)",
        position: "relative",
      }}
    >
      {/* HEAD — "מפת המסע / Trip Roadmap" */}
      <div
        style={{
          padding: "18px 24px 12px",
          borderBottom: "1px solid var(--line)",
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          background: "var(--paper)",
        }}
      >
        <div>
          <div
            className="dm-sans"
            style={{
              fontSize: 9.5, color: "var(--muted)", letterSpacing: "0.22em",
              textTransform: "uppercase", marginBottom: 2,
            }}
          >
            Trip Roadmap
          </div>
          <div className="he-display" style={{ fontSize: 18, fontWeight: 700 }}>
            מפת המסע
          </div>
          <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 3 }}>
            31 ימים · 9 ערים · פברואר–מרץ 2024
          </div>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            style={{
              width: 32, height: 32,
              border: "1px solid var(--line)",
              borderRadius: 8,
              background: "transparent",
              cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "center",
              color: "var(--ink-2)",
            }}
            title="כיווץ פאנל"
          >
            <MetaIcon name="arrow" size={14} />
          </button>
        )}
      </div>

      {/* Day pill row — primary navigation, sits directly under
          the title so the day grid is the first thing users scan. */}
      <DayPillRow activeDay={activeDay} onSelectDay={onSelectDay} />

      {/* InfoBar — secondary filter (Phase A city → Phase B
          category). Lives BELOW the day grid so the hierarchy reads
          'pick a day' → 'narrow it further'. */}
      <InfoBar
        activeCityKey={activeCityKey}
        activeCategory={activeCategory}
        onCityChange={onCityChange}
        onCategoryChange={onCategoryChange}
        onClearAll={onClearFilters}
      />

      {/* Scroller */}
      <div
        ref={scrollerRef}
        className="story-scroll"
        style={{ flex: 1, overflowY: "auto" }}
      >
        {story.map((item, idx) => {
          if (item.type === "day-header") {
            stopSideToggle = 0;
            lastDayHeaderSeen = item.day;
            return (
              <div key={idx} ref={(el) => (dayRefs.current[item.day] = el)}>
                <DayHeader item={item} />
              </div>
            );
          }
          if (item.type === "transit") {
            return <TransitSegment key={idx} item={item} compact={compact} />;
          }
          if (item.type === "hotel") {
            return (
              <HotelAnchor
                key={idx}
                item={item}
                onClick={() => onSelectStop && item.coordinates && onSelectStop({
                  stopId: `hotel-${lastDayHeaderSeen}`,
                  coordinates: item.coordinates,
                  name: item.nameHe,
                })}
              />
            );
          }
          if (item.type === "city-transit") {
            return <CityTransit key={idx} item={item} />;
          }
          if (item.type === "stop") {
            const side = stopSideToggle % 2 === 0 ? "right" : "left";
            stopSideToggle++;
            return (
              <div key={idx} ref={(el) => (stopRefs.current[item.stopId] = el)}>
                <StopRow
                  item={item}
                  side={side}
                  compact={compact}
                  isActive={activeStopId === item.stopId}
                  onClick={(e) => {
                    /* Prevent the click from bubbling into the panel /
                       day-card / sheet drag listeners. Detail modal is
                       the primary surface here. */
                    if (e && typeof e.stopPropagation === "function") {
                      e.stopPropagation();
                    }
                    /* PRIMARY: open the Detail Info modal */
                    if (onOpenDetail) {
                      onOpenDetail({
                        name:        item.titleEn || item.titleHe,
                        nameHe:      item.titleHe,
                        nameJa:      "",
                        desc:        item.note ? item.note.textHe : item.descHe || "",
                        day:         item.day || null,
                        city:        "",
                        cityHe:      "",
                        category:    item.kind || "attraction",
                        rating:      item.rating || null,
                        coordinates: item.coordinates || null,
                      });
                    }
                    /* SECONDARY: still update active state + map pin
                       so the marker highlights — but no flyTo on
                       the parent map (modal is foreground). */
                    if (onSelectStop) {
                      onSelectStop({
                        stopId: item.stopId,
                        coordinates: item.coordinates,
                        name: item.titleHe || item.titleEn,
                        skipMapFly: true, /* hint for parent */
                      });
                    }
                  }}
                />
              </div>
            );
          }
          return null;
        })}

        {/* End cap */}
        <div style={{ display: "flex", justifyContent: "center", padding: "8px 0 28px" }}>
          <div
            style={{
              padding: "8px 14px",
              border: "1px dashed var(--line-2)",
              borderRadius: 20,
              fontSize: 10, color: "var(--muted)",
              letterSpacing: "0.12em", textTransform: "uppercase",
              background: "var(--paper-2)",
            }}
          >
            סוף הצגה · גלילה לימים נוספים
          </div>
        </div>
      </div>
    </div>
  );
});
StoryFlow.displayName = "StoryFlow";

export default StoryFlow;
