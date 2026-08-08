import { test as setup } from "@playwright/test";

const authFile = "playwright/.auth/e2e.json";

setup("create authenticated browser state", async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("erick-market.e2e-auth", "1");
    localStorage.setItem("erick-market.lang", "en");
    localStorage.setItem("erick-market.theme", "dark");
  });
  await page.goto("/");
  await page.context().storageState({ path: authFile });
});
