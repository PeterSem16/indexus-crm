import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: ".",
  testMatch: "automation-overview.spec.ts",
  timeout: 90_000,
  workers: 1,
  reporter: "list",
  use: {
    baseURL: process.env.AUTOMATION_TEST_BASE_URL || "http://127.0.0.1:5000",
    viewport: { width: 1280, height: 900 },
    headless: true,
    launchOptions: { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || "/repl/tools/bin/chromium" },
  },
  outputDir: "/tmp/automation-overview-browser-results",
});
