import React from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Analytics } from "@vercel/analytics/react";
import { AuthProvider } from "./context/AuthContext";
import ProtectedRoute from "./components/ProtectedRoute";
import HomePage from "./views/HomePage";
import ExploreView from "./views/ExploreView";
import AuthView from "./views/AuthView";
import DashboardView from "./views/DashboardView";
import EditorView from "./views/EditorView";

/* ══════════════════════════════════════════════════════════════
   APP — Top-level router

   SaaS map-builder routing (Phase 1 skeleton):
     /                 → HomePage    (Japan landing — serves as the
                                      example-trip entry for now;
                                      becomes the new SaaS landing
                                      in the layout phase)
     /map              → ExploreView (read-only Japan example;
                                      ?demo=1 / ?city / ?day deep-links)
     /auth             → AuthView     (mock Google SSO)
     /dashboard        → DashboardView (protected — trip grid)
     /map/edit/:tripId → EditorView   (protected — workspace shell)

   Protected routes redirect to /auth when no mock session exists.
   ══════════════════════════════════════════════════════════════ */
const App = () => (
  <AuthProvider>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/map" element={<ExploreView />} />
        <Route path="/auth" element={<AuthView />} />
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <DashboardView />
            </ProtectedRoute>
          }
        />
        <Route
          path="/map/edit/:tripId"
          element={
            <ProtectedRoute>
              <EditorView />
            </ProtectedRoute>
          }
        />
        {/* Fallback: anything else lands on the home page */}
        <Route path="*" element={<HomePage />} />
      </Routes>
      <Analytics />
    </BrowserRouter>
  </AuthProvider>
);

export default App;
