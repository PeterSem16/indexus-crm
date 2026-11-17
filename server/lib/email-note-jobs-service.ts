import { createEmailNoteJobsClient, EmailNoteError } from "./email-note-jobs-client";
import { EMAIL_NOTE_JOBS_SCHEMA } from "./email-note-jobs-schema";

export type NoteScope = { userId: string; mailbox: string; messageId: string };
export interface NoteSql {
  query: (text: string, params?: any[]) => Promise<{ rows: any[]; rowCount: number | null }>;
}
export const emailNotesEnabled = () => process.env.INDEXUS_AI_EMAIL_NOTES_ENABLED === "true";
export function createEmailNoteService(sql: NoteSql, options: {
  enabled?: () => boolean; client?: ReturnType<typeof createEmailNoteJobsClient>;
} = {}) {
  const enabled = options.enabled ?? emailNotesEnabled;
  const gateway = options.client ?? createEmailNoteJobsClient({
    token: () => process.env.INDEXUS_AI_GATEWAY_TOKEN,
  });
  const identity = (scope: NoteScope) => [scope.userId, scope.mailbox.toLowerCase(), scope.messageId];
  const requireEnabled = () => { if (!enabled()) throw new EmailNoteError("feature_disabled", 503); };
  async function get(scope: NoteScope) {
    const { rows } = await sql.query(`SELECT id,status,note,error_code,approved_note,approved_by,
      approved_at,version,created_at,updated_at,job_id FROM email_note_jobs
      WHERE owner_user_id=$1 AND mailbox_email=$2 AND message_id=$3`, identity(scope));
    return rows[0] ?? null;
  }
  async function submit(scope: NoteScope, text: string) {
    requireEnabled();
    if (!text.trim() || text.length > 100_000) throw new EmailNoteError("invalid_email_text", 400);
    // Commit the unique reservation BEFORE the only POST. Neither a duplicate
    // request nor a restarted process may resubmit an ambiguous upstream write.
    const { rows } = await sql.query(`INSERT INTO email_note_jobs(owner_user_id,mailbox_email,message_id)
      VALUES($1,$2,$3) ON CONFLICT(owner_user_id,mailbox_email,message_id) DO NOTHING RETURNING id`,
    identity(scope));
    if (!rows.length) return get(scope);
    const id = rows[0].id;
    try {
      // Recheck after the awaited database reservation (emergency stop).
      requireEnabled();
      const job = await gateway.submit(text);
      await sql.query(`UPDATE email_note_jobs SET job_id=$2,status='pending',updated_at=now(),
        next_poll_at=now()+interval '5 seconds',version=version+1 WHERE id=$1`, [id, job.job_id]);
    } catch (error) {
      const code = error instanceof EmailNoteError ? error.code : "submission_uncertain";
      await sql.query(`UPDATE email_note_jobs SET status='failed',error_code=$2,
        updated_at=now(),version=version+1 WHERE id=$1`, [id, code]);
    }
    return get(scope);
  }
  async function approve(scope: NoteScope, note: unknown, version: unknown) {
    requireEnabled();
    if (typeof note !== "string" || note.trim().length < 12 || note.length > 20_000 ||
      !Number.isInteger(version) || Number(version) < 0)
      throw new EmailNoteError("invalid_approval", 400);
    // One SQL statement: revision check, approval and immutable audit succeed
    // together. Never update sentiment, monitoring, customers or opportunities.
    const { rows } = await sql.query(`WITH locked AS (
      SELECT * FROM email_note_jobs WHERE owner_user_id=$1 AND mailbox_email=$2 AND message_id=$3
        AND status IN ('review_required','approved') AND version=$5 FOR UPDATE
    ), changed AS (
      UPDATE email_note_jobs j SET status='approved',approved_note=$4,approved_by=$1,
        approved_at=now(),updated_at=now(),version=j.version+1
      FROM locked l WHERE j.id=l.id AND j.version=$5
      RETURNING j.id,COALESCE(l.approved_note,l.note) AS previous_note,l.note AS generated_note
    )
    INSERT INTO email_note_job_audit(note_id,actor_user_id,action,previous_note,approved_note)
      SELECT id,$1,CASE WHEN generated_note=$4 THEN 'approved' ELSE 'edited_and_approved' END,
        previous_note,$4 FROM changed RETURNING note_id`,
    [...identity(scope), note.trim(), version]);
    if (!rows.length) throw new EmailNoteError("approval_conflict", 409);
    return get(scope);
  }
  let ticking = false;
  async function tick() {
    if (ticking || !enabled()) return;
    ticking = true;
    try {
      // Recover a process crash between reservation and storing the returned
      // job_id without sending another POST (upstream has no idempotency API).
      await sql.query(`UPDATE email_note_jobs SET status='failed',error_code='submission_uncertain',
        version=version+1,updated_at=now() WHERE status='pending' AND job_id IS NULL
        AND created_at<now()-interval '2 minutes'`);
      await sql.query(`UPDATE email_note_jobs SET status='failed',error_code='job_timeout',
        version=version+1,updated_at=now() WHERE status IN ('pending','processing') AND job_id IS NOT NULL
        AND (created_at<now()-interval '10 minutes' OR poll_attempts>=60)
        AND next_poll_at<=now()`);
      // Persistent leases support multiple server processes and restart recovery.
      const { rows } = await sql.query(`WITH due AS (
        SELECT id FROM email_note_jobs WHERE status IN ('pending','processing') AND job_id IS NOT NULL
          AND next_poll_at<=now() AND poll_attempts<60 AND created_at>=now()-interval '10 minutes'
        ORDER BY next_poll_at FOR UPDATE SKIP LOCKED LIMIT 1
      ) UPDATE email_note_jobs j SET poll_attempts=poll_attempts+1,
        next_poll_at=now()+interval '30 seconds'
        FROM due WHERE j.id=due.id RETURNING j.id,j.job_id,j.poll_attempts`);
      for (const row of rows) {
        if (!enabled()) return;
        try {
          const job = await gateway.poll(row.job_id);
          const completed = job.status === "completed" || job.status === "review_required";
          const status = completed ? "review_required" : job.status;
          await sql.query(`UPDATE email_note_jobs SET status=$2,note=$3,error_code=$4,
            next_poll_at=now()+interval '5 seconds',updated_at=now(),version=version+1
            WHERE id=$1 AND status IN ('pending','processing') AND poll_attempts=$5`,
          [row.id, status, completed ? job.note!.trim() : null,
            status === "failed" ? "generation_failed" : null, row.poll_attempts]);
        } catch (error) {
          const code = error instanceof EmailNoteError ? error.code : "gateway_unavailable";
          const retry = ["gateway_timeout", "gateway_unavailable"].includes(code);
          await sql.query(`UPDATE email_note_jobs SET status=CASE WHEN $2 THEN status ELSE 'failed' END,
            error_code=$3,next_poll_at=now()+interval '15 seconds',updated_at=now(),version=version+1
            WHERE id=$1 AND status IN ('pending','processing') AND poll_attempts=$4`,
          [row.id, retry, code, row.poll_attempts]);
        }
      }
    } finally { ticking = false; }
  }
  return { get, submit, approve, tick, enabled,
    ensureSchema: () => sql.query(EMAIL_NOTE_JOBS_SCHEMA) };
}
