import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  timeout: 30_000,
  use: {
    baseURL: "http://127.0.0.1:4174",
    browserName: "chromium",
    launchOptions: {
      executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || "/repl/tools/bin/chromium",
    },
    headless: true,
  },
  webServer: {
    command: "npx vite --config vite.config.ts --host 127.0.0.1 --port 4174",
    url: "http://127.0.0.1:4174/test-fixtures/pulse-dial.html",
    reuseExistingServer: false,
  },
});