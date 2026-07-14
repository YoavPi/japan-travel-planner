import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import tripService, { MAX_ACTIVE_TRIPS } from "../services/tripService";
import Icon from "../components/Icon";
import { isPlacesEnabled, autocomplete as placesAutocomplete } from "../services/googlePlaces";

/* ──────────────────────────────────────────────────────────────
   WizardView — dynamic global onboarding (3 steps + summary).
     0. Destination  — global picker; captures center {lng,lat,zoom}
     1. Duration     — tactile horizontal day bar, 1–45 days
     2. City routing — map city milestones to day ranges (optional)
     → Summary       — styled breakdown + inline edit per section
   Sprint 20 #1 removes the dedicated flights/transit prompt entirely:
   users now add flights manually as transit nodes inside the editor
   timeline, so onboarding no longer asks for origin/destination legs.
   Sprint 18.3 layers live Google Places city-only predictions
   (types:['(cities)']) on top of the static CITY_POOL.
   On "התחילו לבנות" → createNewTrip(dynamic payload) → editor.
   ────────────────────────────────────────────────────────────── */

const T = {
  ink: "#0D0F11", ink2: "#2A3036", ink3: "#6B7178", ink4: "#A4AAB1",
  line: "rgba(20,20,20,0.08)", surface: "#F6F6F4", surface2: "#EFEFEC", accent: "#E0533F",
  accentSoft: "#FDF0EE", green: "#3E7C4A", greenSoft: "#EBF5ED",
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

/* Sprint 23 #4 — city accent palette for the allocation screen: each
   sequenced city owns a color across its card edge, number disc, share
   bar and the proportional timeline segment. */
const ALLOC_COLORS = ["#D04A3E", "#5A8C5F", "#C09445", "#4E9E94", "#7B6BA8", "#C06AA0"];

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
  /* Sprint 27 #1 — flight-lite capture: ONLY origin country + landing
     city (both optional). No flight numbers / terminals / times — those
     stay as manual additions inside the timeline editor. */
  const [originCountry, setOriginCountry] = useState("");
  const [landingCity, setLandingCity] = useState("");
  const [citySearch, setCitySearch] = useState("");
  const [cityPreds, setCityPreds] = useState([]); // live (cities)-restricted predictions
  const [creating, setCreating] = useState(false);
  /* SaaS tier backstop — the wizard is reachable directly via /create,
     so we re-check the active-trip count here too and block the final
     build action once the account is at MAX_ACTIVE_TRIPS. */
  const [atTripCap, setAtTripCap] = useState(false);
  /* Sprint 22 #3 — HTML5 drag-and-drop state for reordering the city
     routing rows (which physically re-sequences the route). */
  const [dragCityIdx, setDragCityIdx] = useState(-1);
  const [dragOverIdx, setDragOverIdx] = useState(-1);
  /* Sprint 22 #4 — skeleton-edit mode. `/create?edit=<tripId>` re-enters
     the wizard against an EXISTING trip: duration + city allocation are
     prefilled, and finishing applies the new skeleton via
     tripService.applySkeleton (inner-day place nodes are preserved). */
  const [searchParams] = useSearchParams();
  const editTripId = searchParams.get("edit");
  const [editTrip, setEditTrip] = useState(null);

  useEffect(() => {
    let live = true;
    tripService.fetchAllTrips().then((list) => {
      if (live) setAtTripCap((list || []).length >= MAX_ACTIVE_TRIPS);
    }).catch(() => {});
    return () => { live = false; };
  }, []);

  useEffect(() => {
    if (!editTripId) return;
    let live = true;
    tripService.fetchTripById(editTripId).then((t) => {
      if (!live) return;
      setEditTrip(t);
      /* Sprint 23 #3 — the wizard tracks NIGHTS; stored trips carry the
         day footprint, so subtract the checkout day on the way in. */
      const totalDays = t.days || t.data?.tripData?.length || 10;
      setDur(Math.max(1, totalDays - 1));
      const ranges = t.settings?.cityRanges || [];
      if (ranges.length) {
        /* Invert the last-range +1 stretch applied on save. */
        setCities(ranges.map((r, i) => ({
          name: r.cityHe || r.city,
          days: Math.max(1, (r.toDay - r.fromDay) + 1 - (i === ranges.length - 1 ? 1 : 0)),
        })));
      } else {
        /* No stored ranges — derive consecutive same-city runs from the
           day headers so the allocation state reflects reality. */
        const runs = [];
        (t.data?.tripData || []).forEach((d) => {
          const nm = d.cityHe || d.city || "";
          const last = runs[runs.length - 1];
          if (last && last.name === nm) last.days += 1;
          else runs.push({ name: nm, days: 1 });
        });
        setCities(runs.filter((r) => r.name));
      }
      const match = DESTINATIONS.find((d) => d.en === t.settings?.destination || d.name === t.settings?.destinationHe);
      if (match) setDestId(match.id);
      setStep(2); // land directly on the skeleton (city/day allocation) state
    }).catch(() => {});
    return () => { live = false; };
  }, [editTripId]);

  const dest = useMemo(() => DESTINATIONS.find((d) => d.id === destId) || {
    id: "custom", flag: "📍",
    name: editTrip?.settings?.destinationHe || editTrip?.title || "",
    en: editTrip?.settings?.destination || "",
    sub: "", center: editTrip?.center || null,
  }, [destId, editTrip]);
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return DESTINATIONS;
    return DESTINATIONS.filter((d) => d.name.includes(q) || d.en.toLowerCase().includes(q));
  }, [query]);

  /* Sprint 18.3 — live city-only autocomplete. When a Google Places key
     is configured we debounce the city-routing search and request
     predictions restricted to types:['(cities)'] so only localities ever
     surface (never POIs/addresses). Without a key this stays inert and
     the static CITY_POOL drives the dropdown. */
  useEffect(() => {
    if (!isPlacesEnabled()) { setCityPreds([]); return; }
    const q = citySearch.trim();
    if (q.length < 2) { setCityPreds([]); return; }
    let live = true;
    const t = setTimeout(() => {
      placesAutocomplete(q, { types: ["(cities)"] })
        .then((res) => { if (live) setCityPreds(res || []); })
        .catch(() => { if (live) setCityPreds([]); });
    }, 250);
    return () => { live = false; clearTimeout(t); };
  }, [citySearch]);

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
  /* Sprint 22 #3 — physically relocate a city row (drag-and-drop drop
     handler): the route sequence IS the row order. */
  const moveCityTo = (fromIdx, toIdx) => {
    if (fromIdx < 0 || toIdx < 0 || fromIdx === toIdx) return;
    setCities((prev) => {
      const next = prev.slice();
      const [moved] = next.splice(fromIdx, 1);
      next.splice(toIdx, 0, moved);
      return next;
    });
  };

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

  /* Sprint 22 #3 — HARD validation: once cities are allocated, the day
     reducer sum must exactly match the selected trip duration, otherwise
     the step's Next action is disabled and an error renders. */
  const allocationValid = sequencedCities.length === 0 || totalAssigned === dur;

  /* Sprint 24 — PREVENTATIVE capacity constraint: the moment every trip
     night is allocated, all ＋ increment buttons hard-lock so the user
     cannot over-allocate even by one. Decrements always stay active, so
     nights can be freed and redistributed. */
  const nightsCapReached = totalAssigned >= dur;

  const finish = async () => {
    if (creating || !allocationValid) return;
    /* Sprint 23 #3 — `dur` counts NIGHTS; the trip schema receives the
       full day footprint (nights + 1). The last city's range is stretched
       by one day so the checkout day inherits its city header. */
    const totalDays = dur + 1;
    const cityRanges = sequencedCities.map(({ city, cityHe, fromDay, toDay }, i) => ({
      city, cityHe, fromDay,
      toDay: i === sequencedCities.length - 1 ? toDay + 1 : toDay,
    }));
    /* Skeleton-edit mode (Sprint 22 #4): re-stamp the existing trip's
       structure — never a new trip, so the tier cap doesn't apply. */
    if (editTripId) {
      setCreating(true);
      try {
        await tripService.applySkeleton(editTripId, { days: totalDays, cityRanges, meta: `${totalDays} ימים · ${dest.name}` });
      } catch { /* surfaced by the editor on reload */ }
      setCreating(false);
      navigate(`/map/edit/${editTripId}`);
      return;
    }
    if (atTripCap) return; // tier ceiling — guarded by the disabled CTA + banner
    setCreating(true);
    const trip = await tripService.createNewTrip({
      title: dest.name,
      destination: dest.en,
      destinationHe: dest.name,
      center: dest.center,
      days: totalDays,
      cityRanges,
      /* Sprint 27 #1 — basic flight structure only (deep logistics are
         editor-side, optional). */
      transitOrigin: originCountry.trim(),
      transitDestination: landingCity.trim(),
      meta: `${totalDays} ימים · ${dest.name}`,
    });
    setCreating(false);
    navigate(`/map/edit/${trip.id}`);
  };

  /* cityTimeline intentionally removed — summary renders sequencedCities
     directly as individual SummaryCard rows (see step === 3 block). */

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
          <button onClick={() => allocationValid && setStep(step === 2 ? 3 : Math.min(3, step + 1))}
            disabled={!allocationValid}
            style={{ border: "none", background: "none", color: allocationValid ? T.ink3 : T.ink4, fontSize: 13, fontWeight: 600, cursor: allocationValid ? "pointer" : "default", fontFamily: "inherit", visibility: step === 2 ? "visible" : "hidden" }}>
            דלגו
          </button>
        </div>

        <div key={step} className="tp-fade-up" style={{ flex: 1, overflowY: "auto", padding: "10px 22px 0" }}>
          {/* SaaS tier ceiling — informational lock when the account is full.
              Irrelevant while editing an existing trip's skeleton. */}
          {atTripCap && !editTripId && (
            <div role="status" aria-live="polite"
              style={{ display: "flex", alignItems: "flex-start", gap: 12, padding: 14, marginBottom: 14, border: `1px solid ${T.accent}33`, borderRadius: 16, background: `${T.accent}0D` }}>
              <span style={{ width: 38, height: 38, borderRadius: 12, background: `${T.accent}1A`, color: T.accent, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <Icon name="shield" size={18} strokeWidth={2.1} />
              </span>
              <span style={{ flex: 1, minWidth: 0 }}>
                <span style={{ display: "block", fontSize: 14, fontWeight: 800, color: T.ink }}>הגעתם למגבלת הטיולים הפעילים (5/5)</span>
                <span style={{ display: "block", fontSize: 12.5, color: T.ink3, marginTop: 3, lineHeight: 1.5 }}>כדי ליצור מסלול חדש, יש למחוק טיול קיים מהרשימה.</span>
              </span>
            </div>
          )}
          {/* STEP 0 — Destination (chosen first; Sprint 18.2) */}
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
                    <button key={c.id} onClick={() => { setDestId(c.id); setStep(1); }}
                      style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", borderRadius: 16, cursor: "pointer", fontFamily: "inherit", textAlign: "right", border: `1.5px solid ${on ? T.ink : T.line}`, background: on ? "rgba(13,15,17,0.03)" : "#fff", transition: "border-color 0.15s, background 0.15s" }}>
                      <div style={{ fontSize: 26, lineHeight: 1 }}>{c.flag}</div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 15.5, fontWeight: 800, color: T.ink, display: "flex", alignItems: "center", gap: 6 }}>
                          {c.name}
                          {c.popular && <span style={{ fontSize: 9.5, fontWeight: 800, color: T.accent, background: T.accentSoft, borderRadius: 999, padding: "2px 7px", letterSpacing: "0.04em" }}>פופולרי</span>}
                        </div>
                        <div style={{ fontSize: 12, color: T.ink3, marginTop: 2 }}>{c.sub}</div>
                      </div>
                      <span style={{ color: on ? T.ink : T.ink4, display: "inline-flex", flexShrink: 0 }}><Icon name={on ? "check" : "chevronEnd"} size={16} strokeWidth={2.2} /></span>
                    </button>
                  );
                })}
              </div>
            </>
          )}

          {/* STEP 1 — Duration. Sprint 23 #3: the trip length is now
              tracked in NIGHTS (the hotel-booking mental model); the day
              footprint (nights + 1) renders as a dynamic sub-label and is
              what the trip schema ultimately receives. */}
          {step === 1 && (
            <>
              <h1 style={{ fontSize: 26, fontWeight: 800, letterSpacing: "-0.022em", color: T.ink, margin: "6px 0 6px" }}>
                לכמה <span style={{ color: T.accent }}>לילות</span> תטוסו?
              </h1>
              <p style={{ fontSize: 14, color: T.ink3, lineHeight: 1.55, marginBottom: 28 }}>גררו את הבר לבחירת מספר הלילות — בין 1 ל־45.</p>

              {/* Big readout — nights, with the total day footprint below */}
              <div style={{ textAlign: "center", marginBottom: 22 }}>
                <span style={{ fontSize: 64, fontWeight: 800, color: T.ink, letterSpacing: "-0.03em", fontVariantNumeric: "tabular-nums", lineHeight: 1 }}>{dur}</span>
                <span style={{ fontSize: 18, fontWeight: 700, color: T.ink3, marginInlineStart: 8 }}>לילות</span>
                <div style={{ marginTop: 8, fontSize: 13.5, fontWeight: 700, color: T.ink3 }}>
                  {dur + 1} ימי טיול סך הכל
                </div>
              </div>

              {/* Sprint 27 #1 — flight-lite: origin country + landing city
                  only. Optional, single screen, zero deep logistics (no
                  flight numbers / terminals / times — those live in the
                  editor as manual additions). */}
              <div style={{ display: "flex", gap: 10, marginBottom: 24 }}>
                <label style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ display: "block", fontSize: 11, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.05em", color: T.ink3, marginBottom: 6 }}>מדינת מוצא</span>
                  <input value={originCountry} onChange={(e) => setOriginCountry(e.target.value)} placeholder="למשל ישראל"
                    style={{ width: "100%", boxSizing: "border-box", height: 46, borderRadius: 14, border: `1px solid ${originCountry ? T.ink : T.line}`, padding: "0 12px", fontSize: 15, fontFamily: "inherit", direction: "rtl", textAlign: "right", color: T.ink, background: "#fff", transition: "border-color 0.15s" }} />
                </label>
                <label style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ display: "block", fontSize: 11, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.05em", color: T.ink3, marginBottom: 6 }}>עיר הנחיתה ב{dest.name}</span>
                  <input value={landingCity} onChange={(e) => setLandingCity(e.target.value)} placeholder={`למשל ${(SUGGESTED_CITIES[destId] || [""])[0] || "עיר"}`}
                    style={{ width: "100%", boxSizing: "border-box", height: 46, borderRadius: 14, border: `1px solid ${landingCity ? T.ink : T.line}`, padding: "0 12px", fontSize: 15, fontFamily: "inherit", direction: "rtl", textAlign: "right", color: T.ink, background: "#fff", transition: "border-color 0.15s" }} />
                </label>
              </div>
              {(SUGGESTED_CITIES[destId] || []).length > 0 && (
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: -14, marginBottom: 24 }}>
                  {SUGGESTED_CITIES[destId].slice(0, 4).map((c) => (
                    <button key={c} onClick={() => setLandingCity(c)}
                      style={{ padding: "5px 11px", borderRadius: 999, cursor: "pointer", fontFamily: "inherit", fontSize: 12, fontWeight: 600, border: `1px solid ${landingCity === c ? T.ink : T.line}`, background: landingCity === c ? T.ink : T.surface, color: landingCity === c ? "#fff" : T.ink2, transition: "background 0.15s, color 0.15s" }}>
                      ✈️ {c}
                    </button>
                  ))}
                </div>
              )}

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
                        aria-label="מספר לילות"
                        style={{ position: "absolute", left: 0, right: 0, width: "100%", height: 40, margin: 0, opacity: 0, cursor: "pointer", direction: "rtl" }}
                      />
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8, fontSize: 12, fontWeight: 700, color: T.ink4 }}>
                      <span>לילה 1</span>
                      <span>45 לילות</span>
                    </div>
                  </div>
                );
              })()}
            </>
          )}

          {/* STEP 2 — City routing */}
          {step === 2 && (
            <>
              <h1 style={{ fontSize: 26, fontWeight: 800, letterSpacing: "-0.022em", color: T.ink, margin: "6px 0 6px" }}>
                חלוקת <span style={{ color: T.accent }}>לילות</span> בין הערים
              </h1>
              <p style={{ fontSize: 14, color: T.ink3, lineHeight: 1.55, marginBottom: 14 }}>אופציונלי — הקצו לילות לכל עיר, והבר יראה את משקלה בטיול.</p>

              {/* City search with autocomplete (pool filtered by country) */}
              {(() => {
                const q = citySearch.trim();
                const pool = CITY_POOL[destId] || SUGGESTED_CITIES[destId] || [];
                /* Repeats allowed — a city can appear several times in
                   the sequence, so we don't filter out added ones. */
                const poolMatches = q ? pool.filter((c) => c.includes(q)).slice(0, 6) : [];
                /* Sprint 18.3: fold in live (cities)-only predictions,
                   de-duped against the static pool matches. */
                const liveMatches = q
                  ? cityPreds
                      .map((p) => p.primary)
                      .filter((n) => n && !poolMatches.includes(n))
                  : [];
                const matches = [...poolMatches, ...liveMatches].slice(0, 8);
                const exactExists = matches.some((c) => c === q);
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

              {/* ── Sprint 23 #4 — redesigned allocation layout ──
                  A PROPORTIONAL SEGMENTED TIMELINE BAR mirrors the whole
                  trip: each city owns a color-coded segment whose width
                  animates with its allocated nights. Below it, interactive
                  stacked city cards (still HTML5 drag-reorderable — the
                  route IS the card order) with clean ＋/− stepper pills
                  (dir="rtl" keeps ＋ on the visual right, Sprint 22 #1). */}
              {sequencedCities.length > 0 && (
                <div style={{ marginBottom: 16 }}>
                  <div style={{ display: "flex", height: 16, borderRadius: 999, overflow: "hidden", background: T.surface2 }}>
                    {sequencedCities.map((c, i) => (
                      <div key={`${c.city}-${i}`} title={`${c.city} · ${c.days} לילות`}
                        style={{
                          width: `${(c.days / Math.max(1, Math.max(dur, totalAssigned))) * 100}%`,
                          background: ALLOC_COLORS[i % ALLOC_COLORS.length],
                          transition: "width 0.3s cubic-bezier(0.22,1,0.36,1)",
                          borderInlineEnd: i < sequencedCities.length - 1 ? "2px solid #fff" : "none",
                        }} />
                    ))}
                  </div>
                  {/* Legend — color dot per city */}
                  <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginTop: 7 }}>
                    {sequencedCities.map((c, i) => (
                      <span key={`${c.city}-lg-${i}`} style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 11, fontWeight: 700, color: T.ink3 }}>
                        <span aria-hidden style={{ width: 8, height: 8, borderRadius: "50%", background: ALLOC_COLORS[i % ALLOC_COLORS.length] }} />
                        {c.city} · {c.days}
                      </span>
                    ))}
                  </div>
                  {/* Sprint 24 — neutral capacity hint (replaces any loud
                      error at full utilization): the ＋ buttons are locked;
                      redistribute or go back to raise the trip's nights. */}
                  {nightsCapReached && (
                    <div role="status" style={{ marginTop: 8, padding: "8px 12px", borderRadius: 12, background: T.surface, border: `1px solid ${T.line}`, color: T.ink3, fontSize: 12, fontWeight: 600, lineHeight: 1.5, textAlign: "center" }}>
                      נוצלו כל הלילות בטיול. כדי להוסיף, יש לחזור לאחור ולהגדיל את סך לילות הטיול.
                    </div>
                  )}
                </div>
              )}

              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {cities.map((c, i) => {
                  const seq = sequencedCities;
                  /* Map this row index to its sequenced range (skipping
                     unnamed rows that aren't sequenced). */
                  const namedBefore = cities.slice(0, i).filter((x) => x.name.trim()).length;
                  const range = c.name.trim() ? seq[namedBefore] : null;
                  const isDrop = dragOverIdx === i && dragCityIdx !== -1 && dragCityIdx !== i;
                  const col = ALLOC_COLORS[(c.name.trim() ? namedBefore : i) % ALLOC_COLORS.length];
                  return (
                    <div key={i}
                      draggable
                      onDragStart={(e) => { setDragCityIdx(i); try { e.dataTransfer.effectAllowed = "move"; } catch { /* noop */ } }}
                      onDragOver={(e) => { e.preventDefault(); setDragOverIdx(i); }}
                      onDragLeave={() => setDragOverIdx((v) => (v === i ? -1 : v))}
                      onDrop={(e) => { e.preventDefault(); moveCityTo(dragCityIdx, i); setDragCityIdx(-1); setDragOverIdx(-1); }}
                      onDragEnd={() => { setDragCityIdx(-1); setDragOverIdx(-1); }}
                      style={{
                        position: "relative", borderRadius: 16, background: "#fff",
                        border: isDrop ? `1.5px dashed ${T.accent}` : `1px solid ${T.line}`,
                        opacity: dragCityIdx === i ? 0.55 : 1,
                        /* Card grows with the allocated nights (spatial weight). */
                        padding: `${10 + Math.min(6, c.days) * 2}px 14px`,
                        boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
                        transition: "padding 0.25s ease, border-color 0.15s ease, opacity 0.15s ease",
                      }}>
                      {/* City color accent — inline-start edge bracket */}
                      <span aria-hidden style={{ position: "absolute", insetInlineStart: 0, top: 10, bottom: 10, width: 4, borderRadius: 999, background: col }} />
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <span title="גררו לשינוי סדר המסלול" style={{ cursor: "grab", color: T.ink4, fontSize: 16, flexShrink: 0, touchAction: "none" }}>≡</span>
                        <span style={{ width: 26, height: 26, borderRadius: "50%", background: col, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 800, flexShrink: 0 }}>{i + 1}</span>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <input value={c.name} onChange={(e) => updateCity(i, { name: e.target.value })} placeholder="עיר (למשל רומא)"
                            style={{ width: "100%", border: "none", background: "transparent", fontSize: 16.5, fontWeight: 800, letterSpacing: "-0.01em", fontFamily: "inherit", direction: "rtl", textAlign: "right", color: T.ink }} />
                          {range && <div style={{ fontSize: 11, color: T.ink4, marginTop: 1 }}>לילות {range.fromDay}–{range.toDay}</div>}
                        </div>
                        <button onClick={() => removeCity(i)} title="הסרת עיר" aria-label="הסרת עיר" style={{ border: "none", background: "transparent", color: T.ink4, cursor: "pointer", fontFamily: "inherit", display: "inline-flex", alignItems: "center", justifyContent: "center", padding: 4 }}><Icon name="x" size={15} strokeWidth={2} /></button>
                      </div>

                      {/* Nights stepper pills — dir="rtl" puts ＋ on the visual
                          RIGHT of − (Sprint 22 #1 invariant). */}
                      <div dir="rtl" style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 12 }}>
                        <button onClick={() => !nightsCapReached && updateCity(i, { days: Math.min(45, c.days + 1) })}
                          disabled={nightsCapReached}
                          aria-disabled={nightsCapReached}
                          title={nightsCapReached ? "נוצלו כל הלילות בטיול" : "הוספת לילה"} aria-label="הוספת לילה"
                          style={{ width: 44, height: 34, borderRadius: 999, border: `1px solid ${nightsCapReached ? T.line : `${col}55`}`, background: nightsCapReached ? T.surface2 : `${col}0D`, color: nightsCapReached ? T.ink4 : col, cursor: nightsCapReached ? "not-allowed" : "pointer", fontFamily: "inherit", fontSize: 17, fontWeight: 700, display: "inline-flex", alignItems: "center", justifyContent: "center", transition: "background 0.15s, color 0.15s, border-color 0.15s" }}>＋</button>
                        <span style={{ minWidth: 74, textAlign: "center", fontSize: 15, fontWeight: 800, color: T.ink, fontVariantNumeric: "tabular-nums" }}>
                          {c.days} <span style={{ fontSize: 12, fontWeight: 700, color: T.ink3 }}>לילות</span>
                        </span>
                        <button onClick={() => updateCity(i, { days: Math.max(1, c.days - 1) })}
                          title="הפחתת לילה" aria-label="הפחתת לילה"
                          style={{ width: 44, height: 34, borderRadius: 999, border: `1px solid ${T.line}`, background: T.surface, color: T.ink2, cursor: "pointer", fontFamily: "inherit", fontSize: 17, fontWeight: 700, display: "inline-flex", alignItems: "center", justifyContent: "center", transition: "background 0.15s" }}>−</button>
                        {/* This card's proportional share, animated */}
                        <div aria-hidden style={{ flex: 1, height: 6, borderRadius: 999, background: T.surface2, overflow: "hidden" }}>
                          <div style={{ width: `${Math.min(100, (c.days / Math.max(1, dur)) * 100)}%`, height: "100%", borderRadius: 999, background: col, transition: "width 0.3s cubic-bezier(0.22,1,0.36,1)" }} />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              <button onClick={() => addCity()} title="הוספת עיר" aria-label="הוספת עיר"
                style={{ marginTop: 12, width: "100%", padding: 14, borderRadius: 16, border: `2px dashed ${T.line}`, background: "transparent", color: T.ink2, fontSize: 14, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
                ＋ הוסף עיר
              </button>

              {sequencedCities.length > 0 && (
                <div style={{ marginTop: 12, fontSize: 12.5, fontWeight: 600, color: totalAssigned === dur ? "#3E7C4A" : T.ink3, textAlign: "center" }}>
                  {totalAssigned === dur
                    ? `מצוין — ${totalAssigned} לילות תואמים למשך הטיול`
                    : `שובצו ${totalAssigned} מתוך ${dur} לילות`}
                </div>
              )}

              {/* Strict validation (Sprint 22 #3, nights semantics since
                  Sprint 23): the allocated-nights reducer must equal the
                  trip's total nights to continue. */}
              {!allocationValid && (
                <div role="alert" style={{ marginTop: 8, padding: "10px 12px", borderRadius: 12, background: "rgba(192,57,43,0.08)", border: "1px solid rgba(192,57,43,0.35)", color: "#A03325", fontSize: 12.5, fontWeight: 700, textAlign: "center" }}>
                  חלוקת הלילות אינה תואמת את סך לילות הטיול שהוגדרו
                </div>
              )}
            </>
          )}

          {/* SUMMARY */}
          {step === 3 && (
            <>
              {/* Badge */}
              <div style={{ display: "inline-flex", alignItems: "center", gap: 6, background: T.accentSoft, padding: "5px 12px", borderRadius: 999, fontSize: 11.5, fontWeight: 800, letterSpacing: "0.06em", color: T.accent, marginTop: 4 }}>
                <Icon name="sparkle" size={13} strokeWidth={2} /> ✨ המסלול שלכם מוכן
              </div>
              <h1 style={{ fontSize: 24, fontWeight: 800, letterSpacing: "-0.022em", color: T.ink, margin: "10px 0 18px", lineHeight: 1.2 }}>
                {dest.flag} {dest.name} · <span style={{ color: T.accent }}>{dur} לילות</span>
              </h1>

              {/* Destination card */}
              <SummaryCard
                icon={<span style={{ fontSize: 22, lineHeight: 1 }}>{dest.flag}</span>}
                label="יעד"
                onEdit={() => setStep(0)}
              >
                <div style={{ fontSize: 16, fontWeight: 800, color: T.ink }}>{dest.name}</div>
                <div style={{ fontSize: 12, color: T.ink3, marginTop: 2 }}>{dest.sub}</div>
              </SummaryCard>

              {/* Duration card */}
              <SummaryCard
                icon={<Icon name="calendar" size={18} strokeWidth={1.9} color={T.ink2} />}
                label="משך הטיול"
                onEdit={() => setStep(1)}
              >
                <div style={{ display: "flex", alignItems: "baseline", gap: 5 }}>
                  <span style={{ fontSize: 28, fontWeight: 800, color: T.ink, letterSpacing: "-0.03em", fontVariantNumeric: "tabular-nums" }}>{dur}</span>
                  <span style={{ fontSize: 14, fontWeight: 700, color: T.ink3 }}>לילות</span>
                  <span style={{ fontSize: 12.5, fontWeight: 700, color: T.ink4, marginInlineStart: 6 }}>· {dur + 1} ימי טיול סך הכל</span>
                </div>
              </SummaryCard>

              {/* City timeline card */}
              <SummaryCard
                icon={<Icon name="pin" size={18} strokeWidth={1.9} color={T.ink2} />}
                label="חלוקת לילות בין הערים"
                onEdit={() => setStep(2)}
              >
                {sequencedCities.length > 0 ? (
                  <div style={{ display: "flex", flexDirection: "column", gap: 7, marginTop: 2 }}>
                    {sequencedCities.map((c, i) => (
                      <div key={i} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        {/* Sequential number — city accent color */}
                        <span style={{ width: 22, height: 22, borderRadius: "50%", background: ALLOC_COLORS[i % ALLOC_COLORS.length], color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10.5, fontWeight: 800, flexShrink: 0 }}>{i + 1}</span>
                        {/* City name */}
                        <span style={{ flex: 1, fontSize: 14, fontWeight: 700, color: T.ink }}>{c.city}</span>
                        {/* Night range chip */}
                        <span style={{ fontSize: 11.5, fontWeight: 700, color: T.ink3, background: T.surface2, borderRadius: 999, padding: "3px 10px", whiteSpace: "nowrap" }}>
                          לילות {c.fromDay}–{c.toDay}
                        </span>
                        {/* Duration */}
                        <span style={{ fontSize: 11, fontWeight: 700, color: T.accent, whiteSpace: "nowrap", minWidth: 40, textAlign: "start" }}>{c.days} ל׳</span>
                      </div>
                    ))}
                    {/* Coverage status */}
                    <div style={{ marginTop: 4, fontSize: 12, fontWeight: 700, color: totalAssigned === dur ? T.green : T.ink3, background: totalAssigned === dur ? T.greenSoft : T.surface, borderRadius: 10, padding: "6px 10px", textAlign: "center" }}>
                      {totalAssigned === dur
                        ? `✓ ${totalAssigned} לילות משובצים — כיסוי מלא`
                        : `${totalAssigned} מתוך ${dur} לילות משובצים`}
                    </div>
                  </div>
                ) : (
                  <div style={{ fontSize: 13.5, color: T.ink4, fontStyle: "italic" }}>לא הוגדרה — נבנה תוך כדי</div>
                )}
              </SummaryCard>

              {/* Sprint 23 #5 — the 3 feature-teaser boxes were removed: the
                  summary footer stays lightweight — core details + CTA only. */}
            </>
          )}
        </div>

        {/* Footer CTA */}
        {step < 2 && <Cta onClick={() => setStep(step + 1)}>המשך{step === 1 ? ` · ${dur} לילות` : ""} <span aria-hidden style={{ display: "inline-flex" }}><Icon name="chevronEnd" size={15} strokeWidth={2.4} /></span></Cta>}
        {step === 2 && <Cta onClick={() => setStep(3)} disabled={!allocationValid}>{allocationValid ? "סקירה אחרונה" : "חלוקת הלילות אינה תואמת"} <span aria-hidden style={{ display: "inline-flex" }}><Icon name="chevronEnd" size={15} strokeWidth={2.4} /></span></Cta>}
        {step === 3 && <Cta onClick={finish} disabled={creating || !allocationValid || (!editTripId && atTripCap)}>
          {editTripId
            ? (creating ? "מעדכן מסלול…" : "עדכן מסלול")
            : atTripCap ? "הגעתם למגבלת הטיולים (5/5)" : creating ? "יוצר…" : "🚀 יצירת הטיול ומעבר למפה"}
          <span aria-hidden style={{ display: "inline-flex" }}><Icon name="chevronEnd" size={15} strokeWidth={2.4} /></span>
        </Cta>}
      </div>
    </div>
  );
};

/* Premium summary card with icon, label, children, and an inline
   edit affordance. Replaces the old flat SummaryRow. */
const SummaryCard = ({ icon, label, children, onEdit }) => (
  <div style={{ borderRadius: 18, border: `1px solid ${T.line}`, background: "#fff", marginBottom: 10, overflow: "hidden", boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}>
    {/* Card header row */}
    <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "11px 14px 8px", borderBottom: `1px solid ${T.line}` }}>
      <span style={{ width: 32, height: 32, borderRadius: 10, background: T.surface2, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{icon}</span>
      <span style={{ flex: 1, fontSize: 11, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.07em", color: T.ink3 }}>{label}</span>
      <button onClick={onEdit}
        style={{ display: "inline-flex", alignItems: "center", gap: 5, border: `1px solid ${T.line}`, background: T.surface, borderRadius: 999, padding: "5px 12px", fontSize: 12, fontWeight: 700, color: T.ink2, cursor: "pointer", fontFamily: "inherit", flexShrink: 0 }}>
        <Icon name="edit" size={12} strokeWidth={2} /> עריכה
      </button>
    </div>
    {/* Card body */}
    <div style={{ padding: "12px 14px" }}>{children}</div>
  </div>
);

export default WizardView;
