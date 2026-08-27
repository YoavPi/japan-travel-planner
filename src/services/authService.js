/* ══════════════════════════════════════════════════════════════
   authService — mock authentication layer.

   This simulates a real auth provider (Google SSO) entirely on the
   client. It is intentionally decoupled so the app can later swap
   in Supabase Auth / NextAuth / Firebase without touching callers.

   • signInWithGoogle() resolves after a 1.2s fake network delay,
     populates a mock user, and persists a mock JWT to
     sessionStorage (so a refresh inside a session keeps the editor
     reachable, but closing the tab logs out — matching a demo).
   • The real token would be an opaque server-issued JWT; here it's
     just a timestamped sentinel.
   ══════════════════════════════════════════════════════════════ */

import { supabase, isSupabaseEnabled } from "../lib/supabase";

const TOKEN_KEY = "tp_auth_token";
const USER_KEY  = "tp_auth_user";

/* Sprint 26 — map a Supabase auth user (Google identity) onto the app's
   user shape so every consumer (dashboard identity block, ownership
   checks) keeps working unchanged. */
export const mapSupabaseUser = (u) => u ? {
  id: u.id,
  name: u.user_metadata?.full_name || u.user_metadata?.name || u.email || "משתמש",
  email: u.email || "",
  avatar: u.user_metadata?.avatar_url || u.user_metadata?.picture || null,
  plan: "Pro",
  isAuthenticated: true,
} : null;

const delay = (ms) => new Promise((res) => setTimeout(res, ms));

/* Decode a Google ID token (JWT) without a library: split on dots,
   base64url-decode the payload segment, parse JSON. Returns null on any
   malformed input so a bad token never throws into the sign-in flow. */
