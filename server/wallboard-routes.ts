import type { Express, NextFunction, Request, Response } from "express";
import { buildWallboardSnapshot, canViewWallboard } from "./lib/wallboard";

export function registerWallboardRoutes(
  app: Express,
  requireAuth: (req: Request, res: Response, next: NextFunction) => void,
) {
  app.get("/api/wallboard", requireAuth, async (req, res) => {
    try {
      const viewer = req.session.user;
      if (!viewer || !(await canViewWallboard(viewer))) {
        return res.status(403).json({ error: "WALLBOARD_FORBIDDEN" });
      }
      if (Array.isArray(req.query.campaignId)) {
        return res.status(400).json({ error: "WALLBOARD_INVALID_CAMPAIGN_ID" });
      }
      const requested = req.query.campaignId === undefined
        ? null
        : typeof req.query.campaignId === "string" && req.query.campaignId.trim().length > 0
          ? req.query.campaignId
          : null;
      if (req.query.campaignId !== undefined && requested === null) {
        return res.status(400).json({ error: "WALLBOARD_INVALID_CAMPAIGN_ID" });
      }
      return res.json(await buildWallboardSnapshot(viewer, requested));
    } catch (error) {
      if (error instanceof Error && error.message === "WALLBOARD_CAMPAIGN_FORBIDDEN") {
        return res.status(403).json({ error: error.message });
      }
      console.error("[Wallboard] snapshot failed:", error);
      return res.status(500).json({ error: "WALLBOARD_SOURCE_UNAVAILABLE" });
    }
  });
}