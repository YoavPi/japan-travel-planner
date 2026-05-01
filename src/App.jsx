import React from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Analytics } from "@vercel/analytics/react";
import HomePage from "./views/HomePage";
import ExploreView from "./views/ExploreView";

/* ══════════════════════════════════════════════════════════════
   APP — Top-level router
   ──────────────────────────────────────────────────────────────
     /         → HomePage   (Modern Japanese landing page)
     /map      → ExploreView (Interactive map + itinerary)
                 Supports deep-link query params:
                   ?city=Tokyo   activates a city filter on mount
                   ?day=12       opens that day on mount
   ══════════════════════════════════════════════════════════════ */
const App = () => (
  <BrowserRouter>
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/map" element={<ExploreView />} />
      {/* Fallback: anything else lands on the home page */}
      <Route path="*" element={<HomePage />} />
    </Routes>
    <Analytics />
  </BrowserRouter>
);

export default App;
