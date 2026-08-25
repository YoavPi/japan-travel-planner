import React, { useEffect, useState } from "react";
import tripService from "../services/tripService";
import { publishToGallery, unpublishFromGallery } from "../services/galleryService";
import { track } from "../analytics/posthog";
import { GALLERY_CATEGORIES } from "../utils/gallery";
import CoverPicker from "./CoverPicker";
import Icon from "./Icon";

/* ══════════════════════════════════════════════════════════════
   PublishToGalleryModal — bottom-anchored RTL sheet that lets a
   trip's owner publish (or manage the publish of) their map to the
   public gallery: editable title, cover (emoji/upload), category,
   an optional description, and a required consent checkbox.

   Mirrors SharePermissionsModal's frost-panel sheet shell.

   Props:
     trip     — the trip to publish (already includes id/title/cover/
                galleryCategory/galleryDescription/isPublic/days/settings)
     onClose()
     onDone() — fired after a successful publish/unpublish
   ══════════════════════════════════════════════════════════════ */

const T = {
  panel: "#fff",
  ink: "#0D0F11",
  ink2: "#2A3036",
  ink3: "#6B7178",
  line: "rgba(20,20,20,0.09)",
  accent: "#E0533F",
  surface: "#F6F6F4",
  font: "'Noto Sans Hebrew','Inter',system-ui,sans-serif",
};

const fieldLabel = { fontSize: 12, fontWeight: 800, color: T.ink3, letterSpacing: "0.04em", margin: "18px 0 8px" };
const inputStyle = {
  width: "100%", boxSizing: "border-box", height: 42, borderRadius: 10, border: `1px solid ${T.line}`,
  background: T.surface, color: T.ink, fontSize: 13.5, fontFamily: T.font, padding: "0 12px", textAlign: "right",
};

const PublishToGalleryModal = ({ trip, onClose, onDone }) => {
  const [title, setTitle] = useState(trip.title || "");
  const [cover, setCover] = useState(trip.cover);
  const [category, setCategory] = useState(trip.galleryCategory || "");
  const [description, setDescription] = useState(trip.galleryDescription || "");
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, []);

  const publish = async () => {
    setErr("");
    try {
      setBusy(true);
      if (title.trim() && title !== trip.title) await tripService.renameTrip(trip.id, title);
      if (cover !== trip.cover) await tripService.setCover(trip.id, cover);
      await publishToGallery(trip.id, { category, description });
      track("map_published", { category, days: trip.days, destination: trip.settings?.destinationHe });
      onDone();
    } catch (e) {
      setErr(e?.message || "הפרסום נכשל");
    } finally {
      setBusy(false);
    }
  };

  const unpublish = async () => {
    setErr("");
    try {
      setBusy(true);
      await unpublishFromGallery(trip.id);
      track("map_unpublished");
      onDone();
    } catch (e) {
      setErr(e?.message || "ביטול הפרסום נכשל");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      dir="rtl"
      onClick={onClose}
      style={{ position: "fixed", inset: 0, zIndex: 95, display: "flex", alignItems: "flex-end", justifyContent: "center", background: "rgba(0,0,0,0.5)", fontFamily: T.font }}
    >
      <div
        className="tp-sheet-up"
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%", maxWidth: 560, maxHeight: "88vh", background: T.panel,
          borderTopLeftRadius: 24, borderTopRightRadius: 24,
          boxShadow: "0 -20px 60px rgba(0,0,0,0.32)",
          display: "flex", flexDirection: "column", overflow: "hidden",
        }}
      >
        {/* Sticky header */}
        <div style={{ flexShrink: 0, padding: "12px 18px 12px", borderBottom: `1px solid ${T.line}`, background: T.panel }}>
          <div style={{ display: "flex", justifyContent: "center", marginBottom: 8 }}>
            <div style={{ width: 44, height: 5, borderRadius: 999, background: T.line }} />
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ width: 34, height: 34, borderRadius: "50%", background: T.surface, color: T.ink2, display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <Icon name="map" size={16} strokeWidth={2} />
            </span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 16, fontWeight: 800, color: T.ink, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                {trip.isPublic ? "ניהול פרסום לגלריה" : "פרסום לגלריה"}
              </div>
            </div>
            <button onClick={onClose} aria-label="סגירה" className="tp-press"
              style={{ width: 34, height: 34, borderRadius: "50%", border: "none", background: T.surface, color: T.ink2, cursor: "pointer", display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <Icon name="x" size={15} strokeWidth={2.2} />
            </button>
          </div>
        </div>

        {/* Scroll body */}
        <div style={{ flex: 1, overflowY: "auto", padding: "16px 18px 24px" }}>
          <div style={fieldLabel}>שם המסלול</div>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="שם המסלול"
            style={inputStyle}
          />

          <div style={fieldLabel}>תמונת שער</div>
          <CoverPicker value={cover} tripId={trip.id} onChange={setCover} />

          <div style={fieldLabel}>קטגוריה</div>
          <select value={category} onChange={(e) => setCategory(e.target.value)} style={{ ...inputStyle, cursor: "pointer" }}>
            <option value="">בחרו קטגוריה</option>
            {GALLERY_CATEGORIES.map((c) => (
              <option key={c.slug} value={c.slug}>{c.label}</option>
            ))}
          </select>

          <div style={fieldLabel}>תיאור (לא חובה)</div>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="ספרו למה כדאי לטייל במסלול הזה..."
            rows={3}
            style={{ width: "100%", boxSizing: "border-box", padding: "10px 12px", borderRadius: 10, border: `1px solid ${T.line}`, background: T.surface, fontSize: 13.5, fontFamily: T.font, color: T.ink, direction: "rtl", textAlign: "right", resize: "vertical", lineHeight: 1.5 }}
          />

          <label style={{ display: "flex", alignItems: "flex-start", gap: 10, marginTop: 20, cursor: "pointer" }}>
            <input
              type="checkbox"
              checked={consent}
              onChange={(e) => setConsent(e.target.checked)}
              style={{ marginTop: 2, width: 18, height: 18, flexShrink: 0, accentColor: T.accent, cursor: "pointer" }}
            />
            <span style={{ fontSize: 13, color: T.ink2, lineHeight: 1.5 }}>
              אני מאשר/ת שהמפה תוצג לכולם
            </span>
          </label>

          {err && <div style={{ marginTop: 12, fontSize: 12, fontWeight: 600, color: "#C0392B" }}>{err}</div>}
        </div>

        {/* Footer */}
        <div style={{ flexShrink: 0, padding: "12px 18px", borderTop: `1px solid ${T.line}`, background: T.panel, display: "flex", flexDirection: "column", gap: 8 }}>
          <button onClick={publish} disabled={!consent || busy} className="tp-press"
            style={{ width: "100%", height: 48, borderRadius: 999, border: "none", background: T.ink, color: T.panel, fontSize: 15, fontWeight: 800, cursor: (!consent || busy) ? "default" : "pointer", fontFamily: T.font, opacity: (!consent || busy) ? 0.55 : 1 }}>
            {busy ? "מפרסם…" : "פרסם"}
          </button>
          {trip.isPublic && (
            <button onClick={unpublish} disabled={busy} className="tp-press"
              style={{ width: "100%", height: 44, borderRadius: 999, border: `1px solid ${T.line}`, background: T.panel, color: "#C0392B", fontSize: 14, fontWeight: 800, cursor: busy ? "default" : "pointer", fontFamily: T.font, opacity: busy ? 0.55 : 1 }}>
              בטל פרסום
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default PublishToGalleryModal;
