---
name: MS365 tokens encrypted at rest
description: System MS365 connection tokens must be decrypted before use with Graph API
---

System MS365 connection access/refresh tokens (storage.getSystemMs365Connection) are stored encrypted with a marker prefix.

**Rule:** Always run `decryptTokenSafe()` (server/lib/token-crypto) on `accessToken` and `refreshToken` BEFORE passing them to `getValidAccessToken()` / Graph calls. `getValidAccessToken` does NOT decrypt internally.

**Why:** Passing raw stored tokens yields Graph error "IDX14100: JWT is not well formed, there are no dots (.)". Happened in the collaborator-update email module.

**How to apply:** Any new server code sending mail via the system mailbox — copy the decrypt pattern used in server/routes.ts (~line 4606). `decryptTokenSafe` is safe on plaintext (returns as-is), so saving refreshed tokens plaintext is tolerated.
