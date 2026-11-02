import type { Express, RequestHandler } from "express";
import type { Pool, PoolClient } from "pg";
import { pool } from "../db";
import { z } from "zod";
import { access, authenticatedUserId } from "./mission-funnel-routes";
import { missionEmailScheduleSchema, MISSION_EMAIL_REPORT, nextMissionEmailRun } from "../../shared/mission-email-schedule";
import { buildMissionEmail, missionRecipient, missionSystemSender, parseStoredMissionSchedule, sendMissionEmail, withMissionScheduleLock } from "./mission-email-scheduler";

class ScheduleError extends Error {
  constructor(public status: number, public code: string) { super(code); }
}
const runtime = {
  build: buildMissionEmail,
  send: sendMissionEmail,
  sender: missionSystemSender,
  mailboxReady: async (country: string) => (await missionSystemSender(country)).connected,
};
export function registerMissionEmailScheduleRoutes(app: Express, auth: RequestHandler, database: Pick<Pool, "query" | "connect"> = pool, overrides: Partial<typeof runtime> = {}) {
  const dependencies = { ...runtime, ...overrides };
  const manager = async (userId: string, missionId: string) => {
    const user = await access(userId, missionId, database);
    if (!user?.canConfigure) throw new ScheduleError(403, "not_authorized");
    return user;
  };
  const error = (res: any, value: unknown) => {
    res.status(value instanceof ScheduleError ? value.status : 500).json({
      error: value instanceof ScheduleError ? value.code : "schedule_unavailable",
    });
  };
  const getRow = async (missionId: string, id: string, db: Pick<PoolClient, "query"> = database) => {
    const row = (await db.query(`SELECT * FROM scheduled_reports WHERE id=$1 AND campaign_id=$2
      AND report_types @> ARRAY[$3]::text[]`, [id, missionId, MISSION_EMAIL_REPORT])).rows[0];
    if (!row) throw new ScheduleError(404, "schedule_not_found");
    return row;
  };
  app.get("/api/campaigns/:id/mission-report-schedules", auth, async (req, res) => {
    try {
      const userId = authenticatedUserId(req), user = await access(userId, req.params.id, database);
      if (!user?.canRead) throw new ScheduleError(403, "not_authorized");
      if (!user.canConfigure) return res.json({ canManage: false, users: [], countries: [], schedules: [] });
      const recipients = await database.query(`SELECT u.id,COALESCE(NULLIF(BTRIM(u.full_name),''),u.username) AS name,u.email
        FROM users u WHERE u.is_active AND NULLIF(BTRIM(u.email),'') IS NOT NULL AND (
          u.role='admin' OR (cardinality($2::text[])>0 AND u.assigned_countries @> $2::text[] AND (
            (u.role='manager' AND u.role_id IS NULL) OR
            EXISTS(SELECT 1 FROM role_module_permissions p WHERE p.role_id=u.role_id AND p.module_key='campaigns' AND p.access='visible') OR
            EXISTS(SELECT 1 FROM campaign_agents a WHERE a.user_id=u.id AND a.campaign_id=$1))))
        ORDER BY name,u.id`, [req.params.id, user.country_codes ?? []]);
      const { rows } = await database.query(`SELECT id,enabled,recipient_user_ids AS "recipientUserIds",external_emails AS "externalEmails",send_time AS "sendTime",
        delivery_options AS "deliveryOptions",next_run_at AS "nextRunAt",last_run_at AS "lastRunAt",
        delivery_options->>'lastStatus' AS "lastStatus"
        FROM scheduled_reports WHERE campaign_id=$1 AND report_types @> ARRAY[$2]::text[] ORDER BY created_at,id`,
      [req.params.id, MISSION_EMAIL_REPORT]);
      const senders = await Promise.all((user.country_codes ?? []).map((country: string) => dependencies.sender(country)));
      const self = await missionRecipient(userId, req.params.id, database);
      res.json({ canManage: true, users: recipients.rows, countries: user.country_codes ?? [], schedules: rows,
        senders, testRecipientEmail: self?.email ?? null });
    } catch (value) { error(res, value); }
  });
  const save: RequestHandler = async (req, res) => {
    try {
      const userId = authenticatedUserId(req), user = await manager(userId, req.params.id);
      const parsed = missionEmailScheduleSchema.safeParse(req.body);
      if (!parsed.success) throw new ScheduleError(400, "invalid_schedule");
      const data = parsed.data;
      if (!user.country_codes?.includes(data.country)) throw new ScheduleError(400, "invalid_sender_country");
      for (const recipient of data.recipientUserIds)
        if (!await missionRecipient(recipient, req.params.id, database)) throw new ScheduleError(400, "recipient_not_authorized");
      if (data.enabled) {
        if (!await dependencies.mailboxReady(data.country)) throw new ScheduleError(409, "system_mailbox_unavailable");
      }
      const delivery = { frequency: data.frequency, weekday: data.weekday, monthDay: data.monthDay, country: data.country, locale: data.locale, includeExcel: data.includeExcel };
      const nextRun = data.enabled ? nextMissionEmailRun(data) : null;
      let row;
      if (req.params.scheduleId) {
        row = await withMissionScheduleLock(req.params.scheduleId, async client => {
          await getRow(req.params.id, req.params.scheduleId, client);
          return (await client.query(`UPDATE scheduled_reports SET recipient_user_ids=$3,send_time=$4,enabled=$5,
            delivery_options=$6::jsonb,next_run_at=$7,created_by=$8,external_emails=$9,updated_at=now()
            WHERE id=$1 AND campaign_id=$2 RETURNING id`, [
            req.params.scheduleId, req.params.id, data.recipientUserIds, data.sendTime, data.enabled, JSON.stringify(delivery), nextRun, userId, data.externalEmails,
          ])).rows[0];
        }, database as Pool);
        if (!row) throw new ScheduleError(409, "schedule_busy");
      } else {
        row = (await database.query(`INSERT INTO scheduled_reports(campaign_id,report_types,recipient_user_ids,
          send_time,enabled,delivery_options,next_run_at,created_by,date_range_type,external_emails)
          VALUES($1,ARRAY[$2],$3,$4,$5,$6::jsonb,$7,$8,'mission_period',$9) RETURNING id`,
        [req.params.id, MISSION_EMAIL_REPORT, data.recipientUserIds, data.sendTime, data.enabled, JSON.stringify(delivery), nextRun, userId, data.externalEmails])).rows[0];
      }
      res.status(req.params.scheduleId ? 200 : 201).json(row);
    } catch (value) { error(res, value); }
  };
  app.post("/api/campaigns/:id/mission-report-schedules", auth, save);
  app.patch("/api/campaigns/:id/mission-report-schedules/:scheduleId", auth, save);
  app.delete("/api/campaigns/:id/mission-report-schedules/:scheduleId", auth, async (req, res) => {
    try {
      await manager(authenticatedUserId(req), req.params.id);
      const removed = await withMissionScheduleLock(req.params.scheduleId, async client => {
        await getRow(req.params.id, req.params.scheduleId, client);
        await client.query("DELETE FROM scheduled_reports WHERE id=$1 AND campaign_id=$2", [req.params.scheduleId, req.params.id]);
        return true;
      }, database as Pool);
      if (!removed) throw new ScheduleError(409, "schedule_busy");
      res.json({ deleted: true });
    } catch (value) { error(res, value); }
  });
  app.post("/api/campaigns/:id/mission-report-schedules/:scheduleId/preview", auth, async (req, res) => {
    try {
      const userId = authenticatedUserId(req);
      await manager(userId, req.params.id);
      const row = await getRow(req.params.id, req.params.scheduleId);
      const content = await dependencies.build(userId, req.params.id, parseStoredMissionSchedule(row));
      res.json({ subject: content.subject, html: content.html, from: content.from, to: content.to });
    } catch (value) { error(res, value); }
  });
  app.post("/api/campaigns/:id/mission-report-schedules/:scheduleId/test-email", auth, async (req, res) => {
    try {
      const userId = authenticatedUserId(req);
      await manager(userId, req.params.id);
      const input = z.object({ requestId: z.string().uuid() }).strict().safeParse(req.body);
      if (!input.success) throw new ScheduleError(400, "invalid_test_request");
      const result = await withMissionScheduleLock(`mission-email-test:${userId}`, async () =>
        withMissionScheduleLock(req.params.scheduleId, async client => {
          const row = await getRow(req.params.id, req.params.scheduleId, client);
          const options = parseStoredMissionSchedule(row), user = await manager(userId, req.params.id);
          if (!user.country_codes?.includes(options.country)) throw new ScheduleError(403, "not_authorized");
          const recipient = await missionRecipient(userId, req.params.id, database);
          if (!recipient) throw new ScheduleError(409, "test_recipient_unavailable");
          const sender = await dependencies.sender(options.country);
          if (!sender.connected || !sender.email) throw new ScheduleError(409, "system_mailbox_unavailable");
          const key = `test:${userId}:${input.data.requestId}`;
          const previous = (await client.query(`SELECT status FROM mission_report_deliveries
            WHERE schedule_id=$1 AND period_key=$2 AND recipient_id=$3`, [row.id, key, userId])).rows[0];
          const response = { status: "sent", to: recipient.email, from: sender.email, attachmentIncluded: options.includeExcel };
          if (previous?.status === "sent") return response;
          if (previous) throw new ScheduleError(409, "test_delivery_unconfirmed");
          const count = (await client.query(`SELECT count(*)::int AS count FROM mission_report_deliveries
            WHERE recipient_id=$1 AND period_key LIKE 'test:%' AND created_at > now()-interval '1 minute'`, [userId])).rows[0]?.count ?? 0;
          if (count >= 3) throw new ScheduleError(429, "test_rate_limited");
          const content = await dependencies.build(userId, req.params.id, options);
          // Reserve once before Graph: a timeout is uncertain, never safe to resend.
          const claimed = await client.query(`INSERT INTO mission_report_deliveries(schedule_id,period_key,recipient_id,status)
            VALUES($1,$2,$3,'sending') ON CONFLICT DO NOTHING RETURNING recipient_id`, [row.id, key, userId]);
          if (!claimed.rowCount) throw new ScheduleError(409, "test_delivery_unconfirmed");
          try {
            const label = options.locale === "hu" ? "TESZT" : "TEST";
            await dependencies.send(options.country, recipient.email, `[${label}] ${content.subject}`,
              content.html.replace(/(<body[^>]*>)/i, `$1<p style="padding:12px;font-weight:bold">${label} · INDEXUS</p>`),
              content.attachments);
            await client.query(`UPDATE mission_report_deliveries SET status='sent',updated_at=now()
              WHERE schedule_id=$1 AND period_key=$2 AND recipient_id=$3`, [row.id, key, userId]);
          } catch {
            await client.query(`UPDATE mission_report_deliveries SET status='unknown',updated_at=now()
              WHERE schedule_id=$1 AND period_key=$2 AND recipient_id=$3`, [row.id, key, userId]);
            throw new ScheduleError(409, "test_delivery_unconfirmed");
          }
          return response;
        }, database as Pool), database as Pool);
      if (!result) throw new ScheduleError(409, "schedule_busy");
      res.json(result);
    } catch (value) { error(res, value); }
  });
  // Legacy report APIs must not bypass the new schedule ownership/country checks.
  app.use("/api/scheduled-reports/:scheduleId", auth, async (req, res, next) => {
    try {
      const row = (await database.query("SELECT report_types FROM scheduled_reports WHERE id=$1", [req.params.scheduleId])).rows[0];
      if (row?.report_types?.includes(MISSION_EMAIL_REPORT) || req.body?.reportTypes?.includes?.(MISSION_EMAIL_REPORT) || req.body?.deliveryOptions)
        throw new ScheduleError(403, "use_mission_report_controls");
      next();
    } catch (value) { error(res, value); }
  });
  app.post("/api/campaigns/:id/scheduled-reports", auth, (req, res, next) => {
    if (req.body?.reportTypes?.includes?.(MISSION_EMAIL_REPORT) || req.body?.deliveryOptions)
      return res.status(403).json({ error: "use_mission_report_controls" });
    next();
  });
}
