import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import AiTripModal from "./AiTripModal";
import { generateItinerary, fetchQuota } from "../services/aiTrip";
import { autocomplete } from "../services/googlePlaces";

/* ══════════════════════════════════════════════════════════════════════
   The AI-failure ladder — the user-facing half of the 2026-09-07 incident,
   where a single failed generation was reported to the user as an
   AI-service-wide overload while they still had 10/10 weekly quota.

   The contract these tests pin down:
     1. FIRST failure  → "יש עומס כרגע" + a retry button.
     2. SECOND failure → "לא זמינה כרגע", NO retry button, and an explicit
        verdict that the extra attempt also failed.
     3. A retry that SUCCEEDS says so, rather than only changing screen.
     4. A raw system/technical error string NEVER reaches the screen.
   ══════════════════════════════════════════════════════════════════════ */

jest.mock("../analytics/posthog", () => ({ track: jest.fn() }));
jest.mock("../services/tripService", () => ({ __esModule: true, default: { createNewTrip: jest.fn() } }));
jest.mock("../services/aiTrip", () => ({
  generateItinerary: jest.fn(),
  fetchQuota: jest.fn(),
  itineraryToTripData: jest.fn(() => []),
  summarizeForRefine: jest.fn(() => []),
}));
jest.mock("../services/googlePlaces", () => ({ autocomplete: jest.fn() }));

// A raw technical error of the kind the server/model can produce. It must
// never appear on screen — only in our logs.
const SYSTEM_ERROR = "Gemini request failed (500): INTERNAL backend error";

const okResult = {
  destination: "גאורגיה",
  days: [{ dayNumber: 1, city: "Tbilisi", spots: [{ name: "Narikala", lat: 41.6, lng: 44.8, place_id: "p1" }] }],
  meta: { remaining: 9, weeklyLimit: 10, used: 1 },
};

beforeEach(() => {
  autocomplete.mockResolvedValue([
    { placeId: "g1", primary: "גאורגיה", secondary: "", types: ["country"] },
  ]);
  fetchQuota.mockResolvedValue({ limit: 10, used: 0, remaining: 10, admin: false });
  jest.spyOn(console, "warn").mockImplementation(() => {});
});

/* Fill the destination via the autocomplete list (destChosen gates submit),
   then press the build button. Georgia is a country, so the modal routes to
   the FOCUS step — "דלג" there runs the generation with focus:null. */
const startGeneration = async () => {
  render(<MemoryRouter><AiTripModal open onClose={() => {}} /></MemoryRouter>);
  const input = screen.getByPlaceholderText(/לאן/);
  fireEvent.change(input, { target: { value: "גאור" } });
  const option = await screen.findByText("גאורגיה");
  fireEvent.click(option);
  fireEvent.click(screen.getByRole("button", { name: /בנו לי מסלול/ }));
  // Country → focus step. Skip it to reach the generation call.
  const skip = await screen.findByRole("button", { name: /תכנן לי — לא משנה לי/ });
  fireEvent.click(skip);
};

test("first failure: says busy, offers a retry, and never shows the raw error", async () => {
  generateItinerary.mockRejectedValue(new Error(SYSTEM_ERROR));
  await startGeneration();

  const alert = await screen.findByRole("alert");
  expect(alert).toHaveTextContent("יש עומס כרגע");
  expect(screen.getByRole("button", { name: /נסו שוב/ })).toBeInTheDocument();
  // The technical detail stays in the console, never on screen.
  expect(document.body.textContent).not.toContain("Gemini");
  expect(document.body.textContent).not.toContain("500");
});

test("second failure: withdraws the retry, says unavailable, and states the retry failed", async () => {
  generateItinerary.mockRejectedValue(new Error(SYSTEM_ERROR));
  await startGeneration();

  fireEvent.click(await screen.findByRole("button", { name: /נסו שוב/ }));

  await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("לא זמינה כרגע"));
  expect(screen.getByRole("alert")).toHaveTextContent("גם הניסיון הנוסף לא הצליח");
  // The message says "come back later" — so it must not still be asking.
  expect(screen.queryByRole("button", { name: /נסו שוב/ })).not.toBeInTheDocument();
  expect(document.body.textContent).not.toContain("Gemini");
});

test("a retry that succeeds says so explicitly", async () => {
  generateItinerary.mockRejectedValueOnce(new Error(SYSTEM_ERROR)).mockResolvedValueOnce(okResult);
  await startGeneration();

  fireEvent.click(await screen.findByRole("button", { name: /נסו שוב/ }));

  const status = await screen.findByRole("status");
  expect(status).toHaveTextContent("הפעם זה עבד");
  expect(screen.queryByRole("alert")).not.toBeInTheDocument();
});

test("quota and cooldown messages are still shown verbatim — they are written for the user", async () => {
  const quotaErr = new Error("הגעת למכסת המסלולים השבועית ב-AI (10/10).");
  quotaErr.code = "weekly-limit";
  quotaErr.quota = { limit: 10, used: 10, remaining: 0 };
  generateItinerary.mockRejectedValue(quotaErr);
  await startGeneration();

  const alert = await screen.findByRole("alert");
  expect(alert).toHaveTextContent("הגעת למכסת המסלולים השבועית");
  // Not a system failure → no retry button, and no "busy" framing.
  expect(screen.queryByRole("button", { name: /נסו שוב/ })).not.toBeInTheDocument();
  expect(alert).not.toHaveTextContent("יש עומס כרגע");
});
