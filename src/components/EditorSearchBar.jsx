import React, { useEffect, useRef, useState } from "react";
import { isSearchEnabled, isPlacesEnabled, autocomplete, textSearch, getDetails, RateLimitError } from "../services/googlePlaces";
import { classifyLocation, ratingToBadge, CATEGORY_META } from "../utils/classify";
import Icon from "./Icon";

/* ══════════════════════════════════════════════════════════════
   EditorSearchBar — persistent search on top of the editor map.

   Search a place → pick a result → it's added to the active day
   ("add from the map to my build"). Powered by Google Places when
   REACT_APP_GOOGLE_MAPS_API_KEY is set: a pick fetches details,
   classifies the category, and builds a stop with coordinates +
   rating. Without a key it falls back to a free-text quick-add
   (no coordinates — the user can pin it afterward).

   Sprint 15.6 — Map Discovery Invariant: a search pick must NEVER
   commit a stop directly. When `onPreview` is supplied the pick only
   hands the live Place details up to the editor, which flies the map,
   drops the pulsing pin, and opens the PlaceInfoCard — the stop is
   committed solely from that card's "הוספה לטיול שלי" CTA. Pressing
   Enter is intentionally inert so a raw, unverified query can never
   become a stop.

   Props:
     onAddStop(stop)  — legacy direct commit (used only if no onPreview)
     onPreview(d)     — hand live Place details to the editor preview flow
     activeDay        — number, shown on the add affordance
   ══════════════════════════════════════════════════════════════ */

const T = {
  ink: "#0D0F11", ink2: "#2A3036", ink3: "#6B7178", ink4: "#A4AAB1",
  line: "rgba(20,20,20,0.10)", surface: "#F6F6F4", accent: "#E0533F",
  font: "'Noto Sans Hebrew','Inter','Noto Sans JP',system-ui,sans-serif",
};

/* Recent picks — a short list the field offers before you type. Keyed by
   placeId so tapping one re-runs the exact same details lookup as a fresh
   result. Live-key only (no placeId without it). */
const RECENTS_KEY = "tp_recent_searches";
const RECENTS_MAX = 6;
const readRecents = () => {
  try {
    const raw = localStorage.getItem(RECENTS_KEY);
    const list = raw ? JSON.parse(raw) : [];
    return Array.isArray(list) ? list.filter((r) => r && r.placeId) : [];
  } catch { return []; }
};
const pushRecent = (r) => {
  if (!r || !r.placeId) return readRecents();
  try {
    const next = [{ placeId: r.placeId, primary: r.primary || r.name || "", secondary: r.secondary || "" },
      ...readRecents().filter((x) => x.placeId !== r.placeId)].slice(0, RECENTS_MAX);
    localStorage.setItem(RECENTS_KEY, JSON.stringify(next));
    return next;
  } catch { return readRecents(); }
};

