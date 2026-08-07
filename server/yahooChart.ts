export type ChartPoint = { name: string; price: number };

export type YahooChartResult = {
  chart: ChartPoint[];
  source: "yahoo";
};

const cache = new Map<string, { at: number; result: YahooChartResult }>();
const TTL_MS = 30 * 60 * 1000;

type YahooPayload = {
  chart?: {
    result?: Array<{
      timestamp?: number[];
      indicators?: { quote?: Array<{ close?: Array<number | null> }> };
    }>;
  };
};

export async function fetchYahooDaily(
  symbol: string,
  range: "1mo" | "3mo" = "1mo",
  maxPoints = 30,
): Promise<YahooChartResult | null> {
  const key = `${symbol}:${range}:${maxPoints}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.result;

  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=${range}`;
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; ErickMarket/1.0)",
        Accept: "application/json",
      },
    });
    if (!res.ok) return null;
    const data = (await res.json()) as YahooPayload;
    const result = data.chart?.result?.[0];
    const times = result?.timestamp ?? [];
    const closes = result?.indicators?.quote?.[0]?.close ?? [];
    const points: ChartPoint[] = [];
    for (let i = 0; i < times.length; i++) {
      const close = closes[i];
      if (typeof close !== "number" || !Number.isFinite(close)) continue;
      const d = new Date(times[i] * 1000);
      points.push({
        name: `${d.getUTCMonth() + 1}/${d.getUTCDate()}`,
        price: Number(close.toFixed(2)),
      });
    }
    if (!points.length) return null;
    const sliced = points.slice(-maxPoints);
    const out: YahooChartResult = { chart: sliced, source: "yahoo" };
    cache.set(key, { at: Date.now(), result: out });
    return out;
  } catch {
    return null;
  }
}

export async function attachYahooCharts<T extends { symbol: string }>(
  rows: T[],
  range: "1mo" | "3mo" = "1mo",
  maxPoints = 20,
): Promise<
  Array<T & { chart: ChartPoint[]; chartSource: "yahoo" | "simulated" }>
> {
  const out: Array<
    T & { chart: ChartPoint[]; chartSource: "yahoo" | "simulated" }
  > = [];
  const concurrency = 4;
  for (let i = 0; i < rows.length; i += concurrency) {
    const chunk = rows.slice(i, i + concurrency);
    const charts = await Promise.all(
      chunk.map((r) => fetchYahooDaily(r.symbol, range, maxPoints)),
    );
    chunk.forEach((row, idx) => {
      const y = charts[idx];
      out.push({
        ...row,
        chart: y?.chart ?? [],
        chartSource: y ? "yahoo" : "simulated",
      });
    });
  }
  return out;
}
