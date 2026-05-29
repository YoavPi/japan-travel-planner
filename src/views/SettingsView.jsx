import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { readPrefs, writePrefs } from "../services/prefsService";

/* ──────────────────────────────────────────────────────────────
   SettingsView — "הגדרות וניהול" (home-profile blueprint, screen 4).

   Grouped rows: account, preferences (language / distance units /
   dark mode), notifications + sharing toggles, support + sign-out.
   Functional controls (units, dark mode, notification toggles)
   persist via prefsService; navigational rows show a "בקרוב" toast.
   ────────────────────────────────────────────────────────────── */

const T = {
  ink: "#0D0F11", ink2: "#2A3036", ink3: "#6B7178", ink4: "#A4AAB1",
  line: "rgba(20,20,20,0.08)", surface: "#F6F6F4", accent: "#E0533F",
  font: "'Noto Sans Hebrew','Inter','Noto Sans JP',system-ui,sans-serif",
};

const Toggle = ({ on, onClick }) => (
  <button onClick={onClick} aria-pressed={on}
    style={{ width: 46, height: 28, borderRadius: 999, border: "none", cursor: "pointer", padding: 3, background: on ? T.ink : "rgba(20,20,20,0.18)", transition: "background 0.2s", flexShrink: 0 }}>
    <span style={{ display: "block", width: 22, height: 22, borderRadius: "50%", background: "#fff", transform: on ? "translateX(-18px)" : "translateX(0)", transition: "transform 0.2s", boxShadow: "0 1px 3px rgba(0,0,0,0.2)" }} />
  </button>
);

const Group = ({ children, style }) => (
  <div style={{ background: "#fff", borderRadius: 18, border: `1px solid ${T.line}`, overflow: "hidden", marginBottom: 14, ...style }}>{children}</div>
);

const Row = ({ icon, title, sub, value, control, onClick, danger, first }) => (
  <div
    onClick={onClick}
    style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 16px", borderTop: first ? "none" : `1px solid ${T.line}`, cursor: onClick ? "pointer" : "default" }}
  >
    <span style={{ width: 34, height: 34, borderRadius: 10, background: danger ? "rgba(192,57,43,0.08)" : T.surface, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, flexShrink: 0 }}>{icon}</span>
    <span style={{ flex: 1, minWidth: 0 }}>
      <span style={{ display: "block", fontSize: 14.5, fontWeight: 600, color: danger ? "#C0392B" : T.ink }}>{title}</span>
      {sub && <span style={{ display: "block", fontSize: 12, color: T.ink3, marginTop: 1 }}>{sub}</span>}
    </span>
    {value && <span style={{ fontSize: 13, fontWeight: 600, color: T.ink3 }}>{value}</span>}
    {control}
    {onClick && !control && <span style={{ color: T.ink4, fontSize: 18 }}>‹</span>}
  </div>
);

const SettingsView = () => {
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const [prefs, setPrefs] = useState(readPrefs);
  const [toast, setToast] = useState("");

  const update = (patch) => setPrefs(writePrefs(patch));
  const soon = () => { setToast("בקרוב"); setTimeout(() => setToast(""), 1400); };

  return (
    <div dir="rtl" style={{ minHeight: "100vh", background: "#EDEDEC", fontFamily: T.font }}>
      <div style={{ maxWidth: 560, margin: "0 auto", minHeight: "100vh" }}>
        {/* Top bar */}
        <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 16px", background: "#fff", borderBottom: `1px solid ${T.line}` }}>
          <button onClick={() => navigate("/profile")} title="חזרה" style={{ width: 40, height: 40, borderRadius: "50%", border: "none", background: T.surface, cursor: "pointer", fontSize: 17, fontFamily: "inherit" }}>›</button>
          <div style={{ fontSize: 17, fontWeight: 800, color: T.ink }}>הגדרות וניהול</div>
          <span style={{ width: 40 }} />
        </header>

        <div style={{ padding: "16px 16px 40px" }}>
          {/* Account */}
          <Group>
            <Row first icon="👤" title="פרטי חשבון" sub={user?.email || "שם, מייל, תמונת פרופיל"} onClick={soon} />
            <Row icon="💳" title="מנוי וחיוב" value={user?.plan || "Free"} onClick={soon} />
          </Group>

          {/* Preferences */}
          <Group>
            <Row first icon="🌐" title="שפה" value="עברית" onClick={soon} />
            <Row
              icon="📏" title="יחידות מרחק"
              value={prefs.units === "km" ? "קילומטרים" : "מיילים"}
              onClick={() => update({ units: prefs.units === "km" ? "mi" : "km" })}
            />
            <Row icon="🌙" title="מצב כהה" control={<Toggle on={prefs.darkMode} onClick={() => update({ darkMode: !prefs.darkMode })} />} />
          </Group>

          {/* Notifications + sharing */}
          <Group>
            <Row first icon="🔔" title="התראות" sub="תזכורות ועדכונים מהמסלול" control={<Toggle on={prefs.notifications} onClick={() => update({ notifications: !prefs.notifications })} />} />
            <Row icon="↗" title="עדכוני שיתוף" sub="כשמישהו עורך מסלול משותף" control={<Toggle on={prefs.shareUpdates} onClick={() => update({ shareUpdates: !prefs.shareUpdates })} />} />
            <Row icon="🛡" title="פרטיות והרשאות" sub="ברירת מחדל לשיתוף מסלולים" onClick={soon} />
          </Group>

          {/* Support + danger */}
          <Group>
            <Row first icon="❓" title="עזרה ותמיכה" onClick={soon} />
            <Row icon="⎋" title="התנתקות" danger onClick={() => { signOut(); navigate("/"); }} />
          </Group>

          <div style={{ textAlign: "center", fontSize: 12, color: T.ink4, marginTop: 18 }}>
            גרסה 3.0.0 · תכנון מסלולים
          </div>
        </div>
      </div>

      {toast && (
        <div style={{ position: "fixed", bottom: 28, left: "50%", transform: "translateX(-50%)", background: T.ink, color: "#fff", borderRadius: 999, padding: "10px 20px", fontSize: 13.5, fontWeight: 600, zIndex: 80 }}>
          {toast}
        </div>
      )}
    </div>
  );
};

export default SettingsView;
