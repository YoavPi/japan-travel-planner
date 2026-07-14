import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import authService, { mapSupabaseUser } from "../services/authService";
import { supabase, isSupabaseEnabled } from "../lib/supabase";

/* ══════════════════════════════════════════════════════════════
   AuthContext — global auth state.

   Re-hydrates from sessionStorage on mount so a page refresh
   inside an active session keeps the user signed in. Exposes the
   user object, a loading flag (for the SSO button skeleton), and
   signIn / signOut actions.
   ══════════════════════════════════════════════════════════════ */

const AuthContext = createContext(null);

/* True while the current URL carries an OAuth callback payload
   (implicit-flow hash tokens, a PKCE code, or a provider error) —
   supabase-js is about to consume it, so hydration MUST be awaited. */
const urlHasAuthPayload = () =>
  typeof window !== "undefined" &&
  /access_token=|refresh_token=|code=|error_description=/.test(window.location.hash + window.location.search);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(() => authService.getCurrentUser());
  const [signingIn, setSigningIn] = useState(false);
  /* OAuth-loop fix — `initializing` gates every auth decision (guards,
     redirects) until the FIRST definitive answer from Supabase arrives.
     Starts true whenever Supabase is configured, because on a fresh page
     load the persisted session / URL tokens are parsed asynchronously —
     checking `user` during that split second reads a false null. */
  const [initializing, setInitializing] = useState(() => isSupabaseEnabled());

  /* Keep state in sync if another tab mutates sessionStorage. */
  useEffect(() => {
    const onStorage = () => setUser(authService.getCurrentUser());
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  /* Sprint 26 — Supabase-native session. Hydrate from an existing
     session on mount (incl. the post-OAuth redirect, where
     detectSessionInUrl has just consumed the callback), and track every
     subsequent auth transition. A live Supabase identity always wins
     over the mock; signing out falls back to whatever mock session
     remains (usually none). */
  useEffect(() => {
    if (!isSupabaseEnabled()) return;
    let live = true;
    const returningFromOAuth = urlHasAuthPayload();

    supabase.auth.getSession().then(({ data }) => {
      if (!live) return;
      if (data?.session?.user) {
        setUser(mapSupabaseUser(data.session.user));
        setInitializing(false);
      } else if (!returningFromOAuth) {
        /* No session and no callback in-flight — hydration is done. When
           a callback IS in-flight we keep gating until SIGNED_IN fires
           (the hash/code parse + token exchange finish a beat later). */
        setInitializing(false);
      }
    }).catch(() => { if (live) setInitializing(false); });

    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (!live) return;
      if (session?.user) {
        /* SIGNED_IN / TOKEN_REFRESHED / INITIAL_SESSION with a session —
           capture it immediately. */
        setUser(mapSupabaseUser(session.user));
        setInitializing(false);
      } else if (event === "SIGNED_OUT") {
        setUser(authService.getCurrentUser());
        setInitializing(false);
      }
      /* Null-session INITIAL_SESSION while an OAuth callback is being
         consumed is intentionally ignored — it must not clobber the
         SIGNED_IN that follows. */
    });

    /* Safety valve: if the provider errored and no event ever lands
       (e.g. error_description in the URL), release the gate so the
       login screen becomes actionable instead of hanging. */
    const failsafe = setTimeout(() => { if (live) setInitializing(false); }, 6000);

    return () => { live = false; clearTimeout(failsafe); sub?.subscription?.unsubscribe?.(); };
  }, []);

  const signIn = useCallback(async () => {
    setSigningIn(true);
    try {
      const u = await authService.signInWithGoogle();
      setUser(u);
      return u;
    } finally {
      setSigningIn(false);
    }
  }, []);

  /* Sprint 26 — Supabase native Google OAuth: starts the provider
     redirect; the onAuthStateChange listener above completes hydration
     when the browser returns. */
  const signInWithSupabase = useCallback(async () => {
    setSigningIn(true);
    try {
      await authService.signInWithSupabaseGoogle();
      return null; // navigating away
    } finally {
      setSigningIn(false);
    }
  }, []);

  /* Real Google SSO callback — hydrate the session from the verified
     ID token (credential) handed back by @react-oauth/google onSuccess. */
  const signInWithGoogleToken = useCallback((credential) => {
    if (!credential) return null;
    const u = authService.signInWithGoogleCredential(credential);
    setUser(u);
    return u;
  }, []);

  const signOut = useCallback(() => {
    authService.signOut();
    setUser(null);
  }, []);

  const value = useMemo(
    () => ({
      user,
      isAuthenticated: !!user,
      /* OAuth-loop fix — consumers (ProtectedRoute, AuthView) must not
         make redirect decisions while this is true. */
      initializing,
      signingIn,
      signIn,
      signInWithSupabase,
      supabaseEnabled: isSupabaseEnabled(),
      signInWithGoogleToken,
      signOut,
    }),
    [user, initializing, signingIn, signIn, signInWithSupabase, signInWithGoogleToken, signOut]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within <AuthProvider>");
  return ctx;
};

export default AuthContext;
