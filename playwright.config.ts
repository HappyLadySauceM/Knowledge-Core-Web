import { defineConfig, devices } from "@playwright/test";

export default defineConfig({ testDir: "./e2e", use: { baseURL: "http://localhost:3000", ...devices["Desktop Chrome"] }, webServer: { command: "pnpm dev", url: "http://localhost:3000", reuseExistingServer: true } });
