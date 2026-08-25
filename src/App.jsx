import React, { useEffect, useRef, useState } from "react";
import { BrowserRouter, Routes, Route, Navigate, useLocation, useNavigate } from "react-router-dom";
import { Analytics } from "@vercel/analytics/react";
import { GoogleOAuthProvider } from "@react-oauth/google";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { useDarkMode } from "./utils/theme";
import useActiveTrip from "./utils/useActiveTrip";
import tripService from "./services/tripService";
import Icon from "./components/Icon";
import ProtectedRoute from "./components/ProtectedRoute";
import BottomDock from "./components/BottomDock";
import SideMenu from "./components/SideMenu";
import useIsDesktop from "./utils/useIsDesktop";
import LandingView from "./views/LandingView";
import HomePage from "./views/HomePage";
import ExploreView from "./views/ExploreView";
import AuthView from "./views/AuthView";
import DashboardView from "./views/DashboardView";
import WizardView from "./views/WizardView";
/* /profile redirects to /dashboard (see <Navigate> route below). */
import SettingsView from "./views/SettingsView";
import NotificationsView from "./views/NotificationsView";
import ResponsiveEditor from "./views/ResponsiveEditor";
import TripOverviewView from "./views/TripOverviewView";
import OnboardingView, { isOnboarded } from "./views/OnboardingView";
import SharePermissionsModal from "./components/SharePermissionsModal";
import PrivacyPage from "./views/PrivacyPage";
import TermsPage from "./views/TermsPage";
import AccessibilityPage from "./views/AccessibilityPage";
import CreditsPage from "./views/CreditsPage";
import AccessibilityWidget from "./components/AccessibilityWidget";
import CookieConsent from "./components/CookieConsent";

/* First-visit gate: send guests through the 5-step walkthrough
   before they ever hit the SaaS landing. The flag persists so the
   redirect only happens once per device.
   Sprint 36 #17 — an authenticated user skips the marketing landing
   entirely and lands straight on their personalized dashboard. */
const LandingGate = () => {
  const { isAuthenticated, initializing } = useAuth();
  if (initializing) return null; // wait for the session probe (no flash/bounce)
  if (isAuthenticated) return <Navigate to="/dashboard" replace />;
  return isOnboarded() ? <LandingView /> : <Navigate to="/welcome" replace />;
};

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
    <div id="main-content" tabIndex={-1} key={location.pathname} className="tp-route" style={{ minHeight: "100vh", outline: "none" }}>
      <Routes location={location}>
        <Route path="/" element={<LandingGate />} />
        <Route path="/welcome" element={<OnboardingView />} />
        <Route path="/japan" element={<HomePage />} />
        <Route path="/map" element={<ExploreView />} />
        <Route path="/auth" element={<AuthView />} />
        {/* Static legal / info pages (public). */}
        <Route path="/privacy" element={<PrivacyPage />} />
        <Route path="/terms" element={<TermsPage />} />
        <Route path="/accessibility" element={<AccessibilityPage />} />
        <Route path="/credits" element={<CreditsPage />} />
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
          path="/trip/overview/:tripId"
          element={
            <ProtectedRoute>
              <TripOverviewView />
            </ProtectedRoute>
          }
        />
        <Route
          path="/map/edit/:tripId"
          element={
            <ProtectedRoute>
              {/* Stage 0 responsive switch: mobile renders EditorView verbatim;
                  desktop frames it. The real desktop cockpit lands here later. */}
              <ResponsiveEditor />
            </ProtectedRoute>
          }
        />
        {/* Fallback: anything else lands on the platform home */}
        <Route path="*" element={<LandingView />} />
      </Routes>
    </div>
  );
};

