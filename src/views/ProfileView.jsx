import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import tripService from "../services/tripService";
import ShareSheet from "../components/ShareSheet";

/* ──────────────────────────────────────────────────────────────
   ProfileView — "הפרופיל שלי" (home-profile blueprint, screen 1).

   Identity hero + stats + "My Maps" list (segmented all/mine/
   shared) with role tags and a per-card share action that opens
   the ShareSheet. Account rows + sign-out. Back-to-home in the
   top bar.
   ────────────────────────────────────────────────────────────── */

const T = {
  ink: "#0D0F11", ink2: "#2A3036", ink3: "#6B7178", ink4: "#A4AAB1",
  line: "rgba(20,20,20,0.08)", surface: "#F6F6F4", accent: "#E0533F",
  nature: "#5A8C5F", natureSoft: "#E4EFE5", natureDeep: "#2B7B71",
  surface2: "#EFEFEC",
  font: "'Noto Sans Hebrew','Inter','Noto Sans JP',system-ui,sans-serif",
};

const ROLE_TAG = {
  owner: { label: "בעלים", bg: T.ink, fg: "#fff", icon: "👤" },
  edit:  { label: "עריכה", bg: T.natureSoft, fg: T.natureDeep, icon: "✏" },
  view:  { label: "צפייה", bg: T.surface2, fg: T.ink2, icon: "👁" },
};

const SEGMENTS = [
  { id: "all", label: "הכל" },
  { id: "mine", label: "שלי" },
  { id: "shared", label: "שותפו איתי" },
];

