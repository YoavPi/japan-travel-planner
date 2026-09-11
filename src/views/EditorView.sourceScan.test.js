const fs = require("fs");

/* B5/F1 — static source-scan guard: the bespoke long-press context menu
   (ctxMenu/ctxSub state, its 7-color THEMES palette) must never resurface
   in EditorView.jsx. Long-press now opens the same StopActionsSheet the
   ⋯ button opens, via `actionsIdx`. See docs/superpowers/specs/
   2026-09-07-mobile-stop-card-redesign-design.md §3.3. */
describe("EditorView source scan — F1 context-menu deletion (T-CARD-10)", () => {
  const src = fs.readFileSync(require.resolve("./EditorView.jsx"), "utf8");

  it("no longer declares ctxMenu/ctxSub state", () => {
    expect(src).not.toMatch(/ctxMenu/);
    expect(src).not.toMatch(/ctxSub/);
  });

  it("no longer defines the bespoke long-press THEMES palette", () => {
    expect(src).not.toMatch(/const THEMES = /);
  });

  it("long-press repoints to the same actions sheet the ⋯ button opens", () => {
    expect(src).toMatch(/onOpenContextMenu=\{\(idx\)\s*=>\s*setActionsIdx\(idx\)\}/);
  });
});

/* Task B6 — source-pinned regression for the rating-writer fix. Two writers
   set a new stop's `rating` field in this file; only ONE of them (the nearby-
   search "add" flow, addNearbyToDay) was wrong — it emitted a raw Google 0-5
   number instead of the app's "/10" badge string. addOverlayPoints already
   emitted a correct string and must be left alone (running it through
   ratingToBadge would silently null out every overlay-imported rating, since
   ratingToBadge rejects non-numeric strings). A plain string match on the
   fixed line is a cheap, precise guard against the exact confusion the task
   brief flagged as a risk — string-based since this file has no integration
   test harness (see the class above). */
describe("EditorView source scan — B6 rating-writer fix (T-CARD-08)", () => {
  const src = fs.readFileSync(require.resolve("./EditorView.jsx"), "utf8");

  it("addNearbyToDay normalises the raw Google rating via ratingToBadge", () => {
    expect(src).toMatch(/rating:\s*ratingToBadge\(r\.rating\)/);
  });

  it("addOverlayPoints is left untouched — still writes its rating as-is", () => {
    expect(src).toMatch(/rating:\s*p\.rating \|\| undefined/);
  });
});

/* Task C2 — spec §5.6 loading skeleton: three StopCard-geometry shells,
   plain fade (never the tpSkeleton shimmer), aria-busy + aria-live, and
   respecting prefers-reduced-motion via the existing sitewide `.tp-fade`
   rule (no second detection mechanism introduced). Source-scan since this
   file has no render harness (see the class above). */
describe("EditorView source scan — C2 loading skeleton (spec §5.6)", () => {
  const src = fs.readFileSync(require.resolve("./EditorView.jsx"), "utf8");

  it("renders exactly three skeleton card shells", () => {
    expect(src).toMatch(/\{\[0,\s*1,\s*2\]\.map\(\(i\)\s*=>\s*\(/);
  });

  it("uses the plain tp-fade entrance, never the tpSkeleton shimmer keyframe, on the skeleton card", () => {
    const skeletonBlock = src.slice(src.indexOf("Task C2"), src.indexOf("<style>{`"));
    expect(skeletonBlock).toMatch(/className="tp-fade"/);
    expect(skeletonBlock).not.toMatch(/animation:\s*["'`]tpSkeleton/);
  });

  it("marks the skeleton list aria-busy and announces the Hebrew loading string via aria-live", () => {
    expect(src).toMatch(/aria-busy="true"/);
    expect(src).toMatch(/aria-live="polite"[\s\S]{0,200}טוען מסלול…/);
  });

  it("skeleton cards match StopCard's real geometry (76px height, 14px radius, LIGHT surface/line tokens)", () => {
    const skeletonBlock = src.slice(src.indexOf("Task C2"), src.indexOf("<style>{`"));
    expect(skeletonBlock).toMatch(/height:\s*76,\s*borderRadius:\s*14/);
    expect(skeletonBlock).toMatch(/background:\s*LIGHT\.surface,\s*border:\s*`1px solid \$\{LIGHT\.line\}`/);
    expect(skeletonBlock).toMatch(/width:\s*32,\s*height:\s*32,\s*borderRadius:\s*8,\s*background:\s*LIGHT\.surface2/);
  });
});
