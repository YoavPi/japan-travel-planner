import React from "react";
import { render, screen, fireEvent, within } from "@testing-library/react";
import TripFilesSheet from "./TripFilesSheet";

const tripData = [
  { day: 1, attractions: [] },
  { day: 2, attractions: [
    { name: "Hotel", attachments: [{ name: "voucher.pdf", type: "application/pdf" }] },
  ] },
  { day: 3, attractions: [] },
];
const files = [{ id: "f_ins", name: "insurance.pdf", type: "application/pdf", day: null }];

const baseProps = {
  open: true, onClose: jest.fn(), tripData, files, dayCount: 3, editable: true, busy: false,
  onUpload: jest.fn(), onRename: jest.fn(), onMove: jest.fn(), onDelete: jest.fn(),
};

test("renders nothing when closed", () => {
  const { container } = render(<TripFilesSheet {...baseProps} open={false} />);
  expect(container).toBeEmptyDOMElement();
});

test("sections: כללי first, then only days with files", () => {
  render(<TripFilesSheet {...baseProps} />);
  const headers = screen.getAllByRole("heading").map((h) => h.textContent);
  expect(headers).toEqual(["כללי", "יום 2"]);
  expect(screen.getByText("insurance.pdf")).toBeInTheDocument();
  expect(screen.getByText("voucher.pdf")).toBeInTheDocument();
});

test("rename a general file commits on Enter", () => {
  render(<TripFilesSheet {...baseProps} />);
  fireEvent.click(screen.getByLabelText("שנה שם ל-insurance.pdf"));
  const input = screen.getByDisplayValue("insurance.pdf");
  fireEvent.change(input, { target: { value: "ביטוח נסיעות" } });
  fireEvent.keyDown(input, { key: "Enter" });
  expect(baseProps.onRename).toHaveBeenCalledWith(
    expect.objectContaining({ kind: "general", id: "f_ins" }), "ביטוח נסיעות");
});

test("move a general file to day 3", () => {
  render(<TripFilesSheet {...baseProps} />);
  fireEvent.click(screen.getByLabelText("פעולות עבור insurance.pdf"));
  fireEvent.click(screen.getByText("יום 3"));
  expect(baseProps.onMove).toHaveBeenCalledWith(
    expect.objectContaining({ id: "f_ins" }), 3);
});

test("delete calls onDelete", () => {
  render(<TripFilesSheet {...baseProps} />);
  fireEvent.click(screen.getByLabelText("פעולות עבור voucher.pdf"));
  fireEvent.click(screen.getByText("מחק"));
  expect(baseProps.onDelete).toHaveBeenCalledWith(
    expect.objectContaining({ kind: "stop", dayNum: 2, stopIdx: 0, fi: 0 }));
});

test("upload rejects a disallowed type without calling onUpload", () => {
  render(<TripFilesSheet {...baseProps} />);
  const input = screen.getByTestId("trip-files-input");
  fireEvent.change(input, { target: { files: [new File(["x"], "a.zip", { type: "application/zip" })] } });
  expect(baseProps.onUpload).not.toHaveBeenCalled();
  expect(screen.getByText(/סוג קובץ/)).toBeInTheDocument();
});

test("read-only: no upload button, no ⋯ menu", () => {
  render(<TripFilesSheet {...baseProps} editable={false} />);
  expect(screen.queryByText("הוסף קובץ כללי")).toBeNull();
  expect(screen.queryByLabelText("פעולות עבור insurance.pdf")).toBeNull();
});
