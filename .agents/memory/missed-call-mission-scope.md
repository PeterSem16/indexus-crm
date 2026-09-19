---
name: Missed inbound call Mission scope
description: Authorization rule for showing and mutating missed inbound calls in multi-Mission Agent Workspace sessions.
---

Missed inbound calls are scoped by the call’s persisted Mission identity, not merely by the agent’s queue membership or the currently visible client filter. Queue-level Mission attribution is only a fallback for legacy calls without call-level identity.

**Why:** Agents may belong to multiple inbound queues during one shift. Queue membership alone caused calls from Medical Partner Cooperation to appear while FMO was selected, and client-only filtering would still leave the API and “Mark handled” mutation exposed.

**How to apply:** Badge, modal query, open-card completion, and direct “Mark handled” must all send the selected Mission. GET and mutation must verify the active shift, Mission assignment, queue membership, and call-level Mission. New queues require an explicit Mission association.