---
name: Agent priority queue authority
description: Rules for personal Nexus Pulse contact ordering and protected built-in presets.
---

Apply a saved personal priority view only after campaign assignment and eligibility filters. The resulting first-match queue, including an unmatched eligible fallback, is authoritative for the desktop sidebar, mobile contacts, Auto, and Next.

**Why:** Applying the view directly to all pending contacts can expose contacts excluded by per-agent campaign rules, while separate queue consumers make displayed order differ from actual dialing order.

**How to apply:** Derive one eligible input pool, then one ordered queue shared by every contact-selection path. Search may inspect the complete eligible pool for direct access. Validate built-in preset IDs against canonical server-owned definitions.

The builder may preview an unsaved draft, but Auto/Next must wait for successful persistence and shared-query synchronization before using that order.

**Why:** The editor and the parent-owned dialing queue are separate consumers; optimistic activation or failed saves can make the preview promise a different next contact than the one actually selected.

**How to apply:** Lock queue actions during hydration, drafts, writes, and errors. In integration tests, derive the parent queue from persisted data rather than hardcoding the expected next contact.

City grouping is subordinate to segment priority: first-match segment → ranked city → configured within-group sort. AI rankings are approximate saved snapshots, not authoritative population figures.

**Why:** Sorting all contacts by city first lets a new contact in a large city jump ahead of a referral in a smaller city. The user requested city subgroups inside each existing group, not a replacement priority scheme.

**How to apply:** Test a lower-priority contact in a higher-ranked city against a referral in a lower-ranked city. Keep missing-city contacts and country-specific identities; allow canceling a failed ranking without trapping the agent.