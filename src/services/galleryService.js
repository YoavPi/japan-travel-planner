import { supabase, getSupabaseUser, isSupabaseEnabled } from "../lib/supabase";
import { rowToTrip } from "./tripService";

/* Owner publishes a map to the public gallery. */
export async function publishToGallery(tripId, { category, description } = {}) {
  if (!isSupabaseEnabled()) throw new Error("Supabase not configured");
  const { data: existing } = await supabase.from("trips").select("published_at").eq("id", tripId).maybeSingle();
  const patch = {
    is_public: true,
    gallery_category: category || null,
    gallery_description: (description || "").trim() || null,
    published_at: existing?.published_at || new Date().toISOString(),
  };
  const { error } = await supabase.from("trips").update(patch).eq("id", tripId);
  if (error) throw new Error(error.message);
}

export async function unpublishFromGallery(tripId) {
  const { error } = await supabase.from("trips").update({ is_public: false }).eq("id", tripId);
  if (error) throw new Error(error.message);
}

/* Public browse. Filters + sort applied server-side; free-text `q` matches
   title OR destination (settings->>destinationHe). */
export async function fetchPublicTrips({ q = "", destination = "", category = "", sort = "popular", limit = 24, offset = 0 } = {}) {
  if (!isSupabaseEnabled()) return [];
  let query = supabase.from("trips").select("*").eq("is_public", true);
  if (category) query = query.eq("gallery_category", category);
  if (destination) query = query.or(`title.ilike.%${destination}%,settings->>destinationHe.ilike.%${destination}%`);
  if (q) query = query.or(`title.ilike.%${q}%,settings->>destinationHe.ilike.%${q}%`);
  query = sort === "new"
    ? query.order("published_at", { ascending: false })
    : query.order("favorites_count", { ascending: false }).order("published_at", { ascending: false });
  query = query.range(offset, offset + limit - 1);
  const { data, error } = await query;
  if (error) { if (typeof console !== "undefined") console.warn("[gallery] fetch failed:", error.message); return []; }
  return (data || []).map(rowToTrip).filter(Boolean);
}

/* One public trip (for the /g/:id viewer). Returns null if not public/found. */
export async function fetchPublicTripById(tripId) {
  if (!isSupabaseEnabled()) return null;
  const { data, error } = await supabase.from("trips").select("*").eq("id", tripId).eq("is_public", true).maybeSingle();
  if (error || !data) return null;
  const trip = rowToTrip(data);
  const me = await getSupabaseUser();
  trip.isOwner = !!(me && data.owner_id && data.owner_id === me.id);
  return trip;
}
