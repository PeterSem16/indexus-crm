---
name: Per-campaign task & call attribution (agent productivity)
description: How to scope agent-activity reports to a single mission when tasks have no campaign_id.
---

# Per-mission agent activity attribution

The `tasks` table has NO `campaign_id`. To scope a report to ONE campaign (mission):

- **Calls**: filter `call_logs` by `campaign_id = :id` directly (it has both `campaign_id`
  and `campaign_contact_id`). For a mission-scoped "new vs repeat" classification,
  `ROW_NUMBER() OVER (PARTITION BY phone_number ...)` must run over that campaign's rows
  only, so "new = first call to that number *within this mission*".
- **Tasks**: link via `campaign_contacts` because there is no direct column. A task belongs
  to the mission if `tasks.customer_id` OR `tasks.related_entity_id` matches one of the
  campaign's contact entity ids. `campaign_contacts` is polymorphic — a contact is one of
  `customer_id / hospital_id / clinic_id / collaborator_id` (see `contact_type`), so the
  match must UNION all four id columns.
- **Agent list**: build the result strictly from `storage.getCampaignAgents(campaignId)`
  (the assigned team). Show every assigned agent even with zero activity; exclude activity
  from users not assigned to the campaign.
- Tasks are attributed by `created_by_user_id`.

**Why:** user chose "only work done within this mission" (option 1A) for the campaign
reporting tab; and the schema forces the campaign_contacts join.

**How to apply:** reuse this scoping for any future per-campaign productivity/KPI report.

**Accepted limitations (not payroll-grade):** the `related_entity_id` branch does NOT also
match `related_entity_type`, so a UUID collision across entity kinds could double-count
(negligible with UUIDs). A task against a contact shared by two campaigns counts in both.
Tighten with a type-matched pair filter only if the numbers must be exact.
