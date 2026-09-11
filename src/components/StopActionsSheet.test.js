import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import StopActionsSheet from "./StopActionsSheet";

const baseProps = { stop: { name: "Sensoji" }, days: [{ day: 1 }], onClose: () => {}, onDelete: () => {} };

test("no cost yet: shows 'הוסף עלות' and calls onSetCost on click", () => {
  const onSetCost = jest.fn();
  render(<StopActionsSheet {...baseProps} onSetCost={onSetCost} stopCostLabel={null} />);

  const row = screen.getByText("הוסף עלות");
  fireEvent.click(row);
  expect(onSetCost).toHaveBeenCalled();
});

test("existing cost: shows the amount in the row label", () => {
  render(<StopActionsSheet {...baseProps} onSetCost={() => {}} stopCostLabel="₪120.00" />);
  expect(screen.getByText("עריכת עלות · ₪120.00")).toBeInTheDocument();
});

test("onSetCost omitted: no cost row rendered at all", () => {
  render(<StopActionsSheet {...baseProps} />);
  expect(screen.queryByText("הוסף עלות")).not.toBeInTheDocument();
});

/* ── D2 merge: 3 copy rows → 1 hub, 2 move rows → 1 ── */

test("the menu no longer carries the old separate copy/move rows", () => {
  render(<StopActionsSheet {...baseProps} onDuplicate={() => {}} onCrossCopy={() => {}} onMoveNextDay={() => {}} />);
  expect(screen.queryByText("שכפל מיקום")).not.toBeInTheDocument();
  expect(screen.queryByText("העתקה ליום אחר")).not.toBeInTheDocument();
  expect(screen.queryByText("העבר ליום הבא")).not.toBeInTheDocument();
  expect(screen.queryByText("העתקה לטיול אחר")).not.toBeInTheDocument(); // not at top level
  expect(screen.getByText("העברה ליום…")).toBeInTheDocument();
  expect(screen.getByText("העתקה…")).toBeInTheDocument();
});

test("'העתקה…' opens one hub with the day grid, duplicate-here and cross-trip", () => {
  render(<StopActionsSheet {...baseProps} days={[{ day: 1 }, { day: 2 }, { day: 3 }]}
    otherTrips={[{ id: "t2", title: "רומא", days: 4 }]}
    onCopy={jest.fn()} onDuplicate={jest.fn()} onCrossCopy={jest.fn()} />);
  fireEvent.click(screen.getByText("העתקה…"));
  expect(screen.getByText("בחרו יום להעתקה")).toBeInTheDocument();
  expect(screen.getByText("שכפול ביום הנוכחי")).toBeInTheDocument();
  expect(screen.getByText("העתקה לטיול אחר ←")).toBeInTheDocument();
});

test("duplicate-here fires onDuplicate", () => {
  const onDuplicate = jest.fn();
  render(<StopActionsSheet {...baseProps} onCopy={() => {}} onDuplicate={onDuplicate} />);
  fireEvent.click(screen.getByText("העתקה…"));
  fireEvent.click(screen.getByText("שכפול ביום הנוכחי"));
  expect(onDuplicate).toHaveBeenCalled();
});

test("the cross-trip step is reached from inside the copy hub", () => {
  render(<StopActionsSheet {...baseProps} otherTrips={[{ id: "t2", title: "רומא", days: 4 }]}
    onCopy={() => {}} onCrossCopy={jest.fn()} />);
  fireEvent.click(screen.getByText("העתקה…"));
  fireEvent.click(screen.getByText("העתקה לטיול אחר ←"));
  expect(screen.getByText("בחרו טיול יעד")).toBeInTheDocument();
});

test("lodging row resolves its label instead of showing both states", () => {
  const { rerender } = render(<StopActionsSheet {...baseProps} stop={{ name: "A", category: "אטרקציה" }} onSetLodging={() => {}} />);
  expect(screen.getByText("הגדרה כנקודת לינה")).toBeInTheDocument();
  expect(screen.queryByText("הגדר/בטל כנקודת לינה")).not.toBeInTheDocument();
  rerender(<StopActionsSheet {...baseProps} stop={{ name: "A", category: "מלון" }} onSetLodging={() => {}} />);
  expect(screen.getByText("ביטול נקודת לינה")).toBeInTheDocument();
});

test("remove-attachment no longer shares the trash glyph with delete", () => {
  render(<StopActionsSheet {...baseProps} onRemoveAttachment={() => {}} attachmentCount={2} onDelete={() => {}} />);
  const remove = screen.getByText("הסרת הקובץ המצורף").closest("button");
  const del = screen.getByText("מחיקה מהמסלול").closest("button");
  expect(remove.textContent).not.toContain("🗑");
  expect(del.textContent).toContain("🗑");
});

/* ── B5: F1 merge — long-press repoints to this sheet; trip-mode
   move-to-next-day row lands here as the schedule section's first row. ── */

describe("StopActionsSheet — trip-mode move-to-next-day row (F1 merge)", () => {
  test("shows the move-to-next-day row when tripActive is true", () => {
    render(<StopActionsSheet {...baseProps} onMoveNextDay={jest.fn()} tripActive />);
    expect(screen.getByText("העבר ליום הבא")).toBeInTheDocument();
  });

  test("hides the move-to-next-day row when tripActive is false", () => {
    render(<StopActionsSheet {...baseProps} onMoveNextDay={jest.fn()} tripActive={false} />);
    expect(screen.queryByText("העבר ליום הבא")).not.toBeInTheDocument();
  });

  test("clicking the row fires onMoveNextDay", () => {
    const onMoveNextDay = jest.fn();
    render(<StopActionsSheet {...baseProps} onMoveNextDay={onMoveNextDay} tripActive />);
    fireEvent.click(screen.getByText("העבר ליום הבא"));
    expect(onMoveNextDay).toHaveBeenCalled();
  });

  test("T-CARD-11 (sheet half): the note row still reaches onSetNote with the draft", () => {
    const onSetNote = jest.fn();
    render(<StopActionsSheet {...baseProps} stop={{ note: "ישן" }} onSetNote={onSetNote} />);
    fireEvent.click(screen.getByText("עריכת הערה"));
    const input = screen.getByDisplayValue("ישן");
    fireEvent.change(input, { target: { value: "חדש" } });
    fireEvent.click(screen.getByText(/שמירת הערה/));
    expect(onSetNote).toHaveBeenCalledWith("חדש");
  });
});
