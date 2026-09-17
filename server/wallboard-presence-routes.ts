import type { Express, NextFunction, Request, Response } from "express";
import { and, eq, isNull } from "drizzle-orm";
import { db } from "./db";
import {
  agentSessions,
  agentWorkspaceAccess,
  campaignAgents,
  campaigns,
} from "@shared/schema";
import { canAgentReadCampaignByWorkspaceCountry } from "./lib/agent-workspace-country-access";
import { updateWallboardPresence } from "./lib/wallboard-presence";

type PresencePayload = {
  sessionId: string;
  campaignId: string;
  working: boolean;
};

const PRESENCE_KEYS = ["sessionId", "campaignId", "working"] as const;

/**
 * Kept as a pure helper so strict payload behavior is easy to verify without
 * constructing a database-backed Express application.
 */
export function parseWallboardPresencePayload(body: unknown): PresencePayload | undefined {
  if (!body || typeof body !== "object" || Array.isArray(body)) return undefined;
  const record = body as Record<string, unknown>;
  const keys = Object.keys(record);
  if (keys.length !== PRESENCE_KEYS.length || keys.some((key) => !PRESENCE_KEYS.includes(key as typeof PRESENCE_KEYS[number]))) {
    return undefined;
  }
  if (
    typeof record.sessionId !== "string" ||
    record.sessionId.trim().length === 0 ||
    record.sessionId.length > 200 ||
    typeof record.campaignId !== "string" ||
    record.campaignId.trim().length === 0 ||
    record.campaignId.length > 200 ||
    typeof record.working !== "boolean"
  ) return undefined;
  return {
    sessionId: record.sessionId,
    campaignId: record.campaignId,
    working: record.working,
  };
}

export function registerWallboardPresenceRoutes(
  app: Express,
  requireAuth: (req: Request, res: Response, next: NextFunction) => void,
): void {
  app.post("/api/wallboard/presence", requireAuth, async (req, res) => {
    const payload = parseWallboardPresencePayload(req.body);
    if (!payload) return res.status(400).json({ error: "WALLBOARD_PRESENCE_INVALID" });

    const viewer = req.session.user;
    if (!viewer) return res.status(401).json({ error: "Unauthorized" });

    try {
      const [session] = await db.select({
        id: agentSessions.id,
        campaignId: agentSessions.campaignId,
        campaignIds: agentSessions.campaignIds,
      }).from(agentSessions).where(and(
        eq(agentSessions.id, payload.sessionId),
        eq(agentSessions.userId, viewer.id),
        isNull(agentSessions.endedAt),
      )).limit(1);
      if (!session) return res.status(403).json({ error: "WALLBOARD_PRESENCE_FORBIDDEN" });

      let allowedCampaignIds = [...new Set([
        ...(session.campaignIds || []),
        ...(session.campaignId ? [session.campaignId] : []),
      ])];
      // Older sessions may not have stored campaign IDs.  Resolve the same
      // user's current campaign assignments instead of trusting the browser.
      if (allowedCampaignIds.length === 0) {
        const assignments = await db.select({ campaignId: campaignAgents.campaignId })
          .from(campaignAgents)
          .where(eq(campaignAgents.userId, viewer.id));
        allowedCampaignIds = [...new Set(assignments.map((row) => row.campaignId))];
      }
      if (!allowedCampaignIds.includes(payload.campaignId)) {
        return res.status(403).json({ error: "WALLBOARD_PRESENCE_FORBIDDEN" });
      }

      const [campaign] = await db.select({
        id: campaigns.id,
        status: campaigns.status,
        countryCodes: campaigns.countryCodes,
      }).from(campaigns).where(and(
        eq(campaigns.id, payload.campaignId),
        eq(campaigns.status, "active"),
      )).limit(1);
      if (!campaign) return res.status(403).json({ error: "WALLBOARD_PRESENCE_FORBIDDEN" });

      const workspace = await db.select({ countryCode: agentWorkspaceAccess.countryCode })
        .from(agentWorkspaceAccess)
        .where(eq(agentWorkspaceAccess.userId, viewer.id));
      if (!canAgentReadCampaignByWorkspaceCountry({
        role: viewer.role,
        workspaceCountryCodes: workspace.map((row) => row.countryCode),
        campaignCountryCodes: campaign.countryCodes,
      })) {
        return res.status(403).json({ error: "WALLBOARD_PRESENCE_FORBIDDEN" });
      }

      const presence = updateWallboardPresence(viewer.id, payload);
      return res.json({ ok: true, presence });
    } catch (error) {
      console.error("[Wallboard] presence update failed:", error);
      return res.status(500).json({ error: "WALLBOARD_PRESENCE_UNAVAILABLE" });
    }
  });
}