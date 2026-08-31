import { renderHook, act, waitFor } from "@testing-library/react";

jest.mock("../services/tripService", () => ({
  __esModule: true,
  default: {
    fetchTripById: jest.fn(),
    saveTrip: jest.fn(() => Promise.resolve()),
  },
}));
jest.mock("../services/googleSavedPlaces", () => ({
  listInboxPlaces: () => Promise.resolve([]),
  addInboxPlaces: () => Promise.resolve([]),
  removeInboxPlace: () => Promise.resolve(),
  updateInboxPlace: () => Promise.resolve(),
  fetchMockGoogleSavedPlaces: () => Promise.resolve([]),
}));

import tripService from "../services/tripService";
import useEditorState from "./useEditorState";

const TRIP = {
  id: "t1", readOnly: false,
  data: { tripData: [{ day: 1, attractions: [{ name: "Sensoji", attachments: [{ name: "x.pdf" }] }] }], files: [] },
};

beforeEach(() => {
  tripService.fetchTripById.mockResolvedValue(JSON.parse(JSON.stringify(TRIP)));
  tripService.saveTrip.mockClear();
  tripService.saveTrip.mockResolvedValue(undefined);
});

test("addTripFile appends to data.files and autosaves", async () => {
  const { result } = renderHook(() => useEditorState("t1"));
  await waitFor(() => expect(result.current.trip).toBeTruthy());

  act(() => result.current.addTripFile({ id: "f_a", name: "ins.pdf", day: null }));

  expect(result.current.tripFiles).toEqual([{ id: "f_a", name: "ins.pdf", day: null }]);
  await waitFor(() =>
    expect(tripService.saveTrip).toHaveBeenCalledWith("t1", expect.objectContaining({
      data: expect.objectContaining({ files: [{ id: "f_a", name: "ins.pdf", day: null }] }),
    })));
});

test("updateTripFile moves a file to a day; removeTripFile drops it", async () => {
  const { result } = renderHook(() => useEditorState("t1"));
  await waitFor(() => expect(result.current.trip).toBeTruthy());

  act(() => result.current.addTripFile({ id: "f_a", name: "ins.pdf", day: null }));
  act(() => result.current.updateTripFile("f_a", { day: 3 }));
  expect(result.current.tripFiles[0].day).toBe(3);

  act(() => result.current.removeTripFile("f_a"));
  expect(result.current.tripFiles).toEqual([]);
});

test("renameAttachmentAt labels one stop attachment", async () => {
  const { result } = renderHook(() => useEditorState("t1"));
  await waitFor(() => expect(result.current.trip).toBeTruthy());

  act(() => result.current.renameAttachmentAt(1, 0, 0, "ביטוח"));
  expect(result.current.days[0].attractions[0].attachments[0].label).toBe("ביטוח");
});

test("read-only trip does not autosave file changes", async () => {
  tripService.fetchTripById.mockResolvedValue({ ...JSON.parse(JSON.stringify(TRIP)), readOnly: true });
  const { result } = renderHook(() => useEditorState("t1"));
  await waitFor(() => expect(result.current.trip).toBeTruthy());

  act(() => result.current.addTripFile({ id: "f_a", name: "x.pdf", day: null }));
  expect(result.current.tripFiles).toEqual([{ id: "f_a", name: "x.pdf", day: null }]);
  await new Promise((r) => setTimeout(r, 0));
  expect(tripService.saveTrip).not.toHaveBeenCalled();
});
