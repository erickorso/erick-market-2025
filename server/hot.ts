import { getMarketQuotesPage } from "./quotes";

export const HOT_LIMIT = 8;
export const HOT_INTERVAL_MS = 5 * 60 * 1000;

export type HotStock = {
  symbol: string;
  company: string;
  price: number;
  changePercent: number;
};

export type HotPayload = {
  type: "hot";
  at: number;
  intervalMs: number;
  source: "live" | "unavailable" | "mock";
  stocks: HotStock[];
};

export async function buildHotPayload(
  apiKey: string | undefined,
): Promise<HotPayload> {
  const result = await getMarketQuotesPage(apiKey, {
    category: "gainers",
    offset: 0,
    limit: HOT_LIMIT,
  });

  return {
    type: "hot",
    at: Date.now(),
    intervalMs: HOT_INTERVAL_MS,
    source: result.source,
    stocks: result.quotes.map((q) => ({
      symbol: q.symbol,
      company: q.company,
      price: q.price,
      changePercent: q.changePercent,
    })),
  };
}
