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

test("a fresh budget persists only the categories that were given a cap", () => {
  const props = baseProps();
  render(<BudgetSetupSheet {...props} />);
  fireEvent.change(screen.getByLabelText("תקרה עבור אוכל"), { target: { value: "2000" } });
  fireEvent.click(screen.getByRole("button", { name: "שמירה" }));

  const saved = props.onSave.mock.calls[0][0];
  // only "food" was capped — no blank base category tags along
  expect(saved.categories).toEqual([
    expect.objectContaining({ key: "food", capIlsMinor: 200000 }),
  ]);
});

test("a previously-declared category keeps its row when its cap is cleared", () => {
  const props = baseProps();
  props.config = { ...config, categories: [{ key: "lodging", label: "לינה", capIlsMinor: 500000 }] };
  render(<BudgetSetupSheet {...props} />);
  // wipe the pre-filled lodging cap
  fireEvent.change(screen.getByLabelText("תקרה עבור לינה"), { target: { value: "" } });
  fireEvent.click(screen.getByRole("button", { name: "שמירה" }));

  const saved = props.onSave.mock.calls[0][0];
  const lodging = saved.categories.find((c) => c.key === "lodging");
  expect(lodging).toBeDefined();
  expect(lodging.capIlsMinor).toBeNull();
});

test("the currency select is disabled while foreign-currency expenses exist", () => {
  const props = baseProps();
  props.foreignItemsPresent = true;
  render(<BudgetSetupSheet {...props} />);
  expect(screen.getByLabelText("מטבע היעד")).toBeDisabled();
  expect(screen.getByText("יש הוצאות במטבע זר — שינוי המטבע ייפתח בהמשך")).toBeInTheDocument();
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

test("changing the rate with paid non-ILS items shows a confirm before saving", () => {
  const onSave = jest.fn();
  const config = { currency: "THB", rate: 10, categories: [] };
  const items = [{ id: "e1", amountMinor: 10000, currency: "THB", paid: true }];
  render(<BudgetSetupSheet open onClose={() => {}} onSave={onSave} config={config} items={items} P={LIGHT} />);

  fireEvent.change(screen.getByLabelText(/שער המרה/), { target: { value: "12" } });
  fireEvent.click(screen.getByText("שמירה"));

  expect(onSave).not.toHaveBeenCalled();
  expect(screen.getByText(/יעריך מחדש/)).toBeInTheDocument();

  fireEvent.click(screen.getByText("עדכן שער"));
  expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ rate: 12 }));
});

test("changing the rate with no paid non-ILS items saves immediately, no confirm", () => {
  const onSave = jest.fn();
  const config = { currency: "THB", rate: 10, categories: [] };
  render(<BudgetSetupSheet open onClose={() => {}} onSave={onSave} config={config} items={[]} P={LIGHT} />);

  fireEvent.change(screen.getByLabelText(/שער המרה/), { target: { value: "12" } });
  fireEvent.click(screen.getByText("שמירה"));

  expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ rate: 12 }));
});
