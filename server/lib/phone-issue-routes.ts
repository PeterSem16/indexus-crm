import type { Express, RequestHandler } from "express";
import { pool } from "../db";
import { phoneIssueContext, verifyPhoneIssue, phoneIssueContact } from "./phone-issues";
import { StatusListWorkflowError, executeEvent } from "./status-list-workflow";
import { evaluateOptionSources } from "./status-list-option-source";
import { queueAutomaticSourceEvent } from "./status-list-automatic";
import { userMayAccessTaskCountry } from "./task-contract";

export async function publishPhoneIssueTransition(client: any, contactId: string) {
  for (const event of await evaluateOptionSources(client, contactId)) {
    await executeEvent(client,event);
    await queueAutomaticSourceEvent(client,event);
  }
}

export function registerPhoneIssueRoutes(app: Express, requireAuth: RequestHandler,
  authorize: (req: any, missionId: string, sessionId: string) => Promise<void>) {
  const route = (verify: boolean): RequestHandler => async (req: any, res) => {
    const client = await pool.connect();
    try {
      const body = verify ? req.body || {} : req.query;
      if (typeof body.sessionId !== "string" || typeof body.entityType !== "string" || typeof body.entityId !== "string")
        throw new StatusListWorkflowError("phone_issue_invalid",400);
      await authorize(req,req.params.missionId,body.sessionId);
      const contact = await phoneIssueContact(client,req.params.missionId,body.entityType,body.entityId);
      const country=contact.entity.country_code || contact.entity.country;
      if(!country || !userMayAccessTaskCountry(req.session.user.role,req.session.user.assignedCountries,country))
        throw new StatusListWorkflowError("phone_issue_invalid",403);
      if (verify) {
        await client.query("BEGIN");
        await verifyPhoneIssue(client,req.params.missionId,body.entityType,body.entityId,req.session.user.id,body);
        const contact = await phoneIssueContact(client,req.params.missionId,body.entityType,body.entityId);
        await publishPhoneIssueTransition(client,contact.id);
        await client.query("COMMIT");
      }
      res.json(await phoneIssueContext(client,req.params.missionId,body.entityType,body.entityId,req.session.user.id));
    } catch (error: any) {
      if (verify) await client.query("ROLLBACK");
      res.status(error instanceof StatusListWorkflowError ? error.status : 500)
        .json({code:error instanceof StatusListWorkflowError ? error.code : "phone_issue_invalid"});
    } finally { client.release(); }
  };
  app.get("/api/campaigns/:missionId/phone-issues/context",requireAuth,route(false));
  app.post("/api/campaigns/:missionId/phone-issues/verify",requireAuth,route(true));
}
