---
name: Forwarded call canonical history
description: Why mobile-forwarded calls need server-owned history independent of sessions and recordings.
---

Persist and finalize canonical call history on the server for mobile-forwarded Mission calls, independently of a browser session or recording eligibility. Mission reports must include calls outside logged-in session windows without inventing login/work time.

**Why:** Standing mobile forwarding has no browser to create its ordinary call history. Queue-only records were invisible to Calls & Transcripts, and session-driven reports excluded the mobile agent even when a call existed.

**How to apply:** Preserve the call-time Mission and actual agent identity through answer and both-leg hangup. Treat persistence and recording as separate operations; recording failures must not disconnect an established call. Protect canonical creation/finalization against early hangup and duplicate events.

The inbound caller being Up (for queue greetings/music) does not prove that the forwarded mobile answered.

**Why:** Treating handoff or caller-channel state as answer fabricates successful-call counts and talk duration.

**How to apply:** Use observed callee answer/bridge evidence. If that evidence is unavailable on a dialplan handoff, preserve an explicit forwarded outcome rather than manufacture answer timestamps.

Historical recovery must use persisted call-time Mission metadata and skip ambiguous matches, never infer a Mission from today's queue membership or a shared customer.

**Why:** Those assignments can change and can attribute one call to the wrong Mission or duplicate an existing call.

**How to apply:** Audit first, recover only unambiguous records transactionally, and keep existing links, timestamps, and duplicate guards intact. No historical audio or transcript can be recreated merely by recovering a call-history row.