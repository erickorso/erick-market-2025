import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import ErrorBoundary from "./ErrorBoundary";
import { consoleErrorSink, setErrorSink } from "../../services/reporter";

function Boom({
  message = "kaboom",
}: {
  message?: string;
}): React.ReactElement {
  throw new Error(message);
}

beforeEach(() => {
  // React logs the caught error; silence it so the run stays readable.
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  // Console only: a unit test must never beacon to /api/log.
  setErrorSink(consoleErrorSink);
});

describe("ErrorBoundary", () => {
  it("renders children while nothing throws", () => {
    render(
      <ErrorBoundary source="test">
        <p>all good</p>
      </ErrorBoundary>,
    );

    expect(screen.getByText("all good")).toBeInTheDocument();
  });

  it("shows a recoverable panel instead of a blank page", () => {
    render(
      <ErrorBoundary source="test">
        <Boom />
      </ErrorBoundary>,
    );

    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /reload/i })).toBeInTheDocument();
  });

  it("uses the caller's copy when provided", () => {
    render(
      <ErrorBoundary
        source="test"
        labels={{
          title: "Se rompió",
          body: "Recargá",
          reload: "Recargar",
          details: "Detalles",
        }}
      >
        <Boom />
      </ErrorBoundary>,
    );

    expect(screen.getByText("Se rompió")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Recargar" }),
    ).toBeInTheDocument();
  });

  it("renders an inline fallback for small areas", () => {
    render(
      <ErrorBoundary source="chart" fallback={<span>Chart unavailable</span>}>
        <Boom />
      </ErrorBoundary>,
    );

    expect(screen.getByText("Chart unavailable")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("supports a null fallback for purely decorative subtrees", () => {
    const { container } = render(
      <ErrorBoundary source="background" fallback={null}>
        <Boom />
      </ErrorBoundary>,
    );

    expect(container).toBeEmptyDOMElement();
  });

  it("reports the failure with the boundary that caught it", () => {
    const sink = vi.fn();
    setErrorSink(sink);

    render(
      <ErrorBoundary source="chart">
        <Boom message="recharts exploded" />
      </ErrorBoundary>,
    );

    expect(sink).toHaveBeenCalledTimes(1);
    expect(sink.mock.calls[0][0]).toMatchObject({
      kind: "error",
      message: "recharts exploded",
      name: "boundary:chart",
    });
    expect(sink.mock.calls[0][0].componentStack).toBeTruthy();
  });

  it("keeps siblings alive when one subtree fails", () => {
    render(
      <div>
        <ErrorBoundary source="chart" fallback={<span>broken</span>}>
          <Boom />
        </ErrorBoundary>
        <p>still here</p>
      </div>,
    );

    expect(screen.getByText("broken")).toBeInTheDocument();
    expect(screen.getByText("still here")).toBeInTheDocument();
  });
});
