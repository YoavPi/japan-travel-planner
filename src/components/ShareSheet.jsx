import React, { useMemo, useState } from "react";
import tripService from "../services/tripService";
import Icon from "./Icon";

/* ══════════════════════════════════════════════════════════════
   ShareSheet — Google-Sheets-style share-by-email (spec §Profile-3).

   Bottom sheet over a dimmed backdrop. Invite people by email with
   an edit/view role, manage existing collaborators' roles, toggle
   general link access, and copy a shareable link. Share state
   (collaborators + linkAccess) persists to the trip via tripService.

   Props:
     trip      { id, title, owner, collaborators[], linkAccess? }
     onClose   ()
   ══════════════════════════════════════════════════════════════ */

const T = {
  ink: "#0D0F11", ink2: "#2A3036", ink3: "#6B7178", ink4: "#A4AAB1",
  line: "rgba(20,20,20,0.08)", surface: "#F6F6F4", accent: "#E0533F",
  nature: "#5A8C5F", natureSoft: "#E4EFE5", natureDeep: "#2B7B71",
  font: "'Noto Sans Hebrew','Inter','Noto Sans JP',system-ui,sans-serif",
};

const ROLE_HE = { edit: "עריכה", view: "צפייה" };

const initials = (name = "") => name.trim().slice(0, 1) || "?";

const Avatar = ({ name, avatar }) =>
  avatar ? (
    <img src={avatar} alt="" style={{ width: 40, height: 40, borderRadius: "50%", objectFit: "cover" }} />
  ) : (
    <div style={{ width: 40, height: 40, borderRadius: "50%", background: T.surface, color: T.ink2, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 15, fontWeight: 800 }}>
      {initials(name)}
    </div>
  );

