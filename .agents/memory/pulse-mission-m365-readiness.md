---
name: Pulse Mission-scoped M365 readiness
description: Conditional Microsoft 365 readiness rules when a NEXUS Pulse Mission sends email from the agent account.
---

NEXUS Pulse must require a connected Microsoft 365 account only for email-capable Missions configured to send from the individual user account. Phone/SMS Missions and system/custom mailbox modes must not be blocked by this check.

**Why:** A general user-level readiness result can incorrectly allow an agent into a user-mail Mission without a usable mailbox, while a global M365 requirement would wrongly block Missions that do not need the agent mailbox.

**How to apply:** Treat the selected Mission and its sender mode as part of readiness scope. Invalidate and rerun readiness when moving into or between user-mail Missions, and guard async checks so results from a previous Mission cannot acknowledge the new one.