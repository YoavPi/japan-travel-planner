/* eslint-disable */
import React, { useEffect, useMemo, useRef, useState } from "react";
import { tripData } from "../data/tripData";

/* ══════════════════════════════════════════════════════════════
   OMNIBOX SEARCH — global location finder.

   • Mobile: a small circular magnifying-glass button pinned to
     the top-right of the map. Tapping it expands a full-width
     input panel with a live suggestion list. Tap a result → the
     parent's onSelect callback fires (handles flyTo + scroll +
     expand on its end).
   • Desktop: a permanent pill-style search bar in the same
     top-right corner of the map. Suggestions render directly
     below it.

   Matching is case-insensitive over: English name, Hebrew name,
   day number ("day 8" / "יום 8"), and the literal Hebrew
   category text. Up to 8 results render at once.
   ══════════════════════════════════════════════════════════════ */

/* Build a searchable flat index from any trip-data array.
   Accepts dynamic data (from tripService) or falls back to the
   static Japan import so the component is backward-compatible. */
const buildIndexFromData = (src) => {
  const rows = [];
  (src || []).forEach((day) => {
    (day.attractions || []).forEach((a) => {
      if (!a.coordinates) return;
      rows.push({
        day: day.day,
        name:    a.name || "",
        nameHe:  a.nameHe || "",
        category: a.category || "",
        coordinates: a.coordinates,
      });
    });
  });
  return rows;
};

/* Backward-compat: static index built from the Japan data file. */
const buildIndex = () => buildIndexFromData(tripData);

