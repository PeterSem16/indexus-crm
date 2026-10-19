import { randomUUID } from "node:crypto";
import type { Express, Request, RequestHandler } from "express";
import { pool } from "../db";
import { StatusListWorkflowError } from "./status-list-workflow";
import { emptyStatusListOrganization, statusListOrganizationEditSchema, statusListOrganizationSchema } from "../../shared/status-list-organization";

export function registerStatusListOrganizationRoutes(app: Express, requireAuth: RequestHandler,
  authorize: (req: Request, manage: boolean) => Promise<unknown>,
  route: (fn: (req: Request, res: any) => Promise<unknown>) => RequestHandler) {
  const path = "/api/campaigns/:campaignId/status-list-workflows/organization";
  app.get(path, requireAuth, route(async (req, res) => {
    await authorize(req, true);
    const row = (await pool.query("SELECT COALESCE(NULLIF(settings,''),'{}')::jsonb->'statusListOrganizer' AS organization FROM campaigns WHERE id=$1", [req.params.campaignId])).rows[0];
    res.json(statusListOrganizationSchema.parse(row.organization ?? emptyStatusListOrganization));
  }));
  app.patch(path, requireAuth, route(async (req, res) => {
    await authorize(req, true);
    const edit = statusListOrganizationEditSchema.parse(req.body);
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const row = (await client.query("SELECT COALESCE(NULLIF(settings,''),'{}')::jsonb->'statusListOrganizer' AS organization FROM campaigns WHERE id=$1 FOR UPDATE", [req.params.campaignId])).rows[0];
      const organization = statusListOrganizationSchema.parse(row.organization ?? emptyStatusListOrganization);
      if (edit.operation === "create" || edit.operation === "rename") {
        if (organization.categories.some(category => category.name.toLowerCase() === edit.name.toLowerCase() && (edit.operation !== "rename" || category.id !== edit.id)))
          throw new StatusListWorkflowError("category_name_exists", 409);
        if (edit.operation === "create") {
          if (organization.categories.length >= 50) throw new StatusListWorkflowError("category_limit", 400);
          organization.categories.push({ id: randomUUID(), name: edit.name });
        } else {
          const category = organization.categories.find(category => category.id === edit.id);
          if (!category) throw new StatusListWorkflowError("category_not_found", 404);
          category.name = edit.name;
        }
      } else if (edit.operation === "remove") {
        if (!organization.categories.some(category => category.id === edit.id)) throw new StatusListWorkflowError("category_not_found", 404);
        organization.categories = organization.categories.filter(category => category.id !== edit.id);
        organization.assignments = Object.fromEntries(Object.entries(organization.assignments).filter(([, category]) => category !== edit.id));
      } else {
        if (edit.categoryId && !organization.categories.some(category => category.id === edit.categoryId)) throw new StatusListWorkflowError("category_not_found", 404);
        const target = edit.kind === "item"
          ? await client.query("SELECT id FROM campaign_status_list_items WHERE id=$1 AND campaign_id=$2", [edit.id, req.params.campaignId])
          : await client.query("SELECT q.id FROM campaign_status_list_questions q JOIN campaign_status_list_items i ON i.id=q.item_id WHERE q.id=$1 AND i.campaign_id=$2", [edit.id, req.params.campaignId]);
        if (!target.rowCount) throw new StatusListWorkflowError("item_not_found", 404);
        if (edit.categoryId) organization.assignments[edit.id] = edit.categoryId;
        else delete organization.assignments[edit.id];
      }
      await client.query(`UPDATE campaigns SET settings=jsonb_set(COALESCE(NULLIF(settings,''),'{}')::jsonb,'{statusListOrganizer}',$2::jsonb,true)::text WHERE id=$1`, [req.params.campaignId, JSON.stringify(organization)]);
      await client.query("COMMIT");
      res.json(organization);
    } catch (error) { await client.query("ROLLBACK"); throw error; }
    finally { client.release(); }
  }));
}
