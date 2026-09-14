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

City grouping is subordinate to segment priority: first-match segment → ranked city → optional referral-first partition → configured within-group sort. AI rankings are approximate saved snapshots, not authoritative population figures.

**Why:** Sorting all contacts by city first lets a new contact in a large city jump ahead of a referral in a smaller city. The user requested city subgroups inside each existing group, not a replacement priority scheme.

**How to apply:** Test a lower-priority contact in a higher-ranked city against a referral in a lower-ranked city. Keep missing-city contacts and country-specific identities; allow canceling a failed ranking without trapping the agent.

Explicit city selection is a queue constraint, not merely a display filter. Empty selection means no contacts; unresolved saved-view loading must fail closed.

**Why:** Falling back to an all-city default on an API error lets Auto dial contacts outside the agent's saved selection.

**How to apply:** Gate parent Contacts, search and dialing consumers until saved authority is known, not only the builder modal.

The Referral segment represents new, uncalled referrals, not all contacts ever referred.

**Why:** The user expects a called and rescheduled referral to leave new referrals and remain in scheduled work without duplication.

**How to apply:** Require a known zero attempt count and no existing callback scheduling; retain scheduled contacts in later matching groups or fallback.

Per-group referral-first ordering and Referral badges represent referral origin, including already called/scheduled contacts; this differs from membership in New referrals.

**Why:** The user wants referrals prioritized within each city's scheduled work too, without returning them to the new-referral group.

**How to apply:** Keep origin and new-referral eligibility separate. Default the per-group option on, persist explicit off, and sort within each partition using the group's configured sort.

New agents start with Referral + cities once a Mission supplies eligible cities; preserve existing saved settings, including retained views without a default.

**Why:** The user approved referral-first city subgroups and requested this as the first-login default, not a migration that replaces agents' personal choices.

**How to apply:** Seed only when no module views exist; city-snapshot completion must conditionally update only the still-active unchanged view. Async initialization effects must use stable input signatures, not their own pending/error state as restart dependencies, or setting pending aborts the request itself.

Explicit preset reactivation must use ordinary persistence, not the initial snapshot compare-and-swap endpoint.

**Why:** An intentionally reselected preset is inactive by definition after switching to another view; the initialization endpoint correctly rejects updating it. Ranking cancellation must compare against the requested target view, not mistake the initiating view change for a subsequent edit.

**How to apply:** Keep automatic initialization protected, but allow explicit Referral + cities save/reactivation to update its existing record. Regression-test switching away, returning, saving, and reopening with the original identity.