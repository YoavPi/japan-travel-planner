import React, { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { searchDestinations, allCountries } from "../utils/destinationSearch";

/* ══════════════════════════════════════════════════════════════
   DestinationSearch — the landing page's primary action (spec §4).

   It is a FIELD, not a button, because the page's single job is to
   get a destination out of the visitor. Matching is entirely local
   (see destinationSearch.js) — this component must never reach the
   network, and specifically never Google Places.

   a11y: the ARIA 1.2 combobox pattern — ↑/↓ move, Enter selects the
   active option (or the top match), Esc closes and returns focus.
   The listbox is positioned within the hero's stacking context at
   z-index 60; it is deliberately NOT portalled to <body> (the old
   portal existed only for the deleted AI modal).
   ══════════════════════════════════════════════════════════════ */

const DestinationSearch = ({ onPick, tone = "light", autoFocus = false }) => {
  const uid = useId();
  const listId = `${uid}-list`;
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const rootRef = useRef(null);
  const inputRef = useRef(null);

  /* Debounced only to avoid re-rendering the list on every keystroke —
     there is no request to debounce. */
  const [debounced, setDebounced] = useState("");
  useEffect(() => {
    const t = setTimeout(() => setDebounced(q), 120);
    return () => clearTimeout(t);
  }, [q]);

  const results = useMemo(() => searchDestinations(debounced, 6), [debounced]);
  const noMatch = debounced.trim().length > 0 && results.length === 0;
  const options = noMatch ? allCountries() : results;

  useEffect(() => { setActive(-1); }, [debounced]);

  /* Close on outside pointer. */
  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e) => { if (rootRef.current && !rootRef.current.contains(e.target)) setOpen(false); };
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, [open]);

  const choose = useCallback((opt) => {
    if (!opt) return;
    setOpen(false);
    setQ("");
    onPick?.({ dest: opt.dest, city: opt.city });
  }, [onPick]);

  const submit = (e) => {
    e.preventDefault();
    choose(active >= 0 ? options[active] : options[0]);
  };

  const onKeyDown = (e) => {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      if (!open) { setOpen(true); return; }
      const dir = e.key === "ArrowDown" ? 1 : -1;
      setActive((i) => {
        const n = options.length;
        if (!n) return -1;
        return ((i < 0 ? (dir > 0 ? -1 : 0) : i) + dir + n) % n;
      });
    } else if (e.key === "Escape") {
      if (open) { e.preventDefault(); setOpen(false); setActive(-1); inputRef.current?.focus(); }
    }
  };

  const dark = tone === "dark";
  const listOpen = open && (options.length > 0);

  return (
    <div ref={rootRef} className={`ds ${dark ? "ds-dark" : ""}`} style={{ position: "relative", zIndex: 60 }}>
      <form className="ds-field" onSubmit={submit} role="search">
        <span className="ds-icon" aria-hidden="true">
          <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3">
            <circle cx="11" cy="11" r="7" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
        </span>
        <label className="ds-sr" htmlFor={`${uid}-input`}>חיפוש יעד</label>
        <input
          id={`${uid}-input`}
          ref={inputRef}
          className="ds-input"
          type="text"
          dir="rtl"
          inputMode="search"
          enterKeyHint="go"
          autoComplete="off"
          autoFocus={autoFocus}
          placeholder="לאן נוסעים?"
          value={q}
          onChange={(e) => { setQ(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
          role="combobox"
          aria-expanded={listOpen}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={active >= 0 && options[active] ? `${uid}-opt-${active}` : undefined}
        />
        <button className="ds-go" type="submit">בואו נתחיל</button>
      </form>

      {listOpen && (
        <ul className="ds-list" id={listId} role="listbox" aria-label="הצעות יעד">
          {noMatch && (
            <li className="ds-empty" role="presentation">
              עוד לא בנינו את היעד הזה. אפשר להתחיל ממדינה קרובה ולהוסיף עצירות ידנית.
            </li>
          )}
          {options.map((o, i) => (
            <li
              key={o.id}
              id={`${uid}-opt-${i}`}
              role="option"
              aria-selected={i === active}
              className={`ds-opt ${i === active ? "is-active" : ""}`}
              onPointerDown={(e) => { e.preventDefault(); choose(o); }}
              onMouseEnter={() => setActive(i)}
            >
              <span className="ds-flag" aria-hidden="true">{o.flag}</span>
              <span className="ds-label">{o.label}</span>
              <span className="ds-sub">{o.sub}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default DestinationSearch;
