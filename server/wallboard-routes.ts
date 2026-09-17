import type { Express, NextFunction, Request, Response } from "express";
import {
  buildWallboardSnapshot,
  canViewWallboard,
  getWallboardAlarmSettings,
  readableCampaigns,
  saveWallboardAlarmSettings,
} from "./lib/wallboard";
import { wallboardAlarmSettingsSchema } from "@shared/wallboard-alarms";

/** Query parsing shared by the snapshot and alarm endpoints. */
export function parseWallboardCampaignId(req: Request): string | null {
  const value = req.query.campaignId;
  if (value === undefined) return null;
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error("WALLBOARD_INVALID_CAMPAIGN_ID");
  }
  return value;
}

async function authorizeWallboardScope(
  viewer: NonNullable<Request["session"]["user"]>,
  campaignId: string | null,
): Promise<void> {
  if (!(await canViewWallboard(viewer))) throw new Error("WALLBOARD_FORBIDDEN");
  // Do not call buildWallboardSnapshot merely to authorize an alarm scope:
  // this exact readable-campaign query is the single source of scope access.
  const readable = await readableCampaigns(viewer, campaignId);
  if (campaignId !== null && !readable.some((campaign) => campaign.id === campaignId)) {
    throw new Error("WALLBOARD_CAMPAIGN_FORBIDDEN");
  }
}

function respondWallboardError(error: unknown, res: Response): void {
  const code = error instanceof Error ? error.message : "";
  if (code === "WALLBOARD_FORBIDDEN" || code === "WALLBOARD_CAMPAIGN_FORBIDDEN") {
    res.status(403).json({ error: code });
    return;
  }
  if (code === "WALLBOARD_ALARM_SETTINGS_INVALID") {
    res.status(500).json({ error: code });
    return;
  }
  console.error("[Wallboard] request failed:", error);
  res.status(500).json({ error: "WALLBOARD_SOURCE_UNAVAILABLE" });
}

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
      const requested = parseWallboardCampaignId(req);
      return res.json(await buildWallboardSnapshot(viewer, requested));
    } catch (error) {
      if (error instanceof Error && ["WALLBOARD_INVALID_CAMPAIGN_ID", "WALLBOARD_CAMPAIGN_FORBIDDEN"].includes(error.message)) {
        if (error.message === "WALLBOARD_INVALID_CAMPAIGN_ID") {
          return res.status(400).json({ error: error.message });
        }
        return res.status(403).json({ error: error.message });
      }
      console.error("[Wallboard] snapshot failed:", error);
      return res.status(500).json({ error: "WALLBOARD_SOURCE_UNAVAILABLE" });
    }
  });

  app.get("/api/wallboard/alarms", requireAuth, async (req, res) => {
    try {
      const viewer = req.session.user;
      if (!viewer) return res.status(401).json({ error: "Unauthorized" });
      const campaignId = parseWallboardCampaignId(req);
      await authorizeWallboardScope(viewer, campaignId);
      return res.json(await getWallboardAlarmSettings(viewer.id, campaignId));
    } catch (error) {
      if (error instanceof Error && error.message === "WALLBOARD_INVALID_CAMPAIGN_ID") {
        return res.status(400).json({ error: error.message });
      }
      respondWallboardError(error, res);
    }
  });

  app.put("/api/wallboard/alarms", requireAuth, async (req, res) => {
    try {
      const viewer = req.session.user;
      if (!viewer) return res.status(401).json({ error: "Unauthorized" });
      const campaignId = parseWallboardCampaignId(req);
      await authorizeWallboardScope(viewer, campaignId);
      const parsed = wallboardAlarmSettingsSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({
          error: "WALLBOARD_INVALID_ALARM_SETTINGS",
          details: parsed.error.flatten(),
        });
      }
      return res.json(await saveWallboardAlarmSettings(viewer.id, campaignId, parsed.data));
    } catch (error) {
      if (error instanceof Error && error.message === "WALLBOARD_INVALID_CAMPAIGN_ID") {
        return res.status(400).json({ error: error.message });
      }
      respondWallboardError(error, res);
    }
  });
}