# Stock Market Simulator

Interactive **stock trading simulator** (mock money): browse quotes, buy/sell into a virtual portfolio, track P/L — with simulated live price ticks and a Three.js background.

Portfolio demo by [Erick Vargas](https://github.com/erickorso) · React 19 · TypeScript · Vite · Recharts · Three.js

## Stack

- **React** + **TypeScript** + **Vite** (`@vitejs/plugin-react`)
- **Tailwind CSS** (PostCSS build — not CDN)
- **React Router** (HashRouter SPA)
- **Context + useReducer** (portfolio / fund / quotes)
- **Recharts** + **Three.js**

## Features

- Fetch market list from public JSON with **`name` → `company` mapping**
- **Mock fallback** if the remote API fails
- Simulated **live quotes** (~3s tick) that refresh chart points
- Buy / sell with inline notices (no `alert()`)
- Portfolio + fund **persisted in `localStorage`**
- Search, loading / error + **retry**, responsive grid

## Run

```bash
npm install
npm run dev
```

```bash
npm run typecheck
npm run build
npm run preview
```

## Note

Educational simulation only — not financial advice and not connected to real brokerages.
