---
name: Recovered-call readiness invalidation
description: Rules for reconciling a deferred NEXUS Pulse readiness recheck after an active call successfully recovers.
---

When an active call survives a network/media interruption, do not present the deferred Oops/readiness gate after fresh bidirectional RTP and SIP registration have both recovered.

**Why:** Network, media, and registration recovery complete asynchronously and in either order. A boolean invalidation latch survives successful recovery, while stale PC/ICE states can create duplicate incidents and force Oops even though the conversation is working again.

**How to apply:** Correlate interruption, critical, and recovered signals with a unique episode owned by the SIP session. Require multiple fresh bidirectional RTP deltas before marking media recovered; preserve that result while registration is pending and reconcile when registration returns. Clear only network/media/lifecycle reasons from the same episode, never device-change reasons. Suppress repeated polling of an already-acknowledged stale disconnected/failed state, but create a new episode for a genuinely later interruption.