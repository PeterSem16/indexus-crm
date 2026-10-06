---
name: Mission SMS provider enforcement
description: Security boundary for enforcing a Mission-selected SMS gateway across manual and automated sends.
---

A fixed Mission SMS provider must be resolved from authoritative Mission context, not from the provider or campaign identifier supplied by the client or an editable automation action.

**Why:** Agents can reach more than one manual SMS endpoint, and a forged or omitted campaign identifier can otherwise route through a country-default provider. In multi-Mission sessions, campaign membership alone is not enough unless the recipient is also verified as a contact of that Mission.

Inbound replies may inherit a Mission only from authenticated provider correlation to a persisted outbound message. A phone match can identify one unique entity, but must never infer a Mission or notification audience.

**Why:** Duplicate phone numbers and uncorrelated provider callbacks can otherwise place reply content in the wrong Mission or notify unrelated agents.

**How to apply:** Every manual SMS route used during an active agent session must derive or validate the Mission against the session and campaign-contact membership before entering the shared provider layer. Status-list and general automation sends must pass server-originated campaign context; action configuration must not override it. Precreate every Mission outbound row and send an opaque correlation identifier where the provider supports it. Unresolved replies stay unassigned and produce no agent notification.

## Diagnosing SMSTOOLS callback failures

Distinguish failure of an incoming-SMS event from failure of another documented
event on the same callback URL before attributing an HTTP 400 alert to a missing
Mission reply.

**Why:** The official SMSTOOLS API documentation specifies credit/account events
(`warning_low_credit`, `credit_request`, `customer_state`) on the same endpoint as
`sms_state` and `received_sms`. A provider warning names the endpoint, not
necessarily the event that failed. Incoming SMS uses `response_id` for its own
identity and `msg_id` for the original outbound message; `msg_id=-1` explicitly
means no original-message match.

**How to apply:** Check redacted event-type/count logs, persisted inbound rows,
and exact original-message/Mission links separately. Keep unknown or negative
correlation unassigned rather than guessing a Mission from the phone. Reference:
https://smstools.sk/downloads/SMSTOOLS-API-dokumentacia.pdf (callback section 5).

## Delivery timing and verification

SMSTOOLS retains pending callback events for seven days and retries with delays
of five minutes, then thirty minutes, then three hours.

**Why:** The provider's service notice explicitly states this delivery policy.
Production checks also showed missing inbound rows appearing later with valid
original-message and Mission links, without an application code change.

**How to apply:** Compare the times of database checks and persisted inbound
creation, not just outbound send time. Verify receipt, original-message linkage,
Mission attribution and delivery status separately. Later HTTP 200 callbacks
prove successful processing of those deliveries, not the root cause or permanent
resolution of an earlier HTTP 400.