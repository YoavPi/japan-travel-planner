import { renderHook, act, waitFor } from "@testing-library/react";

jest.mock("../services/tripService", () => ({
  __esModule: true,
  default: {
    fetchTripById: jest.fn(),
    saveTrip: jest.fn(() => Promise.resolve()),
  },
}));
jest.mock("../services/googleSavedPlaces", () => ({
  listInboxPlaces: () => Promise.resolve([]),
  addInboxPlaces: () => Promise.resolve([]),
  removeInboxPlace: () => Promise.resolve(),
  updateInboxPlace: () => Promise.resolve(),
  fetchMockGoogleSavedPlaces: () => Promise.resolve([]),
}));

import tripService from "../services/tripService";
import useEditorState from "./useEditorState";

const baseTrip = () => ({
  id: "t1", readOnly: false,
  data: {
    tripData: [{ day: 1, attractions: [{ instanceId: "s1", name: "Sensoji", coordinates: { lat: 1, lng: 1 } }] }],
    budget: { config: { currency: "ILS", rate: 1, categories: [] }, items: [] },
  },
});

beforeEach(() => {
  tripService.fetchTripById.mockResolvedValue(JSON.parse(JSON.stringify(baseTrip())));
  tripService.saveTrip.mockClear();
  tripService.saveTrip.mockResolvedValue(undefined);
});

test("saveStopCost on a stop with an instanceId creates one linked expense in a single save", async () => {
  const { result } = renderHook(() => useEditorState("t1"));
  await waitFor(() => expect(result.current.trip).toBeTruthy());

  act(() => result.current.saveStopCost(1, 0, {
    label: "כניסה למקדש", amountMinor: 50000, currency: "ILS", category: "activities", note: "",
  }));

  const items = result.current.trip.data.budget.items;
  expect(items).toHaveLength(1);
  expect(items[0]).toMatchObject({ label: "כניסה למקדש", amountMinor: 50000, currency: "ILS", stopRef: "s1" });
  expect(tripService.saveTrip).toHaveBeenCalledTimes(1);
});

test("saveStopCost on a stop with NO instanceId stamps one and links in the SAME save", async () => {
  const trip = baseTrip();
  trip.data.tripData[0].attractions[0].instanceId = undefined;
  tripService.fetchTripById.mockResolvedValue(JSON.parse(JSON.stringify(trip)));
  const { result } = renderHook(() => useEditorState("t1"));
  await waitFor(() => expect(result.current.trip).toBeTruthy());

  act(() => result.current.saveStopCost(1, 0, {
    label: "טקסי", amountMinor: 3000, currency: "ILS", category: "transport", note: "",
  }));

  const stop = result.current.trip.data.tripData[0].attractions[0];
  expect(stop.instanceId).toBeTruthy();
  const items = result.current.trip.data.budget.items;
  expect(items[0].stopRef).toBe(stop.instanceId);
  expect(tripService.saveTrip).toHaveBeenCalledTimes(1); // one call, not two
});

test("saveStopCost called twice on the same stop UPDATES, never creates a second item", async () => {
  const { result } = renderHook(() => useEditorState("t1"));
  await waitFor(() => expect(result.current.trip).toBeTruthy());

  act(() => result.current.saveStopCost(1, 0, { label: "א", amountMinor: 1000, currency: "ILS", category: "other", note: "" }));
  act(() => result.current.saveStopCost(1, 0, { label: "ב", amountMinor: 2000, currency: "ILS", category: "other", note: "" }));

  const items = result.current.trip.data.budget.items;
  expect(items).toHaveLength(1);
  expect(items[0]).toMatchObject({ label: "ב", amountMinor: 2000 });
});

test("removeStopCost deletes the expense by id", async () => {
  const { result } = renderHook(() => useEditorState("t1"));
  await waitFor(() => expect(result.current.trip).toBeTruthy());
  act(() => result.current.saveStopCost(1, 0, { label: "א", amountMinor: 1000, currency: "ILS", category: "other", note: "" }));
  const id = result.current.trip.data.budget.items[0].id;

  act(() => result.current.removeStopCost(id));

  expect(result.current.trip.data.budget.items).toHaveLength(0);
});

test("deleteStopAt detaches (not deletes) a linked expense, in the same save as the itinerary removal", async () => {
  const { result } = renderHook(() => useEditorState("t1"));
  await waitFor(() => expect(result.current.trip).toBeTruthy());
  act(() => result.current.saveStopCost(1, 0, { label: "א", amountMinor: 1000, currency: "ILS", category: "other", note: "" }));
  tripService.saveTrip.mockClear();

  act(() => result.current.deleteStopAt(1, 0));

  expect(result.current.trip.data.tripData[0].attractions).toHaveLength(0);
  const items = result.current.trip.data.budget.items;
  expect(items).toHaveLength(1); // NOT deleted
  expect(items[0].stopRef).toBeNull();
  expect(tripService.saveTrip).toHaveBeenCalledTimes(1); // one atomic write
});

test("moveStopToInbox detaches a linked expense the same way", async () => {
  const { result } = renderHook(() => useEditorState("t1"));
  await waitFor(() => expect(result.current.trip).toBeTruthy());
  act(() => result.current.saveStopCost(1, 0, { label: "א", amountMinor: 1000, currency: "ILS", category: "other", note: "" }));

  act(() => result.current.moveStopToInbox(1, 0));

  const items = result.current.trip.data.budget.items;
  expect(items[0].stopRef).toBeNull();
});

test("deleteDay detaches (not orphans) a linked expense whose stop lived on the deleted day", async () => {
  const trip = baseTrip();
  trip.data.tripData.push({ day: 2, attractions: [{ instanceId: "s2", name: "Tokyo Tower", coordinates: { lat: 2, lng: 2 } }] });
  tripService.fetchTripById.mockResolvedValue(JSON.parse(JSON.stringify(trip)));
  const { result } = renderHook(() => useEditorState("t1"));
  await waitFor(() => expect(result.current.trip).toBeTruthy());
  act(() => result.current.saveStopCost(1, 0, { label: "א", amountMinor: 1000, currency: "ILS", category: "other", note: "" }));
  tripService.saveTrip.mockClear();

  act(() => result.current.deleteDay(1));

  expect(result.current.trip.data.tripData).toHaveLength(1);
  expect(result.current.trip.data.tripData[0].day).toBe(1);
  const items = result.current.trip.data.budget.items;
  expect(items).toHaveLength(1); // NOT deleted
  expect(items[0].stopRef).toBeNull(); // detached, not left dangling on a gone instanceId
  expect(tripService.saveTrip).toHaveBeenCalledTimes(1); // one atomic write
});

test("costForStop returns the linked expense or null", async () => {
  const { result } = renderHook(() => useEditorState("t1"));
  await waitFor(() => expect(result.current.trip).toBeTruthy());
  expect(result.current.costForStop("s1")).toBeNull();

  act(() => result.current.saveStopCost(1, 0, { label: "א", amountMinor: 1000, currency: "ILS", category: "other", note: "" }));

  expect(result.current.costForStop("s1")).toMatchObject({ label: "א", amountMinor: 1000 });
});
