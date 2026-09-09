---
name: MOH collision recovery
description: Safety rules for recovering a held NEXUS Pulse call after a network, SIP, or ICE interruption
---

Never auto-unhold a normally held call. Automatic return from MOH is allowed only when a network, SIP registration/transport, or ICE failure was correlated with that specific hold episode.

**Why:** Restoring WebSocket registration does not send the `sendrecv` re-INVITE Asterisk needs to stop MOH. Blindly resuming every held call would violate the agent’s intent, while overlapping hold, unhold, ICE restart, or BYE transactions can strand the SIP dialog.

**How to apply:** Serialize all session re-INVITEs through their real final SIP responses, scope recovery to a hold-episode token and the owning session, and enforce one shared session-owned ICE-restart promise/budget across every detector. Re-INVITE deadlines are informational only: they must never release the queue or send BYE while SIP.js owns a pending transaction. Suspend ordinary RTP/ICE escalation while held-call recovery owns the session. Rebind the current live receiver track after recovery, but never let rejected audio playback block ICE repair. Require fresh bidirectional RTP deltas and a settled recovery transaction before declaring success or allowing later Hold/MOH. Treat disconnected ICE as reversible while recovery is active; persistent one-way/no-flow owns critical escalation, but media health alone must never send BYE or finalize the local call. PC/ICE failed/closed and remote audio-track ended are media signals, not proof that the caller hung up. Only SIP Terminated, a session-bound server-confirmed remote hangup, or an explicit agent action owns finalization; an unconfirmed termination during a media incident is system/network, not caller-attributed.