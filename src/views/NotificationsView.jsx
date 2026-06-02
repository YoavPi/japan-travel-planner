import React, { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useDarkMode } from "../utils/theme";

/* ──────────────────────────────────────────────────────────────
   NotificationsView — "התראות" feed.

   Mocked items live in localStorage (tp_notifs_v1). Each entry:
     { id, kind, title, body, ts, read }
   Kinds:
     • share-invite    — someone shared a map with you
     • collab-edit     — collaborator added/changed a stop
     • trip-saved      — auto-save heartbeat (system)
     • feature         — product announcement
   Empty-state seeds three sample notifications the first time.
   ────────────────────────────────────────────────────────────── */

const ACCENT = "#E0533F";
const FONT = "'Noto Sans Hebrew','Inter','Noto Sans JP',system-ui,sans-serif";
const STORE = "tp_notifs_v1";

const readStore = () => {
  try { return JSON.parse(localStorage.getItem(STORE) || "[]"); } catch { return []; }
};
const writeStore = (arr) => {
  try { localStorage.setItem(STORE, JSON.stringify(arr)); } catch { /* noop */ }
};

const seed = () => ([
  { id: "n1", kind: "share-invite", title: "מסלול שותף איתכם", body: "יותם לוי הזמין אתכם לערוך \"איטליה · ירח דבש\".", ts: Date.now() - 1000 * 60 * 12, read: false },
  { id: "n2", kind: "collab-edit",  title: "עדכון במסלול", body: "נועה כהן הוסיפה תחנה חדשה ליום 3 ב\"פורטוגל עם המשפחה\".", ts: Date.now() - 1000 * 60 * 60 * 3, read: false },
  { id: "n3", kind: "trip-saved",   title: "המסלול נשמר אוטומטית", body: "כל השינויים בדובאי מסונכרנים בענן.", ts: Date.now() - 1000 * 60 * 60 * 24 * 2, read: true },
]);

const KIND_META = {
  "share-invite": { icon: "↗", color: "#4A7FB5" },
  "collab-edit":  { icon: "✏", color: "#5A8C5F" },
  "trip-saved":   { icon: "✓", color: "#2B7B71" },
  "feature":      { icon: "✨", color: ACCENT },
};

const timeAgo = (ts) => {
  const s = Math.max(1, Math.floor((Date.now() - ts) / 1000));
  if (s < 60) return `לפני ${s} שנ׳`;
  const m = Math.floor(s / 60);
  if (m < 60) return `לפני ${m} דק׳`;
  const h = Math.floor(m / 60);
  if (h < 24) return `לפני ${h} שע׳`;
  const d = Math.floor(h / 24);
  if (d < 7) return `לפני ${d} ימים`;
  return new Date(ts).toLocaleDateString("he-IL");
};

