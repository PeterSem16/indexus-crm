-- Run locally on CORPCRM01 with psql -X -v ON_ERROR_STOP=1 -f this-file.
-- Read-only and aggregate-only: no caller, agent, channel, token or audio output.
BEGIN READ ONLY;
SET LOCAL statement_timeout = '15s';
SET LOCAL timezone = 'UTC';

SELECT to_regclass('public.queue_forwarded_calls') IS NOT NULL AS evidence_table_exists;

-- Limit audit to new handoffs, not historical recovery without CEL evidence.
SELECT q.status, q.recording_state, count(*) AS calls,
       count(*) FILTER (WHERE c.answered_at IS NOT NULL) AS confirmed_answers,
       count(*) FILTER (WHERE c.ended_at IS NOT NULL) AS confirmed_ends,
       coalesce(sum(c.duration_seconds), 0) AS confirmed_talk_seconds,
       count(*) FILTER (WHERE q.last_error IS NOT NULL) AS pending_errors
FROM queue_forwarded_calls q
JOIN call_logs c ON c.id = q.call_log_id
WHERE q.transferred_at >= (now() AT TIME ZONE 'UTC') - interval '14 days'
GROUP BY q.status, q.recording_state
ORDER BY q.status, q.recording_state;

SELECT
  count(*) FILTER (WHERE c.answered_at IS NULL AND coalesce(c.duration_seconds, 0) <> 0)
    AS unconfirmed_talk_violations,
  count(*) FILTER (WHERE c.answered_at IS NOT NULL AND c.ended_at < c.answered_at)
    AS invalid_time_order,
  count(*) FILTER (WHERE c.answered_at IS NOT NULL AND c.ended_at IS NOT NULL
    AND c.duration_seconds IS DISTINCT FROM
      greatest(0, floor(extract(epoch FROM (c.ended_at - c.answered_at))))::integer)
    AS talk_duration_mismatches,
  count(*) FILTER (WHERE i.call_log_id IS DISTINCT FROM q.call_log_id)
    AS inbound_link_mismatches,
  count(*) FILTER (WHERE q.status <> 'cancelled' AND c.status IS DISTINCT FROM q.status)
    AS outcome_mismatches,
  count(*) FILTER (WHERE q.recording_policy_snapshot->>'mode' = 'agent_only'
    AND (q.recording_authorized OR q.recording_state = 'saved'))
    AS forbidden_mixed_recording_authorizations
FROM queue_forwarded_calls q
JOIN call_logs c ON c.id = q.call_log_id
JOIN inbound_call_logs i ON i.id = q.inbound_call_log_id
WHERE q.transferred_at >= (now() AT TIME ZONE 'UTC') - interval '14 days';

SELECT count(*) AS duplicated_canonical_links
FROM (
  SELECT call_log_id
  FROM queue_forwarded_calls
  GROUP BY call_log_id HAVING count(*) > 1
) duplicates;

ROLLBACK;