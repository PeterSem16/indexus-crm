import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: ".", testMatch: "automation-analysis-flow.spec.ts", workers: 1,
  outputDir: "/tmp/automation-analysis-browser-results", reporter: "list",
  use: {
    baseURL: process.env.AUTOMATION_TEST_BASE_URL || (process.env.REPLIT_DEV_DOMAIN
      ? `https://${process.env.REPLIT_DEV_DOMAIN}` : "http://127.0.0.1:5000"),
    browserName: "chromium", headless: true,
    launchOptions: { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || "/repl/tools/bin/chromium" },
  },
});
