import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import AttachmentViewer from "./AttachmentViewer";

test("renders nothing without a file url", () => {
  const { container } = render(<AttachmentViewer file={null} onClose={() => {}} />);
  expect(container).toBeEmptyDOMElement();
});

test("shows label, close + delete fire their callbacks", () => {
  const onClose = jest.fn();
  const onDelete = jest.fn();
  render(<AttachmentViewer file={{ label: "ביטוח נסיעות", type: "application/pdf", url: "blob:x" }} onClose={onClose} onDelete={onDelete} />);
  expect(screen.getByText("ביטוח נסיעות")).toBeInTheDocument();
  fireEvent.click(screen.getByLabelText("מחק קובץ"));
  fireEvent.click(screen.getByLabelText("סגירה"));
  expect(onDelete).toHaveBeenCalledTimes(1);
  expect(onClose).toHaveBeenCalledTimes(1);
});

test("no delete button when onDelete is omitted", () => {
  render(<AttachmentViewer file={{ name: "a.pdf", type: "application/pdf", url: "blob:x" }} onClose={() => {}} />);
  expect(screen.queryByLabelText("מחק קובץ")).toBeNull();
});

test("non-previewable type offers a download link", () => {
  render(<AttachmentViewer file={{ name: "list.xlsx", type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", url: "blob:x" }} onClose={() => {}} />);
  const link = screen.getByText("הורדת הקובץ").closest("a");
  expect(link).toHaveAttribute("href", "blob:x");
  expect(link).toHaveAttribute("download");
});
