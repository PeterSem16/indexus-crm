---
name: Saved shift login sets
description: Authorization and scope rules for reusable Agent Workspace shift-login selections.
---

Saved shift-login sets are private, advisory preferences. Applying a set must intersect it with the agent's current Mission assignments, workspace-country visibility, active inbound-queue membership, and Back Office role permission. The session-start endpoint must independently re-authorize the submitted scope and reject any reduced scope.

**Why:** Access can change after a set is saved or between applying it and starting the shift. Client filtering alone permits stale or crafted selections to enter the active session.

**How to apply:** Treat the login modal selection as authoritative. Queue-only and Back Office-only shifts must send an empty Mission list and must never inherit the previously active Mission.