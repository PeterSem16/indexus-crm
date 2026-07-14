---
name: Campaign-authored HTML rendered to other agents
description: Rules for per-campaign HTML reply signatures configured by managers but rendered/sent by agents.
---

# Per-campaign HTML reply signature

Campaign managers can configure a per-campaign HTML email-reply signature. It is stored in the campaign `settings` JSON (key `replyEmailSignatureHtml`) — NOT a new DB column, because prod deploy does not run db:push. Variables like `{{user.*}}` are filled at reply-open time via the existing client-side `replaceTemplateVars`.

## Rule: sanitize campaign-authored HTML before render/send
**Why:** the signature is authored by a campaign manager but rendered (dangerouslySetInnerHTML) and emailed on behalf of *other* agents — privilege-crossing stored XSS, not self-XSS. Stripping only `<script>` (the existing personal-signature pattern) is not enough for this cross-user path.
**How to apply:** before storing campaign HTML into the shared reply-signature state, strip script/iframe/object/embed/link/meta tags, `on*=` event handlers, and `javascript:` URLs. No sanitizer lib is installed and prod skips npm install, so use a regex sanitizer (or a Node built-in), never add a new dep.

## Rule: resolve the reply campaign from the email entry, and fetch settings FRESH
**Why:** the reply modal read the signature from the currently-*selected* campaign via the `/api/campaigns` react-query list, which uses `staleTime: Infinity` — a just-saved signature never appeared, and the selected campaign can be null or a different campaign than the email belongs to. Result: "signature applied nothing."
**How to apply:** at reply-open resolve `replyCampaignId = entry.campaignId || selectedCampaignId`, then raw-`fetch('/api/campaigns/:id')` (bypasses the stale list cache) and read `settings.replyEmailSignatureHtml`. NOTE the timeline builder (`persistentAsTimeline`) drops `campaignId` when mapping ContactHistory→TimelineEntry — you must add `campaignId` to both the TimelineEntry interface and the mapping or `entry.campaignId` is always undefined.

## Correction: for EMAILS `entry.campaignId` is ALWAYS undefined
**Why:** the `communication_messages` table (source of email/SMS history rows) has NO `campaignId` column, and the server contact-history handler only sets `campaignId` on CALL rows, never email/SMS rows. So no client mapping change can populate `entry.campaignId` for emails.

## Rule: resolve the email-reply signature server-side from the contact's campaign membership, NOT selectedCampaignId
**Why:** because emails carry no campaignId, tying the reply signature to `selectedCampaignId` silently fails whenever the agent replies while a different campaign is "selected" than the one the signature was configured on — the exact prod symptom ("I configured it, it never shows"). This is the actual bug, not expected behavior.
**How to apply:** use `GET /api/reply-signature?campaignId=<hint>&contactId=<currentContact.id>` (see `server/routes.ts`). It (1) prefers the hinted campaign, then (2) finds EVERY campaign the contact belongs to via `campaign_contacts` (search all four id cols: customer/hospital/clinic/collaborator) and returns the first with a non-empty `settings.replyEmailSignatureHtml`, ordered by `campaigns.updatedAt DESC` for determinism. The client reply-open calls this instead of fetching a single campaign. `contactId` is the entity id (hospitalId for hospital, etc.), matching the `effectiveCampaignContactId` logic. No schema column needed.

## Repro caveat: prod-only campaigns cannot be reproduced in the dev (helium/heliumdb) DB
**Why:** dev DATABASE_URL points to the Replit-managed `helium/heliumdb`, a SEPARATE database from prod CORPCRM01. Prod campaigns (e.g. "Medical Partner Cooperation") and their saved `settings.replyEmailSignatureHtml` do NOT exist in dev, so a "signature not showing" report tied to a prod campaign cannot be reproduced locally. Verify the signature is actually saved on the specific prod campaign AND the latest code is deployed (git pull + build + pm2 restart) before assuming a code bug.

## Rule: harden the sanitizer for unquoted/data URLs; share one function
**Why:** the original regex only neutralized *quoted* `javascript:` in href/src; unquoted (`href=javascript:...`) and `data:text/html` survived on this cross-agent render path. Architect flagged it as still-exploitable stored XSS.
**How to apply:** use the shared `sanitizeSignatureHtml` in `client/src/lib/sanitize-html.ts` at every sink (preview render, reply render/send) to avoid drift. Block `javascript:`/`vbscript:` on href+src (quoted, unquoted, entity/whitespace-prefixed, case-insensitive) and `data:` on href only — `data:image` base64 in `<img src>` is legitimate in signatures and cannot execute script.

## Rule: cache the personal-signature fallback in its own state
**Why:** if the effective signature state is only refetched "when null", opening reply in Campaign A (with a signature) then Campaign B (without one) reuses A's rendered signature — the fallback is skipped because state is no longer null. Cross-campaign leak.
**How to apply:** keep a separate `personalReplySignature` cache; on every reply-open recompute deterministically — campaign signature if present, else the cached personal signature (fetch once). Never reuse the previously-rendered campaign signature as the fallback.
