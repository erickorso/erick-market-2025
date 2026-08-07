import { WATCHLIST } from "./watchlist";

export type StockDetailPayload = {
  source: "live" | "unavailable";
  chartSource: "live" | "unavailable";
  symbol: string;
  company: string;
  tags: string[];
  quote: {
    price: number;
    change: number;
    changePercent: number;
    high: number | null;
    low: number | null;
    open: number | null;
    previousClose: number | null;
  };
  profile: {
    exchange: string | null;
    industry: string | null;
    logo: string | null;
    weburl: string | null;
    marketCap: number | null;
    sharesOutstanding: number | null;
    ipo: string | null;
    country: string | null;
    currency: string | null;
  };
  chart: { name: string; price: number }[];
};

type Quote = { c?: number; d?: number; dp?: number; h?: number; l?: number; o?: number; pc?: number };
type Profile = {
  name?: string;
  exchange?: string;
  finnhubIndustry?: string;
  logo?: string;
  weburl?: string;
  marketCapitalization?: number;
  shareOutstanding?: number;
  ipo?: string;
  country?: string;
  currency?: string;
};
type Candle = { s?: string; c?: number[]; t?: number[] };

export async function getStockDetail(
  apiKey: string | undefined,
  symbolRaw: string,
): Promise<StockDetailPayload | { error: string; status: number }> {
  const symbol = symbolRaw.trim().toUpperCase();
  if (!symbol || !/^[A-Z.]{1,10}$/.test(symbol)) {
    return { error: "invalid symbol", status: 400 };
  }
  if (!apiKey) {
    return { error: "FINNHUB_API_KEY missing", status: 503 };
  }

  const to = Math.floor(Date.now() / 1000);
  const from = to - 90 * 24 * 60 * 60;
  const q = encodeURIComponent(symbol);
  const t = encodeURIComponent(apiKey);

  const [quoteRes, profileRes, candleRes] = await Promise.all([
    fetch(`https://finnhub.io/api/v1/quote?symbol=${q}&token=${t}`),
    fetch(`https://finnhub.io/api/v1/stock/profile2?symbol=${q}&token=${t}`),
    fetch(
      `https://finnhub.io/api/v1/stock/candle?symbol=${q}&resolution=D&from=${from}&to=${to}&token=${t}`,
    ),
  ]);

  const quote = (await quoteRes.json()) as Quote;
  const profile = (await profileRes.json()) as Profile;
  let chartSource: "live" | "unavailable" = "unavailable";
  let closes: number[] = [];
  let times: number[] = [];
  if (candleRes.ok) {
    const candle = (await candleRes.json()) as Candle;
    if (candle.s === "ok" && Array.isArray(candle.c) && candle.c.length) {
      chartSource = "live";
      closes = candle.c;
      times = candle.t ?? [];
    }
  }

  const price = typeof quote.c === "number" ? quote.c : 0;
  if (!price) return { error: "quote not found", status: 404 };

  const watch = WATCHLIST.find((w) => w.symbol === symbol);

  return {
    source: "live",
    chartSource,
    symbol,
    company: profile.name || watch?.company || symbol,
    tags: watch?.tags ?? [],
    quote: {
      price,
      change: typeof quote.d === "number" ? quote.d : 0,
      changePercent: typeof quote.dp === "number" ? quote.dp : 0,
      high: typeof quote.h === "number" ? quote.h : null,
      low: typeof quote.l === "number" ? quote.l : null,
      open: typeof quote.o === "number" ? quote.o : null,
      previousClose: typeof quote.pc === "number" ? quote.pc : null,
    },
    profile: {
      exchange: profile.exchange ?? null,
      industry: profile.finnhubIndustry ?? null,
      logo: profile.logo ?? null,
      weburl: profile.weburl ?? null,
      marketCap: profile.marketCapitalization ?? null,
      sharesOutstanding: profile.shareOutstanding ?? null,
      ipo: profile.ipo ?? null,
      country: profile.country ?? null,
      currency: profile.currency ?? "USD",
    },
    chart: closes.map((close, i) => {
      const ts = times[i] ? new Date(times[i] * 1000) : null;
      const name = ts
        ? `${ts.getUTCMonth() + 1}/${ts.getUTCDate()}`
        : `D-${closes.length - i}`;
      return { name, price: close };
    }),
  };
}
