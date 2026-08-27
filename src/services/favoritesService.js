import { supabase, getSupabaseUser, isSupabaseEnabled } from "../lib/supabase";
import { rowToTrip } from "./tripService";

const LOCAL_KEY = "tp_favorites_v1";
const MIGRATED_FLAG = "tp_favorites_migrated_v1";

const readLocal = () => { try { return new Set(JSON.parse(localStorage.getItem(LOCAL_KEY) || "[]")); } catch { return new Set(); } };

export async function addFavorite(tripId) {
  const me = await getSupabaseUser();
  if (!me) throw new Error("auth-required");
  const { error } = await supabase
    .from("trip_favorites")
    .upsert({ user_id: me.id, trip_id: tripId }, { onConflict: "user_id,trip_id", ignoreDuplicates: true });
  if (error) throw new Error(error.message);
}
export async function removeFavorite(tripId) {
  const me = await getSupabaseUser();
  if (!me) throw new Error("auth-required");
  const { error } = await supabase.from("trip_favorites").delete().eq("user_id", me.id).eq("trip_id", tripId);
  if (error) throw new Error(error.message);
}
export async function listFavoriteIds() {
  if (!isSupabaseEnabled()) return readLocal();
  const me = await getSupabaseUser();
  if (!me) return new Set();
  const { data } = await supabase.from("trip_favorites").select("trip_id").eq("user_id", me.id);
  return new Set((data || []).map((r) => r.trip_id));
}
export async function listFavoriteTrips() {
  if (!isSupabaseEnabled()) return [];
  const me = await getSupabaseUser();
  if (!me) return [];
  /* Two plain queries instead of a PostgREST embed (`trips(*)`) — the embed
     silently returns nothing if the FK relationship isn't detected / the schema
     cache is stale, which made favorited maps vanish from the "מועדפים" tab.
     1) get the favorited ids (newest first), 2) fetch those trip rows. */
  const { data: favRows, error: favErr } = await supabase
    .from("trip_favorites")
    .select("trip_id, created_at")
    .eq("user_id", me.id)
    .order("created_at", { ascending: false });
  if (favErr || !favRows || favRows.length === 0) return [];
  const ids = favRows.map((r) => r.trip_id);
  const { data: tripRows } = await supabase.from("trips").select("*").in("id", ids);
  if (!tripRows) return [];
  /* Preserve the favorited order (newest-favorited first). */
  const byId = new Map(tripRows.map((t) => [t.id, t]));
  return ids.map((id) => byId.get(id)).filter(Boolean).map(rowToTrip);
}
/* One-time: push any device-local favorites into Supabase, then stop reading local. */
export async function migrateLocalFavorites() {
  if (!isSupabaseEnabled()) return;
  const me = await getSupabaseUser();
  if (!me) return;
  try {
    if (localStorage.getItem(MIGRATED_FLAG)) return;
    const ids = [...readLocal()];
    if (ids.length) {
      await supabase.from("trip_favorites").upsert(ids.map((trip_id) => ({ user_id: me.id, trip_id })));
    }
    localStorage.setItem(MIGRATED_FLAG, "1");
  } catch { /* non-fatal */ }
}
