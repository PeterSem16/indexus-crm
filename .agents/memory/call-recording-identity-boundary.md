---
name: Call recording identity boundary
description: The authority and isolation rules for SIP call recordings and their displayed contact identity.
---

Record each browser audio stream against the SIP session and immutable call identity, not mutable UI state. A delayed recorder callback must never consume a later session's audio chunks. Resolve persisted recording labels from the authorized call log and its exact contact linkage, never from multipart display fields. Give temporary uploads a unique path before the upload writes any bytes; a unique final filename alone is too late.

**Why:** Rapid successive calls can reuse stale React display names, and recorder completion and multipart file writes happen asynchronously. Either can mislabel or overwrite another call even if the playback query joins by the correct call-log ID.

**How to apply:** When changing call recording, inbound/outbound finalization, upload naming, or player metadata, preserve per-session identity through asynchronous boundaries and make the server the authority for persisted identity. Historical records need a read-only linkage audit and authorized audio review before repairing any stored associations; a mismatched label alone does not prove which call an audio file contains.