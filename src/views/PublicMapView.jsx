import React, { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import EditorMap from "../components/EditorMap";
import FavoriteButton from "../components/FavoriteButton";
import { useAuth } from "../context/AuthContext";
import { fetchPublicTripById } from "../services/galleryService";
import { listFavoriteIds } from "../services/favoritesService";
import { visibleDayCount } from "../utils/gallery";
import { track } from "../analytics/posthog";

/* ══════════════════════════════════════════════════════════════
   PublicMapView — /g/:tripId public read-only viewer.

   Anyone (signed in or not) can open a published trip's map + a
   plain read-only timeline. Logged-out, non-owner visitors only see
   the first ~30% of the trip's days (visibleDayCount) before a lock
   panel invites them to sign in for the rest — the gallery's core
   conversion gate.
   ══════════════════════════════════════════════════════════════ */

const T = {
  bg: "#FFFFFF", page: "#F4F3F1", ink: "#0D0F11", ink2: "#2A3036", ink3: "#6B7178",
  line: "rgba(20,20,20,0.09)", accent: "#E0533F", surface: "#F6F6F4",
  font: "'Noto Sans Hebrew','Inter',system-ui,sans-serif",
};

const PublicMapView = () => {
  const { tripId } = useParams();
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();

  const [trip, setTrip] = useState(null);
  const [loading, setLoading] = useState(true);
  const [fav, setFav] = useState(false);

  useEffect(() => {
    let live = true;
    setLoading(true);
    fetchPublicTripById(tripId)
      .then((t) => { if (live) setTrip(t); })
      .finally(() => { if (live) setLoading(false); });
    return () => { live = false; };
  }, [tripId]);

  useEffect(() => {
    if (isAuthenticated) listFavoriteIds().then((ids) => setFav(ids.has(tripId))).catch(() => {});
  }, [isAuthenticated, tripId]);

  const days = trip?.data?.tripData || [];
  const total = days.length;
  const gated = !!trip && !trip.isOwner && !isAuthenticated;
  const visible = gated ? visibleDayCount(total) : total;
  const visibleDays = days.slice(0, visible);
  const stops = visibleDays.flatMap((d) =>
    (d.attractions || []).filter(
      (a) => a && !a._transit && a.coordinates &&
        Number.isFinite(a.coordinates.lat) && Number.isFinite(a.coordinates.lng)
    )
  );

  useEffect(() => {
    if (!trip) return;
    track("public_map_opened", { trip_id: tripId });
    if (gated) track("gate_shown", { trip_id: tripId, total_days: total });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trip]);

  const goLogin = () => {
    track("gate_login_clicked");
    navigate("/auth", { state: { from: `/g/${tripId}` } });
  };

  if (loading) {
    return (
      <div dir="rtl" style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: T.page, fontFamily: T.font, color: T.ink3, fontSize: 14, fontWeight: 700 }}>
        טוען…
      </div>
    );
  }

  if (!trip) {
    return (
      <div dir="rtl" style={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 14, background: T.page, fontFamily: T.font, textAlign: "center", padding: 24 }}>
        <div style={{ fontSize: 17, fontWeight: 800, color: T.ink }}>המפה לא נמצאה או אינה ציבורית</div>
        <Link to="/gallery" style={{ color: T.accent, fontSize: 14, fontWeight: 700, textDecoration: "none" }}>
          לחזרה לגלריה
        </Link>
      </div>
    );
  }

  return (
    <div dir="rtl" style={{ minHeight: "100vh", background: T.page, fontFamily: T.font, color: T.ink }}>
      {/* Sticky header */}
      <div style={{
        position: "sticky", top: 0, zIndex: 40, background: T.bg, borderBottom: `1px solid ${T.line}`,
        display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12,
        padding: "12px 18px",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
          <Link to="/" style={{ fontSize: 16, fontWeight: 800, color: T.ink, textDecoration: "none", flexShrink: 0 }}>
            מסלול
          </Link>
          <div style={{ width: 1, height: 22, background: T.line, flexShrink: 0 }} />
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 14.5, fontWeight: 800, color: T.ink, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              {trip.title || "טיול"}
            </div>
            {trip.owner?.name && (
              <div style={{ fontSize: 11.5, fontWeight: 600, color: T.ink3 }}>
                מאת {trip.owner.name}
              </div>
            )}
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
          <FavoriteButton tripId={tripId} favorited={fav} onChange={setFav} returnTo={`/g/${tripId}`} />
          <button
            onClick={() => navigate(isAuthenticated ? "/create" : "/auth")}
            style={{
              height: 38, padding: "0 16px", borderRadius: 999, border: "none",
              background: T.accent, color: "#fff", fontFamily: T.font, fontSize: 13, fontWeight: 800,
              cursor: "pointer", whiteSpace: "nowrap",
            }}
          >
            בנה מסלול משלך
          </button>
        </div>
      </div>

      {/* Map */}
      <div style={{ position: "relative", width: "100%", height: "50vh" }}>
        <EditorMap stops={stops} center={trip.center} />
        {gated && (
          <div style={{
            position: "absolute", top: 12, insetInlineStart: "50%", transform: "translateX(-50%)",
            background: "rgba(13,15,17,0.85)", color: "#fff", fontSize: 12.5, fontWeight: 700,
            padding: "8px 16px", borderRadius: 999, whiteSpace: "nowrap", boxShadow: "0 6px 20px rgba(0,0,0,0.25)",
          }}>
            צפייה חלקית · התחברו לראות את כל המסלול
          </div>
        )}
      </div>

      {/* Read-only timeline */}
      <div style={{ maxWidth: 720, margin: "0 auto", padding: "20px 18px 80px" }}>
        {visibleDays.map((d) => (
          <div key={d.day} style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 15, fontWeight: 800, color: T.ink, marginBottom: 8 }}>
              יום {d.day} · {d.cityHe || d.city}
            </div>
            <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 6 }}>
              {(d.attractions || []).filter((a) => a && !a._transit).map((a, i) => (
                <li key={i} style={{
                  background: T.surface, border: `1px solid ${T.line}`, borderRadius: 10,
                  padding: "10px 12px", fontSize: 13.5, fontWeight: 700, color: T.ink2,
                }}>
                  {a.nameHe || a.name}
                </li>
              ))}
            </ul>
          </div>
        ))}

        {gated && (
          <div style={{ position: "relative", marginTop: 24 }}>
            {/* Blurred teaser of what's hidden */}
            <div aria-hidden style={{ filter: "blur(6px)", opacity: 0.5, pointerEvents: "none", userSelect: "none" }}>
              <div style={{ fontSize: 15, fontWeight: 800, color: T.ink, marginBottom: 8 }}>
                יום {(days[visible]?.day) ?? visible + 1} · {days[visible]?.cityHe || days[visible]?.city || ""}
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {[0, 1, 2].map((i) => (
                  <div key={i} style={{ background: T.surface, border: `1px solid ${T.line}`, borderRadius: 10, padding: "10px 12px", height: 38 }} />
                ))}
              </div>
            </div>

            {/* Lock panel overlay */}
            <div style={{
              position: "absolute", inset: 0, display: "flex", flexDirection: "column",
              alignItems: "center", justifyContent: "center", gap: 14, textAlign: "center", padding: 20,
            }}>
              <div style={{ fontSize: 15.5, fontWeight: 800, color: T.ink, lineHeight: 1.5 }}>
                כדי לראות את שאר התכנון — התחברו למערכת
              </div>
              <button
                onClick={goLogin}
                style={{
                  height: 44, padding: "0 24px", borderRadius: 999, border: "none",
                  background: T.accent, color: "#fff", fontFamily: T.font, fontSize: 14, fontWeight: 800,
                  cursor: "pointer",
                }}
              >
                התחברות
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default PublicMapView;
