import { hexToRgb, relativeLuminance, contrastRatio, readableInkOn } from "./contrast";

/* The two palettes that can be written into `_theme`. Kept verbatim here on
   purpose: if either picker's palette changes, this test must be updated
   deliberately rather than silently drifting. */
const PASTELS = ["#E7A9A0", "#9CCBA9", "#EBCB93", "#A9BBE4"];           // StopActionsSheet
const THEMES = ["#8B7BC7", "#5FA36A", "#E0915A", "#C77BA6", "#6E8BC4", "#D67B7B", "#0D0F11"]; // long-press

describe("hexToRgb", () => {
  it("parses 6-digit and 3-digit hex", () => {
    expect(hexToRgb("#FFFFFF")).toEqual([255, 255, 255]);
    expect(hexToRgb("#fff")).toEqual([255, 255, 255]);
    expect(hexToRgb("E0533F")).toEqual([224, 83, 63]);
  });
  it("returns null for non-hex input instead of throwing", () => {
    [null, undefined, 42, "", "red", "rgb(1,2,3)", "#12", "#1234567"].forEach((v) => {
      expect(hexToRgb(v)).toBeNull();
    });
  });
});

describe("relativeLuminance", () => {
  it("anchors at black and white", () => {
    expect(relativeLuminance("#000000")).toBeCloseTo(0, 5);
    expect(relativeLuminance("#FFFFFF")).toBeCloseTo(1, 5);
  });
});

describe("contrastRatio", () => {
  it("gives 21:1 for black on white", () => {
    expect(contrastRatio("#000000", "#FFFFFF")).toBeCloseTo(21, 1);
  });
  it("is symmetric", () => {
    expect(contrastRatio("#E0533F", "#FFFFFF")).toBeCloseTo(contrastRatio("#FFFFFF", "#E0533F"), 10);
  });
  it("reproduces the bug this module exists to prevent", () => {
    // white on the lightest pastel — what the code did before.
    expect(contrastRatio("#EBCB93", "#FFFFFF")).toBeLessThan(2);
  });
});

describe("readableInkOn", () => {
  it("picks dark ink on light backgrounds, white on dark ones", () => {
    expect(readableInkOn("#EBCB93")).toBe("#14181C");
    expect(readableInkOn("#0D0F11")).toBe("#FFFFFF");
  });

  it("clears WCAG AA (4.5:1) for EVERY colour either picker can write", () => {
    [...PASTELS, ...THEMES].forEach((c) => {
      const ink = readableInkOn(c);
      const ratio = contrastRatio(c, ink);
      expect({ colour: c, ink, ratio: Number(ratio.toFixed(2)) })
        .toEqual(expect.objectContaining({ colour: c }));
      expect(ratio).toBeGreaterThanOrEqual(4.5);
    });
  });

  it("also clears AA on the badge defaults it must not regress", () => {
    ["#1E1E24", "#FF6B6B", "#A4AAB1"].forEach((c) => {
      expect(contrastRatio(c, readableInkOn(c))).toBeGreaterThanOrEqual(4.5);
    });
  });

  it("falls back to the light ink for unparseable input", () => {
    expect(readableInkOn(undefined)).toBe("#FFFFFF");
    expect(readableInkOn("transparent")).toBe("#FFFFFF");
  });
});
