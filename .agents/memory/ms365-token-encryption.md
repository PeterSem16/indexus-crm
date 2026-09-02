---
name: MS365 tokens encrypted at rest
description: System MS365 connection tokens must be decrypted before use with Graph API
---

System MS365 connection access/refresh tokens (storage.getSystemMs365Connection) are stored encrypted with a marker prefix.

**Rule:** Always run `decryptTokenSafe()` on stored access/refresh tokens before passing them to `getValidAccessToken()` or Graph. Encrypt every refreshed token again before persisting it.

**Why:** Passing raw stored tokens yields Graph error "IDX14100: JWT is not well formed". Persisting refreshed tokens without re-encryption violates at-rest protection. Tokens encrypted under a lost/changed key cannot be recovered and the mailbox must be reconnected.

**How to apply:** For every system, personal, or campaign mailbox flow, decrypt on read and use marker-prefixed encryption on every access/refresh token write. Convert crypto failures into a mailbox-specific reconnect message.
