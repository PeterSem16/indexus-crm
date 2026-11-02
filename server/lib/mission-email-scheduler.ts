import type { Pool, PoolClient } from "pg";
import { pool } from "../db";
import { access } from "./mission-funnel-routes";
import { readMissionReport, type MissionPerformanceRow } from "./mission-report-sources";
import { missionEmailScheduleSchema, missionEmailPeriod, nextMissionEmailRun, MISSION_EMAIL_REPORT, type MissionEmailScheduleInput } from "../../shared/mission-email-schedule";
import { renderMissionEmail } from "./mission-email-content";
import { storage } from "../storage";
import { getValidAccessToken } from "./ms365";
import { decryptTokenSafe, encryptTokenWithMarker } from "./token-crypto";
import { buildMissionEmailExcel, type MissionEmailAttachment } from "./mission-email-excel";

export function fullMissionAccess(user: Awaited<ReturnType<typeof access>>) {
  return Boolean(user?.canRead && (user.admin || user.country_codes?.length &&
    user.country_codes.every((country: string) => user.countries.includes(country))));
}
export async function missionRecipient(userId: string, missionId: string, database: Pick<Pool, "query" | "connect"> = pool) {
  if (!fullMissionAccess(await access(userId, missionId, database))) return null;
  const { rows } = await database.query(`SELECT id,email FROM users WHERE id=$1 AND is_active AND NULLIF(BTRIM(email),'') IS NOT NULL`, [userId]);
  return rows[0] ?? null;
}
export function parseStoredMissionSchedule(row: any): MissionEmailScheduleInput {
  const options = row.delivery_options;
  return missionEmailScheduleSchema.parse({
    recipientUserIds: row.recipient_user_ids, sendTime: row.send_time, enabled: row.enabled,
    frequency: options?.frequency, weekday: options?.weekday, monthDay: options?.monthDay,
    country: options?.country, locale: options?.locale, includeExcel: options?.includeExcel,
  });
}
export async function withMissionScheduleLock<T>(id: string, fn: (client: PoolClient) => Promise<T>, database = pool): Promise<T | null> {
  const client = await database.connect();
  let locked = false, destroy = false;
  try {
    locked = Boolean((await client.query("SELECT pg_try_advisory_lock(hashtext($1),64535) AS locked", [id])).rows[0]?.locked);
    return locked ? await fn(client) : null;
  } finally {
    if (locked) try { await client.query("SELECT pg_advisory_unlock(hashtext($1),64535)", [id]); } catch { destroy = true; }
    client.release(destroy);
  }
}
export async function buildMissionEmail(userId: string, missionId: string, options: MissionEmailScheduleInput, now = new Date()) {
  if (!fullMissionAccess(await access(userId, missionId, pool))) throw new Error("Mission report not authorized");
  const period = missionEmailPeriod(options.frequency, now);
  const report = await readMissionReport("funnel", userId, missionId);
  const activity = await readMissionReport<MissionPerformanceRow[]>("performance", userId, missionId, {
    from: period.start.toISOString(), to: new Date(period.end.getTime() - 1).toISOString(),
  });
  return { ...renderMissionEmail(report, activity, options, now),
    attachments: options.includeExcel ? [buildMissionEmailExcel(report, activity, options, now)] : [] };
}
export async function missionSystemSender(country: string) {
  const [settings, connection] = await Promise.all([
    storage.getCountrySystemSettingsByCountry(country), storage.getSystemMs365Connection(country),
  ]);
  const email = settings?.systemEmailAddress?.trim() || null;
  return { country, email, connected: Boolean(email && connection?.isConnected && connection.accessToken &&
    connection.email?.trim().toLowerCase() === email.toLowerCase()) };
}
/** One direct Graph send, never provider retries or a fallback through a personal mailbox. */
export async function sendMissionEmail(country: string, to: string, subject: string, html: string, attachments: MissionEmailAttachment[] = []) {
  const settings = await storage.getCountrySystemSettingsByCountry(country);
  const sender = settings?.systemEmailAddress?.trim();
  const connection = await storage.getSystemMs365Connection(country);
  if (!sender || !connection?.isConnected || !connection.accessToken ||
    connection.email?.trim().toLowerCase() !== sender.toLowerCase()) throw new Error("System mailbox unavailable");
  const tokens = await getValidAccessToken(decryptTokenSafe(connection.accessToken), connection.tokenExpiresAt,
    connection.refreshToken ? decryptTokenSafe(connection.refreshToken) : null, { quiet: true });
  if (!tokens?.accessToken) throw new Error("System mailbox unavailable");
  if (tokens.refreshed) {
    const saved = await storage.updateSystemMs365Connection(country, {
      accessToken: encryptTokenWithMarker(tokens.accessToken),
      ...(tokens.refreshToken ? { refreshToken: encryptTokenWithMarker(tokens.refreshToken) } : {}),
      ...(tokens.expiresOn ? { tokenExpiresAt: tokens.expiresOn } : {}),
    }, connection.accessToken);
    if (!saved) throw new Error("System mailbox changed");
  }
  const response = await fetch(`https://graph.microsoft.com/v1.0/users/${encodeURIComponent(sender)}/sendMail`, {
    method: "POST", signal: AbortSignal.timeout(30_000),
    headers: { Authorization: `Bearer ${tokens.accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({ message: { subject, from: { emailAddress: { address: sender } },
      body: { contentType: "HTML", content: html },
      attachments: attachments.map(file => ({ "@odata.type": "#microsoft.graph.fileAttachment", ...file })),
      toRecipients: [{ emailAddress: { address: to } }] }, saveToSentItems: true }),
  });
  if (response.status !== 202) throw new Error("System mailbox send not confirmed");
}

export interface MissionDeliveryDependencies {
  build: typeof buildMissionEmail;
  send: typeof sendMissionEmail;
  now: () => Date;
}
const defaults: MissionDeliveryDependencies = { build: buildMissionEmail, send: sendMissionEmail, now: () => new Date() };
export async function processMissionEmailSchedule(id: string, dependencies = defaults, database = pool) {
  return withMissionScheduleLock(id, async client => {
    const now = dependencies.now();
    const row = (await client.query("SELECT * FROM scheduled_reports WHERE id=$1", [id])).rows[0];
    if (!row?.enabled || !row.report_types?.includes(MISSION_EMAIL_REPORT) || !row.next_run_at || new Date(row.next_run_at) > now) return false;
    let options: MissionEmailScheduleInput;
    try { options = parseStoredMissionSchedule(row); }
    catch {
      await client.query(`UPDATE scheduled_reports SET enabled=false,delivery_options=COALESCE(delivery_options,'{}'::jsonb)||'{"lastStatus":"blocked"}'::jsonb WHERE id=$1`, [id]);
      return false;
    }
    let state = "blocked";
    try {
      const creator = row.created_by && await access(row.created_by, row.campaign_id, database);
      if (!creator?.canConfigure || !creator.country_codes?.includes(options.country)) return false;
      const content = await dependencies.build(row.created_by, row.campaign_id, options, now);
      const key = `${content.period.from}:${content.period.to}`;
      state = "sent";
      const addressed = new Set<string>();
      for (const userId of options.recipientUserIds) {
        const owner = await access(row.created_by, row.campaign_id, database);
        const recipient = await missionRecipient(userId, row.campaign_id, database);
        if (!owner?.canConfigure || !owner.country_codes?.includes(options.country) || !recipient) {
          if (state !== "unknown") state = "blocked";
          continue;
        }
        const address = recipient.email.trim().toLowerCase();
        if (addressed.has(address)) continue;
        addressed.add(address);
        const claimed = await client.query(`INSERT INTO mission_report_deliveries(schedule_id,period_key,recipient_id,status)
          VALUES($1,$2,$3,'sending') ON CONFLICT DO NOTHING RETURNING recipient_id`, [id, key, userId]);
        if (!claimed.rowCount) {
          const previous = (await client.query(`SELECT status FROM mission_report_deliveries WHERE schedule_id=$1 AND period_key=$2 AND recipient_id=$3`, [id, key, userId])).rows[0];
          if (previous?.status !== "sent") state = "unknown";
          continue;
        }
        try {
          await dependencies.send(options.country, recipient.email, content.subject, content.html, content.attachments);
          await client.query(`UPDATE mission_report_deliveries SET status='sent',updated_at=now() WHERE schedule_id=$1 AND period_key=$2 AND recipient_id=$3`, [id, key, userId]);
        } catch {
          state = "unknown";
          await client.query(`UPDATE mission_report_deliveries SET status='unknown',updated_at=now() WHERE schedule_id=$1 AND period_key=$2 AND recipient_id=$3`, [id, key, userId]);
        }
      }
      return true;
    } catch {
      if (state !== "unknown") state = "blocked";
      return false;
    } finally {
      await client.query(`UPDATE scheduled_reports SET last_run_at=$2,next_run_at=$3,
        delivery_options=delivery_options||jsonb_build_object('lastStatus',$4::text) WHERE id=$1`, [
        id, now, nextMissionEmailRun(options, now), state,
      ]);
    }
  }, database);
}
