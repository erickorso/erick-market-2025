import { describe, expect, it } from "vitest";
import { INITIAL_FUND, currentMonthKey, previousMonthKey } from "./month";

describe("currentMonthKey", () => {
  it("formats as YYYY-MM", () => {
    expect(currentMonthKey(new Date(2026, 7, 8))).toBe("2026-08");
  });

  it("pads single-digit months", () => {
    expect(currentMonthKey(new Date(2026, 0, 1))).toBe("2026-01");
  });

  it("does not pad a two-digit month", () => {
    expect(currentMonthKey(new Date(2026, 11, 31))).toBe("2026-12");
  });
});

describe("previousMonthKey", () => {
  it("steps back one month", () => {
    expect(previousMonthKey("2026-08")).toBe("2026-07");
  });

  it("rolls the year back across January", () => {
    expect(previousMonthKey("2026-01")).toBe("2025-12");
  });

  it("keeps the padded format", () => {
    expect(previousMonthKey("2026-11")).toBe("2026-10");
  });

  it("round-trips against currentMonthKey", () => {
    const now = currentMonthKey(new Date(2026, 5, 15));
    expect(previousMonthKey(now)).toBe("2026-05");
  });
});

describe("INITIAL_FUND", () => {
  it("is the $10,000 every player starts the month with", () => {
    expect(INITIAL_FUND).toBe(10_000);
  });
});
