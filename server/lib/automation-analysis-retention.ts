import { unlink } from "node:fs/promises";
import { join } from "node:path";

type Client = { query(text: string, values?: any[]): Promise<{ rows: any[] }>; release(): void };
type Pool = { connect(): Promise<Client> };

export const ANALYSIS_RETENTION = { resultDays: 90, errorDays: 7, orphanDays: 30, batchSize: 100 } as const;
export const ANALYSIS_RETENTION_SCHEMA = `
  ALTER TABLE workflow_analysis_cache ADD COLUMN IF NOT EXISTS rule_id text;
  ALTER TABLE workflow_analysis_cache ADD COLUMN IF NOT EXISTS event_id text;
  ALTER TABLE task_attachment_uploads ADD COLUMN IF NOT EXISTS analysis_cache_key text;
  CREATE INDEX IF NOT EXISTS task_upload_analysis_retention
    ON task_attachment_uploads(created_at) WHERE analysis_cache_key IS NOT NULL;
  CREATE TABLE IF NOT EXISTS workflow_analysis_tombstones (
    cache_key text PRIMARY KEY, expired_at timestamptz NOT NULL DEFAULT now()
  );
  CREATE TABLE IF NOT EXISTS workflow_analysis_file_deletions (
    storage_key text PRIMARY KEY, upload_id text NOT NULL,
    queued_at timestamptz NOT NULL DEFAULT now(), cleaned_at timestamptz
  );
  CREATE OR REPLACE FUNCTION reject_retired_analysis_attachment() RETURNS trigger
  LANGUAGE plpgsql AS $$
  BEGIN
    IF EXISTS (SELECT 1 FROM workflow_analysis_file_deletions d
      WHERE strpos(to_jsonb(NEW)::text,d.upload_id)>0
        OR strpos(to_jsonb(NEW)::text,d.storage_key)>0) THEN
      RAISE EXCEPTION 'analysis_attachment_retired' USING ERRCODE='23503';
    END IF;
    RETURN NEW;
  END $$;
`;

// Search the complete JSON, including legacy URL-only references and read-only
// history snapshots. False positives retain a file; false negatives lose it.
const referenced = (column: string) => `(
  strpos(COALESCE(${column}::text,''),u.id)>0 OR
  strpos(COALESCE(${column}::text,''),u.storage_key)>0
)`;

export function validAnalysisStorageKey(key: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.[a-z0-9]+$/i.test(key);
}

/**
 * Only analysis-owned uploads are candidates. Never prune runs or association
 * history. Tables are locked briefly so a reference cannot commit between the
 * last reachability check and deleting the upload. A durable deletion queue
 * separates the DB commit from unlink, making retries/crashes safe.
 */