const NotificationsView = () => {
  const navigate = useNavigate();
  const { P } = useDarkMode();
  const [items, setItems] = useState(() => {
    const existing = readStore();
    if (existing.length) return existing;
    const fresh = seed();
    writeStore(fresh);
    return fresh;
  });

  const persist = (next) => { setItems(next); writeStore(next); };

  const unreadCount = useMemo(() => items.filter((it) => !it.read).length, [items]);

  const markAllRead = () => persist(items.map((it) => ({ ...it, read: true })));
  const toggleRead  = (id) => persist(items.map((it) => it.id === id ? { ...it, read: !it.read } : it));
  const remove      = (id) => persist(items.filter((it) => it.id !== id));
  const clearAll    = () => { if (window.confirm("לנקות את כל ההתראות?")) persist([]); };

  return (
    <div dir="rtl" style={{ minHeight: "100vh", background: P.page, fontFamily: FONT, transition: "background 0.25s" }}>
      <div className="tp-fade" style={{ maxWidth: 560, margin: "0 auto", background: P.panel, minHeight: "100vh", paddingBottom: 96, transition: "background 0.25s" }}>

        {/* Top bar */}
        <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 16px", borderBottom: `1px solid ${P.line}` }}>
          <button onClick={() => navigate(-1)} title="חזרה" className="tp-press"
            style={{ width: 40, height: 40, borderRadius: "50%", border: "none", background: P.surface, color: P.ink, cursor: "pointer", fontSize: 17, fontFamily: "inherit" }}>›</button>
          <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 17, fontWeight: 800, color: P.ink }}>
            התראות
            {unreadCount > 0 && (
              <span style={{ fontSize: 11, fontWeight: 800, color: "#fff", background: ACCENT, borderRadius: 999, padding: "2px 8px" }}>{unreadCount}</span>
            )}
          </div>
          <button onClick={markAllRead} title="סמנו הכל כנקראו" className="tp-press"
            style={{ height: 36, padding: "0 12px", borderRadius: 999, border: `1px solid ${P.line}`, background: P.surface, color: P.ink2, fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
            סמנו כנקראו
          </button>
        </header>

        {/* List */}
        <div style={{ padding: "10px 16px 16px" }}>
          {items.length === 0 ? (
            <div style={{ textAlign: "center", color: P.ink3, padding: "60px 0", fontSize: 14 }}>
              <div style={{ fontSize: 40, marginBottom: 10 }}>🔕</div>
              אין התראות חדשות
            </div>
          ) : (
            <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 10 }}>
              {items.map((it, i) => {
                const meta = KIND_META[it.kind] || KIND_META.feature;
                return (
                  <li key={it.id} className="tp-fade-up tp-card"
                    style={{ display: "flex", gap: 12, padding: 14, borderRadius: 16, border: `1px solid ${P.line}`,
                      background: it.read ? P.panel : (it.kind === "share-invite" ? `${meta.color}0F` : P.surface),
                      animationDelay: `${Math.min(i, 8) * 50}ms` }}>
                    <span aria-hidden style={{ width: 38, height: 38, borderRadius: 12, background: `${meta.color}22`, color: meta.color, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 17, fontWeight: 800, flexShrink: 0 }}>
                      {meta.icon}
                    </span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
                        <span style={{ fontSize: 14.5, fontWeight: 800, color: P.ink }}>{it.title}</span>
                        {!it.read && <span style={{ width: 7, height: 7, borderRadius: "50%", background: ACCENT, flexShrink: 0 }} />}
                      </div>
                      <div style={{ fontSize: 12.5, color: P.ink3, marginTop: 3, lineHeight: 1.5 }}>{it.body}</div>
                      <div style={{ display: "flex", gap: 12, marginTop: 8, alignItems: "center" }}>
                        <span style={{ fontSize: 11, color: P.ink4 }}>{timeAgo(it.ts)}</span>
                        <button onClick={() => toggleRead(it.id)} className="tp-press"
                          style={{ border: "none", background: "transparent", padding: 0, fontSize: 11, fontWeight: 600, color: P.ink3, cursor: "pointer", fontFamily: "inherit" }}>
                          {it.read ? "סמנו כלא־נקרא" : "סמנו כנקרא"}
                        </button>
                        <button onClick={() => remove(it.id)} className="tp-press"
                          style={{ border: "none", background: "transparent", padding: 0, fontSize: 11, fontWeight: 600, color: P.danger, cursor: "pointer", fontFamily: "inherit", marginInlineStart: "auto" }}>
                          הסר
                        </button>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}

          {items.length > 0 && (
            <button onClick={clearAll} className="tp-press"
              style={{ display: "block", margin: "18px auto 0", border: "none", background: "transparent", color: P.ink3, fontSize: 12.5, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
              נקו את כל ההתראות
            </button>
          )}
        </div>
      </div>

      {/* Floating bottom dock (same as Dashboard) */}
      <nav style={{ position: "fixed", bottom: 16, left: "50%", transform: "translateX(-50%)", zIndex: 40, display: "flex", gap: 4, padding: 6, borderRadius: 999, background: "#0D0F11", boxShadow: "0 12px 40px rgba(0,0,0,0.35)" }}>
        {[
          { id: "home", icon: "🏠", title: "בית", onClick: () => navigate("/") },
          { id: "maps", icon: "🗺", title: "המפות שלי", onClick: () => navigate("/dashboard") },
          { id: "notif", icon: "🔔", title: "התראות", active: true, onClick: () => {} },
          { id: "profile", icon: "👤", title: "פרופיל", onClick: () => navigate("/profile") },
        ].map((it) => (
          <button key={it.id} onClick={it.onClick} title={it.title} className="tp-press"
            style={{ width: 48, height: 48, borderRadius: 999, border: "none", cursor: "pointer", fontSize: 18, fontFamily: "inherit", background: it.active ? "#fff" : "transparent", color: it.active ? "#0D0F11" : "rgba(255,255,255,0.7)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            {it.icon}
          </button>
        ))}
      </nav>
    </div>
  );
};

export default NotificationsView;
