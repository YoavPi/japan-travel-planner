import React, { useMemo, useRef, useState } from "react";
import { useDarkMode } from "../utils/theme";   // theme.js exports both `useDarkMode` (named) and default
import { buildFileGroups, fileKind, fileEmoji, humanSize } from "../utils/tripFiles";
import { isAllowedFile } from "../services/attachmentService";
import AttachmentViewer from "./AttachmentViewer";

const MAX_BYTES = 15 * 1024 * 1024;
const ACCEPT = "application/pdf,image/*,.pdf,.png,.jpg,.jpeg,.heic,.docx,.xlsx,.txt";

/* Trip Files gallery — every file in the trip (general + per-stop),
   grouped כללי → יום 1 … יום N. Upload / rename / move / delete when
   `editable`; open-only otherwise. */
export default function TripFilesSheet({
  open, onClose, tripData, files, dayCount, editable, busy,
  onUpload, onRename, onMove, onDelete,
}) {
  const { dark } = useDarkMode();
  const inputRef = useRef(null);
  const [pendingDay, setPendingDay] = useState(undefined); // undefined = picker not shown
  const [showPicker, setShowPicker] = useState(false);
  const [err, setErr] = useState("");
  const [renaming, setRenaming] = useState(null);   // FileRow
  const [menuFor, setMenuFor] = useState(null);     // FileRow
  const [viewing, setViewing] = useState(null);     // FileRow

  const groups = useMemo(() => buildFileGroups(tripData, files), [tripData, files]);

  if (!open) return null;

  const P = dark
    ? { sheet: "#15171C", ink: "#F4F5F7", ink2: "#B9BEC7", line: "#2A2E37", row: "#1C1F26", accent: "#E0533F" }
    : { sheet: "#FFFFFF", ink: "#1E1E24", ink2: "#6B7280", line: "#E7E8EC", row: "#F7F8FA", accent: "#E0533F" };

  const totalCount = groups.reduce((n, g) => n + g.items.length, 0);
  const dayNums = Array.from({ length: Math.max(0, dayCount || 0) }, (_, i) => i + 1);

  const pickFile = (day) => {
    setErr("");
    setShowPicker(false);
    setPendingDay(day);
    if (inputRef.current) { inputRef.current.value = ""; inputRef.current.click(); }
  };

  const onPicked = (e) => {
    const f = e.target.files && e.target.files[0];
    if (!f) return;
    if (!isAllowedFile(f)) { setErr("סוג קובץ לא נתמך. אפשר PDF, תמונה, Word, Excel או טקסט."); return; }
    if (f.size > MAX_BYTES) { setErr("הקובץ גדול מדי (עד 15MB)."); return; }
    onUpload(f, pendingDay === undefined ? null : pendingDay);
    setPendingDay(undefined);
  };

  const commitRename = (row, value) => {
    const v = (value || "").trim();
    if (v && v !== row.label) onRename(row, v);
    setRenaming(null);
  };

  return (
    <div dir="rtl" style={{ position: "fixed", inset: 0, zIndex: 380, display: "flex", flexDirection: "column", justifyContent: "flex-end", fontFamily: "inherit" }}>
      <div onClick={onClose} style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.42)" }} />
      <div role="dialog" aria-label="קבצי הטיול" style={{
        position: "relative", background: P.sheet, color: P.ink,
        borderStartStartRadius: 20, borderStartEndRadius: 20, maxHeight: "85vh",
        display: "flex", flexDirection: "column", boxShadow: "0 -12px 40px rgba(0,0,0,0.3)",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "16px 18px 10px", borderBottom: `1px solid ${P.line}` }}>
          <strong style={{ flex: 1, fontSize: 16 }}>קבצי הטיול{totalCount ? ` · ${totalCount}` : ""}</strong>
          <button onClick={onClose} aria-label="סגירה" style={{ width: 44, height: 44, borderRadius: "50%", border: "none", background: P.row, color: P.ink, fontSize: 16, fontWeight: 800, cursor: "pointer" }}>✕</button>
        </div>

        <div style={{ overflowY: "auto", padding: "12px 18px 22px" }}>
          {editable && (
            <div style={{ position: "relative", marginBottom: 6 }}>
              <button onClick={() => setShowPicker((v) => !v)} disabled={busy}
                aria-haspopup="menu" aria-expanded={showPicker}
                style={{ width: "100%", minHeight: 48, borderRadius: 12, border: `1.5px dashed ${P.accent}`, background: "transparent", color: P.accent, fontSize: 14, fontWeight: 800, cursor: busy ? "default" : "pointer" }}>
                {busy ? "מעלה…" : "➕ הוסף קובץ"}
              </button>
              {showPicker && !busy && (
                <div role="menu" style={{
                  position: "absolute", insetInlineStart: 0, insetInlineEnd: 0, insetBlockStart: 52,
                  background: P.sheet, border: `1px solid ${P.line}`, borderRadius: 12,
                  boxShadow: "0 10px 30px rgba(0,0,0,0.25)", padding: 6, zIndex: 3,
                  maxHeight: 260, overflowY: "auto",
                }}>
                  <div style={{ fontSize: 11, color: P.ink2, padding: "4px 10px" }}>הוסף אל…</div>
                  <button onClick={() => pickFile(null)} style={menuItem(P)}>כללי</button>
                  {dayNums.map((d) => (
                    <button key={d} onClick={() => pickFile(d)} style={menuItem(P)}>{`יום ${d}`}</button>
                  ))}
                </div>
              )}
            </div>
          )}
          {err && <div role="alert" style={{ color: P.accent, fontSize: 12.5, fontWeight: 700, margin: "4px 2px 8px" }}>{err}</div>}
          <input ref={inputRef} data-testid="trip-files-input" type="file" accept={ACCEPT} style={{ display: "none" }} onChange={onPicked} />

          {groups.map((g) => (
            (g.items.length > 0 || g.key === "general") && (
              <section key={g.key} style={{ marginTop: 16 }}>
                <h3 style={{ fontSize: 12.5, fontWeight: 800, color: P.ink2, margin: "0 0 8px" }}>
                  {g.day == null ? g.title : <>יום <span>{g.day}</span></>}
                </h3>
                {g.items.length === 0 && (
                  <div style={{ fontSize: 12.5, color: P.ink2, padding: "8px 2px" }}>אין עדיין קבצים כלליים.</div>
                )}
                {g.items.map((row) => {
                  const kind = fileKind(row.type, row.name);
                  const key = row.kind === "general" ? row.id : `${row.dayNum}:${row.stopIdx}:${row.fi}`;
                  return (
                    <div key={key} style={{ position: "relative", display: "flex", alignItems: "center", gap: 10, background: P.row, borderRadius: 12, padding: "10px 12px", marginBottom: 8, minHeight: 56 }}>
                      <span aria-hidden style={{ fontSize: 20 }}>{fileEmoji(kind)}</span>
                      <button onClick={() => setViewing(row)} style={{ flex: 1, minWidth: 0, textAlign: "start", border: "none", background: "transparent", color: P.ink, cursor: "pointer", fontFamily: "inherit", padding: 0 }}>
                        {renaming && renaming._k === key ? (
                          <input autoFocus defaultValue={row.label}
                            onClick={(e) => e.stopPropagation()}
                            onBlur={(e) => commitRename(row, e.target.value)}
                            onKeyDown={(e) => { if (e.key === "Enter") commitRename(row, e.currentTarget.value); if (e.key === "Escape") setRenaming(null); }}
                            style={{ width: "100%", font: "inherit", fontWeight: 700, color: P.ink, background: P.sheet, border: `1px solid ${P.line}`, borderRadius: 8, padding: "6px 8px" }} />
                        ) : (
                          <>
                            <div dir="auto" style={{ fontSize: 13.5, fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{row.label}</div>
                            <div style={{ fontSize: 11.5, color: P.ink2 }}>
                              {humanSize(row.size)}{row.persisted === false ? " · לא נשמר — מצב הדגמה" : ""}
                              {row.kind === "stop" && row.stopName ? ` · ${row.stopName}` : ""}
                            </div>
                          </>
                        )}
                      </button>

                      {editable && (
                        <button aria-label={`שנה שם ל-${row.label}`} title="שנה שם"
                          onClick={() => setRenaming({ ...row, _k: key })}
                          style={{ width: 44, height: 44, border: "none", background: "transparent", color: P.ink2, fontSize: 15, cursor: "pointer" }}>✏️</button>
                      )}
                      {editable && (
                        <button aria-label={`פעולות עבור ${row.label}`} title="פעולות"
                          onClick={() => setMenuFor(menuFor && menuFor._k === key ? null : { ...row, _k: key })}
                          style={{ width: 44, height: 44, border: "none", background: "transparent", color: P.ink2, fontSize: 18, cursor: "pointer" }}>⋯</button>
                      )}

                      {menuFor && menuFor._k === key && (
                        <div role="menu" style={{ position: "absolute", insetInlineEnd: 8, insetBlockStart: 48, maxHeight: 260, overflowY: "auto", background: P.sheet, border: `1px solid ${P.line}`, borderRadius: 12, boxShadow: "0 10px 30px rgba(0,0,0,0.25)", padding: 6, zIndex: 2 }}>
                          {row.kind === "general" && (
                            <>
                              <div style={{ fontSize: 11, color: P.ink2, padding: "4px 10px" }}>העבר ל…</div>
                              <button onClick={() => { onMove(row, null); setMenuFor(null); }} style={menuItem(P)}>כללי</button>
                              {dayNums.map((d) => (
                                <button key={d} onClick={() => { onMove(row, d); setMenuFor(null); }} style={menuItem(P)}>{`יום ${d}`}</button>
                              ))}
                              <div style={{ height: 1, background: P.line, margin: "6px 0" }} />
                            </>
                          )}
                          <button onClick={() => { onDelete(row); setMenuFor(null); }} style={{ ...menuItem(P), color: P.accent }}>מחק</button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </section>
            )
          ))}
        </div>
      </div>

      {viewing && (
        <AttachmentViewer
          file={viewing}
          onClose={() => setViewing(null)}
          onDelete={editable ? () => { onDelete(viewing); setViewing(null); } : undefined}
        />
      )}
    </div>
  );
}

const menuItem = (P) => ({
  display: "block", width: "100%", textAlign: "start", minHeight: 44, padding: "0 12px",
  border: "none", background: "transparent", color: P.ink, fontFamily: "inherit",
  fontSize: 13, fontWeight: 700, cursor: "pointer", borderRadius: 8,
});
