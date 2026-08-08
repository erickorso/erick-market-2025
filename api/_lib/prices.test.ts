import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fetchLivePrices } from "./prices";

const fetchMock = vi.fn();

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function quote(c: unknown) {
  return { ok: true, json: async () => ({ c }) } as Response;
}

describe("fetchLivePrices", () => {
  it("returns a price per symbol", async () => {
    fetchMock.mockResolvedValue(quote(190));
    const prices = await fetchLivePrices(["AAPL", "MSFT"], "key");

    expect(prices.get("AAPL")).toBe(190);
    expect(prices.get("MSFT")).toBe(190);
  });

  it("upper-cases symbols so lookups are predictable", async () => {
    fetchMock.mockResolvedValue(quote(190));
    const prices = await fetchLivePrices(["aapl"], "key");

    expect(prices.get("AAPL")).toBe(190);
  });

  it("quotes each symbol once, however often it is repeated", async () => {
    fetchMock.mockResolvedValue(quote(190));
    await fetchLivePrices(["AAPL", "aapl", "AAPL"], "key");

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("skips blank symbols", async () => {
    fetchMock.mockResolvedValue(quote(190));
    await fetchLivePrices(["", "AAPL"], "key");

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("makes no request at all without an API key", async () => {
    const prices = await fetchLivePrices(["AAPL"], undefined);

    expect(prices.size).toBe(0);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("makes no request for an empty symbol list", async () => {
    await fetchLivePrices([], "key");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("drops a symbol the provider rejects", async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 429 } as Response);
    const prices = await fetchLivePrices(["AAPL"], "key");

    expect(prices.size).toBe(0);
  });

  it("drops a non-positive price rather than marking a position to zero", async () => {
    fetchMock.mockResolvedValue(quote(0));
    expect((await fetchLivePrices(["AAPL"], "key")).size).toBe(0);
  });

  it("drops a price that is not a number", async () => {
    fetchMock.mockResolvedValue(quote("n/a"));
    expect((await fetchLivePrices(["AAPL"], "key")).size).toBe(0);
  });

  it("keeps the symbols that did resolve when one throws", async () => {
    fetchMock
      .mockRejectedValueOnce(new Error("network"))
      .mockResolvedValue(quote(420));

    const prices = await fetchLivePrices(["AAPL", "MSFT"], "key");
    expect(prices.size).toBe(1);
  });
});
