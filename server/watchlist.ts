/** Curated US names + educational tags (not financial advice). */

export type StyleTag =
  | "long-term"
  | "short-term"
  | "growth"
  | "dividend"
  | "blue-chip"
  | "volatile";

export type CategoryId = "all" | StyleTag | "gainers" | "losers";

export type WatchItem = {
  symbol: string;
  company: string;
  tags: StyleTag[];
};

export const CATEGORIES: {
  id: CategoryId;
  label: string;
  hint: string;
}[] = [
  { id: "all", label: "All", hint: "Full watchlist" },
  {
    id: "long-term",
    label: "Long-term",
    hint: "Compounders / quality holds (curated)",
  },
  {
    id: "short-term",
    label: "Short-term",
    hint: "Higher beta / tactical names (curated)",
  },
  { id: "growth", label: "Growth", hint: "Growth-oriented names (curated)" },
  {
    id: "dividend",
    label: "Dividend",
    hint: "Income / staples tilt (curated)",
  },
  {
    id: "blue-chip",
    label: "Blue chip",
    hint: "Large, established names (curated)",
  },
  {
    id: "volatile",
    label: "Volatile",
    hint: "Higher swing names (curated)",
  },
  {
    id: "gainers",
    label: "Day gainers",
    hint: "Best % change today (live)",
  },
  {
    id: "losers",
    label: "Day losers",
    hint: "Worst % change today (live)",
  },
];

/**
 * Official investor/corporate sites, used when the provider profile has no
 * `weburl` (offline or missing API key).
 */
export const COMPANY_SITES: Record<string, string> = {
  AAPL: "https://www.apple.com",
  MSFT: "https://www.microsoft.com",
  GOOGL: "https://abc.xyz",
  AMZN: "https://www.amazon.com",
  NVDA: "https://www.nvidia.com",
  META: "https://about.meta.com",
  TSLA: "https://www.tesla.com",
  JPM: "https://www.jpmorganchase.com",
  V: "https://www.visa.com",
  MA: "https://www.mastercard.com",
  JNJ: "https://www.jnj.com",
  WMT: "https://www.walmart.com",
  PG: "https://www.pg.com",
  XOM: "https://corporate.exxonmobil.com",
  CVX: "https://www.chevron.com",
  HD: "https://www.homedepot.com",
  BAC: "https://www.bankofamerica.com",
  KO: "https://www.coca-colacompany.com",
  PEP: "https://www.pepsico.com",
  COST: "https://www.costco.com",
  AVGO: "https://www.broadcom.com",
  CRM: "https://www.salesforce.com",
  NFLX: "https://www.netflix.com",
  AMD: "https://www.amd.com",
  INTC: "https://www.intel.com",
  ORCL: "https://www.oracle.com",
  CSCO: "https://www.cisco.com",
  DIS: "https://thewaltdisneycompany.com",
  NKE: "https://www.nike.com",
  MCD: "https://www.mcdonalds.com",
  ADBE: "https://www.adobe.com",
  IBM: "https://www.ibm.com",
  QCOM: "https://www.qualcomm.com",
  TXN: "https://www.ti.com",
  UBER: "https://www.uber.com",
  ABNB: "https://www.airbnb.com",
  PYPL: "https://www.paypal.com",
  SQ: "https://block.xyz",
  SHOP: "https://www.shopify.com",
  SPOT: "https://www.spotify.com",
};

