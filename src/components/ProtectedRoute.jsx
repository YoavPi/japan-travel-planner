import React from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

/* ProtectedRoute — gates editor/dashboard behind auth.

   OAuth-loop fix: while the Supabase session is still HYDRATING
   (initial page load after the Google redirect, or any hard refresh
   with a persisted session), `user` is momentarily null. Redirecting
   during that split second ejected freshly-authenticated users back
   to /auth. So while `initializing` is true we render a lightweight
   splash and make NO routing decision; only a definitive
   "not authenticated" bounces to /auth (with the intended destination
   preserved so the auth flow returns the user afterwards). */
const ProtectedRoute = ({ children }) => {
  const { isAuthenticated, initializing } = useAuth();
  const location = useLocation();

  if (initializing) {
    return (
      <div dir="rtl" style={{
        minHeight: "100vh", display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center", gap: 14,
        background: "#F6F6F4",
        fontFamily: "'Noto Sans Hebrew','Inter','Noto Sans JP',system-ui,sans-serif",
      }}>
        <div aria-hidden style={{
          width: 34, height: 34, borderRadius: "50%",
          border: "3px solid rgba(20,20,20,0.12)", borderTopColor: "#0D0F11",
          animation: "tpAuthSpin 0.8s linear infinite",
        }} />
        <div style={{ fontSize: 13.5, fontWeight: 700, color: "#6B7178" }}>מאמת התחברות…</div>
        <style>{`@keyframes tpAuthSpin{to{transform:rotate(360deg)}}`}</style>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/auth" replace state={{ from: location.pathname }} />;
  }
  return children;
};

export default ProtectedRoute;
