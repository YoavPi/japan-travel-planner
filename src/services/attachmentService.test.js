/* CRA's Jest preset sets resetMocks:true, so mock implementations are wiped
   between tests — the classification block re-wires them in its beforeEach.
   `isSupabaseEnabled` defaults to falsy (matches CI without Supabase creds). */
const mockRemove = jest.fn();
jest.mock("../lib/supabase", () => ({
  __esModule: true,
  isSupabaseEnabled: jest.fn(() => false),
  supabase: { storage: { from: jest.fn() } },
}));

import { supabase, isSupabaseEnabled } from "../lib/supabase";
import { isAllowedFile, uploadAttachment, removeStoredFile } from "./attachmentService";

test("isAllowedFile: accepts pdf / image / docx / xlsx / txt", () => {
  expect(isAllowedFile({ type: "application/pdf" })).toBe(true);
  expect(isAllowedFile({ type: "image/jpeg" })).toBe(true);
  expect(isAllowedFile({ type: "", name: "policy.pdf" })).toBe(true);
  expect(isAllowedFile({ type: "", name: "list.xlsx" })).toBe(true);
  expect(isAllowedFile({ type: "", name: "notes.docx" })).toBe(true);
  expect(isAllowedFile({ type: "text/plain" })).toBe(true);
});

test("isAllowedFile: rejects everything else", () => {
  expect(isAllowedFile({ type: "application/zip", name: "a.zip" })).toBe(false);
  expect(isAllowedFile({ type: "", name: "run.exe" })).toBe(false);
  expect(isAllowedFile({})).toBe(false);
});

test("uploadAttachment: rejects a disallowed file type before the size check", async () => {
  await expect(uploadAttachment("t1", { type: "application/zip", name: "a.zip", size: 10 }))
    .rejects.toThrow("file type not allowed");
});

test("uploadAttachment: type check runs before the size check", async () => {
  // oversized AND disallowed → must fail on type, not size
  await expect(uploadAttachment("t1", { type: "application/zip", name: "a.zip", size: 999 * 1024 * 1024 }))
    .rejects.toThrow("file type not allowed");
});

test("removeStoredFile: no-op resolves when path is empty", async () => {
  await expect(removeStoredFile("")).resolves.toBeUndefined();
});

test("removeStoredFile: no-op resolves when path is non-empty (Supabase disabled in CI)", async () => {
  await expect(removeStoredFile("some/path")).resolves.toBeUndefined();
});

describe("removeStoredFile: error classification when Supabase IS enabled", () => {
  beforeEach(() => {
    isSupabaseEnabled.mockReturnValue(true);
    mockRemove.mockReset();
    supabase.storage.from.mockReturnValue({ remove: mockRemove });
  });

  test("a 'not found'-style error is swallowed (resolves)", async () => {
    mockRemove.mockResolvedValue({ error: { message: "Object not found" } });
    await expect(removeStoredFile("trip/x.pdf")).resolves.toBeUndefined();
  });

  test("any other error rejects so the caller can log it", async () => {
    mockRemove.mockResolvedValue({ error: { message: "network fail" } });
    await expect(removeStoredFile("trip/x.pdf")).rejects.toMatchObject({ message: "network fail" });
  });

  test("success resolves and calls remove with [path]", async () => {
    mockRemove.mockResolvedValue({ error: null });
    await expect(removeStoredFile("trip/x.pdf")).resolves.toBeUndefined();
    expect(mockRemove).toHaveBeenCalledWith(["trip/x.pdf"]);
  });
});
