import { describe, expect, it, vi } from "vitest";
import { withRetry } from "./retry";

/** Records the waits instead of serving them, so the suite runs instantly. */
function recorder() {
  const waits: number[] = [];
  return {
    waits,
    sleep: async (ms: number) => {
      waits.push(ms);
    },
  };
}

const always = () => true;
const never = () => false;
/** Pins the jitter so the schedule is an exact number, not a range. */
const noJitter = { random: () => 0 };

describe("withRetry", () => {
  it("returns the first success without waiting", async () => {
    const { waits, sleep } = recorder();
    const fn = vi.fn().mockResolvedValue("ok");

    expect(await withRetry(fn, always, { sleep })).toBe("ok");
    expect(fn).toHaveBeenCalledTimes(1);
    expect(waits).toEqual([]);
  });

  it("retries until it succeeds", async () => {
    const { sleep } = recorder();
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new Error("blip"))
      .mockResolvedValue("ok");

    expect(await withRetry(fn, always, { sleep })).toBe("ok");
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it("gives up after the allotted retries and rethrows the last error", async () => {
    const { sleep } = recorder();
    const fn = vi.fn().mockRejectedValue(new Error("down"));

    await expect(withRetry(fn, always, { retries: 2, sleep })).rejects.toThrow(
      "down",
    );
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it("backs off exponentially", async () => {
    const { waits, sleep } = recorder();
    const fn = vi.fn().mockRejectedValue(new Error("down"));

    await withRetry(fn, always, {
      retries: 3,
      delayMs: 100,
      backoffFactor: 2,
      sleep,
      ...noJitter,
    }).catch(() => null);

    expect(waits).toEqual([100, 200, 400]);
  });

  it("adds jitter, so callers do not resynchronise on the same schedule", async () => {
    const { waits, sleep } = recorder();
    const fn = vi.fn().mockRejectedValue(new Error("down"));

    await withRetry(fn, always, {
      retries: 1,
      delayMs: 100,
      jitterMs: 200,
      random: () => 0.5,
      sleep,
    }).catch(() => null);

    expect(waits).toEqual([200]);
  });

  // The whole reason the predicate has no default: retrying a write that may
  // have landed is how you charge someone twice.
  it("does not retry what the predicate rejects", async () => {
    const { sleep } = recorder();
    const fn = vi.fn().mockRejectedValue(new Error("do not replay"));

    await expect(withRetry(fn, never, { retries: 5, sleep })).rejects.toThrow(
      "do not replay",
    );
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("asks the predicate about the actual error", async () => {
    const { sleep } = recorder();
    const err = Object.assign(new Error("nope"), { code: "price_unavailable" });
    const shouldRetry = vi.fn().mockReturnValue(false);

    await withRetry(vi.fn().mockRejectedValue(err), shouldRetry, {
      sleep,
    }).catch(() => null);

    expect(shouldRetry).toHaveBeenCalledWith(err);
  });

  it("reports each retry to the caller", async () => {
    const { sleep } = recorder();
    const onRetry = vi.fn();

    await withRetry(vi.fn().mockRejectedValue(new Error("down")), always, {
      retries: 2,
      delayMs: 100,
      onRetry,
      sleep,
      ...noJitter,
    }).catch(() => null);

    expect(onRetry).toHaveBeenCalledTimes(2);
    expect(onRetry.mock.calls[0][0]).toMatchObject({ attempt: 1, waitMs: 100 });
    expect(onRetry.mock.calls[1][0]).toMatchObject({ attempt: 2, waitMs: 200 });
  });

  it("passes the attempt number to the work", async () => {
    const { sleep } = recorder();
    const seen: number[] = [];

    await withRetry(
      async (attempt) => {
        seen.push(attempt);
        throw new Error("down");
      },
      always,
      { retries: 2, sleep },
    ).catch(() => null);

    expect(seen).toEqual([0, 1, 2]);
  });

  // A retry loop that outlives the function's own timeout turns a recoverable
  // blip into a dropped request, which is strictly worse than failing early.
  it("stops rather than start a wait that would blow the budget", async () => {
    const fn = vi.fn().mockRejectedValue(new Error("down"));
    let now = 0;
    const sleep = async (ms: number) => {
      now += ms;
    };
    vi.spyOn(Date, "now").mockImplementation(() => now);

    await expect(
      withRetry(fn, always, {
        retries: 10,
        delayMs: 1_000,
        budgetMs: 3_000,
        sleep,
        ...noJitter,
      }),
    ).rejects.toThrow("down");

    // 1000 then 2000 fits; the next wait of 4000 would cross the budget.
    expect(fn).toHaveBeenCalledTimes(3);
    vi.restoreAllMocks();
  });

  it("never retries when retries is zero", async () => {
    const { sleep } = recorder();
    const fn = vi.fn().mockRejectedValue(new Error("down"));

    await withRetry(fn, always, { retries: 0, sleep }).catch(() => null);

    expect(fn).toHaveBeenCalledTimes(1);
  });
});
