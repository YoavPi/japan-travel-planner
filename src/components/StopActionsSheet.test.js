import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import StopActionsSheet from "./StopActionsSheet";

const baseProps = { stop: { name: "Sensoji" }, days: [{ day: 1 }], onClose: () => {}, onDelete: () => {} };

test("no cost yet: shows 'הוסף עלות' and calls onSetCost on click", () => {
  const onSetCost = jest.fn();
  render(<StopActionsSheet {...baseProps} onSetCost={onSetCost} stopCostLabel={null} />);

  const row = screen.getByText("הוסף עלות");
  fireEvent.click(row);
  expect(onSetCost).toHaveBeenCalled();
});

test("existing cost: shows the amount in the row label", () => {
  render(<StopActionsSheet {...baseProps} onSetCost={() => {}} stopCostLabel="₪120.00" />);
  expect(screen.getByText("עריכת עלות · ₪120.00")).toBeInTheDocument();
});

test("onSetCost omitted: no cost row rendered at all", () => {
  render(<StopActionsSheet {...baseProps} />);
  expect(screen.queryByText("הוסף עלות")).not.toBeInTheDocument();
});
