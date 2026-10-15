import { defineConfig } from "@playwright/test";
import base from "./playwright.config";

// Reuse the running CRM workflow instead of compiling the large application
// in a second Vite process during these full-page integration tests.
export default defineConfig({
  ...base,
  testMatch: "healthcare-legal-entity.spec.ts",
  use: { ...base.use, baseURL: process.env.PLAYWRIGHT_BASE_URL || "http://127.0.0.1:5000" },
  webServer: undefined,
});
