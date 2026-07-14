import React, { useEffect, useMemo, useState } from "react";
import tripService from "../services/tripService";
import { useDarkMode } from "../utils/theme";
import Icon from "./Icon";

/* ══════════════════════════════════════════════════════════════
   SharePermissionsModal — Google-Sheets-style sharing sheet.

   A bottom-anchored RTL sheet that loads a trip by id and lets the
   owner manage who has access:
     • add-people row  (email field + role dropdown + הוספה)
     • "אנשים שיש להם גישה" list (owner tagged בעלים; collaborators
       get an inline role dropdown צופה/עורך + הסר)
     • "גישה כללית" link row with a copy button

   Persists the collaborator list through tripService.updateSharing
   (writes even on read-only example trips — sharing metadata is not
   itinerary content). Works for any trip id, so the same component
   serves the dashboard card menu AND the ActiveTripBar long-press.

   Props:
     tripId    — the trip to manage
     onClose() — dismiss
     onChanged(summary) — optional; fired after each successful save
   ══════════════════════════════════════════════════════════════ */

const FONT = "'Noto Sans Hebrew','Inter','Noto Sans JP',system-ui,sans-serif";
const ROLE_LABEL = { edit: "עורך", view: "צופה" };
const isEmail = (s) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test((s || "").trim());

const Avatar = ({ name, P }) => (
  <span style={{
    width: 38, height: 38, borderRadius: "50%", flexShrink: 0,
    background: P.surface2, color: P.ink2, display: "inline-flex",
    alignItems: "center", justifyContent: "center", fontSize: 15, fontWeight: 800,
  }}>
    {(name || "?").trim().slice(0, 1)}
  </span>
);

