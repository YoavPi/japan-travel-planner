import React from "react";

/* ══════════════════════════════════════════════════════════════
   AttachmentViewer — full-screen in-app file viewer.

   Blob + public URLs render inline in <img>/<iframe> (window.open is
   unreliable on iOS/Safari). Non-previewable types fall back to a
   download link. Adapted from the Sprint 65 inline editor modal so
   the Trip Files gallery + trip overview can share one viewer.
   ══════════════════════════════════════════════════════════════ */

export default function AttachmentViewer({ file, onClose, onDelete }) {
  if (!file || !file.url) return null;

  const title = file.label || file.name || "מסמך מצורף";
  const isPdf = /pdf/i.test(file.type || "") || /\.pdf($|\?)/i.test(file.url || "");
  const isImg = /^image\//i.test(file.type || "")
    || /\.(png|jpe?g|gif|webp|heic|heif)($|\?)/i.test(file.url || "");

  return (
    <div dir="rtl" style={{
      position: "fixed", inset: 0, zIndex: 400, display: "flex", flexDirection: "column",
      background: "rgba(10,12,15,0.92)",
      paddingTop: "env(safe-area-inset-top, 0px)", paddingBottom: "env(safe-area-inset-bottom, 0px)",
    }}>
      <div style={{ flexShrink: 0, display: "flex", alignItems: "center", gap: 10, padding: "12px 14px" }}>
        <span aria-hidden style={{ fontSize: 18 }}>📎</span>
        <div dir="auto" style={{ flex: 1, minWidth: 0, fontSize: 14, fontWeight: 800, color: "#fff", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{title}</div>
        {typeof onDelete === "function" && (
          <button onClick={onDelete} aria-label="מחק קובץ" title="מחק קובץ" className="tp-press"
            style={{ flexShrink: 0, minHeight: 44, padding: "0 14px", borderRadius: 999, border: "none", background: "rgba(255,255,255,0.14)", color: "#fff", cursor: "pointer", fontFamily: "inherit", fontSize: 12.5, fontWeight: 800, display: "inline-flex", alignItems: "center", gap: 5 }}>
            <span aria-hidden>🗑️</span> מחק
          </button>
        )}
        <button onClick={onClose} aria-label="סגירה" title="סגירה" className="tp-press"
          style={{ flexShrink: 0, width: 44, height: 44, borderRadius: "50%", border: "none", background: "#fff", color: "#1E1E24", cursor: "pointer", fontFamily: "inherit", fontSize: 16, fontWeight: 800, display: "inline-flex", alignItems: "center", justifyContent: "center" }}>✕</button>
      </div>
      <div style={{ flex: 1, minHeight: 0, display: "flex", alignItems: "center", justifyContent: "center", padding: "0 10px 12px" }}>
        {isImg ? (
          <img src={file.url} alt={title} style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain", borderRadius: 10 }} />
        ) : isPdf ? (
          <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", gap: 8 }}>
            <iframe src={file.url} title={title} style={{ flex: 1, minHeight: 0, width: "100%", border: "none", borderRadius: 10, background: "#fff" }} />
            <a href={file.url} target="_blank" rel="noopener noreferrer"
              style={{ flexShrink: 0, alignSelf: "center", minHeight: 40, lineHeight: "40px", padding: "0 16px", borderRadius: 10, background: "rgba(255,255,255,0.14)", color: "#fff", fontSize: 12.5, fontWeight: 800, textDecoration: "none" }}>
              נפתח בעמוד נפרד? פתח/הורד ↗
            </a>
          </div>
        ) : (
          <div style={{ textAlign: "center", color: "#fff", padding: 24 }}>
            <div style={{ fontSize: 40, marginBottom: 10 }}>📄</div>
            <div style={{ fontSize: 13.5, opacity: 0.85, lineHeight: 1.6 }}>לא ניתן להציג את סוג הקובץ הזה כאן.</div>
            <a href={file.url} download={file.name || undefined}
              style={{ display: "inline-block", marginTop: 14, minHeight: 44, lineHeight: "44px", padding: "0 18px", borderRadius: 12, background: "#fff", color: "#1E1E24", fontSize: 14, fontWeight: 800, textDecoration: "none" }}>הורדת הקובץ</a>
          </div>
        )}
      </div>
    </div>
  );
}
