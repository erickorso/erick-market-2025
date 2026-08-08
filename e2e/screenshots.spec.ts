import { expect, test, type Page } from "@playwright/test";

/**
 * Regenerates the README screenshots from the same deterministic mocks the
 * e2e suite uses, so the images cannot drift from the real UI. Run with
 * `npm run screenshots`; excluded from `npm run test:e2e` by its tag.
 */

const OUT = "docs/screenshots";

function series(base: number) {
  return Array.from({ length: 24 }, (_, i) => ({
    name: `${5 + Math.floor(i / 4)}/${(i % 4) * 7 + 1}`,
    price: Number((base + Math.sin(i / 2.4) * base * 0.05).toFixed(2)),
  }));
}

const stocks = [
  {
    symbol: "AAPL",
    company: "Apple Inc.",
    name: "Apple Inc.",
    price: 214.32,
    change: 2.61,
    changePercent: 1.23,
    tags: ["long-term", "blue-chip", "growth"],
    chart: series(210),
    chartSource: "yahoo",
    quoteSource: "live",
  },
  {
    symbol: "MSFT",
    company: "Microsoft Corp.",
    name: "Microsoft Corp.",
    price: 438.19,
    change: -1.84,
    changePercent: -0.42,
    tags: ["long-term", "blue-chip", "growth"],
    chart: series(440),
    chartSource: "yahoo",
    quoteSource: "live",
  },
  {
    symbol: "NVDA",
    company: "NVIDIA Corp.",
    name: "NVIDIA Corp.",
    price: 126.4,
    change: 4.11,
    changePercent: 3.36,
    tags: ["growth", "short-term", "volatile"],
    chart: series(122),
    chartSource: "yahoo",
    quoteSource: "live",
  },
  {
    symbol: "TSLA",
    company: "Tesla Inc.",
    name: "Tesla Inc.",
    price: 248.5,
    change: -6.2,
    changePercent: -2.43,
    tags: ["short-term", "volatile", "growth"],
    chart: series(255),
    chartSource: "yahoo",
    quoteSource: "live",
  },
];

const hot = [
  { symbol: "ABNB", company: "Airbnb", price: 178.07, changePercent: 17.43 },
  { symbol: "UBER", company: "Uber", price: 75.02, changePercent: 6.46 },
  { symbol: "QCOM", company: "Qualcomm", price: 167.86, changePercent: 4.66 },
  { symbol: "NVDA", company: "NVIDIA", price: 126.4, changePercent: 3.36 },
  { symbol: "SHOP", company: "Shopify", price: 151.57, changePercent: 2.8 },
  { symbol: "SPOT", company: "Spotify", price: 488.14, changePercent: 2.75 },
];

const portfolio = {
  month: "2026-08",
  cash: 7_856.4,
  positions: [
    {
      symbol: "AAPL",
      company: "Apple Inc. (AAPL)",
      qty: 10,
      avg_cost: 208.6,
    },
  ],
};

const league = {
  mode: "shared",
  month: "2026-08",
  entries: [
    { playerId: "p1", name: "Erick", equity: 11_842, pnl: 1_842, pnlPercent: 18.4 },
    { playerId: "p2", name: "Marta", equity: 11_190, pnl: 1_190, pnlPercent: 11.9 },
    { playerId: "p3", name: "Dani", equity: 10_640, pnl: 640, pnlPercent: 6.4 },
    { playerId: "p4", name: "Ana", equity: 10_105, pnl: 105, pnlPercent: 1.05 },
    { playerId: "p5", name: "Luis", equity: 9_720, pnl: -280, pnlPercent: -2.8 },
  ],
  previousWinner: {
    playerId: "p2",
    name: "Marta",
    equity: 12_480,
    pnl: 2_480,
    pnlPercent: 24.8,
  },
};

function json(body: unknown) {
  return {
    status: 200,
    contentType: "application/json",
    body: JSON.stringify(body),
  };
}

async function mockMarket(page: Page) {
  await page.route("**/api/quotes*", (route) =>
    route.fulfill(
      json({
        stocks,
        source: "live",
        total: stocks.length,
        offset: 0,
        limit: 24,
        hasMore: false,
        category: "all",
        categories: [],
      }),
    ),
  );

  await page.route("**/api/hot*", (route) =>
    route.fulfill(json({ type: "hot", source: "live", stocks: hot })),
  );

  await page.route("**/api/detail*", (route) =>
    route.fulfill(
      json({
        source: "live",
        chartSource: "yahoo",
        symbol: "AAPL",
        company: "Apple Inc.",
        tags: ["long-term", "blue-chip", "growth"],
        quote: {
          price: 214.32,
          change: 2.61,
          changePercent: 1.23,
          high: 215.9,
          low: 211.4,
          open: 212.05,
          previousClose: 211.71,
        },
        profile: {
          exchange: "NASDAQ NMS - GLOBAL MARKET",
          industry: "Technology",
          logo: null,
          weburl: "https://www.apple.com",
          marketCap: 3_240_000,
          sharesOutstanding: 15_200,
          ipo: "1980-12-12",
          country: "US",
          currency: "USD",
        },
        chart: series(210),
      }),
    ),
  );

  await page.route("**/api/me", (route) =>
    route.fulfill(
      json({
        user: {
          id: "demo",
          auth0_sub: "auth0|demo",
          email: "demo@example.com",
          display_name: "Erick",
        },
        portfolio,
      }),
    ),
  );

  await page.route("**/api/portfolio", (route) => route.fulfill(json(portfolio)));
  await page.route("**/api/league*", (route) => route.fulfill(json(league)));
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("erick-market.lang", "en");
    localStorage.setItem("erick-market.theme", "dark");
  });
  await mockMarket(page);
});

/**
 * Charts animate in and the data-source notice auto-dismisses after 3.5s.
 * Wait past both so the capture shows the resting state.
 */
async function settle(page: Page) {
  await page.waitForTimeout(4200);
}

test("@screenshots market grid", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");
  await expect(page.getByTestId("company-name").first()).toBeVisible();
  await settle(page);
  await page.screenshot({ path: `${OUT}/market.png` });
});

test("@screenshots stock detail", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 980 });
  await page.goto("/");
  await expect(page.getByTestId("company-name").first()).toBeVisible();
  await page.getByTestId("company-name").first().locator("button").first().click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await settle(page);
  await page.screenshot({ path: `${OUT}/detail.png` });
});

test("@screenshots monthly league", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/#/league");
  await settle(page);
  await page.screenshot({ path: `${OUT}/league.png` });
});

test("@screenshots mobile market", async ({ page }) => {
  await page.setViewportSize({ width: 414, height: 896 });
  await page.goto("/");
  await expect(page.getByTestId("company-name").first()).toBeVisible();
  await settle(page);
  await page.screenshot({ path: `${OUT}/mobile.png` });
});
