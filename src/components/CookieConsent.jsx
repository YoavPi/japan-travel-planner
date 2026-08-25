import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { hasDecided, setConsent } from "../analytics/consent";
import { initAnalytics } from "../analytics/posthog";

/* ══════════════════════════════════════════════════════════════
   CookieConsent — one-time analytics-consent banner.

   Shows until the user makes a choice, then never again (persisted
   via analytics/consent). Accept → starts PostHog product analytics;
   Decline → PostHog stays off. Cookieless Vercel traffic analytics
   runs regardless (essential, anonymous), which the copy states.

   Mounted globally in App. Brand-matched to the "מסלול" landing
   (ink + orange, Noto Sans Hebrew, RTL).
   ══════════════════════════════════════════════════════════════ */

const T = {
  panel: "#FFFFFF", ink: "#0D0F11", ink2: "#2A3036", ink3: "#6B7178",
  line: "rgba(20,20,20,0.10)", accent: "#E0533F",
  font: "'Noto Sans Hebrew','Inter',system-ui,sans-serif",
};

const CookieConsent = () => {
  const navigate = useNavigate();
  const [open, setOpen] = useState(() => !hasDecided());
  if (!open) return null;

  const decide = (value) => {
    setConsent(value);
    if (value === "accepted") initAnalytics(); // idempotent — starts PostHog now
    setOpen(false);
  };

  return (
    <div
      dir="rtl"
      role="dialog"
      aria-live="polite"
      aria-label="הודעת פרטיות ועוגיות"
      style={{
        position: "fixed", zIndex: 2147483000, left: 16, bottom: 16,
        maxWidth: 460, width: "min(460px, calc(100vw - 96px))", background: T.panel,
        border: `1px solid ${T.line}`, borderRadius: 18,
        boxShadow: "0 12px 40px rgba(0,0,0,0.18)", padding: "18px 20px",
        fontFamily: T.font, color: T.ink2,
      }}
    >
      <div style={{ fontSize: 15.5, fontWeight: 800, color: T.ink, marginBottom: 8 }}>
        הפרטיות שלך חשובה לנו
      </div>
      <p style={{ margin: 0, fontSize: 13, lineHeight: 1.6, color: T.ink3 }}>
        אנחנו משתמשים בכלי אנליטיקה (PostHog) כדי להבין איך משתמשים באתר ולשפר אותו.
        מדידת תנועה בסיסית ואנונימית פועלת תמיד. ניתן לחזור מההסכמה בכל עת.{" "}
        <button
          onClick={() => navigate("/privacy")}
          style={{ border: "none", background: "transparent", padding: 0, color: T.accent, fontWeight: 700, fontFamily: "inherit", fontSize: 13, cursor: "pointer", textDecoration: "underline" }}
        >
          מדיניות פרטיות
        </button>
      </p>
      <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
        <button
          onClick={() => decide("accepted")}
          style={{ flex: 1, height: 42, borderRadius: 11, border: "none", background: T.accent, color: "#fff", fontSize: 14, fontWeight: 800, cursor: "pointer", fontFamily: "inherit" }}
        >
          אישור
        </button>
        <button
          onClick={() => decide("declined")}
          style={{ flex: 1, height: 42, borderRadius: 11, border: `1.5px solid ${T.line}`, background: "transparent", color: T.ink2, fontSize: 14, fontWeight: 800, cursor: "pointer", fontFamily: "inherit" }}
        >
          דחייה
        </button>
      </div>
    </div>
  );
};

export default CookieConsent;
