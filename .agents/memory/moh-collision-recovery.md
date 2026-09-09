---
name: MOH collision recovery
description: Safety rules for recovering a held NEXUS Pulse call after a network, SIP, or ICE interruption
---

Never auto-unhold a normally held call. Automatic return from MOH is allowed only when a network, SIP registration/transport, or ICE failure was correlated with that specific hold episode.

**Why:** Restoring WebSocket registration does not send the `sendrecv` re-INVITE Asterisk needs to stop MOH. Blindly resuming every held call would violate the agent’s intent, while overlapping hold, unhold, ICE restart, or BYE transactions can strand the SIP dialog.

**How to apply:** Serialize all session re-INVITEs through final SIP responses, scope recovery to a hold-episode token and the owning session, and preserve one ICE-restart budget per call. After auto-unhold, require fresh bidirectional RTP deltas before declaring success. Treat disconnected ICE as reversible while recovery is active; persistent one-way/no-flow owns critical escalation. Every termination path needs a bounded, session-bound teardown so a stuck re-INVITE cannot leave MOH playing.