import React, { useEffect, useRef, useState } from "react";
import { QUICK_PICKS, CATEGORY_META, classifyLocation, ratingToBadge } from "../utils/classify";
import { isSearchEnabled, autocomplete, getDetails, RateLimitError } from "../services/googlePlaces";
import Icon from "./Icon";

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
     onPreview     (details)       — optional; when set, a prediction
                                     click calls this instead of filling
                                     the inline form (Sprint 7 preview flow)
   ══════════════════════════════════════════════════════════════ */
const AddStopSheet = ({ pendingCoord, onStartPin, onAdd, onClose, onPreview, onAddToDays, days = [], activeDay }) => {
  const [name, setName] = useState("");
  const [cat, setCat] = useState("attraction");
  /* Sprint 42 #7 — a lodging stop can be added to MANY days at once. When the
     🏨 category is selected we surface a multi-day checkbox list (default: the
     current day) and clone the stop into every checked day. */
  const [lodgingDays, setLodgingDays] = useState(() => (activeDay != null ? [activeDay] : []));
  const isLodging = cat === "hotel";
  const toggleLodgingDay = (dn) =>
    setLodgingDays((prev) => (prev.includes(dn) ? prev.filter((x) => x !== dn) : [...prev, dn]));
  /* Sprint 44 #8 — a "מיום … עד יום …" range: pick a start/end day and every
     day in between is selected at once (still fine-tunable via the checklist). */
  const dayNums = days.map((d) => d.day);
  const [rangeFrom, setRangeFrom] = useState(() => (activeDay != null ? activeDay : (dayNums[0] || 1)));
  const [rangeTo, setRangeTo] = useState(() => (activeDay != null ? activeDay : (dayNums[0] || 1)));
  const applyRange = (from, to) => {
    const lo = Math.min(from, to), hi = Math.max(from, to);
    setRangeFrom(from); setRangeTo(to);
    setLodgingDays(dayNums.filter((dn) => dn >= lo && dn <= hi));
  };

  /* Place search — live Google Places when keyed + under budget,
     otherwise the geometric simulation fallback. */
  const placesOn = isSearchEnabled();
  const [gQuery, setGQuery] = useState("");
  const [preds, setPreds] = useState([]);
  const [searching, setSearching] = useState(false);
  const [rlError, setRlError] = useState(""); // rate-limit notification
  const [placeCoord, setPlaceCoord] = useState(null);
  const [placeRating, setPlaceRating] = useState(null);
  const debRef = useRef(null);

  /* Debounced autocomplete as the user types. */
  useEffect(() => {
    if (!placesOn) return;
    if (debRef.current) clearTimeout(debRef.current);
    if (gQuery.trim().length < 2) { setPreds([]); setRlError(""); return; }
    setSearching(true);
    debRef.current = setTimeout(async () => {
      try {
        const res = await autocomplete(gQuery);
        setPreds(res); setRlError(""); setSearching(false);
      } catch (err) {
        setSearching(false); setPreds([]);
        setRlError(err instanceof RateLimitError ? err.message : "החיפוש נכשל, נסו שוב");
      }
    }, 250);
    return () => debRef.current && clearTimeout(debRef.current);
  }, [gQuery, placesOn]);

  /* Pick a prediction → fetch details.
     • When onPreview is provided (Sprint 7): call it with the raw
       details object — the parent minimises the sheet, flies the map,
       and shows the PlaceInfoCard.
     • Otherwise: classify + prefill the inline manual form as before. */
  const pickPrediction = async (p) => {
    setPreds([]);
    setGQuery(p.primary);
    const d = await getDetails(p.placeId);
    if (!d) return;

    if (onPreview) {
      onPreview(d);   // hand off to EditorView preview flow
      return;
    }

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
    const stop = {
      name: name.trim(),
      nameHe: name.trim(),
      category: meta.he,
      rating: placeRating || undefined,
      coordinates: coord,
      _customPin: !!coord && !placeCoord,
    };
    /* Sprint 42 #7 — lodging can fan out to every selected day. */
    if (isLodging && onAddToDays) {
      onAddToDays(stop, lodgingDays.length ? lodgingDays : (activeDay != null ? [activeDay] : []));
      return;
    }
    onAdd(stop);
  };
  const commitDisabled = !canAdd || (isLodging && lodgingDays.length === 0);

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
          <button onClick={onClose} aria-label="סגירה" style={{ width: 32, height: 32, borderRadius: "50%", border: "none", background: "#F6F6F4", cursor: "pointer", fontFamily: "inherit", color: "#2A3036", display: "inline-flex", alignItems: "center", justifyContent: "center" }}><Icon name="x" size={14} strokeWidth={2.2} /></button>
        </div>

        {/* Google Places live search (key present) OR disabled stub */}
        {placesOn ? (
          <div style={{ position: "relative", marginBottom: 6 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "11px 14px", borderRadius: 16, background: "#F6F6F4", border: "1px solid rgba(20,20,20,0.10)" }}>
              <span aria-hidden style={{ color: "#6B7178", display: "inline-flex" }}><Icon name="search" size={16} /></span>
              <input value={gQuery} onChange={(e) => setGQuery(e.target.value)} placeholder="חיפוש ב־Google Maps"
                onKeyDown={(e) => { if (e.key === "Enter") e.preventDefault(); /* Invariant: Enter never adds an unverified stop — choose a result card */ }}
                style={{ flex: 1, border: "none", background: "transparent", fontSize: 16, fontFamily: "inherit", direction: "rtl", textAlign: "right" }} />
              {searching && <span style={{ fontSize: 11, color: "#A4AAB1" }}>מחפש…</span>}
            </div>
            {rlError && (
              <div style={{ marginTop: 6, padding: "9px 12px", borderRadius: 12, background: "#FCEEEA", color: "#B83A2B", fontSize: 12.5, fontWeight: 700, display: "flex", alignItems: "center", gap: 7 }}>
                <span aria-hidden>⏳</span>{rlError}
              </div>
            )}
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
            <span aria-hidden style={{ color: "#6B7178", display: "inline-flex" }}><Icon name="search" size={16} /></span>
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

        {/* Sprint 42 #7 — multi-day picker, shown only for a lodging stop. */}
        {isLodging && days.length > 0 && (
          <div style={{ marginBottom: 16, padding: "12px 14px", borderRadius: 16, background: "#F6F6F4", border: "1px solid rgba(20,20,20,0.08)" }}>
            <div style={{ fontSize: 13, fontWeight: 800, color: "#0D0F11", marginBottom: 2 }}>🏨 לאילו ימים להוסיף?</div>
            <div style={{ fontSize: 11.5, color: "#6B7178", marginBottom: 10 }}>המלון יתווסף כעותק עצמאי לכל יום בטווח שנבחר.</div>
            {/* Sprint 44 #8 — quick "מיום … עד יום …" range selector. */}
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
              <label style={{ flex: 1, minWidth: 0 }}>
                <span style={{ display: "block", fontSize: 10.5, fontWeight: 800, color: "#6B7178", marginBottom: 4 }}>מיום</span>
                <select value={rangeFrom} onChange={(e) => applyRange(Number(e.target.value), rangeTo)}
                  style={{ width: "100%", boxSizing: "border-box", height: 40, borderRadius: 10, border: "1px solid rgba(20,20,20,0.14)", background: "#fff", fontFamily: "inherit", fontSize: 14, padding: "0 8px", direction: "rtl" }}>
                  {days.map((d) => <option key={d.day} value={d.day}>יום {d.day}{d.cityHe || d.city ? ` · ${d.cityHe || d.city}` : ""}</option>)}
                </select>
              </label>
              <span aria-hidden style={{ color: "#A4AAB1", fontSize: 16, marginTop: 16 }}>→</span>
              <label style={{ flex: 1, minWidth: 0 }}>
                <span style={{ display: "block", fontSize: 10.5, fontWeight: 800, color: "#6B7178", marginBottom: 4 }}>עד יום</span>
                <select value={rangeTo} onChange={(e) => applyRange(rangeFrom, Number(e.target.value))}
                  style={{ width: "100%", boxSizing: "border-box", height: 40, borderRadius: 10, border: "1px solid rgba(20,20,20,0.14)", background: "#fff", fontFamily: "inherit", fontSize: 14, padding: "0 8px", direction: "rtl" }}>
                  {days.map((d) => <option key={d.day} value={d.day}>יום {d.day}{d.cityHe || d.city ? ` · ${d.cityHe || d.city}` : ""}</option>)}
                </select>
              </label>
            </div>
            <div style={{ fontSize: 10.5, fontWeight: 700, color: "#6B7178", marginBottom: 8 }}>או בחירה ידנית:</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, maxHeight: 150, overflowY: "auto" }}>
              {days.map((d) => {
                const on = lodgingDays.includes(d.day);
                return (
                  <button key={d.day} onClick={() => toggleLodgingDay(d.day)} aria-pressed={on}
                    style={{
                      display: "inline-flex", alignItems: "center", gap: 7, padding: "8px 12px", borderRadius: 12, cursor: "pointer", fontFamily: "inherit",
                      border: `1.5px solid ${on ? "#6E59C7" : "rgba(20,20,20,0.14)"}`,
                      background: on ? "rgba(110,89,199,0.10)" : "#fff", color: "#0D0F11",
                    }}>
                    <span aria-hidden style={{ width: 18, height: 18, borderRadius: 5, flexShrink: 0, border: `1.5px solid ${on ? "#6E59C7" : "rgba(20,20,20,0.3)"}`, background: on ? "#6E59C7" : "transparent", color: "#fff", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 12 }}>{on ? "✓" : ""}</span>
                    <span style={{ fontSize: 13, fontWeight: 700 }}>יום {d.day}</span>
                    {(d.cityHe || d.city) && <span style={{ fontSize: 10.5, color: "#6B7178" }}>· {d.cityHe || d.city}</span>}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Pin / location status */}
        <button onClick={onStartPin}
          style={{ width: "100%", height: 46, borderRadius: 14, border: "1px dashed rgba(20,20,20,0.2)", background: coord ? "#E4EFE5" : "transparent", color: "#2A3036", fontSize: 13.5, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", marginBottom: 16, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
          {coord ? (
            <><Icon name="pin" size={15} /> {`${placeCoord ? "מיקום מ־Google" : "מיקום נבחר"} (${coord.lat.toFixed(4)}, ${coord.lng.toFixed(4)})`}</>
          ) : "נעצו סיכה ידנית על המפה"}
        </button>

        {/* Commit */}
        <button onClick={commit} disabled={commitDisabled}
          style={{ width: "100%", height: 52, borderRadius: 999, border: "none", background: commitDisabled ? "#D1CCC5" : "#0D0F11", color: "#fff", fontSize: 15.5, fontWeight: 700, cursor: commitDisabled ? "default" : "pointer", fontFamily: "inherit" }}>
          {isLodging && lodgingDays.length > 1 ? `הוספה ל-${lodgingDays.length} ימים` : "הוספה למסלול"}
        </button>
      </div>
    </div>
  );
};

export default AddStopSheet;