export async function cleanAutomationAnalysis(pool: Pool, directory: string) {
  const client = await pool.connect();
  const counts = { caches: 0, uploads: 0, files: 0 };
  let locked = false;
  try {
    locked = (await client.query(
      "SELECT pg_try_advisory_lock(hashtext('indexus:analysis-retention')) AS locked",
    )).rows[0]?.locked === true;
    if (!locked) return counts;
    // Record-entry history is installed lazily. If absent, defer file collection
    // entirely instead of racing a first-time installation of that feature.
    await client.query("BEGIN");
    try {
      await client.query("SET LOCAL lock_timeout='2s'");
      await client.query("SET LOCAL statement_timeout='15s'");
      await client.query(`LOCK TABLE workflow_analysis_cache, task_attachment_uploads,
        tasks, task_comments, workflow_runs, chat_messages IN SHARE ROW EXCLUSIVE MODE`);
      const entries = (await client.query("SELECT to_regclass('automation_record_entries') AS present")).rows[0]?.present;
      if (entries) await client.query("LOCK TABLE automation_record_entries IN SHARE ROW EXCLUSIVE MODE");
      const retries = (await client.query("SELECT to_regclass('workflow_analysis_retries') AS present")).rows[0]?.present;
      if (retries) await client.query("LOCK TABLE workflow_analysis_retries IN SHARE ROW EXCLUSIVE MODE");
      // A writer can validate an upload BEFORE our table locks and save its
      // reference AFTER commit. Persistent, content-free retirement markers
      // reject that stale write rather than leaving a broken live attachment.
      for (const table of ["task_attachment_uploads", "tasks", "task_comments", "workflow_runs", "chat_messages",
        ...(retries ? ["workflow_analysis_retries"] : []),
        ...(entries ? ["automation_record_entries"] : [])]) {
        await client.query(`DO $$ BEGIN
          IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgrelid='${table}'::regclass
            AND tgname='guard_retired_analysis_attachment') THEN
            CREATE TRIGGER guard_retired_analysis_attachment BEFORE INSERT OR UPDATE ON ${table}
              FOR EACH ROW EXECUTE FUNCTION reject_retired_analysis_attachment();
          END IF;
        END $$`);
      }
      // Identify legacy analysis snapshots from their saved analysis result,
      // never by extension/directory alone. Manual/forwarded uploads stay out.
      await client.query(`WITH legacy AS (
        SELECT DISTINCT ON (u.id) u.id,c.cache_key
          FROM task_attachment_uploads u, workflow_analysis_cache c,
            LATERAL jsonb_array_elements(CASE WHEN jsonb_typeof(c.result->'attachments')='array'
              THEN c.result->'attachments' ELSE '[]'::jsonb END) a
          WHERE u.analysis_cache_key IS NULL AND u.id=a->>'id'
            AND u.uploader_user_id=c.owner_user_id
            AND a->>'url'='/api/tasks/attachments/' || u.id
          ORDER BY u.id LIMIT ${ANALYSIS_RETENTION.batchSize}
        ) UPDATE task_attachment_uploads u SET analysis_cache_key=l.cache_key FROM legacy l WHERE u.id=l.id`);

      // Do not evict a result until a terminal run has persisted its history.
      // A legacy result without key metadata must be reproduced exactly in
      // terminal history; otherwise it remains intact (fail closed).
      const expired = await client.query(`SELECT c.cache_key FROM workflow_analysis_cache c
        WHERE (c.result IS NULL AND c.created_at < now()-interval '${ANALYSIS_RETENTION.errorDays} days')
        OR (c.result IS NOT NULL AND c.created_at < now()-interval '${ANALYSIS_RETENTION.resultDays} days'
          AND ((c.rule_id IS NOT NULL AND c.event_id IS NOT NULL
            AND EXISTS (SELECT 1 FROM workflow_runs r WHERE r.rule_id=c.rule_id AND r.event_id=c.event_id
              AND r.status IN ('success','failed','skipped'))
            AND NOT EXISTS (SELECT 1 FROM workflow_runs r WHERE r.rule_id=c.rule_id AND r.event_id=c.event_id
              AND r.status='running'))
          OR (c.rule_id IS NULL
            AND EXISTS (SELECT 1 FROM workflow_runs r WHERE r.payload->'analysis'=c.result
              AND r.status IN ('success','failed','skipped'))
            AND NOT EXISTS (SELECT 1 FROM workflow_runs r WHERE r.payload->'analysis'=c.result AND r.status='running')))
          AND NOT EXISTS (SELECT 1 FROM task_attachment_uploads u WHERE u.analysis_cache_key IS NULL
            AND ${referenced("c.result")}))
        ORDER BY c.created_at LIMIT ${ANALYSIS_RETENTION.batchSize}`);
      for (const row of expired.rows) {
        // Same key lock as analyzeCommunication; never interrupt active analysis.
        const acquired = await client.query("SELECT pg_try_advisory_xact_lock(hashtext($1)) AS locked", [row.cache_key]);
        if (!acquired.rows[0]?.locked) continue;
        // Only successful results need permanent, content-free dedup markers.
        await client.query(`INSERT INTO workflow_analysis_tombstones(cache_key)
          SELECT cache_key FROM workflow_analysis_cache WHERE cache_key=$1 AND result IS NOT NULL
          ON CONFLICT DO NOTHING`, [row.cache_key]);
        await client.query("DELETE FROM workflow_analysis_cache WHERE cache_key=$1", [row.cache_key]);
        counts.caches++;
      }
      const candidates = entries ? await client.query(`SELECT u.id,u.storage_key FROM task_attachment_uploads u
        WHERE u.analysis_cache_key IS NOT NULL AND u.created_at < now()-interval '${ANALYSIS_RETENTION.orphanDays} days'
          AND NOT u.ever_associated AND COALESCE(u.association_history,'[]'::jsonb)='[]'::jsonb
          AND NOT EXISTS (SELECT 1 FROM tasks t WHERE ${referenced("t.attachments")} OR ${referenced("t.forward_review")})
          AND NOT EXISTS (SELECT 1 FROM task_comments t WHERE ${referenced("t.metadata")})
          AND NOT EXISTS (SELECT 1 FROM workflow_runs r WHERE ${referenced("r.payload")})
          ${retries ? `AND NOT EXISTS (SELECT 1 FROM workflow_analysis_retries a WHERE ${referenced("a.analysis")})` : ""}
          AND NOT EXISTS (SELECT 1 FROM chat_messages m WHERE ${referenced("m.attachments")})
          AND NOT EXISTS (SELECT 1 FROM workflow_analysis_cache c WHERE c.cache_key=u.analysis_cache_key OR ${referenced("c.result")})
          AND NOT EXISTS (SELECT 1 FROM automation_record_entries e WHERE ${referenced("e.attachments")})
        ORDER BY u.created_at LIMIT ${ANALYSIS_RETENTION.batchSize}`) : { rows: [] };
      for (const row of candidates.rows) {
        if (!validAnalysisStorageKey(row.storage_key)) continue;
        await client.query("INSERT INTO workflow_analysis_file_deletions(storage_key,upload_id) VALUES($1,$2) ON CONFLICT DO NOTHING", [row.storage_key, row.id]);
        await client.query("DELETE FROM task_attachment_uploads WHERE id=$1", [row.id]);
        counts.uploads++;
      }
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    }
    const pending = await client.query(`SELECT storage_key FROM workflow_analysis_file_deletions WHERE cleaned_at IS NULL ORDER BY queued_at LIMIT ${ANALYSIS_RETENTION.batchSize}`);
    for (const row of pending.rows) {
      if (!validAnalysisStorageKey(row.storage_key)) continue;
      // Defensive check against a restored/reused upload; never unlink its bytes.
      if ((await client.query("SELECT id FROM task_attachment_uploads WHERE storage_key=$1", [row.storage_key])).rows.length) continue;
      try { await unlink(join(directory, row.storage_key)); }
      catch (error: any) { if (error.code !== "ENOENT") throw error; }
      await client.query("UPDATE workflow_analysis_file_deletions SET cleaned_at=now() WHERE storage_key=$1", [row.storage_key]);
      counts.files++;
    }
    return counts;
  } finally {
    if (locked) await client.query("SELECT pg_advisory_unlock(hashtext('indexus:analysis-retention'))").catch(() => {});
    client.release();
  }
}
