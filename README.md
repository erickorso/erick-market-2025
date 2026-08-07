# Stock Market Simulator

Interactive **stock trading simulator** with optional **live US quotes** via a small BFF (Finnhub), buy/sell into a virtual portfolio, and Three.js background.

By [Erick Vargas](https://github.com/erickorso) · Live: [erick-market-2025.vercel.app](https://erick-market-2025.vercel.app)

## How data works

```text
Browser  →  GET /api/quotes?limit=10&offset=0&q=  →  Finnhub
                ↓ fail / no key
              client mock watchlist (same paging)
```

| Source | When | Updates |
|--------|------|---------|
| **live** | `FINNHUB_API_KEY` set on BFF | Poll every 15s (loaded window) |
| **mock** | BFF fails / no key | Simulated tick 3s |

**Paging / search / categories:** first page is 10 symbols (`PAGE_SIZE`). UI “Load more” appends `offset+=10`. Navbar search → `?q=`. Category chips → `?category=` (`long-term`, `short-term`, `growth`, `dividend`, `blue-chip`, `volatile`, plus live `gainers` / `losers`). Curated tags are educational, not advice.

**Hot sidebar:** left rail shows top day gainers. Local BFF pushes over WebSocket `ws://…/ws/hot` every **5 min** (and on connect). On Vercel (no persistent WS) the client falls back to `GET /api/hot` poll every 5 min.

**Detail modal:** click a card or Hot row → `GET /api/detail?symbol=` (quote + profile2 + daily candles ~90d). Card sparklines are **simulated**; the modal chart uses Finnhub candles when the free tier returns them, otherwise falls back to simulated with a clear label.

Buy/sell is **still simulated** (local state + `localStorage`) — not a real broker.

## Stack

- React 19 · TypeScript · Vite · Tailwind · Recharts · Three.js
- BFF: `server/quotes.ts` + local `server/dev-api.ts` · Vercel `api/quotes.ts`

## Setup (live quotes)

1. Free key: [finnhub.io/register](https://finnhub.io/register)
2. `cp .env.example .env` → set `FINNHUB_API_KEY=...`
3. Two terminals:

```bash
npm install
npm run dev:api    # :4010
npm run dev        # Vite proxies /api → :4010
```

## Deploy (Vercel)

1. Project → Settings → Environment Variables → `FINNHUB_API_KEY`
2. Redeploy — `/api/quotes` is the serverless function

Without the key, the site still works (legacy/mock fallback).

## Scripts

| Command | What |
|---------|------|
| `npm run dev` | Frontend only |
| `npm run dev:api` | Local quotes BFF |
| `npm run build` | typecheck + Vite build |
| `npm run typecheck` | `tsc --noEmit` |

## Note

Educational demo — not financial advice. Finnhub free tier is rate-limited (BFF caches ~20s).