const SharePermissionsModal = ({ tripId, onClose, onChanged }) => {
  const { P } = useDarkMode();
  const [trip, setTrip] = useState(null);
  const [collabs, setCollabs] = useState([]);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("view");
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [err, setErr] = useState("");

  /* Load the trip + lock body scroll while open. */
  useEffect(() => {
    let live = true;
    tripService.fetchTripById(tripId)
      .then((t) => { if (live) { setTrip(t); setCollabs(Array.isArray(t.collaborators) ? t.collaborators : []); } })
      .catch(() => { if (live) setErr("טעינת המסלול נכשלה."); });
    return () => { live = false; };
  }, [tripId]);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, []);

  const owner = trip?.owner;
  const shareUrl = useMemo(() => {
    if (!trip) return "";
    return trip.readOnly
      ? `${window.location.origin}/map?demo=1`
      : `${window.location.origin}/map/edit/${trip.id}`;
  }, [trip]);

  /* Optimistic write-through to the store. */
  const persist = async (next) => {
    const prev = collabs;
    setCollabs(next);
    setBusy(true);
    try {
      const updated = await tripService.updateSharing(tripId, next);
      onChanged && onChanged(updated);
    } catch {
      setCollabs(prev); // revert on failure
      setErr("שמירת ההרשאות נכשלה.");
    } finally {
      setBusy(false);
    }
  };

  const addPerson = () => {
    setErr("");
    const e = email.trim().toLowerCase();
    if (!isEmail(e)) { setErr("נא להזין כתובת אימייל תקינה."); return; }
    if (collabs.some((c) => (c.email || "").toLowerCase() === e) || (owner?.email || "").toLowerCase() === e) {
      setErr("לאדם הזה כבר יש גישה."); return;
    }
    const person = { id: `u_${e.replace(/[^a-z0-9]/g, "").slice(0, 10)}_${Date.now().toString(36)}`, name: e.split("@")[0], email: e, role, avatar: null };
    setEmail("");
    persist([...collabs, person]);
  };

  const changeRole = (id, value) => {
    if (value === "remove") { persist(collabs.filter((c) => c.id !== id)); return; }
    persist(collabs.map((c) => (c.id === id ? { ...c, role: value } : c)));
  };

  const copyLink = async () => {
    try { await navigator.clipboard.writeText(shareUrl); } catch { /* noop */ }
    setCopied(true); setTimeout(() => setCopied(false), 1400);
  };

  const selectStyle = {
    appearance: "none", WebkitAppearance: "none", MozAppearance: "none",
    fontFamily: FONT, fontSize: 12.5, fontWeight: 700, color: P.ink2,
    background: `${P.surface} url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%238B9198' stroke-width='2.4' stroke-linecap='round' stroke-linejoin='round'><polyline points='6 9 12 15 18 9'/></svg>") no-repeat left 10px center`,
    border: `1px solid ${P.line}`, borderRadius: 10, padding: "8px 12px 8px 28px",
    cursor: "pointer", direction: "rtl",
  };

  return (
    <div
      dir="rtl"
      onClick={onClose}
      style={{ position: "fixed", inset: 0, zIndex: 95, display: "flex", alignItems: "flex-end", justifyContent: "center", background: "rgba(0,0,0,0.5)", fontFamily: FONT }}
    >
      <div
        className="tp-sheet-up"
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%", maxWidth: 560, maxHeight: "88vh", background: P.panel,
          borderTopLeftRadius: 24, borderTopRightRadius: 24,
          boxShadow: "0 -20px 60px rgba(0,0,0,0.32)",
          display: "flex", flexDirection: "column", overflow: "hidden",
        }}
      >
        {/* Sticky header */}
        <div style={{ flexShrink: 0, padding: "12px 18px 12px", borderBottom: `1px solid ${P.line}`, background: P.panel }}>
          <div style={{ display: "flex", justifyContent: "center", marginBottom: 8 }}>
            <div style={{ width: 44, height: 5, borderRadius: 999, background: P.line }} />
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ width: 34, height: 34, borderRadius: "50%", background: P.surface, color: P.ink2, display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <Icon name="share" size={16} strokeWidth={2} />
            </span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 16, fontWeight: 800, color: P.ink, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                שיתוף{trip ? ` · ${trip.title}` : ""}
              </div>
            </div>
            <button onClick={onClose} aria-label="סגירה" className="tp-press"
              style={{ width: 34, height: 34, borderRadius: "50%", border: "none", background: P.surface, color: P.ink2, cursor: "pointer", display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <Icon name="x" size={15} strokeWidth={2.2} />
            </button>
          </div>
        </div>

        {/* Scroll body */}
        <div style={{ flex: 1, overflowY: "auto", padding: "16px 18px 24px" }}>
          {/* Add-people row */}
          <div style={{ display: "flex", gap: 8, alignItems: "stretch" }}>
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") addPerson(); }}
              type="email"
              dir="ltr"
              placeholder="הוסיפו אנשים לפי אימייל"
              style={{ flex: 1, minWidth: 0, height: 42, borderRadius: 10, border: `1px solid ${P.line}`, background: P.surface, color: P.ink, fontSize: 13.5, fontFamily: FONT, padding: "0 12px", textAlign: "right" }}
            />
            <select value={role} onChange={(e) => setRole(e.target.value)} style={{ ...selectStyle, height: 42 }}>
              <option value="view">צופה</option>
              <option value="edit">עורך</option>
            </select>
            <button onClick={addPerson} disabled={busy} className="tp-press"
              style={{ flexShrink: 0, height: 42, padding: "0 16px", borderRadius: 10, border: "none", background: P.ink, color: P.panel, fontSize: 13.5, fontWeight: 800, cursor: busy ? "default" : "pointer", fontFamily: FONT, opacity: busy ? 0.6 : 1 }}>
              הוספה
            </button>
          </div>
          {err && <div style={{ marginTop: 8, fontSize: 12, fontWeight: 600, color: "#C0392B" }}>{err}</div>}

          {/* People with access */}
          <div style={{ fontSize: 12, fontWeight: 800, color: P.ink3, letterSpacing: "0.04em", margin: "20px 0 8px" }}>
            אנשים שיש להם גישה
          </div>

          {/* Owner */}
          {owner && (
            <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "8px 0" }}>
              <Avatar name={owner.name} P={P} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: P.ink, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{owner.name}</div>
                {owner.email && <div style={{ fontSize: 12, color: P.ink3, direction: "ltr", textAlign: "right" }}>{owner.email}</div>}
              </div>
              <span style={{ fontSize: 12, fontWeight: 700, color: P.ink3, padding: "0 6px" }}>בעלים</span>
            </div>
          )}

          {/* Collaborators */}
          {collabs.map((c) => (
            <div key={c.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "8px 0" }}>
              <Avatar name={c.name} P={P} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: P.ink, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{c.name}</div>
                {c.email && <div style={{ fontSize: 12, color: P.ink3, direction: "ltr", textAlign: "right" }}>{c.email}</div>}
              </div>
              <select value={c.role === "edit" ? "edit" : "view"} onChange={(e) => changeRole(c.id, e.target.value)} disabled={busy} style={selectStyle}>
                <option value="view">{ROLE_LABEL.view}</option>
                <option value="edit">{ROLE_LABEL.edit}</option>
                <option value="remove">הסר</option>
              </select>
            </div>
          ))}

          {owner && collabs.length === 0 && (
            <div style={{ fontSize: 12.5, color: P.ink4, padding: "4px 0 0" }}>עדיין לא שיתפתם את המסלול עם אף אחד.</div>
          )}

          {/* General access link row */}
          <div style={{ fontSize: 12, fontWeight: 800, color: P.ink3, letterSpacing: "0.04em", margin: "22px 0 8px" }}>
            גישה כללית
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 12, padding: 12, borderRadius: 14, border: `1px solid ${P.line}`, background: P.surface }}>
            <span style={{ width: 38, height: 38, borderRadius: "50%", background: P.surface2, color: P.ink2, display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <Icon name="link" size={16} strokeWidth={2} />
            </span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13.5, fontWeight: 700, color: P.ink }}>כל מי שהקישור הזה ברשותו יכול לצפות</div>
              <div style={{ fontSize: 11.5, color: P.ink3, direction: "ltr", textAlign: "right", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{shareUrl}</div>
            </div>
            <button onClick={copyLink} className="tp-press" title={copied ? "הקישור הועתק" : "העתקת קישור"}
              style={{ flexShrink: 0, display: "inline-flex", alignItems: "center", gap: 5, height: 34, padding: "0 12px", borderRadius: 999, border: `1px solid ${P.line}`, background: P.panel, color: P.ink2, cursor: "pointer", fontFamily: FONT, fontSize: 12, fontWeight: 700 }}>
              <Icon name={copied ? "check" : "copy"} size={13} strokeWidth={2.2} />
              {copied ? "הועתק" : "העתקה"}
            </button>
          </div>
        </div>

        {/* Footer */}
        <div style={{ flexShrink: 0, padding: "12px 18px", borderTop: `1px solid ${P.line}`, background: P.panel }}>
          <button onClick={onClose} className="tp-press"
            style={{ width: "100%", height: 48, borderRadius: 999, border: "none", background: P.ink, color: P.panel, fontSize: 15, fontWeight: 800, cursor: "pointer", fontFamily: FONT }}>
            סיום
          </button>
        </div>
      </div>
    </div>
  );
};

export default SharePermissionsModal;
