/** Additive, idempotent startup migration; rollback retains private draft/audit records. */
export const EMAIL_NOTE_JOBS_SCHEMA = `
CREATE TABLE IF NOT EXISTS email_note_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id varchar NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  mailbox_email text NOT NULL,
  message_id text NOT NULL,
  job_id uuid UNIQUE,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','processing','review_required','failed','approved')),
  note text,
  error_code text,
  approved_note text,
  approved_by varchar REFERENCES users(id),
  approved_at timestamptz,
  version integer NOT NULL DEFAULT 0,
  poll_attempts integer NOT NULL DEFAULT 0,
  next_poll_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(owner_user_id,mailbox_email,message_id)
);
CREATE INDEX IF NOT EXISTS email_note_jobs_poll ON email_note_jobs(next_poll_at)
  WHERE status IN ('pending','processing');
CREATE TABLE IF NOT EXISTS email_note_job_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  note_id uuid NOT NULL REFERENCES email_note_jobs(id) ON DELETE CASCADE,
  actor_user_id varchar NOT NULL REFERENCES users(id),
  action text NOT NULL CHECK (action IN ('approved','edited_and_approved')),
  previous_note text,
  approved_note text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
`;
