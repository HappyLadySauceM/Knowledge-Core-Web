import { expect, test } from "@playwright/test";

test("redirects the root to the default locale", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveURL(/\/zh-CN$/);
  await expect(page).toHaveTitle(/HappyLadySauce/);
});

test("serves the health endpoint", async ({ request }) => {
  const response = await request.get("/api/health");
  expect(response.ok()).toBeTruthy();
  await expect(response.json()).resolves.toEqual({ status: "ok" });
});

test("renders the editorial homepage with a full-screen hero", async ({ page }) => {
  await page.goto("/en");
  await expect(page.locator(".home-hero")).toBeVisible();
  await expect(page.locator("#articles")).toContainText("Pages worth reading");
});

test("protects the studio shell when no session cookie exists", async ({ page }) => {
  await page.goto("/zh-CN/studio");
  await expect(page).toHaveURL(/\/zh-CN\/login\?next=%2Fzh-CN%2Fstudio/);
});

test("keeps an action token in the confirmation form without consuming it on GET", async ({ page }) => {
  await page.goto("/zh-CN/verify-email?token=ka1.test-token");
  await expect(page.locator('input[name="token"]')).toHaveValue("ka1.test-token");
});
