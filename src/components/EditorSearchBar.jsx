import React, { useEffect, useRef, useState } from "react";
import { isPlacesEnabled, autocomplete, getDetails } from "../services/googlePlaces";
import { classifyLocation, ratingToBadge, CATEGORY_META } from "../utils/classify";

/* ══════════════════════════════════════════════════════════════
   EditorSearchBar — persistent search on top of the editor map.

   Search a place → pick a result → it's added to the active day
   ("add from the map to my build"). Powered by Google Places when
   REACT_APP_GOOGLE_MAPS_API_KEY is set: a pick fetches details,
   classifies the category, and builds a stop with coordinates +
   rating. Without a key it falls back to a free-text quick-add
   (no coordinates — the user can pin it afterward).

   Props:
     onAddStop(stop)  — commit a new stop to the active day
     activeDay        — number, shown on the add affordance
   ══════════════════════════════════════════════════════════════ */

const T = {
  ink: "#0D0F11", ink2: "#2A3036", ink3: "#6B7178", ink4: "#A4AAB1",
  line: "rgba(20,20,20,0.10)", surface: "#F6F6F4", accent: "#E0533F",
  font: "'Noto Sans Hebrew','Inter','Noto Sans JP',system-ui,sans-serif",
};

const EditorSearchBar = ({ onAddStop, activeDay }) => {
  const placesOn = isPlacesEnabled();
  const [query, setQuery] = useState("");
  const [preds, setPreds] = useState([]);
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);
  const debRef = useRef(null);
  const wrapRef = useRef(null);

  /* Debounced autocomplete (Places only). */
  useEffect(() => {
    if (!placesOn) return;
    if (debRef.current) clearTimeout(debRef.current);
    if (query.trim().length < 2) { setPreds([]); return; }
    setBusy(true);
    debRef.current = setTimeout(async () => {
      const res = await autocomplete(query);
      setPreds(res); setBusy(false); setOpen(true);
    }, 250);
    return () => debRef.current && clearTimeout(debRef.current);
  }, [query, placesOn]);

  /* Close on outside click. */
  useEffect(() => {
    const onDown = (e) => { if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);

  const addFromPlace = async (p) => {
    setOpen(false); setQuery(""); setPreds([]);
    const d = await getDetails(p.placeId);
    if (!d) return;
    const { category, he } = classifyLocation(d.types);
    onAddStop({
      name: d.name || p.primary,
      nameHe: d.name || p.primary,
      category: category === "unknown" ? CATEGORY_META.attraction.he : he,
      rating: ratingToBadge(d.rating) || undefined,
      coordinates: d.lat != null && d.lng != null ? { lng: d.lng, lat: d.lat } : null,
    });
  };

  const addFreeText = () => {
    const q = query.trim();
    if (!q) return;
    setOpen(false); setQuery(""); setPreds([]);
    onAddStop({ name: q, nameHe: q, category: CATEGORY_META.attraction.he, coordinates: null });
  };

  return (
    <div ref={wrapRef} dir="rtl" style={{ position: "absolute", top: 64, insetInlineStart: 16, insetInlineEnd: 16, zIndex: 35, fontFamily: T.font }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, height: 48, padding: "0 14px", borderRadius: 999, background: "#fff", boxShadow: "0 4px 20px rgba(0,0,0,0.14)", border: `1px solid ${T.line}` }}>
        <span aria-hidden>🔍</span>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => setOpen(true)}
          onKeyDown={(e) => { if (e.key === "Enter") (placesOn && preds[0] ? addFromPlace(preds[0]) : addFreeText()); }}
          placeholder="חיפוש מקום והוספה למסלול…"
          style={{ flex: 1, border: "none", outline: "none", background: "transparent", fontSize: 16, fontFamily: "inherit", direction: "rtl", textAlign: "right", color: T.ink }}
        />
        {busy && <span style={{ fontSize: 11, color: T.ink4 }}>מחפש…</span>}
        {query && !busy && (
          <button onClick={() => { setQuery(""); setPreds([]); }} style={{ width: 24, height: 24, borderRadius: "50%", border: "none", background: T.surface, cursor: "pointer", fontSize: 12, fontFamily: "inherit", color: T.ink2 }}>✕</button>
        )}
      </div>

      {open && query.trim().length >= 2 && (
        <div style={{ marginTop: 6, background: "#fff", border: `1px solid ${T.line}`, borderRadius: 16, boxShadow: "0 16px 40px rgba(0,0,0,0.16)", overflow: "hidden" }}>
          {placesOn ? (
            preds.length > 0 ? (
              preds.map((p) => (
                <button key={p.placeId} onClick={() => addFromPlace(p)}
                  style={{ display: "flex", alignItems: "center", gap: 10, width: "100%", textAlign: "right", padding: "11px 14px", border: "none", borderBottom: `1px solid ${T.line}`, background: "transparent", cursor: "pointer", fontFamily: "inherit" }}>
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ display: "block", fontSize: 14, fontWeight: 700, color: T.ink }}>{p.primary}</span>
                    {p.secondary && <span style={{ display: "block", fontSize: 12, color: T.ink3 }}>{p.secondary}</span>}
                  </span>
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
