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

test("renders Chinese login labels, html lang, and a forgot-password link", async ({ page }) => {
  await page.goto("/zh-CN/login");
  await expect(page.locator("html")).toHaveAttribute("lang", "zh-CN");
  await expect(page.getByLabel("邮箱或用户名")).toBeVisible();
  await expect(page.getByLabel("密码")).toBeVisible();
  await expect(page.getByRole("link", { name: "忘记密码？" })).toHaveAttribute("href", "/zh-CN/forgot-password");
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
  await expect(page.locator(".form-error")).toContainText("验证链接无效");
  await expect(page.getByLabel("邮箱")).toBeVisible();
});

test("hides the reset token and keeps the new password field", async ({ page }) => {
  await page.goto("/zh-CN/reset-password?token=ka1.reset-token");
  await expect(page.locator('input[name="token"]')).toHaveAttribute("type", "hidden");
  await expect(page.locator('input[name="token"]')).toHaveValue("ka1.reset-token");
  await expect(page.getByLabel("Token")).toHaveCount(0);
  await expect(page.getByLabel("新密码")).toBeVisible();
});

test("offers verification after a register email conflict", async ({ page }) => {
  await page.route("**/api/bff/auth/register", async (route) => {
    await route.fulfill({
      status: 409,
      contentType: "application/problem+json",
      body: JSON.stringify({
        type: "urn:knowledge-core:problem:identity.email_conflict",
        title: "email already exists",
        status: 409,
        key: "identity.email_conflict",
        detail: "email already exists",
      }),
    });
  });
  await page.goto("/zh-CN/register");
  await page.getByLabel("用户名").fill("alice");
  await page.getByLabel("邮箱").fill("alice@example.com");
  await page.getByLabel("密码").fill("password1");
  await page.getByRole("button", { name: "创建账号" }).click();
  await expect(page.locator(".form-error")).toContainText("该邮箱已注册");
  await expect(page.getByRole("main").getByRole("link", { name: "登录" })).toHaveAttribute("href", "/zh-CN/login");
  await expect(page.getByRole("link", { name: "重新发送验证邮件" })).toHaveAttribute(
    "href",
    "/zh-CN/verify-email?email=alice%40example.com",
  );
});

test("offers verification after an unverified login", async ({ page }) => {
  await page.route("**/api/bff/auth/login", async (route) => {
    await route.fulfill({
      status: 403,
      contentType: "application/problem+json",
      body: JSON.stringify({
        type: "urn:knowledge-core:problem:identity.email_not_verified",
        title: "email verification is required",
        status: 403,
        key: "identity.email_not_verified",
        detail: "email verification is required",
      }),
    });
  });
  await page.goto("/en/login");
  await page.getByLabel("Email or username").fill("alice@example.com");
  await page.getByLabel("Password").fill("password1");
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.locator(".form-error")).toContainText("Verify your email before signing in");
  await expect(page.getByRole("link", { name: "Request a new verification link" })).toHaveAttribute(
    "href",
    "/en/verify-email?email=alice%40example.com",
  );
});
