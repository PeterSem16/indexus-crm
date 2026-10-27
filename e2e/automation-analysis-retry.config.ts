import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: ".", testMatch: "automation-analysis-retry.spec.ts", workers: 1, timeout: 90_000,
  outputDir: "../generated-artifacts/analysis-retry-browser", reporter: "list",
  use: { baseURL: process.env.AUTOMATION_TEST_BASE_URL || (process.env.REPLIT_DEV_DOMAIN
    ? `https://${process.env.REPLIT_DEV_DOMAIN}` : "http://127.0.0.1:5000"),
    headless: true, launchOptions: { executablePath: "/repl/tools/bin/chromium" } },
});
