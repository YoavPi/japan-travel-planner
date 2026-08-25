import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import authService, { mapSupabaseUser } from "../services/authService";
import { supabase, isSupabaseEnabled } from "../lib/supabase";
import { identifyUser, resetAnalytics, track } from "../analytics/posthog";

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
  /* 🔒 When a real backend (Supabase) is configured the ONLY valid identity
     is a live Supabase session — never a value left in local/sessionStorage
     (which could be a stale demo user). Start null in that case and let the
     Supabase hydration below set the real user (or keep null = logged out). */
  const [user, setUser] = useState(() => (isSupabaseEnabled() ? null : authService.getCurrentUser()));
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

  /* Attribute PostHog events to the signed-in user (and detach on logout), so
     product events like map_created are tied to a person. No-op if PostHog
     isn't configured. */
  useEffect(() => {
    if (user) {
      identifyUser(user);
      /* One-time: push any device-local favorites into Supabase now that
         we have a signed-in identity. Lazy import avoids an import cycle. */
      import("../services/favoritesService").then((m) => m.migrateLocalFavorites()).catch(() => {});
    } else {
      resetAnalytics();
    }
  }, [user]);

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
        /* No session and no callback in-flight — hydration is done. Force the
           user to null: with Supabase as the auth authority, no session means
           logged OUT, and we must never leave a stale local identity showing. */
        setUser(null);
        setInitializing(false);
      } else {
        /* Returning from an OAuth redirect, but the session isn't readable YET.
           On Chrome, onAuthStateChange(SIGNED_IN) lands within a moment. On some
           browsers (notably Arc) neither that event nor this first getSession
           sees the just-stored session for several seconds — so the app used to
           hang on /auth. POLL getSession until it appears, then update the REAL
           auth state (which unblocks the auto-navigate AND ProtectedRoute).
           Only ever runs when the first read missed — Chrome never enters here. */
        let tries = 0;
        const poll = () => {
          if (!live) return;
          supabase.auth.getSession().then(({ data: d }) => {
            if (!live) return;
            if (d?.session?.user) { setUser(mapSupabaseUser(d.session.user)); setInitializing(false); }
            else if (tries++ < 24) setTimeout(poll, 600);   // ~14s of retries
            else setInitializing(false);                     // give up → login screen
          }).catch(() => { if (live) { if (tries++ < 24) setTimeout(poll, 600); else setInitializing(false); } });
        };
        setTimeout(poll, 500);
      }
    }).catch(() => { if (live) setInitializing(false); });

    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (!live) return;
      if (session?.user) {
        /* SIGNED_IN / TOKEN_REFRESHED / INITIAL_SESSION with a session —
           capture it immediately. */
        setUser(mapSupabaseUser(session.user));
        setInitializing(false);
        /* Analytics — a REAL sign-in only (event === "SIGNED_IN"), not a page
           refresh (INITIAL_SESSION) or silent token refresh, so the funnel's
           top isn't inflated. */
        if (event === "SIGNED_IN") {
          track("signed_in", { method: session.user.app_metadata?.provider || "unknown" });
        }
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
    /* Backstop the gate. Longer on an OAuth return so the getSession poll above
       has time to catch a slow-to-store session (Arc) before we show buttons. */
    const failsafe = setTimeout(() => { if (live) setInitializing(false); }, returningFromOAuth ? 16000 : 6000);

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

  /* Edit the signed-in user's profile (display name), persisting to the
     backend and reflecting the new identity across the app. */
  const updateProfile = useCallback(async (patch) => {
    const u = await authService.updateProfile(patch);
    if (u) setUser(u);
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
      updateProfile,
      signOut,
    }),
    [user, initializing, signingIn, signIn, signInWithSupabase, signInWithGoogleToken, updateProfile, signOut]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within <AuthProvider>");
  return ctx;
};

export default AuthContext;
