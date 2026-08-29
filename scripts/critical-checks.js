#!/usr/bin/env node
/* ══════════════════════════════════════════════════════════════════════
   critical-checks.js — the pre-deploy safety gate.

   Run BEFORE every production deploy:  npm run critical

   These are the invariants that, if broken, cause SEVERE user-facing bugs
   (people signing in as the wrong account, prod silently running in demo
   mode, ownership checks bypassed). Each one maps to a real incident or a
   real class of incident. A failure exits non-zero so a broken deploy is
   blocked, not shipped.

   This is a fast, dependency-free static gate (no app boot needed). It is
   complemented by `verify-prod.js`, which checks the LIVE deployed bundle
   after a deploy.
   ══════════════════════════════════════════════════════════════════════ */

const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const read = (p) => {
  try { return fs.readFileSync(path.join(root, p), "utf8"); }
  catch { return ""; }
};

const results = [];
const check = (name, ok, detail) => {
  results.push({ name, ok, detail });
  console.log(`${ok ? "✅" : "❌"} ${name}${!ok && detail ? `\n     ↳ ${detail}` : ""}`);
};

/* ── AUTH IDENTITY (the michali.dmr incident) ──────────────────────────
   A visitor must ALWAYS receive their own identity. The demo mock user
   must be impossible to mint when a real backend is configured. */
const auth = read("src/services/authService.js");
check(
  "AUTH: mock signInWithGoogle is hard-guarded (throws when Supabase enabled)",
  /signInWithGoogle\s*\([^)]*\)\s*{[\s\S]{0,400}?if\s*\(\s*isSupabaseEnabled\(\)\s*\)[\s\S]{0,120}?throw/.test(auth),
  "authService.signInWithGoogle() must `throw` when isSupabaseEnabled(), or every Apple/Email/fallback click signs the user in as the shared MOCK_USER."
);

const ctx = read("src/context/AuthContext.jsx");
check(
  "AUTH: AuthContext does not seed a stale local user when Supabase is the authority",
  /useState\(\s*\(\)\s*=>\s*\(?\s*isSupabaseEnabled\(\)\s*\?\s*null\s*:/.test(ctx),
  "Initial user must be null when isSupabaseEnabled() — never a value from local/sessionStorage."
);
check(
  "AUTH: AuthContext clears the user when there is no Supabase session",
  /else if \(!returningFromOAuth\)\s*{[\s\S]{0,600}?setUser\(null\)/.test(ctx),
  "No live session must resolve to logged-OUT (setUser(null)), not a leftover identity."
);

const view = read("src/views/AuthView.jsx");
check(
  "AUTH: Google-OAuth failure does NOT fall back to the mock identity",
  !/doSupabaseGoogle[\s\S]{0,300}?catch\s*{[\s\S]{0,120}?doSignIn\(\)/.test(view),
  "The Supabase Google catch must surface an error, never call the mock doSignIn()."
);
check(
  "AUTH: email sign-in uses the real magic-link, never the mock",
  /* Sign-in is Google + email-magic-link. The mock doSignIn() must stay
     guarded (returns early when supabaseEnabled). Any email sign-in UI must
     route through signInWithEmailLink (real Supabase OTP), NOT the mock; and
     the legacy Apple button must not exist. */
  !/המשך עם Apple/.test(view) &&
    /doSignIn[\s\S]{0,120}?if\s*\(\s*supabaseEnabled\s*\)/.test(view) &&
    (!/קישור התחברות/.test(view) || /signInWithEmailLink/.test(view)),
  "Email sign-in must call signInWithEmailLink (real magic-link) and the mock doSignIn must remain guarded by supabaseEnabled; no Apple button."
);

/* ── BACKEND WIRING — prod must not silently run in demo mode ───────── */
const sb = read("src/lib/supabase.js");
check(
  "BACKEND: Supabase enablement requires BOTH url and anon key",
  /SUPABASE_URL\s*&&\s*SUPABASE_ANON_KEY/.test(sb),
  "isSupabaseEnabled() must require both env vars."
);

/* ── OWNERSHIP — deletes/edits must be owner-scoped ─────────────────── */
const trip = read("src/services/tripService.js");
check(
  "DATA: tripService references an owner/user scope",
  /owner|user_id|userId|auth\.uid|getUser/.test(trip),
  "Trip reads/writes should be scoped to the signed-in user."
);
check(
  "SHARING: fetchAllTrips excludes non-collaborator public trips",
  /!jsonbCollab\s*&&\s*!collabIds\.has\([^)]*\)\)\s*return null/.test(trip),
  "fetchAllTrips does an unscoped read that RLS's public-read (is_public=true) allows for the gallery. A non-owned row must be dropped unless the user is a real collaborator (collaborators JSONB by email OR trip_collaborators), or every user sees every PUBLIC trip in 'שותפו איתי'."
);

/* ── SUMMARY ── */
const failed = results.filter((r) => !r.ok);
console.log("");
if (failed.length) {
  console.error(`🚨 ${failed.length} CRITICAL CHECK(S) FAILED — do NOT deploy until fixed.`);
  process.exit(1);
}
console.log(`✅ All ${results.length} critical checks passed — safe to deploy.`);
