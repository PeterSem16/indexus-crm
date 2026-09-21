import type { Express, Request, RequestHandler, Response } from "express";
import { sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "./db";
import { canAgentReadCampaignByWorkspaceCountry } from "./lib/agent-workspace-country-access";

const setPayloadSchema = z.object({
  name: z.string().trim().min(1).max(80),
  campaignIds: z.array(z.string().min(1).max(100)).max(100).default([]),
  inboundQueueIds: z.array(z.string().min(1).max(100)).max(100).default([]),
  backOffice: z.boolean().default(false),
}).refine(
  (value) => value.campaignIds.length > 0 || value.inboundQueueIds.length > 0 || value.backOffice,
  { message: "At least one shift area is required" },
);

type SetPayload = z.infer<typeof setPayloadSchema>;

function unique(values: string[]): string[] {
  return Array.from(new Set(values));
}

export function filterAllowedShiftLoginScope(
  payload: SetPayload,
  allowedCampaignIds: Set<string>,
  allowedQueueIds: Set<string>,
): SetPayload {
  return {
    name: payload.name.trim(),
    campaignIds: unique(payload.campaignIds).filter((id) => allowedCampaignIds.has(id)),
    inboundQueueIds: unique(payload.inboundQueueIds).filter((id) => allowedQueueIds.has(id)),
    backOffice: payload.backOffice,
  };
}

export async function sanitizeAgentShiftScope(
  userId: string,
  role: string | null | undefined,
  payload: SetPayload,
): Promise<SetPayload> {
  const [assignedCampaigns, campaignRows, workspaceRows, allowedQueues, backOfficePermission]: any[] = await Promise.all([
    db.execute(sql`
      SELECT campaign_id
      FROM campaign_agents
      WHERE user_id = ${userId}
    `),
    db.execute(sql`
      SELECT id, status, country_codes, start_date, end_date
      FROM campaigns
    `),
    db.execute(sql`
      SELECT country_code
      FROM agent_workspace_access
      WHERE user_id = ${userId}
    `),
    db.execute(sql`
      SELECT qm.queue_id
      FROM queue_members qm
      INNER JOIN inbound_queues q ON q.id = qm.queue_id
      WHERE qm.user_id = ${userId}
        AND qm.is_active = true
        AND q.is_active = true
    `),
    db.execute(sql`
      SELECT EXISTS (
        SELECT 1
        FROM users u
        INNER JOIN role_module_permissions permission ON permission.role_id = u.role_id
        WHERE u.id = ${userId}
          AND permission.module_key = 'back_office_agenda'
          AND permission.access = 'visible'
      ) AS allowed
    `),
  ]);
  let allowedCampaignIds = new Set<string>(
    (assignedCampaigns.rows || []).map((row: any) => String(row.campaign_id)),
  );
  const hasExplicitAssignments = allowedCampaignIds.size > 0;
  const workspaceCountryCodes = (workspaceRows.rows || []).map((row: any) => String(row.country_code));
  const now = new Date();
  allowedCampaignIds = new Set(
    (campaignRows.rows || [])
      .filter((row: any) => !hasExplicitAssignments || allowedCampaignIds.has(String(row.id)))
      .filter((row: any) => !["paused", "draft", "completed", "cancelled"].includes(String(row.status)))
      .filter((row: any) => !row.start_date || new Date(row.start_date) <= now)
      .filter((row: any) => !row.end_date || new Date(row.end_date) >= now)
      .filter((row: any) => canAgentReadCampaignByWorkspaceCountry({
        role,
        workspaceCountryCodes,
        campaignCountryCodes: Array.isArray(row.country_codes) ? row.country_codes.map(String) : [],
      }))
      .map((row: any) => String(row.id)),
  );

  const allowedQueueIds = new Set<string>(
    (allowedQueues.rows || []).map((row: any) => String(row.queue_id)),
  );

  return filterAllowedShiftLoginScope(
    {
      ...payload,
      backOffice: payload.backOffice && !!backOfficePermission.rows?.[0]?.allowed,
    },
    allowedCampaignIds,
    allowedQueueIds,
  );
}

function serialize(row: any) {
  return {
    id: String(row.id),
    name: String(row.name),
    campaignIds: Array.isArray(row.campaign_ids) ? row.campaign_ids.map(String) : [],
    inboundQueueIds: Array.isArray(row.inbound_queue_ids) ? row.inbound_queue_ids.map(String) : [],
    backOffice: !!row.back_office,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function registerAgentShiftLoginSetRoutes(
  app: Express,
  requireAuth: RequestHandler,
): void {
  app.get("/api/agent/shift-login-sets", requireAuth, async (req: Request, res: Response) => {
    try {
      const userId = req.session.user!.id;
      const result: any = await db.execute(sql`
        SELECT id, name, campaign_ids, inbound_queue_ids, back_office, created_at, updated_at
        FROM agent_shift_login_sets
        WHERE user_id = ${userId}
        ORDER BY updated_at DESC, created_at DESC
      `);
      const sanitized = await Promise.all((result.rows || []).map(async (row: any) => {
        const scope = await sanitizeAgentShiftScope(userId, req.session.user!.role, {
          name: String(row.name),
          campaignIds: Array.isArray(row.campaign_ids) ? row.campaign_ids.map(String) : [],
          inboundQueueIds: Array.isArray(row.inbound_queue_ids) ? row.inbound_queue_ids.map(String) : [],
          backOffice: !!row.back_office,
        });
        return { ...serialize(row), ...scope };
      }));
      res.json(sanitized);
    } catch (error) {
      console.error("Error fetching shift login sets:", error);
      res.status(500).json({ error: "Failed to fetch shift login sets" });
    }
  });

  app.post("/api/agent/shift-login-sets", requireAuth, async (req: Request, res: Response) => {
    try {
      const parsed = setPayloadSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.issues[0]?.message || "Invalid shift login set" });
      }
      const userId = req.session.user!.id;
      const payload = await sanitizeAgentShiftScope(userId, req.session.user!.role, parsed.data);
      if (payload.campaignIds.length === 0 && payload.inboundQueueIds.length === 0 && !payload.backOffice) {
        return res.status(400).json({ error: "The selected shift areas are no longer available" });
      }
      const result: any = await db.execute(sql`
        INSERT INTO agent_shift_login_sets
          (id, user_id, name, campaign_ids, inbound_queue_ids, back_office, created_at, updated_at)
        VALUES (
          gen_random_uuid(), ${userId}, ${payload.name},
          ${payload.campaignIds}::text[], ${payload.inboundQueueIds}::text[],
          ${payload.backOffice}, now(), now()
        )
        RETURNING id, name, campaign_ids, inbound_queue_ids, back_office, created_at, updated_at
      `);
      res.status(201).json(serialize(result.rows[0]));
    } catch (error: any) {
      if (error?.code === "23505") {
        return res.status(409).json({ error: "A shift login set with this name already exists" });
      }
      console.error("Error creating shift login set:", error);
      res.status(500).json({ error: "Failed to create shift login set" });
    }
  });

  app.delete("/api/agent/shift-login-sets/:id", requireAuth, async (req: Request, res: Response) => {
    try {
      const result: any = await db.execute(sql`
        DELETE FROM agent_shift_login_sets
        WHERE id = ${req.params.id}
          AND user_id = ${req.session.user!.id}
        RETURNING id
      `);
      if (!result.rows?.[0]) return res.status(404).json({ error: "Shift login set not found" });
      res.status(204).end();
    } catch (error) {
      console.error("Error deleting shift login set:", error);
      res.status(500).json({ error: "Failed to delete shift login set" });
    }
  });
}