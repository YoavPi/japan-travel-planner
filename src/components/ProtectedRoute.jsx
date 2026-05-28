import React from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

/* ProtectedRoute — gates editor/dashboard behind mock auth.
   Unauthenticated users are bounced to /auth, with the intended
   destination preserved in location state so the auth flow can
   send them back after sign-in. */
const ProtectedRoute = ({ children }) => {
  const { isAuthenticated } = useAuth();
  const location = useLocation();
  if (!isAuthenticated) {
    return <Navigate to="/auth" replace state={{ from: location.pathname }} />;
  }
  return children;
};

export default ProtectedRoute;
