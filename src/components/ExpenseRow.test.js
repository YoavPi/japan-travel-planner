import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import ExpenseRow from "./ExpenseRow";
import { LIGHT } from "../utils/theme";

const config = { currency: "JPY", rate: 0.023 };
const item = {
  id: "e_a", label: "ראמן אפורי", amountMinor: 1200, currency: "JPY",
  category: "food", dayRef: 1, paid: false, actualMinor: null, note: "",
};
const baseProps = (over = {}) => ({
  item, config, dayLabel: "יום 1", categoryLabel: "אוכל",
  readOnly: false, P: LIGHT,
  onEdit: jest.fn(), onMarkPaid: jest.fn(),
  ...over,
});

test("shows the label, the entry-currency amount and the shekel equivalent", () => {
  render(<ExpenseRow {...baseProps()} />);
  expect(screen.getByText("ראמן אפורי")).toBeInTheDocument();
  expect(screen.getByTestId("row-amount")).toHaveTextContent("¥1,200");
  expect(screen.getByTestId("row-ils")).toHaveTextContent("₪27.60");
});

test("an ILS expense shows no redundant second figure", () => {
  const ils = { ...item, amountMinor: 400000, currency: "ILS" };
  render(<ExpenseRow {...baseProps({ item: ils })} />);
  expect(screen.getByTestId("row-amount")).toHaveTextContent("₪4,000.00");
  expect(screen.queryByTestId("row-ils")).not.toBeInTheDocument();
});

/* THE FLOW: tick → "was it different?" → no → paid with no actual amount. */
test("ticking paid then 'same amount' records paid with no actual", () => {
  const props = baseProps();
  render(<ExpenseRow {...props} />);
  fireEvent.click(screen.getByRole("button", { name: "סימון ראמן אפורי כשולם" }));

  expect(screen.getByText("האם העלות הייתה שונה?")).toBeInTheDocument();
  expect(props.onMarkPaid).not.toHaveBeenCalled();

  fireEvent.click(screen.getByRole("button", { name: "לא, אותו סכום" }));
  expect(props.onMarkPaid).toHaveBeenCalledWith("e_a", true, null);
});

/* …→ yes → a single numeric field → paid with the real amount. */
test("ticking paid then 'yes' asks for the real amount", () => {
  const props = baseProps();
  render(<ExpenseRow {...props} />);
  fireEvent.click(screen.getByRole("button", { name: "סימון ראמן אפורי כשולם" }));
  fireEvent.click(screen.getByRole("button", { name: "כן" }));

  fireEvent.change(screen.getByLabelText("הסכום ששולם בפועל"), { target: { value: "1500" } });
  fireEvent.click(screen.getByRole("button", { name: "אישור" }));
  expect(props.onMarkPaid).toHaveBeenCalledWith("e_a", true, 1500);
});

test("an invalid actual amount is rejected without calling back", () => {
  const props = baseProps();
  render(<ExpenseRow {...props} />);
  fireEvent.click(screen.getByRole("button", { name: "סימון ראמן אפורי כשולם" }));
  fireEvent.click(screen.getByRole("button", { name: "כן" }));
  fireEvent.change(screen.getByLabelText("הסכום ששולם בפועל"), { target: { value: "abc" } });
  fireEvent.click(screen.getByRole("button", { name: "אישור" }));
  expect(props.onMarkPaid).not.toHaveBeenCalled();
});

test("un-ticking a paid expense clears the actual amount immediately, with no prompt", () => {
  const paid = { ...item, paid: true, actualMinor: 1500 };
  const props = baseProps({ item: paid });
  render(<ExpenseRow {...props} />);
  fireEvent.click(screen.getByRole("button", { name: "ביטול סימון ראמן אפורי כשולם" }));
  expect(props.onMarkPaid).toHaveBeenCalledWith("e_a", false, null);
  expect(screen.queryByText("האם העלות הייתה שונה?")).not.toBeInTheDocument();
});

test("a paid expense that cost more shows both figures", () => {
  const paid = { ...item, paid: true, actualMinor: 1500 };
  render(<ExpenseRow {...baseProps({ item: paid })} />);
  expect(screen.getByTestId("row-amount")).toHaveTextContent("¥1,500");
  expect(screen.getByTestId("row-planned")).toHaveTextContent("¥1,200");
});

test("the day and category are shown as text, not only as colour", () => {
  render(<ExpenseRow {...baseProps()} />);
  expect(screen.getByText("יום 1")).toBeInTheDocument();
  expect(screen.getByText("אוכל")).toBeInTheDocument();
});

test("clicking the row opens the editor", () => {
  const props = baseProps();
  render(<ExpenseRow {...props} />);
  fireEvent.click(screen.getByRole("button", { name: "עריכת ראמן אפורי" }));
  expect(props.onEdit).toHaveBeenCalledWith(item);
});

test("read-only hides both the tick and the edit affordance", () => {
  render(<ExpenseRow {...baseProps({ readOnly: true })} />);
  expect(screen.queryByRole("button", { name: /כשולם/ })).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: /עריכת/ })).not.toBeInTheDocument();
});

test("the paid control meets the 44px touch target", () => {
  render(<ExpenseRow {...baseProps()} />);
  const btn = screen.getByRole("button", { name: "סימון ראמן אפורי כשולם" });
  expect(btn).toHaveStyle({ minWidth: "44px", minHeight: "44px" });
});
