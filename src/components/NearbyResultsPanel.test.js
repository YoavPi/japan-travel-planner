import React from "react";
import { render, screen, fireEvent, within } from "@testing-library/react";
import NearbyResultsPanel from "./NearbyResultsPanel";

const results = [
  { placeId: "p1", name: "Trattoria Uno", secondary: "Via Roma 1", lat: 43.1, lng: 11.1, rating: 4.6, types: ["restaurant"] },
  { placeId: "p2", name: "Bar Due", secondary: "Piazza 2", lat: 43.2, lng: 11.2, rating: null, types: ["bar"] },
];
const days = [{ day: 1 }, { day: 2 }, { day: 3 }];

const base = {
  origin: { nameHe: "המלון" },
  results, activeDay: 2, days,
  detailsById: {},
  onWantDetails: jest.fn(),
  onAdd: jest.fn(),
  onSetDay: jest.fn(),
  onOpen: jest.fn(),
  onClose: jest.fn(),
  addedKeys: new Set(),
};

test("renders a row per result with name + address, header names the origin", () => {
  render(<NearbyResultsPanel {...base} />);
  expect(screen.getByText(/נקודות ליד/)).toBeInTheDocument();
  expect(screen.getByText("המלון")).toBeInTheDocument();
  expect(screen.getByText("Trattoria Uno")).toBeInTheDocument();
  expect(screen.getByText("Via Roma 1")).toBeInTheDocument();
  expect(screen.getByText("Bar Due")).toBeInTheDocument();
});

test("requests details for each row on mount", () => {
  const onWantDetails = jest.fn();
  render(<NearbyResultsPanel {...base} onWantDetails={onWantDetails} />);
  expect(onWantDetails).toHaveBeenCalledWith("p1");
  expect(onWantDetails).toHaveBeenCalledWith("p2");
});

test("＋ הוספה calls onAdd with the result", () => {
  const onAdd = jest.fn();
  render(<NearbyResultsPanel {...base} onAdd={onAdd} />);
  fireEvent.click(screen.getByLabelText("הוספת Trattoria Uno למסלול"));
  expect(onAdd).toHaveBeenCalledWith(expect.objectContaining({ placeId: "p1" }));
});

test("an added row shows ✓ נוסף and is disabled", () => {
  render(<NearbyResultsPanel {...base} addedKeys={new Set(["p1"])} />);
  const btn = screen.getByLabelText("נוסף למסלול");
  expect(btn).toBeDisabled();
  expect(btn).toHaveTextContent("✓ נוסף");
});

test("day switcher calls onSetDay", () => {
  const onSetDay = jest.fn();
  render(<NearbyResultsPanel {...base} onSetDay={onSetDay} />);
  fireEvent.click(screen.getByLabelText("יום 3"));
  expect(onSetDay).toHaveBeenCalledWith(3);
});

test("✕ calls onClose", () => {
  const onClose = jest.fn();
  render(<NearbyResultsPanel {...base} onClose={onClose} />);
  fireEvent.click(screen.getByLabelText("סגירת התוצאות"));
  expect(onClose).toHaveBeenCalledTimes(1);
});

test("a loaded editorial description renders; a row without details shows a skeleton", () => {
  const { rerender, container } = render(<NearbyResultsPanel {...base} />);
  expect(container.querySelectorAll(".tp-skel").length).toBe(results.length);

  rerender(<NearbyResultsPanel {...base} detailsById={{ p1: { address: "Via Roma 1", description: "מזרקה מפורסמת מהמאה ה-16." } }} />);
  expect(screen.getByText("מזרקה מפורסמת מהמאה ה-16.")).toBeInTheDocument();
  expect(container.querySelectorAll(".tp-skel").length).toBe(1); // only p2 still loading
});

test("clicking a row body calls onOpen", () => {
  const onOpen = jest.fn();
  render(<NearbyResultsPanel {...base} onOpen={onOpen} />);
  fireEvent.click(screen.getByText("Trattoria Uno"));
  expect(onOpen).toHaveBeenCalledWith(expect.objectContaining({ placeId: "p1" }));
});

test("sheet variant: collapsed hides the list; the toggle calls onToggleCollapse", () => {
  const onToggleCollapse = jest.fn();
  const { rerender } = render(
    <NearbyResultsPanel {...base} variant="sheet" collapsed={false} onToggleCollapse={onToggleCollapse} />
  );
  expect(screen.getByText("Trattoria Uno")).toBeInTheDocument();
  fireEvent.click(screen.getByLabelText("מזעור הרשימה"));
  expect(onToggleCollapse).toHaveBeenCalledTimes(1);

  rerender(<NearbyResultsPanel {...base} variant="sheet" collapsed onToggleCollapse={onToggleCollapse} />);
  expect(screen.queryByText("Trattoria Uno")).toBeNull();          // list hidden
  expect(screen.getByText(/נקודות ליד/)).toBeInTheDocument();       // header still shown
  expect(screen.getByLabelText("הרחבת הרשימה")).toBeInTheDocument(); // toggle flips to expand
});

test("rail variant has no collapse toggle", () => {
  render(<NearbyResultsPanel {...base} onToggleCollapse={jest.fn()} />);
  expect(screen.queryByLabelText("מזעור הרשימה")).toBeNull();
});
