import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import tripService from "../services/tripService";
import ShareSheet from "../components/ShareSheet";
import MapCard from "../components/MapCard";

/* ──────────────────────────────────────────────────────────────
   DashboardView — "המפות שלי" (home-profile blueprint, screen 2).
   Top bar (back / title / profile) · filter pills with counts ·
   dashed "new map" CTA · MapCard list · storage footer.
   ────────────────────────────────────────────────────────────── */

const T = {
  ink: "#0D0F11", ink2: "#2A3036", ink3: "#6B7178", ink4: "#A4AAB1",
  line: "rgba(20,20,20,0.08)", surface: "#F6F6F4", surface2: "#EFEFEC",
  font: "'Noto Sans Hebrew','Inter','Noto Sans JP',system-ui,sans-serif",
};

const DashboardView = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [trips, setTrips] = useState(null); // null = loading
  const [filter, setFilter] = useState("all");
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

  const filtered = useMemo(() => {
    if (!trips) return null;
    if (filter === "mine") return trips.filter((t) => t.role === "owner");
    if (filter === "shared") return trips.filter((t) => t.role !== "owner");
    return trips;
  }, [trips, filter]);

  const openTrip = (t) => navigate(t.readOnly ? "/map?demo=1" : `/map/edit/${t.id}`);

  const deleteTrip = (t) => {
    if (!window.confirm(`למחוק את "${t.title}"? הפעולה אינה הפיכה.`)) return;
    setTrips((prev) => (prev || []).filter((x) => x.id !== t.id)); // optimistic
    tripService.deleteTrip(t.id).catch(() => {});
  };

  const FILTERS = [
    { id: "all", label: "הכל", n: counts.all },
    { id: "mine", label: "שלי", n: counts.mine },
    { id: "shared", label: "שותפו איתי", n: counts.shared },
  ];

  return (
    <div dir="rtl" style={{ minHeight: "100vh", background: "#EDEDEC", fontFamily: T.font }}>
      <div className="tp-fade" style={{ maxWidth: 560, margin: "0 auto", background: "#fff", minHeight: "100vh" }}>
        {/* Top bar */}
        <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 16px", borderBottom: `1px solid ${T.line}` }}>
          <button onClick={() => navigate("/")} title="חזרה לעמוד הבית" style={{ width: 38, height: 38, borderRadius: "50%", border: "none", background: T.surface, cursor: "pointer", fontSize: 17, fontFamily: "inherit" }}>›</button>
          <div style={{ fontSize: 17, fontWeight: 800, color: T.ink }}>המפות שלי</div>
          <button onClick={() => navigate("/profile")} title="הפרופיל שלי" style={{ width: 38, height: 38, borderRadius: "50%", border: "none", background: T.ink, color: "#fff", cursor: "pointer", fontSize: 15, fontWeight: 800, fontFamily: "inherit" }}>
            {(user?.name || "?").trim().slice(0, 1)}
          </button>
        </header>

        <div style={{ padding: "16px 0 40px" }}>
          {/* Filter pills */}
          <div style={{ display: "flex", gap: 4, background: T.surface, borderRadius: 999, padding: 4, margin: "0 22px 14px" }}>
            {FILTERS.map((f) => {
              const on = filter === f.id;
              return (
                <button key={f.id} onClick={() => setFilter(f.id)}
                  style={{ flex: 1, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6, padding: "8px 0", borderRadius: 999, border: "none", cursor: "pointer", fontFamily: "inherit", fontSize: 12.5, fontWeight: 700, background: on ? "#fff" : "transparent", color: on ? T.ink : T.ink3, boxShadow: on ? "0 1px 3px rgba(0,0,0,0.08)" : "none" }}>
                  {f.label}
                  <span style={{ fontSize: 10.5, fontWeight: 800, background: on ? T.surface : T.surface2, color: on ? T.ink2 : T.ink3, borderRadius: 999, padding: "1px 7px" }}>{f.n}</span>
                </button>
              );
            })}
          </div>

          {/* New map dashed CTA */}
          <button onClick={() => navigate("/create")}
            style={{ display: "flex", alignItems: "center", gap: 12, margin: "0 22px 12px", padding: 14, border: `1px dashed ${T.line}`, borderRadius: 18, background: "transparent", cursor: "pointer", width: "calc(100% - 44px)", fontFamily: "inherit", textAlign: "right" }}>
            <span style={{ width: 44, height: 44, borderRadius: 14, background: T.ink, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, fontSize: 22 }}>＋</span>
            <span style={{ flex: 1 }}>
              <span style={{ display: "block", fontSize: 14.5, fontWeight: 800, color: T.ink }}>מסלול חדש</span>
              <span style={{ display: "block", fontSize: 12, color: T.ink3, marginTop: 2 }}>התחילו מאפס או מתבנית מוכנה</span>
            </span>
          </button>

          {/* Maps list */}
          {filtered === null ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 12, padding: "0 22px" }}>
              {[0, 1, 2].map((i) => <div key={i} style={{ height: 112, borderRadius: 20, background: "linear-gradient(90deg,#f0f0ee,#f7f7f5,#f0f0ee)", backgroundSize: "200% 100%", animation: "tpSkeleton 1.2s ease infinite" }} />)}
            </div>
          ) : filtered.length === 0 ? (
            <div style={{ textAlign: "center", color: T.ink3, padding: "28px 0", fontSize: 13.5 }}>אין מסלולים בקטגוריה זו</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 12, padding: "0 22px" }}>
              {filtered.map((t, i) => (
                <MapCard
                  key={t.id}
                  trip={t}
                  index={i}
                  onOpen={() => openTrip(t)}
                  onShare={t.readOnly ? undefined : () => setShareTrip(t)}
                  onDelete={() => deleteTrip(t)}
                />
              ))}
            </div>
          )}

          {/* Storage footer */}
          {filtered && (
            <div style={{ textAlign: "center", fontSize: 12, color: T.ink4, marginTop: 18 }}>
              נוצרו {counts.all} מסלולים · 24.5MB מתוך 2GB בענן
            </div>
          )}
        </div>
      </div>

      {shareTrip && <ShareSheet trip={shareTrip} onClose={() => setShareTrip(null)} />}
      <style>{`@keyframes tpSkeleton{0%{background-position:200% 0}100%{background-position:-200% 0}}`}</style>
    </div>
  );
};

export default DashboardView;
