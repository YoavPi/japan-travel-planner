import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import BudgetSetupSheet from "./BudgetSetupSheet";
import { LIGHT } from "../utils/theme";

const config = {
  currency: "ILS", rate: 1, totalIlsMinor: 0, categories: [],
};
const baseProps = () => ({
  open: true,
  onClose: jest.fn(),
  onSave: jest.fn(),
  config,
  P: LIGHT,
});

test("renders nothing when closed", () => {
  const { container } = render(<BudgetSetupSheet {...baseProps()} open={false} />);
  expect(container).toBeEmptyDOMElement();
});

test("saving a total converts shekels to agorot", () => {
  const props = baseProps();
  render(<BudgetSetupSheet {...props} />);
  fireEvent.change(screen.getByLabelText("תקציב כולל בשקלים"), { target: { value: "15000" } });
  fireEvent.click(screen.getByRole("button", { name: "שמירה" }));
  expect(props.onSave).toHaveBeenCalledWith(expect.objectContaining({ totalIlsMinor: 1500000 }));
});

test("the rate field appears only for a non-shekel currency", () => {
  const props = baseProps();
  render(<BudgetSetupSheet {...props} />);
  expect(screen.queryByLabelText(/שער המרה/)).not.toBeInTheDocument();

  fireEvent.change(screen.getByLabelText("מטבע היעד"), { target: { value: "JPY" } });
  expect(screen.getByLabelText(/שער המרה/)).toBeInTheDocument();
});

test("a category cap is saved in agorot against its key", () => {
  const props = baseProps();
  render(<BudgetSetupSheet {...props} />);
  fireEvent.change(screen.getByLabelText("תקרה עבור לינה"), { target: { value: "5000" } });
  fireEvent.click(screen.getByRole("button", { name: "שמירה" }));

  const saved = props.onSave.mock.calls[0][0];
  expect(saved.categories).toContainEqual(
    expect.objectContaining({ key: "lodging", capIlsMinor: 500000 }));
});

test("a category left blank is saved with a null cap", () => {
  const props = baseProps();
  render(<BudgetSetupSheet {...props} />);
  fireEvent.change(screen.getByLabelText("תקרה עבור אוכל"), { target: { value: "2000" } });
  fireEvent.click(screen.getByRole("button", { name: "שמירה" }));

  const saved = props.onSave.mock.calls[0][0];
  expect(saved.categories.find((c) => c.key === "lodging").capIlsMinor).toBeNull();
});

test("adding a custom category gives it a c_ key and a cap field", () => {
  const props = baseProps();
  render(<BudgetSetupSheet {...props} />);
  fireEvent.change(screen.getByLabelText("שם קטגוריה חדשה"), { target: { value: "מזכרות" } });
  fireEvent.click(screen.getByRole("button", { name: "הוספת קטגוריה" }));

  fireEvent.change(screen.getByLabelText("תקרה עבור מזכרות"), { target: { value: "800" } });
  fireEvent.click(screen.getByRole("button", { name: "שמירה" }));

  const saved = props.onSave.mock.calls[0][0];
  const custom = saved.categories.find((c) => c.label === "מזכרות");
  expect(custom.key).toMatch(/^c_/);
  expect(custom.custom).toBe(true);
  expect(custom.capIlsMinor).toBe(80000);
});

test("the allocation line reports what is still unallocated", () => {
  const props = baseProps();
  render(<BudgetSetupSheet {...props} />);
  fireEvent.change(screen.getByLabelText("תקציב כולל בשקלים"), { target: { value: "15000" } });
  fireEvent.change(screen.getByLabelText("תקרה עבור לינה"), { target: { value: "5000" } });
  expect(screen.getByTestId("allocation-line")).toHaveTextContent("לא מוקצה");
  expect(screen.getByTestId("allocation-line")).toHaveTextContent("₪10,000.00");
});

test("invalid amounts block the save and explain why", () => {
  const props = baseProps();
  render(<BudgetSetupSheet {...props} />);
  fireEvent.change(screen.getByLabelText("תקציב כולל בשקלים"), { target: { value: "-5" } });
  fireEvent.click(screen.getByRole("button", { name: "שמירה" }));
  expect(props.onSave).not.toHaveBeenCalled();
  expect(screen.getByRole("alert")).toHaveTextContent("סכום לא תקין");
});

test("Escape closes the sheet", () => {
  const props = baseProps();
  render(<BudgetSetupSheet {...props} />);
  fireEvent.keyDown(document, { key: "Escape" });
  expect(props.onClose).toHaveBeenCalled();
});

test("the dialog is labelled for screen readers", () => {
  render(<BudgetSetupSheet {...baseProps()} />);
  expect(screen.getByRole("dialog")).toHaveAccessibleName("הגדרת תקציב");
});
