import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

jest.mock("../services/googlePlaces", () => ({
  isSearchEnabled: () => true,
  isPlacesEnabled: () => true,
  autocomplete: jest.fn(async () => []),
  textSearch: jest.fn(async () => []),
  getDetails: jest.fn(async () => ({ name: "אוסקה", lat: 34.69, lng: 135.5, types: ["locality"] })),
  RateLimitError: class extends Error {},
}));
jest.mock("../utils/classifyLocation", () => ({ classifyLocation: () => ({ category: "attraction", he: "אטרקציה" }) }), { virtual: true });

import EditorSearchBar from "./EditorSearchBar";
import { getDetails } from "../services/googlePlaces";

beforeEach(() => {
  localStorage.clear();
  getDetails.mockClear();
});

test("no recents stored → focusing the field shows nothing extra", () => {
  render(<EditorSearchBar onPreview={jest.fn()} activeDay={1} />);
  fireEvent.focus(screen.getByRole("textbox"));
  expect(screen.queryByText("חיפושים אחרונים")).not.toBeInTheDocument();
});

test("stored recents appear on focus, before any typing", () => {
  localStorage.setItem("tp_recent_searches", JSON.stringify([
    { placeId: "p1", primary: "אוסקה", secondary: "יפן" },
    { placeId: "p2", primary: "קיוטו", secondary: "יפן" },
  ]));
  render(<EditorSearchBar onPreview={jest.fn()} activeDay={3} />);
  fireEvent.focus(screen.getByRole("textbox"));
  expect(screen.getByText("חיפושים אחרונים")).toBeInTheDocument();
  expect(screen.getByText("אוסקה")).toBeInTheDocument();
  expect(screen.getByText("קיוטו")).toBeInTheDocument();
});

test("tapping a recent runs the same details lookup as a fresh result would", async () => {
  localStorage.setItem("tp_recent_searches", JSON.stringify([{ placeId: "p1", primary: "אוסקה", secondary: "יפן" }]));
  render(<EditorSearchBar onPreview={jest.fn()} activeDay={1} />);
  fireEvent.focus(screen.getByRole("textbox"));
  fireEvent.click(screen.getByText("אוסקה").closest("button"));
  // the recent row calls the same details path a fresh prediction does
  await waitFor(() => expect(getDetails).toHaveBeenCalledWith("p1"));
});

test("re-picking a stored recent moves it to the front and stays de-duped, capped at 6", async () => {
  const KEY = "tp_recent_searches";
  const read = () => JSON.parse(localStorage.getItem(KEY) || "[]");
  localStorage.setItem(KEY, JSON.stringify(
    Array.from({ length: 6 }, (_, i) => ({ placeId: `s${i}`, primary: `מקום ${i}`, secondary: "" }))
  ));
  render(<EditorSearchBar onPreview={jest.fn()} activeDay={1} />);
  fireEvent.focus(screen.getByRole("textbox"));
  fireEvent.click(screen.getByText("מקום 5").closest("button"));
  await waitFor(() => expect(read()[0].placeId).toBe("s5"));
  const after = read();
  expect(after).toHaveLength(6);
  expect(after.filter((r) => r.placeId === "s5")).toHaveLength(1);
});

test("the recents list is replaced by live predictions once you type 2+ chars", () => {
  localStorage.setItem("tp_recent_searches", JSON.stringify([{ placeId: "p1", primary: "אוסקה", secondary: "יפן" }]));
  render(<EditorSearchBar onPreview={jest.fn()} activeDay={1} />);
  const input = screen.getByRole("textbox");
  fireEvent.focus(input);
  expect(screen.getByText("חיפושים אחרונים")).toBeInTheDocument();
  fireEvent.change(input, { target: { value: "טו" } });
  expect(screen.queryByText("חיפושים אחרונים")).not.toBeInTheDocument();
});
