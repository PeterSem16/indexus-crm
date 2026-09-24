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

Forwarding evidence must survive the CRM worker, and must remain bound to the
same PBX even when transport credentials are refreshed.

**Why:** ARI handoff leaves Stasis and neither an in-memory AMI listener nor
channel polling can replay events missed during a restart. Asterisk unique IDs
are not globally unique across different PBXs; accepting a replacement server's
events can attribute another call's answer to the original caller.

**How to apply:** Replay retained, server-read CEL evidence with exact external
leg and bridge correlation. Keep unresolved calls explicit when the source is
unavailable. Installing a CEL consumer on mediagtw and deploying CRM on
CORPCRM01 are separate operator steps; a successful HTTPS response is not proof
that either the collector or controlled-call verification has run.

Historical recovery must use persisted call-time Mission metadata and skip ambiguous matches, never infer a Mission from today's queue membership or a shared customer.

**Why:** Those assignments can change and can attribute one call to the wrong Mission or duplicate an existing call.

**How to apply:** Audit first, recover only unambiguous records transactionally, and keep existing links, timestamps, and duplicate guards intact. No historical audio or transcript can be recreated merely by recovering a call-history row.

Forwarded recording recovery must use a server-persisted call-time authorization and PBX identity, not current queue or Mission settings. The queue's recording opt-out and Mission's mixed-audio policy both have to allow the capture.

**Why:** ARI completion events can be lost across a worker restart, while settings may change after the call. Retrying from memory or re-evaluating today's policy can silently lose audio or record a call without permission.

**How to apply:** Persist authorization before starting the PBX capture; replay only matching finished calls with an atomic save claim and bounded backoff. Keep a published file until the database links it, never overwrite it on duplicate completion, and never let optional recording failure end the live call.