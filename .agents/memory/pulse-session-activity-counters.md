---
name: Pulse session activity counters
description: Product semantics and lifecycle boundaries for the NEXUS Pulse call, email, and SMS counters.
---

The NEXUS Pulse header and My Activity counters represent successful outbound actions completed during the current agent session. Calls count only after a real SIP connection; unanswered attempts and inbound calls do not count. Each connected outbound call must increment exactly once across every termination path.

**Why:** Daily Mission quota usage has a different scope and source. Mixing server-provided daily usage into the session counter made email/SMS appear correct while calls stayed at zero or changed after quota refresh. Optimistically publishing an inbound call as active before SIP acceptance also creates false connected-call signals.

**How to apply:** Keep daily quota usage isolated from session display counts. Reset display counts when a session starts or ends. Drive call increments from an idempotent connected-call lifecycle, and publish inbound active state only after SIP acceptance succeeds.