const ShareSheet = ({ trip, onClose }) => {
  const owner = trip.owner || { name: "בעלים", email: "" };
  const [people, setPeople] = useState(() => trip.collaborators || []);
  const [linkAccess, setLinkAccess] = useState(() => trip.linkAccess || { mode: "restricted", role: "view" });
  const [email, setEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("edit");
  const [showPop, setShowPop] = useState(false);
  const [copied, setCopied] = useState(false);

  const shareUrl = useMemo(
    () => `${window.location.origin}/map/edit/${trip.id}`,
    [trip.id]
  );

  const persist = (nextPeople, nextLink) => {
    if (trip.readOnly) return;
    tripService.saveTrip(trip.id, { collaborators: nextPeople, linkAccess: nextLink }).catch(() => {});
  };

  const sendInvite = () => {
    const e = email.trim();
    if (!e || !/.+@.+\..+/.test(e)) return;
    const next = [...people, { id: `inv_${Date.now()}`, name: e.split("@")[0], email: e, role: inviteRole, avatar: null }];
    setPeople(next);
    setEmail("");
    persist(next, linkAccess);
  };

  const setRole = (id, role) => {
    if (role === "remove") {
      const next = people.filter((p) => p.id !== id);
      setPeople(next); persist(next, linkAccess); return;
    }
    const next = people.map((p) => (p.id === id ? { ...p, role } : p));
    setPeople(next); persist(next, linkAccess);
  };

  const toggleLinkMode = () => {
    const next = { ...linkAccess, mode: linkAccess.mode === "anyone" ? "restricted" : "anyone" };
    setLinkAccess(next); persist(people, next);
  };
  const toggleLinkRole = () => {
    const next = { ...linkAccess, role: linkAccess.role === "view" ? "edit" : "view" };
    setLinkAccess(next); persist(people, next);
  };

  const copyLink = async () => {
    try { await navigator.clipboard.writeText(shareUrl); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch { /* noop */ }
  };

  const PersonRow = ({ p, isOwner }) => {
    const [open, setOpen] = useState(false);
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 0" }}>
        <Avatar name={p.name} avatar={p.avatar} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: T.ink }}>{p.name}{isOwner ? " (אתם)" : ""}</div>
          {p.email && <div style={{ fontSize: 12, color: T.ink3, direction: "ltr", textAlign: "right", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{p.email}</div>}
        </div>
        {isOwner ? (
          <span style={{ fontSize: 12.5, color: T.ink3, fontWeight: 600 }}>בעלים</span>
        ) : (
          <div style={{ position: "relative" }}>
            <button onClick={() => setOpen((v) => !v)} style={{ border: `1px solid ${T.line}`, background: "#fff", borderRadius: 999, padding: "5px 10px", fontSize: 12, fontWeight: 600, color: T.ink2, cursor: "pointer", fontFamily: "inherit" }}>
              {ROLE_HE[p.role] || "עריכה"} ▾
            </button>
            {open && (
              <div style={{ position: "absolute", insetInlineEnd: 0, top: "110%", zIndex: 5, background: "#fff", border: `1px solid ${T.line}`, borderRadius: 12, boxShadow: "0 24px 60px rgba(0,0,0,0.16)", minWidth: 150, overflow: "hidden" }}>
                {["edit", "view"].map((r) => (
                  <button key={r} onClick={() => { setRole(p.id, r); setOpen(false); }} style={{ display: "block", width: "100%", textAlign: "right", padding: "10px 12px", border: "none", background: "transparent", cursor: "pointer", fontFamily: "inherit", fontSize: 13, color: T.ink }}>
                    {ROLE_HE[r]}
                  </button>
                ))}
                <button onClick={() => { setRole(p.id, "remove"); setOpen(false); }} style={{ display: "block", width: "100%", textAlign: "right", padding: "10px 12px", border: "none", borderTop: `1px solid ${T.line}`, background: "transparent", cursor: "pointer", fontFamily: "inherit", fontSize: 13, color: "#C0392B" }}>
                  הסרת גישה
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 70, display: "flex", alignItems: "flex-end", fontFamily: T.font }}>
      <div onClick={onClose} style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.35)" }} />
      <div dir="rtl" className="tp-sheet-up" style={{ position: "relative", width: "100%", maxWidth: 560, margin: "0 auto", background: "#fff", borderTopLeftRadius: 22, borderTopRightRadius: 22, maxHeight: "90%", overflowY: "auto", boxShadow: "0 -24px 60px rgba(0,0,0,0.18)", padding: "14px 20px 24px" }}>
        <div style={{ display: "flex", justifyContent: "center", marginBottom: 12 }}>
          <div style={{ width: 44, height: 5, borderRadius: 999, background: "rgba(20,20,20,0.18)" }} />
        </div>

        {/* Header */}
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 16 }}>
          <div>
            <div style={{ fontSize: 11, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.08em", color: T.ink3 }}>שיתוף מסלול</div>
            <h2 style={{ fontSize: 19, fontWeight: 800, color: T.ink, margin: "2px 0 0" }}>{trip.title}</h2>
          </div>
          <button onClick={onClose} aria-label="סגירה" style={{ width: 34, height: 34, borderRadius: "50%", border: "none", background: T.surface, cursor: "pointer", fontFamily: "inherit", color: T.ink2, display: "inline-flex", alignItems: "center", justifyContent: "center" }}><Icon name="x" size={15} strokeWidth={2.2} /></button>
        </div>

        {/* Invite row */}
        <div style={{ display: "flex", gap: 8, position: "relative" }}>
          <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 8, height: 50, padding: "0 12px", borderRadius: 16, border: `1px solid ${T.line}`, background: T.surface }}>
            <span aria-hidden style={{ color: T.ink3, display: "inline-flex" }}><Icon name="mail" size={17} /></span>
            <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="הוסיפו כתובת מייל"
              style={{ flex: 1, border: "none", background: "transparent", fontSize: 16, fontFamily: "inherit", direction: "ltr", textAlign: "right" }} />
            <button onClick={() => setShowPop((v) => !v)} style={{ border: "none", background: "transparent", fontSize: 12.5, fontWeight: 700, color: T.ink2, cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap" }}>
              {ROLE_HE[inviteRole]} ▾
            </button>
          </div>
          <button onClick={sendInvite} aria-label="שליחת הזמנה" style={{ width: 50, height: 50, borderRadius: 16, border: "none", background: T.ink, color: "#fff", cursor: "pointer", fontFamily: "inherit", display: "inline-flex", alignItems: "center", justifyContent: "center" }}><Icon name="chevronStart" size={18} strokeWidth={2.2} /></button>

          {showPop && (
            <div style={{ position: "absolute", insetInlineEnd: 58, top: 54, zIndex: 5, background: "#fff", border: `1px solid ${T.line}`, borderRadius: 14, boxShadow: "0 24px 60px rgba(0,0,0,0.16)", width: 260, overflow: "hidden" }}>
              {[
                { r: "edit", t: "יכול לערוך", s: "להוסיף תחנות, לשנות ולסדר ימים" },
                { r: "view", t: "יכול לצפות", s: "לראות את המסלול בלבד, בלי לערוך" },
              ].map((o) => (
                <button key={o.r} onClick={() => { setInviteRole(o.r); setShowPop(false); }} style={{ display: "flex", gap: 8, alignItems: "flex-start", width: "100%", textAlign: "right", padding: "11px 12px", border: "none", background: "transparent", cursor: "pointer", fontFamily: "inherit" }}>
                  <span style={{ width: 18, color: T.accent, display: "inline-flex", alignItems: "center", justifyContent: "center" }}>{inviteRole === o.r ? <Icon name="check" size={14} strokeWidth={2.4} /> : null}</span>
                  <span>
                    <span style={{ display: "block", fontSize: 13.5, fontWeight: 700, color: T.ink }}>{o.t}</span>
                    <span style={{ display: "block", fontSize: 11.5, color: T.ink3 }}>{o.s}</span>
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
        <div style={{ fontSize: 12, color: T.ink3, margin: "8px 2px 18px" }}>
          המוזמנים יקבלו מייל עם קישור למסלול — בדיוק כמו ב־Google Sheets.
        </div>

        {/* People with access */}
        <div style={{ fontSize: 11, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.08em", color: T.ink3, marginBottom: 4 }}>בעלי גישה</div>
        <PersonRow p={{ ...owner, id: "owner" }} isOwner />
        {people.map((p) => <PersonRow key={p.id} p={p} />)}

        {/* General link access */}
        <div style={{ fontSize: 11, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.08em", color: T.ink3, margin: "18px 0 8px" }}>גישה כללית</div>
        <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", borderRadius: 16, background: T.surface }}>
          <span aria-hidden style={{ color: T.ink2, display: "inline-flex" }}><Icon name="link" size={18} /></span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <button onClick={toggleLinkMode} style={{ border: "none", background: "transparent", padding: 0, cursor: "pointer", fontFamily: "inherit", fontSize: 13.5, fontWeight: 700, color: T.ink }}>
              {linkAccess.mode === "anyone" ? "כל מי שיש לו קישור" : "מוגבל"} ▾
            </button>
            <div style={{ fontSize: 11.5, color: T.ink3 }}>
              {linkAccess.mode === "anyone" ? "כל אדם עם הקישור יכול לפתוח את המסלול" : "רק אנשים שהוזמנו יכולים לפתוח"}
            </div>
          </div>
          {linkAccess.mode === "anyone" && (
            <button onClick={toggleLinkRole} style={{ border: `1px solid ${T.line}`, background: "#fff", borderRadius: 999, padding: "5px 10px", fontSize: 12, fontWeight: 600, color: T.ink2, cursor: "pointer", fontFamily: "inherit" }}>
              {ROLE_HE[linkAccess.role]} ▾
            </button>
          )}
        </div>

        {/* Footer */}
        <div style={{ display: "flex", gap: 10, marginTop: 18 }}>
          <button onClick={copyLink} style={{ flex: 1, height: 50, borderRadius: 999, border: `1px solid ${T.line}`, background: "#fff", color: T.ink, fontSize: 14, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
            {copied ? (<><Icon name="check" size={15} strokeWidth={2.4} /> הקישור הועתק</>) : (<><Icon name="copy" size={15} /> העתקת קישור</>)}
          </button>
          <button onClick={onClose} style={{ flex: 1, height: 50, borderRadius: 999, border: "none", background: T.ink, color: "#fff", fontSize: 14, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
            סיום
          </button>
        </div>
      </div>
    </div>
  );
};

export default ShareSheet;
