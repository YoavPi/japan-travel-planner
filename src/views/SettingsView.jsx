import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { readPrefs, writePrefs } from "../services/prefsService";
import { useDarkMode } from "../utils/theme";
import Icon from "../components/Icon";

/* ──────────────────────────────────────────────────────────────
   SettingsView — "הגדרות וניהול". Dark-mode aware. The dark
   toggle uses the SHARED useDarkMode hook so every screen
   updates in sync.
   ────────────────────────────────────────────────────────────── */

const ACCENT = "#E0533F";
const FONT = "'Noto Sans Hebrew','Inter','Noto Sans JP',system-ui,sans-serif";

const SettingsView = () => {
  const navigate = useNavigate();
  const { user, signOut, updateProfile } = useAuth();
  const { dark, setDark, P } = useDarkMode();
  const [prefs, setPrefs] = useState(readPrefs);
  const [toast, setToast] = useState("");
  /* Editable account profile — display name persisted to the backend. */
  const [editingName, setEditingName] = useState(null); // string draft | null
  const [savingName, setSavingName] = useState(false);
  const openNameEditor = () => setEditingName(user?.name || "");
  const saveName = async () => {
    const clean = (editingName || "").trim();
    if (!clean || clean === user?.name) { setEditingName(null); return; }
    setSavingName(true);
    try {
      await updateProfile({ name: clean });
      setEditingName(null);
      setToast("הפרופיל עודכן");
      setTimeout(() => setToast(""), 1600);
    } catch {
      setToast("עדכון הפרופיל נכשל — נסו שוב");
      setTimeout(() => setToast(""), 1800);
    } finally {
      setSavingName(false);
    }
  };

  /* Other prefs persist via the local helper; dark goes through
     the hook so it broadcasts to mounted screens. */
  const update = (patch) => setPrefs(writePrefs(patch));
  const soon = () => { setToast("בקרוב"); setTimeout(() => setToast(""), 1400); };

  const Toggle = ({ on, onClick }) => (
    <button onClick={onClick} aria-pressed={on}
      style={{ width: 46, height: 28, borderRadius: 999, border: "none", cursor: "pointer", padding: 3, background: on ? ACCENT : (dark ? "rgba(255,255,255,0.18)" : "rgba(20,20,20,0.18)"), transition: "background 0.2s", flexShrink: 0 }}>
      <span style={{ display: "block", width: 22, height: 22, borderRadius: "50%", background: "#fff", transform: on ? "translateX(-18px)" : "translateX(0)", transition: "transform 0.2s", boxShadow: "0 1px 3px rgba(0,0,0,0.2)" }} />
    </button>
  );

  const Group = ({ children }) => (
    <div style={{ background: P.panel, borderRadius: 18, border: `1px solid ${P.line}`, overflow: "hidden", marginBottom: 14 }}>{children}</div>
  );

  const Row = ({ icon, title, sub, value, control, onClick, danger, first, soonBadge }) => (
    <div onClick={onClick}
      style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 16px", borderTop: first ? "none" : `1px solid ${P.line}`, cursor: onClick ? "pointer" : "default" }}>
      <span style={{ width: 34, height: 34, borderRadius: 10, background: danger ? "rgba(192,57,43,0.12)" : P.surface, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, color: danger ? P.danger : P.ink2 }}>
        <Icon name={icon} size={17} strokeWidth={1.9} />
      </span>
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{ display: "block", fontSize: 14.5, fontWeight: 600, color: danger ? P.danger : P.ink }}>{title}</span>
        {sub && <span style={{ display: "block", fontSize: 12, color: P.ink3, marginTop: 1 }}>{sub}</span>}
      </span>
      {soonBadge && (
        <span style={{ fontSize: 10.5, fontWeight: 800, letterSpacing: "0.04em", color: P.ink3, background: P.surface, border: `1px solid ${P.line}`, borderRadius: 999, padding: "3px 8px" }}>בקרוב</span>
      )}
      {value && <span style={{ fontSize: 13, fontWeight: 600, color: P.ink3 }}>{value}</span>}
      {control}
      {onClick && !control && !soonBadge && <span style={{ color: P.ink4, display: "inline-flex" }}><Icon name="chevronEnd" size={15} strokeWidth={2} /></span>}
    </div>
  );

  return (
    <div dir="rtl" style={{ minHeight: "100vh", background: P.page, fontFamily: FONT, transition: "background 0.25s" }}>
      <div style={{ maxWidth: 560, margin: "0 auto", minHeight: "100vh" }}>
        <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 16px", background: P.panel, borderBottom: `1px solid ${P.line}`, transition: "background 0.25s" }}>
          <button onClick={() => navigate("/dashboard")} title="חזרה" aria-label="חזרה" style={{ width: 40, height: 40, borderRadius: "50%", border: "none", background: P.surface, cursor: "pointer", fontFamily: "inherit", color: P.ink, display: "inline-flex", alignItems: "center", justifyContent: "center" }}><Icon name="chevronStart" size={16} strokeWidth={2} /></button>
          <div style={{ fontSize: 17, fontWeight: 800, color: P.ink }}>הגדרות וניהול</div>
          <span style={{ width: 40 }} />
        </header>

        <div style={{ padding: "16px 16px 96px" /* reserve bottom space for the floating dock */ }}>
          {/* Account */}
          <Group>
            <Row first icon="user" title="פרטי חשבון" sub={[user?.name, user?.email].filter(Boolean).join(" · ") || "שם ומייל"} value="עריכה" onClick={openNameEditor} />
            <Row icon="sparkle" title="מנוי וחיוב" value={user?.plan || "Free"} onClick={soon} soonBadge />
          </Group>

          {/* Preferences */}
          <Group>
            <Row first icon="globe" title="שפה" value="עברית" onClick={soon} soonBadge />
            <Row icon="ruler" title="יחידות מרחק"
              value={prefs.units === "km" ? "קילומטרים" : "מיילים"}
              onClick={() => update({ units: prefs.units === "km" ? "mi" : "km" })} />
            <Row icon="moon" title="מצב כהה" control={<Toggle on={dark} onClick={() => setDark(!dark)} />} />
          </Group>

          {/* Notifications + sharing */}
          <Group>
            <Row first icon="bell" title="התראות" sub="תזכורות ועדכונים מהמסלול" onClick={soon} soonBadge />
            <Row icon="share" title="עדכוני שיתוף" sub="כשמישהו עורך מסלול משותף" onClick={soon} soonBadge />
            <Row icon="shield" title="פרטיות והרשאות" sub="ברירת מחדל לשיתוף מסלולים" onClick={soon} soonBadge />
          </Group>

          {/* Support + danger */}
          <Group>
            <Row first icon="helpCircle" title="עזרה ותמיכה" onClick={soon} soonBadge />
            {/* Sprint 60 #4 — forceful sign-out: clear session, then hard
                window.location.replace to the public marketing home (full
                reload — no lingering editor canvas / cold SSO overlay). */}
            <Row icon="logOut" title="התנתקות" danger onClick={() => { signOut(); window.location.replace(window.location.origin + "/"); }} />
          </Group>

          <div style={{ textAlign: "center", fontSize: 12, color: P.ink4, marginTop: 18 }}>
            גרסה 3.0.0 · תכנון מסלולים
          </div>
        </div>
      </div>

      {/* Profile editor — edit the display name, saved to the backend. */}
      {editingName !== null && (
        <div dir="rtl" onClick={() => !savingName && setEditingName(null)}
          style={{ position: "fixed", inset: 0, zIndex: 90, background: "rgba(10,12,15,0.45)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20, fontFamily: FONT }}>
          <div onClick={(e) => e.stopPropagation()}
            style={{ width: "100%", maxWidth: 440, background: P.panel, borderRadius: 18, border: `1px solid ${P.line}`, padding: 20, boxShadow: "0 24px 70px rgba(0,0,0,0.4)" }}>
            <div style={{ fontSize: 17, fontWeight: 800, color: P.ink, marginBottom: 4 }}>עריכת פרופיל</div>
            <div style={{ fontSize: 12.5, color: P.ink3, marginBottom: 16 }}>{user?.email}</div>
            <label style={{ display: "block", fontSize: 12.5, fontWeight: 700, color: P.ink3, marginBottom: 6 }}>שם תצוגה</label>
            <input autoFocus value={editingName} onChange={(e) => setEditingName(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") saveName(); }}
              placeholder="השם שלך" maxLength={60}
              style={{ width: "100%", boxSizing: "border-box", height: 46, padding: "0 13px", borderRadius: 12, border: `1.5px solid ${P.line}`, background: P.page, color: P.ink, fontSize: 15, fontFamily: "inherit", direction: "rtl", textAlign: "right" }} />
            <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
              <button onClick={() => setEditingName(null)} disabled={savingName}
                style={{ flex: 1, height: 46, borderRadius: 12, border: `1px solid ${P.line}`, background: P.panel, color: P.ink2, fontSize: 14.5, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>ביטול</button>
              <button onClick={saveName} disabled={savingName}
                style={{ flex: 1, height: 46, borderRadius: 12, border: "none", background: ACCENT, color: "#fff", fontSize: 14.5, fontWeight: 800, cursor: savingName ? "default" : "pointer", opacity: savingName ? 0.7 : 1, fontFamily: "inherit" }}>
                {savingName ? "שומר…" : "שמירה"}
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div style={{ position: "fixed", bottom: 96, left: "50%", transform: "translateX(-50%)", background: P.ink, color: P.panel, borderRadius: 999, padding: "10px 20px", fontSize: 13.5, fontWeight: 600, zIndex: 80, fontFamily: FONT }}>
          {toast}
        </div>
      )}
    </div>
  );
};

export default SettingsView;
