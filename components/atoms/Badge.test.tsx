import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import Badge from "./Badge";

describe("Badge", () => {
  it("renders its content", () => {
    render(<Badge>growth</Badge>);
    expect(screen.getByText("growth")).toBeInTheDocument();
  });

  it("defaults to the outlined style tag look", () => {
    render(<Badge>growth</Badge>);
    expect(screen.getByText("growth")).toHaveClass("border-gray-600");
  });

  it("warns in amber for a simulated quote", () => {
    render(<Badge variant="warning">mock quote</Badge>);
    expect(screen.getByText("mock quote")).toHaveClass("text-amber-300");
  });

  it("marks a live data source in teal", () => {
    render(<Badge variant="live">live</Badge>);
    expect(screen.getByText("live")).toHaveClass("text-teal-300");
  });

  it("mutes a mocked data source", () => {
    render(<Badge variant="muted">mock</Badge>);
    expect(screen.getByText("mock")).toHaveClass("text-slate-300");
  });

  it("uses tighter padding at the xs size for the card grid", () => {
    render(<Badge size="xs">tag</Badge>);
    expect(screen.getByText("tag")).toHaveClass("px-1.5");
  });

  it("uses roomier padding at the default size", () => {
    render(<Badge>tag</Badge>);
    expect(screen.getByText("tag")).toHaveClass("px-2");
  });

  it("merges the caller's className last so it can override", () => {
    render(<Badge className="mb-2 normal-case">tag</Badge>);
    const el = screen.getByText("tag");
    expect(el).toHaveClass("mb-2", "normal-case");
  });
});
