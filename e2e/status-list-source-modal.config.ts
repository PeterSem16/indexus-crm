import { defineConfig } from "@playwright/test";
import adminConfig from "./status-list-admin.config";

export default defineConfig({
  ...adminConfig,
  testMatch: "status-list-source-modal.spec.ts",
  outputDir: "/tmp/status-list-source-modal-results",
});
