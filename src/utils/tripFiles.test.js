import {
  newFileId, fileKind, fileEmoji, humanSize,
  addGeneralFile, updateGeneralFile, removeGeneralFile,
  renameStopAttachment, buildFileGroups,
} from "./tripFiles";

test("newFileId: f_ + 6 alnum", () => {
  expect(newFileId()).toMatch(/^f_[a-z0-9]{6}$/);
  expect(newFileId()).not.toBe(newFileId());
});

test("fileKind / fileEmoji", () => {
  expect(fileKind("application/pdf")).toBe("pdf");
  expect(fileKind("image/png")).toBe("image");
  expect(fileKind("application/vnd.openxmlformats-officedocument.wordprocessingml.document")).toBe("doc");
  expect(fileKind("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")).toBe("sheet");
  expect(fileKind("text/plain")).toBe("text");
  expect(fileKind("", "notes.xlsx")).toBe("sheet");
  expect(fileKind("application/zip")).toBe("other");
  expect(fileEmoji("pdf")).toBe("📄");
  expect(fileEmoji("other")).toBe("📎");
});

test("humanSize", () => {
  expect(humanSize(312 * 1024)).toBe("312 KB");
  expect(humanSize(1.4 * 1024 * 1024)).toBe("1.4 MB");
  expect(humanSize(undefined)).toBe("");
});

test("addGeneralFile creates files[] then appends", () => {
  const d0 = { tripData: [] };
  const d1 = addGeneralFile(d0, { id: "f_a", name: "a.pdf" });
  expect(d1.files).toEqual([{ id: "f_a", name: "a.pdf" }]);
  const d2 = addGeneralFile(d1, { id: "f_b", name: "b.pdf" });
  expect(d2.files.map((f) => f.id)).toEqual(["f_a", "f_b"]);
  expect(d1.files).toHaveLength(1); // d1 not mutated
});

test("updateGeneralFile merges only the target", () => {
  const d = { files: [{ id: "f_a", label: "x", day: null }, { id: "f_b", day: null }] };
  const out = updateGeneralFile(d, "f_a", { label: "ביטוח", day: 3 });
  expect(out.files[0]).toEqual({ id: "f_a", label: "ביטוח", day: 3 });
  expect(out.files[1]).toEqual({ id: "f_b", day: null });
  expect(updateGeneralFile(d, "nope", { label: "z" })).toEqual(d);
});

test("removeGeneralFile drops only the target", () => {
  const d = { files: [{ id: "f_a" }, { id: "f_b" }] };
  expect(removeGeneralFile(d, "f_a").files).toEqual([{ id: "f_b" }]);
});

test("renameStopAttachment sets label on one attachment only", () => {
  const td = [
    { day: 1, attractions: [{ name: "s1", attachments: [{ name: "x.pdf" }] }] },
    { day: 2, attractions: [
      { name: "s2", attachments: [{ name: "a.pdf" }, { name: "b.pdf" }] },
    ] },
  ];
  const out = renameStopAttachment(td, 2, 0, 1, "  כרטיס  ");
  expect(out[1].attractions[0].attachments[1].label).toBe("כרטיס");
  expect(out[1].attractions[0].attachments[0].label).toBeUndefined();
  expect(out[0]).toBe(td[0]); // day 1 untouched by reference
  const cleared = renameStopAttachment(out, 2, 0, 1, "   ");
  expect(cleared[1].attractions[0].attachments[1].label).toBeUndefined();
});

test("buildFileGroups: general first, then days with files ascending", () => {
  const td = [
    { day: 1, attractions: [{ name: "Sensoji", attachments: [] }] },
    { day: 2, attractions: [
      { name: "Hotel", attachments: [{ name: "voucher.pdf", type: "application/pdf" }] },
      { name: "TeamLab", attachments: [{ name: "ticket.png", type: "image/png", label: "כרטיס" }] },
    ] },
    { day: 3, attractions: [{ name: "Kyoto", attachments: [] }] },
  ];
  const files = [
    { id: "f_ins", name: "insurance.pdf", type: "application/pdf", day: null },
    { id: "f_map", name: "kyoto.pdf", type: "application/pdf", day: 3 },
  ];
  const groups = buildFileGroups(td, files);
  expect(groups.map((g) => g.key)).toEqual(["general", "day-2", "day-3"]);
  expect(groups[0].items).toHaveLength(1);
  expect(groups[0].items[0]).toMatchObject({ kind: "general", id: "f_ins", label: "insurance.pdf" });
  expect(groups[1].items.map((i) => i.label)).toEqual(["voucher.pdf", "כרטיס"]);
  expect(groups[1].items[0]).toMatchObject({ kind: "stop", dayNum: 2, stopIdx: 0, fi: 0 });
  expect(groups[2].items[0]).toMatchObject({ kind: "general", id: "f_map" });
});

test("buildFileGroups: general group present even when empty", () => {
  const groups = buildFileGroups([{ day: 1, attractions: [] }], []);
  expect(groups).toEqual([{ key: "general", title: "כללי", day: null, items: [] }]);
});
