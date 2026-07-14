/* ══════════════════════════════════════════════════════════════
   test-supabase-integration.js — Sprint 26 backend verification.

   Standalone Node script (no browser needed). Verifies:
     1. Programmatic auth — signUp / signInWithPassword with a
        deterministic test user (no Google OAuth UI required).
     2. The AuthContext contract — supabase.auth.getSession() +
        an onAuthStateChange SIGNED_IN event (the exact primitives
        src/context/AuthContext.jsx hydrates from).
     3. handle_new_user trigger — public.users has a matching
        profile row for the auth user (read through RLS as self).
     4. trips CRUD — insert/select/update/delete against public.trips
        using the exact row shape tripService writes, plus a
        places_inbox insert/delete. Proves the schema + RLS accept
        the app's real payloads while a session is active.

   Run:  node scripts/test-supabase-integration.js
   ══════════════════════════════════════════════════════════════ */

const fs = require("fs");
const path = require("path");
/* Node 20 has no native WebSocket — polyfill for supabase-js realtime
   (unused by this test, but required at client construction). */
if (typeof globalThis.WebSocket === "undefined") {
  try { globalThis.WebSocket = require("ws"); } catch { /* realtime unused */ }
}
const { createClient } = require("@supabase/supabase-js");

/* ── env ── */
const env = {};
for (const line of fs.readFileSync(path.join(__dirname, "..", ".env"), "utf8").split("\n")) {
  const m = line.match(/^([A-Z_]+[A-Z0-9_]*)=(.*)$/);
  if (m) env[m[1]] = m[2].trim();
}
const URL_ = env.REACT_APP_SUPABASE_URL;
const KEY = env.REACT_APP_SUPABASE_ANON_KEY;

const TEST_EMAIL = "sprint26.tester@gmail.com"; // fixed → reused across runs
const TEST_PASSWORD = "Sprint26!LocalTest";

let pass = 0, fail = 0;
const ok = (label, extra = "") => { pass++; console.log(`  ✅ ${label}${extra ? ` — ${extra}` : ""}`); };
const bad = (label, err) => { fail++; console.log(`  ❌ ${label} — ${err}`); };

