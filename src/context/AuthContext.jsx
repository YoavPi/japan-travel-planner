import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import authService from "../services/authService";

/* ══════════════════════════════════════════════════════════════
   AuthContext — global auth state.

   Re-hydrates from sessionStorage on mount so a page refresh
   inside an active session keeps the user signed in. Exposes the
   user object, a loading flag (for the SSO button skeleton), and
   signIn / signOut actions.
   ══════════════════════════════════════════════════════════════ */

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(() => authService.getCurrentUser());
  const [signingIn, setSigningIn] = useState(false);

  /* Keep state in sync if another tab mutates sessionStorage. */
  useEffect(() => {
    const onStorage = () => setUser(authService.getCurrentUser());
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
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

  const signOut = useCallback(() => {
    authService.signOut();
    setUser(null);
  }, []);

  const value = useMemo(
    () => ({
      user,
      isAuthenticated: !!user,
      signingIn,
      signIn,
      signOut,
    }),
    [user, signingIn, signIn, signOut]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within <AuthProvider>");
  return ctx;
};

export default AuthContext;
