#!/usr/bin/env node
/* ══════════════════════════════════════════════════════════════════════
   deploy.mjs — ship the current working tree to production on Vercel.

   Runs as the middle step of `npm run deploy`
   (preflight → THIS → verify:prod).

   Why a wrapper instead of a plain `npx vercel deploy --prod`:
   this project's Vercel setup returns a spurious `{"message":"Not
   authorized"}` (exit non-zero) on the FIRST `vercel deploy` call even
   though `vercel whoami` is fine — a retry clears it. So we retry a few
   times before giving up.
   ══════════════════════════════════════════════════════════════════════ */
import { spawnSync } from "node:child_process";

const ATTEMPTS = 3;

for (let i = 1; i <= ATTEMPTS; i++) {
  const r = spawnSync("npx", ["vercel", "deploy", "--prod", "--yes"], { stdio: "inherit" });
  if (r.status === 0) process.exit(0);
  if (i === ATTEMPTS) {
    console.error(`\n✗ vercel deploy failed after ${ATTEMPTS} attempts.`);
    console.error("  If it says 'Not authorized', check `npx vercel whoami` / `vercel login`.");
    process.exit(r.status || 1);
  }
  console.error(`\n… attempt ${i}/${ATTEMPTS} failed (often the spurious 'Not authorized') — retrying…\n`);
}
