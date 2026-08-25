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
  "AUTH: Apple/Email do not mock-sign-in on a real backend",
  /* Sign-in is now Google-only: the Apple/Email buttons were removed, which
     eliminates their mock-sign-in path entirely. This passes if those buttons
     are ABSENT (current state) OR — for backward-compat — the old
     supabaseEnabled guard around doOtherProvider is present. */
  (!/המשך עם Apple/.test(view) && !/המשך עם אימייל/.test(view)) ||
    (/doOtherProvider/.test(view) && /supabaseEnabled\s*\)\s*{\s*setAuthErr/.test(view)),
  "With Google-only auth the Apple/Email buttons must be absent; otherwise they must route through a supabaseEnabled guard that blocks the mock."
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

/* ── SUMMARY ── */
const failed = results.filter((r) => !r.ok);
console.log("");
if (failed.length) {
  console.error(`🚨 ${failed.length} CRITICAL CHECK(S) FAILED — do NOT deploy until fixed.`);
  process.exit(1);
}
console.log(`✅ All ${results.length} critical checks passed — safe to deploy.`);
