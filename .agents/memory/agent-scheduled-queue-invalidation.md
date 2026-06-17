---
name: Agent scheduled-call queue invalidation
description: Which react-query key backs the agent's callback queue, and why callback-scheduling mutations must invalidate it.
---

# Agent scheduled-call queue invalidation

The agent workspace scheduled-call **queue panel** is backed by react-query key
`["/api/agent/scheduled-queue"]` and the always-visible **badge count** by
`["/api/agent/scheduled-queue", "badge"]` — both hit `GET /api/agent/scheduled-queue`.

There is a *separate, different* endpoint `GET /api/agent/callbacks` that returns
only DUE callbacks assigned to the current user. Invalidating `/api/agent/callbacks`
does NOT refresh the queue panel or badge.

**Rule:** any mutation that schedules or changes a callback (status-list
`set_callback`, disposition-driven callback, manual reschedule, etc.) must
`invalidateQueries({ queryKey: ["/api/agent/scheduled-queue"] })`. React Query's
default prefix-matching means that one call also refreshes the `"badge"` subkey.

**Why:** the status-list reschedule path set the contact's
`status="callback_scheduled"` + `callbackDate` server-side but only invalidated
contacts/status-list-state/`/api/agent/callbacks`, so the rescheduled call did not
appear in the queue until a manual refresh.

**How to apply:** when wiring any "schedule a callback" UI action, invalidate the
scheduled-queue key, not (only) `/api/agent/callbacks`.

**Queue inclusion criteria (server):** `status="callback_scheduled"` AND
`callbackDate IS NOT NULL` AND `assignedTo IN (current user | "all" | NULL)`. No
date lower-bound (past + future both included). `runStatusListSetCallback` does
NOT touch `assignedTo` — intentional: changing it on reschedule would silently
steal/route ownership, so a callback on a contact owned by another specific agent
correctly surfaces only in that agent's queue.
