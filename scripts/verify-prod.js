#!/usr/bin/env node
/* ══════════════════════════════════════════════════════════════════════
   verify-prod.js — post-deploy live check of the SHIPPED artifact.

   Run right AFTER a production deploy:  npm run verify:prod
   (override the target with SITE=https://… npm run verify:prod)

   Static source checks (critical-checks.js) can't see what actually
   shipped — the env vars are inlined at build time on Vercel. This
   fetches the LIVE bundle and asserts:
     • Supabase is really wired (a real *.supabase.co URL is present) —
       otherwise prod is silently in demo mode and EVERY sign-in returns
       the shared mock identity.
     • the real OAuth entrypoint (signInWithOAuth) is present.
   Exits non-zero on failure.
   ══════════════════════════════════════════════════════════════════════ */

const https = require("https");

const SITE = (process.env.SITE || "https://maslul-app.vercel.app").replace(/\/$/, "");

const get = (url) =>
  new Promise((resolve, reject) => {
    https.get(url, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return resolve(get(new URL(res.headers.location, url).toString()));
      }
      let body = "";
      res.on("data", (c) => (body += c));
      res.on("end", () => resolve(body));
    }).on("error", reject);
  });

(async () => {
  console.log(`🔎 Verifying live production: ${SITE}`);
  const html = await get(SITE + "/");
  const m = html.match(/\/static\/js\/main\.[a-z0-9]+\.js/);
  if (!m) {
    console.error("❌ Could not find the main JS bundle on the live site.");
    process.exit(1);
  }
  const bundle = await get(SITE + m[0]);

  const fails = [];
  const check = (name, ok, detail) => {
    console.log(`${ok ? "✅" : "❌"} ${name}${!ok && detail ? `\n     ↳ ${detail}` : ""}`);
    if (!ok) fails.push(name);
  };

  check(
    "LIVE: Supabase backend is wired (real *.supabase.co URL in the bundle)",
    /https:\/\/[a-z0-9]+\.supabase\.co/.test(bundle),
    "Prod is running WITHOUT Supabase → demo mode → every sign-in returns the shared mock user. Set REACT_APP_SUPABASE_URL / _ANON_KEY in Vercel."
  );
  check(
    "LIVE: real Google OAuth entrypoint present (signInWithOAuth)",
    /signInWithOAuth/.test(bundle),
    "The real OAuth path is missing from the shipped bundle."
  );

  console.log("");
  if (fails.length) {
    console.error(`🚨 ${fails.length} LIVE CHECK(S) FAILED on ${SITE} — investigate before announcing the deploy.`);
    process.exit(1);
  }
  console.log(`✅ Live production checks passed on ${SITE}.`);
})().catch((e) => {
  console.error("❌ verify-prod failed to run:", e.message);
  process.exit(1);
});
