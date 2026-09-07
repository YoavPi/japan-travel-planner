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
/* Two hero sources. `hero-editor` is a landscape product screenshot
   (the /map/edit UI) and gets a wider ladder; `hero_couple_fuji` is the
   portrait founders photo, kept for Fold 3's origin note. */
const SOURCES = [
  { src: "public/photos/home/hero-editor.jpg",       prefix: "hero-editor", widths: [480, 720, 1100, 1600] },
  { src: "public/photos/home/hero_couple_fuji.png",  prefix: "hero",        widths: [480, 720, 1026] },
];
const OUT = join(ROOT, "public/photos/home/derived");
const QUALITY = "70";



const dim = (file, key) =>
  Number(
    execFileSync("sips", ["-g", key, file], { encoding: "utf8" })
      .trim().split(/\s+/).pop()
  );

mkdirSync(OUT, { recursive: true });

let total = 0;
for (const { src, prefix, widths } of SOURCES) {
  const abs = join(ROOT, src);
  if (!existsSync(abs)) { console.log(`skip    ${src} — not present`); continue; }
  const srcW = dim(abs, "pixelWidth"), srcH = dim(abs, "pixelHeight");
  console.log(`\nsource  ${src}  ${srcW}×${srcH}  ${(statSync(abs).size / 1048576).toFixed(2)} MB`);
  const orphan = new RegExp(`^${prefix}-\\d+\\.jpg$`);
  for (const f of readdirSync(OUT)) if (orphan.test(f)) unlinkSync(join(OUT, f));
  for (const w of widths) {
    if (w > srcW) { console.log(`  skip  ${w}w — would upscale`); continue; }
    const out = join(OUT, `${prefix}-${w}.jpg`);
    execFileSync("sips", ["--resampleWidth", String(w), "-s", "format", "jpeg", "-s", "formatOptions", QUALITY, abs, "--out", out], { stdio: "ignore" });
    const b = statSync(out).size; total += b;
    console.log(`  built ${prefix}-${w}.jpg  ${dim(out, "pixelWidth")}×${dim(out, "pixelHeight")}  ${(b / 1024).toFixed(0)} KB`);
  }
}
console.log(`\ntotal   ${(total / 1024).toFixed(0)} KB. No AVIF/WebP — no encoder on this machine (see header).`);
