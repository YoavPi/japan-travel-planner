import React, { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import SiteFooter from "../components/SiteFooter";
import GalleryCard from "../components/GalleryCard";
import { useAuth } from "../context/AuthContext";
import { GALLERY_CATEGORIES } from "../utils/gallery";
import { fetchPublicTrips } from "../services/galleryService";
import { listFavoriteIds } from "../services/favoritesService";
import { isPlacesEnabled, autocomplete as placesAutocomplete } from "../services/googlePlaces";
import { track } from "../analytics/posthog";

/* ══════════════════════════════════════════════════════════════
   GalleryView — public /gallery page: browse trips other users
   have published. Search (debounced), category chips, destination
   filter, and a popular/new sort toggle drive fetchPublicTrips.
   Favorites are marked via a Set of ids fetched once on mount and
   updated optimistically as cards are starred/unstarred.
   ══════════════════════════════════════════════════════════════ */

const T = {
  bg: "#FFFFFF", page: "#F4F3F1", ink: "#0D0F11", ink2: "#2A3036", ink3: "#6B7178", ink4: "#A4AAB1",
  line: "rgba(20,20,20,0.09)", accent: "#E0533F", surface: "#F6F6F4",
  font: "'Noto Sans Hebrew','Inter',system-ui,sans-serif",
};

const PAGE_SIZE = 24;

const GalleryView = () => {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();

  const [qInput, setQInput] = useState("");
  const [q, setQ] = useState("");
  const [destination, setDestination] = useState("");
  const [category, setCategory] = useState("");
  const [sort, setSort] = useState("popular");

  const [limit, setLimit] = useState(PAGE_SIZE);
  const [trips, setTrips] = useState([]);
  const [loading, setLoading] = useState(true);
  const [favIds, setFavIds] = useState(new Set());

  /* Google-Places autocomplete for the destination box (geocode = countries,
     regions, cities). Mirrors the wizard's destination search so the same
     Hebrew place names surface and match published maps' `destinationHe`. */
  const [destPreds, setDestPreds] = useState([]);
  const [destOpen, setDestOpen] = useState(false);
  const destPicked = useRef(false);

  useEffect(() => {
    track("gallery_viewed");
  }, []);

  useEffect(() => {
    listFavoriteIds().then(setFavIds).catch(() => {});
  }, []);

  /* Debounce the free-text search box. */
  useEffect(() => {
    const t = setTimeout(() => setQ(qInput), 300);
    return () => clearTimeout(t);
  }, [qInput]);

  /* Any filter change resets pagination back to page 1. */
  useEffect(() => {
    setLimit(PAGE_SIZE);
  }, [q, destination, category, sort]);

  /* Debounced destination autocomplete. Skips the round-trip right after the
     user picks a suggestion (so the dropdown doesn't reopen on the set value). */
  useEffect(() => {
    if (!isPlacesEnabled()) return;
    if (destPicked.current) { destPicked.current = false; return; }
    const term = destination.trim();
    if (term.length < 2) { setDestPreds([]); setDestOpen(false); return; }
    let live = true;
    const t = setTimeout(() => {
      placesAutocomplete(term, { types: ["geocode"] })
        .then((res) => { if (live) { setDestPreds(res || []); setDestOpen((res || []).length > 0); } })
        .catch(() => { if (live) { setDestPreds([]); setDestOpen(false); } });
    }, 250);
    return () => { live = false; clearTimeout(t); };
  }, [destination]);

  const pickDest = (pred) => {
    destPicked.current = true;
    setDestination(pred.primary);
    setDestPreds([]);
    setDestOpen(false);
  };

  /* Fetch results whenever filters or the page size change. */
  useEffect(() => {
    let live = true;
    setLoading(true);
    fetchPublicTrips({ q, destination, category, sort, limit, offset: 0 })
      .then((rows) => { if (live) setTrips(rows); })
      .finally(() => { if (live) setLoading(false); });
    return () => { live = false; };
  }, [q, destination, category, sort, limit]);

  const toggleCategory = (slug) => setCategory((c) => (c === slug ? "" : slug));
  const onToggleFav = (id, next) =>
    setFavIds((prev) => {
      const s = new Set(prev);
      if (next) s.add(id); else s.delete(id);
      return s;
    });

  const chipStyle = (active) => ({
    border: `1.5px solid ${active ? T.accent : T.line}`,
    background: active ? T.accent : "#fff",
    color: active ? "#fff" : T.ink2,
    borderRadius: 999,
    padding: "8px 16px",
    fontSize: 13.5,
    fontWeight: 700,
    cursor: "pointer",
    fontFamily: "inherit",
    whiteSpace: "nowrap",
  });

  return (
    <div dir="rtl" style={{ minHeight: "100vh", background: T.page, fontFamily: T.font, color: T.ink }}>
      {/* ── Top nav ─────────────────────────────────────────── */}
      <nav style={{ position: "sticky", top: 0, zIndex: 40, width: "100%", background: "rgba(255,255,255,0.9)", backdropFilter: "blur(16px)", WebkitBackdropFilter: "blur(16px)", borderBottom: `1px solid ${T.line}` }}>
        <div style={{ maxWidth: 1240, margin: "0 auto", padding: "0 32px", height: 64, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <button onClick={() => navigate("/")} style={{ display: "inline-flex", alignItems: "center", gap: 8, border: "none", background: "transparent", cursor: "pointer", fontFamily: "inherit", fontSize: 18, fontWeight: 800, color: T.ink }}>
            <span aria-hidden style={{ width: 28, height: 28, borderRadius: 9, background: T.ink, color: "#fff", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 15 }}>◈</span>
            מסלול
          </button>
          <button
            onClick={() => navigate(isAuthenticated ? "/dashboard" : "/auth")}
            style={{ border: "none", background: T.ink, color: "#fff", borderRadius: 999, padding: "10px 20px", fontSize: 14, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}
          >
            {isAuthenticated ? "המפות שלי" : "התחברות"}
          </button>
        </div>
      </nav>

      <main style={{ maxWidth: 1240, margin: "0 auto", padding: "48px 32px 24px" }}>
        {/* ── Header ────────────────────────────────────────── */}
        <div style={{ textAlign: "center", marginBottom: 36 }}>
          <h1 style={{ margin: 0, fontSize: "clamp(30px, 3.6vw, 46px)", fontWeight: 800, letterSpacing: "-0.03em", color: T.ink }}>
            מפות של אחרים
          </h1>
          <p style={{ margin: "12px auto 0", maxWidth: 560, fontSize: 16.5, color: T.ink3, lineHeight: 1.6 }}>
            גלו מסלולים שבנו אחרים, שמרו למועדפים, ותכננו את שלכם
          </p>
        </div>

        {/* ── Discovery bar ─────────────────────────────────── */}
        <div style={{ display: "flex", flexDirection: "column", gap: 14, marginBottom: 30 }}>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
            <input
              type="text"
              value={qInput}
              onChange={(e) => setQInput(e.target.value)}
              placeholder="חיפוש מסלול…"
              style={{
                flex: "1 1 240px",
                minWidth: 200,
                height: 46,
                borderRadius: 12,
                border: `1px solid ${T.line}`,
                background: "#fff",
                padding: "0 16px",
                fontSize: 14.5,
                fontFamily: "inherit",
                color: T.ink,
              }}
            />
            <div style={{ position: "relative", flex: "1 1 180px", minWidth: 160 }}>
              <input
                type="text"
                value={destination}
                onChange={(e) => setDestination(e.target.value)}
                onFocus={() => destPreds.length > 0 && setDestOpen(true)}
                onBlur={() => setTimeout(() => setDestOpen(false), 150)}
                placeholder="יעד (חיפוש מגוגל)…"
                autoComplete="off"
                style={{
                  width: "100%",
                  boxSizing: "border-box",
                  height: 46,
                  borderRadius: 12,
                  border: `1px solid ${T.line}`,
                  background: "#fff",
                  padding: "0 16px",
                  fontSize: 14.5,
                  fontFamily: "inherit",
                  color: T.ink,
                }}
              />
              {destOpen && destPreds.length > 0 && (
                <div style={{
                  position: "absolute", top: "calc(100% + 6px)", insetInlineStart: 0, insetInlineEnd: 0, zIndex: 60,
                  background: "#fff", border: `1px solid ${T.line}`, borderRadius: 12, overflow: "hidden",
                  boxShadow: "0 12px 32px rgba(0,0,0,0.14)",
                }}>
                  {destPreds.slice(0, 6).map((p) => (
                    <button
                      key={p.placeId}
                      onMouseDown={(e) => { e.preventDefault(); pickDest(p); }}
                      style={{
                        display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 2,
                        width: "100%", textAlign: "right", padding: "10px 14px", border: "none",
                        borderBottom: `1px solid ${T.line}`, background: "#fff", cursor: "pointer", fontFamily: "inherit",
                      }}
                    >
                      <span style={{ fontSize: 14, fontWeight: 700, color: T.ink }}>{p.primary}</span>
                      {p.secondary && <span style={{ fontSize: 12, color: T.ink3 }}>{p.secondary}</span>}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div style={{ display: "inline-flex", borderRadius: 12, border: `1px solid ${T.line}`, overflow: "hidden", flexShrink: 0 }}>
              {[{ id: "popular", label: "פופולריים" }, { id: "new", label: "חדשים" }].map((s) => (
                <button
                  key={s.id}
                  onClick={() => setSort(s.id)}
                  style={{
                    height: 46,
                    padding: "0 18px",
                    border: "none",
                    background: sort === s.id ? T.ink : "#fff",
                    color: sort === s.id ? "#fff" : T.ink2,
                    fontSize: 14,
                    fontWeight: 700,
                    cursor: "pointer",
                    fontFamily: "inherit",
                  }}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {GALLERY_CATEGORIES.map((c) => (
              <button key={c.slug} onClick={() => toggleCategory(c.slug)} style={chipStyle(category === c.slug)}>
                {c.label}
              </button>
            ))}
          </div>
        </div>

        {/* ── Results ───────────────────────────────────────── */}
        {!loading && trips.length === 0 ? (
          <div style={{ textAlign: "center", padding: "80px 20px", color: T.ink3, fontSize: 16 }}>
            עדיין אין מפות — היו הראשונים לפרסם!
          </div>
        ) : (
          <>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 18 }}>
              {trips.map((trip) => (
                <GalleryCard
                  key={trip.id}
                  trip={trip}
                  favorited={favIds.has(trip.id)}
                  onToggleFav={onToggleFav}
                />
              ))}
            </div>

            {trips.length >= limit && (
              <div style={{ display: "flex", justifyContent: "center", marginTop: 32 }}>
                <button
                  onClick={() => setLimit((l) => l + PAGE_SIZE)}
                  disabled={loading}
                  style={{
                    height: 46,
                    padding: "0 28px",
                    borderRadius: 999,
                    border: `1.5px solid ${T.ink}`,
                    background: "transparent",
                    color: T.ink,
                    fontSize: 14.5,
                    fontWeight: 700,
                    cursor: loading ? "default" : "pointer",
                    opacity: loading ? 0.6 : 1,
                    fontFamily: "inherit",
                  }}
                >
                  טען עוד
                </button>
              </div>
            )}
          </>
        )}
      </main>

      <SiteFooter />
    </div>
  );
};

export default GalleryView;
