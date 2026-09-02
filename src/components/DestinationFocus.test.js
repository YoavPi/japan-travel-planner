import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import DestinationFocus from "./DestinationFocus";
import { track } from "../analytics/posthog";
import { autocomplete, getDetails } from "../services/googlePlaces";

jest.mock("../analytics/posthog", () => ({ track: jest.fn() }));

jest.mock("../services/googlePlaces", () => ({
  autocomplete: jest.fn(),
  getDetails: jest.fn(),
}));

// CRA's Jest preset sets resetMocks:true — mock implementations are wiped
// between tests, so re-wire them here.
beforeEach(() => {
  autocomplete.mockResolvedValue([
    { placeId: "c1", primary: "Chiang Mai", secondary: "Thailand", types: ["locality"] },
  ]);
  getDetails.mockImplementation(async (id) => ({ name: id === "c1" ? "Chiang Mai" : "X", place_id: id }));
});

const base = {
  destName: "תאילנד", scope: "country", curatedId: "th",
  onPick: jest.fn(), onSkip: jest.fn(),
};

test("country + curatedId: a chip per FOCUS_REGIONS entry; tap → onPick(region)", () => {
  const onPick = jest.fn();
  render(<DestinationFocus {...base} onPick={onPick} />);
  expect(screen.getByText("בנגקוק והמרכז")).toBeInTheDocument();
  expect(screen.getByText("הצפון")).toBeInTheDocument();
  fireEvent.click(screen.getByText("הצפון"));
  expect(onPick).toHaveBeenCalledWith(expect.objectContaining({
    kind: "region", label: "הצפון", cities: ["Chiang Mai", "Pai"],
  }));
});

test("region scope: no curated chips, city search present", () => {
  render(<DestinationFocus {...base} scope="region" curatedId={null} />);
  expect(screen.queryByText("בנגקוק והמרכז")).toBeNull();
  expect(screen.getByPlaceholderText(/עיר/)).toBeInTheDocument();
});

test("city picker: search → pick → chip → המשך fires onPick(cities, english names)", async () => {
  const onPick = jest.fn();
  render(<DestinationFocus {...base} onPick={onPick} />);
  fireEvent.click(screen.getByText(/בחר ערים/));
  const input = screen.getByPlaceholderText(/עיר/);
  fireEvent.change(input, { target: { value: "chiang" } });
  fireEvent.click(await screen.findByText(/Chiang Mai/));
  // wait for the async getDetails → picked-chip round-trip before confirming
  fireEvent.click(await screen.findByText(/המשך \(/));
  await waitFor(() => expect(onPick).toHaveBeenCalledWith(expect.objectContaining({
    kind: "cities", cities: ["Chiang Mai"],
  })));
});

test("תכנן לי → onSkip", () => {
  const onSkip = jest.fn();
  render(<DestinationFocus {...base} onSkip={onSkip} />);
  fireEvent.click(screen.getByText(/תכנן לי/));
  expect(onSkip).toHaveBeenCalledTimes(1);
});

test("fires ai_focus_shown on mount with scope + curated flag", () => {
  render(<DestinationFocus {...base} />);
  expect(track).toHaveBeenCalledWith("ai_focus_shown", { scope: "country", curated: true });
});
