import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import tripService from "../services/tripService";

/* ──────────────────────────────────────────────────────────────
   EditorView — the mobile-first workspace shell.
   PHASE 1 PLACEHOLDER: confirms the data round-trip (fetchTripById
   by :tripId from the localStorage service, with loading + error
   states) and the "exit to dashboard" navigation contract. The
   real Map + Bottom-Sheet editor (editor-screens.jsx) is built in
   the layout phase on top of this loaded `trip`.
   ────────────────────────────────────────────────────────────── */
const EditorView = () => {
  const { tripId } = useParams();
  const navigate = useNavigate();
  const [trip, setTrip] = useState(null);   // null = loading
  const [error, setError] = useState(null);

  useEffect(() => {
    let live = true;
    setTrip(null);
    setError(null);
    tripService.fetchTripById(tripId)
      .then((t) => { if (live) setTrip(t); })
      .catch((e) => { if (live) setError(e.message); });
    return () => { live = false; };
  }, [tripId]);

  return (
    <div dir="rtl" style={{ minHeight: "100vh", background: "#fff", fontFamily: "'Noto Sans Hebrew','Inter',sans-serif" }}>
      <header style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 16px", borderBottom: "1px solid rgba(20,20,20,0.08)" }}>
        <button onClick={() => navigate("/dashboard")} title="חזרה לעמוד הבית"
          style={{ width: 40, height: 40, borderRadius: "50%", border: "1px solid rgba(20,20,20,0.12)", background: "#F6F6F4", cursor: "pointer", fontSize: 18, fontFamily: "inherit" }}>
          ←
        </button>
        <div style={{ fontSize: 16, fontWeight: 800, color: "#0D0F11" }}>
          {trip ? trip.title : "טוען מסלול…"}
        </div>
      </header>

      <main style={{ padding: 22 }}>
        {error && (
          <div style={{ color: "#A03325", fontSize: 14 }}>
            שגיאה בטעינת המסלול: {error}
          </div>
        )}
        {!trip && !error && (
          <div style={{ height: 120, borderRadius: 18, background: "linear-gradient(90deg,#f0f0ee,#f7f7f5,#f0f0ee)", backgroundSize: "200% 100%", animation: "tpSkeleton 1.2s ease infinite" }} />
        )}
        {trip && (
          <div style={{ fontSize: 13.5, color: "#2A3036", lineHeight: 1.7 }}>
            {/* Phase-1 confirmation panel — proves the payload arrived. */}
            <p style={{ fontWeight: 700, marginBottom: 8 }}>עורך המסלול — שלד (Phase 1)</p>
            <ul style={{ paddingInlineStart: 18 }}>
              <li>מזהה: <code>{trip.id}</code></li>
              <li>ימים: {trip.days}</li>
              <li>תחנות בנתונים: {trip.data?.tripData?.length ?? 0} ימי-מסלול</li>
              <li>מעברי ערים: {trip.data?.cityTransitions?.length ?? 0}</li>
              <li>הרשאה: {trip.role}{trip.readOnly ? " (קריאה בלבד)" : ""}</li>
            </ul>
            <p style={{ marginTop: 16, color: "#6B7178" }}>
              רכיבי העריכה (מפה + Bottom Sheet + Wizard) ייבנו בשלב הבא מעל הנתונים שנטענו כאן.
            </p>
          </div>
        )}
      </main>
      <style>{`@keyframes tpSkeleton{0%{background-position:200% 0}100%{background-position:-200% 0}}`}</style>
    </div>
  );
};

export default EditorView;
