import React, { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import tripService from "../services/tripService";
import { generateItinerary, itineraryToTripData, summarizeForRefine, fetchQuota } from "../services/aiTrip";
import { autocomplete } from "../services/googlePlaces";
import { classifyDestScope, matchCuratedCountry } from "../utils/destScope";
import DestinationFocus from "./DestinationFocus";
import Icon from "./Icon";

/* ══════════════════════════════════════════════════════════════
   AiTripModal — INITIATIVE 01 · "בניית מסלול בעזרת AI".
   Two phases: FORM (destination, origin, days, pace, interests,
   multi-transport, party, restrictions, instructions) → generate →
   REVIEW (a clear, detailed quick-view with per-day cards, crowd
   flags, notes, flights) with open / refine (≤2) / rebuild.
   ══════════════════════════════════════════════════════════════ */

const FONT = "'Noto Sans Hebrew','Inter','Noto Sans JP',system-ui,sans-serif";
const ACCENT = "#E0533F";
const MAX_REFINES = 2;

const PACES = [
  { key: "relaxed", label: "רגוע", sub: "2–3 עצירות", emoji: "🌿" },
  { key: "balanced", label: "מאוזן", sub: "4–5 עצירות", emoji: "⚖️" },
  { key: "intense", label: "אינטנסיבי", sub: "6+ עצירות", emoji: "⚡" },
];
const INTERESTS = [
  { key: "אוכל", emoji: "🍜" }, { key: "טבע", emoji: "🌲" }, { key: "היסטוריה", emoji: "🏛️" },
  { key: "אמנות", emoji: "🎨" }, { key: "קניות", emoji: "🛍️" }, { key: "חיי לילה", emoji: "🌃" },
  { key: "משפחות", emoji: "👨‍👩‍👧" }, { key: "נופים", emoji: "🏞️" },
];
const TRANSPORTS = [
  { key: "walking", label: "רגלית", emoji: "🚶" },
  { key: "transit", label: "תחב״צ", emoji: "🚇" },
  { key: "car", label: "רכב", emoji: "🚗" },
];
const RESTRICTIONS = [
  { key: "כשר", emoji: "✡️" }, { key: "צמחוני", emoji: "🥗" }, { key: "טבעוני", emoji: "🌱" },
  { key: "נגיש לנכים", emoji: "♿" }, { key: "מתאים לתינוק", emoji: "🍼" }, { key: "בלי הרבה הליכה", emoji: "🧭" },
];
const CAT_EMOJI = (c = "") =>
  /מלון|לינה/.test(c) ? "🏨" : /אוכל|מסעד/.test(c) ? "🍽️" : /קפה/.test(c) ? "☕" :
  /קניו|קניות|חנות/.test(c) ? "🛍️" : /טבע|פארק|גן/.test(c) ? "🌳" : /מוזי/.test(c) ? "🖼️" : "📍";

/* Little map-building loader shown while generating. */
const BuildLoader = ({ progress, label, T }) => (
  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "10px 0 4px" }}>
    <div style={{ position: "relative", width: 260, height: 152, borderRadius: 16, background: T.surface, overflow: "hidden", border: `1px solid ${T.line}` }}>
      <svg viewBox="0 0 260 152" width="260" height="152" style={{ animation: "tp-loader-pan 6s ease-in-out infinite" }}>
        {/* faint grid */}
        <g stroke={T.line} strokeWidth="1">
          {[38, 76, 114, 152, 190, 228].map((x) => <line key={x} x1={x} y1="0" x2={x} y2="152" />)}
          {[38, 76, 114].map((y) => <line key={y} x1="0" y1={y} x2="260" y2={y} />)}
        </g>
        {/* the route drawing itself */}
        <polyline className="tp-route-line" points="34,120 96,92 150,110 196,60 232,40"
          fill="none" stroke={ACCENT} strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" />
        {/* pins popping in sequence */}
        {[[34, 120], [96, 92], [150, 110], [196, 60], [232, 40]].map(([x, y], i) => (
          <g key={i} className="tp-loader-pin" style={{ animationDelay: `${i * 0.28}s`, transformBox: "fill-box" }} transform={`translate(${x},${y})`}>
            <circle cx="0" cy="0" r="7" fill="#fff" stroke={ACCENT} strokeWidth="3" />
          </g>
        ))}
      </svg>
    </div>
    <div style={{ fontSize: 40, fontWeight: 900, color: T.ink, marginTop: 16, fontVariantNumeric: "tabular-nums", letterSpacing: "-0.02em" }}>
      {Math.round(Math.min(100, progress))}<span style={{ fontSize: 22, color: T.ink3 }}>%</span>
    </div>
    <div style={{ fontSize: 14, fontWeight: 700, color: T.ink2, marginTop: 2 }}>{label}</div>
    <div style={{ fontSize: 11.5, color: T.ink3, marginTop: 8, textAlign: "center", lineHeight: 1.5, maxWidth: 280 }}>
      בונה מסלול אמיתי, מאמת מקומות ומסדר לפי קרבה — מסלולים ארוכים עד דקה ✨
    </div>
  </div>
);

