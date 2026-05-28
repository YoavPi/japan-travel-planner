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

const TOKEN_KEY = "tp_auth_token";
const USER_KEY  = "tp_auth_user";

const delay = (ms) => new Promise((res) => setTimeout(res, ms));

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
  /* Fake Google SSO — resolves the mock user after a delay so the
     sign-in button can show a loading/skeleton state. */
  async signInWithGoogle() {
    await delay(1200);
    const token = `mock-jwt.${btoa(MOCK_USER.email)}.${Date.now()}`;
    sessionStorage.setItem(TOKEN_KEY, token);
    sessionStorage.setItem(USER_KEY, JSON.stringify(MOCK_USER));
    return MOCK_USER;
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
  },
};

export default authService;
