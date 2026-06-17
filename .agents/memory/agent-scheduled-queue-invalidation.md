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

**Write-side invariant (zombie rows):** any server path that sets
`status="callback_scheduled"` MUST set a non-null `callbackDate` in the SAME update,
or it creates a "zombie" row that the queue silently excludes (the inclusion query
requires `callbackDate IS NOT NULL`). The status-list `set_contact_status`
(disposition→status map) path originally gated the date behind a flag
(`notifyAgentPulse`/override) while setting the status unconditionally → zombies.
**How to apply:** never set the callback status without computing a fallback date
(weekday-aware `computeStatusListCallbackDate`, default +1 business day) — there is
no valid `callback_scheduled` state with a NULL date.

**Backfill, not just the write path:** fixing the code that creates zombies does NOT
help callbacks already scheduled before the fix — they keep callback_date=NULL and
stay invisible forever. Pair the code fix with an idempotent one-time repair
(`UPDATE campaign_contacts SET callback_date = updated_at WHERE
status='callback_scheduled' AND callback_date IS NULL`) in the server/index.ts
startup block so it runs on both dev and (after redeploy) prod. Self-hosted prod
(CORPCRM01) only gets code+migrations via the documented `git pull && build && pm2
restart` — the Replit merge does NOT touch the prod server, so "still broken in
prod" usually just means it hasn't been redeployed.
