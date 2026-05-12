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
              fontFamily: "DM Sans, system-ui, sans-serif",
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
        <span
          style={{
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: "0.18em",
            textTransform: "uppercase",
            color: c.color,
            padding: "2px 8px",
            border: `1px solid ${c.color}55`,
            borderRadius: 10,
          }}
        >
          DAY {item.day}
        </span>
      </div>
      <div
        className="he-display"
        style={{ fontSize: 24, fontWeight: 700, color: "var(--ink)", lineHeight: 1.15 }}
      >
        יום <span style={{ color: c.color }}>{item.day}</span> · {item.cityHe}
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
          fontFamily: "DM Sans, system-ui, sans-serif",
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
          <span
            style={{
              position: "absolute",
              bottom: -6, left: -6,
              width: 18, height: 18, borderRadius: "50%",
              background: "#FDFCF7", color: accent, border: `1.5px solid ${accent}`,
              fontSize: 10, fontWeight: 700, fontFamily: "DM Sans, system-ui, sans-serif",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}
          >
            {item.stopNum}
          </span>
        </div>
        <div style={{ textAlign: "right", direction: "rtl", opacity: isActive ? 1 : 0.92 }}>
          <div
            style={{
              fontSize: 10, fontWeight: 700, color: accent,
              letterSpacing: "0.22em", marginBottom: 6,
              fontFamily: "DM Sans, system-ui, sans-serif",
            }}
          >
            STOP {String(item.stopNum).padStart(2, "0")}
          </div>
          <div
            className="he-display"
            style={{
              fontSize: isActive ? 18 : 16, fontWeight: 700,
              lineHeight: 1.2, color: "var(--ink)", marginBottom: 3,
            }}
          >
            {item.titleHe}
          </div>
          {item.titleEn && item.titleEn !== item.titleHe && (
            <div
              style={{
                fontSize: 11, fontWeight: 500, color: "var(--ink-2)",
                fontStyle: "italic", marginBottom: 8,
                fontFamily: "DM Sans, system-ui, sans-serif",
              }}
            >
              {item.titleEn}
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
              style={{ fontSize: 12.5, color: "var(--ink-2)", lineHeight: 1.55 }}
            >
              {item.descHe}
            </div>
          )}
          {item.note && <PersonalNote note={item.note} />}
        </div>
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
        <span
          style={{
            position: "absolute",
            bottom: -6, right: -6,
            width: 18, height: 18, borderRadius: "50%",
            background: "#FDFCF7", color: accent, border: `1.5px solid ${accent}`,
            fontSize: 10, fontWeight: 700, fontFamily: "DM Sans, system-ui, sans-serif",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}
        >
          {item.stopNum}
        </span>
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
          gridColumn: sideRight ? "1" : "2",
          padding: sideRight ? "0 0 0 26%" : "0 26% 0 0",
          textAlign: sideRight ? "right" : "left",
          direction: sideRight ? "rtl" : "ltr",
          opacity: isActive ? 1 : 0.92,
        }}
      >
        <div
          style={{
            fontSize: 10, fontWeight: 700, color: accent,
            letterSpacing: "0.22em", marginBottom: 6,
            fontFamily: "DM Sans, system-ui, sans-serif",
          }}
        >
          STOP {String(item.stopNum).padStart(2, "0")}
        </div>
        <div
          className="he-display"
          style={{
            fontSize: isActive ? 19 : 17, fontWeight: 700,
            lineHeight: 1.2, color: "var(--ink)", marginBottom: 3,
          }}
        >
          {item.titleHe}
        </div>
        {item.titleEn && item.titleEn !== item.titleHe && (
          <div
            style={{
              fontSize: 11.5, fontWeight: 500, color: "var(--ink-2)",
              fontStyle: "italic", marginBottom: 8,
              fontFamily: "DM Sans, system-ui, sans-serif",
            }}
          >
            {item.titleEn}
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
            style={{ fontSize: 12.5, color: "var(--ink-2)", lineHeight: 1.55 }}
          >
            {item.descHe}
          </div>
        )}
        {item.note && <PersonalNote note={item.note} />}
      </div>
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
          <div className="he-display" style={{ fontSize: 15, fontWeight: 700, color: "var(--ink)" }}>
            {item.nameHe}
          </div>
          {item.neighborhoodHe && (
            <div style={{ fontSize: 11, fontStyle: "italic", color: "var(--ink-2)", marginTop: 1 }}>
              {item.nameEn} · {item.neighborhoodHe}
            </div>
          )}
        </div>
        <div style={{ textAlign: "left", direction: "ltr", flexShrink: 0 }}>
          <div style={{ fontSize: 9.5, color: "var(--muted)", letterSpacing: "0.12em" }}>
            {item.nightsLabel}
          </div>
          <div
            style={{
              fontSize: 11, color: "var(--ink-2)", marginTop: 2,
              fontFamily: "DM Mono, monospace",
            }}
          >
            {item.checkin} → {item.checkout}
          </div>
        </div>
      </div>
    </div>
  );
};

