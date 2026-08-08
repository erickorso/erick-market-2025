import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

/**
 * Page-level accessibility. The unit suites run axe over individual
 * components; these run it over the assembled page in a real browser, which
 * is the only place the rules that need layout and a whole document can be
 * checked — colour contrast, landmark structure, heading order, and a
 * reachable skip link.
 */

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
    tags: ["growth", "blue-chip"],
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
    quoteSource: "simulated",
  },
];

async function mockMarket(page: Page) {
  await page.route("**/api/quotes*", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        stocks,
        source: "live",
        total: stocks.length,
        offset: 0,
        limit: 24,
        hasMore: false,
        category: "all",
        categories: [],
      }),
    }),
  );

  await page.route("**/api/hot*", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        type: "hot",
        source: "live",
        stocks: [
          {
            symbol: "ABNB",
            company: "Airbnb",
            price: 178.07,
            changePercent: 17.43,
          },
        ],
      }),
    }),
  );

  await page.route("**/api/league*", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        mode: "shared",
        month: "2026-08",
        entries: [
          {
            playerId: "p1",
            name: "Erick",
            equity: 11842,
            pnl: 1842,
            pnlPercent: 18.4,
          },
        ],
        previousWinner: null,
      }),
    }),
  );

  await page.route("**/api/detail*", (route) =>
    route.fulfill({
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
          weburl: "https://www.apple.com",
          marketCap: 3_000_000,
          sharesOutstanding: 1000,
          ipo: "1980-12-12",
          country: "US",
          currency: "USD",
        },
        chart,
      }),
    }),
  );
}

/** WCAG 2.1 A and AA — the level this project holds itself to. */
function scan(page: Page) {
  return new AxeBuilder({ page }).withTags([
    "wcag2a",
    "wcag2aa",
    "wcag21a",
    "wcag21aa",
  ]);
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("erick-market.lang", "en");
    localStorage.setItem("erick-market.theme", "dark");
  });
  await mockMarket(page);
});

test("the market page has no accessibility violations", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByTestId("company-name").first()).toBeVisible();

  const { violations } = await scan(page).analyze();
  expect(violations).toEqual([]);
});

test("the market page is clean in light mode too", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByTestId("company-name").first()).toBeVisible();
  // Contrast is theme-dependent, so both palettes have to hold up.
  await page.getByRole("button", { name: /light mode/i }).click();
  // The palette animates over 300ms; scanning mid-transition would measure
  // intermediate colours rather than the ones a user ends up looking at.
  await page.waitForFunction(
    () =>
      getComputedStyle(document.documentElement).getPropertyValue(
        "color-scheme",
      ) !== undefined,
  );
  await page.waitForTimeout(500);

  const { violations } = await scan(page).analyze();
  expect(violations).toEqual([]);
});

test("the open detail modal has no accessibility violations", async ({
  page,
}) => {
  await page.goto("/");
  await page
    .getByTestId("company-name")
    .first()
    .locator("button")
    .first()
    .click();
  await expect(page.getByRole("dialog")).toBeVisible();

  const { violations } = await scan(page).analyze();
  expect(violations).toEqual([]);
});

test("the modal hides the page behind it from assistive tech", async ({
  page,
}) => {
  await page.goto("/");
  await page
    .getByTestId("company-name")
    .first()
    .locator("button")
    .first()
    .click();
  await expect(page.getByRole("dialog")).toBeVisible();

  // aria-modal alone does not stop virtual-cursor browsing; inert does.
  const header = page.locator("header");
  await expect(header).toHaveAttribute("inert", "");
  await expect(header).toHaveAttribute("aria-hidden", "true");
});

test("the page behind is restored when the modal closes", async ({ page }) => {
  await page.goto("/");
  await page
    .getByTestId("company-name")
    .first()
    .locator("button")
    .first()
    .click();
  await page.getByRole("button", { name: /close detail/i }).click();

  await expect(page.locator("header")).not.toHaveAttribute("inert", "");
});

test("a skip link is the first thing a keyboard user reaches", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.getByTestId("company-name").first()).toBeVisible();

  await page.keyboard.press("Tab");
  const skip = page.getByRole("link", { name: /skip to main content/i });

  await expect(skip).toBeFocused();
  await expect(skip).toBeVisible();

  await page.keyboard.press("Enter");
  await expect(page.locator("main")).toBeFocused();
});

test("the league page has no accessibility violations", async ({ page }) => {
  await page.goto("/#/league");
  await expect(page.getByRole("heading").first()).toBeVisible();

  const { violations } = await scan(page).analyze();
  expect(violations).toEqual([]);
});

test("the market is still clean on a phone", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await expect(page.getByTestId("company-name").first()).toBeVisible();

  const { violations } = await scan(page).analyze();
  expect(violations).toEqual([]);
});

test("the 3D background is skipped when reduced motion is requested", async ({
  browser,
}) => {
  const context = await browser.newContext({ reducedMotion: "reduce" });
  const page = await context.newPage();
  await page.addInitScript(() => {
    localStorage.setItem("erick-market.lang", "en");
    localStorage.setItem("erick-market.theme", "dark");
  });
  await mockMarket(page);

  await page.goto("/");
  await expect(page.getByTestId("company-name").first()).toBeVisible();

  await expect(page.locator("canvas")).toHaveCount(0);
  await context.close();
});
