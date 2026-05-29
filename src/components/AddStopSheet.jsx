import React, { useEffect, useRef, useState } from "react";
import { QUICK_PICKS, CATEGORY_META, classifyLocation, ratingToBadge } from "../utils/classify";
import { isPlacesEnabled, autocomplete, getDetails } from "../services/googlePlaces";

/* ══════════════════════════════════════════════════════════════
   AddStopSheet — manual add-stop dialog (no Google key path).

   Lets the user name a stop, pick a category (the 4 quick-pick
   pills from spec §5), and attach coordinates either by typing a
   label after dropping a map pin (pinning flow handled by parent)
   or accepting the pending picked coordinate. A Google Places
   search field is shown as a disabled stub with a note.

   Props:
     pendingCoord  {lng,lat}|null  — coordinate captured by a map pin
     onStartPin    ()              — switch parent into pinning mode
     onAdd         (stop)          — commit the new stop
     onClose       ()
   ══════════════════════════════════════════════════════════════ */
const AddStopSheet = ({ pendingCoord, onStartPin, onAdd, onClose }) => {
  const [name, setName] = useState("");
  const [cat, setCat] = useState("attraction");

  /* Google Places live search (only when an API key is configured). */
  const placesOn = isPlacesEnabled();
  const [gQuery, setGQuery] = useState("");
  const [preds, setPreds] = useState([]);
  const [searching, setSearching] = useState(false);
  const [placeCoord, setPlaceCoord] = useState(null);
  const [placeRating, setPlaceRating] = useState(null);
  const debRef = useRef(null);

  /* Debounced autocomplete as the user types. */
  useEffect(() => {
    if (!placesOn) return;
    if (debRef.current) clearTimeout(debRef.current);
    if (gQuery.trim().length < 2) { setPreds([]); return; }
    setSearching(true);
    debRef.current = setTimeout(async () => {
      const res = await autocomplete(gQuery);
      setPreds(res);
      setSearching(false);
    }, 250);
    return () => debRef.current && clearTimeout(debRef.current);
  }, [gQuery, placesOn]);

  /* Pick a prediction → fetch details → classify + prefill. */
  const pickPrediction = async (p) => {
    setPreds([]);
    setGQuery(p.primary);
    const d = await getDetails(p.placeId);
    if (!d) return;
    const { category } = classifyLocation(d.types);
    setName(d.name || p.primary);
    setCat(category === "unknown" ? "attraction" : category);
    if (d.lat != null && d.lng != null) setPlaceCoord({ lng: d.lng, lat: d.lat });
    setPlaceRating(ratingToBadge(d.rating));
  };

  const coord = placeCoord || pendingCoord || null;
  const canAdd = name.trim().length > 0;

  const commit = () => {
    if (!canAdd) return;
    const meta = CATEGORY_META[cat];
    onAdd({
      name: name.trim(),
      nameHe: name.trim(),
      category: meta.he,
      rating: placeRating || undefined,
      coordinates: coord,
      _customPin: !!coord && !placeCoord,
    });
  };

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 60, display: "flex", alignItems: "flex-end" }}>
      <div onClick={onClose} className="tp-fade" style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.32)" }} />
      <div dir="rtl" className="tp-sheet-up" style={{
        position: "relative", width: "100%", background: "#fff",
        borderTopLeftRadius: 22, borderTopRightRadius: 22, padding: "16px 18px 28px",
        boxShadow: "0 -24px 60px rgba(0,0,0,0.18)", maxWidth: 720, margin: "0 auto",
        fontFamily: "'Noto Sans Hebrew','Inter',sans-serif",
      }}>
        <div style={{ display: "flex", justifyContent: "center", marginBottom: 12 }}>
          <div style={{ width: 44, height: 5, borderRadius: 999, background: "rgba(20,20,20,0.18)" }} />
        </div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
          <div style={{ fontSize: 17, fontWeight: 800, color: "#0D0F11" }}>הוספת תחנה</div>
          <button onClick={onClose} style={{ width: 32, height: 32, borderRadius: "50%", border: "none", background: "#F6F6F4", cursor: "pointer", fontSize: 16, fontFamily: "inherit" }}>✕</button>
        </div>

        {/* Google Places live search (key present) OR disabled stub */}
        {placesOn ? (
          <div style={{ position: "relative", marginBottom: 6 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "11px 14px", borderRadius: 16, background: "#F6F6F4", border: "1px solid rgba(20,20,20,0.10)" }}>
              <span aria-hidden>🔍</span>
              <input value={gQuery} onChange={(e) => setGQuery(e.target.value)} placeholder="חיפוש ב־Google Maps"
                style={{ flex: 1, border: "none", background: "transparent", fontSize: 16, fontFamily: "inherit", direction: "rtl", textAlign: "right" }} />
              {searching && <span style={{ fontSize: 11, color: "#A4AAB1" }}>מחפש…</span>}
            </div>
            {preds.length > 0 && (
              <ul style={{ listStyle: "none", margin: "6px 0 0", padding: 0, background: "#fff", border: "1px solid rgba(20,20,20,0.10)", borderRadius: 14, boxShadow: "0 12px 32px rgba(0,0,0,0.12)", maxHeight: 240, overflowY: "auto", position: "absolute", left: 0, right: 0, zIndex: 5 }}>
                {preds.map((p) => (
                  <li key={p.placeId} onClick={() => pickPrediction(p)}
                    style={{ padding: "10px 14px", cursor: "pointer", borderBottom: "1px solid rgba(20,20,20,0.05)" }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: "#0D0F11" }}>{p.primary}</div>
                    {p.secondary && <div style={{ fontSize: 12, color: "#6B7178", marginTop: 1 }}>{p.secondary}</div>}
                  </li>
                ))}
              </ul>
            )}
          </div>
        ) : (
          <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "11px 14px", borderRadius: 16, background: "#F6F6F4", border: "1px solid rgba(20,20,20,0.06)", marginBottom: 6, opacity: 0.7 }}>
            <span aria-hidden>🔍</span>
            <input disabled placeholder="חיפוש ב־Google (דורש מפתח API)"
              style={{ flex: 1, border: "none", background: "transparent", fontSize: 13.5, fontFamily: "inherit", direction: "rtl", textAlign: "right" }} />
          </div>
        )}
        <div style={{ fontSize: 11, color: "#A4AAB1", marginBottom: 16 }}>או הוסיפו ידנית:</div>

        {/* Manual name */}
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="שם המקום"
          autoFocus
          style={{ width: "100%", height: 48, borderRadius: 16, border: "1px solid rgba(20,20,20,0.12)", padding: "0 14px", fontSize: 16, fontFamily: "inherit", direction: "rtl", textAlign: "right", boxSizing: "border-box", marginBottom: 14 }}
        />

        {/* Category quick-picks */}
        <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
          {QUICK_PICKS.map((key) => {
            const m = CATEGORY_META[key];
            const on = cat === key;
            return (
              <button key={key} onClick={() => setCat(key)}
                style={{
                  display: "inline-flex", alignItems: "center", gap: 6,
                  padding: "8px 14px", borderRadius: 999, cursor: "pointer", fontFamily: "inherit",
                  border: `1px solid ${on ? "#0D0F11" : "rgba(20,20,20,0.12)"}`,
                  background: on ? "#0D0F11" : "#fff", color: on ? "#fff" : "#2A3036",
                  fontSize: 13, fontWeight: 600,
                }}>
                <span aria-hidden>{m.emoji}</span>{m.he}
              </button>
            );
          })}
        </div>

        {/* Pin / location status */}
        <button onClick={onStartPin}
          style={{ width: "100%", height: 46, borderRadius: 14, border: "1px dashed rgba(20,20,20,0.2)", background: coord ? "#E4EFE5" : "transparent", color: "#2A3036", fontSize: 13.5, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", marginBottom: 16 }}>
          {coord
            ? `📍 ${placeCoord ? "מיקום מ־Google" : "מיקום נבחר"} (${coord.lat.toFixed(4)}, ${coord.lng.toFixed(4)})`
            : "נעצו סיכה ידנית על המפה"}
        </button>

        {/* Commit */}
        <button onClick={commit} disabled={!canAdd}
          style={{ width: "100%", height: 52, borderRadius: 999, border: "none", background: canAdd ? "#0D0F11" : "#D1CCC5", color: "#fff", fontSize: 15.5, fontWeight: 700, cursor: canAdd ? "pointer" : "default", fontFamily: "inherit" }}>
          הוספה למסלול
        </button>
      </div>
    </div>
  );
};

export default AddStopSheet;
