---
name: Agent incoming-call alert — users↔collaborators push-token bridge
description: How the incoming-call alert reaches an agent's mobile when there is no FK between the users table (standing-forward agents) and the collaborators table (which owns the mobile push tokens).
---

# Delivering the real caller to an agent's mobile (users ↔ collaborators, no FK)

When a queue call is forwarded to an agent's mobile and the CLI is masked (see
`asterisk-forward-callerid.md`), the real caller is pushed to that agent out of band by
`alertAgentIncomingCall(...)` in `server/lib/agent-call-alert.ts`.

## The identity gap (the non-obvious part)
- Standing-forward **agents** are rows in `users` (the alert receives `userId`).
- **Mobile push tokens** (`mobile_push_tokens`) are keyed by `collaboratorId`, i.e. they belong to
  the `collaborators` table (the INDEXUS Connect mobile identity), NOT to `users`.
- **There is NO foreign key** joining a `users` row to its `collaborators` row.

**Bridge:** match the agent's forwarding mobile (`users.call_forwarding_number`, else the passed
`agentMobile`) to a collaborator by **last-9-digits** of the phone (`regexp_replace(col,'[^0-9]','','g')`
then compare the trailing 9). Last-9 == the full SK/CZ national significant number, so cross-country
collision risk is practically nil. Try `collaborators.phone`, `mobile`, and `call_forwarding_number`.
This is raw `db.execute(sql\`…\`)` (parameterised via the drizzle `sql` tag) — read `result.rows`, and
remember raw SQL bypasses the type-checker, so column names must be verified by hand.

## Three best-effort channels (order-independent, each isolated)
1. In-app web notification — `notificationService.sendNotificationToUsers([userId], {...})`.
2. Expo push to INDEXUS Connect — direct `fetch("https://exp.host/--/api/v2/push/send")`.
3. SMS — `sendTransactionalSms` from `./bulkgate`.

**Why direct `fetch` for Expo (no `expo-server-sdk`):** prod deploy is git pull + build + pm2 restart
with **no `npm install`**, so a new dependency would break the build. `fetch` is global (BulkGate already
relies on it). No schema change either (deploy does not run `db:push`).

**Rules that must hold:** every channel is wrapped in its own try/catch and the whole call is
fire-and-forget (`void alert(...).catch(()=>{})`) — it must NEVER delay or break call handling. Gate +
dedup live at the call site (see `asterisk-forward-callerid.md`): only fire when the CLI was actually
substituted, and dedup per `${callId}:${userId}` so re-rings don't re-SMS.

**PII tension:** the SMS body carries the caller's full number — normally forbidden by
`notification-pii-external-channels.md`, but here it is the explicit user requirement (deliver the real
caller both in-app AND by SMS/push), so it is accepted for this specific flow.
