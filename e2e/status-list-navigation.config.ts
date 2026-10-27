import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: ".", testMatch: "status-list-navigation.spec.ts",
  timeout: 90_000, workers: 1, reporter: "list",
  outputDir: "/tmp/status-list-navigation-results",
  use: {
    baseURL: "http://127.0.0.1:5182", headless: true,
    viewport: { width: 1200, height: 850 },
    launchOptions: { executablePath: "/repl/tools/bin/chromium", args: ["--no-sandbox"] },
  },
  webServer: {
    command: "npx vite --host 127.0.0.1 --port 5182 --strictPort",
    cwd: process.cwd(),
    url: "http://127.0.0.1:5182/test-fixtures/pulse-status-notes.html",
    reuseExistingServer: false, timeout: 60_000,
  },
});
