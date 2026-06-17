---
name: BO board twin dedup
description: How the shared Back Office board collapses duplicate status-list tasks without hiding active/answered ones.
---

# Back Office board twin de-duplication

**Rule:** Collapse only TRUE member-twins of a SINGLE confirmation — group status-list
tasks by `relatedEntityId|customerId|title`, then cluster by `createdAt` and merge only
rows within a small time gap (TWIN_GAP_MS ≈ 15s). Never collapse all confirmations of the
same item+customer across all time.

**Why:** A single confirmation creates one task row per back-office group member, inserted
milliseconds apart in a sequential insert loop — those are the only real duplicates.
SEPARATE confirmations of the same item happen seconds-to-days apart and EACH can carry its
own question/answer thread. The old key (item+customer+title, no time) collapsed everything,
and the chosen representative was ranked done > waiting_agent > in_progress > received, so a
finished older twin SHADOWED a newer in_progress task holding the agent's answers → the
reported "agent answer doesn't show in Back Office" regression. NULL-customer entity tasks
(hospital/clinic/collaborator with no customer) are worst hit: the key loses contact identity
so all NULL confirmations of one item share a single key.

**How to apply:** The display dedup (GET /api/back-office/tasks) and the confirm-endpoint
sibling-completion cascade MUST use the SAME time window. If they diverge, confirming one
visible card will complete unrelated time-separated cards. The durable fix is to persist a
work-instance id (or campaignContact/entity identity) at task creation so neither path has to
infer twins from timestamps.
