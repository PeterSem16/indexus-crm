---
name: Recovered-call readiness invalidation
description: Rules for reconciling a deferred NEXUS Pulse readiness recheck after an active call successfully recovers.
---

When an active call survives a network/media interruption, do not present the deferred Oops/readiness gate after fresh bidirectional RTP and SIP registration have both recovered.

**Why:** Network, media, and registration recovery complete asynchronously and in either order. A boolean invalidation latch survives successful recovery, while stale PC/ICE states can create duplicate incidents and force Oops even though the conversation is working again.

**How to apply:** Correlate interruption, critical, and recovered signals with a unique episode owned by the SIP session. Reset RTP baselines when an episode starts, discard asynchronous stats that cross an episode boundary, and require multiple fresh bidirectional RTP deltas before marking media recovered. Preserve that result while registration is pending and reconcile when registration returns. Clear only network/media reasons from the same episode, never lifecycle or device-change reasons. Preserve the prior readiness result while the protected call is transiently offline.

Readiness presentation protection must cover the call, the `ended` transition, manual ACW, and timed wrap-up. Assert timed wrap-up protection synchronously before releasing call protection and clear it when the delay actually ends; do not depend on an asynchronous server status update or refetch.