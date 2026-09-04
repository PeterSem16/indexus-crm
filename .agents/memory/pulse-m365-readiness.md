---
name: Pulse mandatory M365 readiness
description: Microsoft 365 is a global required check for every NEXUS Pulse readiness run.
---

Every NEXUS Pulse readiness run must show and require the signed-in agent's connected Microsoft 365 account, regardless of the selected Mission or its communication channel.

**Why:** Mission requirements were emitted by Agent Workspace, but the readiness gate prevented that workspace from mounting. This race intermittently omitted M365 and immediately invalidated readiness after Continue.

**How to apply:** Keep M365 in the fixed required diagnostic set, use user-scoped versioned readiness storage, and never make the check depend on Mission selection or an event emitted by gated children.