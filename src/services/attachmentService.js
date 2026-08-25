import { supabase, isSupabaseEnabled } from "../lib/supabase";

/* ══════════════════════════════════════════════════════════════
   attachmentService — Sprint 61 #7.

   Attach confirmation files (PDFs, vouchers, images) to itinerary
   stops. When Supabase is configured the file is uploaded to the
   `trip-attachments` Storage bucket and a durable public URL is
   returned. Without Supabase (local/demo mode) we fall back to an
   in-session object URL so the picker + pill + viewer still work
   end-to-end — the file simply isn't persisted across reloads.

   Return shape (stored on stop.attachments[]):
     { name, type, url, size, persisted }
   ══════════════════════════════════════════════════════════════ */

const BUCKET = "trip-attachments";
const MAX_BYTES = 15 * 1024 * 1024; // 15MB guard

export function isAttachmentPersistenceEnabled() {
  return isSupabaseEnabled();
}

/* Upload a picked File. `tripId` scopes the storage path. When Supabase is
   enabled, any upload failure THROWS — callers must not persist a dead
   blob URL. Only in local/demo mode (no Supabase) do we degrade to a
   session object URL. */
export async function uploadAttachment(tripId, file) {
  if (!file) throw new Error("no file");
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

const attachmentService = { uploadAttachment, isAttachmentPersistenceEnabled };
export default attachmentService;
