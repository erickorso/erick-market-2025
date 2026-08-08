# Erick Stocks — Market Simulator

**Paper trading** demo with live US quotes (Finnhub), **Auth0** accounts, and real persistence on **Neon Postgres** (users, trades, portfolio, and monthly league).

By [Erick Vargas](https://github.com/erickorso) · Live: [erick-market-2025.vercel.app](https://erick-market-2025.vercel.app)

> Educational demo — not financial advice and not a real broker.

---

## Product decisions

| Topic | Decision |
|------|----------|
| **DB** | [Neon](https://neon.tech) Postgres |
| **Auth** | Auth0 (Vite SPA + JWT on Vercel API) |
| **Public** | Home, Hot, detail, quotes |
| **Private (Auth0)** | buy / sell, portfolio (`/my-stocks`, `/my-fund`), Play / league |
| **Buy/sell UX** | Buttons stay **visible but disabled** when logged out + login CTA (not hidden) |
| **Portfolio nav** | *My Stocks* / *My Fund* links only when authenticated |
| **UI** | Dark/light mode, i18n EN/ES, scroll only in the center column |

---

## Architecture

```text
Browser (Vite SPA + Auth0 + UserProvider)
   │  public:   GET /api/quotes | /api/hot | /api/detail
   │  private:  /api/me | /api/portfolio | /api/trade | POST /api/league
   ▼
Vercel serverless (withAuth middleware)
   ├── Finnhub (+ Yahoo charts fallback)
   └── Neon Postgres
```

### Auth layers

| Layer | Role |
|------|------|
| **API `withAuth()`** | [`api/_lib/middleware.ts`](api/_lib/middleware.ts) — CORS, Auth0 JWT, upsert user in Neon |
| **Client** | `AuthProvider` → `UserProvider` (`useUser()`) — Auth0 identity + Neon `profile` / `portfolio` |
| **Routes** | `protectedRoute(<Page />)` on Play, portfolio, and sell |

```mermaid
sequenceDiagram
  participant UI
  participant Auth0
  participant API
  participant Neon

  UI->>Auth0: loginWithRedirect
  Auth0-->>UI: access token
  UI->>API: GET /api/me Bearer JWT
  API->>Neon: upsert users + ensure portfolio
  UI->>API: POST /api/trade
  API->>Neon: trade + positions + cash
  UI->>API: POST /api/league
  API->>Neon: league_scores
```

---

## Data model (Neon)

Source of truth: [`db/schema.sql`](db/schema.sql).

```mermaid
erDiagram
  users ||--o{ portfolios : has
  users ||--o{ trades : makes
  users ||--o{ league_scores : ranks
  portfolios ||--o{ positions : holds
  league_months ||--o{ league_scores : contains

  users {
    text id PK
    text auth0_sub UK
    text email
    text display_name
    timestamptz created_at
  }
  portfolios {
    text user_id PK
    text month PK
    numeric cash
    timestamptz updated_at
  }
  positions {
    text user_id PK
    text symbol PK
    text month PK
    text company
    numeric qty
    numeric avg_cost
  }
  trades {
    text id PK
    text user_id FK
    text month
    text symbol
    text side
    numeric qty
    numeric price
    timestamptz created_at
  }
  league_scores {
    text user_id PK
    text month PK
    numeric equity
    numeric cash
    numeric invested
    numeric pnl
    numeric pnl_pct
    timestamptz updated_at
  }
  league_months {
    text month PK
    text winner_user_id FK
    timestamptz archived_at
  }
```

### Tables

| Table | Role |
|-------|------|
| **users** | Internal profile; `auth0_sub` = JWT `sub` |
| **portfolios** | Cash per user and month (`YYYY-MM`) |
| **positions** | Holdings (qty + avg cost) per symbol/month |
| **trades** | Buy/sell ledger |
| **league_scores** | Monthly mark-to-market ranking |
| **league_months** | Month archive + `winner_user_id` |

### Business rules

- Month = `YYYY-MM`. First access in a new month → portfolio with **$10,000** cash.
- Trades update `positions` + `cash` in the same operation.
- On month rollover, the highest equity is archived as winner in `league_months`.
- Buy/sell remain **simulated** (no real broker).

### League scoring

Ranking is continuous **mark-to-market** for the current month (not a daily cron):

```text
equity  = cash + positions at live prices
pnl     = equity − $10,000
pnl_%   = pnl / 10,000 × 100
```

Scores upsert after trades / price changes (~1s debounce) via `POST /api/league`. The Top 10 sidebar polls the board about every 60s.

---

## Market (public)

| Feature | Detail |
|---------|--------|
| Quotes | `GET /api/quotes?limit=&offset=&q=&category=` → Finnhub |
| Hot | Sidebar top gainers; local WS `/ws/hot` or poll `/api/hot` |
| Detail | Modal → `/api/detail?symbol=` (quote + profile + Yahoo/Finnhub candles) |
| Categories | Educational tags + day gainers/losers |

Without `FINNHUB_API_KEY` the UI falls back to mock (simulated ticks).

---

## Setup

### 1. Neon — https://neon.tech

1. Create a project (e.g. `erick-market`).
2. Copy the **connection string** → `DATABASE_URL`.
3. Apply the schema once:

```bash
psql "$DATABASE_URL" -f db/schema.sql
```

No `psql`: Neon → **SQL Editor** → paste [`db/schema.sql`](db/schema.sql) → Run.

### 2. Auth0

1. **Application** → type *Single Page Application*.
2. **API** → Identifier = audience (e.g. `https://erick-market-api`).
3. On the App:
   - Allowed Callback URLs: `http://localhost:5173`, `https://erick-market-2025.vercel.app`
   - Allowed Logout URLs: same
   - Allowed Web Origins: same
4. Fill `.env` (see [`.env.example`](.env.example)):

| Variable | Use |
|----------|-----|
| `AUTH0_DOMAIN` / `VITE_AUTH0_DOMAIN` | Auth0 tenant |
| `VITE_AUTH0_CLIENT_ID` | SPA Client ID |
| `AUTH0_AUDIENCE` / `VITE_AUTH0_AUDIENCE` | API Identifier |

### 3. Local

```bash
cp .env.example .env
# FINNHUB_API_KEY, DATABASE_URL, AUTH0_*, VITE_AUTH0_*
npm install
npm run dev:api   # :4010 — quotes + auth APIs
npm run dev       # Vite proxies /api → :4010
```

### 4. Vercel

Env (Production + Preview):

- `FINNHUB_API_KEY`
- `DATABASE_URL`
- `AUTH0_DOMAIN`, `AUTH0_AUDIENCE`
- `VITE_AUTH0_DOMAIN`, `VITE_AUTH0_CLIENT_ID`, `VITE_AUTH0_AUDIENCE`

Redeploy after changing `VITE_*` (they are baked into the build).

---

## Scripts

| Command | What it does |
|---------|--------------|
| `npm run dev` | Vite frontend |
| `npm run dev:api` | Local BFF (:4010) |
| `npm run build` | typecheck + Vite build |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run db:schema` | Hint to apply the SQL |

---

## Stack

React 19 · TypeScript · Vite · Tailwind · Recharts · Three.js · Auth0 · Neon · Finnhub · Vercel serverless

## License

MIT · © Erick Vargas Ramos
