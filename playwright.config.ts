import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  use: { baseURL: "http://localhost:3000", ...devices["Desktop Chrome"] },
  webServer: {
    // CI uses standalone like the production image, including copied static assets.
    // CI 与生产镜像一样跑 standalone，并拷贝静态资源，否则客户端 JS 会 404。
    command: process.env.CI ? "bash scripts/serve-standalone.sh" : "pnpm dev",
    url: "http://localhost:3000",
    reuseExistingServer: !process.env.CI,
    timeout: process.env.CI ? 180_000 : 60_000,
    env: process.env.CI
      ? {
          PORT: "3000",
          HOSTNAME: "0.0.0.0",
          NODE_ENV: "production",
        }
      : undefined,
  },
});
