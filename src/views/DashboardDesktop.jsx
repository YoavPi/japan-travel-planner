import React, { useState } from "react";
import MapCard from "../components/MapCard";
import Icon from "../components/Icon";
import PublishToGalleryModal from "../components/PublishToGalleryModal";
import isAdminEmail from "../utils/isAdmin";

/* ══════════════════════════════════════════════════════════════
   DashboardDesktop — the ≥1024px "My Maps" home, built as a real
   desktop web app rather than a widened mobile column.

   Layout:  full-width frosted top bar
            ├─ workspace (left, flex): section head + trip GRID
            └─ sidebar  (right, RTL start, sticky): profile · stats
               · storage meter · account links

   It is a PURE presentational shell — every piece of data and every
   handler is threaded in from DashboardView, which still owns state,
   the mobile layout, and all the modals. Mobile never mounts this.
   ══════════════════════════════════════════════════════════════ */

const ACCENT = "#E0533F";
const FONT = "'Noto Sans Hebrew','Inter','Noto Sans JP',system-ui,sans-serif";

const Circle = ({ children, onClick, title, P }) => (
  <button onClick={onClick} title={title} className="tp-press"
    style={{ width: 40, height: 40, borderRadius: "50%", border: `1px solid ${P.line}`, background: P.surface, color: P.ink, cursor: "pointer", fontFamily: "inherit", display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
    {children}
  </button>
);

const DashboardDesktop = ({
  user, P, dark, toggleTheme, navigate,
  stats, counts, FILTERS, filter, setFilter,
  filtered, loadError, onRetry,
  tripCount, atTripCap, maxTrips, activeId,
  openTrip, onShare, onSaveMemo, onDelete, showToast, onCreateAi, favorites, onToggleFavorite,
}) => {
  const frost = dark ? "rgba(20,19,23,0.72)" : "rgba(255,255,255,0.72)";
  /* Which trip's publish-to-gallery modal is open (also doubles as the
     rename / cover-change sheet — it already surfaces both fields). */
  const [publishTrip, setPublishTrip] = useState(null);

  return (
    <div dir="rtl" style={{ minHeight: "100vh", background: P.page, fontFamily: FONT, transition: "background 0.25s" }}>

      {/* ── Full-width sticky top bar ─────────────────────────── */}
      <header style={{
        position: "sticky", top: 0, zIndex: 30,
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "14px 32px", background: frost,
        backdropFilter: "blur(20px) saturate(180%)", WebkitBackdropFilter: "blur(20px) saturate(180%)",
        borderBottom: `1px solid ${P.line}`,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span aria-hidden style={{ width: 30, height: 30, borderRadius: 9, background: P.ink, color: P.panel, display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 15, fontWeight: 800 }}>◈</span>
          <span style={{ fontSize: 20, fontWeight: 800, letterSpacing: "-0.022em", color: P.ink }}>המפות שלי</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Circle P={P} title={dark ? "מצב בהיר" : "מצב כהה"} onClick={toggleTheme}>
            <Icon name={dark ? "sun" : "moon"} size={18} strokeWidth={1.9} />
          </Circle>
          <Circle P={P} title="שיתוף פרופיל" onClick={() => { navigator.clipboard?.writeText(window.location.origin).catch(() => {}); showToast("הקישור הועתק"); }}>
            <Icon name="share" size={17} strokeWidth={1.9} />
          </Circle>
          {/* Sprint 67 — AI generator, the primary create action, beside "מסלול חדש". */}
          <button
            onClick={atTripCap ? undefined : onCreateAi}
            disabled={atTripCap} aria-disabled={atTripCap}
            title={atTripCap ? "הגעת למכסת המפות המקסימלית לחשבון חינמי" : "בניית מסלול בעזרת AI"}
            className={atTripCap ? undefined : "tp-press"}
            style={{ marginInlineStart: 4, height: 40, padding: "0 18px", borderRadius: 999, border: "none", cursor: atTripCap ? "not-allowed" : "pointer", fontFamily: "inherit", fontSize: 13.5, fontWeight: 800, display: "inline-flex", alignItems: "center", gap: 7, background: atTripCap ? P.surface : "linear-gradient(135deg, #E0533F, #C0392B)", color: atTripCap ? P.ink4 : "#fff", opacity: atTripCap ? 0.6 : 1, boxShadow: atTripCap ? "none" : "0 6px 18px rgba(224,83,63,0.32)" }}>
            <span aria-hidden style={{ fontSize: 15 }}>✨</span> בניית מסלול בעזרת AI
          </button>
          <button
            onClick={atTripCap ? undefined : () => navigate("/create")}
            disabled={atTripCap} aria-disabled={atTripCap}
            title={atTripCap ? "הגעת למכסת המפות המקסימלית לחשבון חינמי" : "יצירת מסלול חדש"}
            className={atTripCap ? undefined : "tp-press"}
            style={{ height: 40, padding: "0 18px", borderRadius: 999, border: "none", cursor: atTripCap ? "not-allowed" : "pointer", fontFamily: "inherit", fontSize: 13.5, fontWeight: 800, display: "inline-flex", alignItems: "center", gap: 7, background: atTripCap ? P.surface : P.ink, color: atTripCap ? P.ink4 : P.panel }}>
            <Icon name={atTripCap ? "shield" : "plus"} size={16} strokeWidth={2.3} /> מסלול חדש
          </button>
          {/* Public gallery — discover maps others published ("market").
              Accent-tinted so it reads as a distinct discovery entry point. */}
          <button onClick={() => navigate("/gallery")} className="tp-press"
            title="מפות של אחרים — גלריית מסלולים"
            style={{ height: 40, padding: "0 16px", borderRadius: 999, border: `1.5px solid ${ACCENT}`, cursor: "pointer", fontFamily: "inherit", fontSize: 13.5, fontWeight: 800, display: "inline-flex", alignItems: "center", gap: 7, background: "#E0533F14", color: ACCENT }}>
            <Icon name="globe" size={16} strokeWidth={1.9} /> מפות של אחרים
          </button>
          {/* Example trip — an itinerary to explore beyond the user's own maps. */}
          <button onClick={() => navigate("/japan")} className="tp-press"
            title="מסלול לדוגמה — יפן"
            style={{ height: 40, padding: "0 16px", borderRadius: 999, border: `1px solid ${P.line}`, cursor: "pointer", fontFamily: "inherit", fontSize: 13.5, fontWeight: 800, display: "inline-flex", alignItems: "center", gap: 7, background: P.panel, color: P.ink2 }}>
            <span aria-hidden style={{ fontSize: 15 }}>🗾</span> מסלול לדוגמה
          </button>
          {isAdminEmail(user?.email) && (
            <span title="אדמין — ללא הגבלת מפות" style={{ marginInlineStart: 4, height: 40, padding: "0 13px", borderRadius: 999, border: "1px solid rgba(12,139,148,0.3)", background: "rgba(12,139,148,0.10)", color: "#0C8B94", fontSize: 12.5, fontWeight: 800, display: "inline-flex", alignItems: "center", gap: 6 }}>
              ✨ אדמין · {tripCount} מפות · ∞
            </span>
          )}
        </div>
      </header>

      {/* ── Two-column body ───────────────────────────────────── */}
      <div style={{ maxWidth: 1320, margin: "0 auto", padding: "26px 32px 60px", display: "flex", gap: 28, alignItems: "flex-start" }}>

        {/* ── Sidebar (RTL inline-start = right) ─────────────── */}
        <aside style={{ width: 300, flexShrink: 0, position: "sticky", top: 88, display: "flex", flexDirection: "column", gap: 16 }}>
          {/* Profile card */}
          <div style={{ background: P.panel, border: `1px solid ${P.line}`, borderRadius: 20, padding: 20, textAlign: "center" }}>
            <div style={{ position: "relative", width: 88, height: 88, margin: "0 auto 12px" }}>
              <div style={{ width: 88, height: 88, borderRadius: "50%", background: `linear-gradient(145deg, ${ACCENT}, #B83A2B)`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 34, fontWeight: 800, color: "#fff" }}>
                {(user?.name || "?").trim().slice(0, 1)}
              </div>
              <button title="החלפת תמונה" aria-label="החלפת תמונת פרופיל" className="tp-press" style={{ position: "absolute", bottom: 0, insetInlineStart: 0, width: 30, height: 30, borderRadius: "50%", border: `3px solid ${P.panel}`, background: P.ink, color: P.panel, cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Icon name="camera" size={13} strokeWidth={2} />
              </button>
            </div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
              <span style={{ fontSize: 18, fontWeight: 800, letterSpacing: "-0.02em", color: P.ink }}>{user?.name}</span>
              {user?.plan && <span style={{ fontSize: 9.5, fontWeight: 800, textTransform: "uppercase", color: ACCENT, background: "rgba(224,83,63,0.12)", borderRadius: 999, padding: "2px 7px" }}>{user.plan}</span>}
            </div>
            <div style={{ fontSize: 12.5, color: P.ink3, direction: "ltr", marginTop: 3 }}>{user?.email}</div>
            <button onClick={() => navigate("/settings")} className="tp-press" style={{ display: "inline-flex", alignItems: "center", gap: 6, marginTop: 14, padding: "8px 16px", borderRadius: 999, border: `1px solid ${P.line}`, background: P.surface, fontSize: 12.5, fontWeight: 700, color: P.ink, cursor: "pointer", fontFamily: "inherit" }}>
              <Icon name="edit" size={12} strokeWidth={2} /> ערכו פרופיל
            </button>
          </div>

          {/* Stats — 3 mini tiles */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 10 }}>
            {[{ n: stats.trips, l: "מסלולים" }, { n: stats.countries, l: "מדינות" }, { n: stats.days, l: "ימי טיול" }].map((s) => (
              <div key={s.l} style={{ background: P.panel, border: `1px solid ${P.line}`, borderRadius: 14, padding: "13px 4px", textAlign: "center" }}>
                <div style={{ fontSize: 21, fontWeight: 800, letterSpacing: "-0.015em", color: P.ink, fontVariantNumeric: "tabular-nums" }}>{s.n}</div>
                <div style={{ fontSize: 10.5, color: P.ink3, marginTop: 2 }}>{s.l}</div>
              </div>
            ))}
          </div>

          {/* Saved-maps count (real — no fake storage quota). */}
          <div style={{ background: P.panel, border: `1px solid ${P.line}`, borderRadius: 16, padding: "14px 16px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span style={{ fontSize: 12.5, fontWeight: 800, color: P.ink }}>מסלולים שמורים</span>
            <span style={{ fontSize: 16, fontWeight: 800, color: P.ink, fontVariantNumeric: "tabular-nums" }}>{counts.all}</span>
          </div>

          {/* Account links */}
          <div style={{ background: P.panel, border: `1px solid ${P.line}`, borderRadius: 16, overflow: "hidden" }}>
            {[
              { icon: "settings", label: "הגדרות וניהול", sub: "שפה, יחידות, התראות" },
              { icon: "download", label: "מפות לא־מקוונות", sub: "זמינות גם בלי רשת" },
            ].map((r, i) => (
              <button key={r.label} onClick={() => navigate("/settings")} className="tp-press"
                style={{ display: "flex", alignItems: "center", gap: 12, padding: "13px 15px", borderTop: i ? `1px solid ${P.line}` : "none", width: "100%", background: "transparent", border: "none", cursor: "pointer", fontFamily: "inherit", textAlign: "right" }}>
                <span style={{ width: 32, height: 32, borderRadius: 9, background: P.surface, display: "flex", alignItems: "center", justifyContent: "center", color: P.ink2 }}>
                  <Icon name={r.icon} size={16} strokeWidth={1.9} />
                </span>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ display: "block", fontSize: 13.5, fontWeight: 600, color: P.ink }}>{r.label}</span>
                  <span style={{ display: "block", fontSize: 11.5, color: P.ink3, marginTop: 1 }}>{r.sub}</span>
                </span>
                <span style={{ color: P.ink4, display: "inline-flex" }}><Icon name="chevronEnd" size={15} strokeWidth={2} /></span>
              </button>
            ))}
          </div>
        </aside>

        {/* ── Workspace (main) ──────────────────────────────── */}
        <main style={{ flex: 1, minWidth: 0 }}>
          {/* Section head: title + filter chips */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, marginBottom: 18, flexWrap: "wrap" }}>
            <div>
              <h1 style={{ margin: 0, fontSize: 26, fontWeight: 800, letterSpacing: "-0.025em", color: P.ink }}>המסלולים שלי</h1>
              <div style={{ fontSize: 13, color: P.ink3, marginTop: 3 }}>
                {filtered === null ? "טוען…" : `${filtered.length} ${filtered.length === 1 ? "מסלול" : "מסלולים"}${filter !== "all" ? " · מסונן" : ""}`}
              </div>
            </div>
            <div style={{ display: "flex", gap: 4, background: P.surface, borderRadius: 999, padding: 4 }}>
              {FILTERS.map((f) => {
                const on = filter === f.id;
                return (
                  <button key={f.id} onClick={() => setFilter(f.id)}
                    style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 16px", borderRadius: 999, border: "none", cursor: "pointer", fontFamily: "inherit", fontSize: 13, fontWeight: 700, background: on ? P.panel : "transparent", color: on ? P.ink : P.ink3, boxShadow: on ? "0 1px 4px rgba(0,0,0,0.10)" : "none" }}>
                    {f.label}
                    <span style={{ fontSize: 10.5, fontWeight: 800, background: on ? P.surface2 : "transparent", color: on ? P.ink2 : P.ink4, borderRadius: 999, padding: "1px 7px" }}>{f.n}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Grid / states */}
          {filtered === null ? (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 16 }}>
              {[0, 1, 2, 3].map((i) => <div key={i} style={{ height: 150, borderRadius: 20, background: `linear-gradient(90deg, ${P.surface}, ${P.surface2}, ${P.surface})`, backgroundSize: "200% 100%", animation: "tpSkeleton 1.2s ease infinite" }} />)}
            </div>
          ) : loadError ? (
            <div className="tp-fade-up" style={{ textAlign: "center", padding: "56px 16px", display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
              <div style={{ width: 64, height: 64, borderRadius: "50%", background: "rgba(192,57,43,0.10)", color: "#C0392B", display: "inline-flex", alignItems: "center", justifyContent: "center" }}><Icon name="shield" size={26} strokeWidth={1.8} /></div>
              <div style={{ fontSize: 16, fontWeight: 800, color: P.ink }}>לא הצלחנו לטעון את המסלולים</div>
              <div style={{ fontSize: 13, color: P.ink3, lineHeight: 1.55, maxWidth: 340 }}>ייתכן שיש בעיית רשת או הרשאות. המסלולים שלכם שמורים — אפשר לנסות שוב.</div>
              <button onClick={onRetry} className="tp-press" style={{ marginTop: 4, padding: "11px 22px", borderRadius: 999, border: "none", background: P.ink, color: P.panel, fontSize: 13.5, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", display: "inline-flex", alignItems: "center", gap: 8 }}>
                <span aria-hidden style={{ fontSize: 15, lineHeight: 1 }}>↻</span> נסו שוב
              </button>
            </div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 16, alignItems: "start" }}>
              {/* New-map CTA as the first grid tile (matches card height) */}
              <button
                onClick={atTripCap ? undefined : () => navigate("/create")}
                disabled={atTripCap} aria-disabled={atTripCap}
                title={atTripCap ? "הגעת למכסת המפות המקסימלית לחשבון חינמי" : "יצירת מסלול חדש"}
                className={atTripCap ? undefined : "tp-press"}
                style={{
                  minHeight: 150, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 10,
                  border: atTripCap ? "1.5px solid #C0392B" : `1.5px dashed ${P.line}`, borderRadius: 20,
                  background: atTripCap ? "rgba(192,57,43,0.06)" : "transparent",
                  cursor: atTripCap ? "not-allowed" : "pointer", width: "100%", fontFamily: "inherit", padding: 18,
                }}>
                <span style={{ width: 48, height: 48, borderRadius: 15, background: atTripCap ? "rgba(192,57,43,0.14)" : P.ink, color: atTripCap ? "#C0392B" : P.panel, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <Icon name={atTripCap ? "shield" : "plus"} size={24} strokeWidth={2.2} />
                </span>
                <span style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14.5, fontWeight: 800, color: atTripCap ? "#C0392B" : P.ink }}>
                  מסלול חדש
                  <span style={{ fontSize: 11, fontWeight: 800, color: atTripCap ? "#C0392B" : P.ink3, background: atTripCap ? "rgba(192,57,43,0.14)" : P.surface, borderRadius: 999, padding: "2px 9px", fontVariantNumeric: "tabular-nums" }}>{tripCount}/{maxTrips}</span>
                </span>
                <span style={{ fontSize: 12, color: atTripCap ? "#A03325" : P.ink3, textAlign: "center", lineHeight: 1.5, maxWidth: 240 }}>
                  {atTripCap ? "מכסת החשבון מלאה — מחקו מפה כדי ליצור חדשה." : "התחילו מאפס או מתבנית מוכנה"}
                </span>
              </button>

              {filtered.length === 0 ? (
                <div className="tp-fade-up" style={{ gridColumn: "1 / -1", textAlign: "center", padding: "40px 16px", display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
                  <div style={{ width: 64, height: 64, borderRadius: "50%", background: P.surface, color: P.ink3, display: "inline-flex", alignItems: "center", justifyContent: "center" }}><Icon name="map" size={28} strokeWidth={1.6} /></div>
                  <div style={{ fontSize: 15, fontWeight: 800, color: P.ink }}>אין כאן מסלולים עדיין</div>
                  <div style={{ fontSize: 13, color: P.ink3, lineHeight: 1.55, maxWidth: 300 }}>בנו את המסלול הראשון שלכם — נמלא יעדים, ימים וערים תוך דקה.</div>
                </div>
              ) : (
                filtered.map((t, i) => (
                  <MapCard
                    key={t.id} trip={t} index={i} dark={dark}
                    active={t.id === activeId}
                    onOpen={() => openTrip(t)}
                    onShare={t.role === "owner" ? () => onShare(t.id) : undefined}
                    onSaveMemo={onSaveMemo}
                    onDelete={() => onDelete(t)}
                    favorite={favorites && favorites.has(t.id)}
                    onToggleFavorite={onToggleFavorite}
                    onPublish={() => setPublishTrip(t)}
                    onRename={() => setPublishTrip(t)}
                    onEditCover={() => setPublishTrip(t)}
                  />
                ))
              )}
            </div>
          )}
        </main>
      </div>

      {/* Publish-to-gallery modal — also doubles as the rename / cover
          editor (opened from the card's ellipsis menu). */}
      {publishTrip && (
        <PublishToGalleryModal
          trip={publishTrip}
          onClose={() => setPublishTrip(null)}
          onDone={() => { setPublishTrip(null); }}
        />
      )}
    </div>
  );
};

export default DashboardDesktop;
