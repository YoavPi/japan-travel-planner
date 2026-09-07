import React from "react";
import { render, screen, fireEvent, within } from "@testing-library/react";
import EditorBottomBar from "./EditorBottomBar";

const base = (over = {}) => ({
  bankCount: 0,
  onBank: jest.fn(),
  showViewToggle: true,
  continuousMode: false,
  onSetContinuous: jest.fn(),
  editable: true,
  daysCount: 5,
  dayEditMode: false,
  onReorderDays: jest.fn(),
  onSummary: jest.fn(),
  onDates: jest.fn(),
  onEditSkeleton: jest.fn(),
  hasDates: true,
  ...over,
});

test("every primary control carries a visible Hebrew label", () => {
  render(<EditorBottomBar {...base()} />);
  expect(screen.getByText("בנק הנקודות")).toBeInTheDocument();
  expect(screen.getByText("ימים")).toBeInTheDocument();
  expect(screen.getByText("רציף")).toBeInTheDocument();
  expect(screen.getByText("עוד")).toBeInTheDocument();
});

test("bank badge shows the saved-point count and reads it in the aria-label", () => {
  render(<EditorBottomBar {...base({ bankCount: 12 })} />);
  const bank = screen.getByRole("button", { name: "בנק הנקודות, 12 שמורות" });
  expect(within(bank).getByText("12")).toBeInTheDocument();
});

test("no badge when the bank is empty", () => {
  render(<EditorBottomBar {...base({ bankCount: 0 })} />);
  expect(screen.getByRole("button", { name: "בנק הנקודות" })).toBeInTheDocument();
});

test("bank tap fires onBank", () => {
  const onBank = jest.fn();
  render(<EditorBottomBar {...base({ onBank })} />);
  fireEvent.click(screen.getByText("בנק הנקודות"));
  expect(onBank).toHaveBeenCalledTimes(1);
});

test("the view toggle reflects and drives continuousMode", () => {
  const onSetContinuous = jest.fn();
  const { rerender } = render(<EditorBottomBar {...base({ continuousMode: false, onSetContinuous })} />);
  expect(screen.getByRole("button", { name: "ימים" })).toHaveAttribute("aria-pressed", "true");
  expect(screen.getByRole("button", { name: "רציף" })).toHaveAttribute("aria-pressed", "false");

  fireEvent.click(screen.getByRole("button", { name: "רציף" }));
  expect(onSetContinuous).toHaveBeenCalledWith(true);

  rerender(<EditorBottomBar {...base({ continuousMode: true, onSetContinuous })} />);
  expect(screen.getByRole("button", { name: "רציף" })).toHaveAttribute("aria-pressed", "true");
  fireEvent.click(screen.getByRole("button", { name: "ימים" }));
  expect(onSetContinuous).toHaveBeenCalledWith(false);
});

test("the view toggle is hidden when the trip has one day or fewer", () => {
  render(<EditorBottomBar {...base({ showViewToggle: false })} />);
  expect(screen.queryByText("ימים")).not.toBeInTheDocument();
  expect(screen.queryByText("רציף")).not.toBeInTheDocument();
  expect(screen.getByText("בנק הנקודות")).toBeInTheDocument();
  expect(screen.getByText("עוד")).toBeInTheDocument();
});

test("'עוד' opens a menu of the rarer actions and each one fires its handler", () => {
  const p = base();
  render(<EditorBottomBar {...p} />);
  fireEvent.click(screen.getByText("עוד"));

  fireEvent.click(screen.getByText("סידור מחדש של הימים"));
  expect(p.onReorderDays).toHaveBeenCalled();

  fireEvent.click(screen.getByText("עוד"));
  fireEvent.click(screen.getByText("סיכום הטיול"));
  expect(p.onSummary).toHaveBeenCalled();

  fireEvent.click(screen.getByText("עוד"));
  fireEvent.click(screen.getByText("שינוי תאריכי הטיול"));
  expect(p.onDates).toHaveBeenCalled();

  fireEvent.click(screen.getByText("עוד"));
  fireEvent.click(screen.getByText("עריכת שלד הטיול"));
  expect(p.onEditSkeleton).toHaveBeenCalled();
});

test("in the 'עוד' menu the reorder row reflects an active dayEditMode", () => {
  render(<EditorBottomBar {...base({ dayEditMode: true })} />);
  fireEvent.click(screen.getByText("עוד"));
  expect(screen.getByText("סיום סידור הימים")).toBeInTheDocument();
  expect(screen.queryByText("סידור מחדש של הימים")).not.toBeInTheDocument();
});

test("a read-only viewer gets no reorder and no skeleton-edit rows", () => {
  render(<EditorBottomBar {...base({ editable: false })} />);
  fireEvent.click(screen.getByText("עוד"));
  expect(screen.queryByText("סידור מחדש של הימים")).not.toBeInTheDocument();
  expect(screen.queryByText("עריכת שלד הטיול")).not.toBeInTheDocument();
  // but summary + dates remain
  expect(screen.getByText("סיכום הטיול")).toBeInTheDocument();
});

test("'הגדרת תאריכי הטיול' when the trip has no dates yet", () => {
  render(<EditorBottomBar {...base({ hasDates: false })} />);
  fireEvent.click(screen.getByText("עוד"));
  expect(screen.getByText("הגדרת תאריכי הטיול")).toBeInTheDocument();
});
