import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import tripService, { MAX_ACTIVE_TRIPS } from "../services/tripService";
import { listFavoriteTrips } from "../services/favoritesService";
import isAdminEmail from "../utils/isAdmin";
import { useDarkMode } from "../utils/theme";
import MapCard from "../components/MapCard";
import Icon from "../components/Icon";
import SharePermissionsModal from "../components/SharePermissionsModal";
import PublishToGalleryModal from "../components/PublishToGalleryModal";
import SwipeBackContainer from "../components/SwipeBackContainer";
import ProductUpdatesModal from "../components/ProductUpdatesModal";
import AiTripModal from "../components/AiTripModal";
import useActiveTrip from "../utils/useActiveTrip";
import useIsDesktop from "../utils/useIsDesktop";
import DashboardDesktop from "./DashboardDesktop";

/* ──────────────────────────────────────────────────────────────
   DashboardView — premium "My Maps" profile dashboard.
   Header action row (name · theme · share) · identity (avatar +
   camera + PRO + email + edit) · 3-up stats · filter pills ·
   illustrated MapCard grid (overlay copy + ellipsis delete with
   confirm modal) · floating bottom dock.
   ────────────────────────────────────────────────────────────── */

const ACCENT = "#E0533F";
const FONT = "'Noto Sans Hebrew','Inter','Noto Sans JP',system-ui,sans-serif";

const Circle = ({ children, onClick, title, P }) => (
  <button onClick={onClick} title={title} className="tp-press"
    style={{ width: 40, height: 40, borderRadius: "50%", border: `1px solid ${P.line}`, background: P.surface, color: P.ink, cursor: "pointer", fontSize: 16, fontFamily: "inherit", display: "flex", alignItems: "center", justifyContent: "center" }}>
    {children}
  </button>
);

