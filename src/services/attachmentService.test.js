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
