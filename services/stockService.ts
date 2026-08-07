import type { ApiStockRow, ChartDataPoint, EnrichedStock } from "../types";
import { QUOTES_API_URL } from "../constants";

export function generateChartData(currentPrice: number): ChartDataPoint[] {
  const data: ChartDataPoint[] = [];
  const points = 10;
  for (let i = 0; i < points; i++) {
    const fluctuation = (Math.random() - 0.5) * currentPrice * 0.1;
    data.push({
      name: `T-${points - 1 - i}`,
      price: Math.max(
        0.01,
        currentPrice -
          fluctuation * (points - 1 - i) * 0.2 +
          Math.random() * currentPrice * 0.05,
      ),
    });
  }
  data.push({ name: "Now", price: currentPrice });
  return data;
}

const MOCK_ROWS: ApiStockRow[] = [
  { name: "NovaTech", price: 142.5 },
  { name: "GreenGrid Energy", price: 68.2 },
  { name: "Pulse Media", price: 31.75 },
  { name: "Aether Cloud", price: 210.0 },
  { name: "Horizon Bio", price: 55.4 },
  { name: "Summit Retail", price: 88.9 },
  { name: "Orbit Mobility", price: 24.15 },
  { name: "Lumen Finance", price: 176.3 },
];

function normalizeRow(row: ApiStockRow, index: number): EnrichedStock {
  const companyRaw =
    (typeof row.company === "string" && row.company.trim()) ||
    (typeof row.name === "string" && row.name.trim()) ||
    `Unknown Company ${index}`;
  const company = companyRaw.trim();
  const symbol =
    typeof row.symbol === "string" && row.symbol.trim()
      ? row.symbol.trim().toUpperCase()
      : undefined;
  const priceNum =
    typeof row.price === "number"
      ? row.price
      : typeof row.price === "string"
        ? Number.parseFloat(row.price)
        : NaN;
  const price = Number.isFinite(priceNum) && priceNum >= 0 ? priceNum : 0;
  const idBase = symbol ?? company;
  return {
    id: `${idBase.replace(/\s+/g, "-").toLowerCase()}-${index}`,
    company: symbol ? `${company} (${symbol})` : company,
    price,
    chartData: generateChartData(price),
  };
}

function parsePayload(data: unknown): ApiStockRow[] {
  if (Array.isArray(data)) return data as ApiStockRow[];
  if (
    data &&
    typeof data === "object" &&
    "stocks" in data &&
    Array.isArray((data as { stocks: unknown }).stocks)
  ) {
    return (data as { stocks: ApiStockRow[] }).stocks;
  }
  throw new Error("Invalid data structure received from API.");
}

export type DataSource = "live" | "mock";

export type FetchStocksResult = {
  stocks: EnrichedStock[];
  source: DataSource;
};

async function fetchJson(url: string, ms = 8000): Promise<unknown> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.json();
  } finally {
    clearTimeout(timer);
  }
}

/** Merge new prices into existing stocks (keeps chart history). */
export function mergeLivePrices(
  previous: EnrichedStock[],
  next: EnrichedStock[],
): EnrichedStock[] {
  const prevById = new Map(previous.map((s) => [s.id, s]));
  return next.map((stock) => {
    const old = prevById.get(stock.id);
    if (!old) return stock;
    const chartData = [
      ...old.chartData.slice(-9).map((p, i, arr) => ({
        ...p,
        name: `T-${arr.length - i}`,
      })),
      { name: "Now", price: stock.price },
    ];
    return { ...stock, chartData };
  });
}

export async function fetchStocks(): Promise<FetchStocksResult> {
  // 1) Real quotes via BFF (Finnhub)
  try {
    const data = await fetchJson(QUOTES_API_URL);
    const raw = parsePayload(data);
    if (raw.length) {
      return { stocks: raw.map(normalizeRow), source: "live" };
    }
  } catch {
    /* mock */
  }

  // 2) Local mock (avoid legacy HE Indian list — looks "stuck" when BFF is down)
  return {
    stocks: MOCK_ROWS.map(normalizeRow),
    source: "mock",
  };
}

/** Simulate live quotes when not on Finnhub. */
export function tickStockPrices(stocks: EnrichedStock[]): EnrichedStock[] {
  return stocks.map((stock) => {
    const drift = 1 + (Math.random() - 0.5) * 0.03;
    const next = Math.max(0.01, Number((stock.price * drift).toFixed(2)));
    const chartData = [
      ...stock.chartData.slice(-9),
      { name: "Now", price: next },
    ];
    const labeled = chartData.map((p, i, arr) =>
      i === arr.length - 1 ? p : { ...p, name: `T-${arr.length - 1 - i}` },
    );
    return { ...stock, price: next, chartData: labeled };
  });
}
