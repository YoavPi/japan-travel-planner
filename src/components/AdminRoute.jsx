import React from "react";
import { Navigate } from "react-router-dom";
import ProtectedRoute from "./ProtectedRoute";
import { useAuth } from "../context/AuthContext";
import isAdminEmail from "../utils/isAdmin";

/* AdminRoute — layers an admin-email check on top of ProtectedRoute.
   ProtectedRoute handles the auth splash + bounce-to-/auth; here we ensure
   ONLY the admin (yoav.pintel@gmail.com) proceeds. Any other signed-in user
   is redirected to /dashboard. This client gate is UX only — the real gate is
   the /api/admin/* endpoint returning 403. */
const AdminRoute = ({ children }) => {
  const { user } = useAuth();
  return (
    <ProtectedRoute>
      {isAdminEmail(user?.email) ? children : <Navigate to="/dashboard" replace />}
    </ProtectedRoute>
  );
};

export default AdminRoute;