const ProfileView = () => {
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const [trips, setTrips] = useState(null);
  const [seg, setSeg] = useState("all");
  const [shareTrip, setShareTrip] = useState(null);

  useEffect(() => {
    let live = true;
    tripService.fetchAllTrips(user?.id).then((list) => { if (live) setTrips(list); });
    return () => { live = false; };
  }, [user]);

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

  return (
    <div dir="rtl" style={{ minHeight: "100vh", background: "#EDEDEC", fontFamily: T.font }}>
      <div style={{ maxWidth: 560, margin: "0 auto", background: "#fff", minHeight: "100vh" }}>
        {/* Top bar */}
        <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 16px 10px" }}>
          <button onClick={() => navigate("/")} title="חזרה לעמוד הבית" style={{ width: 40, height: 40, borderRadius: "50%", border: "none", background: T.surface, cursor: "pointer", fontSize: 17, fontFamily: "inherit" }}>←</button>
          <div style={{ fontSize: 17, fontWeight: 800, color: T.ink }}>הפרופיל שלי</div>
          <button onClick={() => navigate("/dashboard")} title="המפות שלי" style={{ width: 40, height: 40, borderRadius: "50%", border: "none", background: T.surface, cursor: "pointer", fontSize: 16, fontFamily: "inherit" }}>🗺</button>
        </header>

        {/* Identity hero */}
        <section style={{ display: "flex", alignItems: "center", gap: 16, padding: "10px 22px 18px" }}>
          <div style={{ width: 78, height: 78, borderRadius: "50%", background: T.surface, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 30, fontWeight: 800, color: T.ink2, flexShrink: 0 }}>
            {(user?.name || "?").trim().slice(0, 1)}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 22, fontWeight: 800, letterSpacing: "-0.02em", color: T.ink }}>{user?.name}</span>
              {user?.plan && <span style={{ fontSize: 10, fontWeight: 800, textTransform: "uppercase", color: T.accent, background: "rgba(224,83,63,0.10)", borderRadius: 999, padding: "2px 8px" }}>{user.plan}</span>}
            </div>
            <div style={{ fontSize: 13, color: T.ink3, direction: "ltr", textAlign: "right", marginTop: 2 }}>{user?.email}</div>
          </div>
        </section>

        {/* Stats */}
        <section style={{ padding: "0 22px 18px" }}>
          <div style={{ display: "flex", background: T.surface, borderRadius: 18, overflow: "hidden" }}>
            {[
              { n: stats.trips, l: "מסלולים" },
              { n: stats.countries, l: "מדינות" },
              { n: stats.days, l: "ימי טיול" },
            ].map((s, i) => (
              <div key={s.l} style={{ flex: 1, textAlign: "center", padding: "14px 0", borderInlineStart: i ? `1px solid ${T.line}` : "none" }}>
                <div style={{ fontSize: 22, fontWeight: 800, color: T.ink, fontVariantNumeric: "tabular-nums" }}>{s.n}</div>
                <div style={{ fontSize: 11.5, color: T.ink3, marginTop: 2 }}>{s.l}</div>
              </div>
            ))}
          </div>
        </section>

        {/* My Maps */}
        <section style={{ padding: "0 22px 28px" }}>
          <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 12 }}>
            <h2 style={{ fontSize: 16, fontWeight: 800, color: T.ink, margin: 0 }}>המפות שלי <span style={{ color: T.ink4, fontWeight: 600 }}>{stats.trips}</span></h2>
          </div>

          {/* Segmented filter */}
          <div style={{ display: "flex", gap: 4, background: T.surface, borderRadius: 999, padding: 4, marginBottom: 14 }}>
            {SEGMENTS.map((s) => {
              const on = seg === s.id;
              return (
                <button key={s.id} onClick={() => setSeg(s.id)} style={{ flex: 1, padding: "8px 0", borderRadius: 999, border: "none", cursor: "pointer", fontFamily: "inherit", fontSize: 12.5, fontWeight: 700, background: on ? "#fff" : "transparent", color: on ? T.ink : T.ink3, boxShadow: on ? "0 1px 3px rgba(0,0,0,0.08)" : "none" }}>
                  {s.label}
                </button>
              );
            })}
          </div>

          {/* Cards */}
          {filtered === null ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {[0, 1].map((i) => <div key={i} style={{ height: 108, borderRadius: 20, background: "linear-gradient(90deg,#f0f0ee,#f7f7f5,#f0f0ee)", backgroundSize: "200% 100%", animation: "tpSkeleton 1.2s ease infinite" }} />)}
            </div>
          ) : filtered.length === 0 ? (
            <div style={{ textAlign: "center", color: T.ink3, padding: "28px 0", fontSize: 13.5 }}>אין מסלולים בקטגוריה זו</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {filtered.map((t) => {
                const tag = ROLE_TAG[t.role] || ROLE_TAG.view;
                return (
                  <button key={t.id} onClick={() => openTrip(t)} style={{ position: "relative", display: "flex", gap: 14, padding: 12, borderRadius: 20, border: `1px solid ${T.line}`, background: "#fff", boxShadow: "0 1px 2px rgba(0,0,0,.04), 0 8px 28px rgba(0,0,0,.05)", cursor: "pointer", textAlign: "right", fontFamily: "inherit" }}>
                    <div style={{ width: 84, height: 84, borderRadius: 14, background: t.cover ? `center/cover url(${t.cover})` : T.surface2, flexShrink: 0, position: "relative" }}>
                      <span style={{ position: "absolute", bottom: 6, insetInlineStart: 6, background: "rgba(13,15,17,0.82)", color: "#fff", fontSize: 10.5, padding: "2px 7px", borderRadius: 999 }}>{t.days} ימים</span>
                    </div>
                    <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column" }}>
                      <div style={{ fontSize: 15.5, fontWeight: 800, color: T.ink, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{t.title}</div>
                      <div style={{ fontSize: 12, color: T.ink3, marginTop: 2 }}>
                        {t.role !== "owner" && t.sharedBy ? `שותף ע״י ${t.sharedBy} · ` : ""}{t.meta}
                      </div>
                      <div style={{ marginTop: "auto", display: "flex", alignItems: "center", gap: 6 }}>
                        <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 11, fontWeight: 700, background: tag.bg, color: tag.fg, borderRadius: 999, padding: "3px 9px" }}>
                          <span aria-hidden>{tag.icon}</span>{tag.label}
                        </span>
                      </div>
                    </div>
                    {/* Share / options action */}
                    <span
                      onClick={(e) => { e.stopPropagation(); setShareTrip(t); }}
                      title={t.role === "view" ? "אפשרויות" : "שיתוף"}
                      style={{ position: "absolute", top: 10, insetInlineStart: 10, width: 30, height: 30, borderRadius: "50%", background: T.surface, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, cursor: "pointer" }}
                    >
                      {t.role === "view" ? "⋯" : "↗"}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </section>

        {/* Account rows */}
        <section style={{ padding: "0 22px 40px" }}>
          <div style={{ borderRadius: 18, border: `1px solid ${T.line}`, overflow: "hidden" }}>
            {[
              { icon: "⚙", label: "הגדרות וניהול", onClick: () => navigate("/settings") },
              { icon: "⬇", label: "מפות לא־מקוונות", onClick: () => navigate("/settings") },
            ].map((r, i) => (
              <button key={r.label} onClick={r.onClick} style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 16px", borderTop: i ? `1px solid ${T.line}` : "none", width: "100%", background: "transparent", border: "none", cursor: "pointer", fontFamily: "inherit", textAlign: "right" }}>
                <span style={{ width: 34, height: 34, borderRadius: 10, background: T.surface, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16 }}>{r.icon}</span>
                <span style={{ flex: 1, fontSize: 14.5, fontWeight: 600, color: T.ink }}>{r.label}</span>
                <span style={{ color: T.ink4 }}>‹</span>
              </button>
            ))}
            <button onClick={() => { signOut(); navigate("/"); }} style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 16px", borderTop: `1px solid ${T.line}`, width: "100%", background: "transparent", border: "none", cursor: "pointer", fontFamily: "inherit", textAlign: "right" }}>
              <span style={{ width: 34, height: 34, borderRadius: 10, background: "rgba(192,57,43,0.08)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16 }}>⎋</span>
              <span style={{ flex: 1, fontSize: 14.5, fontWeight: 600, color: "#C0392B" }}>התנתקות</span>
            </button>
          </div>
        </section>
      </div>

      {shareTrip && <ShareSheet trip={shareTrip} onClose={() => setShareTrip(null)} />}
      <style>{`@keyframes tpSkeleton{0%{background-position:200% 0}100%{background-position:-200% 0}}`}</style>
    </div>
  );
};

export default ProfileView;
