import { renderHook, act, waitFor } from "@testing-library/react";
import useBudget from "./useBudget";
import tripService from "../services/tripService";

jest.mock("../services/tripService", () => ({
  __esModule: true,
  default: { saveTrip: jest.fn(() => Promise.resolve({})) },
}));

const makeTrip = (over = {}) => ({
  id: "t1",
  readOnly: false,
  /* Real trip records always carry lastEdited (rowToTrip). The hook keys its
     re-sync on it, never on `data` object identity — see useBudget.js. */
  lastEdited: "2026-01-01T00:00:00.000Z",
  data: { tripData: [{ day: 1, attractions: [] }] },
  ...over,
});

beforeEach(() => {
  tripService.saveTrip.mockClear();
  tripService.saveTrip.mockImplementation(() => Promise.resolve({}));
});

test("starts with no budget and hasAny false", () => {
  const { result } = renderHook(() => useBudget(makeTrip()));
  expect(result.current.hasAny).toBe(false);
  expect(result.current.roll.effectiveIlsMinor).toBe(0);
});

test("setConfig updates optimistically and persists", async () => {
  const { result } = renderHook(() => useBudget(makeTrip()));
  act(() => result.current.setConfig({ totalIlsMinor: 1500000, currency: "JPY", rate: 0.023 }));

  expect(result.current.budget.config.totalIlsMinor).toBe(1500000);
  expect(result.current.hasAny).toBe(true);
  await waitFor(() => expect(tripService.saveTrip).toHaveBeenCalledTimes(1));
  expect(tripService.saveTrip).toHaveBeenCalledWith("t1",
    { data: expect.objectContaining({ budget: expect.any(Object) }) });
});

test("createExpense adds an item and rollup reflects it", async () => {
  const { result } = renderHook(() => useBudget(makeTrip()));
  act(() => result.current.setConfig({ totalIlsMinor: 1000000 }));
  act(() => result.current.createExpense({ label: "טיסה", amountMinor: 400000, currency: "ILS", category: "flights" }));

  expect(result.current.budget.items).toHaveLength(1);
  expect(result.current.roll.effectiveIlsMinor).toBe(400000);
  await waitFor(() => expect(tripService.saveTrip).toHaveBeenCalledTimes(2));
});

test("markPaid with a different amount moves the effective total", async () => {
  const { result } = renderHook(() => useBudget(makeTrip()));
  act(() => result.current.createExpense({ id: "e_a", label: "ראמן", amountMinor: 10000, currency: "ILS" }));
  expect(result.current.roll.effectiveIlsMinor).toBe(10000);

  act(() => result.current.markPaid("e_a", true, 13500));
  expect(result.current.roll.effectiveIlsMinor).toBe(13500);
  expect(result.current.roll.actualIlsMinor).toBe(13500);
  expect(result.current.roll.plannedIlsMinor).toBe(10000);
  await waitFor(() => expect(tripService.saveTrip).toHaveBeenCalledTimes(2));
});

test("deleteExpense removes it", async () => {
  const { result } = renderHook(() => useBudget(makeTrip()));
  act(() => result.current.createExpense({ id: "e_a", amountMinor: 10000, currency: "ILS" }));
  act(() => result.current.deleteExpense("e_a"));
  expect(result.current.budget.items).toHaveLength(0);
  await waitFor(() => expect(tripService.saveTrip).toHaveBeenCalledTimes(2));
});

test("a read-only trip refuses every mutation and never calls saveTrip", () => {
  const { result } = renderHook(() => useBudget(makeTrip({ readOnly: true })));
  expect(result.current.readOnly).toBe(true);

  act(() => result.current.setConfig({ totalIlsMinor: 999 }));
  act(() => result.current.createExpense({ amountMinor: 100, currency: "ILS" }));

  expect(result.current.hasAny).toBe(false);
  expect(tripService.saveTrip).not.toHaveBeenCalled();
});

test("a failed save surfaces an error and rolls the state back", async () => {
  tripService.saveTrip.mockImplementation(() => Promise.reject(new Error("boom")));
  const { result } = renderHook(() => useBudget(makeTrip()));

  act(() => result.current.createExpense({ id: "e_a", amountMinor: 10000, currency: "ILS" }));
  expect(result.current.budget.items).toHaveLength(1);   // optimistic

  await waitFor(() => expect(result.current.error).toBeTruthy());
  expect(result.current.budget?.items ?? []).toHaveLength(0);  // rolled back
});

test("it re-syncs when a different trip is passed in", async () => {
  const { result, rerender } = renderHook(({ trip }) => useBudget(trip), {
    initialProps: { trip: makeTrip() },
  });
  act(() => result.current.createExpense({ amountMinor: 100, currency: "ILS" }));
  expect(result.current.budget.items).toHaveLength(1);
  await waitFor(() => expect(tripService.saveTrip).toHaveBeenCalledTimes(1));

  rerender({ trip: makeTrip({ id: "t2" }) });
  expect(result.current.budget).toBeNull();
});