/* ══════════════════════════════════════════════════════════════
   AppChrome — global navigation layer.

   Renders the floating BottomDock + the SideMenu drawer (with its
   own floating hamburger trigger) as ONE consistent shell across all
   primary SaaS screens: the platform home (/), the dashboard, and
   settings/notifications.

   It auto-hides on focused full-screen flows that need maximal
   vertical real estate — the trip-creation wizard (/create) and the
   map workspace editor (/map/edit/:tripId) — as well as the
   pre-entry/example-trip routes (/welcome, /auth, /japan, /map),
   which belong to the onboarding + Japan-example layer rather than
   the authenticated SaaS app.

   The hamburger lives bottom-start (left in RTL) so it shares the
   floating-controls band with the centered dock and never collides
   with any per-view top header. ═══════════════════════════════════ */
const SHOW_CHROME = (p) =>
  p === "/" ||
  p.startsWith("/dashboard") ||
  p.startsWith("/settings") ||
  p.startsWith("/notifications");

const AppChrome = () => {
  const { pathname } = useLocation();
  const { P } = useDarkMode();
  const [menuOpen, setMenuOpen] = useState(false);
  /* Desktop gets a real full-width top nav from each view — the floating
     mobile dock + hamburger are what made desktop read as "stretched
     mobile", so they are suppressed entirely at ≥1024px. */
  const isDesktop = useIsDesktop();

  const show = SHOW_CHROME(pathname) && !isDesktop;

  /* Make sure the drawer never lingers open when we route into a
     full-screen flow (wizard/editor) where the chrome is hidden. */
  useEffect(() => { if (!show) setMenuOpen(false); }, [show]);

  if (!show) return null;

  return (
    <>
      {/* Floating SideMenu trigger — bottom-start, harmonised with
          the dock's floating band so it clears every top header. */}
      <button
        onClick={() => setMenuOpen(true)}
        title="תפריט"
        aria-label="פתיחת תפריט"
        className="tp-press"
        style={{
          position: "fixed", bottom: 18, insetInlineEnd: 18, zIndex: 80,
          width: 48, height: 48, borderRadius: 999,
          border: `1px solid ${P.line}`, background: P.panel, cursor: "pointer",
          display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 4,
          boxShadow: "0 12px 40px rgba(0,0,0,0.18), 0 2px 6px rgba(0,0,0,0.08)",
          backdropFilter: "blur(6px)",
        }}
      >
        <span style={{ width: 18, height: 2, borderRadius: 2, background: P.ink }} />
        <span style={{ width: 18, height: 2, borderRadius: 2, background: P.ink }} />
        <span style={{ width: 18, height: 2, borderRadius: 2, background: P.ink }} />
      </button>

      <BottomDock />
      <SideMenu open={menuOpen} onClose={() => setMenuOpen(false)} />
    </>
  );
};

/* ══════════════════════════════════════════════════════════════
   ActiveTripBar — persistent one-click quick-entry to the live trip.

   When a trip is flagged active (tripService.setActiveTrip), this
   floating minibar appears on EVERY screen and jumps straight to
   that trip's overview. It hides itself only while you're already
   viewing the active trip (its overview or editor) to avoid noise,
   and sits above the BottomDock when the chrome is present.
   ══════════════════════════════════════════════════════════════ */
const ACCENT = "#E0533F";
const FONT = "'Noto Sans Hebrew','Inter','Noto Sans JP',system-ui,sans-serif";

const LONG_PRESS_MS = 600;

