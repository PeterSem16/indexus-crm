import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: ".", testMatch: "status-list-recap.spec.ts",
  timeout: 90_000, workers: 1, reporter: "list",
  outputDir: "/tmp/status-list-recap-results",
  use: {
    baseURL: "http://127.0.0.1:5181", headless: true,
    viewport: { width: 1100, height: 800 },
    launchOptions: { executablePath: "/repl/tools/bin/chromium", args: ["--no-sandbox"] },
  },
  webServer: {
    command: "npx vite --host 127.0.0.1 --port 5181 --strictPort",
    cwd: process.cwd(),
    url: "http://127.0.0.1:5181/test-fixtures/status-list-recap.html",
    reuseExistingServer: false, timeout: 60_000,
  },
});
