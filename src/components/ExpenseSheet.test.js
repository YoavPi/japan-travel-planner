import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import ExpenseSheet from "./ExpenseSheet";
import { LIGHT } from "../utils/theme";
import { BASE_CATEGORIES } from "../utils/budget";

const config = { currency: "JPY", rate: 0.023, totalIlsMinor: 1500000, categories: [] };
const baseProps = (over = {}) => ({
  open: true,
  onClose: jest.fn(),
  onSubmit: jest.fn(),
  onDelete: jest.fn(),
  expense: null,
  config,
  categories: BASE_CATEGORIES,
  dayCount: 3,
  P: LIGHT,
  ...over,
});

test("renders nothing when closed", () => {
  const { container } = render(<ExpenseSheet {...baseProps({ open: false })} />);
  expect(container).toBeEmptyDOMElement();
});

test("add mode: submits an amount in the selected currency's minor units", () => {
  const props = baseProps();
  render(<ExpenseSheet {...props} />);
  fireEvent.change(screen.getByLabelText("תיאור ההוצאה"), { target: { value: "ראמן אפורי" } });
  fireEvent.change(screen.getByLabelText("סכום"), { target: { value: "1200" } });
  fireEvent.click(screen.getByRole("button", { name: "הוספה" }));

  expect(props.onSubmit).toHaveBeenCalledWith(expect.objectContaining({
    label: "ראמן אפורי", amountMinor: 1200, currency: "JPY",
  }));
});

test("switching to shekels reinterprets the amount with two decimals", () => {
  const props = baseProps();
  render(<ExpenseSheet {...props} />);
  fireEvent.change(screen.getByLabelText("תיאור ההוצאה"), { target: { value: "טיסה" } });
  fireEvent.change(screen.getByLabelText("סכום"), { target: { value: "4000" } });
  fireEvent.click(screen.getByRole("radio", { name: "₪" }));
  fireEvent.click(screen.getByRole("button", { name: "הוספה" }));

  expect(props.onSubmit).toHaveBeenCalledWith(expect.objectContaining({
    amountMinor: 400000, currency: "ILS",
  }));
});

test("a day can be attached or left general", () => {
  const props = baseProps();
  render(<ExpenseSheet {...props} />);
  fireEvent.change(screen.getByLabelText("תיאור ההוצאה"), { target: { value: "כניסה" } });
  fireEvent.change(screen.getByLabelText("סכום"), { target: { value: "500" } });
  fireEvent.change(screen.getByLabelText("שיוך ליום"), { target: { value: "2" } });
  fireEvent.click(screen.getByRole("button", { name: "הוספה" }));

  expect(props.onSubmit).toHaveBeenCalledWith(expect.objectContaining({ dayRef: 2 }));
});

test("general is the default day", () => {
  const props = baseProps();
  render(<ExpenseSheet {...props} />);
  fireEvent.change(screen.getByLabelText("תיאור ההוצאה"), { target: { value: "ביטוח" } });
  fireEvent.change(screen.getByLabelText("סכום"), { target: { value: "320" } });
  fireEvent.click(screen.getByRole("button", { name: "הוספה" }));
  expect(props.onSubmit).toHaveBeenCalledWith(expect.objectContaining({ dayRef: null }));
});

test("edit mode pre-fills, relabels the button, and offers delete", () => {
  const expense = { id: "e_a", label: "ראמן", amountMinor: 1200, currency: "JPY",
                    category: "food", dayRef: 1, note: "" };
  const props = baseProps({ expense });
  render(<ExpenseSheet {...props} />);

  expect(screen.getByLabelText("תיאור ההוצאה")).toHaveValue("ראמן");
  expect(screen.getByLabelText("סכום")).toHaveValue("1200");
  expect(screen.getByRole("button", { name: "שמירה" })).toBeInTheDocument();

  fireEvent.click(screen.getByRole("button", { name: "מחיקת ההוצאה" }));
  fireEvent.click(screen.getByRole("button", { name: "כן, למחוק" }));
  expect(props.onDelete).toHaveBeenCalledWith("e_a");
});

test("add mode offers no delete", () => {
  render(<ExpenseSheet {...baseProps()} />);
  expect(screen.queryByRole("button", { name: "מחיקת ההוצאה" })).not.toBeInTheDocument();
});

test("an invalid amount blocks submission and explains why", () => {
  const props = baseProps();
  render(<ExpenseSheet {...props} />);
  fireEvent.change(screen.getByLabelText("תיאור ההוצאה"), { target: { value: "x" } });
  fireEvent.change(screen.getByLabelText("סכום"), { target: { value: "abc" } });
  fireEvent.click(screen.getByRole("button", { name: "הוספה" }));
  expect(props.onSubmit).not.toHaveBeenCalled();
  expect(screen.getByRole("alert")).toHaveTextContent("סכום לא תקין");
});

test("an empty description blocks submission", () => {
  const props = baseProps();
  render(<ExpenseSheet {...props} />);
  fireEvent.change(screen.getByLabelText("סכום"), { target: { value: "100" } });
  fireEvent.click(screen.getByRole("button", { name: "הוספה" }));
  expect(props.onSubmit).not.toHaveBeenCalled();
  expect(screen.getByRole("alert")).toHaveTextContent("תיאור");
});

test("a foreign amount previews its shekel equivalent", () => {
  render(<ExpenseSheet {...baseProps()} />);
  fireEvent.change(screen.getByLabelText("סכום"), { target: { value: "1200" } });
  expect(screen.getByTestId("ils-preview")).toHaveTextContent("₪27.60");
});

test("Escape closes the sheet", () => {
  const props = baseProps();
  render(<ExpenseSheet {...props} />);
  fireEvent.keyDown(document, { key: "Escape" });
  expect(props.onClose).toHaveBeenCalled();
});

// C1 — a 2-decimal foreign currency round-trips without a 100x inflation
test("edit mode: a EUR amount shows its major units and re-saves unchanged", () => {
  const props = baseProps({
    config: { currency: "EUR", rate: 4, totalIlsMinor: 1500000, categories: [] },
    expense: { id: "e_eur", label: "מלון", amountMinor: 4550, currency: "EUR",
               category: "lodging", dayRef: null, note: "" },
  });
  render(<ExpenseSheet {...props} />);
  expect(screen.getByLabelText("סכום")).toHaveValue("45.5");

  fireEvent.click(screen.getByRole("button", { name: "שמירה" }));
  expect(props.onSubmit).toHaveBeenCalledWith(expect.objectContaining({
    amountMinor: 4550, currency: "EUR",
  }));
});

// I2 — changing an existing expense's currency clears the recorded paid/actual
test("edit mode: switching currency on a paid expense resets paid + actual", () => {
  const props = baseProps({
    config: { currency: "JPY", rate: 0.023, totalIlsMinor: 1500000, categories: [] },
    expense: { id: "e_p", label: "ראמן", amountMinor: 1200, currency: "JPY",
               category: "food", dayRef: null, note: "", paid: true, actualMinor: 1500 },
  });
  render(<ExpenseSheet {...props} />);
  fireEvent.click(screen.getByRole("radio", { name: "₪" }));
  expect(screen.getByText('שינוי מטבע יאפס את סימון "שולם"')).toBeInTheDocument();

  fireEvent.click(screen.getByRole("button", { name: "שמירה" }));
  expect(props.onSubmit).toHaveBeenCalledWith(expect.objectContaining({
    currency: "ILS", paid: false, actualMinor: null,
  }));
});
