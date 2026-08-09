export const INITIAL_FUND_AMOUNT = 10000;

export const STORAGE_KEY = "erick-market.v2";
export const PLAYER_KEY = "erick-market.player.v1";
export const LEAGUE_LOCAL_KEY = "erick-market.league.v1";
export const LEAGUE_API_URL = "/api/league";

/** BFF quotes — same origin on Vercel; proxied in Vite dev. */
export const QUOTES_API_URL = "/api/quotes";
export const HOT_API_URL = "/api/hot";
export const DETAIL_API_URL = "/api/detail";

/** Local BFF WS path (proxied in Vite). Vercel falls back to HTTP poll. */
export const HOT_WS_PATH = "/ws/hot";

/** Hot sidebar refresh — 5 minutes. */
export const HOT_REFRESH_MS = 5 * 60 * 1000;

/** Fake drift only when using mock data. */
export const PRICE_TICK_MS = 3000;

/** Poll Finnhub via BFF when live. */
export const LIVE_POLL_MS = 15_000;

export const UI = {
  NAV_TITLE: "Erick Market",
  HOME_LINK: "Home",
  MY_STOCKS_LINK: "My Stocks",
  MY_FUND_LINK: "My Fund",
  LEAGUE_LINK: "Play",
  SEARCH_PLACEHOLDER: "Search stocks...",
  BUY_BUTTON: "Buy",
  SELL_BUTTON: "Sell",
  INCREMENT_ARIA: "Increase quantity",
  DECREMENT_ARIA: "Decrease quantity",
  CURRENCY: "$",
  MARKET_DISCLAIMER:
    "Si no sabés de mercado: tratá el demo como visualización, no como señal. Para invertir “de verdad” hace falta tesis (negocio, valuación, riesgo), horizonte y diversificación — no un número verde del sidebar.",
};
