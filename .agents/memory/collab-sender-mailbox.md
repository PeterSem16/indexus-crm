---
name: Per-campaign sender mailbox (collaborator updates)
description: How collab-update campaigns pick their MS365 sender and the PKCE quirks of the custom-mailbox connect flow
---

- senderType on collaborator_update_campaigns: system (country mailbox), own (creator's user_ms365_connections), shared (shared address via the selecting user's MS365 connection), custom (OAuth-connected mailbox, encrypted tokens on the campaign row). All send paths must go through resolveSenderAccessToken(campaign).
- Shared mailboxes do not get campaign OAuth tokens. Store the validated shared address plus its owning user; re-check that it is active for that user before every send and use Graph's shared-mailbox send path.
- **Why:** a shared mailbox delegates SendAs permission to a user's MS365 identity; treating it as a separately authenticated personal mailbox uses the wrong sender model and permits stale or arbitrary From addresses.
- **How to apply:** accept only a shared-mailbox record owned by the current session user, resolve/refresh that user's MS365 connection, and never trust a client-supplied email address directly.
- The shared ms365_pkce_store carries the campaign id in the `country_code` slot for type 'collab-sender'. That column was originally varchar(10) and had to be widened to varchar(64) — UUIDs silently broke the flow otherwise.
- **Why:** reusing the existing PKCE store avoided a new table, but its columns were sized for 2-letter country codes.
- **How to apply:** any new PKCE `type` that stuffs an id into `country_code` must check the column width; the OAuth callback branch must also verify the session user matches pkceData.userId before writing credentials.
- Campaign API responses must strip senderCustomAccessToken/RefreshToken (safeCampaign helper) — tokens live on the campaign row itself.
