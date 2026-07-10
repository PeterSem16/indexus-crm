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
  match must UNION all four id columns. BUT missions are ~99% clinics, and manual tasks
  (POST /api/tasks) only ever store `customer_id` (never `related_entity_type/id`), so a
  manual clinic task has NEITHER link → historically unattributable (accepted loss).
  The tasks that DO make numbers non-zero are the status-list **disposition** tasks:
  `related_entity_type='status_list_item'`, `related_entity_id = campaign_status_list_items.id`,
  and that table has `campaign_id`. So add
  `OR related_entity_id IN (SELECT id FROM campaign_status_list_items WHERE campaign_id=:id)`.
- **Emails / SMS**: `communication_messages` has NO clinic/hospital/collaborator FK — only a
  nullable `customer_id` (set only when recipient email matched a customer). For clinic
  missions, customer_id matching → ~0. Attribute instead by matching `recipient_email` /
  `recipient_phone` against ALL email/phone fields of the mission's contact entities via CTEs:
  clinics(email/email2/email3, phone/phone2/phone3), hospitals(email,phone),
  collaborators(email, phone/mobile/mobile_2), customers(email/email_2/gynecologist_email,
  phone/mobile/mobile_2/gynecologist_phone). Phones compared on last 9 digits
  (`right(regexp_replace(x,'[^0-9]','','g'),9)`, E.164-tolerant); drop NULL/empty & <9-digit
  values on both sides. Use `IN (SELECT v FROM cte)` (hash semi-join), never `= ANY(bigarray)`.
  `entity_campaign_timeline` does NOT log individual email/SMS sends (only dispositions/phases/
  notes/mailchimp/contact_added), so it can't count messages.
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

## Per-ENTITY variant (top-contacts leaderboard)

For a PER-CONTACT ranking (which entity got the most touches), not per-agent:
- **Calls**: `call_logs.campaign_contact_id` is a DIRECT link to a specific `campaign_contacts`
  row → the strongest per-entity attribution path. Prefer it over phone matching here.
- **Emails/SMS**: still no entity FK — reuse the per-contact address CTEs but keyed by `cc_id`
  (`SELECT cc.id, lower(email) ...`), then `COUNT(DISTINCT m.id)` per cc so multiple matching
  address columns on one contact don't multiply the count.
- **Tasks**: attribute via the direct entity-id equijoins only (UNION of 5, dedup by task id).
  Disposition tasks (`related_entity_id = status_list_item.id`) canNOT be tied to a specific
  contact (item is per-campaign, not per-contact) — so per-contact task counts are near-0 for
  clinic missions. Accepted; calls + emails/SMS carry the ranking.
- Emails/SMS CTEs are date-bounded but NOT campaign-scoped (no campaign link on the message),
  so a contact active in two concurrent campaigns counts its touches in both leaderboards.
