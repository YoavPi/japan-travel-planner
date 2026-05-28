import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import tripService from "../services/tripService";
import ShareSheet from "../components/ShareSheet";

/* ──────────────────────────────────────────────────────────────
   DashboardView — "המפות שלי" trip grid.
   PHASE 1 PLACEHOLDER: functional data flow (fetchAllTrips via the
   localStorage-backed service, with loading skeletons), minimal
   styling. The premium card design (home-profile.jsx ProfileMain /
   MyMapsScreen) lands in the layout phase.
   ────────────────────────────────────────────────────────────── */
const DashboardView = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [trips, setTrips] = useState(null); // null = loading
  const [shareTrip, setShareTrip] = useState(null);

  useEffect(() => {
    let live = true;
    tripService.fetchAllTrips(user?.id).then((list) => {
      if (live) setTrips(list);
    });
    return () => { live = false; };
  }, [user]);

  const openTrip = (t) => {
    /* Read-only example deep-links to the existing static viewer;
       editable trips open the (future) editor workspace. */
    if (t.readOnly) navigate("/map?demo=1");
    else navigate(`/map/edit/${t.id}`);
  };

  /* Route through the 4-step wizard rather than creating a blank
     trip immediately, so the new trip gets a destination, duration
     and scaffolded days. */
  const handleCreate = () => navigate("/create");

  return (
    <div dir="rtl" style={{ minHeight: "100vh", background: "#EDEDEC", fontFamily: "'Noto Sans Hebrew','Inter',sans-serif" }}>
      {/* Top bar */}
      <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 16px", background: "#fff", borderBottom: "1px solid rgba(20,20,20,0.08)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <button onClick={() => navigate("/")} title="חזרה לעמוד הבית"
            style={{ width: 38, height: 38, borderRadius: "50%", border: "none", background: "#F6F6F4", cursor: "pointer", fontSize: 16, fontFamily: "inherit" }}>←</button>
          <div style={{ fontSize: 17, fontWeight: 800, color: "#0D0F11" }}>המפות שלי</div>
        </div>
        <button onClick={() => navigate("/profile")} title="הפרופיל שלי"
          style={{ width: 38, height: 38, borderRadius: "50%", border: "none", background: "#F6F6F4", cursor: "pointer", fontSize: 15, fontWeight: 800, color: "#2A3036", fontFamily: "inherit" }}>
          {(user?.name || "?").trim().slice(0, 1)}
        </button>
      </header>

      <main style={{ maxWidth: 900, margin: "0 auto", padding: 22 }}>
        <button onClick={handleCreate}
          style={{ width: "100%", display: "flex", alignItems: "center", gap: 14, padding: 16, marginBottom: 18, borderRadius: 20, border: "2px dashed rgba(20,20,20,0.18)", background: "transparent", cursor: "pointer", fontFamily: "inherit", textAlign: "right" }}>
          <span style={{ width: 44, height: 44, borderRadius: 12, background: "#0D0F11", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, flexShrink: 0 }}>+</span>
          <span>
            <span style={{ display: "block", fontSize: 15.5, fontWeight: 800, color: "#0D0F11" }}>מסלול חדש</span>
            <span style={{ display: "block", fontSize: 12, color: "#6B7178" }}>התחילו לבנות מפה משלכם</span>
          </span>
        </button>

        {trips === null ? (
          /* Loading skeletons */
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px,1fr))", gap: 14 }}>
            {[0, 1, 2].map((i) => (
              <div key={i} style={{ height: 108, borderRadius: 20, background: "linear-gradient(90deg,#f0f0ee,#f7f7f5,#f0f0ee)", backgroundSize: "200% 100%", animation: "tpSkeleton 1.2s ease infinite" }} />
            ))}
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px,1fr))", gap: 14 }}>
            {trips.map((t) => (
              <button key={t.id} onClick={() => openTrip(t)}
                style={{ position: "relative", display: "flex", gap: 14, padding: 12, borderRadius: 20, border: "1px solid rgba(20,20,20,0.08)", background: "#fff", boxShadow: "0 1px 2px rgba(0,0,0,.04), 0 8px 28px rgba(0,0,0,.05)", cursor: "pointer", textAlign: "right", fontFamily: "inherit" }}>
                <div style={{ width: 84, height: 84, borderRadius: 14, background: t.cover ? `center/cover url(${t.cover})` : "#EFEFEC", flexShrink: 0, position: "relative" }}>
                  <span style={{ position: "absolute", bottom: 6, insetInlineStart: 6, background: "rgba(13,15,17,0.82)", color: "#fff", fontSize: 10.5, padding: "2px 7px", borderRadius: 999 }}>{t.days} ימים</span>
                </div>
                <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column" }}>
                  <div style={{ fontSize: 15.5, fontWeight: 800, color: "#0D0F11", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{t.title}</div>
                  <div style={{ fontSize: 12, color: "#6B7178", marginTop: 2 }}>{t.meta}</div>
                  <div style={{ marginTop: "auto", fontSize: 11, color: "#A4AAB1" }}>
                    {t.role === "owner" ? "בעלים" : t.role === "edit" ? "עריכה" : "צפייה"}
                    {t.readOnly ? " · דוגמה" : ""}
                  </div>
                </div>
                {/* Share action (owned/edit) — read-only example has none */}
                {!t.readOnly && (
                  <span
                    onClick={(e) => { e.stopPropagation(); setShareTrip(t); }}
                    title="שיתוף"
                    style={{ position: "absolute", top: 10, insetInlineStart: 10, width: 30, height: 30, borderRadius: "50%", background: "#F6F6F4", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, cursor: "pointer" }}
                  >
                    ↗
                  </span>
                )}
              </button>
            ))}
          </div>
        )}
      </main>
      {shareTrip && <ShareSheet trip={shareTrip} onClose={() => setShareTrip(null)} />}
      <style>{`@keyframes tpSkeleton{0%{background-position:200% 0}100%{background-position:-200% 0}}`}</style>
    </div>
  );
};

export default DashboardView;
