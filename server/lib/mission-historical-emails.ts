import { createHash, createHmac, randomBytes, randomUUID, timingSafeEqual } from "node:crypto";
import type { Express, RequestHandler } from "express";
import type { Pool, PoolClient } from "pg";
import { z } from "zod";

// Process-local signing key intentionally invalidates open previews after restart.
const signingKey = randomBytes(32);
const source = "explicit_admin_email_review_v1";
const purpose = z.enum(["contract_proposal", "informational"]);
const selection = z.object({
  messageIds: z.array(z.string().min(1).max(100)).min(1).max(50)
    .refine(ids => new Set(ids).size === ids.length),
  purpose, reason: z.string().trim().min(10).max(1000),
}).strict();
const ticketSchema = selection.extend({
  actorId: z.string(), missionId: z.string(), reviewId: z.string().uuid(),
  fingerprint: z.string().regex(/^[a-f0-9]{64}$/), expiresAt: z.number(),
});
type Ticket = z.infer<typeof ticketSchema>;
type Database = Pick<Pool, "query" | "connect">;
class ReviewError extends Error {
  constructor(public status: number, message: string) { super(message); }
}
const stop = () => { throw new ReviewError(409, "Historical email preview changed or conflicts"); };
function sign(payload: string) { return createHmac("sha256", signingKey).update(payload).digest("hex"); }
function encode(ticket: Ticket) {
  const payload = Buffer.from(JSON.stringify(ticket)).toString("base64url");
  return `${payload}.${sign(payload)}`;
}
function decode(token: string): Ticket {
  const [payload, signature, extra] = token.split(".");
  const expected = sign(payload || "");
  if (extra || !/^[a-f0-9]{64}$/.test(signature || "") ||
    !timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) {
    throw new ReviewError(409, "Review preview is invalid; create a new preview");
  }
  let ticket: Ticket;
  try { ticket = ticketSchema.parse(JSON.parse(Buffer.from(payload, "base64url").toString())); }
  catch { throw new ReviewError(409, "Invalid review preview"); }
  if (ticket.expiresAt <= Date.now()) throw new ReviewError(410, "Review preview expired");
  return ticket;
}
function timestampUtc(value: string | null) {
  return value == null ? null : /(?:Z|[+-]\d\d:\d\d)$/.test(value) ? value : `${value}Z`;
}
function messageMetadata(raw: unknown): Record<string, unknown> | null {
  try {
    const value = typeof raw === "string" ? JSON.parse(raw) : raw;
    return value && typeof value === "object" && !Array.isArray(value) ? value : null;
  } catch { return null; }
}
const emailAddress = z.string().trim().max(320).email();
/** The legacy MS365 writer persisted To in metadata.recipientEmails, not in
 * recipient_email. Use that exact verified format, never infer recipients from
 * the clinic card, message body, subject, CC or activity proximity. */
function recipientAddresses(message: { recipient_email?: string | null; metadata?: unknown }): string[] {
  const metadata = messageMetadata(message.metadata);
  const direct = message.recipient_email ? emailAddress.safeParse(message.recipient_email) : null;
  if (direct && !direct.success) return [];
  if (metadata?.sentVia === "ms365" && metadata.recipientEmails !== undefined) {
    const parsed = z.array(emailAddress).min(1).max(500).safeParse(metadata.recipientEmails);
    if (!parsed.success) return [];
    if (direct?.success && !parsed.data.some(address => address.toLowerCase() === direct.data.toLowerCase())) return [];
    return [...new Map(parsed.data.map(address => [address.toLowerCase(), address])).values()];
  }
  return direct?.success ? [direct.data] : [];
}

/** Evaluated inside the same transaction as source review, never from session roles.
 * Built-in admins retain their existing global authority; delegated admins need
 * explicit campaigns edit permission AND every Mission country. */
async function authorize(client: PoolClient, actorId: string, missionId: string) {
  const { rows } = await client.query(`
    SELECT u.role,u.assigned_countries,m.country_codes,
      EXISTS(SELECT 1 FROM role_module_permissions p WHERE p.role_id=u.role_id
        AND p.module_key='campaigns' AND p.access='visible' AND p.can_edit) AS module_edit
    FROM users u CROSS JOIN campaigns m
    WHERE u.id=$1 AND u.is_active AND m.id=$2`, [actorId, missionId]);
  const user = rows[0];
  if (!user || !(user.role === "admin" ||
    user.module_edit && user.country_codes?.length &&
    user.country_codes.every((c: string) => user.assigned_countries?.includes(c)))) {
    throw new ReviewError(403, "Historical email review not authorized");
  }
}

