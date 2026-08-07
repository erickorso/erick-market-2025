# Stock Market Simulator

Interactive **stock trading simulator** with optional **live US quotes** via a small BFF (Finnhub), buy/sell into a virtual portfolio, and Three.js background.

By [Erick Vargas](https://github.com/erickorso) · Live: [erick-market-2025.vercel.app](https://erick-market-2025.vercel.app)

## How data works

```text
Browser  →  GET /api/quotes  →  Finnhub (server-side key)
                ↓ fail
         legacy HackerEarth JSON → mock list
```

| Source | When | Updates |
|--------|------|---------|
| **live** | `FINNHUB_API_KEY` set on BFF | Poll every 15s |
| **legacy** | BFF down, S3 JSON ok | Simulated tick 3s |
| **mock** | everything fails | Simulated tick 3s |

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
