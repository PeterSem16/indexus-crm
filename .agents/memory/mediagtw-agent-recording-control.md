---
name: Mediagtw agent-only recording control
description: Security and deployment constraints for controlling outbound agent-only recordings on mediagtw.
---

Outbound Mission agent-only recording must control mediagtw through its AMI listener bound to `127.0.0.1:5038`, reached only through the existing SSH tunnel. Use a dedicated localhost-only AMI account with `read=call` and `write=call,reporting,system`; reporting is required for channel discovery and system for MixMonitor. Never expose AMI publicly.

**Why:** mediagtw is the actual recording point. Text CLI parsing was unreliable, while structured AMI actions can bind the exact channel and start/stop the exact receive-only MixMonitor without changing SIP, trunk, routing, or caller-ID behavior. Production runs multiple PM2 workers, so process-local recording state cannot connect start and finalize requests reliably.

**How to apply:** keep authorization server-derived and fail closed on ambiguous AMI outcomes. Persist only non-secret, validated exact-call recording context so any PM2 worker can finalize; reload SSH/AMI credentials from trusted server configuration. For AMI receive-only MixMonitor, omit the `File` field entirely and use only `r(<absolute wav path>)`; Asterisk explicitly allows this and then writes no mixed stream. Do not use `File: /dev/null`, because the extensionless main output can prevent the directional WAV writer from opening even though AMI reports a successful start. Stop by channel plus MixMonitor ID, download only the exact verified receive file, then synchronously delete and verify the unique remote prefix. Replit Secrets do not propagate to the external CORPCRM01 host, so its PM2 environment must independently contain the mediagtw AMI secret and be restarted with updated environment.