/* ───────── City transit (inter-city milestone) ───────── */
const CityTransit = ({ item }) => {
  const from = STORY_CITIES[item.fromCity - 1];
  const to   = STORY_CITIES[item.toCity - 1];
  return (
    <div style={{ position: "relative", padding: "24px 24px 22px" }}>
      {/* faded spine */}
      <div
        aria-hidden
        style={{
          position: "absolute", top: 0, bottom: 0,
          left: "50%", width: 1,
          background: "repeating-linear-gradient(to bottom, rgba(28,35,51,0.14) 0 4px, transparent 4px 8px)",
          transform: "translateX(-0.5px)",
        }}
      />
      {/* horizontal hairline */}
      <div
        aria-hidden
        style={{
          position: "absolute", top: "50%", left: 24, right: 24,
          height: 1, background: "rgba(28,35,51,0.12)",
          transform: "translateY(-0.5px)",
        }}
      />
      {/* FROM (above) */}
      <div
        style={{
          textAlign: "right", marginBottom: 14, paddingRight: 4,
          display: "flex", alignItems: "baseline", justifyContent: "flex-end", gap: 8,
        }}
      >
        <span className="mono" style={{ fontSize: 10, color: "var(--muted)", letterSpacing: "0.14em" }}>
          {item.depart}
        </span>
        <span className="he-display" style={{ fontSize: 15, fontWeight: 600, color: from.color }}>
          {item.fromHe || from.nameHe}
        </span>
        <span
          style={{
            fontSize: 9, color: "var(--muted)",
            letterSpacing: "0.2em", textTransform: "uppercase",
          }}
        >
          from
        </span>
      </div>
      {/* central medallion */}
      <div
        style={{
          position: "absolute", top: "50%", left: "50%",
          transform: "translate(-50%, -50%)",
          width: 38, height: 38, borderRadius: "50%",
          background: "var(--paper)",
          border: "1px solid rgba(28,35,51,0.22)",
          display: "flex", alignItems: "center", justifyContent: "center",
          color: "var(--ink-2)", zIndex: 2,
          boxShadow: "0 0 0 4px var(--paper)",
        }}
      >
        <Glyph name={item.mode} color="var(--ink-2)" size={18} />
      </div>
      {/* TO (below) */}
      <div
        style={{
          textAlign: "left", marginTop: 14, paddingLeft: 4, direction: "ltr",
          display: "flex", alignItems: "baseline", justifyContent: "flex-start", gap: 8,
        }}
      >
        <span
          style={{
            fontSize: 9, color: "var(--muted)",
            letterSpacing: "0.2em", textTransform: "uppercase",
          }}
        >
          to
        </span>
        <span
          className="he-display"
          style={{
            fontSize: 15, fontWeight: 600, color: to.color, direction: "rtl",
          }}
        >
          {item.toHe || to.nameHe}
        </span>
        <span className="mono" style={{ fontSize: 10, color: "var(--muted)", letterSpacing: "0.14em" }}>
          {item.arrive}
        </span>
      </div>
      {/* caption */}
      <div
        style={{
          position: "absolute", top: "calc(50% + 26px)", left: 0, right: 0,
          textAlign: "center", pointerEvents: "none",
        }}
      >
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
              fontFamily: "DM Sans, system-ui, sans-serif",
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
                  fontFamily: "Noto Serif Hebrew, serif",
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
                    fontFamily: "DM Mono, monospace",
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
            fontFamily: "DM Sans, system-ui, sans-serif",
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
              fontFamily: "DM Sans, system-ui, sans-serif",
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
            fontFamily: "DM Sans, system-ui, sans-serif",
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
                fontFamily: "DM Sans, system-ui, sans-serif",
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

  /* Auto-scroll to the active stop / day */
  useEffect(() => {
    if (!scrollerRef.current) return;
    const targetEl = (activeStopId && stopRefs.current[activeStopId])
      || (activeDay && dayRefs.current[activeDay]);
    if (!targetEl) return;
    const scroller = scrollerRef.current;
    const top = targetEl.offsetTop - scroller.offsetTop - 100;
    scroller.scrollTo({ top, behavior: "smooth" });
  }, [activeStopId, activeDay]);

  /* Imperative scrollToDay used by ExploreView when a map pin is tapped */
  useImperativeHandle(ref, () => ({
    scrollToDay: (dayNum) => {
      const el = dayRefs.current[dayNum];
      if (el && scrollerRef.current) {
        const scroller = scrollerRef.current;
        scroller.scrollTo({ top: el.offsetTop - scroller.offsetTop - 12, behavior: "smooth" });
      }
    },
    scrollToStop: (stopId) => {
      const el = stopRefs.current[stopId];
      if (el && scrollerRef.current) {
        const scroller = scrollerRef.current;
        scroller.scrollTo({ top: el.offsetTop - scroller.offsetTop - 100, behavior: "smooth" });
      }
    },
  }), []);

  /* zig-zag side toggle per day */
  let stopSideToggle = 0;
  let lastDayHeaderSeen = null;

  return (
    <div
      className="panel"
      style={{
        height: "100%",
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

      {/* InfoBar — Phase A/B city → category filter */}
      <InfoBar
        activeCityKey={activeCityKey}
        activeCategory={activeCategory}
        onCityChange={onCityChange}
        onCategoryChange={onCategoryChange}
        onClearAll={onClearFilters}
      />

      {/* Day pill row */}
      <DayPillRow activeDay={activeDay} onSelectDay={onSelectDay} />

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
