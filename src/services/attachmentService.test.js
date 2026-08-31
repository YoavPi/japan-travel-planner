import { isAllowedFile } from "./attachmentService";

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