const DashboardView = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [trips, setTrips] = useState(null);
  const [filter, setFilter] = useState("mine"); // default to the user's OWN maps
  /* "מועדפים" tab — Supabase-backed favorites (distinct from the device-local
     star toggle below), fetched lazily only while that tab is active. */
  const [favoriteTrips, setFavoriteTrips] = useState(null);
  /* Favorite maps — a personal quick-access flag (device-local). Favorites
     float to the top of the list and show a gold star. */
  const [favorites, setFavorites] = useState(() => {
    try { return new Set(JSON.parse(localStorage.getItem("tp_favorites_v1") || "[]")); } catch { return new Set(); }
  });
  const toggleFavorite = (trip) => setFavorites((prev) => {
    const next = new Set(prev);
    if (next.has(trip.id)) next.delete(trip.id); else next.add(trip.id);
    try { localStorage.setItem("tp_favorites_v1", JSON.stringify([...next])); } catch { /* storage off */ }
    return next;
  });
  const { dark, toggle: toggleTheme, P } = useDarkMode();
  const [aiOpen, setAiOpen] = useState(false); // Sprint 67 — AI trip generator
  /* Landing "בנה לי מסלול אוטומטי" sets tp_open_ai before routing here (incl.
     through the SSO redirect) — open the AI form on arrival, once. */
  useEffect(() => {
    try {
      if (sessionStorage.getItem("tp_open_ai") === "1") {
        sessionStorage.removeItem("tp_open_ai");
        setAiOpen(true);
      }
    } catch { /* storage off */ }
  }, []);
  const [confirmTrip, setConfirmTrip] = useState(null);
  const [toast, setToast] = useState("");
  /* Which trip's share/permissions modal is open (null = closed). */
  const [permissionModalTripId, setPermissionModalTripId] = useState(null);
  /* Which trip's publish-to-gallery modal is open (also doubles as the
     rename / cover-change sheet — it already surfaces both fields). */
  const [publishTrip, setPublishTrip] = useState(null);
  /* Sprint 40 — dashboard load state. `loadError` surfaces a clean retry
     block instead of an endless skeleton; `reloadKey` re-runs the fetch. */
  const [loadError, setLoadError] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const activeId = useActiveTrip();
  /* Desktop (≥1024px) widens the board and lays the cards out as a grid.
     Every use of `isDesktop` below is additive — when false, the mobile
     layout renders byte-for-byte as before. */
  const isDesktop = useIsDesktop();
  /* Constrains the profile controls (identity/stats/filters/CTA/account) on
     desktop so they don't stretch grotesquely across the wide board, while
     the card grid uses the full width. */
  const deskNarrow = isDesktop ? { maxWidth: 560 } : null;

  /* Sprint 40 — the fetch is now fully guarded: EVERY path (success, empty,
     network error, RLS block) resolves the loading state so the skeleton
     never loops. On failure we render 0 trips + a retry affordance. */
  useEffect(() => {
    let live = true;
    setLoadError(false);
    setTrips(null); // show the skeleton while (re)loading
    (async () => {
      try {
        const list = await tripService.fetchAllTrips(user?.id);
        if (live) setTrips(Array.isArray(list) ? list : []);
      } catch (err) {
        if (live) { setTrips([]); setLoadError(true); } // resolve loader → error UI
      }
    })();
    return () => { live = false; };
  }, [user, reloadKey]);

  /* "מועדפים" tab data — fetched only when that tab is selected, and
     re-fetched whenever the dashboard reload key bumps. */
  useEffect(() => {
    if (filter !== "favorites") return;
    let live = true;
    setFavoriteTrips(null); // show the skeleton while (re)loading
    listFavoriteTrips()
      .then((list) => { if (live) setFavoriteTrips(list); })
      .catch(() => { if (live) setFavoriteTrips([]); });
    return () => { live = false; };
  }, [filter, reloadKey]);

  const showToast = (m) => { setToast(m); setTimeout(() => setToast(""), 1500); };

  const counts = useMemo(() => {
    const list = trips || [];
    return { all: list.length, mine: list.filter((t) => t.role === "owner").length, shared: list.filter((t) => t.role !== "owner").length };
  }, [trips]);

  const stats = useMemo(() => {
    const list = trips || [];
    const countries = new Set(list.map((t) => t.settings?.destinationHe || t.settings?.destination || t.title).filter(Boolean));
    return { trips: list.length, countries: countries.size, days: list.reduce((s, t) => s + (t.days || 0), 0) };
  }, [trips]);

  /* SaaS tier gate — once the account holds MAX_ACTIVE_TRIPS maps the
     "create" flow locks until a trip is deleted (which updates `trips`
     and re-evaluates this immediately). Counts only maps the user OWNS —
     a map someone else shared with you does NOT count against your quota. */
  const tripCount = counts.mine;
  const admin = isAdminEmail(user?.email);   // admins: no map cap (still counted)
  const atTripCap = !admin && tripCount >= MAX_ACTIVE_TRIPS;

  const filtered = useMemo(() => {
    // "מועדפים" tab — its own async-loaded list (may be null while loading,
    // which correctly falls through to the existing skeleton state below).
    if (filter === "favorites") return favoriteTrips;
    if (!trips) return null;
    const scoped = filter === "mine" ? trips.filter((t) => t.role === "owner")
      : filter === "shared" ? trips.filter((t) => t.role !== "owner")
      : trips;
    // Favorites float to the top (stable within each group).
    return scoped.slice().sort((a, b) => (favorites.has(b.id) ? 1 : 0) - (favorites.has(a.id) ? 1 : 0));
  }, [trips, filter, favorites, favoriteTrips]);

  const openTrip = (t) => navigate(`/trip/overview/${t.id}`);
  const confirmDelete = () => {
    const t = confirmTrip; setConfirmTrip(null);
    if (!t) return;
    /* Optimistic remove — but if the backend delete FAILS (e.g. an RLS
       policy blocked it), restore the card and tell the user, instead of
       silently swallowing it (which made "deleted" trips reappear on reload). */
    setTrips((prev) => (prev || []).filter((x) => x.id !== t.id));
    tripService.deleteTrip(t.id).catch((e) => {
      setTrips((prev) => [t, ...(prev || []).filter((x) => x.id !== t.id)]);
      showToast("מחיקת המפה נכשלה — נסו שוב");
      // eslint-disable-next-line no-console
      console.error("deleteTrip failed:", e?.message || e);
    });
  };

  /* Sprint 19.3 — persist a per-trip sticky memo (optimistic update). */
  const saveTripMemo = (t, memo) => {
    const clean = (memo || "").trim();
    setTrips((prev) => (prev || []).map((x) => (x.id === t.id ? { ...x, tripMemo: clean || undefined } : x)));
    tripService.saveTripMemo(t.id, clean).catch(() => {});
  };

  const FILTERS = [
    { id: "mine", label: "המפות שלי", n: counts.mine },
    { id: "shared", label: "שותפו איתי", n: counts.shared },
    { id: "all", label: "הכל", n: counts.all },
    { id: "favorites", label: "מועדפים ⭐" },
  ];

  return (
    <SwipeBackContainer>
    {/* Sprint 44 #1 — product updates popup (self-gates on last_viewed_sprint). */}
    <ProductUpdatesModal />
    <div dir="rtl" style={{ minHeight: "100vh", background: P.page, fontFamily: FONT, transition: "background 0.25s" }}>
      {isDesktop ? (
        <DashboardDesktop
          user={user} P={P} dark={dark} toggleTheme={toggleTheme} navigate={navigate}
          stats={stats} counts={counts} FILTERS={FILTERS} filter={filter} setFilter={setFilter}
          filtered={filtered} loadError={loadError} onRetry={() => setReloadKey((k) => k + 1)}
          tripCount={tripCount} atTripCap={atTripCap} maxTrips={MAX_ACTIVE_TRIPS} activeId={activeId}
          openTrip={openTrip} onShare={(id) => setPermissionModalTripId(id)}
          onSaveMemo={saveTripMemo} onDelete={(t) => setConfirmTrip(t)} showToast={showToast}
          onCreateAi={() => setAiOpen(true)}
          favorites={favorites} onToggleFavorite={toggleFavorite}
          onPublish={(t) => setPublishTrip(t)}
        />
      ) : (
      <div className="tp-fade" style={{ maxWidth: 560, margin: "0 auto", background: P.panel, minHeight: "100vh", paddingBottom: 96, paddingInline: 0, transition: "background 0.25s, max-width 0.2s" }}>

        {/* Header action row — on desktop a sticky, frosted top nav (Apple
            material): brand on the right (RTL), actions on the left. */}
        <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: isDesktop ? "14px 18px" : "16px 18px 8px",
          ...(isDesktop ? {
            position: "sticky", top: 0, zIndex: 30, marginInline: -16, paddingInline: 34,
            background: dark ? "rgba(20,19,23,0.7)" : "rgba(255,255,255,0.72)",
            backdropFilter: "blur(20px) saturate(180%)", WebkitBackdropFilter: "blur(20px) saturate(180%)",
            borderBottom: `1px solid ${P.line}`,
          } : null) }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ fontSize: isDesktop ? 22 : 20, fontWeight: 800, letterSpacing: "-0.022em", color: P.ink }}>המפות שלי</div>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <Circle P={P} title={dark ? "מצב בהיר" : "מצב כהה"} onClick={toggleTheme}>
              <Icon name={dark ? "sun" : "moon"} size={18} strokeWidth={1.9} />
            </Circle>
            <Circle P={P} title="שיתוף פרופיל" onClick={() => { navigator.clipboard?.writeText(window.location.origin).catch(() => {}); showToast("הקישור הועתק"); }}>
              <Icon name="share" size={17} strokeWidth={1.9} />
            </Circle>
          </div>
        </header>

        {/* Identity */}
        <section style={{ display: "flex", alignItems: "center", gap: 16, padding: "10px 22px 18px", ...deskNarrow }}>
          <div style={{ position: "relative", flexShrink: 0 }}>
            <div style={{ width: 76, height: 76, borderRadius: "50%", background: `linear-gradient(145deg, ${ACCENT}, #B83A2B)`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 30, fontWeight: 800, color: "#fff" }}>
              {(user?.name || "?").trim().slice(0, 1)}
            </div>
            <button title="החלפת תמונה" aria-label="החלפת תמונת פרופיל" className="tp-press" style={{ position: "absolute", bottom: -2, insetInlineStart: -2, width: 28, height: 28, borderRadius: "50%", border: `3px solid ${P.panel}`, background: P.ink, color: P.panel, cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Icon name="camera" size={13} strokeWidth={2} />
            </button>
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 21, fontWeight: 800, letterSpacing: "-0.02em", color: P.ink }}>{user?.name}</span>
              {user?.plan && <span style={{ fontSize: 10, fontWeight: 800, textTransform: "uppercase", color: ACCENT, background: "rgba(224,83,63,0.12)", borderRadius: 999, padding: "2px 8px" }}>{user.plan}</span>}
            </div>
            <div style={{ fontSize: 13, color: P.ink3, direction: "ltr", textAlign: "right", marginTop: 2 }}>{user?.email}</div>
            <button onClick={() => navigate("/settings")} className="tp-press" style={{ display: "inline-flex", alignItems: "center", gap: 6, marginTop: 8, padding: "5px 12px", borderRadius: 999, border: `1px solid ${P.line}`, background: P.surface, fontSize: 12, fontWeight: 700, color: P.ink, cursor: "pointer", fontFamily: "inherit" }}>
              <Icon name="edit" size={12} strokeWidth={2} />
              ערכו פרופיל
            </button>
          </div>
        </section>

        {/* Stats grid */}
        <section style={{ padding: "0 22px 18px", ...deskNarrow }}>
          <div style={{ display: "flex", background: P.surface, borderRadius: 18, overflow: "hidden" }}>
            {[{ n: stats.trips, l: "מסלולים" }, { n: stats.countries, l: "מדינות" }, { n: stats.days, l: "ימי טיול" }].map((s, i) => (
              <div key={s.l} style={{ flex: 1, textAlign: "center", padding: "14px 0", borderInlineStart: i ? `1px solid ${P.line}` : "none" }}>
                <div style={{ fontSize: 23, fontWeight: 800, letterSpacing: "-0.015em", color: P.ink, fontVariantNumeric: "tabular-nums" }}>{s.n}</div>
                <div style={{ fontSize: 11.5, color: P.ink3, marginTop: 2 }}>{s.l}</div>
              </div>
            ))}
          </div>
        </section>

        {/* Example trip — so a new user has an itinerary to explore. */}
        <section style={{ padding: "0 22px 16px", ...deskNarrow }}>
          <button onClick={() => navigate("/japan")} className="tp-press"
            style={{ width: "100%", display: "flex", alignItems: "center", gap: 13, padding: "13px 15px", borderRadius: 16, border: `1px solid ${P.line}`, background: `linear-gradient(135deg, ${dark ? "rgba(224,83,63,0.10)" : "rgba(224,83,63,0.06)"}, ${P.surface})`, cursor: "pointer", fontFamily: "inherit", textAlign: "start" }}>
            <span aria-hidden style={{ flexShrink: 0, width: 44, height: 44, borderRadius: 12, background: `linear-gradient(145deg, ${ACCENT}, #B83A2B)`, display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 22 }}>🗾</span>
            <span style={{ flex: 1, minWidth: 0 }}>
              <span style={{ display: "block", fontSize: 14.5, fontWeight: 800, color: P.ink }}>מסלול לדוגמה — יפן</span>
              <span style={{ display: "block", fontSize: 12, color: P.ink3, marginTop: 1 }}>קבלו השראה ממסלול מלא, מוכן לצפייה</span>
            </span>
            <Icon name="chevronStart" size={16} strokeWidth={2.2} color={P.ink3} />
          </button>
        </section>

        {/* Filter pills */}
        <section style={{ padding: "0 22px 14px", ...deskNarrow }}>
          <div style={{ display: "flex", gap: 4, background: P.surface, borderRadius: 999, padding: 4 }}>
            {FILTERS.map((f) => {
              const on = filter === f.id;
              return (
                <button key={f.id} onClick={() => setFilter(f.id)}
                  style={{ flex: 1, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6, padding: "9px 0", borderRadius: 999, border: "none", cursor: "pointer", fontFamily: "inherit", fontSize: 13, fontWeight: 700, background: on ? P.panel : "transparent", color: on ? P.ink : P.ink3, boxShadow: on ? "0 1px 4px rgba(0,0,0,0.10)" : "none" }}>
                  {f.label}
                  <span style={{ fontSize: 10.5, fontWeight: 800, background: on ? P.surface2 : "transparent", color: on ? P.ink2 : P.ink4, borderRadius: 999, padding: "1px 7px" }}>{f.n}</span>
                </button>
              );
            })}
          </div>
        </section>

        {/* New map CTA — Sprint 22 #2: at the SaaS tier ceiling the card
            itself flips to a destructive-red warning state (disabled click,
            red border/surface/text + an explicit quota sub-label) instead of
            being swapped out for a separate banner. */}
        {/* Sprint 67 — AI trip generator: the primary, most inviting create path. */}
        <section style={{ padding: "0 22px 12px", ...deskNarrow }}>
          <button
            onClick={atTripCap ? undefined : () => setAiOpen(true)}
            disabled={atTripCap}
            aria-disabled={atTripCap}
            title={atTripCap ? "הגעת למכסת המפות המקסימלית לחשבון חינמי" : "יצירת מסלול עם AI"}
            className={atTripCap ? undefined : "tp-press"}
            style={{
              display: "flex", alignItems: "center", gap: 12, padding: 15,
              border: "none", borderRadius: 18, width: "100%", fontFamily: "inherit", textAlign: "right",
              cursor: atTripCap ? "not-allowed" : "pointer", opacity: atTripCap ? 0.5 : 1,
              background: "linear-gradient(135deg, #E0533F, #C0392B)", color: "#fff",
              boxShadow: atTripCap ? "none" : "0 8px 26px rgba(224,83,63,0.34)",
            }}>
            <span style={{ width: 44, height: 44, borderRadius: 14, background: "rgba(255,255,255,0.18)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, fontSize: 22 }} aria-hidden>✨</span>
            <span style={{ flex: 1, minWidth: 0 }}>
              <span style={{ display: "block", fontSize: 15.5, fontWeight: 800 }}>צור מסלול עם AI</span>
              <span style={{ display: "block", fontSize: 12, color: "rgba(255,255,255,0.85)", marginTop: 2, lineHeight: 1.5 }}>תארו יעד והעדפות — נבנה מסלול מלא בשניות</span>
            </span>
            <span aria-hidden style={{ flexShrink: 0, opacity: 0.9 }}><Icon name="chevronStart" size={18} strokeWidth={2.4} color="#fff" /></span>
          </button>
        </section>

        <section style={{ padding: "0 22px 12px", ...deskNarrow }}>
          <button
            onClick={atTripCap ? undefined : () => navigate("/create")}
            disabled={atTripCap}
            aria-disabled={atTripCap}
            title={atTripCap ? "הגעת למכסת המפות המקסימלית לחשבון חינמי" : "יצירת מסלול חדש"}
            className={atTripCap ? undefined : "tp-press"}
            style={{
              display: "flex", alignItems: "center", gap: 12, padding: 14,
              border: atTripCap ? "1.5px solid #C0392B" : `1px dashed ${P.line}`,
              borderRadius: 18,
              background: atTripCap ? "rgba(192,57,43,0.07)" : "transparent",
              cursor: atTripCap ? "not-allowed" : "pointer",
              width: "100%", fontFamily: "inherit", textAlign: "right",
            }}>
            <span style={{ width: 44, height: 44, borderRadius: 14, background: atTripCap ? "rgba(192,57,43,0.14)" : P.ink, color: atTripCap ? "#C0392B" : P.panel, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <Icon name={atTripCap ? "shield" : "plus"} size={atTripCap ? 20 : 22} strokeWidth={2.2} />
            </span>
            <span style={{ flex: 1, minWidth: 0 }}>
              <span style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14.5, fontWeight: 800, color: atTripCap ? "#C0392B" : P.ink }}>
                מסלול חדש
                <span style={{ fontSize: 11, fontWeight: 800, color: atTripCap ? "#C0392B" : (admin ? "#0C8B94" : P.ink3), background: atTripCap ? "rgba(192,57,43,0.14)" : (admin ? "rgba(12,139,148,0.12)" : P.surface), borderRadius: 999, padding: "2px 9px", fontVariantNumeric: "tabular-nums" }}>
                  {admin ? `${tripCount} · ∞` : `${tripCount}/${MAX_ACTIVE_TRIPS}`}
                </span>
              </span>
              <span role={atTripCap ? "status" : undefined} aria-live={atTripCap ? "polite" : undefined}
                style={{ display: "block", fontSize: 12, color: atTripCap ? "#A03325" : P.ink3, marginTop: 2, lineHeight: 1.5 }}>
                {atTripCap
                  ? "הגעת למכסת המפות המקסימלית לחשבון חינמי. יש למחוק מפה קיימת כדי ליצור חדשה."
                  : admin
                    ? `✨ אדמין · ${tripCount} מפות (ללא הגבלה)`
                    : "התחילו מאפס או מתבנית מוכנה"}
              </span>
            </span>
          </button>
        </section>

        {/* Cards */}
        <section style={{ padding: "0 22px" }}>
          {filtered === null ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {[0, 1, 2].map((i) => <div key={i} style={{ height: 116, borderRadius: 20, background: `linear-gradient(90deg, ${P.surface}, ${P.surface2}, ${P.surface})`, backgroundSize: "200% 100%", animation: "tpSkeleton 1.2s ease infinite" }} />)}
            </div>
          ) : loadError ? (
            /* Sprint 40 — the load failed (network / RLS / server). We show a
               clean, actionable state instead of looping the skeleton. */
            <div className="tp-fade-up" style={{ textAlign: "center", padding: "32px 16px 12px", display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
              <div style={{ width: 64, height: 64, borderRadius: "50%", background: "rgba(192,57,43,0.10)", color: "#C0392B", display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
                <Icon name="shield" size={26} strokeWidth={1.8} />
              </div>
              <div style={{ fontSize: 15, fontWeight: 800, color: P.ink }}>לא הצלחנו לטעון את המסלולים</div>
              <div style={{ fontSize: 13, color: P.ink3, lineHeight: 1.55, maxWidth: 300 }}>
                ייתכן שיש בעיית רשת או הרשאות. המסלולים שלכם שמורים — אפשר לנסות שוב.
              </div>
              <button onClick={() => setReloadKey((k) => k + 1)} className="tp-press"
                style={{ marginTop: 4, padding: "11px 22px", borderRadius: 999, border: "none", background: P.ink, color: P.panel, fontSize: 13.5, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", display: "inline-flex", alignItems: "center", gap: 8 }}>
                <span aria-hidden style={{ fontSize: 15, lineHeight: 1 }}>↻</span> נסו שוב
              </button>
            </div>
          ) : filtered.length === 0 ? (
            <div className="tp-fade-up" style={{ textAlign: "center", padding: "36px 16px 12px", display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
              <div style={{ width: 64, height: 64, borderRadius: "50%", background: P.surface, color: P.ink3, display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
                <Icon name="map" size={28} strokeWidth={1.6} />
              </div>
              <div style={{ fontSize: 15, fontWeight: 800, color: P.ink }}>
                {filter === "favorites" ? "עדיין אין מועדפים — סמנו מפות בגלריה ⭐" : "אין כאן מסלולים עדיין"}
              </div>
              {filter !== "favorites" && (
                <>
                  <div style={{ fontSize: 13, color: P.ink3, lineHeight: 1.55, maxWidth: 280 }}>בנו את המסלול הראשון שלכם — נמלא יעדים, ימים וערים תוך דקה.</div>
                  <button onClick={() => navigate("/create")} className="tp-press"
                    style={{ marginTop: 4, padding: "11px 22px", borderRadius: 999, border: "none", background: P.ink, color: P.panel, fontSize: 13.5, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", display: "inline-flex", alignItems: "center", gap: 8 }}>
                    <Icon name="plus" size={15} strokeWidth={2.2} /> מסלול חדש
                  </button>
                </>
              )}
            </div>
          ) : (
            <div style={isDesktop
              ? { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: 16, alignItems: "start" }
              : { display: "flex", flexDirection: "column", gap: 12 }}>
              {filtered.map((t, i) => (
                <MapCard
                  key={t.id}
                  trip={t}
                  index={i}
                  dark={dark}
                  active={t.id === activeId}
                  onOpen={() => openTrip(t)}
                  /* Sprint 18.1: only owners may share — collaborators get no
                     share handler, so the affordance never renders for them. */
                  onShare={t.role === "owner" ? () => setPermissionModalTripId(t.id) : undefined}
                  onSaveMemo={saveTripMemo}
                  onDelete={() => setConfirmTrip(t)}
                  favorite={favorites.has(t.id)}
                  onToggleFavorite={toggleFavorite}
                  onPublish={() => setPublishTrip(t)}
                  onRename={() => setPublishTrip(t)}
                  onEditCover={() => setPublishTrip(t)}
                />
              ))}
            </div>
          )}

          {filtered && !loadError && (
            <div style={{ textAlign: "center", fontSize: 12, color: P.ink4, marginTop: 18 }}>
              נוצרו {counts.all} מסלולים
            </div>
          )}
        </section>

        {/* Account rows (merged from the old Profile screen). */}
        <section style={{ padding: "0 22px 28px", ...deskNarrow }}>
          <div style={{ borderRadius: 18, border: `1px solid ${P.line}`, overflow: "hidden" }}>
            {[
              { icon: "settings", label: "הגדרות וניהול",   sub: "שפה, יחידות, התראות, פרטיות" },
              { icon: "download", label: "מפות לא־מקוונות", sub: "זמינות גם בלי רשת" },
            ].map((r, i) => (
              <button key={r.label} onClick={() => navigate("/settings")} className="tp-press"
                style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 16px", borderTop: i ? `1px solid ${P.line}` : "none", width: "100%", background: "transparent", border: "none", cursor: "pointer", fontFamily: "inherit", textAlign: "right" }}>
                <span style={{ width: 34, height: 34, borderRadius: 10, background: P.surface, display: "flex", alignItems: "center", justifyContent: "center", color: P.ink2 }}>
                  <Icon name={r.icon} size={17} strokeWidth={1.9} />
                </span>
                <span style={{ flex: 1 }}>
                  <span style={{ display: "block", fontSize: 14.5, fontWeight: 600, color: P.ink }}>{r.label}</span>
                  <span style={{ display: "block", fontSize: 12, color: P.ink3, marginTop: 1 }}>{r.sub}</span>
                </span>
                <span style={{ color: P.ink4, display: "inline-flex" }}>
                  <Icon name="chevronEnd" size={16} strokeWidth={2} />
                </span>
              </button>
            ))}
          </div>
        </section>
      </div>
      )}

      {/* Delete confirm modal */}
      {confirmTrip && (
        <div style={{ position: "fixed", inset: 0, zIndex: 70, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
          <div onClick={() => setConfirmTrip(null)} className="tp-fade" style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.45)" }} />
          <div className="tp-pop" dir="rtl" style={{ position: "relative", width: "100%", maxWidth: 360, background: P.panel, borderRadius: 22, padding: "24px 22px", boxShadow: "0 30px 80px rgba(0,0,0,0.4)", textAlign: "center", fontFamily: FONT }}>
            <div style={{ fontSize: 34, marginBottom: 8 }}>🗑️</div>
            <div style={{ fontSize: 18, fontWeight: 800, letterSpacing: "-0.012em", color: P.ink, marginBottom: 6 }}>מחיקת מפה</div>
            <div style={{ fontSize: 14, color: P.ink3, lineHeight: 1.5, marginBottom: 20 }}>
              האם אתה בטוח שברצונך למחוק את "{confirmTrip.title}"?<br />הפעולה אינה הפיכה.
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => setConfirmTrip(null)} style={{ flex: 1, height: 48, borderRadius: 999, border: `1px solid ${P.line}`, background: P.surface, color: P.ink, fontSize: 14.5, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>ביטול</button>
              <button onClick={confirmDelete} style={{ flex: 1, height: 48, borderRadius: 999, border: "none", background: "#C0392B", color: "#fff", fontSize: 14.5, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>מחק מפה</button>
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div className="tp-fade" style={{ position: "fixed", bottom: 84, left: "50%", transform: "translateX(-50%)", zIndex: 80, background: "#0D0F11", color: "#fff", borderRadius: 999, padding: "10px 20px", fontSize: 13.5, fontWeight: 600, fontFamily: FONT }}>
          {toast}
        </div>
      )}

      {/* Share / permissions modal — Google-Sheets-style invite sheet.
          Mounted once at the render-tree root, driven by which card's
          share button was tapped. */}
      {permissionModalTripId && (
        <SharePermissionsModal
          tripId={permissionModalTripId}
          onClose={() => setPermissionModalTripId(null)}
          onChanged={(updated) =>
            setTrips((prev) => (prev || []).map((t) => (t.id === updated.id ? { ...t, ...updated } : t)))
          }
        />
      )}

      {/* Publish-to-gallery modal — also doubles as the rename / cover
          editor (opened from the card's ellipsis menu). */}
      {publishTrip && (
        <PublishToGalleryModal
          trip={publishTrip}
          onClose={() => setPublishTrip(null)}
          onDone={() => { setPublishTrip(null); }}
        />
      )}

      <AiTripModal open={aiOpen} onClose={() => setAiOpen(false)} dark={dark} />

      <style>{`@keyframes tpSkeleton{0%{background-position:200% 0}100%{background-position:-200% 0}}`}</style>
    </div>
    </SwipeBackContainer>
  );
};

export default DashboardView;
