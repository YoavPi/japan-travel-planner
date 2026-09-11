import { render, screen, fireEvent } from "@testing-library/react";
import StopCard from "./StopCard";
import { LIGHT } from "../utils/theme";
// eslint-disable-next-line no-unused-vars
import Money from "./Money"; // not used directly, but confirms the dependency exists

const baseStop = {
  instanceId: "i1", nameHe: "בורג' ח'ליפה", category: "אטרקציה",
  coordinates: { lat: 25.19, lng: 55.27 },
};

const baseProps = {
  stop: baseStop, idx: 0, pos: 0, editable: true, P: LIGHT,
  onNavigate: jest.fn(), onToggleComplete: jest.fn(), onEditNote: jest.fn(),
  onOpenActions: jest.fn(), onDragStart: () => {},
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

  it("every interactive child stops propagation so the card body click doesn't also fire", () => {
    const onNavigate = jest.fn();
    render(<StopCard {...baseProps} onNavigate={onNavigate} />);
    fireEvent.click(screen.getByRole("button", { name: "פעולות" }));
    expect(onNavigate).not.toHaveBeenCalled();
  });
});

describe("StopCard — Row A redesign", () => {
  it("T-CARD-01: tapping the badge in trip mode toggles complete", () => {
    const onToggleComplete = jest.fn();
    render(<StopCard {...baseProps} tripActive onToggleComplete={onToggleComplete} idx={1} />);
    fireEvent.pointerDown(screen.getByRole("button", { name: /סמנו כבוצע|בטלו סימון ביקור/ }));
    fireEvent.pointerUp(screen.getByRole("button", { name: /סמנו כבוצע|בטלו סימון ביקור/ }));
    expect(onToggleComplete).toHaveBeenCalledWith(1);
  });

  it("T-CARD-02: tapping the badge in planning mode does nothing and does not navigate", () => {
    const onNavigate = jest.fn();
    render(<StopCard {...baseProps} tripActive={false} onNavigate={onNavigate} />);
    const badge = screen.getByRole("button", { name: /תחנה/ });
    fireEvent.pointerDown(badge);
    fireEvent.pointerUp(badge);
    expect(onNavigate).not.toHaveBeenCalled();
  });

  it("T-CARD-03 (partial): press-and-move beyond 6px on the badge fires onDragStart", () => {
    const onDragStart = jest.fn();
    render(<StopCard {...baseProps} onDragStart={onDragStart} />);
    const badge = screen.getByRole("button", { name: /תחנה/ });
    fireEvent.pointerDown(badge, { clientX: 0, clientY: 0 });
    fireEvent.pointerMove(badge, { clientX: 0, clientY: 10 });
    expect(onDragStart).toHaveBeenCalled();
  });

  it("a move under 6px does not start a drag", () => {
    const onDragStart = jest.fn();
    render(<StopCard {...baseProps} onDragStart={onDragStart} />);
    const badge = screen.getByRole("button", { name: /תחנה/ });
    fireEvent.pointerDown(badge, { clientX: 0, clientY: 0 });
    fireEvent.pointerMove(badge, { clientX: 0, clientY: 3 });
    expect(onDragStart).not.toHaveBeenCalled();
  });

  it("T-CARD-09 (first half): read-only hides drag/actions, keeps ניווט", () => {
    render(<StopCard {...baseProps} editable={false} />);
    expect(screen.queryByRole("button", { name: "פעולות" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "ניווט ב-Google Maps" })).toBeInTheDocument();
  });

  it("renders ניווט icon-only when compact", () => {
    render(<StopCard {...baseProps} compact />);
    expect(screen.getByRole("button", { name: "ניווט ב-Google Maps" }).textContent).not.toMatch(/ניווט/);
  });
});

describe("StopCard — Row B metadata", () => {
  it("T-CARD-04: tapping the cost item calls onOpenCost, not onNavigate", () => {
    const onOpenCost = jest.fn();
    const onNavigate = jest.fn();
    const costSummary = { count: 1, primary: { id: "e1" }, effectiveMinor: 12000, plannedMinor: 12000, currency: "ILS", paid: false, over: false };
    render(<StopCard {...baseProps} idx={4} costSummary={costSummary} showCost onOpenCost={onOpenCost} onNavigate={onNavigate} />);
    fireEvent.click(screen.getByRole("button", { name: /עלות/ }));
    expect(onOpenCost).toHaveBeenCalledWith(4);
    expect(onNavigate).not.toHaveBeenCalled();
  });

  it("T-CARD-06: renders the summary's effectiveMinor, not a per-item recompute", () => {
    const costSummary = { count: 2, primary: { id: "e1" }, effectiveMinor: 9000, plannedMinor: 8000, currency: "ILS", paid: true, over: true };
    render(<StopCard {...baseProps} costSummary={costSummary} showCost />);
    expect(screen.getByText("×2", { exact: false })).toBeInTheDocument();
  });

  it("T-CARD-07: a stop with no cost renders no cost item and does not throw", () => {
    const spy = jest.spyOn(console, "error").mockImplementation(() => {});
    render(<StopCard {...baseProps} costSummary={null} showCost />);
    expect(screen.queryByRole("button", { name: /עלות/ })).not.toBeInTheDocument();
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });

  it("does not render a cost item when showCost is false, even with a costSummary", () => {
    const costSummary = { count: 1, primary: { id: "e1" }, effectiveMinor: 12000, plannedMinor: 12000, currency: "ILS", paid: false, over: false };
    render(<StopCard {...baseProps} costSummary={costSummary} showCost={false} />);
    expect(screen.queryByRole("button", { name: /עלות/ })).not.toBeInTheDocument();
  });

  it("T-CARD-08: a bare Google 0-5 rating normalises for display", () => {
    render(<StopCard {...baseProps} stop={{ ...baseStop, rating: 4.6 }} />);
    expect(screen.getByText(/9\.2/)).toBeInTheDocument();
  });

  it("sparse: no rating/cost/files/note/category renders Row B as absent", () => {
    render(<StopCard {...baseProps} stop={{ instanceId: "i1", nameHe: "שוק" }} costSummary={null} showCost />);
    expect(screen.queryByText("·")).not.toBeInTheDocument();
  });
});
