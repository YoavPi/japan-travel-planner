import { supabase, isSupabaseEnabled } from "../lib/supabase";

/* ══════════════════════════════════════════════════════════════
   attachmentService — Sprint 61 #7.

   Attach confirmation files (PDFs, vouchers, images, docx, xlsx, txt)
   to itinerary stops. When Supabase is configured the file is uploaded to the
   `trip-attachments` Storage bucket and a durable public URL is
   returned. Without Supabase (local/demo mode) we fall back to an
   in-session object URL so the picker + pill + viewer still work
   end-to-end — the file simply isn't persisted across reloads.

   Return shape (stored on stop.attachments[]):
     { name, type, url, size, persisted }
   ══════════════════════════════════════════════════════════════ */

const BUCKET = "trip-attachments";
const MAX_BYTES = 15 * 1024 * 1024; // 15MB guard
const ALLOWED_EXT = ["pdf", "png", "jpg", "jpeg", "gif", "webp", "heic", "heif", "docx", "xlsx", "txt"];

export function isAllowedFile(file) {
  if (!file) return false;
  const t = (file.type || "").toLowerCase();
  if (t === "application/pdf") return true;
  if (t.startsWith("image/")) return true;
  if (t === "application/vnd.openxmlformats-officedocument.wordprocessingml.document") return true;
  if (t === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet") return true;
  if (t === "text/plain") return true;
  const ext = (file.name || "").split(".").pop().toLowerCase();
  return ALLOWED_EXT.includes(ext);
}

export function isAttachmentPersistenceEnabled() {
  return isSupabaseEnabled();
}

/* Upload a picked File. `tripId` scopes the storage path. When Supabase is
   enabled, any upload failure THROWS — callers must not persist a dead
   blob URL. Only in local/demo mode (no Supabase) do we degrade to a
   session object URL. */
export async function uploadAttachment(tripId, file) {
  if (!file) throw new Error("no file");
  if (!isAllowedFile(file)) throw new Error("file type not allowed");
  if (file.size > MAX_BYTES) throw new Error("file too large");

  const safeName = (file.name || "attachment").replace(/[^\w.\-()֐-׿ ]+/g, "_");

  if (isSupabaseEnabled()) {
    try {
      const path = `${tripId || "trip"}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${safeName}`;
      const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
        cacheControl: "3600",
        upsert: false,
        contentType: file.type || undefined,
      });
      if (error) throw error;
      const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
      if (!data?.publicUrl) throw new Error("no-public-url");
      return { name: safeName, type: file.type || "", url: data.publicUrl, size: file.size, path, persisted: true };
    } catch {
      throw new Error("upload-failed");
    }
  }

  /* local/demo only (no Supabase): a session object URL, clearly not persisted. */
  const url = URL.createObjectURL(file);
  return { name: safeName, type: file.type || "", url, size: file.size, persisted: false };
}

/* Best-effort permanent delete of a stored object. No-op when the file
   was never persisted (session blob → no path) or Supabase is off. A
   "not found" is treated as success; any other failure rejects so the
   caller can log it. */
export async function removeStoredFile(path) {
  if (!path || !isSupabaseEnabled()) return;
  const { error } = await supabase.storage.from(BUCKET).remove([path]);
  if (error && !/not\s*found/i.test(error.message || "")) throw error;
}

const attachmentService = { uploadAttachment, isAttachmentPersistenceEnabled, isAllowedFile, removeStoredFile };
export default attachmentService;