const decodeJwt = (token) => {
  try {
    const payload = token.split(".")[1];
    if (!payload) return null;
    const base64 = payload.replace(/-/g, "+").replace(/_/g, "/");
    const json = decodeURIComponent(
      atob(base64)
        .split("")
        .map((c) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
        .join("")
    );
    return JSON.parse(json);
  } catch {
    return null;
  }
};

/* The mock identity returned by the fake Google SSO. */
const MOCK_USER = {
  id: "u_michali",
  name: "מיכלי דמרי פינטל",
  email: "michali.pintel@gmail.com",
  avatar: null,
  plan: "Pro",
  isAuthenticated: true,
};

export const authService = {
  /* Sprint 26 — Supabase NATIVE Google OAuth. Kicks off the provider
     redirect handshake; Supabase lands the user back on /auth with the
     session in the URL (detectSessionInUrl consumes it), and the
     AuthContext onAuthStateChange listener hydrates the app user. */
  async signInWithSupabaseGoogle() {
    if (!isSupabaseEnabled()) throw new Error("Supabase is not configured");
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth` },
    });
    if (error) throw error;
    /* Browser is navigating away — nothing to return. */
    return null;
  },

  /* Sprint — Email MAGIC LINK (passwordless). Sends a one-time sign-in link to
     the address; clicking it lands the user back on /auth with the session in
     the URL (same handshake as Google OAuth). No password is ever handled.
     `shouldCreateUser: true` lets first-time addresses sign up on the fly. */
  async signInWithEmailLink(email) {
    if (!isSupabaseEnabled()) throw new Error("Supabase is not configured");
    const clean = String(email || "").trim().toLowerCase();
    const { error } = await supabase.auth.signInWithOtp({
      email: clean,
      options: { shouldCreateUser: true, emailRedirectTo: `${window.location.origin}/auth` },
    });
    if (error) throw error;
    return true;
  },

  /* Current Supabase session user, mapped to the app shape (or null). */
  async getSupabaseSessionUser() {
    if (!isSupabaseEnabled()) return null;
    try {
      const { data } = await supabase.auth.getSession();
      return mapSupabaseUser(data?.session?.user || null);
    } catch {
      return null;
    }
  },

  /* Fake Google SSO — the DEMO-ONLY mock identity, for local/preview builds
     that have no backend.

     🔒 SECURITY: this must NEVER run when a real backend (Supabase) is
     configured. Otherwise every Apple/Email button (and any OAuth-failure
     fallback) would sign the visitor in as the SAME hardcoded person —
     i.e. one user logging in and receiving someone else's account. When
     Supabase is enabled, real auth is Supabase OAuth ONLY; this throws so a
     shared identity can never be minted in production. */
  async signInWithGoogle() {
    if (isSupabaseEnabled()) {
      throw new Error("mock-auth-disabled: real Google sign-in is required");
    }
    await delay(1200);
    const token = `mock-jwt.${btoa(MOCK_USER.email)}.${Date.now()}`;
    sessionStorage.setItem(TOKEN_KEY, token);
    sessionStorage.setItem(USER_KEY, JSON.stringify(MOCK_USER));
    return MOCK_USER;
  },

  /* Real Google SSO — given the ID token (credential) returned by the
     @react-oauth/google onSuccess callback, decode the verified profile
     claims and hydrate a real session. The credential itself is the
     server-issued JWT, so it doubles as the persisted token. Falls back
     to safe placeholders if any claim is missing. */
  signInWithGoogleCredential(credential) {
    const claims = decodeJwt(credential) || {};
    const user = {
      id: claims.sub || `g_${Date.now()}`,
      name: claims.name || claims.email || "משתמש Google",
      email: claims.email || "",
      avatar: claims.picture || null,
      plan: "Pro",
      isAuthenticated: true,
    };
    sessionStorage.setItem(TOKEN_KEY, credential);
    sessionStorage.setItem(USER_KEY, JSON.stringify(user));
    return user;
  },

  /* Update the signed-in user's editable profile (display name for now).
     Real backend → Supabase `auth.updateUser` writes user_metadata.full_name,
     which mapSupabaseUser reads, so the new name flows everywhere. Demo/local
     → patch the persisted session user. Returns the mapped, updated user. */
  async updateProfile({ name } = {}) {
    const clean = (name || "").trim();
    if (!clean) throw new Error("empty-name");
    if (isSupabaseEnabled()) {
      const { data, error } = await supabase.auth.updateUser({ data: { full_name: clean, name: clean } });
      if (error) throw new Error(error.message);
      return mapSupabaseUser(data?.user || null);
    }
    try {
      const raw = sessionStorage.getItem(USER_KEY);
      const u = raw ? { ...JSON.parse(raw), name: clean } : null;
      if (u) sessionStorage.setItem(USER_KEY, JSON.stringify(u));
      return u;
    } catch { return null; }
  },

  /* Synchronous read of the persisted session (used on mount to
     re-hydrate auth state without a network round-trip). */
  getCurrentUser() {
    try {
      const raw = sessionStorage.getItem(USER_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  },

  getToken() {
    return sessionStorage.getItem(TOKEN_KEY);
  },

  isAuthenticated() {
    return !!sessionStorage.getItem(TOKEN_KEY);
  },

  /* Sprint 66 #2 — ROBUST HARD SIGN-OUT. Tear down the Supabase session AND
     purge every client storage key (Supabase persists its own auth token in
     localStorage as `sb-<ref>-auth-token`, which the previous session-only
     clear left behind — leaving the user effectively still signed in). We call
     supabase.auth.signOut(), then wipe our own keys plus any Supabase key, and
     finally clear both storages so no token survives the redirect. */
  signOut() {
    try { if (isSupabaseEnabled()) supabase.auth.signOut().catch(() => {}); } catch { /* ignore */ }
    /* Device-level preferences that must SURVIVE sign-out — they are not tied to
       the account and not sensitive: cookie-consent choice, "onboarding seen",
       and the last-viewed product-update watermark. Without preserving these,
       the hard purge below makes all three pop up again on the next session. */
    const KEEP = ["tp_cookie_consent_v1", "tp_onboarded_v1", "last_viewed_sprint"];
    const preserved = {};
    try { KEEP.forEach((k) => { const v = localStorage.getItem(k); if (v != null) preserved[k] = v; }); } catch { /* ignore */ }
    try {
      sessionStorage.removeItem(TOKEN_KEY);
      sessionStorage.removeItem(USER_KEY);
      /* Remove Supabase's own persisted auth tokens (sb-*-auth-token) first,
         then clear both storages entirely as a belt-and-braces purge. */
      for (const store of [localStorage, sessionStorage]) {
        try {
          const keys = [];
          for (let i = 0; i < store.length; i++) { const k = store.key(i); if (k) keys.push(k); }
          keys.forEach((k) => { if (/^sb-|supabase|^tp_/.test(k)) store.removeItem(k); });
        } catch { /* storage unavailable */ }
      }
      try { localStorage.clear(); } catch { /* ignore */ }
      try { sessionStorage.clear(); } catch { /* ignore */ }
    } catch { /* storage unavailable — the redirect below still logs the user out */ }
    /* Restore the preserved device prefs after the purge. */
    try { Object.entries(preserved).forEach(([k, v]) => localStorage.setItem(k, v)); } catch { /* ignore */ }
  },
};

export default authService;
