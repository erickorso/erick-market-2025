import { beforeEach, describe, expect, it, vi } from "vitest";
import { claim, parseIdempotencyKey, record, release } from "./idempotency";

const db = vi.hoisted(() => {
  const queue: Record<string, unknown>[][] = [];
  const calls: { text: string; values: unknown[] }[] = [];
  const sql = (strings: TemplateStringsArray, ...values: unknown[]) => {
    calls.push({ text: strings.join(" ? "), values });
    return Promise.resolve(queue.shift() ?? []);
  };
  return { queue, calls, sql };
});

vi.mock("./db.js", () => ({ getSql: () => db.sql }));

function queue(...results: Record<string, unknown>[][]) {
  db.queue.push(...results);
}

beforeEach(() => {
  db.queue.length = 0;
  db.calls.length = 0;
});

describe("parseIdempotencyKey", () => {
  it("accepts a UUID", () => {
    const uuid = "3f2504e0-4f89-11d3-9a0c-0305e82c3301";
    expect(parseIdempotencyKey(uuid)).toBe(uuid);
  });

  it("accepts a plain hex string", () => {
    expect(parseIdempotencyKey("a".repeat(32))).toBe("a".repeat(32));
  });

  it("trims surrounding whitespace", () => {
    expect(parseIdempotencyKey("  abcdefgh  ")).toBe("abcdefgh");
  });

  it.each([
    ["nothing", undefined],
    ["a number", 12345678],
    ["an empty string", ""],
    ["something too short", "abc"],
    ["something too long", "a".repeat(129)],
    ["punctuation that has no business in a key", "abc/def'; DROP"],
    ["whitespace inside", "abcd efgh"],
  ])("rejects %s", (_label, value) => {
    expect(parseIdempotencyKey(value)).toBeNull();
  });
});

describe("claim", () => {
  it("lets the first caller through", async () => {
    queue([{ idempotency_key: "k" }]);

    expect(await claim("u1", "k")).toEqual({ replayed: false });
  });

  it("scopes the key to the user, so two callers cannot collide", async () => {
    queue([{ idempotency_key: "k" }]);
    await claim("u1", "k");

    expect(db.calls[0].values).toContain("u1");
    expect(db.calls[0].text).toMatch(
      /ON CONFLICT \(user_id, idempotency_key\)/,
    );
  });

  // The whole point: the second request is a lookup, not a second purchase.
  it("replays the stored response instead of trading again", async () => {
    const stored = { month: "2026-08", cash: 9_000, positions: [] };
    queue([], [{ response: stored }]);

    expect(await claim("u1", "k")).toEqual({
      replayed: true,
      response: stored,
    });
  });

  // Letting a duplicate proceed mid-execution is the exact failure this
  // exists to prevent, so it is turned away rather than allowed through.
  it("refuses a duplicate that arrives while the first is still running", async () => {
    queue([], [{ response: null }]);

    await expect(claim("u1", "k")).rejects.toMatchObject({
      status: 409,
      code: "trade_in_progress",
    });
  });

  it("treats a vanished row as still in progress rather than free", async () => {
    queue([], []);

    await expect(claim("u1", "k")).rejects.toMatchObject({ status: 409 });
  });
});

describe("record", () => {
  it("stores the response for a later replay", async () => {
    const response = { cash: 9_000 };
    await record("u1", "k", response);

    expect(db.calls[0].text).toMatch(/UPDATE trade_requests/);
    expect(db.calls[0].values).toContain(JSON.stringify(response));
  });
});

describe("release", () => {
  // A rejected trade wrote nothing, so holding its key would strand the user
  // on 409 for a decision they are entitled to retake.
  it("frees a key whose trade never happened", async () => {
    await release("u1", "k");

    expect(db.calls[0].text).toMatch(/DELETE FROM trade_requests/);
    expect(db.calls[0].values).toEqual(["u1", "k"]);
  });

  // Deleting a completed key would turn a replay back into a second purchase.
  it("never frees one that already has a response", async () => {
    await release("u1", "k");

    expect(db.calls[0].text).toMatch(/response IS NULL/);
  });
});
