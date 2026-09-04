---
name: Pulse quick sound recheck
description: Rules for rechecking test audio without forcing a redundant full Pulse readiness run.
---

A voluntary sound-only recheck may reuse an existing valid NEXUS Pulse readiness result and allow entry after the agent confirms the test sound.

**Why:** Treating the sound-only action as a new incomplete diagnostic run disables entry even though all other required checks already passed, forcing an unnecessary full recheck.

**How to apply:** Enable the quick path only while readiness is still valid and no full diagnostic run has started. Once a full run starts, its critical results are authoritative and sound confirmation must never bypass a failure or incomplete run.