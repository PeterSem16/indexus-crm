import type { Express, RequestHandler } from "express";
import type { createMaintenanceStore } from "./maintenance-store";
import { parseMaintenanceCommand } from "./maintenance-store";
import { JobError } from "./policy";

/** Uses exactly the existing global AI administration guard. */
export function registerMaintenanceRoutes(app: Express, requireAdmin: RequestHandler,
  store: ReturnType<typeof createMaintenanceStore>) {
  const path = "/api/configurator/ai/maintenance";
  const actor = (req: any): string => req.session?.user?.id ?? "";
  app.get(path, requireAdmin, async (req, res) => {
    res.setHeader("Cache-Control", "no-store");
    try { res.json(await store.read(actor(req))); }
    catch { res.status(503).json({ error: "maintenance_unavailable", code: "maintenance_unavailable" }); }
  });
  app.put(path, requireAdmin, async (req, res) => {
    res.setHeader("Cache-Control", "no-store");
    try {
      if (!req.is("application/json")) { res.status(415).json({ error: "maintenance_invalid", code: "maintenance_invalid" }); return; }
      const origin = req.get("origin");
      if (origin && new URL(origin).host !== req.get("host")) throw new JobError("forbidden", 403);
      const input = parseMaintenanceCommand(req.body);
      await store.change(actor(req), input);
      res.json(await store.read(actor(req)));
    } catch (error) {
      const known = error instanceof JobError;
      res.status(known ? error.status : 503).json({
        error: known ? error.code : "maintenance_unavailable",
        code: known ? error.code : "maintenance_unavailable",
      });
    }
  });
}
