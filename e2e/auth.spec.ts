import { expect, test } from "@playwright/test";

test.use({ storageState: "playwright/.auth/e2e.json" });

const portfolio = {
  month: "2026-08",
  cash: 10_000,
  positions: [],
};

async function mockAuthenticatedApi(page: Parameters<typeof test>[0]["page"]) {
  await page.route("**/api/quotes*", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        stocks: [
          {
            symbol: "AAPL",
            company: "Apple Inc.",
            name: "Apple Inc.",
            price: 190,
            change: 2.2,
            changePercent: 1.2,
            tags: ["growth"],
            chart: [
              { name: "T-1", price: 188 },
              { name: "Now", price: 190 },
            ],
            chartSource: "yahoo",
          },
        ],
        source: "live",
        total: 1,
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

  await page.route("**/api/me", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        user: {
          id: "e2e-user",
          auth0_sub: "auth0|e2e-user",
          email: "e2e@example.com",
          display_name: "E2E Trader",
        },
        portfolio,
      }),
    });
  });

  await page.route("**/api/portfolio", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(portfolio),
    });
  });

  await page.route("**/api/league*", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        mode: "shared",
        month: "2026-08",
        entries: [],
        previousWinner: null,
      }),
    });
  });
}

test.beforeEach(async ({ page }) => {
  await mockAuthenticatedApi(page);
});

test("authenticated user sees portfolio navigation", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByTestId("My_Stocks")).toBeVisible();
  await expect(page.getByTestId("My_Fund")).toBeVisible();
  await expect(page.getByText("E2E Trader")).toBeVisible();

  await page.getByTestId("My_Fund").click();
  await expect(
    page.getByRole("heading", { name: "My Fund Status", exact: true }),
  ).toBeVisible();
});

test("authenticated user can buy and sends the expected trade", async ({
  page,
}) => {
  let tradeBody: Record<string, unknown> | null = null;
  let idempotencyKey: string | undefined;
  await page.route("**/api/trade", async (route) => {
    tradeBody = JSON.parse(route.request().postData() ?? "{}") as Record<
      string,
      unknown
    >;
    idempotencyKey = route.request().headers()["idempotency-key"];
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        month: "2026-08",
        cash: 9_810,
        positions: [
          {
            symbol: "AAPL",
            company: "Apple Inc.",
            qty: 1,
            avg_cost: 190,
          },
        ],
      }),
    });
  });

  await page.goto("/");
  await page.getByTestId("addCart-Apple Inc. (AAPL)").click();

  await expect
    .poll(() => tradeBody)
    .toEqual({
      side: "buy",
      symbol: "AAPL",
      company: "Apple Inc. (AAPL)",
      qty: 1,
    });
  // The endpoint rejects a request it cannot recognise as a duplicate, so the
  // header is part of the contract, not a nicety.
  expect(idempotencyKey).toMatch(/^[A-Za-z0-9_-]{8,128}$/);
  await expect(page.getByTestId("company-name")).toHaveCount(1);
});
