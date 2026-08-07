import type { ApiStockRow, ChartDataPoint, EnrichedStock } from "../types";
import { API_URL } from "../constants";

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
  const priceNum =
    typeof row.price === "number"
      ? row.price
      : typeof row.price === "string"
        ? Number.parseFloat(row.price)
        : NaN;
  const price = Number.isFinite(priceNum) && priceNum >= 0 ? priceNum : 0;
  return {
    id: `${company.replace(/\s+/g, "-").toLowerCase()}-${index}`,
    company,
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

export type FetchStocksResult = {
  stocks: EnrichedStock[];
  source: "api" | "mock";
};

export async function fetchStocks(): Promise<FetchStocksResult> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);
    const response = await fetch(API_URL, { signal: controller.signal });
    clearTimeout(timer);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    const raw = parsePayload(await response.json());
    if (!raw.length) throw new Error("Empty stock list");
    return {
      stocks: raw.map(normalizeRow),
      source: "api",
    };
  } catch {
    return {
      stocks: MOCK_ROWS.map(normalizeRow),
      source: "mock",
    };
  }
}

/** Simulate live quotes: ±1.5% drift and refresh chart. */
export function tickStockPrices(stocks: EnrichedStock[]): EnrichedStock[] {
  return stocks.map((stock) => {
    const drift = 1 + (Math.random() - 0.5) * 0.03;
    const next = Math.max(0.01, Number((stock.price * drift).toFixed(2)));
    const chartData = [...stock.chartData.slice(-9), { name: "Now", price: next }];
    // relabel earlier points
    const labeled = chartData.map((p, i, arr) =>
      i === arr.length - 1 ? p : { ...p, name: `T-${arr.length - 1 - i}` },
    );
    return { ...stock, price: next, chartData: labeled };
  });
}
