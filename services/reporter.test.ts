import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  installGlobalErrorHandlers,
  reportError,
  setErrorSink,
} from "./reporter";

const sink = vi.fn();

beforeEach(() => {
  sink.mockReset();
  setErrorSink(sink);
});

afterEach(() => {
  setErrorSink((report) => console.error("[client-error]", report));
});

describe("reportError", () => {
  it("passes the message, stack and source through", () => {
    reportError(new Error("boom"), "boundary:chart");

    expect(sink).toHaveBeenCalledTimes(1);
    expect(sink.mock.calls[0][0]).toMatchObject({
      message: "boom",
      source: "boundary:chart",
    });
    expect(sink.mock.calls[0][0].stack).toBeTruthy();
  });

  it("wraps a non-Error so the sink always gets a message", () => {
    reportError("just a string", "window.error");
    expect(sink.mock.calls[0][0].message).toBe("just a string");
  });

  it("handles a thrown object", () => {
    reportError({ code: 500 }, "test");
    expect(sink.mock.calls[0][0].message).toContain("object");
  });

  it("records where and when it happened", () => {
    reportError(new Error("boom"), "test");

    const report = sink.mock.calls[0][0];
    expect(report.url).toBe(window.location.href);
    expect(() => new Date(report.at).toISOString()).not.toThrow();
  });

  it("carries the component stack when a boundary supplies one", () => {
    reportError(new Error("boom"), "boundary:root", {
      componentStack: "\n  at StockCard",
    });

    expect(sink.mock.calls[0][0].componentStack).toContain("StockCard");
  });
});

describe("setErrorSink", () => {
  it("redirects every later report to the new sink", () => {
    const second = vi.fn();
    setErrorSink(second);

    reportError(new Error("boom"), "test");

    expect(sink).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledTimes(1);
  });
});

describe("installGlobalErrorHandlers", () => {
  it("reports a rejected promise nothing else caught", () => {
    installGlobalErrorHandlers();

    window.dispatchEvent(
      Object.assign(new Event("unhandledrejection"), {
        reason: new Error("no catch"),
      }),
    );

    expect(sink).toHaveBeenCalledWith(
      expect.objectContaining({
        message: "no catch",
        source: "unhandledrejection",
      }),
    );
  });

  it("reports an error thrown outside the render tree", () => {
    installGlobalErrorHandlers();

    window.dispatchEvent(
      Object.assign(new Event("error"), { error: new Error("global boom") }),
    );

    expect(sink).toHaveBeenCalledWith(
      expect.objectContaining({
        message: "global boom",
        source: "window.error",
      }),
    );
  });
});
