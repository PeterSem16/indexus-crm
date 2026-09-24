---
name: Mission call report parity
description: Cross-cutting checks for inbound Mission reporting across routing, recording, and delivery channels.
---

For inbound Mission reporting, treat a call's original persisted Mission as its audit identity even if it later overflows to another queue. Conflicting target-queue attribution must not authorize recording under either queue's assumed policy.

**Why:** A visible report fix alone can still misattribute calls after a cross-Mission queue overflow, or permit mixed recording under a policy that was never verified for the call.

**How to apply:** Check queue entry, no-agent paths, retry, and cross-queue overflow together. Preserve call-time evidence; fail closed on disagreement or unreadable PBX context. Do not infer historical Mission from a queue's current settings.

Full Call List display, CSV/XLSX, and emailed reports should derive from one scoped event set and share date, direction, agent, status, duplicate, and forwarded rules.

**Why:** The three delivery paths previously queried independently; fixing the visible table left missing inbound calls in exports and email.

**How to apply:** When report inclusion changes, verify all output paths, including the date-only boundary in Europe/Bratislava. Do not treat a caller channel becoming Up as proof that a mobile forward answered.