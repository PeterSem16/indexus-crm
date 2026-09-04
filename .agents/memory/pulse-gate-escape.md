---
name: Pulse gate escape
description: Product rule for mandatory NEXUS Pulse readiness checks.
---

The NEXUS Pulse readiness check may block Agent Workspace before work starts, but it must never trap the user or interrupt a live call / post-call wrap-up; always provide a clear route back to normal INDEXUS.

**Why:** Unmounting Agent Workspace when readiness becomes invalid also unmounts the SIP phone and sends BYE, cancelling a healthy live call. A failed check without an exit can also leave agents stuck.

**How to apply:** During connecting/ringing/active/hold and post-call work, defer invalidation, keep Agent Workspace mounted, and show only a deduplicated notification. Run the required check after the call and wrap-up finish.