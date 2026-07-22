---
name: Per-campaign sender mailbox (collaborator updates)
description: How collab-update campaigns pick their MS365 sender and the PKCE quirks of the custom-mailbox connect flow
---

- senderType on collaborator_update_campaigns: system (country mailbox), own (creator's user_ms365_connections), custom (OAuth-connected mailbox, encrypted tokens on the campaign row). All send paths must go through resolveSenderAccessToken(campaign).
- The shared ms365_pkce_store carries the campaign id in the `country_code` slot for type 'collab-sender'. That column was originally varchar(10) and had to be widened to varchar(64) — UUIDs silently broke the flow otherwise.
- **Why:** reusing the existing PKCE store avoided a new table, but its columns were sized for 2-letter country codes.
- **How to apply:** any new PKCE `type` that stuffs an id into `country_code` must check the column width; the OAuth callback branch must also verify the session user matches pkceData.userId before writing credentials.
- Campaign API responses must strip senderCustomAccessToken/RefreshToken (safeCampaign helper) — tokens live on the campaign row itself.
