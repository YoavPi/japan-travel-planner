import { createClient } from "@supabase/supabase-js";

/* ══════════════════════════════════════════════════════════════
   supabase — the single shared Supabase client (Sprint 26).

   Credentials come from .env (REACT_APP_SUPABASE_URL /
   REACT_APP_SUPABASE_ANON_KEY). When either is missing the export
   is null and isSupabaseEnabled() returns false, so every caller
   (authService, tripService, savedPlaces) degrades gracefully to
   its local/mock path instead of crashing — the app stays fully
   usable before the backend is provisioned.
   ══════════════════════════════════════════════════════════════ */

const SUPABASE_URL = process.env.REACT_APP_SUPABASE_URL || "";
const SUPABASE_ANON_KEY = process.env.REACT_APP_SUPABASE_ANON_KEY || "";

export const isSupabaseEnabled = () => !!(SUPABASE_URL && SUPABASE_ANON_KEY);

export const supabase = isSupabaseEnabled()
  ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true, // completes the OAuth redirect handshake
      },
    })
  : null;

/* Synchronous-ish helper: the current Supabase auth user (or null).
   Callers that need to branch supabase-vs-local await this once. */
export async function getSupabaseUser() {
  if (!supabase) return null;
  try {
    const { data } = await supabase.auth.getSession();
    return data?.session?.user || null;
  } catch {
    return null;
  }
}

export default supabase;
