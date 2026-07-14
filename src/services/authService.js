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

  /* Fake Google SSO — resolves the mock user after a delay so the
     sign-in button can show a loading/skeleton state. */
  async signInWithGoogle() {
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

  signOut() {
    sessionStorage.removeItem(TOKEN_KEY);
    sessionStorage.removeItem(USER_KEY);
    /* Also tear down any Supabase session (fire-and-forget). */
    if (isSupabaseEnabled()) supabase.auth.signOut().catch(() => {});
  },
};

export default authService;
