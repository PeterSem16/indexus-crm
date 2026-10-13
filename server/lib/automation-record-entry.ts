import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { dirname, join } from "node:path";
import { and, eq, or, sql, inArray } from "drizzle-orm";
import type { Express, RequestHandler } from "express";
import { db, pool } from "../db";
import { activityLogs, taskAttachmentUploads, users } from "../../shared/schema";
import { RECORD_ENTRY_TYPES, PHONE_COUNTRY_CODES, recordEntryIssues, uniqueRecordMatch,
  recordPhoneKey, type RecordEntryConfig, type RecordEntryType } from "../../shared/automation-record-entry";
import { updateRecordTables, scopePredicate, countryExpression, labelExpression, updateRecordOwner, readUpdateRecord } from "./automation-update-record";
import { loadAnalysisSource } from "./automation-analysis-source";
import { renderAutomationText, automationDisplayValues } from "./automation-display-values";
import { lookupAutomationReference } from "./automation-reference-lookup";
import { DATA_ROOT } from "../config/storage-paths";
import { attachmentExtensions } from "./automation-attachment-document";
import { RecordEntryAmbiguity, createRecordReview, existingRecordReview, recordReviewKey, type ReviewTaskCreator } from "./automation-record-review";

export const RECORD_ENTRY_SCHEMA = `
CREATE TABLE IF NOT EXISTS automation_record_entries (
 id varchar PRIMARY KEY DEFAULT gen_random_uuid()::text,
 dedupe_key text NOT NULL UNIQUE, entity_type text NOT NULL, entity_id varchar NOT NULL,
 country_code text, user_id varchar NOT NULL, rule_id varchar NOT NULL, rule_name text NOT NULL,
 event_id varchar NOT NULL, title text NOT NULL, note text NOT NULL DEFAULT '',
 attachments jsonb NOT NULL DEFAULT '[]'::jsonb, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS automation_record_entries_entity ON automation_record_entries(entity_type,entity_id,created_at);
`;
let schemaReady: Promise<unknown> | undefined;
const ensure = () => schemaReady ||= pool.query(RECORD_ENTRY_SCHEMA).catch(error => { schemaReady = undefined; throw error; });
type Owner = Awaited<ReturnType<typeof updateRecordOwner>>;
type Match = { id: string; entityType: RecordEntryType; label: string; country: string | null };
const contactColumns = (table: any, kind: "email" | "phone") => (kind === "email"
  ? ["email", "email2", "email3", "workEmail", "privateEmail"]
  : ["phone", "phone2", "phone3", "mobile", "mobile2", "mobilePhone", "workPhone", "privatePhone"]).filter(key => table[key]).map(key => table[key]);
