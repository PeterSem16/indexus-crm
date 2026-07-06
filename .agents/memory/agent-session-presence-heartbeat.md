---
name: Agent presence for inbound desk routing (WebSocket, not heartbeat)
description: Desk/queue routing decides "agent present" from the live Nexus Pulse WebSocket, not a lastActiveAt freshness window.
---

# Agent presence for inbound desk routing

Inbound queue routing (`queue-engine.ts`) decides whether an agent is "present at the desk" from the LIVE Nexus Pulse WebSocket, via `inboundCallWs.isAgentConnected(userId)` — NOT from any `agentSessions.lastActiveAt` freshness window.

- The agent-workspace opens `/ws/inbound-calls?userId=X` ONLY while a shift session is active, and closes it instantly on tab-close / navigate-away-from-route / session-end (reconnects after ~5s on a network blip).
- `inboundCallWs` keeps a per-userId socket map in memory and removes the agent instantly on ws close/error. The queue engine runs in the SAME process (pm2 fork, single instance), so this in-memory signal is authoritative.
- Three routing functions gate on `isAgentConnected`: `hasLoggedInAgentsDb` (whether the no-agents action fires), `selectAgent` (which desk to ring), and `getAvailableAgents`. An agent with an active DB session but NO live socket is treated as logged-out → routing falls through to `tryStandingForward` (mobile).

**Why:** A time-based freshness window (previously 3 min + a 30s client heartbeat) was rejected by the user: a logged-out agent's call kept WAITING in queue for the whole window instead of forwarding to mobile. WS presence is instant and matches the user's mental model ("Nexus Pulse open = here, closed = gone"). The softphone/PJSIP registers on app-auth alone (not tied to the shift session), so registration cannot serve as the presence signal — the WS is the only reliable "in Nexus Pulse right now" signal.

**How to apply:** Do NOT reintroduce a `lastActiveAt`/`PRESENCE_STALE_MS` freshness gate or a session heartbeat for desk routing. If presence needs to tolerate WS blips, extend the WS layer (e.g. a brief grace period on close), not a DB-timestamp window. `agentSessions.lastActiveAt` still updates on status/break changes and is fine for stats; SessionCleanup uses `userSessions.lastActivityAt` (a DIFFERENT table), so removing the heartbeat did not affect it.

**Accepted tradeoff / edge windows:** the ~5s WS-reconnect blip and the post-deploy restart window briefly show everyone as "not present" (calls divert to mobile); an on-shift agent who navigates OFF the agent-workspace route is instantly diverted to mobile — all confirmed acceptable/desired.

**Security follow-up (pre-existing):** the `/ws/inbound-calls` upgrade handler does NOT authenticate — it trusts `?userId=` from the client. Since this socket is now the routing authority, a spoofed connection could fake presence or leak caller info. Fix: validate the session cookie in the upgrade handler and derive userId server-side.
