\pset pager off
\pset null '—'
BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY;
SET LOCAL statement_timeout = '25s';

\echo '1. Misia, velkost kohorty a ulozene mapovanie'
WITH mission AS (
  SELECT c.id, c.name, c.status, c.country_codes,
    NULLIF(NULLIF(c.settings, '')::jsonb -> 'missionFunnel', 'null'::jsonb) AS funnel
  FROM campaigns c
  WHERE c.id = 'a65e7775-885c-4413-b2be-e63c92decd3d'
    AND c.name = 'Medical Partner Cooperation'
),
clinic_contacts AS (
  SELECT DISTINCT cc.clinic_id
  FROM campaign_contacts cc JOIN mission m ON m.id = cc.campaign_id
  WHERE cc.contact_type = 'clinic' AND cc.clinic_id IS NOT NULL
),
matched_calls AS (
  SELECT CASE
      WHEN cc.id IS NOT NULL AND cc.campaign_id = m.id AND cc.contact_type = 'clinic'
        AND cc.clinic_id IS NOT NULL AND (l.customer_id IS NULL OR l.customer_id = cc.clinic_id)
        THEN cc.clinic_id
      WHEN cc.id IS NULL AND l.customer_id IS NOT NULL THEN l.customer_id
      ELSE NULL
    END AS clinic_id,
    l.direction, l.status, l.answered_at, l.duration_seconds,
    l.metadata ->> 'funnelAttemptSentAt' AS attempt_marker
  FROM call_logs l
  JOIN mission m ON m.id = l.campaign_id
  LEFT JOIN campaign_contacts cc ON cc.id = l.campaign_contact_id
  WHERE
    (cc.id IS NOT NULL AND cc.campaign_id = m.id AND cc.contact_type = 'clinic'
      AND cc.clinic_id IS NOT NULL AND (l.customer_id IS NULL OR l.customer_id = cc.clinic_id))
    OR
    (cc.id IS NULL AND l.customer_id IS NOT NULL)
),
call_clinics AS (
  SELECT mc.clinic_id,
    bool_or(mc.direction = 'outbound' AND (
      mc.status IN ('ringing','answered','completed','busy','no_answer')
      OR NULLIF(mc.attempt_marker,'') IS NOT NULL
    )) AS has_outbound_attempt_candidate,
    bool_or(mc.direction = 'outbound' AND NULLIF(mc.attempt_marker,'') IS NOT NULL)
      AS has_attempt_marker,
    bool_or(mc.answered_at IS NOT NULL AND COALESCE(mc.duration_seconds,0) > 0)
      AS has_reached_call
  FROM matched_calls mc
  JOIN clinic_contacts cc ON cc.clinic_id = mc.clinic_id
  WHERE mc.clinic_id IS NOT NULL
  GROUP BY mc.clinic_id
)
SELECT m.id AS mission_id, m.name, m.status, m.country_codes,
  CASE WHEN m.funnel IS NULL THEN 'automatic suggested mapping'
       ELSE 'saved mapping' END AS mapping_mode,
  m.funnel ->> 'version' AS mapping_version,
  COALESCE((
    SELECT count(*) FROM campaign_contacts cc
    WHERE cc.campaign_id = m.id AND cc.contact_type = 'clinic'
      AND cc.clinic_id IS NOT NULL
  ), 0) AS clinic_enrollments,
  COALESCE((
    SELECT count(DISTINCT cc.clinic_id) FROM campaign_contacts cc
    WHERE cc.campaign_id = m.id AND cc.contact_type = 'clinic'
      AND cc.clinic_id IS NOT NULL
  ), 0) AS distinct_clinics,
  COALESCE((
    SELECT count(DISTINCT cc.clinic_id)
    FROM campaign_contacts cc JOIN clinics c ON c.id = cc.clinic_id
    WHERE cc.campaign_id = m.id AND cc.contact_type = 'clinic'
      AND cc.clinic_id IS NOT NULL AND c.representative_id IS NOT NULL
  ), 0) AS currently_assigned_to_coordinator,
  (SELECT count(*) FROM call_clinics WHERE has_outbound_attempt_candidate)
    AS clinics_with_outbound_attempt_candidate,
  (SELECT count(*) FROM call_clinics WHERE has_attempt_marker)
    AS clinics_with_browser_attempt_marker,
  (SELECT count(*) FROM call_clinics WHERE has_reached_call)
    AS clinics_with_technically_reached_call,
  COALESCE((
    SELECT count(*) - count(DISTINCT cc.clinic_id) FROM campaign_contacts cc
    WHERE cc.campaign_id = m.id AND cc.contact_type = 'clinic'
      AND cc.clinic_id IS NOT NULL
  ), 0) AS duplicate_clinic_enrollments,
  COALESCE(jsonb_pretty(m.funnel -> 'sources'), '{}') AS saved_source_item_ids
