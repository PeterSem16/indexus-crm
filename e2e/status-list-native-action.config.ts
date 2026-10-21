import { defineConfig } from "@playwright/test";
import base from "./status-list-admin.config";

export default defineConfig({
  ...base,
  testMatch: "status-list-native-action.spec.ts",
  outputDir: "/tmp/status-list-native-action-results",
  use: {
    ...base.use,
    baseURL: "http://127.0.0.1:5179",
  },
  webServer: {
    command: "npx vite --host 127.0.0.1 --port 5179 --strictPort",
    cwd: process.cwd(),
    url: "http://127.0.0.1:5179/test-fixtures/status-list-native-action.html",
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});
