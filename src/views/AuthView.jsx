import React from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

/* ──────────────────────────────────────────────────────────────
   AuthView — mock Google SSO sign-in.
   PHASE 1 PLACEHOLDER: functional auth flow, minimal styling.
   The premium bottom-sheet design (home-auth.jsx) lands in the
   layout phase. For now this confirms: click → 1.2s loading →
   authenticated → redirect to intended destination (or /dashboard).
   ────────────────────────────────────────────────────────────── */
const GoogleGlyph = () => (
  <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden>
    <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3c-1.6 4.7-6.1 8-11.3 8a12 12 0 0 1 0-24c3 0 5.8 1.1 7.9 3l5.7-5.7A20 20 0 1 0 24 44c11 0 20-9 20-20 0-1.3-.1-2.3-.4-3.5z"/>
    <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8A12 12 0 0 1 24 12c3 0 5.8 1.1 7.9 3l5.7-5.7A20 20 0 0 0 6.3 14.7z"/>
    <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2A12 12 0 0 1 12.7 28l-6.5 5A20 20 0 0 0 24 44z"/>
    <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3a12 12 0 0 1-4.1 5.6l6.2 5.2c-.4.4 6.6-4.8 6.6-14.8 0-1.3-.1-2.3-.4-3.5z"/>
  </svg>
);

const AuthView = () => {
  const { signIn, signingIn, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const dest = location.state?.from || "/dashboard";

  React.useEffect(() => {
    if (isAuthenticated) navigate(dest, { replace: true });
  }, [isAuthenticated, dest, navigate]);

  const handleSignIn = async () => {
    await signIn();
    navigate(dest, { replace: true });
  };

  return (
    <div
      dir="rtl"
      style={{
        minHeight: "100vh", display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center", gap: 24,
        background: "#EDEDEC", padding: 24,
        fontFamily: "'Noto Sans Hebrew','Inter',sans-serif",
      }}
    >
      <div
        style={{
          width: "100%", maxWidth: 360, background: "#fff",
          borderRadius: 22, padding: "32px 24px",
          boxShadow: "0 1px 2px rgba(0,0,0,.04), 0 8px 28px rgba(0,0,0,.05)",
          textAlign: "center",
        }}
      >
        <div style={{ fontSize: 24, fontWeight: 800, letterSpacing: "-0.022em", color: "#0D0F11", marginBottom: 6 }}>
          התחברות
        </div>
        <div style={{ fontSize: 13.5, color: "#6B7178", marginBottom: 24, lineHeight: 1.5 }}>
          התחברו כדי לבנות ולנהל את המפות שלכם
        </div>
        <button
          onClick={handleSignIn}
          disabled={signingIn}
          style={{
            width: "100%", height: 52, borderRadius: 999,
            border: "1px solid rgba(20,20,20,0.12)", background: "#fff",
            display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
            fontSize: 15, fontWeight: 600, color: "#0D0F11",
            cursor: signingIn ? "default" : "pointer",
            opacity: signingIn ? 0.7 : 1,
            fontFamily: "inherit",
          }}
        >
          {signingIn ? (
            <span>מתחבר…</span>
          ) : (
            <>
              <GoogleGlyph />
              <span>התחברות עם Google</span>
            </>
          )}
        </button>
        <button
          onClick={() => navigate("/")}
          style={{
            marginTop: 16, background: "none", border: "none",
            color: "#6B7178", fontSize: 12.5, cursor: "pointer", fontFamily: "inherit",
          }}
        >
          חזרה לעמוד הבית
        </button>
      </div>
    </div>
  );
};

export default AuthView;
