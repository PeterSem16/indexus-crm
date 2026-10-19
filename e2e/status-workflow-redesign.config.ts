import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: ".", testMatch: "status-workflow-redesign.spec.ts", timeout: 60000, workers: 1,
  reporter: "list", outputDir: "/tmp/status-workflow-browser-results",
  use: {
    baseURL: process.env.REPLIT_DEV_DOMAIN ? `https://${process.env.REPLIT_DEV_DOMAIN}` : "http://127.0.0.1:5000",
    viewport: { width: 1200, height: 900 }, headless: true,
    launchOptions: { executablePath: "/repl/tools/bin/chromium", args: ["--no-sandbox"] },
  },
});