function phoneSql(column: any, country: any) {
  const digits = sql`regexp_replace(coalesce(${column},''),'[^0-9]','','g')`;
  const prefix = sql`CASE ${country} ${sql.join(Object.entries(PHONE_COUNTRY_CODES).map(([c, code]) => sql`WHEN ${c} THEN ${code}`), sql` `)} END`;
  return sql`CASE WHEN trim(${column}) LIKE '+%' THEN 'e164:' || ${digits}
    WHEN trim(${column}) LIKE '00%' THEN 'e164:' || substring(${digits} from 3)
    WHEN ${prefix} IS NOT NULL THEN 'e164:' || ${prefix} || CASE WHEN ${country}='IT' THEN ${digits} ELSE regexp_replace(${digits},'^0','') END
    ELSE 'local:' || ${country} || ':' || ${digits} END`;
}
export async function matchRecordContacts(input: { targetType: string; email?: string; phone?: string },
  owner: Owner, countries?: string[] | null, executor: any = db): Promise<{ records: Match[]; truncated: boolean }> {
  if (!["auto", ...RECORD_ENTRY_TYPES].includes(input.targetType)) throw new Error("record_entry_invalid");
  const email = input.email?.trim().toLowerCase(), phone = input.phone?.trim();
  if (!email && !phone) throw new Error("record_entry_contact_missing");
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || phone && !/^(?:\+|00)?[\d ()-]{7,40}$/.test(phone))
    throw new Error("record_entry_invalid");
  const records: Match[] = [];
  const types = input.targetType === "auto" ? RECORD_ENTRY_TYPES : [input.targetType as RecordEntryType];
  for (const type of types) {
    const table = updateRecordTables[type], country = countryExpression(type, table);
    const emailConditions = email ? contactColumns(table, "email").map(column => sql`lower(trim(${column}))=${email}`) : [];
    const phoneConditions = phone ? contactColumns(table, "phone").map(column => {
      // Derive a national number only from the record's trusted country, never a browser's guess.
      const digits = phone.replace(/\D/g, "");
      const international = phone.startsWith("+") || phone.startsWith("00");
      const key = international ? recordPhoneKey(phone, null) : null;
      if (international) return eq(phoneSql(column, country), key || "invalid");
      const prefix = sql`CASE ${country} ${sql.join(Object.entries(PHONE_COUNTRY_CODES).map(([c, code]) => sql`WHEN ${c} THEN ${code}`), sql` `)} END`;
      const expected = sql`CASE WHEN ${prefix} IS NOT NULL THEN 'e164:' || ${prefix} ||
        CASE WHEN ${country}='IT' THEN ${digits} ELSE regexp_replace(${digits},'^0','') END
        ELSE 'local:' || ${country} || ':' || ${digits} END`;
      return eq(phoneSql(column, country), expected);
    }) : [];
    if (email && !emailConditions.length || phone && !phoneConditions.length) continue;
    const rows = await executor.select({ id: table.id, label: labelExpression(type, table), country }).from(table)
      .where(and(scopePredicate(type, table, owner, countries), email ? or(...emailConditions) : undefined,
        phone ? or(...phoneConditions) : undefined)).limit(21);
    records.push(...rows.map((row: any) => ({ ...row, entityType: type })));
  }
  return { records: records.slice(0, 20), truncated: records.length > 20 };
}

