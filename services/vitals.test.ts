import { beforeEach, describe, expect, it, vi } from "vitest";
import { reportWebVitals } from "./vitals";
import { reportVital } from "./reporter";

const handlers = vi.hoisted(
  () => ({}) as Record<string, (m: unknown) => void>,
);

vi.mock("web-vitals", () => ({
  onTTFB: (fn: (m: unknown) => void) => (handlers.TTFB = fn),
  onFCP: (fn: (m: unknown) => void) => (handlers.FCP = fn),
  onLCP: (fn: (m: unknown) => void) => (handlers.LCP = fn),
  onCLS: (fn: (m: unknown) => void) => (handlers.CLS = fn),
  onINP: (fn: (m: unknown) => void) => (handlers.INP = fn),
}));

vi.mock("./reporter", () => ({ reportVital: vi.fn() }));

beforeEach(() => {
  vi.mocked(reportVital).mockReset();
  Object.keys(handlers).forEach((k) => delete handlers[k]);
});

describe("reportWebVitals", () => {
  it("subscribes to the five metrics that matter here", () => {
    reportWebVitals();

    // TTFB and FCP diagnose the BFF and the bundle, LCP the market grid,
    // CLS the lazy background, INP whether trading stays responsive.
    expect(Object.keys(handlers).sort()).toEqual([
      "CLS",
      "FCP",
      "INP",
      "LCP",
      "TTFB",
    ]);
  });

  it("forwards a metric with its name, value and rating", () => {
    reportWebVitals();
    handlers.LCP({ name: "LCP", value: 1234.5, rating: "good" });

    expect(reportVital).toHaveBeenCalledWith({
      name: "LCP",
      value: 1234.5,
      rating: "good",
    });
  });

  it("forwards each metric independently", () => {
    reportWebVitals();
    handlers.CLS({ name: "CLS", value: 0.05, rating: "good" });
    handlers.INP({ name: "INP", value: 180, rating: "needs-improvement" });

    expect(reportVital).toHaveBeenCalledTimes(2);
    expect(vi.mocked(reportVital).mock.calls[1][0]).toMatchObject({
      name: "INP",
      rating: "needs-improvement",
    });
  });

  it("reports nothing until a metric actually settles", () => {
    reportWebVitals();
    expect(reportVital).not.toHaveBeenCalled();
  });
});
