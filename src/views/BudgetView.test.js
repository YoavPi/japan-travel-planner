import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import BudgetView from "./BudgetView";
import tripService from "../services/tripService";

jest.mock("../services/tripService", () => ({
  __esModule: true,
  default: { fetchTripById: jest.fn(), saveTrip: jest.fn(() => Promise.resolve({})) },
}));

const withBudget = {
  config: {
    currency: "JPY", rate: 0.023, totalIlsMinor: 1500000,
    categories: [
      { key: "flights", label: "טיסות", capIlsMinor: 400000 },
      { key: "food", label: "אוכל", capIlsMinor: 200000 },
    ],
  },
  items: [
    { id: "e_1", label: "טיסה תל אביב–טוקיו", amountMinor: 400000, currency: "ILS",
      category: "flights", dayRef: null, paid: true, actualMinor: null },
    { id: "e_2", label: "ראמן אפורי", amountMinor: 1200, currency: "JPY",
      category: "food", dayRef: 1, paid: false, actualMinor: null },
  ],
};

const makeTrip = (budget) => ({
  id: "t1", title: "ירח דבש ביפן", readOnly: false, days: 3,
  data: { tripData: [{ day: 1, attractions: [] }, { day: 2, attractions: [] }, { day: 3, attractions: [] }],
          ...(budget ? { budget } : {}) },
});

const renderView = () => render(
  <MemoryRouter initialEntries={["/trip/budget/t1"]}>
    <Routes><Route path="/trip/budget/:tripId" element={<BudgetView />} /></Routes>
  </MemoryRouter>
);

beforeEach(() => {
  tripService.fetchTripById.mockReset();
  tripService.saveTrip.mockReset().mockImplementation(() => Promise.resolve({}));
});

test("empty state invites the user to set a budget", async () => {
  tripService.fetchTripById.mockResolvedValue(makeTrip(null));
  renderView();
  expect(await screen.findByText("עוד לא הגדרת תקציב לטיול")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "הגדרת תקציב" })).toBeInTheDocument();
});

test("summary shows effective against the target, plus planned and actual", async () => {
  tripService.fetchTripById.mockResolvedValue(makeTrip(withBudget));
  renderView();
  // effective = 400000 + 2760 = 402760
  expect(await screen.findByTestId("summary-effective")).toHaveTextContent("₪4,027.60");
  expect(screen.getByTestId("summary-total")).toHaveTextContent("₪15,000.00");
  expect(screen.getByTestId("summary-planned")).toHaveTextContent("₪4,027.60");
  expect(screen.getByTestId("summary-actual")).toHaveTextContent("₪4,000.00");
});

test("the progress bar exposes real ARIA values", async () => {
  tripService.fetchTripById.mockResolvedValue(makeTrip(withBudget));
  renderView();
  const bar = await screen.findByRole("progressbar");
  expect(bar).toHaveAttribute("aria-valuemin", "0");
  expect(bar).toHaveAttribute("aria-valuemax", "1500000");
  expect(bar).toHaveAttribute("aria-valuenow", "402760");
});

test("the allocation line reports what is unallocated", async () => {
  tripService.fetchTripById.mockResolvedValue(makeTrip(withBudget));
  renderView();
  // 1500000 - (400000 + 200000) = 900000
  expect(await screen.findByTestId("allocation")).toHaveTextContent("₪9,000.00");
});

test("grouped by category by default, each capped group showing its cap", async () => {
  tripService.fetchTripById.mockResolvedValue(makeTrip(withBudget));
  renderView();
  const heads = (await screen.findAllByRole("heading", { level: 3 })).map((h) => h.textContent);
  expect(heads).toContain("טיסות");
  expect(heads).toContain("אוכל");
  expect(screen.getByText("טיסה תל אביב–טוקיו")).toBeInTheDocument();
});

test("switching to the day view regroups the same expenses", async () => {
  tripService.fetchTripById.mockResolvedValue(makeTrip(withBudget));
  renderView();
  fireEvent.click(await screen.findByRole("button", { name: "לפי יום" }));
  const heads = screen.getAllByRole("heading", { level: 3 }).map((h) => h.textContent);
  expect(heads).toContain("כללי");
  expect(heads).toContain("יום 1");
});

test("going over budget is announced in words, not only in colour", async () => {
  const over = {
    ...withBudget,
    config: { ...withBudget.config, totalIlsMinor: 100000 },
  };
  tripService.fetchTripById.mockResolvedValue(makeTrip(over));
  renderView();
  expect(await screen.findByTestId("summary-state")).toHaveTextContent("חריגה");
});

test("within budget reports what remains", async () => {
  tripService.fetchTripById.mockResolvedValue(makeTrip(withBudget));
  renderView();
  expect(await screen.findByTestId("summary-state")).toHaveTextContent("נותרו");
});

test("adding an expense persists through saveTrip", async () => {
  tripService.fetchTripById.mockResolvedValue(makeTrip(withBudget));
  renderView();
  fireEvent.click(await screen.findByRole("button", { name: "הוספת הוצאה" }));
  fireEvent.change(screen.getByLabelText("תיאור ההוצאה"), { target: { value: "ביטוח" } });
  fireEvent.change(screen.getByLabelText("סכום"), { target: { value: "320" } });
  fireEvent.click(screen.getByRole("button", { name: "הוספה" }));

  await waitFor(() => expect(tripService.saveTrip).toHaveBeenCalled());
  expect(screen.getByText("ביטוח")).toBeInTheDocument();
});

test("a read-only trip shows the numbers but offers no add button", async () => {
  tripService.fetchTripById.mockResolvedValue({ ...makeTrip(withBudget), readOnly: true });
  renderView();
  expect(await screen.findByTestId("summary-effective")).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "הוספת הוצאה" })).not.toBeInTheDocument();
});

test("a load failure is reported rather than left blank", async () => {
  tripService.fetchTripById.mockRejectedValue(new Error("nope"));
  renderView();
  expect(await screen.findByRole("alert")).toHaveTextContent("לא ניתן לטעון");
});