(async () => {
  console.log("Sprint 26 · Supabase integration test\n──────────────────────────────────────");
  if (!URL_ || !KEY) { bad("env", "missing REACT_APP_SUPABASE_URL / ANON_KEY in .env"); process.exit(1); }
  console.log("Project:", new URL(URL_).host, "\n");

  const supabase = createClient(URL_, KEY, { auth: { persistSession: false } });

  /* ── 1+2. Auth: sign in (or first-run sign up) + AuthContext contract ── */
  console.log("[1] Programmatic auth");
  let authEvent = null;
  const { data: sub } = supabase.auth.onAuthStateChange((event) => { if (event === "SIGNED_IN") authEvent = event; });

  let session = null;
  let signIn = await supabase.auth.signInWithPassword({ email: TEST_EMAIL, password: TEST_PASSWORD });
  if (signIn.error && /invalid login credentials/i.test(signIn.error.message)) {
    /* First run — register the test user. */
    const signUp = await supabase.auth.signUp({ email: TEST_EMAIL, password: TEST_PASSWORD });
    if (signUp.error) { bad("signUp", signUp.error.message); return finish(supabase, sub); }
    if (!signUp.data.session) {
      bad("signUp session", "user created but no session — 'Confirm email' is ON in Supabase. Disable it (Authentication → Sign In / Up → Email → uncheck 'Confirm email') or confirm the user manually, then re-run.");
      return finish(supabase, sub);
    }
    session = signUp.data.session;
    ok("signUp", `new test user ${TEST_EMAIL}`);
  } else if (signIn.error) {
    bad("signInWithPassword", signIn.error.message + (/(email logins are disabled|not enabled)/i.test(signIn.error.message) ? "  → enable the Email provider (Authentication → Providers → Email)" : ""));
    return finish(supabase, sub);
  } else {
    session = signIn.data.session;
    ok("signInWithPassword", TEST_EMAIL);
  }

  const uid = session.user.id;

  console.log("\n[2] AuthContext contract (getSession + onAuthStateChange)");
  const { data: gs } = await supabase.auth.getSession();
  if (gs?.session?.user?.id === uid) ok("getSession() returns the live session", `user ${uid.slice(0, 8)}…`);
  else bad("getSession()", "no session returned — AuthContext would not hydrate");
  await new Promise((r) => setTimeout(r, 300)); // let the listener flush
  if (authEvent === "SIGNED_IN") ok("onAuthStateChange fired SIGNED_IN", "AuthContext's listener would hydrate the app user");
  else bad("onAuthStateChange", "SIGNED_IN event not observed");

  /* ── 3. handle_new_user trigger → public.users profile row ── */
  console.log("\n[3] public.users profile (handle_new_user trigger)");
  const prof = await supabase.from("users").select("*").eq("id", uid).maybeSingle();
  if (prof.error) bad("users select", prof.error.message);
  else if (prof.data) ok("profile row exists", `email=${prof.data.email}, plan=${prof.data.plan}`);
  else bad("profile row", "no row in public.users — trigger missing? Re-run database-schema.sql (the trigger only fires for users created AFTER it exists).");

  /* ── 4. trips CRUD — the exact row shape tripService writes ── */
  console.log("\n[4] trips CRUD (tripService row contract)");
  const tripId = `trip_test_${Math.random().toString(36).slice(2, 8)}`;
  const row = {
    id: tripId,
    owner_id: uid,
    owner_name: "Sprint26 Tester",
    title: "טיול בדיקה — ספרינט 26",
    cover: null, days: 3, meta: "3 ימים · בדיקה",
    read_only: false, collaborators: [],
    settings: { destination: "Test", destinationHe: "בדיקה", days: 3, cityRanges: [] },
    data: { tripData: [{ day: 1, city: "Test", cityHe: "בדיקה", attractions: [] }], cityTransitions: [], lodgingOverrides: {} },
    last_edited: new Date().toISOString(),
  };
  const ins = await supabase.from("trips").insert(row).select().single();
  if (ins.error) bad("INSERT trips", ins.error.message);
  else ok("INSERT trips", tripId);

  const sel = await supabase.from("trips").select("*").eq("id", tripId).maybeSingle();
  if (sel.error || !sel.data) bad("SELECT trips", sel.error?.message || "row not found");
  else ok("SELECT trips (RLS as owner)", `title="${sel.data.title}"`);

  const upd = await supabase.from("trips").update({ trip_memo: "נכתב מהבדיקה", last_edited: new Date().toISOString() }).eq("id", tripId).select().single();
  if (upd.error) bad("UPDATE trips", upd.error.message);
  else ok("UPDATE trips", `trip_memo="${upd.data.trip_memo}"`);

  const inbox = await supabase.from("places_inbox").insert({
    owner_id: uid, name: "Test Cafe", name_he: "קפה בדיקה", category: "בית קפה",
    rating: "9/10", lat: 25.2, lng: 55.3, source: "takeout",
  }).select().single();
  if (inbox.error) bad("INSERT places_inbox", inbox.error.message);
  else ok("INSERT places_inbox", inbox.data.id.slice(0, 8) + "…");

  /* cleanup */
  const delTrip = await supabase.from("trips").delete().eq("id", tripId);
  if (delTrip.error) bad("DELETE trips (cleanup)", delTrip.error.message);
  else ok("DELETE trips (cleanup)");
  if (inbox.data) {
    const delInbox = await supabase.from("places_inbox").delete().eq("id", inbox.data.id);
    if (delInbox.error) bad("DELETE places_inbox (cleanup)", delInbox.error.message);
    else ok("DELETE places_inbox (cleanup)");
  }

  return finish(supabase, sub);

  async function finish(sb, subscription) {
    subscription?.subscription?.unsubscribe?.();
    await sb.auth.signOut().catch(() => {});
    console.log(`\n──────────────────────────────────────\n${fail === 0 ? "🟢 PASS" : "🔴 FAIL"} — ${pass} passed, ${fail} failed`);
    process.exit(fail === 0 ? 0 : 1);
  }
})().catch((e) => { console.error("UNEXPECTED:", e.message); process.exit(1); });
