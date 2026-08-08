import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import Price from "./Price";

describe("Price", () => {
  it("formats to two decimals by default", () => {
    render(<Price value={190.5} />);
    expect(screen.getByText("$190.50")).toBeInTheDocument();
  });

  it("honours a custom precision", () => {
    render(<Price value={10_500.4} digits={0} />);
    expect(screen.getByText("$10500")).toBeInTheDocument();
  });

  it("renders zero rather than an empty string", () => {
    render(<Price value={0} />);
    expect(screen.getByText("$0.00")).toBeInTheDocument();
  });

  it("rounds rather than truncating", () => {
    render(<Price value={1.005} digits={2} />);
    expect(screen.getByText(/^\$1\.0[01]$/)).toBeInTheDocument();
  });

  it("passes className through", () => {
    render(<Price value={1} className="text-2xl font-bold" />);
    expect(screen.getByText("$1.00")).toHaveClass("text-2xl", "font-bold");
  });
});
