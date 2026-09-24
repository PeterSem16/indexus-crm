-- Aggregate-only diagnostic for the Calls & Transcripts customer/player mismatch.
-- Run locally on CORPCRM01 with psql -X -v ON_ERROR_STOP=1 -f this-file.
-- Never returns IDs, names, phone numbers, paths, filenames, transcripts, or audio.
-- Assumes legacy timestamp (without time zone) columns contain UTC, as written by
-- the application. The selected local date is 2026-09-24 in Europe/Bratislava.
\set ON_ERROR_STOP on
\pset pager off
BEGIN READ ONLY;
SET LOCAL statement_timeout = '15s';
SET LOCAL TIME ZONE 'UTC';

WITH
date_bounds AS (
  SELECT
    timestamp '2026-09-23 22:00:00' AS utc_from,
    timestamp '2026-09-24 22:00:00' AS utc_to
),
-- The created_at predicate uses its existing index to bound the initial call
-- lookup; started_at selects the actual calls from the screenshot's local day.
audit_calls AS MATERIALIZED (
  SELECT
    l.id,
    l.customer_id,
    l.campaign_id,
    l.campaign_contact_id,
    l.phone_number,
    l.started_at,
    timezone('Europe/Bratislava', l.started_at AT TIME ZONE 'UTC') AS local_started_at
  FROM call_logs AS l
  CROSS JOIN date_bounds AS b
  WHERE l.created_at >= b.utc_from - interval '3 days'
    AND l.created_at <  b.utc_to + interval '3 days'
    AND l.started_at >= b.utc_from
    AND l.started_at <  b.utc_to
),
audit_identities AS MATERIALIZED (
  SELECT
    l.*,
    COALESCE(
      NULLIF(btrim(clinic.name), ''),
      NULLIF(btrim(hospital.full_name), ''),
      NULLIF(btrim(hospital.name), ''),
      NULLIF(btrim(concat_ws(' ', customer.first_name, customer.last_name)), '')
    ) AS resolved_call_label
  FROM audit_calls AS l
  LEFT JOIN campaign_contacts AS contact
    ON contact.id = l.campaign_contact_id
  LEFT JOIN customers AS customer
    ON customer.id = COALESCE(contact.customer_id, l.customer_id)
  LEFT JOIN clinics AS clinic
    ON clinic.id = COALESCE(contact.clinic_id, l.customer_id)
  LEFT JOIN hospitals AS hospital
    ON hospital.id = COALESCE(contact.hospital_id, l.customer_id)
),
call_recording_pairs AS MATERIALIZED (
  SELECT
    l.id AS call_id,
    l.local_started_at,
    l.customer_id AS call_customer_id,
    l.phone_number AS call_phone,
    l.resolved_call_label,
    r.id AS recording_id,
    r.customer_id AS recording_customer_id,
    r.customer_name AS recording_customer_name,
    r.phone_number AS recording_phone,
    count(r.id) OVER (PARTITION BY l.id) AS recording_count,
    CASE
      WHEN length(regexp_replace(COALESCE(l.phone_number, ''), '[^0-9]', '', 'g')) >= 9
       AND length(regexp_replace(COALESCE(r.phone_number, ''), '[^0-9]', '', 'g')) >= 9
      THEN right(regexp_replace(l.phone_number, '[^0-9]', '', 'g'), 9)
           <> right(regexp_replace(r.phone_number, '[^0-9]', '', 'g'), 9)
      ELSE false
    END AS phone_tail_mismatch,
    CASE
      WHEN NULLIF(btrim(r.customer_name), '') IS NOT NULL
       AND l.resolved_call_label IS NOT NULL
      THEN lower(regexp_replace(btrim(r.customer_name), '[^[:alnum:]]', '', 'g'))
           <> lower(regexp_replace(btrim(l.resolved_call_label), '[^[:alnum:]]', '', 'g'))
      ELSE false
    END AS customer_label_mismatch
  FROM audit_identities AS l
  LEFT JOIN call_recordings AS r ON r.call_log_id = l.id
),
scopes(scope, local_from, local_to) AS (
  VALUES
    ('Bratislava day 2026-09-24'::text, NULL::timestamp, NULL::timestamp),
    ('Screenshot call near 09:49'::text, timestamp '2026-09-24 09:46:00', timestamp '2026-09-24 09:52:00'),
    ('Screenshot call near 09:58'::text, timestamp '2026-09-24 09:55:00', timestamp '2026-09-24 10:01:00')
)
SELECT
  s.scope,
  count(DISTINCT p.call_id) AS calls,
  count(DISTINCT p.call_id) FILTER (WHERE p.recording_id IS NOT NULL) AS calls_with_recording,
  count(DISTINCT p.call_id) FILTER (WHERE p.recording_id IS NULL) AS calls_without_recording,
  count(DISTINCT p.call_id) FILTER (WHERE p.recording_count > 1) AS calls_with_multiple_recordings,
  count(DISTINCT p.recording_id)
    - count(DISTINCT p.call_id) FILTER (WHERE p.recording_id IS NOT NULL) AS extra_recording_rows,
  count(DISTINCT p.call_id) FILTER (
    WHERE p.recording_id IS NOT NULL
      AND p.call_customer_id IS NOT NULL
      AND p.recording_customer_id IS NOT NULL
      AND p.call_customer_id IS DISTINCT FROM p.recording_customer_id
  ) AS customer_id_mismatches,
  count(DISTINCT p.call_id) FILTER (WHERE p.phone_tail_mismatch) AS phone_last9_mismatches,
  count(DISTINCT p.call_id) FILTER (WHERE p.customer_label_mismatch) AS recording_label_vs_resolved_call_label_mismatches,
  count(DISTINCT p.call_id) FILTER (
    WHERE p.recording_id IS NOT NULL
      AND p.recording_customer_name IS NOT NULL
      AND p.resolved_call_label IS NULL
  ) AS recording_labels_without_resolved_call_identity
FROM scopes AS s
LEFT JOIN call_recording_pairs AS p
  ON s.local_from IS NULL
  OR (p.local_started_at >= s.local_from AND p.local_started_at < s.local_to)
GROUP BY s.scope, s.local_from
ORDER BY s.local_from NULLS FIRST;

-- Orphan recordings created on the same Bratislava calendar day. Counts only.
-- The date range is intentionally bounded; statement_timeout caps the scan.
WITH date_bounds AS (
  SELECT timestamp '2026-09-23 22:00:00' AS utc_from,
         timestamp '2026-09-24 22:00:00' AS utc_to
)
SELECT
  count(*) AS recordings_created_that_day,
  count(*) FILTER (WHERE NOT EXISTS (
    SELECT 1 FROM call_logs AS l WHERE l.id = r.call_log_id
  )) AS recordings_without_matching_call_log
FROM call_recordings AS r
CROSS JOIN date_bounds AS b
WHERE r.created_at >= b.utc_from
  AND r.created_at < b.utc_to;

ROLLBACK;