const sourceSql = `
  SELECT to_jsonb(m) AS message,c.name AS clinic_name,c.country_code,
    mission.country_codes,
    COALESCE(NULLIF(BTRIM(u.full_name),''),u.username,m.user_id) AS sender_name,
    ARRAY(SELECT cc.id FROM campaign_contacts cc WHERE cc.campaign_id=$1
      AND cc.contact_type='clinic' AND cc.clinic_id=c.id ORDER BY cc.id) AS contact_ids,
    COALESCE((SELECT jsonb_agg(jsonb_build_object('id',h.id,'contactId',h.campaign_contact_id,
      'actorId',h.user_id,'metadata',h.metadata) ORDER BY h.id)
      FROM campaign_contact_history h WHERE h.action='mission_email_attribution'
      AND h.metadata->>'messageId'=m.id),'[]'::jsonb) AS reviews
  FROM communication_messages m JOIN clinics c ON c.id=m.customer_id
  JOIN campaigns mission ON mission.id=$1 LEFT JOIN users u ON u.id=m.user_id
  WHERE m.id=ANY($2::text[]) ORDER BY m.id`;

function reviewRows(rows: any[], ids: string[], missionId: string, selectedPurpose: string, ticket?: Ticket) {
  if (rows.length !== ids.length) stop();
  let applied = 0;
  const snapshots = rows.map(row => {
    const m = row.message;
    const metadata = messageMetadata(m.metadata);
    // A customer id alone is not evidence that the customer is a clinic.
    if (m.type !== "email" || m.direction !== "outbound" ||
      !["sent", "delivered", "read"].includes(m.status) ||
      metadata?.simulated || metadata?.simulation || metadata?.dryRun ||
      !(metadata?.sentVia === "ms365" || m.external_id && ["ms365", "sendgrid"].includes(m.provider)) ||
      metadata?.campaignId && metadata.campaignId !== missionId ||
      metadata?.campaignContactId && metadata.campaignContactId !== row.contact_ids[0] ||
      metadata?.purpose && metadata.purpose !== selectedPurpose ||
      !(metadata?.contactType === "clinic" || m.entity_type === "clinic" && m.entity_id === m.customer_id) ||
      m.entity_type && m.entity_type !== "clinic" ||
      m.entity_id && m.entity_id !== m.customer_id ||
      !metadata || !m.created_at || recipientAddresses(m).length === 0 || row.contact_ids.length !== 1 ||
      !row.country_codes?.includes(row.country_code) ||
      m.country_code && m.country_code !== row.country_code) stop();
    if (row.reviews.length) {
      const audit = row.reviews[0];
      const a = audit.metadata;
      if (!ticket || row.reviews.length !== 1 || a.reviewSource !== source ||
        a.reviewId !== ticket.reviewId || a.batchFingerprint !== ticket.fingerprint ||
        a.campaignId !== ticket.missionId || a.purpose !== ticket.purpose ||
        audit.actorId !== ticket.actorId || audit.contactId !== row.contact_ids[0] ||
        a.reason !== ticket.reason || a.originalSentAt !== timestampUtc(m.sent_at) ||
        a.originalRecordedAt !== timestampUtc(m.created_at) ||
        a.previousCampaignId !== null || m.campaign_id !== ticket.missionId) stop();
      applied++;
    } else if (m.campaign_id !== null) stop();
    return { ...row, reviews: [], message: { ...m, campaign_id: null } };
  });
  if (applied && applied !== rows.length) stop();
  const fingerprint = createHash("sha256").update(JSON.stringify(snapshots)).digest("hex");
  if (ticket && fingerprint !== ticket.fingerprint) stop();
  return { fingerprint, applied };
}
function publicRow(row: any, includeBody = false) {
  const m = row.message;
  const recipients = recipientAddresses(m);
  // PostgreSQL timestamp-without-time-zone stores UTC here. JSONB preserves
  // microseconds but omits the zone; don't let browsers interpret it as local.
  return { id: m.id, clinicName: row.clinic_name, subject: m.subject,
    recipientEmail: recipients.join(", "), recipientEmails: recipients, senderName: row.sender_name,
    sentAt: timestampUtc(m.sent_at), recordedAt: timestampUtc(m.created_at),
    ...(includeBody ? { body: m.content, contactId: row.contact_ids[0] } : {}) };
}

