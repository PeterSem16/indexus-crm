import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: ".",
  testMatch: "automation-task-rules.spec.ts",
  workers: 1,
  use: {
    baseURL: process.env.AUTOMATION_TEST_BASE_URL || "http://127.0.0.1:5000",
    browserName: "chromium",
    headless: true,
    launchOptions: { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || "/repl/tools/bin/chromium" },
  },
});
