import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import tripService from "../services/tripService";
import { useDarkMode } from "../utils/theme";
import ShareSheet from "../components/ShareSheet";
import MapCard from "../components/MapCard";

/* ──────────────────────────────────────────────────────────────
   ProfileView — "הפרופיל שלי" (home-profile blueprint, screen 1).
   Identity hero (avatar + camera + edit) · stats · "My Maps"
   (segmented filter w/ counts, shared MapCard incl. share/delete)
   · account rows. Back-to-home + settings in the top bar.
   ────────────────────────────────────────────────────────────── */

const ACCENT = "#E0533F";
const FONT = "'Noto Sans Hebrew','Inter','Noto Sans JP',system-ui,sans-serif";

const ProfileView = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { dark, P } = useDarkMode();
  const T = { ...P, accent: ACCENT, font: FONT };
  const [trips, setTrips] = useState(null);
  const [seg, setSeg] = useState("all");
  const [shareTrip, setShareTrip] = useState(null);

  useEffect(() => {
    let live = true;
    tripService.fetchAllTrips(user?.id).then((list) => { if (live) setTrips(list); });
    return () => { live = false; };
  }, [user]);

  const counts = useMemo(() => {
    const list = trips || [];
    return {
      all: list.length,
      mine: list.filter((t) => t.role === "owner").length,
      shared: list.filter((t) => t.role !== "owner").length,
    };
  }, [trips]);

  const SEGMENTS = [
    { id: "all", label: "הכל", n: counts.all },
    { id: "mine", label: "שלי", n: counts.mine },
    { id: "shared", label: "שותפו איתי", n: counts.shared },
  ];

  const filtered = useMemo(() => {
    if (!trips) return null;
    if (seg === "mine") return trips.filter((t) => t.role === "owner");
    if (seg === "shared") return trips.filter((t) => t.role !== "owner");
    return trips;
  }, [trips, seg]);

  const stats = useMemo(() => {
    const list = trips || [];
    const countries = new Set(list.map((t) => t.settings?.destinationHe || t.settings?.destination).filter(Boolean));
    const totalDays = list.reduce((s, t) => s + (t.days || 0), 0);
    return { trips: list.length, countries: countries.size, days: totalDays };
  }, [trips]);

  const openTrip = (t) => navigate(t.readOnly ? "/map?demo=1" : `/map/edit/${t.id}`);
  const deleteTrip = (t) => {
    if (!window.confirm(`למחוק את "${t.title}"? הפעולה אינה הפיכה.`)) return;
    setTrips((prev) => (prev || []).filter((x) => x.id !== t.id));
    tripService.deleteTrip(t.id).catch(() => {});
  };

  return (
    <div dir="rtl" style={{ minHeight: "100vh", background: T.page, fontFamily: T.font, transition: "background 0.25s" }}>
      <div className="tp-fade" style={{ maxWidth: 560, margin: "0 auto", background: T.panel, minHeight: "100vh", transition: "background 0.25s" }}>
        {/* Top bar */}
        <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 16px 10px" }}>
          <button onClick={() => navigate("/")} title="חזרה לעמוד הבית" className="tp-press" style={{ width: 40, height: 40, borderRadius: "50%", border: "none", background: T.surface, cursor: "pointer", fontSize: 17, fontFamily: "inherit" }}>←</button>
          <div style={{ fontSize: 17, fontWeight: 800, color: T.ink }}>הפרופיל שלי</div>
          <button onClick={() => navigate("/settings")} title="הגדרות" className="tp-press" style={{ width: 40, height: 40, borderRadius: "50%", border: "none", background: T.surface, cursor: "pointer", fontSize: 16, fontFamily: "inherit" }}>⚙</button>
        </header>

        {/* Identity hero */}
        <section style={{ display: "flex", alignItems: "center", gap: 16, padding: "10px 22px 18px" }}>
          <div style={{ position: "relative", flexShrink: 0 }}>
            <div style={{ width: 78, height: 78, borderRadius: "50%", background: T.surface, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 30, fontWeight: 800, color: T.ink2 }}>
              {(user?.name || "?").trim().slice(0, 1)}
            </div>
            <button title="החלפת תמונה" className="tp-press" style={{ position: "absolute", bottom: -2, insetInlineStart: -2, width: 28, height: 28, borderRadius: "50%", border: "3px solid #fff", background: T.ink, color: "#fff", cursor: "pointer", fontSize: 12, fontFamily: "inherit" }}>📷</button>
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 22, fontWeight: 800, letterSpacing: "-0.02em", color: T.ink }}>{user?.name}</span>
              {user?.plan && <span style={{ fontSize: 10, fontWeight: 800, textTransform: "uppercase", color: T.accent, background: "rgba(224,83,63,0.10)", borderRadius: 999, padding: "2px 8px" }}>{user.plan}</span>}
            </div>
            <div style={{ fontSize: 13, color: T.ink3, direction: "ltr", textAlign: "right", marginTop: 2 }}>{user?.email}</div>
            <button onClick={() => navigate("/settings")} className="tp-press" style={{ display: "inline-flex", alignItems: "center", gap: 6, marginTop: 8, padding: "5px 12px", borderRadius: 999, border: `1px solid ${T.line}`, background: T.surface, fontSize: 12, fontWeight: 700, color: T.ink, cursor: "pointer", fontFamily: "inherit" }}>
              ✏ ערכו פרופיל
            </button>
          </div>
        </section>

        {/* Stats */}
        <section style={{ padding: "0 22px 18px" }}>
          <div style={{ display: "flex", background: T.surface, borderRadius: 18, overflow: "hidden" }}>
            {[{ n: stats.trips, l: "מסלולים" }, { n: stats.countries, l: "מדינות" }, { n: stats.days, l: "ימי טיול" }].map((s, i) => (
              <div key={s.l} style={{ flex: 1, textAlign: "center", padding: "14px 0", borderInlineStart: i ? `1px solid ${T.line}` : "none" }}>
                <div style={{ fontSize: 22, fontWeight: 800, color: T.ink, fontVariantNumeric: "tabular-nums" }}>{s.n}</div>
                <div style={{ fontSize: 11.5, color: T.ink3, marginTop: 2 }}>{s.l}</div>
              </div>
            ))}
          </div>
        </section>

        {/* My Maps */}
        <section style={{ padding: "0 22px 28px" }}>
          <h2 style={{ fontSize: 16, fontWeight: 800, color: T.ink, margin: "0 0 12px" }}>המפות שלי <span style={{ color: T.ink4, fontWeight: 600 }}>{stats.trips}</span></h2>

          {/* Segmented filter with counts */}
          <div style={{ display: "flex", gap: 4, background: T.surface, borderRadius: 999, padding: 4, marginBottom: 14 }}>
            {SEGMENTS.map((s) => {
              const on = seg === s.id;
              return (
                <button key={s.id} onClick={() => setSeg(s.id)} style={{ flex: 1, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6, padding: "8px 0", borderRadius: 999, border: "none", cursor: "pointer", fontFamily: "inherit", fontSize: 12.5, fontWeight: 700, background: on ? "#fff" : "transparent", color: on ? T.ink : T.ink3, boxShadow: on ? "0 1px 3px rgba(0,0,0,0.08)" : "none" }}>
                  {s.label}
                  <span style={{ fontSize: 10.5, fontWeight: 800, background: on ? T.surface : T.surface2, color: on ? T.ink2 : T.ink3, borderRadius: 999, padding: "1px 7px" }}>{s.n}</span>
                </button>
              );
            })}
          </div>

          {/* Cards */}
          {filtered === null ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {[0, 1].map((i) => <div key={i} style={{ height: 112, borderRadius: 20, background: "linear-gradient(90deg,#f0f0ee,#f7f7f5,#f0f0ee)", backgroundSize: "200% 100%", animation: "tpSkeleton 1.2s ease infinite" }} />)}
            </div>
          ) : filtered.length === 0 ? (
            <div style={{ textAlign: "center", color: T.ink3, padding: "28px 0", fontSize: 13.5 }}>אין מסלולים בקטגוריה זו</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {filtered.map((t, i) => (
                <MapCard
                  key={t.id}
                  trip={t}
                  index={i}
                  dark={dark}
                  onOpen={() => openTrip(t)}
                  onCopyLink={() => {}}
                  onShare={t.readOnly ? undefined : () => setShareTrip(t)}
                  onDelete={() => deleteTrip(t)}
                />
              ))}
            </div>
          )}
        </section>

        {/* Account rows */}
        <section style={{ padding: "0 22px 40px" }}>
          <div style={{ borderRadius: 18, border: `1px solid ${T.line}`, overflow: "hidden" }}>
            {[
              { icon: "⚙", label: "הגדרות וניהול", sub: "שפה, יחידות, התראות, פרטיות" },
              { icon: "⬇", label: "מפות לא־מקוונות", sub: "זמינות גם בלי רשת" },
            ].map((r, i) => (
              <button key={r.label} onClick={() => navigate("/settings")} style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 16px", borderTop: i ? `1px solid ${T.line}` : "none", width: "100%", background: "transparent", border: "none", cursor: "pointer", fontFamily: "inherit", textAlign: "right" }}>
                <span style={{ width: 34, height: 34, borderRadius: 10, background: T.surface, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16 }}>{r.icon}</span>
                <span style={{ flex: 1 }}>
                  <span style={{ display: "block", fontSize: 14.5, fontWeight: 600, color: T.ink }}>{r.label}</span>
                  <span style={{ display: "block", fontSize: 12, color: T.ink3, marginTop: 1 }}>{r.sub}</span>
                </span>
                <span style={{ color: T.ink4 }}>‹</span>
              </button>
            ))}
          </div>
        </section>
      </div>

      {shareTrip && <ShareSheet trip={shareTrip} onClose={() => setShareTrip(null)} />}
      <style>{`@keyframes tpSkeleton{0%{background-position:200% 0}100%{background-position:-200% 0}}`}</style>
    </div>
  );
};

export default ProfileView;