FROM mission m;

\echo '2. Efektivne zdroje funnela a potvrdeny/historicky stav'
WITH
mission AS (
  SELECT c.id,
    NULLIF(NULLIF(c.settings, '')::jsonb -> 'missionFunnel', 'null'::jsonb) AS funnel
  FROM campaigns c
  WHERE c.id = 'a65e7775-885c-4413-b2be-e63c92decd3d'
    AND c.name = 'Medical Partner Cooperation'
),
source_defs(source, default_step_ids, sort_order) AS (VALUES
  ('qualified', ARRAY['MPN-04b']::text[], 1),
  ('agreed', ARRAY['MPN-05c']::text[], 2),
  ('proposalAccepted', ARRAY['MPN-06d']::text[], 3),
  ('proposalUnaccepted', ARRAY['MPN-06e']::text[], 4),
  ('proposalOther', ARRAY['MPN-06a','MPN-06b','MPN-06c']::text[], 5),
  ('email', ARRAY['MPN-07b']::text[], 6),
  ('sent', ARRAY['MPN-08b']::text[], 7),
  ('received', ARRAY['MPN-10c']::text[], 8),
  ('returned', ARRAY['MPN-11a']::text[], 9),
  ('validated', ARRAY['MPN-12e']::text[], 10),
  ('activeWith', ARRAY[]::text[], 11),
  ('activeWithout', ARRAY[]::text[], 12),
  ('materials17', ARRAY['MPN-13d']::text[], 13),
  ('materials18', ARRAY['MPN-14d']::text[], 14),
  ('materials19', ARRAY['MPN-15d']::text[], 15),
  ('unqualified', ARRAY['MPN-04c']::text[], 16),
  ('refused', ARRAY['MPN-05d']::text[], 17),
  ('absent', ARRAY[]::text[], 18),
  ('wrongNumber', ARRAY[]::text[], 19),
  ('notWorking', ARRAY[]::text[], 20)
),
clinic_contacts AS (
  SELECT cc.id AS contact_id, cc.clinic_id
  FROM campaign_contacts cc
  JOIN mission m ON m.id = cc.campaign_id
  WHERE cc.contact_type = 'clinic' AND cc.clinic_id IS NOT NULL
),
mapped AS (
  SELECT s.source, i.id AS item_id, i.step_id, i.label
  FROM mission m CROSS JOIN source_defs s
  JOIN campaign_status_list_items i
    ON i.campaign_id = m.id
   AND (
     (m.funnel IS NULL AND i.step_id = ANY(s.default_step_ids))
     OR
     (m.funnel IS NOT NULL AND i.id IN (
       SELECT selected.value
       FROM jsonb_array_elements_text(
         COALESCE(m.funnel -> 'sources' -> s.source, '[]'::jsonb)
       ) AS selected(value)
     ))
   )
),
history AS (
  SELECT h.campaign_contact_id AS contact_id,
    h.metadata ->> 'statusListItemId' AS item_id,
    bool_or(h.metadata ->> 'confirmed' = 'true') AS ever_confirmed,
    bool_or(h.action = 'status_list_confirmation') AS has_history,
    min(h.created_at) FILTER (WHERE h.metadata ->> 'confirmed' = 'true') AS first_confirmed_at,
    count(*) FILTER (WHERE h.metadata ->> 'confirmed' = 'true') AS confirmed_events
  FROM campaign_contact_history h
  JOIN clinic_contacts cc ON cc.contact_id = h.campaign_contact_id
  WHERE h.action = 'status_list_confirmation'
    AND h.metadata ->> 'confirmed' IN ('true','false')
  GROUP BY h.campaign_contact_id, h.metadata ->> 'statusListItemId'
),
current_state AS (
  SELECT s.campaign_contact_id AS contact_id,
    s.status_list_item_id AS item_id
  FROM campaign_contact_status_list_state s
  JOIN clinic_contacts cc ON cc.contact_id = s.campaign_contact_id
  GROUP BY s.campaign_contact_id, s.status_list_item_id
),
contact_source AS (
  SELECT cc.contact_id, cc.clinic_id, d.source,
    COALESCE(bool_or(h.ever_confirmed), false) AS ever_confirmed,
    COALESCE(bool_or(st.item_id IS NOT NULL), false) AS currently_selected,
    COALESCE(bool_or(st.item_id IS NOT NULL AND h.contact_id IS NULL), false) AS state_only,
    min(h.first_confirmed_at) AS first_confirmed_at,
    COALESCE(sum(h.confirmed_events), 0) AS confirmed_events
  FROM clinic_contacts cc
  CROSS JOIN source_defs d
  LEFT JOIN mapped mp ON mp.source = d.source
  LEFT JOIN history h ON h.contact_id = cc.contact_id AND h.item_id = mp.item_id
  LEFT JOIN current_state st ON st.contact_id = cc.contact_id AND st.item_id = mp.item_id
  GROUP BY cc.contact_id, cc.clinic_id, d.source
),
clinic_source AS (
  SELECT clinic_id, source,
    bool_or(ever_confirmed) AS ever_confirmed,
    bool_or(currently_selected) AS currently_selected,
    bool_or(state_only) AS state_only,
    min(first_confirmed_at) AS first_confirmed_at,
    sum(confirmed_events) AS confirmed_events
  FROM contact_source
  GROUP BY clinic_id, source
),
map_summary AS (
  SELECT source, jsonb_agg(
    jsonb_build_object('itemId', item_id, 'stepId', step_id, 'label', label)
    ORDER BY step_id, item_id
  ) AS selected_items
  FROM mapped GROUP BY source
),
source_summary AS (
  SELECT source,
    count(*) FILTER (WHERE ever_confirmed) AS ever_confirmed_clinics,
    count(*) FILTER (WHERE currently_selected) AS currently_selected_clinics,
    count(*) FILTER (WHERE ever_confirmed AND NOT currently_selected) AS history_only_clinics,
    count(*) FILTER (WHERE state_only) AS state_only_clinics,
    sum(confirmed_events) AS confirmed_history_events
  FROM clinic_source GROUP BY source
),
contact_flags AS (
  SELECT clinic_id, contact_id,
    bool_or(ever_confirmed) FILTER (WHERE source = 'email') AS email_ever,
    bool_or(ever_confirmed) FILTER (WHERE source = 'sent') AS sent_ever,
    min(first_confirmed_at) FILTER (WHERE source = 'email') AS email_first,
    min(first_confirmed_at) FILTER (WHERE source = 'sent') AS sent_first,
    bool_or(ever_confirmed) FILTER (WHERE source = 'agreed') AS agreed_ever,
    bool_or(currently_selected) FILTER (WHERE source = 'agreed') AS agreed_current,
    bool_or(ever_confirmed) FILTER (WHERE source = 'proposalAccepted') AS accepted_ever,
    bool_or(currently_selected) FILTER (WHERE source = 'proposalAccepted') AS accepted_current,
    bool_or(ever_confirmed) FILTER (WHERE source = 'proposalUnaccepted') AS unaccepted_ever,
    bool_or(currently_selected) FILTER (WHERE source = 'proposalUnaccepted') AS unaccepted_current,
    bool_or(ever_confirmed) FILTER (WHERE source = 'proposalOther') AS other_ever,
    bool_or(currently_selected) FILTER (WHERE source = 'proposalOther') AS other_current,
    bool_or(ever_confirmed) FILTER (WHERE source = 'validated') AS validated_ever,
    bool_or(currently_selected) FILTER (WHERE source = 'validated') AS validated_current,
    bool_or(ever_confirmed) FILTER (WHERE source = 'activeWith') AS active_with_ever,
    bool_or(currently_selected) FILTER (WHERE source = 'activeWith') AS active_with_current,
    bool_or(ever_confirmed) FILTER (WHERE source = 'activeWithout') AS active_without_ever,
    bool_or(currently_selected) FILTER (WHERE source = 'activeWithout') AS active_without_current,
    bool_or(currently_selected) FILTER (WHERE source = 'materials17') AS materials17_current,
    bool_or(currently_selected) FILTER (WHERE source = 'materials18') AS materials18_current,
    bool_or(currently_selected) FILTER (WHERE source = 'materials19') AS materials19_current,
    bool_or(ever_confirmed) FILTER (WHERE source = 'materials17') AS materials17_ever,
    bool_or(ever_confirmed) FILTER (WHERE source = 'materials18') AS materials18_ever,
    bool_or(ever_confirmed) FILTER (WHERE source = 'materials19') AS materials19_ever
  FROM contact_source GROUP BY clinic_id, contact_id
),
clinic_flags AS (
  SELECT clinic_id,
    bool_or(email_ever) AS email_ever, bool_or(sent_ever) AS sent_ever,
    min(email_first) AS email_first, min(sent_first) AS sent_first
  FROM contact_flags GROUP BY clinic_id
),
flow_checks AS (
  SELECT
    count(DISTINCT f.clinic_id) FILTER (WHERE sent_ever AND NOT COALESCE(email_ever, false))
      AS sent_without_email_history,
    count(DISTINCT f.clinic_id) FILTER (WHERE sent_ever AND email_ever AND sent_first < email_first)
      AS email_first_confirmed_after_contract_sent,
    count(DISTINCT f.clinic_id) FILTER (WHERE
      (validated_current AND agreed_current AND (accepted_current OR other_current))
      OR (active_without_current AND agreed_current AND unaccepted_current))
      AS current_cooperation_rule_matches_same_contact,
    count(DISTINCT f.clinic_id) FILTER (WHERE
      (validated_ever AND agreed_ever AND (accepted_ever OR other_ever))
      OR (active_without_ever AND agreed_ever AND unaccepted_ever))
      AS same_contact_cooperation_ever_sources_upper_bound,
    count(DISTINCT f.clinic_id) FILTER (WHERE
      validated_current AND agreed_current AND (accepted_current OR other_current)
      AND materials17_current AND materials18_current AND materials19_current)
      AS current_materials_rule_matches_same_contact,
    count(DISTINCT f.clinic_id) FILTER (WHERE
      active_without_current AND agreed_current AND unaccepted_current
      AND materials17_current AND materials18_current AND materials19_current)
      AS current_no_contract_materials_rule_matches_same_contact,
    count(DISTINCT f.clinic_id) FILTER (WHERE
      materials17_ever AND materials18_ever AND materials19_ever)
      AS all_three_material_items_ever_confirmed_same_contact
  FROM contact_flags f
)
SELECT d.source,
  COALESCE(ms.selected_items, '[]'::jsonb) AS effective_mapped_items,
  COALESCE(ss.ever_confirmed_clinics, 0) AS ever_confirmed_clinics,
  COALESCE(ss.currently_selected_clinics, 0) AS currently_selected_clinics,
  COALESCE(ss.history_only_clinics, 0) AS history_only_clinics,
  COALESCE(ss.state_only_clinics, 0) AS state_only_clinics,
  COALESCE(ss.confirmed_history_events, 0) AS confirmed_history_events