const EditorSearchBar = ({ onAddStop, onPreview, activeDay, getBias, onFocusInput, onResults, floatResults = false, placeholder }) => {
  const placesOn = isSearchEnabled();
  /* Live key → Text Search (results carry coordinates, so they can be plotted
     on the map). No key → autocomplete/sim (list only, no map markers). */
  const liveSearch = isPlacesEnabled();
  /* Keep the latest onResults in a ref so the debounced effect isn't re-created
     on every render (which would restart the timer). */
  const onResultsRef = useRef(onResults);
  onResultsRef.current = onResults;
  const emitResults = (list) => { if (onResultsRef.current) onResultsRef.current(list || []); };
  const [query, setQuery] = useState("");
  const [preds, setPreds] = useState([]);
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);
  const [rlError, setRlError] = useState(""); // rate-limit notification
  const [recents, setRecents] = useState([]);
  useEffect(() => { setRecents(readRecents()); }, []);
  const debRef = useRef(null);
  const wrapRef = useRef(null);
  /* Sprint 47 #3 — hold the latest bias getter in a ref so the debounced
     autocomplete effect can read it without listing it as a dependency. */
  const biasRef = useRef(getBias);
  biasRef.current = getBias;

  /* Debounced search (live Text Search with coords, or autocomplete/sim). */
  useEffect(() => {
    if (!placesOn) return;
    if (debRef.current) clearTimeout(debRef.current);
    if (query.trim().length < 2) { setPreds([]); setRlError(""); emitResults([]); return; }
    setBusy(true);
    debRef.current = setTimeout(async () => {
      try {
        /* Bias to the visible map viewport FIRST, then the trip country. */
        const bias = typeof biasRef.current === "function" ? biasRef.current() : null;
        let res;
        if (liveSearch) {
          res = await textSearch(query, bias ? { bias } : {});
          /* Fallback: if Text Search yields nothing (e.g. the legacy Places API
             isn't enabled for the key), use autocomplete predictions so search
             still works — those have no coordinates, so no map markers. */
          if (!res || res.length === 0) res = await autocomplete(query, bias ? { bias } : {});
        } else {
          res = await autocomplete(query, bias ? { bias } : {});
        }
        setPreds(res); setRlError(""); setBusy(false); setOpen(true);
        /* Publish results (those with coordinates) so the editor can drop map
           markers, letting the user see where each hit is before picking. */
        emitResults((res || []).filter((r) => Number.isFinite(r.lat) && Number.isFinite(r.lng)));
      } catch (err) {
        setBusy(false); setPreds([]); setOpen(true); emitResults([]);
        setRlError(err instanceof RateLimitError ? err.message : "החיפוש נכשל, נסו שוב");
      }
    }, 350);
    return () => debRef.current && clearTimeout(debRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, placesOn, liveSearch]);

  /* Clear the map markers when the bar unmounts. */
  useEffect(() => () => emitResults([]), []); // eslint-disable-line react-hooks/exhaustive-deps

  /* Close on outside click. */
  useEffect(() => {
    const onDown = (e) => { if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);

  /* Pick a prediction → fetch live details.
     • Map Discovery Invariant (Sprint 15.6): when onPreview is set we
       hand the raw details to the editor preview flow (fly + pin +
       PlaceInfoCard) and DO NOT commit a stop here.
     • Legacy fallback (no onPreview): classify + commit directly. */
  const addFromPlace = async (p) => {
    setOpen(false); setQuery(""); setPreds([]); emitResults([]);
    setRecents(pushRecent(p));
    const d = await getDetails(p.placeId);
    if (!d) return;
    if (onPreview) { onPreview(d); return; }
    const { category, he } = classifyLocation(d.types);
    onAddStop({
      name: d.name || p.primary,
      nameHe: d.name || p.primary,
      category: category === "unknown" ? CATEGORY_META.attraction.he : he,
      rating: ratingToBadge(d.rating) || undefined,
      coordinates: d.lat != null && d.lng != null ? { lng: d.lng, lat: d.lat } : null,
    });
  };

  /* Legacy free-text quick-add — only reachable when running without a
     live key AND without the preview flow (onPreview unset). Never wired
     to Enter, so a bare query can never auto-commit a stop. */
  const addFreeText = () => {
    if (onPreview) return;
    const q = query.trim();
    if (!q) return;
    setOpen(false); setQuery(""); setPreds([]);
    onAddStop({ name: q, nameHe: q, category: CATEGORY_META.attraction.he, coordinates: null });
  };

  return (
    /* Sprint 45 #6 — the bar is now an INLINE flex child of a unified top row
       (Home + Search) owned by the editor; it fills the remaining width. The
       results dropdown stays anchored relative to this wrapper. */
    <div ref={wrapRef} dir="rtl" style={{ position: "relative", flex: 1, minWidth: 0, fontFamily: T.font }}>
      {/* Sprint 56 #1 — flat rigid search block: rounded-md, solid border, no
          shadow depth; the magnifier is a monochrome vector. */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, height: 48, padding: "0 12px", borderRadius: 8, background: "#fff", boxShadow: "none", border: "1.5px solid #E4E4E8" }}>
        <span aria-hidden style={{ color: T.ink3, display: "inline-flex" }}><Icon name="search" size={17} strokeWidth={2} /></span>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => { setOpen(true); if (onFocusInput) onFocusInput(); }}
          onKeyDown={(e) => {
            /* Map Discovery Invariant: Enter must NOT commit a stop.
               Pick a place from the list (which opens the preview card)
               or do nothing — never auto-add the raw typed text. */
            if (e.key === "Enter") {
              e.preventDefault();
              if (placesOn && preds[0]) addFromPlace(preds[0]);
            }
          }}
          placeholder={placeholder || "חיפוש מקום והוספה למסלול…"}
          style={{ flex: 1, border: "none", outline: "none", background: "transparent", fontSize: 16, fontFamily: "inherit", direction: "rtl", textAlign: "right", color: T.ink }}
        />
        {busy && <span style={{ fontSize: 11, color: T.ink4 }}>מחפש…</span>}
        {query && !busy && (
          <button onClick={() => { setQuery(""); setPreds([]); emitResults([]); }} style={{ width: 24, height: 24, borderRadius: "50%", border: "none", background: T.surface, cursor: "pointer", fontSize: 12, fontFamily: "inherit", color: T.ink2 }}>✕</button>
        )}
      </div>

      {open && query.trim().length < 2 && placesOn && recents.length > 0 && (
        <div style={{
          ...(floatResults
            ? { position: "absolute", top: "calc(100% + 6px)", insetInlineStart: 0, insetInlineEnd: 0, zIndex: 400 }
            : { marginTop: 6 }),
          background: "#fff", border: `1px solid ${T.line}`, borderRadius: 16, boxShadow: "0 16px 40px rgba(0,0,0,0.16)", overflow: "hidden",
        }}>
          <div style={{ padding: "10px 14px 4px", fontSize: 11.5, fontWeight: 800, color: T.ink3, letterSpacing: "0.02em" }}>חיפושים אחרונים</div>
          {recents.map((r) => (
            <button key={r.placeId} onClick={() => addFromPlace(r)}
              style={{ display: "flex", alignItems: "center", gap: 10, width: "100%", textAlign: "right", padding: "11px 14px", border: "none", borderBottom: `1px solid ${T.line}`, background: "transparent", cursor: "pointer", fontFamily: "inherit" }}>
              <span aria-hidden style={{ flexShrink: 0, width: 22, height: 22, borderRadius: "50%", background: T.surface, color: T.ink3, display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 12 }}>↻</span>
              <span style={{ flex: 1, minWidth: 0 }}>
                <span style={{ display: "block", fontSize: 14, fontWeight: 700, color: T.ink, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{r.primary}</span>
                {r.secondary && <span style={{ display: "block", fontSize: 12, color: T.ink3, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{r.secondary}</span>}
              </span>
              <span style={{ fontSize: 12, fontWeight: 700, color: T.accent, whiteSpace: "nowrap" }}>＋ יום {activeDay}</span>
            </button>
          ))}
        </div>
      )}

      {open && query.trim().length >= 2 && (
        <div style={{
          ...(floatResults
            ? { position: "absolute", top: "calc(100% + 6px)", insetInlineStart: 0, insetInlineEnd: 0, zIndex: 400 }
            : { marginTop: 6 }),
          background: "#fff", border: `1px solid ${T.line}`, borderRadius: 16, boxShadow: "0 16px 40px rgba(0,0,0,0.16)", overflow: "hidden",
        }}>
          {rlError ? (
            <div style={{ padding: "12px 14px", fontSize: 13, fontWeight: 700, color: T.accent, display: "flex", alignItems: "center", gap: 8 }}>
              <span aria-hidden>⏳</span>{rlError}
            </div>
          ) : placesOn ? (
            preds.length > 0 ? (
              preds.map((p, i) => (
                <button key={p.placeId} onClick={() => addFromPlace(p)}
                  style={{ display: "flex", alignItems: "center", gap: 10, width: "100%", textAlign: "right", padding: "11px 14px", borderTop: "none", borderInlineStart: "none", borderInlineEnd: "none", borderBottom: `1px solid ${T.line}`, background: "transparent", cursor: "pointer", fontFamily: "inherit" }}>
                  {/* Numbered chip — matches the numbered marker on the map so the
                     user can tie each result to its location before picking. */}
                  {Number.isFinite(p.lat) && (
                    <span aria-hidden style={{ flexShrink: 0, width: 22, height: 22, borderRadius: "50%", background: T.accent, color: "#fff", fontSize: 11, fontWeight: 800, display: "inline-flex", alignItems: "center", justifyContent: "center" }}>{i + 1}</span>
                  )}
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ display: "block", fontSize: 14, fontWeight: 700, color: T.ink }}>{p.primary}</span>
                    {p.secondary && <span style={{ display: "block", fontSize: 12, color: T.ink3, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{p.secondary}</span>}
                  </span>
                  {Number.isFinite(p.rating) && <span style={{ fontSize: 12, fontWeight: 700, color: T.ink2, whiteSpace: "nowrap" }}>★ {p.rating}</span>}
                  <span style={{ fontSize: 12, fontWeight: 700, color: T.accent, whiteSpace: "nowrap" }}>＋ יום {activeDay}</span>
                </button>
              ))
            ) : (
              !busy && <div style={{ padding: "12px 14px", fontSize: 13, color: T.ink3 }}>אין תוצאות</div>
            )
          ) : (
            /* No API key: offer a free-text quick-add */
            <button onClick={addFreeText}
              style={{ display: "flex", alignItems: "center", gap: 10, width: "100%", textAlign: "right", padding: "12px 14px", border: "none", background: "transparent", cursor: "pointer", fontFamily: "inherit" }}>
              <span style={{ flex: 1, fontSize: 14, fontWeight: 700, color: T.ink }}>＋ הוסיפו "{query.trim()}" ליום {activeDay}</span>
              <span style={{ fontSize: 11, color: T.ink4 }}>נעצו מיקום אחר כך</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
};

export default EditorSearchBar;
