import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  use: { baseURL: "http://localhost:3000", ...devices["Desktop Chrome"] },
  webServer: {
    command: process.env.CI ? "node .next/standalone/server.js" : "pnpm dev",
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
