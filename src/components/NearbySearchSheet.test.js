import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import NearbySearchSheet from "./NearbySearchSheet";

test("picking a chip calls onPick with its type", () => {
  const onPick = jest.fn();
  render(<NearbySearchSheet point={{ nameHe: "המלון" }} onPick={onPick} onClose={() => {}} />);
  fireEvent.click(screen.getByText("מסעדות"));
  expect(onPick).toHaveBeenCalledWith({ type: "restaurant" });
});

test("submitting free text calls onPick with the keyword", () => {
  const onPick = jest.fn();
  render(<NearbySearchSheet point={{ nameHe: "המלון" }} onPick={onPick} onClose={() => {}} />);
  const input = screen.getByPlaceholderText(/אחר/);
  fireEvent.change(input, { target: { value: "ראמן" } });
  fireEvent.keyDown(input, { key: "Enter" });
  expect(onPick).toHaveBeenCalledWith({ keyword: "ראמן" });
});
