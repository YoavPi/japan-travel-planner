/* eslint-disable */
/* ═══════════════════════════════════════════════════════════════════
   Sprint 58 #221 — Automated viewport / layout overlap audit.

   Programmatically loads the running app at a mobile viewport (375×812)
   and asserts the primary layout does not overflow horizontally or
   clip content. This guards the Sprint 58 UI overhaul (2-column inbox
   grid, filter chips, FAB suppression, renderPlaceRow title wrapping)
   against regressions that push elements off-screen.

   The check runs against page-level geometry:
     • document.scrollWidth must not exceed the viewport width
       (no horizontal page overflow / no rogue wide element).
     • In-flow (static/relative) elements must not spill past the
       viewport edges. Elements inside intentional overflow-x
       carousels, absolutely/fixed-positioned layers, and the MapLibre
       vector canvas are excluded — those extend past the viewport by
       design.

   Usage:
     node scripts/qa-layout.mjs [url]
       url defaults to http://localhost:3000

   Requires a running dev/preview server. Exits non-zero on failure so
   it can gate CI. Uses Puppeteer if available; otherwise prints the
   in-page audit snippet to paste into a browser console.
   ═══════════════════════════════════════════════════════════════════ */

const URL = process.argv[2] || "http://localhost:3000";
const VIEWPORT = { width: 375, height: 812 };

/* The audit runs inside the page. Kept as a stringifiable function so it
   works both via Puppeteer's page.evaluate and as a copy-paste console
   snippet (see fallback below). */
const AUDIT = () => {
  const vw = document.documentElement.clientWidth;
  const spill = [];
  document.querySelectorAll("body *").forEach((el) => {
    // Skip SVG internals — the map vector layer legitimately extends
    // beyond the viewport.
    if (el instanceof SVGElement) return;
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) return;
    const cs = getComputedStyle(el);
    if (cs.position === "fixed" || cs.position === "absolute") return;
    // Ignore anything inside an off-canvas layer, an overflow-x carousel,
    // or the MapLibre container — all intentionally exceed the viewport.
    let anc = el.parentElement;
    let ignore = false;
    while (anc) {
      const acs = getComputedStyle(anc);
      if (acs.position === "fixed" || acs.position === "absolute") { ignore = true; break; }
      if (acs.overflowX === "auto" || acs.overflowX === "scroll") { ignore = true; break; }
      const cn = anc.className && anc.className.toString ? anc.className.toString() : "";
      if (cn.includes("maplibregl")) { ignore = true; break; }
      anc = anc.parentElement;
    }
    if (ignore) return;
    if (r.right > vw + 1 || r.left < -1) {
      spill.push({
        tag: el.tagName,
        cls: (el.className || "").toString().slice(0, 60),
        left: Math.round(r.left),
        right: Math.round(r.right),
        width: Math.round(r.width),
      });
    }
  });
  return {
    viewport: vw,
    docScrollWidth: document.documentElement.scrollWidth,
    horizontalOverflowPx: document.documentElement.scrollWidth - vw,
    spillCount: spill.length,
    spill,
  };
};

function report(res) {
  console.log(`\n── QA layout audit @ ${VIEWPORT.width}×${VIEWPORT.height} ──`);
  console.log(`viewport width       : ${res.viewport}px`);
  console.log(`document scrollWidth : ${res.docScrollWidth}px`);
  console.log(`horizontal overflow  : ${res.horizontalOverflowPx}px`);
  console.log(`in-flow spill count  : ${res.spillCount}`);
  if (res.spill.length) console.log(JSON.stringify(res.spill, null, 2));

  const overflowOk = res.horizontalOverflowPx <= 0;
  const spillOk = res.spillCount === 0;
  if (overflowOk && spillOk) {
    console.log("\n✅ PASS — no horizontal overflow, no in-flow spill.\n");
    return 0;
  }
  console.log("\n❌ FAIL —" +
    (overflowOk ? "" : ` page overflows by ${res.horizontalOverflowPx}px;`) +
    (spillOk ? "" : ` ${res.spillCount} element(s) spill past the viewport.`) + "\n");
  return 1;
}

async function main() {
  let puppeteer;
  try {
    puppeteer = (await import("puppeteer")).default;
  } catch {
    console.log("puppeteer not installed — printing the console snippet to run manually.\n");
    console.log(`1. Open ${URL} in a mobile-emulated browser (${VIEWPORT.width}px wide).`);
    console.log("2. Paste this into the DevTools console:\n");
    console.log("(" + AUDIT.toString() + ")()");
    process.exit(0);
  }

  const browser = await puppeteer.launch({ headless: "new", args: ["--no-sandbox"] });
  try {
    const page = await browser.newPage();
    await page.setViewport(VIEWPORT);
    await page.goto(URL, { waitUntil: "networkidle2", timeout: 30000 });
    await new Promise((r) => setTimeout(r, 1500)); // let map / lazy layers settle
    const res = await page.evaluate(AUDIT);
    process.exitCode = report(res);
  } finally {
    await browser.close();
  }
}

main().catch((e) => { console.error(e); process.exit(2); });
