---
name: Inactive Mission contacts
description: Visibility and outbound-call rules when an assigned Mission contact becomes inactive.
---

An assigned Mission contact that later becomes inactive must remain loadable in Nexus Pulse, including the complete card and history. Inactivity blocks outbound calling only; it must not remove the contact or hide its context.

**Why:** Agents still need historical and operational context, but calling a deactivated record can violate current Back Office decisions. Client data can also become stale while a card is open.

**How to apply:** Keep inactive records in Mission contact queries and queues. Block calls in the shared client dial flow with a calm localized notice and audio cue, and enforce the same rule from current database state when the server creates the call log.