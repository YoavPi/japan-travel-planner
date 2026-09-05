/* CRA's Jest preset sets resetMocks:true, so mock implementations are wiped
   between tests — each describe block re-wires what it needs.
   Covers the trip-scoped read added for the Places Bank "הבנק לטיול זה" tab
   (listInboxPlaces(tripId) must return trip_id === tripId OR trip_id IS NULL
   rows; omitting tripId must stay fully unfiltered/global, unchanged). */
jest.mock("../lib/supabase", () => ({
  __esModule: true,
  isSupabaseEnabled: jest.fn(() => false),
  supabase: { from: jest.fn() },
  getSupabaseUser: jest.fn(),
}));

import { supabase, getSupabaseUser } from "../lib/supabase";
import { listInboxPlaces } from "./googleSavedPlaces";

const LOCAL_INBOX_KEY = "tp_places_inbox_v1";

describe("listInboxPlaces: no Supabase session (localStorage bank)", () => {
  beforeEach(() => {
    getSupabaseUser.mockResolvedValue(null);
    localStorage.clear();
    localStorage.setItem(LOCAL_INBOX_KEY, JSON.stringify([
      { id: "a", name: "Global point", tripId: undefined },
      { id: "b", name: "Trip A point", tripId: "trip_a" },
      { id: "c", name: "Trip B point", tripId: "trip_b" },
    ]));
  });

  test("no tripId argument returns every row, unfiltered (global tab)", async () => {
    const list = await listInboxPlaces();
    expect(list.map((p) => p.id)).toEqual(["a", "b", "c"]);
  });

  test("passing a tripId returns only that trip's rows plus untagged rows", async () => {
    const list = await listInboxPlaces("trip_a");
    expect(list.map((p) => p.id).sort()).toEqual(["a", "b"]);
  });

  test("a different trip's rows never leak into another trip's scoped list", async () => {
    const list = await listInboxPlaces("trip_b");
    expect(list.map((p) => p.id)).not.toContain("b");
  });
});

/* Minimal stand-in for a Supabase PostgrestFilterBuilder: every chain
   method returns the same object (so `.select().order()` and the later
   `.or()` all compose), and the object itself is a thenable so `await
   query` resolves it — mirroring how listInboxPlaces() builds the query
   incrementally before awaiting it. */
function makeQuery(result = { data: [], error: null }) {
  const q = {
    select: jest.fn(() => q),
    order: jest.fn(() => q),
    or: jest.fn(() => q),
    then: (resolve, reject) => Promise.resolve(result).then(resolve, reject),
  };
  return q;
}

describe("listInboxPlaces: with a Supabase session", () => {
  let query;
  beforeEach(() => {
    getSupabaseUser.mockResolvedValue({ id: "user-1" });
    query = makeQuery();
    supabase.from.mockImplementation(() => query);
  });

  test("omitting tripId never adds an .or() trip filter (global tab, unchanged)", async () => {
    await listInboxPlaces();
    expect(query.or).not.toHaveBeenCalled();
    expect(query.order).toHaveBeenCalled();
  });

  test("passing a tripId filters to that trip's rows OR untagged rows", async () => {
    await listInboxPlaces("trip_a");
    expect(query.or).toHaveBeenCalledWith("trip_id.eq.trip_a,trip_id.is.null");
  });

  test("an unsafe tripId (would break the .or() query string) is ignored, not interpolated", async () => {
    await listInboxPlaces("trip_a,evil=1");
    expect(query.or).not.toHaveBeenCalled();
  });
});
