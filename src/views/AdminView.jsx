import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { useDarkMode } from "../utils/theme";

const FONT = "'Noto Sans Hebrew','Inter',system-ui,sans-serif";
const nf = (n) => new Intl.NumberFormat("he-IL").format(Number.isFinite(n) ? n : 0);
const fmtDate = (s) => (s ? new Date(s).toLocaleDateString("he-IL") : "—");

const AdminView = () => {
  const navigate = useNavigate();
  const { P } = useDarkMode();
  const [state, setState] = useState({ loading: true, error: null, data: null });
  const [sortKey, setSortKey] = useState("lastActiveAt");
  const [q, setQ] = useState("");
  const [selected, setSelected] = useState(null);

  useEffect(() => {
    let live = true;
    (async () => {
      try {
        const { data: sess } = await supabase.auth.getSession();
        const token = sess?.session?.access_token;
        if (!token) throw new Error("no-session");
        const res = await fetch("/api/admin/overview", { headers: { authorization: `Bearer ${token}` } });
        if (res.status === 403) throw new Error("אין הרשאה לצפות בעמוד זה.");
        if (!res.ok) throw new Error(`שגיאת שרת (${res.status})`);
        const json = await res.json();
        if (live) setState({ loading: false, error: null, data: json });
      } catch (e) {
        if (live) setState({ loading: false, error: String(e.message || e), data: null });
      }
    })();
    return () => { live = false; };
  }, []);

  const rows = useMemo(() => {
    const users = state.data?.users || [];
    const filtered = q ? users.filter((u) => (u.email || "").includes(q.toLowerCase())) : users;
    const val = (u) => {
      switch (sortKey) {
        case "trips": return u.trips.total;
        case "aiUses": return u.aiUses;
        case "tokens": return u.tokens.total;
        case "joinedAt": return Date.parse(u.joinedAt || "") || 0;
        default: return Date.parse(u.lastActiveAt || "") || 0;
      }
    };
    return [...filtered].sort((a, b) => val(b) - val(a));
  }, [state.data, q, sortKey]);

  if (state.loading) {
    return <div dir="rtl" style={{ minHeight: "100vh", display: "grid", placeItems: "center", fontFamily: FONT, color: P.ink3 }}>טוען נתונים…</div>;
  }
  if (state.error) {
    return (
      <div dir="rtl" style={{ minHeight: "100vh", display: "grid", placeItems: "center", gap: 12, fontFamily: FONT, color: P.ink }}>
        <div style={{ fontWeight: 800 }}>{state.error}</div>
        <button onClick={() => navigate("/dashboard")} style={{ padding: "8px 16px", borderRadius: 10, border: `1px solid ${P.line}`, background: P.surface, cursor: "pointer", fontFamily: FONT, color: P.ink }}>חזרה לדשבורד</button>
      </div>
    );
  }

  const k = state.data.kpis;
  const kpiTiles = [
    { label: "משתמשים", value: k.users },
    { label: "פעילים השבוע", value: k.activeThisWeek },
    { label: "מסלולים", value: k.trips },
    { label: "שימושי AI", value: k.aiUses },
    { label: "טוקנים סה\"כ", value: k.tokensTotal },
    { label: "טוקנים השבוע", value: k.tokensThisWeek },
  ];
  const cols = [
    { key: "lastActiveAt", label: "פעילות אחרונה" },
    { key: "joinedAt", label: "הצטרפות" },
    { key: "trips", label: "מסלולים" },
    { key: "aiUses", label: "שימושי AI" },
    { key: "tokens", label: "טוקנים" },
  ];

  return (
    <div dir="rtl" style={{ minHeight: "100vh", background: P.surface, fontFamily: FONT, color: P.ink, padding: "20px clamp(12px,4vw,32px) 64px", maxWidth: 1100, margin: "0 auto" }}>
      <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
        <h1 style={{ fontSize: 24, fontWeight: 800, margin: 0 }}>ניהול משתמשים</h1>
        <button onClick={() => navigate("/dashboard")} style={{ padding: "8px 14px", borderRadius: 10, border: `1px solid ${P.line}`, background: P.surface, cursor: "pointer", fontFamily: FONT, color: P.ink, fontWeight: 700, fontSize: 13 }}>← דשבורד</button>
      </header>

      {/* KPI strip */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(140px,1fr))", gap: 10, marginBottom: 22 }}>
        {kpiTiles.map((t) => (
          <div key={t.label} style={{ background: P.panel, border: `1px solid ${P.line}`, borderRadius: 12, padding: "12px 14px" }}>
            <div style={{ fontSize: 12, color: P.ink3, marginBottom: 4 }}>{t.label}</div>
            <div style={{ fontSize: 24, fontWeight: 800, fontVariantNumeric: "tabular-nums" }}>{nf(t.value)}</div>
          </div>
        ))}
      </div>

      {/* Search */}
      <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="חיפוש לפי אימייל…"
        style={{ width: "100%", boxSizing: "border-box", padding: "10px 14px", borderRadius: 10, border: `1px solid ${P.line}`, background: P.surface, color: P.ink, fontFamily: FONT, fontSize: 14, marginBottom: 12 }} />

      {/* Users table */}
      <div style={{ overflowX: "auto", border: `1px solid ${P.line}`, borderRadius: 12 }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13.5, minWidth: 640 }}>
          <thead>
            <tr>
              <th style={{ textAlign: "right", padding: "10px 12px", color: P.ink3, fontWeight: 700, borderBottom: `1px solid ${P.line}` }}>אימייל</th>
              {cols.map((c) => (
                <th key={c.key} onClick={() => setSortKey(c.key)} title="מיון"
                  style={{ textAlign: "right", padding: "10px 12px", color: sortKey === c.key ? "#E0533F" : P.ink3, fontWeight: 700, borderBottom: `1px solid ${P.line}`, cursor: "pointer", whiteSpace: "nowrap" }}>
                  {c.label}{sortKey === c.key ? " ↓" : ""}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr><td colSpan={6} style={{ padding: 24, textAlign: "center", color: P.ink3 }}>אין משתמשים להצגה</td></tr>
            )}
            {rows.map((u) => (
              <tr key={u.id} onClick={() => setSelected(u)} style={{ cursor: "pointer" }}>
                <td style={{ padding: "10px 12px", borderBottom: `1px solid ${P.line}`, direction: "ltr", textAlign: "right" }}>{u.email || u.id}</td>
                <td style={{ padding: "10px 12px", borderBottom: `1px solid ${P.line}` }}>{fmtDate(u.lastActiveAt)}</td>
                <td style={{ padding: "10px 12px", borderBottom: `1px solid ${P.line}` }}>{fmtDate(u.joinedAt)}</td>
                <td style={{ padding: "10px 12px", borderBottom: `1px solid ${P.line}`, fontVariantNumeric: "tabular-nums" }}>{nf(u.trips.total)} <span style={{ color: P.ink4, fontSize: 11 }}>({nf(u.trips.ai)} AI · {nf(u.trips.manual)} ידני)</span></td>
                <td style={{ padding: "10px 12px", borderBottom: `1px solid ${P.line}`, fontVariantNumeric: "tabular-nums" }}>{nf(u.aiUses)}</td>
                <td style={{ padding: "10px 12px", borderBottom: `1px solid ${P.line}`, fontVariantNumeric: "tabular-nums" }}>{nf(u.tokens.total)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Detail drawer */}
      {selected && (
        <div onClick={() => setSelected(null)} style={{ position: "fixed", inset: 0, zIndex: 80, background: "rgba(0,0,0,0.35)" }}>
          <div dir="rtl" onClick={(e) => e.stopPropagation()} style={{ position: "absolute", insetInlineStart: 0, top: 0, bottom: 0, width: "min(440px,92%)", background: P.panel, boxShadow: "8px 0 40px rgba(0,0,0,0.2)", padding: "20px", overflowY: "auto", fontFamily: FONT }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
              <div style={{ direction: "ltr", fontWeight: 800, fontSize: 15 }}>{selected.email || selected.id}</div>
              <button onClick={() => setSelected(null)} aria-label="סגירה" style={{ border: "none", background: P.surface, width: 32, height: 32, borderRadius: "50%", cursor: "pointer", color: P.ink2, fontFamily: FONT }}>✕</button>
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16, fontSize: 12.5, color: P.ink2 }}>
              <span>הצטרף: {fmtDate(selected.joinedAt)}</span>·<span>שימושי AI: {nf(selected.aiUses)}</span>·<span>טוקנים: {nf(selected.tokens.total)}</span>
            </div>
            <div style={{ fontWeight: 800, fontSize: 14, marginBottom: 8 }}>המפות ({selected.maps.length})</div>
            {selected.maps.length === 0 && <div style={{ color: P.ink3, fontSize: 13 }}>אין מפות.</div>}
            {selected.maps.map((m) => (
              <div key={m.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0", borderBottom: `1px solid ${P.line}` }}>
                <span style={{ fontWeight: 600, fontSize: 13.5 }}>{m.title}</span>
                <span style={{ fontSize: 11, fontWeight: 700, borderRadius: 999, padding: "2px 8px", background: P.surface, color: m.source === "ai" ? "#E0533F" : P.ink3 }}>
                  {m.source === "ai" ? "AI" : m.source === "wizard" ? "ידני" : "לא ידוע"}{m.public ? " · ציבורי" : ""}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminView;
