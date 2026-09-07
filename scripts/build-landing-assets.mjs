#!/usr/bin/env node
/* ══════════════════════════════════════════════════════════════
   build-landing-assets.mjs — responsive derivatives for the
   landing hero.

   Why: the source (`public/photos/home/hero_couple_fuji.png`) is a
   2.2 MB PNG and it is the LCP element on a Hebrew, mobile-heavy
   audience. Shipping it raw is not acceptable.

   Follows the repo's documented "no extra deps" precedent
   (src/brand/README.md): macOS `sips` only.

   LIMITATION, stated rather than hidden: this machine has no
   `cwebp` / `avifenc` / ImageMagick, and `sips` cannot write WebP
   or AVIF. Output is JPEG only. That still takes the hero from
   2.2 MB to ~100 KB at mobile width. To add AVIF/WebP later:
   `brew install webp libavif`, then add the two encoder loops
   below — `<picture>` in LandingView.jsx is already shaped for
   extra <source> elements.

   The ladder tops out at the SOURCE width (1026px). The design
   spec asked for 1440 and 1920 derivatives; those would be
   upscales of a 1026px original and are deliberately not built.

   Usage:  node scripts/build-landing-assets.mjs
   ══════════════════════════════════════════════════════════════ */
import { execFileSync } from "node:child_process";
import { mkdirSync, existsSync, statSync, readdirSync, unlinkSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SRC = join(ROOT, "public/photos/home/hero_couple_fuji.png");
const OUT = join(ROOT, "public/photos/home/derived");
const WIDTHS = [480, 720, 1026];
const QUALITY = "70";

if (!existsSync(SRC)) {
  console.error(`✗ source not found: ${SRC}`);
  process.exit(1);
}

const dim = (file, key) =>
  Number(
    execFileSync("sips", ["-g", key, file], { encoding: "utf8" })
      .trim().split(/\s+/).pop()
  );

const srcW = dim(SRC, "pixelWidth");
const srcH = dim(SRC, "pixelHeight");
const srcBytes = statSync(SRC).size;
console.log(`source  ${srcW}×${srcH}  ${(srcBytes / 1048576).toFixed(2)} MB`);

mkdirSync(OUT, { recursive: true });
/* Rebuild from scratch so a narrowed WIDTHS list never leaves orphans
   behind that srcset still references. */
for (const f of readdirSync(OUT)) if (f.startsWith("hero-")) unlinkSync(join(OUT, f));

let total = 0;
for (const w of WIDTHS) {
  if (w > srcW) { console.log(`skip    ${w}w — wider than the source, would upscale`); continue; }
  const out = join(OUT, `hero-${w}.jpg`);
  execFileSync("sips", [
    "--resampleWidth", String(w),
    "-s", "format", "jpeg",
    "-s", "formatOptions", QUALITY,
    SRC, "--out", out,
  ], { stdio: "ignore" });
  const b = statSync(out).size;
  total += b;
  console.log(`built   hero-${w}.jpg  ${dim(out, "pixelWidth")}×${dim(out, "pixelHeight")}  ${(b / 1024).toFixed(0)} KB`);
}

console.log(`\ntotal   ${(total / 1024).toFixed(0)} KB across ${WIDTHS.filter((w) => w <= srcW).length} derivatives`);
console.log(`saving  ${((1 - total / srcBytes) * 100).toFixed(0)}% vs shipping the raw PNG once`);
console.log(`\nnote    no AVIF/WebP — no encoder on this machine. See the header comment.`);
