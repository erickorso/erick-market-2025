import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import Badge from "./Badge";
import ChangePercent from "./ChangePercent";
import Price from "./Price";
import Skeleton from "./Skeleton";

describe("Price", () => {
  it("formats to two decimals by default", () => {
    render(<Price value={190.5} />);
    expect(screen.getByText("$190.50")).toBeInTheDocument();
  });

  it("honours a custom precision", () => {
    render(<Price value={10_500.4} digits={0} />);
    expect(screen.getByText("$10500")).toBeInTheDocument();
  });
});

describe("ChangePercent", () => {
  it("prefixes gains with a plus and colours them green", () => {
    render(<ChangePercent value={1.25} />);
    const el = screen.getByText("+1.25%");
    expect(el).toHaveClass("text-emerald-400");
  });

  it("colours losses red and keeps the minus sign", () => {
    render(<ChangePercent value={-3.5} />);
    const el = screen.getByText("-3.50%");
    expect(el).toHaveClass("text-rose-400");
  });

  it("treats zero as a gain, matching market convention", () => {
    render(<ChangePercent value={0} />);
    expect(screen.getByText("+0.00%")).toHaveClass("text-emerald-400");
  });

  it("accepts a custom precision and suffix", () => {
    render(<ChangePercent value={12.34} digits={1} suffix="% today" />);
    expect(screen.getByText("+12.3% today")).toBeInTheDocument();
  });
});

describe("Badge", () => {
  it("renders its content", () => {
    render(<Badge>growth</Badge>);
    expect(screen.getByText("growth")).toBeInTheDocument();
  });

  it("changes styling per variant", () => {
    const { rerender } = render(<Badge variant="warning">mock</Badge>);
    expect(screen.getByText("mock")).toHaveClass("text-amber-300");

    rerender(<Badge variant="live">live</Badge>);
    expect(screen.getByText("live")).toHaveClass("text-teal-300");
  });

  it("supports the tighter card size", () => {
    render(
      <Badge size="xs" className="mb-2">
        tag
      </Badge>,
    );
    const el = screen.getByText("tag");
    expect(el).toHaveClass("px-1.5");
    expect(el).toHaveClass("mb-2");
  });
});

describe("Skeleton", () => {
  it("takes its size from the caller", () => {
    const { container } = render(<Skeleton className="h-9 w-40" />);
    expect(container.firstChild).toHaveClass("h-9", "w-40", "bg-gray-800");
  });

  it("can mirror a bordered block", () => {
    const { container } = render(<Skeleton bordered className="h-56" />);
    expect(container.firstChild).toHaveClass("border-gray-700");
  });
});
