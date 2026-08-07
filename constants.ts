export const INITIAL_FUND_AMOUNT = 10000;

/** Legacy HackerEarth JSON (fallback chain only). */
export const LEGACY_API_URL =
  "https://s3-ap-southeast-1.amazonaws.com/he-public-data/db12a41f8.json";

/** BFF quotes — same origin on Vercel; proxied in Vite dev. */
export const QUOTES_API_URL = "/api/quotes";

export const STORAGE_KEY = "erick-market.v2";

/** Fake drift only when using mock/legacy data. */
export const PRICE_TICK_MS = 3000;

/** Poll Finnhub via BFF when live. */
export const LIVE_POLL_MS = 15_000;

export const UI = {
  NAV_TITLE: "Erick Stocks",
  HOME_LINK: "Home",
  MY_STOCKS_LINK: "My Stocks",
  MY_FUND_LINK: "My Fund",
  SEARCH_PLACEHOLDER: "Search stocks...",
  BUY_BUTTON: "Buy",
  SELL_BUTTON: "Sell",
  INCREMENT_ARIA: "Increase quantity",
  DECREMENT_ARIA: "Decrease quantity",
  CURRENCY: "$",
};
