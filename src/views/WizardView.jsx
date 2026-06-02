import React, { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import tripService from "../services/tripService";
import Icon from "../components/Icon";

/* ──────────────────────────────────────────────────────────────
   WizardView — dynamic global onboarding (3 steps + summary).
     1. Destination  — global picker; captures center {lng,lat,zoom}
     2. Duration     — tactile horizontal day bar, 1–45 days
     3. City routing — map city milestones to day ranges (optional)
     → Summary       — styled breakdown + inline edit per section
   On "התחילו לבנות" → createNewTrip(dynamic payload) → editor.
   Trip-pace / companions screens removed per spec.
   ────────────────────────────────────────────────────────────── */

const T = {
  ink: "#0D0F11", ink2: "#2A3036", ink3: "#6B7178", ink4: "#A4AAB1",
  line: "rgba(20,20,20,0.08)", surface: "#F6F6F4", accent: "#E0533F",
  font: "'Noto Sans Hebrew','Inter','Noto Sans JP',system-ui,sans-serif",
};

/* Global destinations with map center + default zoom (drives the
   editor's dynamic viewport instead of the hardcoded Japan view). */
const DESTINATIONS = [
  { id: "jp", flag: "🇯🇵", name: "יפן", en: "Japan", sub: "אסיה · 4–14 ימים", center: { lng: 138.2529, lat: 36.2048, zoom: 5 }, popular: true },
  { id: "it", flag: "🇮🇹", name: "איטליה", en: "Italy", sub: "אירופה · 7–14 ימים", center: { lng: 12.5674, lat: 41.8719, zoom: 5.4 } },
  { id: "pt", flag: "🇵🇹", name: "פורטוגל", en: "Portugal", sub: "אירופה · 7–10 ימים", center: { lng: -8.2245, lat: 39.5, zoom: 6 } },
  { id: "gr", flag: "🇬🇷", name: "יוון", en: "Greece", sub: "אירופה · 5–10 ימים", center: { lng: 23.7, lat: 38.5, zoom: 5.8 } },
  { id: "th", flag: "🇹🇭", name: "תאילנד", en: "Thailand", sub: "אסיה · 10–21 ימים", center: { lng: 100.9925, lat: 15.87, zoom: 5 } },
  { id: "vn", flag: "🇻🇳", name: "וייטנאם", en: "Vietnam", sub: "אסיה · 10–14 ימים", center: { lng: 108.2772, lat: 16.0, zoom: 5.2 } },
  { id: "ae", flag: "🇦🇪", name: "דובאי", en: "Dubai", sub: "המפרץ · 4–7 ימים", center: { lng: 55.2708, lat: 25.2048, zoom: 9 } },
  { id: "fr", flag: "🇫🇷", name: "צרפת", en: "France", sub: "אירופה · 5–10 ימים", center: { lng: 2.2137, lat: 46.2276, zoom: 5.2 } },
  { id: "es", flag: "🇪🇸", name: "ספרד", en: "Spain", sub: "אירופה · 7–12 ימים", center: { lng: -3.7492, lat: 40.0, zoom: 5.4 } },
  { id: "us", flag: "🇺🇸", name: "ארה״ב", en: "USA", sub: "צפון אמריקה · 10–21 ימים", center: { lng: -98.5, lat: 39.8, zoom: 3.6 } },
];

/* Suggested cities per destination — shown as quick-add chips in
   the city-routing step so users don't start from a blank field. */
const SUGGESTED_CITIES = {
  jp: ["טוקיו", "קיוטו", "אוסקה", "האקונה", "נארה", "קנזאווה"],
  it: ["רומא", "פירנצה", "ונציה", "מילאנו", "אמלפי", "נאפולי"],
  pt: ["ליסבון", "פורטו", "סינטרה", "לאגוס"],
  gr: ["אתונה", "סנטוריני", "מיקונוס", "כרתים"],
  th: ["בנגקוק", "צ׳אנג מאי", "פוקט", "קו סמוי"],
  vn: ["האנוי", "הוי אן", "הו צ׳י מין", "חאלונג"],
  ae: ["דובאי", "אבו דאבי"],
  fr: ["פריז", "ניס", "ליון", "בורדו"],
  es: ["מדריד", "ברצלונה", "סביליה", "גרנדה"],
  us: ["ניו יורק", "לוס אנג׳לס", "סן פרנסיסקו", "לאס וגאס"],
};

/* Larger searchable city pool per country (superset of the
   suggested chips) — powers the autocomplete search field. */
const CITY_POOL = {
  jp: ["טוקיו", "קיוטו", "אוסקה", "האקונה", "נארה", "קנזאווה", "יוקוהמה", "נגויה", "סאפורו", "הירושימה", "ניקו", "קמאקורה", "טקיאמה", "מטסומוטו", "קוואגוצ׳יקו", "אוקינאווה"],
  it: ["רומא", "פירנצה", "ונציה", "מילאנו", "אמלפי", "נאפולי", "פיזה", "סיינה", "בולוניה", "ורונה", "טורינו", "פלרמו", "סורנטו", "צ׳ינקווה טרה"],
  pt: ["ליסבון", "פורטו", "סינטרה", "לאגוס", "פארו", "קוימברה", "מדיירה", "אבורה"],
  gr: ["אתונה", "סנטוריני", "מיקונוס", "כרתים", "רודוס", "קורפו", "נאפליו", "מטאורה"],
  th: ["בנגקוק", "צ׳אנג מאי", "פוקט", "קו סמוי", "קראבי", "איוטאיה", "פאי", "קו פנגן"],
  vn: ["האנוי", "הוי אן", "הו צ׳י מין", "חאלונג", "דה נאנג", "סאפא", "ניה טראנג", "הואה"],
  ae: ["דובאי", "אבו דאבי", "שארג׳ה", "ראס אל ח׳יימה"],
  fr: ["פריז", "ניס", "ליון", "בורדו", "מרסיי", "סטרסבורג", "קאן", "אנסי", "ביאריץ"],
  es: ["מדריד", "ברצלונה", "סביליה", "גרנדה", "ולנסיה", "מלגה", "סן סבסטיאן", "בילבאו", "טולדו"],
  us: ["ניו יורק", "לוס אנג׳לס", "סן פרנסיסקו", "לאס וגאס", "מיאמי", "שיקגו", "בוסטון", "וושינגטון", "סיאטל", "ניו אורלינס"],
};

const Pip = ({ state }) => (
  <span style={{ width: state === "active" ? 22 : 7, height: 7, borderRadius: 999, background: state === "done" ? T.ink : state === "active" ? T.accent : "rgba(20,20,20,0.14)", transition: "all 0.2s" }} />
);

const Cta = ({ children, onClick, disabled }) => (
  <div style={{ padding: "12px 18px 24px" }}>
    <button onClick={onClick} disabled={disabled}
      style={{ width: "100%", height: 56, borderRadius: 999, border: "none", background: disabled ? "#D1CCC5" : T.ink, color: "#fff", fontSize: 16, fontWeight: 700, cursor: disabled ? "default" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, fontFamily: "inherit" }}>
      {children}
    </button>
  </div>
);

const WizardView = () => {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);          // 0..2 wizard, 3 = summary
  const [query, setQuery] = useState("");
  const [destId, setDestId] = useState("jp");
  const [dur, setDur] = useState(9);
  const [cities, setCities] = useState([]);      // [{ name, fromDay, toDay }]
  const [citySearch, setCitySearch] = useState("");
  const [creating, setCreating] = useState(false);

  const dest = useMemo(() => DESTINATIONS.find((d) => d.id === destId), [destId]);
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return DESTINATIONS;
    return DESTINATIONS.filter((d) => d.name.includes(q) || d.en.toLowerCase().includes(q));
  }, [query]);

  const back = () => (step === 0 ? navigate("/dashboard") : setStep((s) => s - 1));

  /* City-routing helpers.
     Each row is { name, days }. The day SEQUENCE is derived from the
     row order: city #1 takes days 1..d1, city #2 the next d2 days, …
     so the same city can appear multiple times (e.g. Rome 3 → Florence
     4 → Rome 3 = days 1-3, 4-7, 8-10). */
  const addCity = (name = "") => {
    setCities((prev) => [...prev, { name: typeof name === "string" ? name : "", days: 2 }]);
  };
  const updateCity = (i, patch) => setCities(cities.map((c, idx) => (idx === i ? { ...c, ...patch } : c)));
  const removeCity = (i) => setCities(cities.filter((_, idx) => idx !== i));

  /* Sequential day ranges from the ordered rows. */
  const sequencedCities = useMemo(() => {
    let cursor = 1;
    return cities
      .filter((c) => c.name.trim())
      .map((c) => {
        const fromDay = cursor;
        const toDay = cursor + Math.max(1, c.days) - 1;
        cursor = toDay + 1;
        return { city: c.name.trim(), cityHe: c.name.trim(), days: Math.max(1, c.days), fromDay, toDay };
      });
  }, [cities]);

  const totalAssigned = useMemo(() => sequencedCities.reduce((s, c) => s + c.days, 0), [sequencedCities]);

  const finish = async () => {
    setCreating(true);
    const cityRanges = sequencedCities.map(({ city, cityHe, fromDay, toDay }) => ({ city, cityHe, fromDay, toDay }));
    const trip = await tripService.createNewTrip({
      title: dest.name,
      destination: dest.en,
      destinationHe: dest.name,
      center: dest.center,
      days: dur,
      cityRanges,
      meta: `${dur} ימים · ${dest.name}`,
    });
    setCreating(false);
    navigate(`/map/edit/${trip.id}`);
  };

  /* Compact city-timeline string for the summary. */
  const cityTimeline = useMemo(() => {
    if (!sequencedCities.length) return null;
    return sequencedCities.map((c) => `${c.city} (${c.days} ימים)`).join(" ← ");
  }, [sequencedCities]);

  return (
    <div dir="rtl" style={{ minHeight: "100vh", background: "#EDEDEC", fontFamily: T.font }}>
      <div style={{ maxWidth: 560, margin: "0 auto", background: "#fff", minHeight: "100vh", display: "flex", flexDirection: "column" }}>
        {/* Head */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 18px 6px" }}>
          <button onClick={back} aria-label={step === 0 ? "סגירה" : "חזרה"} style={{ width: 36, height: 36, borderRadius: "50%", border: "none", background: T.surface, cursor: "pointer", fontFamily: "inherit", color: T.ink2, display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
            <Icon name={step === 0 ? "x" : "chevronStart"} size={16} strokeWidth={2} />
          </button>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            {[0, 1, 2].map((i) => <Pip key={i} state={i < Math.min(step, 3) ? "done" : i === step ? "active" : "todo"} />)}
          </div>
          <button onClick={() => setStep(step === 2 ? 3 : Math.min(3, step + 1))} style={{ border: "none", background: "none", color: T.ink3, fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", visibility: step === 2 ? "visible" : (step < 2 ? "hidden" : "hidden") }}>
            דלגו
          </button>
        </div>

        <div key={step} className="tp-fade-up" style={{ flex: 1, overflowY: "auto", padding: "10px 22px 0" }}>
          {/* STEP 1 — Destination */}
          {step === 0 && (
            <>
              <h1 style={{ fontSize: 26, fontWeight: 800, letterSpacing: "-0.022em", color: T.ink, margin: "6px 0 6px" }}>
                לאן <span style={{ color: T.accent }}>בא לכם</span> השנה?
              </h1>
              <p style={{ fontSize: 14, color: T.ink3, lineHeight: 1.55, marginBottom: 16 }}>בחרו יעד — נבנה שלד מסלול ונכוון את המפה למדינה.</p>
              <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "11px 14px", borderRadius: 16, background: T.surface, border: `1px solid ${T.line}`, marginBottom: 16 }}>
                <span aria-hidden style={{ color: T.ink3, display: "inline-flex" }}><Icon name="search" size={16} /></span>
                <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="חיפוש מדינה או עיר"
                  style={{ flex: 1, border: "none", background: "transparent", fontSize: 16, fontFamily: "inherit", direction: "rtl", textAlign: "right" }} />
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {filtered.map((c) => {
                  const on = destId === c.id;
                  return (
                    <button key={c.id} onClick={() => setDestId(c.id)}
                      style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", borderRadius: 16, cursor: "pointer", fontFamily: "inherit", textAlign: "right", border: `1.5px solid ${on ? T.ink : T.line}`, background: on ? "rgba(13,15,17,0.03)" : "#fff" }}>
                      <div style={{ fontSize: 26 }}>{c.flag}</div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 16, fontWeight: 800, color: T.ink }}>{c.name}{c.popular && <span style={{ fontSize: 10, fontWeight: 700, color: T.accent, marginInlineStart: 6 }}>פופולרי</span>}</div>
                      </div>
                      <span style={{ color: on ? T.ink : T.ink4, display: "inline-flex" }}><Icon name={on ? "check" : "chevronStart"} size={16} strokeWidth={2.2} /></span>
                    </button>
                  );
                })}
              </div>
            </>
          )}

          {/* STEP 2 — Duration (single tactile slider bar) */}
          {step === 1 && (
            <>
              <h1 style={{ fontSize: 26, fontWeight: 800, letterSpacing: "-0.022em", color: T.ink, margin: "6px 0 6px" }}>
                כמה <span style={{ color: T.accent }}>זמן</span> תטוסו?
              </h1>
              <p style={{ fontSize: 14, color: T.ink3, lineHeight: 1.55, marginBottom: 28 }}>גררו את הבר לבחירת מספר הימים — בין 1 ל־45.</p>

              {/* Big readout */}
              <div style={{ textAlign: "center", marginBottom: 22 }}>
                <span style={{ fontSize: 64, fontWeight: 800, color: T.ink, letterSpacing: "-0.03em", fontVariantNumeric: "tabular-nums", lineHeight: 1 }}>{dur}</span>
                <span style={{ fontSize: 18, fontWeight: 700, color: T.ink3, marginInlineStart: 8 }}>ימים</span>
              </div>

              {/* Custom slider: a clearly-visible track + filled bar +
                  big thumb, with a transparent native range on top to
                  capture drag/keys. RTL → fill grows from the right. */}
              {(() => {
                const pct = ((dur - 1) / 44) * 100;
                return (
                  <div style={{ padding: "0 6px" }}>
                    <div style={{ position: "relative", height: 40, display: "flex", alignItems: "center" }}>
                      {/* track */}
                      <div style={{ position: "absolute", left: 0, right: 0, height: 12, borderRadius: 999, background: T.surface2 }} />
                      {/* fill (from the right edge in RTL) */}
                      <div style={{ position: "absolute", right: 0, width: `${pct}%`, height: 12, borderRadius: 999, background: T.accent }} />
                      {/* thumb */}
                      <div style={{ position: "absolute", right: `calc(${pct}% - 15px)`, width: 30, height: 30, borderRadius: "50%", background: T.ink, border: "3px solid #fff", boxShadow: "0 2px 10px rgba(0,0,0,0.3)", pointerEvents: "none" }} />
                      {/* invisible range on top for interaction */}
                      <input
                        type="range" min={1} max={45} step={1} value={dur}
                        onChange={(e) => setDur(Number(e.target.value))}
                        aria-label="מספר ימים"
                        style={{ position: "absolute", left: 0, right: 0, width: "100%", height: 40, margin: 0, opacity: 0, cursor: "pointer", direction: "rtl" }}
                      />
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8, fontSize: 12, fontWeight: 700, color: T.ink4 }}>
                      <span>יום 1</span>
                      <span>45 ימים</span>
                    </div>
                  </div>
                );
              })()}
            </>
          )}

          {/* STEP 3 — City routing */}
          {step === 2 && (
            <>
              <h1 style={{ fontSize: 26, fontWeight: 800, letterSpacing: "-0.022em", color: T.ink, margin: "6px 0 6px" }}>
                חלוקת <span style={{ color: T.accent }}>ערים</span> לפי ימים
              </h1>
              <p style={{ fontSize: 14, color: T.ink3, lineHeight: 1.55, marginBottom: 14 }}>אופציונלי — מפו ערים לטווחי ימים, ונמלא את כותרות הימים מראש.</p>

              {/* City search with autocomplete (pool filtered by country) */}
              {(() => {
                const q = citySearch.trim();
                const pool = CITY_POOL[destId] || SUGGESTED_CITIES[destId] || [];
                /* Repeats allowed — a city can appear several times in
                   the sequence, so we don't filter out added ones. */
                const matches = q ? pool.filter((c) => c.includes(q)).slice(0, 6) : [];
                const exactExists = pool.some((c) => c === q);
                return (
                  <div style={{ position: "relative", marginBottom: 16 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "11px 14px", borderRadius: 16, background: T.surface, border: `1px solid ${T.line}` }}>
                      <span aria-hidden style={{ color: T.ink3, display: "inline-flex" }}><Icon name="search" size={16} /></span>
                      <input value={citySearch} onChange={(e) => setCitySearch(e.target.value)} placeholder={`חיפוש עיר ב${dest.name}`}
                        style={{ flex: 1, border: "none", background: "transparent", fontSize: 16, fontFamily: "inherit", direction: "rtl", textAlign: "right" }} />
                    </div>
                    {q && (matches.length > 0 || !exactExists) && (
                      <ul style={{ listStyle: "none", margin: "6px 0 0", padding: 0, background: "#fff", border: `1px solid ${T.line}`, borderRadius: 14, boxShadow: "0 12px 32px rgba(0,0,0,0.12)", maxHeight: 220, overflowY: "auto", position: "absolute", left: 0, right: 0, zIndex: 5 }}>
                        {matches.map((c) => (
                          <li key={c} onClick={() => { addCity(c); setCitySearch(""); }}
                            style={{ padding: "10px 14px", cursor: "pointer", borderBottom: `1px solid ${T.line}`, fontSize: 14, fontWeight: 600, color: T.ink }}>
                            {c}
                          </li>
                        ))}
                        {!exactExists && (
                          <li onClick={() => { addCity(q); setCitySearch(""); }}
                            style={{ padding: "10px 14px", cursor: "pointer", fontSize: 13.5, fontWeight: 700, color: T.accent }}>
                            ＋ הוסיפו "{q}"
                          </li>
                        )}
                      </ul>
                    )}
                  </div>
                );
              })()}

              {/* Suggested cities — tap to add (can add the same city
                  more than once to build a loop). */}
              {(SUGGESTED_CITIES[destId] || []).length > 0 && (
                <div style={{ marginBottom: 16 }}>
                  <div style={{ fontSize: 11, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.06em", color: T.ink3, marginBottom: 8 }}>
                    ערים מומלצות ב{dest.name}
                  </div>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    {SUGGESTED_CITIES[destId].map((cityName) => (
                      <button key={cityName} onClick={() => addCity(cityName)}
                        style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "7px 12px", borderRadius: 999, cursor: "pointer", fontFamily: "inherit", fontSize: 13, fontWeight: 600,
                          border: `1px solid ${T.accent}55`, background: `${T.accent}0F`, color: T.accent }}>
                        ＋ {cityName}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Ordered city rows — each picks a NUMBER OF DAYS; the
                  day range is derived from the order (city 1 → days
                  1..d1, city 2 → next d2 days, …). */}
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {cities.map((c, i) => {
                  const seq = sequencedCities;
                  /* Map this row index to its sequenced range (skipping
                     unnamed rows that aren't sequenced). */
                  const namedBefore = cities.slice(0, i).filter((x) => x.name.trim()).length;
                  const range = c.name.trim() ? seq[namedBefore] : null;
                  return (
                    <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", borderRadius: 16, border: `1px solid ${T.line}`, background: "#fff" }}>
                      <span style={{ width: 24, height: 24, borderRadius: "50%", background: T.surface2, color: T.ink2, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 800, flexShrink: 0 }}>{i + 1}</span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <input value={c.name} onChange={(e) => updateCity(i, { name: e.target.value })} placeholder="עיר (למשל רומא)"
                          style={{ width: "100%", border: "none", background: "transparent", fontSize: 15, fontWeight: 700, fontFamily: "inherit", direction: "rtl", textAlign: "right", color: T.ink }} />
                        {range && <div style={{ fontSize: 11, color: T.ink4, marginTop: 1 }}>ימים {range.fromDay}–{range.toDay}</div>}
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <button onClick={() => updateCity(i, { days: Math.max(1, c.days - 1) })} style={{ width: 28, height: 28, borderRadius: 8, border: `1px solid ${T.line}`, background: T.surface, cursor: "pointer", fontFamily: "inherit", fontSize: 16, color: T.ink2 }}>−</button>
                        <span style={{ minWidth: 54, textAlign: "center", fontSize: 13, fontWeight: 700, color: T.ink }}>{c.days} ימים</span>
                        <button onClick={() => updateCity(i, { days: Math.min(45, c.days + 1) })} style={{ width: 28, height: 28, borderRadius: 8, border: `1px solid ${T.line}`, background: T.surface, cursor: "pointer", fontFamily: "inherit", fontSize: 16, color: T.ink2 }}>＋</button>
                      </div>
                      <button onClick={() => removeCity(i)} aria-label="הסרת עיר" style={{ border: "none", background: "transparent", color: T.ink4, cursor: "pointer", fontFamily: "inherit", display: "inline-flex", alignItems: "center", justifyContent: "center", padding: 4 }}><Icon name="x" size={15} strokeWidth={2} /></button>
                    </div>
                  );
                })}
              </div>

              <button onClick={() => addCity()} style={{ marginTop: 12, width: "100%", padding: 14, borderRadius: 16, border: `2px dashed ${T.line}`, background: "transparent", color: T.ink2, fontSize: 14, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
                ＋ הוסף עיר
              </button>

              {sequencedCities.length > 0 && (
                <div style={{ marginTop: 12, fontSize: 12.5, fontWeight: 600, color: totalAssigned === dur ? "#3E7C4A" : T.ink3, textAlign: "center" }}>
                  {totalAssigned === dur
                    ? `מצוין — ${totalAssigned} ימים תואמים למשך הטיול`
                    : `שובצו ${totalAssigned} מתוך ${dur} ימים`}
                </div>
              )}
            </>
          )}

          {/* SUMMARY */}
          {step === 3 && (
            <>
              <div style={{ display: "inline-flex", alignItems: "center", gap: 6, background: T.surface, padding: "5px 12px", borderRadius: 999, fontSize: 11.5, fontWeight: 700, letterSpacing: "0.06em", color: T.ink2, marginTop: 4 }}>
                <Icon name="sparkle" size={13} strokeWidth={2} /> המסלול שלכם מוכן
              </div>
              <h1 style={{ fontSize: 26, fontWeight: 800, letterSpacing: "-0.022em", color: T.ink, margin: "12px 0 16px" }}>
                {dest.flag} {dest.name} · <span style={{ color: T.accent }}>{dur} ימים</span>
              </h1>

              {/* Summary cards with inline edit */}
              <SummaryRow label="יעד" value={`${dest.flag} ${dest.name}`} onEdit={() => setStep(0)} />
              <SummaryRow label="משך" value={`${dur} ימים`} onEdit={() => setStep(1)} />
              <SummaryRow label="חלוקת ערים" value={cityTimeline || "לא הוגדרה — נבנה תוך כדי"} onEdit={() => setStep(2)} muted={!cityTimeline} />

              <div style={{ display: "flex", gap: 10, marginTop: 18, alignItems: "flex-start" }}>
                {[
                  { ic: "🗺", t: "מפה דינמית", s: `נתכוונן ל${dest.name} אוטומטית` },
                  { ic: "🔎", t: "הוספת תחנות", s: "חיפוש / פין ידני בכל יום" },
                  { ic: "🚆", t: "זמנים אוטומטיים", s: "הליכה/תחבורה בין תחנות" },
                ].map((h, i) => (
                  <div key={i} style={{ flex: 1, textAlign: "center" }}>
                    <div style={{ width: 40, height: 40, borderRadius: 12, background: T.surface, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, margin: "0 auto 6px" }}>{h.ic}</div>
                    <div style={{ fontSize: 12.5, fontWeight: 700, color: T.ink }}>{h.t}</div>
                    <div style={{ fontSize: 11, color: T.ink3, marginTop: 2, lineHeight: 1.4 }}>{h.s}</div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Footer CTA */}
        {step < 2 && <Cta onClick={() => setStep(step + 1)}>המשך{step === 1 ? ` · ${dur} ימים` : ""} <span aria-hidden style={{ display: "inline-flex" }}><Icon name="chevronStart" size={15} strokeWidth={2.4} /></span></Cta>}
        {step === 2 && <Cta onClick={() => setStep(3)}>סקירה אחרונה <span aria-hidden style={{ display: "inline-flex" }}><Icon name="chevronStart" size={15} strokeWidth={2.4} /></span></Cta>}
        {step === 3 && <Cta onClick={finish} disabled={creating}>{creating ? "יוצר…" : "התחילו לבנות"} <span aria-hidden style={{ display: "inline-flex" }}><Icon name="chevronStart" size={15} strokeWidth={2.4} /></span></Cta>}
      </div>
    </div>
  );
};

/* Summary row with an inline edit affordance. */
const SummaryRow = ({ label, value, onEdit, muted }) => (
  <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 16px", borderRadius: 16, border: `1px solid ${T.line}`, background: "#fff", marginBottom: 10 }}>
    <div style={{ flex: 1, minWidth: 0 }}>
      <div style={{ fontSize: 11, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.06em", color: T.ink3, marginBottom: 3 }}>{label}</div>
      <div style={{ fontSize: 15, fontWeight: 700, color: muted ? T.ink4 : T.ink }}>{value}</div>
    </div>
    <button onClick={onEdit} style={{ border: `1px solid ${T.line}`, background: T.surface, borderRadius: 999, padding: "6px 14px", fontSize: 12.5, fontWeight: 700, color: T.ink2, cursor: "pointer", fontFamily: "inherit" }}>
      עריכה
    </button>
  </div>
);

export default WizardView;
