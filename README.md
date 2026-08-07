# Stock Market Simulator

Interactive **stock trading simulator** (no real money): browse mock quotes, buy/sell into a virtual portfolio, and track profit/loss — with a **Three.js** animated background.

Personal frontend demo by [Erick Vargas](https://github.com/erickorso) · React · TypeScript · Vite.

## Stack

- **React** + **TypeScript** + **Vite**
- **React Router** (SPA pages)
- **Context + useReducer** (portfolio / funds / listings)
- **Three.js** (3D background)
- Charts for price trends (simulated history)

## Features

- Dynamic stock listings with simulated price updates
- Buy / sell flows affecting virtual cash and holdings
- Portfolio view (avg cost, current value, profit/loss)
- Fund overview (capital, invested, remaining)
- Search + responsive layout

## Run

```bash
npm install   # or yarn
npm run dev
```

```bash
npm run build
npm run preview
```

## Note

Mock / educational simulation only — not financial advice and not connected to live markets.
