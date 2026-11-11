import type { Express, RequestHandler } from "express";
import { pool } from "../db";
import { AISettingsStore } from "./ai/settings-store";
import { installAIAdminReload } from "./ai/admin-runtime";
import { registerAISettingsRoutes } from "./ai/settings-controller";
import { parseAIRouterMode } from "./ai/router";
import { aiSettingsAdminGuard } from "./ai/settings-authorization";
import { AISettingsError } from "./ai/settings-policy";
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
  registerAISettingsRoutes(app, { store: aiSettingsStore, requireAdmin });
}