export const WATCHLIST: WatchItem[] = [
  { symbol: "AAPL", company: "Apple", tags: ["long-term", "blue-chip", "growth"] },
  { symbol: "MSFT", company: "Microsoft", tags: ["long-term", "blue-chip", "growth"] },
  { symbol: "GOOGL", company: "Alphabet", tags: ["long-term", "blue-chip", "growth"] },
  { symbol: "AMZN", company: "Amazon", tags: ["long-term", "growth", "volatile"] },
  { symbol: "NVDA", company: "NVIDIA", tags: ["growth", "short-term", "volatile"] },
  { symbol: "META", company: "Meta", tags: ["growth", "volatile", "short-term"] },
  { symbol: "TSLA", company: "Tesla", tags: ["short-term", "volatile", "growth"] },
  { symbol: "JPM", company: "JPMorgan", tags: ["blue-chip", "dividend", "long-term"] },
  { symbol: "V", company: "Visa", tags: ["long-term", "blue-chip", "growth"] },
  { symbol: "MA", company: "Mastercard", tags: ["long-term", "blue-chip", "growth"] },
  { symbol: "JNJ", company: "Johnson & Johnson", tags: ["dividend", "blue-chip", "long-term"] },
  { symbol: "WMT", company: "Walmart", tags: ["dividend", "blue-chip", "long-term"] },
  { symbol: "PG", company: "Procter & Gamble", tags: ["dividend", "blue-chip", "long-term"] },
  { symbol: "XOM", company: "Exxon Mobil", tags: ["dividend", "blue-chip"] },
  { symbol: "CVX", company: "Chevron", tags: ["dividend", "blue-chip"] },
  { symbol: "HD", company: "Home Depot", tags: ["blue-chip", "dividend", "long-term"] },
  { symbol: "BAC", company: "Bank of America", tags: ["dividend", "short-term"] },
  { symbol: "KO", company: "Coca-Cola", tags: ["dividend", "blue-chip", "long-term"] },
  { symbol: "PEP", company: "PepsiCo", tags: ["dividend", "blue-chip", "long-term"] },
  { symbol: "COST", company: "Costco", tags: ["long-term", "blue-chip", "growth"] },
  { symbol: "AVGO", company: "Broadcom", tags: ["growth", "dividend", "volatile"] },
  { symbol: "CRM", company: "Salesforce", tags: ["growth", "short-term"] },
  { symbol: "NFLX", company: "Netflix", tags: ["growth", "volatile", "short-term"] },
  { symbol: "AMD", company: "AMD", tags: ["growth", "volatile", "short-term"] },
  { symbol: "INTC", company: "Intel", tags: ["volatile", "short-term", "dividend"] },
  { symbol: "ORCL", company: "Oracle", tags: ["blue-chip", "growth", "dividend"] },
  { symbol: "CSCO", company: "Cisco", tags: ["dividend", "blue-chip"] },
  { symbol: "DIS", company: "Disney", tags: ["blue-chip", "volatile"] },
  { symbol: "NKE", company: "Nike", tags: ["blue-chip", "growth"] },
  { symbol: "MCD", company: "McDonald's", tags: ["dividend", "blue-chip", "long-term"] },
  { symbol: "ADBE", company: "Adobe", tags: ["growth", "volatile"] },
  { symbol: "IBM", company: "IBM", tags: ["dividend", "blue-chip"] },
  { symbol: "QCOM", company: "Qualcomm", tags: ["growth", "dividend", "volatile"] },
  { symbol: "TXN", company: "Texas Instruments", tags: ["dividend", "blue-chip", "long-term"] },
  { symbol: "UBER", company: "Uber", tags: ["growth", "short-term", "volatile"] },
  { symbol: "ABNB", company: "Airbnb", tags: ["growth", "short-term", "volatile"] },
  { symbol: "PYPL", company: "PayPal", tags: ["volatile", "short-term"] },
  { symbol: "SQ", company: "Block", tags: ["volatile", "short-term", "growth"] },
  { symbol: "SHOP", company: "Shopify", tags: ["growth", "volatile", "short-term"] },
  { symbol: "SPOT", company: "Spotify", tags: ["growth", "volatile", "short-term"] },
];

export const PAGE_SIZE = 10;

const STYLE_TAGS = new Set<string>([
  "long-term",
  "short-term",
  "growth",
  "dividend",
  "blue-chip",
  "volatile",
]);

export function parseCategory(raw: unknown): CategoryId {
  const v = String(raw ?? "all").trim().toLowerCase();
  if (v === "all" || v === "") return "all";
  if (v === "gainers" || v === "losers") return v;
  if (STYLE_TAGS.has(v)) return v as StyleTag;
  return "all";
}

export function filterWatchlist(
  q: string,
  category: CategoryId,
): WatchItem[] {
  const query = q.trim().toLowerCase();
  return WATCHLIST.filter((w) => {
    const textOk =
      !query ||
      w.symbol.toLowerCase().includes(query) ||
      w.company.toLowerCase().includes(query);
    if (!textOk) return false;
    if (category === "all" || category === "gainers" || category === "losers") {
      return true;
    }
    return w.tags.includes(category);
  });
}

export function tagsForSymbol(symbol: string): StyleTag[] {
  return WATCHLIST.find((w) => w.symbol === symbol)?.tags ?? [];
}
