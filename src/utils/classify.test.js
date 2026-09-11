import { withFreshInstanceId, normalizeRating, ratingToBadge } from "./classify";

/* Pins the invariant behind trip-budget-design §1.5: stopRef is the stop's
   instanceId, so two stops must never share one — a duplicate that carried
   its source's instanceId forward would make one budget item resolve to
   two places on the map. Mirrors the existing regression test for the
   desktop clone path (useEditorState.duplicateStopAt), for the three
   mobile clone paths in EditorView.jsx that a `builder` pass wires this
   into (copyStopToDay, setStopAsMultiDayHotel, copyStopToOtherTrip). */
describe("withFreshInstanceId", () => {
  const genId = (() => {
    let n = 0;
    return () => `inst-${++n}`;
  })();

  test("the clone gets a fresh instanceId, different from the source", () => {
    const src = { instanceId: "inst-original", name: "ראמן אפורי", category: "food" };
    const clone = withFreshInstanceId(src, genId);
    expect(clone.instanceId).not.toBe(src.instanceId);
  });

  test("every other field is preserved, unchanged", () => {
    const src = {
      instanceId: "inst-a",
      name: "מקדש קינקאקוג'י",
      category: "מקדש",
      coordinates: { lat: 35.0, lng: 135.0 },
      note: "לבוא מוקדם",
    };
    const clone = withFreshInstanceId(src, genId);
    const { instanceId, ...restOfClone } = clone;
    const { instanceId: srcId, ...restOfSrc } = src;
    expect(restOfClone).toEqual(restOfSrc);
  });

  test("the source object itself is never mutated", () => {
    const src = { instanceId: "inst-b", name: "A" };
    const before = { ...src };
    withFreshInstanceId(src, genId);
    expect(src).toEqual(before);
  });

  test("repeated calls never collide with the source or with each other", () => {
    const src = { instanceId: "inst-c", name: "A" };
    const ids = new Set([src.instanceId]);
    for (let i = 0; i < 20; i++) {
      const clone = withFreshInstanceId(src, genId);
      expect(ids.has(clone.instanceId)).toBe(false);
      ids.add(clone.instanceId);
    }
  });

  test("a legacy stop with no instanceId still gets one stamped", () => {
    const src = { name: "רחוב פונטוצ'ו", category: "רחוב" };
    const clone = withFreshInstanceId(src, genId);
    expect(clone.instanceId).toBeTruthy();
    expect(clone.name).toBe(src.name);
  });
});

describe("normalizeRating", () => {
  it("passes through an already-scaled string", () => {
    expect(normalizeRating("9/10")).toBe("9/10");
    expect(normalizeRating("9.2/10")).toBe("9.2/10");
  });
  it("scales a raw Google 0-5 number", () => {
    expect(normalizeRating(4.6)).toBe("9.2/10");
    expect(normalizeRating(4.7)).toBe("9.4/10");
  });
  it("treats a bare number above 5 as already /10", () => {
    expect(normalizeRating(9.4)).toBe("9.4/10");
  });
  it("returns null for unparseable input", () => {
    expect(normalizeRating(undefined)).toBeNull();
    expect(normalizeRating(null)).toBeNull();
    expect(normalizeRating("")).toBeNull();
    expect(normalizeRating("garbage")).toBeNull();
  });
});

/* Task B6 — EditorView's addNearbyToDay now writes `rating: ratingToBadge(r.rating)`
   instead of the raw Google 0-5 number, so the nearby-search "add" flow produces
   the same "/10" badge string every other rating writer does. This duplicates
   coverage already on ratingToBadge itself (above) deliberately, as a named
   marker that the addNearbyToDay call site specifically is covered — see
   EditorView.sourceScan.test.js for the source-pinned counterpart that also
   confirms addOverlayPoints (a correct pre-existing "/10" writer) was NOT
   touched. */
it("T-CARD-08 (writer half): a raw Google rating passed through ratingToBadge becomes a /10 string", () => {
  expect(ratingToBadge(4.6)).toBe("9.2/10");
});
