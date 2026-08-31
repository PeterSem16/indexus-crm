---
name: Mission recording authorization
description: Privacy boundary for Mission call recording policies and agent-only capture.
---

Mission recording authorization must be derived from server-owned Mission/contact or inbound queue state, snapshotted when the call begins, and bound to the actual SIP/ARI call. Agent-only audio must come from a trusted directional server capture; browser-provided audio, campaign IDs, snapshots, Call-IDs, and inbound IDs are not authorization.

**Why:** A browser can relabel an unrelated owned call as a recording-enabled Mission or upload mixed customer audio. Owner checks and immutable metadata alone do not prove that the recording belongs to the authorized Mission call.

**How to apply:** For outbound calls, verify campaign-contact membership and the persisted destination number, then return the server-resolved immutable policy with the new call log and make the client use that response (never its possibly stale Mission cache) to decide whether to start capture. Bind capture with a single-use server token carried on the actual SIP INVITE and verify Asterisk's observed destination. For inbound calls, derive Mission context from strict ARI queue metadata and require the assigned caller channel and agent endpoint to share the expected bridge. Any unresolved classification or mixed-only agent capture must fail closed.