export function registerMissionHistoricalEmailRoutes(
  app: Express, requireAuth: RequestHandler, database: Database,
  identity: (req: unknown) => string,
) {
  const path = "/api/campaigns/:id/mission-funnel/historical-emails";
  const handler = (mode: "list" | "preview" | "apply"): RequestHandler => async (req, res) => {
    let client: PoolClient | undefined;
    try {
      const actorId = identity(req), missionId = req.params.id;
      const input = mode === "preview" ? selection.parse(req.body) : null;
      const apply = mode === "apply" ? z.object({
        reviewToken: z.string().max(20000), approved: z.literal(true),
      }).strict().parse(req.body) : null;
      const ticket = apply ? decode(apply.reviewToken) : undefined;
      if (ticket && (ticket.actorId !== actorId || ticket.missionId !== missionId)) {
        throw new ReviewError(403, "Review belongs to another actor or Mission");
      }
      const query = mode === "list" ? z.object({
        q: z.string().trim().max(200).default(""), before: z.string().max(100).optional(),
      }).strict().parse(req.query) : null;
      client = await database.connect();
      await client.query(ticket ? "BEGIN ISOLATION LEVEL REPEATABLE READ" :
        "BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");
      await client.query("SET LOCAL statement_timeout='15s'");
      await client.query("SET LOCAL lock_timeout='2s'");
      if (ticket) {
        // Bounded, short apply transaction: these locks also exclude phantom
        // membership/audit inserts and permission revocation during approval.
        // No source locks are held while an administrator reads the preview.
        await client.query(`LOCK TABLE users,role_module_permissions,campaigns,clinics,campaign_contacts IN SHARE MODE`);
        await client.query(`LOCK TABLE communication_messages,campaign_contact_history IN SHARE ROW EXCLUSIVE MODE`);
      }
      await authorize(client, actorId, missionId);
      if (query) {
        const { rows } = await client.query(`
          SELECT m.id,c.name AS "clinicName",m.subject,m.recipient_email,m.metadata,
            COALESCE(NULLIF(BTRIM(u.full_name),''),u.username,m.user_id) AS "senderName",
            m.sent_at AS "sentAt",m.created_at AS "recordedAt"
          FROM communication_messages m JOIN clinics c ON c.id=m.customer_id
          JOIN campaigns mission ON mission.id=$1 LEFT JOIN users u ON u.id=m.user_id
          WHERE m.type='email' AND m.direction='outbound' AND m.status IN ('sent','delivered','read')
            AND m.campaign_id IS NULL AND c.country_code=ANY(mission.country_codes)
            AND (SELECT count(*) FROM campaign_contacts cc WHERE cc.campaign_id=$1
              AND cc.contact_type='clinic' AND cc.clinic_id=c.id)=1
            AND NOT EXISTS(SELECT 1 FROM campaign_contact_history h
              WHERE h.action='mission_email_attribution' AND h.metadata->>'messageId'=m.id)
            AND ($3::text IS NULL OR m.id<$3)
            AND ($2='' OR strpos(lower(concat_ws(' ',c.name,m.subject,m.recipient_email,m.metadata,u.full_name,u.username,m.user_id)),lower($2))>0)
          ORDER BY m.id DESC LIMIT 101`, [missionId, query.q, query.before || null]);
        await client.query("ROLLBACK");
        return void res.json({ rows: rows.slice(0, 100).map(({ recipient_email, metadata, ...row }) => {
          const recipients = recipientAddresses({ recipient_email, metadata });
          return { ...row, recipientEmail: recipients.join(", "), recipientEmails: recipients };
        }), nextCursor: rows.length > 100 ? rows[99].id : null });
      }
      const ids = (ticket?.messageIds || input!.messageIds).slice().sort();
      const { rows } = await client.query(sourceSql, [missionId, ids]);
      const checked = reviewRows(rows, ids, missionId, ticket?.purpose || input!.purpose, ticket);
      if (!ticket) {
        const expiresAt = Date.now() + 15 * 60_000;
        const preview: Ticket = { ...input!, messageIds: ids, actorId, missionId,
          reviewId: randomUUID(), fingerprint: checked.fingerprint, expiresAt };
        await client.query("ROLLBACK");
        return void res.json({ reviewToken: encode(preview), fingerprint: checked.fingerprint,
          expiresAt, missionId, purpose: input!.purpose, rows: rows.map(r => publicRow(r, true)),
          unknownSendingTimes: rows.filter(r => !r.message.sent_at).length });
      }
      if (!checked.applied) for (const row of rows) {
        const updated = await client.query(`UPDATE communication_messages SET campaign_id=$2
          WHERE id=$1 AND campaign_id IS NULL RETURNING id`, [row.message.id, missionId]);
        if (updated.rows.length !== 1) stop();
        await client.query(`INSERT INTO campaign_contact_history
          (id,campaign_contact_id,user_id,action,metadata)
          VALUES($1,$2,$3,'mission_email_attribution',$4::jsonb)`,
        [randomUUID(), row.contact_ids[0], actorId, JSON.stringify({
          messageId: row.message.id, campaignId: missionId, purpose: ticket.purpose,
          previousCampaignId: null, originalSentAt: timestampUtc(row.message.sent_at),
          originalRecordedAt: timestampUtc(row.message.created_at), sendingTimeKnown: Boolean(row.message.sent_at),
          timestampKind: row.message.sent_at ? "sent" : "recorded", reviewSource: source,
          reviewId: ticket.reviewId, batchFingerprint: ticket.fingerprint,
          reason: ticket.reason, evidenceVersion: 2,
        })]);
      }
      await client.query("COMMIT");
      res.json({ status: checked.applied ? "already_applied" : "applied", updates: checked.applied ? 0 : rows.length });
    } catch (error) {
      await client?.query("ROLLBACK").catch(() => {});
      const status = error instanceof ReviewError ? error.status : error instanceof z.ZodError ? 400 :
        ["40001", "40P01", "55P03", "57014"].includes((error as any)?.code) ? 409 : 500;
      res.status(status).json({ error: error instanceof ReviewError ? error.message : "Historical email review unavailable" });
    } finally { client?.release(); }
  };
  app.get(path, requireAuth, handler("list"));
  app.post(`${path}/preview`, requireAuth, handler("preview"));
  app.post(`${path}/apply`, requireAuth, handler("apply"));
}
