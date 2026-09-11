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

test("offers sign-in after a register email conflict", async ({ page }) => {
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
  await page.getByLabel("Username").fill("alice");
  await page.getByLabel("Email").fill("alice@example.com");
  await page.getByLabel("Password").fill("password1");
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page.locator(".form-error")).toContainText("This email is already registered");
  await expect(page.getByRole("link", { name: "Sign in" })).toHaveAttribute("href", "/zh-CN/login");
  await expect(page.getByRole("link", { name: "Request a new verification link" })).toHaveCount(0);
});

test("keeps the verification token hidden and guides invalid links to sign-in", async ({ page }) => {
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
  await expect(page.getByLabel("Email")).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Continue to sign in" })).toHaveAttribute("href", "/zh-CN/login");
});

test("shows a Studio reminder only for unverified sessions", async ({ page }) => {
  await page.context().addCookies([{ name: "kc_access", value: "test-access", url: "http://localhost:3000" }]);
  await page.route("**/api/bff/auth/session", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        user: {
          id: "1",
          username: "alice",
          avatar: "",
          email: "alice@example.com",
          role: "user",
          status: "pending_verification",
          bio: "",
          created_at: "2026-01-01T00:00:00Z",
          updated_at: "2026-01-01T00:00:00Z",
        },
      }),
    });
  });
  await page.route("**/api/bff/auth/request-verification", async (route) => {
    if (route.request().method() === "GET") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ state: "idle" }),
      });
      return;
    }
    await route.continue();
  });
  await page.route("**/api/bff/gateway/**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ items: [], page: { has_more: false } }),
    });
  });
  await page.goto("/zh-CN/studio");
  await expect(page.locator(".verify-banner")).toContainText("请验证邮箱");
  await expect(page.getByRole("button", { name: "发送验证邮件" })).toBeEnabled();
});

test("hides the Studio reminder after the email is verified", async ({ page }) => {
  await page.context().addCookies([{ name: "kc_access", value: "test-access", url: "http://localhost:3000" }]);
  await page.route("**/api/bff/auth/session", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        user: {
          id: "1",
          username: "alice",
          avatar: "",
          email: "alice@example.com",
          role: "user",
          status: "active",
          bio: "",
          created_at: "2026-01-01T00:00:00Z",
          updated_at: "2026-01-01T00:00:00Z",
          email_verified_at: "2026-01-01T01:00:00Z",
        },
      }),
    });
  });
  await page.route("**/api/bff/gateway/**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ items: [], page: { has_more: false } }),
    });
  });
  await page.goto("/zh-CN/studio");
  await expect(page.locator(".verify-banner")).toHaveCount(0);
});

test("hides the reset token and keeps the new password field", async ({ page }) => {
  await page.goto("/zh-CN/reset-password?token=ka1.reset-token");
  await expect(page.locator('input[name="token"]')).toHaveAttribute("type", "hidden");
  await expect(page.locator('input[name="token"]')).toHaveValue("ka1.reset-token");
  await expect(page.getByLabel("Token")).toHaveCount(0);
  await expect(page.getByLabel("New password")).toBeVisible();
});
