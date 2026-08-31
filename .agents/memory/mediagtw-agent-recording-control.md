---
name: Mediagtw agent-only recording control
description: Security and deployment constraints for controlling outbound agent-only recordings on mediagtw.
---

Outbound Mission agent-only recording must control mediagtw through its AMI listener bound to `127.0.0.1:5038`, reached only through the existing SSH tunnel. Use a dedicated least-privilege AMI account with `read=call`, `write=call`, and localhost-only ACL; never expose AMI publicly.

**Why:** mediagtw is the actual recording point. Text CLI parsing was unreliable, while structured AMI actions can bind the exact channel and start/stop the exact receive-only MixMonitor without changing SIP, trunk, routing, or caller-ID behavior.

**How to apply:** keep authorization server-derived and fail closed on ambiguous AMI outcomes. Stop by channel plus MixMonitor ID, download only the exact verified receive file, then synchronously delete and verify the unique remote prefix. Replit Secrets do not propagate to the external CORPCRM01 host, so its PM2 environment must independently contain the mediagtw AMI secret and be restarted with updated environment.