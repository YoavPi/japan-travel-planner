import React, { useRef, useState } from "react";
import { COVER_EMOJIS, coverIsEmoji, coverEmoji } from "../utils/gallery";
import { uploadAttachment } from "../services/attachmentService";

/* ══════════════════════════════════════════════════════════════
   CoverPicker — pick a trip cover: an emoji from the curated set,
   or an uploaded image.

   Props:
     value  — current cover: "emoji:<x>" or an image URL
     tripId — scopes the uploaded attachment's storage path
     onChange(cover) — called with the new cover value
   ══════════════════════════════════════════════════════════════ */

const T = {
  bg: "#FFFFFF",
  ink: "#0D0F11",
  ink2: "#2A3036",
  ink3: "#6B7178",
  line: "rgba(20,20,20,0.09)",
  accent: "#E0533F",
  surface: "#F6F6F4",
  font: "'Noto Sans Hebrew','Inter',system-ui,sans-serif",
};

const CoverPicker = ({ value, tripId, onChange }) => {
  const fileInputRef = useRef(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const isEmoji = coverIsEmoji(value);
  const hasImage = !isEmoji && typeof value === "string" && value.trim().length > 0;

  const handlePickFile = () => {
    if (busy) return;
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e) => {
    const file = e.target.files && e.target.files[0];
    e.target.value = "";
    if (!file) return;
    setErr("");
    setBusy(true);
    try {
      const r = await uploadAttachment(tripId, file);
      if (!r || r.persisted === false || !r.url) throw new Error("fail");
      onChange(r.url);
    } catch {
      setErr("ההעלאה נכשלה, נסו שוב");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div dir="rtl" style={{ fontFamily: T.font }}>
      <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 16 }}>
        <div
          style={{
            width: 72,
            height: 72,
            borderRadius: 12,
            flexShrink: 0,
            border: `1px solid ${T.line}`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            overflow: "hidden",
            background: hasImage ? undefined : T.surface,
            backgroundImage: hasImage ? `url(${value})` : undefined,
            backgroundSize: "cover",
            backgroundPosition: "center",
          }}
        >
          {isEmoji ? (
            <span style={{ fontSize: 34, lineHeight: 1 }}>{coverEmoji(value)}</span>
          ) : !hasImage ? (
            <span style={{ fontSize: 22, color: T.ink3 }}>—</span>
          ) : null}
        </div>

        <div>
          <button
            type="button"
            onClick={handlePickFile}
            disabled={busy}
            style={{
              padding: "9px 16px",
              borderRadius: 10,
              border: `1px solid ${T.line}`,
              background: T.bg,
              color: T.ink2,
              fontFamily: "inherit",
              fontSize: 14,
              fontWeight: 700,
              cursor: busy ? "default" : "pointer",
              opacity: busy ? 0.7 : 1,
            }}
          >
            {busy ? "מעלה…" : "העלה תמונה"}
          </button>
          {err ? (
            <div style={{ marginTop: 6, fontSize: 12.5, color: T.accent }}>{err}</div>
          ) : null}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileChange}
            style={{ display: "none" }}
          />
        </div>
      </div>

      <div style={{ fontSize: 13, fontWeight: 700, color: T.ink3, marginBottom: 8 }}>בחר אימוג'י</div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        {COVER_EMOJIS.map((e) => {
          const selected = coverEmoji(value) === e;
          return (
            <button
              key={e}
              type="button"
              onClick={() => onChange("emoji:" + e)}
              style={{
                width: 40,
                height: 40,
                borderRadius: 10,
                border: selected ? `1.5px solid ${T.accent}` : `1px solid ${T.line}`,
                background: selected ? "#E0533F12" : T.bg,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 19,
                cursor: "pointer",
                padding: 0,
              }}
              aria-label={e}
            >
              {e}
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default CoverPicker;
