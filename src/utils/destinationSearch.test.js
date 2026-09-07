import { normalize, searchDestinations, allCountries } from "./destinationSearch";

describe("normalize", () => {
  it("folds geresh variants so both spellings match", () => {
    expect(normalize("צ׳אנג")).toBe(normalize("צ'אנג"));
  });
  it("collapses whitespace and casefolds Latin", () => {
    expect(normalize("  JaPan  ")).toBe("japan");
    expect(normalize("hoi   an")).toBe("hoi an");
  });
  it("survives null/undefined without throwing", () => {
    expect(normalize(null)).toBe("");
    expect(normalize(undefined)).toBe("");
  });
});

describe("searchDestinations", () => {
  it("returns nothing for an empty query", () => {
    expect(searchDestinations("")).toEqual([]);
    expect(searchDestinations("   ")).toEqual([]);
  });

  it("matches a Hebrew country and carries a usable dest id", () => {
    const [top] = searchDestinations("יפן");
    expect(top).toMatchObject({ type: "country", dest: "jp", label: "יפן" });
  });

  it("matches a Hebrew city and carries BOTH its country and its name", () => {
    const hit = searchDestinations("קיוטו").find((r) => r.type === "city");
    expect(hit).toMatchObject({ type: "city", dest: "jp", city: "קיוטו" });
  });

  it("matches Latin country input", () => {
    expect(searchDestinations("japan")[0]).toMatchObject({ dest: "jp" });
  });

  it("documents the known Latin-city limitation rather than pretending it works", () => {
    // CITY_POOL is Hebrew-only. This is the limitation the spec asks us to state.
    expect(searchDestinations("tokyo")).toHaveLength(0);
  });

  it("sorts countries above cities", () => {
    const res = searchDestinations("א");
    const firstCity = res.findIndex((r) => r.type === "city");
    const lastCountry = res.map((r) => r.type).lastIndexOf("country");
    if (firstCity !== -1 && lastCountry !== -1) expect(lastCountry).toBeLessThan(firstCity);
  });

  it("prefers prefix matches over substring matches", () => {
    const res = searchDestinations("רומ");
    expect(res[0].label.startsWith("רומ")).toBe(true);
  });

  it("caps results at the limit", () => {
    expect(searchDestinations("א", 6).length).toBeLessThanOrEqual(6);
    expect(searchDestinations("א", 2).length).toBeLessThanOrEqual(2);
  });

  it("finds a geresh city typed with a straight apostrophe", () => {
    const hit = searchDestinations("צ'אנג").find((r) => r.type === "city");
    expect(hit).toBeDefined();
    expect(hit.dest).toBe("th");
  });

  it("never returns an entry without a dest the wizard can consume", () => {
    ["יפן", "רומא", "italy", "אתונה", "פורטו"].forEach((q) => {
      searchDestinations(q).forEach((r) => expect(typeof r.dest).toBe("string"));
    });
  });
});

describe("allCountries", () => {
  it("is the never-a-dead-end fallback and covers every destination", () => {
    const all = allCountries();
    expect(all.length).toBeGreaterThanOrEqual(10);
    all.forEach((c) => expect(c).toMatchObject({ type: "country" }));
  });
});