export async function executeRecordEntry(config: RecordEntryConfig, ctx: any, sourceLoader = loadAnalysisSource, createReviewTask?: ReviewTaskCreator) {
  try {
    if (recordEntryIssues(config).length) throw new Error("record_entry_invalid");
    const owner = await updateRecordOwner(ctx.rule.createdByUserId);
    const source = await sourceLoader(ctx.rule, ctx.event);
    if (!source?.communication.id || source.communication.id !== ctx.communication?.id) throw new Error("record_entry_source_denied");
    const contact = config.lookup === "configured" ? { email: config.email, phone: config.phone }
      : config.lookup === "sender" ? { email: source.communication.senderEmail, phone: source.communication.senderPhone }
        : { email: source.communication.recipientEmail, phone: source.communication.recipientPhone };
    const countries = ctx.rule.countryCodes || (ctx.rule.countryCode ? [ctx.rule.countryCode] : null);
    const sourceCountry = source.communication.countryCode;
    if (sourceCountry && countries?.length && !countries.includes(sourceCountry)) throw new Error("record_entry_source_denied");
    const scoped = sourceCountry ? [String(sourceCountry)] : countries;
    await ensure();
    if (config.onAmbiguous) {
      const pending = await existingRecordReview(recordReviewKey(config, ctx));
      if (pending) return pending;
    }
    let files: any[] = [];
    if (config.mode === "invoice") {
      if (source.channel !== "email") throw new Error("record_entry_invoice_missing");
      const invoices = (ctx.analysis?.attachments || []).filter((file: any) => file.classification === "invoice" && file.sourceAttachmentId);
      if (!invoices.length || invoices.length > 10) throw new Error("record_entry_invoice_missing");
      files = await db.select({ id: taskAttachmentUploads.id, name: taskAttachmentUploads.name,
        type: taskAttachmentUploads.type, size: taskAttachmentUploads.size }).from(taskAttachmentUploads)
        .where(and(inArray(taskAttachmentUploads.id, invoices.map((file: any) => file.id)), eq(taskAttachmentUploads.uploaderUserId, owner.id)));
      if (files.length !== invoices.length) throw new Error("record_entry_attachment_denied");
    }
    const display = await automationDisplayValues(ctx, [config.title, config.note || ""], lookupAutomationReference);
    const title = renderAutomationText(config.title, ctx, display).slice(0, 1000);
    const note = renderAutomationText(config.note?.trim() ? config.note : "{{analysis.summary}}", ctx, display).slice(0, 12000);
    await ensure();
    return await db.transaction(async tx => {
      const plan = await matchRecordContacts({ targetType: config.targetType, email: contact.email ? String(contact.email) : undefined,
        phone: contact.phone ? String(contact.phone) : undefined }, owner, scoped, tx);
      if ((plan.truncated || plan.records.length > 1) && config.onAmbiguous) {
        let reviewFiles = files;
        if (!reviewFiles.length && source.channel === "email") {
          const invoices = (ctx.analysis?.attachments || []).filter((file: any) => file.classification === "invoice" && file.sourceAttachmentId);
          if (invoices.length > 10) throw new Error("record_entry_invoice_missing");
          if (invoices.length) {
            reviewFiles = await tx.select({ id: taskAttachmentUploads.id, name: taskAttachmentUploads.name,
              type: taskAttachmentUploads.type, size: taskAttachmentUploads.size }).from(taskAttachmentUploads)
              .where(and(inArray(taskAttachmentUploads.id, invoices.map((file: any) => file.id)), eq(taskAttachmentUploads.uploaderUserId, owner.id)));
            if (reviewFiles.length !== invoices.length) throw new Error("record_entry_attachment_denied");
          }
        }
        const candidateCountries = new Set(plan.records.map(record => record.country));
        const country = sourceCountry ? String(sourceCountry) : scoped?.length === 1 ? scoped[0]
          : !plan.truncated && candidateCountries.size === 1 ? plan.records[0].country : null;
        throw new RecordEntryAmbiguity({ ...plan, country, title, note, files: reviewFiles, ownerId: owner.id });
      }
      const target = uniqueRecordMatch(plan.records, plan.truncated);
      const table = updateRecordTables[target.entityType];
      const locked = await tx.select({ id: table.id }).from(table)
        .where(and(eq(table.id, target.id), scopePredicate(target.entityType, table, owner, scoped))).for("update");
      if (!locked.length) throw new Error("record_entry_target_denied");
      const key = createHash("sha256").update(JSON.stringify([ctx.rule.id, ctx.event.id, target.entityType, target.id, config])).digest("hex");
      const result = await tx.execute(sql`INSERT INTO automation_record_entries
        (dedupe_key,entity_type,entity_id,country_code,user_id,rule_id,rule_name,event_id,title,note,attachments)
        VALUES(${key},${target.entityType},${target.id},${target.country},${owner.id},${ctx.rule.id},${ctx.rule.name},
          ${ctx.event.id},${title},${note},${JSON.stringify(files)}::jsonb)
        ON CONFLICT(dedupe_key) DO NOTHING RETURNING id`);
      if (result.rows.length && files.length) await tx.update(taskAttachmentUploads).set({ everAssociated: true })
        .where(and(inArray(taskAttachmentUploads.id, files.map(file => file.id)), eq(taskAttachmentUploads.uploaderUserId, owner.id)));
      if (result.rows.length) await tx.insert(activityLogs).values({
        userId: owner.id, action: "automation_analysis", entityType: target.entityType, entityId: target.id,
        entityName: target.label, details: JSON.stringify({ title, note, ruleId: ctx.rule.id,
          ruleName: ctx.rule.name, entryId: result.rows[0].id, attachmentCount: files.length }),
      });
      return { ok: true, output: { entityType: target.entityType, entityId: target.id, entryId: result.rows[0]?.id ?? null,
        attachmentCount: files.length, duplicate: !result.rows.length } };
    }, { isolationLevel: "serializable" });
  } catch (error) {
    if (error instanceof RecordEntryAmbiguity) {
      try { return await createRecordReview(config, ctx, error, createReviewTask); }
      catch (reviewError) { error = reviewError; }
    }
    return { ok: false, error: error instanceof Error && /^record_entry_[a-z_]+$/.test(error.message) ? error.message : "record_entry_failed" };
  }
}