const SearchIcon = ({ size = 16, color = "currentColor" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
       stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="11" cy="11" r="7" />
    <line x1="21" y1="21" x2="16.65" y2="16.65" />
  </svg>
);

const CloseIcon = ({ size = 14, color = "currentColor" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
       stroke={color} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
  </svg>
);

const SuggestionList = ({ items, onPick, accent = "#1C2333" }) => (
  <ul
    role="listbox"
    style={{
      listStyle: "none",
      margin: 0,
      padding: 0,
      maxHeight: 320,
      overflowY: "auto",
      background: "#FDFCF7",
      border: "1px solid var(--line)",
      borderRadius: 12,
      boxShadow: "0 8px 24px rgba(28,35,51,0.12)",
      direction: "rtl",
    }}
  >
    {items.length === 0 ? (
      <li style={{ padding: "12px 14px", fontSize: 12, color: "var(--muted)", textAlign: "right" }}>
        אין תוצאות
      </li>
    ) : items.map((it, idx) => (
      <li
        key={`${it.day}-${it.name}-${idx}`}
        role="option"
        onClick={() => onPick(it)}
        style={{
          padding: "10px 14px",
          cursor: "pointer",
          borderBottom: idx < items.length - 1 ? "1px solid var(--line)" : "none",
          textAlign: "right",
        }}
        onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(28,35,51,0.04)")}
        onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
      >
        <div style={{ fontSize: 13, fontWeight: 700, color: "var(--ink)", direction: "ltr", textAlign: "right" }}>
          {it.name}
        </div>
        {it.nameHe && (
          <div style={{ fontSize: 11, color: "var(--ink-2)", marginTop: 1 }}>
            {it.nameHe}
          </div>
        )}
        <div style={{ fontSize: 10, color: "var(--muted)", marginTop: 3, letterSpacing: "0.04em" }}>
          יום {it.day}{it.category ? ` · ${it.category}` : ""}
        </div>
      </li>
    ))}
  </ul>
);

/* tripDataProp: when provided (by ExploreView loading a dynamic trip)
   the search indexes that trip's stops instead of the static Japan data. */
const OmniboxSearch = ({ onSelect, variant = "desktop", tripDataProp }) => {
  const index = useMemo(
    () => tripDataProp ? buildIndexFromData(tripDataProp) : buildIndex(),
    [tripDataProp]
  );
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const inputRef = useRef(null);
  const containerRef = useRef(null);

  /* Filter the index against the query — case-insensitive,
     matches any of: English name, Hebrew name, day number,
     category. */
  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    const dayHit = q.match(/(?:day\s*|יום\s*)?(\d{1,2})$/);
    const dayNum = dayHit ? Number(dayHit[1]) : null;
    return index
      .filter((it) => {
        if (dayNum && it.day === dayNum) return true;
        const hay = `${it.name} ${it.nameHe} ${it.category}`.toLowerCase();
        return hay.includes(q);
      })
      .slice(0, 8);
  }, [index, query]);

  /* Close on outside click / Escape. */
  useEffect(() => {
    if (!open) return;
    const onDown = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    const onKey = (e) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  /* Auto-focus on open. */
  useEffect(() => {
    if (open && inputRef.current) {
      setTimeout(() => inputRef.current.focus(), 50);
    }
  }, [open]);

  const handlePick = (it) => {
    setQuery("");
    setOpen(false);
    onSelect && onSelect(it);
  };

  /* ── MOBILE: circular icon button → full-width overlay panel ── */
  if (variant === "mobile") {
    return (
      <div ref={containerRef} style={{ position: "absolute", top: 12, right: 12, zIndex: 20 }}>
        {!open ? (
          <button
            onClick={() => setOpen(true)}
            title="חיפוש"
            style={{
              width: 40, height: 40, borderRadius: "50%",
              border: "1px solid #1C2333",
              background: "#1C2333",
              color: "#FDFCF7",
              display: "flex", alignItems: "center", justifyContent: "center",
              cursor: "pointer",
              boxShadow: "0 2px 8px rgba(0,0,0,0.18)",
            }}
          >
            <SearchIcon size={18} color="#FDFCF7" />
          </button>
        ) : (
          <div
            style={{
              position: "fixed",
              top: 12, left: 12, right: 12,
              direction: "rtl",
            }}
          >
            <div
              style={{
                display: "flex", alignItems: "center", gap: 8,
                padding: "8px 12px",
                background: "#FDFCF7",
                border: "1px solid var(--line)",
                borderRadius: 22,
                boxShadow: "0 8px 24px rgba(28,35,51,0.12)",
              }}
            >
              <SearchIcon size={16} color="#1C2333" />
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="חפש לוקיישן, יום או קטגוריה…"
                style={{
                  flex: 1, border: "none", outline: "none",
                  background: "transparent",
                  /* iOS Safari auto-zooms when an input has font-size < 16px.
                     16px here suppresses the focus-zoom on mobile. */
                  fontSize: 16,
                  fontFamily: "inherit", direction: "rtl",
                  textAlign: "right", color: "var(--ink)",
                }}
              />
              <button
                onClick={() => { setQuery(""); setOpen(false); }}
                style={{
                  width: 26, height: 26, borderRadius: "50%",
                  background: "rgba(28,35,51,0.08)",
                  border: "none", cursor: "pointer",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  color: "var(--ink-2)",
                }}
              >
                <CloseIcon size={12} />
              </button>
            </div>
            {query.trim() && (
              <div style={{ marginTop: 6 }}>
                <SuggestionList items={results} onPick={handlePick} />
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  /* ── DESKTOP: permanent pill bar ── */
  return (
    <div
      ref={containerRef}
      style={{
        position: "absolute",
        top: 16, right: 16,
        width: 320,
        zIndex: 20,
        direction: "rtl",
      }}
    >
      <div
        onClick={() => setOpen(true)}
        style={{
          display: "flex", alignItems: "center", gap: 8,
          padding: "8px 14px",
          background: "#FDFCF7",
          border: "1px solid var(--line)",
          borderRadius: 22,
          boxShadow: "0 2px 8px rgba(28,35,51,0.08)",
          cursor: "text",
        }}
      >
        <SearchIcon size={15} color="#1C2333" />
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          placeholder="חפש לוקיישן, יום או קטגוריה…"
          style={{
            flex: 1, border: "none", outline: "none",
            background: "transparent", fontSize: 13.5,
            fontFamily: "inherit", direction: "rtl",
            textAlign: "right", color: "var(--ink)",
          }}
        />
        {query && (
          <button
            onClick={(e) => { e.stopPropagation(); setQuery(""); inputRef.current?.focus(); }}
            style={{
              width: 22, height: 22, borderRadius: "50%",
              background: "rgba(28,35,51,0.08)",
              border: "none", cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "center",
              color: "var(--ink-2)",
            }}
          >
            <CloseIcon size={10} />
          </button>
        )}
      </div>
      {open && query.trim() && (
        <div style={{ marginTop: 6 }}>
          <SuggestionList items={results} onPick={handlePick} />
        </div>
      )}
    </div>
  );
};

export default OmniboxSearch;
