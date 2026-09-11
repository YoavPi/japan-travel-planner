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
