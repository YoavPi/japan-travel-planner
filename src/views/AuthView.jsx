import React from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

/* ──────────────────────────────────────────────────────────────
   AuthView — premium sign-in bottom sheet (home-auth blueprint).

   A soft hero fills the screen; an auth sheet rises from the
   bottom with Google / Apple / Email actions. All three run the
   same mock signIn for now (1.2s) → redirect to the intended
   destination (location.state.from) or /dashboard. Backdrop or
   the close affordance returns to the home page.
   ────────────────────────────────────────────────────────────── */

const T = {
  ink: "#0D0F11", ink2: "#2A3036", ink3: "#6B7178", ink4: "#A4AAB1",
  line: "rgba(20,20,20,0.10)", surface: "#F6F6F4", accent: "#E0533F",
  font: "'Noto Sans Hebrew','Inter','Noto Sans JP',system-ui,sans-serif",
};

const GoogleGlyph = () => (
  <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden>
    <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3c-1.6 4.7-6.1 8-11.3 8a12 12 0 0 1 0-24c3 0 5.8 1.1 7.9 3l5.7-5.7A20 20 0 1 0 24 44c11 0 20-9 20-20 0-1.3-.1-2.3-.4-3.5z"/>
    <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8A12 12 0 0 1 24 12c3 0 5.8 1.1 7.9 3l5.7-5.7A20 20 0 0 0 6.3 14.7z"/>
    <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2A12 12 0 0 1 12.7 28l-6.5 5A20 20 0 0 0 24 44z"/>
    <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3a12 12 0 0 1-4.1 5.6l6.2 5.2c-.4.4 6.6-4.8 6.6-14.8 0-1.3-.1-2.3-.4-3.5z"/>
  </svg>
);
const AppleGlyph = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="#0D0F11" aria-hidden>
    <path d="M16.4 12.8c0-2.2 1.8-3.3 1.9-3.4-1-1.5-2.6-1.7-3.2-1.7-1.4-.1-2.6.8-3.3.8-.7 0-1.7-.8-2.8-.8-1.4 0-2.8.8-3.5 2.1-1.5 2.6-.4 6.4 1.1 8.5.7 1 1.5 2.2 2.6 2.1 1-.04 1.4-.7 2.7-.7 1.2 0 1.6.7 2.7.6 1.1-.02 1.8-1 2.5-2 .8-1.2 1.1-2.3 1.1-2.4-.02-.01-2.1-.8-2.1-3zM14.3 6.3c.6-.7 1-1.7.9-2.7-.9.04-1.9.6-2.5 1.3-.5.6-1 1.6-.9 2.6 1 .08 1.9-.5 2.5-1.2z"/>
  </svg>
);

const AuthBtn = ({ children, onClick, disabled, variant }) => {
  const base = {
    width: "100%", height: 54, borderRadius: 14, cursor: disabled ? "default" : "pointer",
    display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
    fontSize: 15, fontWeight: 700, fontFamily: "inherit", opacity: disabled ? 0.7 : 1,
  };
  const styles = {
    google: { ...base, border: `1px solid ${T.line}`, background: "#fff", color: T.ink },
    apple:  { ...base, border: "none", background: T.ink, color: "#fff" },
    ghost:  { ...base, border: "none", background: "transparent", color: T.ink2, height: 46, fontWeight: 600 },
  };
  return <button onClick={onClick} disabled={disabled} style={styles[variant]}>{children}</button>;
};

const AuthView = () => {
  const { signIn, signingIn, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const dest = location.state?.from || "/dashboard";

  React.useEffect(() => {
    if (isAuthenticated) navigate(dest, { replace: true });
  }, [isAuthenticated, dest, navigate]);

  const doSignIn = async () => {
    await signIn();
    navigate(dest, { replace: true });
  };

  return (
    <div dir="rtl" style={{ position: "fixed", inset: 0, fontFamily: T.font, overflow: "hidden" }}>
      {/* Hero behind the sheet */}
      <div style={{ position: "absolute", inset: 0, background: `linear-gradient(to bottom, rgba(13,15,17,0.30), rgba(13,15,17,0.55)), center/cover url(/photos/home/hero_couple_fuji.png), #1C2333` }} />

      {/* Close → home */}
      <button onClick={() => navigate("/")} title="חזרה לעמוד הבית"
        style={{ position: "absolute", top: 16, insetInlineEnd: 16, zIndex: 3, width: 38, height: 38, borderRadius: "50%", border: "none", background: "rgba(255,255,255,0.92)", cursor: "pointer", fontSize: 16, fontFamily: "inherit" }}>✕</button>

      {/* Backdrop tap area (above hero, below sheet) */}
      <div onClick={() => navigate("/")} style={{ position: "absolute", inset: 0, zIndex: 1 }} />

      {/* Auth sheet */}
      <div style={{ position: "absolute", insetInlineStart: 0, insetInlineEnd: 0, bottom: 0, zIndex: 2 }}>
        <div style={{ maxWidth: 560, margin: "0 auto", background: "#fff", borderTopLeftRadius: 26, borderTopRightRadius: 26, padding: "12px 22px 30px", boxShadow: "0 -24px 60px rgba(0,0,0,0.25)" }}>
          <div style={{ display: "flex", justifyContent: "center", marginBottom: 16 }}>
            <div style={{ width: 44, height: 5, borderRadius: 999, background: "rgba(20,20,20,0.18)" }} />
          </div>

          <div style={{ fontSize: 11, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.08em", color: T.accent, marginBottom: 8 }}>
            צריך חשבון כדי לשמור
          </div>
          <h2 style={{ fontSize: 26, fontWeight: 800, letterSpacing: "-0.022em", color: T.ink, lineHeight: 1.2, margin: 0 }}>
            התחברו כדי לבנות<br />
            <span style={{ fontWeight: 400, color: T.ink3 }}>את המסלול שלכם</span>
          </h2>
          <p style={{ fontSize: 14, color: T.ink3, lineHeight: 1.55, margin: "10px 0 22px" }}>
            שמרו תחנות, סנכרנו בין מכשירים, וחזרו בכל זמן לערוך.
          </p>

          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <AuthBtn variant="google" onClick={doSignIn} disabled={signingIn}>
              {signingIn ? <span>מתחבר…</span> : <><GoogleGlyph /><span>המשך עם Google</span></>}
            </AuthBtn>
            <AuthBtn variant="apple" onClick={doSignIn} disabled={signingIn}>
              <AppleGlyph /><span style={{ color: "#fff" }}>המשך עם Apple</span>
            </AuthBtn>
            <AuthBtn variant="ghost" onClick={doSignIn} disabled={signingIn}>
              המשך עם אימייל
            </AuthBtn>
          </div>

          <div style={{ fontSize: 11.5, color: T.ink4, textAlign: "center", marginTop: 18, lineHeight: 1.5 }}>
            בלחיצה אתם מסכימים ל<span style={{ color: T.ink3, textDecoration: "underline" }}>תנאי השימוש</span> ול<span style={{ color: T.ink3, textDecoration: "underline" }}>מדיניות הפרטיות</span> שלנו.
          </div>
        </div>
      </div>
    </div>
  );
};

export default AuthView;
