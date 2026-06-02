import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { readPrefs, writePrefs } from "../services/prefsService";
import { useDarkMode } from "../utils/theme";
import BottomDock from "../components/BottomDock";
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
  const { user, signOut } = useAuth();
  const { dark, setDark, P } = useDarkMode();
  const [prefs, setPrefs] = useState(readPrefs);
  const [toast, setToast] = useState("");

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

  const Row = ({ icon, title, sub, value, control, onClick, danger, first }) => (
    <div onClick={onClick}
      style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 16px", borderTop: first ? "none" : `1px solid ${P.line}`, cursor: onClick ? "pointer" : "default" }}>
      <span style={{ width: 34, height: 34, borderRadius: 10, background: danger ? "rgba(192,57,43,0.12)" : P.surface, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, color: danger ? P.danger : P.ink2 }}>
        <Icon name={icon} size={17} strokeWidth={1.9} />
      </span>
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{ display: "block", fontSize: 14.5, fontWeight: 600, color: danger ? P.danger : P.ink }}>{title}</span>
        {sub && <span style={{ display: "block", fontSize: 12, color: P.ink3, marginTop: 1 }}>{sub}</span>}
      </span>
      {value && <span style={{ fontSize: 13, fontWeight: 600, color: P.ink3 }}>{value}</span>}
      {control}
      {onClick && !control && <span style={{ color: P.ink4, display: "inline-flex" }}><Icon name="chevronStart" size={15} strokeWidth={2} /></span>}
    </div>
  );

  return (
    <div dir="rtl" style={{ minHeight: "100vh", background: P.page, fontFamily: FONT, transition: "background 0.25s" }}>
      <div style={{ maxWidth: 560, margin: "0 auto", minHeight: "100vh" }}>
        <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 16px", background: P.panel, borderBottom: `1px solid ${P.line}`, transition: "background 0.25s" }}>
          <button onClick={() => navigate("/dashboard")} title="חזרה" style={{ width: 40, height: 40, borderRadius: "50%", border: "none", background: P.surface, cursor: "pointer", fontSize: 17, fontFamily: "inherit", color: P.ink }}>›</button>
          <div style={{ fontSize: 17, fontWeight: 800, color: P.ink }}>הגדרות וניהול</div>
          <span style={{ width: 40 }} />
        </header>

        <div style={{ padding: "16px 16px 96px" /* reserve bottom space for the floating dock */ }}>
          {/* Account */}
          <Group>
            <Row first icon="user" title="פרטי חשבון" sub={user?.email || "שם, מייל, תמונת פרופיל"} onClick={soon} />
            <Row icon="sparkle" title="מנוי וחיוב" value={user?.plan || "Free"} onClick={soon} />
          </Group>

          {/* Preferences */}
          <Group>
            <Row first icon="globe" title="שפה" value="עברית" onClick={soon} />
            <Row icon="ruler" title="יחידות מרחק"
              value={prefs.units === "km" ? "קילומטרים" : "מיילים"}
              onClick={() => update({ units: prefs.units === "km" ? "mi" : "km" })} />
            <Row icon="moon" title="מצב כהה" control={<Toggle on={dark} onClick={() => setDark(!dark)} />} />
          </Group>

          {/* Notifications + sharing */}
          <Group>
            <Row first icon="bell" title="התראות" sub="תזכורות ועדכונים מהמסלול" control={<Toggle on={prefs.notifications} onClick={() => update({ notifications: !prefs.notifications })} />} />
            <Row icon="share" title="עדכוני שיתוף" sub="כשמישהו עורך מסלול משותף" control={<Toggle on={prefs.shareUpdates} onClick={() => update({ shareUpdates: !prefs.shareUpdates })} />} />
            <Row icon="shield" title="פרטיות והרשאות" sub="ברירת מחדל לשיתוף מסלולים" onClick={soon} />
          </Group>

          {/* Support + danger */}
          <Group>
            <Row first icon="helpCircle" title="עזרה ותמיכה" onClick={soon} />
            <Row icon="logOut" title="התנתקות" danger onClick={() => { signOut(); navigate("/"); }} />
          </Group>

          <div style={{ textAlign: "center", fontSize: 12, color: P.ink4, marginTop: 18 }}>
            גרסה 3.0.0 · תכנון מסלולים
          </div>
        </div>
      </div>

      {toast && (
        <div style={{ position: "fixed", bottom: 96, left: "50%", transform: "translateX(-50%)", background: P.ink, color: P.panel, borderRadius: 999, padding: "10px 20px", fontSize: 13.5, fontWeight: 600, zIndex: 80, fontFamily: FONT }}>
          {toast}
        </div>
      )}
      <BottomDock />
    </div>
  );
};

export default SettingsView;
