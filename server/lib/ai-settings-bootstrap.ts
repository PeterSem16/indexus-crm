import type { Express, RequestHandler } from "express";
import { pool } from "../db";
import { AISettingsStore } from "./ai/settings-store";
import { installAIAdminReload } from "./ai/admin-runtime";
import { registerAISettingsRoutes } from "./ai/settings-controller";
import { parseAIRouterMode } from "./ai/router";
import { aiSettingsAdminGuard } from "./ai/settings-authorization";
import { AISettingsError } from "./ai/settings-policy";
import { inferenceStore } from "./ai-jobs/inference-live";
import { createMaintenanceStore } from "./ai-jobs/maintenance-store";
import { registerMaintenanceRoutes } from "./ai-jobs/maintenance-routes";
import { maintenanceAllowsClaim } from "./ai-jobs/maintenance-gate";
export const aiSettingsStore = new AISettingsStore(pool);
export async function initializeAIAdministration() {
  await aiSettingsStore.initialize();
  if (parseAIRouterMode(process.env.INDEXUS_AI_ROUTER_MODE) !== "legacy") {
    await aiSettingsStore.read();
    installAIAdminReload(async () => {
      try { await aiSettingsStore.read(); }
      catch { throw new AISettingsError("settings_unavailable", 503); }
    });
  }
}
export function registerAIAdministration(app: Express, requireAuth: RequestHandler) {
  const requireAdmin = aiSettingsAdminGuard(pool, requireAuth);
  registerMaintenanceRoutes(app, requireAdmin, createMaintenanceStore(pool));
  registerAISettingsRoutes(app, { store: aiSettingsStore, requireAdmin,
    allowInternalTest: () => maintenanceAllowsClaim(pool),
    queueStatus: () => inferenceStore.status() });
}
