import { describe, expect, it, vi } from "vitest";
import userEvent from "@testing-library/user-event";
import { renderWithProviders, screen } from "../../test/render";
import QuantityStepper from "./QuantityStepper";

const props = {
  quantity: 1,
  onIncrement: () => {},
  onDecrement: () => {},
};

describe("QuantityStepper", () => {
  it("shows the current quantity", () => {
    renderWithProviders(<QuantityStepper {...props} quantity={7} />);
    expect(screen.getByTestId("quantity")).toHaveTextContent("7");
  });

  it("calls up and down independently", async () => {
    const onIncrement = vi.fn();
    const onDecrement = vi.fn();
    renderWithProviders(
      <QuantityStepper
        {...props}
        onIncrement={onIncrement}
        onDecrement={onDecrement}
      />,
    );

    await userEvent.click(screen.getByLabelText("Increase quantity"));
    await userEvent.click(screen.getByLabelText("Decrease quantity"));

    expect(onIncrement).toHaveBeenCalledTimes(1);
    expect(onDecrement).toHaveBeenCalledTimes(1);
  });

  it("labels both buttons for screen readers", () => {
    renderWithProviders(<QuantityStepper {...props} />);

    expect(screen.getByLabelText("Increase quantity")).toBeInTheDocument();
    expect(screen.getByLabelText("Decrease quantity")).toBeInTheDocument();
  });

  it("disables both buttons for guests", async () => {
    const onIncrement = vi.fn();
    renderWithProviders(
      <QuantityStepper {...props} disabled onIncrement={onIncrement} />,
    );

    const up = screen.getByLabelText("Increase quantity");
    expect(up).toBeDisabled();
    expect(screen.getByLabelText("Decrease quantity")).toBeDisabled();

    await userEvent.click(up);
    expect(onIncrement).not.toHaveBeenCalled();
  });

  it("renders a denser control at the sm size", () => {
    const { rerender } = renderWithProviders(
      <QuantityStepper {...props} size="md" />,
    );
    expect(screen.getByLabelText("Increase quantity")).toHaveClass("px-3");

    rerender(<QuantityStepper {...props} size="sm" />);
    expect(screen.getByLabelText("Increase quantity")).toHaveClass("px-2");
  });

  it("uses buttons, not inputs, so it never submits a form", () => {
    renderWithProviders(<QuantityStepper {...props} />);
    screen
      .getAllByRole("button")
      .forEach((b) => expect(b).toHaveAttribute("type", "button"));
  });
});
