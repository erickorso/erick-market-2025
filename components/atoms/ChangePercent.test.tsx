import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import ChangePercent from "./ChangePercent";

describe("ChangePercent", () => {
  it("prefixes gains with a plus and colours them green", () => {
    render(<ChangePercent value={1.25} />);
    expect(screen.getByText("+1.25%")).toHaveClass("text-emerald-400");
  });

  it("colours losses red and keeps the minus sign", () => {
    render(<ChangePercent value={-3.5} />);
    expect(screen.getByText("-3.50%")).toHaveClass("text-rose-400");
  });

  it("treats zero as a gain, matching market convention", () => {
    render(<ChangePercent value={0} />);
    expect(screen.getByText("+0.00%")).toHaveClass("text-emerald-400");
  });

  it("accepts a custom precision", () => {
    render(<ChangePercent value={12.34} digits={1} />);
    expect(screen.getByText("+12.3%")).toBeInTheDocument();
  });

  it("accepts a custom suffix for the card layout", () => {
    render(<ChangePercent value={1.2} suffix="% today" />);
    expect(screen.getByText("+1.20% today")).toBeInTheDocument();
  });

  it("can drop the suffix entirely", () => {
    render(<ChangePercent value={2} suffix="" />);
    expect(screen.getByText("+2.00")).toBeInTheDocument();
  });

  it("passes className through", () => {
    render(<ChangePercent value={1} className="text-xs font-medium" />);
    expect(screen.getByText("+1.00%")).toHaveClass("text-xs", "font-medium");
  });
});
