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
- **Calls**: do NOT rely on `call_logs.campaign_contact_id` — it is essentially never populated
  (0/9 in dev; the dialer links calls by `campaign_id` + `phone_number`, not the cc row).
  Attributing calls only via campaign_contact_id → always 0. Instead UNION three paths and
  `COUNT(DISTINCT call id)` per contact: (1) direct `campaign_contact_id = cc.id`, (2) last-9-digit
  `phone_number` match vs the contact's phones, (3) `customer_id = <any entity id>` (see below).
  All three scoped by `campaign_id` + date range.
- **Emails/SMS**: `communication_messages.customer_id` is NOT customer-only — the send paths
  (MS365 `/api/ms365/send-email-from-mailbox`, send-sms) write `customer_id = currentContact.id`
  together with a `contactType`, so for a clinic email `customer_id` holds the CLINIC id (likewise
  hospital/collaborator). There is NO separate clinic/hospital/collaborator FK and NO `recipients`
  column (Drizzle silently drops unknown cols). The MS365 path also leaves `recipient_email` empty
  (recipient lives in `metadata.recipientEmails`). So match by BOTH: recipient_email/recipient_phone
  address match, OR `customer_id IN (all entity ids of the contact)`. Build a `cc_eid` CTE mapping
  each cc row → its customer/clinic/hospital/collaborator ids; `COUNT(DISTINCT m.id)` per contact.
- **Same fix applies to the per-AGENT commAgg** (agent-productivity Detailed statistics): its
  `customer_id IN (SELECT customer_id FROM cc)` must be broadened to UNION clinic_id/hospital_id/
  collaborator_id, or clinic-mission emails show 0 in the Emails column.
- **Tasks**: attribute via the direct entity-id equijoins only (UNION of 5, dedup by task id).
  Disposition tasks (`related_entity_id = status_list_item.id`) canNOT be tied to a specific
  contact (item is per-campaign, not per-contact) — so per-contact task counts are near-0 for
  clinic missions. Accepted; calls + emails/SMS carry the ranking.
- Emails/SMS are date-bounded but NOT campaign-scoped (no campaign link on the message),
  so a contact active in two concurrent campaigns counts its touches in both leaderboards.
  Two contacts sharing a phone/email each get the same calls/messages counted (per-contact
  touches, not globally unique events) — accepted for a "most-contacted" ranking.

## Reachable vs unreachable per contact (top-contacts leaderboard)

Extending the leaderboard with a "did we actually reach them" split:
- **Reachable = answered calls (BOTH directions) + inbound email replies + inbound sms replies.**
  A call is answered when `answered_at IS NOT NULL OR COALESCE(duration_seconds,0)>0`.
  Replies = `communication_messages` with `direction='inbound'` (email matched by customer_id;
  sms matched by customer_id OR last-9 `sender_phone`). Reuse the same `call_match` (3-path)
  and `cc_eid`/`cc_phone` CTEs as the touch counts.
- **Unreachable = outbound calls not answered + NETTED unreplied outbound emails + netted sms.**
  Netting per contact: `GREATEST(0, outbound_count - inbound_count)` for email and sms
  (email_c/sms_c are already `direction='outbound'`-filtered), so reply and no-reply can't both
  count. Unreachable calls restricted to `NOT reachable AND direction='outbound'` — a missed
  INBOUND call is neither reachable nor unreachable (we didn't fail to reach them).
- Dedup: `call_match` UNION dedups the full (cc_id, id, reachable, dir) tuple so a call matched
  by >1 path counts once; email/sms use `COUNT(DISTINCT id)`.
- **Quirk (accepted):** reachable can exceed the visible calls/total columns because reachable
  counts answered INBOUND calls while calls/total are outbound-only. Also email_in has no
  sender-email path (only customer_id), so replies without a linked customer_id undercount.

## Conversion + attempts-to-reach per contact (top-contacts leaderboard)

- **Conversion** = reachable / (reachable + unreachable), computed CLIENT-side from the two
  counts already returned; zero attempts → render "—" (never divide). Pure UI, no backend change.
- **Attempts to reach** = how many unanswered/rescheduled OUTBOUND calls happened chronologically
  BEFORE the first answered call ("first reachable"), or ALL unanswered outbound calls if the
  contact was never reached. Needs backend: the `call_match` CTE had no timestamp, so add
  `ts = cl.started_at` to it, then `first_reach = MIN(ts) WHERE reachable` and
  `attempts_before = COUNT(*) WHERE NOT reachable AND dir='outbound' AND (reach_ts IS NULL OR ts < reach_ts)`.
  Also return a `reached` boolean (`first_reach.cc_id IS NOT NULL`).
- **Safe to add ts to call_match:** `ts` is functionally dependent on the call id (same
  call_logs row across all 3 UNION paths), so the UNION still dedups to identical tuples and the
  existing `reach_call`/`unreach_call` `COUNT(*)` results are unchanged. Verify this invariant
  before adding any column to a UNION'd, dedup-relied-on CTE.
- **`reached` is direction-agnostic** (an answered INBOUND call also caps the attempt count),
  matching the existing reachable definition. The whole computation is date-window scoped, so a
  reach that happened before the selected range is invisible — inherent to a date-filtered report.
- UI: colored pill — reached → check + count (emerald 0 / amber 1-2 / red 3+); never-reached-but-
  tried → red X + count; no call attempts → em-dash.

## Pagination for the leaderboard

- Endpoint takes `page` (min 1) + `pageSize` (clamp 1-100, default 10); `LIMIT/OFFSET`.
- Total for the client = `COUNT(*) OVER() AS total_count` in the SELECT — a window fn evaluates
  AFTER `WHERE total>0` but BEFORE `LIMIT/OFFSET`, so it's the full filtered count on every page.
  Read via `Number(rows[0].total_count)` (bigint returns as string); 0 when the page is empty.
- Response shape changed from a bare array to `{ contacts, total, page, pageSize }` — update BOTH
  the query type and the `?.contacts ?? []` reads on the client together.
- **ORDER BY needs a unique tiebreaker** (`total DESC, name ASC, cc.cc_id ASC`): many contacts
  tie on total and name can be NULL/dup, so without a stable key LIMIT/OFFSET pages repeat/skip
  rows non-deterministically.
- Client: put `page` in the react-query key, use `placeholderData: keepPreviousData` for smooth
  paging, reset page to 1 via `useEffect` on date-range/campaign change, and compute the global
  rank as `(page-1)*pageSize + idx` so trophy/medal styling only hits the true top 3 on page 1.