const ActiveTripBar = () => {
  const activeId = useActiveTrip();
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const [title, setTitle] = useState("");
  const [readOnly, setReadOnly] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);

  /* Long-press bookkeeping: a timer arms the context menu; if it
     fires we flag the press as "long" so the trailing click is
     swallowed instead of routing into the map. */
  const pressTimer = useRef(null);
  const longFired = useRef(false);

  useEffect(() => {
    let live = true;
    if (!activeId) { setTitle(""); setReadOnly(false); return; }
    tripService.fetchTripById(activeId)
      .then((t) => { if (live) { setTitle(t.title || ""); setReadOnly(!!t.readOnly); } })
      .catch(() => { if (live) { setTitle(""); setReadOnly(false); } });
    return () => { live = false; };
  }, [activeId]);

  /* Close the menu when the active trip changes / unmounts. */
  useEffect(() => { setMenuOpen(false); setShareOpen(false); }, [activeId]);

  if (!activeId) return null;

  /* Read-only example trips (the Japan demo) live on the canonical
     static demo map (/map?demo=1) — NOT a standalone editable route.
     Routing the bar there keeps a single, read-only sample map and
     prevents the dual-map confusion of spawning /map/edit/japan-demo. */
  const mapTarget = readOnly ? "/map?demo=1" : `/map/edit/${activeId}`;

  /* Don't shout the shortcut while the user is already inside the
     active trip (its overview, its editor, or — for the demo — the
     static example map at /map). */
  const onActiveTrip =
    pathname === `/trip/overview/${activeId}` ||
    pathname === `/map/edit/${activeId}` ||
    (readOnly && pathname === "/map");
  if (onActiveTrip) return null;

  /* Lift above the dock on the primary SaaS screens; otherwise hug
     the bottom edge (editor/wizard hide the dock). */
  const liftedAboveDock = SHOW_CHROME(pathname);

  const clearPressTimer = () => {
    if (pressTimer.current) { clearTimeout(pressTimer.current); pressTimer.current = null; }
  };

  const startPress = () => {
    longFired.current = false;
    clearPressTimer();
    pressTimer.current = setTimeout(() => {
      longFired.current = true;
      pressTimer.current = null;
      setMenuOpen(true);
    }, LONG_PRESS_MS);
  };

  const endPress = () => clearPressTimer();

  /* FAST CLICK → hard route straight into the interactive map
     workspace canvas. A long-press that already opened the menu
     swallows this click. */
  const handleClick = () => {
    if (longFired.current) { longFired.current = false; return; }
    if (menuOpen) return;
    navigate(mapTarget);
  };

  const stopTrip = () => { setMenuOpen(false); tripService.setActiveTrip(null); };

  const sendTrip = () => {
    setMenuOpen(false);
    const url = `${window.location.origin}${mapTarget}`;
    if (navigator.share) {
      navigator.share({ title: title || "הטיול שלי", url }).catch(() => {});
    } else {
      navigator.clipboard?.writeText(url).catch(() => {});
    }
  };

  const openShare = () => { setMenuOpen(false); setShareOpen(true); };

  const MENU = [
    { icon: "map", label: "פתחו את המפה", onClick: () => { setMenuOpen(false); navigate(mapTarget); } },
    { icon: "share", label: "שיתוף טיול", onClick: openShare },
    { icon: "link", label: "שליחת טיול", onClick: sendTrip },
    { icon: "x", label: "עצירת טיול", danger: true, onClick: stopTrip },
  ];

  return (
    <>
      {/* Tap-catcher: clicking outside dismisses the context menu. */}
      {menuOpen && (
        <div
          onClick={() => setMenuOpen(false)}
          style={{ position: "fixed", inset: 0, zIndex: 74, background: "transparent" }}
        />
      )}

      <div style={{ position: "fixed", bottom: liftedAboveDock ? 86 : 20, insetInlineStart: 18, zIndex: 76 }}>
        {/* Long-press context menu */}
        {menuOpen && (
          <div
            className="tp-pop"
            dir="rtl"
            style={{
              position: "absolute", bottom: 56, insetInlineStart: 0, minWidth: 200,
              background: "#fff", borderRadius: 14, overflow: "hidden", fontFamily: FONT,
              boxShadow: "0 18px 50px rgba(0,0,0,0.28), 0 2px 8px rgba(0,0,0,0.12)",
              border: "1px solid rgba(20,20,20,0.08)",
            }}
          >
            {MENU.map((m, i) => (
              <button
                key={m.label}
                onClick={m.onClick}
                className="tp-press"
                style={{
                  display: "flex", alignItems: "center", gap: 10, width: "100%", textAlign: "right",
                  padding: "12px 14px", border: "none", borderTop: i ? "1px solid rgba(20,20,20,0.06)" : "none",
                  background: "transparent", cursor: "pointer", fontFamily: FONT, fontSize: 13.5,
                  fontWeight: 700, color: m.danger ? "#C0392B" : "#0D0F11",
                }}
              >
                <span style={{ width: 18, display: "inline-flex", alignItems: "center", justifyContent: "center", color: m.danger ? "#C0392B" : "#6B7178" }}>
                  <Icon name={m.icon} size={15} strokeWidth={2} />
                </span>
                {m.label}
              </button>
            ))}
          </div>
        )}

        <button
          onClick={handleClick}
          onPointerDown={startPress}
          onPointerUp={endPress}
          onPointerLeave={endPress}
          onContextMenu={(e) => { e.preventDefault(); setMenuOpen(true); }}
          className="tp-press tp-pop"
          title="פתיחת מפת הטיול הפעיל"
          style={{
            display: "inline-flex", alignItems: "center", gap: 10,
            maxWidth: "min(86vw, 340px)", height: 46, padding: "0 16px 0 12px",
            borderRadius: 999, border: "none", cursor: "pointer", fontFamily: FONT,
            background: ACCENT, color: "#fff",
            boxShadow: `0 10px 30px ${ACCENT}66, 0 2px 8px rgba(0,0,0,0.18)`,
            touchAction: "none", userSelect: "none",
          }}
        >
          <span style={{ position: "relative", display: "inline-flex", alignItems: "center", justifyContent: "center", width: 26, height: 26, borderRadius: "50%", background: "rgba(255,255,255,0.18)", flexShrink: 0 }}>
            <Icon name="map" size={15} strokeWidth={2.2} />
            <span style={{ position: "absolute", top: -1, insetInlineEnd: -1, width: 9, height: 9, borderRadius: "50%", background: "#fff", border: `2px solid ${ACCENT}`, animation: "tpLivePulse 1.6s ease-in-out infinite" }} />
          </span>
          <span style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", lineHeight: 1.15, minWidth: 0 }}>
            <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: "0.04em", opacity: 0.85 }}>טיול פעיל · לייב</span>
            <span style={{ fontSize: 13.5, fontWeight: 800, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: 220 }}>{title || "המשך לטיול"}</span>
          </span>
          <span style={{ display: "inline-flex", flexShrink: 0, opacity: 0.9, marginInlineStart: 2 }}>
            <Icon name="chevronEnd" size={16} strokeWidth={2.4} />
          </span>
        </button>
      </div>

      {/* Share / permissions modal — same workflow as the dashboard. */}
      {shareOpen && (
        <SharePermissionsModal tripId={activeId} onClose={() => setShareOpen(false)} />
      )}
    </>
  );
};

/* Google SSO wrapper — only mount GoogleOAuthProvider when a real
   client id is configured (REACT_APP_GOOGLE_CLIENT_ID). With an empty
   key the provider would throw, so we fall back to the bare tree and
   AuthView keeps its mock sign-in path. This keeps the build/runtime
   crash-free whether or not a client id is present. */
const GOOGLE_CLIENT_ID = process.env.REACT_APP_GOOGLE_CLIENT_ID || "";

const Shell = () => (
  <AuthProvider>
    <BrowserRouter>
      <a href="#main-content" className="tp-skip-link">דילוג לתוכן</a>
      <AnimatedRoutes />
      <AppChrome />
      <ActiveTripBar />
      <AccessibilityWidget />
      <CookieConsent />
      <Analytics />
    </BrowserRouter>
  </AuthProvider>
);

const App = () =>
  GOOGLE_CLIENT_ID ? (
    <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
      <Shell />
    </GoogleOAuthProvider>
  ) : (
    <Shell />
  );

export default App;
