import { supabase, getSupabaseUser, isSupabaseEnabled } from "../lib/supabase";
import { rowToTrip } from "./tripService";

const LOCAL_KEY = "tp_favorites_v1";
const MIGRATED_FLAG = "tp_favorites_migrated_v1";

const readLocal = () => { try { return new Set(JSON.parse(localStorage.getItem(LOCAL_KEY) || "[]")); } catch { return new Set(); } };

export async function addFavorite(tripId) {
  const me = await getSupabaseUser();
  if (!me) throw new Error("auth-required");
  const { error } = await supabase.from("trip_favorites").upsert({ user_id: me.id, trip_id: tripId });
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
  const { data } = await supabase.from("trip_favorites").select("trip_id, trips(*)").eq("user_id", me.id).order("created_at", { ascending: false });
  return (data || []).map((r) => (r.trips ? rowToTrip(r.trips) : null)).filter(Boolean);
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
