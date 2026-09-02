import React, { useState, useEffect } from "react";
import { useDarkMode } from "../utils/theme";
import { FOCUS_REGIONS } from "../data/focusRegions";
import { autocomplete, getDetails } from "../services/googlePlaces";
import { track } from "../analytics/posthog";

const MAX_CITIES = 3;

export default function DestinationFocus({ destName, scope, curatedId, countryBias, onPick, onSkip }) {
  const { dark } = useDarkMode();
  const P = dark
    ? { ink: "#F4F5F7", ink2: "#B9BEC7", line: "#2A2E37", surface: "#1C1F26", card: "#15171C", accent: "#E0533F" }
    : { ink: "#1E1E24", ink2: "#6B7280", line: "#E7E8EC", surface: "#F6F6F4", card: "#FFFFFF", accent: "#E0533F" };

  const regions = (scope === "country" && curatedId && FOCUS_REGIONS[curatedId]) || null;
  const [mode, setMode] = useState(regions ? "regions" : "cities"); // regions | cities
  const [q, setQ] = useState("");
  const [preds, setPreds] = useState([]);
  const [picked, setPicked] = useState([]); // { name, placeId }
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    track("ai_focus_shown", { scope, curated: !!curatedId });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const search = async (val) => {
    setQ(val);
    if (val.trim().length < 2) { setPreds([]); return; }
    try {
      const r = await autocomplete(val.trim(), { types: ["(cities)"], ...(countryBias ? { bias: countryBias } : {}) });
      setPreds(r.slice(0, 6));
    } catch { setPreds([]); }
  };
  const addCity = async (p) => {
    if (picked.length >= MAX_CITIES || picked.some((x) => x.placeId === p.placeId)) return;
    let name = p.primary;
    try { const d = await getDetails(p.placeId); if (d && d.name) name = d.name; } catch { /* keep p.primary */ }
    setPicked((prev) => [...prev, { name, placeId: p.placeId }]);
    setQ(""); setPreds([]);
  };
  const removeCity = (id) => setPicked((prev) => prev.filter((x) => x.placeId !== id));
  const confirmCities = async () => {
    if (!picked.length) return;
    setBusy(true);
    const cities = picked.map((x) => x.name);
    const label = cities.join(" · ");
    track("ai_focus_chosen", { kind: "cities", label, cityCount: picked.length });
    onPick({ kind: "cities", cities, label });
  };

  const chooseRegion = (r) => {
    track("ai_focus_chosen", { kind: "region", label: r.label, cityCount: r.cities.length });
    onPick({ kind: "region", cities: r.cities.map((c) => c.en), label: r.label });
  };
  const skip = () => {
    track("ai_focus_chosen", { kind: "skip" });
    onSkip();
  };

  const title = scope === "country"
    ? `${destName} גדולה — על איזה אזור לכוון?`
    : `${destName} — אילו ערים לכלול?`;

  return (
    <div dir="rtl" style={{ fontFamily: "inherit" }}>
      <div style={{ fontSize: 15, fontWeight: 800, color: P.ink, marginBottom: 4 }}>{title}</div>
      <div style={{ fontSize: 12.5, color: P.ink2, marginBottom: 14 }}>
        זה עוזר ל-AI לבנות מסלול הגיוני במקום לפזר את הימים על כל היעד.
      </div>

      {mode === "regions" && regions && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {regions.map((r) => (
            <button key={r.id}
              onClick={() => chooseRegion(r)}
              style={{ textAlign: "start", minHeight: 56, padding: "10px 14px", borderRadius: 12, border: `1px solid ${P.line}`, background: P.card, color: P.ink, cursor: "pointer", fontFamily: "inherit" }}>
              <div style={{ fontSize: 14, fontWeight: 800 }}>{r.label}</div>
              <div style={{ fontSize: 12, color: P.ink2, marginTop: 2 }}>{r.blurb} · {r.cities.map((c) => c.he).join(", ")}</div>
            </button>
          ))}
          <button onClick={() => setMode("cities")}
            style={{ minHeight: 44, borderRadius: 12, border: `1px dashed ${P.line}`, background: "transparent", color: P.ink2, fontSize: 13, fontWeight: 800, cursor: "pointer", fontFamily: "inherit" }}>
            אזור אחר / בחר ערים
          </button>
        </div>
      )}

      {mode === "cities" && (
        <div>
          {picked.length > 0 && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 8 }}>
              {picked.map((c) => (
                <span key={c.placeId} style={{ display: "inline-flex", alignItems: "center", gap: 6, height: 32, padding: "0 10px", borderRadius: 999, background: P.surface, color: P.ink, fontSize: 12.5, fontWeight: 800 }}>
                  {c.name}
                  <button onClick={() => removeCity(c.placeId)} aria-label={`הסר ${c.name}`}
                    style={{ border: "none", background: "transparent", color: P.ink2, cursor: "pointer", fontSize: 13, lineHeight: 1 }}>✕</button>
                </span>
              ))}
            </div>
          )}
          {picked.length < MAX_CITIES && (
            <>
              <input value={q} onChange={(e) => search(e.target.value)} placeholder="חפשו עיר…"
                style={{ width: "100%", boxSizing: "border-box", height: 44, borderRadius: 12, border: `1px solid ${P.line}`, background: P.surface, color: P.ink, padding: "0 14px", fontSize: 14, fontFamily: "inherit", direction: "rtl", textAlign: "right" }} />
              {preds.length > 0 && (
                <ul style={{ listStyle: "none", margin: "6px 0 0", padding: 0, border: `1px solid ${P.line}`, borderRadius: 12, overflow: "hidden" }}>
                  {preds.map((p) => (
                    <li key={p.placeId} onClick={() => addCity(p)}
                      style={{ padding: "10px 14px", cursor: "pointer", fontSize: 13.5, color: P.ink, borderBottom: `1px solid ${P.line}` }}>
                      {p.primary}{p.secondary ? <span style={{ color: P.ink2 }}> · {p.secondary}</span> : null}
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
          <button onClick={confirmCities} disabled={!picked.length || busy}
            style={{ marginTop: 12, width: "100%", minHeight: 48, borderRadius: 12, border: "none", background: picked.length ? P.accent : P.line, color: "#fff", fontSize: 14, fontWeight: 800, cursor: picked.length ? "pointer" : "default", fontFamily: "inherit" }}>
            המשך{picked.length ? ` (${picked.length})` : ""}
          </button>
        </div>
      )}

      <button onClick={skip}
        style={{ marginTop: 10, width: "100%", minHeight: 44, borderRadius: 12, border: "none", background: "transparent", color: P.ink2, fontSize: 13, fontWeight: 800, cursor: "pointer", fontFamily: "inherit" }}>
        תכנן לי — לא משנה לי
      </button>
    </div>
  );
}
