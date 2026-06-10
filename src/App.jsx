import React from "react";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { Analytics } from "@vercel/analytics/react";
import { AuthProvider } from "./context/AuthContext";
import ProtectedRoute from "./components/ProtectedRoute";
import LandingView from "./views/LandingView";
import HomePage from "./views/HomePage";
import ExploreView from "./views/ExploreView";
import AuthView from "./views/AuthView";
import DashboardView from "./views/DashboardView";
import WizardView from "./views/WizardView";
/* ProfileView retired — merged into DashboardView (one premium
   "המפות שלי / הפרופיל שלי" page). /profile now redirects there. */
import SettingsView from "./views/SettingsView";
import NotificationsView from "./views/NotificationsView";
import EditorView from "./views/EditorView";
import OnboardingView, { isOnboarded } from "./views/OnboardingView";

/* First-visit gate: send guests through the 5-step walkthrough
   before they ever hit the SaaS landing. The flag persists so the
   redirect only happens once per device. */
const LandingGate = () => (isOnboarded() ? <LandingView /> : <Navigate to="/welcome" replace />);

/* ══════════════════════════════════════════════════════════════
   APP — Top-level router

   SaaS map-builder routing:
     /                 → LandingView (SaaS platform HOME page)
     /japan            → HomePage    (Japan example-trip landing)
     /map              → ExploreView (read-only Japan example;
                                      ?demo=1 / ?city / ?day deep-links)
     /auth             → AuthView     (mock Google SSO)
     /dashboard        → DashboardView (protected — trip grid)
     /map/edit/:tripId → EditorView   (protected — workspace shell)

   Protected routes redirect to /auth when no mock session exists.
   ══════════════════════════════════════════════════════════════ */
/* AnimatedRoutes — wraps the route table in a per-path fading
   container so every navigation cross-fades instead of hard-cutting.
   Keyed on pathname so React remounts the wrapper (re-running the
   .tp-route opacity animation) on each navigation. The fade is
   OPACITY-ONLY by design: a transform here would re-root every
   position:fixed descendant (bottom dock, editor sheet, side drawer)
   to this wrapper and misplace them mid-animation. */
const AnimatedRoutes = () => {
  const location = useLocation();
  return (
    <div key={location.pathname} className="tp-route" style={{ minHeight: "100vh" }}>
      <Routes location={location}>
        <Route path="/" element={<LandingGate />} />
        <Route path="/welcome" element={<OnboardingView />} />
        <Route path="/japan" element={<HomePage />} />
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
          path="/create"
          element={
            <ProtectedRoute>
              <WizardView />
            </ProtectedRoute>
          }
        />
        {/* Legacy /profile alias — folded into /dashboard. */}
        <Route path="/profile" element={<Navigate to="/dashboard" replace />} />
        <Route
          path="/settings"
          element={
            <ProtectedRoute>
              <SettingsView />
            </ProtectedRoute>
          }
        />
        <Route
          path="/notifications"
          element={
            <ProtectedRoute>
              <NotificationsView />
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
        {/* Fallback: anything else lands on the platform home */}
        <Route path="*" element={<LandingView />} />
      </Routes>
    </div>
  );
};

const App = () => (
  <AuthProvider>
    <BrowserRouter>
      <AnimatedRoutes />
      <Analytics />
    </BrowserRouter>
  </AuthProvider>
);

export default App;