const AiTripModal = ({ open, onClose, dark = false }) => {
  const navigate = useNavigate();
  const [phase, setPhase] = useState("form");
  const [destination, setDestination] = useState("");
  /* Destination MUST be picked from Google's city/region autocomplete so the
     LLM always gets a real, unambiguous place (free text like "לפקדה" produced
     an unparseable itinerary). `destChosen` gates submit. */
  const [destPreds, setDestPreds] = useState([]);
  const [destOpen, setDestOpen] = useState(false);
  const [destChosen, setDestChosen] = useState(false);
  const [destLoading, setDestLoading] = useState(false);
  const [, setDestTypes] = useState([]); // raw Google `types` for the picked destination (kept for downstream tasks)
  const [destScope, setDestScope] = useState("city");   // "country" | "region" | "city"
  const [curatedId, setCuratedId] = useState(null);
  const [focus, setFocus] = useState(null);             // { cities, label } | null
  const destTimer = useRef(null);
  const destBoxRef = useRef(null);
  const [origin, setOrigin] = useState("");
  const [dayCount, setDayCount] = useState(3);
  const [pace, setPace] = useState("balanced");
  const [interests, setInterests] = useState([]);
  const [transport, setTransport] = useState(["walking"]);
  const [adults, setAdults] = useState(2);
  const [kids, setKids] = useState(0);
  const [restrictions, setRestrictions] = useState([]);
  const [restrictText, setRestrictText] = useState("");
  const [instructions, setInstructions] = useState("");
  const [busy, setBusy] = useState(false);
  /* True only while the AI is (re)generating — initial build, refine, OR
     rebuild. Drives the full-screen build loader so an AI *update* gets the
     same loader as the first generation (not just a tiny text line). */
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState("");
  /* Set when a generation failed for a reason a RETRY can plausibly fix (model
     hiccup, network, verification) — as opposed to quota/cooldown/login, which
     retrying cannot help. Holds the args to replay, so the retry reproduces the
     exact request (same focus / refine) rather than a fresh one. */
  const [retryArgs, setRetryArgs] = useState(null);
  /* Consecutive non-actionable failures. Drives a two-step ladder: the FIRST
     failure invites a retry ("busy, try again"), the SECOND stops asking and
     says the feature is unavailable for now. Reset by a success or resetAll. */
  const [failCount, setFailCount] = useState(0);
  /* One-shot outcome banner for the retry itself, so a user who pressed
     "נסו שוב" is told whether it worked — success is otherwise only implied by
     the screen changing. "ok" | "fail" | null. */
  const [retryOutcome, setRetryOutcome] = useState(null);
  const [result, setResult] = useState(null);
  const [refineCount, setRefineCount] = useState(0);
  const [refineOpen, setRefineOpen] = useState(false);
  const [refineText, setRefineText] = useState("");

  // Weekly AI quota (server-authoritative) — powers the "X/3 השבוע" indicator.
  const [quota, setQuota] = useState(null); // { limit, used, remaining, resetsAt } | null
  const [progress, setProgress] = useState(0);
  const tickRef = useRef(null);
  const stopProgress = () => { if (tickRef.current) { clearInterval(tickRef.current); tickRef.current = null; } };
  const startProgress = () => {
    stopProgress();
    setProgress(6);
    const ease = Math.max(0.02, 0.09 - dayCount * 0.004);
    tickRef.current = setInterval(() => {
      setProgress((p) => (p >= 93 ? 93 : p + Math.max(0.3, (95 - p) * ease)));
    }, 340);
  };
  useEffect(() => stopProgress, []);
  useEffect(() => () => { if (destTimer.current) clearTimeout(destTimer.current); }, []);
  // Load the caller's weekly quota when the modal opens.
  useEffect(() => {
    if (!open) return;
    let live = true;
    fetchQuota().then((q) => { if (live && q) setQuota(q); }).catch(() => {});
    return () => { live = false; };
  }, [open]);

  const PROGRESS_STEPS = [
    { at: 0, label: "מתייעץ עם ה-AI על היעד…" },
    { at: 26, label: "מאתר מקומות שמתאימים לכם…" },
    { at: 52, label: "מאמת כל מקום מול Google Maps…" },
    { at: 76, label: "בודק עומסים ושעות פתיחה…" },
    { at: 88, label: "מסדר את המסלול לפי קרבה…" },
  ];
  const progressLabel = [...PROGRESS_STEPS].reverse().find((s) => progress >= s.at)?.label || PROGRESS_STEPS[0].label;

  if (!open) return null;

  const T = dark
    ? { panel: "#191B1F", surface: "#24272C", ink: "#F3F4F6", ink2: "#C7CBD1", ink3: "#8B9198", ink4: "#6B7178", line: "rgba(255,255,255,0.12)", page: "#0F1113" }
    : { panel: "#FFFFFF", surface: "#F6F6F4", ink: "#0D0F11", ink2: "#2A3036", ink3: "#6B7178", ink4: "#A4AAB1", line: "rgba(20,20,20,0.12)", page: "#FFFFFF" };

  const close = () => { if (busy) return; onClose && onClose(); setTimeout(resetAll, 200); };
  /* `focus` is a per-generation choice → reset it. `destScope` / `curatedId` /
     `destTypes` describe the still-selected destination, so leave them intact
     (a close+reopen after a country pick must still route through the focus
     step). `pickDest` sets all three fresh on every new pick. */
  const resetAll = () => { setPhase("form"); setResult(null); setError(""); setRetryArgs(null); setFailCount(0); setRetryOutcome(null); setRefineCount(0); setRefineOpen(false); setRefineText(""); setProgress(0); setFocus(null); };

  const toggleInterest = (k) => setInterests((p) => (p.includes(k) ? p.filter((x) => x !== k) : [...p, k]));
  const toggleTransport = (k) => setTransport((p) => (p.includes(k) ? p.filter((x) => x !== k) : [...p, k]));
  const toggleRestriction = (k) => setRestrictions((p) => (p.includes(k) ? p.filter((x) => x !== k) : [...p, k]));

  /* Debounced city/region autocomplete for the destination field. */
  const onDestChange = (value) => {
    setDestination(value);
    setDestChosen(false);
    setError("");
    if (destTimer.current) clearTimeout(destTimer.current);
    const q = value.trim();
    if (q.length < 2) { setDestPreds([]); setDestOpen(false); setDestLoading(false); return; }
    setDestLoading(true); setDestOpen(true);
    destTimer.current = setTimeout(async () => {
      try {
        /* `geocode` = countries, regions, cities, islands & neighbourhoods,
           but NOT businesses — the right granularity for a trip destination
           (and it finds small places like islands that (cities) misses). */
        const preds = await autocomplete(q, { types: ["geocode"] });
        setDestPreds(preds || []);
      } catch { setDestPreds([]); }
      finally { setDestLoading(false); }
    }, 260);
  };
  const pickDest = (p) => {
    const full = [p.primary, p.secondary].filter(Boolean).join(", ");
    setDestination(full);
    setDestChosen(true);
    const types = p.types || [];
    setDestTypes(types);
    setDestScope(classifyDestScope(types));
    setCuratedId(matchCuratedCountry(p.primary, p.secondary, types));
    setFocus(null);
    setDestOpen(false);
    setDestPreds([]);
    setError("");
  };

  // Destination must be picked from the list; quota must not be exhausted.
  // Admins have no cap (quota.admin) — never blocked.
  const outOfQuota = !!quota && !quota.admin && quota.remaining <= 0;
  const canSubmit = destChosen && destination.trim().length >= 2 && !busy && !outOfQuota;

  const runGenerate = async ({ refine, focus: focusArg } = {}) => {
    const effectiveFocus = focusArg !== undefined ? focusArg : focus;
    // Was this attempt launched from the error banner's retry button? Decides
    // whether the user gets an explicit success/failure verdict afterwards.
    const isRetry = failCount > 0;
    setBusy(true); setGenerating(true); setError(""); setRetryArgs(null); setRetryOutcome(null); startProgress();
    try {
      const res = await generateItinerary({
        destination: destination.trim(), dayCount, pace,
        preferences: interests, transport, instructions,
        party: { adults, kids },
        restrictions: [...restrictions, ...(restrictText.trim() ? [restrictText.trim()] : [])],
        focus: effectiveFocus || null,
        destScope,
        refine: refine || undefined,
        previous: refine && result ? summarizeForRefine(result) : undefined,
      });
      const verified = (res.days || []).reduce((n, d) => n + (d.spots || []).length, 0);
      if (!verified) throw new Error("לא הצלחנו לאמת מקומות ליעד הזה. נסו יעד או העדפות אחרות.");
      // Sync the weekly quota from the server's authoritative meta.
      if (res.meta && (res.meta.admin || Number.isFinite(res.meta.remaining))) {
        setQuota({ limit: res.meta.weeklyLimit, used: res.meta.used, remaining: res.meta.remaining, resetsAt: res.meta.resetsAt, admin: res.meta.admin });
      }
      setProgress(100);
      setResult(res); setPhase("review"); setRefineOpen(false); setRefineText("");
      if (refine) setRefineCount((c) => c + 1);
      setFailCount(0);
      if (isRetry) setRetryOutcome("ok"); // the retry worked — say so explicitly
    } catch (e) {
      // A rate-limit / cooldown error carries fresh quota numbers — reflect them.
      if (e && e.quota && Number.isFinite(e.quota.remaining)) {
        setQuota({ limit: e.quota.limit, used: e.quota.used, remaining: e.quota.remaining, resetsAt: e.quota.resetsAt });
      }
      // Only the INTENTIONAL, user-actionable messages (quota / cooldown / login)
      // are shown verbatim — those are written FOR the user and tell them what
      // to do. Everything else (server / model / network / verification) is a
      // system error: the raw text NEVER reaches the screen, only our console
      // and the server-side ai_errors log.
      //
      // Two-step ladder, so we neither cry outage on a one-off nor keep asking
      // someone to retry into a wall:
      //   1st failure → "busy right now, you can try again"  + retry button
      //   2nd failure → "unavailable right now, try later"   + no retry button
      const actionable = ["weekly-limit", "cooldown", "auth-required"].includes(e && e.code);
      if (actionable) {
        setError(e.message);
      } else {
        if (typeof console !== "undefined") console.warn("[ai-generate] failure:", (e && (e.message || e.code)) || e);
        const fails = failCount + 1;
        setFailCount(fails);
        if (fails >= 2) {
          setError("בניית מסלולים ב-AI לא זמינה כרגע. נסו שוב מאוחר יותר — בינתיים אפשר להמשיך להוסיף ולערוך מקומות ידנית.");
          if (isRetry) setRetryOutcome("fail"); // verdict on the retry they asked for
        } else {
          setError("יש עומס כרגע — אפשר לנסות שוב.");
          setRetryArgs({ refine, focus: effectiveFocus });
        }
      }
    } finally { stopProgress(); setBusy(false); setGenerating(false); }
  };

  const accept = async () => {
    if (!result || busy) return;
    setBusy(true); setError("");
    try {
      const seedDays = itineraryToTripData(result, { origin: origin.trim(), transport });
      const trip = await tripService.createNewTrip({
        title: destination.trim(),
        destination: destination.trim(), destinationHe: destination.trim(),
        days: seedDays.length,
        meta: `${seedDays.length} ימים · ${destination.trim()} · נוצר ב-AI`,
        transitOrigin: origin.trim() || "",
        seedDays,
      });
      onClose && onClose(); setTimeout(resetAll, 200);
      navigate(`/map/edit/${trip.id}`);
    } catch (e) {
      // Same rule as generation: a raw tripService/Supabase message is a system
      // error and never reaches the screen — it goes to our console only.
      if (typeof console !== "undefined") console.warn("[ai-accept] failure:", (e && (e.message || e.code)) || e);
      setError("שמירת המסלול לא הצליחה. נסו שוב.");
    } finally { setBusy(false); }
  };

  const pill = (on) => ({
    display: "inline-flex", alignItems: "center", gap: 7, padding: "9px 14px",
    borderRadius: 999, cursor: busy ? "default" : "pointer", fontFamily: FONT, fontSize: 13.5, fontWeight: 700,
    border: `1.5px solid ${on ? ACCENT : T.line}`, background: on ? "rgba(224,83,63,0.10)" : T.panel, color: on ? ACCENT : T.ink2,
    transition: "border-color 0.15s, background 0.15s",
  });
  const label = { display: "block", fontSize: 12.5, fontWeight: 800, color: T.ink3, margin: "18px 0 8px" };
  const inputStyle = (filled) => ({ width: "100%", boxSizing: "border-box", height: 48, padding: "0 14px", borderRadius: 14, border: `1.5px solid ${filled ? ACCENT : T.line}`, background: T.page, color: T.ink, fontSize: 15.5, fontFamily: "inherit", direction: "rtl", textAlign: "right", transition: "border-color 0.15s" });

  /* Outcome of an explicit "נסו שוב" — so pressing retry always ends in a
     stated verdict rather than the user inferring it. The failure verdict lives
     inside ErrorBox (the message there already says it); this renders the
     SUCCESS case, which otherwise has no words at all. */
  const RetryOk = ({ marginTop }) => retryOutcome !== "ok" ? null : (
    <div role="status" style={{ marginTop, padding: "10px 14px", borderRadius: 12, background: "rgba(31,122,80,0.10)", color: "#1F7A50", fontSize: 13, fontWeight: 700, lineHeight: 1.5 }}>
      ✓ הפעם זה עבד — הנה המסלול.
    </div>
  );

  /* The error banner. On the FIRST failure it carries the retry action itself —
     the user should never have to re-fill the form to find out a second attempt
     would have worked. On the second failure the retry is withdrawn: the message
     says to come back later, so offering the button again would contradict it. */
  const ErrorBox = ({ marginTop }) => !error ? null : (
    <div role="alert" style={{ marginTop, padding: "11px 14px", borderRadius: 12, background: "rgba(184,58,43,0.10)", color: "#C0392B", fontSize: 13, fontWeight: 700, lineHeight: 1.5 }}>
      {/* Verdict on a retry the user explicitly asked for — named as such, so
          the second attempt closes with an answer instead of a mood. */}
      {retryOutcome === "fail" && <div style={{ marginBlockEnd: 4 }}>גם הניסיון הנוסף לא הצליח.</div>}
      {error}
      {retryArgs && (
        <button onClick={() => runGenerate(retryArgs)} disabled={busy}
          style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 7, marginBlockStart: 10, minHeight: 44, paddingInline: 18, borderRadius: 999, border: "1.5px solid currentColor", background: "transparent", color: "inherit", fontSize: 13.5, fontWeight: 800, fontFamily: "inherit", cursor: busy ? "default" : "pointer" }}>
          <span aria-hidden>↻</span> נסו שוב
        </button>
      )}
    </div>
  );

  const Stepper = ({ value, set, min = 0, max = 20, aria }) => (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <button onClick={() => set(Math.max(min, value - 1))} disabled={busy || value <= min} aria-label={`פחות ${aria}`}
        style={{ width: 40, height: 40, borderRadius: 11, border: `1px solid ${T.line}`, background: T.surface, color: T.ink, fontSize: 20, cursor: "pointer", fontFamily: "inherit" }}>−</button>
      <div style={{ minWidth: 32, textAlign: "center", fontSize: 19, fontWeight: 800, fontVariantNumeric: "tabular-nums" }}>{value}</div>
      <button onClick={() => set(Math.min(max, value + 1))} disabled={busy || value >= max} aria-label={`עוד ${aria}`}
        style={{ width: 40, height: 40, borderRadius: 11, border: `1px solid ${T.line}`, background: T.surface, color: T.ink, fontSize: 20, cursor: "pointer", fontFamily: "inherit" }}>+</button>
    </div>
  );

  const totalSpots = result ? (result.days || []).reduce((n, d) => n + (d.spots || []).length, 0) : 0;
  /* Show the full build loader for ANY (re)generation — initial, refine, or
     rebuild — regardless of phase. `accept` (opening the map) keeps its own
     inline button text and is intentionally excluded. */
  const showLoader = generating;

  return (
    <div dir="rtl" onClick={close}
      style={{ position: "fixed", inset: 0, zIndex: 200, background: "rgba(8,10,14,0.55)", backdropFilter: "blur(3px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16, fontFamily: FONT }}>
      <div onClick={(e) => e.stopPropagation()} className="tp-pop"
        style={{ width: "100%", maxWidth: 500, maxHeight: "92vh", overflowY: "auto", background: T.panel, color: T.ink, borderRadius: 22, border: `1px solid ${T.line}`, boxShadow: "0 30px 90px rgba(0,0,0,0.45)", padding: "22px 22px 24px" }}>

        {/* Header */}
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, marginBottom: 4 }}>
          <div>
            <div style={{ display: "inline-flex", alignItems: "center", gap: 8, fontSize: 20, fontWeight: 800, letterSpacing: "-0.01em" }}>
              <span aria-hidden>✨</span> {showLoader ? (phase === "review" ? "מעדכן את המסלול…" : "בונה את המסלול…") : phase === "form" ? "יצירת מסלול עם AI" : phase === "focus" ? "על איזה אזור לכוון?" : "המסלול שלכם מוכן"}
            </div>
            {!showLoader && phase !== "focus" && (
              <div style={{ fontSize: 13, color: T.ink3, marginTop: 4 }}>
                {phase === "form" ? "תארו מה בא לכם — נבנה מסלול מלא עם מקומות אמיתיים." : "עברו על מה שבנינו — אפשר לפתוח, לתקן, או לבנות מחדש."}
              </div>
            )}
          </div>
          {!busy && (
            <button onClick={close} aria-label="סגירה"
              style={{ flexShrink: 0, width: 34, height: 34, borderRadius: "50%", border: "none", background: T.surface, color: T.ink2, cursor: "pointer", fontFamily: "inherit", display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
              <Icon name="x" size={15} strokeWidth={2.2} />
            </button>
          )}
        </div>

        {/* ── LOADER (replaces the form so it's centred, no scrolling) ── */}
        {showLoader && <BuildLoader progress={progress} label={progressLabel} T={T} />}

        {/* ── FORM ── */}
        {phase === "form" && !showLoader && (
          <>
            <label style={label}>יעד</label>
            <div ref={destBoxRef} style={{ position: "relative" }}>
              <input autoFocus value={destination} autoComplete="off"
                onChange={(e) => onDestChange(e.target.value)}
                onFocus={() => { if (destPreds.length && !destChosen) setDestOpen(true); }}
                onBlur={() => setTimeout(() => setDestOpen(false), 150)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    if (destOpen && destPreds.length && !destChosen) pickDest(destPreds[0]);
                    else if (canSubmit) { if ((destScope === "country" || destScope === "region") && !focus) setPhase("focus"); else runGenerate(); }
                  } else if (e.key === "Escape") setDestOpen(false);
                }}
                placeholder="לאן טסים? התחילו להקליד ובחרו מהרשימה"
                disabled={busy}
                style={{ ...inputStyle(destChosen ? destination : ""), paddingInlineStart: destChosen ? 38 : 14, borderColor: destChosen ? ACCENT : (destination.trim() && !destChosen ? "#E0A03F" : T.line) }} />
              {destChosen && (
                <span aria-hidden style={{ position: "absolute", insetInlineStart: 13, top: "50%", transform: "translateY(-50%)", color: "#2E9E6B", fontSize: 16, fontWeight: 900, pointerEvents: "none" }}>✓</span>
              )}
              {destOpen && !destChosen && destination.trim().length >= 2 && (
                <div style={{ position: "absolute", zIndex: 6, top: "calc(100% + 6px)", left: 0, right: 0, background: T.panel, border: `1px solid ${T.line}`, borderRadius: 12, boxShadow: "0 12px 34px rgba(0,0,0,0.22)", overflow: "hidden", maxHeight: 264, overflowY: "auto" }}>
                  {destLoading && destPreds.length === 0 ? (
                    <div style={{ padding: "13px 14px", fontSize: 13, color: T.ink3 }}>מחפש יעדים…</div>
                  ) : destPreds.length === 0 ? (
                    <div style={{ padding: "13px 14px", fontSize: 13, color: T.ink3, lineHeight: 1.5 }}>לא נמצא יעד תואם. נסו איות אחר או שם באנגלית.</div>
                  ) : destPreds.map((p) => (
                    <button key={p.placeId} type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => pickDest(p)}
                      style={{ display: "flex", alignItems: "center", gap: 10, width: "100%", textAlign: "right", padding: "11px 14px", borderTop: "none", borderInlineStart: "none", borderInlineEnd: "none", borderBottom: `1px solid ${T.line}`, background: "transparent", cursor: "pointer", fontFamily: "inherit", color: T.ink }}>
                      <span aria-hidden style={{ fontSize: 15, flexShrink: 0 }}>📍</span>
                      <span style={{ minWidth: 0, flex: 1 }}>
                        <span style={{ display: "block", fontSize: 14.5, fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{p.primary}</span>
                        {p.secondary && <span style={{ display: "block", fontSize: 12, color: T.ink3, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{p.secondary}</span>}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
            {destination.trim() && !destChosen && !destOpen && (
              <div style={{ fontSize: 12, color: "#C77A1E", marginTop: 6, fontWeight: 600 }}>בחרו יעד מרשימת ההשלמה כדי שנבנה מסלול מדויק.</div>
            )}

            <label style={label}>מאיפה טסים? <span style={{ fontWeight: 600 }}>(לא חובה — נוסיף טיסות)</span></label>
            <input value={origin} onChange={(e) => setOrigin(e.target.value)}
              placeholder="עיר/שדה תעופה מוצא, למשל תל אביב (TLV)" disabled={busy} style={inputStyle(origin)} />

            <div style={{ display: "flex", gap: 20, flexWrap: "wrap" }}>
              <div>
                <label style={label}>כמה ימים?</label>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <Stepper value={dayCount} set={(v) => setDayCount(Math.max(1, Math.min(14, v)))} min={1} max={14} aria="ימים" />
                  <span style={{ fontSize: 12.5, color: T.ink3 }}>עד 14</span>
                </div>
              </div>
            </div>

            <label style={label}>קצב</label>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {PACES.map((p) => (
                <button key={p.key} onClick={() => setPace(p.key)} disabled={busy} style={{ ...pill(pace === p.key), flexDirection: "column", alignItems: "flex-start", gap: 2, padding: "10px 14px" }}>
                  <span><span aria-hidden style={{ marginInlineEnd: 5 }}>{p.emoji}</span>{p.label}</span>
                  <span style={{ fontSize: 11, fontWeight: 600, color: pace === p.key ? ACCENT : T.ink3 }}>{p.sub}</span>
                </button>
              ))}
            </div>

            {/* Party composition */}
            <label style={label}>מי מטייל?</label>
            <div style={{ display: "flex", gap: 22, flexWrap: "wrap" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: T.ink2 }}>👤 מבוגרים</span>
                <Stepper value={adults} set={setAdults} min={1} max={20} aria="מבוגרים" />
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: T.ink2 }}>🧒 ילדים</span>
                <Stepper value={kids} set={setKids} min={0} max={20} aria="ילדים" />
              </div>
            </div>

            <label style={label}>מה אתם אוהבים? <span style={{ fontWeight: 600 }}>(אפשר כמה)</span></label>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {INTERESTS.map((it) => (
                <button key={it.key} onClick={() => toggleInterest(it.key)} disabled={busy} style={pill(interests.includes(it.key))}>
                  <span aria-hidden>{it.emoji}</span>{it.key}
                </button>
              ))}
            </div>

            <label style={label}>איך מתניידים? <span style={{ fontWeight: 600 }}>(אפשר כמה — נוסיף מעברים)</span></label>
            <div style={{ display: "flex", gap: 8 }}>
              {TRANSPORTS.map((t) => (
                <button key={t.key} onClick={() => toggleTransport(t.key)} disabled={busy} style={{ ...pill(transport.includes(t.key)), flex: 1, justifyContent: "center" }}>
                  <span aria-hidden>{t.emoji}</span>{t.label}
                </button>
              ))}
            </div>

            {/* Restrictions — chips + free text */}
            <label style={label}>הגבלות והעדפות <span style={{ fontWeight: 600 }}>(לא חובה)</span></label>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 8 }}>
              {RESTRICTIONS.map((r) => (
                <button key={r.key} onClick={() => toggleRestriction(r.key)} disabled={busy} style={pill(restrictions.includes(r.key))}>
                  <span aria-hidden>{r.emoji}</span>{r.key}
                </button>
              ))}
            </div>
            <input value={restrictText} onChange={(e) => setRestrictText(e.target.value)}
              placeholder="עוד משהו? (אלרגיות, ניידות, תקציב…)" disabled={busy}
              style={{ ...inputStyle(restrictText), height: 44, fontSize: 14.5 }} />

            <label style={label}>הנחיות מיוחדות <span style={{ fontWeight: 600 }}>(לא חובה)</span></label>
            <textarea value={instructions} onChange={(e) => setInstructions(e.target.value)}
              placeholder="למשל: יום אחד רגוע, הרבה אוכל מקומי, מתאים לילדים…" rows={2} disabled={busy}
              style={{ width: "100%", boxSizing: "border-box", padding: "11px 13px", borderRadius: 14, border: `1.5px solid ${instructions ? ACCENT : T.line}`, background: T.page, color: T.ink, fontSize: 14.5, fontFamily: "inherit", direction: "rtl", textAlign: "right", resize: "vertical", lineHeight: 1.5 }} />

            <ErrorBox marginTop={16} />

            <button onClick={() => {
              if ((destScope === "country" || destScope === "region") && !focus) { setPhase("focus"); return; }
              runGenerate();
            }} disabled={!canSubmit}
              style={{ marginTop: 20, width: "100%", height: 54, borderRadius: 999, border: "none", background: canSubmit ? ACCENT : (dark ? "#3A3D42" : "#D1CCC5"), color: "#fff", fontSize: 16, fontWeight: 800, cursor: canSubmit ? "pointer" : "default", fontFamily: "inherit", display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 9, boxShadow: canSubmit ? `0 6px 22px ${ACCENT}44` : "none" }}>
              <span aria-hidden>✨</span> {busy ? "בונה מסלול…" : "בנו לי מסלול"}
            </button>

            {/* Weekly AI quota indicator (admins: unlimited, just a count). */}
            {quota && (
              quota.admin ? (
                <div style={{ marginTop: 10, fontSize: 12.5, color: T.ink3, textAlign: "center", fontWeight: 600 }}>
                  ✨ אדמין · יצרת {quota.used ?? 0} מסלולים השבוע (ללא הגבלה)
                </div>
              ) : outOfQuota ? (
                <div style={{ marginTop: 12, padding: "12px 14px", borderRadius: 12, background: dark ? "rgba(255,255,255,0.05)" : "#F6F0E6", border: `1px solid ${T.line}`, fontSize: 12.5, color: T.ink2, lineHeight: 1.6, textAlign: "center" }}>
                  הגעת למכסת המסלולים השבועית ב-AI ({quota.limit}/{quota.limit}) — מתחדשת בתחילת השבוע הבא. בינתיים אפשר להמשיך להוסיף ולערוך מקומות ידנית.
                </div>
              ) : (
                <div style={{ marginTop: 10, fontSize: 12.5, color: T.ink3, textAlign: "center", fontWeight: 600 }}>
                  נשארו {quota.remaining}/{quota.limit} מסלולים ב-AI השבוע
                </div>
              )
            )}
          </>
        )}

        {/* ── FOCUS (country/region → region chips or city picker) ── */}
        {phase === "focus" && !showLoader && (
          <div style={{ padding: "4px 2px" }}>
            <DestinationFocus
              destName={destination.split(",")[0].trim()}
              scope={destScope}
              curatedId={curatedId}
              onPick={(pick) => { setFocus({ cities: pick.cities, label: pick.label }); setPhase("form"); runGenerate({ focus: { cities: pick.cities, label: pick.label } }); }}
              onSkip={() => { setPhase("form"); runGenerate({ focus: null }); }}
            />
            <button onClick={() => setPhase("form")}
              style={{ marginTop: 6, width: "100%", minHeight: 44, border: "none", background: "transparent", color: T.ink3, fontSize: 12.5, fontWeight: 800, cursor: "pointer", fontFamily: "inherit" }}>
              → חזרה
            </button>
          </div>
        )}

        {/* ── REVIEW (redesigned) ── */}
        {phase === "review" && result && !showLoader && (
          <>
            {result.description && (
              <div style={{ marginTop: 16, padding: "14px 16px", borderRadius: 14, background: "rgba(224,83,63,0.08)", border: `1px solid ${T.line}`, fontSize: 14.5, color: T.ink, lineHeight: 1.6, fontWeight: 500 }}>
                {result.description}
              </div>
            )}
            <div style={{ display: "flex", gap: 8, margin: "12px 0 4px", flexWrap: "wrap" }}>
              <span style={{ fontSize: 12, fontWeight: 800, color: T.ink2, background: T.surface, borderRadius: 999, padding: "5px 11px" }}>📅 {result.days.length} ימים</span>
              <span style={{ fontSize: 12, fontWeight: 800, color: T.ink2, background: T.surface, borderRadius: 999, padding: "5px 11px" }}>📍 {totalSpots} מקומות</span>
              {origin.trim() && <span style={{ fontSize: 12, fontWeight: 800, color: T.ink2, background: T.surface, borderRadius: 999, padding: "5px 11px" }}>✈️ טיסות</span>}
              {(adults + kids) > 0 && <span style={{ fontSize: 12, fontWeight: 800, color: T.ink2, background: T.surface, borderRadius: 999, padding: "5px 11px" }}>👥 {adults}{kids ? `+${kids}` : ""}</span>}
            </div>

            {origin.trim() && (
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 10, padding: "10px 13px", borderRadius: 12, background: T.surface, fontSize: 13, fontWeight: 700, color: T.ink2 }}>
                <span aria-hidden>✈️</span> נחיתה: {origin.trim()} → {result.days[0]?.city || destination}
              </div>
            )}

            {/* Day-by-day — detailed cards */}
            <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 12, maxHeight: "44vh", overflowY: "auto", paddingInlineEnd: 2 }}>
              {result.days.map((d) => (
                <div key={d.dayNumber} style={{ flexShrink: 0, border: `1px solid ${T.line}`, borderRadius: 16, overflow: "hidden", background: T.panel }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 9, padding: "11px 13px", background: T.surface }}>
                    <span style={{ flexShrink: 0, width: 26, height: 26, borderRadius: 8, background: ACCENT, color: "#fff", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 800 }}>{d.dayNumber}</span>
                    <span style={{ fontSize: 14, fontWeight: 800, color: T.ink }}>{d.title || `יום ${d.dayNumber}`}</span>
                    <span style={{ fontSize: 11, color: T.ink3, fontWeight: 700 }}>· {d.city}</span>
                    <span style={{ marginInlineStart: "auto", fontSize: 11, fontWeight: 700, color: T.ink3 }}>{(d.spots || []).length} מקומות</span>
                  </div>
                  <div style={{ padding: "6px 8px 8px" }}>
                    {(d.spots || []).map((s, i) => (
                      <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 9, padding: "8px 6px", borderTop: i ? `1px solid ${T.line}` : "none" }}>
                        <span aria-hidden style={{ flexShrink: 0, width: 26, height: 26, borderRadius: 8, background: T.surface, display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 15 }}>{CAT_EMOJI(s.category)}</span>
                        <span style={{ flex: 1, minWidth: 0 }}>
                          <span style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                            <span dir="auto" style={{ fontSize: 13.5, fontWeight: 700, color: T.ink }}>{s.name}</span>
                            {Number.isFinite(s.rating) && <span style={{ fontSize: 11, color: T.ink3, fontVariantNumeric: "tabular-nums" }}>★ {s.rating}</span>}
                            {s.crowd === "high" && <span style={{ fontSize: 10.5, fontWeight: 800, color: "#B26A00", background: "rgba(240,170,50,0.18)", borderRadius: 999, padding: "2px 7px" }}>⚠️ עלול להיות עמוס</span>}
                          </span>
                          {s.note && <span dir="auto" style={{ display: "block", fontSize: 12, color: T.ink3, marginTop: 2, lineHeight: 1.45 }}>{s.note}</span>}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            {origin.trim() && (
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 10, padding: "10px 13px", borderRadius: 12, background: T.surface, fontSize: 13, fontWeight: 700, color: T.ink2 }}>
                <span aria-hidden>✈️</span> חזרה: {result.days[result.days.length - 1]?.city || destination} → {origin.trim()}
              </div>
            )}

            {refineOpen && (
              <div style={{ marginTop: 14 }}>
                <textarea autoFocus value={refineText} onChange={(e) => setRefineText(e.target.value)}
                  placeholder="מה לשנות? למשל: יום 2 יותר רגוע, להוסיף עוד אוכל…" rows={2} disabled={busy}
                  style={{ width: "100%", boxSizing: "border-box", padding: "11px 13px", borderRadius: 12, border: `1.5px solid ${refineText ? ACCENT : T.line}`, background: T.page, color: T.ink, fontSize: 14, fontFamily: "inherit", direction: "rtl", textAlign: "right", resize: "none", lineHeight: 1.5 }} />
                <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                  <button onClick={() => runGenerate({ refine: refineText.trim() })} disabled={busy || refineText.trim().length < 2}
                    style={{ flex: 1, height: 44, borderRadius: 12, border: "none", background: ACCENT, color: "#fff", fontSize: 14, fontWeight: 800, cursor: busy || refineText.trim().length < 2 ? "default" : "pointer", opacity: busy || refineText.trim().length < 2 ? 0.6 : 1, fontFamily: "inherit" }}>
                    {busy ? "מעדכן…" : "עדכן את המסלול"}
                  </button>
                  <button onClick={() => setRefineOpen(false)} disabled={busy}
                    style={{ height: 44, padding: "0 16px", borderRadius: 12, border: `1px solid ${T.line}`, background: T.panel, color: T.ink2, fontSize: 14, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>ביטול</button>
                </div>
                <div style={{ fontSize: 11, color: T.ink4, marginTop: 6, textAlign: "center" }}>תיקון {refineCount + 1} מתוך {MAX_REFINES}</div>
              </div>
            )}

            <RetryOk marginTop={14} />
            <ErrorBox marginTop={14} />

            {!refineOpen && (
              <>
                <button onClick={accept} disabled={busy}
                  style={{ marginTop: 18, width: "100%", height: 54, borderRadius: 999, border: "none", background: ACCENT, color: "#fff", fontSize: 16, fontWeight: 800, cursor: busy ? "default" : "pointer", opacity: busy ? 0.7 : 1, fontFamily: "inherit", display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 9, boxShadow: `0 6px 22px ${ACCENT}44` }}>
                  {busy ? "פותח…" : "פתחו את המסלול לעריכה →"}
                </button>
                <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                  {refineCount < MAX_REFINES && (
                    <button onClick={() => setRefineOpen(true)} disabled={busy}
                      style={{ flex: 1, height: 46, borderRadius: 12, border: `1px solid ${T.line}`, background: T.panel, color: T.ink, fontSize: 13.5, fontWeight: 800, cursor: "pointer", fontFamily: "inherit", display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 7 }}>
                      <Icon name="edit" size={15} strokeWidth={2} color={T.ink2} /> תקנו משהו
                    </button>
                  )}
                  <button onClick={() => runGenerate()} disabled={busy}
                    style={{ flex: 1, height: 46, borderRadius: 12, border: `1px solid ${T.line}`, background: T.panel, color: T.ink, fontSize: 13.5, fontWeight: 800, cursor: "pointer", fontFamily: "inherit", display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 7 }}>
                    <span aria-hidden>🔄</span> בנו מחדש
                  </button>
                </div>
                {refineCount >= MAX_REFINES && (
                  <div style={{ fontSize: 11, color: T.ink3, marginTop: 8, textAlign: "center" }}>הגעתם למקסימום התיקונים — אפשר לפתוח ולערוך ידנית.</div>
                )}
              </>
            )}
          </>
        )}

      </div>
    </div>
  );
};

export default AiTripModal;
