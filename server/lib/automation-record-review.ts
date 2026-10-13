import { createHash } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { db, pool } from "../db";
import { taskGroups } from "../../shared/schema";
import type { RecordEntryConfig } from "../../shared/automation-record-entry";
import { getRecordReviewCopy } from "../../client/src/i18n/automation-record-review-copy";
import { getRecordEntryCopy } from "../../client/src/i18n/automation-record-entry-copy";

export type ReviewTaskCreator = (config: any, ctx: any) => Promise<{ ok: boolean; output?: any; error?: string }>;
export class RecordEntryAmbiguity extends Error {
  constructor(public plan: { records: { id: string; entityType: string; label: string; country: string | null }[];
    truncated: boolean; country: string | null; title: string; note: string; files: any[]; ownerId: string }) {
    super("record_entry_ambiguous");
  }
}
export function recordReviewKey(config: RecordEntryConfig, ctx: any) {
  return createHash("sha256").update(JSON.stringify([ctx.rule.id, ctx.event.id, config.recordEntryVersion,
    config.targetType, config.lookup, config.email || "", config.phone || "", config.mode, config.title,
    config.note || "", config.onAmbiguous?.taskGroupId])).digest("hex");
}
export async function existingRecordReview(key: string) {
  const { rows } = await pool.query("SELECT entity_id FROM automation_record_entries WHERE dedupe_key=$1 AND entity_type='task'", [key]);
  return rows[0] ? { ok: true, output: { routedToBackOffice: true, taskId: rows[0].entity_id, duplicate: true } } : null;
}
export async function createRecordReview(config: RecordEntryConfig, ctx: any, ambiguity: RecordEntryAmbiguity, createTask?: ReviewTaskCreator) {
  if (!createTask || !config.onAmbiguous) throw new Error("record_entry_review_unavailable");
  const p = ambiguity.plan;
  // Never publish a country-less review containing identities from several countries.
  if (!p.country || p.records.some(record => record.country !== p.country)) throw new Error("record_entry_review_country_required");
  const [group] = await db.select({ id: taskGroups.id }).from(taskGroups)
    .where(and(eq(taskGroups.id, config.onAmbiguous.taskGroupId), eq(taskGroups.isBackOffice, true)));
  if (!group) throw new Error("record_entry_review_group_unavailable");
  const key = recordReviewKey(config, ctx), client = await pool.connect();
  const lock = BigInt.asIntN(64, BigInt(`0x${key.slice(0, 16)}`)).toString();
  let locked = false;
  try {
    await client.query("SELECT pg_advisory_lock($1::bigint)", [lock]); locked = true;
    const existing = await existingRecordReview(key);
    if (existing) return existing;
    const locale = ({ SK: "sk", CZ: "cs", HU: "hu", RO: "ro", IT: "it", DE: "de" } as Record<string, string>)[p.country] || "en";
    const c = getRecordReviewCopy(locale), records = getRecordEntryCopy(locale);
    const marker = `[INDEXUS-REVIEW:${key}]`;
    // Recover a committed task if an earlier attempt stopped before writing its review receipt.
    const recovered = await client.query(`SELECT id FROM tasks WHERE created_by_user_id=$1 AND country=$2
      AND description LIKE $3 AND tags @> ARRAY[$4]::text[] LIMIT 1`,
      [p.ownerId, p.country, `%${marker}%`, `group_id:${group.id}`]);
    let taskId = recovered.rows[0]?.id;
    if (!taskId) {
      const names = p.records.map(record => `• ${record.label} · ${(records as any)[record.entityType] || record.entityType} · ${record.country}`).join("\n");
      const description = `${p.note}\n\n${c.candidates}\n${names}${p.truncated ? `\n${c.more}` : ""}\n\n${c.help}\n\n${c.reference}: ${marker}`;
      const attachmentIds = new Set(p.files.map(file => file.id));
      // Text is substituted once from trusted context. Never reinterpret tokens in source text.
      const result = await createTask({ taskActionVersion: 2, taskGroupId: group.id, country: p.country,
        title: "{{recordReview.title}}", description: "{{recordReview.description}}", taskText: "{{recordReview.description}}",
        analysisAttachments: p.files.length ? "invoice" : undefined, priority: "medium", createdByUserId: p.ownerId },
        { ...ctx, recordReview: { title: p.title, description }, analysis: { ...ctx.analysis,
          attachments: (ctx.analysis?.attachments || []).filter((file: any) => attachmentIds.has(file.id)) },
          event: { ...ctx.event, countryCode: p.country } });
      if (!result.ok || !result.output?.taskId) throw new Error("record_entry_review_delivery_failed");
      taskId = result.output.taskId;
    }
    await client.query(`INSERT INTO automation_record_entries
      (dedupe_key,entity_type,entity_id,country_code,user_id,rule_id,rule_name,event_id,title,note,attachments)
      VALUES($1,'task',$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb) ON CONFLICT(dedupe_key) DO NOTHING`,
      [key, taskId, p.country, p.ownerId, ctx.rule.id, ctx.rule.name, ctx.event.id, p.title, p.note, JSON.stringify(p.files)]);
    return { ok: true, output: { routedToBackOffice: true, taskId, attachmentCount: p.files.length, duplicate: !!recovered.rows.length } };
  } finally {
    try { if (locked) await client.query("SELECT pg_advisory_unlock($1::bigint)", [lock]); } finally { client.release(); }
  }
}
