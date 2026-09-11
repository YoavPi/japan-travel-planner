import { render, screen, fireEvent } from "@testing-library/react";
import TransitConnector from "./TransitConnector";
import { LIGHT } from "../utils/theme";

const a = { coordinates: { lat: 35.0, lng: 135.0 } };
const b = { coordinates: { lat: 35.01, lng: 135.01 } };

describe("TransitConnector — extraction invariants", () => {
  it("renders nothing when computeTransit returns null (no coordinates)", () => {
    const { container } = render(<TransitConnector a={{}} b={{}} units="km" P={LIGHT} />);
    expect(container.firstChild).toBeNull();
  });

  it("renders a segment for two stops with coordinates", () => {
    render(<TransitConnector a={a} b={b} units="km" editable P={LIGHT} />);
    expect(screen.getByRole("button", { name: /שינוי אופן המעבר/ })).toBeInTheDocument();
  });

  it("opens the mode menu on click and calls onSetMode on a pick", () => {
    const onSetMode = jest.fn();
    render(<TransitConnector a={a} b={b} units="km" editable onSetMode={onSetMode} P={LIGHT} />);
    fireEvent.click(screen.getByRole("button", { name: /שינוי אופן המעבר/ }));
    const menu = screen.getByRole("menu");
    fireEvent.click(menu.querySelectorAll("button")[1]); // "car"
    expect(onSetMode).toHaveBeenCalledWith("car");
  });

  it("renders a read-only span, no button, when editable is false", () => {
    render(<TransitConnector a={a} b={b} units="km" editable={false} P={LIGHT} />);
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });
});
