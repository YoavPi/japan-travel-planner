import { render, screen, fireEvent } from "@testing-library/react";
import StopCard from "./StopCard";
import { LIGHT } from "../utils/theme";

const baseStop = {
  instanceId: "i1", nameHe: "בורג' ח'ליפה", category: "אטרקציה",
  coordinates: { lat: 25.19, lng: 55.27 },
};

const baseProps = {
  stop: baseStop, idx: 0, pos: 0, editable: true, P: LIGHT,
  onNavigate: jest.fn(), onToggleComplete: jest.fn(), onEditNote: jest.fn(),
  onOpenActions: jest.fn(), onHandleDown: () => () => {},
};

describe("StopCard — extraction invariants", () => {
  it("renders the stop name", () => {
    render(<StopCard {...baseProps} />);
    expect(screen.getByText("בורג' ח'ליפה")).toBeInTheDocument();
  });

  it("tapping the name calls onNavigate with the stop", () => {
    const onNavigate = jest.fn();
    render(<StopCard {...baseProps} onNavigate={onNavigate} />);
    fireEvent.click(screen.getByText("בורג' ח'ליפה"));
    expect(onNavigate).toHaveBeenCalledWith(baseStop);
  });

  it("calls onOpenActions(idx) when the more button is tapped", () => {
    const onOpenActions = jest.fn();
    render(<StopCard {...baseProps} idx={3} onOpenActions={onOpenActions} />);
    fireEvent.click(screen.getByRole("button", { name: "פעולות" }));
    expect(onOpenActions).toHaveBeenCalledWith(3);
  });

  it("calls onEditNote(idx) when the note trigger is tapped", () => {
    const onEditNote = jest.fn();
    render(<StopCard {...baseProps} idx={2} onEditNote={onEditNote} />);
    fireEvent.click(screen.getByRole("button", { name: /הוספת הערה|עריכת הערה/ }));
    expect(onEditNote).toHaveBeenCalledWith(2);
  });

  it("hides ⋯ and drag handle when editable is false, keeps navigation", () => {
    render(<StopCard {...baseProps} editable={false} />);
    expect(screen.queryByRole("button", { name: "פעולות" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "ניווט ב-Google Maps" })).toBeInTheDocument();
  });

  it("every interactive child stops propagation so the card body click doesn't also fire", () => {
    const onNavigate = jest.fn();
    render(<StopCard {...baseProps} onNavigate={onNavigate} />);
    fireEvent.click(screen.getByRole("button", { name: "פעולות" }));
    expect(onNavigate).not.toHaveBeenCalled();
  });
});
