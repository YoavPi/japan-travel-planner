/* ══════════════════════════════════════════════════════════════
   tripFiles — pure helpers for the Trip Files gallery.

   General ("כללי") files live at trip.data.files[]. Per-stop files
   stay at day.attractions[].attachments[] (Sprint 61/65). This module
   only transforms plain data — no React, no Supabase.
   ══════════════════════════════════════════════════════════════ */

export function newFileId() {
  return "f_" + Math.random().toString(36).slice(2, 8).padEnd(6, "0").slice(0, 6);
}

const EXT_KIND = { pdf: "pdf", png: "image", jpg: "image", jpeg: "image", gif: "image", webp: "image", heic: "image", heif: "image", doc: "doc", docx: "doc", xls: "sheet", xlsx: "sheet", csv: "sheet", txt: "text" };

export function fileKind(mime, name) {
  const m = (mime || "").toLowerCase();
  if (m.includes("pdf")) return "pdf";
  if (m.startsWith("image/")) return "image";
  if (m.includes("wordprocessingml") || m === "application/msword") return "doc";
  if (m.includes("spreadsheetml") || m === "application/vnd.ms-excel") return "sheet";
  if (m === "text/plain") return "text";
  const ext = (name || "").split(".").pop().toLowerCase();
  return EXT_KIND[ext] || "other";
}

export function fileEmoji(kind) {
  return { pdf: "📄", image: "🖼️", doc: "📝", sheet: "📊", text: "📃", other: "📎" }[kind] || "📎";
}

export function humanSize(bytes) {
  if (!Number.isFinite(bytes)) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function addGeneralFile(data, meta) {
  const d = data || {};
  return { ...d, files: [...(d.files || []), meta] };
}

export function updateGeneralFile(data, id, patch) {
  const d = data || {};
  if (!(d.files || []).some((f) => f.id === id)) return data;
  return { ...d, files: d.files.map((f) => (f.id === id ? { ...f, ...patch } : f)) };
}

export function removeGeneralFile(data, id) {
  const d = data || {};
  return { ...d, files: (d.files || []).filter((f) => f.id !== id) };
}

/* Keep general files' `day` valid after the trip's days are renumbered.
   `mapping` maps an OLD day number to its NEW one (or null if that day
   was removed). Files with day===null are untouched; a file whose day
   is removed or now exceeds the trip length falls back to null (כללי). */
export function remapFileDays(files, mapping, newDayCount) {
  return (files || []).map((f) => {
    if (f.day == null) return f;
    const next = mapping[f.day];
    if (next == null || next > newDayCount) return { ...f, day: null };
    return next === f.day ? f : { ...f, day: next };
  });
}

export function renameStopAttachment(tripData, dayNum, stopIdx, fi, label) {
  const clean = (label || "").trim();
  return (tripData || []).map((d) => {
    if (d.day !== dayNum) return d;
    return {
      ...d,
      attractions: d.attractions.map((a, i) => {
        if (i !== stopIdx || !Array.isArray(a.attachments)) return a;
        return {
          ...a,
          attachments: a.attachments.map((f, k) =>
            k === fi ? { ...f, label: clean || undefined } : f),
        };
      }),
    };
  });
}

const labelOf = (e) => e.label || e.name || "קובץ";

export function buildFileGroups(tripData, files) {
  const byDay = new Map(); // dayNum -> FileRow[]
  const general = [];

  (files || []).forEach((f) => {
    const row = {
      kind: "general",
      id: f.id, label: labelOf(f), name: f.name, type: f.type,
      url: f.url, path: f.path, size: f.size, persisted: f.persisted, day: f.day ?? null,
    };
    if (row.day == null) general.push(row);
    else { if (!byDay.has(row.day)) byDay.set(row.day, []); byDay.get(row.day).push(row); }
  });

  (tripData || []).forEach((d) => {
    (d.attractions || []).forEach((a, stopIdx) => {
      (a.attachments || []).forEach((f, fi) => {
        if (!byDay.has(d.day)) byDay.set(d.day, []);
        byDay.get(d.day).push({
          kind: "stop",
          dayNum: d.day, stopIdx, fi,
          label: labelOf(f), name: f.name, type: f.type,
          url: f.url, path: f.path, size: f.size, persisted: f.persisted,
          stopName: a.nameHe || a.name || "",
        });
      });
    });
  });

  const groups = [{ key: "general", title: "כללי", day: null, items: general }];
  [...byDay.keys()].sort((a, b) => a - b).forEach((day) => {
    groups.push({ key: `day-${day}`, title: `יום ${day}`, day, items: byDay.get(day) });
  });
  return groups;
}
