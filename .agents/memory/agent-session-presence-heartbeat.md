---
name: Agent presence heartbeat & desk-routing freshness gate
description: Why inbound queue desk-routing must gate on agentSessions.lastActiveAt freshness and why the presence heartbeat must be workspace-scoped, not app-wide.
---

# Inbound desk-routing must gate on session *freshness*, not just an active session

**Rule:** Queue eligibility (selectAgent + its ring-all twin getAvailableAgents, plus
hasLoggedInAgentsDb) must require the agent's `agentSessions` row to be *fresh*
(`lastActiveAt` newer than PRESENCE_STALE_MS), not merely active (status
available/break/busy, `endedAt` null). A stale, un-ended session must be excluded so
the call falls through to standing forward (mobile).

**Why:** The SIP softphone registers on app-auth alone (sip-context `canRegister` =
user.sipEnabled/sipExtension/sipPassword) — completely independent of the agent
session. So a registered/answering endpoint (PJSIP answering 180) is NOT proof the
agent is manning the queue. Sessions end ONLY via explicit endSession() — there is no
unload handler and no sweeper — so closing the tab or leaving the console leaves the
row "available" forever. Result: the desk rang instead of forwarding to mobile even
though the agent had left.

**How to apply:**
- No routing sweeper is needed. processQueues re-reads the DB every ~2s tick, so once
  the stale agent is unselectable, tryStandingForward fires on the SAME queued call.
- The presence heartbeat that refreshes `lastActiveAt` MUST be workspace-scoped
  (mounted once inside agent-workspace, gated on isSessionActive). Do NOT move it to
  AgentSessionProvider / app-wide. The actual bug is an agent whose INDEXUS is still
  open on OTHER pages (softphone still answers 180, desk rings) with a stale session.
  An app-wide heartbeat — even gated on isSessionActive — would keep that stale
  session fresh for as long as INDEXUS is open anywhere, reintroducing the bug. This
  is fundamental: both "stale forgotten session" and "on-shift agent browsing another
  page" have an active session + app open, so workspace-console presence is the only
  proxy that distinguishes them.
- **Accepted tradeoff:** an on-shift agent who leaves the workspace page for longer
  than PRESENCE_STALE_MS has inbound calls diverted to mobile. This matches "present
  at console → desk, otherwise → mobile". Status/break/activity endpoints also refresh
  lastActiveAt, so only fully-idle browsing on other pages triggers the divert.
- Heartbeat interval (30s) vs threshold (3min) is safe against background-tab timer
  throttling (~1/min) and a single missed beat; a visibilitychange->visible beat
  covers tab-return. Browser fully closed → goes stale (correct: agent unreachable).
- `lastActiveAt` is a pre-existing NOT NULL column — this change needs no db:push.
- loadAgentStates (engine startup) reads sessions ungated, but it only seeds in-memory
  queueIds; per-call eligibility always re-queries with the gate, so it is not a hole.
