# Stock Market Simulator

Interactive **stock trading simulator** with live US quotes (Finnhub), **Auth0** accounts, and portfolio/league persisted in **Neon Postgres**.

By [Erick Vargas](https://github.com/erickorso) · Live: [erick-market-2025.vercel.app](https://erick-market-2025.vercel.app)

## Architecture

```text
Browser (Vite SPA + Auth0)
   │  public: quotes / hot / detail
   │  auth:   me / portfolio / trade / league score
   ▼
Vercel serverless  ──►  Finnhub
                   ──►  Neon Postgres (users, trades, positions, league)
```

| Area | Auth |
|------|------|
| Home, Hot, stock detail | Public |
| Buy / sell (buttons disabled + login CTA) | Auth0 |
| My Stocks, My Fund, Play | Auth0 |

## Data model

See [`db/schema.sql`](db/schema.sql): `users`, `portfolios`, `positions`, `trades`, `league_scores`, `league_months`.

Month key `YYYY-MM`. New month → fresh `$10,000` cash; previous month winner archived.

## Setup

### 1. Neon

1. Create a free project at [neon.tech](https://neon.tech)
2. Copy the connection string → `DATABASE_URL`
3. Apply schema:

```bash
psql "$DATABASE_URL" -f db/schema.sql
```

### 2. Auth0

1. Create an **Application** (type: Single Page Application)
2. Create an **API** (Identifier = audience, e.g. `https://erick-market-api`)
3. Application settings:
   - Allowed Callback URLs: `http://localhost:5173`, `https://erick-market-2025.vercel.app`
   - Allowed Logout URLs: same
   - Allowed Web Origins: same
4. Copy Domain, Client ID, Audience into `.env` (see `.env.example`)

### 3. Local

```bash
cp .env.example .env
# fill FINNHUB_API_KEY, DATABASE_URL, AUTH0_*, VITE_AUTH0_*
npm install
npm run dev:api    # :4010 — quotes + auth APIs
npm run dev        # Vite proxies /api → :4010
```

### 4. Vercel

Environment variables (Production + Preview):

- `FINNHUB_API_KEY`
- `DATABASE_URL`
- `AUTH0_DOMAIN`
- `AUTH0_AUDIENCE`
- `VITE_AUTH0_DOMAIN`
- `VITE_AUTH0_CLIENT_ID`
- `VITE_AUTH0_AUDIENCE`

Redeploy after setting vars (Vite embeds `VITE_*` at build time).

## Scripts

| Command | What |
|---------|------|
| `npm run dev` | Frontend |
| `npm run dev:api` | Local BFF |
| `npm run build` | typecheck + Vite build |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run db:schema` | Print schema apply hint |

## Note

Educational demo — not financial advice. Finnhub free tier is rate-limited.
