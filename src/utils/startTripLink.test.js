import { buildStartTripTarget, startTrip } from "./startTripLink";

describe("buildStartTripTarget", () => {
  it("country only", () => {
    expect(buildStartTripTarget({ dest: "jp" })).toBe("/create?dest=jp");
  });
  it("country + city", () => {
    expect(buildStartTripTarget({ dest: "it", city: "רומא" }))
      .toBe(`/create?dest=it&city=${encodeURIComponent("רומא")}`);
  });
  it("encodes cities containing spaces and geresh", () => {
    const t = buildStartTripTarget({ dest: "th", city: "צ׳אנג מאי" });
    expect(t).toContain("dest=th");
    expect(decodeURIComponent(t.split("city=")[1])).toBe("צ׳אנג מאי");
    expect(t).not.toMatch(/ /);
  });
  it("drops a blank/whitespace city rather than emitting city=", () => {
    expect(buildStartTripTarget({ dest: "jp", city: "   " })).toBe("/create?dest=jp");
    expect(buildStartTripTarget({ dest: "jp", city: undefined })).toBe("/create?dest=jp");
  });
  it("falls back to a bare /create with no destination", () => {
    expect(buildStartTripTarget({})).toBe("/create");
    expect(buildStartTripTarget()).toBe("/create");
  });
});

describe("startTrip auth branch", () => {
  it("navigates straight there when authenticated", () => {
    const navigate = jest.fn();
    startTrip({ dest: "jp", city: "טוקיו" }, { isAuthenticated: true, navigate });
    expect(navigate).toHaveBeenCalledTimes(1);
    expect(navigate.mock.calls[0][0]).toContain("/create?dest=jp&city=");
    expect(navigate.mock.calls[0][1]).toBeUndefined();
  });

  it("routes a guest through /auth carrying the FULL target in state.from", () => {
    const navigate = jest.fn();
    startTrip({ dest: "gr", city: "סנטוריני" }, { isAuthenticated: false, navigate });
    expect(navigate).toHaveBeenCalledWith("/auth", {
      state: { from: `/create?dest=gr&city=${encodeURIComponent("סנטוריני")}` },
    });
  });

  it("guest target survives a round-trip decode — the query must not be dropped", () => {
    const navigate = jest.fn();
    startTrip({ dest: "jp", city: "קוואגוצ׳יקו" }, { isAuthenticated: false, navigate });
    const from = navigate.mock.calls[0][1].state.from;
    const params = new URLSearchParams(from.split("?")[1]);
    expect(params.get("dest")).toBe("jp");
    expect(params.get("city")).toBe("קוואגוצ׳יקו");
  });
});
