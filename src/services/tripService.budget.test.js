/* Exercises the localStorage engine (no Supabase session in tests), which is
   the same code path the demo/mock sessions use in production. */
import tripService, { rowToTrip } from "./tripService";
import { summarize } from "../utils/budget";

const BUDGET = {
  config: { currency: "JPY", rate: 0.023, totalIlsMinor: 1000000, categories: [] },
  items: [{ id: "e_1", label: "טיסה", amountMinor: 400000, currency: "ILS",
            category: "flights", paid: false, actualMinor: null }],
};

beforeEach(async () => {
  localStorage.clear();
  await tripService.resetStore();
});

test("saveTrip derives data.budget.summary from the budget it is given", async () => {
  const trip = await tripService.createNewTrip({ title: "בדיקה", days: 2 });
  const saved = await tripService.saveTrip(trip.id, {
    data: { ...trip.data, budget: BUDGET },
  });
  expect(saved.data.budget.summary).toEqual(summarize(BUDGET));
  expect(saved.data.budget.summary.effectiveIlsMinor).toBe(400000);
});

test("a summary supplied by the caller is overwritten, never trusted", async () => {
  const trip = await tripService.createNewTrip({ title: "בדיקה", days: 2 });
  const lying = { ...BUDGET, summary: { totalIlsMinor: 1, effectiveIlsMinor: 1, pct: 1, over: true } };
  const saved = await tripService.saveTrip(trip.id, { data: { ...trip.data, budget: lying } });
  expect(saved.data.budget.summary.effectiveIlsMinor).toBe(400000);
  expect(saved.data.budget.summary.over).toBe(false);
});

/* THE REGRESSION THIS TASK EXISTS FOR: a write that arrives through the
   generic editor path — a patch that only carries `data`, produced by a stop
   mutation — must still re-derive the summary. */
test("the generic data-only editor save path still re-derives the summary", async () => {
  const trip = await tripService.createNewTrip({ title: "בדיקה", days: 2 });
  await tripService.saveTrip(trip.id, { data: { ...trip.data, budget: BUDGET } });

  const withMore = {
    ...BUDGET,
    items: [...BUDGET.items,
      { id: "e_2", label: "ביטוח", amountMinor: 32000, currency: "ILS",
        category: "insurance", paid: false, actualMinor: null }],
  };
  const after = await tripService.saveTrip(trip.id, {
    data: { ...trip.data, tripData: [{ day: 1, attractions: [] }], budget: withMore },
  });
  expect(after.data.budget.summary.effectiveIlsMinor).toBe(432000);
});

test("a patch with no budget is passed through untouched", async () => {
  const trip = await tripService.createNewTrip({ title: "בדיקה", days: 2 });
  const saved = await tripService.saveTrip(trip.id, { title: "שם חדש" });
  expect(saved.title).toBe("שם חדש");
  expect(saved.data.budget).toBeUndefined();
});

test("fetchAllTrips lifts budgetSummary even though it strips data", async () => {
  const trip = await tripService.createNewTrip({ title: "בדיקה", days: 2 });
  await tripService.saveTrip(trip.id, { data: { ...trip.data, budget: BUDGET } });

  const list = await tripService.fetchAllTrips();
  const row = list.find((t) => t.id === trip.id);
  expect(row.data).toBeUndefined();
  expect(row.budgetSummary.effectiveIlsMinor).toBe(400000);
});

test("a trip with no budget lists a null budgetSummary", async () => {
  const trip = await tripService.createNewTrip({ title: "בדיקה", days: 2 });
  const list = await tripService.fetchAllTrips();
  expect(list.find((t) => t.id === trip.id).budgetSummary).toBeNull();
});

test("rowToTrip lifts the summary out of the Supabase row shape", () => {
  const trip = rowToTrip({
    id: "t1", title: "t", owner_id: "u1",
    data: { tripData: [], budget: { ...BUDGET, summary: summarize(BUDGET) } },
  });
  expect(trip.budgetSummary.effectiveIlsMinor).toBe(400000);
});

test("rowToTrip yields a null summary for a trip without a budget", () => {
  const trip = rowToTrip({ id: "t1", title: "t", owner_id: "u1", data: { tripData: [] } });
  expect(trip.budgetSummary).toBeNull();
});
