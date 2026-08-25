import React from "react";
import { useNavigate, useLocation } from "react-router-dom";
import Map from "react-map-gl/maplibre";
import "maplibre-gl/dist/maplibre-gl.css";
import { GoogleLogin } from "@react-oauth/google";
import { useAuth } from "../context/AuthContext";
import Icon from "../components/Icon";

const MAP_STYLE = "https://basemaps.cartocdn.com/gl/positron-gl-style/style.json";

/* Real Google SSO is active only when a client id is configured. With
   an empty key the GoogleOAuthProvider isn't mounted (see App.jsx), so
   we keep the mock buttons instead of rendering <GoogleLogin> (which
   would throw outside a provider). */
const GOOGLE_SSO_ON = !!(process.env.REACT_APP_GOOGLE_CLIENT_ID || "");

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
  const { signIn, signInWithSupabase, supabaseEnabled, signInWithGoogleToken, signingIn, isAuthenticated, initializing } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const dest = location.state?.from || "/dashboard";

  /* Surface a provider error handed back on the redirect
     (…/auth#error_description=…) instead of failing silently. */
  const [oauthError] = React.useState(() => {
    const m = (window.location.hash + window.location.search).match(/error_description=([^&]+)/);
    return m ? decodeURIComponent(m[1].replace(/\+/g, " ")) : "";
  });
  /* Inline auth error (e.g. OAuth failed, or an unimplemented provider was
     tapped). We NEVER silently mock-sign-in on a real backend. */
  const [authErr, setAuthErr] = React.useState("");

  /* OAuth-loop fix — navigate in once we know the user is authenticated. */
  React.useEffect(() => {
    if (!initializing && isAuthenticated) navigate(dest, { replace: true });
  }, [initializing, isAuthenticated, dest, navigate]);

  /* DEMO-ONLY mock sign-in — reachable only when there is NO real backend
     (supabaseEnabled === false). With a real backend it must never run, or
     it would sign the visitor in as the shared demo identity. */
  const doSignIn = async () => {
    if (supabaseEnabled) { setAuthErr("התחברות זו אינה זמינה — התחברו עם Google."); return; }
    await signIn();
    navigate(dest, { replace: true });
  };

  /* Supabase NATIVE Google OAuth — the ONLY real sign-in path in production.
     On failure we surface an error and let the user retry; we do NOT fall
     back to a mock identity (that was the account-mix-up bug). */
  const doSupabaseGoogle = async () => {
    setAuthErr("");
    try {
      await signInWithSupabase(); // browser navigates away on success
    } catch {
      setAuthErr("ההתחברות עם Google נכשלה. נסו שוב.");
    }
  };

  /* Apple / Email aren't implemented against the real backend yet. Tapping
     them must inform the user — never quietly mock them into someone's
     account. In the no-backend demo they still run the local mock. */
  const doOtherProvider = () => {
    if (supabaseEnabled) { setAuthErr("התחברות עם Apple/אימייל עדיין לא זמינה — התחברו עם Google."); return; }
    doSignIn();
  };

  /* Real Google onSuccess — the callback payload carries an ID token
     (credential). Hydrate the profile from it; the isAuthenticated
     effect above then routes to the intended destination. */
  const onGoogleSuccess = (resp) => {
    if (resp?.credential) signInWithGoogleToken(resp.credential);
  };

  return (
    <div dir="rtl" style={{ position: "fixed", inset: 0, fontFamily: T.font, overflow: "hidden" }}>
      {/* Beautiful map behind the sheet (non-interactive) */}
      <div style={{ position: "absolute", inset: 0 }}>
        <Map
          initialViewState={{ longitude: 12.4964, latitude: 41.9028, zoom: 4.4 }}
          style={{ width: "100%", height: "100%" }}
          mapStyle={MAP_STYLE}
          attributionControl={false}
          interactive={false}
        />
      </div>
      {/* Soft scrim for contrast under the sheet */}
      <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to bottom, rgba(13,15,17,0.10), rgba(13,15,17,0.28) 60%, rgba(13,15,17,0.40))" }} />

      {/* Close → home */}
      <button onClick={() => navigate("/")} title="חזרה לעמוד הבית"
        aria-label="סגירה"
        style={{ position: "absolute", top: 16, insetInlineEnd: 16, zIndex: 3, width: 38, height: 38, borderRadius: "50%", border: "none", background: "rgba(255,255,255,0.92)", cursor: "pointer", fontFamily: "inherit", color: "#2A3036", display: "inline-flex", alignItems: "center", justifyContent: "center" }}><Icon name="x" size={16} strokeWidth={2.2} /></button>

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

          {/* Post-redirect hydration state — the callback tokens are being
              consumed; show progress instead of a clickable login that is
              about to auto-navigate. */}
          {initializing && (
            <div role="status" style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, padding: "10px 12px", marginBottom: 12, borderRadius: 12, background: T.surface, color: T.ink2, fontSize: 13, fontWeight: 700 }}>
              <span aria-hidden style={{ width: 16, height: 16, borderRadius: "50%", border: `2.5px solid ${T.line}`, borderTopColor: T.ink, display: "inline-block", animation: "tpAuthSpin 0.8s linear infinite" }} />
              מאמת התחברות…
              <style>{`@keyframes tpAuthSpin{to{transform:rotate(360deg)}}`}</style>
            </div>
          )}

          {/* Provider error from the OAuth redirect (if any). */}
          {oauthError && !initializing && (
            <div role="alert" style={{ padding: "10px 12px", marginBottom: 12, borderRadius: 12, background: "rgba(192,57,43,0.08)", border: "1px solid rgba(192,57,43,0.35)", color: "#A03325", fontSize: 12.5, fontWeight: 700, lineHeight: 1.5 }}>
              ההתחברות נכשלה: {oauthError}
            </div>
          )}

          {/* Inline auth error (failed OAuth / unavailable provider). */}
          {authErr && !initializing && (
            <div role="alert" style={{ padding: "10px 12px", marginBottom: 12, borderRadius: 12, background: "rgba(192,57,43,0.08)", border: "1px solid rgba(192,57,43,0.35)", color: "#A03325", fontSize: 12.5, fontWeight: 700, lineHeight: 1.5 }}>
              {authErr}
            </div>
          )}

          {/* While the session check is in flight, show ONLY the spinner above
              — NOT clickable sign-in buttons. Otherwise a user on a slow network
              clicks Google while a session is hydrating, and that redirect races
              the auto-navigate that fires the instant hydration finishes → the
              click appears to "do nothing" until they close and land in. */}
          {!initializing && (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {supabaseEnabled ? (
              /* Sprint 26 — Supabase native Google OAuth (primary). */
              <AuthBtn variant="google" onClick={doSupabaseGoogle} disabled={signingIn}>
                {signingIn ? <span>מתחבר…</span> : <><GoogleGlyph /><span>המשך עם Google</span></>}
              </AuthBtn>
            ) : GOOGLE_SSO_ON ? (
              /* Real Google Identity Services button (official modal /
                 popup loop). Rendered only when a client id is set so the
                 provider is mounted. */
              <div style={{ display: "flex", justifyContent: "center" }}>
                <GoogleLogin
                  onSuccess={onGoogleSuccess}
                  onError={() => { /* swallow — user can retry or use another method */ }}
                  text="continue_with"
                  shape="pill"
                  width="320"
                />
              </div>
            ) : (
              <AuthBtn variant="google" onClick={doSignIn} disabled={signingIn}>
                {signingIn ? <span>מתחבר…</span> : <><GoogleGlyph /><span>המשך עם Google</span></>}
              </AuthBtn>
            )}
            <AuthBtn variant="apple" onClick={doOtherProvider} disabled={signingIn}>
              <AppleGlyph /><span style={{ color: "#fff" }}>המשך עם Apple</span>
            </AuthBtn>
            <AuthBtn variant="ghost" onClick={doOtherProvider} disabled={signingIn}>
              המשך עם אימייל
            </AuthBtn>
          </div>
          )}

          {!initializing && (
          <div style={{ fontSize: 11.5, color: T.ink4, textAlign: "center", marginTop: 18, lineHeight: 1.5 }}>
            בלחיצה אתם מסכימים ל<span style={{ color: T.ink3, textDecoration: "underline" }}>תנאי השימוש</span> ול<span style={{ color: T.ink3, textDecoration: "underline" }}>מדיניות הפרטיות</span> שלנו.
          </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AuthView;
