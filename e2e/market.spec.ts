import { expect, test } from "@playwright/test";

const chart = [
  { name: "T-2", price: 185 },
  { name: "T-1", price: 188 },
  { name: "Now", price: 190 },
];

const stocks = [
  {
    symbol: "AAPL",
    company: "Apple Inc.",
    name: "Apple Inc.",
    price: 190,
    change: 2.2,
    changePercent: 1.2,
    tags: ["growth"],
    chart,
    chartSource: "yahoo",
  },
  {
    symbol: "MSFT",
    company: "Microsoft Corp.",
    name: "Microsoft Corp.",
    price: 420,
    change: -1.5,
    changePercent: -0.4,
    tags: ["blue-chip"],
    chart,
    chartSource: "yahoo",
  },
];

async function mockMarket(page: Parameters<typeof test>[0]["page"]) {
  await page.route("**/api/quotes*", async (route) => {
    const requestUrl = new URL(route.request().url());
    const query = (requestUrl.searchParams.get("q") ?? "").toLowerCase();
    const filtered = query
      ? stocks.filter((stock) =>
          `${stock.symbol} ${stock.company}`.toLowerCase().includes(query),
        )
      : stocks;
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        stocks: filtered,
        source: "live",
        total: filtered.length,
        offset: 0,
        limit: 24,
        hasMore: false,
        category: "all",
        categories: [],
      }),
    });
  });

  await page.route("**/api/hot*", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ stocks: [], source: "mock" }),
    });
  });

  await page.route("**/api/detail*", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        source: "live",
        chartSource: "yahoo",
        symbol: "AAPL",
        company: "Apple Inc.",
        tags: ["growth"],
        quote: {
          price: 190,
          change: 2.2,
          changePercent: 1.2,
          high: 192,
          low: 187,
          open: 188,
          previousClose: 187.8,
        },
        profile: {
          exchange: "NASDAQ",
          industry: "Technology",
          logo: null,
          weburl: null,
          marketCap: 3_000_000,
          sharesOutstanding: 1000,
          ipo: null,
          country: "US",
          currency: "USD",
        },
        chart,
      }),
    });
  });
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("erick-market.lang", "en");
    localStorage.setItem("erick-market.theme", "dark");
  });
  await mockMarket(page);
});

test("loads the public market and filters by search", async ({ page }) => {
  await page.goto("/");

  await expect(
    page.getByRole("heading", { name: "Available Stocks" }),
  ).toBeVisible();
  await expect(page.getByTestId("company-name")).toHaveCount(2);

  await page.getByTestId("search").fill("AAPL");
  await expect(page.getByTestId("company-name")).toHaveCount(1);
  await expect(page.getByText("Apple Inc. (AAPL)")).toBeVisible();
});

test("opens and closes stock detail", async ({ page }) => {
  await page.goto("/");
  await page.getByTestId("company-name").first().locator("button").first().click();

  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole("heading", { name: "Apple Inc." })).toBeVisible();
  await expect(dialog.getByText("$190.00", { exact: true })).toBeVisible();

  await dialog.getByRole("button", { name: "Close detail" }).click();
  await expect(dialog).toBeHidden();
});

test("protects the league route for unauthenticated users", async ({ page }) => {
  await page.goto("/#/league");

  await expect(
    page.getByRole("heading", { name: "Sign in to continue" }),
  ).toBeVisible();
  await expect(
    page.getByRole("main").getByRole("button", { name: "Log in" }),
  ).toBeVisible();
});

test("toggles theme and keeps the market usable on mobile", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("html")).toHaveClass(/dark/);

  await page.getByRole("button", { name: "Switch to light mode" }).click();
  await expect(page.locator("html")).not.toHaveClass(/dark/);
  await expect(page.getByTestId("search")).toBeVisible();
  await expect(page.getByTestId("company-name").first()).toBeVisible();
});