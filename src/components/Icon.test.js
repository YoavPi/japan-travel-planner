import { render } from "@testing-library/react";
import Icon from "./Icon";

describe("Icon — new glyphs for the stop-card redesign", () => {
  it.each(["paperclip", "navigation", "walk"])("renders %s without a console warning", (name) => {
    const warn = jest.spyOn(console, "warn").mockImplementation(() => {});
    const { container } = render(<Icon name={name} />);
    expect(container.querySelector("svg")).toBeTruthy();
    expect(warn).not.toHaveBeenCalled();
    warn.mockRestore();
  });
});