FROM source_defs d
LEFT JOIN map_summary ms ON ms.source = d.source
LEFT JOIN source_summary ss ON ss.source = d.source
UNION ALL
SELECT '__FLOW_CHECKS__',
  jsonb_build_object(
    'sentWithoutAnyEmailConfirmation', sent_without_email_history,
    'emailConfirmedAfterContractSent', email_first_confirmed_after_contract_sent,
    'currentCooperationRuleMatchesSameContact', current_cooperation_rule_matches_same_contact,
    'sameContactEverConfirmedCooperationUpperBound', same_contact_cooperation_ever_sources_upper_bound,
    'currentContractBranchMaterialsRuleMatchesSameContact', current_materials_rule_matches_same_contact,
    'currentNoContractBranchMaterialsRuleMatchesSameContact', current_no_contract_materials_rule_matches_same_contact,
    'allThreeMaterialItemsEverConfirmedSameContact', all_three_material_items_ever_confirmed_same_contact
  ), NULL, NULL, NULL, NULL, NULL
FROM flow_checks
ORDER BY 1;

\echo '3. Polozky Status Listu vratane tych, ktore este nie su namapovane'
WITH mission AS (
  SELECT c.id
  FROM campaigns c
  WHERE c.id = 'a65e7775-885c-4413-b2be-e63c92decd3d'
    AND c.name = 'Medical Partner Cooperation'
),
clinic_contacts AS (
  SELECT cc.id AS contact_id, cc.clinic_id
  FROM campaign_contacts cc JOIN mission m ON m.id = cc.campaign_id
  WHERE cc.contact_type = 'clinic' AND cc.clinic_id IS NOT NULL
),
history_counts AS (
  SELECT h.metadata ->> 'statusListItemId' AS item_id,
    count(*) FILTER (WHERE h.metadata ->> 'confirmed' = 'true') AS confirmed_events,
    count(DISTINCT cc.clinic_id) FILTER (WHERE h.metadata ->> 'confirmed' = 'true') AS clinics_ever_confirmed,
    count(*) FILTER (WHERE h.metadata ->> 'confirmed' = 'false') AS unconfirm_events
  FROM campaign_contact_history h
  JOIN clinic_contacts cc ON cc.contact_id = h.campaign_contact_id
  WHERE h.action = 'status_list_confirmation'
    AND h.metadata ->> 'confirmed' IN ('true','false')
  GROUP BY h.metadata ->> 'statusListItemId'
),
state_counts AS (
  SELECT s.status_list_item_id AS item_id,
    count(DISTINCT cc.clinic_id) AS clinics_currently_selected
  FROM campaign_contact_status_list_state s
  JOIN clinic_contacts cc ON cc.contact_id = s.campaign_contact_id
  GROUP BY s.status_list_item_id
)
SELECT i.step_id, i.label, parent.step_id AS parent_step_id, parent.label AS parent_label,
  i.id AS item_id, i.item_type, i.confirmation_type, i.question_selection_mode,
  i.is_hidden, COALESCE(h.clinics_ever_confirmed, 0) AS clinics_ever_confirmed,
  COALESCE(s.clinics_currently_selected, 0) AS clinics_currently_selected,
  COALESCE(h.confirmed_events, 0) AS confirmed_events,
  COALESCE(h.unconfirm_events, 0) AS unconfirm_events
FROM campaign_status_list_items i
JOIN mission m ON m.id = i.campaign_id
LEFT JOIN campaign_status_list_items parent ON parent.id = i.parent_id
LEFT JOIN history_counts h ON h.item_id = i.id
LEFT JOIN state_counts s ON s.item_id = i.id
WHERE i.step_id ~ '^MPN-'
   OR lower(i.label) ~ 'escalat|contract|material|cooperat|qualified|refus|unavail|number|proposal|sent'
ORDER BY i.sort_order, i.id;

COMMIT;