export function registerRecordEntryRoutes(app: Express, requireAuth: RequestHandler, requireAdmin: RequestHandler) {
  app.post("/api/automation/record-match", requireAdmin, async (req, res) => {
    try {
      if (!Array.isArray(req.body.countryCodes || []) || (req.body.countryCodes || []).some((c: unknown) => typeof c !== "string"))
        return res.status(400).json({ error: "Invalid country scope" });
      const owner = await updateRecordOwner((req as any).session.user.id);
      const result = await matchRecordContacts(req.body, owner, req.body.countryCodes);
      res.json({ ...result, status: result.truncated || result.records.length > 1 ? "ambiguous" : result.records.length === 1 ? "unique" : "missing" });
    } catch { res.status(400).json({ error: "record_match_unavailable" }); }
  });
  const permitted = async (req: any) => {
    const type = req.params.entityType;
    if (!RECORD_ENTRY_TYPES.includes(type)) throw new Error("Invalid entity");
    const [user] = await db.select({ id: users.id, role: users.role, assignedCountries: users.assignedCountries, isActive: users.isActive })
      .from(users).where(eq(users.id, req.session.user.id));
    if (!user || user.isActive !== true) throw new Error("Unavailable");
    await readUpdateRecord(type, req.params.entityId, user);
  };
  app.get("/api/automation/records/:entityType/:entityId/entries", requireAuth, async (req, res) => {
    try {
      await permitted(req); await ensure();
      const result = await pool.query(`SELECT id,title,note,rule_name AS "ruleName",created_at AS "createdAt",attachments
        FROM automation_record_entries WHERE entity_type=$1 AND entity_id=$2 ORDER BY created_at DESC LIMIT 200`, [req.params.entityType, req.params.entityId]);
      res.json(result.rows);
    } catch { res.status(403).json({ error: "record_entries_denied" }); }
  });
  app.get("/api/automation/records/:entityType/:entityId/files/:fileId", requireAuth, async (req, res) => {
    try {
      await permitted(req); await ensure();
      const linked = await pool.query(`SELECT u.storage_key,u.name,u.type FROM task_attachment_uploads u
        WHERE u.id=$3 AND EXISTS(SELECT 1 FROM automation_record_entries e
          WHERE e.entity_type=$1 AND e.entity_id=$2 AND e.attachments @> jsonb_build_array(jsonb_build_object('id',u.id)))`,
        [req.params.entityType, req.params.entityId, req.params.fileId]);
      const file = linked.rows[0];
      if (!file || !/^[a-f0-9-]{36}\.[a-z0-9]{1,5}$/i.test(file.storage_key) || !attachmentExtensions[file.type])
        return res.status(404).json({ error: "File unavailable" });
      res.setHeader("Content-Type", file.type);
      res.setHeader("X-Content-Type-Options", "nosniff");
      res.setHeader("Content-Disposition", `attachment; filename*=UTF-8''${encodeURIComponent(file.name.replace(/[\r\n]/g, "_"))}`);
      createReadStream(join(dirname(DATA_ROOT), "private-task-attachments", file.storage_key))
        .on("error", () => { if (!res.headersSent) res.status(404).end(); else res.destroy(); }).pipe(res);
    } catch { res.status(403).json({ error: "record_file_denied" }); }
  });
}
