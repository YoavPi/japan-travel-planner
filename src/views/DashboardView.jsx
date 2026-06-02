import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import tripService from "../services/tripService";
import { useDarkMode } from "../utils/theme";
import MapCard from "../components/MapCard";
import BottomDock from "../components/BottomDock";

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
  const [filter, setFilter] = useState("all");
  const { dark, toggle: toggleTheme, P } = useDarkMode();
  const [confirmTrip, setConfirmTrip] = useState(null);
  const [toast, setToast] = useState("");

  useEffect(() => {
    let live = true;
    tripService.fetchAllTrips(user?.id).then((list) => { if (live) setTrips(list); });
    return () => { live = false; };
  }, [user]);

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

  const filtered = useMemo(() => {
    if (!trips) return null;
    if (filter === "mine") return trips.filter((t) => t.role === "owner");
    if (filter === "shared") return trips.filter((t) => t.role !== "owner");
    return trips;
  }, [trips, filter]);

  const openTrip = (t) => navigate(t.readOnly ? "/map?demo=1" : `/map/edit/${t.id}`);
  const confirmDelete = () => {
    const t = confirmTrip; setConfirmTrip(null);
    if (!t) return;
    setTrips((prev) => (prev || []).filter((x) => x.id !== t.id));
    tripService.deleteTrip(t.id).catch(() => {});
  };

  const FILTERS = [
    { id: "all", label: "הכל", n: counts.all },
    { id: "mine", label: "שלי", n: counts.mine },
    { id: "shared", label: "שותפו איתי", n: counts.shared },
  ];

  return (
    <div dir="rtl" style={{ minHeight: "100vh", background: P.page, fontFamily: FONT, transition: "background 0.25s" }}>
      <div className="tp-fade" style={{ maxWidth: 560, margin: "0 auto", background: P.panel, minHeight: "100vh", paddingBottom: 96, transition: "background 0.25s" }}>

        {/* Header action row */}
        <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 18px 8px" }}>
          <div style={{ fontSize: 20, fontWeight: 800, letterSpacing: "-0.02em", color: P.ink }}>המפות שלי</div>
          <div style={{ display: "flex", gap: 8 }}>
            <Circle P={P} title="מצב תצוגה" onClick={toggleTheme}>{dark ? "☀️" : "🌙"}</Circle>
            <Circle P={P} title="שיתוף פרופיל" onClick={() => { navigator.clipboard?.writeText(window.location.origin).catch(() => {}); showToast("הקישור הועתק"); }}>↗</Circle>
          </div>
        </header>

        {/* Identity */}
        <section style={{ display: "flex", alignItems: "center", gap: 16, padding: "10px 22px 18px" }}>
          <div style={{ position: "relative", flexShrink: 0 }}>
            <div style={{ width: 76, height: 76, borderRadius: "50%", background: `linear-gradient(145deg, ${ACCENT}, #B83A2B)`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 30, fontWeight: 800, color: "#fff" }}>
              {(user?.name || "?").trim().slice(0, 1)}
            </div>
            <button title="החלפת תמונה" className="tp-press" style={{ position: "absolute", bottom: -2, insetInlineStart: -2, width: 28, height: 28, borderRadius: "50%", border: `3px solid ${P.panel}`, background: P.ink, color: P.panel, cursor: "pointer", fontSize: 12, fontFamily: "inherit" }}>📷</button>
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 21, fontWeight: 800, letterSpacing: "-0.02em", color: P.ink }}>{user?.name}</span>
              {user?.plan && <span style={{ fontSize: 10, fontWeight: 800, textTransform: "uppercase", color: ACCENT, background: "rgba(224,83,63,0.12)", borderRadius: 999, padding: "2px 8px" }}>{user.plan}</span>}
            </div>
            <div style={{ fontSize: 13, color: P.ink3, direction: "ltr", textAlign: "right", marginTop: 2 }}>{user?.email}</div>
            <button onClick={() => navigate("/settings")} className="tp-press" style={{ display: "inline-flex", alignItems: "center", gap: 6, marginTop: 8, padding: "5px 12px", borderRadius: 999, border: `1px solid ${P.line}`, background: P.surface, fontSize: 12, fontWeight: 700, color: P.ink, cursor: "pointer", fontFamily: "inherit" }}>
              ✏ ערכו פרופיל
            </button>
          </div>
        </section>

        {/* Stats grid */}
        <section style={{ padding: "0 22px 18px" }}>
          <div style={{ display: "flex", background: P.surface, borderRadius: 18, overflow: "hidden" }}>
            {[{ n: stats.trips, l: "מסלולים" }, { n: stats.countries, l: "מדינות" }, { n: stats.days, l: "ימי טיול" }].map((s, i) => (
              <div key={s.l} style={{ flex: 1, textAlign: "center", padding: "14px 0", borderInlineStart: i ? `1px solid ${P.line}` : "none" }}>
                <div style={{ fontSize: 23, fontWeight: 800, color: P.ink, fontVariantNumeric: "tabular-nums" }}>{s.n}</div>
                <div style={{ fontSize: 11.5, color: P.ink3, marginTop: 2 }}>{s.l}</div>
              </div>
            ))}
          </div>
        </section>

        {/* Filter pills */}
        <section style={{ padding: "0 22px 14px" }}>
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

        {/* New map CTA */}
        <section style={{ padding: "0 22px 12px" }}>
          <button onClick={() => navigate("/create")} className="tp-press"
            style={{ display: "flex", alignItems: "center", gap: 12, padding: 14, border: `1px dashed ${P.line}`, borderRadius: 18, background: "transparent", cursor: "pointer", width: "100%", fontFamily: "inherit", textAlign: "right" }}>
            <span style={{ width: 44, height: 44, borderRadius: 14, background: P.ink, color: P.panel, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, fontSize: 22 }}>＋</span>
            <span style={{ flex: 1 }}>
              <span style={{ display: "block", fontSize: 14.5, fontWeight: 800, color: P.ink }}>מסלול חדש</span>
              <span style={{ display: "block", fontSize: 12, color: P.ink3, marginTop: 2 }}>התחילו מאפס או מתבנית מוכנה</span>
            </span>
          </button>
        </section>

        {/* Cards */}
        <section style={{ padding: "0 22px" }}>
          {filtered === null ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {[0, 1, 2].map((i) => <div key={i} style={{ height: 116, borderRadius: 20, background: `linear-gradient(90deg, ${P.surface}, ${P.surface2}, ${P.surface})`, backgroundSize: "200% 100%", animation: "tpSkeleton 1.2s ease infinite" }} />)}
            </div>
          ) : filtered.length === 0 ? (
            <div style={{ textAlign: "center", color: P.ink3, padding: "28px 0", fontSize: 13.5 }}>אין מסלולים בקטגוריה זו</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {filtered.map((t, i) => (
                <MapCard
                  key={t.id}
                  trip={t}
                  index={i}
                  dark={dark}
                  onOpen={() => openTrip(t)}
                  onCopyLink={() => showToast("הקישור הועתק")}
                  onDelete={() => setConfirmTrip(t)}
                />
              ))}
            </div>
          )}

          {filtered && (
            <div style={{ textAlign: "center", fontSize: 12, color: P.ink4, marginTop: 18 }}>
              נוצרו {counts.all} מסלולים · 24.5MB מתוך 2GB בענן
            </div>
          )}
        </section>

        {/* Account rows (merged from the old Profile screen). */}
        <section style={{ padding: "0 22px 28px" }}>
          <div style={{ borderRadius: 18, border: `1px solid ${P.line}`, overflow: "hidden" }}>
            {[
              { icon: "⚙",  label: "הגדרות וניהול",   sub: "שפה, יחידות, התראות, פרטיות" },
              { icon: "⬇", label: "מפות לא־מקוונות", sub: "זמינות גם בלי רשת" },
            ].map((r, i) => (
              <button key={r.label} onClick={() => navigate("/settings")} className="tp-press"
                style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 16px", borderTop: i ? `1px solid ${P.line}` : "none", width: "100%", background: "transparent", border: "none", cursor: "pointer", fontFamily: "inherit", textAlign: "right" }}>
                <span style={{ width: 34, height: 34, borderRadius: 10, background: P.surface, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16 }}>{r.icon}</span>
                <span style={{ flex: 1 }}>
                  <span style={{ display: "block", fontSize: 14.5, fontWeight: 600, color: P.ink }}>{r.label}</span>
                  <span style={{ display: "block", fontSize: 12, color: P.ink3, marginTop: 1 }}>{r.sub}</span>
                </span>
                <span style={{ color: P.ink4 }}>‹</span>
              </button>
            ))}
          </div>
        </section>
      </div>

      {/* Shared floating bottom dock — auto-detects active route */}
      <BottomDock />

      {/* Delete confirm modal */}
      {confirmTrip && (
        <div style={{ position: "fixed", inset: 0, zIndex: 70, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
          <div onClick={() => setConfirmTrip(null)} className="tp-fade" style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.45)" }} />
          <div className="tp-pop" dir="rtl" style={{ position: "relative", width: "100%", maxWidth: 360, background: P.panel, borderRadius: 22, padding: "24px 22px", boxShadow: "0 30px 80px rgba(0,0,0,0.4)", textAlign: "center", fontFamily: FONT }}>
            <div style={{ fontSize: 34, marginBottom: 8 }}>🗑️</div>
            <div style={{ fontSize: 18, fontWeight: 800, color: P.ink, marginBottom: 6 }}>מחיקת מפה</div>
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

      <style>{`@keyframes tpSkeleton{0%{background-position:200% 0}100%{background-position:-200% 0}}`}</style>
    </div>
  );
};

export default DashboardView;
