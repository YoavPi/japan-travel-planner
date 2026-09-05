/* `instanceId` is the stable per-stop identity that Phase B's `stopRef` will
   point at. Two invariants now carry money and must not regress:
     1. a duplicated stop NEVER inherits its original's instanceId
        (one expense would resolve to two stops), and
     2. an updated stop ALWAYS keeps its own
        (its expense would silently detach).
   Both already hold — these tests pin them. */
import { renderHook, act, waitFor } from "@testing-library/react";
import useEditorState from "./useEditorState";
import tripService from "../services/tripService";

/* useEditorState takes a tripId and loads the trip itself, so the fixture is
   delivered through fetchTripById rather than passed in. */
jest.mock("../services/tripService", () => ({
  __esModule: true,
  default: {
    fetchTripById: jest.fn(),
    saveTrip: jest.fn(() => Promise.resolve({})),
  },
}));

const seed = () => ({
  id: "t1",
  readOnly: false,
  days: 2,
  data: {
    tripData: [
      { day: 1, city: "Tokyo", cityHe: "טוקיו",
        attractions: [{ instanceId: "inst-aaa", name: "Ramen", nameHe: "ראמן",
                        coordinates: { lng: 139.7, lat: 35.6 } }] },
      { day: 2, city: "Tokyo", cityHe: "טוקיו", attractions: [] },
    ],
    budget: {
      config: { currency: "ILS", rate: 1, totalIlsMinor: 100000, categories: [] },
      items: [
        { id: "e_general", label: "ביטוח", amountMinor: 32000, currency: "ILS",
          category: "insurance", dayRef: null, stopRef: null, paid: false, actualMinor: null },
        { id: "e_day2", label: "כניסה", amountMinor: 5000, currency: "ILS",
          category: "attractions", dayRef: 2, stopRef: null, paid: false, actualMinor: null },
      ],
    },
  },
});

const daysOf = (r) => r.current.trip.data.tripData;

/* Mount and wait for the async load to land. */
const mountLoaded = async () => {
  const hook = renderHook(() => useEditorState("t1"));
  await waitFor(() => expect(hook.result.current.trip).toBeTruthy());
  return hook;
};

beforeEach(() => {
  tripService.saveTrip.mockClear().mockImplementation(() => Promise.resolve({}));
  tripService.fetchTripById.mockReset().mockImplementation(() => Promise.resolve(seed()));
});

test("a duplicated stop never inherits the original's instanceId", async () => {
  const { result } = await mountLoaded();
  act(() => result.current.duplicateStopAt(1, 0));

  const stops = daysOf(result)[0].attractions;
  expect(stops).toHaveLength(2);
  expect(stops[1].instanceId).toBeTruthy();
  expect(stops[1].instanceId).not.toBe(stops[0].instanceId);
  expect(stops[1].name).toBe(stops[0].name);   // it is still a copy
});

test("an updated stop keeps its instanceId", async () => {
  const { result } = await mountLoaded();
  act(() => result.current.updateStopAt(1, 0, { name: "Ramen 2", nameHe: "ראמן 2" }));

  const stop = daysOf(result)[0].attractions[0];
  expect(stop.instanceId).toBe("inst-aaa");
  expect(stop.nameHe).toBe("ראמן 2");
});

test("deleting a day remaps expense days: the removed day falls back to general", async () => {
  const { result } = await mountLoaded();
  act(() => result.current.deleteDay(2));

  const items = result.current.trip.data.budget.items;
  expect(items).toHaveLength(2);                                   // nothing dropped
  expect(items.find((i) => i.id === "e_day2").dayRef).toBeNull();  // folded to general
  expect(items.find((i) => i.id === "e_day2").amountMinor).toBe(5000); // money intact
  expect(items.find((i) => i.id === "e_general").dayRef).toBeNull();
});

test("deleting an earlier day renumbers a later expense's day rather than dropping it", async () => {
  const { result } = await mountLoaded();
  act(() => result.current.deleteDay(1));

  const it = result.current.trip.data.budget.items.find((i) => i.id === "e_day2");
  expect(it.dayRef).toBe(1);          // old day 2 became day 1
  expect(it.amountMinor).toBe(5000);
});
