---
name: BO agent-score attribution
description: How the Back Office "My score" panel must attribute completed vs open tasks on the shared single-task queue.
---

# Back Office agent-score attribution

The BO "My score" panel (`GET /api/back-office/agent-score`) must credit a completed
task to **whoever actually finished it**, not to the nominal assignee.

- WHERE fetches rows where `assignedUserId = me OR resolvedByUserId = me OR
  confirmedByUserId = me` (the confirmation row is left-joined). The confirmer clause
  is required so legacy Done tasks that never set `resolvedByUserId` are still reachable.
- Per-row attribution in the aggregation loop:
  - **Done** → credit `resolvedByUserId ?? confirmedByUserId ?? assignedUserId`; skip the
    row if that id isn't me. This stops the nominal owner being credited for another
    agent's work.
  - **Open** (not done) → count toward `openTotal`/`openOverdue` only if
    `assignedUserId === me` (personal workload).

**Why:** BO status-list tasks are now created **once** as a single shared card assigned to a
nominal owner (`assignees[0]`), but any BO agent can confirm a received task **without
claiming it first**. Claim reassigns `assignedUserId`; confirm only sets `resolvedByUserId`.
So filtering the score purely by `assignedUserId` made the actual completer see 0 Completed
("nezobrazuje žiadne dáta") while the nominal owner got undeserved credit.

**How to apply:** Any future change to BO task ownership/claim/confirm flow, or to the score
endpoint, must keep done-credit on the resolver/confirmer and open-credit on the assignee.
Known non-blocking gap: legacy duplicate "twin" rows (pre single-task model) completed with
the same `resolvedByUserId` can inflate the count; dedupe by a stable status-list-item group
key if that ever matters.
