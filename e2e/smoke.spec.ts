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

test("keeps the requested locale when protecting authenticated pages", async ({ page }) => {
  await page.goto("/en/studio/media");
  await expect(page).toHaveURL(/\/en\/login\?next=%2Fen%2Fstudio%2Fmedia/);
});

test("hides the verification token and auto-submits the magic link", async ({ page }) => {
  await page.route("**/api/bff/auth/verify-email", async (route) => {
    await route.fulfill({
      status: 400,
      contentType: "application/problem+json",
      body: JSON.stringify({
        type: "urn:knowledge-core:problem:identity.invalid_input",
        title: "invalid identity input",
        status: 400,
        key: "identity.invalid_input",
        detail: "invalid identity input",
      }),
    });
  });
  await page.goto("/zh-CN/verify-email?token=ka1.test-token");
  await expect(page.locator('input[name="token"]:not([type="hidden"])')).toHaveCount(0);
  await expect(page.getByLabel("Token")).toHaveCount(0);
  await expect(page.locator(".form-error")).toContainText("This verification link is invalid");
  await expect(page.getByLabel("Email")).toBeVisible();
});

test("hides the reset token and keeps the new password field", async ({ page }) => {
  await page.goto("/zh-CN/reset-password?token=ka1.reset-token");
  await expect(page.locator('input[name="token"]')).toHaveAttribute("type", "hidden");
  await expect(page.locator('input[name="token"]')).toHaveValue("ka1.reset-token");
  await expect(page.getByLabel("Token")).toHaveCount(0);
  await expect(page.getByLabel("New password")).toBeVisible();
});
